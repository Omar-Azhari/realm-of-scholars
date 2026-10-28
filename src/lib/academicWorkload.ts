/**
 * Workload Level engine (Phase 19, Part 5). Per-teaching-week, categorical
 * Low/Medium/High/Peak — NEVER a fabricated hour estimate (Part 5's explicit
 * instruction). This is a RELATIVE ranking across the user's own weeks, not
 * an absolute effort measurement: the same inputs (assessment count/
 * weighting/reading volume/module count/deadline spacing) score differently
 * depending on how heavy the user's OTHER weeks are.
 *
 * Deliberately distinct from `simulation.ts`'s `SubjectSimState.workload`
 * (a PER-SUBJECT, PER-ROOM numeric signal driving mood/room ambience) — this
 * is a PER-WEEK, whole-semester signal for planning (the Academic Roadmap,
 * Study Planner, Today Engine). Neither reads nor overwrites the other; see
 * docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §1.
 */

import type { AcademicRoadmap, WeekRoadmapEntry } from "./academicRoadmap";

export type WorkloadLevel = "low" | "medium" | "high" | "peak";

export interface WeekWorkload {
  weekNumber: number;
  level: WorkloadLevel;
  assessmentCount: number;
  readingCount: number;
  moduleCount: number;
}

interface ScoredWeek {
  weekNumber: number;
  score: number;
  assessmentCount: number;
  readingCount: number;
  moduleCount: number;
}

function rawScore(week: WeekRoadmapEntry, totalWeighting: number): number {
  return week.assessmentsDue.length * 25 + totalWeighting * 0.5 + week.readings.length * 3 + week.modules.length * 5;
}

/**
 * Categorises every teaching week's workload RELATIVE to the others in the
 * same roadmap. `assessmentRoadmap` supplies each assessment's confirmed
 * weighting (not tracked on WeekRoadmapEntry itself, since weighting
 * belongs to the assessment, not the week) — weeks with zero explainable
 * signal (no assessments, no readings, no modules) always score "low",
 * never inflated by clustering alone.
 */
export function computeWeeklyWorkload(roadmap: AcademicRoadmap): WeekWorkload[] {
  const weightingByAssessmentId = new Map(
    roadmap.assessmentRoadmap.map((a) => [a.assessmentId, a] as const)
  );

  const scored: ScoredWeek[] = roadmap.weeks.map((week) => {
    const totalWeighting = week.assessmentsDue.reduce((sum, a) => {
      const entry = weightingByAssessmentId.get(a.assessmentId);
      return sum + (entry?.weighting ?? 0);
    }, 0);
    return {
      weekNumber: week.weekNumber,
      score: rawScore(week, totalWeighting),
      assessmentCount: week.assessmentsDue.length,
      readingCount: week.readings.length,
      moduleCount: week.modules.length,
    };
  });

  const nonZeroScores = scored.map((s) => s.score).filter((s) => s > 0).sort((a, b) => a - b);
  if (nonZeroScores.length === 0) {
    return scored.map((s) => ({ weekNumber: s.weekNumber, level: "low", assessmentCount: s.assessmentCount, readingCount: s.readingCount, moduleCount: s.moduleCount }));
  }

  const quantile = (p: number): number => {
    const index = Math.min(nonZeroScores.length - 1, Math.floor(p * (nonZeroScores.length - 1)));
    return nonZeroScores[index];
  };
  const q50 = quantile(0.5);
  const q80 = quantile(0.8);
  const maxScore = nonZeroScores[nonZeroScores.length - 1];

  // Clustering: a week adjacent to another heavy week is bumped toward
  // "peak" rather than just "high" — deadline pressure compounds when it's
  // back-to-back, which is exactly Part 5's "spacing" requirement.
  const scoreByWeek = new Map(scored.map((s) => [s.weekNumber, s.score]));
  return scored.map((s) => {
    if (s.score === 0) {
      return { weekNumber: s.weekNumber, level: "low" as WorkloadLevel, assessmentCount: s.assessmentCount, readingCount: s.readingCount, moduleCount: s.moduleCount };
    }
    const prevScore = scoreByWeek.get(s.weekNumber - 1) ?? 0;
    const nextScore = scoreByWeek.get(s.weekNumber + 1) ?? 0;
    const adjacentHeavy = prevScore >= q80 || nextScore >= q80;

    let level: WorkloadLevel;
    if (s.score >= maxScore && (s.score > q80 || adjacentHeavy)) level = "peak";
    else if (s.score >= q80) level = adjacentHeavy ? "peak" : "high";
    else if (s.score >= q50) level = "medium";
    else level = "low";

    return { weekNumber: s.weekNumber, level, assessmentCount: s.assessmentCount, readingCount: s.readingCount, moduleCount: s.moduleCount };
  });
}
