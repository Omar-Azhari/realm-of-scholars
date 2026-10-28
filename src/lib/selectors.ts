/**
 * Pure derived-data helpers. Nothing here is stored — progress percentages,
 * "next deadline", and weekly activity are always computed from `tasks` and
 * `semester.subjects` at read time, so there is exactly one source of truth
 * (no separately-maintained duplicate counters to drift out of sync).
 */

import type { AssessmentRecord, SubjectRecord, TaskRecord } from "../types/domain";

/**
 * XP constants. Defined once here (rather than in saveDataMutations.ts, which
 * imports them) so the amount awarded and the amount reflected in derived
 * totals (getSubjectXp) can never drift apart.
 */
export const MODULE_REVIEW_XP = 2;
export const STREAK_BONUS_XP = 5;

export function isModuleCompleted(tasks: TaskRecord[], moduleId: string): boolean {
  return tasks.some((task) => task.linkedModuleId === moduleId && task.completed);
}

export function getSubjectCompletedModuleCount(tasks: TaskRecord[], subject: SubjectRecord): number {
  return subject.modules.filter((module) => isModuleCompleted(tasks, module.id)).length;
}

export function getSubjectProgressPercent(tasks: TaskRecord[], subject: SubjectRecord): number {
  const total = subject.modules.length;
  if (total === 0) return 0;
  return Math.round((getSubjectCompletedModuleCount(tasks, subject) / total) * 100);
}

export interface OverallModuleProgress {
  completed: number;
  total: number;
  percent: number;
}

export function getOverallModuleProgress(
  tasks: TaskRecord[],
  subjects: SubjectRecord[]
): OverallModuleProgress {
  const total = subjects.reduce((sum, subject) => sum + subject.modules.length, 0);
  const completed = subjects.reduce(
    (sum, subject) => sum + getSubjectCompletedModuleCount(tasks, subject),
    0
  );
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

/**
 * Modules completed within the trailing N days of real time. Deliberately
 * NOT tied to semester "week numbers" — those are NEEDS_CONFIRMATION (no
 * confirmed semester start date exists anywhere in /docs), so this measures
 * actual recent activity instead of an invented calendar-week mapping.
 */
export function getModulesCompletedInLastDays(
  tasks: TaskRecord[],
  days: number,
  now: Date = new Date()
): number {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return tasks.filter(
    (task) =>
      task.linkedModuleId !== null &&
      task.completed &&
      task.completedAt !== null &&
      new Date(task.completedAt).getTime() >= cutoff
  ).length;
}

/**
 * Formats `now` as Melbourne wall-clock "YYYY-MM-DDTHH:mm". Assessment
 * dueDate/dueTime values are already Australia/Melbourne local values (see
 * src/types/domain.ts), so comparing zero-padded strings in this same format
 * gives a correct chronological comparison without any timezone-conversion
 * arithmetic or added date-library dependency. Exported (not just used
 * internally) so src/lib/priority.ts can determine overdue status the same
 * way, rather than re-implementing this formatting.
 */
export function getMelbourneDateTimeKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Today's calendar date in Australia/Melbourne, as "YYYY-MM-DD". */
export function getMelbourneDateIso(now: Date = new Date()): string {
  return getMelbourneDateTimeKey(now).slice(0, 10);
}

/** Shifts a "YYYY-MM-DD" date by a (possibly negative) number of whole days. */
export function shiftDateIso(dateIso: string, deltaDays: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + deltaDays)).toISOString().slice(0, 10);
}

/** Whole days between two "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm") dates; positive when `toIso` is later. */
export function daysBetweenDateIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / (24 * 60 * 60 * 1000));
}

export interface UpcomingDeadline {
  subject: SubjectRecord;
  assessment: AssessmentRecord;
}

/**
 * Every assessment across the given subjects whose due date AND due time are
 * both confirmed and not yet passed, soonest first. Assessments with any
 * NEEDS_CONFIRMATION due date/time are excluded — never guessed at.
 */
export function getUpcomingDeadlines(
  subjects: SubjectRecord[],
  now: Date = new Date()
): UpcomingDeadline[] {
  const nowKey = getMelbourneDateTimeKey(now);
  const candidates: Array<UpcomingDeadline & { dueKey: string }> = [];

  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime } = assessment;
      if (
        dueDate.status === "confirmed" &&
        dueTime.status === "confirmed" &&
        dueDate.value &&
        dueTime.value
      ) {
        const dueKey = `${dueDate.value}T${dueTime.value}`;
        if (dueKey >= nowKey) {
          candidates.push({ subject, assessment, dueKey });
        }
      }
    }
  }

  candidates.sort((a, b) => (a.dueKey < b.dueKey ? -1 : a.dueKey > b.dueKey ? 1 : 0));
  return candidates.map(({ subject, assessment }) => ({ subject, assessment }));
}

