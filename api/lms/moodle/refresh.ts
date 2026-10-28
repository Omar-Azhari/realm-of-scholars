/**
 * POST /api/lms/moodle/refresh (Phase 18F, Part 20/21). Unlike Canvas's
 * `refresh.ts` (which refreshes an OAuth access token), a Moodle
 * institution-issued token has no refresh mechanism (§5/§17 of the
 * architecture doc) — this route instead RE-VALIDATES the existing
 * connection by calling `core_webservice_get_site_info` again, confirming
 * the token still works and updating the recorded enabled-functions list
 * (an admin may have changed the external service's permitted functions
 * since the connection was first made). It does not re-fetch course
 * content — that happens through `/import-preview`, exactly the same
 * route used for the very first import (see that route's own header for
 * why a separate sync-preview route wasn't needed).
 */

import { moodleConnectionStore } from "../../../src/server/lms/moodle/moodleConnectionStore";
import { validateMoodleSiteAndUser } from "../../../src/server/lms/moodle/moodleClient";
import { decryptMoodleToken } from "../../../src/server/lms/moodle/moodleTokenCrypto";
import { findMoodleInstitution } from "../../../src/import/moodleInstitutionRegistry";
import { MoodleError, toClientMessage, type MoodleErrorCategory } from "../../../src/server/lms/moodle/moodleErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

function jsonError(status: number, category: MoodleErrorCategory): Response {
  return new Response(JSON.stringify({ error: { category, message: toClientMessage(category) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface RefreshRequestBody {
  ownerId?: unknown;
  institutionId?: unknown;
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

export async function POST(request: Request): Promise<Response> {
  if (!globalRateLimiter.tryConsume("global")) return jsonError(429, "rate-limited");
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown-client";
  if (!perClientRateLimiter.tryConsume(clientKey)) return jsonError(429, "rate-limited");

  let body: RefreshRequestBody;
  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    return jsonError(400, "invalid-request");
  }
  const unknownFields = Object.keys(body).filter((k) => k !== "ownerId" && k !== "institutionId");
  if (unknownFields.length > 0) return jsonError(400, "invalid-request");

  const ownerId = boundedString(body.ownerId, 100);
  const institutionId = boundedString(body.institutionId, 50);
  if (!ownerId || !institutionId) return jsonError(400, "invalid-request");

  const institution = findMoodleInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");

  const connection = await moodleConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");

  try {
    const siteInfo = await validateMoodleSiteAndUser(institution, decryptMoodleToken(connection.encryptedCredential));
    await moodleConnectionStore.saveConnection({
      ...connection,
      enabledFunctions: siteInfo.enabledFunctions,
      moodleSiteName: siteInfo.siteName,
      reauthorisationRequiredAt: null,
      updatedAt: Date.now(),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    if (error instanceof MoodleError) {
      await moodleConnectionStore.markReauthorisationRequired(connection.connectionId);
      return jsonError(400, error.category);
    }
    return jsonError(502, "moodle-unavailable");
  }
}
