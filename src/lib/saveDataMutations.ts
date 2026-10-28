/**
 * Pure (save) -> save update functions for the interactive parts of Phase 3:
 * marking modules complete/incomplete, and confirming NEEDS_CONFIRMATION
 * fields in place. All of these edit `saveData.semester` (the user's working
 * copy — see src/lib/persistence.ts) or `saveData.tasks`/`userProgress`;
 * `src/data/*` (the pristine seed) is never touched.
 *
 * confirmationStatus / reminderSchedule are always recomputed via the same
 * `deriveConfirmationStatus` / `deriveReminderSchedule` helpers the seed data
 * uses, rather than being hand-set — so an edited assessment can never fall
 * out of sync with its own weight/dueDate/dueTime.
 */

import {
  confirmed,
  deriveConfirmationStatus,
  deriveReminderSchedule,
  type AssessmentRecord,
  type AssessmentProgressStatus,
  type PersonalGoals,
  type PlayerIdentity,
  type UniGameSaveData,
  type UserAssessmentProgress,
} from "../types/domain";
import { createDefaultPlayerIdentity } from "../data/playerIdentityDefaults";
import { MODULE_REVIEW_XP, STREAK_BONUS_XP, getMelbourneDateIso, shiftDateIso } from "./selectors";
import { computeLevel } from "./xpRules";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}


export function toggleModuleCompletion(
  save: UniGameSaveData,
  moduleId: string
): UniGameSaveData {
  let xpDelta = 0;
  let becameCompleted = false;
  const nowIso = new Date().toISOString();

  const tasks = save.tasks.map((task) => {
    if (task.linkedModuleId !== moduleId) return task;
    const completed = !task.completed;
    xpDelta += completed ? task.xpReward : -task.xpReward;
    becameCompleted = completed;
    return { ...task, completed, completedAt: completed ? nowIso : null };
  });

  let { streakCount, longestStreak, lastActiveDate } = save.userProgress;

  // Streak only advances on completion (not on un-checking), and only once
  // per new Melbourne calendar day — repeat completions on the same day
  // don't re-award the streak bonus.
  if (becameCompleted) {
    const today = getMelbourneDateIso();
    if (lastActiveDate !== today) {
      streakCount = lastActiveDate === shiftDateIso(today, -1) ? streakCount + 1 : 1;
      xpDelta += STREAK_BONUS_XP;
      lastActiveDate = today;
    }
    longestStreak = Math.max(longestStreak, streakCount);
  }

  const xp = Math.max(0, save.userProgress.xp + xpDelta);

  return {
    ...save,
    tasks,
    userProgress: {
      ...save.userProgress,
      xp,
      level: computeLevel(xp),
      streakCount,
      longestStreak,
      lastActiveDate,
    },
  };
}

/**
 * Awards a small one-off "reviewed this module" XP bonus the first time its
 * detail panel is opened. Idempotent — returns `save` unchanged (same
 * reference, so React skips a re-render) if this module was already reviewed
 * or doesn't exist.
 */
export function markModuleReviewed(save: UniGameSaveData, moduleId: string): UniGameSaveData {
  let awarded = false;
  const nowIso = new Date().toISOString();

  const tasks = save.tasks.map((task) => {
    if (task.linkedModuleId !== moduleId || task.reviewedAt) return task;
    awarded = true;
    return { ...task, reviewedAt: nowIso };
  });

  if (!awarded) return save;

  const xp = save.userProgress.xp + MODULE_REVIEW_XP;
  return {
    ...save,
    tasks,
    userProgress: { ...save.userProgress, xp, level: computeLevel(xp) },
  };
}

function updateAssessment(
  save: UniGameSaveData,
  assessmentId: string,
  update: (assessment: AssessmentRecord) => AssessmentRecord
): UniGameSaveData {
  return {
    ...save,
    semester: {
      ...save.semester,
      subjects: save.semester.subjects.map((subject) => ({
        ...subject,
        assessments: subject.assessments.map((assessment) =>
          assessment.id === assessmentId ? update(assessment) : assessment
        ),
      })),
    },
  };
}

