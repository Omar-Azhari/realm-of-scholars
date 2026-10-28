/**
 * PDF provider (Phase 18A, Part 3/4). Native text extraction via pdf.js,
 * dynamically imported so the parser only enters the bundle when a PDF is
 * actually processed. Never defaults to OCR: a document whose pages yield
 * almost no text is flagged as likely scanned/image-only rather than
 * silently producing an empty result.
 */

import type { AcademicProvider, ExtractionContext, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";
import { parseSyllabusText } from "../extraction/syllabusParser";

/** Below this average characters-per-page, a PDF is treated as likely scanned. */
const SCANNED_DOCUMENT_THRESHOLD_CHARS_PER_PAGE = 20;

export function createPdfDocumentProvider(getContextYear: () => number | null): AcademicProvider {
  return {
    id: "pdf-document",
    displayName: "PDF document",
    capabilities: {
      acceptedFileKinds: ["pdf"],
      requiresNoFile: false,
      producesSubjects: true,
      producesCalendarEvents: false,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (input.kind !== "pdf") return new ImportError("unsupported-file-type", `${input.filename} isn't a PDF.`, input.sourceId);
      if (!input.bytes || input.bytes.byteLength === 0) {
        return new ImportError("empty-file", `${input.filename} is empty.`, input.sourceId);
      }
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
      if (!input.bytes) throw new ImportError("empty-file", `${input.filename} is empty.`, input.sourceId);

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.1, message: "Loading PDF engine…" });
      const { extractPdfPages } = await import("./pdfExtract");

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.3, message: "Reading pages…" });
      let pages: Awaited<ReturnType<typeof extractPdfPages>>;
      try {
        pages = await extractPdfPages(input.bytes.slice(0), ctx.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
        }
        throw new ImportError(
          "corrupted-file",
          `${input.filename} could not be read as a PDF — it may be corrupted or password-protected.`,
          input.sourceId
        );
      }

      const totalChars = pages.reduce((sum, p) => sum + p.text.replace(/\s+/g, "").length, 0);
      const avgCharsPerPage = pages.length > 0 ? totalChars / pages.length : 0;

      if (avgCharsPerPage < SCANNED_DOCUMENT_THRESHOLD_CHARS_PER_PAGE) {
        return {
          providerId: "pdf-document",
          subjects: [],
          calendarEvents: [],
          warnings: [
            {
              id: `${input.sourceId}-scanned`,
              kind: "scanned-document",
              message: `${input.filename} looks like a scanned or image-only PDF — very little text could be extracted. OCR isn't available yet; try a text-based export of this document instead.`,
              sourceId: input.sourceId,
            },
          ],
        };
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.7, message: "Finding subjects, modules and assessments…" });

      // Build one joined text string plus a page-boundary table so extracted
      // fields keep a real page reference (Part 4: "retain page or section
      // references when extraction libraries support them").
      let joined = "";
      const boundaries: Array<{ start: number; page: number }> = [];
      for (const p of pages) {
        boundaries.push({ start: joined.length, page: p.page });
        joined += `${p.text}\n\n`;
      }
      const locate = (index: number): string | null => {
        let page = boundaries[0]?.page ?? null;
        for (const b of boundaries) {
          if (b.start <= index) page = b.page;
          else break;
        }
        return page !== null ? `page ${page}` : null;
      };

      const { subject, warnings } = parseSyllabusText(joined, {
        sourceId: input.sourceId,
        filename: input.filename,
        contextYear: getContextYear(),
        locate,
      });

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return { providerId: "pdf-document", subjects: [subject], calendarEvents: [], warnings };
    },
  };
}
