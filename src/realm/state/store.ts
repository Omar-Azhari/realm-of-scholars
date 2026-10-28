/**
 * The Realm save: one small external store persisted to localStorage.
 * Game code reads/writes it imperatively (the 3D world, mini-games) and
 * React components subscribe through useRealm().
 */

import { useSyncExternalStore } from "react";
import type { RealmProgress, RealmState } from "../types";
import { emptyArena, sanitizeArena } from "../arena/save";

/** Expo mode (?expo, see expo.ts) plays on its own save so the real one is never touched. */
const EXPO_MODE = typeof location !== "undefined" && new URLSearchParams(location.search).has("expo");
const STORAGE_KEY = EXPO_MODE ? "unigame.realm.expo" : "unigame.realm.v1";
/** Set by expo.ts while it wipes the demo save, so nothing writes it back on the way out. */
let savingBlocked = false;
export function blockSaving(): void {
  savingBlocked = true;
}

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Local date `days` after `iso` (YYYY-MM-DD). */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function createEmptyProgress(): RealmProgress {
  return {
    skillXp: {},
    focus: 30,
    lifeXp: {},
    materials: {},
    weapons: [],
    weapon: null,
    accuracy: {},
    marks: {},
    achievements: {},
    title: null,
    mockExams: [],
    explained: {},
    counters: {},
    siegeClaimed: false,
    mistakes: {},
    streak: { current: 0, best: 0, lastDay: null },
    wardrobe: { owned: [], cape: null, hat: null, pet: null, outfit: {}, dyes: {} },
    dorm: { owned: {}, placed: [] },
    voyages: { stamps: {}, rivals: {} },
    rest: { lastDay: null, until: null },
    mail: [],
    spellbar: [],
    buffs: {},
    ladder: { season: "", rank: 11, best: 11 },
    secrets: {},
    timetable: [],
    classClaims: [],
    lectures: {},
    bosses: {},
    group: {},
    quests: {},
    weeks: {},
    questPoints: 0,
    coins: 25,
    inventory: [],
    activeFocus: null,
    daily: { date: todayIso(), wins: {}, studied: 0, steps: 0, claimed: false },
    graduatedAt: null,
    focusMinutes: 0,
    arena: emptyArena(),
    games: {},
  };
}

export function createEmptyState(): RealmState {
  return {
    version: 1,
    player: null,
    curriculum: null,
    progress: createEmptyProgress(),
    settings: { sound: true, music: true, zoom: 0.45, graphics: "high", reminders: false, realTimeSky: true, textScale: 1, colorblind: false, reduceMotion: false },
  };
}

