/**
 * Moodle import orchestration (Phase 18F, Part 9/10/11/12/13/14). For each
 * selected course: fetch course contents (sections/activities),
 * assignments, quizzes, calendar events, and (opt-in) announcements via the
 * Moodle client, map them through the pure functions in
 * `src/import/extraction/moodleMapping.ts`, dedupe section-linked
 * assignments/quizzes and activity-generated calendar events, and assemble
 * one `ImportedSourcePackage` — the SAME shape every other provider
 * produces, so it flows through the existing merge/Review/Apply pipeline
 * unmodified. One course failing never destroys another course's result
 * (the same discipline `canvasImportOrchestrator.ts`/
 * `discoveryOrchestrator.ts` already established).
 *
 * A single-course fetch always uses `moodleGetOne` (never a list-shaped
 * function) — this project already found and fixed a real bug earlier
 * (Phase 18E) where a single-resource fetch was mistakenly routed through
 * a list-fetch function; that lesson is applied deliberately here.
 */

import type { ImportedAssessmentCandidate, ImportedSourcePackage, ImportWarning, ImportWarningKind } from "../../../import/types";
import {
  isMoodleActivityGeneratedEvent,
  isMoodleQuizAssessable,
  mapMoodleAssignToAssessment,
  mapMoodleCalendarEventToCandidate,
  mapMoodleCourseToSubject,
  mapMoodleForumPostToAnnouncement,
  mapMoodleQuizToAssessment,
  mapMoodleSectionToCandidate,
} from "../../../import/extraction/moodleMapping";
import { moodleGetList, moodleGetOne, moodleGetWrappedList } from "./moodleClient";
import { MoodleError } from "./moodleErrors";
import {
  validateMoodleAssign,
  validateMoodleCalendarEvent,
  validateMoodleForumPost,
  validateMoodleQuiz,
  validateMoodleSection,
  type ValidatedMoodleAssign,
  type ValidatedMoodleQuiz,
} from "./moodleSchemas";
import type { MoodleInstitutionDefinition } from "../../../import/moodleInstitutionRegistry";

let warningCounter = 0;
function warn(kind: ImportWarningKind, message: string, sourceId: string): ImportWarning {
  warningCounter += 1;
  return { id: `moodle-warn-${warningCounter}`, kind, message, sourceId };
}

function unwrapAssignmentsForCourse(courseId: number): (raw: unknown) => unknown[] | null {
  return (raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return null;
    const courses = (raw as { courses?: unknown }).courses;
    if (!Array.isArray(courses)) return null;
    const match = courses.find((c) => typeof c === "object" && c !== null && (c as { id?: unknown }).id === courseId);
    if (!match) return [];
    const assignments = (match as { assignments?: unknown }).assignments;
    return Array.isArray(assignments) ? assignments : [];
  };
}

function unwrapField(fieldName: string): (raw: unknown) => unknown[] | null {
  return (raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return null;
    const field = (raw as Record<string, unknown>)[fieldName];
    return Array.isArray(field) ? field : null;
  };
}

export interface MoodleCourseImportResult {
  courseId: number;
  courseName: string | null;
  status: "found" | "partial" | "error";
  assignmentsFound: number;
  quizzesFound: number;
  sectionsFound: number;
  calendarEventsFound: number;
  announcementsFound: number;
  warnings: string[];
}

export interface MoodleImportOutcome {
  sourcePackage: ImportedSourcePackage;
  courseResults: MoodleCourseImportResult[];
}

export interface MoodleImportOptions {
  includeAnnouncements: boolean;
  signal?: AbortSignal;
}

/**
 * `discoveredCourses` are the already-fetched, already-
 * validated course records from course discovery (Part 8) — Moodle has no
 * single reliable "get one course by id" web-service function available
 * across versions the way Canvas's `GET /courses/:id` is, so this
 * orchestrator takes the course record directly rather than re-fetching a
 * single course (deliberately avoiding the exact "single-resource fetch
 * through a list-shaped assumption" mistake this project already found and
 * fixed once for Canvas).
 */
