/**
 * Selects an institution-specific extractor by institution id (Phase 18D,
 * Part 9). An institution with no extractor here simply gets none — general
 * extraction (`parseSyllabusText`) already ran and is the complete result;
 * this is an enhancement layer, never a requirement.
 */

import type { InstitutionExtractor } from "./types";
import { unimelbExtractor } from "./unimelb";

const INSTITUTION_EXTRACTORS: Record<string, InstitutionExtractor> = {
  [unimelbExtractor.institutionId]: unimelbExtractor,
};

export function getInstitutionExtractor(institutionId: string): InstitutionExtractor | null {
  return INSTITUTION_EXTRACTORS[institutionId] ?? null;
}
