/**
 * Phase 18D live support matrix (Part 18). NOT a pass/fail test suite — a
 * bounded, honest REPORT. Runs one code query and one name query against
 * each of the 7 registered institutions through the real, unmodified
 * `discoverOneSubject()` orchestrator (the same code path production uses),
 * and prints exactly what Part 18 asks for per institution: query used,
 * code/name search result, year/period detection, content extracted,
 * quality, failure reason, whether the frontend fallback still applies, and
 * today's verification date.
 *
 * Never asserts success — an external site being unreachable, blocking
 * automated fetches, or returning nothing is reported as data, not treated
 * as an internal test failure (see the brief's own instruction: "external
 * site failures must not fail the internal fixture suite" — this script is
 * intentionally separate from scripts/verify-phase18c-backend.ts and
 * scripts/verify-phase18d-*.ts, which never depend on live sites). A URL
 * returning HTTP 200 is never alone reported as "supported" — only actual
 * extracted content (modules/assessments) counts.
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18d-live-matrix.ts .tmp/verify-phase18d-live-matrix.cjs
 *   node .tmp/verify-phase18d-live-matrix.cjs
 */

import { discoverOneSubject } from "../src/server/discoveryOrchestrator";
import { UNIVERSITY_REGISTRY } from "../src/import/universityRegistry";

const ACADEMIC_YEAR = "2026";

// One plausible query per institution. Only Melbourne's code is a
// genuinely CONFIRMED-working real subject (UNIB10007 — Phase 18B/18C live
// verification). The rest have no confirmed example code from prior
// research (see universityRegistry.ts's verificationNote per institution) —
// `codeIsConfirmed: false` means a "not found" result here says nothing
// about whether the institution's discovery PATTERN is wrong, only that
// this particular guessed code wasn't found; that distinction is reported
// explicitly below, never blurred into a blanket "unsupported".
const TEST_QUERIES: Array<{ institutionId: string; code: string; codeIsConfirmed: boolean; name: string }> = [
  { institutionId: "unimelb", code: "UNIB10007", codeIsConfirmed: true, name: "Introduction to Climate Change" },
  { institutionId: "monash", code: "FIT1045", codeIsConfirmed: false, name: "Introduction to Programming" },
  { institutionId: "rmit", code: "COSC1076", codeIsConfirmed: false, name: "Advanced Programming Techniques" },
  { institutionId: "latrobe", code: "CSE1OFA", codeIsConfirmed: false, name: "Object-Oriented Fundamentals A" },
  { institutionId: "deakin", code: "SIT102", codeIsConfirmed: false, name: "Introduction to Programming" },
  { institutionId: "swinburne", code: "COS10009", codeIsConfirmed: false, name: "Introduction to Programming" },
  { institutionId: "vu", code: "ISY1002", codeIsConfirmed: false, name: "Introduction to Programming" },
];

interface MatrixRow {
  institution: string;
  queryUsed: string;
  codeSearchResult: string;
  nameSearchResult: string;
  yearDetection: string;
  teachingPeriodDetection: string;
  contentExtracted: string;
  quality: string;
  failureReason: string | null;
  fallbackOffered: string;
  verificationDate: string;
}