export async function importMoodleCourses(
  institution: MoodleInstitutionDefinition,
  connectionId: string,
  discoveredCourses: Array<{ id: number; shortName: string | null; fullName: string | null; viewUrl: string | null }>,
  options: MoodleImportOptions,
  sourceIdPrefix: string
): Promise<MoodleImportOutcome> {
  const subjects: ReturnType<typeof mapMoodleCourseToSubject>[] = [];
  const calendarEvents: ReturnType<typeof mapMoodleCalendarEventToCandidate>[] = [];
  const announcements: ReturnType<typeof mapMoodleForumPostToAnnouncement>[] = [];
  const warnings: ImportWarning[] = [];
  const courseResults: MoodleCourseImportResult[] = [];

  for (const course of discoveredCourses) {
    const sourceId = `${sourceIdPrefix}-course-${course.id}`;
    const courseWarningMessages: string[] = [];
    const subject = mapMoodleCourseToSubject(
      { id: course.id, shortName: course.shortName, fullName: course.fullName, category: null, startDateIso: null, endDateIso: null, visible: null, progress: null, viewUrl: course.viewUrl, lastAccessIso: null },
      sourceId
    );

    let assignOutcome: Awaited<ReturnType<typeof moodleGetWrappedList<ValidatedMoodleAssign>>> | null = null;
    let quizOutcome: Awaited<ReturnType<typeof moodleGetWrappedList<ValidatedMoodleQuiz>>> | null = null;
    let sectionsOutcome: Awaited<ReturnType<typeof moodleGetList<NonNullable<ReturnType<typeof validateMoodleSection>>>>> | null = null;
    let calendarOutcome: Awaited<ReturnType<typeof moodleGetWrappedList<NonNullable<ReturnType<typeof validateMoodleCalendarEvent>>>>> | null = null;
    let announcementOutcome: Awaited<ReturnType<typeof moodleGetWrappedList<NonNullable<ReturnType<typeof validateMoodleForumPost>>>>> | null = null;

    try {
      assignOutcome = await moodleGetWrappedList(institution, connectionId, "mod_assign_get_assignments", { "courseids[0]": String(course.id) }, unwrapAssignmentsForCourse(course.id), validateMoodleAssign, options.signal);
      if (assignOutcome.skippedCount > 0) courseWarningMessages.push(`${assignOutcome.skippedCount} assignment(s) had an unexpected shape and were skipped, not guessed.`);
    } catch (error) {
      courseWarningMessages.push(error instanceof MoodleError ? `Assignments: ${error.message}` : "Assignments couldn't be fetched.");
    }
    try {
      quizOutcome = await moodleGetWrappedList(institution, connectionId, "mod_quiz_get_quizzes_by_courses", { "course_ids[0]": String(course.id) }, unwrapField("quizzes"), validateMoodleQuiz, options.signal);
    } catch (error) {
      courseWarningMessages.push(error instanceof MoodleError ? `Quizzes: ${error.message}` : "Quizzes couldn't be fetched.");
    }
    try {
      sectionsOutcome = await moodleGetList(institution, connectionId, "core_course_get_contents", { courseid: String(course.id) }, validateMoodleSection, options.signal);
      if (sectionsOutcome.skippedCount > 0) courseWarningMessages.push(`${sectionsOutcome.skippedCount} section(s) had an unexpected shape and were skipped, not guessed.`);
    } catch (error) {
      courseWarningMessages.push(error instanceof MoodleError ? `Sections: ${error.message}` : "Course sections couldn't be fetched.");
    }
    try {
      calendarOutcome = await moodleGetWrappedList(
        institution,
        connectionId,
        "core_calendar_get_calendar_events",
        { "events[courseids][0]": String(course.id) },
        unwrapField("events"),
        validateMoodleCalendarEvent,
        options.signal
      );
    } catch (error) {
      courseWarningMessages.push(error instanceof MoodleError ? `Calendar: ${error.message}` : "Calendar events couldn't be fetched.");
    }
    if (options.includeAnnouncements) {
      try {
        // Two-step: find the course's "news"/announcements forum, then its
        // recent discussions — Moodle exposes announcements as an ordinary
        // forum activity of a specific type, not a dedicated endpoint.
        const forums = await moodleGetOne<Array<{ id: unknown; type: unknown; course: unknown }>>(
          institution,
          connectionId,
          "mod_forum_get_forums_by_courses",
          { "courseids[0]": String(course.id) },
          (raw) => (Array.isArray(raw) ? raw : null),
          options.signal
        );
        const newsForum = forums?.find((f) => f.type === "news");
        if (newsForum && typeof newsForum.id === "number") {
          announcementOutcome = await moodleGetWrappedList(
            institution,
            connectionId,
            "mod_forum_get_forum_discussions",
            { forumid: String(newsForum.id) },
            unwrapField("discussions"),
            validateMoodleForumPost,
            options.signal
          );
        }
      } catch (error) {
        courseWarningMessages.push(error instanceof MoodleError ? `Announcements: ${error.message}` : "Announcements couldn't be fetched.");
      }
    }

    const assessmentByAssignInstance = new Map<number, ImportedAssessmentCandidate>();
    const assessments: ImportedAssessmentCandidate[] = [];
    for (const assign of assignOutcome?.items ?? []) {
      const assessment = mapMoodleAssignToAssessment(assign, sourceId);
      assessments.push(assessment);
      assessmentByAssignInstance.set(assign.id, assessment);
    }
    const assessmentByQuizInstance = new Map<number, ImportedAssessmentCandidate>();
    for (const quiz of quizOutcome?.items ?? []) {
      if (!isMoodleQuizAssessable(quiz)) continue; // practice quiz — stays a resource, never an assessment (Part 11)
      const assessment = mapMoodleQuizToAssessment(quiz, sourceId);
      assessments.push(assessment);
      assessmentByQuizInstance.set(quiz.id, assessment);
    }

    for (const section of sectionsOutcome?.items ?? []) {
      const { module, linkedAssignInstanceIds, linkedQuizInstanceIds } = mapMoodleSectionToCandidate(section, sourceId);
      subject.modules.push(module);
      for (const instanceId of linkedAssignInstanceIds) {
        const assessment = assessmentByAssignInstance.get(instanceId);
        if (assessment) assessment.linkedModule = module.temporaryId;
      }
      for (const instanceId of linkedQuizInstanceIds) {
        const assessment = assessmentByQuizInstance.get(instanceId);
        if (assessment) assessment.linkedModule = module.temporaryId;
      }
    }
    subject.assessments = assessments;

    const courseCalendarEvents = (calendarOutcome?.items ?? [])
      .filter((event) => !isMoodleActivityGeneratedEvent(event)) // deduplicated against the assignment/quiz's own due date — never imported twice
      .map((event) => {
        const candidate = mapMoodleCalendarEventToCandidate(event, sourceId);
        candidate.subjectCode = subject.code ?? (event.courseId !== null ? String(event.courseId) : "");
        return candidate;
      });

    const courseAnnouncements = (announcementOutcome?.items ?? []).map((post) => {
      const candidate = mapMoodleForumPostToAnnouncement(post, sourceId);
      candidate.subjectCode = subject.code;
      return candidate;
    });

    for (const message of courseWarningMessages) warnings.push(warn("source-unreachable", message, sourceId));
    const status: MoodleCourseImportResult["status"] = courseWarningMessages.length === 0 ? "found" : subject.confidence === "missing" ? "error" : "partial";

    subjects.push(subject);
    calendarEvents.push(...courseCalendarEvents);
    announcements.push(...courseAnnouncements);
    courseResults.push({
      courseId: course.id,
      courseName: course.fullName,
      status,
      assignmentsFound: assignOutcome?.items.length ?? 0,
      quizzesFound: assessmentByQuizInstance.size,
      sectionsFound: sectionsOutcome?.items.length ?? 0,
      calendarEventsFound: courseCalendarEvents.length,
      announcementsFound: courseAnnouncements.length,
      warnings: courseWarningMessages,
    });
  }

  return {
    sourcePackage: { providerId: "moodle-lms", subjects, calendarEvents, announcements, warnings, conflicts: [] },
    courseResults,
  };
}
