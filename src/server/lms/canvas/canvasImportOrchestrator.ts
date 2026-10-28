/**
 * Canvas import orchestration (Phase 18E, Part 7/8/9/10/11). For each
 * selected course: fetch assignments, assignment groups, modules, calendar
 * events, and (opt-in) announcements via the Canvas API client, map them
 * through the pure functions in `src/import/extraction/canvasMapping.ts`,
 * dedupe module-linked assignments and assignment-generated calendar
 * events, and assemble one `ImportedSourcePackage` — the SAME shape every
 * other provider produces, so it flows through the existing merge/Review/
 * Apply pipeline unmodified. One course failing never destroys another
 * course's result (the same discipline `discoveryOrchestrator.ts` already
 * established for university discovery).
 */

import type { CanvasInstitutionDefinition } from "../../../import/canvasInstitutionRegistry";
import type { ImportedAssessmentCandidate, ImportedSourcePackage, ImportWarning, ImportWarningKind } from "../../../import/types";
import {
  mapAnnouncementToCandidate,
  mapAssignmentToAssessment,
  mapCalendarEventToCandidate,
  mapCourseToSubject,
  mapModuleToCandidate,
  isAssignmentGeneratedEvent,
  parseCourseContextCode,
} from "../../../import/extraction/canvasMapping";
import { canvasGetList, canvasGetOne } from "./canvasClient";
import { CanvasError } from "./canvasErrors";
import {
  validateAnnouncement,
  validateAssignment,
  validateAssignmentGroup,
  validateCalendarEvent,
  validateCourse,
  validateModule,
  type ValidatedCourse,
} from "./canvasSchemas";

let warningCounter = 0;
function warn(kind: ImportWarningKind, message: string, sourceId: string): ImportWarning {
  warningCounter += 1;
  return { id: `canvas-warn-${warningCounter}`, kind, message, sourceId };
}

export interface CanvasCourseImportResult {
  courseId: number;
  courseName: string | null;
  status: "found" | "partial" | "error";
  assignmentsFound: number;
  modulesFound: number;
  calendarEventsFound: number;
  announcementsFound: number;
  warnings: string[];
}

export interface CanvasImportOutcome {
  sourcePackage: ImportedSourcePackage;
  courseResults: CanvasCourseImportResult[];
}

export interface CanvasImportOptions {
  includeAnnouncements: boolean;
  signal?: AbortSignal;
}

