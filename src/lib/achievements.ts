/**
 * Achievement definitions. Each `isUnlocked` predicate reads only real,
 * already-tracked user activity (module completions/reviews, XP, streak,
 * overall progress, assessment status) — nothing here is ever force-unlocked
 * or time-based. Unlock state is recomputed on every read, not stored, so it
 * can never drift from what actually happened.
 */

import type { UniGameSaveData } from "../types/domain";
import { getMelbourneDateTimeKey, getOverallModuleProgress } from "./selectors";
import { getCountedSessions, getTotalFocusSeconds } from "./focusSession";

/** Melbourne local hour a session started at. */
function sessionStartHour(startedAt: string): number {
  return Number(getMelbourneDateTimeKey(new Date(startedAt)).slice(11, 13));
}

export interface AchievementContext {
  saveData: UniGameSaveData;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  isUnlocked: (context: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "first-module",
    title: "First Module",
    description: "Complete your first module in any subject.",
    isUnlocked: ({ saveData }) => saveData.tasks.some((task) => task.linkedModuleId !== null && task.completed),
  },
  {
    id: "study-streak",
    title: "Study Streak",
    description: "Reach a 3-day study streak.",
    isUnlocked: ({ saveData }) => saveData.userProgress.streakCount >= 3,
  },
  {
    id: "half-semester",
    title: "Half Semester",
    description: "Complete 50% of all modules across the semester.",
    isUnlocked: ({ saveData }) =>
      getOverallModuleProgress(saveData.tasks, saveData.semester.subjects).percent >= 50,
  },
  {
    id: "hundred-xp",
    title: "100 XP",
    description: "Earn a total of 100 XP.",
    isUnlocked: ({ saveData }) => saveData.userProgress.xp >= 100,
  },
  {
    id: "first-assessment",
    title: "First Assessment",
    description: "Mark an assessment as submitted or graded.",
    isUnlocked: ({ saveData }) =>
      saveData.assessmentProgress.some((progress) => progress.status === "submitted" || progress.status === "graded"),
  },
  /* --- Focus Sprint + living-semester achievements (Phase 7). All predicates
     read real recorded activity; "counted" sessions need ≥5 real minutes.
     Times use the Australia/Melbourne wall clock. --- */
  {
    id: "first-sprint",
    title: "First Focus Sprint",
    description: "Complete your first counted Focus Sprint (5+ real minutes).",
    isUnlocked: ({ saveData }) => getCountedSessions(saveData).length >= 1,
  },
  {
    id: "five-sprints",
    title: "Five Focus Sprints",
    description: "Complete five counted Focus Sprints.",
    isUnlocked: ({ saveData }) => getCountedSessions(saveData).length >= 5,
  },
  {
    id: "five-hours",
    title: "Five Hours Studied",
    description: "Log five hours of real focused study time.",
    isUnlocked: ({ saveData }) => getTotalFocusSeconds(saveData) >= 5 * 3600,
  },
  {
    id: "twenty-five-hours",
    title: "Twenty-Five Hours Studied",
    description: "Log twenty-five hours of real focused study time.",
    isUnlocked: ({ saveData }) => getTotalFocusSeconds(saveData) >= 25 * 3600,
  },
  {
    id: "hundred-hours",
    title: "One Hundred Hours Studied",
    description: "Log one hundred hours of real focused study time.",
    isUnlocked: ({ saveData }) => getTotalFocusSeconds(saveData) >= 100 * 3600,
  },
  {
    id: "seven-day-streak",
    title: "Seven-Day Streak",
    description: "Reach a 7-day study streak.",
    isUnlocked: ({ saveData }) => saveData.userProgress.longestStreak >= 7,
  },
  {
    id: "thirty-day-streak",
    title: "Thirty-Day Streak",
    description: "Reach a 30-day study streak.",
    isUnlocked: ({ saveData }) => saveData.userProgress.longestStreak >= 30,
  },
  {
    id: "morning-session",
    title: "Morning Study Session",
    description: "Start a counted Focus Sprint between 5:00 am and 9:00 am (Melbourne).",
    isUnlocked: ({ saveData }) =>
      getCountedSessions(saveData).some((session) => {
        const hour = sessionStartHour(session.startedAt);
        return hour >= 5 && hour < 9;
      }),
  },
  {
    id: "late-night-session",
    title: "Late-Night Study Session",
    description: "Start a counted Focus Sprint between 10:00 pm and 2:00 am (Melbourne).",
    isUnlocked: ({ saveData }) =>
      getCountedSessions(saveData).some((session) => {
        const hour = sessionStartHour(session.startedAt);
        return hour >= 22 || hour < 2;
      }),
  },
  {
    id: "semester-complete",
    title: "Semester Completed",
    description: "Complete every module and submit every assessment across all four subjects.",
    isUnlocked: ({ saveData }) => {
      const progress = getOverallModuleProgress(saveData.tasks, saveData.semester.subjects);
      if (progress.total === 0 || progress.completed !== progress.total) return false;
      const statusById = new Map(saveData.assessmentProgress.map((p) => [p.assessmentId, p.status]));
      return saveData.semester.subjects.every((subject) =>
        subject.assessments.every((assessment) => {
          const status = statusById.get(assessment.id);
          return status === "submitted" || status === "graded";
        })
      );
    },
  },
];

export interface AchievementStatus {
  definition: AchievementDefinition;
  unlocked: boolean;
}

export function getAchievementStatuses(saveData: UniGameSaveData): AchievementStatus[] {
  const context: AchievementContext = { saveData };
  return ACHIEVEMENTS.map((definition) => ({ definition, unlocked: definition.isUnlocked(context) }));
}
