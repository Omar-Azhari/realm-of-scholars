/**
 * Approved external search-API adapter (Phase 18C, Part 4; reshaped to the
 * formalised `AcademicSearchAdapter` interface in Phase 18D) — interface
 * only, NOT wired up in either phase, exactly the Phase 18A AI-extraction-
 * adapter precedent (src/import/types.ts's AcademicExtractionService).
 * Gated behind an env var that, if unset, means this adapter is never
 * selected and `isConfigured()` reports it honestly — no key of any kind
 * exists in this repository or in browser code either way.
 *
 * A real implementation would call a paid, approved web-search API
 * server-side (credentials never leaving the server), restrict results to
 * `officialDomains` before returning anything, respect `resultLimit`, and
 * reuse each confirmed result's fetched HTML the same way `sitemapAdapter.ts`
 * does (fetch each candidate exactly once).
 */

import type { AcademicSearchAdapter, SearchResult } from "./types";

const API_KEY_ENV_VAR = "UNIGAME_SEARCH_API_KEY";

export function createExternalSearchApiAdapter(): AcademicSearchAdapter {
  return {
    id: "external-search-api",
    isConfigured: () => Boolean(process.env[API_KEY_ENV_VAR]),
    supportsInstitution: () => Boolean(process.env[API_KEY_ENV_VAR]),
    async healthCheck() {
      const configured = Boolean(process.env[API_KEY_ENV_VAR]);
      return { ok: configured, detail: configured ? null : `${API_KEY_ENV_VAR} is not set — this adapter is unconfigured` };
    },
    async search(): Promise<SearchResult[]> {
      if (!process.env[API_KEY_ENV_VAR]) return [];
      // Not implemented this phase — see file header. Returning no result
      // here is correct per Part 3 ("never fabricate search results"), not
      // a placeholder success.
      return [];
    },
  };
}
