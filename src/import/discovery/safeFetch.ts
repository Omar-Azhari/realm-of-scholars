/**
 * The one place `OfficialUniversityProvider` is allowed to touch the
 * network (Phase 18B, Part 7 — Safety). Enforces, in order:
 *  1. the target hostname is one of the university's declared
 *     `officialDomains` (never an arbitrary URL derived from page content —
 *     this is the structural guard against mirrors/forums/wikis/caches);
 *  2. robots.txt for that host allows the path;
 *  3. a single attempt with a caller-supplied timeout — no retry loop.
 * A redirect landing outside the official domain is treated as a failure,
 * not silently followed and trusted.
 */

const USER_AGENT_TOKEN = "unigame-import";

/** origin -> disallow rules, so one run never re-fetches the same robots.txt per page. */
const robotsCache = new Map<string, string[]>();

function parseDisallowRules(robotsTxt: string): string[] {
  const groups: Record<string, string[]> = {};
  let currentAgents: string[] = [];
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      // A new User-agent line after at least one Disallow starts a new group.
      if (currentAgents.length > 0 && groups[currentAgents[0]]?.length) currentAgents = [];
      currentAgents.push(agent);
      groups[agent] = groups[agent] ?? [];
    } else if (key === "disallow" && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        groups[agent] = groups[agent] ?? [];
        if (value) groups[agent].push(value);
      }
    }
  }
  return groups[USER_AGENT_TOKEN] ?? groups["*"] ?? [];
}

async function fetchDisallowRules(origin: string, signal: AbortSignal): Promise<string[]> {
  if (robotsCache.has(origin)) return robotsCache.get(origin) ?? [];
  let rules: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal });
    // No robots.txt, or it can't be read — standard crawler convention treats that as "nothing disallowed",
    // never as "block everything".
    if (res.ok) rules = parseDisallowRules(await res.text());
  } catch {
    rules = [];
  }
  robotsCache.set(origin, rules);
  return rules;
}

export interface RobotsCheck {
  allowed: boolean;
  reason: string | null;
}

export async function checkRobotsAllowed(url: URL, signal: AbortSignal): Promise<RobotsCheck> {
  const rules = await fetchDisallowRules(url.origin, signal);
  const blocked = rules.some((rule) => rule !== "" && url.pathname.startsWith(rule));
  return { allowed: !blocked, reason: blocked ? `robots.txt disallows ${url.pathname}` : null };
}

export interface SafeFetchResult {
  ok: boolean;
  status: number | null;
  text: string | null;
  finalUrl: string;
  error: string | null;
}

/**
 * `timeoutMs` bounds a single attempt — there is no retry here by design
 * (Part 7: "Do not retry aggressively"). Callers that want to try several
 * candidate pages for one subject issue several separate calls.
 */
export async function safeFetchOfficialPage(
  url: string,
  officialDomains: string[],
  timeoutMs = 8000
): Promise<SafeFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: null, text: null, finalUrl: url, error: "not a valid URL" };
  }

  if (!officialDomains.includes(parsed.hostname)) {
    return { ok: false, status: null, text: null, finalUrl: url, error: "not one of this university's official domains" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const robots = await checkRobotsAllowed(parsed, controller.signal);
    if (!robots.allowed) {
      return { ok: false, status: null, text: null, finalUrl: url, error: robots.reason };
    }

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": `UniGame-Import/1.0 (+student-owned semester import; ${USER_AGENT_TOKEN})` },
    });

    if (!res.ok) {
      return { ok: false, status: res.status, text: null, finalUrl: res.url, error: `HTTP ${res.status}` };
    }

    const finalHost = new URL(res.url).hostname;
    if (!officialDomains.includes(finalHost)) {
      return { ok: false, status: res.status, text: null, finalUrl: res.url, error: "redirected away from the official domain" };
    }

    const text = await res.text();
    return { ok: true, status: res.status, text, finalUrl: res.url, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, status: null, text: null, finalUrl: url, error: aborted ? "timed out" : message };
  } finally {
    clearTimeout(timeout);
  }
}
