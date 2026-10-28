/**
 * Phase 18D institution-extractor verification harness (Part 9). Tests the
 * unimelb extractor at two levels:
 *
 *  - Unit-level, directly against `unimelbExtractor.enhance()` with
 *    hand-built subjects, proving it only ever fills a null field, never
 *    overwrites an already-populated one, and never invents a value with no
 *    matching text.
 *  - End-to-end through the REAL, unmodified `discoverOneSubject()`
 *    orchestrator against a local synthetic HTTP fixture server (no live-
 *    site dependency), proving institution selection by id genuinely wires
 *    the extractor into the real discovery pipeline, that it's tolerant of
 *    minor label-formatting differences, and that an institution with NO
 *    extractor registered (falls back safely) behaves identically to
 *    general-only extraction.
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18d-extractors.ts .tmp/verify-phase18d-extractors.cjs
 *   node .tmp/verify-phase18d-extractors.cjs
 */

process.env.UNIGAME_ALLOW_LOCALHOST_FETCH = "true";

import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

import { unimelbExtractor } from "../src/import/extraction/institutions/unimelb";
import { getInstitutionExtractor } from "../src/import/extraction/institutions/registry";
import { discoverOneSubject } from "../src/server/discoveryOrchestrator";
import type { ImportedSubjectCandidate } from "../src/import/types";
import type { UniversityDefinition } from "../src/import/universityRegistry";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`  ok   - ${name}`);
  } else {
    failed++;
    failures.push(detail ? `${name} :: ${detail}` : name);
    console.log(`  FAIL - ${name}${detail ? " :: " + detail : ""}`);
  }
}

async function section(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (error) {
    failed++;
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    failures.push(`${name} threw :: ${detail}`);
    console.log(`  FAIL - section threw: ${detail}`);
  }
}

function makeSubject(overrides: Partial<ImportedSubjectCandidate>): ImportedSubjectCandidate {
  return {
    temporaryId: "subj-1",
    code: "TST1001",
    name: "Fixture Systems Design",
    description: null,
    coordinator: null,
    creditPoints: null,
    teachingPeriod: null,
    colourSuggestion: null,
    modules: [],
    assessments: [],
    readings: [],
    goals: [],
    sourceReferences: [],
    confidence: "high",
    fieldConfidence: {},
    ...overrides,
  };
}

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures/phase18d");
function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

const requestCounts = new Map<string, number>();

function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      requestCounts.set(url, (requestCounts.get(url) ?? 0) + 1);
      if (url === "/subjects/TST1001" || url === "/subjects/TST1099") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("unimelb-subject-page.html"));
      } else if (url === "/subjects/TST1002") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("unimelb-subject-page-variant-formatting.html"));
      } else if (url === "/subjects/TST1003") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("../phase18c/subject-page.html"));
      } else {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, port });
    });
  });
}

