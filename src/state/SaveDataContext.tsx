import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setSoundEnabled, setCategoryVolume } from "../lib/sound";
import { syncAutoReminders } from "../lib/reminders";
import { syncMilestones } from "../lib/milestones";
import { buildStudentContext } from "../ai/ContextEngine";
import { syncGoalMilestones } from "../ai/GoalSystem";
import { withRecordedTopic, DEFAULT_NPC_MEMORY, MAX_ADVICE_LOG_ENTRIES } from "../lib/npcMemory";
import { syncFurnitureUnlocks } from "../data/furnitureUnlocks";
import { getMelbourneDateIso, getMelbourneDateTimeKey } from "../lib/selectors";
import {
  endFocusSession as endFocusSessionMutation,
  pauseFocusSession,
  resumeFocusSession,
  setFocusSessionLinks,
  setFocusSessionNotes,
  startFocusSession,
  type FocusCompletionOutcome,
} from "../lib/focusSession";
import type {
  AppSettings,
  AssessmentProgressStatus,
  FocusSessionStatus,
  PersonalGoals,
  PlayerIdentity,
  ReminderKind,
  ReminderStatus,
  StudyLogEntry,
  UniGameSaveData,
} from "../types/domain";
import {
  backupCurrentSave,
  downloadSaveData,
  importSaveDataFromJson,
  loadSaveData,
  persistSaveData,
  resetSaveData as resetSaveDataInStorage,
  sanitizeSaveData,
  markImportBackupKind,
  getImportBackupKind,
  hasImportBackup,
  IMPORT_BACKUP_KEY,
  type ImportResult,
} from "../lib/persistence";
import {
  confirmAssessmentAiPolicy,
  confirmAssessmentDueDate,
  confirmAssessmentDueTime,
  confirmAssessmentExtensionEligibility,
  confirmAssessmentWeight,
  confirmSubjectCode,
  confirmSemesterStartDate,
  confirmSemesterEndDate,
  markModuleReviewed,
  toggleModuleCompletion,
  setAssessmentProgressStatus,
  setAssessmentProgressPercent,
  setAssessmentEstimatedHours,
  setAssessmentHoursCompleted,
  setAssessmentGrade,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
  addAssessmentLink,
  removeAssessmentLink,
  togglePinnedPriority,
  setPersonalGoals,
  setPlayerIdentity,
} from "../lib/saveDataMutations";
import { applySemesterImport, type ImportSelection } from "../import/applyImport";
import type { AcademicImportPackage } from "../import/types";

type SaveDataUpdater = UniGameSaveData | ((prev: UniGameSaveData) => UniGameSaveData);

