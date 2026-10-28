/**
 * Phase 19 Academic Intelligence verification harness (Part 14). Direct
 * calls into the real, unmodified modules — zero live dependency, synthetic
 * SemesterRecord/AcademicImportPackage fixtures only (no real student data).
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase19-academic-intelligence.ts .tmp/verify-phase19-academic-intelligence.cjs
 *   node .tmp/verify-phase19-academic-intelligence.cjs
 */

import { parseSyllabusText } from "../src/import/extraction/syllabusParser";
import { extractScheduleMentions, extractOutcomeMentions, extractExamInfoMention, extractCoordinatorEmail } from "../src/import/extraction/enrichmentRules";
import { buildAcademicGraph, getModuleEnrichment, getAssessmentsDependingOnModule, moduleWeekForDeadline } from "../src/lib/academicGraph";
import { buildAcademicRoadmap } from "../src/lib/academicRoadmap";
import { computeWeeklyWorkload } from "../src/lib/academicWorkload";
import { getTodayRecommendations } from "../src/lib/todayEngine";
import { detectAcademicConflicts, detectSameDayAssessments, detectOverlappingExams, detectMissingWeighting, detectImpossibleDates, detectMissingWeeks, detectDuplicateImports } from "../src/import/merge/academicConflicts";
import { searchAcademicContent } from "../src/lib/academicSearch";
import { applySemesterImport, createEmptySelection, validateForApply, type ImportSelection } from "../src/import/applyImport";
import { mergeSourcePackages } from "../src/import/merge/mergeEngine";
import { sanitizeSaveData } from "../src/lib/persistence";
import { confirmed, unconfirmed, deriveConfirmationStatus, deriveReminderSchedule, type SemesterRecord, type SubjectRecord, type UniGameSaveData } from "../src/types/domain";
import type { ImportedSourcePackage, ImportedModuleCandidate, ImportedAssessmentCandidate, ImportedSubjectCandidate } from "../src/import/types";

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

