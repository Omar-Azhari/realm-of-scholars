/**
 * POST /api/lms/canvas/import-preview (Phase 18E, Part 8/21). The ONLY
 * place the browser learns anything about Canvas course content — the
 * access token itself never leaves this handler. Ownership is verified
 * before any Canvas call is made; course ids are trusted only insofar as
 * they belong to courses this SAME connection is allowed to see (Canvas
 * itself enforces that on every request — this app never widens it).
 */

import { canvasConnectionStore } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { findCanvasInstitution } from "../../../src/import/canvasInstitutionRegistry";
import { importCanvasCourses } from "../../../src/server/lms/canvas/canvasImportOrchestrator";
import { toClientMessage, type CanvasErrorCategory } from "../../../src/server/lms/canvas/canvasErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

const MAX_COURSES_PER_REQUEST = 12;

function jsonError(status: number, category: CanvasErrorCategory): Response {
  return new Response(JSON.stringify({ error: { category, message: toClientMessage(category) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface ImportPreviewRequestBody {
  ownerId?: unknown;
  institutionId?: unknown;
  courseIds?: unknown;
  includeAnnouncements?: unknown;
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

  let body: ImportPreviewRequestBody;
  try {
    body = (await request.json()) as ImportPreviewRequestBody;
  } catch {
    return jsonError(400, "invalid-request");
  }
  const knownFields = new Set(["ownerId", "institutionId", "courseIds", "includeAnnouncements"]);
  const unknownFields = Object.keys(body).filter((k) => !knownFields.has(k));
  if (unknownFields.length > 0) return jsonError(400, "invalid-request");

  const ownerId = boundedString(body.ownerId, 100);
  const institutionId = boundedString(body.institutionId, 50);
  if (!ownerId || !institutionId) return jsonError(400, "invalid-request");
  if (!Array.isArray(body.courseIds) || body.courseIds.length === 0 || body.courseIds.length > MAX_COURSES_PER_REQUEST) {
    return jsonError(400, "invalid-request");
  }
  const courseIds = body.courseIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  if (courseIds.length !== body.courseIds.length) return jsonError(400, "invalid-request");
  const includeAnnouncements = body.includeAnnouncements === true;

  const institution = findCanvasInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");

  const connection = await canvasConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");
  if (connection.reauthorisationRequiredAt) return jsonError(409, "reauthorisation-required");

  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  try {
    const outcome = await importCanvasCourses(institution, connection.connectionId, courseIds, { includeAnnouncements, signal: controller.signal }, `canvas-${connection.connectionId}`);

    const anySucceeded = outcome.courseResults.some((r) => r.status === "found" || r.status === "partial");
    if (anySucceeded) {
      await canvasConnectionStore.saveConnection({ ...connection, lastSuccessfulSyncAt: Date.now(), updatedAt: Date.now() });
    }

    return new Response(JSON.stringify(outcome), { status: 200, headers: { "content-type": "application/json" } });
  } catch {
    return jsonError(502, "canvas-unavailable");
  }
}
