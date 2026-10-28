/**
 * Moodle sync state, change detection (Phase 18F, Part 17). Pure,
 * client-usable functions — mirrors `canvasSync.ts` field-for-field,
 * including the identical two-consecutive-miss deletion state machine
 * (see that file's own header for the full reasoning — it applies
 * unchanged here). Sync metadata lives INSIDE `UniGameSaveData` (an
 * additive `moodleSync` field, see `src/types/domain.ts`), never in a
 * separate store, so the existing whole-save backup/Undo mechanism
 * already covers it with zero new Undo code. Credentials never appear
 * here or anywhere in this file's inputs/outputs.
 */

import { sha256Hex } from "../server/contentHash";
import type { ImportConflict, ImportedAnnouncementCandidate, ImportedAssessmentCandidate, ImportedCalendarCandidate, ImportedModuleCandidate, ImportedSubjectCandidate } from "./types";
import type { MoodleRemoteItemType, MoodleRemoteSnapshot } from "../types/domain";
import type { SemesterRecord, SubjectRecord } from "../types/domain";
export type { MoodleRemoteItemType, MoodleCourseBinding, MoodleRemoteSnapshot, MoodleSyncState } from "../types/domain";
export { createEmptyMoodleSyncState } from "../types/domain";

/** Same provenance-marker convention as Canvas's "Canvas — " prefix — survives through Apply onto the live AssessmentRecord.sourceFile/ModuleRecord.sourceNote, used to identify Moodle-origin data for the "Remove imported Moodle data" action (Part 20). */
const MOODLE_SOURCE_FILE_PREFIX = "Moodle — ";

export function isMoodleOriginSourceFile(sourceFile: string): boolean {
  return sourceFile.startsWith(MOODLE_SOURCE_FILE_PREFIX);
}

export interface MoodleDataRemovalPreview {
  subjectName: string;
  assessmentTitles: string[];
  moduleTitles: string[];
}

/** What "Remove imported Moodle data" would remove, PER subject — shown before the user confirms. Never removes a subject room itself; only Moodle-sourced assessments/modules within it. */
export function previewMoodleDataRemoval(semester: SemesterRecord): MoodleDataRemovalPreview[] {
  const previews: MoodleDataRemovalPreview[] = [];
  for (const subject of semester.subjects) {
    const assessmentTitles = subject.assessments.filter((a) => isMoodleOriginSourceFile(a.sourceFile)).map((a) => a.title);
    const moduleTitles = subject.modules.filter((m) => isMoodleOriginSourceFile(m.sourceNote)).map((m) => m.title);
    if (assessmentTitles.length > 0 || moduleTitles.length > 0) {
      previews.push({ subjectName: subject.name, assessmentTitles, moduleTitles });
    }
  }
  return previews;
}

/** The actual removal — a pure `(semester) => semester` reducer, applied by the caller with the same backup-before-commit discipline as every other Apply-adjacent mutation. */
export function removeMoodleImportedData(semester: SemesterRecord): SemesterRecord {
  const subjects: SubjectRecord[] = semester.subjects.map((subject) => ({
    ...subject,
    assessments: subject.assessments.filter((a) => !isMoodleOriginSourceFile(a.sourceFile)),
    modules: subject.modules.filter((m) => !isMoodleOriginSourceFile(m.sourceNote)),
  }));
  return { ...semester, subjects };
}

export type MoodleChangeKind =
  | "new-item"
  | "changed-name"
  | "changed-due-date"
  | "changed-description"
  | "changed-grade"
  | "unpublished"
  | "renamed"
  | "reordered"
  | "course-concluded"
  | "proposed-deletion";

export interface MoodleSyncChange {
  kind: MoodleChangeKind;
  remoteItemId: number;
  remoteItemType: MoodleRemoteItemType;
  summary: string;
  previousFingerprint: string | null;
  newFingerprint: string | null;
}

