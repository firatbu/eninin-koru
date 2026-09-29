import { demoTeams } from "./js/demo.js";
import { NAME_DEFAULTS, localizeName, positionLabel, setLang, t } from "./js/i18n.js";
import {
  MODEL_DEFAULTS,
  FORMATION_IDS,
  FORMATIONS,
  GROUP_ORDER,
  sanitizeSettings,
  sanitizeTeam,
  normalizeGame,
  createGame,
  includedFootballers,
  footballerCount,
  squadValue,
  budgetRemaining,
  formatEuro,
  budgetMillions,
  currentTeam,
  cardAvailability,
  pickFootballer,
  pickCoach,
  passTurn,
  advanceTransition,
  finishDraft,
  setFormation,
  applyDrag,
  moveStarter,
  buildPrompt,
  turnLabel,
  undoDraft,
  resolveTurn,
} from "./js/rules.js";

const app = document.getElementById("app");
const PARTICLES = new Set(["de", "del", "della", "da", "dos", "das", "van", "von", "der", "den", "ten", "ter", "di", "el", "al", "st", "bin", "ibn"]);

let settings = sanitizeSettings(null);
let teams = [];
let links = [];
let game = null;
let view = "setup";
let openSquadId = "";
let scrollRestore = 0;
let urlsText = "";
let drag = null;
let press = null;
let swapSel = null;
let transitionTimer = 0;
const loadGen = new Map();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function labelName(name) {
  const clean = String(name || "").trim();
  if (clean.length <= 16) return clean;
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && PARTICLES.has(parts[parts.length - 2].toLowerCase())) {
    const compound = parts.slice(-2).join(" ");
    if (compound.length <= 18) return compound;
  }
  return parts[parts.length - 1];
}

function valueLabel(player) {
  if (player.valueText) return player.valueText;
  if (player.value == null) return "\u2014";
  return formatEuro(player.value);
}

function useLang() {
  const lang = settings.lang === "tr" ? "tr" : "en";
  settings.lang = lang;
  setLang(lang);
  document.documentElement.lang = lang;
}

function pruneSwapSel() {
  if (!swapSel || !game || !game.players || !game.players[swapSel.player]) {
    swapSel = null;
    return;
  }
  const squad = game.players[swapSel.player];
  const list = swapSel.kind === "bench" ? squad.bench : squad.xi;
  if (!list || !list[swapSel.index]) swapSel = null;
}

function errorText(error) {
  if (!error || error === "load") return t("setup.couldNotLoad");
  if (error === "empty") return t("setup.emptyResponse");
  if (error === "simulate") return t("setup.simulationFailed");
  const status = /^status:(\d+)$/.exec(error);
  if (status) return t("setup.requestFailed", { status: status[1] });
  return error;
}

function localizeLockedNames() {
  if (!game || !game.locked || !Array.isArray(game.locked.names)) return;
  const lang = settings.lang === "tr" ? "tr" : "en";
  game.locked.names = [0, 1].map((i) => localizeName(game.locked.names[i], i, lang));
}

function applyLanguage(lang) {
  settings.lang = lang === "tr" ? "tr" : "en";
  settings.names = [0, 1].map((i) => localizeName(settings.names[i], i, settings.lang));
  localizeLockedNames();
  saveSettings();
  if (game) saveGame();
  render();
}

function langSeg(compact) {
  const current = settings.lang === "tr" ? "tr" : "en";
  const buttons = ["en", "tr"].map((value) => {
    const on = current === value;
    return `<button type="button" data-action="lang" data-value="${value}" aria-pressed="${on ? "true" : "false"}">${value === "tr" ? "TR" : "EN"}</button>`;
  }).join("");
  const group = `<div class="seg${compact ? " compact" : ""} lang-switch" role="group" aria-label="${esc(t("lang.switch"))}">${buttons}</div>`;
  if (compact) return group;
  return `<div class="field"><span class="field-label">${esc(t("setup.language"))}</span>${group}</div>`;
}

function undoButton() {
  const disabled = !game || !Array.isArray(game.history) || !game.history.length;
  return `<button type="button" class="btn undo" data-action="undo" ${disabled ? "disabled" : ""} aria-label="${esc(t("game.undo"))}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6.2 3.2 3 6.4l3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.4 6.4h6.1a3.5 3.5 0 1 1 0 7H8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>${esc(t("game.undo"))}</span></button>`;
}

function pos(x, y) {
  const px = Math.min(100, Math.max(0, Number(x) || 0));
  const py = Math.min(100, Math.max(0, Number(y) || 0));
  return `left:${px}%;top:${py}%`;
}

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSettings() {
  try { localStorage.setItem("draftxi.settings", JSON.stringify(settings)); } catch { /* ignore quota */ }
}

function saveTeams() {
  try { localStorage.setItem("draftxi.teams", JSON.stringify(teams)); } catch { /* ignore quota */ }
}

function saveGame() {
  try {
    if (game) localStorage.setItem("draftxi.game", JSON.stringify(game));
    else localStorage.removeItem("draftxi.game");
  } catch { /* ignore quota */ }
}

function blankLink(url) {
  return {
    url,
    status: "loading",
    error: "",
    teamId: "",
    name: "",
    playerCount: 0,
    seasonLabel: "",
    note: "",
  };
}

function linkFromTeam(team) {
  return {
    url: team.url || "",
    status: "ok",
    error: "",
    teamId: team.id,
    name: team.name,
    playerCount: team.players.length,
    seasonLabel: team.seasonLabel,
    note: "",
  };
}

function render() {
  useLang();
  pruneSwapSel();
  if (view === "game" && !game) view = "setup";
  const active = document.activeElement;
  const focusId = active && active.id && app.contains(active) ? active.id : "";
  const sel = focusId && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null;
  const poolTop = document.querySelector(".pool")?.scrollTop || 0;
  const pageY = window.scrollY || document.documentElement.scrollTop || 0;
  const squadEl = document.querySelector(".squad-panel");
  const squadTop = squadEl ? squadEl.scrollTop : 0;
  const squadTeam = squadEl && squadEl.dataset.team ? squadEl.dataset.team : "";
  const restorePage = view === "setup";
  const token = ++scrollRestore;
  document.body.classList.toggle("draft-lock", view === "game" && game && game.phase !== "results");
  app.innerHTML = view === "game" ? gameHTML() : setupHTML();
  bindFallbacks();
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      try { el.focus({ preventScroll: true }); } catch { el.focus(); }
      if (sel && el.setSelectionRange) {
        try { el.setSelectionRange(sel[0], sel[1]); } catch { /* ignore */ }
      }
    }
  }
  const pool = document.querySelector(".pool");
  if (pool) pool.scrollTop = poolTop;
  if (!restorePage) return;
  const applyScroll = () => {
    if (token !== scrollRestore) return;
    const panel = document.querySelector(".squad-panel");
    if (panel && squadTeam && panel.dataset.team === squadTeam) panel.scrollTop = squadTop;
    window.scrollTo(0, pageY);
  };
  applyScroll();
  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(applyScroll);
  });
}

