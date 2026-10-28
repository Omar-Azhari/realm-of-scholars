/**
 * Course discovery and classification (Phase 18F, Part 8). Classifies every
 * Moodle course the connected user is enrolled in (Moodle's own
 * `core_enrol_get_users_courses` already scopes results to enrolled
 * courses — unlike Canvas, there is no separate per-course "enrollment
 * state" field to read; Moodle's enrolment signal is effectively binary),
 * and suggests — but never silently finalises — a default selection. Every
 * course is always returned and reviewable, never hidden from the user
 * (Part 8: "Any uncertain course must remain reviewable").
 *
 * Classification terms are kept identical to Canvas's own
 * `CourseClassification` vocabulary (`"completed"`, not the brief's
 * "concluded") so both providers report through the SAME
 * `LmsCourseClassification` union (src/import/lmsProvider.ts) — the
 * underlying concept the brief's Part 8 asks for is preserved; only the
 * exact word differs, deliberately consolidated to one shared term rather
 * than two synonyms for the same state.
 */

import type { ValidatedMoodleCourse } from "./moodleSchemas";
import type { LmsCourseClassification } from "../../../import/lmsProvider";

export type MoodleCourseClassification = LmsCourseClassification;

const NON_ACADEMIC_NAME_HINTS = [
  "orientation",
  "welcome",
  "academic integrity",
  "library",
  "student services",
  "student union",
  "student club",
  "sandbox",
  "test course",
  "training",
  "how to moodle",
  "how to lms",
];

export function classifyMoodleCourse(course: ValidatedMoodleCourse, now: Date = new Date()): MoodleCourseClassification {
  if (course.visible === false) return "hidden";

  const start = course.startDateIso ? new Date(course.startDateIso) : null;
  const end = course.endDateIso ? new Date(course.endDateIso) : null;

  if (end && end.getTime() < now.getTime()) return "completed";
  if (start && start.getTime() > now.getTime()) return "future";
  if (course.visible === null && !start && !end) return "unknown";
  return "active"; // core_enrol_get_users_courses already scopes to enrolled courses — no separate enrolment-state signal to check
}

/** Heuristic-only, never a hard exclusion — the user can always re-include anything this flags. */
export function looksNonAcademic(course: ValidatedMoodleCourse): boolean {
  const haystack = `${course.fullName ?? ""} ${course.shortName ?? ""}`.toLowerCase();
  return NON_ACADEMIC_NAME_HINTS.some((hint) => haystack.includes(hint));
}

export interface MoodleCourseDiscoveryResult {
  course: ValidatedMoodleCourse;
  classification: MoodleCourseClassification;
  /** Default-selected only when true; the user can always change this — never applied without review (Part 8). */
  suggestedSelected: boolean;
  suggestionReason: string;
}

/**
 * Suggests a default selection: active courses that don't look
 * non-academic. Completed/future/hidden/unavailable/unknown courses, and
 * anything that looks like an orientation/library/support/club course,
 * default to UNselected — never silently imported (Part 8's explicit
 * list) — but every course is still returned and reviewable.
 */
export function discoverMoodleCourses(courses: ValidatedMoodleCourse[], now: Date = new Date()): MoodleCourseDiscoveryResult[] {
  return courses.map((course) => {
    const classification = classifyMoodleCourse(course, now);
    const nonAcademic = looksNonAcademic(course);

    let suggestedSelected = false;
    let suggestionReason: string;

    if (nonAcademic) {
      suggestionReason = "Looks like an orientation, library, support, or non-academic course — excluded by default, include manually if this is wrong.";
    } else if (classification === "active") {
      suggestedSelected = true;
      suggestionReason = "Currently active on the LMS.";
    } else if (classification === "completed") {
      suggestionReason = "Course has concluded — excluded by default, include manually if you still want it imported.";
    } else if (classification === "future") {
      suggestionReason = "Course hasn't started yet — excluded by default, include manually if you want to import it now.";
    } else if (classification === "hidden") {
      suggestionReason = "Course is hidden on the LMS.";
    } else {
      suggestionReason = "Course state couldn't be determined — reviewed manually rather than guessed.";
    }

    return { course, classification, suggestedSelected, suggestionReason };
  });
}
