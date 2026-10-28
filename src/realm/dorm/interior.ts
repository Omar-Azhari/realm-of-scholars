/**
 * The dorm as a place you walk into. Builds a small World from the saved
 * room: one tile per furniture cell, walls around it, the door in the right
 * wall. Furniture becomes objects with things to do:
 *
 *   bed          Sleep: once a day, "well rested" (+10% study XP for 4 hours)
 *   study desk   Study: the study hub, or a real focus session
 *   bookshelf    Review: the Grimoire of Mistakes
 *   seats        Sit
 *   wardrobe     Customise: parts, dyes, emotes
 *   noticeboard  Read: what's due, today's plan and challenges; Decorate: rearrange the room
 *   door         the way in and out (front wall)
 *
 * Lamps, rugs, plants and pictures add comfort (extra daily Focus).
 */

import { furniture, FIXTURES, footprint, ROOM_COLS, ROOM_ROWS, standHeight } from "./dorm";
import type { Dorm } from "../types";
import type { ObjectAction, World, WorldObject } from "../world/worldGen";

/** Room cell (c, r) is world tile (c + ROOM_X, r + ROOM_Z). */
export const ROOM_X = 1;
export const ROOM_Z = 1;
export const INTERIOR_SIZE = Math.max(ROOM_COLS, ROOM_ROWS) + 3;

const ACTIONS: Record<string, ObjectAction[]> = {
  "bed-single-a": [{ id: "rest", label: "Sleep" }],
  "bed-single-b": [{ id: "rest", label: "Sleep" }],
  "table-medium": [{ id: "desk", label: "Study" }],
  "shelf-b-large-decorated": [{ id: "review", label: "Review" }],
  "couch-pillows": [{ id: "sit", label: "Read" }],
  armchair: [{ id: "sit", label: "Read" }],
  "chair-a-wood": [{ id: "sit", label: "Read" }],
  "chair-c": [{ id: "sit", label: "Read" }],
};

const EXAMINE: Record<string, string> = {
  rest: "Sleep here once a day to wake up well rested: +10% study XP for the next four hours.",
  desk: "Your desk. Open your study hub, or sit down for a timed focus session.",
  review: "Your notes and textbooks. The Grimoire of Mistakes lives here.",
  sit: "A comfy seat for reading your subject notes.",
};

export function dormWorld(dorm: Dorm, hub: World["hub"]): World {
  const size = INTERIOR_SIZE;
  const kinds = new Uint8Array(size * size).fill(2);
  const walkable = new Uint8Array(size * size);
  for (let r = 0; r < ROOM_ROWS; r++) for (let c = 0; c < ROOM_COLS; c++) walkable[(r + ROOM_Z) * size + c + ROOM_X] = 1;
  const block = (c: number, r: number) => {
    if (c >= 0 && r >= 0 && c < ROOM_COLS && r < ROOM_ROWS) walkable[(r + ROOM_Z) * size + c + ROOM_X] = 0;
  };

  const objects: WorldObject[] = [];
  for (const p of dorm.placed) {
    const item = furniture(p.id);
    if (!item) continue;
    const { w, d } = footprint(item, p.rot);
    if (item.layer === "floor") for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) block(p.c + dc, p.r + dr);
    const actions = ACTIONS[p.id] ?? [];
    objects.push({
      id: `furniture-${p.uid}`,
      kind: "furniture",
      x: p.c + ROOM_X,
      z: (item.layer === "wall" ? 0 : p.r) + ROOM_Z,
      w,
      d: item.layer === "wall" ? 1 : d,
      rot: 0,
      name: item.name,
      examine: actions.length ? EXAMINE[actions[0].id] : `${item.name}: +${item.comfort} comfort. A comfier room pays extra Focus with the daily challenges.`,
      actions,
      furniture: { id: p.id, uid: p.uid, rot: p.rot, y: standHeight(dorm, p) },
    });
  }

  block(FIXTURES.wardrobe.c, FIXTURES.wardrobe.r);
  objects.push({
    id: "dorm-wardrobe",
    kind: "wardrobe",
    x: FIXTURES.wardrobe.c + ROOM_X,
    z: FIXTURES.wardrobe.r + ROOM_Z,
    w: 1,
    d: 1,
    rot: 0,
    name: "Wardrobe",
    examine: "Mix and match any class's parts, dye them, and try emotes.",
    actions: [{ id: "customise", label: "Open" }],
  });
  objects.push({
    id: "dorm-noticeboard",
    kind: "noticeboard",
    x: FIXTURES.noticeboardColumn + ROOM_X,
    z: ROOM_Z,
    w: 1,
    d: 1,
    rot: 0,
    name: "Noticeboard",
    examine: "Pinned notes: what's due, today's plan and the daily challenges. You can rearrange the room from here too.",
    actions: [
      { id: "plan", label: "Read" },
      { id: "mail", label: "Letters" },
      { id: "decorate", label: "Decorate" },
    ],
  });
  // The doorway cell stays walkable even if an old layout put furniture there.
  walkable[(ROOM_ROWS - 1 + ROOM_Z) * size + FIXTURES.doorCol + ROOM_X] = 1;
  objects.push({
    id: "dorm-door",
    kind: "door",
    x: FIXTURES.doorCol + ROOM_X,
    z: ROOM_ROWS + ROOM_Z,
    w: 1,
    d: 1,
    // The door visual is drawn for a side wall; a quarter turn stands it in the front wall.
    rot: -Math.PI / 2,
    name: "Door",
    examine: "Your door. Walk out to head back to campus.",
    actions: [],
  });

  return {
    mode: "interior",
    interior: "dorm",
    islandId: "home",
    hub,
    hubProps: [],
    camps: [],
    districts: [],
    size,
    kinds,
    regionOf: new Uint8Array(size * size),
    heights: new Float32Array((size + 1) * (size + 1)),
    walkable,
    objects,
    trees: [],
    rocks: [],
    flowers: [],
    regions: [],
    spawn: { x: FIXTURES.doorCol + ROOM_X + 0.5, z: ROOM_ROWS - 1 + ROOM_Z + 0.5 },
    plaza: { x0: ROOM_X, z0: ROOM_Z, x1: ROOM_X + ROOM_COLS, z1: ROOM_Z + ROOM_ROWS },
  };
}
