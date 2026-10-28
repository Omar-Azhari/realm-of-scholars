/**
 * The dorm room: a small room the player furnishes with furniture bought
 * with study coins. Furniture adds comfort, and a comfy room pays extra
 * Focus when the daily challenges are claimed — so decorating feeds back
 * into play, and the coins for it come from studying.
 *
 * Grid: ROOM_COLS × ROOM_ROWS floor cells, 1 unit each. The back wall runs
 * along r = 0 and the left wall along c = 0. Floor items block their cells;
 * rugs lie underneath; tabletop items sit on a surface; wall items hang on
 * the back wall.
 */

import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import { spendCoins } from "../state/actions";
import type { Dorm, PlacedFurniture } from "../types";

export const ROOM_COLS = 8;
export const ROOM_ROWS = 7;
export const MAX_COMFORT = 30;

export type FurnitureLayer = "floor" | "rug" | "top" | "wall";

export interface Furniture {
  id: string;
  name: string;
  icon: string;
  price: number;
  layer: FurnitureLayer;
  /** Footprint in cells before rotation (wall items: width along the wall). */
  w: number;
  d: number;
  comfort: number;
  /** Height of the top surface, for tables and the like that hold tabletop items. */
  surface?: number;
  /** Mount height for wall items. */
  mount?: number;
  /** Gives off a warm light. */
  light?: boolean;
}

export const FURNITURE: Furniture[] = [
  { id: "bed-single-a", name: "Cosy bed", icon: "🛏", price: 300, layer: "floor", w: 2, d: 3, comfort: 6 },
  { id: "bed-single-b", name: "Quilted bed", icon: "🛏", price: 380, layer: "floor", w: 2, d: 3, comfort: 7 },
  { id: "table-medium", name: "Study desk", icon: "🪑", price: 200, layer: "floor", w: 2, d: 2, comfort: 3, surface: 1.0 },
  { id: "table-small", name: "Side table", icon: "◻", price: 80, layer: "floor", w: 1, d: 1, comfort: 1, surface: 1.0 },
  { id: "table-low", name: "Coffee table", icon: "▭", price: 140, layer: "floor", w: 3, d: 2, comfort: 2, surface: 0.5 },
  { id: "chair-a-wood", name: "Wooden chair", icon: "🪑", price: 60, layer: "floor", w: 1, d: 1, comfort: 1 },
  { id: "chair-c", name: "Padded chair", icon: "💺", price: 90, layer: "floor", w: 1, d: 1, comfort: 2 },
  { id: "armchair", name: "Armchair", icon: "🛋", price: 220, layer: "floor", w: 2, d: 2, comfort: 4 },
  { id: "couch-pillows", name: "Couch", icon: "🛋", price: 360, layer: "floor", w: 3, d: 2, comfort: 6 },
  { id: "cabinet-small-decorated", name: "Cabinet", icon: "🗄", price: 150, layer: "floor", w: 1, d: 1, comfort: 2 },
  { id: "lamp-standing", name: "Floor lamp", icon: "💡", price: 120, layer: "floor", w: 1, d: 1, comfort: 2, light: true },
  { id: "cactus-medium-a", name: "Potted cactus", icon: "🌵", price: 70, layer: "floor", w: 1, d: 1, comfort: 1 },
  { id: "rug-oval-a", name: "Oval rug", icon: "🟫", price: 100, layer: "rug", w: 3, d: 2, comfort: 2 },
  { id: "rug-rectangle-stripes-a", name: "Striped rug", icon: "🟥", price: 100, layer: "rug", w: 3, d: 2, comfort: 2 },
  { id: "rug-rectangle-stripes-b", name: "Blue striped rug", icon: "🟦", price: 100, layer: "rug", w: 3, d: 2, comfort: 2 },
  { id: "lamp-table", name: "Desk lamp", icon: "🪔", price: 70, layer: "top", w: 1, d: 1, comfort: 1, light: true },
  { id: "book-set", name: "Textbooks", icon: "📚", price: 50, layer: "top", w: 1, d: 1, comfort: 1 },
  { id: "pictureframe-standing-b", name: "Photo frame", icon: "🖼", price: 60, layer: "top", w: 1, d: 1, comfort: 1 },
  { id: "cactus-small-b", name: "Tiny cactus", icon: "🌵", price: 40, layer: "top", w: 1, d: 1, comfort: 1 },
  { id: "shelf-b-large-decorated", name: "Bookshelf", icon: "📚", price: 200, layer: "wall", w: 2, d: 1, comfort: 3, mount: 1.5 },
  { id: "shelf-a-small", name: "Wall shelf", icon: "▬", price: 60, layer: "wall", w: 1, d: 1, comfort: 1, mount: 1.6 },
  { id: "pictureframe-large-a", name: "Painting", icon: "🖼", price: 120, layer: "wall", w: 1, d: 1, comfort: 2, mount: 1.9 },
];

/**
 * Built-in fixtures every room has, which furniture can't cover: the
 * wardrobe in the back-right corner, the noticeboard on the back wall, and
 * the door in the front wall at the right-hand end (its doorway cell stays clear).
 */
