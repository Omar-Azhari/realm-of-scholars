/**
 * POST /api/realm/lecture — writes one week's lecture for the lecture hall
 * (research with web search, then a structured lecture). Thin HTTP shell over
 * src/server/realm/lectureAi.ts. Lectures take a minute or two, so this route
 * gets a longer time limit than the other study helpers.
 */

import { CurriculumError } from "../../src/server/realm/curriculumResearch";
import { validateLectureRequest, writeLecture } from "../../src/server/realm/lectureAi";
import { RateLimiter } from "../../src/server/rateLimiter";

export const config = { runtime: "nodejs", maxDuration: 300 };

const perClient = new RateLimiter(8, 60 * 60_000); // 8 lectures/hour per IP
const globalLimiter = new RateLimiter(120, 60 * 60_000);

const STATUS: Record<CurriculumError["category"], number> = {
  "ai-unavailable": 503,
  "invalid-request": 400,
  "rate-limited": 429,
  refused: 422,
  upstream: 502,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid-request", message: "Body was not a JSON object." });
  }
  try {
    const req = validateLectureRequest(body);
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!globalLimiter.tryConsume("global") || !perClient.tryConsume(clientKey)) throw new CurriculumError("rate-limited", "That's a lot of lectures for one hour. Try again later.");
    return json(200, { lecture: await writeLecture(req) });
  } catch (error) {
    if (error instanceof CurriculumError) return json(STATUS[error.category], { error: error.category, message: error.message });
    return json(500, { error: "upstream", message: "Unexpected server error." });
  }
}