export interface MoodleSyncReport {
  changes: MoodleSyncChange[];
  newItemsCount: number;
  changedItemsCount: number;
  proposedDeletionsCount: number;
  unchangedCount: number;
}

async function fingerprintAssessment(a: ImportedAssessmentCandidate): Promise<string> {
  return sha256Hex(JSON.stringify({ title: a.title, description: a.description, due: a.due?.isoDate ?? null, weighting: a.weighting }));
}

async function fingerprintModule(m: ImportedModuleCandidate): Promise<string> {
  return sha256Hex(JSON.stringify({ title: m.title, topics: m.topics }));
}

async function fingerprintCalendarEvent(c: ImportedCalendarCandidate): Promise<string> {
  return sha256Hex(JSON.stringify({ title: c.title, start: c.start.isoDate, end: c.end?.isoDate ?? null }));
}

async function fingerprintAnnouncement(a: ImportedAnnouncementCandidate): Promise<string> {
  return sha256Hex(JSON.stringify({ title: a.title, body: a.body }));
}

export function parseMoodleTempId(temporaryId: string): { kind: string; moodleId: number } | null {
  const match = /^moodle-([a-z]+)-(\d+)$/.exec(temporaryId);
  if (!match) return null;
  return { kind: match[1], moodleId: Number(match[2]) };
}

/**
 * Compares a fresh Moodle fetch (mapped subject, with its modules/
 * assessments; plus calendar events and announcements) against the
 * previously stored snapshots for the SAME course, producing a reviewable
 * `MoodleSyncReport`. Never mutates the live save directly — the caller
 * (Review) applies changes only after explicit confirmation.
 */
