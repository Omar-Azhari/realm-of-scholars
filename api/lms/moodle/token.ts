/**
 * POST /api/lms/moodle/token (Phase 18F, Part 4/5/21). There is no OAuth
 * authorization-redirect flow to mediate for Moodle (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §3/§5/§14 — "Do not create
 * fake callback routes where no OAuth flow exists") — this single route IS
 * the entire connection flow: validate the submitted token against
 * `core_webservice_get_site_info` (Part 7), confirm it grants the function
 * permissions this app actually needs, encrypt it immediately, and save the
 * connection. The raw token is NEVER returned to the browser, NEVER logged,
 * and never appears anywhere but this request's own body and the encrypted
 * value written to storage.
 *
 * This is NOT a student-facing "paste your Moodle token" UI field — per
 * the architecture doc's research, an ordinary student cannot self-service
 * a Moodle web-service token on a stock install (§3). This endpoint exists
 * for whichever operator process configures a real, admin-issued token for
 * a deployment (see the deployment doc's onboarding checklist) — the
 * frontend never renders a form that calls this route for an ordinary user.
 */

import { moodleConnectionStore } from "../../../src/server/lms/moodle/moodleConnectionStore";
import { validateMoodleSiteAndUser } from "../../../src/server/lms/moodle/moodleClient";
import { encryptMoodleToken } from "../../../src/server/lms/moodle/moodleTokenCrypto";
import { findMoodleInstitution } from "../../../src/import/moodleInstitutionRegistry";
import { MoodleError, toClientMessage, type MoodleErrorCategory } from "../../../src/server/lms/moodle/moodleErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

const REQUIRED_FUNCTIONS = ["core_enrol_get_users_courses", "core_course_get_contents"];

function jsonError(status: number, category: MoodleErrorCategory): Response {
  return new Response(JSON.stringify({ error: { category, message: toClientMessage(category) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface TokenRequestBody {
  ownerId?: unknown;
  institutionId?: unknown;
  token?: unknown;
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

let connectionIdCounter = 0;
function nextConnectionId(): string {
  connectionIdCounter += 1;
  return `moodle-conn-${Date.now()}-${connectionIdCounter}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!globalRateLimiter.tryConsume("global")) return jsonError(429, "rate-limited");
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown-client";
  if (!perClientRateLimiter.tryConsume(clientKey)) return jsonError(429, "rate-limited");

  let body: TokenRequestBody;
  try {
    body = (await request.json()) as TokenRequestBody;
  } catch {
    return jsonError(400, "invalid-request");
  }
  const unknownFields = Object.keys(body).filter((k) => k !== "ownerId" && k !== "institutionId" && k !== "token");
  if (unknownFields.length > 0) return jsonError(400, "invalid-request");

  const ownerId = boundedString(body.ownerId, 100);
  const institutionId = boundedString(body.institutionId, 50);
  const token = boundedString(body.token, 500);
  if (!ownerId || !institutionId || !token) return jsonError(400, "invalid-request");

  const institution = findMoodleInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");

  let siteInfo;
  try {
    siteInfo = await validateMoodleSiteAndUser(institution, token);
  } catch (error) {
    return jsonError(error instanceof MoodleError ? 400 : 502, error instanceof MoodleError ? error.category : "moodle-unavailable");
  }

  const missingFunctions = REQUIRED_FUNCTIONS.filter((fn) => !siteInfo.enabledFunctions.includes(fn));
  if (missingFunctions.length > 0) return jsonError(403, "insufficient-permission");

  const connectionId = nextConnectionId();
  const now = Date.now();
  await moodleConnectionStore.saveConnection({
    connectionId,
    ownerId,
    institutionId,
    moodleBaseUrl: institution.moodleBaseUrl,
    encryptedCredential: encryptMoodleToken(token),
    credentialType: "institution-token",
    credentialExpiresAt: null, // Moodle doesn't report a token expiry through site-info — treated as not expiring until reauthorisation is explicitly required
    enabledFunctions: siteInfo.enabledFunctions,
    moodleUserId: siteInfo.userId !== null ? String(siteInfo.userId) : null,
    moodleSiteName: siteInfo.siteName,
    createdAt: now,
    updatedAt: now,
    lastSuccessfulSyncAt: null,
    reauthorisationRequiredAt: null,
    revokedAt: null,
  });

  return new Response(JSON.stringify({ connected: true, moodleSiteName: siteInfo.siteName, enabledFunctions: siteInfo.enabledFunctions }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
