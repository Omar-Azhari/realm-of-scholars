/**
 * Canvas provider (Phase 18E, Part 8) — implements the existing
 * `AcademicProvider` contract, exactly like every other provider. Contains
 * NO Canvas API logic itself: the real work (bearer-authenticated fetch,
 * pagination, mapping) all happens server-side
 * (`src/server/lms/canvas/canvasImportOrchestrator.ts`), reached through
 * `POST /api/lms/canvas/import-preview`. This provider is a thin client-
 * side wrapper, the same shape `officialUniversityProvider.ts` uses for its
 * own server round-trip — the Canvas access token never reaches this file
 * or anything else running in the browser.
 */

import type { AcademicProvider, ExtractionContext, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";
import { callCanvasImportPreview, fetchCanvasCourses, fetchCanvasStatus } from "../canvasBackendClient";
import type { LmsCourseClassification, LmsCourseSummary, LmsProvider, LmsSyncCapabilities } from "../lmsProvider";

export interface CanvasImportRequestPayload {
  institutionId: string;
  courseIds: number[];
  includeAnnouncements: boolean;
}

export function createCanvasProvider(): AcademicProvider {
  return {
    id: "canvas-lms",
    displayName: "Canvas (read-only)",
    capabilities: {
      acceptedFileKinds: [],
      requiresNoFile: true,
      producesSubjects: true,
      producesCalendarEvents: true,
      configured: true, // the PROVIDER is always available; whether a given institution's OAuth is actually configured is a separate, per-institution check surfaced earlier in the flow (Study Details/Connect Canvas step), never faked here
    },
    isAvailable: () => true,
    validate(input) {
      if (!input.text) return new ImportError("empty-file", "No Canvas courses were selected.", input.sourceId);
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);

      let payload: CanvasImportRequestPayload;
      try {
        payload = JSON.parse(input.text ?? "{}") as CanvasImportRequestPayload;
      } catch {
        throw new ImportError("parse-failed", "That Canvas import request couldn't be read.", input.sourceId);
      }
      if (!payload.institutionId || !Array.isArray(payload.courseIds) || payload.courseIds.length === 0) {
        throw new ImportError("empty-file", "No Canvas courses were selected.", input.sourceId);
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.3, message: "Retrieving your selected Canvas courses…" });

      const result = await callCanvasImportPreview(payload.institutionId, payload.courseIds, payload.includeAnnouncements, ctx.signal);
      if (!result.available || !result.outcome) {
        throw new ImportError("network-disabled", result.error ?? "Canvas is temporarily unavailable.", input.sourceId);
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return result.outcome.sourcePackage;
    },
  };
}

/**
 * Additive `LmsProvider` facade (Phase 18F, Part 2) — wraps the existing,
 * unmodified `canvasBackendClient.ts` functions in the shared shape Semester
 * Setup's UI uses for either Canvas or Moodle once an institution's LMS
 * kind is known. Contains no new logic of its own; every call delegates to
 * an already-shipped, already-tested Canvas function. `previewImport`
 * reuses `callCanvasImportPreview` and unwraps its outcome into the
 * provider-neutral `ImportedSourcePackage` shape it already returns.
 */
export function createCanvasLmsProvider(institutionId: string): LmsProvider {
  return {
    providerId: "canvas-lms",
    institutionId,
    async getConnectionStatus(_ownerId: string) {
      const status = await fetchCanvasStatus(institutionId);
      return {
        connected: status?.connected ?? false,
        institutionConfigured: status?.institutionConfigured ?? false,
        reauthorisationRequired: status?.reauthorisationRequired ?? false,
        lastSuccessfulSyncAt: status?.lastSuccessfulSyncAt ? new Date(status.lastSuccessfulSyncAt).toISOString() : null,
      };
    },
    async listCourses(_ownerId: string): Promise<LmsCourseSummary[]> {
      const courses = await fetchCanvasCourses(institutionId);
      if (!courses) return [];
      return courses.map((c) => ({
        remoteId: String(c.courseId),
        name: c.name ?? "Untitled course",
        code: c.courseCode,
        classification: c.classification as LmsCourseClassification,
        suggestedSelected: c.suggestedSelected,
      }));
    },
    async previewImport(_ownerId: string, courseIds: string[], options): Promise<ImportedSourcePackage> {
      const signal = new AbortController().signal;
      const result = await callCanvasImportPreview(institutionId, courseIds.map(Number), options.includeAnnouncements, signal);
      if (!result.available || !result.outcome) {
        throw new ImportError("network-disabled", result.error ?? "Canvas is temporarily unavailable.", null);
      }
      return result.outcome.sourcePackage;
    },
    getSyncCapabilities(): LmsSyncCapabilities {
      return { supportsManualRefresh: true, supportsAnnouncements: true, supportsCalendarApi: true, hasFallbackImportPath: true };
    },
  };
}
