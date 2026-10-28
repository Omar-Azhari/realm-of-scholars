/**
 * Sequence: put the steps of a real process in order. Steps come from the
 * lectures' flow, cycle and timeline diagrams when a subject has them;
 * otherwise from the course plan (which week teaches which topic).
 */

import type { RealmSubject } from "../types";
import type { SubjectLectures } from "../curriculum/banks/lectures/types";
import { LECTURE_BANKS } from "../curriculum/banks/lectures";
import { bankLectureFor } from "./connections";
import { between, hashString, seededRng, shuffleWith } from "./rng";
import { rivalSkill } from "./rating";

export const SEQUENCE_ROUNDS = 3;

export interface SequencePuzzle {
  title: string;
  /** The steps in the right order. */
  steps: string[];
  /** Where it came from, shown to the player. */
  source: string;
  week: number | null;
  /** For a cycle, the first step is given (a loop has no natural start otherwise). */
  fixedFirst: boolean;
}

function clean(steps: string[]): string[] | null {
  const out = steps.map((s) => s.trim()).filter(Boolean);
  if (out.length < 3 || out.length > 7) return null;
  if (new Set(out.map((s) => s.toLowerCase())).size !== out.length) return null;
  return out;
}

/** Every ordered diagram in the subject's ready-made lectures. */
export function lectureSequences(subject: RealmSubject, banks: SubjectLectures[] = LECTURE_BANKS): SequencePuzzle[] {
  const out: SequencePuzzle[] = [];
  for (const w of subject.weeks) {
    const lec = bankLectureFor(subject, w.week, banks);
    if (!lec) continue;
    for (const seg of lec.segments) {
      const v = seg.visual;
      if (!v) continue;
      const steps = v.kind === "flow" || v.kind === "cycle" ? clean(v.steps) : v.kind === "timeline" ? clean(v.events.map((e) => e.label)) : null;
      if (!steps) continue;
      const title = ("title" in v && v.title) || seg.heading;
      out.push({ title, steps, source: `Week ${w.week} lecture: ${seg.heading}`, week: w.week, fixedFirst: v.kind === "cycle" });
    }
  }
  return out;
}

/** Fallback: a handful of the course's weekly topics, to be put in teaching order. */
export function weekOrderPuzzle(subject: RealmSubject, rng: () => number, size = 5): SequencePuzzle | null {
  const weeks = subject.weeks.filter((w) => w.title.trim());
  if (weeks.length < 4) return null;
  const picked = shuffleWith(weeks, rng)
    .slice(0, Math.min(size, weeks.length))
    .sort((a, b) => a.week - b.week);
  const steps = clean(picked.map((w) => w.title));
  return steps ? { title: "Put these topics in the order the course teaches them", steps, source: "Your course plan", week: null, fixedFirst: false } : null;
}

/** A match's puzzles: lecture diagrams first (shuffled), topped up with course-plan orderings. */
export function sequencePuzzles(subject: RealmSubject, rng: () => number, count = SEQUENCE_ROUNDS, banks: SubjectLectures[] = LECTURE_BANKS): SequencePuzzle[] {
  const out = shuffleWith(lectureSequences(subject, banks), rng).slice(0, count);
  for (let tries = 0; out.length < count && tries < count * 3; tries++) {
    const p = weekOrderPuzzle(subject, rng);
    if (!p) break;
    if (!out.some((o) => o.steps.join("|") === p.steps.join("|"))) out.push(p);
  }
  return out;
}

/** Share of step pairs in the right relative order (1 = perfect). Partial credit for nearly-right orders. */
export function pairAccuracy(order: string[], correct: string[]): number {
  const pos = new Map(correct.map((s, i) => [s, i]));
  let right = 0;
  let total = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      total++;
      if ((pos.get(order[i]) ?? 0) < (pos.get(order[j]) ?? 0)) right++;
    }
  }
  return total === 0 ? 0 : right / total;
}

/** One round's points: up to 200 for order, 100 more for perfect. */
export function sequenceRoundScore(order: string[], correct: string[]): number {
  const perfect = order.length === correct.length && order.every((s, i) => s === correct[i]);
  return Math.round(200 * pairAccuracy(order, correct)) + (perfect ? 100 : 0);
}

/** A match: the rounds' points plus a speed bonus. */
export function sequenceMatchScore(roundScores: number[], seconds: number): number {
  return roundScores.reduce((a, b) => a + b, 0) + Math.max(0, Math.round(150 - seconds));
}

/** How a rival does over `rounds` puzzles. */
export function rivalSequence(rating: number, rounds: number, seed: string): { score: number; seconds: number } {
  const rng = seededRng(hashString(seed));
  const s = rivalSkill(rating);
  const scores: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const perfect = rng() < 0.15 + 0.65 * s;
    const acc = perfect ? 1 : Math.max(0, Math.min(0.95, 0.55 + 0.4 * s + between(rng, -0.2, 0.15)));
    scores.push(Math.round(200 * acc) + (perfect ? 100 : 0));
  }
  const seconds = Math.round(rounds * (45 - 25 * s) * between(rng, 0.75, 1.25));
  return { score: sequenceMatchScore(scores, seconds), seconds };
}
