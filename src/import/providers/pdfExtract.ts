/**
 * pdf.js wiring, isolated in its own module so it is only ever pulled into
 * the bundle via dynamic `import()` from pdfProvider.ts (code-split — most
 * sessions never touch a PDF). Native text extraction only: this module
 * never rasterizes pages or runs OCR. A page that yields no text (a scanned
 * image) is reported as empty for that page — the caller decides whether
 * the whole document looks scanned.
 */

import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a hashed, servable URL; pdf.js loads its worker from it.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageText {
  page: number;
  text: string;
}

export async function extractPdfPages(bytes: ArrayBuffer, signal: AbortSignal): Promise<PdfPageText[]> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  let doc: pdfjsLib.PDFDocumentProxy;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    throw new Error(`PDF could not be opened: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const pages: PdfPageText[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    if (signal.aborted) {
      await loadingTask.destroy();
      throw new DOMException("Import cancelled", "AbortError");
    }
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    // pdf.js never puts line breaks inside `item.str` itself — each text run
    // is its own array entry, and `hasEOL` marks whether a line break
    // follows it. Every deterministic extraction rule (module/subject/
    // assessment headings) matches per-line via `^...$`, so this join must
    // reconstruct real line breaks rather than flattening the whole page
    // into one space-joined line.
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pages.push({ page: pageNumber, text });
  }
  await loadingTask.destroy();
  return pages;
}
