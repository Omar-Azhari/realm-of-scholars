/**
 * Canvas sync state, change detection (Phase 18E, Part 15/16). Pure,
 * client-usable functions — sync metadata lives INSIDE `UniGameSaveData`
 * (an additive `canvasSync` field, see `src/types/domain.ts`), never in a
 * separate store, so the existing whole-save backup/Undo mechanism already
 * covers it with zero new Undo code (see
 * docs/PHASE_18E_CANVAS_INTEGRATION.md §10). Credentials never appear here
 * or anywhere in this file's inputs/outputs.
 *
 * Change detection compares a FRESH set of mapped Canvas candidates against
 * the STORED snapshots from the last sync, using the stable, Canvas-id-
 * derived `temporaryId`s `canvasMapping.ts` now produces (see that file) —
 * the same remote item always maps to the same id across syncs, so
 * matching is a simple lookup, never a fuzzy comparison.
 */

import { sha256Hex } from "../server/contentHash";
import type { ImportConflict, ImportedAnnouncementCandidate, ImportedAssessmentCandidate, ImportedCalendarCandidate, ImportedModuleCandidate, ImportedSubjectCandidate } from "./types";
import type { CanvasRemoteItemType, CanvasRemoteSnapshot } from "../types/domain";
import type { SemesterRecord, SubjectRecord } from "../types/domain";
export type { CanvasRemoteItemType, CanvasCourseBinding, CanvasRemoteSnapshot, CanvasSyncState } from "../types/domain";
export { createEmptyCanvasSyncState } from "../types/domain";

/** Every Canvas-mapped candidate's source-reference filename starts with this — the one, deliberately consistent marker `applySemesterImport` carries through onto the live `AssessmentRecord.sourceFile`/`ModuleRecord.sourceNote`-equivalent field, since the richer `SourceReference.parser` field ("canvas:assignment" etc.) doesn't survive Apply. Used to identify Canvas-origin data for the "Remove imported Canvas data" action (Part 19) — never used to identify data for any OTHER purpose (e.g. never used to gate ordinary Review behaviour). */
const CANVAS_SOURCE_FILE_PREFIX = "Canvas — ";

export function isCanvasOriginSourceFile(sourceFile: string): boolean {
  return sourceFile.startsWith(CANVAS_SOURCE_FILE_PREFIX);
}

export interface CanvasDataRemovalPreview {
  subjectName: string;
  assessmentTitles: string[];
  moduleTitles: string[];
}

/** What "Remove imported Canvas data" would remove, PER subject — shown before the user confirms (Part 19: "a separate destructive action with a clear preview"). Never removes a subject room itself (rooms are fixed and art-bound); only Canvas-sourced assessments/modules within it. */
export function previewCanvasDataRemoval(semester: SemesterRecord): CanvasDataRemovalPreview[] {
  const previews: CanvasDataRemovalPreview[] = [];
  for (const subject of semester.subjects) {
    const assessmentTitles = subject.assessments.filter((a) => isCanvasOriginSourceFile(a.sourceFile)).map((a) => a.title);
    const moduleTitles = subject.modules.filter((m) => isCanvasOriginSourceFile(m.sourceNote)).map((m) => m.title);
    if (assessmentTitles.length > 0 || moduleTitles.length > 0) {
      previews.push({ subjectName: subject.name, assessmentTitles, moduleTitles });
    }
  }
  return previews;
}

/** The actual removal — a pure `(semester) => semester` reducer, applied by the caller exactly like `applySemesterImport` (same backup-before-commit discipline applies at the call site, never here). */
export function removeCanvasImportedData(semester: SemesterRecord): SemesterRecord {
  const subjects: SubjectRecord[] = semester.subjects.map((subject) => ({
    ...subject,
    assessments: subject.assessments.filter((a) => !isCanvasOriginSourceFile(a.sourceFile)),
    modules: subject.modules.filter((m) => !isCanvasOriginSourceFile(m.sourceNote)),
  }));
  return { ...semester, subjects };
}

export type CanvasChangeKind =
  | "new-item"
  | "changed-name"
  | "changed-due-date"
  | "changed-description"
  | "changed-points"
  | "changed-weighting"
  | "changed-availability"
  | "unpublished"
  | "renamed"
  | "reordered"
  | "course-concluded"
  | "proposed-deletion";

export interface CanvasSyncChange {
  kind: CanvasChangeKind;
  remoteItemId: number;
  remoteItemType: CanvasRemoteItemType;
  summary: string;
  previousFingerprint: string | null;
  newFingerprint: string | null;
}

