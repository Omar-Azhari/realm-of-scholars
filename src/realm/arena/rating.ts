/**
 * Arena ranking: an Elo-style rating per game, ranks with divisions, named
 * AI rivals whose accuracy and speed scale with their rating, weekly
 * seasons, the capped rewards and the mixed leaderboard. Pure functions
 * only — the store is touched in record.ts.
 */

import type { ArenaGameId, ArenaProgress, ArenaRecord, RealmState } from "../types";
import { ARENA_GAME_IDS, emptyRecord, MAX_RATING, MAX_SCORE, MIN_RATING, START_RATING } from "./save";
import { hashString } from "./rng";

export { START_RATING };

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface ArenaGameInfo {
  id: ArenaGameId;
  name: string;
  icon: string;
  blurb: string;
  /** What the score measures, shown next to personal bests. */
  scoreLabel: string;
}

export const ARENA_GAMES: Record<ArenaGameId, ArenaGameInfo> = {
  buzzer: { id: "buzzer", name: "Buzzer Duel", icon: "⚡", blurb: "Head-to-head on the same question. First correct answer takes the point; a wrong buzz locks you out. First to 4.", scoreLabel: "points won" },
  blitz: { id: "blitz", name: "Blitz", icon: "⏱", blurb: "60 seconds of rapid fire. Streaks multiply your score, speed adds a bonus, and the questions get harder as you heat up.", scoreLabel: "points" },
  lexicon: { id: "lexicon", name: "Lexicon", icon: "🔤", blurb: "Guess the key term from its definition in six tries, with letter-by-letter feedback. One ranked daily puzzle per subject.", scoreLabel: "points" },
  connections: { id: "connections", name: "Connections", icon: "🧩", blurb: "Sixteen ideas from four weeks of lectures. Sort them into the four weeks they belong to. Four mistakes and you're out.", scoreLabel: "points" },
  sequence: { id: "sequence", name: "Sequence", icon: "🔢", blurb: "Put the steps of real processes from your lectures in order, against the clock.", scoreLabel: "points" },
};

// ---------------------------------------------------------------------------
// Rating maths
// ---------------------------------------------------------------------------

export type MatchOutcome = "win" | "loss" | "draw";

/** Chance that a player rated `a` beats one rated `b`. */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Big swings while a rating is provisional (first 10 games), smaller after. */
export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 10 ? 40 : 24;
}

/** Rating change for one match. Bounded by the K-factor; a win always gains and a loss always costs at least 1. */
export function ratingDelta(player: number, rival: number, outcome: MatchOutcome, gamesPlayed: number): number {
  const k = kFactor(gamesPlayed);
  const s = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  let delta = Math.round(k * (s - expectedScore(player, rival)));
  if (outcome === "win") delta = Math.max(1, delta);
  if (outcome === "loss") delta = Math.min(-1, delta);
  return Math.max(-k, Math.min(k, delta));
}

export function clampRating(rating: number): number {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(rating)));
}

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

export interface RankTier {
  id: "bronze" | "silver" | "gold" | "platinum" | "diamond" | "grandmaster";
  name: string;
  min: number;
}

export const RANKS: readonly RankTier[] = [
  { id: "bronze", name: "Bronze", min: 0 },
  { id: "silver", name: "Silver", min: 1100 },
  { id: "gold", name: "Gold", min: 1300 },
  { id: "platinum", name: "Platinum", min: 1500 },
  { id: "diamond", name: "Diamond", min: 1700 },
  { id: "grandmaster", name: "Grandmaster", min: 1900 },
];

export interface RankInfo {
  tier: RankTier;
  /** 3, 2 or 1 inside a tier (1 is the top); null for Grandmaster. */
  division: 1 | 2 | 3 | null;
  /** "Gold II". */
  label: string;
  /** 0-1 progress to the next division or tier. */
  progress: number;
  /** Rating of the next division or tier, null at Grandmaster. */
  next: number | null;
}

const ROMAN = { 1: "I", 2: "II", 3: "III" } as const;

export function rankFor(rating: number): RankInfo {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (rating >= RANKS[i].min) index = i;
  const tier = RANKS[index];
  const upper = RANKS[index + 1]?.min ?? null;
  if (upper === null) return { tier, division: null, label: tier.name, progress: 1, next: null };
  // Bronze starts at the rating floor in practice: give it the same 200-point band as the others.
  const lower = index === 0 ? upper - 200 : tier.min;
  const band = (upper - lower) / 3;
  const step = Math.max(0, Math.min(2, Math.floor((rating - lower) / band)));
  const division = (3 - step) as 1 | 2 | 3;
  const from = lower + step * band;
  const next = Math.round(from + band);
  return { tier, division, label: `${tier.name} ${ROMAN[division]}`, progress: Math.max(0, Math.min(1, (rating - from) / band)), next };
}

// ---------------------------------------------------------------------------
// Seasons (weekly)
// ---------------------------------------------------------------------------

