/**
 * Small shared helpers for splitting syllabus text into workable chunks.
 * Kept separate so subject/module/assessment rule modules stay focused on
 * their own patterns rather than re-implementing text chunking each time.
 */

export interface Heading {
  /** Matched heading text, e.g. "Assessment 2: Quantitative and Qualitative Data Analysis". */
  text: string;
  /** Character offset in the source text where the heading starts. */
  index: number;
}

/** The text between one heading's start and the next (or end of document). */
export function sliceUntilNext(text: string, headings: Heading[], current: Heading): string {
  const idx = headings.indexOf(current);
  const nextStart = idx >= 0 && idx + 1 < headings.length ? headings[idx + 1].index : text.length;
  return text.slice(current.index, nextStart);
}

/** Percentage weighting: "30%", "weighting: 25 %", "worth 40 percent". */
export function findWeighting(block: string): number | null {
  // `\b` must sit around "percent", never right after the literal "%" — "%"
  // and the whitespace/newline that follows it are both non-word characters,
  // so a `\b` placed immediately after "%" can never match anything real.
  const pct = /(\d{1,3}(?:\.\d+)?)\s*(?:%|\bpercent\b)/i.exec(block);
  if (!pct) return null;
  const value = Number(pct[1]);
  return value >= 0 && value <= 100 ? value : null;
}

/** Submission-method sentence: "Submit via the LMS.", "Submission: single PDF upload." */
export function findSubmissionMethod(block: string): string | null {
  const m = /\bsubmi(?:t|ssion)\b[^.\n]{0,140}[.\n]/i.exec(block);
  return m ? m[0].trim().replace(/\s+/g, " ") : null;
}

/** Excerpt around an index, trimmed to whole-ish words, for a SourceReference. */
export function excerptAround(text: string, index: number, radius = 90): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim().replace(/\s+/g, " ")}${suffix}`;
}
