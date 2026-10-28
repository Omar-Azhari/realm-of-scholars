/**
 * Deterministic NPC "cosmetic reaction" dialogue for Room Edit Mode (Phase
 * 20D, Part 8) — "NPCs should acknowledge changes... purely cosmetic
 * dialogue, deterministic, no relationship system yet." Same rule-based
 * shape as `mentorDialogue.ts` (a priority ladder, a deterministic pool
 * pick keyed off what actually changed) scaled down to this phase's much
 * smaller scope — no subject/relationship/workload signals, since this
 * dialogue reacts to room layout, not academic progress.
 *
 * Shown exactly once, right after Apply — never stored, never replayed on
 * reload, so it can't drift from "a comment about the change that just
 * happened" into a persistent claim.
 */

import type { RoomCustomisation, RoomThemeId } from "../types/domain";
import { findFurnitureItem } from "../data/furnitureCatalogue";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

function pick(pool: string[], seed: string): string {
  return pool[hashString(seed) % pool.length];
}

const THEME_CHANGE_LINES = [
  "Oh, you changed things up in here — I like it.",
  "New look for the room! Suits you.",
  "This theme feels good. Nice choice.",
  "Redecorated, huh? It's working.",
];

/** One line per furniture category, for when a specific slot changed and no theme switch happened. */
const CATEGORY_LINES: Record<string, string[]> = {
  desk: ["Nice new desk.", "That desk looks solid.", "New desk — very studious."],
  bookshelf: ["Nice new bookshelf.", "That shelf suits the room.", "More room for books, I see."],
  chair: ["Comfier-looking chair.", "That chair looks good there.", "Nice seat upgrade."],
  plant: ["A new plant! Nice touch.", "The room's looking greener.", "Plants really do help a space."],
  lamp: ["Good lighting choice.", "That lamp adds a nice glow.", "Nice lamp — sets the mood."],
  rug: ["Like the new rug.", "That rug ties the room together.", "Cosier floor already."],
  "wall-art": ["Nice wall art.", "That's a good look on the wall.", "The wall's looking sharp."],
  noticeboard: ["Good noticeboard upgrade.", "Easier to keep track of things now.", "Nice board — stay organised."],
  storage: ["Nice, more storage.", "That'll keep things tidy.", "Good call on the extra storage."],
  "desk-accessory": ["Nice desk setup.", "Good little desk upgrade.", "That's a tidy desk now."],
  decoration: ["Nice personal touch.", "That's a nice little detail.", "I like how organised your room feels."],
};

const GENERIC_LINES = ["I like how organised your room feels.", "The room's really coming together.", "Looking good in here."];

/**
 * Compares the room state right before and right after an Apply and
 * returns one reaction line, or `null` if nothing actually changed (e.g.
 * the player opened the editor and applied with no edits).
 */
export function getRoomChangeReaction(
  previousTheme: RoomThemeId,
  previousCustomisation: RoomCustomisation,
  nextTheme: RoomThemeId,
  nextCustomisation: RoomCustomisation
): string | null {
  if (previousTheme !== nextTheme) {
    return pick(THEME_CHANGE_LINES, nextTheme);
  }

  const changedSlotIds = Object.keys(nextCustomisation.placedFurniture).filter(
    (slotId) => nextCustomisation.placedFurniture[slotId] !== previousCustomisation.placedFurniture[slotId]
  );
  if (changedSlotIds.length === 0) return null;

  const lastChangedId = changedSlotIds[changedSlotIds.length - 1];
  const newItemId = nextCustomisation.placedFurniture[lastChangedId];
  const category = newItemId ? findFurnitureItem(newItemId)?.category : undefined;
  const pool = category ? CATEGORY_LINES[category] : undefined;
  return pick(pool ?? GENERIC_LINES, lastChangedId + (newItemId ?? "empty"));
}
