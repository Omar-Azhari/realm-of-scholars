/**
 * POST /api/realm/calendar { url } — fetches a La Trobe Moodle calendar
 * export so the realm can read its deadlines. The link is sent in the body
 * (not the query string) because it contains the student's calendar token.
 */

import { CalendarProxyError, fetchCalendar } from "../../src/server/realm/calendarProxy";
import { RateLimiter } from "../../src/server/rateLimiter";

export const config = { runtime: "nodejs", maxDuration: 30 };

const perClient = new RateLimiter(20, 60 * 60_000);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid-request", message: "Body was not valid JSON." });
  }
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!perClient.tryConsume(clientKey)) return json(429, { error: "rate-limited", message: "Too many calendar fetches. Try again later." });
  try {
    const text = await fetchCalendar(body?.url);
    return json(200, { text });
  } catch (error) {
    if (error instanceof CalendarProxyError) return json(error.status, { error: "calendar", message: error.message });
    return json(500, { error: "calendar", message: "Unexpected server error." });
  }
}
