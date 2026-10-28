/**
 * Archery game rules: rounds, targets, wind, quiz-range scoring and medals. Pure.
 */

import type { RealmQuestion } from "../../types";
import type { TargetFace, Vec3, Wind } from "./physics";

export type ArcheryMode = "practice" | "quiz";

export const GAME_IDS: Record<ArcheryMode, string> = { practice: "archery-practice", quiz: "archery-quiz" };

/** Centre height of every target face. */
export const TARGET_HEIGHT = 1.3;

export interface RoundSpec {
  distance: number;
  arrows: number;
  radius: number;
  /** Strongest wind this round can roll (m/s). */
  windMax: number;
  /** Side-to-side travel of a moving target (metres either way; 0 = still) and its speed (rad/s). */
  moveAmp: number;
  moveSpeed: number;
}

/** Target practice: three ends of six arrows, further each time, the last at a moving target. */
export const PRACTICE_ROUNDS: RoundSpec[] = [
  { distance: 18, arrows: 6, radius: 0.4, windMax: 1.5, moveAmp: 0, moveSpeed: 0 },
  { distance: 30, arrows: 6, radius: 0.55, windMax: 3, moveAmp: 0, moveSpeed: 0 },
  { distance: 45, arrows: 6, radius: 0.65, windMax: 4.5, moveAmp: 2.6, moveSpeed: 0.75 },
];

export const PRACTICE_MAX = PRACTICE_ROUNDS.reduce((sum, r) => sum + r.arrows * 10, 0);
/** Bronze, silver, gold (out of 180). */
export const PRACTICE_MEDALS: [number, number, number] = [90, 125, 150];

export interface TargetSpec extends TargetFace {
  id: string;
  label?: string;
  moveAmp: number;
  moveSpeed: number;
  phase: number;
}

export function practiceTarget(round: number): TargetSpec {
  const r = PRACTICE_ROUNDS[Math.max(0, Math.min(PRACTICE_ROUNDS.length - 1, round))];
  return { id: `practice-${round}`, x: 0, y: TARGET_HEIGHT, z: -r.distance, radius: r.radius, moveAmp: r.moveAmp, moveSpeed: r.moveSpeed, phase: 0 };
}

/** Where a (possibly moving) target is at time t. */
export function targetPosition(spec: TargetSpec, t: number): Vec3 {
  return { x: spec.x + spec.moveAmp * Math.sin(spec.moveSpeed * t + spec.phase), y: spec.y, z: spec.z };
}

/** A wind for one end: up to the round's strongest, mostly across the lanes. */
export function rollWind(windMax: number, rng: () => number): Wind {
  const speed = windMax * (0.35 + 0.65 * rng());
  const angle = (rng() - 0.5) * 1.1 + (rng() < 0.5 ? 0 : Math.PI);
  return { x: Math.cos(angle) * speed, z: Math.sin(angle) * speed * 0.5 };
}

export function windSpeed(w: Wind): number {
  return Math.hypot(w.x, w.z);
}

// ---------------------------------------------------------------------------
// The quiz range
// ---------------------------------------------------------------------------

export const QUIZ_DISTANCE = 22;
export const QUIZ_QUESTIONS = 10;
export const QUIZ_ARROWS_PER_QUESTION = 2;
export const QUIZ_RADIUS = 0.55;
export const QUIZ_WIND_MAX = 1.5;
/** Bronze, silver, gold. A perfect run (ten right, all bullseyes) scores 3,600. */
export const QUIZ_MEDALS: [number, number, number] = [600, 1400, 2200];
export const LETTERS = ["A", "B", "C", "D"] as const;

/** Four targets in a row, A to D from left to right. */
export function quizTargets(): TargetSpec[] {
  return LETTERS.map((label, i) => ({ id: `quiz-${label}`, label, x: (i - 1.5) * 3, y: TARGET_HEIGHT, z: -QUIZ_DISTANCE, radius: QUIZ_RADIUS, moveAmp: 0, moveSpeed: 0, phase: 0 }));
}

/** Target index i is the right answer. */
export function isCorrectTarget(index: number, question: Pick<RealmQuestion, "answerIndex">): boolean {
  return index === question.answerIndex;
}

/** Streak multiplier: x1, then x2 from 2 right in a row, x3 from 4, x4 from 6. */
export function streakMultiplier(streak: number): number {
  return Math.min(4, 1 + Math.floor(Math.max(0, streak) / 2));
}

/** Points for hitting the right answer: 100 times the streak multiplier, plus 5 per ring for precision. */
export function quizHitPoints(ring: number, streakAfterHit: number): number {
  return 100 * streakMultiplier(streakAfterHit) + Math.max(0, Math.min(10, ring)) * 5;
}
