/**
 * POST /api/lms/moodle/disconnect (Phase 18F, Part 20/21). Moodle's
 * standard web-service token has no documented, universally-available
 * revocation call the way Canvas's `DELETE /login/oauth2/token` is — so
 * "disconnect" here means deleting the encrypted local credential
 * unconditionally (there is nothing this app can remotely revoke on a
 * stock Moodle install; an operator who wants the token fully invalidated
 * deletes it from Moodle's own Manage Tokens admin screen). This is
 * reported honestly to the caller, never presented as if a remote
 * revocation happened when it didn't. Never touches imported academic
 * data — that lives entirely in `UniGameSaveData` on the user's own
 * device, which this server-side endpoint has no access to and never
 * needs.
 */

import { moodleConnectionStore } from "../../../src/server/lms/moodle/moodleConnectionStore";
import { toClientMessage, type MoodleErrorCategory } from "../../../src/server/lms/moodle/moodleErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

function jsonError(status: number, category: MoodleErrorCategory): Response {
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

  const connection = await moodleConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");

  await moodleConnectionStore.revokeConnection(connection.connectionId);
  await moodleConnectionStore.deleteConnection(connection.connectionId);

  return new Response(JSON.stringify({ disconnected: true, remoteRevocationSucceeded: false, remoteRevocationError: "Moodle has no supported remote-revocation call for an institution-issued token — delete it from Moodle's own Manage Tokens admin screen to fully invalidate it." }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