interface SaveDataContextValue {
  saveData: UniGameSaveData;
  /** False while localStorage writes are failing — progress is session-only. */
  storageOk: boolean;
  setSaveData: (updater: SaveDataUpdater) => void;
  exportSaveData: () => void;
  importSaveData: (json: string) => ImportResult;
  resetSaveData: () => void;
  toggleModuleCompletion: (moduleId: string) => void;
  markModuleReviewed: (moduleId: string) => void;
  confirmSubjectCode: (subjectId: string, code: string) => void;
  confirmSemesterStartDate: (dateIso: string) => void;
  confirmSemesterEndDate: (dateIso: string) => void;
  confirmAssessmentWeight: (assessmentId: string, weight: number) => void;
  confirmAssessmentDueDate: (assessmentId: string, dueDate: string) => void;
  confirmAssessmentDueTime: (assessmentId: string, dueTime: string) => void;
  confirmAssessmentAiPolicy: (assessmentId: string, aiPolicy: string) => void;
  confirmAssessmentExtensionEligibility: (assessmentId: string, extensionEligibility: string) => void;
  setAssessmentProgressStatus: (assessmentId: string, status: AssessmentProgressStatus) => void;
  setAssessmentProgressPercent: (assessmentId: string, progressPercent: number) => void;
  setAssessmentEstimatedHours: (assessmentId: string, estimatedHours: number | null) => void;
  setAssessmentHoursCompleted: (assessmentId: string, hoursCompleted: number) => void;
  setAssessmentGrade: (assessmentId: string, grade: number | null) => void;
  addChecklistItem: (assessmentId: string, label: string) => void;
  toggleChecklistItem: (assessmentId: string, itemId: string) => void;
  removeChecklistItem: (assessmentId: string, itemId: string) => void;
  addAssessmentLink: (assessmentId: string, label: string, url: string) => void;
  removeAssessmentLink: (assessmentId: string, linkId: string) => void;
  togglePinnedPriority: (itemId: string) => void;
  /* Reminders (save v2) */
  addUserReminder: (input: {
    kind: ReminderKind;
    title: string;
    fireAt: string;
    subjectId?: string | null;
    assessmentId?: string | null;
  }) => void;
  setReminderStatus: (reminderId: string, status: ReminderStatus) => void;
  snoozeReminder: (reminderId: string, untilKey: string) => void;
  deleteUserReminder: (reminderId: string) => void;
  markRemindersNotified: (reminderIds: string[]) => void;
  /* Study logs (save v2) */
  addStudyLog: (entry: Omit<StudyLogEntry, "id">) => void;
  updateStudyLog: (logId: string, patch: Partial<Omit<StudyLogEntry, "id">>) => void;
  deleteStudyLog: (logId: string) => void;
  /* Settings */
  updateSettings: (patch: Partial<AppSettings>) => void;
  /* Focus Sprint (Phase 7) */
  startFocus: (input: {
    subjectId: string;
    assessmentId?: string | null;
    moduleId?: string | null;
    focusMinutes: number;
    breakMinutes: number;
  }) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  setFocusNotes: (notes: string) => void;
  setFocusLinks: (links: { assessmentId: string | null; moduleId: string | null }) => void;
  /** Ends the active session and returns the outcome (XP breakdown, journal id). Idempotent per session. */
  endFocus: (status: FocusSessionStatus) => FocusCompletionOutcome;
  /* Mentor bonds (Phase 7) — at most one visit counted per Melbourne day. */
  recordRoomVisit: (subjectId: string) => void;
  /** Phase 21 Part 2/8 — same once-per-Melbourne-day counting as recordRoomVisit, for the 6 real campus LOCATIONS (as opposed to a subject's own room). sceneId is a CampusSceneId, kept as a plain string here so this module never needs to import the 3D world's types. */
  recordBuildingVisit: (sceneId: string) => void;
  /** Phase 21 Part 3 "Campus Memory" — remembers the last line an important NPC said (subject id, or "guide"), and when. Always overwrites (not gated to once-per-day) since a later conversation the same day should still update "what was last said," even though the recognition check separately asks "was it today." Phase 23 (additive): an optional conversation `topic` is folded into the NPC's small recent-topics memory in the same mutation. */
  recordNpcInteraction: (npcKey: string, line: string, topic?: string) => void;
  /** Phase 23 "Memory System" — flags (or clears, when `assessmentId` is null) an assessment as under real pressure, so a LATER conversation can honestly follow up once its status changes ("How did that go?"). Never claims the player said anything — this is set from real save signals only. */
  flagAssessmentStruggle: (npcKey: string, assessmentId: string | null) => void;
  /** Phase 24 "Proactive Mentor Engine" — records that a specific proactive event id has fired (cooldown/once-ever persistence + the daily-limit count). Always appends; never de-dupes here — `ProactiveMentorEngine.ts`'s own cooldown check is what prevents the same id being picked again while still on cooldown. */
  recordProactiveEventFired: (triggerId: string) => void;
  /** Phase 24 "Daily Check-In" — the once-per-day "what are you focusing on today" multiple-choice pick. `subjectId: null` is a real, honest "not sure yet" answer, not a missing one. Overwrites any earlier pick the same day (answering again just updates the pick). */
  setDailyCheckIn: (subjectId: string | null) => void;
  /** Phase 24 "Evening Reflection" — the once-per-day "how did today feel" pick. */
  setEveningCheckIn: (feltManageable: boolean) => void;
  /* Semester completion (Phase 11) — marks the celebration as seen; never locks anything. */
  markCompletionCelebrated: () => void;
  /* Personal goals (Phase 18A) — user-chosen only. */
  updatePersonalGoals: (patch: Partial<PersonalGoals>) => void;
  /**
   * Player identity (Phase 20B). Works whether `playerIdentity` is
   * currently `null` (creates a fresh one, stamping `createdAt`) or
   * already set (patches it, preserving `createdAt`) — see
   * `setPlayerIdentity` in saveDataMutations.ts. The onboarding flow and
   * the in-world Character Creator/Wardrobe both call this same method.
   */
  updatePlayerIdentity: (patch: Partial<PlayerIdentity>) => void;
  /**
   * Semester import (Phase 18A). Backs up the current save (reusing the same
   * IMPORT_BACKUP_KEY whole-save import already uses — one "previous save"
   * mechanism, not two), then applies the pure `applySemesterImport`
   * reducer. Never called with unresolved conflicts (the Review step
   * validates first) — if the reducer somehow throws, the live save is left
   * completely untouched (setSaveData is never called), matching the
   * "rollback = don't commit" design in the architecture doc.
   */
  applySemesterImportPackage: (pkg: AcademicImportPackage, selection: ImportSelection) => { ok: true } | { ok: false; error: string };
  /** True only while the pre-import backup written by the most recent Apply is still available. */
  canUndoLastSemesterImport: () => boolean;
  undoLastSemesterImport: () => boolean;
}