export const FIXTURES = {
  wardrobe: { c: ROOM_COLS - 1, r: 0 },
  noticeboardColumn: ROOM_COLS - 2,
  doorCol: ROOM_COLS - 1,
} as const;

/** Furniture every player gets when they first move in. */
export const STARTER: Array<{ id: string; c: number; r: number; rot: 0 | 1 | 2 | 3 }> = [
  { id: "bed-single-a", c: 0, r: 0, rot: 0 },
  { id: "table-small", c: 2, r: 0, rot: 0 },
  { id: "chair-a-wood", c: 5, r: 2, rot: 0 },
];

export function furniture(id: string): Furniture | undefined {
  return FURNITURE.find((f) => f.id === id);
}

/** Footprint size after rotation. */
export function footprint(item: Furniture, rot: number): { w: number; d: number } {
  if (item.layer === "wall") return { w: item.w, d: 1 };
  return rot % 2 === 1 ? { w: item.d, d: item.w } : { w: item.w, d: item.d };
}

function cells(item: Furniture, c: number, r: number, rot: number): Array<[number, number]> {
  const { w, d } = footprint(item, rot);
  const out: Array<[number, number]> = [];
  for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < d; dr++) out.push([c + dc, r + dr]);
  return out;
}

/** The floor item (if any) covering a cell. */
export function floorItemAt(dorm: Dorm, c: number, r: number, ignoreUid?: string): PlacedFurniture | undefined {
  return dorm.placed.find((p) => {
    if (p.uid === ignoreUid) return false;
    const f = furniture(p.id);
    return f?.layer === "floor" && cells(f, p.c, p.r, p.rot).some(([x, y]) => x === c && y === r);
  });
}

/** Why an item can't go here, or null when it can. */
export function placeBlocker(dorm: Dorm, id: string, c: number, r: number, rot: number, ignoreUid?: string): string | null {
  const item = furniture(id);
  if (!item) return "Unknown furniture.";
  const { w, d } = footprint(item, rot);
  if (item.layer === "wall") {
    if (c < 0 || c + w > ROOM_COLS) return "That doesn't fit on the wall.";
    if (c <= FIXTURES.noticeboardColumn && FIXTURES.noticeboardColumn < c + w) return "The noticeboard hangs there.";
    if (c <= FIXTURES.wardrobe.c && FIXTURES.wardrobe.c < c + w) return "The wardrobe stands there.";
    const clash = dorm.placed.some((p) => {
      if (p.uid === ignoreUid) return false;
      const f = furniture(p.id);
      return f?.layer === "wall" && p.c < c + w && c < p.c + f.w;
    });
    return clash ? "Something already hangs there." : null;
  }
  if (c < 0 || r < 0 || c + w > ROOM_COLS || r + d > ROOM_ROWS) return "That doesn't fit in the room.";
  const mine = cells(item, c, r, rot);
  if (item.layer === "floor" && mine.some(([x, y]) => x === FIXTURES.doorCol && y === ROOM_ROWS - 1)) return "Keep the doorway clear.";
  if (item.layer === "top") {
    const under = floorItemAt(dorm, c, r, ignoreUid);
    if (!under || !furniture(under.id)?.surface) return "Put it on a table or desk.";
    const taken = dorm.placed.some((p) => p.uid !== ignoreUid && furniture(p.id)?.layer === "top" && p.c === c && p.r === r);
    return taken ? "There's already something on that spot." : null;
  }
  for (const p of dorm.placed) {
    if (p.uid === ignoreUid) continue;
    const f = furniture(p.id);
    if (!f || f.layer !== item.layer) continue;
    const theirs = cells(f, p.c, p.r, p.rot);
    if (mine.some(([x, y]) => theirs.some(([a, b]) => a === x && b === y))) return item.layer === "rug" ? "There's already a rug there." : "Something's in the way.";
  }
  if (item.layer !== "rug" && mine.some(([x, y]) => x === FIXTURES.wardrobe.c && y === FIXTURES.wardrobe.r)) return "The wardrobe stands there.";
  // Keep a free spot by the door (front-right corner) so the room can be entered.
  if (item.layer === "floor" && mine.some(([x, y]) => x === ROOM_COLS - 1 && y === ROOM_ROWS - 1)) return "Keep the doorway clear.";
  return null;
}

/** Height of the table top (or 0) at a cell. */
export function surfaceAt(dorm: Dorm, c: number, r: number): number {
  return furniture(floorItemAt(dorm, c, r)?.id ?? "")?.surface ?? 0;
}

/** Height a placed item stands at (tabletop items sit on their surface). */
export function standHeight(dorm: Dorm, p: PlacedFurniture): number {
  const f = furniture(p.id);
  if (!f) return 0;
  if (f.layer === "wall") return f.mount ?? 1.6;
  if (f.layer === "top") return surfaceAt(dorm, p.c, p.r);
  return 0;
}

export function availableCount(dorm: Dorm, id: string): number {
  return (dorm.owned[id] ?? 0) - dorm.placed.filter((p) => p.id === id).length;
}

