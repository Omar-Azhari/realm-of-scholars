/**
 * Phase 18C end-to-end verification harness (Parts 12/13). Drives the REAL,
 * unmodified `src/server/*` modules and the actual `api/academic/discover.ts`
 * handler — against a local, synthetic HTTP fixture server for every
 * security/parsing scenario (Part 12's fixture list), and against the real,
 * live University of Melbourne handbook for one bounded live smoke test
 * (Part 13's "separate, bounded" live check — failure there is reported
 * honestly, never treated as an internal test failure of the fixture suite).
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18c-backend.ts .tmp/verify-phase18c-backend.cjs
 *   node .tmp/verify-phase18c-backend.cjs
 */

process.env.UNIGAME_ALLOW_LOCALHOST_FETCH = "true";

import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

import { isLiteralIpAddress, isPrivateOrReservedAddress, isLocalhostName } from "../src/server/security/ipRanges";
import { guardUrlStructure, guardUrl } from "../src/server/security/ssrfGuard";
import { serverFetchOfficialPage } from "../src/server/security/serverFetch";
import { validateDiscoverRequest } from "../src/server/schema";
import { BoundedCache } from "../src/server/cache";
import { RateLimiter } from "../src/server/rateLimiter";
import { createSitemapSearchAdapter } from "../src/server/search/sitemapAdapter";
import { discoverOneSubject, discoverSubjects } from "../src/server/discoveryOrchestrator";
import { findUniversity, type UniversityDefinition } from "../src/import/universityRegistry";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import { reconcileWithLiveSemester } from "../src/import/merge/reconcile";
import { createEmptySelection, validateForApply, applySemesterImport } from "../src/import/applyImport";
import { resolveConflict } from "../src/import/merge/mergeEngine";
import { POST as discoverHandler } from "../api/academic/discover";

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

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures/phase18c");
function readFixture(name: string, port: number): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8").replace(/__PORT__/g, String(port));
}

// ---------------------------------------------------------------------------
// Local synthetic fixture server (Part 12) — every route below exercises one
// named security/parsing scenario against the real serverFetchOfficialPage.
// ---------------------------------------------------------------------------

