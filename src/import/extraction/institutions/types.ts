/**
 * Institution-specific extractor contract (Phase 18D, Part 9). An institution
 * extractor NEVER replaces the general deterministic engine
 * (`parseSyllabusText`) — it runs strictly AFTER it, over the same plain text
 * and the subject it already produced, and may only ADD a field the general
 * engine left null. It must never overwrite an already-populated field, never
 * invent a value it can't point to a real excerpt for, and never throw: a
 * page whose HTML changed slightly should just leave the gap it can't fill,
 * not break discovery for that subject.
 */

import type { ImportedSubjectCandidate } from "../../types";

export interface InstitutionExtractor {
  readonly institutionId: string;
  /** Pure function: given the subject the general engine already built and the same plain text it read, returns a subject with zero or more previously-null fields filled in, each with a real source excerpt and `fieldConfidence` set. Never mutates its input. */
  enhance(subject: ImportedSubjectCandidate, plainText: string, sourceId: string, filename: string): ImportedSubjectCandidate;
}
