/**
 * Bounded, in-memory, per-instance cache (Phase 18C, Part 10). Vercel
 * Functions do not share memory across concurrent/cold instances, so this
 * is a real but honestly-scoped optimisation — see
 * docs/PHASE_18C_DISCOVERY_BACKEND.md §9 for why a distributed store isn't
 * wired up this phase. Short TTL for failures (retry soon), longer TTL for
 * confirmed successes (stable handbook pages rarely change hour to hour).
 */

export interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 200;
export const FAILURE_TTL_MS = 60_000; // 1 minute
export const SUCCESS_TTL_MS = 60 * 60_000; // 1 hour

export class BoundedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  get(key: string): CacheEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    // Touch for LRU recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    const now = Date.now();
    this.entries.set(key, { value, cachedAt: now, expiresAt: now + ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Cache key per Part 10: institution + normalized subject query + academic year + teaching period. */
export function buildCacheKey(institutionId: string, code: string | null, name: string | null, academicYear: string, teachingPeriod: string | null): string {
  const query = (code ?? name ?? "").trim().toLowerCase();
  return [institutionId, query, academicYear, teachingPeriod ?? ""].join("::");
}
