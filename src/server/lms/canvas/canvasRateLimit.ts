/**
 * Canvas rate-limit awareness (Phase 18E, Part 6). Canvas returns a 403 with
 * `X-Rate-Limit-Remaining` approaching zero, or a 429 with a `Retry-After`
 * header, when a client is making too many requests. This module decides
 * whether/how long to wait — bounded, never an aggressive retry loop.
 */

export const MAX_RETRIES = 2;
const MAX_BACKOFF_MS = 5_000;

/** Parses Retry-After as either delta-seconds (Canvas's actual format) or an HTTP-date — bounded to a sane maximum so a hostile/misconfigured header can't make this app sleep for hours. */
export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_BACKOFF_MS);
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const deltaMs = asDate - Date.now();
    if (deltaMs > 0) return Math.min(deltaMs, MAX_BACKOFF_MS);
  }
  return null;
}

/** Bounded exponential backoff for a 5xx/network retry — never used for 4xx (client errors are never retried blindly). */
export function boundedBackoffMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
