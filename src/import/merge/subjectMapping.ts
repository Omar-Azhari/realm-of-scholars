/**
 * Suggests which of the 4 existing, art-bound live subjects an imported
 * subject candidate corresponds to (Phase 18A — see
 * docs/PHASE_18A_IMPORT_ARCHITECTURE.md §1/§9). Never auto-applies a
 * mapping — the Review step always requires the user to confirm it, but a
 * good default saves a click when the match is obvious (exact code, or a
 * strong name match).
 */

import type { ImportedSubjectCandidate } from "../types";
import type { SubjectRecord } from "../../types/domain";
import { codesMatch, similarity } from "./matching";

/** Two live subjects would be within this fraction of similarity of each other — close enough that picking one over the other can't be trusted as an automatic default. */
const AMBIGUITY_SIMILARITY_GAP = 0.1;

export interface SubjectMappingSuggestion {
  subjectId: string | null;
  confidence: "exact-code" | "strong-name" | "weak-name" | "none";
  /** Set only for a name-based match (never for exact-code, which is unambiguous by definition) when a second live subject scored within AMBIGUITY_SIMILARITY_GAP of the best match — the caller must not silently apply `subjectId` and should raise a "subject-mapping-ambiguous" conflict instead. */
  ambiguousWith: { subjectId: string; subjectName: string } | null;
}

export function suggestSubjectMapping(
  candidate: ImportedSubjectCandidate,
  liveSubjects: SubjectRecord[]
): SubjectMappingSuggestion {
  const byCode = liveSubjects.find((s) => codesMatch(s.code.value, candidate.code));
  if (byCode) return { subjectId: byCode.id, confidence: "exact-code", ambiguousWith: null };

  let best: SubjectRecord | null = null;
  let bestScore = 0;
  let second: SubjectRecord | null = null;
  let secondScore = 0;
  for (const subject of liveSubjects) {
    const score = similarity(subject.name, candidate.name);
    if (score > bestScore) {
      second = best;
      secondScore = bestScore;
      best = subject;
      bestScore = score;
    } else if (score > secondScore) {
      second = subject;
      secondScore = score;
    }
  }

  const ambiguousWith =
    best && second && bestScore >= 0.35 && bestScore - secondScore < AMBIGUITY_SIMILARITY_GAP
      ? { subjectId: second.id, subjectName: second.name }
      : null;

  if (best && bestScore >= 0.6) return { subjectId: best.id, confidence: "strong-name", ambiguousWith };
  if (best && bestScore >= 0.35) return { subjectId: best.id, confidence: "weak-name", ambiguousWith };
  return { subjectId: null, confidence: "none", ambiguousWith: null };
}