const SaveDataContext = createContext<SaveDataContextValue | null>(null);

export function SaveDataProvider({ children }: { children: ReactNode }) {
  const [saveData, setSaveDataState] = useState<UniGameSaveData>(() => loadSaveData());
  // False when localStorage writes fail (quota/private browsing) — surfaced
  // as a persistent banner so nobody loses progress silently (RC1 Part 6).
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    setStorageOk(persistSaveData(saveData));
  }, [saveData]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(saveData.settings.reducedMotion);
  }, [saveData.settings.reducedMotion]);

  useEffect(() => {
    setSoundEnabled(saveData.settings.soundEnabled);
  }, [saveData.settings.soundEnabled]);

  // Phase 20F Part 10 — sync each mixer category's saved volume into the
  // sound module whenever it changes (including once on mount, so a
  // returning save's saved mix applies before any sound ever plays).
  const { ambience, footsteps, interaction, ui, npc, music } = saveData.settings.soundVolumes;
  useEffect(() => {
    setCategoryVolume("ambience", ambience);
    setCategoryVolume("footsteps", footsteps);
    setCategoryVolume("interaction", interaction);
    setCategoryVolume("ui", ui);
    setCategoryVolume("npc", npc);
    setCategoryVolume("music", music);
  }, [ambience, footsteps, interaction, ui, npc, music]);

  // Keep auto reminders in line with assessment data + reminder settings.
  // syncAutoReminders returns the same array instance when nothing changed,
  // so this converges instead of looping.
  useEffect(() => {
    setSaveDataState((prev) => {
      const synced = syncAutoReminders(prev);
      return synced === prev.reminders ? prev : { ...prev, reminders: synced };
    });
  }, [saveData.semester, saveData.settings.reminderOffsets, saveData.settings.weeklyPlanningReminder]);

  // First-seen milestone log (Phase 11) — appends newly-observed derived
  // milestones (achievements, bond levels, room stages, semester complete)
  // so the Timeline can order them. syncMilestones returns the same array
  // instance when nothing is new, so this converges instead of looping.
  useEffect(() => {
    setSaveDataState((prev) => {
      const milestones = syncMilestones(prev);
      return milestones === prev.milestones ? prev : { ...prev, milestones };
    });
  }, [saveData.tasks, saveData.assessmentProgress, saveData.completedFocusSessions, saveData.mentorBonds]);

  // Phase 22 Part 6 "Goal System" — same first-seen-log convergence
  // contract as syncMilestones above, for today's completed AI Mentor
  // goals ("completed goals become journal memories"). Depends on
  // everything a goal's completion could touch; a new Melbourne day
  // naturally produces new goal ids (date-suffixed), so no explicit
  // "today changed" dependency is needed.
  useEffect(() => {
    setSaveDataState((prev) => {
      const context = buildStudentContext(prev);
      const milestones = syncGoalMilestones(prev, context);
      return milestones === prev.milestones ? prev : { ...prev, milestones };
    });
  }, [saveData.completedFocusSessions, saveData.assessmentProgress, saveData.mentorBonds, saveData.userProgress.streakCount, saveData.userProgress.lastActiveDate]);

  // Furniture unlocks (Phase 20D, Part 6) — permanent once granted, so this
  // only ever adds ids, never removes them, even if the underlying signal
  // (e.g. streak) later regresses. No-op until onboarding creates a
  // playerIdentity. syncFurnitureUnlocks returns the same array instance
  // when nothing newly qualifies, so this converges instead of looping.
  useEffect(() => {
    setSaveDataState((prev) => {
      if (!prev.playerIdentity) return prev;
      const unlockedFurnitureIds = syncFurnitureUnlocks(prev.playerIdentity.roomCustomisation.unlockedFurnitureIds, prev);
      if (unlockedFurnitureIds === prev.playerIdentity.roomCustomisation.unlockedFurnitureIds) return prev;
      return {
        ...prev,
        playerIdentity: {
          ...prev.playerIdentity,
          roomCustomisation: { ...prev.playerIdentity.roomCustomisation, unlockedFurnitureIds },
        },
      };
    });
  }, [
    saveData.playerIdentity,
    saveData.userProgress,
    saveData.tasks,
    saveData.assessmentProgress,
    saveData.completedFocusSessions,
    saveData.semester,
  ]);

  const value = useMemo<SaveDataContextValue>(
    () => ({
      saveData,
      storageOk,
      setSaveData: (updater) =>
        setSaveDataState((prev) => (typeof updater === "function" ? updater(prev) : updater)),
      exportSaveData: () => downloadSaveData(saveData),
      importSaveData: (json: string) => {
        const result = importSaveDataFromJson(json);
        if (result.ok) {
          // Automatic one-step-back safety net before the import replaces
          // the live save (planning/FEATURE_PLAN.md §7 + this phase's brief).
          backupCurrentSave(saveData);
          markImportBackupKind("raw-save-import");
          setSaveDataState(result.data);
        }
        return result;
      },
      resetSaveData: () => {
        setSaveDataState(resetSaveDataInStorage());
      },
      toggleModuleCompletion: (moduleId) =>
        setSaveDataState((prev) => toggleModuleCompletion(prev, moduleId)),
      markModuleReviewed: (moduleId) =>
        setSaveDataState((prev) => markModuleReviewed(prev, moduleId)),
      confirmSubjectCode: (subjectId, code) =>
        setSaveDataState((prev) => confirmSubjectCode(prev, subjectId, code)),
      confirmSemesterStartDate: (dateIso) =>
        setSaveDataState((prev) => confirmSemesterStartDate(prev, dateIso)),
      confirmSemesterEndDate: (dateIso) =>
        setSaveDataState((prev) => confirmSemesterEndDate(prev, dateIso)),
      confirmAssessmentWeight: (assessmentId, weight) =>
        setSaveDataState((prev) => confirmAssessmentWeight(prev, assessmentId, weight)),
      confirmAssessmentDueDate: (assessmentId, dueDate) =>
        setSaveDataState((prev) => confirmAssessmentDueDate(prev, assessmentId, dueDate)),
      confirmAssessmentDueTime: (assessmentId, dueTime) =>
        setSaveDataState((prev) => confirmAssessmentDueTime(prev, assessmentId, dueTime)),
      confirmAssessmentAiPolicy: (assessmentId, aiPolicy) =>
        setSaveDataState((prev) => confirmAssessmentAiPolicy(prev, assessmentId, aiPolicy)),
      confirmAssessmentExtensionEligibility: (assessmentId, extensionEligibility) =>
        setSaveDataState((prev) =>
          confirmAssessmentExtensionEligibility(prev, assessmentId, extensionEligibility)
        ),
      setAssessmentProgressStatus: (assessmentId, status) =>
        setSaveDataState((prev) => setAssessmentProgressStatus(prev, assessmentId, status)),
      setAssessmentProgressPercent: (assessmentId, progressPercent) =>
        setSaveDataState((prev) => setAssessmentProgressPercent(prev, assessmentId, progressPercent)),
      setAssessmentEstimatedHours: (assessmentId, estimatedHours) =>
        setSaveDataState((prev) => setAssessmentEstimatedHours(prev, assessmentId, estimatedHours)),
      setAssessmentHoursCompleted: (assessmentId, hoursCompleted) =>
        setSaveDataState((prev) => setAssessmentHoursCompleted(prev, assessmentId, hoursCompleted)),
      setAssessmentGrade: (assessmentId, grade) =>
        setSaveDataState((prev) => setAssessmentGrade(prev, assessmentId, grade)),
      addChecklistItem: (assessmentId, label) =>
        setSaveDataState((prev) => addChecklistItem(prev, assessmentId, label)),
      toggleChecklistItem: (assessmentId, itemId) =>
        setSaveDataState((prev) => toggleChecklistItem(prev, assessmentId, itemId)),
      removeChecklistItem: (assessmentId, itemId) =>
        setSaveDataState((prev) => removeChecklistItem(prev, assessmentId, itemId)),
      addAssessmentLink: (assessmentId, label, url) =>
        setSaveDataState((prev) => addAssessmentLink(prev, assessmentId, label, url)),
      removeAssessmentLink: (assessmentId, linkId) =>
        setSaveDataState((prev) => removeAssessmentLink(prev, assessmentId, linkId)),
      togglePinnedPriority: (itemId) => setSaveDataState((prev) => togglePinnedPriority(prev, itemId)),

      addUserReminder: ({ kind, title, fireAt, subjectId = null, assessmentId = null }) =>
        setSaveDataState((prev) => ({
          ...prev,
          reminders: [
            ...prev.reminders,
            {
              id: `user-${crypto.randomUUID()}`,
              kind,
              title,
              subjectId,
              assessmentId,
              offsetIso: null,
              fireAt,
              sourceWindow: null,
              status: "pending",
              snoozedUntil: null,
              notifiedAt: null,
              origin: "user",
              createdAt: getMelbourneDateTimeKey(new Date()),
            },
          ],
        })),
      setReminderStatus: (reminderId, status) =>
        setSaveDataState((prev) => ({
          ...prev,
          reminders: prev.reminders.map((reminder) =>
            reminder.id === reminderId ? { ...reminder, status, snoozedUntil: null } : reminder
          ),
        })),
      snoozeReminder: (reminderId, untilKey) =>
        setSaveDataState((prev) => ({
          ...prev,
          reminders: prev.reminders.map((reminder) =>
            reminder.id === reminderId
              ? { ...reminder, status: "pending", snoozedUntil: untilKey, notifiedAt: null }
              : reminder
          ),
        })),
      deleteUserReminder: (reminderId) =>
        setSaveDataState((prev) => ({
          ...prev,
          reminders: prev.reminders.filter(
            (reminder) => !(reminder.id === reminderId && reminder.origin === "user")
          ),
        })),
      markRemindersNotified: (reminderIds) =>
        setSaveDataState((prev) => {
          const ids = new Set(reminderIds);
          const nowKey = getMelbourneDateTimeKey(new Date());
          return {
            ...prev,
            reminders: prev.reminders.map((reminder) =>
              ids.has(reminder.id) ? { ...reminder, notifiedAt: nowKey } : reminder
            ),
          };
        }),

      addStudyLog: (entry) =>
        setSaveDataState((prev) => ({
          ...prev,
          studyLog: [...prev.studyLog, { ...entry, id: `log-${crypto.randomUUID()}` }],
        })),
      updateStudyLog: (logId, patch) =>
        setSaveDataState((prev) => ({
          ...prev,
          studyLog: prev.studyLog.map((entry) => (entry.id === logId ? { ...entry, ...patch } : entry)),
        })),
      deleteStudyLog: (logId) =>
        setSaveDataState((prev) => ({
          ...prev,
          studyLog: prev.studyLog.filter((entry) => entry.id !== logId),
        })),

      updateSettings: (patch) =>
        setSaveDataState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),

      startFocus: (input) => setSaveDataState((prev) => startFocusSession(prev, input)),
      pauseFocus: () => setSaveDataState((prev) => pauseFocusSession(prev)),
      resumeFocus: () => setSaveDataState((prev) => resumeFocusSession(prev)),
      setFocusNotes: (notes) => setSaveDataState((prev) => setFocusSessionNotes(prev, notes)),
      setFocusLinks: (links) => setSaveDataState((prev) => setFocusSessionLinks(prev, links)),
      endFocus: (status) => {
        // Computed against the current snapshot so the XP breakdown can be
        // returned synchronously; endFocusSession is idempotent per session
        // id, so a double-fire can never award twice.
        const outcome = endFocusSessionMutation(saveData, status);
        setSaveDataState(outcome.save);
        return outcome;
      },
      markCompletionCelebrated: () =>
        setSaveDataState((prev) =>
          prev.completionCelebratedAt
            ? prev
            : { ...prev, completionCelebratedAt: new Date().toISOString() }
        ),
      recordRoomVisit: (subjectId) =>
        setSaveDataState((prev) => {
          const today = getMelbourneDateIso();
          const bond = prev.mentorBonds[subjectId] ?? { visitDays: 0, lastVisitDate: null };
          if (bond.lastVisitDate === today) return prev;
          return {
            ...prev,
            mentorBonds: {
              ...prev.mentorBonds,
              [subjectId]: { visitDays: bond.visitDays + 1, lastVisitDate: today },
            },
          };
        }),
      recordBuildingVisit: (sceneId) =>
        setSaveDataState((prev) => {
          const today = getMelbourneDateIso();
          const visit = prev.buildingVisits[sceneId] ?? { visitDays: 0, lastVisitDate: null };
          if (visit.lastVisitDate === today) return prev;
          // Phase 22 Part 5 — a capped, distinct-day log alongside the
          // lifetime counter above, so weekly reflections can honestly
          // count "visits in the last 7 days" (the counter alone only
          // knows a lifetime total + the single most recent date).
          const MAX_BUILDING_VISIT_LOG_ENTRIES = 90;
          const nextLog = [...prev.buildingVisitLog, { sceneId, dateIso: today }].slice(-MAX_BUILDING_VISIT_LOG_ENTRIES);
          return {
            ...prev,
            buildingVisits: {
              ...prev.buildingVisits,
              [sceneId]: { visitDays: visit.visitDays + 1, lastVisitDate: today },
            },
            buildingVisitLog: nextLog,
          };
        }),
      recordNpcInteraction: (npcKey, line, topic) =>
        setSaveDataState((prev) => {
          const today = getMelbourneDateIso();
          const nowIso = new Date().toISOString();
          const existing = prev.npcMemory[npcKey] ?? DEFAULT_NPC_MEMORY;
          // Phase 24 "Mentor Relationships" — every real interaction counts
          // toward conversationCount (recognition-collapsed repeats too —
          // still a genuine visit); an advice-bearing conversation
          // (topic present) also logs it for the "advice followed"
          // heuristic (`ai/MentorRelationshipStats.ts`), capped so this
          // never grows unbounded.
          const adviceLog = topic
            ? [...existing.adviceLog, { category: topic, subjectId: npcKey === "guide" ? null : npcKey, at: nowIso }].slice(-MAX_ADVICE_LOG_ENTRIES)
            : existing.adviceLog;
          return {
            ...prev,
            npcMemory: {
              ...prev.npcMemory,
              [npcKey]: {
                ...existing,
                lastLine: line,
                lastLineDate: today,
                lastInteractionAt: nowIso,
                recentTopics: topic ? withRecordedTopic(existing, topic) : existing.recentTopics,
                conversationCount: existing.conversationCount + 1,
                adviceLog,
              },
            },
          };
        }),
      flagAssessmentStruggle: (npcKey, assessmentId) =>
        setSaveDataState((prev) => {
          const existing = prev.npcMemory[npcKey] ?? DEFAULT_NPC_MEMORY;
          if (existing.flaggedAssessmentId === assessmentId) return prev;
          return {
            ...prev,
            npcMemory: {
              ...prev.npcMemory,
              [npcKey]: { ...existing, flaggedAssessmentId: assessmentId, flaggedAssessmentAt: assessmentId ? new Date().toISOString() : null },
            },
          };
        }),

      recordProactiveEventFired: (triggerId) =>
        setSaveDataState((prev) => {
          const MAX_PROACTIVE_LOG_ENTRIES = 90;
          const nextLog = [...prev.proactiveMentorLog, { triggerId, firedAt: new Date().toISOString() }].slice(-MAX_PROACTIVE_LOG_ENTRIES);
          return { ...prev, proactiveMentorLog: nextLog };
        }),
      setDailyCheckIn: (subjectId) => setSaveDataState((prev) => ({ ...prev, dailyCheckIn: { dateIso: getMelbourneDateIso(), subjectId } })),
      setEveningCheckIn: (feltManageable) => setSaveDataState((prev) => ({ ...prev, eveningCheckIn: { dateIso: getMelbourneDateIso(), feltManageable } })),

      updatePersonalGoals: (patch) => setSaveDataState((prev) => setPersonalGoals(prev, patch)),
      updatePlayerIdentity: (patch) => setSaveDataState((prev) => setPlayerIdentity(prev, patch)),

      applySemesterImportPackage: (pkg, selection) => {
        try {
          backupCurrentSave(saveData);
          markImportBackupKind("semester-import");
          const next = applySemesterImport(saveData, pkg, selection);
          // Round-trip through the same sanitizer every load goes through —
          // cheap insurance that Apply can never produce a save shape the
          // rest of the app can't read back.
          setSaveDataState(sanitizeSaveData(next));
          return { ok: true };
        } catch (error) {
          // Rollback = never call setSaveDataState. The live save is
          // untouched; the backup just written is still available if the
          // caller wants to offer Undo anyway (nothing was changed to undo).
          return { ok: false, error: error instanceof Error ? error.message : "The import couldn't be applied." };
        }
      },
      canUndoLastSemesterImport: () => hasImportBackup() && getImportBackupKind() === "semester-import",
      undoLastSemesterImport: () => {
        if (!hasImportBackup() || getImportBackupKind() !== "semester-import") return false;
        try {
          const raw = window.localStorage.getItem(IMPORT_BACKUP_KEY);
          if (!raw) return false;
          const restored = sanitizeSaveData(JSON.parse(raw));
          setSaveDataState(restored);
          window.localStorage.removeItem(IMPORT_BACKUP_KEY);
          return true;
        } catch {
          return false;
        }
      },
    }),
    [saveData, storageOk]
  );

  return <SaveDataContext.Provider value={value}>{children}</SaveDataContext.Provider>;
}

export function useSaveData(): SaveDataContextValue {
  const context = useContext(SaveDataContext);
  if (!context) {
    throw new Error("useSaveData must be used within a SaveDataProvider");
  }
  return context;
}
