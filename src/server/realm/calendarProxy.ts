/**
 * Fetches a La Trobe Moodle calendar export (.ics) on the student's behalf.
 * Browsers can't read it directly (no CORS), so the server does — but only
 * from La Trobe's Moodle calendar-export address, never an arbitrary URL.
 * The export link contains the student's private calendar token: it is
 * used for this one request and never logged or stored.
 */

export class CalendarProxyError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_BYTES = 3_000_000;

/** Throws CalendarProxyError unless the URL is a La Trobe Moodle calendar export. */
export function validateCalendarUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.length > 2000) throw new CalendarProxyError(400, "Paste the calendar export link from Moodle.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CalendarProxyError(400, "That isn't a web address.");
  }
  const host = url.hostname.toLowerCase();
  const laTrobe = host === "latrobe.edu.au" || host.endsWith(".latrobe.edu.au");
  if (url.protocol !== "https:" || !laTrobe || url.port || url.username || url.password) {
    throw new CalendarProxyError(400, "Only La Trobe Moodle calendar links can be fetched. For other universities, download the .ics file and upload it.");
  }
  if (!url.pathname.endsWith("/calendar/export_execute.php")) {
    throw new CalendarProxyError(400, "That link isn't a Moodle calendar export. In Moodle: Calendar → Import or export calendars → Export calendar → Get calendar URL.");
  }
  return url;
}

export async function fetchCalendar(raw: unknown): Promise<string> {
  const url = validateCalendarUrl(raw);
  let response: Response;
  try {
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { accept: "text/calendar" } });
  } catch {
    throw new CalendarProxyError(502, "Moodle didn't respond. Try again, or download the .ics file and upload it.");
  }
  if (response.status >= 300 && response.status < 400) {
    throw new CalendarProxyError(502, "Moodle wanted you to sign in. Download the .ics file instead and upload it.");
  }
  if (!response.ok) throw new CalendarProxyError(502, `Moodle returned an error (${response.status}).`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new CalendarProxyError(413, "That calendar is too large.");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new CalendarProxyError(413, "That calendar is too large.");
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new CalendarProxyError(502, "Moodle didn't send a calendar. Check the link, or download the .ics file instead.");
  return text;
}
