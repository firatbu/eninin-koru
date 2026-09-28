/** Draft rules, formations, saved-state cleanup, and the match prompt. */

import { NAME_DEFAULTS, detectLang, localizeName, positionLabel, t, translatePitchRole } from "./i18n.js";

export const MODEL_DEFAULTS = {
  openai: "gpt-6-luna",
  gemini: "gemini-3.8-flash",
};

const HISTORY_LIMIT = 200;

export const FORMATION_IDS = [
  "4-3-3",
  "4-4-2",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
  "5-4-1",
];

/** Vertical pitch, attacking up. x/y are percentages. */
export const FORMATIONS = {
  "4-3-3": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 14, y: 72, group: "DEF", role: "LB" },
    { x: 36, y: 76, group: "DEF", role: "LCB" },
    { x: 64, y: 76, group: "DEF", role: "RCB" },
    { x: 86, y: 72, group: "DEF", role: "RB" },
    { x: 30, y: 50, group: "MID", role: "LCM" },
    { x: 50, y: 52, group: "MID", role: "CM" },
    { x: 70, y: 50, group: "MID", role: "RCM" },
    { x: 16, y: 20, group: "FWD", role: "LW" },
    { x: 50, y: 16, group: "FWD", role: "ST" },
    { x: 84, y: 20, group: "FWD", role: "RW" },
  ],
  "4-4-2": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 14, y: 72, group: "DEF", role: "LB" },
    { x: 36, y: 76, group: "DEF", role: "LCB" },
    { x: 64, y: 76, group: "DEF", role: "RCB" },
    { x: 86, y: 72, group: "DEF", role: "RB" },
    { x: 14, y: 48, group: "MID", role: "LM" },
    { x: 38, y: 52, group: "MID", role: "LCM" },
    { x: 62, y: 52, group: "MID", role: "RCM" },
    { x: 86, y: 48, group: "MID", role: "RM" },
    { x: 38, y: 18, group: "FWD", role: "LS" },
    { x: 62, y: 18, group: "FWD", role: "RS" },
  ],
  "4-2-3-1": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 14, y: 74, group: "DEF", role: "LB" },
    { x: 36, y: 78, group: "DEF", role: "LCB" },
    { x: 64, y: 78, group: "DEF", role: "RCB" },
    { x: 86, y: 74, group: "DEF", role: "RB" },
    { x: 38, y: 60, group: "MID", role: "CDM" },
    { x: 62, y: 60, group: "MID", role: "CDM" },
    { x: 16, y: 38, group: "MID", role: "LAM" },
    { x: 50, y: 36, group: "MID", role: "CAM" },
    { x: 84, y: 38, group: "MID", role: "RAM" },
    { x: 50, y: 16, group: "FWD", role: "ST" },
  ],
  "3-5-2": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 30, y: 76, group: "DEF", role: "LCB" },
    { x: 50, y: 78, group: "DEF", role: "CB" },
    { x: 70, y: 76, group: "DEF", role: "RCB" },
    { x: 12, y: 48, group: "MID", role: "LWB" },
    { x: 32, y: 54, group: "MID", role: "CM" },
    { x: 50, y: 40, group: "MID", role: "CAM" },
    { x: 68, y: 54, group: "MID", role: "CM" },
    { x: 88, y: 48, group: "MID", role: "RWB" },
    { x: 38, y: 18, group: "FWD", role: "LS" },
    { x: 62, y: 18, group: "FWD", role: "RS" },
  ],
  "3-4-3": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 30, y: 76, group: "DEF", role: "LCB" },
    { x: 50, y: 78, group: "DEF", role: "CB" },
    { x: 70, y: 76, group: "DEF", role: "RCB" },
    { x: 14, y: 48, group: "MID", role: "LM" },
    { x: 38, y: 52, group: "MID", role: "LCM" },
    { x: 62, y: 52, group: "MID", role: "RCM" },
    { x: 86, y: 48, group: "MID", role: "RM" },
    { x: 16, y: 20, group: "FWD", role: "LW" },
    { x: 50, y: 15, group: "FWD", role: "ST" },
    { x: 84, y: 20, group: "FWD", role: "RW" },
  ],
  "5-3-2": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 12, y: 68, group: "DEF", role: "LWB" },
    { x: 30, y: 76, group: "DEF", role: "LCB" },
    { x: 50, y: 78, group: "DEF", role: "CB" },
    { x: 70, y: 76, group: "DEF", role: "RCB" },
    { x: 88, y: 68, group: "DEF", role: "RWB" },
    { x: 32, y: 48, group: "MID", role: "CM" },
    { x: 50, y: 52, group: "MID", role: "CM" },
    { x: 68, y: 48, group: "MID", role: "CM" },
    { x: 38, y: 18, group: "FWD", role: "LS" },
    { x: 62, y: 18, group: "FWD", role: "RS" },
  ],
  "4-1-4-1": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 14, y: 74, group: "DEF", role: "LB" },
    { x: 36, y: 78, group: "DEF", role: "LCB" },
    { x: 64, y: 78, group: "DEF", role: "RCB" },
    { x: 86, y: 74, group: "DEF", role: "RB" },
    { x: 50, y: 60, group: "MID", role: "CDM" },
    { x: 14, y: 42, group: "MID", role: "LM" },
    { x: 38, y: 46, group: "MID", role: "LCM" },
    { x: 62, y: 46, group: "MID", role: "RCM" },
    { x: 86, y: 42, group: "MID", role: "RM" },
    { x: 50, y: 16, group: "FWD", role: "ST" },
  ],
  "5-4-1": [
    { x: 50, y: 90, group: "GK", role: "GK" },
    { x: 12, y: 68, group: "DEF", role: "LWB" },
    { x: 30, y: 76, group: "DEF", role: "LCB" },
    { x: 50, y: 78, group: "DEF", role: "CB" },
    { x: 70, y: 76, group: "DEF", role: "RCB" },
    { x: 88, y: 68, group: "DEF", role: "RWB" },
    { x: 14, y: 46, group: "MID", role: "LM" },
    { x: 38, y: 50, group: "MID", role: "LCM" },
    { x: 62, y: 50, group: "MID", role: "RCM" },
    { x: 86, y: 46, group: "MID", role: "RM" },
    { x: 50, y: 16, group: "FWD", role: "ST" },
  ],
};

