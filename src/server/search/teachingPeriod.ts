/**
 * Teaching-period intelligence (Phase 18D, Part 7). Uses each institution's
 * OWN registry-declared period names and aliases (`teachingPeriodAliases`)
 * — never a cross-institution equivalence table. "Semester 1" at one
 * university is never assumed to mean "Trimester 1" at another; aliases
 * here only ever cover textual variants of the SAME institution's OWN
 * period (e.g. an abbreviation like "S1" for "Semester 1").
 */

import type { UniversityDefinition } from "../../import/universityRegistry";

export type TeachingPeriodClassification = "exact" | "alias" | "not-shown" | "conflicting" | "multiple-offered";

export interface TeachingPeriodResult {
  classification: TeachingPeriodClassification;
  matchedPeriods: string[];
  evidence: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectTeachingPeriod(text: string, requestedPeriod: string | null, university: UniversityDefinition): TeachingPeriodResult {
  if (!requestedPeriod) {
    return { classification: "not-shown", matchedPeriods: [], evidence: [] };
  }

  const foundPeriods: string[] = [];
  const evidence: string[] = [];
  let matchedViaAlias = false;

  for (const period of university.teachingPeriodNames) {
    const aliases = university.teachingPeriodAliases[period] ?? [];
    const canonicalHit = new RegExp(`\\b${escapeRegExp(period)}\\b`, "i").test(text);
    const aliasHit = aliases.find((alias) => new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(text));

    if (canonicalHit) {
      foundPeriods.push(period);
      evidence.push(`Page mentions "${period}"`);
    } else if (aliasHit) {
      foundPeriods.push(period);
      evidence.push(`Page mentions "${aliasHit}", an alias for "${period}"`);
      matchedViaAlias = true;
    }
  }

  const distinct = [...new Set(foundPeriods)];
  if (distinct.length === 0) {
    return { classification: "not-shown", matchedPeriods: [], evidence: [] };
  }
  if (distinct.length > 1) {
    return { classification: "multiple-offered", matchedPeriods: distinct, evidence };
  }

  const requestedLower = requestedPeriod.trim().toLowerCase();
  const only = distinct[0];
  if (only.toLowerCase() === requestedLower) {
    return { classification: matchedViaAlias ? "alias" : "exact", matchedPeriods: [only], evidence };
  }
  return {
    classification: "conflicting",
    matchedPeriods: [only],
    evidence: [...evidence, `Requested "${requestedPeriod}" but the page shows "${only}"`],
  };
}
