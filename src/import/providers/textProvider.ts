/**
 * Plain-text / Markdown provider (Phase 18A, Part 3). Runs the shared
 * deterministic syllabus parser directly over the decoded file text.
 */

import type { AcademicProvider, ExtractionContext, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";
import { parseSyllabusText, looksLikeEmptyExtraction } from "../extraction/syllabusParser";

export function createTextDocumentProvider(getContextYear: () => number | null): AcademicProvider {
  return {
    id: "text-document",
    displayName: "Text / Markdown file",
    capabilities: {
      acceptedFileKinds: ["text", "markdown"],
      requiresNoFile: false,
      producesSubjects: true,
      producesCalendarEvents: false,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (input.kind !== "text" && input.kind !== "markdown") {
        return new ImportError("unsupported-file-type", `${input.filename} isn't a text or Markdown file.`, input.sourceId);
      }
      if (!input.text) {
        return new ImportError("empty-file", `${input.filename} has no readable text.`, input.sourceId);
      }
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.2, message: "Reading text…" });

      const text = input.text ?? "";
      if (looksLikeEmptyExtraction(text)) {
        return {
          providerId: "text-document",
          subjects: [],
          calendarEvents: [],
          warnings: [
            {
              id: `${input.sourceId}-empty`,
              kind: "empty-extraction",
              message: `${input.filename} doesn't contain enough text to extract anything useful.`,
              sourceId: input.sourceId,
            },
          ],
        };
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.6, message: "Finding subjects, modules and assessments…" });
      const { subject, warnings } = parseSyllabusText(text, {
        sourceId: input.sourceId,
        filename: input.filename,
        contextYear: getContextYear(),
      });

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return { providerId: "text-document", subjects: [subject], calendarEvents: [], warnings };
    },
  };
}
