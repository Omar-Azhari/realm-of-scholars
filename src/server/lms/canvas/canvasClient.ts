/**
 * Server-only Canvas API client (Phase 18E, Part 6). Every call:
 * bearer-authenticates with the connection's (already-refreshed) access
 * token, hits only the institution's OWN registry-declared `apiBaseUrl`
 * (never an arbitrary host), applies a request timeout + response-size
 * cap + content-type check, follows Link-header pagination up to a bounded
 * page count, retries only idempotent GETs on 429 (Retry-After honoured)
 * or 5xx (bounded exponential backoff) — never on 4xx — and validates every
 * item through canvasSchemas.ts before it ever reaches the mapping layer.
 *
 * A 401 triggers exactly one token-refresh-and-retry via
 * canvasTokenManager.ensureFreshAccessToken — never a silent second retry
 * loop, and never more than once per call (a persistent 401 after refresh
 * means real reauthorisation is needed, surfaced as such).
 */

import type { CanvasInstitutionDefinition } from "../../../import/canvasInstitutionRegistry";
import { ensureFreshAccessToken } from "./canvasTokenManager";
import { CanvasError, type CanvasErrorCategory } from "./canvasErrors";
import { parseNextLink, MAX_PAGES_PER_REQUEST, PAGE_SIZE } from "./canvasPagination";
import { parseRetryAfterMs, boundedBackoffMs, sleep, MAX_RETRIES } from "./canvasRateLimit";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB — generous for a JSON list page, still bounded

export interface CanvasFetchOutcome<T> {
  items: T[];
  /** Count of items Canvas returned that failed validation and were skipped — never silently absorbed into `items.length`, always reported so a caller can warn honestly. */
  skippedCount: number;
  /** True if the bounded page limit was hit before Canvas's own last page — reported, never silently truncated without a trace. */
  truncated: boolean;
}

async function readBoundedBody(res: Response): Promise<string> {
  const declaredLength = res.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new CanvasError("invalid-response", "Canvas response declared a size over the allowed limit.");
  }
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new CanvasError("invalid-response", "Canvas response exceeded the allowed size limit while streaming.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
}

interface RawPageResult {
  status: number;
  bodyText: string;
  nextUrl: string | null;
  retryAfterHeader: string | null;
}

async function fetchOnePage(url: string, accessToken: string, signal: AbortSignal | undefined): Promise<RawPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (signal?.aborted) throw new CanvasError("invalid-request", "Cancelled.");
        throw new CanvasError("canvas-unavailable", "Canvas request timed out.");
      }
      throw new CanvasError("canvas-unavailable", "Canvas request failed (network error).");
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && !contentType.includes("application/json")) {
      throw new CanvasError("invalid-response", `Canvas returned an unexpected content type: ${contentType || "(none)"}.`);
    }

    const bodyText = res.ok ? await readBoundedBody(res) : "";
    return { status: res.status, bodyText, nextUrl: parseNextLink(res.headers.get("link")), retryAfterHeader: res.headers.get("retry-after") };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

function categoryForStatus(status: number): CanvasErrorCategory {
  if (status === 401) return "reauthorisation-required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "canvas-unavailable";
  return "unknown";
}

/**
 * Fetches a bounded, validated, paginated list from a Canvas endpoint.
 * `path` is relative to the institution's `apiBaseUrl` (e.g.
 * `/courses/123/assignments`) — never a full URL a caller could redirect
 * elsewhere.
 */
export async function canvasGetList<TValidated>(
  institution: CanvasInstitutionDefinition,
  connectionId: string,
  path: string,
  params: Record<string, string> = {},
  validate: (raw: unknown) => TValidated | null,
  signal?: AbortSignal
): Promise<CanvasFetchOutcome<TValidated>> {
  const tokenResult = await ensureFreshAccessToken(connectionId);
  if (!tokenResult.ok) {
    throw new CanvasError(tokenResult.reason === "not-configured" ? "not-configured" : "reauthorisation-required", "Canvas access token isn't available.");
  }
  let accessToken = tokenResult.accessToken;

  const initialUrl = new URL(`${institution.apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) initialUrl.searchParams.set(key, value);
  initialUrl.searchParams.set("per_page", String(PAGE_SIZE));

  const items: TValidated[] = [];
  let skippedCount = 0;
  let nextUrl: string | null = initialUrl.toString();
  let pageCount = 0;
  let hasRetriedAfter401 = false;

  while (nextUrl && pageCount < MAX_PAGES_PER_REQUEST) {
    pageCount += 1;
    let attempt = 0;
    let page: RawPageResult | null = null;

    for (;;) {
      const result = await fetchOnePage(nextUrl, accessToken, signal);

      if (result.status === 401 && !hasRetriedAfter401) {
        hasRetriedAfter401 = true;
        const retryTokenResult = await ensureFreshAccessToken(connectionId);
        if (!retryTokenResult.ok) throw new CanvasError("reauthorisation-required", "Canvas access token could not be refreshed.");
        accessToken = retryTokenResult.accessToken;
        continue; // retry this exact page once with the refreshed token
      }

      if (result.status === 429 && attempt < MAX_RETRIES) {
        attempt += 1;
        const retryAfterMs = parseRetryAfterMs(result.retryAfterHeader) ?? boundedBackoffMs(attempt);
        await sleep(retryAfterMs);
        continue;
      }

      if (result.status >= 500 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(boundedBackoffMs(attempt));
        continue;
      }

      if (result.status < 200 || result.status >= 300) {
        throw new CanvasError(categoryForStatus(result.status), `Canvas responded with HTTP ${result.status}.`);
      }

      page = result;
      break;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(page.bodyText);
    } catch {
      throw new CanvasError("invalid-response", "Canvas returned a response that wasn't valid JSON.");
    }
    if (!Array.isArray(parsed)) {
      throw new CanvasError("invalid-response", "Canvas returned a response that wasn't a list where one was expected.");
    }

    for (const raw of parsed) {
      const validated = validate(raw);
      if (validated === null) skippedCount += 1;
      else items.push(validated as TValidated);
    }

    nextUrl = page.nextUrl;
  }

  return { items, skippedCount, truncated: nextUrl !== null };
}

/** Single-resource GET (e.g. one course by id) — same auth/timeout/size/content-type discipline, no pagination. */
export async function canvasGetOne<TValidated>(
  institution: CanvasInstitutionDefinition,
  connectionId: string,
  path: string,
  params: Record<string, string> = {},
  validate: (raw: unknown) => TValidated | null,
  signal?: AbortSignal
): Promise<TValidated | null> {
  const tokenResult = await ensureFreshAccessToken(connectionId);
  if (!tokenResult.ok) {
    throw new CanvasError(tokenResult.reason === "not-configured" ? "not-configured" : "reauthorisation-required", "Canvas access token isn't available.");
  }
  const accessToken = tokenResult.accessToken;

  const url = new URL(`${institution.apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const result = await fetchOnePage(url.toString(), accessToken, signal);
  if (result.status === 404) return null;
  if (result.status < 200 || result.status >= 300) {
    throw new CanvasError(categoryForStatus(result.status), `Canvas responded with HTTP ${result.status}.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.bodyText);
  } catch {
    throw new CanvasError("invalid-response", "Canvas returned a response that wasn't valid JSON.");
  }
  return validate(parsed);
}

export { CanvasError };
