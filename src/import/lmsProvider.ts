/**
 * Provider-neutral LMS orchestration contract (Phase 18F, Part 2). This is
 * the thin, shared shape Semester Setup's UI and the sync-refresh flow use
 * to talk to EITHER Canvas or Moodle once an institution's LMS kind is
 * known — it deliberately does NOT force authentication, pagination, or
 * response-schema handling into a shared abstraction (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §2 for the full reasoning).
 * Each provider's own connect/disconnect routes, client, and connection
 * store remain entirely independent; this interface only unifies the
 * handful of read-only orchestration calls the UI actually needs to render
 * one code path for "Connect / Status / Course list / Preview" regardless
 * of which LMS produced the data.
 *
 * `CanvasAcademicProvider`-equivalent and `MoodleAcademicProvider` each
 * implement this as an ADDITIVE facade over their existing/new
 * provider-specific modules — never a rewrite of either provider's
 * internals, and never a replacement for `AcademicProvider` (src/import/types.ts),
 * which both providers also still produce output compatible with
 * (`ImportedSourcePackage`).
 */

import type { ImportedSourcePackage } from "./types";

export type LmsCourseClassification =
  | "active"
  | "future"
  | "completed"
  | "hidden"
  | "unavailable"
  | "non-academic"
  | "unknown";

export interface LmsConnectionStatus {
  connected: boolean;
  institutionConfigured: boolean;
  reauthorisationRequired: boolean;
  lastSuccessfulSyncAt: string | null;
}

/** Enough for a room-mapping/course-selection list — never the full raw course record, which stays provider-specific. */
export interface LmsCourseSummary {
  /** Stringified — Canvas and Moodle both use numeric remote ids, kept as a string here so this interface never assumes either provider's id type. */
  remoteId: string;
  name: string;
  code: string | null;
  classification: LmsCourseClassification;
  suggestedSelected: boolean;
}

export interface LmsImportPreviewOptions {
  includeAnnouncements: boolean;
  [key: string]: boolean;
}

export interface LmsSyncCapabilities {
  supportsManualRefresh: boolean;
  supportsAnnouncements: boolean;
  supportsCalendarApi: boolean;
  /** True when a working, non-API fallback (e.g. ICS import) exists regardless of live-connection state. */
  hasFallbackImportPath: boolean;
}

/**
 * Shared read-only orchestration contract. Authentication (`connect`-style
 * flows), disconnect, and sync-preview are DELIBERATELY NOT part of this
 * interface — see the file header and the architecture doc's §2 for why
 * each provider keeps its own shape for those. A provider that has no live
 * connection configured still implements this fully: `getConnectionStatus()`
 * reports `institutionConfigured: false`/`connected: false`, and
 * `listCourses`/`previewImport` simply aren't called by the UI in that
 * state — never a special-cased "unconfigured" object shape.
 *
 * Deliberately NO synchronous `isConfigured()` method: "is this institution
 * configured" can only be answered honestly by asking the server (it
 * depends on a server-only environment variable), and `getConnectionStatus`
 * already carries that as `institutionConfigured`. A synchronous client-side
 * equivalent would need to import a server-side registry module directly
 * into browser code — precisely the shape that caused a real Canvas
 * institution-registry bundle leak earlier in this project (env-var NAMES
 * and endpoint URLs bundled into `dist/assets/*.js`, fixed by routing
 * client code through a status API call instead of a direct import). Never
 * reintroduce that shape for Moodle either.
 */
export interface LmsProvider {
  readonly providerId: string;
  readonly institutionId: string;
  getConnectionStatus(ownerId: string): Promise<LmsConnectionStatus>;
  listCourses(ownerId: string): Promise<LmsCourseSummary[]>;
  previewImport(ownerId: string, courseIds: string[], options: LmsImportPreviewOptions): Promise<ImportedSourcePackage>;
  getSyncCapabilities(): LmsSyncCapabilities;
}
