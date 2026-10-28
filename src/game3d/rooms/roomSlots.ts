/**
 * Snap-point furniture slots (Phase 20D, Part 2) for the test room. Each
 * slot is a fixed floor position (or, for wall-mounted categories, a
 * fixed wall anchor) that accepts furniture from exactly one catalogue
 * category — "furniture occupies predefined snap locations... avoid
 * free-form physics placement," per the brief. There is no drag-and-drop;
 * placing an item is choosing which catalogue entry a slot holds, nothing
 * more.
 *
 * Every slot position matches where that piece of furniture already sits
 * in `TestRoomProps.tsx`/`testRoomWorld.ts` as of Milestone 20C, so a
 * migrated save (defaulted to the starter item per slot — see
 * `playerIdentityDefaults.ts`) reproduces exactly today's room, not a
 * different one. The two genuinely new slots (`storage`, `decoration` —
 * Campus HQ polish, Part 9) default to empty, since nothing occupies
 * those spots today.
 */

import type { FloorPoint } from "../../world/worldTypes";
import type { FurnitureCategory } from "../../data/furnitureCatalogue";

export interface RoomSlot {
  id: string;
  category: FurnitureCategory;
  /** Floor position in scene units — matches the existing prop's position exactly for the slots that already have furniture today. */
  position: FloorPoint;
  /** Whether an item in this slot may be rotated in Room Edit Mode (Part 5) — most fixed-against-a-wall pieces aren't, freestanding floor pieces are. */
  rotatable: boolean;
}

export const ROOM_SLOTS: RoomSlot[] = [
  { id: "slot-desk", category: "desk", position: { x: 300, feetY: 100 }, rotatable: false },
  { id: "slot-bookshelf", category: "bookshelf", position: { x: 495, feetY: 80 }, rotatable: false },
  { id: "slot-chair", category: "chair", position: { x: 115, feetY: 385 }, rotatable: false },
  { id: "slot-plant-a", category: "plant", position: { x: 180, feetY: 280 }, rotatable: true },
  { id: "slot-plant-b", category: "plant", position: { x: 350, feetY: 280 }, rotatable: true },
  { id: "slot-lamp", category: "lamp", position: { x: 150, feetY: 320 }, rotatable: true },
  { id: "slot-rug", category: "rug", position: { x: 300, feetY: 240 }, rotatable: false },
  { id: "slot-wallart", category: "wall-art", position: { x: 135, feetY: 0 }, rotatable: false },
  { id: "slot-noticeboard", category: "noticeboard", position: { x: 598, feetY: 215 }, rotatable: false },
  { id: "slot-storage", category: "storage", position: { x: 405, feetY: 75 }, rotatable: false },
  { id: "slot-decoration", category: "decoration", position: { x: 290, feetY: 325 }, rotatable: true },
  { id: "slot-desk-accessory", category: "desk-accessory", position: { x: 300, feetY: 100 }, rotatable: false },
];

export function findRoomSlot(id: string): RoomSlot | undefined {
  return ROOM_SLOTS.find((s) => s.id === id);
}

export function slotsForCategory(category: FurnitureCategory): RoomSlot[] {
  return ROOM_SLOTS.filter((s) => s.category === category);
}
