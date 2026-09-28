# Eninin Körü

Two players draft football squads from Transfermarkt teams, one hidden team at a time, then simulate the match with an LLM.

## Run (macOS)

Needs only `python3` (preinstalled via Xcode Command Line Tools, or from python.org). No packages to install.

```bash
cd path/to/this/folder
python3 server.py            # opens http://localhost:8000
```

Or double-click `start.command` in Finder (first time: `chmod +x start.command`).

Options: `--port 9000`, `--no-browser`.

## How to play

1. Paste Transfermarkt club links, one per line, and click **Load teams**. Any club page on any Transfermarkt domain works (`…/startseite/verein/131`, `…/kader/verein/131/saison_id/2014`, `…/kader/verein/131/plus/0/galerie/0?saison_id=2004`). If the link has a season (`saison_id`), you get that season's squad, market values and coach. Without it, you get the current season.
   Use **Edit squad** on a loaded team to leave out footballers (or that team's coach) before the draft. **Exclude under €1m** (per team, or for all teams at once) leaves out every player valued under €1m or with no value. You can still click any of them back in. Exclusions are saved with the team.
2. Pick your settings, then click **Start draft**. The teams are shuffled and each one stays hidden until its turn.
3. Team 1: Player 1 picks first. Team 2: Player 2 picks first, and so on. Players take turns picking one footballer at a time or passing. Once a player passes, the other can keep picking as long as they want. The next team comes up when both have passed.
4. Change the formation from the dropdown. You can drag players anywhere on your pitch. Or click a player, then click an empty position (LW, ST, LB…) to move him there, another starter to swap their places, or a sub slot to send him to the bench (and vice versa for subs).
   Misclicked a player? **Undo** (top right, or Ctrl/Cmd+Z) reverts the last pick or pass, including one that ended the draft.
5. On the results screen, click **Simulate match** if you set an API key. Otherwise, copy the prompt and paste it into ChatGPT, Gemini or Claude.

## Settings

| Setting | Options |
|---|---|
| Display | Names only / Names + photos (can also be switched during the game) |
| Squad | Starting XI (11) / XI + 3 subs (14) |
| Economy | Normal / Budget (€m per player, based on Transfermarkt market value for that season) |
| Coach | No coach / Pick a coach (that season's head coach appears in the pool, free) |
| Simulation | OpenAI or Gemini API key + model (defaults `gpt-6-luna`, `gemini-3.8-flash`) |
| Language | EN / TR switch in settings and in the game's top bar; the match prompt follows the language |

Settings, loaded teams and a game in progress are saved in the browser (localStorage), so you can refresh without losing anything. API keys stay on your machine. They are only sent to the local server, which passes them to OpenAI or Gemini.

## Hosting on Render

`render.yaml` describes a free Python web service in Frankfurt. It has no build step, and the start command is `python3 server.py --no-browser` with `HOST=0.0.0.0`. Render supplies `PORT`.

1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo, then **Apply**.
3. Open `https://<service>.onrender.com`. Free services sleep after about 15 minutes idle, so the first visit after a break takes around a minute.

Locally nothing changes: without `HOST`/`PORT`, the server only listens on `127.0.0.1`.

Transfermarkt's website blocks most hosting providers (Render gets HTTP 405). When that happens, `server.py` switches to Transfermarkt's JSON API (`tmapi-alpha.transfermarkt.technology`). You get the same squads, positions, shirt numbers and season market values, with these differences:
- A team takes about 5–15 seconds to load instead of 1–2.
- Coaches are only available for the current season.
- Market values for calendar-year leagues (MLS, Brazil, Scandinavia) can differ slightly from the website.

## Files

- `server.py`: static server, Transfermarkt scraper (`POST /api/team`), LLM proxy (`POST /api/simulate`). Standard library only.
- `public/index.html`, `public/styles.css`, `public/app.js`: UI.
- `public/js/rules.js`: draft rules, formations, prompt builder.
- `public/js/demo.js`: offline demo teams. Open `http://localhost:8000/?demo=1`.
