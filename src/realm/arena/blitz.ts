/**
 * Blitz: 60 seconds of rapid-fire questions. Every three answers in a row
 * raise the multiplier (up to ×5); fast answers earn a speed bonus; a wrong
 * answer resets the streak and costs time. Harder questions come as the
 * streak grows.
 */

import type { RealmQuestion } from "../types";
import { between, hashString, seededRng } from "./rng";
import { rivalAccuracy, rivalAnswerMs } from "./rating";

export const BLITZ_MS = 60_000;
export const BLITZ_WRONG_PENALTY_MS = 3000;
export const BLITZ_BASE_POINTS = 100;
export const BLITZ_MAX_SPEED_BONUS = 50;
export const BLITZ_MAX_MULTIPLIER = 5;

/** ×1 for answers 1-3 of a streak, ×2 for 4-6, … up to ×5. `streak` is the run before this answer. */
export function blitzMultiplier(streak: number): number {
  return Math.min(BLITZ_MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, streak) / 3));
}

/** Full bonus within 2 s, nothing after 8 s, linear between. */
export function speedBonus(ms: number): number {
  if (ms <= 2000) return BLITZ_MAX_SPEED_BONUS;
  if (ms >= 8000) return 0;
  return Math.round((BLITZ_MAX_SPEED_BONUS * (8000 - ms)) / 6000);
}

export function blitzPoints(correct: boolean, streakBefore: number, ms: number): number {
  return correct ? (BLITZ_BASE_POINTS + speedBonus(ms)) * blitzMultiplier(streakBefore) : 0;
}

/** The difficulty the next question aims for. */
export function targetDifficulty(streak: number): 1 | 2 | 3 {
  return streak < 3 ? 1 : streak < 6 ? 2 : 3;
}

/** Next question: unused first, closest to the target difficulty (harder preferred on ties). Recycles once every question is used. */
export function pickBlitzQuestion(pool: RealmQuestion[], streak: number, used: ReadonlySet<string>, rng: () => number): RealmQuestion | null {
  if (pool.length === 0) return null;
  const fresh = pool.filter((q) => !used.has(q.id));
  const from = fresh.length > 0 ? fresh : pool;
  const target = targetDifficulty(streak);
  const distance = (q: RealmQuestion) => Math.abs((q.difficulty ?? 2) - target) - ((q.difficulty ?? 2) > target ? 0.1 : 0);
  const bestDistance = Math.min(...from.map(distance));
  const best = from.filter((q) => distance(q) === bestDistance);
  return best[Math.floor(rng() * best.length)];
}

export interface BlitzEvent {
  atMs: number;
  correct: boolean;
  points: number;
  total: number;
}

/** A rival's whole minute, as a timeline (so its score can climb live beside yours). */
export function simulateBlitz(rating: number, seed: string): { events: BlitzEvent[]; score: number } {
  const rng = seededRng(hashString(seed));
  const events: BlitzEvent[] = [];
  let t = 0;
  let streak = 0;
  let total = 0;
  for (let guard = 0; guard < 200; guard++) {
    const difficulty = targetDifficulty(streak);
    // Blitz questions are answered faster than a duel: no one is waiting to buzz.
    const ms = Math.round(rivalAnswerMs(rating, 160, difficulty) * 0.7 * between(rng, 0.6, 1.4));
    t += ms;
    if (t > BLITZ_MS) break;
    const correct = rng() < rivalAccuracy(rating, difficulty);
    const points = blitzPoints(correct, streak, ms);
    total += points;
    events.push({ atMs: t, correct, points, total });
    if (correct) streak++;
    else {
      streak = 0;
      t += BLITZ_WRONG_PENALTY_MS;
    }
  }
  return { events, score: total };
}

/** The rival's score at a moment in the minute. */
export function scoreAt(events: BlitzEvent[], ms: number): number {
  let total = 0;
  for (const e of events) {
    if (e.atMs > ms) break;
    total = e.total;
  }
  return total;
}