async function testOne(institutionId: string, code: string | null, name: string | null): Promise<{ summary: string; year: string; period: string; content: string; quality: string; failure: string | null }> {
  const university = UNIVERSITY_REGISTRY.find((u) => u.id === institutionId);
  if (!university) return { summary: "institution not found in registry", year: "n/a", period: "n/a", content: "n/a", quality: "n/a", failure: "institution not found" };

  try {
    const outcome = await discoverOneSubject(university, { code, name, preferredUrl: null }, ACADEMIC_YEAR, `live-matrix-${institutionId}-${code ?? name}`);
    const subject = outcome.sourcePackage?.subjects[0] ?? null;
    const hasRealContent = !!subject && (subject.modules.length > 0 || subject.assessments.length > 0);
    const summary = outcome.queryResult.status === "found" ? "found" : outcome.queryResult.status === "partial" ? "partial" : outcome.queryResult.status === "ambiguous" ? "ambiguous (needs selection)" : outcome.queryResult.status === "not-found" ? "not found" : "error";
    const quality = outcome.queryResult.quality ? `${outcome.queryResult.quality.overall} (identity: ${outcome.queryResult.quality.dimensions.identity}, assessments: ${outcome.queryResult.quality.dimensions.assessments})` : "n/a — nothing to score";
    const failure = outcome.queryResult.status === "not-found" || outcome.queryResult.status === "error" ? outcome.queryResult.warnings.map((w) => w.message).join(" | ") || "no reason recorded" : null;
    const contentSummary = hasRealContent ? `${subject!.modules.length} modules, ${subject!.assessments.length} assessments (meaningful content — not just an HTTP 200)` : "no meaningful academic content extracted";
    return {
      summary,
      year: outcome.queryResult.quality?.dimensions.academicYear ?? "n/a",
      period: outcome.queryResult.quality?.dimensions.teachingPeriod ?? "n/a",
      content: contentSummary,
      quality,
      failure,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { summary: "error", year: "n/a", period: "n/a", content: "n/a", quality: "n/a", failure: message };
  }
}

async function main(): Promise<void> {
  const rows: MatrixRow[] = [];
  const verificationDate = new Date().toISOString().slice(0, 10);

  for (const q of TEST_QUERIES) {
    console.log(`\n--- ${q.institutionId} ---`);
    const university = UNIVERSITY_REGISTRY.find((u) => u.id === q.institutionId);
    const university_name = university?.name ?? q.institutionId;

    const codeResult = await testOne(q.institutionId, q.code, null);
    console.log(`  code "${q.code}"${q.codeIsConfirmed ? " (confirmed real)" : " (unconfirmed guess — see note)"}: ${codeResult.summary}`);

    const nameResult = await testOne(q.institutionId, null, q.name);
    console.log(`  name "${q.name}": ${nameResult.summary}`);

    rows.push({
      institution: university_name,
      queryUsed: `code="${q.code}"${q.codeIsConfirmed ? "" : " [unconfirmed]"}, name="${q.name}"`,
      codeSearchResult: codeResult.summary,
      nameSearchResult: nameResult.summary,
      yearDetection: codeResult.year,
      teachingPeriodDetection: codeResult.period,
      contentExtracted: codeResult.content,
      quality: codeResult.quality,
      failureReason: codeResult.failure ?? nameResult.failure,
      fallbackOffered: "Yes — direct-browser fallback (Phase 18B) and upload/manual entry always remain available regardless of this result.",
      verificationDate,
    });
  }

  console.log(`\n${"=".repeat(100)}`);
  console.log("PHASE 18D LIVE SUPPORT MATRIX (bounded, honest report — not a pass/fail suite)");
  console.log(`Run date: ${verificationDate}`);
  console.log("=".repeat(100));
  for (const row of rows) {
    console.log(`\n${row.institution}`);
    console.log(`  Query used:               ${row.queryUsed}`);
    console.log(`  Code search result:       ${row.codeSearchResult}`);
    console.log(`  Name search result:       ${row.nameSearchResult}`);
    console.log(`  Academic-year detection:  ${row.yearDetection}`);
    console.log(`  Teaching-period detection:${row.teachingPeriodDetection}`);
    console.log(`  Content extracted:        ${row.contentExtracted}`);
    console.log(`  Quality:                  ${row.quality}`);
    console.log(`  Failure reason:           ${row.failureReason ?? "n/a (succeeded)"}`);
    console.log(`  Fallback offered:         ${row.fallbackOffered}`);
    console.log(`  Verification date:        ${row.verificationDate}`);
  }
  console.log(`\n${"=".repeat(100)}`);
  console.log("Note: only Melbourne's code query used a CONFIRMED real subject code (UNIB10007, verified live in");
  console.log("Phase 18B/18C). Every other institution's code/name query used an unconfirmed, plausible-format");
  console.log("guess — a 'not found' result for those does NOT mean the institution's discovery pattern is wrong,");
  console.log("only that this specific guessed code/name wasn't found. This script never fails the build; it is a");
  console.log("reporting tool only, run separately from the deterministic fixture suites.");
}

void main();
