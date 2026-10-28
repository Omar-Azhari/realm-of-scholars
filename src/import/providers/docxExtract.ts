/**
 * mammoth.js wiring, isolated for dynamic import (see pdfExtract.ts for the
 * same rationale). Raw text extraction only — no HTML is generated or
 * rendered, so there is no HTML-injection surface from a DOCX file.
 *
 * Imported from the package's main entry (not the prebuilt
 * `mammoth.browser.js`, which ships no type declarations): mammoth's
 * package.json declares a `"browser"` field that remaps its two Node-only
 * internals (`unzip.js`, `docx/files.js`) to browser-safe implementations,
 * which Vite applies automatically for a browser build — so the main entry
 * is both fully typed and safe to bundle for the browser.
 */

import mammoth from "mammoth";

export async function extractDocxText(bytes: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: bytes });
  return result.value;
}