async function importOneCourse(
  institution: CanvasInstitutionDefinition,
  connectionId: string,
  courseId: number,
  options: CanvasImportOptions,
  sourceIdPrefix: string
): Promise<{
  subject: ReturnType<typeof mapCourseToSubject>;
  calendarEvents: ReturnType<typeof mapCalendarEventToCandidate>[];
  announcements: ReturnType<typeof mapAnnouncementToCandidate>[];
  warnings: ImportWarning[];
  result: CanvasCourseImportResult;
}> {
  const sourceId = `${sourceIdPrefix}-course-${courseId}`;
  const warnings: ImportWarning[] = [];
  const courseWarningMessages: string[] = [];

  const courseRecord: ValidatedCourse | null = await canvasGetOne<ValidatedCourse>(institution, connectionId, `/courses/${courseId}`, {}, validateCourse, options.signal);
  if (!courseRecord) {
    warnings.push(warn("source-unreachable", `Couldn't read course ${courseId} from Canvas.`, sourceId));
    return {
      subject: mapCourseToSubject({ id: courseId, name: null, course_code: null, workflow_state: null, enrollment_term_id: null, start_at: null, end_at: null, syllabus_body: null, html_url: null, enrollment_states: [], apply_assignment_group_weights: false }, sourceId),
      calendarEvents: [],
      announcements: [],
      warnings,
      result: { courseId, courseName: null, status: "error", assignmentsFound: 0, modulesFound: 0, calendarEventsFound: 0, announcementsFound: 0, warnings: ["Course could not be read from Canvas."] },
    };
  }

  const subject = mapCourseToSubject(courseRecord, sourceId);

  let assignmentsOutcome: Awaited<ReturnType<typeof canvasGetList<NonNullable<ReturnType<typeof validateAssignment>>>>> | null = null;
  let assignmentGroupsOutcome: Awaited<ReturnType<typeof canvasGetList<NonNullable<ReturnType<typeof validateAssignmentGroup>>>>> | null = null;
  let modulesOutcome: Awaited<ReturnType<typeof canvasGetList<NonNullable<ReturnType<typeof validateModule>>>>> | null = null;
  let calendarOutcome: Awaited<ReturnType<typeof canvasGetList<NonNullable<ReturnType<typeof validateCalendarEvent>>>>> | null = null;
  let announcementsOutcome: Awaited<ReturnType<typeof canvasGetList<NonNullable<ReturnType<typeof validateAnnouncement>>>>> | null = null;

  try {
    assignmentsOutcome = await canvasGetList(institution, connectionId, `/courses/${courseId}/assignments`, {}, validateAssignment, options.signal);
    if (assignmentsOutcome.skippedCount > 0) courseWarningMessages.push(`${assignmentsOutcome.skippedCount} assignment(s) had an unexpected shape and were skipped, not guessed.`);
  } catch (error) {
    courseWarningMessages.push(error instanceof CanvasError ? `Assignments: ${error.message}` : "Assignments couldn't be fetched.");
  }
  try {
    assignmentGroupsOutcome = await canvasGetList(institution, connectionId, `/courses/${courseId}/assignment_groups`, {}, validateAssignmentGroup, options.signal);
  } catch (error) {
    courseWarningMessages.push(error instanceof CanvasError ? `Assignment groups: ${error.message}` : "Assignment groups couldn't be fetched.");
  }
  try {
    modulesOutcome = await canvasGetList(institution, connectionId, `/courses/${courseId}/modules`, { include: "items" }, validateModule, options.signal);
    if (modulesOutcome.skippedCount > 0) courseWarningMessages.push(`${modulesOutcome.skippedCount} module(s) had an unexpected shape and were skipped, not guessed.`);
  } catch (error) {
    courseWarningMessages.push(error instanceof CanvasError ? `Modules: ${error.message}` : "Modules couldn't be fetched.");
  }
  try {
    calendarOutcome = await canvasGetList(institution, connectionId, "/calendar_events", { "context_codes[]": `course_${courseId}`, per_page: "100" }, validateCalendarEvent, options.signal);
  } catch (error) {
    courseWarningMessages.push(error instanceof CanvasError ? `Calendar: ${error.message}` : "Calendar events couldn't be fetched.");
  }
  if (options.includeAnnouncements) {
    try {
      announcementsOutcome = await canvasGetList(institution, connectionId, "/announcements", { "context_codes[]": `course_${courseId}` }, validateAnnouncement, options.signal);
    } catch (error) {
      courseWarningMessages.push(error instanceof CanvasError ? `Announcements: ${error.message}` : "Announcements couldn't be fetched.");
    }
  }

  const groupById = new Map((assignmentGroupsOutcome?.items ?? []).map((g) => [g.id, g]));
  const assessments: ImportedAssessmentCandidate[] = (assignmentsOutcome?.items ?? []).map((a) =>
    mapAssignmentToAssessment(a, a.assignment_group_id !== null ? (groupById.get(a.assignment_group_id) ?? null) : null, courseRecord.apply_assignment_group_weights, sourceId)
  );
  const assessmentByCanvasId = new Map((assignmentsOutcome?.items ?? []).map((a, i) => [a.id, assessments[i]]));

  for (const module of modulesOutcome?.items ?? []) {
    const { module: moduleCandidate, linkedAssignmentCanvasIds } = mapModuleToCandidate(module, sourceId);
    subject.modules.push(moduleCandidate);
    for (const canvasId of linkedAssignmentCanvasIds) {
      const assessment = assessmentByCanvasId.get(canvasId);
      if (assessment) assessment.linkedModule = moduleCandidate.temporaryId;
    }
  }
  subject.assessments = assessments;

  const calendarEvents = (calendarOutcome?.items ?? [])
    .filter((event) => !isAssignmentGeneratedEvent(event)) // deduplicated against the assignment's own due date — never imported twice
    .map((event) => {
      const candidate = mapCalendarEventToCandidate(event, sourceId);
      candidate.subjectCode = subject.code ?? String(parseCourseContextCode(event.context_code) ?? "");
      return candidate;
    });

  const announcements = (announcementsOutcome?.items ?? []).map((a) => {
    const candidate = mapAnnouncementToCandidate(a, sourceId);
    candidate.subjectCode = subject.code;
    return candidate;
  });

  for (const message of courseWarningMessages) warnings.push(warn("source-unreachable", message, sourceId));

  const status: CanvasCourseImportResult["status"] = courseWarningMessages.length === 0 ? "found" : subject.confidence === "missing" ? "error" : "partial";

  return {
    subject,
    calendarEvents,
    announcements,
    warnings,
    result: {
      courseId,
      courseName: courseRecord.name,
      status,
      assignmentsFound: assessments.length,
      modulesFound: modulesOutcome?.items.length ?? 0,
      calendarEventsFound: calendarEvents.length,
      announcementsFound: announcements.length,
      warnings: courseWarningMessages,
    },
  };
}

export async function importCanvasCourses(
  institution: CanvasInstitutionDefinition,
  connectionId: string,
  courseIds: number[],
  options: CanvasImportOptions,
  sourceIdPrefix: string
): Promise<CanvasImportOutcome> {
  const subjects: ReturnType<typeof mapCourseToSubject>[] = [];
  const calendarEvents: ReturnType<typeof mapCalendarEventToCandidate>[] = [];
  const announcements: ReturnType<typeof mapAnnouncementToCandidate>[] = [];
  const warnings: ImportWarning[] = [];
  const courseResults: CanvasCourseImportResult[] = [];

  for (const courseId of courseIds) {
    const outcome = await importOneCourse(institution, connectionId, courseId, options, sourceIdPrefix);
    subjects.push(outcome.subject);
    calendarEvents.push(...outcome.calendarEvents);
    announcements.push(...outcome.announcements);
    warnings.push(...outcome.warnings);
    courseResults.push(outcome.result);
  }

  return {
    sourcePackage: {
      providerId: "canvas-lms",
      subjects,
      calendarEvents,
      announcements,
      warnings,
      conflicts: [],
    },
    courseResults,
  };
}