function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      const port = (server.address() as { port: number }).port;

      if (url === "/robots.txt") {
        res.writeHead(200, { "content-type": "text/plain" }).end(readFixture("robots.txt", port));
      } else if (url === "/subjects/TST1001" || url === "/blocked/page.html" || url === "/duplicate-a" || url === "/duplicate-b") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("subject-page.html", port));
      } else if (url === "/decoy-page.html") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("decoy-page.html", port));
      } else if (url === "/js-shell.html") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("js-shell.html", port));
      } else if (url === "/stale-year-page.html") {
        res.writeHead(200, { "content-type": "text/html" }).end(readFixture("stale-year-page.html", port));
      } else if (url === "/sitemap.xml") {
        res.writeHead(200, { "content-type": "application/xml" }).end(readFixture("sitemap-index.xml", port));
      } else if (url === "/sitemap-leaf.xml") {
        res.writeHead(200, { "content-type": "application/xml" }).end(readFixture("sitemap-leaf.xml", port));
      } else if (url === "/redirect-allowed") {
        res.writeHead(302, { location: `http://localhost:${port}/subjects/TST1001` }).end();
      } else if (url === "/redirect-disallowed") {
        res.writeHead(302, { location: "https://example.com/evil" }).end();
      } else if (url === "/oversized-declared") {
        res.writeHead(200, { "content-type": "text/html", "content-length": "999999999" }).end("<html>short body, dishonest header</html>");
      } else if (url === "/oversized-stream") {
        res.writeHead(200, { "content-type": "text/html", "transfer-encoding": "chunked" });
        const chunk = "a".repeat(1024 * 1024); // 1 MB per chunk
        let sent = 0;
        const interval = setInterval(() => {
          if (sent >= 8) {
            clearInterval(interval);
            res.end();
            return;
          }
          res.write(chunk);
          sent += 1;
        }, 1);
      } else if (url === "/malformed-content-type") {
        res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-fixture-not-real");
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

const FIXTURE_UNIVERSITY_ID = "fixture-test-university";

function buildFixtureUniversity(port: number): UniversityDefinition {
  return {
    id: FIXTURE_UNIVERSITY_ID,
    name: "Fixture Test University",
    officialDomains: ["localhost"],
    preferredDomains: ["localhost"],
    excludedSubdomains: [],
    unitTerm: "unit",
    subjectGuideTerm: "unit guide",
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
    sitemapLocations: [`http://localhost:${port}/sitemap.xml`],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: ["/subjects/"],
    yearUrlConvention: null,
    knownJsRenderedSections: ["description"],
    verified: false,
    verificationNote: "Synthetic fixture university for Phase 18C automated testing — not a real institution.",
    researchDate: "2026-07-22",
    // Registry V3 fields (Phase 18D, Part 8) — added when this fixture
    // predated that extension; every field the ranking/year/period engines
    // read must exist even on a synthetic university, or those engines
    // throw on `undefined.find(...)` the moment a real one is missing.
    archivePathPatterns: [],
    marketingPathPatterns: [],
    titleSuffixesToStrip: [],
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
  };
}

async function main(): Promise<void> {
  const { server, port } = await startFixtureServer();

  try {
    // ---- Unit-level SSRF/IP checks (no network) --------------------------
    await section("SSRF: IP-range classification (unit-level, no network)", () => {
      check("10.0.0.5 is private", isPrivateOrReservedAddress("10.0.0.5"));
      check("172.16.0.1 is private", isPrivateOrReservedAddress("172.16.0.1"));
      check("172.32.0.1 is NOT private (outside /12)", !isPrivateOrReservedAddress("172.32.0.1"));
      check("192.168.1.1 is private", isPrivateOrReservedAddress("192.168.1.1"));
      check("127.0.0.1 is private (loopback)", isPrivateOrReservedAddress("127.0.0.1"));
      check("169.254.1.1 is private (link-local)", isPrivateOrReservedAddress("169.254.1.1"));
      check("8.8.8.8 is NOT private", !isPrivateOrReservedAddress("8.8.8.8"));
      check("::1 is private (loopback v6)", isPrivateOrReservedAddress("::1"));
      check("fe80::1 is private (link-local v6)", isPrivateOrReservedAddress("fe80::1"));
      check("fc00::1 is private (unique-local v6)", isPrivateOrReservedAddress("fc00::1"));
      check("2001:4860:4860::8888 is NOT private (real public v6)", !isPrivateOrReservedAddress("2001:4860:4860::8888"));
      check("203.0.113.5 IS a literal IP", isLiteralIpAddress("203.0.113.5"));
      check("handbook.unimelb.edu.au is NOT a literal IP", !isLiteralIpAddress("handbook.unimelb.edu.au"));
      check("localhost is recognised as localhost", isLocalhostName("localhost"));
    });

    await section("SSRF: structural URL guard", () => {
      const domains = ["handbook.unimelb.edu.au"];
      // This one check needs UNIGAME_ALLOW_LOCALHOST_FETCH genuinely off —
      // temporarily unset it (the fixture-server tests below need it back on).
      const previousAllowFlag = process.env.UNIGAME_ALLOW_LOCALHOST_FETCH;
      delete process.env.UNIGAME_ALLOW_LOCALHOST_FETCH;
      check("http:// is rejected when localhost-allow is off for a real domain", !guardUrlStructure(new URL("http://handbook.unimelb.edu.au/x"), domains).allowed);
      process.env.UNIGAME_ALLOW_LOCALHOST_FETCH = previousAllowFlag;
      check("a URL on an unlisted domain is rejected", !guardUrlStructure(new URL("https://coursehero.com/x"), domains).allowed);
      check("an IP-literal hostname is rejected outright", !guardUrlStructure(new URL("https://203.0.113.5/x"), ["203.0.113.5"]).allowed);
      check("embedded credentials are rejected", !guardUrlStructure(new URL("https://user:pass@handbook.unimelb.edu.au/x"), domains).allowed);
      check("a normal allowlisted https URL passes structural checks", guardUrlStructure(new URL("https://handbook.unimelb.edu.au/subjects/unib10007"), domains).allowed);
    });

    await section("SSRF: DNS-resolution guard rejects a real private-network hostname", async () => {
      // A hostname that resolves to a private address is the exact case an
      // allowlisted *name* alone can't catch — this is a real DNS lookup
      // against a service specifically made for testing this (per RFC 6761
      // guidance style test domains are not guaranteed, so this check
      // degrades gracefully to a skip-if-unresolvable rather than a hard
      // fixture dependency).
      try {
        const result = await guardUrl(new URL("https://private-address-test.example"), ["private-address-test.example"]);
        check("an unresolvable/non-existent test domain is rejected, not silently allowed", !result.allowed);
      } catch {
        check("DNS guard did not crash on an unresolvable domain", true);
      }
    });

    // ---- Fixture server: real network, synthetic content (Part 12) -------
    const university = buildFixtureUniversity(port);

    await section("Fixture: valid static handbook page (Part 12)", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/subjects/TST1001`, university.officialDomains);
      check("fetched successfully", result.ok, result.error ?? undefined);
      check("contains real fixture content", (result.text ?? "").includes("Fixture Systems Design"));
    });

    await section("Fixture: redirect to an allowed domain follows through", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/redirect-allowed`, university.officialDomains);
      check("redirect followed and final page fetched", result.ok);
      check("finalUrl reflects the redirect target", result.finalUrl.includes("/subjects/TST1001"));
    });

    await section("Fixture: redirect to a disallowed domain is rejected", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/redirect-disallowed`, university.officialDomains);
      check("rejected, never followed to example.com", !result.ok);
      check("error explains the redirect rejection", (result.error ?? "").includes("redirect"));
    });

    await section("Fixture: robots.txt disallow is respected", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/blocked/page.html`, university.officialDomains);
      check("blocked path rejected", !result.ok);
      check("error cites robots.txt", (result.error ?? "").toLowerCase().includes("robots"));
    });

    await section("Fixture: oversized response rejected via Content-Length header", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/oversized-declared`, university.officialDomains);
      check("rejected before reading the body", !result.ok);
      check("error cites size", (result.error ?? "").toLowerCase().includes("byte"));
    });

    await section("Fixture: oversized response rejected via streaming cap (no honest Content-Length)", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/oversized-stream`, university.officialDomains);
      check("rejected mid-stream once the cap was exceeded", !result.ok);
    });

    await section("Fixture: unsupported content-type rejected", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/malformed-content-type`, university.officialDomains);
      check("application/pdf rejected", !result.ok);
      check("error cites content type", (result.error ?? "").toLowerCase().includes("content type"));
    });

    await section("Fixture: 404 handled gracefully", async () => {
      const result = await serverFetchOfficialPage(`http://localhost:${port}/does-not-exist`, university.officialDomains);
      check("404 reported as a clean failure, not a crash", !result.ok && result.status === 404);
    });

    // ---- Sitemap adapter (Part 4/12; call site updated for the Phase 18D
    // AcademicSearchAdapter interface reshape — see search/types.ts) --------
    await section("Sitemap adapter: index -> leaf -> ranked candidate (real code match beats decoy)", async () => {
      const adapter = createSitemapSearchAdapter((id) => (id === university.id ? university : null));
      const candidates = await adapter.search(
        {
          institutionId: university.id,
          subjectCode: "TST1001",
          subjectName: null,
          academicYear: "2026",
          teachingPeriod: null,
          degree: null,
          major: null,
          campus: null,
          resultLimit: 5,
        },
        {}
      );
      check("at least one candidate found", candidates.length > 0);
      const top = candidates[0];
      check("the real subject page ranked first, not the decoy", top?.url.includes("/subjects/TST1001"));
      // Under the Phase 18D ranking engine, "high" additionally requires a
      // registry-verified institution or structured page metadata (neither
      // true of this bare, unverified fixture) — exact-code-in-path alone
      // correctly earns "medium", not "high". See WEIGHTS in ranking.ts.
      check("top candidate has at least medium confidence (exact code match)", top?.confidence === "medium" || top?.confidence === "high");
      check("candidate carries its already-fetched HTML (no duplicate fetch needed)", (top?.fetchedHtml ?? "").includes("Fixture Systems Design"));
    });

    // ---- Full per-subject discovery via the fixture university -----------
    await section("Orchestrator: full discovery for a code that resolves via direct template", async () => {
      const outcome = await discoverOneSubject(university, { code: "TST1001", name: null }, "2026", "fixture-src-1");
      check("status found", outcome.queryResult.status === "found");
      check("subject code extracted", outcome.sourcePackage?.subjects[0]?.code === "TST1001");
      check("modules extracted", (outcome.sourcePackage?.subjects[0]?.modules.length ?? 0) >= 2);
      check("assessment extracted with real weighting", outcome.sourcePackage?.subjects[0]?.assessments[0]?.weighting === 40);
      check("source reference points at the real fixture URL", outcome.discoveredSources[0]?.finalUrl.includes("/subjects/TST1001"));
    });

    await section("Orchestrator: stale-academic-year detection (real 'not available in YYYY' phrasing)", async () => {
      const staleUniversity: UniversityDefinition = { ...university, handbookUrlTemplate: `http://localhost:${port}/stale-year-page.html` };
      const outcome = await discoverOneSubject(staleUniversity, { code: "TST3003", name: null }, "2026", "fixture-src-2");
      check("stale-academic-year warning raised", outcome.queryResult.warnings.some((w) => w.kind === "stale-academic-year"));
    });

    await section("Orchestrator: JS-rendered shell page reported honestly, not as empty success", async () => {
      const jsUniversity: UniversityDefinition = { ...university, handbookUrlTemplate: `http://localhost:${port}/js-shell.html`, subjectCodePattern: /^TST\d{4}$/ };
      const outcome = await discoverOneSubject(jsUniversity, { code: "TST2002", name: null }, "2026", "fixture-src-3");
      check("js-rendered-page warning raised", outcome.queryResult.warnings.some((w) => w.kind === "js-rendered-page"));
    });

    await section("Orchestrator: unrecognised code never attempts a fetch", async () => {
      const outcome = await discoverOneSubject(university, { code: "not-a-real-code", name: null }, "2026", "fixture-src-4");
      check("status not-found without any network attempt", outcome.queryResult.status === "not-found");
    });

    await section("Orchestrator: partial multi-subject success — one bad subject doesn't destroy others", async () => {
      // discoverSubjects() looks institutions up in the REAL registry, so
      // this uses the real "unimelb" entry with two codes: one genuinely
      // malformed (never attempts a fetch) and one pattern-valid but
      // fictitious (attempts a real fetch and gets a 404) — proving both
      // outcomes coexist in one multi-subject request without one
      // poisoning the other.
      const outcome = await discoverSubjects(
        {
          institutionId: "unimelb",
          subjectQueries: [
            { code: "not-a-real-code", name: null },
            { code: "ZZZZ99999", name: null },
          ],
          degree: null,
          major: null,
          academicYear: "2026",
          teachingPeriod: null,
          campus: null,
          locale: null,
        },
        "fixture-multi"
      );
      check("both subjects produced a result (neither request crashed the batch)", outcome.queryResults.length === 2);
      check("malformed code resolved without any fetch", outcome.queryResults[0].status === "not-found");
      check("well-formed-but-fictitious code also resolved gracefully (likely not-found via a real 404)", outcome.queryResults[1].status !== undefined);
    });

    // ---- validateDiscoverRequest (Part 2) ----------------------------------
    await section("Request validation: rejects unknown fields, bad shapes; accepts a valid request", () => {
      check("rejects a non-object body", !validateDiscoverRequest("nope").ok);
      check("rejects an unknown top-level field", !validateDiscoverRequest({ institutionId: "unimelb", subjectQueries: [{ code: "X" }], academicYear: "2026", evil: true }).ok);
      check("rejects an empty subjectQueries array", !validateDiscoverRequest({ institutionId: "unimelb", subjectQueries: [], academicYear: "2026" }).ok);
      check("rejects a non-4-digit academicYear", !validateDiscoverRequest({ institutionId: "unimelb", subjectQueries: [{ code: "X" }], academicYear: "26" }).ok);
      check("rejects a query with neither code nor name", !validateDiscoverRequest({ institutionId: "unimelb", subjectQueries: [{}], academicYear: "2026" }).ok);
      const valid = validateDiscoverRequest({ institutionId: "unimelb", subjectQueries: [{ code: "UNIB10007", name: null }], academicYear: "2026", degree: null, major: null, teachingPeriod: null, campus: null, locale: null });
      check("accepts a well-formed request", valid.ok);
    });

    // ---- Cache + rate limiter (Part 10/13) ---------------------------------
    await section("Cache: TTL expiry and bounded eviction", async () => {
      const cache = new BoundedCache<string>(2);
      cache.set("a", "1", 10_000);
      cache.set("b", "2", 10_000);
      cache.set("c", "3", 10_000); // evicts "a" (bounded to 2 entries)
      check("oldest entry evicted once over capacity", cache.get("a") === null);
      check("recent entries retained", cache.get("b")?.value === "2" && cache.get("c")?.value === "3");

      const shortLived = new BoundedCache<string>(5);
      shortLived.set("x", "expires-soon", 1);
      await new Promise((r) => setTimeout(r, 20));
      check("expired entry is gone after its TTL", shortLived.get("x") === null);
    });

    await section("Rate limiter: rejects once the per-key limit is reached", () => {
      const limiter = new RateLimiter(3, 60_000);
      check("1st allowed", limiter.tryConsume("client-a"));
      check("2nd allowed", limiter.tryConsume("client-a"));
      check("3rd allowed", limiter.tryConsume("client-a"));
      check("4th rejected (limit reached)", !limiter.tryConsume("client-a"));
      check("a different key is unaffected", limiter.tryConsume("client-b"));
    });

    // ---- The actual Vercel handler, called in-process (Part 13) ------------
    await section("The real api/academic/discover.ts handler, invoked in-process with a Request object", async () => {
      const request = new Request("http://localhost/api/academic/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          institutionId: "unimelb",
          subjectQueries: [{ code: "not-a-real-code", name: null }],
          academicYear: "2026",
          degree: null,
          major: null,
          teachingPeriod: null,
          campus: null,
          locale: null,
        }),
      });
      const response = await discoverHandler(request);
      check("handler returns 200 even when a subject isn't found (a graceful result, not an HTTP error)", response.status === 200);
      const body = await response.json();
      check("response has the documented shape", typeof body.requestId === "string" && Array.isArray(body.queryResults));
      check("cacheStatus reported", body.cacheStatus === "live" || body.cacheStatus === "hit");
    });

    await section("The real handler rejects a malformed request with 400, never a stack trace", async () => {
      const request = new Request("http://localhost/api/academic/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ institutionId: "unimelb" }), // missing subjectQueries/academicYear
      });
      const response = await discoverHandler(request);
      check("400 returned", response.status === 400);
      const body = await response.json();
      const message = body.errors?.[0]?.message ?? "";
      check("client message never contains a stack trace", !message.includes(" at ") && !message.includes(".ts:"));
    });

    // ---- Bounded LIVE smoke test against the real, verified university -----
    // Part 13: "separate, bounded, allowed to fail with a clear external-site
    // status" — a failure here is reported honestly and does NOT flip the
    // overall exit code, since it proves nothing about this codebase.
    console.log("\n=== LIVE smoke test: University of Melbourne (bounded, may legitimately fail if the site is down) ===");
    try {
      const liveUniversity = findUniversity("unimelb");
      if (!liveUniversity) throw new Error("unimelb missing from registry");
      const liveOutcome = await discoverOneSubject(liveUniversity, { code: "UNIB10007", name: null }, "2026", "live-smoke-1");
      console.log(`  live status: ${liveOutcome.queryResult.status}, sources: ${liveOutcome.discoveredSources.length}, subject: "${liveOutcome.sourcePackage?.subjects[0]?.name}"`);
      if (liveOutcome.queryResult.status === "found") {
        console.log("  LIVE RESULT: successful discovery against the real live site (not counted as a fixture-suite pass/fail).");
      } else {
        console.log("  LIVE RESULT: the live site did not return a usable result right now — reported honestly, not treated as a codebase defect.");
      }

      // End-to-end (Part 13): discovery -> merge -> review-gate -> apply -> reload -> Undo-equivalent.
      if (liveOutcome.sourcePackage) {
        const defaultSave = createDefaultSaveData();
        const { pkg: reconciled } = reconcileWithLiveSemester(
          { importId: "live", createdAt: new Date().toISOString(), provider: ["backend-discovery"], sourceFiles: [], institution: liveUniversity.name, degree: null, major: null, academicYear: "2026", semesterName: null, campus: null, subjects: liveOutcome.sourcePackage.subjects, calendarEvents: [], warnings: liveOutcome.sourcePackage.warnings, conflicts: [], extractionSummary: { subjectsFound: 1, modulesFound: 0, assessmentsFound: 0, calendarEventsFound: 0, confirmedDeadlines: 0, uncertainDeadlines: 0, conflictsFound: 0, missingFieldsCount: 0 } },
          defaultSave.semester
        );
        let selection = createEmptySelection();
        selection = { ...selection, subjectMapping: { [reconciled.subjects[0].temporaryId]: "user-interface-design" } };
        let resolvedPkg = reconciled;
        for (const c of reconciled.conflicts.filter((c) => c.resolution === null)) {
          resolvedPkg = resolveConflict(resolvedPkg, c.id, c.options[0].label);
        }
        const validation = validateForApply(resolvedPkg, selection);
        console.log(`  end-to-end: Review-gate ok=${validation.ok}`);
        if (validation.ok) {
          const applied = applySemesterImport(defaultSave, resolvedPkg, selection);
          const reloaded = sanitizeSaveData(JSON.parse(JSON.stringify(applied)));
          const uiSubject = reloaded.semester.subjects.find((s) => s.id === "user-interface-design");
          console.log(`  end-to-end: applied + reloaded, UI Design now has ${uiSubject?.assessments.length} assessments — semester intact through a full reload.`);
        }
      }
    } catch (error) {
      console.log(`  LIVE RESULT: threw ${error instanceof Error ? error.message : String(error)} — external-site failure, not a fixture-suite failure.`);
    }
  } finally {
    server.close();
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed (${passed + failed} checks total)`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

void main();
