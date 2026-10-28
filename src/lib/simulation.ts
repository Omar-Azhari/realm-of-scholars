/**
 * Simulation layer — see planning/SIMS_STYLE_REDESIGN.md §4 for the full
 * design (mood/energy/stress/focus/confidence). Like src/lib/priority.ts,
 * every value here is *derived* fresh from tasks/assessments on each read,
 * never stored — there is nothing to invalidate and nothing that can drift
 * from real progress.
 */

import { computeAssessmentPriorities, computeModulePriorities } from "./priority";
import {
  getMelbourneDateTimeKey,
  getModulesCompletedInLastDays,
  getSubjectProgressPercent,
  getSubjectStreak,
  daysBetweenDateIso,
} from "./selectors";
import type { SubjectRecord, TaskRecord, UserAssessmentProgress } from "../types/domain";

export type MoodBucket = "relaxed" | "content" | "focused" | "stressed" | "tired";
export type RoomActivity = "idle" | "typing" | "reading" | "walking" | "looking-around";
export type RoomStatus = "calm" | "active" | "urgent" | "completed";

export interface SubjectSimState {
  subjectId: string;
  mood: MoodBucket;
  energy: number;
  stress: number;
  focus: number;
  confidence: number;
  workload: number;
  activity: RoomActivity;
  roomStatus: RoomStatus;
  justCelebrated: boolean;
  /** The strongest current pressure signal, for character speech — null when nothing is pressing. */
  pressingConcern: string | null;
}

