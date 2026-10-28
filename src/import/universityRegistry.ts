/**
 * University registry (Phase 18B, Part 2; extended to V2 in Phase 18C,
 * Part 5). Pure data — every entry describes one university's OFFICIAL
 * public handbook, never a mirror/forum/wiki/cache. `OfficialUniversityProvider`
 * (Phase 18B, browser-direct) and the Phase 18C server-side discovery
 * orchestrator both contain NO per-university branching; they only ever
 * read `officialDomains` (the hard fetch boundary) and substitute `{code}`
 * into these templates, or crawl a declared sitemap. A university with no
 * verified template/sitemap is still listed — Study Details can still
 * record the institution — but discovery reports "no direct link known yet"
 * rather than guessing one.
 *
 * `verified` + `verificationNote` + `researchDate` record what was actually
 * checked against the live site, and when (see
 * docs/PHASE_18B_UNIVERSITY_DISCOVERY.md and
 * docs/PHASE_18C_DISCOVERY_BACKEND.md for the full research logs):
 *   - Melbourne: real, working, static-HTML pages for both the subject
 *     overview and its assessment tab; a real native search endpoint.
 *   - Monash: the unit URL pattern is real and resolves, but assessment/
 *     description content is client-rendered — a plain fetch only ever sees
 *     the page shell. A real sitemap INDEX exists and was fetched
 *     successfully (Phase 18C).
 *   - RMIT: a real sitemap exists, but the sampled entries were marketing/
 *     blog content, not obviously the course catalogue — recorded honestly
 *     as an unconfirmed-coverage signal, not treated as a working discovery
 *     path.
 *   - La Trobe / Deakin: no verified direct code -> URL template or sitemap
 *     — both hosts refused or blocked an automated fetch during research —
 *     left `null`/`[]` rather than guessed.
 */

export type SourceType = "handbook" | "subject-guide" | "timetable" | "assessment" | "calendar";

export type SupportLevel = "verified" | "partial" | "unsupported";

/**
 * Per-institution support status (Phase 18D, Part 8). Deliberately separate
 * per capability — an institution can have a verified direct code search
 * while name search, year detection, etc. are still unsupported. Never mark
 * a capability "verified" without a genuine, current live check backing it.
 */
export interface InstitutionSupportStatus {
  codeSearchSupport: SupportLevel;
  nameSearchSupport: SupportLevel;
  yearDetectionSupport: SupportLevel;
  teachingPeriodSupport: SupportLevel;
  staticPageAvailability: SupportLevel;
  /** Free-text note on what specifically renders via client-side JS, if anything — null if nothing known to. */
  jsRenderedLimitations: string | null;
  verifiedSourceTypes: SourceType[];
  lastVerificationDate: string;
  /** Overall confidence, reusing the same vocabulary as extracted-field confidence for one shared mental model. */
  confidenceLevel: "confirmed" | "high" | "medium" | "low" | "missing";
}

