/**
 * La Trobe University teaching-period dates, from La Trobe's own key-dates
 * pages. Only periods confirmed from an official source are listed — add
 * others the same way once they're checked. Used to fill in the semester
 * start (so "this week", quest due dates, bosses and plans line up), the
 * mid-semester break, and the assessment (exam) period.
 *
 * Semester 2, 2026: starts Monday 13 July; mid-semester break 31 August –
 * 6 September; assessment period 16–24 October.
 * Sources: https://www.latrobe.edu.au/calendar/all-students/census-dates and
 * https://www.latrobe.edu.au/calendar/exams-and-results
 */

import type { Enrolment } from "../types";

export interface TeachingPeriodDates {
  year: number;
  period: string;
  /** Monday of teaching week 1. */
  start: string;
  /** Mondays of non-teaching weeks inside the period. */
  breakWeeks: string[];
  examStart: string;
  examEnd: string;
  source: string;
}

export const LA_TROBE_DATES: TeachingPeriodDates[] = [
  {
    year: 2026,
    period: "Semester 2",
    start: "2026-07-13",
    breakWeeks: ["2026-08-31"],
    examStart: "2026-10-16",
    examEnd: "2026-10-24",
    source: "https://www.latrobe.edu.au/calendar/all-students/census-dates",
  },
];

export function laTrobeDatesFor(enrolment: Pick<Enrolment, "university" | "teachingPeriod" | "year">): TeachingPeriodDates | null {
  if (!/la\s*trobe/i.test(enrolment.university)) return null;
  const period = enrolment.teachingPeriod.trim().toLowerCase();
  return LA_TROBE_DATES.find((d) => d.year === enrolment.year && d.period.toLowerCase() === period) ?? null;
}

/** Fills the semester start, break and exam period from La Trobe's calendar when the enrolment has no start date. */
export function withLaTrobeDates(enrolment: Enrolment): Enrolment {
  if (enrolment.startDate) return enrolment;
  const dates = laTrobeDatesFor(enrolment);
  if (!dates) return enrolment;
  return { ...enrolment, startDate: dates.start, breakWeeks: dates.breakWeeks, examPeriod: { start: dates.examStart, end: dates.examEnd } };
}
