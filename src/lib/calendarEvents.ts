/**
 * Calendar data helpers — event list and month/week grid arithmetic for the
 * Master Calendar screen. Date-only math is done via Date.UTC on ISO
 * "YYYY-MM-DD" strings (same idiom as shiftDateIso/daysBetweenDateIso in
 * selectors.ts) rather than a date library, to avoid local-timezone bugs.
 */

import { getSubjectAccentVar } from "./subjectTheme";
import type { AssessmentRecord, SubjectRecord } from "../types/domain";

export interface CalendarEvent {
  id: string;
  date: string;
  timeLabel: string;
  title: string;
  subjectId: string;
  subjectName: string;
  accentVar: string;
  assessment: AssessmentRecord;
}

/**
 * One event per assessment whose due date AND due time are both confirmed —
 * an unconfirmed date is never placed on a specific calendar day (see
 * getUnscheduledAssessments for those instead).
 */
export function getCalendarEvents(subjects: SubjectRecord[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime } = assessment;
      if (dueDate.status === "confirmed" && dueTime.status === "confirmed" && dueDate.value && dueTime.value) {
        events.push({
          id: assessment.id,
          date: dueDate.value,
          timeLabel: dueTime.value,
          title: assessment.title,
          subjectId: subject.id,
          subjectName: subject.name,
          accentVar: getSubjectAccentVar(subject.id),
          assessment,
        });
      }
    }
  }
  return events.sort((a, b) => (a.date + a.timeLabel < b.date + b.timeLabel ? -1 : 1));
}

export interface UnscheduledAssessment {
  subject: SubjectRecord;
  assessment: AssessmentRecord;
}

/** Assessments that can't be placed on an exact day — surfaced as a plain list instead of guessed at. */
export function getUnscheduledAssessments(subjects: SubjectRecord[]): UnscheduledAssessment[] {
  const results: UnscheduledAssessment[] = [];
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime } = assessment;
      const hasExactDate = dueDate.status === "confirmed" && dueTime.status === "confirmed" && dueDate.value && dueTime.value;
      if (!hasExactDate) results.push({ subject, assessment });
    }
  }
  return results;
}

/** 0 = Monday .. 6 = Sunday, for a "YYYY-MM-DD" date — used to align grid columns. */
function isoWeekday(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

export function addDaysIso(dateIso: string, delta: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A 6-week (42-day) grid covering the given month, starting the Monday on/before the 1st. */
export function getMonthGridDates(year: number, month: number): string[] {
  const firstOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const leadingDays = isoWeekday(firstOfMonth);
  const gridStart = addDaysIso(firstOfMonth, -leadingDays);
  return Array.from({ length: 42 }, (_, index) => addDaysIso(gridStart, index));
}

/** The Monday-to-Sunday week containing the given date. */
export function getWeekGridDates(dateIso: string): string[] {
  const weekStart = addDaysIso(dateIso, -isoWeekday(dateIso));
  return Array.from({ length: 7 }, (_, index) => addDaysIso(weekStart, index));
}

export function isSameMonth(dateIso: string, year: number, month: number): boolean {
  const [y, m] = dateIso.split("-").map(Number);
  return y === year && m - 1 === month;
}
