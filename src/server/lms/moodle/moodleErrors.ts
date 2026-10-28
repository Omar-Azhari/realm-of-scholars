/**
 * Structured Moodle error categories (Phase 18F, Part 6/22) — shared by the
 * connection-validation flow and the Moodle API client so every failure
 * mode has one name, never a raw exception message (or a raw Moodle
 * `errorcode`/`debuginfo` string, which can include server paths) leaking
 * to the browser.
 */

export type MoodleErrorCategory =
  | "not-configured"
  | "invalid-request"
  | "invalid-token"
  | "wrong-host"
  | "wrong-site"
  | "insufficient-permission"
  | "connection-not-found"
  | "ownership-mismatch"
  | "reauthorisation-required"
  | "rate-limited"
  | "moodle-unavailable"
  | "moodle-exception"
  | "forbidden"
  | "not-found"
  | "invalid-response"
  | "unknown";

export class MoodleError extends Error {
  readonly category: MoodleErrorCategory;
  constructor(category: MoodleErrorCategory, message: string) {
    super(message);
    this.name = "MoodleError";
    this.category = category;
  }
}

/** Every message here is safe to show a user or put in a client-facing JSON error — never includes a raw Moodle exception/errorcode/debuginfo, a token, or an internal stack trace. */
export function toClientMessage(category: MoodleErrorCategory): string {
  switch (category) {
    case "not-configured":
      return "Moodle integration isn't set up for this institution yet.";
    case "invalid-request":
      return "That request was malformed.";
    case "invalid-token":
      return "That Moodle connection token isn't valid.";
    case "wrong-host":
      return "That Moodle connection doesn't match the institution's own LMS.";
    case "wrong-site":
      return "That Moodle token belongs to a different Moodle site.";
    case "insufficient-permission":
      return "This Moodle token doesn't permit the functions UniGame needs.";
    case "connection-not-found":
      return "No Moodle connection was found.";
    case "ownership-mismatch":
      return "That Moodle connection doesn't belong to this installation.";
    case "reauthorisation-required":
      return "Your Moodle connection needs to be reconfigured.";
    case "rate-limited":
      return "Moodle is temporarily rate-limiting requests — try again shortly.";
    case "moodle-unavailable":
      return "Moodle is temporarily unavailable.";
    case "moodle-exception":
      return "Moodle reported a problem handling that request.";
    case "forbidden":
      return "Moodle denied access to that resource.";
    case "not-found":
      return "That Moodle resource wasn't found.";
    case "invalid-response":
      return "Moodle returned a response UniGame couldn't understand.";
    case "unknown":
      return "Something went wrong with the Moodle connection.";
  }
}
