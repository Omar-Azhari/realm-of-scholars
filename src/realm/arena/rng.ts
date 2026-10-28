/**
 * Small deterministic helpers for the Arena: a seeded random generator (so a
 * daily puzzle is the same for everyone on the same day) and shuffles.
 */

import type { RealmQuestion } from "../types";

/** FNV-1a hash of a string to a 32-bit unsigned integer. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32: a fast seeded generator returning numbers in [0, 1). */
export function seededRng(seed: number | string): () => number {
  let a = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith<T>(items: readonly T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Uniform number in [min, max). */
export function between(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** The same question with its choices in a new order (so remembering a position never helps). */
export function shuffleChoices(question: RealmQuestion, rng: () => number): RealmQuestion {
  const order = shuffleWith(
    question.choices.map((_, i) => i),
    rng,
  );
  return { ...question, choices: order.map((i) => question.choices[i]), answerIndex: order.indexOf(question.answerIndex) };
}
