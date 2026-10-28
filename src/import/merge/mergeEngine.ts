/**
 * Merge & conflict engine (Phase 18A, Part 6). Combines the
 * ImportedSourcePackage output of every provider run into ONE
 * AcademicImportPackage, matching subjects/modules/assessments across
 * sources and raising an ImportConflict — never a silent guess — whenever
 * two sources disagree on a material fact (date, weight, semester bounds,
 * a likely duplicate assessment name).
 *
 * Source priority: a `confirmed` field (manual-completion provider, or a
 * value the user already resolved earlier in this same session) always
 * wins over anything merely extracted; two extracted values that disagree
 * always become a conflict, never an automatic pick.
 */

import type {
  AcademicImportPackage,
  ConfidenceLevel,
  ImportConflict,
  ImportedAssessmentCandidate,
  ImportedCalendarCandidate,
  ImportedModuleCandidate,
  ImportedSourcePackage,
  ImportedSubjectCandidate,
  ImportSourceFile,
  ImportWarning,
  SourceReference,
} from "../types";
import { computeExtractionSummary } from "../types";
import { CROSS_SUBJECT_DUPLICATE_THRESHOLD, codesMatch, similarity, TITLE_MATCH_THRESHOLD } from "./matching";
import { detectAcademicConflicts } from "./academicConflicts";

let conflictCounter = 0;
function nextConflictId(): string {
  conflictCounter += 1;
  return `conflict-${conflictCounter}`;
}

const RANK: Record<ConfidenceLevel, number> = {
  confirmed: 5,
  high: 4,
  medium: 3,
  low: 2,
  conflicting: 1,
  missing: 0,
};

