/**
 * POST /api/realm/assessment-feedback: rubric feedback on a student's own
 * draft, for the Unity game's Studio and Ledger.
 *   body: { subject, title, brief, rubric: [{ name, weight, levels }], draft }
 *   200 { ok: true, feedback: { criteria, rangeLow, rangeHigh, topFixes }, note }
 *   200 { ok: false, reason: "no-key" } when the server has no ANTHROPIC_API_KEY
 *   4xx/5xx { ok: false, reason, message } otherwise
 * Thin HTTP shell over src/server/realm/assessmentFeedback.ts. The key stays on
 * the server; the client never sees it.
 *
 * GET reports whether AI is configured.
 */

import { CurriculumError, isAiConfigured } from "../../src/server/realm/curriculumResearch";
import { assessmentFeedback, validateFeedbackRequest } from "../../src/server/realm/assessmentFeedback";
import { RateLimiter } from "../../src/server/rateLimiter";

export const config = { runtime: "nodejs", maxDuration: 120 };

const perClient = new RateLimiter(20, 60 * 60_000); // 20 drafts/hour per IP
const globalLimiter = new RateLimiter(300, 60 * 60_000);

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
  if (!isAiConfigured()) return json(200, { ok: false, reason: "no-key" });
  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, reason: "invalid-request", message: "Body was not a JSON object." });
  }
  try {
    const req = validateFeedbackRequest(body);
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!globalLimiter.tryConsume("global") || !perClient.tryConsume(clientKey)) throw new CurriculumError("rate-limited", "That's a lot of feedback for one hour. Try again later.");
    return json(200, await assessmentFeedback(req));
  } catch (error) {
    if (error instanceof CurriculumError) return json(STATUS[error.category], { ok: false, reason: error.category, message: error.message });
    return json(500, { ok: false, reason: "upstream", message: "Unexpected server error." });
  }
}
