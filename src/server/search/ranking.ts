/**
 * Deterministic, explainable candidate-ranking engine (Phase 18D, Part 5).
 * Every score is a sum of named, fixed-weight signals — no opaque AI
 * ranking, and every signal that contributed is retained on the result so
 * the Ambiguity Review step (Part 11) can show the user exactly why a page
 * ranked where it did.
 *
 * Hard rules encoded here directly (see docs/PHASE_18D_ACADEMIC_SEARCH_INTELLIGENCE.md):
 *  - A path-ranking-hint match is a small BOOST only, never large enough to
 *    qualify a candidate by itself (this is the generalised fix for the
 *    real bug Phase 18C found in the sitemap adapter — see WEIGHTS below).
 *  - An exact subject-code MISMATCH is penalised more heavily than any
 *    positive signal can offset.
 *  - A stale-year page can never outscore a same-or-better-year page by
 *    virtue of any other signal — the stale penalty alone exceeds every
 *    positive signal's combined maximum.
 */

import type { UniversityDefinition } from "../../import/universityRegistry";
import { detectAcademicYear, type YearDetectionResult } from "./yearDetection";
import { detectTeachingPeriod, type TeachingPeriodResult } from "./teachingPeriod";

export interface RankingInput {
  url: string;
  pageTitle: string | null;
  pageText: string;
  university: UniversityDefinition;
  query: { code: string | null; name: string | null };
  requestedYear: string;
  requestedTeachingPeriod: string | null;
  requestedDegree: string | null;
  requestedMajor: string | null;
}

export interface RankingSignal {
  name: string;
  weight: number;
  detail: string;
}

export interface RankingResult {
  score: number;
  signals: RankingSignal[];
  yearResult: YearDetectionResult;
  periodResult: TeachingPeriodResult;
}

export const WEIGHTS = {
  exactCodeInPath: 50,
  exactCodeInTitle: 20,
  exactNameMatch: 45,
  nameTokenOverlapPerWord: 4,
  nameTokenOverlapCap: 20,
  yearExact: 15,
  yearFuture: 3,
  yearStale: -60,
  yearConflicting: -20,
  periodExact: 10,
  periodAlias: 8,
  periodConflicting: -25,
  periodMultipleOffered: -4,
  preferredDomain: 3,
  pathHint: 2, // deliberately small — a boost only, never a qualifying signal by itself
  structuredMetadataPresent: 8,
  degreeOrMajorMatch: 4,
  recentlyVerifiedRegistry: 3,
  archivePath: -70,
  marketingPath: -30,
  excludedSubdomain: -200, // should never even reach here, but a hard safety net
  jsShellPage: -15,
  emptyContent: -80,
  codeMismatch: -100,
  unavailablePage: -60,
} as const;

/** A candidate needs at least this much to be considered a real match at all — keeps a lone small boost (e.g. a bare path hint) from ever qualifying. */
export const MINIMUM_QUALIFYING_SCORE = 15;
/** If the top two candidates' scores are within this gap, the result is ambiguous — never silently picked. */
export const AMBIGUITY_SCORE_GAP = 10;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function looksLikeSearchResultsPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().includes("/search") || parsed.searchParams.has("q") || parsed.searchParams.has("query");
  } catch {
    return false;
  }
}