function higherConfidence(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Module merge
// ---------------------------------------------------------------------------

function findModuleMatch(candidate: ImportedModuleCandidate, pool: ImportedModuleCandidate[]): ImportedModuleCandidate | null {
  if (candidate.weekNumber !== null) {
    const byWeek = pool.find((m) => m.weekNumber === candidate.weekNumber);
    if (byWeek) return byWeek;
  }
  let best: ImportedModuleCandidate | null = null;
  let bestScore = TITLE_MATCH_THRESHOLD;
  for (const m of pool) {
    const score = similarity(m.title, candidate.title);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

function mergeModulePair(a: ImportedModuleCandidate, b: ImportedModuleCandidate): ImportedModuleCandidate {
  return {
    ...a,
    weekNumber: a.weekNumber ?? b.weekNumber,
    description: a.description || b.description,
    topics: [...new Set([...a.topics, ...b.topics])],
    readings: [...new Set([...a.readings, ...b.readings])],
    sourceReferences: [...a.sourceReferences, ...b.sourceReferences],
    confidence: higherConfidence(a.confidence, b.confidence),
    fieldConfidence: { ...b.fieldConfidence, ...a.fieldConfidence },
  };
}

function mergeModules(lists: ImportedModuleCandidate[][]): ImportedModuleCandidate[] {
  let acc: ImportedModuleCandidate[] = [];
  for (const list of lists) {
    for (const candidate of list) {
      const match = findModuleMatch(candidate, acc);
      if (match) {
        acc = acc.map((m) => (m === match ? mergeModulePair(m, candidate) : m));
      } else {
        acc.push(candidate);
      }
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Assessment merge (raises date/weight conflicts)
// ---------------------------------------------------------------------------

function dueDiffers(a: ImportedAssessmentCandidate["due"], b: ImportedAssessmentCandidate["due"]): boolean {
  if (!a || !b) return false;
  if (a.isoDate && b.isoDate) return a.isoDate !== b.isoDate;
  return false;
}

function weightDiffers(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) > 0.01;
}

function mergeAssessmentPair(
  a: ImportedAssessmentCandidate,
  b: ImportedAssessmentCandidate,
  conflicts: ImportConflict[]
): ImportedAssessmentCandidate {
  let weighting = a.weighting ?? b.weighting;
  let weightingConfidence = a.fieldConfidence.weighting ?? "missing";

  if (weightDiffers(a.weighting, b.weighting)) {
    conflicts.push({
      id: nextConflictId(),
      kind: "weight-mismatch",
      summary: `"${a.title}" has different weightings across sources.`,
      candidateIds: [a.temporaryId, b.temporaryId],
      options: [
        { label: `${a.weighting}%`, value: String(a.weighting), sourceReferences: a.sourceReferences },
        { label: `${b.weighting}%`, value: String(b.weighting), sourceReferences: b.sourceReferences },
      ],
      resolution: null,
    });
    weighting = null;
    weightingConfidence = "conflicting";
  } else if (a.fieldConfidence.weighting === "confirmed" || b.fieldConfidence.weighting === "confirmed") {
    // A confirmed (manually-entered / already-resolved) value always wins.
    if (b.fieldConfidence.weighting === "confirmed" && a.fieldConfidence.weighting !== "confirmed") {
      weighting = b.weighting;
      weightingConfidence = "confirmed";
    } else {
      weightingConfidence = "confirmed";
    }
  }

  let due = a.due ?? b.due;
  let dueConfidence = a.fieldConfidence.dueDate ?? "missing";

  if (dueDiffers(a.due, b.due)) {
    conflicts.push({
      id: nextConflictId(),
      kind: "date-mismatch",
      summary: `"${a.title}" has different due dates across sources.`,
      candidateIds: [a.temporaryId, b.temporaryId],
      options: [
        { label: a.due?.rawText ?? "unknown", value: a.due?.isoDate ?? "", sourceReferences: a.sourceReferences },
        { label: b.due?.rawText ?? "unknown", value: b.due?.isoDate ?? "", sourceReferences: b.sourceReferences },
      ],
      resolution: null,
    });
    due = { ...(a.due ?? b.due)!, isoDate: null, isoTime: null, dateKind: "source_conflict" };
    dueConfidence = "conflicting";
  } else if (a.fieldConfidence.dueDate === "confirmed" || b.fieldConfidence.dueDate === "confirmed") {
    if (b.fieldConfidence.dueDate === "confirmed" && a.fieldConfidence.dueDate !== "confirmed") {
      due = b.due;
    }
    dueConfidence = "confirmed";
  } else if (!a.due && b.due) {
    due = b.due;
    dueConfidence = b.fieldConfidence.dueDate ?? "missing";
  }

  return {
    ...a,
    description: a.description || b.description,
    weighting,
    due,
    submissionMethod: a.submissionMethod ?? b.submissionMethod,
    sourceReferences: [...a.sourceReferences, ...b.sourceReferences],
    confidence: higherConfidence(a.confidence, b.confidence),
    fieldConfidence: {
      ...a.fieldConfidence,
      ...b.fieldConfidence,
      weighting: weightingConfidence,
      dueDate: dueConfidence,
    },
  };
}

function findAssessmentMatch(
  candidate: ImportedAssessmentCandidate,
  pool: ImportedAssessmentCandidate[]
): ImportedAssessmentCandidate | null {
  let best: ImportedAssessmentCandidate | null = null;
  let bestScore = TITLE_MATCH_THRESHOLD;
  for (const item of pool) {
    const score = similarity(item.title, candidate.title);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

function mergeAssessments(
  lists: ImportedAssessmentCandidate[][],
  conflicts: ImportConflict[]
): ImportedAssessmentCandidate[] {
  let acc: ImportedAssessmentCandidate[] = [];
  for (const list of lists) {
    for (const candidate of list) {
      const match = findAssessmentMatch(candidate, acc);
      if (match) {
        acc = acc.map((m) => (m === match ? mergeAssessmentPair(m, candidate, conflicts) : m));
      } else {
        acc.push(candidate);
      }
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Subject merge
// ---------------------------------------------------------------------------

function findSubjectMatch(candidate: ImportedSubjectCandidate, pool: ImportedSubjectCandidate[]): ImportedSubjectCandidate | null {
  const byCode = pool.find((s) => codesMatch(s.code, candidate.code));
  if (byCode) return byCode;
  let best: ImportedSubjectCandidate | null = null;
  let bestScore = TITLE_MATCH_THRESHOLD;
  for (const s of pool) {
    const score = similarity(s.name, candidate.name);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

/** Both sources gave a non-null code and they don't refer to the same subject. */
function codeDiffers(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && !codesMatch(a, b);
}

function creditPointsDiffer(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) > 0.01;
}

function normalizePeriod(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cross-source textual disagreement only — institution-specific aliases (e.g. "Semester 1" vs "Term 1" meaning the same thing) are a registry concept handled by `search/teachingPeriod.ts`, not here. */
function teachingPeriodDiffers(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && normalizePeriod(a) !== normalizePeriod(b);
}

function mergeSubjectPair(
  a: ImportedSubjectCandidate,
  b: ImportedSubjectCandidate,
  conflicts: ImportConflict[]
): ImportedSubjectCandidate {
  const modules = mergeModules([a.modules, b.modules]);
  const assessments = mergeAssessments([a.assessments, b.assessments], conflicts);

  let code = a.code ?? b.code;
  let codeConfidence = a.fieldConfidence.code ?? "missing";
  if (codeDiffers(a.code, b.code)) {
    conflicts.push({
      id: nextConflictId(),
      kind: "subject-code-mismatch",
      summary: `"${a.name}" has different subject codes across sources.`,
      candidateIds: [a.temporaryId],
      options: [
        { label: a.code ?? "", value: a.code ?? "", sourceReferences: a.sourceReferences },
        { label: b.code ?? "", value: b.code ?? "", sourceReferences: b.sourceReferences },
      ],
      resolution: null,
    });
    code = null;
    codeConfidence = "conflicting";
  }

  let creditPoints = a.creditPoints ?? b.creditPoints;
  let creditPointsConfidence = a.fieldConfidence.creditPoints ?? "missing";
  if (creditPointsDiffer(a.creditPoints, b.creditPoints)) {
    conflicts.push({
      id: nextConflictId(),
      kind: "credit-points-mismatch",
      summary: `"${a.name}" has different credit-point values across sources.`,
      candidateIds: [a.temporaryId],
      options: [
        { label: `${a.creditPoints} points`, value: String(a.creditPoints), sourceReferences: a.sourceReferences },
        { label: `${b.creditPoints} points`, value: String(b.creditPoints), sourceReferences: b.sourceReferences },
      ],
      resolution: null,
    });
    creditPoints = null;
    creditPointsConfidence = "conflicting";
  }

  let teachingPeriod = a.teachingPeriod ?? b.teachingPeriod;
  let teachingPeriodConfidence = a.fieldConfidence.teachingPeriod ?? "missing";
  if (teachingPeriodDiffers(a.teachingPeriod, b.teachingPeriod)) {
    conflicts.push({
      id: nextConflictId(),
      kind: "teaching-period-mismatch",
      summary: `"${a.name}" has different teaching periods across sources.`,
      candidateIds: [a.temporaryId],
      options: [
        { label: a.teachingPeriod ?? "", value: a.teachingPeriod ?? "", sourceReferences: a.sourceReferences },
        { label: b.teachingPeriod ?? "", value: b.teachingPeriod ?? "", sourceReferences: b.sourceReferences },
      ],
      resolution: null,
    });
    teachingPeriod = null;
    teachingPeriodConfidence = "conflicting";
  }

  return {
    ...a,
    code,
    description: a.description ?? b.description,
    coordinator: a.coordinator ?? b.coordinator,
    creditPoints,
    teachingPeriod,
    modules,
    assessments,
    readings: [...new Set([...a.readings, ...b.readings])],
    sourceReferences: [...a.sourceReferences, ...b.sourceReferences],
    confidence: higherConfidence(a.confidence, b.confidence),
    fieldConfidence: {
      ...b.fieldConfidence,
      ...a.fieldConfidence,
      code: codeConfidence,
      creditPoints: creditPointsConfidence,
      teachingPeriod: teachingPeriodConfidence,
    },
  };
}

/** Cross-subject duplicate-name advisory (Part 6 conflict example). */
function detectDuplicateAssessmentNames(subjects: ImportedSubjectCandidate[]): ImportConflict[] {
  const found: ImportConflict[] = [];
  const flat = subjects.flatMap((s) => s.assessments.map((a) => ({ subject: s, assessment: a })));
  for (let i = 0; i < flat.length; i += 1) {
    for (let j = i + 1; j < flat.length; j += 1) {
      const x = flat[i];
      const y = flat[j];
      if (x.subject === y.subject) continue; // same-subject matches were already merged above
      if (x.assessment.title.length < 12 || y.assessment.title.length < 12) continue; // avoid generic short titles
      if (similarity(x.assessment.title, y.assessment.title) >= CROSS_SUBJECT_DUPLICATE_THRESHOLD) {
        found.push({
          id: nextConflictId(),
          kind: "duplicate-assessment-name",
          summary: `"${x.assessment.title}" appears in both ${x.subject.name} and ${y.subject.name} — please check these aren't the same assessment misfiled under two subjects.`,
          candidateIds: [x.assessment.temporaryId, y.assessment.temporaryId],
          options: [
            { label: x.subject.name, value: x.subject.temporaryId, sourceReferences: x.assessment.sourceReferences },
            { label: y.subject.name, value: y.subject.temporaryId, sourceReferences: y.assessment.sourceReferences },
          ],
          resolution: null,
        });
      }
    }
  }
  return found;
}

export interface ImportPackageMeta {
  institution: string | null;
  degree: string | null;
  major: string | null;
  academicYear: string | null;
  semesterName: string | null;
  campus: string | null;
}

let importIdCounter = 0;

export function mergeSourcePackages(
  sourcePackages: ImportedSourcePackage[],
  sourceFiles: ImportSourceFile[],
  meta: ImportPackageMeta,
  createdAt: string
): AcademicImportPackage {
  importIdCounter += 1;
  const conflicts: ImportConflict[] = sourcePackages.flatMap((p) => p.conflicts ?? []);
  const warnings: ImportWarning[] = sourcePackages.flatMap((p) => p.warnings);

  let subjects: ImportedSubjectCandidate[] = [];
  for (const pkg of sourcePackages) {
    for (const candidate of pkg.subjects) {
      const match = findSubjectMatch(candidate, subjects);
      if (match) {
        subjects = subjects.map((s) => (s === match ? mergeSubjectPair(s, candidate, conflicts) : s));
      } else {
        subjects.push(candidate);
      }
    }
  }

  conflicts.push(...detectDuplicateAssessmentNames(subjects));
  conflicts.push(...detectAcademicConflicts(subjects, meta.academicYear));

  // Calendar events that clearly name a matched subject and describe an
  // assessment deadline are folded into that assessment's due date (highest
  // confidence source per the architecture audit); everything else stays a
  // standalone calendar candidate.
  const calendarEvents: ImportedCalendarCandidate[] = [];
  for (const pkg of sourcePackages) {
    for (const event of pkg.calendarEvents) {
      const subject = event.subjectCode ? subjects.find((s) => codesMatch(s.code, event.subjectCode)) : null;
      const targetAssessment =
        subject && event.eventType === "assessment-due"
          ? subject.assessments.find((a) => similarity(a.title, event.title) > TITLE_MATCH_THRESHOLD)
          : null;

      if (subject && targetAssessment) {
        const eventDue = {
          rawText: event.start.rawText,
          isoDate: event.start.isoDate,
          isoTime: event.start.isoTime,
          sourceTimezone: event.start.sourceTimezone,
          weekNumber: event.start.weekNumber,
          dateKind: event.start.dateKind,
        };
        if (targetAssessment.due && dueDiffers(targetAssessment.due, eventDue)) {
          conflicts.push({
            id: nextConflictId(),
            kind: "date-mismatch",
            summary: `"${targetAssessment.title}" has a different date in the calendar file than in its syllabus.`,
            candidateIds: [targetAssessment.temporaryId],
            options: [
              { label: targetAssessment.due.rawText, value: targetAssessment.due.isoDate ?? "", sourceReferences: targetAssessment.sourceReferences },
              { label: eventDue.rawText, value: eventDue.isoDate ?? "", sourceReferences: event.sourceReferences },
            ],
            resolution: null,
          });
        } else if (!targetAssessment.due || targetAssessment.fieldConfidence.dueDate !== "confirmed") {
          targetAssessment.due = eventDue;
          targetAssessment.fieldConfidence.dueDate = "high";
          targetAssessment.sourceReferences = [...targetAssessment.sourceReferences, ...event.sourceReferences];
        }
        continue;
      }
      calendarEvents.push(event);
    }
  }

  const announcements = sourcePackages.flatMap((p) => p.announcements ?? []);

  const pkg: AcademicImportPackage = {
    importId: `import-${importIdCounter}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    provider: [...new Set(sourcePackages.map((p) => p.providerId))],
    sourceFiles,
    institution: meta.institution,
    degree: meta.degree,
    major: meta.major,
    academicYear: meta.academicYear,
    semesterName: meta.semesterName,
    campus: meta.campus,
    subjects,
    calendarEvents,
    announcements,
    warnings,
    conflicts,
    extractionSummary: computeExtractionSummary({ subjects, calendarEvents, conflicts }),
  };
  return pkg;
}

/**
 * Marks a conflict resolved AND, for every kind that nulled out a candidate
 * field pending resolution (weight-mismatch, date-mismatch — see
 * `mergeAssessmentPair`; subject-code-mismatch, credit-points-mismatch,
 * teaching-period-mismatch — see `mergeSubjectPair`), writes the user's
 * chosen value back into that field at `confirmed` confidence. Without this,
 * "resolving" a conflict would only unblock Apply while leaving the field
 * permanently missing — the user's choice would be recorded but never
 * actually take effect (the Phase 18A regression this guards against; see
 * scripts/verify-phase18d-conflicts.ts).
 *
 * The remaining kinds never null a candidate field to begin with, so
 * resolving them only needs to record the choice: duplicate-assessment-name
 * and conflicting-handbook-versions (there's no single field to overwrite —
 * the user's choice is "I've reviewed this, proceed"), subject-mapping-
 * ambiguous (the choice is which LIVE subject to map to, applied at Apply
 * time, not written into the candidate), and the live-semester conflicts
 * from reconcile.ts (see its own docstring).
 */
export function resolveConflict(
  pkg: AcademicImportPackage,
  conflictId: string,
  chosenLabel: string
): AcademicImportPackage {
  const conflict = pkg.conflicts.find((c) => c.id === conflictId);
  if (!conflict) return pkg;
  const chosen = conflict.options.find((o) => o.label === chosenLabel);
  const conflicts = pkg.conflicts.map((c) => (c.id === conflictId ? { ...c, resolution: chosenLabel } : c));

  const applyAssessmentResolution = (a: ImportedAssessmentCandidate): ImportedAssessmentCandidate => {
    if (!conflict.candidateIds.includes(a.temporaryId) || !chosen) return a;

    if (conflict.kind === "weight-mismatch") {
      const value = Number(chosen.value);
      if (Number.isNaN(value)) return a;
      return { ...a, weighting: value, fieldConfidence: { ...a.fieldConfidence, weighting: "confirmed" } };
    }

    if (conflict.kind === "date-mismatch") {
      const isoDate = chosen.value || null;
      return {
        ...a,
        due: {
          rawText: chosen.label,
          isoDate,
          isoTime: a.due?.isoTime ?? null,
          sourceTimezone: a.due?.sourceTimezone ?? null,
          weekNumber: null,
          dateKind: isoDate ? "exact" : "missing",
        },
        fieldConfidence: { ...a.fieldConfidence, dueDate: isoDate ? "confirmed" : "missing" },
      };
    }

    return a;
  };

  const applySubjectResolution = (s: ImportedSubjectCandidate): ImportedSubjectCandidate => {
    if (!conflict.candidateIds.includes(s.temporaryId) || !chosen) return s;

    if (conflict.kind === "subject-code-mismatch") {
      return { ...s, code: chosen.value || null, fieldConfidence: { ...s.fieldConfidence, code: "confirmed" } };
    }

    if (conflict.kind === "credit-points-mismatch") {
      const value = Number(chosen.value);
      if (Number.isNaN(value)) return s;
      return { ...s, creditPoints: value, fieldConfidence: { ...s.fieldConfidence, creditPoints: "confirmed" } };
    }

    if (conflict.kind === "teaching-period-mismatch") {
      return { ...s, teachingPeriod: chosen.value || null, fieldConfidence: { ...s.fieldConfidence, teachingPeriod: "confirmed" } };
    }

    return s;
  };

  const subjects = pkg.subjects.map((subject) => {
    const resolvedSubject = applySubjectResolution(subject);
    return { ...resolvedSubject, assessments: resolvedSubject.assessments.map(applyAssessmentResolution) };
  });

  return {
    ...pkg,
    subjects,
    conflicts,
    extractionSummary: computeExtractionSummary({ subjects, calendarEvents: pkg.calendarEvents, conflicts }),
  };
}

export function unresolvedConflictCount(pkg: AcademicImportPackage): number {
  return pkg.conflicts.filter((c) => c.resolution === null).length;
}

export { similarity, normalize } from "./matching";
export type { SourceReference };
