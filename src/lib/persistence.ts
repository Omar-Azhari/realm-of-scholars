/**
 * Versioned local-storage persistence for UniGame, built around
 * `UniGameSaveData` (src/types/domain.ts).
 *
 * Design: `src/data/semesterData.ts` is the pristine, read-only seed
 * (subject/module/assessment content extracted from /docs). A save's
 * `semester` field starts as a structural clone of that seed and is the
 * user's editable working copy (e.g. confirming a NEEDS_CONFIRMATION date
 * writes into this copy, never into the seed file). `tasks`,
 * `assessmentProgress`, `studyLog`, `userProgress`, and `settings` are the
 * overlay of user-generated state that has no equivalent in /docs at all.
 * This split is what lets a future updated seed be re-imported later without
 * silently discarding what the user has already done (planning/FEATURE_PLAN.md
 * section 7).
 *
 * Every read from storage goes through `sanitizeSaveData`, which repairs or
 * falls back to defaults field-by-field rather than rejecting the whole save
 * on a single bad field.
 */

import type {
  ActiveFocusSession,
  AppSettings,
  BuildingVisitRecord,
  BuildingVisitLogEntry,
  CanvasCourseBinding,
  CanvasRemoteItemType,
  CanvasRemoteSnapshot,
  CanvasSyncState,
  CharacterAppearance,
  FocusSessionRecord,
  MentorBond,
  MilestoneEntry,
  NpcMemoryEntry,
  ProactiveLogEntry,
  DailyCheckIn,
  EveningCheckIn,
  MoodleCourseBinding,
  MoodleRemoteItemType,
  MoodleRemoteSnapshot,
  MoodleSyncState,
  MoodRating,
  PersonalGoals,
  PlayerIdentity,
  PlayerPersonality,
  ReminderRecord,
  RoomCustomisation,
  RoomThemeId,
  SoundMixerSettings,
  StudyLogEntry,
  TaskRecord,
  UniGameSaveData,
  UserAssessmentProgress,
  UserProgress,
  YearLevel,
} from "../types/domain";
import { DEFAULT_REMINDER_OFFSETS, unconfirmed } from "../types/domain";
import { semesterData, subjects } from "../data/semesterData";
import {
  findBodyPreset,
  findEyeOption,
  findEyebrowOption,
  findFacialHairOption,
  findHairColor,
  findOption,
  findSkinTone,
} from "../data/appearanceCatalogue";
import { findPersonalityTrait } from "../data/personalityTraits";
import { createDefaultPlayerIdentity } from "../data/playerIdentityDefaults";
import { findFurnitureItem, STARTER_FURNITURE_IDS } from "../data/furnitureCatalogue";
import { ROOM_SLOTS } from "../game3d/rooms/roomSlots";
import { MAX_RECENT_TOPICS } from "./npcMemory";

export const SAVE_DATA_VERSION = 2 as const;
/** Historical key name — kept stable across versions so upgrades read the same slot. */
export const STORAGE_KEY = "unigame:saveData:v1";
/** Raw copy of a version-1 save, written once immediately before migration. */
export const MIGRATION_BACKUP_KEY = "unigame:saveData:backup-v1";
/** Snapshot of the current save, written immediately before an import replaces it. */
export const IMPORT_BACKUP_KEY = "unigame:saveData:backup-preimport";

// ---------------------------------------------------------------------------
// Default / seed construction
// ---------------------------------------------------------------------------

function cloneSemesterSeed(): UniGameSaveData["semester"] {
  // semesterData is plain JSON-serialisable data (no functions/classes), so a
  // JSON round-trip is a safe, dependency-free deep clone.
  return JSON.parse(JSON.stringify(semesterData)) as UniGameSaveData["semester"];
}

function createDefaultUserProgress(): UserProgress {
  const perSubjectCompletionPercent: Record<string, number> = {};
  for (const subject of subjects) {
    perSubjectCompletionPercent[subject.id] = 0;
  }
  return {
    xp: 0,
    level: 1,
    streakCount: 0,
    longestStreak: 0,
    lastActiveDate: null,
    perSubjectCompletionPercent,
    overallCompletionPercent: 0,
  };
}

/**
 * One "milestone" task per module, linked via `linkedModuleId`. This is the
 * mechanism module completion (Phase 3) is built on — TaskRecord already had
 * `linkedModuleId`/`completed` from Phase 2, so this reuses that shape
 * instead of introducing a separate module-progress type.
 */
function createDefaultModuleTasks(): TaskRecord[] {
  return subjects.flatMap((subject) =>
    subject.modules.map(
      (module): TaskRecord => ({
        id: `module-task-${module.id}`,
        linkedAssessmentId: null,
        linkedModuleId: module.id,
        title: `Complete: ${module.title}`,
        type: "milestone",
        dueDate: null,
        estimatedMinutes: null,
        completed: false,
        completedAt: null,
        reviewedAt: null,
        xpReward: 10,
        // Real semester week numbers are NEEDS_CONFIRMATION (see
        // planning/SEMESTER_DATA.md) — module order is not treated as a
        // calendar week here, so this stays null rather than guessing.
        weekNumber: null,
      })
    )
  );
}

function createDefaultAssessmentProgress(): UserAssessmentProgress[] {
  return subjects.flatMap((subject) =>
    subject.assessments.map(
      (assessment): UserAssessmentProgress => ({
        assessmentId: assessment.id,
        progressPercent: 0,
        status: "not_started",
        estimatedHours: null,
        hoursCompleted: 0,
        checklist: [],
        grade: null,
        links: [],
        statusChangedAt: null,
      })
    )
  );
}

function createDefaultSoundVolumes(): SoundMixerSettings {
  return { ambience: 1, footsteps: 1, interaction: 1, ui: 1, npc: 1, music: 1 };
}

function createDefaultSettings(): AppSettings {
  return {
    reducedMotion: false,
    soundEnabled: false,
    soundVolumes: createDefaultSoundVolumes(),
    browserNotificationsEnabled: false,
    notificationPermission: "default",
    reminderOffsets: DEFAULT_REMINDER_OFFSETS.map((offset) => ({
      isoDuration: offset.isoDuration,
      enabled: true,
    })),
    weeklyPlanningReminder: true,
    quietHours: { enabled: false, startHour: 22, endHour: 7 },
    dataVersion: SAVE_DATA_VERSION,
    theme: "system",
    pinnedPriorityIds: [],
    onboardingHintDismissed: false,
    semesterSetupOffered: false,
    worldRenderer: "legacy-2d",
    graphicsQuality: "auto",
    campus3DGuidanceDismissed: false,
  };
}

