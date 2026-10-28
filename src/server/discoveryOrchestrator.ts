/**
 * Server-side discovery orchestration (Phase 18C, Part 8). For each
 * requested subject: try verified direct URL templates first, then a
 * search adapter, rank/fetch a bounded set, extract via the EXISTING
 * deterministic engine (`parseSyllabusText` — the same one every Phase 18A
 * document provider and the Phase 18B browser provider use), compare
 * academic year, and report a quality result. One failed subject never
 * destroys another's result — every subject is handled in its own
 * try/catch and contributes to `queryResults` independently.
 */

import { htmlToPlainText } from "../import/extraction/htmlText";
import { parseSyllabusText } from "../import/extraction/syllabusParser";
import { getInstitutionExtractor } from "../import/extraction/institutions/registry";
import type { ImportConflict, ImportedSourcePackage, ImportWarning, ImportWarningKind } from "../import/types";
import { findUniversity, buildUniversityUrl, type UniversityDefinition } from "../import/universityRegistry";
import { serverFetchOfficialPage } from "./security/serverFetch";
import { createSitemapSearchAdapter } from "./search/sitemapAdapter";
import { createExternalSearchApiAdapter } from "./search/externalApiAdapter";
import type { AcademicSearchAdapter, SearchResult } from "./search/types";
import { AMBIGUITY_SCORE_GAP } from "./search/ranking";
import { detectAcademicYear } from "./search/yearDetection";
import { detectTeachingPeriod } from "./search/teachingPeriod";
import { computeQualityScore } from "./qualityScore";
import type { DiscoverRequest, DiscoveredSource, QueryResult, SubjectQuery } from "./schema";
import { DiscoveryError } from "./errors";
import { sha256Hex } from "./contentHash";
import { PageCache } from "./pageCache";

const SEARCH_ADAPTERS: AcademicSearchAdapter[] = [createSitemapSearchAdapter(findUniversity), createExternalSearchApiAdapter()];

// Phase 18D, Part 14 — fetched-page cache shared across every single-URL
// fetch this orchestrator makes directly (direct-template + the Ambiguity
// Review "select"/"search again" preferredUrl path). The sitemap search
// adapter fetches its own shortlist independently and isn't wired to this
// instance — its candidates are typically fetched once per unique request
// rather than repeatedly re-requested the way a retry/select action is.
const pageCache = new PageCache();

interface CachedFetchResult {
  ok: boolean;
  finalUrl: string;
  text: string | null;
  error: string | null;
  stale: boolean;
}

/** Wraps `serverFetchOfficialPage` with the page cache: a live cache hit skips the network entirely; a fresh-fetch failure falls back to a stale cached copy (within its grace window) rather than failing outright — the caller must surface `stale` honestly, never silently. */
async function fetchPageCached(
  url: string,
  officialDomains: string[],
  institutionId: string,
  academicYear: string
): Promise<CachedFetchResult> {
  const cached = pageCache.get(url);
  if (cached) {
    return { ok: true, finalUrl: url, text: cached.html, error: null, stale: false };
  }

  const result = await serverFetchOfficialPage(url, officialDomains);
  if (result.ok && result.text) {
    const contentHash = await sha256Hex(result.text);
    pageCache.set(result.finalUrl, { html: result.text, contentHash, canonicalUrl: null, institutionId, academicYear, sourceRetrievedAt: Date.now() });
    return { ok: true, finalUrl: result.finalUrl, text: result.text, error: null, stale: false };
  }

  const stale = pageCache.getStale(url);
  if (stale) {
    return { ok: true, finalUrl: url, text: stale.entry.html, error: null, stale: stale.stale };
  }
  return { ok: false, finalUrl: url, text: null, error: result.error, stale: false };
}

let warningCounter = 0;
function warn(kind: ImportWarningKind, message: string, sourceId: string): ImportWarning {
  warningCounter += 1;
  return { id: `backend-warn-${warningCounter}`, kind, message, sourceId };
}

