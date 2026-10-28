/**
 * Bounded, in-memory, per-instance rate limiter (Phase 18C, Part 3/10).
 * Same per-instance scoping caveat as cache.ts — real within a warm
 * instance, not distributed across instances. Fixed-window counters, one
 * keyed per client (IP) and one global, both checked before any fetch work
 * begins for a request.
 */

interface Window {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Returns true if this call is allowed (and counts it), false if the limit is already reached for this key's current window. */
  tryConsume(key: string): boolean {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || now - existing.windowStart > this.windowMs) {
      this.windows.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (existing.count >= this.limit) return false;
    existing.count += 1;
    return true;
  }
}

// Conservative defaults: a genuine student doing Semester Setup makes one
// request with up to 10 subjects; a burst beyond this is far more likely
// to be a misbehaving client than legitimate use.
export const perClientRateLimiter = new RateLimiter(5, 60_000); // 5 requests/minute per IP
export const globalRateLimiter = new RateLimiter(60, 60_000); // 60 requests/minute across all clients (this instance)
