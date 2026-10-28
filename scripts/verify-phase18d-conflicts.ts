/**
 * Phase 18D conflict-engine verification harness (Part 13). Drives the REAL,
 * unmodified merge/reconcile/orchestrator modules directly:
 *
 *  - Section 1 is a permanent REGRESSION TEST for the Phase 18A conflict-
 *    resolution bug (resolveConflict recording a choice but never writing it
 *    back into the candidate field, leaving the field permanently missing
 *    even after the user "resolved" the conflict) — explicitly required by
 *    the Phase 18D brief ("Add regression tests for the Phase 18A conflict-
 *    resolution bug"). It reuses the exact fixture files
 *    (fixtures/phase18a/syllabus/conflicting-{a,b}.txt) the bug was first
 *    caught with.
 *  - Sections 2-4 cover the three NEW field-level conflict kinds this phase
 *    adds to mergeSubjectPair (subject-code-mismatch, credit-points-mismatch,
 *    teaching-period-mismatch), proving both detection AND write-back.
 *  - Section 5 covers subject-mapping-ambiguous (reconcile.ts, via
 *    suggestSubjectMapping's new ambiguousWith signal).
 *  - Section 6 covers conflicting-handbook-versions end-to-end through the
 *    real discoveryOrchestrator against a local synthetic HTTP fixture (no
 *    live-site dependency), proving a subject whose own fetched page mixes
 *    two academic-year signals raises a blocking conflict, not a silent pick.
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18d-conflicts.ts .tmp/verify-phase18d-conflicts.cjs
 *   node .tmp/verify-phase18d-conflicts.cjs
 */

process.env.UNIGAME_ALLOW_LOCALHOST_FETCH = "true";

import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

import { ingestFile } from "../src/import/ingestion";
import { createTextDocumentProvider } from "../src/import/providers/textProvider";
import { mergeSourcePackages, resolveConflict, unresolvedConflictCount } from "../src/import/merge/mergeEngine";
import { reconcileWithLiveSemester } from "../src/import/merge/reconcile";
import { discoverOneSubject } from "../src/server/discoveryOrchestrator";
import type { ImportedSourcePackage, ImportedSubjectCandidate } from "../src/import/types";
import type { SemesterRecord, SubjectRecord } from "../src/types/domain";
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

function ctx() {
  return { signal: new AbortController().signal, onProgress: () => {} };
}

const A_FIXTURES_DIR = path.resolve(process.cwd(), "fixtures/phase18a");
async function fileFromDisk(rel: string): Promise<File> {
  const abs = path.join(A_FIXTURES_DIR, rel);
  const bytes = fs.readFileSync(abs);
  return new File([bytes], path.basename(abs));
}

const META = { institution: "Fixture University", degree: null, major: null, academicYear: "2026", semesterName: "Semester 2", campus: null };

let tempCounter = 0;
function nextTempId(prefix: string): string {
  tempCounter += 1;
  return `${prefix}-${tempCounter}`;
}