/** Comfort of the furnished room (placed items only), capped. */
export function comfort(dorm: Dorm): number {
  const total = dorm.placed.reduce((n, p) => n + (furniture(p.id)?.comfort ?? 0), 0);
  return Math.min(MAX_COMFORT, total);
}

/** Extra Focus paid with the daily challenge reward: half the room's comfort. */
export function comfortFocusBonus(dorm: Dorm): number {
  return Math.floor(comfort(dorm) / 2);
}

function setDorm(update: (d: Dorm) => Dorm): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, dorm: update(s.progress.dorm) } }));
}

let uidCounter = 0;
function newUid(): string {
  uidCounter = (uidCounter + 1) % 100000;
  return `${Date.now().toString(36)}-${uidCounter}`;
}

/** Furnishes an empty room the first time the player visits. */
export function moveIn(): boolean {
  const state = realmStore.get();
  if ((state.progress.counters.dormMovedIn ?? 0) > 0) return false;
  setDorm((d) => {
    const owned = { ...d.owned };
    const placed = [...d.placed];
    for (const s of STARTER) {
      owned[s.id] = (owned[s.id] ?? 0) + 1;
      placed.push({ uid: newUid(), id: s.id, c: s.c, r: s.r, rot: s.rot });
    }
    return { owned, placed };
  });
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, counters: { ...s.progress.counters, dormMovedIn: 1 } } }));
  chat("You move into your dorm room. A bed, a side table and a chair to start. Furnish it with coins from studying.", "quest");
  return true;
}

export function buyFurniture(id: string): boolean {
  const item = furniture(id);
  if (!item) return false;
  if (!spendCoins(item.price)) return false;
  setDorm((d) => ({ ...d, owned: { ...d.owned, [id]: (d.owned[id] ?? 0) + 1 } }));
  emit({ type: "sound", name: "coin" });
  chat(`You buy a ${item.name.toLowerCase()}. Place it in your room.`);
  return true;
}

export function placeFurniture(id: string, c: number, r: number, rot: 0 | 1 | 2 | 3): PlacedFurniture | null {
  const dorm = realmStore.get().progress.dorm;
  if (availableCount(dorm, id) <= 0) return null;
  if (placeBlocker(dorm, id, c, r, rot)) return null;
  const placed: PlacedFurniture = { uid: newUid(), id, c, r: furniture(id)?.layer === "wall" ? 0 : r, rot };
  setDorm((d) => ({ ...d, placed: [...d.placed, placed] }));
  emit({ type: "sound", name: "click" });
  return placed;
}

/** Moves or turns a placed item. Returns false (and leaves it) when the new spot isn't free. */
export function moveFurniture(uid: string, c: number, r: number, rot: 0 | 1 | 2 | 3): boolean {
  const dorm = realmStore.get().progress.dorm;
  const p = dorm.placed.find((x) => x.uid === uid);
  if (!p || placeBlocker(dorm, p.id, c, r, rot, uid)) return false;
  // Things on a table travel with it; turning the table puts them back in storage.
  const onTop = furniture(p.id)?.surface ? dorm.placed.filter((x) => furniture(x.id)?.layer === "top" && floorItemAt(dorm, x.c, x.r)?.uid === uid).map((x) => x.uid) : [];
  const dc = c - p.c;
  const dr = r - p.r;
  setDorm((d) => ({
    ...d,
    placed: d.placed
      .filter((x) => !(onTop.includes(x.uid) && rot !== p.rot))
      .map((x) => (x.uid === uid ? { ...x, c, r, rot } : onTop.includes(x.uid) ? { ...x, c: x.c + dc, r: x.r + dr } : x)),
  }));
  return true;
}

/** Turns a placed item a quarter turn about its middle, nudged to stay inside the room. */
export function turnFurniture(uid: string): boolean {
  const dorm = realmStore.get().progress.dorm;
  const p = dorm.placed.find((x) => x.uid === uid);
  const item = p ? furniture(p.id) : undefined;
  if (!p || !item) return false;
  const rot = ((p.rot + 1) % 4) as 0 | 1 | 2 | 3;
  const before = footprint(item, p.rot);
  const after = footprint(item, rot);
  const midC = p.c + before.w / 2;
  const midR = p.r + before.d / 2;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const c = clamp(Math.round(midC - after.w / 2), ROOM_COLS - after.w);
  const r = clamp(Math.round(midR - after.d / 2), ROOM_ROWS - after.d);
  return moveFurniture(uid, c, r, rot) || moveFurniture(uid, p.c, p.r, rot);
}

/** Picks an item up (back into storage). Anything sitting on it comes up too. */
export function pickUp(uid: string): void {
  setDorm((d) => {
    const p = d.placed.find((x) => x.uid === uid);
    if (!p) return d;
    const f = furniture(p.id);
    const onTop = f?.surface ? d.placed.filter((x) => furniture(x.id)?.layer === "top" && floorItemAt(d, x.c, x.r)?.uid === uid).map((x) => x.uid) : [];
    return { ...d, placed: d.placed.filter((x) => x.uid !== uid && !onTop.includes(x.uid)) };
  });
}
