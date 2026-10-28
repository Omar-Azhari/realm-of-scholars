/**
 * Semester Calendar — THE single derivation of "where are we in the
 * semester". No duplicate date sources: everything reads the semester
 * record (start/end/exam period are ConfirmableValues the USER confirms —
 * /docs contains no semester dates, so none are ever invented) plus the
 * already-confirmed assessment deadlines.
 *
 * When the start date is unconfirmed, week numbering is simply unavailable
 * (shown as needing confirmation); the "semester era" that drives living-
 * world changes then falls back to real module progress, so the world still
 * evolves without a single fabricated date.
 */

import { getMelbourneDateIso, daysBetweenDateIso, getUpcomingDeadlines, getOverallModuleProgress } from "./selectors";
import type { UniGameSaveData } from "../types/domain";

/** Teaching weeks assumed when only a start date is confirmed (standard trimester). */
export const DEFAULT_TEACHING_WEEKS = 12;

export type SemesterPeriod = "pre-semester" | "teaching" | "revision" | "exams" | "finished";

export type SemesterEra = "early" | "mid" | "late" | "complete";

export interface SemesterCalendar {
  /** Melbourne "today". */
  todayIso: string;
  /** null until the user confirms the semester start date. */
  currentWeek: number | null;
  totalTeachingWeeks: number;
  completedWeeks: number | null;
  period: SemesterPeriod | null;
  startConfirmed: boolean;
  endConfirmed: boolean;
  examPeriodRaw: string | null;
  /** ISO Mondays of each teaching week (empty when unconfirmed). */
  weekStarts: string[];
  /** Teaching weeks (1-based) containing at least one confirmed deadline. */
  assessmentWeeks: number[];
  daysUntilNextAssessment: number | null;
  nextAssessmentTitle: string | null;
  era: SemesterEra;
}

/** All modules complete AND every assessment submitted/graded — the same rule the achievement uses. */
export function isSemesterComplete(save: UniGameSaveData): boolean {
  const progress = getOverallModuleProgress(save.tasks, save.semester.subjects);
  if (progress.total === 0 || progress.completed !== progress.total) return false;
  const statusById = new Map(save.assessmentProgress.map((p) => [p.assessmentId, p.status]));
  return save.semester.subjects.every((subject) =>
    subject.assessments.every((assessment) => {
      const status = statusById.get(assessment.id);
      return status === "submitted" || status === "graded";
    })
  );
}

export function getSemesterCalendar(save: UniGameSaveData, now: Date = new Date()): SemesterCalendar {
  const todayIso = getMelbourneDateIso(now);
  const { startDate, endDate, examPeriod } = save.semester;
  const startConfirmed = startDate.status === "confirmed" && Boolean(startDate.value);
  const endConfirmed = endDate.status === "confirmed" && Boolean(endDate.value);

  const upcoming = getUpcomingDeadlines(save.semester.subjects, now);
  const next = upcoming[0] ?? null;
  const daysUntilNextAssessment = next
    ? daysBetweenDateIso(todayIso, next.assessment.dueDate.value as string)
    : null;

  let currentWeek: number | null = null;
  let completedWeeks: number | null = null;
  let period: SemesterPeriod | null = null;
  let totalTeachingWeeks = DEFAULT_TEACHING_WEEKS;
  const weekStarts: string[] = [];
  const assessmentWeeks: number[] = [];

  if (startConfirmed) {
    const start = startDate.value as string;
    if (endConfirmed) {
      const spanWeeks = Math.round(daysBetweenDateIso(start, endDate.value as string) / 7);
      if (spanWeeks >= 6 && spanWeeks <= 20) totalTeachingWeeks = spanWeeks;
    }
    for (let week = 0; week < totalTeachingWeeks; week += 1) {
      const [y, m, d] = start.split("-").map(Number);
      const monday = new Date(Date.UTC(y, m - 1, d + week * 7));
      weekStarts.push(monday.toISOString().slice(0, 10));
    }

    const daysIn = daysBetweenDateIso(start, todayIso);
    if (daysIn < 0) {
      period = "pre-semester";
      currentWeek = null;
      completedWeeks = 0;
    } else {
      const rawWeek = Math.floor(daysIn / 7) + 1;
      if (rawWeek <= totalTeachingWeeks) {
        period = "teaching";
        currentWeek = rawWeek;
        completedWeeks = rawWeek - 1;
      } else {
        completedWeeks = totalTeachingWeeks;
        currentWeek = null;
        // After teaching: revision, then exams (only when the user confirmed
        // an exam period string containing a parseable ISO date is that used;
        // otherwise the label stays generic).
        period = isSemesterComplete(save) ? "finished" : rawWeek <= totalTeachingWeeks + 1 ? "revision" : "exams";
      }
    }

    // Which teaching week each confirmed deadline falls in.
    for (const subject of save.semester.subjects) {
      for (const assessment of subject.assessments) {
        if (assessment.dueDate.status !== "confirmed" || !assessment.dueDate.value) continue;
        const week = Math.floor(daysBetweenDateIso(start, assessment.dueDate.value) / 7) + 1;
        if (week >= 1 && week <= totalTeachingWeeks && !assessmentWeeks.includes(week)) {
          assessmentWeeks.push(week);
        }
      }
    }
    assessmentWeeks.sort((a, b) => a - b);
  }

  // Era drives the living world. Week-based when dates are confirmed,
  // progress-based otherwise — deterministic either way.
  let era: SemesterEra;
  if (isSemesterComplete(save)) {
    era = "complete";
  } else if (currentWeek !== null) {
    era = currentWeek <= 3 ? "early" : currentWeek <= 8 ? "mid" : "late";
  } else if (startConfirmed && period !== "pre-semester" && period !== null) {
    era = "late"; // past the teaching weeks
  } else {
    const percent = getOverallModuleProgress(save.tasks, save.semester.subjects).percent;
    era = percent < 25 ? "early" : percent < 60 ? "mid" : "late";
  }

  return {
    todayIso,
    currentWeek,
    totalTeachingWeeks,
    completedWeeks,
    period,
    startConfirmed,
    endConfirmed,
    examPeriodRaw: examPeriod.status === "confirmed" ? (examPeriod.value ?? null) : null,
    weekStarts,
    assessmentWeeks,
    daysUntilNextAssessment,
    nextAssessmentTitle: next ? next.assessment.title : null,
    era,
  };
}

/** Numeric era index (0-3) used to merge manifest era layers. */
export function eraIndex(era: SemesterEra): number {
  return era === "early" ? 0 : era === "mid" ? 1 : era === "late" ? 2 : 3;
}
