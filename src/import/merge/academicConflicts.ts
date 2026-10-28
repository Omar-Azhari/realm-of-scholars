/**
 * Academic Intelligence conflict extensions (Phase 19, Part 7). New,
 * additive `ConflictKind` members (see src/import/types.ts) detected purely
 * from the already-merged `ImportedSubjectCandidate[]` — the same shape
 * `detectDuplicateAssessmentNames` (mergeEngine.ts) already works with —
 * flowing through the exact same `ImportConflict`/Review/`resolveConflict`
 * pipeline, never a parallel conflict system.
 *
 * Two of the brief's named checks are DELIBERATELY not reimplemented here:
 * "semester mismatch" and "subject mismatch" are already fully covered by
 * the existing `semester-date-mismatch`/`academic-year-mismatch`/
 * `teaching-period-mismatch`/`subject-code-mismatch` kinds (Phase 18B/18D)
 * — adding new kind names for the same signal would just be redundant
 * conflict spam. "Large workload week" is also deliberately not a formal
 * ImportConflict: it isn't a source-vs-source disagreement (which is what
 * ImportConflict represents), it's a planning insight, already surfaced via
 * the Workload engine (academicWorkload.ts) in the Study Planner/Roadmap —
 * see docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §8 for the full reasoning.
 *
 * Every new kind here uses a single-option "Acknowledged" resolution — none
 * of these represent two competing VALUES to pick between (unlike
 * date-mismatch/weight-mismatch), just something worth the user's attention
 * before Apply, exactly the same shape conflicting-handbook-versions and
 * duplicate-assessment-name already use for "I've reviewed this, proceed."
 */

import type { ImportConflict, ImportedSubjectCandidate, SourceReference } from "../types";

let conflictCounter = 0;
function nextId(): string {
  conflictCounter += 1;
  return `academic-conflict-${conflictCounter}`;
}

function acknowledge(kind: ImportConflict["kind"], summary: string, candidateIds: string[], sourceReferences: SourceReference[]): ImportConflict {
  return {
    id: nextId(),
    kind,
    summary,
    candidateIds,
    options: [{ label: "Acknowledged", value: "acknowledged", sourceReferences }],
    resolution: null,
  };
}

/** Two or more assessments (any subjects) sharing the same confirmed exact due date. */
export function detectSameDayAssessments(subjects: ImportedSubjectCandidate[]): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const byDate = new Map<string, Array<{ subject: ImportedSubjectCandidate; assessment: ImportedSubjectCandidate["assessments"][number] }>>();
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      if (assessment.due?.dateKind !== "exact" || !assessment.due.isoDate) continue;
      const list = byDate.get(assessment.due.isoDate) ?? [];
      list.push({ subject, assessment });
      byDate.set(assessment.due.isoDate, list);
    }
  }
  for (const [date, group] of byDate) {
    if (group.length < 2) continue;
    const names = group.map((g) => `"${g.assessment.title}" (${g.subject.name})`).join(", ");
    conflicts.push(
      acknowledge(
        "same-day-assessments",
        `Multiple assessments are due on ${date}: ${names}.`,
        group.map((g) => g.assessment.temporaryId),
        group.flatMap((g) => g.assessment.sourceReferences)
      )
    );
  }
  return conflicts;
}

/** Two or more exam-type assessments sharing the same confirmed exact due date AND time. */
export function detectOverlappingExams(subjects: ImportedSubjectCandidate[]): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const byDateTime = new Map<string, Array<{ subject: ImportedSubjectCandidate; assessment: ImportedSubjectCandidate["assessments"][number] }>>();
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      if (assessment.type !== "exam" || assessment.due?.dateKind !== "exact" || !assessment.due.isoDate || !assessment.due.isoTime) continue;
      const key = `${assessment.due.isoDate}T${assessment.due.isoTime}`;
      const list = byDateTime.get(key) ?? [];
      list.push({ subject, assessment });
      byDateTime.set(key, list);
    }
  }
  for (const [key, group] of byDateTime) {
    if (group.length < 2) continue;
    const names = group.map((g) => `"${g.assessment.title}" (${g.subject.name})`).join(", ");
    conflicts.push(
      acknowledge(
        "overlapping-exams",
        `Multiple exams are scheduled at the same time (${key.replace("T", " ")}): ${names}.`,
        group.map((g) => g.assessment.temporaryId),
        group.flatMap((g) => g.assessment.sourceReferences)
      )
    );
  }
  return conflicts;
}

