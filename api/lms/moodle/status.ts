/**
 * GET /api/lms/moodle/status (Phase 18F, Part 21). Returns only non-secret
 * connection state — never a token, never an encrypted blob.
 */

import { moodleConnectionStore } from "../../../src/server/lms/moodle/moodleConnectionStore";
import { findMoodleInstitution, isMoodleInstitutionConfigured } from "../../../src/import/moodleInstitutionRegistry";
import { toClientMessage, type MoodleErrorCategory } from "../../../src/server/lms/moodle/moodleErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

function jsonError(status: number, category: MoodleErrorCategory): Response {
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
  const ownerId = boundedParam(url.searchParams.get("ownerId"), 100);
  if (!institutionId || !ownerId) return jsonError(400, "invalid-request");

  const institution = findMoodleInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");

  const connection = await moodleConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);

  const body = {
    institutionId,
    institutionConfigured: isMoodleInstitutionConfigured(institutionId),
    connected: !!connection && !connection.reauthorisationRequiredAt,
    reauthorisationRequired: !!connection?.reauthorisationRequiredAt,
    moodleUserId: connection?.moodleUserId ?? null,
    moodleSiteName: connection?.moodleSiteName ?? null,
    lastSuccessfulSyncAt: connection?.lastSuccessfulSyncAt ?? null,
    enabledFunctions: connection?.enabledFunctions ?? [],
    connectedAt: connection?.createdAt ?? null,
  };

  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
