/**
 * POST /api/realm/study — AI study helpers for Realm of Scholars.
 *   { mode: "week-questions", ... }  questions from one week's lecture slides
 *   { mode: "tutor", ... }           the subject tutor answers a question
 *   { mode: "explain", ... }         marks the student's own explanation of a concept
 * Thin HTTP shell over src/server/realm/studyAi.ts.
 *
 * GET reports whether AI is configured.
 */

import { CurriculumError, isAiConfigured } from "../../src/server/realm/curriculumResearch";
import { gradeExplanation, tutorReply, validateExplainRequest, validateTutorRequest, validateWeekQuestionsRequest, weekQuestions } from "../../src/server/realm/studyAi";
import { RateLimiter } from "../../src/server/rateLimiter";

export const config = { runtime: "nodejs", maxDuration: 120 };

const slidesLimiter = new RateLimiter(15, 60 * 60_000); // 15 slide decks/hour per IP
const tutorLimiter = new RateLimiter(60, 60 * 60_000); // 60 tutor questions/hour per IP
const globalLimiter = new RateLimiter(600, 60 * 60_000);

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
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid-request", message: "Body was not a JSON object." });
  }

  try {
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (body.mode === "week-questions") {
      const req = validateWeekQuestionsRequest(body);
      if (!globalLimiter.tryConsume("global") || !slidesLimiter.tryConsume(clientKey)) throw new CurriculumError("rate-limited", "Too many slide decks this hour. Try again later.");
      return json(200, await weekQuestions(req));
    }
    if (body.mode === "tutor") {
      const req = validateTutorRequest(body);
      if (!globalLimiter.tryConsume("global") || !tutorLimiter.tryConsume(clientKey)) throw new CurriculumError("rate-limited", "The tutor needs a rest. Try again in a little while.");
      return json(200, await tutorReply(req));
    }
    if (body.mode === "explain") {
      const req = validateExplainRequest(body);
      if (!globalLimiter.tryConsume("global") || !tutorLimiter.tryConsume(clientKey)) throw new CurriculumError("rate-limited", "The tutor needs a rest. Try again in a little while.");
      return json(200, await gradeExplanation(req));
    }
    return json(400, { error: "invalid-request", message: 'mode must be "week-questions", "tutor" or "explain".' });
  } catch (error) {
    if (error instanceof CurriculumError) return json(STATUS[error.category], { error: error.category, message: error.message });
    return json(500, { error: "upstream", message: "Unexpected server error." });
  }
}
