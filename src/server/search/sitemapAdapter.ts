/**
 * Sitemap-based search adapter (Phase 18B/18C; reshaped to the formalised
 * `AcademicSearchAdapter` interface in Phase 18D). Real, wired, needs no
 * credential: crawls an institution's registered XML sitemap(s) — following
 * a sitemap INDEX into a bounded number of child sitemaps — then ranks in
 * TWO passes so it never fetches every result (Phase 18C, Part 8):
 *
 *  1. Cheap, URL-only pass using the shared `scoreCandidate` engine with no
 *     page text yet (its text-dependent signals are inert on empty text —
 *     see ranking.ts) — picks a small bounded shortlist.
 *  2. Fetches only that shortlist, then re-scores each with its real page
 *     text for the full, explainable signal set (code/name match, year,
 *     teaching period, structured data, JS-shell detection, etc).
 */

import { serverFetchOfficialPage } from "../security/serverFetch";
import type { UniversityDefinition } from "../../import/universityRegistry";
import { scoreCandidate, rankCandidates, type RankingInput } from "./ranking";
import type { AcademicSearchAdapter, SearchContext, SearchRequest, SearchResult } from "./types";

const MAX_CHILD_SITEMAPS = 3;
const MAX_URLS_COLLECTED = 3000;
const MAX_CANDIDATES_TO_FETCH = 5;

function extractLocEntries(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi);
  return [...matches].map((m) => m[1].trim());
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

async function collectSitemapUrls(locations: string[], officialDomains: string[]): Promise<string[]> {
  const collected: string[] = [];
  for (const location of locations) {
    if (collected.length >= MAX_URLS_COLLECTED) break;
    const result = await serverFetchOfficialPage(location, officialDomains);
    if (!result.ok || !result.text) continue;

    if (isSitemapIndex(result.text)) {
      const childSitemaps = extractLocEntries(result.text).slice(0, MAX_CHILD_SITEMAPS);
      for (const child of childSitemaps) {
        if (collected.length >= MAX_URLS_COLLECTED) break;
        const childResult = await serverFetchOfficialPage(child, officialDomains);
        if (childResult.ok && childResult.text) {
          collected.push(...extractLocEntries(childResult.text).slice(0, MAX_URLS_COLLECTED - collected.length));
        }
      }
    } else {
      collected.push(...extractLocEntries(result.text).slice(0, MAX_URLS_COLLECTED - collected.length));
    }
  }
  return collected;
}

function baseRankingInput(url: string, university: UniversityDefinition, request: SearchRequest, pageTitle: string | null, pageText: string): RankingInput {
  return {
    url,
    pageTitle,
    pageText,
    university,
    query: { code: request.subjectCode, name: request.subjectName },
    requestedYear: request.academicYear ?? new Date().getFullYear().toString(),
    requestedTeachingPeriod: request.teachingPeriod,
    requestedDegree: request.degree,
    requestedMajor: request.major,
  };
}

export function createSitemapSearchAdapter(findUniversity: (id: string) => UniversityDefinition | null): AcademicSearchAdapter {
  return {
    id: "sitemap-search",
    isConfigured: () => true,
    supportsInstitution: (institutionId) => {
      const university = findUniversity(institutionId);
      return (university?.sitemapLocations.length ?? 0) > 0;
    },
    async healthCheck() {
      return { ok: true, detail: null };
    },
    async search(request: SearchRequest, _context: SearchContext): Promise<SearchResult[]> {
      const university = findUniversity(request.institutionId);
      if (!university || university.sitemapLocations.length === 0) return [];

      const urls = await collectSitemapUrls(university.sitemapLocations, university.officialDomains);

      // Pass 1: cheap URL-only pre-filter (no fetch yet).
      const preFiltered = rankCandidates(urls, (url) => scoreCandidate(baseRankingInput(url, university, request, null, "")));
      const shortlist = preFiltered.ranked.slice(0, MAX_CANDIDATES_TO_FETCH).map((r) => r.item);

      // Pass 2: fetch only the shortlist, re-score with real page text.
      const fetched: Array<{ url: string; html: string; title: string | null }> = [];
      for (const url of shortlist) {
        const page = await serverFetchOfficialPage(url, university.officialDomains);
        if (!page.ok || !page.text) continue;
        const titleMatch = /<title>([^<]*)<\/title>/i.exec(page.text);
        fetched.push({ url: page.finalUrl, html: page.text, title: titleMatch ? titleMatch[1].trim() : null });
      }

      const final = rankCandidates(fetched, (f) => scoreCandidate(baseRankingInput(f.url, university, request, f.title, f.html)));

      return final.ranked.slice(0, request.resultLimit).map(({ item, result }) => ({
        url: item.url,
        canonicalUrl: null,
        title: item.title,
        snippet: null,
        detectedSubjectCode: request.subjectCode,
        detectedSubjectName: request.subjectName,
        detectedAcademicYear: result.yearResult.detectedYears[0]?.toString() ?? null,
        detectedTeachingPeriod: result.periodResult.matchedPeriods[0] ?? null,
        sourceType: "handbook",
        discoveryMethod: "sitemap",
        rankSignals: result.signals,
        preliminaryScore: result.score,
        confidence: result.score >= 60 ? "high" : result.score >= 30 ? "medium" : "low",
        warnings: [],
        fetchedHtml: item.html,
      }));
    },
  };
}