function createDefaultPersonalGoals(): PersonalGoals {
  return {
    targetGrade: null,
    weeklyStudyHours: null,
    preferredStudyDays: [],
    desiredFocusSprintsPerWeek: null,
  };
}

export function createDefaultSaveData(): UniGameSaveData {
  return {
    version: SAVE_DATA_VERSION,
    semester: cloneSemesterSeed(),
    tasks: createDefaultModuleTasks(),
    assessmentProgress: createDefaultAssessmentProgress(),
    reminders: [],
    studyLog: [],
    activeFocusSession: null,
    completedFocusSessions: [],
    mentorBonds: {},
    npcMemory: {},
    buildingVisits: {},
    buildingVisitLog: [],
    milestones: [],
    completionCelebratedAt: null,
    userProgress: createDefaultUserProgress(),
    settings: createDefaultSettings(),
    personalGoals: createDefaultPersonalGoals(),
    canvasSync: null,
    moodleSync: null,
    // `null`, NOT `createDefaultPlayerIdentity()` — a genuinely fresh save
    // has never been through onboarding, so this is exactly the signal
    // that shows the Phase 20B onboarding flow. Migrating an OLD save
    // (see `coercePlayerIdentity` below) backfills a real, non-null
    // identity instead, which is what makes a returning user skip it.
    playerIdentity: null,
    proactiveMentorLog: [],
    dailyCheckIn: null,
    eveningCheckIn: null,
  };
}

// ---------------------------------------------------------------------------
// Safe parsing — field-level fallback, never an all-or-nothing reject
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Clamps a stored volume value into the valid 0–1 range (Phase 20F Part 10) — a corrupted or hand-edited save shouldn't be able to push a category volume outside what the mixer accepts. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function coerceArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

/**
 * Phase 19 (additive): `ModuleRecord` gained `readings`/`schedule`/
 * `outcomes`/`prerequisiteModuleIds`/`manualOverrides`, and
 * `AssessmentRecord` gained `examInfo` — neither exists on any save written
 * before this phase. `coerceSemester` below otherwise trusts a
 * structurally-plausible semester object wholesale (no per-field
 * validation), so a save missing these fields would leave them `undefined`
 * at runtime despite the type saying they're required arrays/values —
 * backfilled here, once, rather than requiring every reader of
 * ModuleRecord/AssessmentRecord to defensively `?? []` on every access.
 */
function backfillPhase19AcademicFields(
  semester: UniGameSaveData["semester"]
): UniGameSaveData["semester"] {
  return {
    ...semester,
    subjects: semester.subjects.map((subject) => ({
      ...subject,
      modules: subject.modules.map((module) => {
        const raw = module as Partial<typeof module>;
        return {
          ...module,
          readings: raw.readings ?? [],
          schedule: raw.schedule ?? [],
          outcomes: raw.outcomes ?? [],
          prerequisiteModuleIds: raw.prerequisiteModuleIds ?? [],
          manualOverrides: raw.manualOverrides ?? [],
        };
      }),
      assessments: subject.assessments.map((assessment) => {
        const raw = assessment as Partial<typeof assessment>;
        return {
          ...assessment,
          examInfo: raw.examInfo ?? unconfirmed<string>(),
        };
      }),
    })),
  };
}

function coerceSemester(
  value: unknown,
  fallback: UniGameSaveData["semester"]
): UniGameSaveData["semester"] {
  if (isRecord(value) && Array.isArray(value.subjects)) {
    return backfillPhase19AcademicFields(value as unknown as UniGameSaveData["semester"]);
  }
  return fallback;
}

function coerceUserProgress(value: unknown, fallback: UserProgress): UserProgress {
  if (!isRecord(value)) return fallback;
  const streakCount = typeof value.streakCount === "number" ? value.streakCount : fallback.streakCount;
  return {
    xp: typeof value.xp === "number" ? value.xp : fallback.xp,
    level: typeof value.level === "number" ? value.level : fallback.level,
    streakCount,
    // Older saves never tracked the longest streak — the current streak is
    // the best honest lower bound, never an invented value.
    longestStreak:
      typeof value.longestStreak === "number" ? Math.max(value.longestStreak, streakCount) : streakCount,
    lastActiveDate: typeof value.lastActiveDate === "string" ? value.lastActiveDate : null,
    perSubjectCompletionPercent: isRecord(value.perSubjectCompletionPercent)
      ? (value.perSubjectCompletionPercent as Record<string, number>)
      : fallback.perSubjectCompletionPercent,
    overallCompletionPercent:
      typeof value.overallCompletionPercent === "number"
        ? value.overallCompletionPercent
        : fallback.overallCompletionPercent,
  };
}