import { sanitizeAppearance } from "../customise/humans";
import { HOUSES } from "../customise/houses";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts anything; returns a structurally valid state. Corrupt sections fall back to defaults instead of crashing the game. */
export function sanitizeState(raw: unknown): RealmState {
  const empty = createEmptyState();
  if (!isObject(raw) || raw.version !== 1) return empty;
  const progressRaw = isObject(raw.progress) ? raw.progress : {};
  const progress: RealmProgress = { ...empty.progress };
  if (isObject(progressRaw.skillXp)) {
    for (const [key, value] of Object.entries(progressRaw.skillXp)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) progress.skillXp[key] = Math.floor(value);
    }
  }
  if (isObject(progressRaw.quests)) progress.quests = progressRaw.quests as RealmProgress["quests"];
  if (isObject(progressRaw.weeks)) progress.weeks = progressRaw.weeks as RealmProgress["weeks"];
  if (typeof progressRaw.questPoints === "number") progress.questPoints = progressRaw.questPoints;
  if (typeof progressRaw.coins === "number") progress.coins = progressRaw.coins;
  if (Array.isArray(progressRaw.inventory)) progress.inventory = progressRaw.inventory.filter(isObject) as unknown as RealmProgress["inventory"];
  if (isObject(progressRaw.activeFocus)) progress.activeFocus = progressRaw.activeFocus as unknown as RealmProgress["activeFocus"];
  if (isObject(progressRaw.daily) && typeof progressRaw.daily.date === "string") progress.daily = progressRaw.daily as unknown as RealmProgress["daily"];
  if (typeof progressRaw.graduatedAt === "string") progress.graduatedAt = progressRaw.graduatedAt;
  if (typeof progressRaw.focusMinutes === "number") progress.focusMinutes = progressRaw.focusMinutes;
  progress.arena = sanitizeArena(progressRaw.arena);
  if (isObject(progressRaw.games)) {
    for (const [id, raw] of Object.entries(progressRaw.games).slice(0, 40)) {
      if (!/^[a-z][a-z0-9-]{0,30}$/.test(id) || !isObject(raw)) continue;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      progress.games[id] = {
        best: num(raw.best),
        plays: Math.max(0, Math.min(1_000_000, Math.round(num(raw.plays) ?? 0))),
        medal: raw.medal === "bronze" || raw.medal === "silver" || raw.medal === "gold" ? raw.medal : null,
        coinsDay: typeof raw.coinsDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.coinsDay) ? raw.coinsDay : "",
        coinsToday: Math.max(0, Math.min(10_000, Math.round(num(raw.coinsToday) ?? 0))),
      };
    }
  }
  if (isObject(progressRaw.mistakes)) {
    for (const [key, value] of Object.entries(progressRaw.mistakes)) {
      if (!isObject(value) || typeof value.subjectId !== "string" || typeof value.dueOn !== "string" || !isObject(value.question)) continue;
      const q = value.question;
      if (typeof q.prompt !== "string" || !Array.isArray(q.choices) || q.choices.length !== 4 || typeof q.answerIndex !== "number") continue;
      progress.mistakes[key] = value as unknown as RealmProgress["mistakes"][string];
    }
  }
  if (isObject(progressRaw.streak)) {
    const s = progressRaw.streak;
    progress.streak = {
      current: typeof s.current === "number" ? Math.max(0, Math.floor(s.current)) : 0,
      best: typeof s.best === "number" ? Math.max(0, Math.floor(s.best)) : 0,
      lastDay: typeof s.lastDay === "string" ? s.lastDay : null,
    };
  }
  if (isObject(progressRaw.wardrobe)) {
    const w = progressRaw.wardrobe;
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    progress.wardrobe = {
      owned: Array.isArray(w.owned) ? w.owned.filter((x): x is string => typeof x === "string") : [],
      cape: str(w.cape),
      hat: str(w.hat),
      pet: str(w.pet),
      outfit: {},
      dyes: {},
    };
    const classes = new Set(["knight", "mage", "rogue", "rogue_hooded", "barbarian", "none"]);
    if (isObject(w.outfit)) {
      for (const slot of ["head", "torso", "arms", "legs", "cape", "headgear"] as const) {
        const v = w.outfit[slot];
        // Only the cape and headgear can be left off.
        if (typeof v === "string" && classes.has(v) && (v !== "none" || slot === "cape" || slot === "headgear")) progress.wardrobe.outfit[slot] = v as never;
      }
    }
    if (isObject(w.dyes)) {
      for (const slot of ["torso", "arms", "legs", "headgear"] as const) {
        const v = w.dyes[slot];
        if (typeof v === "string" && /^dye-[a-z]+$/.test(v)) progress.wardrobe.dyes[slot] = v;
      }
    }
  }
  if (isObject(progressRaw.voyages)) {
    const v = progressRaw.voyages;
    const isoMap = (value: unknown): Record<string, string> => {
      const out: Record<string, string> = {};
      if (isObject(value)) for (const [k, t] of Object.entries(value)) if (typeof t === "string" && /^[a-z0-9-]{1,80}$/.test(k)) out[k] = t.slice(0, 40);
      return out;
    };
    progress.voyages = { stamps: isoMap(v.stamps), rivals: isoMap(v.rivals) };
  }
  if (Array.isArray(progressRaw.timetable)) {
    progress.timetable = progressRaw.timetable
      .filter((t): t is Record<string, unknown> => isObject(t) && typeof t.key === "string" && typeof t.weekday === "number" && typeof t.start === "string" && typeof t.end === "string")
      .slice(0, 40)
      .map((t) => ({
        key: String(t.key).slice(0, 120),
        subjectId: typeof t.subjectId === "string" ? t.subjectId : null,
        title: typeof t.title === "string" ? t.title.slice(0, 60) : "Class",
        weekday: Math.max(0, Math.min(6, Math.round(t.weekday as number))),
        start: /^\d{2}:\d{2}$/.test(t.start as string) ? (t.start as string) : "00:00",
        end: /^\d{2}:\d{2}$/.test(t.end as string) ? (t.end as string) : "00:00",
        location: typeof t.location === "string" ? t.location.slice(0, 80) : "",
      }));
  }
  if (Array.isArray(progressRaw.classClaims)) progress.classClaims = progressRaw.classClaims.filter((x): x is string => typeof x === "string").slice(-30);
  if (isObject(progressRaw.lectures)) {
    for (const [k, v] of Object.entries(progressRaw.lectures).slice(0, 400)) if (/^[\w.-]{1,80}:\d{1,2}$/.test(k) && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) progress.lectures[k] = v;
  }
  if (isObject(progressRaw.secrets)) {
    for (const [k, v] of Object.entries(progressRaw.secrets)) if (/^secret-\d$/.test(k) && typeof v === "string") progress.secrets[k] = v;
  }
  if (isObject(progressRaw.ladder)) {
    const l = progressRaw.ladder;
    const rank = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(1, Math.min(11, Math.round(v))) : 11);
    progress.ladder = { season: typeof l.season === "string" && /^\d{4}-\d{2}$/.test(l.season) ? l.season : "", rank: rank(l.rank), best: rank(l.best) };
  }
  if (isObject(progressRaw.buffs)) {
    for (const [k, v] of Object.entries(progressRaw.buffs)) if (/^(insight|swiftness|warding)$/.test(k) && typeof v === "string" && !Number.isNaN(Date.parse(v))) progress.buffs[k] = v;
  }
  if (Array.isArray(progressRaw.spellbar)) progress.spellbar = progressRaw.spellbar.slice(0, 4).map((x) => (typeof x === "string" ? x.slice(0, 120) : ""));
  if (Array.isArray(progressRaw.mail)) {
    progress.mail = progressRaw.mail
      .filter((l): l is Record<string, unknown> => isObject(l) && typeof l.key === "string" && typeof l.subject === "string")
      .slice(0, 60)
      .map((l) => ({
        key: String(l.key).slice(0, 120),
        at: typeof l.at === "string" ? l.at : new Date(0).toISOString(),
        from: typeof l.from === "string" ? l.from.slice(0, 60) : "",
        subject: String(l.subject).slice(0, 160),
        body: typeof l.body === "string" ? l.body.slice(0, 1000) : "",
        read: l.read === true,
      }));
  }
  if (isObject(progressRaw.rest)) {
    const r = progressRaw.rest;
    progress.rest = {
      lastDay: typeof r.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.lastDay) ? r.lastDay : null,
      until: typeof r.until === "string" && !Number.isNaN(Date.parse(r.until)) ? r.until : null,
    };
  }
  if (isObject(progressRaw.dorm)) {
    const d = progressRaw.dorm;
    const owned: Record<string, number> = {};
    if (isObject(d.owned)) for (const [k, v] of Object.entries(d.owned)) if (typeof v === "number" && v > 0 && /^[a-z0-9-]+$/.test(k)) owned[k] = Math.min(20, Math.floor(v));
    const placed = Array.isArray(d.placed)
      ? d.placed
          .filter((p): p is Record<string, unknown> => isObject(p) && typeof p.id === "string" && typeof p.uid === "string" && typeof p.c === "number" && typeof p.r === "number")
          .slice(0, 80)
          .map((p) => ({ uid: String(p.uid), id: String(p.id), c: Math.floor(p.c as number), r: Math.floor(p.r as number), rot: ((Math.floor(Number(p.rot) || 0) % 4) + 4) % 4 as 0 | 1 | 2 | 3 }))
      : [];
    progress.dorm = { owned, placed };
  }
  const numberMap = (value: unknown, max: number): Record<string, number> => {
    const out: Record<string, number> = {};
    if (isObject(value)) for (const [k, v] of Object.entries(value)) if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(0, Math.min(max, v));
    return out;
  };
  if (isObject(progressRaw.accuracy)) {
    for (const [key, value] of Object.entries(progressRaw.accuracy)) {
      if (isObject(value) && typeof value.right === "number" && typeof value.wrong === "number") progress.accuracy[key] = { right: Math.max(0, value.right), wrong: Math.max(0, value.wrong) };
    }
  }
  if (isObject(progressRaw.marks)) {
    for (const [key, value] of Object.entries(progressRaw.marks)) {
      if (isObject(value) && typeof value.score === "number" && typeof value.outOf === "number" && value.outOf > 0 && value.score >= 0 && value.score <= value.outOf) {
        progress.marks[key] = { score: value.score, outOf: value.outOf };
      }
    }
  }
  if (isObject(progressRaw.achievements)) {
    for (const [key, value] of Object.entries(progressRaw.achievements)) if (typeof value === "string") progress.achievements[key] = value;
  }
  if (typeof progressRaw.title === "string") progress.title = progressRaw.title.slice(0, 60);
  if (Array.isArray(progressRaw.mockExams)) {
    progress.mockExams = progressRaw.mockExams
      .filter((m): m is Record<string, unknown> => isObject(m) && typeof m.subjectId === "string" && typeof m.right === "number" && typeof m.total === "number")
      .slice(-30) as unknown as RealmProgress["mockExams"];
  }
  progress.explained = numberMap(progressRaw.explained, 100);
  if (typeof progressRaw.focus === "number" && Number.isFinite(progressRaw.focus)) progress.focus = Math.max(0, Math.min(100, Math.round(progressRaw.focus)));
  progress.lifeXp = numberMap(progressRaw.lifeXp, 1e8);
  progress.materials = numberMap(progressRaw.materials, 1e6);
  if (Array.isArray(progressRaw.weapons)) progress.weapons = progressRaw.weapons.filter((w): w is string => typeof w === "string").slice(0, 50);
  if (typeof progressRaw.weapon === "string" && progress.weapons.includes(progressRaw.weapon)) progress.weapon = progressRaw.weapon;
  progress.counters = numberMap(progressRaw.counters, 1e9);
  if (typeof progressRaw.siegeClaimed === "boolean") progress.siegeClaimed = progressRaw.siegeClaimed;
  if (isObject(progressRaw.bosses)) {
    for (const [key, value] of Object.entries(progressRaw.bosses)) if (typeof value === "string") progress.bosses[key] = value;
  }
  if (isObject(progressRaw.group)) {
    for (const [key, value] of Object.entries(progressRaw.group)) {
      if (isObject(value) && typeof value.name === "string" && isObject(value.levels)) progress.group[key] = value as unknown as RealmProgress["group"][string];
    }
  }

  const settingsRaw = isObject(raw.settings) ? raw.settings : {};
  return {
    version: 1,
    player:
      isObject(raw.player) && typeof raw.player.name === "string"
        ? {
            ...(raw.player as unknown as NonNullable<RealmState["player"]>),
            appearance: isObject(raw.player.appearance) ? sanitizeAppearance(raw.player.appearance) : undefined,
            house: typeof raw.player.house === "string" && HOUSES.some((h) => h.id === (raw.player as { house: string }).house) ? raw.player.house : undefined,
          }
        : null,
    curriculum:
      isObject(raw.curriculum) && Array.isArray(raw.curriculum.subjects) ? (raw.curriculum as unknown as RealmState["curriculum"]) : null,
    progress,
    settings: {
      sound: typeof settingsRaw.sound === "boolean" ? settingsRaw.sound : true,
      music: typeof settingsRaw.music === "boolean" ? settingsRaw.music : true,
      reminders: settingsRaw.reminders === true,
      realTimeSky: settingsRaw.realTimeSky !== false,
      textScale: settingsRaw.textScale === 1.3 ? 1.3 : settingsRaw.textScale === 1.15 ? 1.15 : 1,
      colorblind: settingsRaw.colorblind === true,
      reduceMotion: settingsRaw.reduceMotion === true,
      zoom: typeof settingsRaw.zoom === "number" ? Math.min(1, Math.max(0, settingsRaw.zoom)) : 0.45,
      graphics: settingsRaw.graphics === "low" ? "low" : settingsRaw.graphics === "ultra" ? "ultra" : "high",
    },
  };
}

