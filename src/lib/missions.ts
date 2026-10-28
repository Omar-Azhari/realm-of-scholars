/**
 * Weekly Mission Generator — turns real progress data into a short, concrete
 * to-do list. Missions are always generated fresh from `tasks` and
 * `semester.subjects` (never persisted), so completing the underlying module
 * review/completion or assessment confirmation elsewhere in the app is
 * automatically reflected here — there is no separate "mission complete"
 * flag to fall out of sync.
 *
 * Only three mission kinds exist, each backed by a real, already-tracked
 * signal: completing a module, reviewing a module (opening its detail panel
 * for the first time), and confirming a NEEDS_CONFIRMATION assessment field.
 * A generic "study for N minutes" mission was deliberately left out — there
 * is no timer/session-tracking feature yet (that's Focus Sprint, a later
 * mini-game), and faking a completable-but-unverifiable mission would break
 * the "never invent" rule this project has followed since Phase 1.
 */

import { computeModulePriorities, computeAssessmentPriorities } from "./priority";
import type { SubjectRecord, TaskRecord } from "../types/domain";

export type MissionKind = "complete_module" | "review_module" | "confirm_assessment";

export interface Mission {
  id: string;
  kind: MissionKind;
  title: string;
  subjectId: string;
  subjectName: string;
  completed: boolean;
}

const RECENT_DAYS = 7;
const MAX_MISSIONS = 8;

/**
 * Up to MAX_MISSIONS missions: modules completed or reviewed in the last
 * RECENT_DAYS days (shown as done, so "progress" is meaningful rather than
 * trivially 0), plus the next actionable incomplete modules and any
 * NEEDS_CONFIRMATION assessments, ranked by the Priority Engine.
 */
export function getWeeklyMissions(
  subjects: SubjectRecord[],
  tasks: TaskRecord[],
  now: Date = new Date()
): Mission[] {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const cutoff = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const missions: Mission[] = [];
  const seenModuleIds = new Set<string>();

  const modulePriorities = [...computeModulePriorities(tasks, subjects)].sort(
    (a, b) => b.score - a.score
  );

  // Recently completed or reviewed modules — included so weekly progress
  // reflects real completed work, not just a perpetually-empty pending list.
  for (const mp of modulePriorities) {
    const task = tasks.find((t) => t.linkedModuleId === mp.moduleId);
    if (!task) continue;
    const subject = subjectsById.get(mp.subjectId);
    const module = subject?.modules.find((m) => m.id === mp.moduleId);
    if (!subject || !module) continue;

    const completedRecently =
      task.completed && task.completedAt && new Date(task.completedAt).getTime() >= cutoff;
    const reviewedRecently =
      !task.completed && task.reviewedAt && new Date(task.reviewedAt).getTime() >= cutoff;

    if (completedRecently) {
      missions.push({
        id: `mission-complete-${module.id}`,
        kind: "complete_module",
        title: `Complete: ${module.title}`,
        subjectId: subject.id,
        subjectName: subject.name,
        completed: true,
      });
      seenModuleIds.add(module.id);
    } else if (reviewedRecently) {
      missions.push({
        id: `mission-review-${module.id}`,
        kind: "review_module",
        title: `Review: ${module.title}`,
        subjectId: subject.id,
        subjectName: subject.name,
        completed: true,
      });
      seenModuleIds.add(module.id);
    }
  }

  // Next actionable (unblocked, incomplete) modules — pending "complete" missions.
  for (const mp of modulePriorities) {
    if (missions.length >= MAX_MISSIONS) break;
    if (mp.completed || mp.blockedByCount > 0 || seenModuleIds.has(mp.moduleId)) continue;
    const subject = subjectsById.get(mp.subjectId);
    const module = subject?.modules.find((m) => m.id === mp.moduleId);
    if (!subject || !module) continue;

    missions.push({
      id: `mission-complete-${module.id}`,
      kind: "complete_module",
      title: `Complete: ${module.title}`,
      subjectId: subject.id,
      subjectName: subject.name,
      completed: false,
    });
    seenModuleIds.add(module.id);
  }

  // Unreviewed modules — pending "review" missions.
  for (const task of tasks) {
    if (missions.length >= MAX_MISSIONS) break;
    if (!task.linkedModuleId || task.reviewedAt || task.completed || seenModuleIds.has(task.linkedModuleId)) {
      continue;
    }
    let found = false;
    for (const subject of subjects) {
      const module = subject.modules.find((m) => m.id === task.linkedModuleId);
      if (module) {
        missions.push({
          id: `mission-review-${module.id}`,
          kind: "review_module",
          title: `Review: ${module.title}`,
          subjectId: subject.id,
          subjectName: subject.name,
          completed: false,
        });
        seenModuleIds.add(module.id);
        found = true;
        break;
      }
    }
    if (found) continue;
  }

  // NEEDS_CONFIRMATION assessments — pending "confirm" missions, highest priority first.
  const assessmentPriorities = [...computeAssessmentPriorities(subjects, now)]
    .filter((ap) => ap.level !== "low")
    .sort((a, b) => b.score - a.score);

  for (const ap of assessmentPriorities) {
    if (missions.length >= MAX_MISSIONS) break;
    const subject = subjectsById.get(ap.subjectId);
    const assessment = subject?.assessments.find((a) => a.id === ap.assessmentId);
    if (!subject || !assessment || assessment.confirmationStatus === "confirmed") continue;

    missions.push({
      id: `mission-confirm-${assessment.id}`,
      kind: "confirm_assessment",
      title: `Confirm details: ${assessment.title}`,
      subjectId: subject.id,
      subjectName: subject.name,
      completed: false,
    });
  }

  return missions.slice(0, MAX_MISSIONS);
}

export interface WeeklyMissionProgress {
  completed: number;
  total: number;
}

export function getWeeklyMissionProgress(missions: Mission[]): WeeklyMissionProgress {
  return { completed: missions.filter((m) => m.completed).length, total: missions.length };
}