let orchestratorConflictCounter = 0;
function nextOrchestratorConflictId(): string {
  orchestratorConflictCounter += 1;
  return `orch-conflict-${orchestratorConflictCounter}`;
}

interface FetchedPage {
  url: string;
  text: string;
  discoveryMethod: DiscoveredSource["discoveryMethod"];
  sourceType: DiscoveredSource["sourceType"];
  confidence: DiscoveredSource["confidence"];
}

const DIRECT_TEMPLATE_STEPS: Array<{ key: keyof UniversityDefinition; sourceType: DiscoveredSource["sourceType"] }> = [
  { key: "handbookUrlTemplate", sourceType: "handbook" },
  { key: "subjectGuideUrlTemplate", sourceType: "subject-guide" },
  { key: "timetableUrlTemplate", sourceType: "timetable" },
  { key: "assessmentUrlTemplate", sourceType: "assessment" },
  { key: "calendarUrlTemplate", sourceType: "calendar" },
];

async function fetchViaDirectTemplates(
  university: UniversityDefinition,
  code: string,
  sourceId: string,
  academicYear: string,
  warnings: ImportWarning[]
): Promise<FetchedPage[]> {
  const pages: FetchedPage[] = [];
  for (const step of DIRECT_TEMPLATE_STEPS) {
    const template = university[step.key];
    if (typeof template !== "string") continue;
    const url = buildUniversityUrl(template, code, university.codeCase);
    const result = await fetchPageCached(url, university.officialDomains, university.id, academicYear);
    if (result.ok && result.text) {
      if (result.stale) {
        warnings.push(warn("source-unreachable", `${university.name}'s ${step.sourceType} page for ${code} couldn't be re-verified just now — showing the last cached copy instead.`, sourceId));
      }
      pages.push({ url: result.finalUrl, text: result.text, discoveryMethod: "direct-template", sourceType: step.sourceType, confidence: "high" });
    } else {
      warnings.push(
        warn(
          result.error?.includes("robots") ? "robots-disallowed" : "source-unreachable",
          `Couldn't reach ${university.name}'s ${step.sourceType} page for ${code} (${result.error}).`,
          sourceId
        )
      );
    }
  }
  return pages;
}

interface SearchAdapterOutcome {
  pages: FetchedPage[];
  candidates: SearchResult[];
  ambiguous: boolean;
}

async function fetchViaSearchAdapters(
  university: UniversityDefinition,
  query: SubjectQuery,
  academicYear: string,
  teachingPeriod: string | null,
  degree: string | null,
  major: string | null,
  sourceId: string,
  warnings: ImportWarning[]
): Promise<SearchAdapterOutcome> {
  for (const adapter of SEARCH_ADAPTERS) {
    if (!adapter.isConfigured() || !adapter.supportsInstitution(university.id)) continue;
    const candidates = await adapter.search(
      {
        institutionId: university.id,
        subjectCode: query.code,
        subjectName: query.name,
        academicYear,
        teachingPeriod,
        degree,
        major,
        campus: null,
        resultLimit: 5,
      },
      {}
    );
    if (candidates.length === 0) continue;

    // Ambiguity (Phase 18D, Part 5/11): the top two candidates are within
    // the ranking engine's own gap threshold — never silently pick one.
    const ambiguous = candidates.length >= 2 && candidates[0].preliminaryScore - candidates[1].preliminaryScore < AMBIGUITY_SCORE_GAP;
    if (ambiguous) {
      warnings.push(
        warn(
          "ambiguous-match",
          `Found ${candidates.length} similarly-ranked official pages for ${query.code ?? query.name} — the top candidate was used for extraction, but review the alternatives listed as sources.`,
          sourceId
        )
      );
    }

    return {
      pages: candidates.map((c) => ({
        url: c.url,
        text: c.fetchedHtml,
        discoveryMethod: c.discoveryMethod,
        sourceType: c.sourceType,
        confidence: c.confidence,
      })),
      candidates,
      ambiguous,
    };
  }
  return { pages: [], candidates: [], ambiguous: false };
}

