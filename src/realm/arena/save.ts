/**
 * The Arena's slice of the save: defaults and sanitising. Pure (no store
 * import), so the store can use it without an import cycle.
 */

import type { ArenaGameId, ArenaProgress, ArenaRecord } from "../types";

export const ARENA_GAME_IDS: readonly ArenaGameId[] = ["buzzer", "blitz", "lexicon", "connections", "sequence"];

export const START_RATING = 1000;
export const MIN_RATING = 100;
export const MAX_RATING = 3000;
/** Personal-best scores are clamped to this. */
export const MAX_SCORE = 1_000_000;

export function isArenaGame(value: unknown): value is ArenaGameId {
  return typeof value === "string" && (ARENA_GAME_IDS as readonly string[]).includes(value);
}

export function emptyRecord(): ArenaRecord {
  return { rating: START_RATING, peak: START_RATING, games: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, best: 0, seasonPeak: START_RATING, seasonWins: 0 };
}

export function emptyArena(): ArenaProgress {
  return { season: "", games: {}, daily: { date: "", xp: 0, coins: 0, focus: 0, played: [] } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const whole = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;

function sanitizeRecord(raw: Record<string, unknown>): ArenaRecord {
  const rating = whole(raw.rating, MIN_RATING, MAX_RATING, START_RATING);
  const games = whole(raw.games, 0, 1e6, 0);
  const wins = Math.min(games, whole(raw.wins, 0, 1e6, 0));
  const losses = Math.min(games - wins, whole(raw.losses, 0, 1e6, 0));
  const draws = Math.min(games - wins - losses, whole(raw.draws, 0, 1e6, 0));
  const streak = Math.min(wins, whole(raw.streak, 0, 1e6, 0));
  return {
    rating,
    peak: Math.max(rating, whole(raw.peak, MIN_RATING, MAX_RATING, rating)),
    games,
    wins,
    losses,
    draws,
    streak,
    bestStreak: Math.max(streak, Math.min(wins, whole(raw.bestStreak, 0, 1e6, 0))),
    best: whole(raw.best, 0, MAX_SCORE, 0),
    seasonPeak: Math.max(rating, whole(raw.seasonPeak, MIN_RATING, MAX_RATING, rating)),
    seasonWins: Math.min(wins, whole(raw.seasonWins, 0, 1e6, 0)),
  };
}

/** Accepts anything; returns a valid arena slice. Unknown games, bad numbers and junk are dropped or clamped. */
export function sanitizeArena(raw: unknown): ArenaProgress {
  const out = emptyArena();
  if (!isObject(raw)) return out;
  if (typeof raw.season === "string" && /^\d{4}-W\d{2}$/.test(raw.season)) out.season = raw.season;
  if (isObject(raw.games)) {
    for (const id of ARENA_GAME_IDS) {
      const record = raw.games[id];
      if (isObject(record)) out.games[id] = sanitizeRecord(record);
    }
  }
  if (isObject(raw.daily) && typeof raw.daily.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.daily.date)) {
    const d = raw.daily;
    out.daily = {
      date: d.date as string,
      xp: whole(d.xp, 0, 1e6, 0),
      coins: whole(d.coins, 0, 1e6, 0),
      focus: whole(d.focus, 0, 1e6, 0),
      played: Array.isArray(d.played) ? d.played.filter((p): p is string => typeof p === "string" && /^[a-z]+\|[\w.-]{1,80}$/.test(p)).slice(0, 60) : [],
    };
  }
  return out;
}