function coerceSettings(value: unknown, fallback: AppSettings): AppSettings {
  if (!isRecord(value)) return fallback;
  const theme =
    value.theme === "light" || value.theme === "dark" || value.theme === "system"
      ? value.theme
      : fallback.theme;
  const notificationPermission =
    value.notificationPermission === "granted" ||
    value.notificationPermission === "denied" ||
    value.notificationPermission === "default"
      ? value.notificationPermission
      : fallback.notificationPermission;
  const reminderOffsets = Array.isArray(value.reminderOffsets)
    ? fallback.reminderOffsets.map((def) => {
        const stored = (value.reminderOffsets as Array<Record<string, unknown>>).find(
          (entry) => isRecord(entry) && entry.isoDuration === def.isoDuration
        );
        return {
          isoDuration: def.isoDuration,
          enabled: stored && typeof stored.enabled === "boolean" ? stored.enabled : def.enabled,
        };
      })
    : fallback.reminderOffsets;

  const quietHours =
    isRecord(value.quietHours) &&
    typeof value.quietHours.startHour === "number" &&
    typeof value.quietHours.endHour === "number"
      ? {
          enabled: value.quietHours.enabled === true,
          startHour: Math.min(23, Math.max(0, Math.round(value.quietHours.startHour))),
          endHour: Math.min(23, Math.max(0, Math.round(value.quietHours.endHour))),
        }
      : fallback.quietHours;

  const soundVolumes: SoundMixerSettings = isRecord(value.soundVolumes)
    ? {
        ambience: typeof value.soundVolumes.ambience === "number" ? clamp01(value.soundVolumes.ambience) : fallback.soundVolumes.ambience,
        footsteps: typeof value.soundVolumes.footsteps === "number" ? clamp01(value.soundVolumes.footsteps) : fallback.soundVolumes.footsteps,
        interaction: typeof value.soundVolumes.interaction === "number" ? clamp01(value.soundVolumes.interaction) : fallback.soundVolumes.interaction,
        ui: typeof value.soundVolumes.ui === "number" ? clamp01(value.soundVolumes.ui) : fallback.soundVolumes.ui,
        npc: typeof value.soundVolumes.npc === "number" ? clamp01(value.soundVolumes.npc) : fallback.soundVolumes.npc,
        music: typeof value.soundVolumes.music === "number" ? clamp01(value.soundVolumes.music) : fallback.soundVolumes.music,
      }
    : fallback.soundVolumes;

  return {
    reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : fallback.reducedMotion,
    soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : fallback.soundEnabled,
    soundVolumes,
    browserNotificationsEnabled:
      typeof value.browserNotificationsEnabled === "boolean"
        ? value.browserNotificationsEnabled
        : fallback.browserNotificationsEnabled,
    notificationPermission,
    reminderOffsets,
    weeklyPlanningReminder:
      typeof value.weeklyPlanningReminder === "boolean"
        ? value.weeklyPlanningReminder
        : fallback.weeklyPlanningReminder,
    quietHours,
    dataVersion: SAVE_DATA_VERSION,
    theme,
    pinnedPriorityIds: Array.isArray(value.pinnedPriorityIds)
      ? (value.pinnedPriorityIds as string[])
      : fallback.pinnedPriorityIds,
    onboardingHintDismissed:
      typeof value.onboardingHintDismissed === "boolean"
        ? value.onboardingHintDismissed
        : fallback.onboardingHintDismissed,
    semesterSetupOffered:
      typeof value.semesterSetupOffered === "boolean" ? value.semesterSetupOffered : fallback.semesterSetupOffered,
    worldRenderer:
      value.worldRenderer === "legacy-2d" || value.worldRenderer === "experimental-3d" || value.worldRenderer === "prestige-v2"
        ? value.worldRenderer
        : fallback.worldRenderer,
    graphicsQuality:
      value.graphicsQuality === "auto" ||
      value.graphicsQuality === "low" ||
      value.graphicsQuality === "medium" ||
      value.graphicsQuality === "high"
        ? value.graphicsQuality
        : fallback.graphicsQuality,
    campus3DGuidanceDismissed:
      typeof value.campus3DGuidanceDismissed === "boolean" ? value.campus3DGuidanceDismissed : fallback.campus3DGuidanceDismissed,
  };
}

// ---------------------------------------------------------------------------
// v2 collections: reminders + study logs (including v1 study-log migration)
// ---------------------------------------------------------------------------

const REMINDER_KINDS = new Set([
  "assessment-deadline",
  "assessment-start",
  "milestone",
  "weekly-planning",
  "study-session",
  "overdue-task",
  "needs-confirmation",
]);

const FIRE_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Per-record repair; records without a usable id/kind/fireAt are dropped rather than guessed at. */
function coerceReminders(value: unknown): ReminderRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: ReminderRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== "string" || entry.id.length === 0 || seen.has(entry.id)) continue;
    if (typeof entry.kind !== "string" || !REMINDER_KINDS.has(entry.kind)) continue;
    if (typeof entry.fireAt !== "string" || !FIRE_AT_PATTERN.test(entry.fireAt)) continue;
    seen.add(entry.id);
    result.push({
      id: entry.id,
      kind: entry.kind as ReminderRecord["kind"],
      title: typeof entry.title === "string" ? entry.title : "Reminder",
      subjectId: typeof entry.subjectId === "string" ? entry.subjectId : null,
      assessmentId: typeof entry.assessmentId === "string" ? entry.assessmentId : null,
      offsetIso: typeof entry.offsetIso === "string" ? entry.offsetIso : null,
      fireAt: entry.fireAt,
      sourceWindow: typeof entry.sourceWindow === "string" ? entry.sourceWindow : null,
      status:
        entry.status === "dismissed" || entry.status === "completed" ? entry.status : "pending",
      snoozedUntil:
        typeof entry.snoozedUntil === "string" && FIRE_AT_PATTERN.test(entry.snoozedUntil)
          ? entry.snoozedUntil
          : null,
      notifiedAt: typeof entry.notifiedAt === "string" ? entry.notifiedAt : null,
      origin: entry.origin === "user" ? "user" : "auto",
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Phase 7 collections: focus sessions + mentor bonds (additive to save v2)
// ---------------------------------------------------------------------------

const ISO_TS_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function coerceActiveFocusSession(value: unknown): ActiveFocusSession | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.subjectId !== "string") return null;
  if (typeof value.startedAt !== "string" || !ISO_TS_PATTERN.test(value.startedAt)) return null;
  return {
    id: value.id,
    subjectId: value.subjectId,
    assessmentId: typeof value.assessmentId === "string" ? value.assessmentId : null,
    moduleId: typeof value.moduleId === "string" ? value.moduleId : null,
    startedAt: value.startedAt,
    focusMinutes: typeof value.focusMinutes === "number" && value.focusMinutes > 0 ? value.focusMinutes : 25,
    breakMinutes: typeof value.breakMinutes === "number" && value.breakMinutes >= 0 ? value.breakMinutes : 5,
    accumulatedMs: typeof value.accumulatedMs === "number" && value.accumulatedMs >= 0 ? value.accumulatedMs : 0,
    segmentStartedAt:
      typeof value.segmentStartedAt === "string" && ISO_TS_PATTERN.test(value.segmentStartedAt)
        ? value.segmentStartedAt
        : null,
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

function coerceFocusSessions(value: unknown): FocusSessionRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: FocusSessionRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== "string" || seen.has(entry.id)) continue;
    if (typeof entry.subjectId !== "string") continue;
    if (typeof entry.startedAt !== "string" || typeof entry.endedAt !== "string") continue;
    seen.add(entry.id);
    result.push({
      id: entry.id,
      subjectId: entry.subjectId,
      assessmentId: typeof entry.assessmentId === "string" ? entry.assessmentId : null,
      moduleId: typeof entry.moduleId === "string" ? entry.moduleId : null,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      focusMinutesPlanned: typeof entry.focusMinutesPlanned === "number" ? entry.focusMinutesPlanned : 0,
      breakMinutesPlanned: typeof entry.breakMinutesPlanned === "number" ? entry.breakMinutesPlanned : 0,
      elapsedFocusSeconds:
        typeof entry.elapsedFocusSeconds === "number" && entry.elapsedFocusSeconds >= 0
          ? entry.elapsedFocusSeconds
          : 0,
      status:
        entry.status === "completed" || entry.status === "finished-early" ? entry.status : "cancelled",
      xpAwarded: typeof entry.xpAwarded === "number" && entry.xpAwarded >= 0 ? entry.xpAwarded : 0,
      journalEntryId: typeof entry.journalEntryId === "string" ? entry.journalEntryId : null,
    });
  }
  return result;
}

