/**
 * Phase 18A end-to-end verification harness (Part 13).
 *
 * This is NOT part of the app build/dev path — it is a standalone Node
 * script that imports the REAL src/import/* and src/lib/persistence.ts
 * modules directly and drives them with the fixtures in fixtures/phase18a/,
 * proving the actual pipeline works (upload -> extract -> normalize ->
 * review -> apply -> reload) rather than just typechecking.
 *
 * Run with (from the repo root, Node 20+):
 *   npx esbuild scripts/verify-phase18a-import.ts --bundle --platform=node \
 *     --format=esm --outfile=.tmp/verify-phase18a-import.mjs --alias:jszip=jszip
 *   node .tmp/verify-phase18a-import.mjs
 *
 * `esbuild` and `jszip` are not declared devDependencies of this project —
 * they are present on disk as transitive dependencies of vite/mammoth. This
 * script is a one-off verification artefact, not part of `npm run build`;
 * if it should become a permanent regression check, add both as explicit
 * devDependencies first (see the Phase 18A completion report's "known
 * limitations" section).
 *
 * PDF/DOCX scope note: neither `pdfExtract.ts` nor `docxExtract.ts` is
 * imported literally here. `pdfExtract.ts` imports the browser build of
 * pdfjs-dist plus a Vite-only `?url` asset import, neither of which resolve
 * under plain Node; this harness re-implements `extractPdfPages`'s exact
 * loop against pdf.js's Node-targeted "legacy" build instead. `docxExtract.ts`
 * calls `mammoth.extractRawText({ arrayBuffer: bytes })` — correct in the
 * browser, where Vite applies mammoth's package.json `"browser"` field remap
 * to a browser-safe unzip implementation that reads `arrayBuffer` (see that
 * file's own comment) — but under plain Node, `require("mammoth")` resolves
 * to mammoth's Node-targeted unzip implementation instead, which expects
 * `{ buffer }`, not `{ arrayBuffer }`. So this harness calls
 * `mammoth.extractRawText({ buffer })` directly. In both PDF and DOCX cases,
 * what's actually proven here is that the real binary-format libraries can
 * genuinely extract text from a real file, and that the shared, unmodified
 * `parseSyllabusText()` deterministic engine — 100% of the interesting logic,
 * identical across all three document providers — handles that text
 * correctly. The browser-specific wiring in pdfExtract.ts/docxExtract.ts
 * themselves is covered structurally by `tsc -b`, lint, and the production
 * build (which code-splits both into their own chunks) rather than by a
 * literal Node execution of those two files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as JSZipModule from "jszip";
import * as pdfjsLegacy from "pdfjs-dist/legacy/build/pdf.mjs";

import { ImportError } from "../src/import/types";
import { ingestFile, findDuplicate } from "../src/import/ingestion";
import { createTextDocumentProvider } from "../src/import/providers/textProvider";
import { createIcsCalendarProvider } from "../src/import/providers/icsProvider";
import { createStructuredJsonProvider } from "../src/import/providers/jsonProvider";
import { createManualCompletionProvider } from "../src/import/providers/manualProvider";
import { PLACEHOLDER_PROVIDERS } from "../src/import/providers/placeholders";
import { createProviderRegistry, findProviderForKind } from "../src/import/providers/registry";
import mammothForVerification from "mammoth";
import { runImport } from "../src/import/importManager";
import { mergeSourcePackages, resolveConflict, unresolvedConflictCount } from "../src/import/merge/mergeEngine";
import { reconcileWithLiveSemester } from "../src/import/merge/reconcile";
import { parseSyllabusText } from "../src/import/extraction/syllabusParser";
import {
  createEmptySelection,
  validateForApply,
  buildApplyDiff,
  applySemesterImport,
} from "../src/import/applyImport";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";

const JSZip: any = (JSZipModule as any).default ?? JSZipModule;

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

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

function eq(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures/phase18a");

function fixturePath(rel: string): string {
  return path.join(FIXTURES_DIR, rel);
}

function readFixtureText(rel: string): string {
  return fs.readFileSync(fixturePath(rel), "utf-8");
}

async function fileFromDisk(rel: string): Promise<File> {
  const abs = fixturePath(rel);
  const bytes = fs.readFileSync(abs);
  const name = path.basename(abs);
  return new File([bytes], name);
}

function fileFromBytes(bytes: Uint8Array | Buffer, name: string): File {
  return new File([bytes], name);
}

const META = {
  institution: "Example University",
  degree: null,
  major: null,
  academicYear: "2026",
  semesterName: "Semester 2",
  campus: null,
};

// ---------------------------------------------------------------------------
// Minimal fixture generators (DOCX via jszip, PDF hand-rolled) — kept here,
// not shipped app code, so the shared parser can be proven against two more
// real binary formats without hand-authoring large binary fixtures by hand.
// ---------------------------------------------------------------------------

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function buildMinimalDocx(lines: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", RELS_XML);
  const body = lines
    .map((l) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(l)}</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal, deliberately lenient single-page PDF (no real xref table — pdf.js falls back to scanning objects, verified against this exact trick beforehand). */
