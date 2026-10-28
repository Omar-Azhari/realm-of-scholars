/**
 * Minimal, dependency-free HTML -> plain-text conversion (Phase 18B). No DOM
 * parser, no script execution, no `innerHTML` — a handbook page's markup is
 * treated as inert text throughout. Block-level closing tags become real
 * newlines so the shared line-anchored extraction rules (heading patterns,
 * "Week N" detection, etc.) see the same kind of text they see from a real
 * uploaded document.
 */

const BLOCK_END_TAGS = /<\/(p|div|li|tr|h[1-6]|section|article|header|footer|ul|ol|table)\s*>/gi;
const LINE_BREAK_TAGS = /<br\s*\/?>/gi;
const LIST_ITEM_OPEN = /<li[^>]*>/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
}

export function htmlToPlainText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(LIST_ITEM_OPEN, "\n");
  text = text.replace(BLOCK_END_TAGS, "\n");
  text = text.replace(LINE_BREAK_TAGS, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  text = text.replace(/[ \t]+/g, " ");
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