function withRederivedStatus(assessment: AssessmentRecord): AssessmentRecord {
  return {
    ...assessment,
    confirmationStatus: deriveConfirmationStatus(
      assessment.weight,
      assessment.dueDate,
      assessment.dueTime
    ),
    reminderSchedule: deriveReminderSchedule(assessment.dueDate, assessment.dueTime),
  };
}

export function confirmAssessmentWeight(
  save: UniGameSaveData,
  assessmentId: string,
  weight: number
): UniGameSaveData {
  return updateAssessment(save, assessmentId, (assessment) =>
    withRederivedStatus({ ...assessment, weight: confirmed(weight) })
  );
}

export function confirmAssessmentDueDate(
  save: UniGameSaveData,
  assessmentId: string,
  dueDate: string
): UniGameSaveData {
  return updateAssessment(save, assessmentId, (assessment) =>
    withRederivedStatus({ ...assessment, dueDate: confirmed(dueDate) })
  );
}

export function confirmAssessmentDueTime(
  save: UniGameSaveData,
  assessmentId: string,
  dueTime: string
): UniGameSaveData {
  return updateAssessment(save, assessmentId, (assessment) =>
    withRederivedStatus({ ...assessment, dueTime: confirmed(dueTime) })
  );
}

export function confirmAssessmentAiPolicy(
  save: UniGameSaveData,
  assessmentId: string,
  aiPolicy: string
): UniGameSaveData {
  return updateAssessment(save, assessmentId, (assessment) => ({
    ...assessment,
    aiPolicy: confirmed(aiPolicy),
  }));
}

export function confirmAssessmentExtensionEligibility(
  save: UniGameSaveData,
  assessmentId: string,
  extensionEligibility: string
): UniGameSaveData {
  return updateAssessment(save, assessmentId, (assessment) => ({
    ...assessment,
    extensionEligibility: confirmed(extensionEligibility),
  }));
}

export function confirmSubjectCode(
  save: UniGameSaveData,
  subjectId: string,
  code: string
): UniGameSaveData {
  return {
    ...save,
    semester: {
      ...save.semester,
      subjects: save.semester.subjects.map((subject) =>
        subject.id === subjectId ? { ...subject, code: confirmed(code) } : subject
      ),
    },
  };
}

/**
 * Semester start/end are ConfirmableValues with no /docs source — the user
 * confirms them in place (Semester Calendar strip). Same pattern as every
 * other NEEDS_CONFIRMATION field: the value the user enters becomes the
 * single source; nothing is ever invented.
 */
export function confirmSemesterStartDate(save: UniGameSaveData, dateIso: string): UniGameSaveData {
  return { ...save, semester: { ...save.semester, startDate: confirmed(dateIso) } };
}

export function confirmSemesterEndDate(save: UniGameSaveData, dateIso: string): UniGameSaveData {
  return { ...save, semester: { ...save.semester, endDate: confirmed(dateIso) } };
}

// ---------------------------------------------------------------------------
// Assessment progress (Assessment Detail screen) — a per-assessment
// UserAssessmentProgress record always exists (seeded in persistence.ts), so
// these update in place; the fallback branch only guards against a future
// assessment added to the seed without a matching progress record yet.
// ---------------------------------------------------------------------------

function updateAssessmentProgress(
  save: UniGameSaveData,
  assessmentId: string,
  update: (progress: UserAssessmentProgress) => UserAssessmentProgress
): UniGameSaveData {
  const exists = save.assessmentProgress.some((progress) => progress.assessmentId === assessmentId);
  const list = exists
    ? save.assessmentProgress.map((progress) =>
        progress.assessmentId === assessmentId ? update(progress) : progress
      )
    : [
        ...save.assessmentProgress,
        update({
          assessmentId,
          progressPercent: 0,
          status: "not_started",
          statusChangedAt: null,
          estimatedHours: null,
          hoursCompleted: 0,
          checklist: [],
          grade: null,
          links: [],
        }),
      ];
  return { ...save, assessmentProgress: list };
}

