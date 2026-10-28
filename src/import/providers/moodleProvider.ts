/**
 * Moodle provider (Phase 18F, Part 8/9) — implements the existing
 * `AcademicProvider` contract, exactly like every other provider. Contains
 * NO Moodle API logic itself: the real work (POST-body-token-authenticated
 * fetch, wrapper-object unwrapping, mapping) all happens server-side
 * (`src/server/lms/moodle/moodleImportOrchestrator.ts`), reached through
 * `POST /api/lms/moodle/import-preview`. This provider is a thin
 * client-side wrapper — the Moodle connection token never reaches this
 * file or anything else running in the browser. Mirrors
 * `canvasProvider.ts`'s exact structure.
 */

import type { AcademicProvider, ExtractionContext, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";
import { callMoodleImportPreview, fetchMoodleCourses, fetchMoodleStatus } from "../moodleBackendClient";
import type { LmsCourseClassification, LmsCourseSummary, LmsProvider, LmsSyncCapabilities } from "../lmsProvider";

export interface MoodleImportRequestPayload {
  institutionId: string;
  courses: Array<{ courseId: number; shortName: string | null; fullName: string | null; viewUrl: string | null }>;
  includeAnnouncements: boolean;
}

export function createMoodleProvider(): AcademicProvider {
  return {
    id: "moodle-lms",
    displayName: "Moodle (read-only)",
    capabilities: {
      acceptedFileKinds: [],
      requiresNoFile: true,
      producesSubjects: true,
      producesCalendarEvents: true,
      configured: true, // the PROVIDER is always available; whether a given institution's token is actually configured is a separate, per-institution check surfaced earlier in the flow, never faked here
    },
    isAvailable: () => true,
    validate(input) {
      if (!input.text) return new ImportError("empty-file", "No Moodle courses were selected.", input.sourceId);
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);

      let payload: MoodleImportRequestPayload;
      try {
        payload = JSON.parse(input.text ?? "{}") as MoodleImportRequestPayload;
      } catch {
        throw new ImportError("parse-failed", "That Moodle import request couldn't be read.", input.sourceId);
      }
      if (!payload.institutionId || !Array.isArray(payload.courses) || payload.courses.length === 0) {
        throw new ImportError("empty-file", "No Moodle courses were selected.", input.sourceId);
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.3, message: "Retrieving your selected Moodle courses…" });

      const result = await callMoodleImportPreview(payload.institutionId, payload.courses, payload.includeAnnouncements, ctx.signal);
      if (!result.available || !result.outcome) {
        throw new ImportError("network-disabled", result.error ?? "Moodle is temporarily unavailable.", input.sourceId);
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return result.outcome.sourcePackage;
    },
  };
}

/** Additive `LmsProvider` facade (Phase 18F, Part 2) — see canvasProvider.ts's own equivalent for the full reasoning; every call here delegates to an already-built, already-tested Moodle function. */
export function createMoodleLmsProvider(institutionId: string): LmsProvider {
  return {
    providerId: "moodle-lms",
    institutionId,
    async getConnectionStatus(_ownerId: string) {
      const status = await fetchMoodleStatus(institutionId);
      return {
        connected: status?.connected ?? false,
        institutionConfigured: status?.institutionConfigured ?? false,
        reauthorisationRequired: status?.reauthorisationRequired ?? false,
        lastSuccessfulSyncAt: status?.lastSuccessfulSyncAt ? new Date(status.lastSuccessfulSyncAt).toISOString() : null,
      };
    },
    async listCourses(_ownerId: string): Promise<LmsCourseSummary[]> {
      const courses = await fetchMoodleCourses(institutionId);
      if (!courses) return [];
      return courses.map((c) => ({
        remoteId: String(c.courseId),
        name: c.fullName ?? c.shortName ?? "Untitled course",
        code: c.shortName,
        classification: c.classification as LmsCourseClassification,
        suggestedSelected: c.suggestedSelected,
      }));
    },
    async previewImport(_ownerId: string, courseIds: string[], options): Promise<ImportedSourcePackage> {
      const signal = new AbortController().signal;
      const courses = await fetchMoodleCourses(institutionId);
      const selected = (courses ?? []).filter((c) => courseIds.includes(String(c.courseId))).map((c) => ({ courseId: c.courseId, shortName: c.shortName, fullName: c.fullName, viewUrl: c.viewUrl }));
      const result = await callMoodleImportPreview(institutionId, selected, options.includeAnnouncements, signal);
      if (!result.available || !result.outcome) {
        throw new ImportError("network-disabled", result.error ?? "Moodle is temporarily unavailable.", null);
      }
      return result.outcome.sourcePackage;
    },
    getSyncCapabilities(): LmsSyncCapabilities {
      return { supportsManualRefresh: true, supportsAnnouncements: true, supportsCalendarApi: true, hasFallbackImportPath: true };
    },
  };
}
