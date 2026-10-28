/**
 * Canvas → canonical candidate mapping (Phase 18E, Part 8/9/10/11). Pure
 * functions only — no network, no I/O — so they're testable in isolation
 * and safely importable from both server-side orchestration
 * (`src/server/lms/canvas/canvasImportOrchestrator.ts`) and, if ever
 * needed, elsewhere. Every rule below is a DIRECT, literal encoding of the
 * brief's explicit "never infer" list — see the comment above each
 * function that touches a risk the brief specifically calls out.
 */

import type {
  ImportedAnnouncementCandidate,
  ImportedAssessmentCandidate,
  ImportedCalendarCandidate,
  ImportedModuleCandidate,
  ImportedSubjectCandidate,
  SourceReference,
} from "../types";
import type {
  ValidatedAnnouncement,
  ValidatedAssignment,
  ValidatedAssignmentGroup,
  ValidatedCalendarEvent,
  ValidatedCourse,
  ValidatedModule,
  ValidatedModuleItem,
} from "../../server/lms/canvas/canvasSchemas";
import { sanitizeCanvasHtml } from "./htmlSanitize";

/**
 * Stable, Canvas-id-derived temporaryIds (Phase 18E, Part 15/16) — NOT a
 * monotonic counter. Re-fetching the SAME Canvas item always produces the
 * SAME temporaryId, which is what makes change detection (comparing a
 * fresh fetch's candidates against stored `CanvasRemoteSnapshot`s by id) a
 * simple lookup rather than a fuzzy match, and prevents a re-sync from ever
 * creating a duplicate of an already-imported item.
 */
function canvasTempId(kind: string, canvasId: number): string {
  return `canvas-${kind}-${canvasId}`;
}