function bindFallbacks() {
  app.querySelectorAll("img[data-fallback]").forEach((img) => {
    img.addEventListener("error", () => {
      const span = document.createElement("span");
      span.className = img.dataset.fallbackClass || "initials";
      span.textContent = img.dataset.fallback || "?";
      img.replaceWith(span);
    });
  });
}

function seg(label, action, options, current) {
  const buttons = options.map((opt) => {
    const on = String(current) === String(opt.value);
    return `<button type="button" data-action="${action}" data-value="${esc(opt.value)}" aria-pressed="${on ? "true" : "false"}">${esc(opt.label)}</button>`;
  }).join("");
  return `<div class="field"><span class="field-label">${esc(label)}</span><div class="seg" role="group" aria-label="${esc(label)}">${buttons}</div></div>`;
}

function exclusionCount(team) {
  return Array.isArray(team && team.excluded) ? team.excluded.length : 0;
}

const UNDER_MILLION = 1000000;

function isUnderMillion(player) {
  const value = Number(player && player.value);
  if (!Number.isFinite(value) || value <= 0) return true;
  return value < UNDER_MILLION;
}

function underMillionWouldChange(team) {
  if (!team || !Array.isArray(team.players)) return false;
  const excluded = new Set((team.excluded || []).map((id) => String(id)));
  return team.players.some((player) => isUnderMillion(player) && !excluded.has(String(player.id)));
}

function excludeUnderMillion(team) {
  const selected = new Set((team.excluded || []).map((id) => String(id)));
  for (const player of team.players) {
    if (isUnderMillion(player)) selected.add(String(player.id));
  }
  return playerExclusionIds(team, selected);
}


function editSquadLabel(team) {
  const n = exclusionCount(team);
  if (team.coach && team.coachExcluded) return t("squad.editCoach", { n });
  return t("squad.edit", { n });
}

function teamById(id) {
  return teams.find((team) => team.id === id) || null;
}

function squadChipHTML(team, opts) {
  const pid = opts.pid != null ? ` data-pid="${esc(opts.pid)}"` : "";
  const title = opts.excluded ? t("squad.excluded", { name: opts.name }) : opts.name;
  return `<button type="button" class="squad-chip${opts.excluded ? " is-excluded" : ""}${opts.coach ? " is-coach" : ""}" data-action="${opts.action}" data-team="${esc(team.id)}"${pid} aria-pressed="${opts.excluded ? "true" : "false"}" title="${esc(title)}"><span class="squad-num">${esc(opts.num)}</span><span class="squad-name">${esc(opts.name)}</span><span class="squad-pos">${esc(opts.pos)}</span><span class="squad-val">${esc(opts.value)}</span></button>`;
}

function squadPanelHTML(team) {
  const total = team.players.length;
  const included = includedFootballers(team).length;
  const excluded = new Set((team.excluded || []).map((id) => String(id)));
  const coachOut = !!(team.coach && team.coachExcluded);
  const includeDisabled = included === total && !coachOut;
  const excludeDisabled = included === 0 && (!team.coach || coachOut);
  const underDisabled = !underMillionWouldChange(team);
  const coach = team.coach
    ? squadChipHTML(team, {
      action: "toggle-coach",
      excluded: !!team.coachExcluded,
      coach: true,
      num: "C",
      name: team.coach.name,
      pos: t("squad.coach"),
      value: "\u2014",
    })
    : "";
  const groups = GROUP_ORDER.map((group) => {
    const players = team.players.filter((player) => player.group === group);
    if (!players.length) return "";
    const chips = players.map((player) => squadChipHTML(team, {
      action: "toggle-player",
      pid: player.id,
      excluded: excluded.has(String(player.id)),
      num: player.number || "\u2013",
      name: player.name,
      pos: positionLabel(player.position),
      value: valueLabel(player),
    })).join("");
    return `<div class="squad-group"><div class="squad-group-label">${esc(t(`group.${group}`))}</div><div class="squad-chips">${chips}</div></div>`;
  }).join("");
  return `<div class="squad-panel" id="squad-${esc(team.id)}" data-team="${esc(team.id)}" role="region" aria-label="${esc(t("squad.aria", { name: team.name }))}">
      <div class="squad-sticky">
        <div class="squad-tools">
          <span class="squad-count">${esc(t("squad.count", { included, total }))}</span>
          <span class="squad-tool-actions">
            <button type="button" class="btn squad-mini" data-action="include-all" data-team="${esc(team.id)}" ${includeDisabled ? "disabled" : ""}>${esc(t("squad.includeAll"))}</button>
            <button type="button" class="btn squad-mini" data-action="exclude-under" data-team="${esc(team.id)}" ${underDisabled ? "disabled" : ""}>${esc(t("squad.excludeUnder"))}</button>
            <button type="button" class="btn squad-mini" data-action="exclude-all" data-team="${esc(team.id)}" ${excludeDisabled ? "disabled" : ""}>${esc(t("squad.excludeAll"))}</button>
          </span>
        </div>
        ${coach}
      </div>
      ${groups}
    </div>`;
}

