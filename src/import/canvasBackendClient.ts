/**
 * Browser-side client for the Canvas OAuth + import endpoints (Phase 18E,
 * Part 21) — the exact same "call the backend, treat any failure as
 * honestly unavailable" discipline as `backendDiscoveryClient.ts` (Phase
 * 18C). Never sends or receives a Canvas token; every function here only
 * ever exchanges non-secret identifiers (institutionId, ownerId,
 * courseIds) with the server.
 */

import type { CanvasImportOutcome } from "../server/lms/canvas/canvasImportOrchestrator";

const INSTALLATION_ID_KEY = "unigame:canvasInstallationId:v1";

/** A non-secret, client-generated correlation id — deliberately stored OUTSIDE the save-data object/key, so it is never included in a save export (see docs/PHASE_18E_CANVAS_INTEGRATION.md §1). Losing it (cleared browser storage) means losing the Canvas connection binding, by design — documented as a known limitation, not silently masked. */
export function getOrCreateCanvasInstallationId(): string {
  if (typeof window === "undefined") return "server-side-no-installation-id";
  let id = window.localStorage.getItem(INSTALLATION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(INSTALLATION_ID_KEY, id);
  }
  return id;
}

export interface CanvasStatusResponse {
  institutionId: string;
  institutionConfigured: boolean;
  connected: boolean;
  reauthorisationRequired: boolean;
  canvasUserId: string | null;
  lastSuccessfulSyncAt: number | null;
  scopes: string[];
  connectedAt: number | null;
}

export async function fetchCanvasStatus(institutionId: string): Promise<CanvasStatusResponse | null> {
  const ownerId = getOrCreateCanvasInstallationId();
  try {
    const res = await fetch(`/api/lms/canvas/status?institutionId=${encodeURIComponent(institutionId)}&ownerId=${encodeURIComponent(ownerId)}`);
    if (!res.ok) return null;
    return (await res.json()) as CanvasStatusResponse;
  } catch {
    return null;
  }
}

/**
 * Navigates the WHOLE browser to the Canvas OAuth flow — not a fetch, a
 * real page navigation, since the server's response is a redirect to
 * Canvas itself. `includeGrades` must only ever be true immediately after
 * the user explicitly confirmed the separate grades-consent screen (Part
 * 12) — never passed as true by default.
 */
export function beginCanvasConnect(institutionId: string, includeGrades = false): void {
  const ownerId = getOrCreateCanvasInstallationId();
  const params = new URLSearchParams({ institutionId, returnPath: "/", ownerId });
  if (includeGrades) params.set("includeGrades", "true");
  window.location.href = `/api/lms/canvas/connect?${params.toString()}`;
}

/** True only if the connection's actual granted scopes (Canvas's own record, not a locally-tracked flag) include the grades/submissions scope — see connect.ts's comment on why this is the sole source of truth. */
export function connectionHasGradesScope(scopes: string[]): boolean {
  return scopes.some((s) => s.includes("/submissions"));
}

export async function disconnectCanvas(institutionId: string): Promise<{ ok: boolean; remoteRevocationSucceeded: boolean }> {
  const ownerId = getOrCreateCanvasInstallationId();
  try {
    const res = await fetch("/api/lms/canvas/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, institutionId }),
    });
    if (!res.ok) return { ok: false, remoteRevocationSucceeded: false };
    const data = (await res.json()) as { disconnected: boolean; remoteRevocationSucceeded: boolean };
    return { ok: data.disconnected, remoteRevocationSucceeded: data.remoteRevocationSucceeded };
  } catch {
    return { ok: false, remoteRevocationSucceeded: false };
  }
}

export async function refreshCanvasConnection(institutionId: string): Promise<boolean> {
  const ownerId = getOrCreateCanvasInstallationId();
  try {
    const res = await fetch("/api/lms/canvas/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, institutionId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface CanvasCourseListItem {
  courseId: number;
  name: string | null;
  courseCode: string | null;
  classification: string;
  suggestedSelected: boolean;
  suggestionReason: string;
  htmlUrl: string | null;
}

export async function fetchCanvasCourses(institutionId: string): Promise<CanvasCourseListItem[] | null> {
  const ownerId = getOrCreateCanvasInstallationId();
  try {
    const res = await fetch(`/api/lms/canvas/courses?institutionId=${encodeURIComponent(institutionId)}&ownerId=${encodeURIComponent(ownerId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { courses: CanvasCourseListItem[] };
    return data.courses;
  } catch {
    return null;
  }
}

export interface CanvasImportPreviewOutcome {
  available: boolean;
  outcome: CanvasImportOutcome | null;
  error: string | null;
}

export async function callCanvasImportPreview(
  institutionId: string,
  courseIds: number[],
  includeAnnouncements: boolean,
  signal: AbortSignal
): Promise<CanvasImportPreviewOutcome> {
  const ownerId = getOrCreateCanvasInstallationId();
  try {
    const res = await fetch("/api/lms/canvas/import-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, institutionId, courseIds, includeAnnouncements }),
      signal,
    });
    if (!res.ok) {
      return { available: false, outcome: null, error: `backend responded with HTTP ${res.status}` };
    }
    const data = (await res.json()) as CanvasImportOutcome;
    return { available: true, outcome: data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { available: false, outcome: null, error: error instanceof Error ? error.message : "network error" };
  }
}
