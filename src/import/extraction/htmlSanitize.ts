/**
 * Canvas-provided rich text sanitisation (Phase 18E, Part 9/20). Canvas
 * assignment descriptions, syllabus bodies, and announcement messages are
 * raw, untrusted HTML from a system this app doesn't control.
 *
 * Rather than write a bespoke allowlist HTML sanitiser (no such library is a
 * dependency of this project, and hand-rolled markup sanitisation is exactly
 * the kind of DIY security primitive Part 4 already warns against for
 * cryptography — the same caution applies here), this flattens Canvas HTML
 * to safe PLAIN TEXT using the existing, already-proven `htmlToPlainText()`
 * (Phase 18B — strips `<script>`/`<style>`/comments before removing any
 * other tag, then decodes entities). Every other source excerpt already
 * rendered by this app's Review/Extraction Report UI is plain text, never
 * `dangerouslySetInnerHTML` — this keeps Canvas content on the exact same,
 * already-audited path rather than introducing a new one.
 */

import { htmlToPlainText } from "./htmlText";

const MAX_SANITIZED_LENGTH = 4000;

export function sanitizeCanvasHtml(html: string): string {
  const plain = htmlToPlainText(html);
  return plain.length > MAX_SANITIZED_LENGTH ? `${plain.slice(0, MAX_SANITIZED_LENGTH)}…` : plain;
}
