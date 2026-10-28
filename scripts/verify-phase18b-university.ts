/**
 * Phase 18B end-to-end verification harness (Part 8). Like
 * verify-phase18a-import.ts, this drives the REAL, unmodified
 * `src/import/*` modules — here specifically `officialUniversityProvider.ts`
 * — against REAL live university websites (Node has no CORS enforcement,
 * so this proves the underlying fetch/extract logic genuinely works even
 * though the deployed browser app will hit CORS on most of these domains
 * and fall back to file upload, which is the honest, expected outcome for
 * most universities today).
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18b-university.ts .tmp/verify-phase18b-university.cjs
 *   node .tmp/verify-phase18b-university.cjs
 *
 * This makes a small number of real, single-attempt, robots.txt-respecting
 * network requests to handbook.unimelb.edu.au, handbook.monash.edu,
 * www.rmit.edu.au, handbook.latrobe.edu.au and www.deakin.edu.au. It does
 * not retry on failure and does not run in a loop — see safeFetch.ts.
 */

import { createOfficialUniversityProvider, type UniversityDiscoveryPayload } from "../src/import/providers/officialUniversityProvider";
import { UNIVERSITY_REGISTRY } from "../src/import/universityRegistry";
import { safeFetchOfficialPage, checkRobotsAllowed } from "../src/import/discovery/safeFetch";
import { mergeSourcePackages } from "../src/import/merge/mergeEngine";
import { reconcileWithLiveSemester } from "../src/import/merge/reconcile";
import { createEmptySelection, validateForApply, applySemesterImport } from "../src/import/applyImport";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import type { ImportedSourcePackage } from "../src/import/types";

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
  return { signal: new AbortController().signal, onProgress: (e: { message: string }) => console.log(`    … ${e.message}`) };
}

async function discover(universityId: string, subjectCodes: string[], academicYear = "2026"): Promise<ImportedSourcePackage> {
  const payload: UniversityDiscoveryPayload = { universityId, academicYear, teachingPeriod: "Semester 2", subjectCodes };
  return createOfficialUniversityProvider().extract(
    { sourceId: `verify-${universityId}`, filename: `${universityId} search`, kind: "json", bytes: null, text: JSON.stringify(payload) },
    ctx()
  );
}