export const GROUP_ORDER = ["GK", "DEF", "MID", "FWD"];

export const GROUP_LABELS = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

export function defaultSettings() {
  const lang = detectLang();
  return {
    lang,
    names: NAME_DEFAULTS[lang].slice(),
    display: "names",
    squad: 11,
    economy: "normal",
    budget: 250,
    coach: false,
    shuffle: true,
    sim: {
      provider: "openai",
      apiKey: "",
      model: MODEL_DEFAULTS.openai,
      modelEdited: false,
    },
  };
}

export function budgetMillions(settings) {
  const n = Number(settings && settings.budget);
  if (!Number.isFinite(n) || n < 0) return 250;
  return n;
}

export function sanitizeSettings(raw) {
  const d = defaultSettings();
  if (!raw || typeof raw !== "object") return d;
  d.lang = raw.lang === "en" || raw.lang === "tr" ? raw.lang : d.lang;
  const names = Array.isArray(raw.names) ? raw.names : [];
  d.names = [0, 1].map((i) => String(names[i] ?? "").slice(0, 40));
  if (!d.names[0] && names[0] == null) d.names[0] = NAME_DEFAULTS[d.lang][0];
  if (!d.names[1] && names[1] == null) d.names[1] = NAME_DEFAULTS[d.lang][1];
  d.names = [0, 1].map((i) => localizeName(d.names[i], i, d.lang));
  d.display = raw.display === "photos" ? "photos" : "names";
  d.squad = Number(raw.squad) === 14 ? 14 : 11;
  d.economy = raw.economy === "budget" ? "budget" : "normal";
  d.budget = budgetMillions(raw);
  d.coach = !!raw.coach;
  d.shuffle = raw.shuffle !== false;
  const provider = raw.sim && raw.sim.provider === "gemini" ? "gemini" : "openai";
  d.sim.provider = provider;
  d.sim.apiKey = raw.sim && raw.sim.apiKey != null ? String(raw.sim.apiKey) : "";
  d.sim.modelEdited = !!(raw.sim && raw.sim.modelEdited);
  const model = raw.sim && raw.sim.model != null ? String(raw.sim.model).trim() : "";
  d.sim.model = d.sim.modelEdited && model ? model : MODEL_DEFAULTS[provider];
  return d;
}

