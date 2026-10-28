/**
 * Phase 22 Part 6 "Goal System" — small, adaptive daily goals, generated
 * fresh from `StudentContext` (never stored as "assigned," since every
 * goal's progress/completion is fully re-derivable from today's Melbourne-
 * date save data at any moment — the same "derived over stored" discipline
 * `mentorRelationship.ts`/`roomEvolution.ts` already follow). "Adapt
 * automatically" means WHICH goals appear today depends on real context
 * (subject count, remaining assessments, an active streak) — never a
 * player-authored or randomly-picked list.
 *
 * "Completed goals become journal memories": a goal's completion state
 * can't be recovered after the fact once tomorrow resets it, so —
 * mirroring `milestones.ts`'s own reasoning for why a first-seen log
 * exists at all — `syncGoalMilestones` stamps a `"goal-complete"`
 * `MilestoneEntry` the first time a goal is observed complete each day
 * (the id is date-suffixed, so completing the same goal again tomorrow
 * logs a fresh entry, and the SAME convergence contract `syncMilestones`
 * already uses: returns the identical array reference when nothing new
 * qualifies, so a `useEffect` calling it converges instead of looping).
 */

import { getMelbourneDateIso } from "../lib/selectors";
import { getCountedSessions } from "../lib/focusSession";
import type { StudentContext } from "./ContextEngine";
import type { MilestoneEntry, UniGameSaveData } from "../types/domain";

export type GoalTemplateId = "study-45" | "visit-every-subject-room" | "complete-assessment" | "maintain-streak";

export interface Goal {
  id: string;
  templateId: GoalTemplateId;
  title: string;
  description: string;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
}

const STUDY_GOAL_MINUTES = 45;

function studyGoal(save: UniGameSaveData, todayIso: string): Goal {
  const minutesToday = Math.floor(
    getCountedSessions(save)
      .filter((s) => getMelbourneDateIso(new Date(s.startedAt)) === todayIso)
      .reduce((sum, s) => sum + s.elapsedFocusSeconds, 0) / 60
  );
  return {
    id: `goal:study-45:${todayIso}`,
    templateId: "study-45",
    title: `Study for ${STUDY_GOAL_MINUTES} minutes`,
    description: `You've focused for ${minutesToday} of ${STUDY_GOAL_MINUTES} minutes today.`,
    progressCurrent: Math.min(minutesToday, STUDY_GOAL_MINUTES),
    progressTarget: STUDY_GOAL_MINUTES,
    completed: minutesToday >= STUDY_GOAL_MINUTES,
  };
}

function visitEverySubjectRoomGoal(save: UniGameSaveData, context: StudentContext, todayIso: string): Goal {
  const total = context.subjects.length;
  const visitedToday = context.subjects.filter((s) => save.mentorBonds[s.subjectId]?.lastVisitDate === todayIso).length;
  return {
    id: `goal:visit-every-subject-room:${todayIso}`,
    templateId: "visit-every-subject-room",
    title: "Visit every subject room today",
    description: `You've visited ${visitedToday} of ${total} subject rooms today.`,
    progressCurrent: visitedToday,
    progressTarget: total,
    completed: total > 0 && visitedToday >= total,
  };
}

function completeAssessmentGoal(save: UniGameSaveData, todayIso: string): Goal {
  const completedToday = save.assessmentProgress.filter(
    (p) => (p.status === "submitted" || p.status === "graded") && p.statusChangedAt !== null && getMelbourneDateIso(new Date(p.statusChangedAt)) === todayIso
  ).length;
  return {
    id: `goal:complete-assessment:${todayIso}`,
    templateId: "complete-assessment",
    title: "Complete one assessment",
    description: completedToday > 0 ? `You've submitted ${completedToday} assessment${completedToday === 1 ? "" : "s"} today.` : "Submit an assessment today to complete this goal.",
    progressCurrent: Math.min(completedToday, 1),
    progressTarget: 1,
    completed: completedToday >= 1,
  };
}

function maintainStreakGoal(save: UniGameSaveData, todayIso: string): Goal {
  const maintainedToday = save.userProgress.lastActiveDate === todayIso;
  return {
    id: `goal:maintain-streak:${todayIso}`,
    templateId: "maintain-streak",
    title: "Maintain your study streak",
    description: maintainedToday ? `Your ${save.userProgress.streakCount}-day streak is safe for today.` : `Do something today to keep your ${save.userProgress.streakCount}-day streak going.`,
    progressCurrent: maintainedToday ? 1 : 0,
    progressTarget: 1,
    completed: maintainedToday,
  };
}

/**
 * Today's adaptive goal set. Only includes a goal template when it makes
 * sense for THIS save right now: "visit every subject room" needs 2+
 * subjects, "complete an assessment" needs one still outstanding,
 * "maintain streak" needs an actual streak to maintain.
 */
export function generateDailyGoals(save: UniGameSaveData, context: StudentContext, now: Date = new Date()): Goal[] {
  const todayIso = getMelbourneDateIso(now);
  const goals: Goal[] = [];

  if (context.subjects.length > 0) goals.push(studyGoal(save, todayIso));
  if (context.subjects.length >= 2) goals.push(visitEverySubjectRoomGoal(save, context, todayIso));
  if (context.subjects.some((s) => s.completedAssessments < s.totalAssessments)) goals.push(completeAssessmentGoal(save, todayIso));
  if (context.streak.current >= 1) goals.push(maintainStreakGoal(save, todayIso));

  return goals;
}

/**
 * Appends a `"goal-complete"` milestone the first time each of today's
 * goals is observed complete. Same convergence contract as
 * `milestones.ts`'s `syncMilestones`: returns the SAME array reference
 * when nothing new qualifies, so a `useEffect` calling this converges
 * instead of looping.
 */
export function syncGoalMilestones(save: UniGameSaveData, context: StudentContext, now: Date = new Date()): MilestoneEntry[] {
  const have = new Set(save.milestones.map((entry) => entry.id));
  const fresh: MilestoneEntry[] = [];
  const at = now.toISOString();

  for (const goal of generateDailyGoals(save, context, now)) {
    if (goal.completed && !have.has(goal.id)) {
      fresh.push({ id: goal.id, kind: "goal-complete", label: goal.title, at });
    }
  }

  return fresh.length === 0 ? save.milestones : [...save.milestones, ...fresh];
}
