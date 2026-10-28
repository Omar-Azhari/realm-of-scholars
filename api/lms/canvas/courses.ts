/**
 * GET /api/lms/canvas/courses (Phase 18E, Part 7/21). Lists and classifies
 * every Canvas course the authorised user can see — never silently
 * finalises a selection; the frontend always shows this list for explicit
 * review (Part 7).
 */

import { canvasConnectionStore } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { findCanvasInstitution } from "../../../src/import/canvasInstitutionRegistry";
import { canvasGetList } from "../../../src/server/lms/canvas/canvasClient";
import { validateCourse, type ValidatedCourse } from "../../../src/server/lms/canvas/canvasSchemas";
import { discoverCourses } from "../../../src/server/lms/canvas/canvasCourseDiscovery";
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
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");
  if (connection.reauthorisationRequiredAt) return jsonError(409, "reauthorisation-required");

  try {
    const result = await canvasGetList<ValidatedCourse>(institution, connection.connectionId, "/courses", { include: "term", state: "active,completed" }, validateCourse);
    const discovery = discoverCourses(result.items);

    return new Response(
      JSON.stringify({
        courses: discovery.map((d) => ({
          courseId: d.course.id,
          name: d.course.name,
          courseCode: d.course.course_code,
          classification: d.classification,
          suggestedSelected: d.suggestedSelected,
          suggestionReason: d.suggestionReason,
          htmlUrl: d.course.html_url,
        })),
        skippedCount: result.skippedCount,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch {
    return jsonError(502, "canvas-unavailable");
  }
}
