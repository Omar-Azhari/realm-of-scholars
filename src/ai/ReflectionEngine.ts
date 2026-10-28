/**
 * Phase 22 Part 5 "Reflection Engine" — weekly, supportive, evidence-backed
 * reflections comparing a rolling 7-day window ("this week") against the
 * 7 days before it ("last week"). Every statement traces to real save
 * data (`completedFocusSessions`, the new `buildingVisitLog` — Part 5's
 * own "visited the Library five times" needs day-level history that
 * `buildingVisits`' lifetime counter alone can't answer — and
 * `assessmentProgress`). "Never shame the player": a statement is only
 * generated for a neutral-to-positive observation (consistency held or
 * improved, a real visit/assessment count, a genuine routine leader) —
 * a declining metric simply produces no comparison statement, rather than
 * a discouraging one.
 */

import { getCountedSessions } from "../lib/focusSession";
import { getMelbourneDateTimeKey } from "../lib/selectors";
import { getCampusLocationMeta } from "../game3d/campus/campusMap";
import type { PriorityReason } from "../lib/priority";
import type { StudentContext } from "./ContextEngine";
import type { CampusSceneId } from "../world/worldTypes";
import type { UniGameSaveData } from "../types/domain";

export type ReflectionCategory = "consistency" | "building-visits" | "subject-routine" | "assessments";

export interface ReflectionStatement {
  id: string;
  category: ReflectionCategory;
  text: string;
  evidence: PriorityReason[];
}

export interface WeeklyReflection {
  thisWeekStartIso: string;
  lastWeekStartIso: string;
  statements: ReflectionStatement[];
}

function dayKey(iso: string): string {
  return getMelbourneDateTimeKey(new Date(iso)).slice(0, 10);
}

function distinctDaysInWindow(dates: string[], windowStartMs: number, windowEndMs: number): number {
  const days = new Set<string>();
  for (const iso of dates) {
    const t = new Date(iso).getTime();
    if (t >= windowStartMs && t < windowEndMs) days.add(dayKey(iso));
  }
  return days.size;
}

function consistencyStatement(save: UniGameSaveData, now: Date): ReflectionStatement | null {
  const nowMs = now.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sessionDates = getCountedSessions(save).map((s) => s.startedAt);

  const thisWeekDays = distinctDaysInWindow(sessionDates, nowMs - 7 * oneDayMs, nowMs);
  const lastWeekDays = distinctDaysInWindow(sessionDates, nowMs - 14 * oneDayMs, nowMs - 7 * oneDayMs);

  if (thisWeekDays === 0) return null;
  if (lastWeekDays === 0) {
    return {
      id: "consistency",
      category: "consistency",
      text: `You started building a study routine this week — active on ${thisWeekDays} day${thisWeekDays === 1 ? "" : "s"}.`,
      evidence: [{ label: `${thisWeekDays} active day${thisWeekDays === 1 ? "" : "s"} this week`, contribution: thisWeekDays, max: 7 }],
    };
  }
  if (thisWeekDays > lastWeekDays) {
    return {
      id: "consistency",
      category: "consistency",
      text: "This week you studied more consistently than last week.",
      evidence: [
        { label: `This week: ${thisWeekDays} active day${thisWeekDays === 1 ? "" : "s"}`, contribution: thisWeekDays, max: 7 },
        { label: `Last week: ${lastWeekDays} active day${lastWeekDays === 1 ? "" : "s"}`, contribution: lastWeekDays, max: 7 },
      ],
    };
  }
  if (thisWeekDays === lastWeekDays) {
    return {
      id: "consistency",
      category: "consistency",
      text: `You kept up the same steady pace as last week — active ${thisWeekDays} day${thisWeekDays === 1 ? "" : "s"} both weeks.`,
      evidence: [{ label: `${thisWeekDays} active days, both weeks`, contribution: thisWeekDays, max: 7 }],
    };
  }
  // Declined week-over-week — no shaming comparison statement; simply omitted.
  return null;
}

