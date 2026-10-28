/**
 * Fixed error categories for the discovery backend (Phase 18C, Part 11).
 * Every failure the backend can produce maps to exactly one of these — used
 * for both the HTTP response and structured logging, so a log line and a
 * client-visible error always agree on what happened.
 */

export type DiscoveryErrorCategory =
  | "invalid-request"
  | "unsupported-institution"
  | "no-official-result"
  | "robots-disallowed"
  | "timeout"
  | "domain-rejected"
  | "redirect-rejected"
  | "response-too-large"
  | "unsupported-content-type"
  | "parse-failure"
  | "stale-academic-year"
  | "ambiguous-results"
  | "service-misconfigured"
  | "rate-limited";

export class DiscoveryError extends Error {
  readonly category: DiscoveryErrorCategory;
  constructor(category: DiscoveryErrorCategory, message: string) {
    super(message);
    this.name = "DiscoveryError";
    this.category = category;
  }
}

/** User-facing text never includes stack traces or raw exception internals — see Part 9. */
export function toClientMessage(category: DiscoveryErrorCategory, detail?: string): string {
  const base: Record<DiscoveryErrorCategory, string> = {
    "invalid-request": "That search request wasn't in a shape UniGame recognises.",
    "unsupported-institution": "That university isn't in UniGame's registry yet.",
    "no-official-result": "No official page could be found for this subject.",
    "robots-disallowed": "This page's site asks automated tools not to access it.",
    timeout: "The university's website took too long to respond.",
    "domain-rejected": "That page isn't on this university's official domain.",
    "redirect-rejected": "That page redirected somewhere UniGame doesn't trust.",
    "response-too-large": "That page was too large to process safely.",
    "unsupported-content-type": "That page wasn't a format UniGame can read.",
    "parse-failure": "That page's content couldn't be understood.",
    "stale-academic-year": "That page appears to be for a different academic year.",
    "ambiguous-results": "More than one official page matched — please confirm which one.",
    "service-misconfigured": "Automatic search isn't available right now.",
    "rate-limited": "Too many searches in a short time — please try again shortly.",
  };
  return detail ? `${base[category]} (${detail})` : base[category];
}