function coerceMentorBonds(value: unknown): Record<string, MentorBond> {
  if (!isRecord(value)) return {};
  const result: Record<string, MentorBond> = {};
  for (const [subjectId, bond] of Object.entries(value)) {
    if (!isRecord(bond)) continue;
    result[subjectId] = {
      visitDays: typeof bond.visitDays === "number" && bond.visitDays >= 0 ? Math.floor(bond.visitDays) : 0,
      lastVisitDate: typeof bond.lastVisitDate === "string" ? bond.lastVisitDate : null,
    };
  }
  return result;
}

const MAX_ADVICE_LOG_ENTRIES = 20;

function coerceAdviceLog(value: unknown): NpcMemoryEntry["adviceLog"] {
  if (!Array.isArray(value)) return [];
  const result: NpcMemoryEntry["adviceLog"] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.category !== "string" || typeof entry.at !== "string") continue;
    if (entry.subjectId !== null && typeof entry.subjectId !== "string") continue;
    result.push({ category: entry.category, subjectId: entry.subjectId, at: entry.at });
  }
  return result.slice(-MAX_ADVICE_LOG_ENTRIES);
}

/** Same field-by-field, never-throw coercion discipline as coerceMentorBonds — a corrupted/hand-edited entry is dropped, not fatal to the whole save. */
function coerceNpcMemory(value: unknown): Record<string, NpcMemoryEntry> {
  if (!isRecord(value)) return {};
  const result: Record<string, NpcMemoryEntry> = {};
  for (const [npcKey, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    result[npcKey] = {
      lastLine: typeof entry.lastLine === "string" ? entry.lastLine : null,
      lastLineDate: typeof entry.lastLineDate === "string" ? entry.lastLineDate : null,
      lastInteractionAt: typeof entry.lastInteractionAt === "string" ? entry.lastInteractionAt : null,
      recentTopics: Array.isArray(entry.recentTopics) ? entry.recentTopics.filter((t): t is string => typeof t === "string").slice(-MAX_RECENT_TOPICS) : [],
      flaggedAssessmentId: typeof entry.flaggedAssessmentId === "string" ? entry.flaggedAssessmentId : null,
      flaggedAssessmentAt: typeof entry.flaggedAssessmentAt === "string" ? entry.flaggedAssessmentAt : null,
      conversationCount: typeof entry.conversationCount === "number" && entry.conversationCount >= 0 ? Math.floor(entry.conversationCount) : 0,
      adviceLog: coerceAdviceLog(entry.adviceLog),
    };
  }
  return result;
}

function coerceBuildingVisits(value: unknown): Record<string, BuildingVisitRecord> {
  if (!isRecord(value)) return {};
  const result: Record<string, BuildingVisitRecord> = {};
  for (const [sceneId, visit] of Object.entries(value)) {
    if (!isRecord(visit)) continue;
    result[sceneId] = {
      visitDays: typeof visit.visitDays === "number" && visit.visitDays >= 0 ? Math.floor(visit.visitDays) : 0,
      lastVisitDate: typeof visit.lastVisitDate === "string" ? visit.lastVisitDate : null,
    };
  }
  return result;
}

const MAX_BUILDING_VISIT_LOG_ENTRIES = 90;

function coerceBuildingVisitLog(value: unknown): BuildingVisitLogEntry[] {
  if (!Array.isArray(value)) return [];
  const result: BuildingVisitLogEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.sceneId !== "string" || typeof entry.dateIso !== "string") continue;
    result.push({ sceneId: entry.sceneId, dateIso: entry.dateIso });
  }
  return result.slice(-MAX_BUILDING_VISIT_LOG_ENTRIES);
}

function coerceMood(value: unknown): MoodRating | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null;
}

/**
 * Accepts both the v2 StudyLogEntry shape and the narrower v1 shape
 * ({date, difficult}), migrating the latter without losing text the user
 * wrote. Entries without an id or subject are dropped.
 */
function coerceStudyLog(value: unknown): StudyLogEntry[] {
  if (!Array.isArray(value)) return [];
  const result: StudyLogEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== "string" || typeof entry.subjectId !== "string") continue;
    const legacyDate = typeof entry.date === "string" ? entry.date : null;
    const dateTime =
      typeof entry.dateTime === "string" && FIRE_AT_PATTERN.test(entry.dateTime)
        ? entry.dateTime
        : legacyDate
          ? `${legacyDate.slice(0, 10)}T00:00`
          : null;
    if (!dateTime) continue;
    result.push({
      id: entry.id,
      subjectId: entry.subjectId,
      assessmentId: typeof entry.assessmentId === "string" ? entry.assessmentId : null,
      moduleId: typeof entry.moduleId === "string" ? entry.moduleId : null,
      dateTime,
      durationMinutes: typeof entry.durationMinutes === "number" ? entry.durationMinutes : null,
      completed: typeof entry.completed === "string" ? entry.completed : "",
      difficulties:
        typeof entry.difficulties === "string"
          ? entry.difficulties
          : typeof entry.difficult === "string"
            ? entry.difficult
            : "",
      nextPlan: typeof entry.nextPlan === "string" ? entry.nextPlan : "",
      moodBefore: coerceMood(entry.moodBefore),
      moodAfter: coerceMood(entry.moodAfter),
      notes: typeof entry.notes === "string" ? entry.notes : "",
      focusSessionId: typeof entry.focusSessionId === "string" ? entry.focusSessionId : null,
    });
  }
  return result;
}