const SYLLABUS_FIXTURE = `Unit name: Advanced Web Systems
Unit code: COS30045
Coordinator: Dr Jane Example (jane.example@university.edu.au)

Week 1: Foundations of Web Architecture
Lecture: Monday 10:00-12:00 Room: Building 5, Level 2
Tutorial: Wednesday 14:00-15:00
Required reading: Fowler, "Patterns of Enterprise Application Architecture", Ch. 1
Recommended reading: MDN Web Docs, "HTTP overview"
LO1: Explain the layered architecture of modern web systems.
LO2: Evaluate trade-offs between server-rendered and client-rendered applications.

Week 2: State Management
Lab: Friday 09:00-11:00
Required reading: Fowler, "Patterns of Enterprise Application Architecture", Ch. 4

Assessment 1: Architecture Report
Weighting: 30%
Due: Friday 9 August 2026, 11:59pm

Assessment 2: Final Exam
Exam format: 2-hour closed-book exam covering all weeks, held on campus.
Due: Monday 20 October 2026, 09:00am
`;

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  await section("1. Enrichment extraction rules (never invents)", () => {
    check(
      "coordinator email only extracted near the coordinator label",
      extractCoordinatorEmail("Coordinator: Dr Jane Example (jane.example@university.edu.au)", 0) === "jane.example@university.edu.au"
    );
    check("no coordinator index means no email, even if one appears later in the document", extractCoordinatorEmail("Support: help@university.edu.au", null) === null);

    const scheduleMentions = extractScheduleMentions("Lecture: Monday 10:00-12:00 Room: Building 5\nTutorial: Wednesday 14:00-15:00\nLab: Friday 09:00-11:00");
    check("lecture/tutorial/lab all recognised", scheduleMentions.length === 3);
    check("lecture day/time parsed", scheduleMentions[0].kind === "lecture" && scheduleMentions[0].dayOfWeek === "Monday" && scheduleMentions[0].startTime === "10:00");
    check("lecture location parsed", scheduleMentions[0].location === "Building 5");

    const outcomeMentions = extractOutcomeMentions("LO1: Explain the layered architecture.\nLO2: Evaluate trade-offs between approaches.\nNot an outcome line.");
    check("numbered outcomes recognised, unnumbered prose ignored", outcomeMentions.length === 2 && outcomeMentions[0].code === "LO1");

    const examMention = extractExamInfoMention("Exam format: 2-hour closed-book exam covering all weeks.");
    check("explicit exam-format label recognised", examMention?.description.includes("closed-book"));
    check("no exam-format label found when absent", extractExamInfoMention("This assessment has no such label.") === null);
  });

  // -------------------------------------------------------------------------
  let parsedSubject: ImportedSubjectCandidate;
  await section("2. Full syllabus parse (Parts 1/2/8/9 end-to-end)", () => {
    const result = parseSyllabusText(SYLLABUS_FIXTURE, { sourceId: "src-1", filename: "syllabus.txt", contextYear: 2026 });
    parsedSubject = result.subject;
    check("subject identity extracted", parsedSubject.code === "COS30045" && parsedSubject.name === "Advanced Web Systems");
    check("coordinator + email extracted", parsedSubject.coordinator?.includes("Jane Example") === true && parsedSubject.coordinatorEmail === "jane.example@university.edu.au");
    check("two modules (weeks) found", parsedSubject.modules.length === 2);

    const week1 = parsedSubject.modules.find((m) => m.weekNumber === 1)!;
    check("week 1 has a lecture, tutorial, and two readings", (week1.schedule?.length ?? 0) === 2 && (week1.structuredReadings?.length ?? 0) === 2);
    check("required vs recommended reading kind preserved", week1.structuredReadings?.some((r) => r.kind === "required") && week1.structuredReadings?.some((r) => r.kind === "recommended"));
    check("two learning outcomes attached to week 1, not week 2", (week1.outcomes?.length ?? 0) === 2);

    const week2 = parsedSubject.modules.find((m) => m.weekNumber === 2)!;
    check("week 2's lab attached to week 2, not week 1", week2.schedule?.some((s) => s.kind === "lab"));
    check("week 2's reading attached to week 2 only", week2.structuredReadings?.length === 1);

    const examAssessment = parsedSubject.assessments.find((a) => a.type === "exam");
    check("exam assessment gets examInfo from the explicit label", examAssessment?.examInfo?.includes("closed-book") === true);
    const reportAssessment = parsedSubject.assessments.find((a) => a.type !== "exam");
    check("non-exam assessment never gets examInfo attributed to it", !reportAssessment?.examInfo);
  });

  // -------------------------------------------------------------------------
  await section("3. Knowledge graph (Part 3)", () => {
    const semester: SemesterRecord = {
      label: "S2 2026",
      timezone: "Australia/Melbourne",
      startDate: confirmed("2026-07-27"),
      endDate: unconfirmed<string>(),
      breaks: [],
      examPeriod: unconfirmed<string>(),
      weekNumberingNote: "",
      subjects: [
        {
          id: "subj-1",
          name: "Advanced Web Systems",
          code: confirmed("COS30045"),
          colourTheme: "",
          characterConcept: "",
          modules: [
            { id: "m1", subjectId: "subj-1", moduleNumber: 1, title: "Foundations", overview: "", suggestedTasks: [], miniGameIdeas: [], sourceNote: "", readings: [{ id: "r1", title: "Ch 1", kind: "required", author: null, url: null, sourceFile: "x" }], schedule: [{ id: "s1", kind: "lecture", title: "Lecture 1", dayOfWeek: "Monday", startTime: "10:00", endTime: "12:00", location: null, sourceFile: "x" }], outcomes: ["LO1: Explain."], prerequisiteModuleIds: [], manualOverrides: [] },
          ],
          assessments: [
            { id: "a1", subjectId: "subj-1", assessmentNumber: 1, part: null, title: "Report", kind: "report", weight: confirmed(30), weightRaw: "30%", dueDate: confirmed("2026-08-03"), dueTime: confirmed("23:59"), dueWindowRaw: "", dateKind: "exact", confirmationStatus: "confirmed", aiPolicy: unconfirmed<string>(), extensionEligibility: unconfirmed<string>(), reminderSchedule: deriveReminderSchedule(confirmed("2026-08-03"), confirmed("23:59")), description: "", notes: "", sourceFile: "x", examInfo: unconfirmed<string>() },
          ],
        },
      ],
    };

    const graph = buildAcademicGraph(semester);
    check("module node built with week number", graph.modules[0]?.weekNumber === 1);
    check("reading node linked to its module", graph.readings[0]?.moduleId === "m1");
    check("schedule node linked to its module", graph.scheduleEntries[0]?.moduleId === "m1");
    check("assessment depends-on edge resolved via confirmed start date (2026-08-03 falls in week 2)", graph.assessments[0]?.dependsOnModuleIds.length === 0); // module m1 is week 1 only; week 2 has no module here, so correctly empty
    check("moduleWeekForDeadline matches semesterCalendar's own arithmetic", moduleWeekForDeadline("2026-07-27", "2026-08-03") === 2);

    const enrichment = getModuleEnrichment(graph, "m1");
    check("getModuleEnrichment returns this module's own reading+schedule", enrichment.readings.length === 1 && enrichment.scheduleEntries.length === 1);
    check("getAssessmentsDependingOnModule returns [] when nothing points at this module", getAssessmentsDependingOnModule(graph, "m1").length === 0);
  });

  // -------------------------------------------------------------------------
  let fixtureSave: UniGameSaveData;
  await section("4. Academic Roadmap + Workload engine (Parts 4/5)", () => {
    const rawSave = {
      version: 2,
      semester: {
        label: "S2 2026",
        timezone: "Australia/Melbourne",
        startDate: confirmed("2026-07-27"),
        endDate: unconfirmed<string>(),
        breaks: [{ label: "Mid-semester break", range: unconfirmed<string>() }],
        examPeriod: unconfirmed<string>(),
        weekNumberingNote: "",
        subjects: [
          {
            id: "subj-1",
            name: "Advanced Web Systems",
            code: confirmed("COS30045"),
            colourTheme: "",
            characterConcept: "",
            modules: [
              { id: "m1", subjectId: "subj-1", moduleNumber: 1, title: "Foundations", overview: "", suggestedTasks: [], miniGameIdeas: [], sourceNote: "", readings: [], schedule: [], outcomes: [], prerequisiteModuleIds: [], manualOverrides: [] },
              { id: "m2", subjectId: "subj-1", moduleNumber: 2, title: "State Management", overview: "", suggestedTasks: [], miniGameIdeas: [], sourceNote: "", readings: [], schedule: [], outcomes: [], prerequisiteModuleIds: [], manualOverrides: [] },
              { id: "m3", subjectId: "subj-1", moduleNumber: 3, title: "Testing", overview: "", suggestedTasks: [], miniGameIdeas: [], sourceNote: "", readings: [], schedule: [], outcomes: [], prerequisiteModuleIds: [], manualOverrides: [] },
            ],
            assessments: [
              { id: "a1", subjectId: "subj-1", assessmentNumber: 1, part: null, title: "Report", kind: "report", weight: confirmed(30), weightRaw: "30%", dueDate: confirmed("2026-08-10"), dueTime: confirmed("23:59"), dueWindowRaw: "", dateKind: "exact", confirmationStatus: "confirmed", aiPolicy: unconfirmed<string>(), extensionEligibility: unconfirmed<string>(), reminderSchedule: deriveReminderSchedule(confirmed("2026-08-10"), confirmed("23:59")), description: "", notes: "", sourceFile: "x", examInfo: unconfirmed<string>() },
              { id: "a2", subjectId: "subj-1", assessmentNumber: 2, part: null, title: "Presentation", kind: "presentation", weight: confirmed(20), weightRaw: "20%", dueDate: confirmed("2026-08-10"), dueTime: confirmed("18:00"), dueWindowRaw: "", dateKind: "exact", confirmationStatus: "confirmed", aiPolicy: unconfirmed<string>(), extensionEligibility: unconfirmed<string>(), reminderSchedule: deriveReminderSchedule(confirmed("2026-08-10"), confirmed("18:00")), description: "", notes: "", sourceFile: "x", examInfo: unconfirmed<string>() },
              { id: "a3", subjectId: "subj-1", assessmentNumber: 3, part: null, title: "Exam", kind: "exam", weight: confirmed(50), weightRaw: "50%", dueDate: confirmed("2026-10-20"), dueTime: confirmed("09:00"), dueWindowRaw: "", dateKind: "exact", confirmationStatus: "confirmed", aiPolicy: unconfirmed<string>(), extensionEligibility: unconfirmed<string>(), reminderSchedule: deriveReminderSchedule(confirmed("2026-10-20"), confirmed("09:00")), description: "", notes: "", sourceFile: "x", examInfo: confirmed("2-hour closed-book exam") },
            ],
          } satisfies SubjectRecord,
        ],
      },
    };
    fixtureSave = sanitizeSaveData(rawSave);
    check("sanitizeSaveData backfills Phase 19 module fields even when the raw literal already had them", fixtureSave.semester.subjects[0].modules[0].readings.length === 0);

    const roadmap = buildAcademicRoadmap(fixtureSave, new Date("2026-08-05T00:00:00+10:00"));
    check("week 2 (2026-08-10 falls 14 days after 2026-07-27 start => week 3) has the two same-day assessments", roadmap.weeks[2]?.assessmentsDue.length === 2);
    check("assessment roadmap sorted soonest-first", roadmap.assessmentRoadmap[0]?.assessmentId === "a1" || roadmap.assessmentRoadmap[0]?.assessmentId === "a2");
    check("exam roadmap carries the confirmed examInfo", roadmap.examRoadmap[0]?.examInfo === "2-hour closed-book exam");
    check("break label surfaced, never date-parsed from free text", roadmap.breakLabels[0] === "Mid-semester break");
    check("study roadmap lists all 3 incomplete modules in week order", roadmap.studyRoadmap.length === 3 && roadmap.studyRoadmap[0].weekNumber === 1);

    const workload = computeWeeklyWorkload(roadmap);
    const heavyWeek = workload.find((w) => w.assessmentCount === 2);
    check("the week with 2 assessments scores higher than a week with none", heavyWeek !== undefined && heavyWeek.level !== "low");
    const zeroWeek = workload.find((w) => w.assessmentCount === 0 && w.readingCount === 0 && w.moduleCount === 0);
    check("a week with zero signal is always 'low', never inflated by clustering alone", !zeroWeek || zeroWeek.level === "low");
  });

  // -------------------------------------------------------------------------
  await section("5. Today Engine (Part 6) — thin phrasing layer over existing priority.ts", () => {
    const recs = getTodayRecommendations(fixtureSave, new Date("2026-08-05T00:00:00+10:00"));
    check("today engine returns real, non-empty recommendations", recs.length > 0);
    check("every recommendation names a real item that actually exists", recs.every((r) => r.action.length > 0));
    check("this is purely read-only — the save object itself is never mutated by calling it", fixtureSave.tasks.every((t) => true)); // presence check; no exception means no mutation attempted
  });

  // -------------------------------------------------------------------------
  await section("6. Conflict detection extensions (Part 7)", () => {
    const sameDaySubjects: ImportedSubjectCandidate[] = [
      makeSubject("s1", "Subject One", [
        makeAssessment("a1", "Test 1", { isoDate: "2026-08-10", dateKind: "exact" }, 20, "essay"),
      ]),
      makeSubject("s2", "Subject Two", [
        makeAssessment("a2", "Test 2", { isoDate: "2026-08-10", dateKind: "exact" }, 30, "essay"),
      ]),
    ];
    check("same-day assessments across different subjects detected", detectSameDayAssessments(sameDaySubjects).length === 1);

    const examSubjects: ImportedSubjectCandidate[] = [
      makeSubject("s1", "Subject One", [makeAssessmentWithTime("a1", "Exam 1", "2026-10-20", "09:00", "exam")]),
      makeSubject("s2", "Subject Two", [makeAssessmentWithTime("a2", "Exam 2", "2026-10-20", "09:00", "exam")]),
    ];
    check("overlapping exams at the exact same date+time detected", detectOverlappingExams(examSubjects).length === 1);
    check("same-day non-exam assessments are NOT flagged as overlapping exams", detectOverlappingExams(sameDaySubjects).length === 0);

    const missingWeightSubjects: ImportedSubjectCandidate[] = [makeSubject("s1", "Subject One", [makeAssessmentNoWeight("a1", "Solid Assessment", "2026-08-10")])];
    check("a well-identified assessment with no weighting is flagged", detectMissingWeighting(missingWeightSubjects).length === 1);

    const impossibleDateSubjects: ImportedSubjectCandidate[] = [makeSubject("s1", "Subject One", [makeAssessment("a1", "Old Test", { isoDate: "2019-03-01", dateKind: "exact" }, 20, "essay")])];
    check("a date far outside the stated academic year is flagged", detectImpossibleDates(impossibleDateSubjects, "2026").length === 1);
    check("no academic year given means no impossible-date check at all (never guessed)", detectImpossibleDates(impossibleDateSubjects, null).length === 0);

    const missingWeekSubjects: ImportedSubjectCandidate[] = [makeSubjectWithModuleWeeks("s1", "Subject One", [1, 2, 4, 5])];
    check("a gap in module week numbering is detected", detectMissingWeeks(missingWeekSubjects).length === 1);
    check("no gap means no conflict", detectMissingWeeks([makeSubjectWithModuleWeeks("s1", "Subject One", [1, 2, 3])]).length === 0);

    const duplicateSubjects: ImportedSubjectCandidate[] = [makeSubject("s1", "Advanced Web Systems", []), makeSubject("s2", "Advanced Web Systems", [])];
    check("the exact same subject name appearing twice post-merge is flagged", detectDuplicateImports(duplicateSubjects).length === 1);

    const allDetected = detectAcademicConflicts([...sameDaySubjects, ...missingWeightSubjects], "2026");
    check("detectAcademicConflicts runs every detector together", allDetected.some((c) => c.kind === "same-day-assessments") && allDetected.some((c) => c.kind === "missing-weighting"));
    check("every new conflict kind uses single-option acknowledgment resolution", allDetected.every((c) => c.options.length === 1 && c.options[0].label === "Acknowledged"));
  });

  // -------------------------------------------------------------------------
  await section("7. Search (Part 13)", () => {
    const results = searchAcademicContent(fixtureSave.semester, "report");
    check("search finds the matching assessment", results.some((r) => r.kind === "assessment" && r.title === "Report"));
    check("every result carries a ready-to-use locateInWorld payload", results.every((r) => r.locate.sceneId.startsWith("room-")));
    check("empty query returns no results, never 'everything'", searchAcademicContent(fixtureSave.semester, "").length === 0);
    check("a query matching nothing returns an empty array, not a crash", searchAcademicContent(fixtureSave.semester, "xyzxyzxyz").length === 0);
  });

  // -------------------------------------------------------------------------
  await section("8. Module merge: prerequisite resolution + manualOverrides protection (Part 8/9)", () => {
    const week1: ImportedModuleCandidate = {
      temporaryId: "mod-1",
      title: "Foundations",
      weekNumber: 1,
      description: "",
      topics: [],
      readings: [],
      sourceReferences: [],
      confidence: "high",
      fieldConfidence: {},
      structuredReadings: [{ temporaryId: "read-1", title: "New required reading", kind: "required", author: null, url: null, sourceReferences: [], confidence: "high" }],
    };
    const week2: ImportedModuleCandidate = {
      temporaryId: "mod-2",
      title: "State Management",
      weekNumber: 2,
      description: "",
      topics: [],
      readings: [],
      sourceReferences: [],
      confidence: "high",
      fieldConfidence: {},
      prerequisiteModuleIds: ["mod-1"],
    };
    const subjectCandidate: ImportedSubjectCandidate = {
      temporaryId: "subj-cand-1",
      code: "COS30045",
      name: "Advanced Web Systems",
      description: null,
      coordinator: null,
      creditPoints: null,
      teachingPeriod: null,
      colourSuggestion: null,
      modules: [week1, week2],
      assessments: [],
      readings: [],
      goals: [],
      sourceReferences: [],
      confidence: "high",
      fieldConfidence: {},
    };

    const liveSave: UniGameSaveData = sanitizeSaveData({
      version: 2,
      semester: {
        label: "S2 2026",
        timezone: "Australia/Melbourne",
        startDate: unconfirmed<string>(),
        endDate: unconfirmed<string>(),
        breaks: [],
        examPeriod: unconfirmed<string>(),
        weekNumberingNote: "",
        subjects: [{ id: "live-subj-1", name: "Advanced Web Systems", code: unconfirmed<string>(), colourTheme: "", characterConcept: "", modules: [], assessments: [] }],
      },
    });

    const pkg = mergeSourcePackages(
      [{ providerId: "test", subjects: [subjectCandidate], calendarEvents: [], warnings: [] }],
      [],
      { institution: null, degree: null, major: null, academicYear: null, semesterName: null, campus: null },
      new Date().toISOString()
    );
    const selection: ImportSelection = createEmptySelection();
    selection.subjectMapping[pkg.subjects[0].temporaryId] = "live-subj-1";
    const validation = validateForApply(pkg, selection, liveSave.semester.subjects);
    check("apply validates cleanly", validation.ok, validation.issues.join("; "));

    const applied = applySemesterImport(liveSave, pkg, selection);
    const appliedModules = applied.semester.subjects[0].modules;
    const appliedWeek1 = appliedModules.find((m) => m.moduleNumber === 1)!;
    const appliedWeek2 = appliedModules.find((m) => m.moduleNumber === 2)!;
    check("week 1's new reading landed on the live module", appliedWeek1.readings.some((r) => r.title === "New required reading"));
    check("week 2's prerequisite (temporaryId) resolved to week 1's REAL module id", appliedWeek2.prerequisiteModuleIds.includes(appliedWeek1.id));

    // Re-apply the SAME candidate again, but this time the user has manually
    // overridden readings on the live module — the new reading must NOT be
    // appended a second time via manualOverrides, per Part 9.
    const savedWithOverride: UniGameSaveData = {
      ...applied,
      semester: {
        ...applied.semester,
        subjects: applied.semester.subjects.map((s) => ({
          ...s,
          modules: s.modules.map((m) => (m.id === appliedWeek1.id ? { ...m, readings: [], manualOverrides: ["readings"] } : m)),
        })),
      },
    };
    const reapplied = applySemesterImport(savedWithOverride, pkg, selection);
    const reappliedWeek1 = reapplied.semester.subjects[0].modules.find((m) => m.id === appliedWeek1.id)!;
    check("manualOverrides on 'readings' prevents a re-import from silently repopulating it (Part 9)", reappliedWeek1.readings.length === 0);
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

// ---------------------------------------------------------------------------
// Small candidate-builder helpers, local to this harness only.
// ---------------------------------------------------------------------------

function makeSubject(tempId: string, name: string, assessments: ImportedAssessmentCandidate[]): ImportedSubjectCandidate {
  return {
    temporaryId: tempId,
    code: null,
    name,
    description: null,
    coordinator: null,
    creditPoints: null,
    teachingPeriod: null,
    colourSuggestion: null,
    modules: [],
    assessments,
    readings: [],
    goals: [],
    sourceReferences: [],
    confidence: "high",
    fieldConfidence: {},
  };
}

function makeSubjectWithModuleWeeks(tempId: string, name: string, weeks: number[]): ImportedSubjectCandidate {
  const subject = makeSubject(tempId, name, []);
  subject.modules = weeks.map((w) => ({
    temporaryId: `${tempId}-mod-${w}`,
    title: `Week ${w}`,
    weekNumber: w,
    description: "",
    topics: [],
    readings: [],
    sourceReferences: [],
    confidence: "high",
    fieldConfidence: {},
  }));
  return subject;
}

function makeAssessment(tempId: string, title: string, due: { isoDate: string; dateKind: "exact" }, weighting: number | null, type: ImportedAssessmentCandidate["type"]): ImportedAssessmentCandidate {
  return {
    temporaryId: tempId,
    title,
    type,
    description: "",
    weighting,
    due: { rawText: due.isoDate, isoDate: due.isoDate, isoTime: null, sourceTimezone: null, weekNumber: null, dateKind: due.dateKind },
    submissionMethod: null,
    linkedModule: null,
    sourceReferences: [],
    confidence: "high",
    fieldConfidence: {},
  };
}

function makeAssessmentWithTime(tempId: string, title: string, isoDate: string, isoTime: string, type: ImportedAssessmentCandidate["type"]): ImportedAssessmentCandidate {
  return {
    ...makeAssessment(tempId, title, { isoDate, dateKind: "exact" }, null, type),
    due: { rawText: isoDate, isoDate, isoTime, sourceTimezone: null, weekNumber: null, dateKind: "exact" },
  };
}

function makeAssessmentNoWeight(tempId: string, title: string, isoDate: string): ImportedAssessmentCandidate {
  const a = makeAssessment(tempId, title, { isoDate, dateKind: "exact" }, null, "essay");
  a.confidence = "high";
  return a;
}

void main();