export function scoreCandidate(input: RankingInput): RankingResult {
  const signals: RankingSignal[] = [];
  const add = (name: string, weight: number, detail: string) => {
    if (weight !== 0) signals.push({ name, weight, detail });
  };

  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(input.url);
    hostname = parsed.hostname;
    pathname = parsed.pathname;
  } catch {
    // leave blank — structural checks below simply won't match
  }

  if (input.university.excludedSubdomains.includes(hostname)) {
    add("excluded-subdomain", WEIGHTS.excludedSubdomain, `${hostname} is an explicitly excluded subdomain for this institution`);
  }

  // Text-dependent signals are skipped entirely (not scored as "empty") when
  // no page text was supplied — this lets the SAME function serve as both a
  // cheap, URL-only pre-filter (before fetching anything) and the full
  // post-fetch score, without the pre-filter pass looking like every
  // candidate has "empty content".
  const hasPageText = input.pageText.length > 0;
  const meaningfulLength = input.pageText.replace(/\s+/g, "").length;
  if (hasPageText && meaningfulLength < 100) {
    add("empty-content", WEIGHTS.emptyContent, "very little readable text was found on this page");
  }

  const looksJsRendered = hasPageText && meaningfulLength < 300 && input.university.knownJsRenderedSections.length > 0;
  if (looksJsRendered) {
    add("js-shell-page", WEIGHTS.jsShellPage, "this page's academic content likely requires client-side rendering");
  }

  if (looksLikeSearchResultsPage(input.url)) {
    add("search-results-page", -30, "this URL looks like a search-results listing, not a subject page");
  }

  const codeNorm = input.query.code ? normalize(input.query.code) : null;
  const pathNorm = normalize(decodeURIComponent(pathname));
  const titleNorm = input.pageTitle ? normalize(input.pageTitle) : "";

  if (codeNorm) {
    if (pathNorm.includes(codeNorm)) {
      add("exact-code-in-path", WEIGHTS.exactCodeInPath, `"${input.query.code}" appears in the page URL`);
    } else if (titleNorm.includes(codeNorm)) {
      add("exact-code-in-title", WEIGHTS.exactCodeInTitle, `"${input.query.code}" appears in the page title`);
    } else {
      // A DIFFERENT code appearing prominently where this one was expected is a real mismatch signal.
      const otherCodeInTitle = input.university.subjectCodePattern.source.length > 0 && /\b[A-Z]{2,5}\d{3,5}[A-Z]{0,2}\b/.exec(input.pageTitle ?? "");
      if (otherCodeInTitle && normalize(otherCodeInTitle[0]) !== codeNorm) {
        add("code-mismatch", WEIGHTS.codeMismatch, `the page identifies itself as "${otherCodeInTitle[0]}", not "${input.query.code}"`);
      }
    }
  }

  if (input.query.name) {
    const nameNorm = normalize(input.query.name);
    if (titleNorm === nameNorm || pathNorm.includes(nameNorm)) {
      add("exact-name-match", WEIGHTS.exactNameMatch, `"${input.query.name}" matches the page title or URL exactly (normalised)`);
    } else {
      const queryWords = nameNorm.split(" ").filter((w) => w.length > 3);
      const matchedWords = queryWords.filter((w) => titleNorm.includes(w) || pathNorm.includes(w));
      if (matchedWords.length > 0) {
        const overlapWeight = Math.min(matchedWords.length * WEIGHTS.nameTokenOverlapPerWord, WEIGHTS.nameTokenOverlapCap);
        add("name-token-overlap", overlapWeight, `${matchedWords.length} of ${queryWords.length} name words matched (${matchedWords.join(", ")})`);
      }
    }
  }

  const yearResult = detectAcademicYear(input.pageText, input.url, input.pageTitle, input.requestedYear);
  if (yearResult.classification === "exact") add("year-exact", WEIGHTS.yearExact, `page confirms academic year ${input.requestedYear}`);
  else if (yearResult.classification === "future") add("year-future", WEIGHTS.yearFuture, "page appears to be a next-year handbook, published early");
  else if (yearResult.classification === "stale") add("year-stale", WEIGHTS.yearStale, "page appears to be for an earlier academic year");
  else if (yearResult.classification === "conflicting") add("year-conflicting", WEIGHTS.yearConflicting, "page shows more than one distinct academic year");

  const periodResult = detectTeachingPeriod(input.pageText, input.requestedTeachingPeriod, input.university);
  if (periodResult.classification === "exact") add("period-exact", WEIGHTS.periodExact, `page confirms ${input.requestedTeachingPeriod}`);
  else if (periodResult.classification === "alias") add("period-alias", WEIGHTS.periodAlias, `page uses a known alias for ${input.requestedTeachingPeriod}`);
  else if (periodResult.classification === "conflicting") add("period-conflicting", WEIGHTS.periodConflicting, periodResult.evidence.at(-1) ?? "teaching period mismatch");
  else if (periodResult.classification === "multiple-offered") add("period-multiple-offered", WEIGHTS.periodMultipleOffered, `subject appears offered in multiple periods: ${periodResult.matchedPeriods.join(", ")}`);

  if (input.university.preferredDomains.includes(hostname)) {
    add("preferred-domain", WEIGHTS.preferredDomain, `${hostname} is this institution's preferred domain`);
  }

  const hintHit = input.university.pathRankingHints.find((hint) => pathname.toLowerCase().includes(hint.toLowerCase()));
  if (hintHit) add("path-hint", WEIGHTS.pathHint, `URL path contains "${hintHit}", typical of a handbook page`);

  const archiveHit = input.university.archivePathPatterns.find((p) => pathname.toLowerCase().includes(p.toLowerCase()) || input.url.toLowerCase().includes(p.toLowerCase()));
  if (archiveHit) add("archive-path", WEIGHTS.archivePath, `URL matches a known archived-handbook pattern ("${archiveHit}")`);

  const marketingHit = input.university.marketingPathPatterns.find((p) => pathname.toLowerCase().includes(p.toLowerCase()));
  if (marketingHit) add("marketing-path", WEIGHTS.marketingPath, `URL matches a known marketing/overview-page pattern ("${marketingHit}")`);

  if (/application\/ld\+json/i.test(input.pageText) || /<table[^>]*>/i.test(input.pageText)) {
    add("structured-metadata", WEIGHTS.structuredMetadataPresent, "page contains structured data (JSON-LD or a table) rather than plain prose only");
  }

  if (input.requestedDegree && normalize(input.pageText).includes(normalize(input.requestedDegree))) {
    add("degree-match", WEIGHTS.degreeOrMajorMatch, `page mentions the degree "${input.requestedDegree}"`);
  }
  if (input.requestedMajor && normalize(input.pageText).includes(normalize(input.requestedMajor))) {
    add("major-match", WEIGHTS.degreeOrMajorMatch, `page mentions the major "${input.requestedMajor}"`);
  }

  if (input.university.verified) {
    add("recently-verified-registry", WEIGHTS.recentlyVerifiedRegistry, "this institution's discovery pattern was recently verified against a real page");
  }

  if (/not\s+available\s+in\s+\d{4}/i.test(input.pageText)) {
    add("marked-unavailable", WEIGHTS.unavailablePage, "page explicitly states the subject is not available in a given year");
  }

  const score = signals.reduce((sum, s) => sum + s.weight, 0);
  return { score, signals, yearResult, periodResult };
}

export function isQualifyingCandidate(result: RankingResult): boolean {
  return result.score >= MINIMUM_QUALIFYING_SCORE;
}

export interface RankedSet<T> {
  ranked: Array<{ item: T; result: RankingResult }>;
  ambiguous: boolean;
}

/** Ranks a set of candidates, sorts descending by score, and flags ambiguity when the top two are within AMBIGUITY_SCORE_GAP of each other. */
export function rankCandidates<T>(items: T[], score: (item: T) => RankingResult): RankedSet<T> {
  const ranked = items
    .map((item) => ({ item, result: score(item) }))
    .filter(({ result }) => isQualifyingCandidate(result))
    .sort((a, b) => b.result.score - a.result.score);

  const ambiguous = ranked.length >= 2 && ranked[0].result.score - ranked[1].result.score < AMBIGUITY_SCORE_GAP;
  return { ranked, ambiguous };
}