/**
 * Per-item repair for assessment progress records — fills in fields added
 * after a save was first written (e.g. `links`, introduced alongside the
 * Assessment Detail screen) so an older save doesn't crash on the new field
 * being `undefined`, without discarding the rest of that record's progress.
 */
function coerceAssessmentProgressList(
  value: unknown,
  fallback: UserAssessmentProgress[]
): UserAssessmentProgress[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((entry): UserAssessmentProgress => {
    const record = isRecord(entry) ? entry : {};
    return {
      assessmentId: typeof record.assessmentId === "string" ? record.assessmentId : "",
      progressPercent: typeof record.progressPercent === "number" ? record.progressPercent : 0,
      status:
        record.status === "in_progress" || record.status === "submitted" || record.status === "graded"
          ? record.status
          : "not_started",
      estimatedHours: typeof record.estimatedHours === "number" ? record.estimatedHours : null,
      hoursCompleted: typeof record.hoursCompleted === "number" ? record.hoursCompleted : 0,
      checklist: Array.isArray(record.checklist) ? (record.checklist as UserAssessmentProgress["checklist"]) : [],
      grade: typeof record.grade === "number" ? record.grade : null,
      links: Array.isArray(record.links) ? (record.links as UserAssessmentProgress["links"]) : [],
      statusChangedAt: typeof record.statusChangedAt === "string" ? record.statusChangedAt : null,
    };
  });
}

function coercePersonalGoals(value: unknown, fallback: PersonalGoals): PersonalGoals {
  if (!isRecord(value)) return fallback;
  return {
    targetGrade: typeof value.targetGrade === "number" ? value.targetGrade : null,
    weeklyStudyHours: typeof value.weeklyStudyHours === "number" ? value.weeklyStudyHours : null,
    preferredStudyDays: Array.isArray(value.preferredStudyDays)
      ? value.preferredStudyDays.filter((d): d is string => typeof d === "string")
      : [],
    desiredFocusSprintsPerWeek:
      typeof value.desiredFocusSprintsPerWeek === "number" ? value.desiredFocusSprintsPerWeek : null,
  };
}

// ---------------------------------------------------------------------------
// Player identity (Phase 20B, additive) — field-level repair against the
// appearance/personality catalogues, same "never reject the whole object"
// philosophy as every coercer above. A field with an id that doesn't exist
// in the current catalogue (e.g. a hand-edited save, or a future catalogue
// entry removed) falls back to that one field's default rather than
// discarding the rest of the identity.
// ---------------------------------------------------------------------------

const YEAR_LEVELS: ReadonlySet<YearLevel> = new Set([
  "first-year",
  "second-year",
  "third-year",
  "fourth-year",
  "postgraduate",
  "other",
]);

const ROOM_THEME_IDS: ReadonlySet<RoomThemeId> = new Set([
  "modern-campus",
  "cozy-library",
  "minimal-study",
  "creative-studio",
  "digital-lab",
  "classic-academy",
]);

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function coerceAppearance(value: unknown, fallback: CharacterAppearance): CharacterAppearance {
  if (!isRecord(value)) return fallback;
  const str = (v: unknown, valid: (id: string) => boolean, fallbackId: string): string =>
    typeof v === "string" && valid(v) ? v : fallbackId;
  const nullableStr = (v: unknown, valid: (id: string) => boolean, fallbackId: string | null): string | null => {
    if (v === null) return null;
    return typeof v === "string" && valid(v) ? v : fallbackId;
  };
  return {
    bodyId: str(value.bodyId, (id) => Boolean(findBodyPreset(id)), fallback.bodyId),
    skinToneId: str(value.skinToneId, (id) => Boolean(findSkinTone(id)), fallback.skinToneId),
    hairId: str(value.hairId, (id) => Boolean(findOption("hair", id)), fallback.hairId),
    hairColorId: str(value.hairColorId, (id) => Boolean(findHairColor(id)), fallback.hairColorId),
    eyesId: str(value.eyesId, (id) => Boolean(findEyeOption(id)), fallback.eyesId),
    eyebrowsId: str(value.eyebrowsId, (id) => Boolean(findEyebrowOption(id)), fallback.eyebrowsId),
    facialHairId: nullableStr(value.facialHairId, (id) => Boolean(findFacialHairOption(id)), fallback.facialHairId),
    topId: str(value.topId, (id) => Boolean(findOption("top", id)), fallback.topId),
    jacketId: nullableStr(value.jacketId, (id) => Boolean(findOption("jacket", id)), fallback.jacketId),
    bottomId: str(value.bottomId, (id) => Boolean(findOption("bottom", id)), fallback.bottomId),
    shoesId: str(value.shoesId, (id) => Boolean(findOption("shoes", id)), fallback.shoesId),
    accessoryIds: Array.isArray(value.accessoryIds)
      ? value.accessoryIds.filter((id): id is string => typeof id === "string" && Boolean(findOption("accessory", id)))
      : fallback.accessoryIds,
  };
}

function coercePersonality(value: unknown, fallback: PlayerPersonality): PlayerPersonality {
  if (!isRecord(value)) return fallback;
  const primaryTraitId =
    typeof value.primaryTraitId === "string" && findPersonalityTrait(value.primaryTraitId)
      ? value.primaryTraitId
      : fallback.primaryTraitId;
  const secondaryTraitIds = Array.isArray(value.secondaryTraitIds)
    ? Array.from(
        new Set(
          value.secondaryTraitIds.filter(
            (id): id is string => typeof id === "string" && id !== primaryTraitId && Boolean(findPersonalityTrait(id))
          )
        )
      ).slice(0, 2)
    : fallback.secondaryTraitIds;
  return { primaryTraitId, secondaryTraitIds };
}

/**
 * Phase 20D — field-level repair for room customisation, same philosophy
 * as every coercer in this file: an unrecognised furniture id or slot id
 * is dropped rather than rejecting the whole object. Starter furniture
 * ids are always re-added even if somehow missing from a hand-edited
 * save, since they're meant to be permanently available to everyone.
 */
