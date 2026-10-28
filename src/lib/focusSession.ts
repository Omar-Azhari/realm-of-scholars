/**
 * Focus Sprint lifecycle — pure save mutations plus real-clock timer math.
 *
 * Timer model: the active session stores `accumulatedMs` (focused time banked
 * by previous run segments) and `segmentStartedAt` (wall-clock start of the
 * current running segment, null while paused). Elapsed time is always
 * `accumulatedMs + (now - segmentStartedAt)` — derived from real timestamps,
 * so a refresh, tab sleep, or laptop lid-close reconstructs the exact state;
 * setInterval only repaints the UI.
 *
 * Completion is idempotent by session id: if a record with the active
 * session's id already exists, the mutation returns the save unchanged —
 * retrying the completion flow can never double-award XP or duplicate the
 * auto-created journal entry.
 */

import { computeFocusXp, computeLevel, isCountedSession, type FocusXpResult } from "./xpRules";
import { STREAK_BONUS_XP, getMelbourneDateIso, getMelbourneDateTimeKey, shiftDateIso } from "./selectors";
import type {
  ActiveFocusSession,
  FocusSessionRecord,
  FocusSessionStatus,
  StudyLogEntry,
  UniGameSaveData,
} from "../types/domain";

export const FOCUS_PRESETS = [
  { focusMinutes: 25, breakMinutes: 5, label: "25 / 5" },
  { focusMinutes: 45, breakMinutes: 10, label: "45 / 10" },
  { focusMinutes: 60, breakMinutes: 15, label: "60 / 15" },
] as const;


/** Real focused milliseconds so far. */
export function getElapsedFocusMs(session: ActiveFocusSession, now: Date = new Date()): number {
  const running = session.segmentStartedAt
    ? Math.max(0, now.getTime() - new Date(session.segmentStartedAt).getTime())
    : 0;
  return session.accumulatedMs + running;
}

export function isFocusSessionPaused(session: ActiveFocusSession): boolean {
  return session.segmentStartedAt === null;
}

/** Starts a session — refused (save returned unchanged) while another is active. */
export function startFocusSession(
  save: UniGameSaveData,
  input: {
    subjectId: string;
    assessmentId?: string | null;
    moduleId?: string | null;
    focusMinutes: number;
    breakMinutes: number;
  },
  now: Date = new Date()
): UniGameSaveData {
  if (save.activeFocusSession) return save;
  const focusMinutes = Math.min(240, Math.max(1, Math.round(input.focusMinutes)));
  const breakMinutes = Math.min(60, Math.max(0, Math.round(input.breakMinutes)));
  return {
    ...save,
    activeFocusSession: {
      id: `focus-${crypto.randomUUID()}`,
      subjectId: input.subjectId,
      assessmentId: input.assessmentId ?? null,
      moduleId: input.moduleId ?? null,
      startedAt: now.toISOString(),
      focusMinutes,
      breakMinutes,
      accumulatedMs: 0,
      segmentStartedAt: now.toISOString(),
      notes: "",
    },
  };
}

export function pauseFocusSession(save: UniGameSaveData, now: Date = new Date()): UniGameSaveData {
  const session = save.activeFocusSession;
  if (!session || session.segmentStartedAt === null) return save;
  return {
    ...save,
    activeFocusSession: {
      ...session,
      accumulatedMs: getElapsedFocusMs(session, now),
      segmentStartedAt: null,
    },
  };
}

export function resumeFocusSession(save: UniGameSaveData, now: Date = new Date()): UniGameSaveData {
  const session = save.activeFocusSession;
  if (!session || session.segmentStartedAt !== null) return save;
  return {
    ...save,
    activeFocusSession: { ...session, segmentStartedAt: now.toISOString() },
  };
}

export function setFocusSessionNotes(save: UniGameSaveData, notes: string): UniGameSaveData {
  if (!save.activeFocusSession) return save;
  return { ...save, activeFocusSession: { ...save.activeFocusSession, notes } };
}

export function setFocusSessionLinks(
  save: UniGameSaveData,
  links: { assessmentId: string | null; moduleId: string | null }
): UniGameSaveData {
  if (!save.activeFocusSession) return save;
  return { ...save, activeFocusSession: { ...save.activeFocusSession, ...links } };
}

export interface FocusCompletionOutcome {
  save: UniGameSaveData;
  record: FocusSessionRecord | null;
  xp: FocusXpResult | null;
  journalEntryId: string | null;
}

