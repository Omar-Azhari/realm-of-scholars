/**
 * GET /api/lms/canvas/connect (Phase 18E, Part 3/21). The browser navigates
 * here directly (a real page navigation, not a fetch) so the 302 response
 * below can carry the user on to Canvas's own login/consent screen. Never
 * called with a client secret or a Canvas token — this endpoint only ever
 * SENDS the browser onward; it never receives Canvas credentials itself.
 */

import { findCanvasInstitution, isCanvasInstitutionConfigured } from "../../../src/import/canvasInstitutionRegistry";
import { canvasConnectionStore, PENDING_CONNECTION_TTL_MS } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { generateState, signState, generatePkceVerifier, derivePkceChallenge, isOAuthStateSigningConfigured } from "../../../src/server/lms/canvas/canvasOAuthState";
import { toClientMessage, type CanvasErrorCategory } from "../../../src/server/lms/canvas/canvasErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";
import { CANVAS_READONLY_SCOPES, CANVAS_GRADES_SCOPES } from "../../../src/server/lms/canvas/canvasScopes";

export const config = { runtime: "nodejs" };

/** Only the app's own root is ever a valid post-OAuth landing spot — Semester Setup is an in-app overlay, not a distinct route, so there is nothing else to allowlist. Rejecting everything else closes the open-redirect vector outright rather than trying to pattern-match "safe" paths. */
const ALLOWED_RETURN_PATHS = new Set(["/"]);

function jsonError(status: number, category: CanvasErrorCategory): Response {
  return new Response(JSON.stringify({ error: { category, message: toClientMessage(category) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function boundedParam(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

export async function GET(request: Request): Promise<Response> {
  if (!globalRateLimiter.tryConsume("global")) return jsonError(429, "rate-limited");
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown-client";
  if (!perClientRateLimiter.tryConsume(clientKey)) return jsonError(429, "rate-limited");

  const url = new URL(request.url);
  const institutionId = boundedParam(url.searchParams.get("institutionId"), 50);
  const returnPathRaw = boundedParam(url.searchParams.get("returnPath"), 100) ?? "/";
  const ownerId = boundedParam(url.searchParams.get("ownerId"), 100);
  // Part 12: grades/submissions scope is requested ONLY when the user has
  // just explicitly opted in via a dedicated consent screen immediately
  // before this navigation — never bundled by default. The granted scope
  // list Canvas returns (stored on the connection record) is itself the
  // durable, checkable record of that consent; there is no separate
  // "consent flag" to keep in sync or fall out of date.
  const includeGrades = url.searchParams.get("includeGrades") === "true";

  if (!institutionId || !ownerId) return jsonError(400, "invalid-request");
  if (!ALLOWED_RETURN_PATHS.has(returnPathRaw)) return jsonError(400, "invalid-return-path");

  const institution = findCanvasInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");
  if (!isCanvasInstitutionConfigured(institutionId) || !isOAuthStateSigningConfigured()) {
    return jsonError(503, "not-configured");
  }

  const clientId = process.env[institution.clientIdEnvVar];
  const redirectUri = process.env[institution.redirectUriEnvVar];
  if (!clientId || !redirectUri) return jsonError(503, "not-configured");

  const rawState = generateState();
  const pkceVerifier = generatePkceVerifier();
  const pkceChallenge = derivePkceChallenge(pkceVerifier);
  const now = Date.now();

  await canvasConnectionStore.createPendingConnection({
    state: rawState,
    institutionId,
    returnPath: returnPathRaw,
    pkceVerifier,
    ownerId,
    createdAt: now,
    expiresAt: now + PENDING_CONNECTION_TTL_MS,
  });

  const authorizeUrl = new URL(institution.authorizeEndpoint);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", signState(rawState));
  authorizeUrl.searchParams.set("code_challenge", pkceChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  const scopes = includeGrades ? [...CANVAS_READONLY_SCOPES, ...CANVAS_GRADES_SCOPES] : CANVAS_READONLY_SCOPES;
  authorizeUrl.searchParams.set("scope", scopes.join(" "));

  return new Response(null, { status: 302, headers: { location: authorizeUrl.toString() } });
}
