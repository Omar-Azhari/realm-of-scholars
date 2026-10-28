/**
 * Request/response schema for POST /api/academic/discover (Phase 18C,
 * Part 2), plus a hand-written runtime validator. TypeScript types are
 * erased at build time and prove nothing about what the browser actually
 * sends — every field here is checked at runtime, unknown fields are
 * rejected outright, and every string/array is length-capped before it
 * touches anything else in the pipeline.
 *
 * No validation library (e.g. zod) was added for this — the validated
 * surface is one small, mostly-flat request shape, and a hand-written
 * allow-list validator keeps the dependency footprint at zero while still
 * being exhaustive. See docs/PHASE_18C_DISCOVERY_BACKEND.md §4.
 */

import type { AcademicImportPackage, ConfidenceLevel, ImportWarning } from "../import/types";
import type { QualityResult } from "./qualityScore";

export interface SubjectQuery {
  code: string | null;
  name: string | null;
  /**
   * Phase 18D, Part 11 ("select" action on the Ambiguity Review step). When
   * set, the orchestrator fetches AND extracts from this exact URL instead
   * of running search/ranking — but it is NOT treated as an arbitrary
   * browser-supplied URL: it still passes through the same domain-allowlist
   * and SSRF guard (`serverFetchOfficialPage`) as every other candidate, and
   * the browser is only ever expected to echo back a `finalUrl` it already
   * received from a PRIOR response's `discoveredSources`/`alternativeCandidates`
   * — never a URL of its own construction.
   */
  preferredUrl: string | null;
}

export interface DiscoverRequest {
  institutionId: string;
  subjectQueries: SubjectQuery[];
  degree: string | null;
  major: string | null;
  academicYear: string;
  teachingPeriod: string | null;
  campus: string | null;
  locale: string | null;
}

export type DiscoveryMethod = "direct-template" | "sitemap" | "search-adapter" | "native-search" | "registry-known-page" | "user-selected";
export type SourceType = "handbook" | "subject-guide" | "timetable" | "assessment" | "calendar" | "search-result";
export type CacheStatus = "hit" | "revalidated" | "live" | "stale-fallback";

export interface DiscoveredSource {
  finalUrl: string;
  pageTitle: string | null;
  sourceType: SourceType;
  officialDomain: string;
  fetchedAt: string;
  contentHash: string;
  confidence: ConfidenceLevel;
  discoveryMethod: DiscoveryMethod;
  warnings: string[];
}

export interface QueryResult {
  query: SubjectQuery;
  status: "found" | "partial" | "ambiguous" | "not-found" | "error";
  discoveredSources: DiscoveredSource[];
  /** Populated only when status is "ambiguous" (Phase 18D, Part 11) — the top-ranked candidate was still used for the default extraction, but these alternatives must be shown before Review, never silently discarded. */
  alternativeCandidates: DiscoveredSource[];
  /** Transparent, multi-dimensional quality report (Phase 18D, Part 10) — null only when status is "not-found"/"error" (nothing to score). */
  quality: QualityResult | null;
  warnings: ImportWarning[];
}

export interface DiscoverResponse {
  requestId: string;
  institution: string;
  queryResults: QueryResult[];
  discoveredSources: DiscoveredSource[];
  package: AcademicImportPackage;
  warnings: ImportWarning[];
  errors: Array<{ category: string; message: string }>;
  timing: { totalMs: number; perSubjectMs: Record<string, number> };
  cacheStatus: CacheStatus;
}

const MAX_QUERIES = 10;
const MAX_STRING_LENGTH = 200;
const KNOWN_REQUEST_FIELDS = new Set([
  "institutionId",
  "subjectQueries",
  "degree",
  "major",
  "academicYear",
  "teachingPeriod",
  "campus",
  "locale",
]);
const KNOWN_QUERY_FIELDS = new Set(["code", "name", "preferredUrl"]);
const MAX_URL_LENGTH = 500;

export interface ValidationResult {
  ok: boolean;
  value: DiscoverRequest | null;
  error: string | null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Drops ASCII control characters (code point below 32, plus DEL at 127) by comparing code points one at a time — safer to author than a control-character regex literal. */
function stripControlCharacters(s: string): string {
  let result = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) result += ch;
  }
  return result;
}

function boundedString(v: unknown, maxLength = MAX_STRING_LENGTH): string | null {
  if (typeof v !== "string") return null;
  const cleaned = stripControlCharacters(v).trim();
  return cleaned.length === 0 ? null : cleaned.slice(0, maxLength);
}

/** Rejects unknown fields, wrong types, oversized arrays/strings — never trusts the TS type alone. */
export function validateDiscoverRequest(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, value: null, error: "Request body must be a JSON object." };
  }

  const unknownFields = Object.keys(body).filter((k) => !KNOWN_REQUEST_FIELDS.has(k));
  if (unknownFields.length > 0) {
    return { ok: false, value: null, error: `Unexpected field(s): ${unknownFields.join(", ")}` };
  }

  const institutionId = boundedString(body.institutionId, 50);
  if (!institutionId) {
    return { ok: false, value: null, error: "institutionId is required." };
  }

  if (!Array.isArray(body.subjectQueries) || body.subjectQueries.length === 0) {
    return { ok: false, value: null, error: "subjectQueries must be a non-empty array." };
  }
  if (body.subjectQueries.length > MAX_QUERIES) {
    return { ok: false, value: null, error: `subjectQueries exceeds the limit of ${MAX_QUERIES}.` };
  }

  const subjectQueries: SubjectQuery[] = [];
  for (const raw of body.subjectQueries) {
    if (!isPlainObject(raw)) {
      return { ok: false, value: null, error: "Each subjectQuery must be an object." };
    }
    const rawUnknown = Object.keys(raw).filter((k) => !KNOWN_QUERY_FIELDS.has(k));
    if (rawUnknown.length > 0) {
      return { ok: false, value: null, error: `Unexpected field(s) in subjectQuery: ${rawUnknown.join(", ")}` };
    }
    const code = boundedString(raw.code, 20);
    const name = boundedString(raw.name, 150);
    if (!code && !name) {
      return { ok: false, value: null, error: "Each subjectQuery needs a code or a name." };
    }
    const preferredUrlRaw = boundedString(raw.preferredUrl, MAX_URL_LENGTH);
    let preferredUrl: string | null = null;
    if (preferredUrlRaw) {
      try {
        const parsed = new URL(preferredUrlRaw);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return { ok: false, value: null, error: "preferredUrl must be an http(s) URL." };
        }
        preferredUrl = preferredUrlRaw;
      } catch {
        return { ok: false, value: null, error: "preferredUrl is not a well-formed URL." };
      }
    }
    subjectQueries.push({ code, name, preferredUrl });
  }

  const academicYear = boundedString(body.academicYear, 4);
  if (!academicYear || !/^\d{4}$/.test(academicYear)) {
    return { ok: false, value: null, error: "academicYear must be a 4-digit year." };
  }

  return {
    ok: true,
    error: null,
    value: {
      institutionId,
      subjectQueries,
      degree: boundedString(body.degree),
      major: boundedString(body.major),
      academicYear,
      teachingPeriod: boundedString(body.teachingPeriod),
      campus: boundedString(body.campus),
      locale: boundedString(body.locale, 20),
    },
  };
}
