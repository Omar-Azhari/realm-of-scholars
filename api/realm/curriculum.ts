/**
 * POST /api/realm/curriculum — researches (or structures an uploaded
 * outline for) ONE subject and returns curriculum JSON for Realm of
 * Scholars. Thin HTTP shell over src/server/realm/curriculumResearch.ts.
 *
 * GET reports whether AI research is configured, so the enrolment screen
 * can offer the right options before the student starts.
 */

import {
  CurriculumError,
  isAiConfigured,
  researchCurriculum,
  validateCurriculumRequest,
  type CurriculumResult,
} from "../../src/server/realm/curriculumResearch";
import { BoundedCache } from "../../src/server/cache";
import { RateLimiter } from "../../src/server/rateLimiter";

export const config = { runtime: "nodejs", maxDuration: 300 };

const cache = new BoundedCache<CurriculumResult>(200);
const perClient = new RateLimiter(12, 60 * 60_000); // 12 subjects/hour per IP
const global = new RateLimiter(120, 60 * 60_000);
const CACHE_TTL_MS = 12 * 60 * 60_000;

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

export async function GET(): Promise<Response> {
  return json(200, { status: "ok", aiConfigured: isAiConfigured() });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid-request", message: "Body was not valid JSON." });
  }

  try {
    const req = validateCurriculumRequest(body);
    const key = req.documentText
      ? null
      : [req.university, req.subjectCode, req.subjectName, req.teachingPeriod, req.year].join("|").toLowerCase();
    if (key) {
      const hit = cache.get(key);
      if (hit) return json(200, { ...hit.value, cached: true });
    }

    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!global.tryConsume("global") || !perClient.tryConsume(clientKey)) {
      throw new CurriculumError("rate-limited", "Too many research requests. Try again later.");
    }

    const result = await researchCurriculum(req);
    if (key) cache.set(key, result, CACHE_TTL_MS);
    return json(200, { ...result, cached: false });
  } catch (error) {
    if (error instanceof CurriculumError) {
      return json(STATUS[error.category], { error: error.category, message: error.message });
    }
    return json(500, { error: "upstream", message: "Unexpected server error." });
  }
}