export interface CanvasSyncReport {
  changes: CanvasSyncChange[];
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

function parseCanvasTempId(temporaryId: string): { kind: string; canvasId: number } | null {
  const match = /^canvas-([a-z]+)-(\d+)$/.exec(temporaryId);
  if (!match) return null;
  return { kind: match[1], canvasId: Number(match[2]) };
}

/**
 * Compares a fresh Canvas fetch (mapped subject, with its modules/
 * assessments; plus calendar events and announcements) against the
 * previously stored snapshots for the SAME course, producing a reviewable
 * `CanvasSyncReport`. Never mutates the live save directly — the caller
 * (Review) applies changes only after explicit confirmation, exactly like
 * every other Apply path.
 */
export async function detectCanvasChanges(
  courseId: number,
  freshSubject: ImportedSubjectCandidate,
  freshCalendarEvents: ImportedCalendarCandidate[],
  freshAnnouncements: ImportedAnnouncementCandidate[],
  priorSnapshots: CanvasRemoteSnapshot[]
): Promise<{ report: CanvasSyncReport; nextSnapshots: CanvasRemoteSnapshot[] }> {
  const now = new Date().toISOString();
  const priorByKey = new Map(priorSnapshots.filter((s) => s.remoteCourseId === courseId).map((s) => [`${s.remoteItemType}:${s.remoteItemId}`, s]));
  const seenKeys = new Set<string>();
  const changes: CanvasSyncChange[] = [];
  const nextSnapshots: CanvasRemoteSnapshot[] = [...priorSnapshots.filter((s) => s.remoteCourseId !== courseId)];
  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  async function processItem(
    remoteItemType: CanvasRemoteItemType,
    temporaryId: string,
    fingerprint: string,
    label: string
  ): Promise<void> {
    const parsed = parseCanvasTempId(temporaryId);
    if (!parsed) return; // not a Canvas-originated candidate — never touched by sync
    const key = `${remoteItemType}:${parsed.canvasId}`;
    seenKeys.add(key);
    const prior = priorByKey.get(key);

    if (!prior) {
      changes.push({ kind: "new-item", remoteItemId: parsed.canvasId, remoteItemType, summary: `New: ${label}`, previousFingerprint: null, newFingerprint: fingerprint });
      newCount += 1;
    } else if (prior.contentFingerprint !== fingerprint) {
      if (prior.userOverriddenFields.length === 0) {
        changes.push({ kind: "changed-name", remoteItemId: parsed.canvasId, remoteItemType, summary: `Changed in Canvas: ${label}`, previousFingerprint: prior.contentFingerprint, newFingerprint: fingerprint });
        changedCount += 1;
      } else {
        // The user has an explicit local override on this item — the change
        // is still recorded (never silently dropped) but flagged distinctly
        // so Review can offer "keep mine" as the visible default, not just
        // silently apply the remote value over an edit the user made on
        // purpose (Part 17: "user progress, notes... must never be
        // silently overwritten").
        changes.push({ kind: "changed-name", remoteItemId: parsed.canvasId, remoteItemType, summary: `Changed in Canvas (you've edited this locally): ${label}`, previousFingerprint: prior.contentFingerprint, newFingerprint: fingerprint });
        changedCount += 1;
      }
    } else {
      unchangedCount += 1;
    }

    nextSnapshots.push({
      institutionId: prior?.institutionId ?? "",
      remoteCourseId: courseId,
      remoteItemId: parsed.canvasId,
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
  for (const assessment of freshSubject.assessments) await processItem("assignment", assessment.temporaryId, await fingerprintAssessment(assessment), assessment.title);
  for (const module of freshSubject.modules) await processItem("module", module.temporaryId, await fingerprintModule(module), module.title);
  for (const event of freshCalendarEvents) await processItem("calendar-event", event.temporaryId, await fingerprintCalendarEvent(event), event.title);
  for (const announcement of freshAnnouncements) await processItem("announcement", announcement.temporaryId, await fingerprintAnnouncement(announcement), announcement.title);

  // Items that existed in the PRIOR snapshot for this course but weren't
  // seen this run: never deleted after one omission (Part 16). "present" ->
  // "missing-once" -> (if still absent next time) "confirmed-deleted", and
  // ONLY the confirmed state becomes a proposed-deletion change.
  let proposedDeletions = 0;
  for (const [key, prior] of priorByKey) {
    if (seenKeys.has(key)) continue;
    const nextState = prior.remoteDeletionState === "missing-once" ? "confirmed-deleted" : "missing-once";
    if (nextState === "confirmed-deleted") {
      changes.push({
        kind: "proposed-deletion",
        remoteItemId: prior.remoteItemId,
        remoteItemType: prior.remoteItemType,
        summary: `No longer visible in Canvas after two syncs (${prior.remoteItemType} ${prior.remoteItemId}) — proposed for removal, not yet removed.`,
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

let canvasConflictCounter = 0;
function nextCanvasConflictId(): string {
  canvasConflictCounter += 1;
  return `canvas-sync-conflict-${canvasConflictCounter}`;
}

/**
 * Turns proposed-deletion changes into real `ImportConflict`s so they flow
 * through the SAME Review/Apply gating as every other conflict — a
 * proposed removal is never applied silently (Part 17). Other change kinds
 * (new items, ordinary content changes) are informational only in the sync
 * report; due-date/weighting conflicts against an already-CONFIRMED live
 * value are already raised for free by the existing
 * `reconcileWithLiveSemester` once the fresh Canvas data flows through it
 * exactly like any other provider's data — no separate Canvas-specific
 * code needed for those (see docs/PHASE_18E_CANVAS_INTEGRATION.md §Part 17).
 */
export function proposedDeletionsToConflicts(report: CanvasSyncReportLike, candidateIdFor: (remoteItemId: number, remoteItemType: CanvasRemoteItemType) => string | null): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  for (const change of report.changes) {
    if (change.kind !== "proposed-deletion") continue;
    const candidateId = candidateIdFor(change.remoteItemId, change.remoteItemType);
    if (!candidateId) continue;
    conflicts.push({
      id: nextCanvasConflictId(),
      kind: "canvas-remote-item-removed",
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

interface CanvasSyncReportLike {
  changes: CanvasSyncChange[];
}
