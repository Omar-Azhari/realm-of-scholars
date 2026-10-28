/**
 * The transactional apply step (Phase 18A, Part 9). A pure
 * `(save, package, selection) => save` reducer — exactly the style every
 * other mutation in `saveDataMutations.ts` already uses — so Apply either
 * fully succeeds or the caller never commits the result at all. No partial
 * write is representable.
 *
 * What this reducer does NOT do (by design, see the architecture audit):
 * it never touches `assessmentProgress` values, `studyLog`, XP, grades, or
 * task completion for records that already exist — it only ever (a) fills
 * currently `needs_confirmation` fields on a matched existing record, or
 * (b) appends brand-new module/assessment records (with their own default
 * progress entries, exactly like the seed data creates for every module and
 * assessment).
 */

import {
  confirmed,
  deriveConfirmationStatus,
  deriveReminderSchedule,
  unconfirmed,
  type AssessmentKind,
  type AssessmentRecord,
  type ModuleRecord,
  type ReminderKind,
  type ReminderRecord,
  type SubjectRecord,
  type TaskRecord,
  type UniGameSaveData,
  type UserAssessmentProgress,
} from "../types/domain";
import type {
  AcademicImportPackage,
  AssessmentCandidateType,
  ImportedAssessmentCandidate,
  ImportedCalendarCandidate,
  ImportedModuleCandidate,
} from "./types";
import { similarity, TITLE_MATCH_THRESHOLD } from "./merge/matching";
import { unresolvedConflictCount } from "./merge/mergeEngine";

export interface ImportSelection {
  /** Subject candidate temporaryId -> live SubjectRecord id, or null (excluded / unmapped). */
  subjectMapping: Record<string, string | null>;
  /** temporaryIds (module/assessment/calendar candidates) explicitly excluded from Apply. */
  excludedIds: Set<string>;
}

export function createEmptySelection(): ImportSelection {
  return { subjectMapping: {}, excludedIds: new Set() };
}

export interface ApplyDiffEntry {
  kind: "subject-field" | "module" | "assessment" | "reminder";
  label: string;
  action: "added" | "updated" | "skipped";
}