/**
 * Ends the active session. `status` distinguishes a natural completion, an
 * early finish (records only real elapsed time), and a cancel (no XP, no
 * journal entry). Also advances the shared daily study streak for counted
 * sessions — the same once-per-Melbourne-day rule module completion uses.
 */
export function endFocusSession(
  save: UniGameSaveData,
  status: FocusSessionStatus,
  now: Date = new Date()
): FocusCompletionOutcome {
  const session = save.activeFocusSession;
  if (!session) return { save, record: null, xp: null, journalEntryId: null };
  // Idempotency: a record for this id means a retry — change nothing.
  if (save.completedFocusSessions.some((record) => record.id === session.id)) {
    return { save: { ...save, activeFocusSession: null }, record: null, xp: null, journalEntryId: null };
  }

  const elapsedFocusSeconds = Math.floor(getElapsedFocusMs(session, now) / 1000);
  const cancelled = status === "cancelled";
  const xp = cancelled ? null : computeFocusXp(elapsedFocusSeconds, save.completedFocusSessions, now);

  let xpDelta = xp?.totalXp ?? 0;
  let { streakCount, longestStreak, lastActiveDate } = save.userProgress;
  if (xp && xp.counted) {
    const today = getMelbourneDateIso(now);
    if (lastActiveDate !== today) {
      streakCount = lastActiveDate === shiftDateIso(today, -1) ? streakCount + 1 : 1;
      lastActiveDate = today;
      xpDelta += STREAK_BONUS_XP;
      xp.lines.push({ label: "Daily study streak maintained", xp: STREAK_BONUS_XP });
      xp.totalXp += STREAK_BONUS_XP;
    }
    longestStreak = Math.max(longestStreak, streakCount);
  }

  const record: FocusSessionRecord = {
    id: session.id,
    subjectId: session.subjectId,
    assessmentId: session.assessmentId,
    moduleId: session.moduleId,
    startedAt: session.startedAt,
    endedAt: now.toISOString(),
    focusMinutesPlanned: session.focusMinutes,
    breakMinutesPlanned: session.breakMinutes,
    elapsedFocusSeconds,
    status,
    xpAwarded: xp?.totalXp ?? 0,
    journalEntryId: null,
  };

  // Auto journal entry for non-cancelled sessions (deduped by focusSessionId).
  let journalEntryId: string | null = null;
  let studyLog = save.studyLog;
  if (!cancelled) {
    const existing = save.studyLog.find((entry) => entry.focusSessionId === session.id);
    if (existing) {
      journalEntryId = existing.id;
    } else {
      journalEntryId = `log-${crypto.randomUUID()}`;
      const startKey = getMelbourneDateTimeKey(new Date(session.startedAt));
      const entry: StudyLogEntry = {
        id: journalEntryId,
        subjectId: session.subjectId,
        assessmentId: session.assessmentId,
        moduleId: session.moduleId,
        dateTime: startKey,
        durationMinutes: Math.floor(elapsedFocusSeconds / 60),
        completed: "",
        difficulties: "",
        nextPlan: "",
        moodBefore: null,
        moodAfter: null,
        notes: session.notes,
        focusSessionId: session.id,
      };
      studyLog = [...save.studyLog, entry];
    }
    record.journalEntryId = journalEntryId;
  }

  const newXp = Math.max(0, save.userProgress.xp + xpDelta);
  const nextSave: UniGameSaveData = {
    ...save,
    activeFocusSession: null,
    completedFocusSessions: [...save.completedFocusSessions, record],
    studyLog,
    userProgress: {
      ...save.userProgress,
      xp: newXp,
      level: computeLevel(newXp),
      streakCount,
      longestStreak,
      lastActiveDate,
    },
  };
  return { save: nextSave, record, xp, journalEntryId };
}

/* ------------------------------------------------------------------ */
/* Derived study-time totals (used by profile + room evolution)         */
/* ------------------------------------------------------------------ */

/** Counted (≥5-minute, non-cancelled) sessions. */
export function getCountedSessions(save: UniGameSaveData): FocusSessionRecord[] {
  return save.completedFocusSessions.filter(isCountedSession);
}

export function getTotalFocusSeconds(save: UniGameSaveData): number {
  return getCountedSessions(save).reduce((sum, record) => sum + record.elapsedFocusSeconds, 0);
}

export function getSubjectFocusSeconds(save: UniGameSaveData, subjectId: string): number {
  return getCountedSessions(save)
    .filter((record) => record.subjectId === subjectId)
    .reduce((sum, record) => sum + record.elapsedFocusSeconds, 0);
}