function playerExclusionIds(team, selected) {
  const seen = new Set();
  const out = [];
  for (const player of team.players) {
    const id = String(player.id);
    if (!selected.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function saveExclusions(team, excluded, coachExcluded) {
  team.excluded = excluded;
  team.coachExcluded = !!coachExcluded && !!team.coach;
  saveTeams();
  render();
}

function setupHTML() {
  const loading = links.some((l) => l.status === "loading");
  const playable = teams.filter((team) => includedFootballers(team).length > 0).length;
  const blocked = teams.length > 0 && playable === 0;
  const startHint = blocked
    ? `<p class="hint" id="start-hint">${esc(t("setup.startBlocked"))}</p>`
    : "";
  const roundLine = game
    ? t(game.phase === "results" ? "setup.resumeResults" : "setup.resumeRound", { round: game.round + 1, total: game.teams.length })
    : "";
  const resume = game ? `<section class="resume">
      <div>
        <strong>${esc(t("setup.resumeTitle"))}</strong>
        <p>${esc(roundLine)}</p>
      </div>
      <div class="resume-actions">
        <button type="button" class="btn primary" data-action="resume">${esc(t("setup.resume"))}</button>
        <button type="button" class="btn" data-action="discard">${esc(t("setup.discard"))}</button>
      </div>
    </section>` : "";
  let squadShown = false;
  const rows = links.map((row, index) => {
    if (row.status === "loading") {
      return `<li class="status"><span class="spinner" aria-hidden="true"></span><span class="text">${esc(row.url)}</span></li>`;
    }
    if (row.status === "error") {
      return `<li class="status"><span class="mark bad">\u2717</span><span class="text">${esc(row.url)} \u2014 ${esc(errorText(row.error))}</span><span class="link-actions"><button type="button" class="btn" data-action="retry" data-index="${index}">${esc(t("setup.retry"))}</button><button type="button" class="btn" data-action="remove-link" data-index="${index}">${esc(t("setup.remove"))}</button></span></li>`;
    }
    const team = teams.find((item) => item.id === row.teamId);
    const note = row.note === "already" ? ` \u00b7 ${esc(t("setup.alreadyLoaded"))}` : "";
    if (!team) {
      return `<li class="status"><span class="mark ok">\u2713</span><span class="text"><strong>${esc(row.name)}</strong> \u00b7 ${esc(t("setup.meta", { count: row.playerCount, season: row.seasonLabel }))}${note}</span><button type="button" class="btn" data-action="remove-link" data-index="${index}">${esc(t("setup.remove"))}</button></li>`;
    }
    const open = openSquadId === team.id && !squadShown;
    if (open) squadShown = true;
    const panel = open ? squadPanelHTML(team) : "";
    return `<li class="status with-squad">
      <div class="squad-head">
        <span class="mark ok">\u2713</span>
        <span class="text"><strong>${esc(row.name)}</strong> \u00b7 ${esc(t("setup.meta", { count: row.playerCount, season: row.seasonLabel }))}${note}</span>
        <span class="link-actions">
          <button type="button" class="btn squad-edit" data-action="edit-squad" data-team="${esc(team.id)}" aria-expanded="${open ? "true" : "false"}"${open ? ` aria-controls="squad-${esc(team.id)}"` : ""}>${esc(editSquadLabel(team))}</button>
          <button type="button" class="btn" data-action="remove-link" data-index="${index}">${esc(t("setup.remove"))}</button>
        </span>
      </div>
      ${panel}
    </li>`;
  }).join("");
  const loadedKey = teams.length === 1 ? "setup.loaded" : "setup.loadedPlural";
  return `<main class="setup">
    <h1>Eninin K\u00f6r\u00fc</h1>
    <p class="lede">${esc(t("setup.lede"))}</p>
    ${resume}
    <div class="setup-grid">
      <section class="panel">
        <h2>${esc(t("setup.teams"))}</h2>
        <label class="field-label" for="urls">${esc(t("setup.links"))}</label>
        <textarea id="urls" spellcheck="false" placeholder="https://www.transfermarkt.com/fc-barcelona/kader/verein/131/saison_id/2014">${esc(urlsText)}</textarea>
        <p class="hint">${esc(t("setup.linksHint"))}</p>
        <div class="team-load">
          <button type="button" class="btn primary" data-action="load" ${loading ? "disabled" : ""}>${esc(t("setup.load"))}</button>
          <button type="button" class="btn" data-action="exclude-under-all" ${teams.some(underMillionWouldChange) ? "" : "disabled"}>${esc(t("setup.excludeUnderAll"))}</button>
          <span class="hint">${esc(t(loadedKey, { n: teams.length }))}</span>
        </div>
        <ul class="status-list" aria-live="polite">${rows}</ul>
      </section>
      <section class="panel">
        <h2>${esc(t("setup.settings"))}</h2>
        ${langSeg(false)}
        <div class="field">
          <span class="field-label">${esc(t("setup.playerNames"))}</span>
          <div class="names">
            <input id="name0" type="text" maxlength="32" aria-label="${esc(t("setup.name1"))}" value="${esc(settings.names[0])}">
            <input id="name1" type="text" maxlength="32" aria-label="${esc(t("setup.name2"))}" value="${esc(settings.names[1])}">
          </div>
        </div>
        ${seg(t("setup.display"), "display", [{ value: "names", label: t("setup.namesOnly") }, { value: "photos", label: t("setup.namesPhotos") }], settings.display)}
        ${seg(t("setup.squad"), "squad", [{ value: "11", label: t("setup.xi11") }, { value: "14", label: t("setup.xi14") }], String(settings.squad))}
        <div class="field">
          <span class="field-label">${esc(t("setup.economy"))}</span>
          <div class="budget-row">
            <div class="seg" role="group" aria-label="${esc(t("setup.economy"))}">
              <button type="button" data-action="economy" data-value="normal" aria-pressed="${settings.economy === "normal" ? "true" : "false"}">${esc(t("setup.normal"))}</button>
              <button type="button" data-action="economy" data-value="budget" aria-pressed="${settings.economy === "budget" ? "true" : "false"}">${esc(t("setup.budget"))}</button>
            </div>
            <label class="budget-field"><span>\u20acm</span>
              <input id="budget" type="number" min="0" step="any" aria-label="${esc(t("setup.budgetAria"))}" value="${esc(settings.budget)}" ${settings.economy === "budget" ? "" : "disabled"}>
            </label>
          </div>
        </div>
        ${seg(t("setup.coach"), "coach", [{ value: "0", label: t("setup.noCoach") }, { value: "1", label: t("setup.pickCoach") }], settings.coach ? "1" : "0")}
        <label class="check"><input id="shuffle" type="checkbox" ${settings.shuffle ? "checked" : ""}><span>${esc(t("setup.shuffle"))}</span></label>
        <div class="field">
          <span class="field-label">${esc(t("setup.sim"))}</span>
          <div class="seg" role="group" aria-label="${esc(t("setup.provider"))}">
            <button type="button" data-action="provider" data-value="openai" aria-pressed="${settings.sim.provider === "openai" ? "true" : "false"}">OpenAI</button>
            <button type="button" data-action="provider" data-value="gemini" aria-pressed="${settings.sim.provider === "gemini" ? "true" : "false"}">Gemini</button>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="apikey">${esc(t("setup.apiKey"))}</label>
          <input id="apikey" type="password" autocomplete="off" value="${esc(settings.sim.apiKey)}">
          <p class="hint">${esc(t("setup.apiHint"))}</p>
        </div>
        <div class="field">
          <label class="field-label" for="model">${esc(t("setup.model"))}</label>
          <input id="model" type="text" spellcheck="false" value="${esc(settings.sim.model)}">
        </div>
        <button type="button" class="btn primary xl" data-action="start" ${playable ? "" : "disabled"}${blocked ? ` aria-describedby="start-hint"` : ""}>${esc(t("setup.start"))}</button>
        ${startHint}
      </section>
    </div>
  </main>`;
}

function displaySeg() {
  return `<div class="seg compact" role="group" aria-label="${esc(t("setup.display"))}">
    <button type="button" data-action="display" data-value="names" aria-pressed="${settings.display === "names" ? "true" : "false"}">${esc(t("setup.namesOnly"))}</button>
    <button type="button" data-action="display" data-value="photos" aria-pressed="${settings.display === "photos" ? "true" : "false"}">${esc(t("setup.namesPhotos"))}</button>
  </div>`;
}

function face(person, extra) {
  const ini = esc(initials(person.name));
  const cls = extra ? `face ${extra}` : "face";
  if (settings.display === "photos" && person.image) {
    return `<span class="${cls}"><img alt="" draggable="false" referrerpolicy="no-referrer" loading="lazy" src="${esc(person.image)}" data-fallback="${ini}" data-fallback-class="initials"></span>`;
  }
  if (settings.display === "photos") {
    return `<span class="${cls}"><span class="initials">${ini}</span></span>`;
  }
  return "";
}

function tokenFace(token) {
  if (settings.display === "photos") return face(token);
  return `<span class="face"><span class="badge">${esc(token.number || token.group)}</span></span>`;
}

function crestHTML(team) {
  if (team.crest) {
    return `<img class="crest" alt="" draggable="false" referrerpolicy="no-referrer" src="${esc(team.crest)}" data-fallback="${esc(initials(team.name))}" data-fallback-class="crest fallback">`;
  }
  return `<span class="crest fallback">${esc(initials(team.name))}</span>`;
}

const LINES = `<div class="lines" aria-hidden="true"><div class="touchline"></div><div class="halfway"></div><div class="circle"></div><div class="spot"></div><div class="box pen top"></div><div class="box pen bot"></div><div class="box six top"></div><div class="box six bot"></div></div>`;

function coachSlotHTML(squad) {
  if (squad.coach) {
    return `<div class="coach-slot filled" data-kind="coach" title="${esc(squad.coach.name)}">${face(squad.coach, "xs")}<span class="coach-name">${esc(squad.coach.name)}</span></div>`;
  }
  return `<div class="coach-slot" data-kind="coach"><span class="bench-hint">${esc(t("game.coach"))}</span></div>`;
}

function benchSlotsHTML(i, squad) {
  return [0, 1, 2].map((bi) => {
    const token = squad.bench[bi];
    const selected = swapSel && swapSel.player === i && swapSel.kind === "bench" && swapSel.index === bi;
    const inner = token
      ? `<div class="bench-chip${selected ? " is-selected" : ""}" data-drag="1" data-kind="bench" data-player="${i}" data-index="${bi}">${settings.display === "photos" ? face(token, "xs") : `<span class="shirt sm">${esc(token.number || token.group)}</span>`}<span class="bname">${esc(labelName(token.name))}</span></div>`
      : `<span class="bench-hint">${esc(t("game.sub"))}</span>`;
    return `<div class="bench-slot" data-kind="bench" data-player="${i}" data-index="${bi}">${inner}</div>`;
  }).join("");
}

function bottomRowHTML(i, squad) {
  const subs = game.locked.squad === 14;
  const coach = !!game.locked.coach;
  if (!subs && !coach) return "";
  const cls = ["bottom-row"];
  if (subs) cls.push("subs");
  if (coach) cls.push("with-coach");
  if (!subs && coach) cls.push("coach-only");
  return `<div class="${cls.join(" ")}">${coach ? coachSlotHTML(squad) : ""}${subs ? benchSlotsHTML(i, squad) : ""}</div>`;
}

function sideHTML(i, results) {
  const squad = game.players[i];
  const name = game.locked.names[i];
  const active = game.phase === "draft" && game.active === i;
  const passed = game.phase === "draft" && game.passed[i];
  const slots = FORMATIONS[squad.formation] || FORMATIONS["4-3-3"];
  const holes = slots.map((slot, index) => {
    if (squad.xi[index]) return "";
    return `<div class="hole" data-kind="empty" data-player="${i}" data-index="${index}" style="${pos(slot.x, slot.y)}">${esc(slot.role)}</div>`;
  }).join("");
  const tokens = squad.xi.map((token, index) => {
    if (!token) return "";
    const selected = swapSel && swapSel.player === i && swapSel.kind === "xi" && swapSel.index === index;
    return `<div class="token${selected ? " is-selected" : ""}" data-drag="1" data-kind="xi" data-player="${i}" data-index="${index}" style="${pos(token.x, token.y)}" title="${esc(token.name)}">${tokenFace(token)}<span class="token-name">${esc(labelName(token.name))}</span></div>`;
  }).join("");
  const options = FORMATION_IDS.map((id) => `<option value="${id}"${id === squad.formation ? " selected" : ""}>${id}</option>`).join("");
  const budgetLeft = game.locked.economy === "budget"
    ? `<span class="budget-left">${esc(t("game.left", { amount: formatEuro(budgetRemaining(game, i)) }))}</span>`
    : "";
  const worth = results ? `<span class="squad-worth">${esc(t("game.squadWorth", { amount: formatEuro(squadValue(squad)) }))}</span>` : "";
  const swapClass = swapSel && swapSel.player === i ? (swapSel.kind === "bench" ? " swap-from-bench" : " swap-from-xi") : "";
  return `<section class="side s${i}${active ? " active" : ""}${swapClass}" aria-label="${esc(t("game.pitch", { name }))}">
    <div class="side-top">
      <div class="side-name">
        <h2>${esc(name)}</h2>
        ${budgetLeft}
      </div>
      ${passed ? `<span class="pill">${esc(t("game.passed"))}</span>` : ""}
      ${worth}
      <span class="count">${footballerCount(squad)}/${game.locked.squad}</span>
    </div>
    <div class="side-controls">
      <select aria-label="${esc(t("game.formation", { name }))}" data-action="formation" data-player="${i}">${options}</select>
    </div>
    <div class="pitch-frame"><div class="pitch" data-zone="pitch" data-player="${i}">${LINES}${holes}${tokens}</div></div>
    ${bottomRowHTML(i, squad)}
  </section>`;
}

function poolHTML() {
  const team = currentTeam(game);
  if (!team) return `<div class="pool"></div>`;
  let coach = "";
  if (game.locked.coach) {
    if (!team.coach) coach = `<p class="empty-note">${esc(t("game.noCoach"))}</p>`;
    else {
      const avail = cardAvailability(game, "coach");
      const open = avail.state === "open";
      const who = avail.owner >= 0 ? `<span class="who">${esc(game.locked.names[avail.owner])}</span>` : "";
      coach = `<button type="button" class="card coach${avail.owner === 0 ? " owner-0" : ""}${avail.owner === 1 ? " owner-1" : ""}" ${open ? `data-action="pick-coach"` : "disabled"} title="${esc(avail.reason)}">${face(team.coach, "sm")}<span class="card-main"><span class="card-name">${esc(team.coach.name)}</span><span class="card-pos">${esc(t("game.cardCoach"))}</span></span>${who}</button>`;
    }
  }
  const groups = GROUP_ORDER.map((group) => {
    const players = team.players.filter((p) => p.group === group);
    if (!players.length) return "";
    const cards = players.map((player) => {
      const avail = cardAvailability(game, "player", player.id);
      const open = avail.state === "open";
      const who = avail.owner >= 0 ? `<span class="who">${esc(game.locked.names[avail.owner])}</span>` : "";
      const valueCls = game.locked.economy === "budget" ? "value" : "value subtle";
      return `<button type="button" class="card${avail.owner === 0 ? " owner-0" : ""}${avail.owner === 1 ? " owner-1" : ""}" ${open ? `data-action="pick" data-pid="${esc(player.id)}"` : "disabled"} title="${esc(avail.reason)}">${face(player, "sm")}<span class="shirt">${esc(player.number || "\u2013")}</span><span class="card-main"><span class="card-name">${esc(player.name)}</span><span class="card-pos">${esc(positionLabel(player.position))}</span></span><span class="${valueCls}">${esc(valueLabel(player))}</span>${who}</button>`;
    }).join("");
    return `<div class="group-label">${esc(t(`group.${group}`))}</div><div class="cards">${cards}</div>`;
  }).join("");
  return `<div class="pool"><div class="pool-head"><span>${esc(t("game.pool"))}</span><span>${esc(t("game.poolCount", { n: team.players.length }))}</span></div>${coach}${groups}</div>`;
}

function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let list = null;
  const close = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  const inline = (s) => {
    let out = esc(s);
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+?)\*/g, "$1<em>$2</em>");
    out = out.replace(/(^|[\s(])_([^_\n]+?)_/g, "$1<em>$2</em>");
    return out;
  };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      close();
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>`;
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list !== "ul") { close(); html += "<ul>"; list = "ul"; }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (list !== "ol") { close(); html += "<ol>"; list = "ol"; }
      html += `<li>${inline(numbered[1])}</li>`;
      continue;
    }
    if (!line.trim()) { close(); continue; }
    close();
    html += `<p>${inline(line)}</p>`;
  }
  close();
  return html;
}

function simHTML() {
  const prompt = buildPrompt(game);
  const key = settings.sim.apiKey.trim();
  let body = "";
  if (!key) {
    body = `<p class="hint">${esc(t("sim.paste"))}</p><textarea id="prompt-box" class="prompt" readonly>${esc(prompt)}</textarea>`;
  } else if (game.sim.status === "loading") {
    body = `<p class="hint"><span class="spinner" aria-hidden="true"></span> ${esc(t("sim.loading"))}</p>`;
  } else if (game.sim.status === "error") {
    body = `<p class="error">${esc(errorText(game.sim.error))}</p><textarea id="prompt-box" class="prompt" readonly>${esc(prompt)}</textarea>`;
  } else if (game.sim.status === "done") {
    body = `<div class="md">${renderMarkdown(game.sim.text)}</div>`;
  } else {
    body = `<p class="hint">${esc(t("sim.idle"))}</p>`;
  }
  const simulate = key
    ? `<button type="button" class="btn primary" data-action="simulate" ${game.sim.status === "loading" ? "disabled" : ""}>${esc(t("sim.simulate"))}</button>`
    : "";
  return `<section class="sim-panel">
    <div class="sim-actions">
      ${simulate}
      <button type="button" class="btn" data-action="copy-prompt">${esc(t("sim.copy"))}</button>
      <div class="grow"></div>
      <button type="button" class="btn primary" data-action="new-game">${esc(t("sim.newGame"))}</button>
      <button type="button" class="btn" data-action="back-setup">${esc(t("sim.back"))}</button>
    </div>
    <div aria-live="polite">${body}</div>
  </section>`;
}

function gameTopHTML() {
  const team = currentTeam(game);
  const kicker = `<div class="kicker">${esc(t("game.teamOf", { n: game.round + 1, total: game.teams.length }))}</div>`;
  const club = team
    ? `<div class="team-now">${crestHTML(team)}<div class="team-copy">${kicker}<div class="team-line"><span class="club-name">${esc(team.name)}</span><span class="season">${esc(team.seasonLabel)}</span></div></div></div>`
    : `<div class="team-now"><div class="team-copy">${kicker}</div></div>`;
  const live = game.phase === "draft";
  const label = turnLabel(game);
  return `<header class="topbar">
    <div class="brand">Eninin K\u00f6r\u00fc</div>
    ${club}
    ${displaySeg()}
    ${langSeg(true)}
    <div class="turn-actions">
      <p class="turn-copy" aria-live="polite" title="${esc(label)}">${esc(label)}</p>
      <button type="button" class="btn pass s${game.active}" data-action="pass" ${live ? "" : "disabled"}>${esc(t("game.pass"))}</button>
      <button type="button" class="btn" data-action="finish">${esc(t("game.finish"))}</button>
      ${undoButton()}
    </div>
  </header>`;
}

function gameHTML() {
  if (game.phase === "results") {
    return `<main class="game">
      <header class="topbar"><div class="brand">Eninin K\u00f6r\u00fc</div>${displaySeg()}${langSeg(true)}<div class="grow"></div>${undoButton()}</header>
      <div class="results-layout">${sideHTML(0, true)}${sideHTML(1, true)}</div>
      ${simHTML()}
    </main>`;
  }
  const overlay = game.phase === "transition" ? `<div class="overlay" role="status"><div class="overlay-card">${esc(t("game.next"))}</div></div>` : "";
  return `<main class="game">
    ${gameTopHTML()}
    <div class="board">
      <div class="draft-layout">${sideHTML(0, false)}${poolHTML()}${sideHTML(1, false)}</div>
      ${overlay}
    </div>
  </main>`;
}

function scheduleTransition() {
  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => {
    if (!game || game.phase !== "transition" || view !== "game") return;
    advanceTransition(game);
    saveGame();
    render();
    if (game && game.phase === "transition" && view === "game") scheduleTransition();
  }, 850);
}

function afterAction() {
  swapSel = null;
  saveGame();
  render();
  if (game && game.phase === "transition" && view === "game") scheduleTransition();
}

function onUndo() {
  if (!game || view !== "game" || drag || press) return;
  window.clearTimeout(transitionTimer);
  if (!undoDraft(game)) return;
  swapSel = null;
  localizeLockedNames();
  saveGame();
  render();
  if (game && game.phase === "transition" && view === "game") scheduleTransition();
}

function beginGame(roster) {
  if (!Array.isArray(roster) || !roster.some((team) => includedFootballers(team).length > 0)) return;
  window.clearTimeout(transitionTimer);
  swapSel = null;
  const lang = settings.lang === "tr" ? "tr" : "en";
  settings.names = [0, 1].map((i) => {
    const name = String(settings.names[i] || "").trim();
    return name || NAME_DEFAULTS[lang][i];
  });
  settings.budget = budgetMillions(settings);
  settings.squad = Number(settings.squad) === 14 ? 14 : 11;
  saveSettings();
  game = createGame(roster, settings);
  view = "game";
  saveGame();
  render();
  if (game.phase === "transition") scheduleTransition();
}

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) throw new Error((data && data.error) || `status:${res.status}`);
  if (!data) throw new Error("empty");
  return data;
}

async function loadOne(url) {
  let row = links.find((item) => item.url === url);
  if (!row) {
    row = blankLink(url);
    links.push(row);
  }
  const gen = (loadGen.get(url) || 0) + 1;
  loadGen.set(url, gen);
  row.status = "loading";
  row.error = "";
  row.note = "";
  render();
  try {
    const team = sanitizeTeam(await postJSON("/api/team", { url }));
    if (loadGen.get(url) !== gen) return;
    const existing = teams.findIndex((item) => item.id === team.id);
    const note = existing >= 0 ? "already" : "";
    let stored = team;
    if (existing >= 0) {
      const prev = teams[existing];
      stored = sanitizeTeam({
        ...team,
        excluded: prev.excluded,
        coachExcluded: prev.coachExcluded,
      });
      teams[existing] = stored;
    } else teams.push(team);
    for (const item of links) {
      if (item.url !== url) continue;
      item.status = "ok";
      item.error = "";
      item.teamId = stored.id;
      item.name = stored.name;
      item.playerCount = stored.players.length;
      item.seasonLabel = stored.seasonLabel;
      item.note = note;
    }
    saveTeams();
  } catch (err) {
    if (loadGen.get(url) !== gen) return;
    for (const item of links) {
      if (item.url !== url) continue;
      item.status = "error";
      item.error = err && err.message ? err.message : "load";
    }
  }
  render();
}

async function runPool(items, limit, fn) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}

async function loadAll() {
  const urls = [...new Set(urlsText.split(/\n/).map((s) => s.trim()).filter(Boolean))];
  if (!urls.length || links.some((row) => row.status === "loading")) return;
  await runPool(urls, 3, loadOne);
}

function removeLink(index) {
  const row = links[index];
  if (!row) return;
  loadGen.set(row.url, (loadGen.get(row.url) || 0) + 1);
  links.splice(index, 1);
  if (row.teamId && !links.some((item) => item.teamId === row.teamId)) {
    if (openSquadId === row.teamId) openSquadId = "";
    teams = teams.filter((team) => team.id !== row.teamId);
    saveTeams();
  }
  render();
}

async function onSimulate() {
  if (!game || game.sim.status === "loading") return;
  const apiKey = settings.sim.apiKey.trim();
  if (!apiKey) return;
  const prompt = buildPrompt(game);
  game.sim = { status: "loading", text: "", error: "" };
  saveGame();
  render();
  try {
    const data = await postJSON("/api/simulate", {
      provider: settings.sim.provider,
      apiKey,
      model: settings.sim.model.trim() || MODEL_DEFAULTS[settings.sim.provider],
      prompt,
    });
    if (!data || typeof data.text !== "string") throw new Error("empty");
    game.sim = { status: "done", text: data.text, error: "" };
  } catch (err) {
    game.sim = { status: "error", text: "", error: err && err.message ? err.message : "simulate" };
  }
  saveGame();
  render();
}

async function onCopy() {
  const text = buildPrompt(game);
  const btn = document.querySelector("[data-action='copy-prompt']");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  if (btn) {
    const label = btn.querySelector("span") || btn;
    label.textContent = t("sim.copied");
    window.setTimeout(() => {
      const again = document.querySelector("[data-action='copy-prompt']");
      if (again) again.textContent = t("sim.copy");
    }, 1200);
  }
}

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  if (action === "lang") {
    const next = btn.dataset.value === "tr" ? "tr" : "en";
    if (settings.lang !== next) applyLanguage(next);
    return;
  }
  if (action === "undo") {
    onUndo();
    return;
  }
  if (action === "display") {
    settings.display = btn.dataset.value === "photos" ? "photos" : "names";
    saveSettings();
    render();
    return;
  }
  if (action === "squad") {
    settings.squad = btn.dataset.value === "14" ? 14 : 11;
    saveSettings();
    render();
    return;
  }
  if (action === "economy") {
    settings.economy = btn.dataset.value === "budget" ? "budget" : "normal";
    saveSettings();
    render();
    return;
  }
  if (action === "coach") {
    settings.coach = btn.dataset.value === "1";
    saveSettings();
    render();
    return;
  }
  if (action === "provider") {
    const provider = btn.dataset.value === "gemini" ? "gemini" : "openai";
    if (settings.sim.provider !== provider) {
      settings.sim.provider = provider;
      if (!settings.sim.modelEdited) settings.sim.model = MODEL_DEFAULTS[provider];
      saveSettings();
      render();
    }
    return;
  }
  if (action === "load") { loadAll(); return; }
  if (action === "retry") {
    const row = links[Number(btn.dataset.index)];
    if (row && row.status !== "loading") loadOne(row.url);
    return;
  }
  if (action === "remove-link") { removeLink(Number(btn.dataset.index)); return; }
  if (action === "edit-squad") {
    const id = btn.dataset.team || "";
    openSquadId = openSquadId === id ? "" : id;
    render();
    return;
  }
  if (action === "toggle-player") {
    const team = teamById(btn.dataset.team || "");
    if (!team) return;
    const selected = new Set((team.excluded || []).map((id) => String(id)));
    const id = String(btn.dataset.pid || "");
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    saveExclusions(team, playerExclusionIds(team, selected), team.coachExcluded);
    return;
  }
  if (action === "toggle-coach") {
    const team = teamById(btn.dataset.team || "");
    if (!team || !team.coach) return;
    const selected = new Set((team.excluded || []).map((id) => String(id)));
    saveExclusions(team, playerExclusionIds(team, selected), !team.coachExcluded);
    return;
  }
  if (action === "include-all") {
    const team = teamById(btn.dataset.team || "");
    if (!team) return;
    saveExclusions(team, [], false);
    return;
  }
  if (action === "exclude-all") {
    const team = teamById(btn.dataset.team || "");
    if (!team) return;
    const selected = new Set(team.players.map((player) => String(player.id)));
    saveExclusions(team, playerExclusionIds(team, selected), true);
    return;
  }
  if (action === "exclude-under") {
    const team = teamById(btn.dataset.team || "");
    if (!team || !underMillionWouldChange(team)) return;
    saveExclusions(team, excludeUnderMillion(team), team.coachExcluded);
    return;
  }
  if (action === "exclude-under-all") {
    let changed = false;
    for (const team of teams) {
      if (!underMillionWouldChange(team)) continue;
      team.excluded = excludeUnderMillion(team);
      changed = true;
    }
    if (!changed) return;
    saveTeams();
    render();
    return;
  }
  if (action === "start") {
    if (!teams.some((team) => includedFootballers(team).length > 0)) return;
    if (game && !window.confirm(t("confirm.replace"))) return;
    beginGame(teams);
    return;
  }
  if (action === "resume") {
    view = "game";
    if (game.phase === "draft") resolveTurn(game);
    saveGame();
    render();
    if (game.phase === "transition") scheduleTransition();
    return;
  }
  if (action === "discard") {
    if (!window.confirm(t("confirm.discard"))) return;
    swapSel = null;
    window.clearTimeout(transitionTimer);
    game = null;
    saveGame();
    view = "setup";
    render();
    return;
  }
  if (action === "pick") {
    if (!game || game.phase !== "draft") return;
    if (pickFootballer(game, btn.dataset.pid)) afterAction();
    return;
  }
  if (action === "pick-coach") {
    if (!game || game.phase !== "draft") return;
    if (pickCoach(game)) afterAction();
    return;
  }
  if (action === "pass") {
    if (!game || game.phase !== "draft") return;
    if (passTurn(game)) afterAction();
    return;
  }
  if (action === "finish") {
    if (!game || game.phase === "results") return;
    if (!window.confirm(t("confirm.finish"))) return;
    window.clearTimeout(transitionTimer);
    if (!finishDraft(game)) return;
    swapSel = null;
    saveGame();
    render();
    return;
  }
  if (action === "simulate") { onSimulate(); return; }
  if (action === "copy-prompt") { onCopy(); return; }
  if (action === "new-game") {
    if (!game) return;
    if (!window.confirm(t("confirm.newGame"))) return;
    const roster = game.roster && game.roster.length ? game.roster : game.teams;
    beginGame(roster);
    return;
  }
  if (action === "back-setup") {
    window.clearTimeout(transitionTimer);
    view = "setup";
    render();
  }
}

function onInput(e) {
  const target = e.target;
  if (target.id === "urls") { urlsText = target.value; return; }
  if (target.id === "name0" || target.id === "name1") {
    settings.names[target.id === "name0" ? 0 : 1] = target.value;
    saveSettings();
    return;
  }
  if (target.id === "budget") { settings.budget = target.value; saveSettings(); return; }
  if (target.id === "apikey") { settings.sim.apiKey = target.value; saveSettings(); return; }
  if (target.id === "model") {
    settings.sim.model = target.value;
    settings.sim.modelEdited = target.value.trim() !== MODEL_DEFAULTS[settings.sim.provider];
    saveSettings();
  }
}

function onChange(e) {
  const target = e.target;
  if (target.id === "shuffle") {
    settings.shuffle = target.checked;
    saveSettings();
    return;
  }
  if (target.dataset.action === "formation" && game) {
    swapSel = null;
    if (setFormation(game, Number(target.dataset.player), target.value)) {
      saveGame();
      render();
    }
  }
}

function pitchPoint(player, clientX, clientY) {
  const pitch = document.querySelector(`.pitch[data-player="${player}"]`);
  if (!pitch) return null;
  const rect = pitch.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    x: Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.min(97, Math.max(3, ((clientY - rect.top) / rect.height) * 100)),
  };
}

function resolveTarget(el, owner) {
  if (!el || el.closest(".coach-slot, [data-kind='coach']")) return null;
  const mine = (node) => node && Number(node.dataset.player) === owner;
  const bench = el.closest("[data-kind='bench']");
  if (bench && mine(bench)) {
    const index = Number(bench.dataset.index);
    if (!Number.isInteger(index)) return null;
    return { type: "bench", index };
  }
  const xi = el.closest("[data-kind='xi']");
  if (xi && mine(xi)) {
    const index = Number(xi.dataset.index);
    if (!Number.isInteger(index)) return null;
    return { type: "xi", index };
  }
  const hole = el.closest("[data-kind='empty']");
  if (hole && mine(hole)) {
    const index = Number(hole.dataset.index);
    if (!Number.isInteger(index)) return null;
    return { type: "empty", index };
  }
  const pitch = el.closest("[data-zone='pitch']");
  if (pitch && mine(pitch)) return { type: "pitch" };
  return null;
}

function elementUnder(x, y, ignore) {
  const prev = ignore.style.visibility;
  ignore.style.visibility = "hidden";
  const el = document.elementFromPoint(x, y);
  ignore.style.visibility = prev;
  return el;
}

const CLICK_SLOP = 5;
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const point = pitchPoint(drag.player, e.clientX, e.clientY);
  if (point) {
    drag.x = point.x;
    drag.y = point.y;
  }
  if (drag.kind === "xi" && point) {
    drag.el.style.left = `${point.x}%`;
    drag.el.style.top = `${point.y}%`;
  } else if (drag.ghost) {
    drag.ghost.style.left = `${e.clientX}px`;
    drag.ghost.style.top = `${e.clientY}px`;
  }
}

function beginDrag(info, e) {
  const handle = info.handle;
  if (!handle || !game) return;
  const player = Number(handle.dataset.player);
  const kind = handle.dataset.kind === "bench" ? "bench" : "xi";
  const index = Number(handle.dataset.index);
  const squad = game.players[player];
  const token = squad && (kind === "xi" ? squad.xi[index] : squad.bench[index]);
  if (!token) return;
  swapSel = null;
  const ghost = kind === "bench" ? document.createElement("div") : null;
  if (ghost) {
    ghost.className = "drag-ghost";
    ghost.textContent = labelName(token.name);
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    document.body.appendChild(ghost);
  }
  drag = {
    player,
    kind,
    index,
    pointerId: e.pointerId,
    originX: Number(token.x) || 50,
    originY: Number(token.y) || 50,
    x: Number(token.x) || 50,
    y: Number(token.y) || 50,
    el: handle,
    ghost,
  };
  handle.classList.add("is-dragging");
  document.body.classList.add("dragging");
}

function finishDrag(e) {
  const spec = drag;
  drag = null;
  document.body.classList.remove("dragging");
  if (spec && spec.ghost) spec.ghost.remove();
  let changed = false;
  if (e && game && spec && spec.el) {
    const point = pitchPoint(spec.player, e.clientX, e.clientY);
    if (point) {
      spec.x = point.x;
      spec.y = point.y;
    }
    const under = elementUnder(e.clientX, e.clientY, spec.el);
    changed = applyDrag(game, {
      player: spec.player,
      kind: spec.kind,
      index: spec.index,
      x: spec.x,
      y: spec.y,
      originX: spec.originX,
      originY: spec.originY,
      target: resolveTarget(under, spec.player),
    });
  }
  if (changed) saveGame();
  render();
}

function abortDrag() {
  const spec = drag;
  drag = null;
  document.body.classList.remove("dragging");
  if (spec && spec.ghost) spec.ghost.remove();
  render();
}

function clearSwapChrome() {
  swapSel = null;
  document.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
  document.querySelectorAll(".side.swap-from-xi, .side.swap-from-bench").forEach((el) => {
    el.classList.remove("swap-from-xi", "swap-from-bench");
  });
}

function refOf(node) {
  if (!node || !node.dataset) return null;
  const kind = node.dataset.kind === "bench" ? "bench" : node.dataset.kind === "xi" ? "xi" : null;
  if (!kind) return null;
  const index = Number(node.dataset.index);
  const player = Number(node.dataset.player);
  if (!Number.isInteger(index) || !Number.isInteger(player)) return null;
  return { player, kind, index };
}

function sameRef(a, b) {
  return !!(a && b && a.player === b.player && a.kind === b.kind && a.index === b.index);
}

function sameSquad(node) {
  return !!(swapSel && node && Number(node.dataset.player) === swapSel.player);
}

function swapTarget(info) {
  if (!swapSel) return null;
  if (swapSel.kind === "xi") {
    if (info.handle && info.handle.dataset.kind === "bench") {
      return { player: Number(info.handle.dataset.player), type: "bench", index: Number(info.handle.dataset.index) };
    }
    if (info.handle && info.handle.dataset.kind === "xi") {
      return { player: Number(info.handle.dataset.player), type: "xi", index: Number(info.handle.dataset.index) };
    }
    if (info.hole) {
      return { player: Number(info.hole.dataset.player), type: "empty", index: Number(info.hole.dataset.index) };
    }
    const slot = info.slot;
    if (slot && sameSquad(slot)) {
      return { player: Number(slot.dataset.player), type: "bench", index: Number(slot.dataset.index) };
    }
    return null;
  }
  if (info.handle && info.handle.dataset.kind === "xi") {
    return { player: Number(info.handle.dataset.player), type: "xi", index: Number(info.handle.dataset.index) };
  }
  if (info.hole) {
    return { player: Number(info.hole.dataset.player), type: "empty", index: Number(info.hole.dataset.index) };
  }
  return null;
}

function handleSwapClick(info) {
  if (!game) return;
  const ref = info.handle ? refOf(info.handle) : null;
  if (!swapSel) {
    if (!ref) return;
    swapSel = { player: ref.player, kind: ref.kind, index: ref.index };
    render();
    return;
  }
  if (ref && sameRef(swapSel, ref)) {
    swapSel = null;
    render();
    return;
  }
  const target = swapTarget(info);
  const squad = game.players[swapSel.player];
  const moving = squad && (swapSel.kind === "xi" ? squad.xi[swapSel.index] : squad.bench[swapSel.index]);
  if (target && target.player === swapSel.player && moving && Number.isInteger(target.index)) {
    const starterMove = swapSel.kind === "xi" && (target.type === "empty" || target.type === "xi");
    const changed = starterMove ? moveStarter(game, swapSel.player, swapSel.index, target) : applyDrag(game, {
      player: swapSel.player,
      kind: swapSel.kind,
      index: swapSel.index,
      x: moving.x,
      y: moving.y,
      originX: moving.x,
      originY: moving.y,
      target: { type: target.type, index: target.index },
    });
    swapSel = null;
    if (changed) saveGame();
    render();
    return;
  }
  swapSel = null;
  render();
}

function onPointerMove(e) {
  if (!press || e.pointerId !== press.pointerId) return;
  if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) {
    press.moved = true;
    // a real drag always wins over a pending click-to-move selection
    if (press.handle) {
      if (press.swapOnly) clearSwapChrome();
      beginDrag(press, e);
    }
  }
  if (drag) moveDrag(e);
}

function onPointerUp(e) {
  if (!press || !e || e.pointerId !== press.pointerId) return;
  const info = press;
  const cancelled = e.type === "pointercancel";
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
  const cap = info.handle || info.hole || info.slot;
  if (cap && cap.releasePointerCapture) {
    try { cap.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  }
  press = null;
  if (drag) {
    if (cancelled) abortDrag();
    else finishDrag(e);
    return;
  }
  if (!cancelled && !info.moved) handleSwapClick(info);
}

function onPointerDown(e) {
  if (!game || view !== "game") return;
  if (press || drag) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (e.target.closest(".coach-slot")) {
    if (swapSel) {
      swapSel = null;
      render();
    }
    return;
  }
  const handle = e.target.closest("[data-drag]");
  const hole = e.target.closest("[data-kind='empty']");
  const slot = e.target.closest(".bench-slot");
  const partner = !!(swapSel && (
    (swapSel.kind === "xi" && ((slot && sameSquad(slot)) || (hole && sameSquad(hole)) || (handle && sameSquad(handle)))) ||
    (swapSel.kind === "bench" && ((handle && handle.dataset.kind === "xi" && sameSquad(handle)) || (hole && sameSquad(hole))))
  ));
  const reclick = !!(handle && swapSel && sameRef(swapSel, refOf(handle)));
  if (!handle && !partner) {
    if (swapSel) clearSwapChrome();
    return;
  }
  e.preventDefault();
  press = {
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    handle,
    hole,
    slot: slot && (!handle || handle.dataset.kind === "bench") ? slot : null,
    moved: false,
    swapOnly: partner && !reclick,
  };
  const cap = handle || hole || slot;
  if (cap && cap.setPointerCapture) {
    try { cap.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function typingTarget(el) {
  if (!el || typeof el.closest !== "function") return false;
  if (el.closest("input, textarea, select")) return true;
  const editable = el.closest("[contenteditable]");
  return !!(editable && editable.isContentEditable);
}

function onKeyDown(e) {
  if (e.key === "Escape" && swapSel && !drag && !press) {
    swapSel = null;
    render();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "z" || e.key === "Z")) {
    if (typingTarget(e.target)) return;
    e.preventDefault();
    onUndo();
  }
}

function boot() {
  settings = sanitizeSettings(loadJSON("draftxi.settings"));
  const stored = loadJSON("draftxi.teams");
  teams = [];
  if (Array.isArray(stored)) {
    const seen = new Set();
    for (const item of stored) {
      try {
        const team = sanitizeTeam(item);
        if (seen.has(team.id)) continue;
        seen.add(team.id);
        teams.push(team);
      } catch { /* skip corrupt rows */ }
    }
  }
  if (new URLSearchParams(location.search).get("demo") === "1") {
    let changed = false;
    for (const raw of demoTeams()) {
      if (teams.some((item) => item.id === String(raw.id))) continue;
      try {
        teams.push(sanitizeTeam(raw));
        changed = true;
      } catch { /* skip invalid demo rows */ }
    }
    if (changed) saveTeams();
  }
  links = teams.map(linkFromTeam);
  urlsText = teams.map((team) => team.url).filter((url) => url && !url.startsWith("demo:")).join("\n");
  game = normalizeGame(loadJSON("draftxi.game"));
  if (game) {
    const before = game.locked.names.join("\n");
    localizeLockedNames();
    if (game.locked.names.join("\n") !== before) saveGame();
  }
  view = "setup";
  render();
}

app.addEventListener("click", onClick);
app.addEventListener("input", onInput);
app.addEventListener("change", onChange);
app.addEventListener("pointerdown", onPointerDown, { passive: false });
window.addEventListener("keydown", onKeyDown);
boot();