export function safeUrl(url) {
  const s = String(url || "").trim();
  if (/^https:\/\//i.test(s)) return s;
  return null;
}

function normalizeGroup(player) {
  const g = String(player.group || "").toUpperCase();
  if (g === "GK" || g === "DEF" || g === "MID" || g === "FWD") return g;
  const pos = String(player.position || "").toLowerCase();
  if (pos.includes("goal")) return "GK";
  if (/(back|defend|sweeper)/.test(pos)) return "DEF";
  if (/(forward|striker|wing|attack)/.test(pos)) return "FWD";
  return "MID";
}

export function sanitizeTeam(raw) {
  if (!raw || raw.id == null || !raw.name || !Array.isArray(raw.players)) {
    throw new Error("Unexpected team response");
  }
  const team = {
    id: String(raw.id),
    clubId: raw.clubId == null ? "" : String(raw.clubId),
    name: String(raw.name),
    season: raw.season == null ? null : Number(raw.season),
    seasonLabel: raw.seasonLabel == null ? "" : String(raw.seasonLabel),
    crest: safeUrl(raw.crest),
    url: raw.url == null ? "" : String(raw.url),
    players: raw.players.map((p, i) => {
      const value = p.value == null || p.value === "" ? null : Number(p.value);
      return {
        id: String(p.id ?? `${raw.id}-${i}`),
        name: String(p.name || "Unknown"),
        position: String(p.position || "Unknown"),
        group: normalizeGroup(p),
        number: p.number == null || p.number === "" ? "" : String(p.number),
        value: Number.isFinite(value) ? value : null,
        valueText: p.valueText ? String(p.valueText) : "",
        image: safeUrl(p.image),
        age: p.age == null || p.age === "" ? null : Number(p.age),
        nationality: p.nationality == null ? null : String(p.nationality),
      };
    }),
    coach: null,
  };
  if (raw.coach && raw.coach.name) {
    team.coach = {
      id: String(raw.coach.id ?? "coach"),
      name: String(raw.coach.name),
      image: safeUrl(raw.coach.image),
    };
  }
  const known = new Set(team.players.map((p) => p.id));
  const excluded = [];
  const seen = new Set();
  if (Array.isArray(raw.excluded)) {
    for (const id of raw.excluded) {
      if (id == null) continue;
      const key = String(id);
      if (!known.has(key) || seen.has(key)) continue;
      seen.add(key);
      excluded.push(key);
    }
  }
  team.excluded = excluded;
  team.coachExcluded = !!(raw.coachExcluded && team.coach);
  return team;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function cleanToken(t) {
  if (!t || typeof t !== "object" || !t.name) return null;
  const group = ["GK", "DEF", "MID", "FWD"].includes(t.group) ? t.group : "MID";
  const value = t.value == null || t.value === "" ? null : Number(t.value);
  return {
    playerId: String(t.playerId ?? ""),
    teamId: String(t.teamId ?? ""),
    teamName: String(t.teamName ?? ""),
    seasonLabel: String(t.seasonLabel ?? ""),
    name: String(t.name),
    position: String(t.position ?? ""),
    group,
    number: t.number == null ? "" : String(t.number),
    value: Number.isFinite(value) ? value : null,
    valueText: String(t.valueText ?? ""),
    image: safeUrl(t.image),
    x: clamp(Number.isFinite(Number(t.x)) ? Number(t.x) : 50, 0, 100),
    y: clamp(Number.isFinite(Number(t.y)) ? Number(t.y) : 50, 0, 100),
  };
}

function cleanCoach(c) {
  if (!c || !c.name) return null;
  return {
    id: String(c.id ?? "coach"),
    name: String(c.name),
    image: safeUrl(c.image),
    teamId: String(c.teamId ?? ""),
    teamName: String(c.teamName ?? ""),
    seasonLabel: String(c.seasonLabel ?? ""),
  };
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw.slice(-HISTORY_LIMIT)) {
    if (!entry || typeof entry !== "object") continue;
    const norm = normalizeGame({
      phase: entry.phase,
      round: entry.round,
      active: entry.active,
      passed: entry.passed,
      teams: entry.teams,
      roster: entry.roster,
      players: entry.players,
      locked: entry.locked,
    });
    if (!norm) continue;
    out.push({
      phase: norm.phase,
      round: norm.round,
      active: norm.active,
      passed: norm.passed.slice(),
      teams: norm.teams,
      roster: norm.roster,
      players: norm.players,
      locked: norm.locked,
    });
  }
  return out;
}

export function normalizeGame(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.teams) || !raw.teams.length) return null;
  if (!Array.isArray(raw.players) || raw.players.length !== 2) return null;
  let teams;
  try {
    teams = raw.teams.map(sanitizeTeam);
  } catch {
    return null;
  }
  const roster = Array.isArray(raw.roster) && raw.roster.length
    ? raw.roster.map((t) => {
      try { return sanitizeTeam(t); } catch { return null; }
    }).filter(Boolean)
    : teams.map((t) => JSON.parse(JSON.stringify(t)));
  const players = raw.players.map((p) => {
    const formation = FORMATIONS[p && p.formation] ? p.formation : "4-3-3";
    const xi = Array.isArray(p && p.xi) ? p.xi.map(cleanToken) : [];
    while (xi.length < 11) xi.push(null);
    const bench = Array.isArray(p && p.bench) ? p.bench.map(cleanToken) : [];
    while (bench.length < 3) bench.push(null);
    return {
      formation,
      spent: Number(p && p.spent) || 0,
      coach: cleanCoach(p && p.coach),
      xi: xi.slice(0, 11),
      bench: bench.slice(0, 3),
    };
  });
  const locked = raw.locked || {};
  const names = Array.isArray(locked.names) ? locked.names : ["Player 1", "Player 2"];
  const squad = Number(locked.squad) === 14 ? 14 : 11;
  const economy = locked.economy === "budget" ? "budget" : "normal";
  const budget = Number.isFinite(Number(locked.budget)) ? Number(locked.budget) : 250;
  const game = {
    phase: raw.phase === "results" || raw.phase === "transition" ? raw.phase : "draft",
    round: clamp(raw.round | 0, 0, teams.length - 1),
    active: raw.active === 1 ? 1 : 0,
    passed: [!!(raw.passed && raw.passed[0]), !!(raw.passed && raw.passed[1])],
    teams,
    roster: roster.length ? roster : teams.map((t) => JSON.parse(JSON.stringify(t))),
    players,
    locked: {
      squad,
      economy,
      budget,
      budgetRaw: economy === "budget" ? Math.round(budget * 1e6) : 0,
      coach: !!locked.coach,
      names: [0, 1].map((i) => String(names[i] || `Player ${i + 1}`).trim() || `Player ${i + 1}`),
    },
    sim: {
      status: raw.sim && ["idle", "loading", "done", "error"].includes(raw.sim.status) ? raw.sim.status : "idle",
      text: raw.sim && raw.sim.text ? String(raw.sim.text) : "",
      error: raw.sim && raw.sim.error ? String(raw.sim.error) : "",
    },
  };
  game.history = sanitizeHistory(raw.history);
  if (game.sim.status === "loading") game.sim.status = "idle";
  return game;
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Players still in the draft (not listed in team.excluded). */
export function includedFootballers(team) {
  const players = team && Array.isArray(team.players) ? team.players : [];
  const drop = new Set(Array.isArray(team && team.excluded) ? team.excluded.map((id) => String(id)) : []);
  return players.filter((player) => player && !drop.has(String(player.id)));
}

