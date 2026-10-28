/**
 * Broom flying: unlocked by mastering a subject — studying every one of its
 * weeks at the waystones. Press B outdoors to take off or land. Flying is
 * faster, crosses water and walls, and opens the Sky Race in the games hall.
 */

import { weekKey } from "../state/actions";
import type { RealmState } from "../types";

/** Flying speed multiplier over walking. */
export const BROOM_SPEED = 2.2;
/** Height above the ground while flying. */
export const FLY_HEIGHT = 2.4;

/** The subject that unlocked the broom (first fully studied), or null. */
export function broomSubject(state: RealmState): string | null {
  for (const s of state.curriculum?.subjects ?? []) {
    if (s.weeks.length > 0 && s.weeks.every((w) => state.progress.weeks[weekKey(s.id, w.week)]?.studiedAt)) return s.name;
  }
  return null;
}

export function broomUnlocked(state: RealmState): boolean {
  return broomSubject(state) !== null;
}

/** Weeks still to study in the subject closest to unlocking the broom. */
export function weeksToBroom(state: RealmState): { subject: string; left: number } | null {
  let best: { subject: string; left: number } | null = null;
  for (const s of state.curriculum?.subjects ?? []) {
    if (s.weeks.length === 0) continue;
    const left = s.weeks.filter((w) => !state.progress.weeks[weekKey(s.id, w.week)]?.studiedAt).length;
    if (!best || left < best.left) best = { subject: s.name, left };
  }
  return best;
}
