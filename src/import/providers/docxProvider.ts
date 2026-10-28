/**
 * DOCX provider (Phase 18A, Part 3/4). Native text extraction via mammoth,
 * dynamically imported (code-split — most sessions never touch a DOCX).
 * DOCX has no meaningful "scanned document" case (it's always native text),
 * so unlike the PDF provider there is no OCR-flag path here.
 */

import type { AcademicProvider, ExtractionContext, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";
import { parseSyllabusText, looksLikeEmptyExtraction } from "../extraction/syllabusParser";

export function createDocxDocumentProvider(getContextYear: () => number | null): AcademicProvider {
  return {
    id: "docx-document",
    displayName: "Word document (.docx)",
    capabilities: {
      acceptedFileKinds: ["docx"],
      requiresNoFile: false,
      producesSubjects: true,
      producesCalendarEvents: false,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (input.kind !== "docx") return new ImportError("unsupported-file-type", `${input.filename} isn't a .docx file.`, input.sourceId);
      if (!input.bytes || input.bytes.byteLength === 0) {
        return new ImportError("empty-file", `${input.filename} is empty.`, input.sourceId);
      }
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
      if (!input.bytes) throw new ImportError("empty-file", `${input.filename} is empty.`, input.sourceId);

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.15, message: "Loading document engine…" });
      const { extractDocxText } = await import("./docxExtract");

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.4, message: "Reading document…" });
      let text: string;
      try {
        text = await extractDocxText(input.bytes.slice(0));
      } catch {
        throw new ImportError(
          "corrupted-file",
          `${input.filename} could not be read — it may not be a valid .docx file, or is corrupted.`,
          input.sourceId
        );
      }

      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);

      if (looksLikeEmptyExtraction(text)) {
        return {
          providerId: "docx-document",
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

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.75, message: "Finding subjects, modules and assessments…" });
      const { subject, warnings } = parseSyllabusText(text, {
        sourceId: input.sourceId,
        filename: input.filename,
        contextYear: getContextYear(),
      });

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return { providerId: "docx-document", subjects: [subject], calendarEvents: [], warnings };
    },
  };
}
