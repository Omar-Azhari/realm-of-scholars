/**
 * Phase 22 Part 2 "Confidence Model" — a per-subject, 5-tier academic-
 * readiness estimate (Very Low/Low/Developing/Strong/Excellent). Entirely
 * deterministic, built ONLY from data already in the save: study frequency,
 * completed modules, assessment completion, mentor interactions, recent
 * consistency, and room progression. Never invents a grade or predicts a
 * mark — the score is an internal 0-100 weighting used only to pick a
 * tier, never displayed as a percentage or shown to the player directly.
 *
 * Deliberately distinct from `simulation.ts`'s `SubjectSimState.confidence`
 * (a short-term, 0-100 MOOD input — "how does the character feel right
 * now," derived from module progress + a 7-day completion window, feeding
 * the room's mood/ambience) — this is a longer-horizon READINESS estimate
 * that also weighs mentor relationship level and room-evolution stage,
 * neither of which `sim.confidence` considers. Both coexist, same
 * discipline `academicWorkload.ts` already documents for its own
 * WorkloadLevel vs. `sim.workload`: reuse `sim.confidence` as ONE input
 * here (module progress + recent momentum), never recompute it.
 */

import { computeSubjectSimState } from "../lib/simulation";
import { computeMentorRelationship } from "../lib/mentorRelationship";
import { computeRoomEvolution, MAX_STAGE } from "../lib/roomEvolution";
import type { PriorityReason } from "../lib/priority";
import type { SubjectRecord, UniGameSaveData } from "../types/domain";

export type ConfidenceLevel = "very-low" | "low" | "developing" | "strong" | "excellent";

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  "very-low": "Very Low",
  low: "Low",
  developing: "Developing",
  strong: "Strong",
  excellent: "Excellent",
};

/** Checked high to low; first threshold the score clears wins — same shape as priority.ts's own level ladder. */
const LEVEL_THRESHOLDS: ReadonlyArray<{ level: ConfidenceLevel; min: number }> = [
  { level: "excellent", min: 80 },
  { level: "strong", min: 60 },
  { level: "developing", min: 40 },
  { level: "low", min: 20 },
  { level: "very-low", min: 0 },
];

/**
 * Maps any 0-100 score onto the same 5-tier ladder (Very Low..Excellent).
 * Exported so `RecommendationEngine.ts` can reuse the identical bucketing
 * for its own "how strong is the evidence for this suggestion" confidence
 * — a different score, the same tier vocabulary and thresholds, rather
 * than a second copy of these 5 numbers drifting apart from this one.
 */
export function levelFromScore(score: number): ConfidenceLevel {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return "very-low";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface SubjectConfidence {
  subjectId: string;
  level: ConfidenceLevel;
  label: string;
  /** Internal 0-100 weighting used only to pick `level` — never shown to the player as a percentage, grade, or predicted mark. */
  score: number;
  /** Same shape as `priority.ts`'s `PriorityReason` — an honest, additive breakdown, reused (not duplicated) for Part 8's explanation system. */
  factors: PriorityReason[];
}

/**
 * One subject's confidence estimate. Every factor traces to an existing
 * engine — nothing here is a new academic claim:
 *  - module progress + recent momentum: `sim.confidence` (simulation.ts, reused verbatim)
 *  - assessment completion: submitted/graded ratio over this subject's own assessments
 *  - mentor interactions/consistency: `computeMentorRelationship(...).level` (mentorRelationship.ts)
 *  - room progression: `computeRoomEvolution(...).stage` (roomEvolution.ts)
 */
export function computeSubjectConfidence(save: UniGameSaveData, subject: SubjectRecord): SubjectConfidence {
  const sim = computeSubjectSimState(subject, save.tasks, save.assessmentProgress);
  const relationship = computeMentorRelationship(save, subject);
  const roomEvolution = computeRoomEvolution(save, subject);

  const assessmentIds = new Set(subject.assessments.map((a) => a.id));
  const totalAssessments = subject.assessments.length;
  const completedAssessments = save.assessmentProgress.filter(
    (p) => assessmentIds.has(p.assessmentId) && (p.status === "submitted" || p.status === "graded")
  ).length;
  const assessmentRatio = totalAssessments === 0 ? 0 : completedAssessments / totalAssessments;

  const moduleProgressContribution = sim.confidence * 0.35;
  const assessmentContribution = assessmentRatio * 30;
  const mentorContribution = ((relationship.level - 1) / 4) * 20;
  const roomContribution = (roomEvolution.stage / MAX_STAGE) * 15;

  const score = clamp(moduleProgressContribution + assessmentContribution + mentorContribution + roomContribution, 0, 100);
  const level = levelFromScore(score);

  const factors: PriorityReason[] = [
    { label: "Module progress & recent momentum", contribution: Math.round(moduleProgressContribution), max: 35 },
    { label: `Assessments completed (${completedAssessments}/${totalAssessments})`, contribution: Math.round(assessmentContribution), max: 30 },
    { label: `Mentor bond level ${relationship.level}/5`, contribution: Math.round(mentorContribution), max: 20 },
    { label: `Room stage ${roomEvolution.stage}/${MAX_STAGE}`, contribution: Math.round(roomContribution), max: 15 },
  ];

  return { subjectId: subject.id, level, label: CONFIDENCE_LEVEL_LABELS[level], score: Math.round(score), factors };
}

/** Every subject's confidence estimate, in the subject's own semester order. */
export function computeAllSubjectConfidence(save: UniGameSaveData): SubjectConfidence[] {
  return save.semester.subjects.map((subject) => computeSubjectConfidence(save, subject));
}
