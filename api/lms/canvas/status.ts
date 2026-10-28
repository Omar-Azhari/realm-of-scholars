/**
 * GET /api/lms/canvas/status (Phase 18E, Part 3/21). Returns only
 * non-secret connection state — never a token, never an encrypted blob.
 */

import { canvasConnectionStore } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { findCanvasInstitution, isCanvasInstitutionConfigured } from "../../../src/import/canvasInstitutionRegistry";
import { toClientMessage, type CanvasErrorCategory } from "../../../src/server/lms/canvas/canvasErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

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
  const ownerId = boundedParam(url.searchParams.get("ownerId"), 100);
  if (!institutionId || !ownerId) return jsonError(400, "invalid-request");

  const institution = findCanvasInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");

  const connection = await canvasConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);

  const body = {
    institutionId,
    institutionConfigured: isCanvasInstitutionConfigured(institutionId),
    connected: !!connection && !connection.reauthorisationRequiredAt,
    reauthorisationRequired: !!connection?.reauthorisationRequiredAt,
    canvasUserId: connection?.canvasUserId ?? null,
    lastSuccessfulSyncAt: connection?.lastSuccessfulSyncAt ?? null,
    scopes: connection?.scopes ?? [],
    connectedAt: connection?.createdAt ?? null,
  };

  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
