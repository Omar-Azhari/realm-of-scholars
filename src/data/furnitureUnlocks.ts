/**
 * Furniture unlock evaluation (Phase 20D, Part 6 — "furniture unlocks from
 * XP, Achievements, Study streaks, Semester milestones, Special events...
 * nothing affects grades, everything is cosmetic").
 *
 * Unlocks are checked against real, already-tracked signals and then
 * stored permanently in `RoomCustomisation.unlockedFurnitureIds` (see
 * `coerceRoomCustomisation` in persistence.ts) rather than recomputed live
 * like achievements are — a later streak reset must not retract an
 * already-earned unlock. `minStreak` requirements therefore read
 * `longestStreak`, the same permanent, non-decreasing signal the
 * `seven-day-streak`/`thirty-day-streak` achievements already use, not the
 * resettable `streakCount`.
 */

import type { UniGameSaveData } from "../types/domain";
import { FURNITURE_CATALOGUE, type FurnitureItem, type UnlockRequirement } from "./furnitureCatalogue";
import { getAchievementStatuses } from "../lib/achievements";

export function isUnlockRequirementMet(requirement: UnlockRequirement, saveData: UniGameSaveData): boolean {
  switch (requirement.type) {
    case "starter":
      return true;
    case "xp":
      return saveData.userProgress.xp >= requirement.minXp;
    case "level":
      return saveData.userProgress.level >= requirement.minLevel;
    case "streak":
      return saveData.userProgress.longestStreak >= requirement.minStreak;
    case "achievement":
      return getAchievementStatuses(saveData).some(
        (status) => status.definition.id === requirement.achievementId && status.unlocked
      );
  }
}

/**
 * Returns the full set of furniture ids that should be permanently
 * unlocked given `current` plus whatever now newly qualifies. Returns the
 * exact same array instance when nothing changed, matching the
 * `syncMilestones`/`syncAutoReminders` convergence pattern in
 * SaveDataContext (an effect can depend on the result without looping).
 */
export function syncFurnitureUnlocks(current: string[], saveData: UniGameSaveData): string[] {
  const unlocked = new Set(current);
  let changed = false;
  for (const item of FURNITURE_CATALOGUE) {
    if (unlocked.has(item.id)) continue;
    if (isUnlockRequirementMet(item.unlockRequirement, saveData)) {
      unlocked.add(item.id);
      changed = true;
    }
  }
  return changed ? Array.from(unlocked) : current;
}

export interface RoomUnlockProgress {
  unlockedCount: number;
  totalCount: number;
  /** The locked item the player is proportionally closest to unlocking, by whichever numeric signal its requirement uses — `null` once nothing measurable remains locked (only achievement-gated items left, or everything unlocked). */
  nextItem: FurnitureItem | null;
  /** 0-1, how close `nextItem` is to unlocking. 0 when `nextItem` is null. */
  nextItemProgress: number;
}

/**
 * Phase 20E, Part 4 "room unlock progress" — reused by both the Daily
 * Brief panel and the mentor's contextual advice (npcGreetings.ts), so
 * "which item is closest" is computed in exactly one place.
 */
export function getRoomUnlockProgress(saveData: UniGameSaveData): RoomUnlockProgress {
  const unlockedIds = new Set(saveData.playerIdentity?.roomCustomisation.unlockedFurnitureIds ?? []);
  const totalCount = FURNITURE_CATALOGUE.length;
  const unlockedCount = FURNITURE_CATALOGUE.filter((item) => unlockedIds.has(item.id)).length;

  const candidates = FURNITURE_CATALOGUE.filter(
    (item) => !unlockedIds.has(item.id) && item.unlockRequirement.type !== "starter" && item.unlockRequirement.type !== "achievement"
  );
  if (candidates.length === 0) return { unlockedCount, totalCount, nextItem: null, nextItemProgress: 0 };

  const progress = (item: FurnitureItem): number => {
    const req = item.unlockRequirement;
    if (req.type === "xp") return saveData.userProgress.xp / req.minXp;
    if (req.type === "level") return saveData.userProgress.level / req.minLevel;
    if (req.type === "streak") return saveData.userProgress.longestStreak / req.minStreak;
    return 0;
  };
  const nextItem = [...candidates].sort((a, b) => progress(b) - progress(a))[0];
  return { unlockedCount, totalCount, nextItem, nextItemProgress: Math.min(1, progress(nextItem)) };
}