function coerceRoomCustomisation(value: unknown, fallback: RoomCustomisation): RoomCustomisation {
  if (!isRecord(value)) return fallback;

  const unlockedFromSave = Array.isArray(value.unlockedFurnitureIds)
    ? value.unlockedFurnitureIds.filter((id): id is string => typeof id === "string" && Boolean(findFurnitureItem(id)))
    : [];
  const unlockedFurnitureIds = Array.from(new Set([...STARTER_FURNITURE_IDS, ...unlockedFromSave]));

  const placedFurniture: Record<string, string | null> = {};
  const rotations: Record<string, number> = {};
  const rawPlaced = isRecord(value.placedFurniture) ? value.placedFurniture : {};
  const rawRotations = isRecord(value.rotations) ? value.rotations : {};
  const VALID_ROTATIONS = new Set([0, 90, 180, 270]);
  for (const slot of ROOM_SLOTS) {
    const rawItemId = rawPlaced[slot.id];
    if (rawItemId === null) {
      placedFurniture[slot.id] = null;
    } else if (typeof rawItemId === "string" && findFurnitureItem(rawItemId)?.category === slot.category) {
      placedFurniture[slot.id] = rawItemId;
    } else {
      placedFurniture[slot.id] = fallback.placedFurniture[slot.id] ?? null;
    }

    const rawRotation = rawRotations[slot.id];
    rotations[slot.id] = typeof rawRotation === "number" && VALID_ROTATIONS.has(rawRotation) ? rawRotation : 0;
  }

  return { unlockedFurnitureIds, placedFurniture, rotations };
}

/**
 * `wasKeyPresent` distinguishes "this save predates Phase 20B entirely"
 * (backfill a full default identity, so this returning player skips
 * onboarding) from "this save has already been through 20B and is
 * deliberately still `null`" (mid-onboarding or never started — keep
 * showing the flow). Every other coercer in this file only needs the
 * VALUE; this is the one place needing to know whether the key existed at
 * all, which is why it takes `raw` directly rather than `raw.playerIdentity`.
 */
function coercePlayerIdentity(raw: Record<string, unknown>): PlayerIdentity | null {
  const wasKeyPresent = "playerIdentity" in raw;
  if (!wasKeyPresent) return createDefaultPlayerIdentity();

  const value = raw.playerIdentity;
  if (value === null) return null;
  if (!isRecord(value)) return createDefaultPlayerIdentity();

  const fallback = createDefaultPlayerIdentity();
  return {
    preferredName: typeof value.preferredName === "string" && value.preferredName.trim() ? value.preferredName : fallback.preferredName,
    displayName: typeof value.displayName === "string" ? value.displayName : null,
    university: typeof value.university === "string" ? value.university : null,
    degree: typeof value.degree === "string" ? value.degree : null,
    yearLevel: typeof value.yearLevel === "string" && YEAR_LEVELS.has(value.yearLevel as YearLevel) ? (value.yearLevel as YearLevel) : null,
    appearance: coerceAppearance(value.appearance, fallback.appearance),
    personality: coercePersonality(value.personality, fallback.personality),
    preferredRoomTheme:
      typeof value.preferredRoomTheme === "string" && ROOM_THEME_IDS.has(value.preferredRoomTheme as RoomThemeId)
        ? (value.preferredRoomTheme as RoomThemeId)
        : fallback.preferredRoomTheme,
    favouriteColour: typeof value.favouriteColour === "string" && HEX_COLOR_PATTERN.test(value.favouriteColour) ? value.favouriteColour : fallback.favouriteColour,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : fallback.createdAt,
    lastModifiedAt: typeof value.lastModifiedAt === "string" ? value.lastModifiedAt : fallback.lastModifiedAt,
    schemaVersion: typeof value.schemaVersion === "number" ? value.schemaVersion : fallback.schemaVersion,
    roomCustomisation: coerceRoomCustomisation(value.roomCustomisation, fallback.roomCustomisation),
  };
}

const CANVAS_REMOTE_ITEM_TYPES = new Set(["course", "assignment", "module", "calendar-event", "announcement"]);
const CANVAS_DELETION_STATES = new Set(["present", "missing-once", "confirmed-deleted"]);

function coerceCanvasCourseBinding(entry: unknown): CanvasCourseBinding | null {
  if (!isRecord(entry)) return null;
  if (typeof entry.connectionId !== "string" || typeof entry.institutionId !== "string") return null;
  if (typeof entry.canvasCourseId !== "number" || typeof entry.localSubjectId !== "string") return null;
  return {
    connectionId: entry.connectionId,
    institutionId: entry.institutionId,
    canvasCourseId: entry.canvasCourseId,
    localSubjectId: entry.localSubjectId,
    boundAt: typeof entry.boundAt === "string" ? entry.boundAt : new Date().toISOString(),
  };
}

function coerceCanvasRemoteSnapshot(entry: unknown): CanvasRemoteSnapshot | null {
  if (!isRecord(entry)) return null;
  if (typeof entry.remoteItemId !== "number" || typeof entry.remoteCourseId !== "number") return null;
  if (typeof entry.remoteItemType !== "string" || !CANVAS_REMOTE_ITEM_TYPES.has(entry.remoteItemType)) return null;
  if (typeof entry.contentFingerprint !== "string") return null;
  const deletionState = typeof entry.remoteDeletionState === "string" && CANVAS_DELETION_STATES.has(entry.remoteDeletionState) ? (entry.remoteDeletionState as CanvasRemoteSnapshot["remoteDeletionState"]) : "present";
  return {
    institutionId: typeof entry.institutionId === "string" ? entry.institutionId : "",
    remoteCourseId: entry.remoteCourseId,
    remoteItemId: entry.remoteItemId,
    remoteItemType: entry.remoteItemType as CanvasRemoteItemType,
    remoteUpdatedAt: typeof entry.remoteUpdatedAt === "string" ? entry.remoteUpdatedAt : null,
    contentFingerprint: entry.contentFingerprint,
    lastImportedAt: typeof entry.lastImportedAt === "string" ? entry.lastImportedAt : new Date().toISOString(),
    lastSeenAt: typeof entry.lastSeenAt === "string" ? entry.lastSeenAt : new Date().toISOString(),
    localTargetId: typeof entry.localTargetId === "string" ? entry.localTargetId : null,
    userOverriddenFields: Array.isArray(entry.userOverriddenFields) ? entry.userOverriddenFields.filter((f): f is string => typeof f === "string") : [],
    remoteDeletionState: deletionState,
  };
}

