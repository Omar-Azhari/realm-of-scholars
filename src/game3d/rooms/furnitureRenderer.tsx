/**
 * Generic slot-driven furniture renderer (Phase 20D, Part 2/3). Maps a
 * `FurnitureItem`'s `shape` key to one of the shared primitives in
 * `furniturePieces.tsx`, tinted by that item's `colors` — the "shape+colour
 * recipe" from `appearanceCatalogue.ts`/Phase 20B, applied to furniture so
 * the catalogue can grow via colour variation without a bespoke mesh per
 * entry. This is the ONLY place that reads `FurnitureItem.shape`; adding a
 * new catalogue item with an existing shape needs no renderer change.
 */

import type { FurnitureItem } from "../../data/furnitureCatalogue";
import {
  Bookshelf,
  DecorationPhotoFrame,
  DecorationTrophy,
  DeskItems,
  Noticeboard,
  PotPlant,
  ReadingChair,
  Rug,
  StandingLamp,
  StorageLockers,
  WallArt,
} from "./furniturePieces";

/** World-space Y of the desk's top surface — matches TestRoomScene.tsx's own desk box exactly (kept in sync there, not re-derived here, since only the desk mesh itself needs the full box geometry). */
export const DESK_TOP_Y = 0.755;

export function FurnitureMesh({ item, x, z }: { item: FurnitureItem; x: number; z: number }) {
  switch (item.shape) {
    case "bookshelf-standard":
    case "bookshelf-tall":
      return <Bookshelf x={x} z={z} color={item.colors.primary} />;
    case "chair-reading":
      return <ReadingChair x={x} z={z} color={item.colors.primary} />;
    case "plant-pot":
      return <PotPlant x={x} y={0} z={z} potColor={item.colors.pot} leafColor={item.colors.leaf} />;
    case "lamp-standing":
      return <StandingLamp x={x} z={z} metalColor={item.colors.metal} shadeColor={item.colors.shade} />;
    case "rug-simple":
      return <Rug x={x} z={z} width={1.6} depth={1.2} fill={item.colors.fill} border={item.colors.border} />;
    case "wallart-board":
      return <WallArt x={x} y={1.5} color={item.colors.primary} />;
    case "noticeboard-cork":
      return <Noticeboard x={x} y={1.3} z={z} color={item.colors.primary} />;
    case "storage-lockers":
      return <StorageLockers x={x} z={z} color={item.colors.primary} />;
    case "decoration-trophy":
      return <DecorationTrophy x={x} z={z} color={item.colors.primary} />;
    case "decoration-photo-frame":
      return <DecorationPhotoFrame x={x} z={z} color={item.colors.primary} />;
    case "desk-accessories":
      return <DeskItems x={x} z={z} deskTopY={DESK_TOP_Y} />;
    // "desk-classic"/"desk-standing" are rendered by TestRoomScene.tsx's own
    // desk box (it needs to stay a real collidable, clickable mesh with its
    // own onClick — not a generic swap-in), so they intentionally fall
    // through to null here rather than double-rendering a second desk.
    default:
      return null;
  }
}