export function setAssessmentProgressStatus(
  save: UniGameSaveData,
  assessmentId: string,
  status: AssessmentProgressStatus
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) =>
    progress.status === status
      ? progress
      : { ...progress, status, statusChangedAt: new Date().toISOString() }
  );
}

export function setAssessmentProgressPercent(
  save: UniGameSaveData,
  assessmentId: string,
  progressPercent: number
): UniGameSaveData {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  return updateAssessmentProgress(save, assessmentId, (progress) => ({ ...progress, progressPercent: clamped }));
}

export function setAssessmentEstimatedHours(
  save: UniGameSaveData,
  assessmentId: string,
  estimatedHours: number | null
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({ ...progress, estimatedHours }));
}

export function setAssessmentHoursCompleted(
  save: UniGameSaveData,
  assessmentId: string,
  hoursCompleted: number
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({
    ...progress,
    hoursCompleted: Math.max(0, hoursCompleted),
  }));
}

export function setAssessmentGrade(
  save: UniGameSaveData,
  assessmentId: string,
  grade: number | null
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({ ...progress, grade }));
}

export function addChecklistItem(
  save: UniGameSaveData,
  assessmentId: string,
  label: string
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({
    ...progress,
    checklist: [...progress.checklist, { id: generateId("checklist"), label, done: false }],
  }));
}

export function toggleChecklistItem(
  save: UniGameSaveData,
  assessmentId: string,
  itemId: string
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({
    ...progress,
    checklist: progress.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    ),
  }));
}

export function removeChecklistItem(
  save: UniGameSaveData,
  assessmentId: string,
  itemId: string
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({
    ...progress,
    checklist: progress.checklist.filter((item) => item.id !== itemId),
  }));
}

export function addAssessmentLink(
  save: UniGameSaveData,
  assessmentId: string,
  label: string,
  url: string
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({
    ...progress,
    links: [...progress.links, { id: generateId("link"), label, url }],
  }));
}

export function removeAssessmentLink(
  save: UniGameSaveData,
  assessmentId: string,
  linkId: string
): UniGameSaveData {
  return updateAssessmentProgress(save, assessmentId, (progress) => ({
    ...progress,
    links: progress.links.filter((link) => link.id !== linkId),
  }));
}

// ---------------------------------------------------------------------------
// Priority Centre manual override
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Personal goals (Phase 18A) — user-chosen only, never inferred from an import.
// ---------------------------------------------------------------------------

export function setPersonalGoals(save: UniGameSaveData, patch: Partial<PersonalGoals>): UniGameSaveData {
  return { ...save, personalGoals: { ...save.personalGoals, ...patch } };
}

/**
 * Phase 20B — one mutation covers both "create during onboarding" and
 * "edit later via the Character Creator/Wardrobe": if `save.playerIdentity`
 * is `null` (a genuinely fresh save that hasn't been through onboarding),
 * the patch is merged onto a fresh default identity and `createdAt` is
 * stamped for the first time; if an identity already exists, the patch
 * merges onto it and `createdAt` is preserved. Either way `lastModifiedAt`
 * updates. This is why the onboarding wizard can call this incrementally,
 * one step's fields at a time, rather than needing a separate "create"
 * mutation before "edit" ones.
 */
export function setPlayerIdentity(save: UniGameSaveData, patch: Partial<PlayerIdentity>): UniGameSaveData {
  const isFirstWrite = save.playerIdentity === null;
  const base = save.playerIdentity ?? createDefaultPlayerIdentity();
  const now = new Date().toISOString();
  return {
    ...save,
    playerIdentity: {
      ...base,
      ...patch,
      createdAt: isFirstWrite ? now : base.createdAt,
      lastModifiedAt: now,
    },
  };
}

export function togglePinnedPriority(save: UniGameSaveData, itemId: string): UniGameSaveData {
  const pinned = save.settings.pinnedPriorityIds.includes(itemId);
  return {
    ...save,
    settings: {
      ...save.settings,
      pinnedPriorityIds: pinned
        ? save.settings.pinnedPriorityIds.filter((id) => id !== itemId)
        : [...save.settings.pinnedPriorityIds, itemId],
    },
  };
}
