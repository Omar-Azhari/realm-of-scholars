/**
 * Phase 22 Part 1 "Context Engine" — the single place a complete snapshot
 * of the student's current state is assembled. Every field is composed
 * from an EXISTING engine (`mentorRelationship.ts`, `simulation.ts`,
 * `semesterCalendar.ts`, `roomEvolution.ts`, `furnitureUnlocks.ts`,
 * `focusSession.ts`, `achievements.ts`, `academicWorkload.ts`,
 * `academicRoadmap.ts`, `campusMap.ts`, and Phase 22's own
 * `ConfidenceModel.ts`) — nothing here re-derives a number a prior engine
 * already computes. `RecommendationEngine.ts`, `ReflectionEngine.ts`,
 * `GoalSystem.ts`, and `MentorPlanner.ts` all consume THIS object rather
 * than reading `UniGameSaveData` directly, so every AI Mentor surface
 * agrees on "what's true right now."
 *
 * `buildStudentContext` is a pure function; its result is frozen
 * (top-level `Object.freeze`) as a literal, lightweight enforcement of
 * "output a single immutable Context object" — every nested array/object
 * is still a freshly-built value each call (never a reference into the
 * save itself), so nothing here can be accidentally mutated back into the
 * save.
 */

import { computeMentorRelationship, type MentorRelationship } from "../lib/mentorRelationship";
import { computeSubjectSimState, type MoodBucket } from "../lib/simulation";
import { getSemesterCalendar, type SemesterEra, type SemesterPeriod } from "../lib/semesterCalendar";
import { getOverallModuleProgress, getSubjectCompletedModuleCount, getMelbourneDateTimeKey, daysBetweenDateIso } from "../lib/selectors";
import { getRoomUnlockProgress, type RoomUnlockProgress } from "../data/furnitureUnlocks";
import { getCountedSessions } from "../lib/focusSession";
import { getAchievementStatuses } from "../lib/achievements";
import { buildAcademicRoadmap } from "../lib/academicRoadmap";
import { computeWeeklyWorkload, type WorkloadLevel } from "../lib/academicWorkload";
import { getFavouriteBuildings, type FavouriteBuilding } from "../game3d/campus/campusMap";
import { computeSubjectConfidence, type SubjectConfidence } from "./ConfidenceModel";
import type { MilestoneEntry, NpcMemoryEntry, SubjectRecord, UniGameSaveData } from "../types/domain";

export interface SubjectStudentContext {
  subjectId: string;
  subjectName: string;
  relationship: MentorRelationship;
  confidence: SubjectConfidence;
  completedModules: number;
  totalModules: number;
  completedAssessments: number;
  totalAssessments: number;
  /** Minutes of Focus Sprint time logged against this subject in the last 7 days — the "study frequency" signal. */
  focusMinutesLast7Days: number;
  mood: MoodBucket;
  /** Per-subject 0-100 workload signal (`simulation.ts`) — distinct from the whole-semester per-week `WorkloadLevel` below (see `academicWorkload.ts`'s own doc comment for why the two never merge). */
  subjectWorkload: number;
}

export interface OverdueAssessmentContext {
  subjectId: string;
  subjectName: string;
  assessmentId: string;
  title: string;
  daysOverdue: number;
}

export interface UpcomingAssessmentContext {
  subjectId: string;
  subjectName: string;
  assessmentId: string;
  title: string;
  daysUntilDue: number;
}

export interface RecentAchievementContext {
  id: string;
  title: string;
  at: string;
}

export interface StudentContext {
  generatedAt: string;
  semester: {
    period: SemesterPeriod | null;
    currentWeek: number | null;
    totalTeachingWeeks: number;
    era: SemesterEra;
    overallProgress: { completed: number; total: number; percent: number };
  };
  subjects: SubjectStudentContext[];
  overdueAssessments: OverdueAssessmentContext[];
  upcomingAssessments: UpcomingAssessmentContext[];
  streak: { current: number; longest: number; lastActiveDate: string | null };
  favouriteBuildings: FavouriteBuilding[];
  buildingVisitHistory: Record<string, { visitDays: number; lastVisitDate: string | null }>;
  roomUnlockProgress: RoomUnlockProgress;
  achievements: { unlockedCount: number; totalCount: number; recent: RecentAchievementContext[] };
  npcInteractions: Record<string, NpcMemoryEntry>;
  journalMilestones: MilestoneEntry[];
  /** Current teaching week's workload level — null when the semester start date isn't confirmed yet (no fabricated week number). */
  workloadLevel: WorkloadLevel | null;
}