/** The single soonest upcoming deadline — see getUpcomingDeadlines for the full list and exclusion rule. */
export function getNextDeadline(
  subjects: SubjectRecord[],
  now: Date = new Date()
): UpcomingDeadline | null {
  return getUpcomingDeadlines(subjects, now)[0] ?? null;
}

export function countConfirmedAssessments(assessments: AssessmentRecord[]): number {
  return assessments.filter((assessment) => assessment.confirmationStatus === "confirmed").length;
}

/** Total XP earned from this subject's modules (completion + one-off review bonus). */
export function getSubjectXp(tasks: TaskRecord[], subject: SubjectRecord): number {
  const moduleIds = new Set(subject.modules.map((module) => module.id));
  return tasks.reduce((sum, task) => {
    if (!task.linkedModuleId || !moduleIds.has(task.linkedModuleId)) return sum;
    let xp = sum;
    if (task.completed) xp += task.xpReward;
    if (task.reviewedAt) xp += MODULE_REVIEW_XP;
    return xp;
  }, 0);
}

/**
 * Consecutive-day study streak for one subject, derived from module
 * completedAt timestamps — no separate stored streak field for this (unlike
 * the semester-wide streak in UserProgress, which the Phase 2 data model
 * already commits to storing). A streak still counts as "current" if the
 * most recent activity was yesterday (not yet broken until today ends).
 */
export function getSubjectStreak(
  tasks: TaskRecord[],
  subject: SubjectRecord,
  now: Date = new Date()
): number {
  const moduleIds = new Set(subject.modules.map((module) => module.id));
  const activeDates = new Set(
    tasks
      .filter(
        (task) =>
          task.linkedModuleId &&
          moduleIds.has(task.linkedModuleId) &&
          task.completed &&
          task.completedAt
      )
      .map((task) => getMelbourneDateIso(new Date(task.completedAt as string)))
  );

  let cursor = getMelbourneDateIso(now);
  if (!activeDates.has(cursor)) {
    const yesterday = shiftDateIso(cursor, -1);
    if (!activeDates.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateIso(cursor, -1);
  }
  return streak;
}

/** All incomplete module-completion tasks across the semester. Broader than
 * (and independent from) the curated Weekly Missions list in src/lib/missions.ts —
 * this is the raw "everything left to do" count shown on the HUD. */
export function getActiveMissionCount(tasks: TaskRecord[]): number {
  return tasks.filter((task) => task.type === "milestone" && !task.completed).length;
}

export interface RecentlyCompletedModule {
  subject: SubjectRecord;
  module: SubjectRecord["modules"][number];
  completedAt: string;
}

/** Modules completed within the trailing N days, with title/subject for display (newest first). */
export function getRecentlyCompletedModules(
  subjects: SubjectRecord[],
  tasks: TaskRecord[],
  days: number,
  now: Date = new Date()
): RecentlyCompletedModule[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const results: RecentlyCompletedModule[] = [];

  for (const subject of subjects) {
    for (const module of subject.modules) {
      const task = tasks.find((t) => t.linkedModuleId === module.id);
      if (task?.completed && task.completedAt && new Date(task.completedAt).getTime() >= cutoff) {
        results.push({ subject, module, completedAt: task.completedAt });
      }
    }
  }

  results.sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0));
  return results;
}

/**
 * XP earned in the trailing N days from module completions and review
 * bonuses (both timestamped). Does NOT include streak bonuses — those are
 * awarded in the same transaction as a completion but not attributed to a
 * specific task record, so they can't be attributed to a day in retrospect
 * without inventing a ledger; this is a real partial total, not a fabricated
 * one.
 */
export function getWeeklyXp(tasks: TaskRecord[], days: number = 7, now: Date = new Date()): number {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  let xp = 0;
  for (const task of tasks) {
    if (task.completed && task.completedAt && new Date(task.completedAt).getTime() >= cutoff) {
      xp += task.xpReward;
    }
    if (task.reviewedAt && new Date(task.reviewedAt).getTime() >= cutoff) {
      xp += MODULE_REVIEW_XP;
    }
  }
  return xp;
}