/** ISO week id of a local date, e.g. "2026-W43". */
export function seasonId(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Whole days until the season ends (Sunday night). 0 on Sunday. */
export function seasonDaysLeft(now: Date = new Date()): number {
  const day = now.getDay() || 7;
  return 7 - day;
}

/** A game's record as seen this season: season fields restart when the week changes. */
export function viewRecord(arena: ArenaProgress, game: ArenaGameId, season: string = seasonId()): ArenaRecord {
  const record = arena.games[game] ?? emptyRecord();
  if (arena.season === season) return record;
  return { ...record, seasonPeak: record.rating, seasonWins: 0 };
}

/** The arena with season fields restarted if the week has changed. Ratings never reset: they only move on results. */
export function rollSeason(arena: ArenaProgress, season: string = seasonId()): ArenaProgress {
  if (arena.season === season) return arena;
  const games: ArenaProgress["games"] = {};
  for (const id of ARENA_GAME_IDS) {
    const r = arena.games[id];
    if (r) games[id] = { ...r, seasonPeak: r.rating, seasonWins: 0 };
  }
  return { ...arena, season, games };
}

// ---------------------------------------------------------------------------
// AI rivals
// ---------------------------------------------------------------------------

export interface RivalProfile {
  id: string;
  name: string;
  /** A short tag line shown under the name. */
  title: string;
  /** Base rating; each season and game shifts it a little. */
  base: number;
}

export const RIVALS: readonly RivalProfile[] = [
  { id: "pip", name: "Pip Underhill", title: "First-year, eager", base: 820 },
  { id: "marigold", name: "Marigold Ashby", title: "Reads the summary only", base: 920 },
  { id: "theo", name: "Theo Quillfeather", title: "Highlighter enthusiast", base: 1020 },
  { id: "nadia", name: "Nadia Corvel", title: "Never misses a lecture", base: 1120 },
  { id: "ishaan", name: "Ishaan Vale", title: "Flashcards at breakfast", base: 1230 },
  { id: "beatrix", name: "Beatrix Moorcroft", title: "Tutor's favourite", base: 1340 },
  { id: "lucien", name: "Lucien Grey", title: "Speed reader", base: 1450 },
  { id: "saoirse", name: "Saoirse Kettle", title: "Past-paper machine", base: 1560 },
  { id: "kenji", name: "Kenji Arden", title: "Top of the cohort", base: 1670 },
  { id: "ottilie", name: "Ottilie Strand", title: "Dean's list, twice", base: 1780 },
  { id: "magnus", name: "Magnus Rook", title: "Writes the study guides", base: 1890 },
  { id: "archivist", name: "The Archivist", title: "Has read every slide", base: 2010 },
  { id: "elowen", name: "Headmaster Elowen", title: "Wrote the exam", base: 2150 },
];

export interface ArenaRival {
  id: string;
  name: string;
  title: string;
  rating: number;
}

/** A rival's rating for one game this season (a small seeded drift keeps the board moving week to week). */
export function rivalRating(rival: RivalProfile, game: ArenaGameId, season: string = seasonId()): number {
  const drift = (hashString(`${rival.id}|${game}|${season}`) % 81) - 40;
  return clampRating(rival.base + drift);
}

export function rivalsFor(game: ArenaGameId, season: string = seasonId()): ArenaRival[] {
  return RIVALS.map((r) => ({ id: r.id, name: r.name, title: r.title, rating: rivalRating(r, game, season) })).sort((a, b) => a.rating - b.rating);
}

export function findRival(game: ArenaGameId, id: string, season: string = seasonId()): ArenaRival | null {
  return rivalsFor(game, season).find((r) => r.id === id) ?? null;
}

export interface RivalPick {
  rival: ArenaRival;
  label: "Warm-up" | "Even match" | "Stretch";
  /** Your chance of winning by rating. */
  winChance: number;
}

/** Three rivals to challenge: one a bit weaker, the closest, and one stronger. */
export function rivalChoices(rating: number, game: ArenaGameId, season: string = seasonId()): RivalPick[] {
  const all = rivalsFor(game, season);
  let even = 0;
  for (let i = 0; i < all.length; i++) if (Math.abs(all[i].rating - rating) < Math.abs(all[even].rating - rating)) even = i;
  const picks: RivalPick[] = [];
  const add = (i: number, label: RivalPick["label"]) => {
    if (i < 0 || i >= all.length || picks.some((p) => p.rival.id === all[i].id)) return;
    picks.push({ rival: all[i], label, winChance: expectedScore(rating, all[i].rating) });
  };
  add(even - 1, "Warm-up");
  add(even, "Even match");
  add(even + 1, "Stretch");
  if (picks.length < 3) add(even + 2, "Stretch");
  if (picks.length < 3) add(even - 2, "Warm-up");
  return picks.sort((a, b) => a.rival.rating - b.rival.rating);
}

/** 0 (weakest rival) … 1 (the strongest). */
export function rivalSkill(rating: number): number {
  return Math.max(0, Math.min(1, (rating - 700) / 1500));
}

/** Chance the rival answers a question of this difficulty correctly. */
export function rivalAccuracy(rating: number, difficulty: 1 | 2 | 3 = 2): number {
  return Math.max(0.3, Math.min(0.97, 0.5 + 0.45 * rivalSkill(rating) - 0.07 * (difficulty - 2)));
}

/** The rival's typical time to answer, in ms; longer questions take longer to read. */
export function rivalAnswerMs(rating: number, textLength = 180, difficulty: 1 | 2 | 3 = 2): number {
  const base = 9000 - 5500 * rivalSkill(rating);
  const reading = Math.max(0.7, Math.min(1.4, textLength / 180));
  return Math.round(base * reading * (1 + 0.12 * (difficulty - 2)));
}

// ---------------------------------------------------------------------------
// Rewards (they serve study, and are capped per day)
// ---------------------------------------------------------------------------

export const ARENA_REWARDS = {
  winXp: 50,
  drawXp: 25,
  lossXp: 10,
  /** Extra for beating a higher-rated rival. */
  upsetXp: 25,
  winCoins: 10,
  upsetCoins: 5,
  /** Focus only for beating a stronger rival. */
  upsetFocus: 4,
  /** Daily caps across every arena game: far below one day of real study (two waystones are 440 XP and 40 Focus). */
  dailyXpCap: 400,
  dailyCoinCap: 80,
  dailyFocusCap: 12,
} as const;

export interface ArenaReward {
  xp: number;
  coins: number;
  focus: number;
  /** True when a cap cut the reward. */
  capped: boolean;
}

/** Rewards for one ranked result, cut to what's left of today's caps. `spent` is what was already paid today. */
export function computeReward(spent: { xp: number; coins: number; focus: number }, outcome: MatchOutcome, rivalStronger: boolean): ArenaReward {
  const R = ARENA_REWARDS;
  const wantXp = outcome === "win" ? R.winXp + (rivalStronger ? R.upsetXp : 0) : outcome === "draw" ? R.drawXp : R.lossXp;
  const wantCoins = outcome === "win" ? R.winCoins + (rivalStronger ? R.upsetCoins : 0) : 0;
  const wantFocus = outcome === "win" && rivalStronger ? R.upsetFocus : 0;
  const xp = Math.max(0, Math.min(wantXp, R.dailyXpCap - spent.xp));
  const coins = Math.max(0, Math.min(wantCoins, R.dailyCoinCap - spent.coins));
  const focus = Math.max(0, Math.min(wantFocus, R.dailyFocusCap - spent.focus));
  return { xp, coins, focus, capped: xp < wantXp || coins < wantCoins || focus < wantFocus };
}

// ---------------------------------------------------------------------------
// Leaderboard: you, classmates (from share codes) and the AI rivals
// ---------------------------------------------------------------------------

export interface BoardRow {
  key: string;
  name: string;
  kind: "you" | "classmate" | "rival";
  rating: number;
  /** Personal best score, when known. */
  best: number | null;
  rank: RankInfo;
  /** Extra note, e.g. a classmate's code is from an older season. */
  note: string;
}

/** What the board reads from the save. */
export interface BoardSource {
  playerName: string;
  arena: ArenaProgress;
  group: RealmState["progress"]["group"];
}

export function boardSource(state: RealmState): BoardSource {
  return { playerName: state.player?.name ?? "You", arena: state.progress.arena, group: state.progress.group };
}

export function arenaLeaderboard(source: BoardSource, game: ArenaGameId, season: string = seasonId()): BoardRow[] {
  const rows: BoardRow[] = [];
  const mine = source.arena.games[game];
  rows.push({
    key: "you",
    name: source.playerName,
    kind: "you",
    rating: mine?.rating ?? START_RATING,
    best: mine?.best ?? null,
    rank: rankFor(mine?.rating ?? START_RATING),
    note: mine ? "" : "unranked",
  });
  for (const [key, member] of Object.entries(source.group)) {
    // Saved classmates are untrusted: read defensively.
    const entry = member && typeof member === "object" && member.arena && typeof member.arena === "object" ? member.arena[game] : undefined;
    if (!entry || typeof entry.rating !== "number" || !Number.isFinite(entry.rating)) continue;
    const rating = clampRating(entry.rating);
    const best = typeof entry.best === "number" && Number.isFinite(entry.best) ? Math.max(0, Math.min(MAX_SCORE, Math.round(entry.best))) : null;
    rows.push({
      key: `mate:${key}`,
      name: String(member.name ?? "Classmate").slice(0, 40),
      kind: "classmate",
      rating,
      best,
      rank: rankFor(rating),
      note: member.arenaSeason && member.arenaSeason !== season ? `code from ${member.arenaSeason}` : "",
    });
  }
  for (const rival of rivalsFor(game, season)) {
    rows.push({ key: `ai:${rival.id}`, name: rival.name, kind: "rival", rating: rival.rating, best: null, rank: rankFor(rival.rating), note: rival.title });
  }
  return rows.sort((a, b) => b.rating - a.rating || (a.kind === "you" ? -1 : b.kind === "you" ? 1 : 0));
}
