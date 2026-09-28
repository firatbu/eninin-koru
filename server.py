#!/usr/bin/env python3
"""Eninin Körü local server.

Python 3.8+ standard library only. Run:  python3 server.py  [--port 8000] [--no-browser]

Serves ./public and a small JSON API:
  POST /api/team      {"url": "<transfermarkt club url>"}      -> squad of that season
  POST /api/simulate  {"provider", "apiKey", "model", "prompt"} -> {"text": "..."}
"""

import argparse
import datetime as dt
import gzip
import html
import json
import os
import re
import ssl
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import zlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
TM_BASE = "https://www.transfermarkt.com"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
MAX_BODY = 1_000_000


def _ssl_context():
    ctx = ssl.create_default_context()
    # python.org macOS builds ship without a CA bundle until "Install Certificates.command"
    # is run; the system bundle at /etc/ssl/cert.pem covers that case.
    if sys.platform == "darwin" and os.path.exists("/etc/ssl/cert.pem"):
        ctx.load_verify_locations("/etc/ssl/cert.pem")
    return ctx


SSL_CTX = _ssl_context()


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# --------------------------------------------------------------------------- HTTP client


def http_request(url, data=None, headers=None, timeout=25):
    req_headers = {"User-Agent": UA, "Accept-Encoding": "gzip, deflate"}
    req_headers.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=req_headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            return resp.status, _decode_body(resp.read(), resp.headers.get("Content-Encoding"))
    except urllib.error.HTTPError as e:
        return e.code, _decode_body(e.read(), e.headers.get("Content-Encoding"))
    except urllib.error.URLError as e:
        raise ApiError("Network error contacting %s: %s" % (urllib.parse.urlsplit(url).netloc, e.reason), 502)
    except TimeoutError:
        raise ApiError("Timed out contacting %s" % urllib.parse.urlsplit(url).netloc, 504)


def _decode_body(raw, encoding):
    if encoding == "gzip":
        raw = gzip.decompress(raw)
    elif encoding == "deflate":
        raw = zlib.decompress(raw)
    return raw.decode("utf-8", "replace")


def fetch_tm(path):
    status, body = http_request(
        TM_BASE + path,
        headers={"Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9"},
    )
    if status == 404:
        raise ApiError("Transfermarkt page not found (404). Check the link.", 404)
    if status in (403, 429):
        raise ApiError("Transfermarkt refused the request (HTTP %d). Wait a minute and retry." % status, 502)
    if status != 200:
        raise ApiError("Transfermarkt returned HTTP %d." % status, 502)
    return body


# --------------------------------------------------------------------------- Transfermarkt parsing


