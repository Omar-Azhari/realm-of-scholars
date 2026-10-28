/**
 * The Grimoire of Mistakes: spaced repetition for every question the player
 * gets wrong. A wrong answer is asked again 1 day later; answering right
 * moves it to 3 days, then 7 days, then it is mastered and leaves the book.
 * A wrong answer at any point sends it back to 1 day.
 */

import { addDays, realmStore, todayIso } from "./store";
import { chat, emit } from "./events";
import { getSubject, grantXp, markStudyDay } from "./actions";
import { bumpCounter, recordAnswer } from "./stats";
import { gainFocus } from "./focus";
import { FOCUS } from "../life/catalog";
import type { MistakeEntry, RealmQuestion, RealmState } from "../types";

/** Days until the next review after landing in each box. */
export const REVIEW_INTERVALS = [1, 3, 7] as const;
export const REVIEW_XP = 60;
export const MASTERED_BONUS_XP = 100;

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Stable across sessions: generated questions get new ids and shuffled choices, but the prompt and answer stay the same. */
export function mistakeKey(subjectId: string, question: RealmQuestion): string {
  return `${subjectId}|${hash(`${question.prompt}\u0000${question.choices[question.answerIndex] ?? ""}`)}`;
}

/** Called whenever the player answers a duel, trial or boss question wrongly. */
export function recordMistake(subjectId: string, question: RealmQuestion): void {
  const key = mistakeKey(subjectId, question);
  const today = todayIso();
  realmStore.set((s) => {
    const existing = s.progress.mistakes[key];
    const entry: MistakeEntry = existing
      ? { ...existing, box: 0, dueOn: addDays(today, REVIEW_INTERVALS[0]), misses: existing.misses + 1 }
      : { subjectId, question: { ...question, choices: question.choices.slice() }, box: 0, dueOn: addDays(today, REVIEW_INTERVALS[0]), misses: 1, addedAt: new Date().toISOString() };
    return { ...s, progress: { ...s.progress, mistakes: { ...s.progress.mistakes, [key]: entry } } };
  });
}

export interface DueCard {
  key: string;
  entry: MistakeEntry;
}

export function dueCards(state: RealmState, on: string = todayIso()): DueCard[] {
  return Object.entries(state.progress.mistakes)
    .filter(([, entry]) => entry.dueOn <= on && getSubject(state, entry.subjectId))
    .map(([key, entry]) => ({ key, entry }))
    .sort((a, b) => a.entry.dueOn.localeCompare(b.entry.dueOn) || b.entry.misses - a.entry.misses);
}

export function nextReviewDate(state: RealmState): string | null {
  const dates = Object.values(state.progress.mistakes).map((e) => e.dueOn).sort();
  return dates[0] ?? null;
}

/** Applies one review answer. Returns "mastered" when the card leaves the book. */
export function answerReview(key: string, correct: boolean): "again" | "promoted" | "mastered" | "missing" {
  const state = realmStore.get();
  const entry = state.progress.mistakes[key];
  if (!entry) return "missing";
  recordAnswer(entry.subjectId, entry.question, correct);
  gainFocus(FOCUS.earn.reviewCard, "a Grimoire review");
  const today = todayIso();
  if (!correct) {
    realmStore.set((s) => ({
      ...s,
      progress: { ...s.progress, mistakes: { ...s.progress.mistakes, [key]: { ...entry, box: 0, dueOn: addDays(today, REVIEW_INTERVALS[0]), misses: entry.misses + 1 } } },
    }));
    emit({ type: "sound", name: "miss" });
    return "again";
  }
  emit({ type: "sound", name: "hit" });
  const nextBox = entry.box + 1;
  if (nextBox >= REVIEW_INTERVALS.length) {
    realmStore.set((s) => {
      const mistakes = { ...s.progress.mistakes };
      delete mistakes[key];
      return { ...s, progress: { ...s.progress, mistakes } };
    });
    grantXp(entry.subjectId, REVIEW_XP + MASTERED_BONUS_XP);
    bumpCounter("mastered");
    return "mastered";
  }
  realmStore.set((s) => ({
    ...s,
    progress: { ...s.progress, mistakes: { ...s.progress.mistakes, [key]: { ...entry, box: nextBox, dueOn: addDays(today, REVIEW_INTERVALS[nextBox]) } } },
  }));
  grantXp(entry.subjectId, REVIEW_XP);
  return "promoted";
}

/** End of a review session with at least one card: counts as a day of study. */
export function finishReviewSession(reviewed: number, mastered: number): void {
  if (reviewed <= 0) return;
  chat(`You close the Grimoire: ${reviewed} reviewed${mastered ? `, ${mastered} mastered and struck from its pages` : ""}.`);
  markStudyDay();
}