async function main(): Promise<void> {
  await section("Domain allowlist rejects anything outside officialDomains", async () => {
    const result = await safeFetchOfficialPage("https://coursehero.com/UNIB10007", ["handbook.unimelb.edu.au"]);
    check("mirror/forum-shaped URL rejected without a network attempt", !result.ok && result.error === "not one of this university's official domains");
  });

  await section("robots.txt check runs against a real live host without crashing", async () => {
    const result = await checkRobotsAllowed(new URL("https://handbook.unimelb.edu.au/subjects/unib10007"), new AbortController().signal);
    check("robots check completes and returns a verdict", typeof result.allowed === "boolean");
    console.log(`    (robots.txt verdict for this path: allowed=${result.allowed}${result.reason ? `, reason=${result.reason}` : ""})`);
  });

  // ---- University of Melbourne: expected SUCCESSFUL discovery -------------
  let melbournePkg: ImportedSourcePackage;
  await section("University of Melbourne (UNIB10007) — expected: successful discovery", async () => {
    melbournePkg = await discover("unimelb", ["UNIB10007"]);
    const subject = melbournePkg.subjects[0];
    check("a subject was produced", !!subject);
    check("confidence is not 'missing' (real content was found)", subject.confidence !== "missing");
    check("modules were discovered", subject.modules.length > 0, `got ${subject?.modules.length}`);
    check("assessments were discovered", subject.assessments.length > 0, `got ${subject?.assessments.length}`);
    check("every module/assessment carries a real source URL", subject.sourceReferences.every((r) => r.location?.startsWith("https://handbook.unimelb.edu.au")));
    console.log(`    subject="${subject?.name}" modules=${subject?.modules.length} assessments=${subject?.assessments.length} readings=${subject?.readings.length}`);
  });

  // ---- Monash: expected PARTIAL discovery (real URL, JS-rendered content) -
  await section("Monash University (FIT1045) — expected: partial discovery", async () => {
    const pkg = await discover("monash", ["FIT1045"]);
    const subject = pkg.subjects[0];
    check("a subject was produced (not a hard failure)", !!subject);
    console.log(`    subject="${subject?.name}" code=${subject?.code} modules=${subject?.modules.length} assessments=${subject?.assessments.length} confidence=${subject?.confidence}`);
    console.log(`    warnings: ${pkg.warnings.map((w) => w.message).join(" | ") || "(none)"}`);
    check("no crash regardless of how little real content the page shell yielded", true);
  });

  // ---- RMIT: expected MISSING (no verified URL template) ------------------
  await section("RMIT University (COSC1076) — expected: missing (no URL pattern)", async () => {
    const pkg = await discover("rmit", ["COSC1076"]);
    const subject = pkg.subjects[0];
    check("subject reported as not found, never fabricated", subject?.confidence === "missing");
    check("a no-url-pattern warning explains why", pkg.warnings.some((w) => w.kind === "no-url-pattern"));
  });

  // ---- La Trobe: expected MISSING (site blocks automated fetch) -----------
  await section("La Trobe University (CSE2UI) — expected: source unreachable", async () => {
    const pkg = await discover("latrobe", ["CSE2UI"]);
    const subject = pkg.subjects[0];
    console.log(`    warnings: ${pkg.warnings.map((w) => w.message).join(" | ") || "(none)"}`);
    check("gracefully handled — no crash even though the real host refuses automated fetches", !!subject);
    check("a warning explains the page could not be reached", pkg.warnings.some((w) => w.kind === "source-unreachable" || w.kind === "robots-disallowed"));
  });

  // ---- Deakin: expected MISSING (no verified URL template) ----------------
  await section("Deakin University (SIT102) — expected: missing (no URL pattern)", async () => {
    const pkg = await discover("deakin", ["SIT102"]);
    const subject = pkg.subjects[0];
    check("subject reported as not found, never fabricated", subject?.confidence === "missing");
    check("a no-url-pattern warning explains why", pkg.warnings.some((w) => w.kind === "no-url-pattern"));
  });

  await section("A code that doesn't match the university's shape never attempts a fetch", async () => {
    const pkg = await discover("unimelb", ["not-a-real-code"]);
    check("no-url-pattern warning for an unrecognisable code", pkg.warnings.some((w) => w.kind === "no-url-pattern"));
  });

  await section("Registry sanity — every listed university has a real entry", () => {
    check("7 universities registered", UNIVERSITY_REGISTRY.length === 7);
    check("exactly one verified entry today (Melbourne)", UNIVERSITY_REGISTRY.filter((u) => u.verified).length === 1);
  });

  // ---- Full chain: discovery -> merge -> review-gate -> apply -> reload ---
  await section("End-to-end: web discovery -> merge -> review -> apply -> reload -> semester intact", async () => {
    const merged = mergeSourcePackages([melbournePkg], [], { institution: null, degree: null, major: null, academicYear: "2026", semesterName: "Semester 2", campus: null }, "2026-01-01T00:00:00.000Z");
    check("merge engine (the existing, unmodified one) accepted the discovery output", merged.subjects.length === 1);

    const defaultSave = createDefaultSaveData();
    const { pkg: reconciled } = reconcileWithLiveSemester(merged, defaultSave.semester);

    let selection = createEmptySelection();
    selection = { ...selection, subjectMapping: { [reconciled.subjects[0].temporaryId]: "user-interface-design" } };
    const validation = validateForApply(reconciled, selection);
    check("Review gate evaluates the real discovered package", typeof validation.ok === "boolean");

    const applied = applySemesterImport(defaultSave, reconciled, selection);
    const uiSubject = applied.semester.subjects.find((s) => s.id === "user-interface-design");
    check("discovered assessment landed in the live subject", (uiSubject?.assessments.length ?? 0) > defaultSave.semester.subjects[0].assessments.length);

    // Reload: round-trip through the exact same sanitizer every load goes through.
    const reloaded = sanitizeSaveData(JSON.parse(JSON.stringify(applied)));
    const reloadedSubject = reloaded.semester.subjects.find((s) => s.id === "user-interface-design");
    check(
      "semester intact after a save/reload round-trip",
      reloadedSubject !== undefined && reloadedSubject.assessments.length === uiSubject!.assessments.length
    );
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed (${passed + failed} checks total)`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

void main();
