/**
 * Parkour runs and the shared play-game records (state/playGames.ts): each course has
 * its own game id, a Focus cost to start a run, and medal times (lower is better).
 */

import { finishPlay, playRecord, startPlay, PLAY_COST, type PlayResult } from "../../state/playGames";
import type { CourseDef } from "./courses";

export const PARKOUR_COST = PLAY_COST;

export function parkourGameId(courseId: string): string {
  return `parkour-${courseId}`;
}

/** Pays the Focus for a run. False when there isn't enough (the game explains in chat). */
export function startRun(course: CourseDef): boolean {
  return startPlay(parkourGameId(course.id), PARKOUR_COST);
}

/** Records a finished run: personal best, medal, coins. */
export function finishRun(course: CourseDef, seconds: number): PlayResult {
  return finishPlay(parkourGameId(course.id), seconds, { higherIsBetter: false, medals: course.medals });
}

export function courseRecord(course: CourseDef) {
  return playRecord(parkourGameId(course.id));
}

/** "1:02.35" style run time. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "--:--.--";
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const cs = Math.min(99, Math.floor((rest - whole) * 100));
  return `${m}:${String(whole).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** "+1.20" / "-0.45" split difference. */
export function formatDelta(delta: number): string {
  const sign = delta < 0 ? "-" : "+";
  return `${sign}${Math.abs(delta).toFixed(2)}`;
}