function detectStaleYearWarning(text: string, requestedYear: string, sourceId: string): ImportWarning | null {
  const match = /not\s+available\s+in\s+(\d{4})/i.exec(text);
  if (match && match[1] === requestedYear) {
    return warn("stale-academic-year", `This page says the subject is not available in ${requestedYear} — double-check before relying on it.`, sourceId);
  }
  return null;
}

function looksJsRendered(text: string, university: UniversityDefinition): boolean {
  const meaningful = htmlToPlainText(text).replace(/\s+/g, "");
  return meaningful.length < 200 && university.knownJsRenderedSections.length > 0;
}

export interface SubjectDiscoveryOutcome {
  queryResult: QueryResult;
  discoveredSources: DiscoveredSource[];
  sourcePackage: ImportedSourcePackage | null;
}

export async function discoverOneSubject(
  university: UniversityDefinition,
  query: SubjectQuery,
  academicYear: string,
  sourceId: string,
  teachingPeriod: string | null = null,
  degree: string | null = null,
  major: string | null = null
): Promise<SubjectDiscoveryOutcome> {
  const warnings: ImportWarning[] = [];
  const looksLikeCode = query.code ? university.subjectCodePattern.test(query.code.toUpperCase()) : false;

  let pages: FetchedPage[] = [];
  let isAmbiguous = false;
  let alternativePages: FetchedPage[] = [];

  // Ambiguity Review "select" action (Phase 18D, Part 11): the browser only
  // ever echoes back a URL it already received in a PRIOR response's
  // discoveredSources/alternativeCandidates — never one of its own
  // construction — but it still passes through the exact same domain-
  // allowlist + SSRF guard as every other candidate (serverFetchOfficialPage),
  // so this is not a "fetch any URL the browser sends" backdoor.
  if (query.preferredUrl) {
    const result = await fetchPageCached(query.preferredUrl, university.officialDomains, university.id, academicYear);
    if (result.ok && result.text) {
      if (result.stale) {
        warnings.push(warn("source-unreachable", `Couldn't re-verify the page you selected just now — showing the last cached copy instead.`, sourceId));
      }
      pages = [{ url: result.finalUrl, text: result.text, discoveryMethod: "user-selected", sourceType: "handbook", confidence: "high" }];
    } else {
      warnings.push(warn("source-unreachable", `Couldn't reach the page you selected (${result.error}).`, sourceId));
    }
  }
  if (pages.length === 0 && looksLikeCode && query.code) {
    pages = await fetchViaDirectTemplates(university, query.code.toUpperCase(), sourceId, academicYear, warnings);
  }
  if (pages.length === 0) {
    const searchOutcome = await fetchViaSearchAdapters(university, query, academicYear, teachingPeriod, degree, major, sourceId, warnings);
    // Search-adapter results are ALTERNATIVE candidate pages (which page is
    // the right one?), unlike direct-template pages (handbook + assessment
    // sub-pages of the SAME subject, joined together below) — only the
    // top-ranked candidate is ever extracted from; the rest are recorded as
    // alternatives for the Ambiguity Review step, never blended in.
    pages = searchOutcome.pages.slice(0, 1);
    alternativePages = searchOutcome.pages.slice(1);
    isAmbiguous = searchOutcome.ambiguous;
  }

  if (pages.length === 0) {
    return {
      queryResult: { query, status: "not-found", discoveredSources: [], alternativeCandidates: [], quality: null, warnings },
      discoveredSources: [],
      sourcePackage: null,
    };
  }

  const discoveredSources: DiscoveredSource[] = [];
  let joined = "";
  const boundaries: Array<{ start: number; url: string }> = [];
  const fetchedAt = new Date().toISOString();
  const seenContentHashes = new Map<string, string>(); // contentHash -> the first URL that had it

  for (const page of pages) {
    const plainText = htmlToPlainText(page.text);
    const contentHash = await sha256Hex(plainText);
    const duplicateOfUrl = seenContentHashes.get(contentHash) ?? null;

    const staleWarning = detectStaleYearWarning(plainText, academicYear, sourceId);
    if (staleWarning) warnings.push(staleWarning);

    let officialDomain = "";
    try {
      officialDomain = new URL(page.url).hostname;
    } catch {
      officialDomain = "";
    }

    const titleMatch = /<title>([^<]*)<\/title>/i.exec(page.text);
    const sourceWarnings: string[] = [];
    if (looksJsRendered(page.text, university)) {
      sourceWarnings.push(`Official page found, but its academic content requires client-side rendering — try uploading ${query.code ?? "this subject"}'s guide instead.`);
    }
    if (duplicateOfUrl) {
      sourceWarnings.push(`Identical content to ${duplicateOfUrl} — not extracted twice.`);
    }

    discoveredSources.push({
      finalUrl: page.url,
      pageTitle: titleMatch ? titleMatch[1].trim() : null,
      sourceType: page.sourceType,
      officialDomain,
      fetchedAt,
      contentHash,
      confidence: page.confidence,
      discoveryMethod: page.discoveryMethod,
      warnings: sourceWarnings,
    });

    if (looksJsRendered(page.text, university)) {
      warnings.push(warn("js-rendered-page", `${university.name}'s page for ${query.code ?? query.name} needs client-side rendering — very little text could be read directly.`, sourceId));
    }

    // Duplicate content under two URLs (Part 6/12): extract it once, not twice.
    if (duplicateOfUrl) continue;
    seenContentHashes.set(contentHash, page.url);

    boundaries.push({ start: joined.length, url: page.url });
    joined += `${plainText}\n\n`;
  }

  const locate = (index: number): string | null => {
    let current = boundaries[0] ?? null;
    for (const boundary of boundaries) {
      if (boundary.start <= index) current = boundary;
      else break;
    }
    return current ? current.url : null;
  };

  const { subject: parsedSubject, warnings: parseWarnings } = parseSyllabusText(joined, {
    sourceId,
    filename: `${university.name} — ${query.code ?? query.name ?? "subject"}`,
    contextYear: /^\d{4}$/.test(academicYear) ? Number(academicYear) : null,
    locate,
  });

  // Institution-specific enhancement (Phase 18D, Part 9) — runs strictly
  // AFTER general extraction and only ever fills a field it left null; a
  // failure here must never take down discovery for this subject.
  let subject = parsedSubject;
  const institutionExtractor = getInstitutionExtractor(university.id);
  if (institutionExtractor) {
    try {
      subject = institutionExtractor.enhance(parsedSubject, joined, sourceId, `${university.name} — ${query.code ?? query.name ?? "subject"}`);
    } catch {
      subject = parsedSubject;
    }
  }

  const allWarnings = [...warnings, ...parseWarnings];
  const baseStatus: QueryResult["status"] =
    subject.confidence === "missing" ? "not-found" : subject.modules.length === 0 && subject.assessments.length === 0 ? "partial" : "found";
  // Ambiguity overrides found/partial (never "not-found" — we DID get a
  // usable top candidate) so the frontend knows to offer candidate
  // selection before Review, per Part 11.
  const status: QueryResult["status"] = isAmbiguous && baseStatus !== "not-found" ? "ambiguous" : baseStatus;

  const alternativeCandidates: DiscoveredSource[] = alternativePages.map((page) => {
    let officialDomain = "";
    try {
      officialDomain = new URL(page.url).hostname;
    } catch {
      officialDomain = "";
    }
    const titleMatch = /<title>([^<]*)<\/title>/i.exec(page.text);
    return {
      finalUrl: page.url,
      pageTitle: titleMatch ? titleMatch[1].trim() : null,
      sourceType: page.sourceType,
      officialDomain,
      fetchedAt: new Date().toISOString(),
      contentHash: "",
      confidence: page.confidence,
      discoveryMethod: page.discoveryMethod,
      warnings: ["Not the selected candidate — shown for comparison only, never extracted from automatically."],
    };
  });

  const yearResult = detectAcademicYear(joined, discoveredSources[0]?.finalUrl ?? "", discoveredSources[0]?.pageTitle ?? null, academicYear);
  const periodResult = detectTeachingPeriod(joined, teachingPeriod, university);
  const quality = computeQualityScore(subject, yearResult, periodResult, discoveredSources[0]?.discoveryMethod ?? null, academicYear);

  // Conflicting year signals within this subject's OWN fetched pages (e.g. a
  // handbook page mentions both last year's and this year's dates) mean we
  // can't tell which year's assessment structure was actually extracted —
  // material enough to block Apply, not just a quality-report footnote.
  const sourceConflicts: ImportConflict[] =
    yearResult.classification === "conflicting"
      ? [
          {
            id: nextOrchestratorConflictId(),
            kind: "conflicting-handbook-versions",
            summary: `"${subject.name}" shows conflicting academic-year signals (${yearResult.detectedYears.join(", ")}) across its source pages — the extracted assessments may belong to more than one handbook version.`,
            candidateIds: [subject.temporaryId],
            options: yearResult.detectedYears.map((year) => ({
              label: String(year),
              value: String(year),
              sourceReferences: subject.sourceReferences,
            })),
            resolution: null,
          },
        ]
      : [];

  const sourcePackage: ImportedSourcePackage = {
    providerId: "backend-discovery",
    subjects: [subject],
    calendarEvents: [],
    warnings: allWarnings,
    conflicts: sourceConflicts,
  };

  return {
    queryResult: { query, status, discoveredSources, alternativeCandidates, quality, warnings: allWarnings },
    discoveredSources,
    sourcePackage,
  };
}

