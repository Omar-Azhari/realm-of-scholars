/**
 * Room evolution — THE dedicated configuration for how rooms grow with real
 * progress. Stage VISUALS (prop images, extra lights, ambience) are declared
 * per room in public/assets/manifest.json under `evolution.stages`; this
 * module owns only the thresholds and the stage computation.
 *
 * Stage score (all real, per subject):
 *   score = completedModules
 *         + 2 × assessments submitted/graded
 *         + 1 per full hour of counted focus time
 *         + mentor relationship level
 *
 * Stages:
 *   0 — fresh room (base background only)
 *   1 — score ≥ 3   (books, pinned notes, active wall display)
 *   2 — score ≥ 8   (second monitor, coffee mug, busier noticeboard)
 *   3 — score ≥ 15  (trophies, project props, improved lighting)
 *   4 — ALL modules complete AND every assessment submitted/graded
 *       (subject-completion decorations + celebration lighting) — stage 4 is
 *       never reached by score alone; completion states are real, not
 *       invented.
 */

import { computeMentorRelationship } from "./mentorRelationship";
import { getSubjectFocusSeconds } from "./focusSession";
import { getSubjectCompletedModuleCount } from "./selectors";
import type { SubjectRecord, UniGameSaveData } from "../types/domain";

export const STAGE_THRESHOLDS = [0, 3, 8, 15] as const;
export const MAX_STAGE = 4;

export interface RoomEvolutionState {
  stage: number;
  score: number;
  /** Score still needed for the next stage; null at stage 3+ (stage 4 is completion-gated). */
  nextStageAt: number | null;
  subjectComplete: boolean;
}

export function computeRoomEvolution(save: UniGameSaveData, subject: SubjectRecord): RoomEvolutionState {
  const modules = getSubjectCompletedModuleCount(save.tasks, subject);
  const assessmentIds = new Set(subject.assessments.map((a) => a.id));
  const submitted = save.assessmentProgress.filter(
    (p) => assessmentIds.has(p.assessmentId) && (p.status === "submitted" || p.status === "graded")
  ).length;
  const focusHours = Math.floor(getSubjectFocusSeconds(save, subject.id) / 3600);
  const relationshipLevel = computeMentorRelationship(save, subject).level;

  const score = modules + 2 * submitted + focusHours + relationshipLevel;

  const subjectComplete =
    subject.modules.length > 0 &&
    modules === subject.modules.length &&
    subject.assessments.length > 0 &&
    submitted === subject.assessments.length;

  let stage = 0;
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (score >= STAGE_THRESHOLDS[i]) {
      stage = i;
      break;
    }
  }
  if (subjectComplete) stage = MAX_STAGE;

  return {
    stage,
    score,
    nextStageAt: stage < STAGE_THRESHOLDS.length - 1 ? STAGE_THRESHOLDS[stage + 1] : null,
    subjectComplete,
  };
}