function buildingVisitStatement(save: UniGameSaveData, now: Date): ReflectionStatement | null {
  const nowMs = now.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const windowStart = nowMs - 7 * oneDayMs;

  const countsThisWeek = new Map<string, number>();
  for (const entry of save.buildingVisitLog) {
    const t = new Date(`${entry.dateIso}T12:00:00.000Z`).getTime();
    if (t < windowStart || t > nowMs) continue;
    countsThisWeek.set(entry.sceneId, (countsThisWeek.get(entry.sceneId) ?? 0) + 1);
  }
  if (countsThisWeek.size === 0) return null;

  let topSceneId = "";
  let topCount = 0;
  for (const [sceneId, count] of countsThisWeek) {
    if (count > topCount) {
      topSceneId = sceneId;
      topCount = count;
    }
  }
  const label = getCampusLocationMeta(topSceneId as CampusSceneId)?.label ?? topSceneId;

  return {
    id: `building-visits-${topSceneId}`,
    category: "building-visits",
    text: `You visited the ${label} ${topCount} time${topCount === 1 ? "" : "s"} this week.`,
    evidence: [{ label: `${label}: ${topCount} visit day${topCount === 1 ? "" : "s"} this week`, contribution: topCount, max: 7 }],
  };
}

/** Only stated when there's real separation from the rest — never a coin-flip between close subjects (same discipline as `RecommendationEngine.ts`'s subject-focus rule). */
function subjectRoutineStatement(context: StudentContext): ReflectionStatement | null {
  if (context.subjects.length < 2) return null;
  const ranked = [...context.subjects].sort((a, b) => b.focusMinutesLast7Days - a.focusMinutesLast7Days);
  const [leader, runnerUp] = ranked;
  if (!leader || leader.focusMinutesLast7Days < 20) return null;
  if (runnerUp && leader.focusMinutesLast7Days - runnerUp.focusMinutesLast7Days < 15) return null;
  return {
    id: `subject-routine-${leader.subjectId}`,
    category: "subject-routine",
    text: `${leader.subjectName} is becoming your strongest routine.`,
    evidence: [{ label: `${leader.subjectName}: ${leader.focusMinutesLast7Days} min this week`, contribution: leader.focusMinutesLast7Days, max: 100 }],
  };
}

function assessmentsCompletedStatement(save: UniGameSaveData, now: Date): ReflectionStatement | null {
  const nowMs = now.getTime();
  const windowStart = nowMs - 7 * 24 * 60 * 60 * 1000;
  const count = save.assessmentProgress.filter(
    (p) =>
      (p.status === "submitted" || p.status === "graded") &&
      p.statusChangedAt !== null &&
      new Date(p.statusChangedAt).getTime() >= windowStart &&
      new Date(p.statusChangedAt).getTime() <= nowMs
  ).length;
  if (count === 0) return null;
  return {
    id: "assessments-completed",
    category: "assessments",
    text: `You completed ${count} assessment${count === 1 ? "" : "s"} this week.`,
    evidence: [{ label: `${count} submitted/graded this week`, contribution: count, max: count }],
  };
}

/** The complete weekly reflection — every statement optional, present only when this save's own data honestly supports it. */
export function generateWeeklyReflection(save: UniGameSaveData, context: StudentContext, now: Date = new Date()): WeeklyReflection {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const statements = [
    consistencyStatement(save, now),
    buildingVisitStatement(save, now),
    subjectRoutineStatement(context),
    assessmentsCompletedStatement(save, now),
  ].filter((s): s is ReflectionStatement => s !== null);

  return {
    thisWeekStartIso: new Date(now.getTime() - 7 * oneDayMs).toISOString(),
    lastWeekStartIso: new Date(now.getTime() - 14 * oneDayMs).toISOString(),
    statements,
  };
}
