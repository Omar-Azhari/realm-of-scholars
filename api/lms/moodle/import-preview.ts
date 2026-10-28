/**
 * POST /api/lms/moodle/import-preview (Phase 18F, Part 9/21). The ONLY
 * place the browser learns anything about Moodle course content — the
 * connection token itself never leaves this handler. Ownership is verified
 * before any Moodle call is made. Unlike Canvas's equivalent route, the
 * request body carries each selected course's already-fetched
 * shortName/fullName/viewUrl (from `/courses`, this same connection's own
 * result) rather than bare ids — Moodle has no single reliable "get one
 * course by id" function, so the orchestrator needs the already-discovered
 * record directly (see moodleImportOrchestrator.ts's own header for why).
 */

import { moodleConnectionStore } from "../../../src/server/lms/moodle/moodleConnectionStore";
import { findMoodleInstitution } from "../../../src/import/moodleInstitutionRegistry";
import { importMoodleCourses } from "../../../src/server/lms/moodle/moodleImportOrchestrator";
import { toClientMessage, type MoodleErrorCategory } from "../../../src/server/lms/moodle/moodleErrors";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

const MAX_COURSES_PER_REQUEST = 12;

function jsonError(status: number, category: MoodleErrorCategory): Response {
  return new Response(JSON.stringify({ error: { category, message: toClientMessage(category) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface CourseInput {
  courseId?: unknown;
  shortName?: unknown;
  fullName?: unknown;
  viewUrl?: unknown;
}

interface ImportPreviewRequestBody {
  ownerId?: unknown;
  institutionId?: unknown;
  courses?: unknown;
  includeAnnouncements?: unknown;
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function optionalBoundedString(value: unknown, maxLength: number): string | null {
  if (value === null) return null;
  return boundedString(value, maxLength);
}

function parseCourseInput(raw: unknown): { id: number; shortName: string | null; fullName: string | null; viewUrl: string | null } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as CourseInput;
  if (typeof c.courseId !== "number" || !Number.isInteger(c.courseId) || c.courseId <= 0) return null;
  const knownFields = new Set(["courseId", "shortName", "fullName", "viewUrl"]);
  if (Object.keys(c).some((k) => !knownFields.has(k))) return null;
  return {
    id: c.courseId,
    shortName: optionalBoundedString(c.shortName, 50),
    fullName: optionalBoundedString(c.fullName, 300),
    viewUrl: optionalBoundedString(c.viewUrl, 500),
  };
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
  const knownFields = new Set(["ownerId", "institutionId", "courses", "includeAnnouncements"]);
  const unknownFields = Object.keys(body).filter((k) => !knownFields.has(k));
  if (unknownFields.length > 0) return jsonError(400, "invalid-request");

  const ownerId = boundedString(body.ownerId, 100);
  const institutionId = boundedString(body.institutionId, 50);
  if (!ownerId || !institutionId) return jsonError(400, "invalid-request");
  if (!Array.isArray(body.courses) || body.courses.length === 0 || body.courses.length > MAX_COURSES_PER_REQUEST) {
    return jsonError(400, "invalid-request");
  }
  const courses = body.courses.map(parseCourseInput);
  if (courses.some((c) => c === null)) return jsonError(400, "invalid-request");
  const validCourses = courses as NonNullable<(typeof courses)[number]>[];
  const includeAnnouncements = body.includeAnnouncements === true;

  const institution = findMoodleInstitution(institutionId);
  if (!institution) return jsonError(400, "not-configured");

  const connection = await moodleConnectionStore.getConnectionForOwnerAndInstitution(ownerId, institutionId);
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");
  if (connection.reauthorisationRequiredAt) return jsonError(409, "reauthorisation-required");

  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  try {
    const outcome = await importMoodleCourses(institution, connection.connectionId, validCourses, { includeAnnouncements, signal: controller.signal }, `moodle-${connection.connectionId}`);

    const anySucceeded = outcome.courseResults.some((r) => r.status === "found" || r.status === "partial");
    if (anySucceeded) {
      await moodleConnectionStore.saveConnection({ ...connection, lastSuccessfulSyncAt: Date.now(), updatedAt: Date.now() });
    }

    return new Response(JSON.stringify(outcome), { status: 200, headers: { "content-type": "application/json" } });
  } catch {
    return jsonError(502, "moodle-unavailable");
  }
}