export interface ApplyDiff {
  entries: ApplyDiffEntry[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface ApplyValidation {
  ok: boolean;
  issues: string[];
}

/**
 * Must pass before Apply may run — mirrors "no one-click Import Everything
 * while conflicts remain". `liveSubjects` is optional purely for backward
 * compatibility with existing call sites/tests that predate the duplicate-
 * room-mapping check (Phase 18E, Part 13 — matters most for Canvas, which
 * can plausibly return many more courses than there are rooms); when
 * omitted, that one check is skipped rather than the whole function
 * breaking.
 */
export function validateForApply(pkg: AcademicImportPackage, selection: ImportSelection, liveSubjects?: SubjectRecord[]): ApplyValidation {
  const issues: string[] = [];
  const includedSubjects = pkg.subjects.filter((s) => !selection.excludedIds.has(s.temporaryId));

  for (const subject of includedSubjects) {
    if (!selection.subjectMapping[subject.temporaryId]) {
      issues.push(`"${subject.name}" needs to be matched to an existing subject, or excluded.`);
    }
  }

  // Two different candidates mapped to the SAME room is never silently
  // allowed — the second one to apply would just overwrite fields the
  // first one already filled, with no visibility into what happened.
  const claimedBy = new Map<string, string>(); // liveSubjectId -> candidate name that claimed it first
  for (const subject of includedSubjects) {
    const liveSubjectId = selection.subjectMapping[subject.temporaryId];
    if (!liveSubjectId) continue;
    const priorClaimant = claimedBy.get(liveSubjectId);
    if (priorClaimant) {
      const liveName = liveSubjects?.find((s) => s.id === liveSubjectId)?.name ?? liveSubjectId;
      issues.push(`"${subject.name}" and "${priorClaimant}" are both matched to "${liveName}" — resolve which one belongs there.`);
    } else {
      claimedBy.set(liveSubjectId, subject.name);
    }
  }

  const unresolved = unresolvedConflictCount(pkg);
  if (unresolved > 0) {
    const relevant = pkg.conflicts.filter(
      (c) => c.resolution === null && c.candidateIds.some((id) => !selection.excludedIds.has(id))
    );
    if (relevant.length > 0) {
      issues.push(`${relevant.length} conflict${relevant.length === 1 ? "" : "s"} still need${relevant.length === 1 ? "s" : ""} a decision.`);
    }
  }

  return { ok: issues.length === 0, issues };
}

function assessmentTypeToKind(type: AssessmentCandidateType): AssessmentKind {
  if (type === "assignment") return "other";
  return type;
}

function findLiveModuleMatch(candidate: ImportedModuleCandidate, modules: ModuleRecord[]): ModuleRecord | null {
  if (candidate.weekNumber !== null) {
    const byWeek = modules.find((m) => m.moduleNumber === candidate.weekNumber);
    if (byWeek) return byWeek;
  }
  let best: ModuleRecord | null = null;
  let bestScore = TITLE_MATCH_THRESHOLD;
  for (const m of modules) {
    const score = similarity(m.title, candidate.title);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

function findLiveAssessmentMatch(candidate: ImportedAssessmentCandidate, assessments: AssessmentRecord[]): AssessmentRecord | null {
  let best: AssessmentRecord | null = null;
  let bestScore = TITLE_MATCH_THRESHOLD;
  for (const a of assessments) {
    const score = similarity(a.title, candidate.title);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

function nextModuleId(subject: SubjectRecord): { id: string; number: number } {
  const prefix = subject.modules[0]?.id.split("-module-")[0] ?? subject.id.slice(0, 4);
  const usedNumbers = new Set(subject.modules.map((m) => m.moduleNumber));
  let n = 1;
  while (usedNumbers.has(n)) n += 1;
  return { id: `${prefix}-module-${String(n).padStart(2, "0")}`, number: n };
}

function nextAssessmentId(subject: SubjectRecord): { id: string; number: number } {
  const prefix = subject.assessments[0]?.id.split("-assessment-")[0] ?? subject.id.slice(0, 4);
  const usedNumbers = new Set(subject.assessments.map((a) => a.assessmentNumber));
  let n = 1;
  while (usedNumbers.has(n)) n += 1;
  return { id: `${prefix}-assessment-${n}`, number: n };
}

function mergeModuleIntoSubject(
  live: ModuleRecord[],
  candidate: ImportedModuleCandidate,
  subject: SubjectRecord,
  diff: ApplyDiffEntry[],
  excludedIds: Set<string>
): { modules: ModuleRecord[]; newTasks: TaskRecord[]; resultModuleId: string } {
  const match = findLiveModuleMatch(candidate, live);
  if (match) {
    const matchSourceFileLabel = candidate.sourceReferences[0]?.filename ?? match.sourceNote;
    // Phase 19: append newly-extracted readings/schedule/outcomes that
    // aren't already present (matched by title) — but never onto a field
    // the user has directly edited since import (manualOverrides), per
    // Part 9's "never silently replace user edits" rule. Individually
    // excluded items (Review's per-item Accept/Reject, Part 10) are
    // filtered out here, exactly like every other candidate type.
    const existingReadingTitles = new Set(match.readings.map((r) => r.title));
    const newReadings = (candidate.structuredReadings ?? [])
      .filter((r) => !existingReadingTitles.has(r.title) && !excludedIds.has(r.temporaryId))
      .map((r) => ({ id: r.temporaryId, title: r.title, kind: r.kind, author: r.author, url: r.url, sourceFile: r.sourceReferences[0]?.filename ?? matchSourceFileLabel }));
    const existingScheduleTitles = new Set(match.schedule.map((s) => s.title));
    const newSchedule = (candidate.schedule ?? [])
      .filter((s) => !existingScheduleTitles.has(s.title) && !excludedIds.has(s.temporaryId))
      .map((s) => ({ id: s.temporaryId, kind: s.kind, title: s.title, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, location: s.location, sourceFile: s.sourceReferences[0]?.filename ?? matchSourceFileLabel }));
    const existingOutcomeTexts = new Set(match.outcomes);
    const newOutcomes = (candidate.outcomes ?? [])
      .filter((o) => !excludedIds.has(o.temporaryId))
      .map((o) => (o.code ? `${o.code}: ${o.text}` : o.text))
      .filter((text) => !existingOutcomeTexts.has(text));

    const updated = live.map((m) =>
      m === match
        ? {
            ...m,
            overview: m.overview && m.overview !== "Title and instructions were not clearly visible in the screenshots." ? m.overview : candidate.description || m.overview,
            readings: m.manualOverrides.includes("readings") ? m.readings : [...m.readings, ...newReadings],
            schedule: m.manualOverrides.includes("schedule") ? m.schedule : [...m.schedule, ...newSchedule],
            outcomes: m.manualOverrides.includes("outcomes") ? m.outcomes : [...m.outcomes, ...newOutcomes],
          }
        : m
    );
    diff.push({ kind: "module", label: match.title, action: candidate.description || newReadings.length || newSchedule.length || newOutcomes.length ? "updated" : "skipped" });
    return { modules: updated, newTasks: [], resultModuleId: match.id };
  }

  const { id, number } = nextModuleId(subject);
  const sourceFileLabel = candidate.sourceReferences[0]?.filename ?? "Added via Semester Setup import.";
  const newModule: ModuleRecord = {
    id,
    subjectId: subject.id,
    moduleNumber: number,
    title: candidate.title,
    overview: candidate.description || "Imported from a syllabus document.",
    suggestedTasks: [],
    miniGameIdeas: [],
    // Same provenance convention as assessments' `sourceFile` below — a
    // provider-specific source-reference filename when one exists (e.g.
    // Canvas's mapping prefixes "Canvas — ", used by
    // canvasSync.ts's Remove-imported-data preview), a generic fallback
    // otherwise.
    sourceNote: sourceFileLabel,
    // Phase 19: readings/schedule/outcomes are carried over directly (they
    // never cross-reference another module). prerequisiteModuleIds is
    // deliberately left [] here — resolving a candidate's temporaryId
    // cross-references to real module ids requires every sibling module in
    // the subject to exist first, so that resolution is a second pass in
    // applySemesterImport (see docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §3/§9).
    readings: (candidate.structuredReadings ?? [])
      .filter((r) => !excludedIds.has(r.temporaryId))
      .map((r) => ({
        id: r.temporaryId,
        title: r.title,
        kind: r.kind,
        author: r.author,
        url: r.url,
        sourceFile: r.sourceReferences[0]?.filename ?? sourceFileLabel,
      })),
    schedule: (candidate.schedule ?? [])
      .filter((s) => !excludedIds.has(s.temporaryId))
      .map((s) => ({
        id: s.temporaryId,
        kind: s.kind,
        title: s.title,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location,
        sourceFile: s.sourceReferences[0]?.filename ?? sourceFileLabel,
      })),
    outcomes: (candidate.outcomes ?? [])
      .filter((o) => !excludedIds.has(o.temporaryId))
      .map((o) => (o.code ? `${o.code}: ${o.text}` : o.text)),
    prerequisiteModuleIds: [],
    manualOverrides: [],
  };
  const newTask: TaskRecord = {
    id: `module-task-${id}`,
    linkedAssessmentId: null,
    linkedModuleId: id,
    title: `Complete: ${newModule.title}`,
    type: "milestone",
    dueDate: null,
    estimatedMinutes: null,
    completed: false,
    completedAt: null,
    reviewedAt: null,
    xpReward: 10,
    weekNumber: null,
  };
  diff.push({ kind: "module", label: newModule.title, action: "added" });
  return { modules: [...live, newModule], newTasks: [newTask], resultModuleId: newModule.id };
}

function mergeAssessmentIntoSubject(
  live: AssessmentRecord[],
  candidate: ImportedAssessmentCandidate,
  subject: SubjectRecord,
  diff: ApplyDiffEntry[]
): { assessments: AssessmentRecord[]; newProgress: UserAssessmentProgress[] } {
  const match = findLiveAssessmentMatch(candidate, live);
  if (match) {
    let changed = false;
    let next = { ...match };

    if (next.weight.status !== "confirmed" && candidate.weighting !== null && candidate.fieldConfidence.weighting !== "conflicting") {
      next = { ...next, weight: confirmed(candidate.weighting), weightRaw: `${candidate.weighting}%` };
      changed = true;
    }
    if (
      next.dueDate.status !== "confirmed" &&
      candidate.due?.isoDate &&
      candidate.due.dateKind === "exact" &&
      candidate.fieldConfidence.dueDate !== "conflicting"
    ) {
      next = { ...next, dueDate: confirmed(candidate.due.isoDate), dateKind: "exact", dueWindowRaw: candidate.due.rawText };
      changed = true;
    }
    if (next.dueTime.status !== "confirmed" && candidate.due?.isoTime && candidate.fieldConfidence.dueTime !== "conflicting") {
      next = { ...next, dueTime: confirmed(candidate.due.isoTime) };
      changed = true;
    }

    if (changed) {
      next = {
        ...next,
        confirmationStatus: deriveConfirmationStatus(next.weight, next.dueDate, next.dueTime),
        reminderSchedule: deriveReminderSchedule(next.dueDate, next.dueTime),
      };
    }

    diff.push({ kind: "assessment", label: match.title, action: changed ? "updated" : "skipped" });
    return {
      assessments: live.map((a) => (a === match ? next : a)),
      newProgress: [],
    };
  }

  const { id, number } = nextAssessmentId(subject);
  const weight = candidate.weighting !== null ? confirmed(candidate.weighting) : unconfirmed<number>();
  const dueDate =
    candidate.due?.isoDate && candidate.due.dateKind === "exact" ? confirmed(candidate.due.isoDate) : unconfirmed<string>();
  const dueTime = candidate.due?.isoTime ? confirmed(candidate.due.isoTime) : unconfirmed<string>();

  const newAssessment: AssessmentRecord = {
    id,
    subjectId: subject.id,
    assessmentNumber: number,
    part: null,
    title: candidate.title,
    kind: assessmentTypeToKind(candidate.type),
    weight,
    weightRaw: candidate.weighting !== null ? `${candidate.weighting}%` : "NEEDS_CONFIRMATION",
    dueDate,
    dueTime,
    dueWindowRaw: candidate.due?.rawText ?? "NEEDS_CONFIRMATION",
    dateKind: candidate.due?.dateKind ?? "missing",
    confirmationStatus: deriveConfirmationStatus(weight, dueDate, dueTime),
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    reminderSchedule: deriveReminderSchedule(dueDate, dueTime),
    description: candidate.description,
    notes: "Added via Semester Setup import.",
    sourceFile: candidate.sourceReferences[0]?.filename ?? "Imported",
    examInfo: candidate.examInfo ? confirmed(candidate.examInfo) : unconfirmed<string>(),
  };
  const newProgress: UserAssessmentProgress = {
    assessmentId: id,
    progressPercent: 0,
    status: "not_started",
    statusChangedAt: null,
    estimatedHours: null,
    hoursCompleted: 0,
    checklist: [],
    grade: null,
    links: [],
  };
  diff.push({ kind: "assessment", label: newAssessment.title, action: "added" });
  return { assessments: [...live, newAssessment], newProgress: [newProgress] };
}

function calendarEventToReminderKind(event: ImportedCalendarCandidate): ReminderKind {
  if (event.eventType === "assessment-due" || event.eventType === "exam") return "assessment-deadline";
  if (event.eventType === "holiday") return "milestone";
  return "study-session";
}

export function buildApplyDiff(pkg: AcademicImportPackage, selection: ImportSelection, save: UniGameSaveData): ApplyDiff {
  const entries: ApplyDiffEntry[] = [];
  const included = pkg.subjects.filter((s) => !selection.excludedIds.has(s.temporaryId) && selection.subjectMapping[s.temporaryId]);

  for (const subjectCandidate of included) {
    const liveSubjectId = selection.subjectMapping[subjectCandidate.temporaryId];
    const liveSubject = save.semester.subjects.find((s) => s.id === liveSubjectId);
    if (!liveSubject) continue;

    if (liveSubject.code.status !== "confirmed" && subjectCandidate.code) {
      entries.push({ kind: "subject-field", label: `${liveSubject.name} — code`, action: "updated" });
    }

    for (const m of subjectCandidate.modules) {
      if (selection.excludedIds.has(m.temporaryId)) continue;
      mergeModuleIntoSubject(liveSubject.modules, m, liveSubject, entries, selection.excludedIds);
    }
    for (const a of subjectCandidate.assessments) {
      if (selection.excludedIds.has(a.temporaryId)) continue;
      mergeAssessmentIntoSubject(liveSubject.assessments, a, liveSubject, entries);
    }
  }

  for (const event of pkg.calendarEvents) {
    if (selection.excludedIds.has(event.temporaryId)) continue;
    if (!event.start.isoDate) {
      entries.push({ kind: "reminder", label: event.title, action: "skipped" });
      continue;
    }
    entries.push({ kind: "reminder", label: event.title, action: "added" });
  }

  return {
    entries,
    addedCount: entries.filter((e) => e.action === "added").length,
    updatedCount: entries.filter((e) => e.action === "updated").length,
    skippedCount: entries.filter((e) => e.action === "skipped").length,
  };
}

/**
 * The pure reducer. Throws only on a genuine internal invariant violation
 * (never on ordinary "nothing to do") — callers validate with
 * `validateForApply` first and should treat any throw as "roll back, don't
 * commit" (see docs/PHASE_18A_IMPORT_ARCHITECTURE.md §7-8).
 */
export function applySemesterImport(save: UniGameSaveData, pkg: AcademicImportPackage, selection: ImportSelection): UniGameSaveData {
  let subjects = save.semester.subjects;
  let tasks = save.tasks;
  let assessmentProgress = save.assessmentProgress;
  const diffEntries: ApplyDiffEntry[] = [];

  const included = pkg.subjects.filter((s) => !selection.excludedIds.has(s.temporaryId) && selection.subjectMapping[s.temporaryId]);

  for (const subjectCandidate of included) {
    const liveSubjectId = selection.subjectMapping[subjectCandidate.temporaryId];
    const liveSubject = subjects.find((s) => s.id === liveSubjectId);
    if (!liveSubject) continue;

    let nextSubject = liveSubject;
    if (nextSubject.code.status !== "confirmed" && subjectCandidate.code) {
      nextSubject = { ...nextSubject, code: confirmed(subjectCandidate.code) };
    }

    const newTasksForSubject: TaskRecord[] = [];
    const moduleTempIdToRealId = new Map<string, string>();
    const includedModuleCandidates = subjectCandidate.modules.filter((m) => !selection.excludedIds.has(m.temporaryId));
    for (const m of includedModuleCandidates) {
      const result = mergeModuleIntoSubject(nextSubject.modules, m, nextSubject, diffEntries, selection.excludedIds);
      nextSubject = { ...nextSubject, modules: result.modules };
      newTasksForSubject.push(...result.newTasks);
      moduleTempIdToRealId.set(m.temporaryId, result.resultModuleId);
    }
    // Second pass (Part 8): resolve each candidate's prerequisiteModuleIds
    // (temporaryIds pointing at SIBLING module candidates) into real
    // ModuleRecord ids — this can only happen once every sibling module in
    // this subject has been created/matched above, since a prerequisite
    // may point at a module later in the same candidate list.
    for (const m of includedModuleCandidates) {
      if (!m.prerequisiteModuleIds || m.prerequisiteModuleIds.length === 0) continue;
      const realModuleId = moduleTempIdToRealId.get(m.temporaryId);
      if (!realModuleId) continue;
      const realPrereqIds = m.prerequisiteModuleIds.map((tid) => moduleTempIdToRealId.get(tid)).filter((id): id is string => Boolean(id));
      if (realPrereqIds.length === 0) continue;
      nextSubject = {
        ...nextSubject,
        modules: nextSubject.modules.map((mod) =>
          mod.id === realModuleId && !mod.manualOverrides.includes("prerequisiteModuleIds")
            ? { ...mod, prerequisiteModuleIds: [...new Set([...mod.prerequisiteModuleIds, ...realPrereqIds])] }
            : mod
        ),
      };
    }

    const newProgressForSubject: UserAssessmentProgress[] = [];
    for (const a of subjectCandidate.assessments) {
      if (selection.excludedIds.has(a.temporaryId)) continue;
      const result = mergeAssessmentIntoSubject(nextSubject.assessments, a, nextSubject, diffEntries);
      nextSubject = { ...nextSubject, assessments: result.assessments };
      newProgressForSubject.push(...result.newProgress);
    }

    subjects = subjects.map((s) => (s.id === nextSubject.id ? nextSubject : s));
    tasks = [...tasks, ...newTasksForSubject];
    assessmentProgress = [...assessmentProgress, ...newProgressForSubject];
  }

  // Standalone calendar events (no matching assessment) become user reminders
  // — reusing the existing ReminderRecord store rather than a parallel one.
  const newReminders: ReminderRecord[] = [];
  const nowIso = new Date().toISOString();
  for (const event of pkg.calendarEvents) {
    if (selection.excludedIds.has(event.temporaryId)) continue;
    if (!event.start.isoDate) continue; // nothing to fire on — never invented
    const fireTime = event.start.isoTime ?? "09:00"; // a reminder needs a trigger time; the assessment's own due TIME is never invented this way
    newReminders.push({
      id: `import-${event.temporaryId}`,
      kind: calendarEventToReminderKind(event),
      title: event.title,
      subjectId: null,
      assessmentId: null,
      offsetIso: null,
      fireAt: `${event.start.isoDate}T${fireTime}`,
      sourceWindow: event.start.rawText,
      status: "pending",
      snoozedUntil: null,
      notifiedAt: null,
      origin: "user",
      createdAt: nowIso,
    });
  }

  return {
    ...save,
    semester: { ...save.semester, subjects },
    tasks,
    assessmentProgress,
    reminders: [...save.reminders, ...newReminders],
  };
}