function buildFixtureUniversity(id: string, port: number): UniversityDefinition {
  return {
    id,
    name: "Phase 18D Extractor Fixture University",
    officialDomains: ["localhost"],
    preferredDomains: ["localhost"],
    excludedSubdomains: [],
    unitTerm: "subject",
    subjectGuideTerm: "subject overview",
    teachingPeriodTerm: "semester",
    teachingPeriodNames: ["Semester 1", "Semester 2"],
    subjectCodePattern: /^TST\d{4}$/,
    handbookUrlTemplate: `http://localhost:${port}/subjects/{code}`,
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
    verified: false,
    verificationNote: "Synthetic fixture university for Phase 18D institution-extractor testing — not a real institution.",
    researchDate: "2026-07-22",
    archivePathPatterns: [],
    marketingPathPatterns: [],
    titleSuffixesToStrip: [" — The University of Melbourne Handbook"],
    subjectCodeAliases: {},
    teachingPeriodAliases: {},
    supportStatus: {
      codeSearchSupport: "verified",
      nameSearchSupport: "unsupported",
      yearDetectionSupport: "verified",
      teachingPeriodSupport: "unsupported",
      staticPageAvailability: "verified",
      jsRenderedLimitations: null,
      verifiedSourceTypes: ["handbook"],
      lastVerificationDate: "2026-07-22",
      confidenceLevel: "confirmed",
    },
  } as UniversityDefinition;
}

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Unit-level: fills only what's null, never overwrites, never invents
  // -------------------------------------------------------------------------
  await section("1. unimelbExtractor.enhance() — unit-level", () => {
    const plainText = "Subject code: TST1001\nCredit Points: 12.5\nSubject Coordinator: Dr Fixture Example\n";

    const bothNull = makeSubject({ creditPoints: null, coordinator: null });
    const enhanced = unimelbExtractor.enhance(bothNull, plainText, "src-1", "Fixture University — TST1001");
    check("fills creditPoints from 'Credit Points:' label", enhanced.creditPoints === 12.5);
    check("creditPoints fieldConfidence set to high", enhanced.fieldConfidence.creditPoints === "high");
    check("fills coordinator from 'Subject Coordinator:' label", enhanced.coordinator === "Dr Fixture Example");
    check("both fills carry a real source excerpt", enhanced.sourceReferences.length === 2 && enhanced.sourceReferences.every((r) => !!r.excerpt));

    const alreadyFilled = makeSubject({ creditPoints: 99, coordinator: "Someone Else", fieldConfidence: { creditPoints: "confirmed", coordinator: "confirmed" } });
    const unchanged = unimelbExtractor.enhance(alreadyFilled, plainText, "src-1", "Fixture University — TST1001");
    check("never overwrites an already-populated creditPoints", unchanged.creditPoints === 99);
    check("never overwrites an already-populated coordinator", unchanged.coordinator === "Someone Else");
    check("no new source references added when nothing was filled", unchanged.sourceReferences.length === alreadyFilled.sourceReferences.length);

    const noLabels = makeSubject({ creditPoints: null, coordinator: null });
    const stillNull = unimelbExtractor.enhance(noLabels, "No matching labels anywhere in this text.", "src-1", "Fixture University — TST1001");
    check("falls back safely: stays null when no label is present (never invents a value)", stillNull.creditPoints === null && stillNull.coordinator === null);
    check("returns the identical object reference when nothing changed (cheap no-op)", stillNull === noLabels);
  });

  // -------------------------------------------------------------------------
  // 2. Registry selection by institution id
  // -------------------------------------------------------------------------
  await section("2. getInstitutionExtractor() — selected by institution id", () => {
    check("unimelb resolves to the real extractor", getInstitutionExtractor("unimelb") === unimelbExtractor);
    check("an institution with no extractor resolves to null (falls back to general-only extraction)", getInstitutionExtractor("monash") === null);
    check("an unknown id resolves to null, never throws", getInstitutionExtractor("not-a-real-institution") === null);
  });

  // -------------------------------------------------------------------------
  // 3. End-to-end through the real orchestrator (synthetic fixture server)
  // -------------------------------------------------------------------------
  const { server, port } = await startFixtureServer();
  try {
    await section("3. End-to-end: extractor genuinely wired into discoverOneSubject() by institution id", async () => {
      const university = buildFixtureUniversity("unimelb", port);
      const outcome = await discoverOneSubject(university, { code: "TST1001", name: null }, "2026", "src-e2e-1");
      const subject = outcome.sourcePackage?.subjects[0];
      check("subject extracted", !!subject);
      check("credit points filled via the institution extractor, not the general engine", subject?.creditPoints === 12.5);
      check("subject coordinator filled via the institution extractor's own label variant", subject?.coordinator === "Dr Fixture Example");
    });

    await section("4. Tolerant of minor label-formatting differences (no colon, dash instead of colon, different case)", async () => {
      const university = buildFixtureUniversity("unimelb", port);
      const outcome = await discoverOneSubject(university, { code: "TST1002", name: null }, "2026", "src-e2e-2");
      const subject = outcome.sourcePackage?.subjects[0];
      check("credit points still found despite 'credit points 12.5' (lowercase, no colon)", subject?.creditPoints === 12.5);
      check("coordinator still found despite 'Subject Coordinator - Name' (dash, not colon)", subject?.coordinator === "Dr Fixture Example");
    });

    await section("5. Falls back safely: a page with neither label still extracts cleanly via the general engine", async () => {
      const university = buildFixtureUniversity("unimelb", port);
      const outcome = await discoverOneSubject(university, { code: "TST1003", name: null }, "2026", "src-e2e-3");
      const subject = outcome.sourcePackage?.subjects[0];
      check("subject still extracted (general engine unaffected)", !!subject);
      check("creditPoints stays null — no label present, nothing invented", subject?.creditPoints === null);
      check("coordinator still comes from the GENERAL engine's own 'Coordinator:' label, not overwritten", subject?.coordinator === "Dr Fixture Example");
    });

    await section("6a. preferredUrl (Ambiguity Review 'select' action) fetches and extracts from that exact page", async () => {
      const university = buildFixtureUniversity("unimelb", port);
      const outcome = await discoverOneSubject(
        university,
        { code: null, name: null, preferredUrl: `http://localhost:${port}/subjects/TST1002` },
        "2026",
        "src-e2e-select"
      );
      const subject = outcome.sourcePackage?.subjects[0];
      check("subject extracted from the exact selected URL, bypassing ranking/search", !!subject);
      check("discoveredSources records the user-selected discovery method", outcome.discoveredSources[0]?.discoveryMethod === "user-selected");
      check("credit points came from the selected page's own content (variant-formatting fixture)", subject?.creditPoints === 12.5);
    });

    await section("6b. preferredUrl outside the institution's official domains is rejected, not fetched", async () => {
      const university = buildFixtureUniversity("unimelb", port);
      const outcome = await discoverOneSubject(
        university,
        { code: null, name: null, preferredUrl: "https://not-an-official-domain.example.com/page" },
        "2026",
        "src-e2e-select-bad"
      );
      check("rejected before any content was extracted", outcome.queryResult.status === "not-found");
    });

    await section("6. An institution with NO extractor registered behaves identically to general-only extraction", async () => {
      const university = buildFixtureUniversity("no-extractor-fixture-university", port);
      const outcome = await discoverOneSubject(university, { code: "TST1001", name: null }, "2026", "src-e2e-4");
      const subject = outcome.sourcePackage?.subjects[0];
      check("subject still extracted", !!subject);
      check("creditPoints stays null (no extractor registered for this institution id)", subject?.creditPoints === null);
    });

    await section("7. Page cache (Phase 18D, Part 14): a repeat fetch of the same URL is a genuine cache hit, not a re-fetch", async () => {
      const university = buildFixtureUniversity("unimelb", port);
      const path = "/subjects/TST1099"; // never fetched by any earlier section — a genuinely fresh URL
      const before = requestCounts.get(path) ?? 0;
      check("URL is fresh before this test (sanity check)", before === 0);

      await discoverOneSubject(university, { code: "TST1099", name: null, preferredUrl: null }, "2026", "src-cache-1");
      const afterFirst = requestCounts.get(path) ?? 0;
      check("first call actually hit the fixture server", afterFirst > before);

      await discoverOneSubject(university, { code: "TST1099", name: null, preferredUrl: null }, "2026", "src-cache-2");
      const afterSecond = requestCounts.get(path) ?? 0;
      check("second call within the cache TTL made NO additional request (page cache hit)", afterSecond === afterFirst);
    });
  } finally {
    server.close();
  }

  // ---------------------------------------------------------------------
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed (${passed + failed} checks total)`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

void main();
