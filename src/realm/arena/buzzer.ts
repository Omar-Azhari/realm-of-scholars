/**
 * Buzzer duel: you and a rival race on the same question. The first correct
 * answer takes the point; a wrong answer locks that side out for the rest of
 * the question. First to BUZZER_TARGET points wins; level after the last
 * round is a draw.
 */

import type { RealmQuestion } from "../types";
import { between, hashString, seededRng } from "./rng";
import { rivalAccuracy, rivalAnswerMs } from "./rating";

export const BUZZER_TARGET = 4;
/** Rounds before a level match is called a draw (first to 4 needs at most 7 decided rounds). */
export const BUZZER_MAX_ROUNDS = 10;
export const BUZZER_ROUND_MS = 15_000;

export interface RivalBuzz {
  /** When the rival buzzes, ms after the question appears. */
  atMs: number;
  correct: boolean;
  /** The choice it gives. */
  choice: number;
}

/** When and how the rival answers this question. Deterministic for a seed. */
export function planRivalBuzz(rating: number, question: RealmQuestion, seed: string): RivalBuzz {
  const rng = seededRng(hashString(seed));
  const difficulty = question.difficulty ?? 2;
  const length = question.prompt.length + question.choices.join(" ").length;
  const atMs = Math.round(Math.min(BUZZER_ROUND_MS - 500, Math.max(1200, rivalAnswerMs(rating, length, difficulty) * between(rng, 0.7, 1.3))));
  const correct = rng() < rivalAccuracy(rating, difficulty);
  const wrong = question.choices.map((_, i) => i).filter((i) => i !== question.answerIndex);
  const choice = correct ? question.answerIndex : wrong[Math.floor(rng() * wrong.length)];
  return { atMs, correct, choice };
}

export interface RoundState {
  open: boolean;
  winner: "player" | "rival" | null;
  playerLocked: boolean;
  rivalLocked: boolean;
}

export const NEW_ROUND: RoundState = { open: true, winner: null, playerLocked: false, rivalLocked: false };

/** Applies one buzz. A locked-out side or a closed round changes nothing. */
export function applyBuzz(round: RoundState, who: "player" | "rival", correct: boolean): RoundState {
  if (!round.open) return round;
  if (who === "player" ? round.playerLocked : round.rivalLocked) return round;
  if (correct) return { ...round, open: false, winner: who };
  const next = who === "player" ? { ...round, playerLocked: true } : { ...round, rivalLocked: true };
  // Both wrong: nobody can score, the round ends.
  return next.playerLocked && next.rivalLocked ? { ...next, open: false } : next;
}

/** Time ran out with no correct answer. */
export function timeUp(round: RoundState): RoundState {
  return round.open ? { ...round, open: false } : round;
}

/** The match result, or null while it's still on. */
export function buzzerOutcome(you: number, rival: number, roundsPlayed: number, maxRounds: number = BUZZER_MAX_ROUNDS): "win" | "loss" | "draw" | null {
  if (you >= BUZZER_TARGET) return "win";
  if (rival >= BUZZER_TARGET) return "loss";
  if (roundsPlayed >= maxRounds) return you > rival ? "win" : rival > you ? "loss" : "draw";
  return null;
}

/** Points for a won round: 100, plus up to 100 for buzzing fast. */
export function buzzerRoundPoints(ms: number): number {
  return 100 + Math.max(0, Math.min(100, Math.round((BUZZER_ROUND_MS - ms) / 120)));
}