function makeSubjectCandidate(overrides: Partial<ImportedSubjectCandidate>): ImportedSubjectCandidate {
  return {
    temporaryId: nextTempId("subj"),
    code: null,
    name: "Shared Subject Name",
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

function makeSourcePackage(providerId: string, subjects: ImportedSubjectCandidate[]): ImportedSourcePackage {
  return { providerId, subjects, calendarEvents: [], warnings: [] };
}

function makeLiveSubject(overrides: Partial<SubjectRecord>): SubjectRecord {
  return {
    id: nextTempId("live"),
    name: "Live Subject",
    code: { value: null, status: "needs_confirmation" },
    colourTheme: "#000000",
    characterConcept: "",
    modules: [],
    assessments: [],
    ...overrides,
  };
}

const FIXTURE_UNIVERSITY_ID = "phase18d-fixture-university";
function buildFixtureUniversity(port: number): UniversityDefinition {
  return {
    id: FIXTURE_UNIVERSITY_ID,
    name: "Phase 18D Fixture University",
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
    sitemapLocations: [],
    preferredSourceTypes: ["handbook"],
    pathRankingHints: ["/subjects/"],
    yearUrlConvention: null,
    knownJsRenderedSections: [],
    verified: false,
    verificationNote: "Synthetic fixture university for Phase 18D conflict-engine testing — not a real institution.",
    researchDate: "2026-07-22",
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
  } as UniversityDefinition;
}

function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      if (url === "/subjects/TST1001") {
        const html = fs.readFileSync(path.resolve(process.cwd(), "fixtures/phase18d/conflicting-year-page.html"), "utf-8");
        res.writeHead(200, { "content-type": "text/html" }).end(html);
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

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. REGRESSION: Phase 18A conflict-resolution write-back bug
  // -------------------------------------------------------------------------
  await section("1. REGRESSION — Phase 18A conflict-resolution write-back bug", async () => {
    const textProvider = createTextDocumentProvider(() => null);
    const a = await textProvider.extract((await ingestFile(await fileFromDisk("syllabus/conflicting-a.txt"), "src-conf-a")).input, ctx());
    const b = await textProvider.extract((await ingestFile(await fileFromDisk("syllabus/conflicting-b.txt"), "src-conf-b")).input, ctx());
    const merged = mergeSourcePackages([a, b], [], META, "2026-01-01T00:00:00.000Z");

    const weightConflict = merged.conflicts.find((c) => c.kind === "weight-mismatch");
    const dateConflict = merged.conflicts.find((c) => c.kind === "date-mismatch");
    check("weight-mismatch conflict raised", !!weightConflict);
    check("date-mismatch conflict raised", !!dateConflict);
    if (!weightConflict || !dateConflict) return;

    check("weighting nulled pending resolution (not guessed)", merged.subjects[0].assessments[0].weighting === null);
    check("due date nulled pending resolution (not guessed)", merged.subjects[0].assessments[0].due?.isoDate === null);

    let resolved = resolveConflict(merged, weightConflict.id, weightConflict.options[1].label);
    resolved = resolveConflict(resolved, dateConflict.id, dateConflict.options[1].label);
    const resolvedAssessment = resolved.subjects[0].assessments[0];

    // This is the exact regression: resolving must WRITE the value back into
    // the candidate field, not just record which label the user picked.
    check(
      "resolving weight-mismatch actually writes the value back (not just recorded)",
      resolvedAssessment.weighting !== null && resolvedAssessment.fieldConfidence.weighting === "confirmed"
    );
    check(
      "resolving date-mismatch actually writes the value back (not just recorded)",
      resolvedAssessment.due?.isoDate !== null && resolvedAssessment.fieldConfidence.dueDate === "confirmed"
    );
    check("both conflicts show a resolution label, not just an internal flag", resolved.conflicts.every((c) => c.resolution !== null));
    check("0 unresolved conflicts after resolution — Apply is unblocked", unresolvedConflictCount(resolved) === 0);
  });

  // -------------------------------------------------------------------------
  // 2. subject-code-mismatch
  // -------------------------------------------------------------------------
  await section("2. subject-code-mismatch (new conflict kind)", () => {
    const a = makeSubjectCandidate({ code: "ABC1000", fieldConfidence: { code: "high" } });
    const b = makeSubjectCandidate({ code: "XYZ9999", fieldConfidence: { code: "high" } });
    const merged = mergeSourcePackages([makeSourcePackage("p1", [a]), makeSourcePackage("p2", [b])], [], META, "2026-01-01T00:00:00.000Z");

    const conflict = merged.conflicts.find((c) => c.kind === "subject-code-mismatch");
    check("conflict raised when two sources give different non-null codes", !!conflict);
    check("code nulled pending resolution, not silently kept as the first source's value", merged.subjects[0].code === null);
    check("fieldConfidence marked conflicting", merged.subjects[0].fieldConfidence.code === "conflicting");
    if (!conflict) return;

    const resolved = resolveConflict(merged, conflict.id, conflict.options[1].label);
    check("resolving writes the chosen code back", resolved.subjects[0].code === "XYZ9999");
    check("fieldConfidence becomes confirmed", resolved.subjects[0].fieldConfidence.code === "confirmed");
  });

  // -------------------------------------------------------------------------
  // 3. credit-points-mismatch
  // -------------------------------------------------------------------------
  await section("3. credit-points-mismatch (new conflict kind)", () => {
    const a = makeSubjectCandidate({ creditPoints: 12.5, fieldConfidence: { creditPoints: "high" } });
    const b = makeSubjectCandidate({ creditPoints: 25, fieldConfidence: { creditPoints: "high" } });
    const merged = mergeSourcePackages([makeSourcePackage("p1", [a]), makeSourcePackage("p2", [b])], [], META, "2026-01-01T00:00:00.000Z");

    const conflict = merged.conflicts.find((c) => c.kind === "credit-points-mismatch");
    check("conflict raised when two sources give different non-null credit points", !!conflict);
    check("creditPoints nulled pending resolution", merged.subjects[0].creditPoints === null);
    if (!conflict) return;

    const resolved = resolveConflict(merged, conflict.id, conflict.options[1].label);
    check("resolving writes the chosen credit-point value back", resolved.subjects[0].creditPoints === 25);
    check("fieldConfidence becomes confirmed", resolved.subjects[0].fieldConfidence.creditPoints === "confirmed");
  });

  // -------------------------------------------------------------------------
  // 4. teaching-period-mismatch
  // -------------------------------------------------------------------------
  await section("4. teaching-period-mismatch (new conflict kind)", () => {
    const a = makeSubjectCandidate({ teachingPeriod: "Semester 1", fieldConfidence: { teachingPeriod: "high" } });
    const b = makeSubjectCandidate({ teachingPeriod: "Semester 2", fieldConfidence: { teachingPeriod: "high" } });
    const merged = mergeSourcePackages([makeSourcePackage("p1", [a]), makeSourcePackage("p2", [b])], [], META, "2026-01-01T00:00:00.000Z");

    const conflict = merged.conflicts.find((c) => c.kind === "teaching-period-mismatch");
    check("conflict raised when two sources give different non-null teaching periods", !!conflict);
    check("teachingPeriod nulled pending resolution", merged.subjects[0].teachingPeriod === null);
    if (!conflict) return;

    const resolved = resolveConflict(merged, conflict.id, conflict.options[0].label);
    check("resolving writes the chosen teaching period back", resolved.subjects[0].teachingPeriod === "Semester 1");

    // Same textual value, different case/whitespace, must NOT be flagged — this
    // is a cross-source textual check, not the registry alias system.
    const c = makeSubjectCandidate({ teachingPeriod: "semester 1", fieldConfidence: { teachingPeriod: "high" } });
    const d = makeSubjectCandidate({ teachingPeriod: "Semester 1", fieldConfidence: { teachingPeriod: "high" } });
    const mergedSame = mergeSourcePackages([makeSourcePackage("p3", [c]), makeSourcePackage("p4", [d])], [], META, "2026-01-01T00:00:00.000Z");
    check("no false-positive conflict for case/whitespace-only textual match", !mergedSame.conflicts.some((cf) => cf.kind === "teaching-period-mismatch"));
  });

  // -------------------------------------------------------------------------
  // 5. subject-mapping-ambiguous
  // -------------------------------------------------------------------------
  await section("5. subject-mapping-ambiguous (new conflict kind)", () => {
    const semester: SemesterRecord = {
      label: "Semester 2 2026",
      timezone: "Australia/Melbourne",
      startDate: { value: null, status: "needs_confirmation" },
      endDate: { value: null, status: "needs_confirmation" },
      breaks: [],
      examPeriod: { value: null, status: "needs_confirmation" },
      weekNumberingNote: "",
      subjects: [
        makeLiveSubject({ name: "Marketing Foundations", code: { value: null, status: "needs_confirmation" } }),
        makeLiveSubject({ name: "Marketing Essentials", code: { value: null, status: "needs_confirmation" } }),
      ],
    };
    const candidate = makeSubjectCandidate({ name: "Marketing Fundamentals", code: null });
    const pkg = mergeSourcePackages([makeSourcePackage("p1", [candidate])], [], META, "2026-01-01T00:00:00.000Z");
    const { pkg: reconciled } = reconcileWithLiveSemester(pkg, semester);

    const conflict = reconciled.conflicts.find((c) => c.kind === "subject-mapping-ambiguous");
    check("ambiguous mapping between two similarly-named live subjects raises a conflict, not a silent pick", !!conflict);
    check("conflict offers both competing live subjects as options", conflict?.options.length === 2);
  });

  // -------------------------------------------------------------------------
  // 6. conflicting-handbook-versions (end-to-end through the real orchestrator)
  // -------------------------------------------------------------------------
  const { server, port } = await startFixtureServer();
  try {
    await section("6. conflicting-handbook-versions (end-to-end, synthetic fixture server)", async () => {
      const university = buildFixtureUniversity(port);
      const outcome = await discoverOneSubject(university, { code: "TST1001", name: null }, "2026", "src-conflict-year-1");

      check("subject was still extracted despite the year conflict (never blocked outright)", outcome.sourcePackage?.subjects.length === 1);
      check("quality report flags the academic-year dimension as Low", outcome.queryResult.quality?.dimensions.academicYear === "Low");

      const sourceConflicts = outcome.sourcePackage?.conflicts ?? [];
      const conflict = sourceConflicts.find((c) => c.kind === "conflicting-handbook-versions");
      check("conflicting-handbook-versions conflict raised on the source package", !!conflict);
      check("conflict lists both detected years as options", (conflict?.options.length ?? 0) >= 2);

      if (outcome.sourcePackage) {
        const merged = mergeSourcePackages([outcome.sourcePackage], [], META, "2026-01-01T00:00:00.000Z");
        const mergedConflict = merged.conflicts.find((c) => c.kind === "conflicting-handbook-versions");
        check("conflict survives mergeSourcePackages and blocks Apply", !!mergedConflict && unresolvedConflictCount(merged) > 0);
        if (mergedConflict) {
          const resolved = resolveConflict(merged, mergedConflict.id, mergedConflict.options[0].label);
          check("resolving records the acknowledgement and unblocks Apply", unresolvedConflictCount(resolved) === 0);
        }
      }
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
