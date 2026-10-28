/**
 * Fetched-page cache (Phase 18D, Part 14). Extends the Phase 18C whole-
 * response cache (`cache.ts`, still used unchanged by
 * `api/academic/discover.ts`) with a PAGE cache keyed by the exact URL
 * fetched, carrying the metadata Part 14 asks for (contentHash,
 * canonicalUrl, createdAt, expiresAt, lastValidatedAt, sourceRetrievedAt,
 * academicYear, institutionId) — so a retry-one-subject or "select this
 * alternative" action that re-requests a URL already fetched moments ago
 * doesn't re-fetch it.
 *
 * Stale fallback: when a fresh fetch fails but a page cache entry exists
 * within `STALE_GRACE_MS` of its expiry, it's returned anyway (marked
 * `stale: true`) rather than turning a transient network blip into a
 * discovery failure — the caller is expected to surface this honestly
 * (a warning), never silently.
 *
 * A PARSED-RESULT cache (Part 14's third layer) was deliberately NOT added
 * here: `parseSyllabusText` bakes a fresh, monotonically-unique
 * `temporaryId` into every candidate it returns, and that id is later used
 * as a merge/conflict/Undo identity key. Naively caching a parsed
 * `ImportedSubjectCandidate` by content hash and returning the SAME cached
 * object for two different queries in one batch (a real case: two subject
 * codes that happen to resolve to identical page content) would hand out
 * one shared temporaryId to what the rest of the pipeline treats as two
 * distinct subjects — a genuine identity bug, not a safe optimisation.
 * Doing this safely needs the cached value to carry no identity (re-stamp
 * fresh ids on every read), which is a real design task on its own, not a
 * quick bolt-on — left as a named Phase 18E candidate rather than rushed
 * in under this phase's "don't overengineer" instruction. Parsing itself is
 * a low-single-digit-millisecond operation on already-fetched text, so the
 * PAGE cache above (which avoids the actual expensive part — the network
 * round-trip) already captures the real performance win.
 *
 * This module is used ONLY by the discovery orchestrator. It never touches
 * uploaded documents, user notes, personal goals, credentials, or
 * authenticated data — those live entirely outside src/server/* (see
 * SaveDataContext / localStorage), so there's no code path by which this
 * cache could ever hold them.
 */

export interface PageCacheEntry {
  html: string;
  contentHash: string;
  canonicalUrl: string | null;
  institutionId: string;
  academicYear: string;
  createdAt: number;
  expiresAt: number;
  lastValidatedAt: number;
  sourceRetrievedAt: number;
}

export interface PageCacheLookup {
  entry: PageCacheEntry;
  stale: boolean;
}

const DEFAULT_MAX_ENTRIES = 200;
const PAGE_TTL_MS = 30 * 60_000; // 30 minutes — handbook pages change rarely within one setup session
const STALE_GRACE_MS = 6 * 60 * 60_000; // 6 hours past expiry, a stale entry may still stand in for a failed live fetch

export class PageCache {
  private readonly entries = new Map<string, PageCacheEntry>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  /** A live (non-expired) hit, or null. Never returns a stale entry — see getStale for that. */
  get(url: string): PageCacheEntry | null {
    const entry = this.entries.get(url);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  /** An entry within its stale-fallback grace window, live or not — the caller decides whether `stale` matters. Null once the grace window has also passed (evicted, not kept forever). */
  getStale(url: string): PageCacheLookup | null {
    const entry = this.entries.get(url);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt + STALE_GRACE_MS) {
      this.entries.delete(url);
      return null;
    }
    return { entry, stale: now > entry.expiresAt };
  }

  set(url: string, value: Omit<PageCacheEntry, "createdAt" | "expiresAt" | "lastValidatedAt">): PageCacheEntry {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    const now = Date.now();
    const entry: PageCacheEntry = { ...value, createdAt: now, expiresAt: now + PAGE_TTL_MS, lastValidatedAt: now };
    this.entries.set(url, entry);
    return entry;
  }

  get size(): number {
    return this.entries.size;
  }
}