function cloneTeamForPlay(team) {
  const next = JSON.parse(JSON.stringify(team));
  next.players = includedFootballers(next);
  if (next.coachExcluded) next.coach = null;
  return next;
}

export function createGame(teams, settings) {
  const roster = JSON.parse(JSON.stringify(teams)).map(sanitizeTeam);
  const playable = roster.map(cloneTeamForPlay).filter((team) => team.players.length > 0);
  const ordered = settings.shuffle ? shuffle(playable) : playable.map((team) => JSON.parse(JSON.stringify(team)));
  const lang = settings.lang === "tr" ? "tr" : "en";
  const names = [0, 1].map((i) => {
    const n = String((settings.names && settings.names[i]) || "").trim();
    return n || NAME_DEFAULTS[lang][i];
  });
  const squad = Number(settings.squad) === 14 ? 14 : 11;
  const economy = settings.economy === "budget" ? "budget" : "normal";
  const budget = budgetMillions(settings);
  const game = {
    phase: "draft",
    round: 0,
    active: 0,
    passed: [false, false],
    teams: ordered,
    roster,
    players: [0, 1].map(() => ({
      formation: "4-3-3",
      spent: 0,
      coach: null,
      xi: Array(11).fill(null),
      bench: [null, null, null],
    })),
    locked: {
      squad,
      economy,
      budget,
      budgetRaw: economy === "budget" ? Math.round(budget * 1e6) : 0,
      coach: !!settings.coach,
      names,
    },
    sim: { status: "idle", text: "", error: "" },
    history: [],
  };
  resolveTurn(game);
  return game;
}

export function footballerCount(player) {
  return player.xi.filter(Boolean).length + player.bench.filter(Boolean).length;
}

