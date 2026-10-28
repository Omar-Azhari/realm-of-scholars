/**
 * Formalised search adapter contract (Phase 18D, Part 2 — supersedes the
 * lighter Phase 18C `SearchAdapter`/`SearchCandidate` shape). Every adapter
 * returns CANDIDATES only — ranking (`ranking.ts`) and safe retrieval
 * (`security/serverFetch.ts`) live outside every adapter, so no adapter
 * duplicates retrieval, SSRF, or domain-validation logic. An adapter that
 * finds nothing returns an empty array — never a fabricated result.
 */

import type { ConfidenceLevel } from "../../import/types";
import type { RankingSignal } from "./ranking";
import type { DiscoveryMethod, SourceType } from "../schema";

export type { DiscoveryMethod, SourceType };

export interface SearchRequest {
  institutionId: string;
  subjectCode: string | null;
  subjectName: string | null;
  academicYear: string | null;
  teachingPeriod: string | null;
  degree: string | null;
  major: string | null;
  campus: string | null;
  resultLimit: number;
}

export interface SearchContext {
  signal?: AbortSignal;
}

export interface SearchResult {
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  snippet: string | null;
  detectedSubjectCode: string | null;
  detectedSubjectName: string | null;
  detectedAcademicYear: string | null;
  detectedTeachingPeriod: string | null;
  sourceType: SourceType;
  discoveryMethod: DiscoveryMethod;
  rankSignals: RankingSignal[];
  preliminaryScore: number;
  confidence: ConfidenceLevel;
  warnings: string[];
  /** Already-fetched page HTML, reused for extraction — never re-fetched (Phase 18C, Part 8: "Prevent duplicate requests"). */
  fetchedHtml: string;
}

export interface AcademicSearchAdapter {
  readonly id: string;
  isConfigured(): boolean;
  supportsInstitution(institutionId: string): boolean;
  search(request: SearchRequest, context: SearchContext): Promise<SearchResult[]>;
  healthCheck(): Promise<{ ok: boolean; detail: string | null }>;
}