/** A well-identified assessment (confirmed title, confirmed exact due date) with no weighting found at all — deliberately not raised for assessments still missing basic identity, to avoid conflict spam on genuinely low-confidence records. */
export function detectMissingWeighting(subjects: ImportedSubjectCandidate[]): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      const hasSolidIdentity = assessment.confidence !== "missing" && assessment.due?.dateKind === "exact";
      if (hasSolidIdentity && assessment.weighting === null) {
        conflicts.push(
          acknowledge(
            "missing-weighting",
            `"${assessment.title}" (${subject.name}) has a confirmed due date but no weighting was found.`,
            [assessment.temporaryId],
            assessment.sourceReferences
          )
        );
      }
    }
  }
  return conflicts;
}

/** An assessment's confirmed due date falls outside the stated academic year — a likely stale/misattributed date, not a real deadline. Skipped entirely when no academic year was given (never guessed). */
export function detectImpossibleDates(subjects: ImportedSubjectCandidate[], academicYear: string | null): ImportConflict[] {
  if (!academicYear || !/^\d{4}$/.test(academicYear)) return [];
  const conflicts: ImportConflict[] = [];
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      if (assessment.due?.dateKind !== "exact" || !assessment.due.isoDate) continue;
      const dueYear = assessment.due.isoDate.slice(0, 4);
      // A one-year tolerance covers a January deadline for a semester that
      // started the previous December — never flag a plausible cross-
      // year-boundary date as impossible.
      if (Math.abs(Number(dueYear) - Number(academicYear)) > 1) {
        conflicts.push(
          acknowledge(
            "impossible-date",
            `"${assessment.title}" (${subject.name}) is dated ${assessment.due.isoDate}, well outside the stated academic year ${academicYear} — please confirm this date.`,
            [assessment.temporaryId],
            assessment.sourceReferences
          )
        );
      }
    }
  }
  return conflicts;
}

/** A subject's module numbering skips a week (e.g. 1,2,4,5 with no 3). Only checked when at least 3 modules exist — a two-module extraction with a gap is too common/uninformative to flag. */
export function detectMissingWeeks(subjects: ImportedSubjectCandidate[]): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  for (const subject of subjects) {
    const weekNumbers = subject.modules.map((m) => m.weekNumber).filter((w): w is number => w !== null).sort((a, b) => a - b);
    if (weekNumbers.length < 3) continue;
    const missing: number[] = [];
    for (let w = weekNumbers[0]; w <= weekNumbers[weekNumbers.length - 1]; w += 1) {
      if (!weekNumbers.includes(w)) missing.push(w);
    }
    if (missing.length > 0) {
      conflicts.push(
        acknowledge(
          "missing-week",
          `${subject.name} has modules for weeks ${weekNumbers.join(", ")} but week${missing.length === 1 ? "" : "s"} ${missing.join(", ")} ${missing.length === 1 ? "wasn't" : "weren't"} found.`,
          subject.modules.map((m) => m.temporaryId),
          subject.sourceReferences
        )
      );
    }
  }
  return conflicts;
}

/** The same subject NAME appears as two separate, unmerged candidates post-merge — findSubjectMatch's code/title matching didn't consider them the same subject (e.g. both have a null code and the title similarity fell just short), almost always the same content imported twice. */
export function detectDuplicateImports(subjects: ImportedSubjectCandidate[]): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const byName = new Map<string, ImportedSubjectCandidate[]>();
  for (const subject of subjects) {
    const key = subject.name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(subject);
    byName.set(key, list);
  }
  for (const [, group] of byName) {
    if (group.length < 2) continue;
    conflicts.push(
      acknowledge(
        "duplicate-import",
        `"${group[0].name}" appears ${group.length} times as separate subjects — this usually means the same document was imported more than once.`,
        group.map((s) => s.temporaryId),
        group.flatMap((s) => s.sourceReferences)
      )
    );
  }
  return conflicts;
}

/** Runs every Phase 19 academic-conflict detector — called once from mergeSourcePackages alongside the existing detectDuplicateAssessmentNames. */
export function detectAcademicConflicts(subjects: ImportedSubjectCandidate[], academicYear: string | null): ImportConflict[] {
  return [
    ...detectSameDayAssessments(subjects),
    ...detectOverlappingExams(subjects),
    ...detectMissingWeighting(subjects),
    ...detectImpossibleDates(subjects, academicYear),
    ...detectMissingWeeks(subjects),
    ...detectDuplicateImports(subjects),
  ];
}
