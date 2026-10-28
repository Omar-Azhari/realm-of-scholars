/**
 * Raw Canvas API response shapes (Phase 18E, Part 6). These describe what
 * Canvas's REST API actually returns (per Canvas's own API documentation
 * conventions) — every field is optional/nullable here even where Canvas
 * usually sends it, because "usually" is not "always": a genuinely missing
 * or null field must flow through as missing, never defaulted or guessed
 * (Part 8: "do not blindly trust Canvas API data; handle nullable and
 * omitted fields"). Runtime validation lives in canvasSchemas.ts — this
 * file is types only.
 */

export interface CanvasUser {
  id: number;
  name?: string | null;
  short_name?: string | null;
}

export interface CanvasEnrollment {
  type?: string | null; // "StudentEnrollment", "TeacherEnrollment", etc.
  enrollment_state?: string | null; // "active", "invited", "completed", "inactive"
  role?: string | null;
}

export interface CanvasCourse {
  id: number;
  name?: string | null;
  course_code?: string | null;
  workflow_state?: string | null; // "unpublished" | "available" | "completed" | "deleted"
  enrollment_term_id?: number | null;
  start_at?: string | null;
  end_at?: string | null;
  syllabus_body?: string | null;
  html_url?: string | null;
  enrollments?: CanvasEnrollment[] | null;
  apply_assignment_group_weights?: boolean | null;
}

export interface CanvasAssignmentGroup {
  id: number;
  name?: string | null;
  group_weight?: number | null;
}

export interface CanvasAssignment {
  id: number;
  name?: string | null;
  description?: string | null; // raw HTML — must be sanitised before display
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  points_possible?: number | null;
  assignment_group_id?: number | null;
  submission_types?: string[] | null;
  allowed_extensions?: string[] | null;
  has_submitted_submissions?: boolean | null;
  published?: boolean | null;
  anonymous_grading?: boolean | null;
  html_url?: string | null;
  external_tool_tag_attributes?: { url?: string | null } | null;
}

export interface CanvasModuleItem {
  id: number;
  module_id?: number | null;
  position?: number | null;
  title?: string | null;
  type?: string | null; // "Page" | "Assignment" | "Quiz" | "File" | "Discussion" | "ExternalUrl" | "ExternalTool" | "SubHeader" | ...
  content_id?: number | null; // links back to the Assignment/Quiz/etc id when type references one
  html_url?: string | null;
  external_url?: string | null;
  published?: boolean | null;
}

export interface CanvasModule {
  id: number;
  name?: string | null;
  position?: number | null;
  unlock_at?: string | null;
  prerequisite_module_ids?: number[] | null;
  state?: string | null;
  published?: boolean | null;
  items_count?: number | null;
  items?: CanvasModuleItem[] | null;
}

export interface CanvasCalendarEvent {
  id: number;
  title?: string | null;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  all_day?: boolean | null;
  context_code?: string | null; // e.g. "course_123"
  html_url?: string | null;
  type?: string | null; // "event" | "assignment"
  assignment?: { id: number } | null; // present when type === "assignment"
}

export interface CanvasAnnouncement {
  id: number;
  title?: string | null;
  message?: string | null; // raw HTML — must be sanitised
  posted_at?: string | null;
  html_url?: string | null;
  author?: { display_name?: string | null } | null;
  context_code?: string | null;
}