export interface UniversityDefinition {
  id: string;
  name: string;
  /** Hostnames this provider is ever allowed to fetch from — the hard boundary against mirrors/forums/wikis. */
  officialDomains: string[];
  /** Subset of officialDomains to prefer when a search result matches more than one (e.g. handbook.* over www.*). */
  preferredDomains: string[];
  /** Subdomains that ARE part of the institution but must never be treated as an official handbook source (e.g. a student-union or alumni site on the same root domain). */
  excludedSubdomains: string[];
  /** How this university refers to a subject/guide/teaching-period — shown in copy, never used for parsing. */
  unitTerm: string;
  subjectGuideTerm: string;
  teachingPeriodTerm: string;
  teachingPeriodNames: string[];
  /** Validates a code LOOKS like this university's shape before it's ever put in a URL — never used to invent a code. */
  subjectCodePattern: RegExp;
  /**
   * `{code}` is substituted with the subject code (case handling per
   * `codeCase`). Null = no verified pattern yet. Order matches the Part 3
   * discovery pipeline: handbook, subject guide, timetable, assessment,
   * calendar — a null field is simply skipped, never guessed.
   */
  handbookUrlTemplate: string | null;
  subjectGuideUrlTemplate: string | null;
  timetableUrlTemplate: string | null;
  assessmentUrlTemplate: string | null;
  calendarUrlTemplate: string | null;
  codeCase: "as-entered" | "upper" | "lower";
  /** `{query}` substituted with the URL-encoded search term, for the institution's own on-site search (a page to fetch and parse links from, not a request-URL "search API"). */
  searchQueryTemplate: string | null;
  /** A real, publicly reachable on-site search page (no query template known, or the template above IS this page). */
  nativeSearchEndpoint: string | null;
  /** XML sitemap or sitemap-index URLs, crawled by the sitemap search adapter. */
  sitemapLocations: string[];
  /** Which SourceType a discovered page is assumed to be, ranked by how likely each URL path segment is to be that type — used only to prioritise fetch order, never to invent a page. */
  preferredSourceTypes: SourceType[];
  /** Path substrings that make a sitemap/search result more likely to be a genuine handbook/subject-guide page (vs. a marketing or blog page under the same domain). */
  pathRankingHints: string[];
  /** How this university encodes the academic year in a URL, if at all — e.g. "/{year}/subjects/{code}" — null if year-agnostic (always "current"). */
  yearUrlConvention: string | null;
  /** Known sections that render via client-side JS and will yield little/no text from a plain fetch — surfaced to the user rather than silently returning nothing. */
  knownJsRenderedSections: string[];
  /** Path substrings that mean "this is an OLD handbook edition" — a strong negative ranking signal, never silently treated as current. */
  archivePathPatterns: string[];
  /** Path substrings that mean "this is a marketing/course-overview page, not a subject-level handbook page" — a negative ranking signal. */
  marketingPathPatterns: string[];
  /** Suffixes to strip from a fetched page's <title> before comparing it to a search query (e.g. " - University Handbook"). */
  titleSuffixesToStrip: string[];
  /** Known alternate codes for the SAME subject at this institution (e.g. after a renumbering) — populated only from genuine evidence, empty otherwise. */
  subjectCodeAliases: Record<string, string>;
  /** This institution's own textual variants for one of its own `teachingPeriodNames` (e.g. an abbreviation seen in real page text) — never a cross-institution equivalence. */
  teachingPeriodAliases: Record<string, string[]>;
  supportStatus: InstitutionSupportStatus;
  verified: boolean;
  verificationNote: string;
  researchDate: string;
}

