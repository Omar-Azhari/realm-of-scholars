/**
 * GET /api/lms/moodle/courses (Phase 18F, Part 8/21). Lists and classifies
 * every course the connected Moodle user is enrolled in — never silently
 * finalises a selection; the frontend always shows this list for explicit
 * review (Part 8).
 */

import { moodleConnectionStore } from "../../../src/server/lms/moodle/moodleConnectionStore";
import { findMoodleInstitution } from "../../../src/import/moodleInstitutionRegistry";
import { moodleGetList } from "../../../src/server/lms/moodle/moodleClient";
import { validateMoodleCourse } from "../../../src/server/lms/moodle/moodleSchemas";
import { discoverMoodleCourses } from "../../../src/server/lms/moodle/moodleCourseDiscovery";
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
  if (!connection) return jsonError(404, "connection-not-found");
  if (connection.ownerId !== ownerId) return jsonError(403, "ownership-mismatch");
  if (connection.reauthorisationRequiredAt) return jsonError(409, "reauthorisation-required");

  try {
    const result = await moodleGetList(institution, connection.connectionId, "core_enrol_get_users_courses", { userid: connection.moodleUserId ?? "0" }, validateMoodleCourse);
    const discovery = discoverMoodleCourses(result.items);

    return new Response(
      JSON.stringify({
        courses: discovery.map((d) => ({
          courseId: d.course.id,
          shortName: d.course.shortName,
          fullName: d.course.fullName,
          classification: d.classification,
          suggestedSelected: d.suggestedSelected,
          suggestionReason: d.suggestionReason,
          viewUrl: d.course.viewUrl,
        })),
        skippedCount: result.skippedCount,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch {
    return jsonError(502, "moodle-unavailable");
  }
}
