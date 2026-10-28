/**
 * Attending lectures in the lecture theatre.
 *
 *  - First time for a week you haven't studied: it counts as studying the
 *    week (tome, XP, Focus), plus XP for each check-in answered right.
 *  - A week already studied: a smaller XP reward and 1 Focus, once a day.
 *  - Replaying the same lecture again the same day: XP for right answers only.
 */

import { realmStore, todayIso } from "./store";
import { grantXp, studyWeek, weekKey } from "./actions";
import { gainFocus } from "./focus";
import { bumpCounter } from "./stats";
import type { RealmState } from "../types";

export const LECTURE_XP = { perCorrect: 25, review: 60, replayPerCorrect: 10 } as const;

export function lectureKey(subjectId: string, week: number): string {
  return `${subjectId}:${week}`;
}

export function attendedOn(state: RealmState, subjectId: string, week: number): string | null {
  return state.progress.lectures[lectureKey(subjectId, week)] ?? null;
}

/** Records the lecture (local date) and pays out. Returns a line describing the reward. */
export function attendLecture(subjectId: string, week: number, right: number): string {
  const state = realmStore.get();
  const key = lectureKey(subjectId, week);
  const before = state.progress.lectures[key];
  const studied = Boolean(state.progress.weeks[weekKey(subjectId, week)]?.studiedAt);
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, lectures: { ...s.progress.lectures, [key]: todayIso() } } }));
  bumpCounter("lectures");
  const answers = Math.max(0, Math.round(right));
  if (!studied) {
    studyWeek(subjectId, week);
    if (answers) grantXp(subjectId, answers * LECTURE_XP.perCorrect);
    return `Week studied. Tome, study XP and Focus${answers ? `, plus ${answers * LECTURE_XP.perCorrect} XP for your answers` : ""}.`;
  }
  if (before === todayIso()) {
    if (answers) grantXp(subjectId, answers * LECTURE_XP.replayPerCorrect);
    return answers ? `${answers * LECTURE_XP.replayPerCorrect} XP for your answers (replayed today).` : "Replayed. No extra reward today.";
  }
  grantXp(subjectId, LECTURE_XP.review + answers * LECTURE_XP.perCorrect);
  gainFocus(1, "attending a lecture");
  return `${LECTURE_XP.review + answers * LECTURE_XP.perCorrect} XP and 1 Focus for revising this week.`;
}