function buildSubjectContext(save: UniGameSaveData, subject: SubjectRecord, now: Date): SubjectStudentContext {
  const relationship = computeMentorRelationship(save, subject);
  const confidence = computeSubjectConfidence(save, subject);
  const sim = computeSubjectSimState(subject, save.tasks, save.assessmentProgress);

  const assessmentIds = new Set(subject.assessments.map((a) => a.id));
  const completedAssessments = save.assessmentProgress.filter(
    (p) => assessmentIds.has(p.assessmentId) && (p.status === "submitted" || p.status === "graded")
  ).length;

  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const focusSecondsLast7Days = getCountedSessions(save)
    .filter((session) => session.subjectId === subject.id && new Date(session.startedAt).getTime() >= sevenDaysAgo)
    .reduce((sum, session) => sum + session.elapsedFocusSeconds, 0);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    relationship,
    confidence,
    completedModules: getSubjectCompletedModuleCount(save.tasks, subject),
    totalModules: subject.modules.length,
    completedAssessments,
    totalAssessments: subject.assessments.length,
    focusMinutesLast7Days: Math.floor(focusSecondsLast7Days / 60),
    mood: sim.mood,
    subjectWorkload: sim.workload,
  };
}

/** Confirmed due date/time in the past AND not yet submitted/graded — distinct from `priority.ts`'s `overdue` flag, which doesn't check submission status (that engine ranks EVERY assessment, submitted or not, for its own purpose). */
function buildOverdueAssessments(save: UniGameSaveData, now: Date): OverdueAssessmentContext[] {
  const nowKey = getMelbourneDateTimeKey(now);
  const results: OverdueAssessmentContext[] = [];
  for (const subject of save.semester.subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime } = assessment;
      if (dueDate.status !== "confirmed" || dueTime.status !== "confirmed" || !dueDate.value || !dueTime.value) continue;
      const dueKey = `${dueDate.value}T${dueTime.value}`;
      if (dueKey >= nowKey) continue;
      const progress = save.assessmentProgress.find((p) => p.assessmentId === assessment.id);
      if (progress && (progress.status === "submitted" || progress.status === "graded")) continue;
      results.push({
        subjectId: subject.id,
        subjectName: subject.name,
        assessmentId: assessment.id,
        title: assessment.title,
        daysOverdue: Math.max(0, daysBetweenDateIso(dueDate.value, nowKey)),
      });
    }
  }
  return results.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Confirmed due date/time in the future, soonest first — same confirmed-only rule as `selectors.ts`'s `getUpcomingDeadlines`, phrased with a days-until figure for direct use in recommendations/dialogue. */
function buildUpcomingAssessments(save: UniGameSaveData, now: Date): UpcomingAssessmentContext[] {
  const nowKey = getMelbourneDateTimeKey(now);
  const results: UpcomingAssessmentContext[] = [];
  for (const subject of save.semester.subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime } = assessment;
      if (dueDate.status !== "confirmed" || dueTime.status !== "confirmed" || !dueDate.value || !dueTime.value) continue;
      const dueKey = `${dueDate.value}T${dueTime.value}`;
      if (dueKey < nowKey) continue;
      results.push({
        subjectId: subject.id,
        subjectName: subject.name,
        assessmentId: assessment.id,
        title: assessment.title,
        daysUntilDue: Math.max(0, daysBetweenDateIso(nowKey, dueDate.value)),
      });
    }
  }
  return results.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** Build the complete, immutable student-state snapshot every AI Mentor system consumes. */
export function buildStudentContext(save: UniGameSaveData, now: Date = new Date()): StudentContext {
  const calendar = getSemesterCalendar(save, now);
  const overallProgress = getOverallModuleProgress(save.tasks, save.semester.subjects);

  const roadmap = buildAcademicRoadmap(save, now);
  const weeklyWorkload = computeWeeklyWorkload(roadmap);
  const workloadLevel = calendar.currentWeek !== null ? (weeklyWorkload.find((w) => w.weekNumber === calendar.currentWeek)?.level ?? null) : null;

  const achievementStatuses = getAchievementStatuses(save);
  const recentAchievements: RecentAchievementContext[] = save.milestones
    .filter((m) => m.kind === "achievement")
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 5)
    .map((m) => ({ id: m.id, title: m.label, at: m.at }));

  const journalMilestones = [...save.milestones]
    .filter((m) => m.kind !== "achievement")
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  const context: StudentContext = {
    generatedAt: now.toISOString(),
    semester: {
      period: calendar.period,
      currentWeek: calendar.currentWeek,
      totalTeachingWeeks: calendar.totalTeachingWeeks,
      era: calendar.era,
      overallProgress,
    },
    subjects: save.semester.subjects.map((subject) => buildSubjectContext(save, subject, now)),
    overdueAssessments: buildOverdueAssessments(save, now),
    upcomingAssessments: buildUpcomingAssessments(save, now),
    streak: { current: save.userProgress.streakCount, longest: save.userProgress.longestStreak, lastActiveDate: save.userProgress.lastActiveDate },
    favouriteBuildings: getFavouriteBuildings(save, 3),
    buildingVisitHistory: { ...save.buildingVisits },
    roomUnlockProgress: getRoomUnlockProgress(save),
    achievements: { unlockedCount: achievementStatuses.filter((a) => a.unlocked).length, totalCount: achievementStatuses.length, recent: recentAchievements },
    npcInteractions: { ...save.npcMemory },
    journalMilestones,
    workloadLevel,
  };

  return Object.freeze(context);
}