export const UNIVERSITY_REGISTRY: UniversityDefinition[] = [
  {
    id: "unimelb",
    name: "University of Melbourne",
    officialDomains: ["handbook.unimelb.edu.au"],
    preferredDomains: ["handbook.unimelb.edu.au"],
    excludedSubdomains: ["studentunion.unimelb.edu.au", "alumni.unimelb.edu.au"],
    unitTerm: "subject",
    subjectGuideTerm: "subject overview",
    teachingPeriodTerm: "teaching period",
    teachingPeriodNames: ["Semester 1", "Semester 2", "Summer Term", "Winter Term"],
    subjectCodePattern: /^[A-Z]{4}\d{5}$/,
    handbookUrlTemplate: "https://handbook.unimelb.edu.au/subjects/{code}",
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: "https://handbook.unimelb.edu.au/subjects/{code}/assessment",
    calendarUrlTemplate: null,
    codeCase: "lower",
    searchQueryTemplate: "https://handbook.unimelb.edu.au/search?query={query}",
    nativeSearchEndpoint: "https://handbook.unimelb.edu.au/search",
    sitemapLocations: [],
    preferredSourceTypes: ["handbook", "assessment"],
    pathRankingHints: ["/subjects/"],
    yearUrlConvention: null,
    knownJsRenderedSections: [],
    archivePathPatterns: ["/archive.handbook."],
    marketingPathPatterns: ["/courses/", "/study/"],
    titleSuffixesToStrip: [" — The University of Melbourne Handbook", " - The University of Melbourne Handbook"],
    subjectCodeAliases: {},
    teachingPeriodAliases: { "Semester 1": ["Sem 1", "S1"], "Semester 2": ["Sem 2", "S2"] },
    supportStatus: {
      codeSearchSupport: "verified",
      nameSearchSupport: "partial",
      yearDetectionSupport: "partial",
      teachingPeriodSupport: "partial",
      staticPageAvailability: "verified",
      jsRenderedLimitations: null,
      verifiedSourceTypes: ["handbook", "assessment"],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "high",
    },
    verified: true,
    verificationNote:
      "Both handbook and assessment URLs fetched successfully as static HTML with real assessment weightings/due-windows (Phase 18B). /sitemap.xml returned 404 (Phase 18C) — the native search endpoint is the real discovery path here, not a sitemap.",
    researchDate: "2026-07-22",
  },
  {
    id: "monash",
    name: "Monash University",
    officialDomains: ["handbook.monash.edu"],
    preferredDomains: ["handbook.monash.edu"],
    excludedSubdomains: ["www3.monash.edu"],
    unitTerm: "unit",
    subjectGuideTerm: "unit guide",
    teachingPeriodTerm: "teaching period",
    teachingPeriodNames: ["Semester 1", "Semester 2", "Term 1", "Term 2", "Term 3"],
    subjectCodePattern: /^[A-Z]{3}\d{4}$/,
    handbookUrlTemplate: "https://handbook.monash.edu/current/units/{code}",
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: null,
    calendarUrlTemplate: null,
    codeCase: "upper",
    searchQueryTemplate: null,
    nativeSearchEndpoint: "https://handbook.monash.edu/search",
    sitemapLocations: ["https://handbook.monash.edu/sitemap.xml"],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: ["/units/"],
    yearUrlConvention: "/{year}/units/{code} (an explicit-year variant exists alongside /current/)",
    knownJsRenderedSections: ["description", "assessment", "learning outcomes"],
    archivePathPatterns: ["/2019handbooks/", "/2020handbooks/", "/2021handbooks/", "/2022handbooks/", "/2023handbooks/"],
    marketingPathPatterns: ["/courses/", "/study-at-monash/"],
    titleSuffixesToStrip: [" - Monash University", " - Monash Handbook"],
    subjectCodeAliases: {},
    teachingPeriodAliases: { "Semester 1": ["S1"], "Semester 2": ["S2"] },
    supportStatus: {
      codeSearchSupport: "partial",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "partial",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "partial",
      jsRenderedLimitations: "Description, assessment and learning-outcome content renders client-side; a plain fetch sees only the page shell (code/title).",
      verifiedSourceTypes: ["handbook"],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "medium",
    },
    verified: false,
    verificationNote:
      "The direct URL pattern is real and resolves (code/title present), but assessment/description content is client-rendered — a plain fetch only sees the page shell. /sitemap.xml is a REAL, working sitemap index (fetched successfully, Phase 18C), listing timestamped child sitemaps crawled dynamically by the sitemap adapter — not hardcoded here since their filenames rotate.",
    researchDate: "2026-07-22",
  },
  {
    id: "rmit",
    name: "RMIT University",
    officialDomains: ["www.rmit.edu.au"],
    preferredDomains: ["www.rmit.edu.au"],
    excludedSubdomains: ["www1.rmit.edu.au"],
    unitTerm: "course",
    subjectGuideTerm: "course guide",
    teachingPeriodTerm: "teaching period",
    teachingPeriodNames: ["Semester 1", "Semester 2"],
    subjectCodePattern: /^[A-Z]{4}\d{4}$/,
    handbookUrlTemplate: null,
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: null,
    calendarUrlTemplate: null,
    codeCase: "upper",
    searchQueryTemplate: null,
    nativeSearchEndpoint: "https://www.rmit.edu.au/students/my-course/program-course-information/course-guides",
    sitemapLocations: ["https://www.rmit.edu.au/sitemap.xml"],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: ["/courses/", "/course-guides/"],
    yearUrlConvention: null,
    knownJsRenderedSections: [],
    archivePathPatterns: ["/course-guides-archive/"],
    marketingPathPatterns: ["/scholarships/", "/online/blog/", "/study-with-us/"],
    titleSuffixesToStrip: [" - RMIT University"],
    subjectCodeAliases: {},
    teachingPeriodAliases: {},
    supportStatus: {
      codeSearchSupport: "unsupported",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "unsupported",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "unsupported",
      jsRenderedLimitations: null,
      verifiedSourceTypes: [],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "missing",
    },
    verified: false,
    verificationNote:
      "No simple code-in-path URL was found — RMIT's current course guides sit behind a search/curriculum-catalogue interface. /sitemap.xml IS real and fetches successfully (Phase 18C), but the sampled entries were marketing/blog content (scholarships, online-course blog posts), not obviously the course catalogue — recorded as an unconfirmed-coverage signal, not a working discovery path.",
    researchDate: "2026-07-22",
  },
  {
    id: "latrobe",
    name: "La Trobe University",
    officialDomains: ["handbook.latrobe.edu.au"],
    preferredDomains: ["handbook.latrobe.edu.au"],
    excludedSubdomains: ["www.latrobecollegeaustralia.edu.au"],
    unitTerm: "subject",
    subjectGuideTerm: "subject learning guide",
    teachingPeriodTerm: "teaching period",
    teachingPeriodNames: ["Semester 1", "Semester 2", "Summer Semester"],
    subjectCodePattern: /^[A-Z]{3}\d[A-Z]{2}$/,
    handbookUrlTemplate: "https://handbook.latrobe.edu.au/subjects/{code}",
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: null,
    calendarUrlTemplate: null,
    codeCase: "upper",
    searchQueryTemplate: null,
    nativeSearchEndpoint: null,
    sitemapLocations: [],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: ["/subjects/"],
    yearUrlConvention: null,
    knownJsRenderedSections: [],
    archivePathPatterns: [],
    marketingPathPatterns: ["/courses/", "/study/"],
    titleSuffixesToStrip: [" - La Trobe University"],
    subjectCodeAliases: {},
    teachingPeriodAliases: {},
    supportStatus: {
      codeSearchSupport: "unsupported",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "unsupported",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "unsupported",
      jsRenderedLimitations: null,
      verifiedSourceTypes: [],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "missing",
    },
    verified: false,
    verificationNote:
      "The handbook host blocked an automated research fetch outright in Phase 18B, but a real single-attempt server-side fetch in Phase 18C reached the host and received a genuine HTTP 404 for the one code tested — the domain is reachable, but this guessed path template is not confirmed correct. /sitemap.xml could not be retrieved by the research tooling used this phase.",
    researchDate: "2026-07-22",
  },
  {
    id: "deakin",
    name: "Deakin University",
    officialDomains: ["www.deakin.edu.au"],
    preferredDomains: ["www.deakin.edu.au"],
    excludedSubdomains: ["apps.deakin.edu.au"],
    unitTerm: "unit",
    subjectGuideTerm: "unit guide",
    teachingPeriodTerm: "trimester",
    teachingPeriodNames: ["Trimester 1", "Trimester 2", "Trimester 3"],
    subjectCodePattern: /^[A-Z]{3}\d{3}$/,
    handbookUrlTemplate: null,
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: null,
    calendarUrlTemplate: null,
    codeCase: "upper",
    searchQueryTemplate: null,
    nativeSearchEndpoint: "https://www.deakin.edu.au/courses-search/unit-search.php",
    sitemapLocations: [],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: ["/unit-search/", "/courses-search/"],
    yearUrlConvention: "/students/enrolment-and-fees/manage-your-course/handbooks/{year}-handbook",
    knownJsRenderedSections: [],
    archivePathPatterns: ["/archived-handbooks/"],
    marketingPathPatterns: ["/courses-search/"],
    titleSuffixesToStrip: [" | Deakin"],
    subjectCodeAliases: {},
    teachingPeriodAliases: { "Trimester 1": ["T1"], "Trimester 2": ["T2"], "Trimester 3": ["T3"] },
    supportStatus: {
      codeSearchSupport: "unsupported",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "unsupported",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "unsupported",
      jsRenderedLimitations: null,
      verifiedSourceTypes: [],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "missing",
    },
    verified: false,
    verificationNote:
      "Deakin's unit-search endpoint returned 403 Forbidden to an automated fetch in both Phase 18B and Phase 18C research — no working direct URL or sitemap is known.",
    researchDate: "2026-07-22",
  },
  {
    id: "swinburne",
    name: "Swinburne University of Technology",
    officialDomains: ["www.swinburne.edu.au"],
    preferredDomains: ["www.swinburne.edu.au"],
    excludedSubdomains: [],
    unitTerm: "unit",
    subjectGuideTerm: "unit outline",
    teachingPeriodTerm: "teaching period",
    teachingPeriodNames: ["Semester 1", "Semester 2"],
    subjectCodePattern: /^[A-Z]{3}\d{5}$/,
    handbookUrlTemplate: null,
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: null,
    calendarUrlTemplate: null,
    codeCase: "upper",
    searchQueryTemplate: null,
    nativeSearchEndpoint: null,
    sitemapLocations: [],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: [],
    yearUrlConvention: null,
    knownJsRenderedSections: [],
    archivePathPatterns: [],
    marketingPathPatterns: [],
    titleSuffixesToStrip: [],
    subjectCodeAliases: {},
    teachingPeriodAliases: {},
    supportStatus: {
      codeSearchSupport: "unsupported",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "unsupported",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "unsupported",
      jsRenderedLimitations: null,
      verifiedSourceTypes: [],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "missing",
    },
    verified: false,
    verificationNote: "Not researched this phase — listed so Study Details can record the institution, but no URL pattern is attempted.",
    researchDate: "2026-07-22",
  },
  {
    id: "vu",
    name: "Victoria University",
    officialDomains: ["www.vu.edu.au"],
    preferredDomains: ["www.vu.edu.au"],
    excludedSubdomains: [],
    unitTerm: "unit",
    subjectGuideTerm: "unit outline",
    teachingPeriodTerm: "study period",
    teachingPeriodNames: ["Semester 1", "Semester 2", "Block Model Study Period 1", "Block Model Study Period 2"],
    subjectCodePattern: /^[A-Z]{3}\d{4}$/,
    handbookUrlTemplate: null,
    subjectGuideUrlTemplate: null,
    timetableUrlTemplate: null,
    assessmentUrlTemplate: null,
    calendarUrlTemplate: null,
    codeCase: "upper",
    searchQueryTemplate: null,
    nativeSearchEndpoint: null,
    sitemapLocations: [],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: [],
    yearUrlConvention: null,
    knownJsRenderedSections: [],
    archivePathPatterns: [],
    marketingPathPatterns: [],
    titleSuffixesToStrip: [],
    subjectCodeAliases: {},
    teachingPeriodAliases: {},
    supportStatus: {
      codeSearchSupport: "unsupported",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "unsupported",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "unsupported",
      jsRenderedLimitations: null,
      verifiedSourceTypes: [],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "missing",
    },
    verified: false,
    verificationNote: "Not researched this phase — listed so Study Details can record the institution, but no URL pattern is attempted.",
    researchDate: "2026-07-22",
  },
];

export function findUniversity(id: string): UniversityDefinition | null {
  return UNIVERSITY_REGISTRY.find((u) => u.id === id) ?? null;
}

/** Substitutes `{code}` per the template's declared case rule — the only "logic" the registry performs. */
export function buildUniversityUrl(template: string, code: string, codeCase: UniversityDefinition["codeCase"]): string {
  const cased = codeCase === "upper" ? code.toUpperCase() : codeCase === "lower" ? code.toLowerCase() : code;
  return template.replace("{code}", encodeURIComponent(cased));
}

/** Substitutes `{query}` (URL-encoded) into a search-query template. */
export function buildSearchUrl(template: string, query: string): string {
  return template.replace("{query}", encodeURIComponent(query));
}
