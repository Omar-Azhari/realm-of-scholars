/**
 * Manual completion provider (Phase 18A, Part 3). Not a file at all — this
 * is how the Review step lets a user type in one missing fact (e.g. an exam
 * date no document supplied) as an ordinary provider contribution, so it
 * merges through the exact same pipeline as every file-based source instead
 * of being a special-cased UI-only edit. Every value handed to this provider
 * comes directly from the user, so it is always `confirmed`.
 */

import type { AcademicProvider, ExtractionContext, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";

export interface ManualCompletionPayload {
  subjectCode: string | null;
  subjectName: string | null;
  assessmentTitle: string;
  weighting: number | null;
  dueDate: string | null;
  dueTime: string | null;
  submissionMethod: string | null;
}

let counter = 0;
function tempId(prefix: string): string {
  counter += 1;
  return `${prefix}-manual-${counter}`;
}

export function createManualCompletionProvider(): AcademicProvider {
  return {
    id: "manual-completion",
    displayName: "Typed in manually",
    capabilities: {
      acceptedFileKinds: [],
      requiresNoFile: true,
      producesSubjects: true,
      producesCalendarEvents: false,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (!input.text) return new ImportError("empty-file", "Nothing was entered.", input.sourceId);
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
      let payload: ManualCompletionPayload;
      try {
        payload = JSON.parse(input.text ?? "{}") as ManualCompletionPayload;
      } catch {
        throw new ImportError("parse-failed", "That entry couldn't be read.", input.sourceId);
      }
      if (!payload.assessmentTitle || !payload.assessmentTitle.trim()) {
        throw new ImportError("parse-failed", "An assessment title is required.", input.sourceId);
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Recorded." });

      const now = new Date().toISOString();
      const sourceRef = {
        sourceId: input.sourceId,
        filename: "Manual entry",
        location: null,
        excerpt: null,
        parser: "manual",
        importedAt: now,
      };

      return {
        providerId: "manual-completion",
        subjects: [
          {
            temporaryId: tempId("subject"),
            code: payload.subjectCode,
            name: payload.subjectName ?? payload.subjectCode ?? "Manual entry",
            description: null,
            coordinator: null,
            creditPoints: null,
            teachingPeriod: null,
            colourSuggestion: null,
            modules: [],
            assessments: [
              {
                temporaryId: tempId("assessment"),
                title: payload.assessmentTitle.trim(),
                type: "other",
                description: "",
                weighting: payload.weighting,
                due: payload.dueDate
                  ? {
                      rawText: payload.dueTime ? `${payload.dueDate} ${payload.dueTime}` : payload.dueDate,
                      isoDate: payload.dueDate,
                      isoTime: payload.dueTime,
                      sourceTimezone: null,
                      weekNumber: null,
                      dateKind: "exact",
                    }
                  : null,
                submissionMethod: payload.submissionMethod,
                linkedModule: null,
                sourceReferences: [sourceRef],
                confidence: "confirmed",
                fieldConfidence: {
                  title: "confirmed",
                  weighting: payload.weighting !== null ? "confirmed" : "missing",
                  dueDate: payload.dueDate ? "confirmed" : "missing",
                  dueTime: payload.dueTime ? "confirmed" : "missing",
                },
              },
            ],
            readings: [],
            goals: [],
            sourceReferences: [sourceRef],
            confidence: "confirmed",
            fieldConfidence: { name: "confirmed", code: payload.subjectCode ? "confirmed" : "missing" },
          },
        ],
        calendarEvents: [],
        warnings: [],
      };
    },
  };
}
