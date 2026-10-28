/**
 * Runtime validation of Canvas API responses (Phase 18E, Part 6). Canvas is
 * an external system this app doesn't control — its responses are never
 * trusted blindly, and a malformed or unexpectedly-shaped response is
 * rejected here rather than allowed to propagate `undefined`/wrong-typed
 * values into the mapping layer (`canvasProvider.ts`).
 *
 * Unlike this project's OWN request validation (`src/server/schema.ts`),
 * which REJECTS unknown fields, these validators are deliberately
 * permissive about extra fields Canvas sends but this app doesn't use —
 * Canvas's API is a large surface that evolves; the discipline here is
 * "every field we actually read is the right type or explicitly null/
 * absent", not "the response must match our shape exactly".
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((v): v is string => typeof v === "string");
  return strings;
}

function optionalNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is number => typeof v === "number");
}

export interface ValidatedCourse {
  id: number;
  name: string | null;
  course_code: string | null;
  workflow_state: string | null;
  enrollment_term_id: number | null;
  start_at: string | null;
  end_at: string | null;
  syllabus_body: string | null;
  html_url: string | null;
  enrollment_states: string[];
  apply_assignment_group_weights: boolean;
}

/** Returns null (not a throw) when the response isn't even a plausible Canvas course — the caller decides how to report that as a warning, never crashes the whole request over one malformed item. */
export function validateCourse(raw: unknown): ValidatedCourse | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  const enrollments = Array.isArray(raw.enrollments) ? raw.enrollments : [];
  const enrollmentStates = enrollments
    .filter(isRecord)
    .map((e) => optionalString(e.enrollment_state))
    .filter((s): s is string => s !== null);
  return {
    id,
    name: optionalString(raw.name),
    course_code: optionalString(raw.course_code),
    workflow_state: optionalString(raw.workflow_state),
    enrollment_term_id: optionalNumber(raw.enrollment_term_id),
    start_at: optionalString(raw.start_at),
    end_at: optionalString(raw.end_at),
    syllabus_body: optionalString(raw.syllabus_body),
    html_url: optionalString(raw.html_url),
    enrollment_states: enrollmentStates,
    apply_assignment_group_weights: optionalBoolean(raw.apply_assignment_group_weights) ?? false,
  };
}

export interface ValidatedAssignment {
  id: number;
  name: string | null;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  points_possible: number | null;
  assignment_group_id: number | null;
  submission_types: string[];
  allowed_extensions: string[];
  published: boolean | null;
  anonymous_grading: boolean | null;
  html_url: string | null;
}

export function validateAssignment(raw: unknown): ValidatedAssignment | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    name: optionalString(raw.name),
    description: optionalString(raw.description),
    due_at: optionalString(raw.due_at),
    unlock_at: optionalString(raw.unlock_at),
    lock_at: optionalString(raw.lock_at),
    created_at: optionalString(raw.created_at),
    updated_at: optionalString(raw.updated_at),
    points_possible: optionalNumber(raw.points_possible),
    assignment_group_id: optionalNumber(raw.assignment_group_id),
    submission_types: optionalStringArray(raw.submission_types) ?? [],
    allowed_extensions: optionalStringArray(raw.allowed_extensions) ?? [],
    published: optionalBoolean(raw.published),
    anonymous_grading: optionalBoolean(raw.anonymous_grading),
    html_url: optionalString(raw.html_url),
  };
}

export interface ValidatedAssignmentGroup {
  id: number;
  name: string | null;
  group_weight: number | null;
}

export function validateAssignmentGroup(raw: unknown): ValidatedAssignmentGroup | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return { id, name: optionalString(raw.name), group_weight: optionalNumber(raw.group_weight) };
}

export interface ValidatedModuleItem {
  id: number;
  module_id: number | null;
  position: number | null;
  title: string | null;
  type: string | null;
  content_id: number | null;
  html_url: string | null;
  external_url: string | null;
  published: boolean | null;
}

export function validateModuleItem(raw: unknown): ValidatedModuleItem | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    module_id: optionalNumber(raw.module_id),
    position: optionalNumber(raw.position),
    title: optionalString(raw.title),
    type: optionalString(raw.type),
    content_id: optionalNumber(raw.content_id),
    html_url: optionalString(raw.html_url),
    external_url: optionalString(raw.external_url),
    published: optionalBoolean(raw.published),
  };
}

export interface ValidatedModule {
  id: number;
  name: string | null;
  position: number | null;
  unlock_at: string | null;
  prerequisite_module_ids: number[];
  published: boolean | null;
  items: ValidatedModuleItem[];
}

export function validateModule(raw: unknown): ValidatedModule | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  const items = Array.isArray(raw.items) ? raw.items.map(validateModuleItem).filter((i): i is ValidatedModuleItem => i !== null) : [];
  return {
    id,
    name: optionalString(raw.name),
    position: optionalNumber(raw.position),
    unlock_at: optionalString(raw.unlock_at),
    prerequisite_module_ids: optionalNumberArray(raw.prerequisite_module_ids) ?? [],
    published: optionalBoolean(raw.published),
    items,
  };
}

export interface ValidatedCalendarEvent {
  id: number;
  title: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  context_code: string | null;
  html_url: string | null;
  type: string | null;
  assignment_id: number | null;
}

export function validateCalendarEvent(raw: unknown): ValidatedCalendarEvent | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  const assignment = isRecord(raw.assignment) ? raw.assignment : null;
  return {
    id,
    title: optionalString(raw.title),
    description: optionalString(raw.description),
    start_at: optionalString(raw.start_at),
    end_at: optionalString(raw.end_at),
    all_day: optionalBoolean(raw.all_day) ?? false,
    context_code: optionalString(raw.context_code),
    html_url: optionalString(raw.html_url),
    type: optionalString(raw.type),
    assignment_id: assignment ? optionalNumber(assignment.id) : null,
  };
}

export interface ValidatedAnnouncement {
  id: number;
  title: string | null;
  message: string | null;
  posted_at: string | null;
  html_url: string | null;
  author_display_name: string | null;
  context_code: string | null;
}

export function validateAnnouncement(raw: unknown): ValidatedAnnouncement | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  const author = isRecord(raw.author) ? raw.author : null;
  return {
    id,
    title: optionalString(raw.title),
    message: optionalString(raw.message),
    posted_at: optionalString(raw.posted_at),
    html_url: optionalString(raw.html_url),
    author_display_name: author ? optionalString(author.display_name) : null,
    context_code: optionalString(raw.context_code),
  };
}

export interface ValidatedUser {
  id: number;
  name: string | null;
}

export function validateUser(raw: unknown): ValidatedUser | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return { id, name: optionalString(raw.name) };
}