function coerceCanvasSyncState(value: unknown): CanvasSyncState | null {
  if (!isRecord(value)) return null;
  const courseBindings = Array.isArray(value.courseBindings) ? value.courseBindings.map(coerceCanvasCourseBinding).filter((b): b is CanvasCourseBinding => b !== null) : [];
  const remoteSnapshots = Array.isArray(value.remoteSnapshots) ? value.remoteSnapshots.map(coerceCanvasRemoteSnapshot).filter((s): s is CanvasRemoteSnapshot => s !== null) : [];
  if (courseBindings.length === 0 && remoteSnapshots.length === 0) return null;
  return { courseBindings, remoteSnapshots };
}

const MOODLE_REMOTE_ITEM_TYPES = new Set(["course", "assignment", "quiz", "section", "calendar-event", "announcement"]);
const MOODLE_DELETION_STATES = new Set(["present", "missing-once", "confirmed-deleted"]);

function coerceMoodleCourseBinding(entry: unknown): MoodleCourseBinding | null {
  if (!isRecord(entry)) return null;
  if (typeof entry.connectionId !== "string" || typeof entry.institutionId !== "string") return null;
  if (typeof entry.moodleCourseId !== "number" || typeof entry.localSubjectId !== "string") return null;
  return {
    connectionId: entry.connectionId,
    institutionId: entry.institutionId,
    moodleCourseId: entry.moodleCourseId,
    localSubjectId: entry.localSubjectId,
    boundAt: typeof entry.boundAt === "string" ? entry.boundAt : new Date().toISOString(),
  };
}

function coerceMoodleRemoteSnapshot(entry: unknown): MoodleRemoteSnapshot | null {
  if (!isRecord(entry)) return null;
  if (typeof entry.remoteItemId !== "number" || typeof entry.remoteCourseId !== "number") return null;
  if (typeof entry.remoteItemType !== "string" || !MOODLE_REMOTE_ITEM_TYPES.has(entry.remoteItemType)) return null;
  if (typeof entry.contentFingerprint !== "string") return null;
  const deletionState = typeof entry.remoteDeletionState === "string" && MOODLE_DELETION_STATES.has(entry.remoteDeletionState) ? (entry.remoteDeletionState as MoodleRemoteSnapshot["remoteDeletionState"]) : "present";
  return {
    institutionId: typeof entry.institutionId === "string" ? entry.institutionId : "",
    remoteCourseId: entry.remoteCourseId,
    remoteItemId: entry.remoteItemId,
    remoteItemType: entry.remoteItemType as MoodleRemoteItemType,
    remoteUpdatedAt: typeof entry.remoteUpdatedAt === "string" ? entry.remoteUpdatedAt : null,
    contentFingerprint: entry.contentFingerprint,
    lastImportedAt: typeof entry.lastImportedAt === "string" ? entry.lastImportedAt : new Date().toISOString(),
    lastSeenAt: typeof entry.lastSeenAt === "string" ? entry.lastSeenAt : new Date().toISOString(),
    localTargetId: typeof entry.localTargetId === "string" ? entry.localTargetId : null,
    userOverriddenFields: Array.isArray(entry.userOverriddenFields) ? entry.userOverriddenFields.filter((f): f is string => typeof f === "string") : [],
    remoteDeletionState: deletionState,
  };
}

function coerceMoodleSyncState(value: unknown): MoodleSyncState | null {
  if (!isRecord(value)) return null;
  const courseBindings = Array.isArray(value.courseBindings) ? value.courseBindings.map(coerceMoodleCourseBinding).filter((b): b is MoodleCourseBinding => b !== null) : [];
  const remoteSnapshots = Array.isArray(value.remoteSnapshots) ? value.remoteSnapshots.map(coerceMoodleRemoteSnapshot).filter((s): s is MoodleRemoteSnapshot => s !== null) : [];
  if (courseBindings.length === 0 && remoteSnapshots.length === 0) return null;
  return { courseBindings, remoteSnapshots };
}

const MILESTONE_KINDS = new Set(["achievement", "bond-level", "room-stage", "semester-complete", "goal-complete"]);

function coerceMilestones(value: unknown): MilestoneEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: MilestoneEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== "string" || seen.has(entry.id)) continue;
    if (typeof entry.kind !== "string" || !MILESTONE_KINDS.has(entry.kind)) continue;
    if (typeof entry.at !== "string") continue;
    seen.add(entry.id);
    result.push({
      id: entry.id,
      kind: entry.kind as MilestoneEntry["kind"],
      label: typeof entry.label === "string" ? entry.label : entry.id,
      at: entry.at,
    });
  }
  return result;
}

const MAX_PROACTIVE_LOG_ENTRIES = 90;

function coerceProactiveMentorLog(value: unknown): ProactiveLogEntry[] {
  if (!Array.isArray(value)) return [];
  const result: ProactiveLogEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.triggerId !== "string" || typeof entry.firedAt !== "string") continue;
    result.push({ triggerId: entry.triggerId, firedAt: entry.firedAt });
  }
  return result.slice(-MAX_PROACTIVE_LOG_ENTRIES);
}

function coerceDailyCheckIn(value: unknown): DailyCheckIn | null {
  if (!isRecord(value)) return null;
  if (typeof value.dateIso !== "string") return null;
  if (value.subjectId !== null && typeof value.subjectId !== "string") return null;
  return { dateIso: value.dateIso, subjectId: value.subjectId };
}

function coerceEveningCheckIn(value: unknown): EveningCheckIn | null {
  if (!isRecord(value)) return null;
  if (typeof value.dateIso !== "string" || typeof value.feltManageable !== "boolean") return null;
  return { dateIso: value.dateIso, feltManageable: value.feltManageable };
}

/** Versions this build can read. Version 1 is migrated to 2 during sanitising. */
const READABLE_VERSIONS = new Set([1, SAVE_DATA_VERSION]);

/**
 * Repairs a parsed-but-untrusted value into a valid UniGameSaveData,
 * falling back to fresh defaults on a per-field basis. Version-1 saves are
 * migrated in the same pass: every field-level coercer accepts both shapes
 * (v1 simply lacks `reminders` and uses the narrower study-log fields), so
 * migration is "coerce with v2 defaults" — no user data is discarded.
 * Only an unrecognised top-level shape causes a full fallback.
 */