function clamp01to100(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

interface DeadlinePressure {
  hasOverdue: boolean;
  /** Days until the nearest confirmed, not-yet-passed deadline; null when none is confirmed. */
  nearestDays: number | null;
  nearestTitle: string | null;
  unconfirmedCount: number;
}

function computeDeadlinePressure(subject: SubjectRecord, now: Date): DeadlinePressure {
  const nowKey = getMelbourneDateTimeKey(now);
  let hasOverdue = false;
  let nearestDays: number | null = null;
  let nearestTitle: string | null = null;
  let unconfirmedCount = 0;

  for (const assessment of subject.assessments) {
    const { dueDate, dueTime } = assessment;
    const confirmedDeadline =
      dueDate.status === "confirmed" && dueTime.status === "confirmed" && dueDate.value && dueTime.value;
    if (!confirmedDeadline) {
      unconfirmedCount += 1;
      continue;
    }
    const dueKey = `${dueDate.value}T${dueTime.value}`;
    if (dueKey < nowKey) {
      hasOverdue = true;
      continue;
    }
    const days = daysBetweenDateIso(nowKey, dueKey);
    if (nearestDays === null || days < nearestDays) {
      nearestDays = days;
      nearestTitle = assessment.title;
    }
  }

  return { hasOverdue, nearestDays, nearestTitle, unconfirmedCount };
}

/**
 * calm / active / urgent / completed — see planning/SIMS_STYLE_REDESIGN.md §4
 * for the rule table. Reuses the existing priority engine's overdue/urgency
 * detection rather than re-deriving "is this due soon" a second way.
 */
export function computeRoomStatus(
  subject: SubjectRecord,
  tasks: TaskRecord[],
  now: Date = new Date()
): RoomStatus {
  const modulePriorities = computeModulePriorities(tasks, [subject]);
  const allModulesComplete = modulePriorities.every((mp) => mp.completed);

  const assessmentPriorities = computeAssessmentPriorities([subject], now);
  const hasOverdue = assessmentPriorities.some((ap) => ap.overdue);
  const pressure = computeDeadlinePressure(subject, now);
  const hasNearDeadline = pressure.nearestDays !== null && pressure.nearestDays <= 3;

  const anyAssessmentOpen = subject.assessments.length > 0;
  const completedModuleCount = modulePriorities.filter((mp) => mp.completed).length;

  if (allModulesComplete && !anyAssessmentOpen) return "completed";
  if (hasOverdue || hasNearDeadline) return "urgent";
  if (completedModuleCount > 0) return "active";
  return "calm";
}

/**
 * Full per-subject simulation state (the Phase C model from
 * planning/SIMS_STYLE_REDESIGN.md §4). Deterministic rules over values the
 * app already tracks — deadline proximity, overdue items, unconfirmed fields,
 * streaks, recent completions, subject progress. Nothing fabricated.
 */
export function computeSubjectSimState(
  subject: SubjectRecord,
  tasks: TaskRecord[],
  _assessmentProgress: UserAssessmentProgress[],
  now: Date = new Date()
): SubjectSimState {
  const modulePriorities = computeModulePriorities(tasks, [subject]);
  const incompleteCount = modulePriorities.filter((mp) => !mp.completed).length;
  const totalModules = Math.max(1, modulePriorities.length);
  const pressure = computeDeadlinePressure(subject, now);
  const progressPercent = getSubjectProgressPercent(tasks, subject);
  const streak = getSubjectStreak(tasks, subject, now);

  const moduleIds = new Set(subject.modules.map((m) => m.id));
  const subjectTasks = tasks.filter((t) => t.linkedModuleId !== null && moduleIds.has(t.linkedModuleId));
  const recentCompletions = getModulesCompletedInLastDays(subjectTasks, 7, now);

  // Days since the last completion in this subject (Infinity when none yet).
  let daysSinceActivity = Number.POSITIVE_INFINITY;
  for (const task of subjectTasks) {
    if (task.completed && task.completedAt) {
      const days = (now.getTime() - new Date(task.completedAt).getTime()) / (24 * 60 * 60 * 1000);
      if (days < daysSinceActivity) daysSinceActivity = days;
    }
  }

  // workload — proportion of remaining modules plus near-deadline pressure.
  let workload = (incompleteCount / totalModules) * 70;
  if (pressure.hasOverdue) workload += 30;
  else if (pressure.nearestDays !== null && pressure.nearestDays <= 7) workload += 20;
  else if (pressure.nearestDays !== null && pressure.nearestDays <= 14) workload += 10;
  workload = clamp01to100(workload);

  // stress — overdue (big), confirmed deadline within 3 days (medium),
  // unresolved NEEDS_CONFIRMATION on approaching work (small). Falls as work clears.
  let stress = 10;
  if (pressure.hasOverdue) stress += 55;
  if (pressure.nearestDays !== null) {
    if (pressure.nearestDays <= 3) stress += 35;
    else if (pressure.nearestDays <= 7) stress += 22;
    else if (pressure.nearestDays <= 14) stress += 10;
  }
  stress += Math.min(15, pressure.unconfirmedCount * 5);
  stress -= progressPercent * 0.2;
  stress = clamp01to100(stress);

  // energy — drains with inactivity, refills on a same-day completion.
  let energy: number;
  if (!Number.isFinite(daysSinceActivity)) energy = 55;
  else if (daysSinceActivity < 1) energy = 95;
  else energy = 90 - Math.min(50, daysSinceActivity * 9);
  energy = clamp01to100(energy);

  // focus — streaks and recent completions build it; stress erodes it.
  let focus = 30 + streak * 12 + recentCompletions * 8 - stress * 0.35;
  focus = clamp01to100(focus);

  // confidence — overall progress plus recent momentum, dented by overdue work.
  let confidence = 20 + progressPercent * 0.6 + recentCompletions * 6 - (pressure.hasOverdue ? 20 : 0);
  confidence = clamp01to100(confidence);

  // mood — plain decision ladder, documented in SIMS_STYLE_REDESIGN.md §4.
  let mood: MoodBucket;
  if (stress >= 60 && energy < 40) mood = "tired";
  else if (stress >= 55) mood = "stressed";
  else if (focus >= 60 && confidence >= 55) mood = "focused";
  else if (workload <= 30 && confidence >= 55) mood = "relaxed";
  else mood = "content";

  // activity — derived from mood + whether anything is actionable.
  let activity: RoomActivity;
  switch (mood) {
    case "stressed":
    case "focused":
      activity = "typing";
      break;
    case "tired":
      activity = "reading";
      break;
    case "relaxed":
      activity = "looking-around";
      break;
    default:
      activity = "reading";
      break;
  }
  if (incompleteCount === 0) activity = "looking-around";

  const roomStatus = computeRoomStatus(subject, tasks, now);

  // justCelebrated — a completion in this subject within the last 12 seconds.
  const justCelebrated = subjectTasks.some(
    (task) =>
      task.completed &&
      task.completedAt !== null &&
      now.getTime() - new Date(task.completedAt).getTime() < 12_000
  );

  let pressingConcern: string | null = null;
  if (pressure.hasOverdue) pressingConcern = "Something in here is overdue!";
  else if (pressure.nearestDays !== null && pressure.nearestDays <= 7 && pressure.nearestTitle) {
    pressingConcern =
      pressure.nearestDays <= 0
        ? `${pressure.nearestTitle} is due today!`
        : `${pressure.nearestTitle} — ${pressure.nearestDays} day${pressure.nearestDays === 1 ? "" : "s"} left.`;
  } else if (pressure.unconfirmedCount > 0) {
    pressingConcern = `${pressure.unconfirmedCount} assessment detail${pressure.unconfirmedCount === 1 ? "" : "s"} still need${pressure.unconfirmedCount === 1 ? "s" : ""} confirming.`;
  }

  return {
    subjectId: subject.id,
    mood,
    energy,
    stress,
    focus,
    confidence,
    workload,
    activity,
    roomStatus,
    justCelebrated,
    pressingConcern,
  };
}

/** Placeholder kept for API compatibility with pre-simulation callers. */
export const PLACEHOLDER_SIM_STATE: Pick<SubjectSimState, "mood" | "activity" | "justCelebrated"> = {
  mood: "content",
  activity: "idle",
  justCelebrated: false,
};
