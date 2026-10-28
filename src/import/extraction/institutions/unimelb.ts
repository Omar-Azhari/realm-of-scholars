/**
 * University of Melbourne extractor (Phase 18D, Part 9). The only
 * institution in the registry marked `supportStatus.staticPageAvailability:
 * "verified"` with real, working static handbook/assessment pages (Phase
 * 18B's live check) — so it's the one genuine example built this phase,
 * rather than a scaffold with no real institution behind it.
 *
 * Fills two gaps the GENERAL engine (`parseSyllabusText`/`subjectRules.ts`)
 * leaves on every source, Melbourne included:
 *
 *  - Credit points: the general engine never looks for this field at all
 *    (`creditPoints` is always null coming out of `subjectRules.ts`), but
 *    Melbourne's handbook pages state it plainly near the top of every
 *    subject page as "Credit Points: N".
 *  - Coordinator via "Subject Coordinator" label: `subjectRules.ts`'s
 *    `COORDINATOR_LABEL_PATTERN` only recognises a line that STARTS with
 *    "coordinator"/"unit coordinator"/"lecturer"/"convenor" — Melbourne's
 *    handbook labels this field "Subject Coordinator", which never matches
 *    that pattern, so the general engine silently leaves it null on every
 *    Melbourne page even when the source states it clearly.
 *
 * Both only ever fill a field that's still null; neither overwrites, and
 * neither invents a value with no matching text — a page with no "Credit
 * Points" line simply stays null, exactly as the general engine would leave
 * it. Every filled field carries a real source excerpt.
 */

import type { ImportedSubjectCandidate, SourceReference } from "../../types";
import { excerptAround } from "../textBlocks";
import type { InstitutionExtractor } from "./types";

const CREDIT_POINTS_PATTERN = /credit\s*points?\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i;
const SUBJECT_COORDINATOR_PATTERN = /^subject\s+coordinator\s*[:\-–]\s*(.+)$/im;

function ref(sourceId: string, filename: string, excerpt: string, parser: string): SourceReference {
  return { sourceId, filename, location: null, excerpt, parser, importedAt: new Date().toISOString() };
}

function enhance(
  subject: ImportedSubjectCandidate,
  plainText: string,
  sourceId: string,
  filename: string
): ImportedSubjectCandidate {
  let creditPoints = subject.creditPoints;
  let creditPointsConfidence = subject.fieldConfidence.creditPoints;
  let sourceReferences = subject.sourceReferences;

  if (creditPoints === null) {
    const match = CREDIT_POINTS_PATTERN.exec(plainText);
    if (match && match.index !== undefined) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        creditPoints = value;
        creditPointsConfidence = "high";
        sourceReferences = [
          ...sourceReferences,
          ref(sourceId, filename, excerptAround(plainText, match.index), "institution:unimelb-credit-points"),
        ];
      }
    }
  }

  let coordinator = subject.coordinator;
  let coordinatorConfidence = subject.fieldConfidence.coordinator;

  if (coordinator === null) {
    const match = SUBJECT_COORDINATOR_PATTERN.exec(plainText);
    if (match && match.index !== undefined) {
      const value = match[1].trim();
      if (value.length > 0) {
        coordinator = value;
        coordinatorConfidence = "high";
        sourceReferences = [
          ...sourceReferences,
          ref(sourceId, filename, excerptAround(plainText, match.index), "institution:unimelb-subject-coordinator"),
        ];
      }
    }
  }

  if (creditPoints === subject.creditPoints && coordinator === subject.coordinator) {
    return subject; // nothing to add — page didn't contain either label, fall back safely
  }

  return {
    ...subject,
    creditPoints,
    coordinator,
    sourceReferences,
    fieldConfidence: { ...subject.fieldConfidence, creditPoints: creditPointsConfidence, coordinator: coordinatorConfidence },
  };
}

export const unimelbExtractor: InstitutionExtractor = {
  institutionId: "unimelb",
  enhance,
};