export async function detectMoodleChanges(
  courseId: number,
  freshSubject: ImportedSubjectCandidate,
  freshCalendarEvents: ImportedCalendarCandidate[],
  freshAnnouncements: ImportedAnnouncementCandidate[],
  priorSnapshots: MoodleRemoteSnapshot[]
): Promise<{ report: MoodleSyncReport; nextSnapshots: MoodleRemoteSnapshot[] }> {
  const now = new Date().toISOString();
  const priorByKey = new Map(priorSnapshots.filter((s) => s.remoteCourseId === courseId).map((s) => [`${s.remoteItemType}:${s.remoteItemId}`, s]));
  const seenKeys = new Set<string>();
  const changes: MoodleSyncChange[] = [];
  const nextSnapshots: MoodleRemoteSnapshot[] = [...priorSnapshots.filter((s) => s.remoteCourseId !== courseId)];
  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  async function processItem(remoteItemType: MoodleRemoteItemType, temporaryId: string, fingerprint: string, label: string): Promise<void> {
    const parsed = parseMoodleTempId(temporaryId);
    if (!parsed) return; // not a Moodle-originated candidate — never touched by sync
    const key = `${remoteItemType}:${parsed.moodleId}`;
    seenKeys.add(key);
    const prior = priorByKey.get(key);

    if (!prior) {
      changes.push({ kind: "new-item", remoteItemId: parsed.moodleId, remoteItemType, summary: `New: ${label}`, previousFingerprint: null, newFingerprint: fingerprint });
      newCount += 1;
    } else if (prior.contentFingerprint !== fingerprint) {
      const overridden = prior.userOverriddenFields.length > 0;
      changes.push({
        kind: "changed-name",
        remoteItemId: parsed.moodleId,
        remoteItemType,
        summary: overridden ? `Changed on Moodle (you've edited this locally): ${label}` : `Changed on Moodle: ${label}`,
        previousFingerprint: prior.contentFingerprint,
        newFingerprint: fingerprint,
      });
      changedCount += 1;
    } else {
      unchangedCount += 1;
    }

    nextSnapshots.push({
      institutionId: prior?.institutionId ?? "",
      remoteCourseId: courseId,
      remoteItemId: parsed.moodleId,
      remoteItemType,
      remoteUpdatedAt: null,
      contentFingerprint: fingerprint,
      lastImportedAt: prior?.lastImportedAt ?? now,
      lastSeenAt: now,
      localTargetId: prior?.localTargetId ?? null,
      userOverriddenFields: prior?.userOverriddenFields ?? [],
      remoteDeletionState: "present",
    });
  }

  await processItem("course", freshSubject.temporaryId, await sha256Hex(JSON.stringify({ name: freshSubject.name, code: freshSubject.code })), freshSubject.name);
  for (const assessment of freshSubject.assessments) await processItem(assessment.type === "quiz" ? "quiz" : "assignment", assessment.temporaryId, await fingerprintAssessment(assessment), assessment.title);
  for (const module of freshSubject.modules) await processItem("section", module.temporaryId, await fingerprintModule(module), module.title);
  for (const event of freshCalendarEvents) await processItem("calendar-event", event.temporaryId, await fingerprintCalendarEvent(event), event.title);
  for (const announcement of freshAnnouncements) await processItem("announcement", announcement.temporaryId, await fingerprintAnnouncement(announcement), announcement.title);

  // Never deleted after one omission: "present" -> "missing-once" -> (if
  // still absent next time) "confirmed-deleted", and ONLY the confirmed
  // state becomes a proposed-deletion change (same rule as Canvas's sync).
  let proposedDeletions = 0;
  for (const [key, prior] of priorByKey) {
    if (seenKeys.has(key)) continue;
    const nextState = prior.remoteDeletionState === "missing-once" ? "confirmed-deleted" : "missing-once";
    if (nextState === "confirmed-deleted") {
      changes.push({
        kind: "proposed-deletion",
        remoteItemId: prior.remoteItemId,
        remoteItemType: prior.remoteItemType,
        summary: `No longer visible on Moodle after two syncs (${prior.remoteItemType} ${prior.remoteItemId}) — proposed for removal, not yet removed.`,
        previousFingerprint: prior.contentFingerprint,
        newFingerprint: null,
      });
      proposedDeletions += 1;
    }
    nextSnapshots.push({ ...prior, remoteDeletionState: nextState, lastSeenAt: prior.lastSeenAt });
  }

  return {
    report: { changes, newItemsCount: newCount, changedItemsCount: changedCount, proposedDeletionsCount: proposedDeletions, unchangedCount },
    nextSnapshots,
  };
}

let moodleConflictCounter = 0;
function nextMoodleConflictId(): string {
  moodleConflictCounter += 1;
  return `moodle-sync-conflict-${moodleConflictCounter}`;
}

/**
 * Turns proposed-deletion changes into real `ImportConflict`s so they flow
 * through the SAME Review/Apply gating as every other conflict — never
 * applied silently. Other change kinds are informational in the sync
 * report; due-date/weighting conflicts against an already-confirmed live
 * value are already raised for free by the existing, unmodified
 * `reconcileWithLiveSemester` once fresh Moodle data flows through it
 * exactly like any other provider's data — same discipline Canvas already
 * proved (see docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §12).
 */
export function proposedDeletionsToMoodleConflicts(report: MoodleSyncReportLike, candidateIdFor: (remoteItemId: number, remoteItemType: MoodleRemoteItemType) => string | null): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  for (const change of report.changes) {
    if (change.kind !== "proposed-deletion") continue;
    const candidateId = candidateIdFor(change.remoteItemId, change.remoteItemType);
    if (!candidateId) continue;
    conflicts.push({
      id: nextMoodleConflictId(),
      kind: "moodle-remote-item-removed",
      summary: change.summary,
      candidateIds: [candidateId],
      options: [
        { label: "Remove locally", value: "remove", sourceReferences: [] },
        { label: "Keep it", value: "keep", sourceReferences: [] },
      ],
      resolution: null,
    });
  }
  return conflicts;
}

interface MoodleSyncReportLike {
  changes: MoodleSyncChange[];
}
