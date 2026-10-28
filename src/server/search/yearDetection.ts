/**
 * Academic-year intelligence (Phase 18D, Part 6). Detects year signals from
 * a fetched page's title, URL, and body text, then classifies the page
 * relative to the year the user actually asked for. Never assumes the
 * current calendar year IS the academic year, never treats a retrieval date
 * as a handbook year, and explicitly allows for a university publishing next
 * year's handbook before the current calendar year ends (a real, expected
 * case — not an error).
 */

export type YearClassification = "exact" | "likely" | "not-shown" | "stale" | "future" | "conflicting";

export interface YearDetectionResult {
  classification: YearClassification;
  /** Every distinct year found across all signals, sorted ascending. */
  detectedYears: number[];
  /** Human-readable evidence strings — kept on the source reference so the user can see exactly why a classification was reached. */
  evidence: string[];
}

interface YearMention {
  year: number;
  strength: "strong" | "weak";
  evidence: string;
}

function findYearMentions(text: string, url: string, title: string | null): YearMention[] {
  const mentions: YearMention[] = [];

  // Strong: explicit "20XX Handbook" / "Handbook 20XX" phrasing in title or body.
  const strongPattern = /\b(20\d{2})\s+Handbook\b|\bHandbook\s+(20\d{2})\b/gi;
  for (const source of [title ?? "", text]) {
    for (const m of source.matchAll(strongPattern)) {
      const year = Number(m[1] ?? m[2]);
      mentions.push({ year, strength: "strong", evidence: `"${m[0]}" in ${source === title ? "the page title" : "the page text"}` });
    }
  }

  // Weak: a bare 20xx-shaped number in the URL path (could be a year, could be coincidental).
  for (const m of url.matchAll(/\b(20\d{2})\b/g)) {
    mentions.push({ year: Number(m[1]), strength: "weak", evidence: `"${m[1]}" appears in the page URL` });
  }

  return mentions;
}

export function detectAcademicYear(text: string, url: string, title: string | null, requestedYear: string): YearDetectionResult {
  const requested = Number(requestedYear);
  const mentions = findYearMentions(text, url, title);
  const evidence = mentions.map((m) => m.evidence);

  const staleMatch = /not\s+available\s+in\s+(\d{4})/i.exec(text);
  if (staleMatch && Number(staleMatch[1]) === requested) {
    evidence.push(`Page states "not available in ${staleMatch[1]}"`);
    return { classification: "stale", detectedYears: [...new Set(mentions.map((m) => m.year))].sort(), evidence };
  }

  const distinctYears = [...new Set(mentions.map((m) => m.year))].sort();

  if (distinctYears.length === 0) {
    return { classification: "not-shown", detectedYears: [], evidence };
  }
  if (distinctYears.length > 1) {
    return { classification: "conflicting", detectedYears: distinctYears, evidence };
  }

  const only = distinctYears[0];
  const hasStrongEvidence = mentions.some((m) => m.year === only && m.strength === "strong");

  if (only === requested) {
    return { classification: hasStrongEvidence ? "exact" : "likely", detectedYears: [only], evidence };
  }
  if (only > requested) {
    // A university may legitimately publish next year's handbook before the
    // current calendar year ends — surfaced as "future", never silently
    // treated as wrong, but also never silently treated as current either.
    return { classification: "future", detectedYears: [only], evidence };
  }
  return { classification: "stale", detectedYears: [only], evidence };
}
