/**
 * Requested Canvas OAuth scopes (Phase 18E, Part 5/8). Least privilege —
 * every scope maps to exactly one already-built, read-only feature; see
 * docs/PHASE_18E_CANVAS_INTEGRATION.md §8 for the full per-scope
 * justification. No write scope, no admin scope, no grade/submission scope
 * here — those are a separate, explicit, off-by-default opt-in
 * (`CANVAS_GRADES_SCOPES` below), never requested at initial connect time.
 */

/** Requested at every Canvas connection — ordinary course/assignment/module/calendar/announcement import. */
export const CANVAS_READONLY_SCOPES: string[] = [
  "url:GET|/api/v1/users/self",
  "url:GET|/api/v1/courses",
  "url:GET|/api/v1/courses/:id",
  "url:GET|/api/v1/courses/:id/assignments",
  "url:GET|/api/v1/courses/:id/assignment_groups",
  "url:GET|/api/v1/courses/:id/modules",
  "url:GET|/api/v1/courses/:id/modules/:id/items",
  "url:GET|/api/v1/courses/:id/pages/:url",
  "url:GET|/api/v1/calendar_events",
  "url:GET|/api/v1/announcements",
];

/**
 * Requested ONLY when a user explicitly opts in via the separate grades
 * consent step (Part 12) — never bundled into `CANVAS_READONLY_SCOPES`,
 * never requested as a side effect of ordinary course import.
 */
export const CANVAS_GRADES_SCOPES: string[] = ["url:GET|/api/v1/courses/:id/students/submissions"];