def text_of(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse_club_url(url):
    url = (url or "").strip()
    if not url:
        raise ApiError("Empty link.")
    if not re.match(r"https?://", url):
        url = "https://" + url
    parts = urllib.parse.urlsplit(url)
    if "transfermarkt." not in parts.netloc:
        raise ApiError("Not a Transfermarkt link.")
    m = re.search(r"/([^/]+)/[^/]+/verein/(\d+)", parts.path)
    if not m:
        raise ApiError("Link must point to a club page (…/verein/<id>…).")
    # season appears either as a path segment (/saison_id/2014) or a query param (?saison_id=2014)
    season = re.search(r"/saison_id/(\d{4})", parts.path)
    if season:
        return m.group(1), m.group(2), season.group(1)
    query = urllib.parse.parse_qs(parts.query).get("saison_id", [""])[0]
    return m.group(1), m.group(2), query if re.fullmatch(r"\d{4}", query) else None


def parse_value(txt):
    m = re.match(r"€\s*([\d.,]+)\s*(bn|m|k|Th\.|Mio\.)?", txt.strip())
    if not m:
        return None
    num = float(m.group(1).replace(",", "."))
    mult = {"bn": 1e9, "m": 1e6, "Mio.": 1e6, "k": 1e3, "Th.": 1e3}.get(m.group(2) or "", 1)
    return int(round(num * mult))


GROUP_BY_BG = {"bg_Torwart": "GK", "bg_Abwehr": "DEF", "bg_Mittelfeld": "MID", "bg_Sturm": "FWD"}


def position_group(position, bg_class):
    p = position.lower()
    if "goalkeeper" in p:
        return "GK"
    if "back" in p or "defender" in p or "sweeper" in p:
        return "DEF"
    if "midfield" in p:
        return "MID"
    if "winger" in p or "forward" in p or "striker" in p or "attack" in p:
        return "FWD"
    return GROUP_BY_BG.get(bg_class, "MID")


def season_from_title(page):
    title = re.search(r"<title>(.*?)</title>", page, re.S)
    t = title.group(1) if title else ""
    m = re.search(r"\b(\d{2})/(\d{2})\b", t)
    if m:
        return 2000 + int(m.group(1)) if int(m.group(1)) < 70 else 1900 + int(m.group(1)), True
    m = re.search(r"\b(19|20)(\d{2})\b", t)
    if m:
        return int(m.group(0)), False
    return None, True


def season_label(season, split_year):
    if not split_year:
        return str(season)
    return "%02d/%02d" % (season % 100, (season + 1) % 100)


def parse_players(page):
    start = page.find('class="items"')
    if start < 0:
        raise ApiError("Could not find a squad table on that page.", 502)
    body_start = page.find("<tbody>", start)
    depth, pos, end = 0, body_start, len(page)
    # the players table nests inline tables; walk <table> depth to find its end
    for tag in re.finditer(r"<(/?)table\b", page[body_start:]):
        if tag.group(1):
            if depth == 0:
                end = body_start + tag.start()
                break
            depth -= 1
        else:
            depth += 1
    rows = re.split(r'<tr class="(?:odd|even)">', page[body_start:end])[1:]
    players, seen = [], set()
    for row in rows:
        link = re.search(r'<td class="hauptlink">\s*<a href="/[^"]*/profil/spieler/(\d+)"[^>]*>(.*?)</a>', row, re.S)
        if not link or link.group(1) in seen:
            continue
        pid = link.group(1)
        seen.add(pid)
        name = text_of(link.group(2))
        img = re.search(r'<img[^>]+(?:data-src|src)="(https://[^"]+/portrait/[^"]+)"', row)
        image = html.unescape(img.group(1)) if img and "default" not in img.group(1) else None
        pos_m = re.search(r"</a>\s*</td>\s*</tr>\s*<tr>\s*<td>(.*?)</td>", row, re.S)
        position = text_of(pos_m.group(1)) if pos_m else ""
        bg = re.search(r"rueckennummer (bg_\w+)", row)
        num = re.search(r"rn_nummer>([^<]*)<", row)
        number = num.group(1).strip() if num else ""
        age = re.search(r'<td class="zentriert">[^<]*\((\d{1,2})\)</td>', row)
        nat = re.search(r'<img[^>]+title="([^"]+)"[^>]+class="flaggenrahmen"', row)
        val = re.search(r'<td class="rechts hauptlink">(.*?)</td>', row, re.S)
        value_text = text_of(val.group(1)) if val else ""
        value = parse_value(value_text)
        players.append({
            "id": pid,
            "name": name,
            "position": position or "Unknown",
            "group": position_group(position, bg.group(1) if bg else ""),
            "number": number if number not in ("-", "") else "",
            "value": value,
            "valueText": value_text if value is not None else "-",
            "image": image,
            "age": int(age.group(1)) if age else None,
            "nationality": html.unescape(nat.group(1)) if nat else None,
        })
    if not players:
        raise ApiError("No players found for that club/season.", 502)
    return players


def parse_date(s):
    try:
        return dt.datetime.strptime(s.strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def find_coach(slug, club_id, season, split_year):
    page = fetch_tm("/%s/mitarbeiterhistorie/verein/%s" % (slug, club_id))
    start = page.find('class="items"')
    if start < 0 or season is None:
        return None
    if split_year:
        window = (dt.date(season, 8, 1), dt.date(season + 1, 5, 31))
    else:
        window = (dt.date(season, 3, 1), dt.date(season, 11, 30))
    today = dt.date.today()
    best, best_days = None, 0
    for row in re.split(r'<tr class="(?:odd|even)">', page[start:])[1:]:
        link = re.search(r'<a title="([^"]*)" id="(\d+)" href="/[^"]*/profil/trainer/\d+"', row)
        if not link:
            continue
        dates = re.findall(r'<td class="zentriert">([^<]*)</td>', row)
        if len(dates) < 2:
            continue
        begin = parse_date(dates[0])
        finish = parse_date(dates[1]) or today
        if not begin:
            continue
        overlap = (min(finish, window[1]) - max(begin, window[0])).days
        if overlap > best_days:
            img = re.search(r'<img src="(https://[^"]+/portrait/[^"]+)"', row)
            image = html.unescape(img.group(1)).replace("/portrait/small/", "/portrait/medium/") if img else None
            if image and "default" in image:
                image = None
            best_days = overlap
            best = {"id": link.group(2), "name": html.unescape(link.group(1)), "image": image}
    return best


_cache = {}
_cache_lock = threading.Lock()


def load_team(url):
    slug, club_id, season_param = parse_club_url(url)
    key = (club_id, season_param)
    with _cache_lock:
        if key in _cache:
            return _cache[key]
    path = "/%s/kader/verein/%s%s/plus/1" % (slug, club_id, "/saison_id/%s" % season_param if season_param else "")
    page = fetch_tm(path)
    season, split_year = season_from_title(page)
    if season_param:
        season = int(season_param)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    name = text_of(h1.group(1)) if h1 else slug.replace("-", " ").title()
    crest = re.search(r'<img src="(https://[^"]+/wappen/head/[^"]+)"', page)
    players = parse_players(page)
    try:
        coach = find_coach(slug, club_id, season, split_year)
    except ApiError:
        coach = None  # squad is still usable without the manager
    team = {
        "id": "%s-%s" % (club_id, season),
        "clubId": club_id,
        "name": name,
        "season": season,
        "seasonLabel": season_label(season, split_year) if season else "",
        "crest": html.unescape(crest.group(1)) if crest else None,
        "url": TM_BASE + path,
        "players": players,
        "coach": coach,
    }
    with _cache_lock:
        _cache[key] = team
    return team


# --------------------------------------------------------------------------- LLM proxy


def simulate(provider, api_key, model, prompt):
    if not api_key:
        raise ApiError("Missing API key.")
    if not prompt:
        raise ApiError("Missing prompt.")
    if provider == "openai":
        status, body = http_request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps({"model": model or "gpt-6-luna", "messages": [{"role": "user", "content": prompt}]}).encode(),
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + api_key},
            timeout=180,
        )
        payload = _json_or_error(status, body, "OpenAI")
        try:
            return payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise ApiError("Unexpected OpenAI response.", 502)
    if provider == "gemini":
        status, body = http_request(
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent"
            % urllib.parse.quote(model or "gemini-3.8-flash", safe=""),
            data=json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}]}).encode(),
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            timeout=180,
        )
        payload = _json_or_error(status, body, "Gemini")
        try:
            parts = payload["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts if not p.get("thought"))
        except (KeyError, IndexError, TypeError):
            raise ApiError("Unexpected Gemini response (possibly blocked).", 502)
    raise ApiError("Unknown provider '%s'." % provider)


def _json_or_error(status, body, name):
    try:
        payload = json.loads(body)
    except ValueError:
        raise ApiError("%s returned HTTP %d with a non-JSON body." % (name, status), 502)
    if status != 200:
        err = payload.get("error") if isinstance(payload, dict) else None
        msg = err.get("message") if isinstance(err, dict) else err
        raise ApiError("%s error (HTTP %d): %s" % (name, status, msg or body[:300]), 502)
    return payload


# --------------------------------------------------------------------------- HTTP server


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            sys.stderr.write("%s %s\n" % (self.command, fmt % args))

    def do_POST(self):
        routes = {"/api/team": self._team, "/api/simulate": self._simulate}
        route = routes.get(urllib.parse.urlsplit(self.path).path)
        if not route:
            return self._json(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                raise ApiError("Request too large.", 413)
            data = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(data, dict):
                raise ApiError("Expected a JSON object.")
            self._json(200, route(data))
        except ApiError as e:
            self._json(e.status, {"error": str(e)})
        except ValueError:
            self._json(400, {"error": "Invalid JSON."})
        except Exception as e:  # keep the server alive and report
            self._json(500, {"error": "Server error: %s" % e})

    def _team(self, data):
        return load_team(data.get("url"))

    def _simulate(self, data):
        return {"text": simulate(data.get("provider"), data.get("apiKey"), data.get("model"), data.get("prompt"))}

    def _json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    ap = argparse.ArgumentParser(description="Eninin Körü local server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    # 127.0.0.1 keeps the local game private; hosting (Render) sets HOST=0.0.0.0
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    server = None
    # a hosting platform assigns one exact port; locally, step past busy ports
    ports = [args.port] if "PORT" in os.environ else range(args.port, args.port + 20)
    for port in ports:
        try:
            server = ThreadingHTTPServer((args.host, port), Handler)
            break
        except OSError:
            continue
    if server is None:
        sys.exit("No free port found near %d." % args.port)
    url = "http://localhost:%d" % server.server_address[1]
    print("Eninin Körü running at %s  (Ctrl+C to stop)" % url, flush=True)
    if not args.no_browser:
        threading.Timer(0.6, webbrowser.open, (url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