export function squadValue(player) {
  return [...player.xi, ...player.bench].reduce((sum, t) => {
    const n = t && Number(t.value);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

export function budgetRemaining(game, index) {
  if (game.locked.economy !== "budget") return null;
  return game.locked.budgetRaw - (Number(game.players[index].spent) || 0);
}

export function formatEuro(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "\u20ac0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const trim = (s) => s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  if (abs >= 1000000) return `${sign}\u20ac${trim((abs / 1000000).toFixed(2))}m`;
  if (abs >= 1000) return `${sign}\u20ac${trim((abs / 1000).toFixed(abs >= 100000 ? 0 : 1))}k`;
  return `${sign}\u20ac${Math.round(abs)}`;
}

export function currentTeam(game) {
  return game.teams[game.round] || null;
}

function costOf(player) {
  const v = Number(player.value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v;
}

function takenBy(game, teamId, playerId) {
  for (let i = 0; i < 2; i++) {
    const squad = game.players[i];
    const hit = [...squad.xi, ...squad.bench].some((t) => t && t.teamId === teamId && t.playerId === playerId);
    if (hit) return i;
  }
  return -1;
}

function coachOwner(game, teamId) {
  for (let i = 0; i < 2; i++) {
    const c = game.players[i].coach;
    if (c && c.teamId === teamId) return i;
  }
  return -1;
}

function affordable(game, index, player) {
  if (game.locked.economy !== "budget") return true;
  return costOf(player) <= budgetRemaining(game, index);
}

function coachAvailable(game, index) {
  if (!game.locked.coach) return false;
  const team = currentTeam(game);
  if (!team || !team.coach) return false;
  if (game.players[index].coach) return false;
  if (coachOwner(game, team.id) >= 0) return false;
  return true;
}

export function canPick(game, index) {
  if (!game || game.phase !== "draft") return false;
  const team = currentTeam(game);
  if (!team) return false;
  if (coachAvailable(game, index)) return true;
  if (footballerCount(game.players[index]) >= game.locked.squad) return false;
  return team.players.some((pl) => takenBy(game, team.id, pl.id) < 0 && affordable(game, index, pl));
}

export function cardAvailability(game, kind, playerId) {
  const team = currentTeam(game);
  const active = game.active;
  const nameOf = (i) => game.locked.names[i];
  if (!team || game.phase !== "draft") return { state: "blocked", reason: t("reason.unavailable"), owner: -1 };
  if (kind === "coach") {
    if (!team.coach) return { state: "blocked", reason: t("reason.noCoach"), owner: -1 };
    const owner = coachOwner(game, team.id);
    if (owner >= 0) return { state: "taken", reason: t("reason.taken", { name: nameOf(owner) }), owner };
    if (game.players[active].coach || !game.locked.coach) {
      return { state: "blocked", reason: t("reason.coachFilled"), owner: -1 };
    }
    return { state: "open", reason: "", owner: -1 };
  }
  const owner = takenBy(game, team.id, playerId);
  if (owner >= 0) return { state: "taken", reason: t("reason.taken", { name: nameOf(owner) }), owner };
  const pl = team.players.find((p) => p.id === playerId);
  if (!pl) return { state: "blocked", reason: t("reason.unavailable"), owner: -1 };
  if (footballerCount(game.players[active]) >= game.locked.squad) {
    return { state: "blocked", reason: t("reason.squadFull"), owner: -1 };
  }
  if (!affordable(game, active, pl)) return { state: "blocked", reason: t("reason.budget"), owner: -1 };
  return { state: "open", reason: "", owner: -1 };
}

function bothSquadsComplete(game) {
  return game.players.every((p) => {
    if (footballerCount(p) < game.locked.squad) return false;
    if (game.locked.coach && !p.coach) return false;
    return true;
  });
}

function endRound(game) {
  if (bothSquadsComplete(game) || game.round >= game.teams.length - 1) {
    game.phase = "results";
    return;
  }
  game.phase = "transition";
}

/** Auto-pass anyone who cannot legally pick, then end the round or move the turn. */
export function resolveTurn(game) {
  if (!game || game.phase !== "draft") return;
  for (let n = 0; n < 6; n++) {
    if (bothSquadsComplete(game)) {
      game.phase = "results";
      return;
    }
    for (let i = 0; i < 2; i++) {
      if (!game.passed[i] && !canPick(game, i)) game.passed[i] = true;
    }
    if (game.passed[0] && game.passed[1]) {
      endRound(game);
      return;
    }
    if (game.passed[game.active]) {
      const other = 1 - game.active;
      if (!game.passed[other]) {
        game.active = other;
        continue;
      }
      endRound(game);
      return;
    }
    return;
  }
}

function makeToken(player, team) {
  return {
    playerId: String(player.id),
    teamId: team.id,
    teamName: team.name,
    seasonLabel: team.seasonLabel,
    name: player.name,
    position: player.position,
    group: player.group,
    number: player.number,
    value: player.value,
    valueText: player.valueText,
    image: player.image,
    x: 50,
    y: 50,
  };
}

/** Formation roles each Transfermarkt position prefers, best first. */
const ROLE_PREFS = [
  [/goalkeeper/, ["GK"]],
  [/left-back|left wing-back/, ["LB", "LWB", "LCB", "LM"]],
  [/right-back|right wing-back/, ["RB", "RWB", "RCB", "RM"]],
  [/centre-back|sweeper|defender/, ["CB", "LCB", "RCB"]],
  [/defensive midfield/, ["CDM", "CM", "LCM", "RCM"]],
  [/central midfield|^midfield/, ["CM", "LCM", "RCM", "CDM", "CAM"]],
  [/attacking midfield/, ["CAM", "LAM", "RAM", "CM"]],
  [/left midfield/, ["LM", "LAM", "LWB", "LW"]],
  [/right midfield/, ["RM", "RAM", "RWB", "RW"]],
  [/left winger/, ["LW", "LAM", "LM", "LS"]],
  [/right winger/, ["RW", "RAM", "RM", "RS"]],
  [/forward|striker|attack/, ["ST", "LS", "RS", "CAM"]],
];

/** Lower is better: preferred role < same group < other outfield < GK/outfield mismatch. */
function slotScore(token, slot) {
  const pos = String(token.position || "").toLowerCase();
  const prefs = (ROLE_PREFS.find(([re]) => re.test(pos)) || [null, []])[1];
  const rank = prefs.indexOf(slot.role);
  if (rank >= 0) return rank;
  if (slot.group === token.group) return 10;
  if (slot.group === "GK" || token.group === "GK") return 30;
  return 20;
}

function placeToken(squad, token, allowBench) {
  const slots = FORMATIONS[squad.formation] || FORMATIONS["4-3-3"];
  let idx = -1;
  let best = Infinity;
  squad.xi.forEach((s, i) => {
    if (s || !slots[i]) return;
    const score = slotScore(token, slots[i]);
    if (score < best) {
      best = score;
      idx = i;
    }
  });
  const benchIdx = allowBench ? squad.bench.findIndex((s) => !s) : -1;
  // a second keeper, or an outfielder when only the GK slot is open, waits on the bench
  if (idx >= 0 && !(best >= 30 && benchIdx >= 0)) {
    token.x = slots[idx].x;
    token.y = slots[idx].y;
    squad.xi[idx] = token;
    return;
  }
  if (benchIdx >= 0) squad.bench[benchIdx] = token;
  else if (idx >= 0) {
    token.x = slots[idx].x;
    token.y = slots[idx].y;
    squad.xi[idx] = token;
  }
}

function afterPick(game) {
  if (bothSquadsComplete(game)) {
    game.phase = "results";
    return;
  }
  const other = 1 - game.active;
  if (!game.passed[other]) game.active = other;
  resolveTurn(game);
}

export function pickFootballer(game, playerId) {
  if (!game || game.phase !== "draft") return false;
  const avail = cardAvailability(game, "player", playerId);
  if (avail.state !== "open") return false;
  const team = currentTeam(game);
  const player = team.players.find((p) => p.id === playerId);
  pushHistory(game);
  const squad = game.players[game.active];
  squad.spent += costOf(player);
  placeToken(squad, makeToken(player, team), game.locked.squad > 11);
  afterPick(game);
  return true;
}

export function pickCoach(game) {
  if (!game || game.phase !== "draft") return false;
  if (cardAvailability(game, "coach").state !== "open") return false;
  pushHistory(game);
  const team = currentTeam(game);
  game.players[game.active].coach = {
    id: team.coach.id,
    name: team.coach.name,
    image: team.coach.image,
    teamId: team.id,
    teamName: team.name,
    seasonLabel: team.seasonLabel,
  };
  afterPick(game);
  return true;
}

export function passTurn(game) {
  if (!game || game.phase !== "draft") return false;
  pushHistory(game);
  const other = 1 - game.active;
  game.passed[game.active] = true;
  if (!game.passed[other]) game.active = other;
  else {
    endRound(game);
    return true;
  }
  resolveTurn(game);
  return true;
}

export function advanceTransition(game) {
  if (!game || game.phase !== "transition") return false;
  if (game.round >= game.teams.length - 1) {
    game.phase = "results";
    return true;
  }
  game.round += 1;
  game.passed = [false, false];
  game.active = game.round % 2;
  game.phase = "draft";
  resolveTurn(game);
  return true;
}

export function finishDraft(game) {
  if (!game || game.phase === "results") return false;
  pushHistory(game);
  game.phase = "results";
  return true;
}

function draftSnapshot(game) {
  return {
    phase: game.phase,
    round: game.round,
    active: game.active,
    passed: [!!game.passed[0], !!game.passed[1]],
    teams: JSON.parse(JSON.stringify(game.teams)),
    roster: JSON.parse(JSON.stringify(game.roster)),
    players: JSON.parse(JSON.stringify(game.players)),
    locked: JSON.parse(JSON.stringify(game.locked)),
  };
}

export function pushHistory(game) {
  if (!game) return;
  if (!Array.isArray(game.history)) game.history = [];
  game.history.push(draftSnapshot(game));
  if (game.history.length > HISTORY_LIMIT) {
    game.history.splice(0, game.history.length - HISTORY_LIMIT);
  }
}

function tokenKey(token) {
  return `${token.teamId}\0${token.playerId}`;
}

/**
 * Revert the last pick, coach pick, pass, or finish.
 * Snapshots store draft state only (no sim, no nested history), capped at
 * HISTORY_LIMIT. One undo also reverts auto-pass, round advance, and a
 * jump to the next team or to results caused by that action.
 *
 * XI/bench membership is the snapshot's, so a later pitch-to-bench swap is
 * not kept. Each squad keeps the formation selected at undo time; a different
 * formation is remapped onto the restored XI. A token that exists both before
 * the undo and in the snapshot (teamId + playerId) keeps its current x/y.
 * sim is left untouched.
 */
export function undoDraft(game) {
  if (!game || !Array.isArray(game.history) || !game.history.length) return false;
  const carried = game.players.map((squad) => {
    const pos = {};
    for (const token of [...squad.xi, ...squad.bench]) {
      if (token) pos[tokenKey(token)] = { x: token.x, y: token.y };
    }
    return { formation: squad.formation, pos };
  });
  const snap = game.history.pop();
  const sim = game.sim;
  game.phase = snap.phase === "results" || snap.phase === "transition" ? snap.phase : "draft";
  game.round = snap.round | 0;
  game.active = snap.active === 1 ? 1 : 0;
  game.passed = [!!(snap.passed && snap.passed[0]), !!(snap.passed && snap.passed[1])];
  game.teams = snap.teams;
  game.roster = snap.roster;
  game.players = snap.players;
  game.locked = snap.locked;
  game.sim = sim;
  game.players.forEach((squad, i) => {
    const keep = carried[i];
    if (!keep || !squad) return;
    if (FORMATIONS[keep.formation] && keep.formation !== squad.formation) {
      setFormation(game, i, keep.formation);
    }
    for (const token of [...squad.xi, ...squad.bench]) {
      if (!token) continue;
      const point = keep.pos[tokenKey(token)];
      if (!point) continue;
      token.x = point.x;
      token.y = point.y;
    }
  });
  return true;
}

export function remapXI(xi, formation) {
  const slots = FORMATIONS[formation];
  const players = xi.filter(Boolean);
  const assigned = Array(11).fill(null);
  const pairs = [];
  players.forEach((p, pi) => slots.forEach((slot, si) => pairs.push([slotScore(p, slot), pi, si])));
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const usedPlayers = new Set();
  for (const [, pi, si] of pairs) {
    if (usedPlayers.has(pi) || assigned[si]) continue;
    usedPlayers.add(pi);
    assigned[si] = { ...players[pi], x: slots[si].x, y: slots[si].y };
  }
  return assigned;
}

export function setFormation(game, playerIndex, formation) {
  const squad = game.players[playerIndex];
  if (!squad || !FORMATIONS[formation]) return false;
  squad.formation = formation;
  squad.xi = remapXI(squad.xi, formation);
  return true;
}

/**
 * Click-to-move a starter: onto an empty formation spot (takes that slot and its coordinates)
 * or onto another starter (the two trade slots and positions).
 */
export function moveStarter(game, playerIndex, fromIndex, target) {
  const squad = game.players[playerIndex];
  const moving = squad && squad.xi[fromIndex];
  if (!moving || !target || !Number.isInteger(target.index) || target.index === fromIndex) return false;
  if (target.index < 0 || target.index > 10) return false;
  if (target.type === "empty") {
    if (squad.xi[target.index]) return false;
    const slot = (FORMATIONS[squad.formation] || FORMATIONS["4-3-3"])[target.index];
    squad.xi[target.index] = { ...moving, x: slot.x, y: slot.y };
    squad.xi[fromIndex] = null;
    return true;
  }
  if (target.type === "xi") {
    const other = squad.xi[target.index];
    if (!other) return false;
    squad.xi[target.index] = { ...moving, x: other.x, y: other.y };
    squad.xi[fromIndex] = { ...other, x: moving.x, y: moving.y };
    return true;
  }
  return false;
}

export function applyDrag(game, spec) {
  const squad = game.players[spec.player];
  if (!squad) return false;
  const target = spec.target;
  if (target && target.type === "coach") return false;
  const x = clamp(Number.isFinite(Number(spec.x)) ? Number(spec.x) : 50, 4, 96);
  const y = clamp(Number.isFinite(Number(spec.y)) ? Number(spec.y) : 50, 3, 97);

  if (spec.kind === "xi") {
    const moving = squad.xi[spec.index];
    if (!moving || !target) return false;
    if (target.type === "bench") {
      if (game.locked.squad !== 14) return false;
      if (!Number.isInteger(target.index) || target.index < 0 || target.index > 2) return false;
      const occupant = squad.bench[target.index];
      if (occupant) {
        squad.bench[target.index] = { ...moving };
        squad.xi[spec.index] = { ...occupant, x: spec.originX, y: spec.originY };
      } else {
        squad.bench[target.index] = { ...moving };
        squad.xi[spec.index] = null;
      }
      return true;
    }
    if (target.type === "pitch" || target.type === "empty" || target.type === "xi") {
      const nudged = Math.abs(x - spec.originX) > 1 || Math.abs(y - spec.originY) > 1;
      if (!nudged) return false;
      moving.x = x;
      moving.y = y;
      return true;
    }
    return false;
  }

  if (spec.kind === "bench") {
    const moving = squad.bench[spec.index];
    if (!moving || !target) return false;
    if (target.type === "xi") {
      if (!Number.isInteger(target.index)) return false;
      const occupant = squad.xi[target.index];
      if (!occupant) return false;
      squad.bench[spec.index] = { ...occupant };
      squad.xi[target.index] = { ...moving, x: occupant.x, y: occupant.y };
      return true;
    }
    if (target.type === "empty") {
      if (!Number.isInteger(target.index) || target.index < 0 || target.index > 10) return false;
      if (squad.xi.filter(Boolean).length >= 11) return false;
      if (squad.xi[target.index]) return false;
      const slot = (FORMATIONS[squad.formation] || FORMATIONS["4-3-3"])[target.index];
      if (!slot) return false;
      squad.xi[target.index] = { ...moving, x: slot.x, y: slot.y };
      squad.bench[spec.index] = null;
      return true;
    }
    if (target.type === "pitch") {
      if (squad.xi.filter(Boolean).length >= 11) return false;
      const idx = squad.xi.findIndex((s) => !s);
      if (idx < 0) return false;
      squad.xi[idx] = { ...moving, x, y };
      squad.bench[spec.index] = null;
      return true;
    }
    if (target.type === "bench" && target.index !== spec.index) {
      if (!Number.isInteger(target.index) || target.index < 0 || target.index > 2) return false;
      const occupant = squad.bench[target.index];
      squad.bench[target.index] = moving;
      squad.bench[spec.index] = occupant || null;
      return true;
    }
  }
  return false;
}

function lateral(x) {
  if (x < 26) return "left";
  if (x > 74) return "right";
  if (x < 45) return "left-centre";
  if (x > 55) return "right-centre";
  return "centre";
}

/** Role label derived only from where the token stands (attacking up). */
export function pitchRole(x, y) {
  const px = Number.isFinite(Number(x)) ? Number(x) : 50;
  const py = Number.isFinite(Number(y)) ? Number(y) : 50;
  const side = lateral(px);
  if (py >= 84) return "goalkeeper";
  if (py >= 64) {
    if (side === "left") return "left-back";
    if (side === "right") return "right-back";
    if (side === "left-centre") return "left centre-back";
    if (side === "right-centre") return "right centre-back";
    return "centre-back";
  }
  if (py >= 30) {
    const high = py <= 40;
    const low = py >= 56;
    if (side === "left") {
      if (high) return "left attacking midfielder";
      if (low) return "left defensive midfielder";
      return "left midfielder";
    }
    if (side === "right") {
      if (high) return "right attacking midfielder";
      if (low) return "right defensive midfielder";
      return "right midfielder";
    }
    if (side === "left-centre") {
      if (high) return "left attacking midfielder";
      if (low) return "left defensive midfielder";
      return "left central midfielder";
    }
    if (side === "right-centre") {
      if (high) return "right attacking midfielder";
      if (low) return "right defensive midfielder";
      return "right central midfielder";
    }
    if (high) return "attacking midfielder";
    if (low) return "defensive midfielder";
    return "central midfielder";
  }
  if (side === "left") return "left winger";
  if (side === "right") return "right winger";
  if (side === "left-centre") return "left striker";
  if (side === "right-centre") return "right striker";
  return "striker";
}

function playerValueText(token) {
  if (token.valueText) return token.valueText;
  if (token.value == null) return "\u20ac0";
  return formatEuro(token.value);
}

export function buildPrompt(game) {
  const lines = [];
  lines.push(t("prompt.intro1"));
  lines.push(t("prompt.intro2"));
  lines.push(t("prompt.intro3"));
  lines.push("");
  game.players.forEach((squad, i) => {
    lines.push(t("prompt.team", { name: game.locked.names[i] }));
    lines.push(squad.coach ? t("prompt.manager", { name: squad.coach.name }) : t("prompt.managerNone"));
    lines.push(t("prompt.formation", { formation: squad.formation }));
    lines.push(t("prompt.xi"));
    const starters = squad.xi.map((pl) => (pl ? pl : null)).filter(Boolean);
    starters.sort((a, b) => b.y - a.y || a.x - b.x);
    if (!starters.length) lines.push(t("prompt.none"));
    starters.forEach((pl, n) => {
      const club = `${pl.teamName} ${pl.seasonLabel}`.trim();
      const role = translatePitchRole(pitchRole(pl.x, pl.y));
      lines.push(`${n + 1}. ${pl.name} \u2014 ${role} \u2014 ${positionLabel(pl.position)} \u2014 ${club} \u2014 ${playerValueText(pl)}`);
    });
    const bench = squad.bench.filter(Boolean);
    lines.push(t("prompt.bench"));
    if (!bench.length) lines.push(t("prompt.none"));
    bench.forEach((pl) => {
      const club = `${pl.teamName} ${pl.seasonLabel}`.trim();
      lines.push(`- ${pl.name} \u2014 ${positionLabel(pl.position)} \u2014 ${club} \u2014 ${playerValueText(pl)}`);
    });
    lines.push(t("prompt.total", { value: formatEuro(squadValue(squad)) }));
    lines.push("");
  });
  const anyBench = game.players.some((p) => p.bench.some(Boolean));
  lines.push(t("prompt.write"));
  lines.push(t("prompt.score"));
  lines.push(t("prompt.goals"));
  lines.push(anyBench ? t("prompt.momentsSubs") : t("prompt.moments"));
  lines.push(t("prompt.motm"));
  lines.push(t("prompt.tactics"));
  return lines.join("\n");
}

export function turnLabel(game) {
  if (game.phase === "transition") return t("game.next");
  if (game.phase === "results") return t("game.fullTime");
  const name = game.locked.names[game.active];
  const other = game.locked.names[1 - game.active];
  if (game.passed[1 - game.active]) return t("game.keep", { other, name });
  return t("game.pick", { name });
}
