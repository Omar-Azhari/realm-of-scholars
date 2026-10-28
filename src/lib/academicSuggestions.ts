/**
 * Grounded academic setup suggestions (Phase 18A, Part 10). These are pure
 * derivations over the save — exactly like Priority Centre or the Semester
 * Calendar — never persisted and never invented. Shown at the end of the
 * Semester Setup flow (and reusable anywhere else that wants a "what to do
 * next" summary) as short, factual sentences that always cite a real count.
 *
 * This is deliberately NOT a new goals/task/reminder store: every fact here
 * already exists in `semester`/`tasks`/`assessmentProgress`; this module
 * only phrases it as a suggestion.
 */

import type { UniGameSaveData } from "../types/domain";
import { getOverallModuleProgress, getUpcomingDeadlines } from "./selectors";

export interface AcademicSuggestion {
  id: string;
  text: string;
}

export function getAcademicSuggestions(save: UniGameSaveData): AcademicSuggestion[] {
  const suggestions: AcademicSuggestion[] = [];
  const { subjects } = save.semester;

  const overall = getOverallModuleProgress(save.tasks, subjects);
  const remainingModules = overall.total - overall.completed;
  if (remainingModules > 0) {
    suggestions.push({
      id: "complete-weekly-modules",
      text: `Complete weekly modules — ${remainingModules} of ${overall.total} still open across your subjects.`,
    });
  }

  const upcoming = getUpcomingDeadlines(subjects).slice(0, 1)[0];
  if (upcoming) {
    suggestions.push({
      id: "begin-next-assessment",
      text: `Begin "${upcoming.assessment.title}" (${upcoming.subject.name}) before it's due — ${upcoming.assessment.dueWindowRaw}.`,
    });
  }

  const upcomingCount = getUpcomingDeadlines(subjects).length;
  if (upcomingCount > 0) {
    suggestions.push({
      id: "review-upcoming-work",
      text: `Review your ${upcomingCount} confirmed upcoming deadline${upcomingCount === 1 ? "" : "s"} in Calendar.`,
    });
  }

  let unconfirmedCount = 0;
  for (const subject of subjects) {
    if (subject.code.status !== "confirmed") unconfirmedCount += 1;
    for (const assessment of subject.assessments) {
      if (assessment.dueDate.status !== "confirmed" || assessment.dueTime.status !== "confirmed") {
        unconfirmedCount += 1;
      }
    }
  }
  if (unconfirmedCount > 0) {
    suggestions.push({
      id: "confirm-missing-dates",
      text: `Confirm ${unconfirmedCount} missing detail${unconfirmedCount === 1 ? "" : "s"} — dates and codes UniGame couldn't verify on its own.`,
    });
  }

  if (suggestions.length === 0 && overall.total > 0) {
    suggestions.push({ id: "all-caught-up", text: "Everything found is confirmed and up to date — nothing needs attention right now." });
  }

  return suggestions;
}
