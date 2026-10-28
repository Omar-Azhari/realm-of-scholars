/**
 * Pure matching helpers for the merge engine (Phase 18A, Part 6). No
 * dependency, fully deterministic, unit-testable in isolation.
 */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(text: string): Set<string> {
  const s = normalize(text).replace(/\s+/g, " ");
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

/** Dice coefficient over character bigrams — a simple, dependency-free fuzzy-match score in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return na === nb ? 1 : 0;
  let overlap = 0;
  for (const g of ba) if (bb.has(g)) overlap += 1;
  return (2 * overlap) / (ba.size + bb.size);
}

/** Threshold above which two titles are considered "the same thing" for merge purposes. */
export const TITLE_MATCH_THRESHOLD = 0.6;
/** Higher bar used only for flagging likely-unintentional duplicate names across different subjects. */
export const CROSS_SUBJECT_DUPLICATE_THRESHOLD = 0.85;

export function codesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return normalize(a) === normalize(b);
}
