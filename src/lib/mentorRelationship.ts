/**
 * Mentor relationships — THE single place bond points and levels are
 * computed.
 *
 * Almost everything is DERIVED from real saved activity, so points can never
 * drift or be farmed by UI fiddling:
 * - +10 per counted Focus Sprint in the subject (needs ≥5 real minutes)
 * - +5  per completed module in the subject
 * - +15 per assessment submitted or graded in the subject
 * - +2  per distinct visit day (the ONLY stored input — incremented at most
 *       once per Melbourne calendar day when entering the room, so opening
 *       and closing interactions repeatedly earns nothing)
 * - +5  per global streak milestone reached (3 / 7 / 14 / 30 days, from
 *       longestStreak — shared by every mentor: streaks are semester-wide)
 *
 * Levels unlock dialogue depth, celebration reactions, a supportive check-in
 * variant, and (via roomEvolution.ts) cosmetic room upgrades. Dialogue only
 * ever references real saved progress and deadlines.
 */

import { getCountedSessions, getSubjectFocusSeconds } from "./focusSession";
import { getSubjectCompletedModuleCount } from "./selectors";
import type { SubjectRecord, UniGameSaveData } from "../types/domain";

export const POINTS_PER_SPRINT = 10;
export const POINTS_PER_MODULE = 5;
export const POINTS_PER_ASSESSMENT = 15;
export const POINTS_PER_VISIT_DAY = 2;
export const POINTS_PER_STREAK_MILESTONE = 5;
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

/** Level thresholds in points; index = level. Level range: 1–5. */
export const LEVEL_THRESHOLDS = [0, 25, 70, 140, 240] as const;

export const LEVEL_NAMES = ["New", "Familiar", "Supportive", "Trusted", "Inspired"] as const;

export interface MentorRelationship {
  subjectId: string;
  points: number;
  /** 1-based level (1..5). */
  level: number;
  levelName: (typeof LEVEL_NAMES)[number];
  /** Points into the current level / points needed for the next (null at max). */
  progress: { current: number; needed: number } | null;
  /** Real inputs behind the points, for the mentor profile display. */
  stats: {
    sprints: number;
    focusMinutes: number;
    modulesCompleted: number;
    assessmentsSubmitted: number;
    visitDays: number;
  };
}

export function computeMentorRelationship(
  save: UniGameSaveData,
  subject: SubjectRecord
): MentorRelationship {
  const sprints = getCountedSessions(save).filter((s) => s.subjectId === subject.id).length;
  const modulesCompleted = getSubjectCompletedModuleCount(save.tasks, subject);
  const assessmentIds = new Set(subject.assessments.map((a) => a.id));
  const assessmentsSubmitted = save.assessmentProgress.filter(
    (p) => assessmentIds.has(p.assessmentId) && (p.status === "submitted" || p.status === "graded")
  ).length;
  const visitDays = save.mentorBonds[subject.id]?.visitDays ?? 0;
  const streakMilestones = STREAK_MILESTONES.filter(
    (milestone) => save.userProgress.longestStreak >= milestone
  ).length;

  const points =
    sprints * POINTS_PER_SPRINT +
    modulesCompleted * POINTS_PER_MODULE +
    assessmentsSubmitted * POINTS_PER_ASSESSMENT +
    visitDays * POINTS_PER_VISIT_DAY +
    streakMilestones * POINTS_PER_STREAK_MILESTONE;

  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const progress =
    level >= LEVEL_THRESHOLDS.length
      ? null
      : {
          current: points - LEVEL_THRESHOLDS[level - 1],
          needed: LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level - 1],
        };

  return {
    subjectId: subject.id,
    points,
    level,
    levelName: LEVEL_NAMES[level - 1],
    progress,
    stats: {
      sprints,
      focusMinutes: Math.floor(getSubjectFocusSeconds(save, subject.id) / 60),
      modulesCompleted,
      assessmentsSubmitted,
      visitDays,
    },
  };
}

/**
 * Level-gated mentor greeting additions. Facts only — every number comes
 * from the relationship's real stats.
 */
export function getRelationshipLine(relationship: MentorRelationship): string | null {
  const { level, stats } = relationship;
  if (level >= 4 && stats.focusMinutes > 0) {
    return `We've logged ${formatMinutes(stats.focusMinutes)} together across ${stats.sprints} session${stats.sprints === 1 ? "" : "s"} — proud of this room.`;
  }
  if (level >= 3 && stats.sprints > 0) {
    return `${stats.sprints} focus session${stats.sprints === 1 ? "" : "s"} in this room so far — it's becoming a habit.`;
  }
  if (level >= 2 && stats.visitDays > 1) {
    return `Good to see you back — ${stats.visitDays} days you've dropped in now.`;
  }
  return null;
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
