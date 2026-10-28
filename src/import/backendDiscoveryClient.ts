/**
 * Browser-side client for POST /api/academic/discover (Phase 18C, Part 9).
 * The frontend calls the backend first; `SemesterSetupOverlay.tsx` falls
 * back to the Phase 18B direct-browser `OfficialUniversityProvider` when
 * this reports unavailable — never presented as a fake success, always an
 * honest "couldn't reach the search service" leading to the same fallback
 * chain (browser-direct where it works, then upload/manual completion).
 */

import type { DiscoverRequest, DiscoverResponse } from "../server/schema";

export interface BackendDiscoveryOutcome {
  available: boolean;
  response: DiscoverResponse | null;
  error: string | null;
}

export async function callDiscoveryBackend(payload: DiscoverRequest, signal: AbortSignal): Promise<BackendDiscoveryOutcome> {
  try {
    const res = await fetch("/api/academic/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) {
      return { available: false, response: null, error: `backend responded with HTTP ${res.status}` };
    }
    const data = (await res.json()) as DiscoverResponse;
    return { available: true, response: data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    // Network error, 404 from a static-only deployment, CORS, etc. — all
    // mean "not available right now", never a hard failure of the flow.
    return { available: false, response: null, error: error instanceof Error ? error.message : "network error" };
  }
}