export function sanitizeSaveData(raw: unknown): UniGameSaveData {
  const fallback = createDefaultSaveData();
  if (!isRecord(raw) || typeof raw.version !== "number" || !READABLE_VERSIONS.has(raw.version)) {
    return fallback;
  }
  return {
    version: SAVE_DATA_VERSION,
    semester: coerceSemester(raw.semester, fallback.semester),
    tasks: coerceArray<TaskRecord>(raw.tasks, fallback.tasks),
    assessmentProgress: coerceAssessmentProgressList(raw.assessmentProgress, fallback.assessmentProgress),
    reminders: coerceReminders(raw.reminders),
    studyLog: coerceStudyLog(raw.studyLog),
    activeFocusSession: coerceActiveFocusSession(raw.activeFocusSession),
    completedFocusSessions: coerceFocusSessions(raw.completedFocusSessions),
    mentorBonds: coerceMentorBonds(raw.mentorBonds),
    npcMemory: coerceNpcMemory(raw.npcMemory),
    buildingVisits: coerceBuildingVisits(raw.buildingVisits),
    buildingVisitLog: coerceBuildingVisitLog(raw.buildingVisitLog),
    milestones: coerceMilestones(raw.milestones),
    completionCelebratedAt:
      typeof raw.completionCelebratedAt === "string" ? raw.completionCelebratedAt : null,
    userProgress: coerceUserProgress(raw.userProgress, fallback.userProgress),
    settings: coerceSettings(raw.settings, fallback.settings),
    personalGoals: coercePersonalGoals(raw.personalGoals, fallback.personalGoals),
    canvasSync: coerceCanvasSyncState(raw.canvasSync),
    moodleSync: coerceMoodleSyncState(raw.moodleSync),
    playerIdentity: coercePlayerIdentity(raw),
    proactiveMentorLog: coerceProactiveMentorLog(raw.proactiveMentorLog),
    dailyCheckIn: coerceDailyCheckIn(raw.dailyCheckIn),
    eveningCheckIn: coerceEveningCheckIn(raw.eveningCheckIn),
  };
}

// ---------------------------------------------------------------------------
// Load / persist
// ---------------------------------------------------------------------------

export function loadSaveData(): UniGameSaveData {
  if (typeof window === "undefined") return createDefaultSaveData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSaveData();
    const parsed: unknown = JSON.parse(raw);

    // One-time raw backup of the pre-migration save, kept until manually
    // cleared — the migrated save overwrites the main slot on first persist.
    if (isRecord(parsed) && parsed.version === 1 && !window.localStorage.getItem(MIGRATION_BACKUP_KEY)) {
      try {
        window.localStorage.setItem(MIGRATION_BACKUP_KEY, raw);
      } catch {
        // Backup is best-effort; migration itself is non-destructive.
      }
    }

    return sanitizeSaveData(parsed);
  } catch {
    return createDefaultSaveData();
  }
}

/**
 * Returns false when the write failed (quota exceeded, private browsing,
 * storage blocked). The app keeps working in-memory for the session; the
 * caller surfaces a "progress isn't being saved" warning (RC1 Part 6).
 */
export function persistSaveData(data: UniGameSaveData): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Export / import / reset
// ---------------------------------------------------------------------------

export function exportSaveDataAsJson(data: UniGameSaveData): string {
  return JSON.stringify(data, null, 2);
}

/** Triggers a browser file download of the current save as JSON. */
export function downloadSaveData(data: UniGameSaveData, filename = "unigame-save.json"): void {
  const json = exportSaveDataAsJson(data);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true; data: UniGameSaveData }
  | { ok: false; error: string };

/**
 * Validates and parses an imported save file (versions 1 and 2 accepted;
 * v1 is migrated). Per planning/FEATURE_PLAN.md section 7: on failure
 * nothing is overwritten and the caller surfaces the error; the caller
 * writes a pre-import backup before applying `data` (see backupCurrentSave).
 */
export function importSaveDataFromJson(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "The selected file is not valid JSON." };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "The selected file is not a UniGame save (expected a JSON object)." };
  }
  if (typeof parsed.version !== "number" || !READABLE_VERSIONS.has(parsed.version)) {
    return {
      ok: false,
      error: `The selected file is not a recognised UniGame save (found version ${String(
        parsed.version ?? "none"
      )}; this app reads versions 1 and ${SAVE_DATA_VERSION}).`,
    };
  }
  if (!isRecord(parsed.semester) || !Array.isArray((parsed.semester as Record<string, unknown>).subjects)) {
    return {
      ok: false,
      error: "The selected file is missing its semester data and cannot be imported safely.",
    };
  }
  return { ok: true, data: sanitizeSaveData(parsed) };
}

/**
 * Writes the current save to the pre-import backup slot. Called immediately
 * before imported data replaces the live save, so one step back is always
 * possible.
 */
export function backupCurrentSave(current: UniGameSaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify(current));
  } catch {
    // Best-effort; the import itself already passed validation.
  }
}

/**
 * `IMPORT_BACKUP_KEY` is shared between whole-save JSON import and the
 * Phase 18A semester-import Apply transaction — deliberately, so the app
 * has exactly one "previous save" backup mechanism rather than two parallel
 * ones (see docs/PHASE_18A_IMPORT_ARCHITECTURE.md §7). This tiny marker
 * records WHICH of the two operations most recently wrote that backup, so
 * "Undo last semester import" can honestly offer itself only when that's
 * actually what's sitting in the backup slot.
 */
const IMPORT_BACKUP_KIND_KEY = "unigame:saveData:backup-preimport-kind";
export type ImportBackupKind = "raw-save-import" | "semester-import";

export function markImportBackupKind(kind: ImportBackupKind): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORT_BACKUP_KIND_KEY, kind);
  } catch {
    // Best-effort — worst case "Undo" is simply not offered.
  }
}

export function getImportBackupKind(): ImportBackupKind | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(IMPORT_BACKUP_KIND_KEY);
  return value === "raw-save-import" || value === "semester-import" ? value : null;
}

export function hasImportBackup(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(IMPORT_BACKUP_KEY) !== null;
}

/**
 * Overwrites storage with a fresh default save and returns it. The caller is
 * responsible for the explicit user confirmation step before calling this
 * (see planning/FEATURE_PLAN.md section 7: "never runs on load").
 */
export function resetSaveData(): UniGameSaveData {
  const fresh = createDefaultSaveData();
  persistSaveData(fresh);
  return fresh;
}
