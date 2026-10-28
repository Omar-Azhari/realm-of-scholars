/**
 * Studying a week pays only after real study: attending its lecture in the
 * Lecture Theatre (state/lectures.ts), or passing a short check on the week's
 * own questions at its waystone. There is no one-click "I've studied" reward.
 */

import type { RealmQuestion, RealmSubject } from "../types";
import { getSubject, studyWeek, weekKey } from "./actions";
import { realmStore } from "./store";

export const STUDY_CHECK = { questions: 3, toPass: 2 } as const;

/** The week's own multiple-choice questions (bank, slides or the student's own), shuffled, at most three. */
export function studyCheckQuestions(subject: RealmSubject, week: number): RealmQuestion[] {
  // Typed questions (term, cloze, numeric) still carry four choices, so they work as multiple choice here.
  const own = subject.questions.filter((q) => q.week === week && q.choices.length >= 2 && q.answerIndex >= 0 && q.answerIndex < q.choices.length);
  const shuffled = [...own];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, STUDY_CHECK.questions);
}

/** True when the week has enough of its own questions for the check. */
export function hasStudyCheck(subject: RealmSubject, week: number): boolean {
  return studyCheckQuestions(subject, week).length >= STUDY_CHECK.questions;
}

/**
 * Finishes a study check with `right` correct answers. A pass studies the week
 * (the full study reward, once); a miss pays nothing. Returns whether it passed.
 */
export function finishStudyCheck(subjectId: string, week: number, right: number): boolean {
  const state = realmStore.get();
  const subject = getSubject(state, subjectId);
  if (!subject || !subject.weeks.some((w) => w.week === week)) return false;
  if (right < STUDY_CHECK.toPass) return false;
  if (!state.progress.weeks[weekKey(subjectId, week)]?.studiedAt) studyWeek(subjectId, week);
  return true;
}
