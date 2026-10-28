/**
 * Course discovery and classification (Phase 18E, Part 7). Classifies every
 * Canvas course the authorised user can see, and suggests — but never
 * silently finalises — a default selection. The user reviews and confirms
 * every course before anything is imported (Part 7: "UI must let the user
 * select courses... it must remain reviewable").
 */

import type { ValidatedCourse } from "./canvasSchemas";

export type CourseClassification = "active" | "completed" | "future" | "unavailable" | "unknown";

const NON_ACADEMIC_NAME_HINTS = [
  "orientation",
  "welcome",
  "student union",
  "student club",
  "sandbox",
  "test course",
  "training",
  "how to canvas",
];

export function classifyCourse(course: ValidatedCourse, now: Date = new Date()): CourseClassification {
  if (course.workflow_state === "deleted" || course.workflow_state === "unpublished") return "unavailable";
  if (course.workflow_state === "completed") return "completed";

  const isActiveEnrollment = course.enrollment_states.includes("active");
  const isInvitedOnly = course.enrollment_states.length > 0 && course.enrollment_states.every((s) => s === "invited");

  const start = course.start_at ? new Date(course.start_at) : null;
  const end = course.end_at ? new Date(course.end_at) : null;

  if (end && end.getTime() < now.getTime()) return "completed";
  if (start && start.getTime() > now.getTime()) return "future";
  if (isActiveEnrollment) return "active";
  if (isInvitedOnly) return "future"; // invited but not yet enrolled — never assumed active
  if (course.enrollment_states.length === 0) return "unknown"; // no enrolment info at all — never guessed as active
  return "unknown";
}

/** Heuristic-only, never a hard exclusion — the user can always re-include anything this flags. Matches course name/code substrings a real orientation/test/club course would plausibly use; a genuine academic subject with an unlucky name is still shown, just not auto-selected. */
export function looksNonAcademic(course: ValidatedCourse): boolean {
  const haystack = `${course.name ?? ""} ${course.course_code ?? ""}`.toLowerCase();
  return NON_ACADEMIC_NAME_HINTS.some((hint) => haystack.includes(hint));
}

export interface CourseDiscoveryResult {
  course: ValidatedCourse;
  classification: CourseClassification;
  /** Default-selected only when true; the user can always change this — never applied without review (Part 7). */
  suggestedSelected: boolean;
  suggestionReason: string;
}

/**
 * Suggests a default selection: active courses that don't look
 * non-academic. Concluded/future/unavailable/unknown courses, and anything
 * that looks like an orientation/test/club course, default to UNselected —
 * never silently imported (Part 7's explicit list) — but every course is
 * still returned and reviewable, never hidden.
 */
export function discoverCourses(courses: ValidatedCourse[], now: Date = new Date()): CourseDiscoveryResult[] {
  return courses.map((course) => {
    const classification = classifyCourse(course, now);
    const nonAcademic = looksNonAcademic(course);

    let suggestedSelected = false;
    let suggestionReason: string;

    if (nonAcademic) {
      suggestionReason = "Looks like an orientation, test, or non-academic course — excluded by default, include manually if this is wrong.";
    } else if (classification === "active") {
      suggestedSelected = true;
      suggestionReason = "Active enrolment, currently running.";
    } else if (classification === "completed") {
      suggestionReason = "Course has concluded — excluded by default, include manually if you still want it imported.";
    } else if (classification === "future") {
      suggestionReason = "Course hasn't started yet — excluded by default, include manually if you want to import it now.";
    } else if (classification === "unavailable") {
      suggestionReason = "Course is unpublished or no longer available.";
    } else {
      suggestionReason = "Enrolment state couldn't be determined — reviewed manually rather than guessed.";
    }

    return { course, classification, suggestedSelected, suggestionReason };
  });
}
