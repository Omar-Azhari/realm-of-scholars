/**
 * Milestone log — the ONLY place derived accomplishments get a timestamp.
 *
 * Locked/unlocked state is always re-derived from the save (achievements,
 * bond levels, room stages, semester completion). But a chronological
 * timeline needs to know *when* each was reached, and derivation can't
 * recover that. So the log records the first moment each milestone is
 * OBSERVED — nothing else. Removing the log loses only ordering, never
 * progress; entries whose milestone is no longer earned simply stop being
 * displayed by consumers that cross-check (state stays derived).
 */

import { getAchievementStatuses } from "./achievements";
import { computeMentorRelationship, LEVEL_NAMES } from "./mentorRelationship";
import { computeRoomEvolution } from "./roomEvolution";
import { isSemesterComplete } from "./semesterCalendar";
import type { MilestoneEntry, UniGameSaveData } from "../types/domain";

/**
 * Returns the milestone list with any newly-observed milestones appended
 * (stamped `now`). Existing entries are never modified or re-stamped.
 * Returns the SAME array reference when nothing new was observed, so the
 * provider's sync effect converges instead of looping.
 */
export function syncMilestones(save: UniGameSaveData, now: Date = new Date()): MilestoneEntry[] {
  const have = new Set(save.milestones.map((entry) => entry.id));
  const fresh: MilestoneEntry[] = [];
  const at = now.toISOString();
  const add = (id: string, kind: MilestoneEntry["kind"], label: string) => {
    if (!have.has(id)) fresh.push({ id, kind, label, at });
  };

  for (const status of getAchievementStatuses(save)) {
    if (status.unlocked) {
      add(`achievement:${status.definition.id}`, "achievement", status.definition.title);
    }
  }

  for (const subject of save.semester.subjects) {
    const relationship = computeMentorRelationship(save, subject);
    // Level 1 is the starting state — only levels actually earned get logged.
    for (let level = 2; level <= relationship.level; level += 1) {
      add(
        `bond:${subject.id}:${level}`,
        "bond-level",
        `${subject.name} mentor — bond level ${level} (${LEVEL_NAMES[level - 1] ?? ""})`
      );
    }
    const evolution = computeRoomEvolution(save, subject);
    for (let stage = 1; stage <= evolution.stage; stage += 1) {
      add(`stage:${subject.id}:${stage}`, "room-stage", `${subject.name} room reached stage ${stage}`);
    }
  }

  if (isSemesterComplete(save)) {
    add("semester:complete", "semester-complete", "Semester 100% complete");
  }

  return fresh.length === 0 ? save.milestones : [...save.milestones, ...fresh];
}
