/**
 * Browser-side client for the Moodle connection + import endpoints (Phase
 * 18F, Part 21) — the exact same "call the backend, treat any failure as
 * honestly unavailable" discipline as `canvasBackendClient.ts`. Never
 * sends or receives a Moodle token in normal operation (the one exception,
 * `submitMoodleToken`, exists only for whichever operator process
 * configures a real institution-issued token — see token.ts's own header;
 * ordinary student-facing UI never renders a form that calls it).
 */

import type { MoodleImportOutcome } from "../server/lms/moodle/moodleImportOrchestrator";

const INSTALLATION_ID_KEY = "unigame:moodleInstallationId:v1";

/** A non-secret, client-generated correlation id — same convention as Canvas's own installation id, deliberately stored OUTSIDE the save-data object so it is never included in a save export. */
export function getOrCreateMoodleInstallationId(): string {
  if (typeof window === "undefined") return "server-side-no-installation-id";
  let id = window.localStorage.getItem(INSTALLATION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(INSTALLATION_ID_KEY, id);
  }
  return id;
}

export interface MoodleStatusResponse {
  institutionId: string;
  institutionConfigured: boolean;
  connected: boolean;
  reauthorisationRequired: boolean;
  moodleUserId: string | null;
  moodleSiteName: string | null;
  lastSuccessfulSyncAt: number | null;
  enabledFunctions: string[];
  connectedAt: number | null;
}

export async function fetchMoodleStatus(institutionId: string): Promise<MoodleStatusResponse | null> {
  const ownerId = getOrCreateMoodleInstallationId();
  try {
    const res = await fetch(`/api/lms/moodle/status?institutionId=${encodeURIComponent(institutionId)}&ownerId=${encodeURIComponent(ownerId)}`);
    if (!res.ok) return null;
    return (await res.json()) as MoodleStatusResponse;
  } catch {
    return null;
  }
}

export interface MoodleCourseListItem {
  courseId: number;
  shortName: string | null;
  fullName: string | null;
  classification: string;
  suggestedSelected: boolean;
  suggestionReason: string;
  viewUrl: string | null;
}

export async function fetchMoodleCourses(institutionId: string): Promise<MoodleCourseListItem[] | null> {
  const ownerId = getOrCreateMoodleInstallationId();
  try {
    const res = await fetch(`/api/lms/moodle/courses?institutionId=${encodeURIComponent(institutionId)}&ownerId=${encodeURIComponent(ownerId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { courses: MoodleCourseListItem[] };
    return data.courses;
  } catch {
    return null;
  }
}

export async function disconnectMoodle(institutionId: string): Promise<{ ok: boolean; remoteRevocationSucceeded: boolean; remoteRevocationError: string | null }> {
  const ownerId = getOrCreateMoodleInstallationId();
  try {
    const res = await fetch("/api/lms/moodle/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, institutionId }),
    });
    if (!res.ok) return { ok: false, remoteRevocationSucceeded: false, remoteRevocationError: null };
    const data = (await res.json()) as { disconnected: boolean; remoteRevocationSucceeded: boolean; remoteRevocationError: string | null };
    return { ok: data.disconnected, remoteRevocationSucceeded: data.remoteRevocationSucceeded, remoteRevocationError: data.remoteRevocationError };
  } catch {
    return { ok: false, remoteRevocationSucceeded: false, remoteRevocationError: null };
  }
}

export async function refreshMoodleConnection(institutionId: string): Promise<boolean> {
  const ownerId = getOrCreateMoodleInstallationId();
  try {
    const res = await fetch("/api/lms/moodle/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, institutionId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface MoodleImportPreviewOutcome {
  available: boolean;
  outcome: MoodleImportOutcome | null;
  error: string | null;
}

export async function callMoodleImportPreview(
  institutionId: string,
  courses: Array<{ courseId: number; shortName: string | null; fullName: string | null; viewUrl: string | null }>,
  includeAnnouncements: boolean,
  signal: AbortSignal
): Promise<MoodleImportPreviewOutcome> {
  const ownerId = getOrCreateMoodleInstallationId();
  try {
    const res = await fetch("/api/lms/moodle/import-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, institutionId, courses, includeAnnouncements }),
      signal,
    });
    if (!res.ok) {
      return { available: false, outcome: null, error: `backend responded with HTTP ${res.status}` };
    }
    const data = (await res.json()) as MoodleImportOutcome;
    return { available: true, outcome: data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { available: false, outcome: null, error: error instanceof Error ? error.message : "network error" };
  }
}