/** Set (in sessionStorage) by expo.ts's "New visitor": the next page load starts from a wiped demo save. */
export const EXPO_RESET_FLAG = "unigame.realm.expoReset";

function load(): RealmState {
  try {
    if (EXPO_MODE && sessionStorage.getItem(EXPO_RESET_FLAG)) {
      sessionStorage.removeItem(EXPO_RESET_FLAG);
      localStorage.removeItem(STORAGE_KEY);
      return createEmptyState();
    }
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return createEmptyState();
    return sanitizeState(JSON.parse(text));
  } catch {
    return createEmptyState();
  }
}

/**
 * Development only, for testing without touching the real save:
 * `?sandbox` plays a copy of the save that is never written back; `?sandbox=fresh` starts empty.
 */
const SANDBOX_PARAM = typeof location !== "undefined" ? new URLSearchParams(location.search).get("sandbox") : null;
const SANDBOX = Boolean(import.meta.env?.DEV) && SANDBOX_PARAM !== null;

let state: RealmState = typeof localStorage === "undefined" || (SANDBOX && SANDBOX_PARAM === "fresh") ? createEmptyState() : load();
const listeners = new Set<() => void>();
let saveTimer: number | null = null;

function persist(): void {
  if (typeof localStorage === "undefined" || SANDBOX || savingBlocked) return;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked — the game keeps running in memory.
    }
  }, 250);
}

export const realmStore = {
  get(): RealmState {
    return state;
  },
  set(updater: (current: RealmState) => RealmState): void {
    const next = updater(state);
    if (next === state) return;
    state = next;
    persist();
    listeners.forEach((listener) => listener());
  },
  replace(next: RealmState): void {
    state = sanitizeState(next);
    persist();
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  exportJson(): string {
    return JSON.stringify(state, null, 2);
  },
};

if (typeof window !== "undefined" && !SANDBOX) {
  window.addEventListener("beforeunload", () => {
    if (savingBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  });
}

export function useRealm<T>(selector: (s: RealmState) => T): T {
  return useSyncExternalStore(realmStore.subscribe, () => selector(realmStore.get()));
}

// Dev-only handle for play-testing in the sandbox (stripped from production builds).
if (SANDBOX && typeof window !== "undefined") {
  (window as unknown as { __store?: typeof realmStore }).__store = realmStore;
}
