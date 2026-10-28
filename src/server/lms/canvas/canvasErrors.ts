/**
 * Structured Canvas error categories (Phase 18E, Part 6/20) — shared by the
 * OAuth endpoints and the Canvas API client so every failure mode has one
 * name, never a raw exception message leaking Canvas/internal detail to the
 * browser.
 */

export type CanvasErrorCategory =
  | "not-configured"
  | "invalid-request"
  | "invalid-return-path"
  | "invalid-state"
  | "state-expired"
  | "state-replayed"
  | "institution-mismatch"
  | "authorization-denied"
  | "token-exchange-failed"
  | "connection-not-found"
  | "ownership-mismatch"
  | "reauthorisation-required"
  | "rate-limited"
  | "canvas-unavailable"
  | "forbidden"
  | "not-found"
  | "invalid-response"
  | "unknown";

export class CanvasError extends Error {
  readonly category: CanvasErrorCategory;
  constructor(category: CanvasErrorCategory, message: string) {
    super(message);
    this.name = "CanvasError";
    this.category = category;
  }
}

/** Every message here is safe to show a user or put in a client-facing JSON error — never includes a raw Canvas response, a token, or an internal stack trace. */
export function toClientMessage(category: CanvasErrorCategory): string {
  switch (category) {
    case "not-configured":
      return "Canvas integration isn't set up for this institution yet.";
    case "invalid-request":
      return "That request was malformed.";
    case "invalid-return-path":
      return "That return destination isn't recognised.";
    case "invalid-state":
      return "Your Canvas connection attempt couldn't be verified — please try connecting again.";
    case "state-expired":
      return "That Canvas connection attempt has expired — please try connecting again.";
    case "state-replayed":
      return "That Canvas connection attempt was already used — please try connecting again.";
    case "institution-mismatch":
      return "That Canvas connection attempt doesn't match the institution you started with.";
    case "authorization-denied":
      return "Canvas authorization was denied.";
    case "token-exchange-failed":
      return "Couldn't complete the Canvas connection right now.";
    case "connection-not-found":
      return "No Canvas connection was found.";
    case "ownership-mismatch":
      return "That Canvas connection doesn't belong to this installation.";
    case "reauthorisation-required":
      return "Your Canvas connection needs to be reauthorised.";
    case "rate-limited":
      return "Canvas is temporarily rate-limiting requests — try again shortly.";
    case "canvas-unavailable":
      return "Canvas is temporarily unavailable.";
    case "forbidden":
      return "Canvas denied access to that resource.";
    case "not-found":
      return "That Canvas resource wasn't found.";
    case "invalid-response":
      return "Canvas returned a response UniGame couldn't understand.";
    case "unknown":
      return "Something went wrong with the Canvas connection.";
  }
}
