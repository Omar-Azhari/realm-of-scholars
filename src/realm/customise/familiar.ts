/**
 * Familiars grow with your study. A pet from the bazaar levels up (1-5) as
 * you study weeks and finish quests, and each level adds a perk:
 *   2 — sometimes finds an extra item when you gather
 *   3 — leaves you a note each day about your next deadline (owl post)
 *   4 — +2 Focus whenever you study a waystone
 *   5 — fully grown: bigger and brighter
 */

import type { RealmState } from "../types";

export const FAMILIAR_PERKS = [
  "Keeps you company.",
  "Sometimes finds an extra item when you gather (1 in 5).",
  "Leaves a daily note about your next deadline.",
  "+2 Focus whenever you study a waystone.",
  "Fully grown: bigger and brighter.",
];

export const GATHER_FIND_CHANCE = 0.2;
export const STUDY_FOCUS_BONUS = 2;

/** Weeks studied plus twice the quests finished: what a familiar grows on. */
export function familiarGrowth(state: RealmState): number {
  const studied = Object.values(state.progress.weeks).filter((w) => w.studiedAt).length;
  const quests = Object.values(state.progress.quests).filter((q) => q.status === "complete").length;
  return studied + quests * 2;
}

/** 1 (new) … 5 (grown): a level every 4 points of growth. 0 with no familiar. */
export function familiarLevel(state: RealmState): number {
  if (!state.progress.wardrobe.pet) return 0;
  return Math.min(5, 1 + Math.floor(familiarGrowth(state) / 4));
}

/** Growth needed for the next level (null at the top). */
export function nextFamiliarLevelAt(state: RealmState): number | null {
  const level = familiarLevel(state);
  return level >= 5 || level === 0 ? null : level * 4;
}