export interface OrchestratorOutcome {
  institution: string;
  queryResults: QueryResult[];
  discoveredSources: DiscoveredSource[];
  sourcePackages: ImportedSourcePackage[];
  perSubjectMs: Record<string, number>;
}

/** One failed subject never destroys another subject's result — each is isolated in its own try/catch. */
export async function discoverSubjects(request: DiscoverRequest, requestIdPrefix: string): Promise<OrchestratorOutcome> {
  const university = findUniversity(request.institutionId);
  if (!university) {
    throw new DiscoveryError("unsupported-institution", `"${request.institutionId}" isn't in the registry.`);
  }

  const queryResults: QueryResult[] = [];
  const discoveredSources: DiscoveredSource[] = [];
  const sourcePackages: ImportedSourcePackage[] = [];
  const perSubjectMs: Record<string, number> = {};

  for (let i = 0; i < request.subjectQueries.length; i += 1) {
    const query = request.subjectQueries[i];
    const key = query.code ?? query.name ?? `query-${i}`;
    const sourceId = `${requestIdPrefix}-${i}`;
    const start = Date.now();
    try {
      const outcome = await discoverOneSubject(
        university,
        query,
        request.academicYear,
        sourceId,
        request.teachingPeriod,
        request.degree,
        request.major
      );
      queryResults.push(outcome.queryResult);
      discoveredSources.push(...outcome.discoveredSources);
      if (outcome.sourcePackage) sourcePackages.push(outcome.sourcePackage);
    } catch (error) {
      const message = error instanceof DiscoveryError ? error.message : "Something went wrong discovering this subject.";
      queryResults.push({
        query,
        status: "error",
        discoveredSources: [],
        alternativeCandidates: [],
        quality: null,
        warnings: [warn("source-unreachable", message, sourceId)],
      });
    }
    perSubjectMs[key] = Date.now() - start;
  }

  return { institution: university.name, queryResults, discoveredSources, sourcePackages, perSubjectMs };
}
