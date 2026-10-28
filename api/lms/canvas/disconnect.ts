/**
 * POST /api/lms/canvas/disconnect (Phase 18E, Part 3/19/21). Revokes the
 * token at Canvas where reachable (best-effort — a revocation failure never
 * blocks local deletion, Part 19's explicit instruction), then deletes the
 * encrypted connection record regardless. Never touches imported academic
 * data — that lives entirely in `UniGameSaveData` on the user's own device,
 * which this server-side endpoint has no access to and never needs.
 */

import { canvasConnectionStore } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { revokeAccessToken, decryptAccessToken } from "../../../src/server/lms/canvas/canvasTokenManager";
import { findCanvasInstitution } from "../../../src/import/canvasInstitutionRegistry";
import { toClientMessage, type CanvasErrorCategory } from "../../../src/server/lms/canvas/canvasErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

function jsonError(status: number, category: CanvasErrorCategory): Response {
  return new Response(JSON.stringify({ error: { category, message: toClientMessage(category) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface DisconnectRequestBody {
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

  let body: DisconnectRequestBody;
  try {
    body = (await request.json()) as DisconnectRequestBody;
  } catch {
    return jsonError(400, "invalid-request");
  }
  const unknownFields = Object.keys(body).filter((k) => k !== "ownerId" && k !== "institutionId");
  if (unknownFields.length > 0) return jsonError(400, "invalid-request");

  const ownerId = boundedString(body.ownerId, 100);
  const institutionId = boundedString(body.institutionId, 50);
  if (!ownerId || !institutionId) return jsonError(400, "invalid-request");

  const connection = await canvasConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");

  const institution = findCanvasInstitution(institutionId);
  let revocation: { ok: boolean; error: string | null } = { ok: false, error: "institution not found" };
  if (institution) {
    try {
      revocation = await revokeAccessToken(institution, decryptAccessToken(connection));
    } catch {
      revocation = { ok: false, error: "revocation attempt failed" };
    }
  }

  // Local credential deletion happens unconditionally — a failed remote
  // revocation must never leave the user unable to disconnect locally.
  await canvasConnectionStore.revokeConnection(connection.connectionId);
  await canvasConnectionStore.deleteConnection(connection.connectionId);

  return new Response(JSON.stringify({ disconnected: true, remoteRevocationSucceeded: revocation.ok, remoteRevocationError: revocation.error }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
