/**
 * Answer statistics behind the weak-spot map. Every answered question
 * (trial, exam duel, boss, mock exam, Grimoire review, workshop) is tallied
 * against its week. A week is "weak" once there's enough evidence and the
 * hit rate is low; tutors and waystones point the player to it.
 */

import { realmStore } from "./store";
import { grantXp, markStudyDay } from "./actions";
import { gainFocus } from "./focus";
import { FOCUS } from "../life/catalog";
import type { AnswerTally, RealmQuestion, RealmState, RealmSubject } from "../types";

/** Answers needed before a week is judged. */
export const WEAK_MIN_ANSWERS = 4;
/** Below this share right, a week is weak. */
export const WEAK_THRESHOLD = 0.6;

export function accuracyKey(subjectId: string, week: number | null): string {
  return `${subjectId}:${week ?? "all"}`;
}

export function recordAnswer(subjectId: string, question: Pick<RealmQuestion, "week">, correct: boolean): void {
  const key = accuracyKey(subjectId, question.week);
  realmStore.set((s) => {
    const prev = s.progress.accuracy[key] ?? { right: 0, wrong: 0 };
    const next: AnswerTally = correct ? { ...prev, right: prev.right + 1 } : { ...prev, wrong: prev.wrong + 1 };
    return { ...s, progress: { ...s.progress, accuracy: { ...s.progress.accuracy, [key]: next } } };
  });
}

/** Share of answers right for a week, or null when there isn't enough evidence yet. */
export function weekAccuracy(state: RealmState, subjectId: string, week: number): { rate: number; answered: number } | null {
  const tally = state.progress.accuracy[accuracyKey(subjectId, week)];
  if (!tally) return null;
  const answered = tally.right + tally.wrong;
  return answered === 0 ? null : { rate: tally.right / answered, answered };
}

export function isWeakWeek(state: RealmState, subjectId: string, week: number): boolean {
  const acc = weekAccuracy(state, subjectId, week);
  return acc !== null && acc.answered >= WEAK_MIN_ANSWERS && acc.rate < WEAK_THRESHOLD;
}

/** Weak weeks of a subject, weakest first. */
export function weakWeeks(state: RealmState, subject: RealmSubject): Array<{ week: number; title: string; rate: number; answered: number }> {
  return subject.weeks
    .filter((w) => isWeakWeek(state, subject.id, w.week))
    .map((w) => ({ week: w.week, title: w.title, ...weekAccuracy(state, subject.id, w.week)! }))
    .sort((a, b) => a.rate - b.rate);
}

/** XP only for improving on your best explanation of a concept, so re-submitting never farms XP. */
export const EXPLAIN_XP_PER_POINT = 4;

export function recordExplanation(subjectId: string, conceptKey: string, score: number): number {
  const key = `${subjectId}|${conceptKey}`;
  const best = realmStore.get().progress.explained[key] ?? 0;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped > best) realmStore.set((s) => ({ ...s, progress: { ...s.progress, explained: { ...s.progress.explained, [key]: clamped } } }));
  const xp = Math.max(0, clamped - best) * EXPLAIN_XP_PER_POINT;
  if (xp > 0) grantXp(subjectId, xp);
  if (clamped >= 50) {
    markStudyDay();
    gainFocus(FOCUS.earn.explain, "explaining a concept");
  }
  return xp;
}

/** Rough offline check: how much of the course's wording for the concept the explanation covers. Capped at 70 — it can't judge understanding. */
export function keywordScore(reference: string, explanation: string): { score: number; missing: string[] } {
  const stop = new Set(["that", "this", "with", "from", "they", "their", "which", "when", "what", "into", "your", "have", "been", "were", "will", "than", "then", "them", "also", "such", "used", "uses", "using", "each", "more", "most", "some", "only", "over", "about"]);
  const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stop.has(w));
  const ref = [...new Set(words(reference))];
  if (ref.length === 0) return { score: 0, missing: [] };
  const mine = words(explanation);
  const has = (w: string) => mine.some((m) => m === w || (w.length > 5 && m.startsWith(w.slice(0, 5))));
  const covered = ref.filter(has);
  const length = Math.min(1, mine.length / 25);
  return { score: Math.round(Math.min(70, (covered.length / ref.length) * 80 * (0.5 + 0.5 * length))), missing: ref.filter((w) => !has(w)).slice(0, 5) };
}

export function bumpCounter(name: string, by = 1): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, counters: { ...s.progress.counters, [name]: (s.progress.counters[name] ?? 0) + by } } }));
}