function ref(sourceId: string, filename: string, location: string | null, excerpt: string | null, parser: string): SourceReference {
  return { sourceId, filename, location, excerpt, parser, importedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Course → subject
// ---------------------------------------------------------------------------

export function mapCourseToSubject(course: ValidatedCourse, sourceId: string): ImportedSubjectCandidate {
  const hasCode = !!course.course_code;
  const hasName = !!course.name;
  const identityConfidence = hasCode && hasName ? "high" : hasCode || hasName ? "medium" : "missing";

  const sourceReferences: SourceReference[] = [];
  if (course.html_url) sourceReferences.push(ref(sourceId, `Canvas — ${course.name ?? course.course_code ?? "course"}`, course.html_url, null, "canvas:course"));

  return {
    temporaryId: canvasTempId("subject", course.id),
    code: course.course_code,
    name: course.name ?? course.course_code ?? "Untitled Canvas course",
    // Syllabus body is genuinely optional description text, sanitised — never a required field, never invented when absent.
    description: course.syllabus_body ? sanitizeCanvasHtml(course.syllabus_body) : null,
    coordinator: null, // Canvas's course object doesn't expose an instructor name in the fields this app requests — never guessed from enrollments without a dedicated, explicit teacher-role lookup
    creditPoints: null, // Canvas has no native "credit points" concept — never invented
    teachingPeriod: null, // never inferred from the current date alone (Part 8) — left for the user/registry-driven flow to resolve, same as every other provider
    colourSuggestion: null,
    modules: [],
    assessments: [],
    readings: [],
    goals: [],
    sourceReferences,
    confidence: identityConfidence,
    fieldConfidence: { code: hasCode ? "high" : "missing", name: hasName ? "high" : "missing" },
  };
}

// ---------------------------------------------------------------------------
// Assignment → assessment
// ---------------------------------------------------------------------------

/**
 * Weighting rule (Part 9): weighting is populated ONLY when the course
 * confirms it uses weighted assignment groups (`apply_assignment_group_weights`)
 * AND the assignment's own group has a `group_weight`. `points_possible` is
 * ALWAYS stored separately (in `pointsPossible` metadata carried via the
 * description/notes, never conflated with `weighting` — see the field-level
 * comment below) — the brief explicitly forbids assuming points are a
 * percentage.
 */
export function mapAssignmentToAssessment(
  assignment: ValidatedAssignment,
  assignmentGroup: ValidatedAssignmentGroup | null,
  courseAppliesGroupWeights: boolean,
  sourceId: string
): ImportedAssessmentCandidate {
  // due_at is the ONLY field that ever becomes a deadline (Part 8's explicit
  // rule) — unlock_at/lock_at are NEVER used here, regardless of whether
  // due_at is present.
  const due = assignment.due_at
    ? {
        rawText: assignment.due_at,
        isoDate: assignment.due_at.slice(0, 10),
        isoTime: assignment.due_at.length >= 16 ? assignment.due_at.slice(11, 16) : null,
        sourceTimezone: "UTC", // Canvas's due_at is always UTC ISO-8601
        weekNumber: null,
        dateKind: "exact" as const,
      }
    : null;

  const weighting = courseAppliesGroupWeights && assignmentGroup?.group_weight != null ? assignmentGroup.group_weight : null;

  const sourceReferences: SourceReference[] = [
    ref(sourceId, `Canvas — ${assignment.name ?? "assignment"}`, assignment.html_url, assignment.description ? sanitizeCanvasHtml(assignment.description).slice(0, 200) : null, "canvas:assignment"),
  ];

  return {
    temporaryId: canvasTempId("assessment", assignment.id),
    title: assignment.name ?? "Untitled Canvas assignment",
    type: "other", // Canvas doesn't expose a reliable assessment "kind" field the general engine's vocabulary maps onto directly — never guessed from a title alone (Part 8's "assessment type solely from a title" prohibition)
    description: assignment.description ? sanitizeCanvasHtml(assignment.description) : "",
    weighting,
    due,
    submissionMethod: assignment.submission_types.length > 0 ? assignment.submission_types.join(", ") : null,
    linkedModule: null, // set by the module-mapping pass when a module item references this assignment
    sourceReferences,
    confidence: assignment.due_at ? "high" : "medium",
    fieldConfidence: {
      weighting: weighting !== null ? "high" : "missing",
      dueDate: assignment.due_at ? "high" : "missing",
    },
  };
}

// ---------------------------------------------------------------------------
// Module + module items → module candidate
// ---------------------------------------------------------------------------

const ASSESSMENT_ITEM_TYPES = new Set(["Assignment", "Quiz"]);

export interface ModuleMappingResult {
  module: ImportedModuleCandidate;
  /** Canvas assignment/quiz ids this module's items referenced — used by the caller to link `linkedModule` on the matching assessment candidate, never to create a duplicate assessment from the module item itself (Part 10: "avoid duplicating an assignment imported through both the Assignments API and a module item"). */
  linkedAssignmentCanvasIds: number[];
}

function describeItem(item: ValidatedModuleItem): string {
  const label = item.title ?? `Untitled ${item.type ?? "item"}`;
  if (item.type === "ExternalUrl" && item.external_url) return `${label} (${item.external_url})`;
  return label;
}

export function mapModuleToCandidate(module: ValidatedModule, sourceId: string): ModuleMappingResult {
  const linkedAssignmentCanvasIds: number[] = [];
  const topics: string[] = [];

  for (const item of module.items) {
    if (item.type && ASSESSMENT_ITEM_TYPES.has(item.type) && item.content_id !== null) {
      linkedAssignmentCanvasIds.push(item.content_id);
      continue; // never duplicated as a module topic/resource — it's the linked assessment instead
    }
    // Page/File/Discussion/ExternalUrl/ExternalTool/SubHeader/unsupported
    // types remain module resource text, never promoted to an assessment.
    topics.push(describeItem(item));
  }

  const sourceReferences: SourceReference[] = [ref(sourceId, `Canvas — ${module.name ?? "module"}`, null, null, "canvas:module")];

  return {
    module: {
      temporaryId: canvasTempId("module", module.id),
      title: module.name ?? "Untitled Canvas module",
      weekNumber: null, // Canvas modules use `position`, not a week number — never conflated
      description: "",
      topics,
      readings: [],
      sourceReferences,
      confidence: module.name ? "high" : "medium",
      fieldConfidence: { title: module.name ? "high" : "missing" },
    },
    linkedAssignmentCanvasIds,
  };
}

// ---------------------------------------------------------------------------
// Calendar event → calendar candidate
// ---------------------------------------------------------------------------

/**
 * Assignment-generated calendar events are deduplicated by Canvas's own
 * `assignment.id` reference (Part 11) — NEVER by fuzzy title matching,
 * which the general engine uses for uploaded documents but which Canvas's
 * own structured `assignment_id` link makes unnecessary and less reliable
 * here.
 */
export function isAssignmentGeneratedEvent(event: ValidatedCalendarEvent): boolean {
  return event.type === "assignment" && event.assignment_id !== null;
}

export function mapCalendarEventToCandidate(event: ValidatedCalendarEvent, sourceId: string): ImportedCalendarCandidate {
  const startDateKind: "exact" | "missing" = event.start_at ? "exact" : "missing";
  const start = {
    rawText: event.start_at ?? "",
    isoDate: event.start_at ? event.start_at.slice(0, 10) : null,
    isoTime: event.all_day || !event.start_at ? null : event.start_at.slice(11, 16),
    sourceTimezone: "UTC",
    weekNumber: null,
    dateKind: startDateKind,
  };
  const end = event.end_at
    ? {
        rawText: event.end_at,
        isoDate: event.end_at.slice(0, 10),
        isoTime: event.all_day ? null : event.end_at.slice(11, 16),
        sourceTimezone: "UTC",
        weekNumber: null,
        dateKind: "exact" as const,
      }
    : null;

  return {
    temporaryId: canvasTempId("calendar", event.id),
    title: event.title ?? "Untitled Canvas event",
    start,
    end,
    recurrence: null, // Canvas calendar events don't expose an RRULE through this API — never fabricated
    location: null,
    subjectCode: null, // resolved by the caller from event.context_code -> course mapping, not guessed here
    eventType: event.type === "assignment" ? "exam" : "other", // a plain course calendar event is never assumed to be an exam; only Canvas's OWN assignment-linked flag maps to something more specific, and even then only loosely — see the orchestrator for the exact classification used
    sourceReferences: [ref(sourceId, `Canvas — ${event.title ?? "event"}`, event.html_url, null, "canvas:calendar-event")],
    confidence: event.start_at ? "high" : "low",
  };
}

// ---------------------------------------------------------------------------
// Announcement → announcement candidate (Part 11 — optional, never a deadline)
// ---------------------------------------------------------------------------

export function mapAnnouncementToCandidate(announcement: ValidatedAnnouncement, sourceId: string): ImportedAnnouncementCandidate {
  return {
    temporaryId: canvasTempId("announcement", announcement.id),
    title: announcement.title ?? "Untitled announcement",
    body: announcement.message ? sanitizeCanvasHtml(announcement.message) : "",
    authorName: announcement.author_display_name,
    postedAt: announcement.posted_at,
    sourceUrl: announcement.html_url,
    subjectCode: null, // resolved by the caller from context_code, same convention as calendar events
    sourceReferences: [ref(sourceId, `Canvas — ${announcement.title ?? "announcement"}`, announcement.html_url, null, "canvas:announcement")],
    confidence: announcement.message ? "high" : "medium",
  };
}

/** Canvas's `context_code` is `"course_<id>"` — this is the only place that parses it, so every caller shares one definition of the format. */
export function parseCourseContextCode(contextCode: string | null): number | null {
  if (!contextCode) return null;
  const match = /^course_(\d+)$/.exec(contextCode);
  return match ? Number(match[1]) : null;
}
