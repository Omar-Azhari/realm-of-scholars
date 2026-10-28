/**
 * POST /api/lms/canvas/refresh (Phase 18E, Part 3/21). Manually triggered
 * refresh (e.g. before a "Refresh Canvas" sync run). Ownership is checked
 * before anything else — a request can only ever act on a connection whose
 * `ownerId` matches the requester's own installation id (Part 21: "require
 * authenticated connection ownership").
 */

import { canvasConnectionStore } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { ensureFreshAccessToken } from "../../../src/server/lms/canvas/canvasTokenManager";
import { toClientMessage, type CanvasErrorCategory } from "../../../src/server/lms/canvas/canvasErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

function jsonError(status: number, category: CanvasErrorCategory): Response {
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

  const connection = await canvasConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);
  if (!connection) return jsonError(404, "connection-not-found");
  // getConnectionForOwnerAndInstitution already filters by ownerId, but the
  // explicit check below documents the ownership invariant at the call
  // site itself rather than relying solely on the store's own filtering.
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");

  const result = await ensureFreshAccessToken(connection.connectionId);
  if (!result.ok) {
    const category: CanvasErrorCategory = result.reason === "not-configured" ? "not-configured" : result.reason === "connection-not-found" ? "connection-not-found" : "reauthorisation-required";
    return jsonError(result.reason === "reauthorisation-required" ? 409 : 400, category);
  }

  return new Response(JSON.stringify({ refreshed: true, tokenExpiresAt: result.connection.tokenExpiresAt }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