function buildMinimalPdf(lines: string[]): Uint8Array {
  const ops: string[] = ["BT", "/F1 11 Tf", "72 730 Td", "13 TL"];
  lines.forEach((line, i) => {
    if (i > 0) ops.push("T*");
    ops.push(`(${pdfEscape(line)}) Tj`);
  });
  ops.push("ET");
  const content = ops.join("\n");
  const contentBytes = new TextEncoder().encode(content);

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  objects.forEach((obj, i) => {
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  body += `5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream\nendobj\n`;
  body += `xref\n0 6\n0000000000 65535 f \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF`;
  return new TextEncoder().encode(body);
}

/** Equivalent logic to src/import/providers/pdfExtract.ts's extractPdfPages — see file header for why this isn't a literal import. */
async function extractPdfPagesForVerification(
  bytes: ArrayBuffer,
  signal: AbortSignal
): Promise<Array<{ page: number; text: string }>> {
  const loadingTask = (pdfjsLegacy as any).getDocument({ data: bytes, disableWorker: true, isEvalSupported: false });
  const doc = await loadingTask.promise;
  const pages: Array<{ page: number; text: string }> = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    if (signal.aborted) {
      await loadingTask.destroy();
      throw new DOMException("Import cancelled", "AbortError");
    }
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pages.push({ page: pageNumber, text });
  }
  await loadingTask.destroy();
  return pages;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. File ingestion & safety layer -----------------------------------
  await section("1. File ingestion & safety layer", async () => {
    const clean = await fileFromDisk("syllabus/clean-syllabus.txt");
    const ingestedClean = await ingestFile(clean, "src-ingest-1");
    check("sniffs .txt as text", ingestedClean.input.kind === "text");
    check("content hash is 64 hex chars", /^[0-9a-f]{64}$/.test(ingestedClean.contentHash));
    check("decodes text content", (ingestedClean.input.text ?? "").includes("XYZ1000"));

    const json = await fileFromDisk("json/uncertain-fields.json");
    const ingestedJson = await ingestFile(json, "src-ingest-2");
    check("sniffs .json as json", ingestedJson.input.kind === "json");

    const ics = await fileFromDisk("calendar/valid-recurring.ics");
    const ingestedIcs = await ingestFile(ics, "src-ingest-3");
    check("sniffs .ics as ics", ingestedIcs.input.kind === "ics");

    // Duplicate detection: two independent File objects, identical bytes.
    const cleanAgain = await fileFromDisk("syllabus/clean-syllabus.txt");
    const ingestedCleanAgain = await ingestFile(cleanAgain, "src-ingest-1b");
    const dup = findDuplicate(ingestedCleanAgain.contentHash, [
      { sourceId: ingestedClean.input.sourceId, filename: ingestedClean.input.filename, contentHash: ingestedClean.contentHash },
    ]);
    check("duplicate file detected by content hash", dup?.sourceId === "src-ingest-1");

    // Corrupted file: invalid UTF-8 bytes claiming to be .txt.
    try {
      await ingestFile(fileFromBytes(Uint8Array.from([0x80, 0x81, 0xff]), "bad.txt"), "src-bad-1");
      check("corrupted file throws", false);
    } catch (error) {
      check("corrupted file throws corrupted-file", error instanceof ImportError && error.code === "corrupted-file");
    }

    // Unsupported file type.
    try {
      await ingestFile(fileFromBytes(Uint8Array.from([0, 1, 2, 3]), "notes.xyz"), "src-bad-2");
      check("unsupported file type throws", false);
    } catch (error) {
      check("unsupported file type throws unsupported-file-type", error instanceof ImportError && error.code === "unsupported-file-type");
    }

    // Empty file.
    try {
      await ingestFile(fileFromBytes(new Uint8Array(0), "empty.txt"), "src-bad-3");
      check("empty file throws", false);
    } catch (error) {
      check("empty file throws empty-file", error instanceof ImportError && error.code === "empty-file");
    }

    // File too large (> 2MB text limit).
    try {
      const big = "a".repeat(2 * 1024 * 1024 + 10);
      await ingestFile(fileFromBytes(new TextEncoder().encode(big), "big.txt"), "src-bad-4");
      check("oversized file throws", false);
    } catch (error) {
      check("oversized file throws file-too-large", error instanceof ImportError && error.code === "file-too-large");
    }
  });

  // 2. Clean syllabus extraction ----------------------------------------
  const textProvider = createTextDocumentProvider(() => null);
  let cleanPkg: any;
  await section("2. Clean syllabus extraction (text provider)", async () => {
    const ingested = await ingestFile(await fileFromDisk("syllabus/clean-syllabus.txt"), "src-clean-1");
    cleanPkg = await textProvider.extract(ingested.input, ctx());
    const subject = cleanPkg.subjects[0];
    check("subject code (label match, high confidence)", subject.code === "XYZ1000" && subject.fieldConfidence.code === "high");
    check("subject name (label match, high confidence)", subject.name === "Systems Analysis and Design" && subject.fieldConfidence.name === "high");
    check("coordinator", subject.coordinator === "Dr Alex Rivera");
    check("3 modules found", subject.modules.length === 3);
    check("module week numbers 1-3", subject.modules.map((m: any) => m.weekNumber).join(",") === "1,2,3");
    check("2 readings found (attached to the nearest preceding module, week 3)", subject.modules[2].readings.length === 2);
    check("4 assessments found", subject.assessments.length === 4);

    const a1 = subject.assessments.find((a: any) => a.title === "Portfolio of Wireframes");
    check("A1 weighting 30", a1?.weighting === 30);
    check("A1 exact date+time+tz", a1?.due?.isoDate === "2026-08-09" && a1?.due?.isoTime === "23:59" && a1?.due?.sourceTimezone === "AEST");

    const a2 = subject.assessments.find((a: any) => a.title === "Final Report and Prototype");
    check("A2 weighting 40", a2?.weighting === 40);
    check("A2 date-only, no invented time", a2?.due?.isoDate === "2026-08-16" && a2?.due?.isoTime === null);

    const a3 = subject.assessments.find((a: any) => a.title === "Reflective Practice Journal Entry");
    check("A3 weighting 10", a3?.weighting === 10);
    check("A3 week-only, never resolved to a date", a3?.due?.dateKind === "week_only" && a3?.due?.weekNumber === 8 && a3?.due?.isoDate === null);
    check("week-only-date warning raised", cleanPkg.warnings.some((w: any) => w.kind === "week-only-date"));

    const a4 = subject.assessments.find((a: any) => a.title === "Case Study Exercise");
    check("A4 weighting 5", a4?.weighting === 5);
    check("A4 example date correctly excluded (due stays null)", a4?.due === null);
  });

  // 3. No-dates syllabus --------------------------------------------------
  await section("3. Syllabus with no dates", async () => {
    const ingested = await ingestFile(await fileFromDisk("syllabus/no-dates-syllabus.txt"), "src-nodates-1");
    const pkg = await textProvider.extract(ingested.input, ctx());
    const subject = pkg.subjects[0];
    check("subject code DEF3000", subject.code === "DEF3000");
    check("2 assessments, both dateless", subject.assessments.length === 2 && subject.assessments.every((a: any) => a.due === null));
    const merged = mergeSourcePackages([pkg], [], META, "2026-01-01T00:00:00.000Z");
    eq("uncertainDeadlines counted, nothing invented", merged.extractionSummary.uncertainDeadlines, 2);
  });

  // 4. Messy syllabus -------------------------------------------------------
  let messyPkg: any;
  await section("4. Messy syllabus (irregular formatting)", async () => {
    const ingested = await ingestFile(await fileFromDisk("syllabus/messy-syllabus.txt"), "src-messy-1");
    messyPkg = await textProvider.extract(ingested.input, ctx());
    const subject = messyPkg.subjects[0];
    check("subject code ABC2000 despite messy layout", subject.code === "ABC2000");
    check("2 modules found despite irregular spacing", subject.modules.length === 2);
    const a1 = subject.assessments.find((a: any) => a.title === "Data Cleaning Exercise");
    check("assignment weighting 15 from '15  %'", a1?.weighting === 15);
    check("assignment date from 9/8/26 (AU day/month/year)", a1?.due?.isoDate === "2026-08-09");
    const a2 = subject.assessments.find((a: any) => a.title === "Reflective Practice Journal Entry");
    check("second assessment weighting 12", a2?.weighting === 12);
    check("second assessment date from 09/08/2026", a2?.due?.isoDate === "2026-08-09");
  });

  // 5. Cross-source merge conflict + resolution ----------------------------
  await section("5. Cross-source conflict (two syllabus versions)", async () => {
    const a = await textProvider.extract((await ingestFile(await fileFromDisk("syllabus/conflicting-a.txt"), "src-conf-a")).input, ctx());
    const b = await textProvider.extract((await ingestFile(await fileFromDisk("syllabus/conflicting-b.txt"), "src-conf-b")).input, ctx());
    const merged = mergeSourcePackages([a, b], [], META, "2026-01-01T00:00:00.000Z");

    check("one subject (matched by code)", merged.subjects.length === 1);
    check("one assessment (matched by title)", merged.subjects[0].assessments.length === 1);
    const assessment = merged.subjects[0].assessments[0];
    check("weighting nulled pending resolution, not guessed", assessment.weighting === null && assessment.fieldConfidence.weighting === "conflicting");
    check("date nulled pending resolution, not guessed", assessment.due?.isoDate === null && assessment.due?.dateKind === "source_conflict");

    const weightConflict = merged.conflicts.find((c: any) => c.kind === "weight-mismatch");
    const dateConflict = merged.conflicts.find((c: any) => c.kind === "date-mismatch");
    check("weight-mismatch conflict raised with both sources", !!weightConflict && weightConflict.options.length === 2);
    check("date-mismatch conflict raised with both sources", !!dateConflict && dateConflict.options.length === 2);
    check("2 unresolved conflicts block apply", unresolvedConflictCount(merged) === 2);

    let resolved = resolveConflict(merged, weightConflict.id, weightConflict.options[1].label);
    resolved = resolveConflict(resolved, dateConflict.id, dateConflict.options[1].label);
    const resolvedAssessment = resolved.subjects[0].assessments[0];
    check("resolving weight-mismatch writes the chosen value back", resolvedAssessment.weighting === 35 && resolvedAssessment.fieldConfidence.weighting === "confirmed");
    check("resolving date-mismatch writes the chosen value back", resolvedAssessment.due?.isoDate === "2026-08-16" && resolvedAssessment.fieldConfidence.dueDate === "confirmed");
    check("0 unresolved conflicts after resolution", unresolvedConflictCount(resolved) === 0);
  });

  // 6. Cross-subject duplicate-assessment-name -----------------------------
  await section("6. Cross-subject duplicate assessment name", async () => {
    const merged = mergeSourcePackages([cleanPkg, messyPkg], [], META, "2026-01-01T00:00:00.000Z");
    check("two distinct subjects kept separate", merged.subjects.length === 2);
    const dupConflict = merged.conflicts.find((c: any) => c.kind === "duplicate-assessment-name");
    check("duplicate-assessment-name conflict raised across subjects", !!dupConflict);
  });

  // 7. ICS: valid recurring calendar ---------------------------------------
  const icsProvider = createIcsCalendarProvider();
  await section("7. ICS: valid recurring calendar", async () => {
    const ingested = await ingestFile(await fileFromDisk("calendar/valid-recurring.ics"), "src-ics-1");
    const pkg = await icsProvider.extract(ingested.input, ctx());
    check("2 events parsed, 1 skipped (missing SUMMARY)", pkg.calendarEvents.length === 2);
    check("skip produces a warning, not a crash", pkg.warnings.some((w: any) => w.kind === "unparsable-file"));

    const lecture = pkg.calendarEvents.find((e: any) => e.title === "XYZ1000 Lecture");
    check("recurrence preserved verbatim, not expanded", lecture?.recurrence === "FREQ=WEEKLY;COUNT=12;BYDAY=MO");
    check("lecture classified correctly", lecture?.eventType === "lecture");
    check("subject code extracted from location", lecture?.subjectCode === "XYZ1000");
    check("date+time parsed, no timezone given", lecture?.start.isoDate === "2026-08-03" && lecture?.start.isoTime === "09:00");

    const exam = pkg.calendarEvents.find((e: any) => String(e.title).includes("Examination"));
    check('"Examination" (not just "Exam") classified correctly', exam?.eventType === "exam");
  });

  // 8. ICS: malformed file --------------------------------------------------
  await section("8. ICS: malformed calendar file", async () => {
    const ingested = await ingestFile(await fileFromDisk("calendar/malformed.ics"), "src-ics-bad");
    try {
      await icsProvider.extract(ingested.input, ctx());
      check("malformed ICS throws", false);
    } catch (error) {
      check("malformed ICS throws parse-failed", error instanceof ImportError && error.code === "parse-failed");
    }
  });

  // 9. Calendar-disagrees-with-syllabus conflict ---------------------------
  await section("9. Calendar event disagrees with syllabus due date", async () => {
    const acIngested = await ingestFile(await fileFromDisk("calendar/assessment-conflict.ics"), "src-ics-ac");
    const acPkg = await icsProvider.extract(acIngested.input, ctx());
    check("1 assessment-due event parsed", acPkg.calendarEvents.length === 1 && acPkg.calendarEvents[0].eventType === "assessment-due");

    const cleanIngested2 = await ingestFile(await fileFromDisk("syllabus/clean-syllabus.txt"), "src-clean-2");
    const cleanPkg2 = await textProvider.extract(cleanIngested2.input, ctx());
    const merged = mergeSourcePackages([cleanPkg2, acPkg], [], META, "2026-01-01T00:00:00.000Z");

    check("calendar event folded into the assessment, not left standalone", merged.calendarEvents.length === 0);
    const foldConflict = merged.conflicts.find((c: any) => c.kind === "date-mismatch" && String(c.summary).includes("calendar file"));
    check("disagreement raised as a conflict, not silently picked", !!foldConflict);
    const portfolio = merged.subjects[0].assessments.find((a: any) => a.title === "Portfolio of Wireframes");
    check("original syllabus date untouched pending resolution", portfolio?.due?.isoDate === "2026-08-09");

    const resolved = resolveConflict(merged, foldConflict.id, foldConflict.options[1].label);
    const portfolioResolved = resolved.subjects[0].assessments.find((a: any) => a.title === "Portfolio of Wireframes");
    check("resolving in favour of the calendar updates the date", portfolioResolved?.due?.isoDate === "2026-08-10" && portfolioResolved?.fieldConfidence.dueDate === "confirmed");
  });

  // 10. Structured JSON: uncertain fields -----------------------------------
  const jsonProvider = createStructuredJsonProvider();
  await section("10. Structured JSON: uncertain/missing fields", async () => {
    const ingested = await ingestFile(await fileFromDisk("json/uncertain-fields.json"), "src-json-uf");
    const pkg = await jsonProvider.extract(ingested.input, ctx());
    const merged = mergeSourcePackages([pkg], [], META, "2026-01-01T00:00:00.000Z");
    eq("subjectsFound", merged.extractionSummary.subjectsFound, 1);
    eq("assessmentsFound", merged.extractionSummary.assessmentsFound, 2);
    eq("uncertainDeadlines", merged.extractionSummary.uncertainDeadlines, 2);
    eq("missingFieldsCount", merged.extractionSummary.missingFieldsCount, 3);
    eq("confirmedDeadlines", merged.extractionSummary.confirmedDeadlines, 0);
  });

  // 11. Reconcile against the live semester + gated Apply -------------------
  let defaultSave: any;
  await section("11. Reconcile vs. live confirmed data + gated Apply", async () => {
    defaultSave = createDefaultSaveData();
    const ingested = await ingestFile(await fileFromDisk("json/cwa-conflict.json"), "src-json-cwa");
    const cwaPkg = await jsonProvider.extract(ingested.input, ctx());
    const cwaMerged = mergeSourcePackages([cwaPkg], [], META, "2026-01-01T00:00:00.000Z");

    const { pkg: reconciled, subjectMappings } = reconcileWithLiveSemester(cwaMerged, defaultSave.semester);
    check(
      "exact-code subject mapping suggested",
      subjectMappings[0]?.mapping.confidence === "exact-code" && subjectMappings[0]?.mapping.subjectId === "cloud-based-web-application-development"
    );

    const weightConf = reconciled.conflicts.find((c: any) => c.kind === "weight-mismatch");
    const dateConf = reconciled.conflicts.find((c: any) => c.kind === "date-mismatch");
    check("weight conflict raised vs already-confirmed live value", !!weightConf);
    check("date conflict raised vs already-confirmed live value", !!dateConf);

    let selection = createEmptySelection();
    selection = { ...selection, subjectMapping: { [reconciled.subjects[0].temporaryId]: "cloud-based-web-application-development" } };

    let validation = validateForApply(reconciled, selection);
    check("Apply blocked while these conflicts are unresolved (no Import-Everything)", validation.ok === false);

    let resolved = resolveConflict(reconciled, weightConf.id, weightConf.options[0].label);
    resolved = resolveConflict(resolved, dateConf.id, dateConf.options[1].label);
    validation = validateForApply(resolved, selection);
    check("Apply unblocked once every conflict has a decision", validation.ok === true);

    const diff = buildApplyDiff(resolved, selection, defaultSave);
    const assessmentDiff = diff.entries.find((e: any) => e.kind === "assessment");
    check("confirmed live assessment reported as unchanged, not overwritten", assessmentDiff?.action === "skipped");

    const liveCwaBefore = defaultSave.semester.subjects.find((s: any) => s.id === "cloud-based-web-application-development");
    const before = JSON.parse(JSON.stringify(liveCwaBefore.assessments.find((a: any) => a.title.includes("HealthCoverSim"))));
    const beforeModuleCount = liveCwaBefore.modules.length;

    const applied = applySemesterImport(defaultSave, resolved, selection);
    const liveCwaAfter = applied.semester.subjects.find((s: any) => s.id === "cloud-based-web-application-development");
    const after = liveCwaAfter.assessments.find((a: any) => a.title.includes("HealthCoverSim"));
    eq("confirmed weight/date NEVER overwritten by a disputed import, even after 'resolving'", { weight: after.weight, dueDate: after.dueDate }, { weight: before.weight, dueDate: before.dueDate });
    check("module count never shrinks", liveCwaAfter.modules.length >= beforeModuleCount);
  });

  // 12. Manual completion provider -------------------------------------------
  await section("12. Manual completion provider", async () => {
    const manualProvider = createManualCompletionProvider();
    const payload = {
      subjectCode: null,
      subjectName: "Manual Add-on",
      assessmentTitle: "Pop Quiz",
      weighting: 5,
      dueDate: "2026-09-01",
      dueTime: "09:00",
      submissionMethod: null,
    };
    const input = { sourceId: "src-manual-1", filename: "Manual entry", kind: "json" as const, bytes: null, text: JSON.stringify(payload) };
    const pkg = await manualProvider.extract(input, ctx());
    check("manual entry produces one subject/assessment", pkg.subjects.length === 1 && pkg.subjects[0].assessments.length === 1);
    check("manual entry is always confirmed (the user typed it)", pkg.subjects[0].assessments[0].confidence === "confirmed");
  });

  // 13/14. Old save with progress: compatibility + preservation + reminders -
  let oldSave: any;
  const targetAssessmentId = () => oldSave.semester.subjects[0].assessments[0].id;
  await section("13. Old-save fixture: sanitize/compatibility", async () => {
    oldSave = JSON.parse(JSON.stringify(createDefaultSaveData()));
    oldSave.assessmentProgress = oldSave.assessmentProgress.map((p: any) =>
      p.assessmentId === targetAssessmentId() ? { ...p, status: "in_progress", hoursCompleted: 5, progressPercent: 40 } : p
    );
    oldSave.tasks = oldSave.tasks.map((t: any, i: number) => (i === 0 ? { ...t, completed: true, completedAt: "2026-06-01T00:00:00.000Z" } : t));
    oldSave.reminders = [
      {
        id: "existing-reminder-1",
        kind: "study-session",
        title: "Pre-existing reminder",
        subjectId: null,
        assessmentId: null,
        offsetIso: null,
        fireAt: "2026-07-01T09:00",
        sourceWindow: "manual",
        status: "pending",
        snoozedUntil: null,
        notifiedAt: null,
        origin: "user",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    delete oldSave.personalGoals; // simulate a save captured before Phase 18A
    delete oldSave.settings.semesterSetupOffered;

    fs.mkdirSync(fixturePath("saves"), { recursive: true });
    fs.writeFileSync(fixturePath("saves/old-save-with-progress.json"), JSON.stringify(oldSave, null, 2));

    const reloaded = sanitizeSaveData(JSON.parse(readFixtureText("saves/old-save-with-progress.json")));
    check("missing personalGoals backfilled with defaults", reloaded.personalGoals && typeof reloaded.personalGoals === "object");
    check("missing settings.semesterSetupOffered backfilled to false", reloaded.settings.semesterSetupOffered === false);
    check("existing assessment progress preserved", reloaded.assessmentProgress.find((p: any) => p.assessmentId === targetAssessmentId())?.hoursCompleted === 5);
    check("existing task completion preserved", reloaded.tasks[0].completed === true);
    check("existing reminder preserved", reloaded.reminders.some((r: any) => r.id === "existing-reminder-1"));
    oldSave = reloaded;
  });

  await section("14. Apply onto the old save: progress/grades/reminders", async () => {
    const ingested = await ingestFile(await fileFromDisk("json/cwa-conflict.json"), "src-json-cwa-2");
    const cwaPkg = await jsonProvider.extract(ingested.input, ctx());
    const icsIngested = await ingestFile(await fileFromDisk("calendar/valid-recurring.ics"), "src-ics-2");
    const icsPkg = await icsProvider.extract(icsIngested.input, ctx());
    const merged = mergeSourcePackages([cwaPkg, icsPkg], [], META, "2026-01-01T00:00:00.000Z");

    const { pkg: reconciled } = reconcileWithLiveSemester(merged, oldSave.semester);
    let selection = createEmptySelection();
    selection = { ...selection, subjectMapping: { [reconciled.subjects[0].temporaryId]: "cloud-based-web-application-development" } };
    let resolved = reconciled;
    for (const c of resolved.conflicts.filter((c: any) => c.resolution === null)) {
      resolved = resolveConflict(resolved, c.id, c.options[0].label);
    }
    check("all conflicts resolvable before apply", validateForApply(resolved, selection).ok === true);

    const remindersBefore = oldSave.reminders.length;
    const applied = applySemesterImport(oldSave, resolved, selection);

    check("existing assessment progress survives Apply", applied.assessmentProgress.find((p: any) => p.assessmentId === targetAssessmentId())?.hoursCompleted === 5);
    check("existing task completion survives Apply", applied.tasks[0].completed === true);
    check("pre-existing reminder survives Apply", applied.reminders.some((r: any) => r.id === "existing-reminder-1"));
    check(
      "standalone confirmed calendar events become new reminders (2 added)",
      applied.reminders.length === remindersBefore + reconciled.calendarEvents.length && reconciled.calendarEvents.length === 2
    );
    const lectureReminder = applied.reminders.find((r: any) => r.title === "XYZ1000 Lecture");
    check("reminder fire time uses the real given time, never invented", lectureReminder?.fireAt === "2026-08-03T09:00");
  });

  // 15. Reminder fallback trigger time for a date-only calendar event --------
  await section("15. Standalone calendar event with no time uses the documented 09:00 fallback (never a due-time invention)", async () => {
    const acIngested = await ingestFile(await fileFromDisk("calendar/assessment-conflict.ics"), "src-ics-fallback");
    const acPkg = await icsProvider.extract(acIngested.input, ctx());
    check("event has no time in the source", acPkg.calendarEvents[0].start.isoTime === null);
    const selection = createEmptySelection();
    const applied = applySemesterImport(oldSave, { ...acPkg, subjects: [], conflicts: [], warnings: [], sourceFiles: [], provider: [acPkg.providerId], importId: "x", createdAt: "2026-01-01T00:00:00.000Z", institution: null, degree: null, major: null, academicYear: null, semesterName: null, campus: null, extractionSummary: { subjectsFound: 0, modulesFound: 0, assessmentsFound: 0, calendarEventsFound: 1, confirmedDeadlines: 0, uncertainDeadlines: 0, conflictsFound: 0, missingFieldsCount: 0 } } as any, selection);
    const reminder = applied.reminders.find((r: any) => r.title === acPkg.calendarEvents[0].title);
    check("fallback reminder trigger time is 09:00 (a reminder needs some trigger, unlike an assessment due-time)", reminder?.fireAt?.endsWith("T09:00"));
  });

  // 16. Pure-reducer non-mutation (the property that makes rollback correct) -
  await section("16. applySemesterImport never mutates its input (rollback correctness)", async () => {
    const before = createDefaultSaveData();
    const beforeSnapshot = JSON.stringify(before);
    const pkg = { subjects: [], calendarEvents: [], conflicts: [], warnings: [], sourceFiles: [], provider: [], importId: "x", createdAt: "2026-01-01T00:00:00.000Z", institution: null, degree: null, major: null, academicYear: null, semesterName: null, campus: null, extractionSummary: { subjectsFound: 0, modulesFound: 0, assessmentsFound: 0, calendarEventsFound: 0, confirmedDeadlines: 0, uncertainDeadlines: 0, conflictsFound: 0, missingFieldsCount: 0 } } as any;
    applySemesterImport(before, pkg, createEmptySelection());
    check("input save object is byte-identical after Apply (never mutated in place)", JSON.stringify(before) === beforeSnapshot);

    // A malformed candidate (assessments not an array) should throw a plain
    // TypeError rather than silently continue — SaveDataContext's try/catch
    // around this call is what makes that recoverable; here we confirm the
    // reducer itself never partially mutates `before` even when it throws.
    const brokenPkg = {
      ...pkg,
      subjects: [{ temporaryId: "t1", assessments: null, modules: null, code: null, name: "Broken", coordinator: null, creditPoints: null, teachingPeriod: null, colourSuggestion: null, readings: [], goals: [], sourceReferences: [], confidence: "confirmed", fieldConfidence: {} }],
    };
    const selection = { subjectMapping: { t1: "cloud-based-web-application-development" }, excludedIds: new Set<string>() };
    let threw = false;
    try {
      applySemesterImport(before, brokenPkg as any, selection);
    } catch {
      threw = true;
    }
    check("malformed candidate throws rather than silently corrupting data", threw);
    check("save is still byte-identical after the forced throw", JSON.stringify(before) === beforeSnapshot);
  });

  // 17. Backup + undo primitives (localStorage polyfill) ---------------------
  await section("17. Backup + undo primitives", async () => {
    const store = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    const persistence = await import("../src/lib/persistence");
    const original = createDefaultSaveData();
    persistence.backupCurrentSave(original);
    persistence.markImportBackupKind("semester-import");
    check("backup written", persistence.hasImportBackup() === true);
    check("backup kind recorded", persistence.getImportBackupKind() === "semester-import");

    const restored = sanitizeSaveData(JSON.parse(store.get(persistence.IMPORT_BACKUP_KEY)!));
    eq("undo restores an exact round-trip of the pre-import save", restored, sanitizeSaveData(JSON.parse(JSON.stringify(original))));
    delete (globalThis as any).window;
  });

  // 18. DOCX: real mammoth extraction -----------------------------------------
  await section("18. DOCX: real mammoth text extraction", async () => {
    const lines = readFixtureText("syllabus/clean-syllabus.txt").split(/\r?\n/).filter((l) => l.length > 0);
    const docxBuffer = await buildMinimalDocx(lines);
    fs.writeFileSync(fixturePath("syllabus/clean-syllabus.docx"), docxBuffer);
    const result = await (mammothForVerification as any).extractRawText({ buffer: docxBuffer });
    const extracted: string = result.value;
    check("mammoth extracted non-trivial text from a real .docx", extracted.length > 100);
    check("extracted text contains the unit code", extracted.includes("XYZ1000"));

    const { subject } = parseSyllabusText(extracted, { sourceId: "src-docx-1", filename: "clean-syllabus.docx", contextYear: null });
    check("shared parser reads the real docx-extracted text correctly", subject.code === "XYZ1000" && subject.assessments.length === 4);
  });

  // 19. PDF: real pdf.js extraction (equivalent logic, see file header) ------
  await section("19. PDF: real pdf.js text extraction", async () => {
    const lines = readFixtureText("syllabus/clean-syllabus.txt").split(/\r?\n/).filter((l) => l.length > 0);
    const pdfBytes = buildMinimalPdf(lines);
    fs.writeFileSync(fixturePath("syllabus/clean-syllabus.pdf"), pdfBytes);
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const pages = await extractPdfPagesForVerification(arrayBuffer, new AbortController().signal);
    check("1 page extracted from a real PDF", pages.length === 1);
    const joined = pages.map((p) => p.text).join("\n\n");
    check("line breaks preserved (hasEOL fix) — multiple headings present", (joined.match(/^Assessment \d/gm) ?? []).length === 4);

    const { subject } = parseSyllabusText(joined, { sourceId: "src-pdf-1", filename: "clean-syllabus.pdf", contextYear: null });
    check("shared parser reads the real PDF-extracted text correctly", subject.code === "XYZ1000" && subject.assessments.length === 4);
  });

  // 20. Placeholder providers never fake availability ------------------------
  await section("20. Placeholder providers (web/LMS) are honest about being unconfigured", async () => {
    for (const p of PLACEHOLDER_PROVIDERS) {
      check(`${p.id}: capabilities.configured === false`, p.capabilities.configured === false);
      check(`${p.id}: isAvailable() === false`, (await p.isAvailable()) === false);
      try {
        await p.extract({ sourceId: "x", filename: "x", kind: "json", bytes: null, text: "{}" }, ctx());
        check(`${p.id}: extract() throws rather than pretending to work`, false);
      } catch (error) {
        check(`${p.id}: extract() throws not-configured`, error instanceof ImportError && error.code === "not-configured");
      }
    }
  });

  // 21. Multi-file import through the real provider registry + progress -----
  await section("21. Multi-file import via runImport() + progress reporting", async () => {
    const registry = createProviderRegistry(() => 2026);
    check("PDF routes to the PDF provider", findProviderForKind(registry, "pdf")?.id === "pdf-document");
    check("ICS routes to the ICS provider", findProviderForKind(registry, "ics")?.id === "ics-calendar");

    const textIngested = await ingestFile(await fileFromDisk("syllabus/clean-syllabus.txt"), "src-multi-1");
    const icsIngested = await ingestFile(await fileFromDisk("calendar/valid-recurring.ics"), "src-multi-2");
    const progressEvents: any[] = [];
    const { results, pkg } = await runImport({
      providers: registry,
      inputs: [textIngested.input, icsIngested.input],
      sourceFiles: [],
      meta: META,
      signal: new AbortController().signal,
      onProgress: (e) => progressEvents.push(e),
    });
    check("both files processed successfully", results.every((r: any) => r.ok));
    check("combined package has both a subject and calendar events", pkg.subjects.length === 1 && pkg.calendarEvents.length === 2);
    check("progress events were reported", progressEvents.length > 0 && progressEvents.some((e) => e.fraction === 1));

    // Cancellation.
    const controller = new AbortController();
    controller.abort();
    const { results: cancelledResults } = await runImport({
      providers: registry,
      inputs: [textIngested.input],
      sourceFiles: [],
      meta: META,
      signal: controller.signal,
      onProgress: () => {},
    });
    check("cancelled run reports a cancelled error, not a crash", cancelledResults[0].error?.code === "cancelled");
  });

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
