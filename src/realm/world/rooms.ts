/**
 * Walk-in buildings: the dorm room and the lecture theatre live inside their
 * buildings on the island itself, so you walk through the door and you're in
 * (no loading, no separate world). Each room is laid out on its own small
 * grid (dorm/interior.ts, lecture/theatre.ts) and placed into the building's
 * footprint here: turned to face the entrance, its floor tiles made walkable,
 * its doorway opened, the ground under it levelled, and its furniture added
 * to the island's objects.
 *
 * A room grid is (size x size) with the room itself at x in [1, 1 + cols),
 * z in [1, 1 + rows), walls in the ring around it, and the door in the front
 * wall (z = rows + 1) at column doorCol + 1. The footprint is that ring:
 * (cols + 2) wide x (rows + 2) deep, and the room's front faces the entrance.
 */

import { TILE, type World, type WorldObject } from "./worldGen";
import type { Dorm } from "../types";
import { dormWorld } from "../dorm/interior";
import { FIXTURES, ROOM_COLS, ROOM_ROWS } from "../dorm/dorm";
import { theatreWorld, THEATRE_COLS, THEATRE_DOOR_COL, THEATRE_ROWS } from "../lecture/theatre";

export type RoomKind = "dorm" | "theatre";

export interface PlacedRoom {
  kind: RoomKind;
  /** The building object this room is inside. */
  buildingId: string;
  /** Footprint min corner on the island, in tiles, and its size (after turning). */
  x0: number;
  z0: number;
  w: number;
  d: number;
  /** Quarter turns applied to the room's own layout (see `turnsToFace`). */
  turns: 0 | 1 | 2 | 3;
  /** Size of the room's own footprint before turning (cols + 2, rows + 2). */
  iw: number;
  id: number;
  /** Floor height the room stands at. */
  y: number;
  /** The island tile just outside the doorway. */
  outside: { x: number; z: number };
  /** The first tile inside the doorway. */
  inside: { x: number; z: number };
}

/** Which quarter turn points the room's front (its own +Z, where the door is) toward `dir` on the island. */
export function turnsToFace(dir: "+x" | "-x" | "+z" | "-z"): 0 | 1 | 2 | 3 {
  return dir === "+z" ? 0 : dir === "+x" ? 1 : dir === "-z" ? 2 : 3;
}

/** Room-grid point (x, z) -> island point, for a room placed as `room`. */
export function roomToWorld(room: Pick<PlacedRoom, "x0" | "z0" | "w" | "d" | "turns" | "iw" | "id">, x: number, z: number): { x: number; z: number } {
  const u = x - room.iw / 2;
  const v = z - room.id / 2;
  const t = (room.turns * Math.PI) / 2;
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  // Same convention as a three.js group rotated by t around Y.
  return { x: room.x0 + room.w / 2 + u * c + v * s, z: room.z0 + room.d / 2 - u * s + v * c };
}

/** Rotation (radians around Y) of the room's layout on the island. */
export function roomAngle(room: Pick<PlacedRoom, "turns">): number {
  return (room.turns * Math.PI) / 2;
}

/** The placed room the island point (x, z) is inside (walls included), if any. */
export function roomAt(rooms: readonly PlacedRoom[] | undefined, x: number, z: number): PlacedRoom | null {
  for (const r of rooms ?? []) if (x >= r.x0 && x < r.x0 + r.w && z >= r.z0 && z < r.z0 + r.d) return r;
  return null;
}

/**
 * Places a room grid into a building footprint. `interior` is the room's own
 * small World (from dormWorld / theatreWorld); its walkable tiles and objects
 * are copied in. Mutates `out` (a copy of the island being assembled).
 */
export function embedRoom(
  out: { walkable: Uint8Array; heights: Float32Array; kinds: Uint8Array; objects: WorldObject[]; size: number },
  interior: World,
  slot: { kind: RoomKind; buildingId: string; x0: number; z0: number; turns: 0 | 1 | 2 | 3; cols: number; rows: number; doorCol: number },
): PlacedRoom {
  const iw = slot.cols + 2;
  const id = slot.rows + 2;
  const odd = slot.turns % 2 === 1;
  const placement = { x0: slot.x0, z0: slot.z0, w: odd ? id : iw, d: odd ? iw : id, turns: slot.turns, iw, id };
  const size = out.size;
  const tile = (x: number, z: number) => {
    const p = roomToWorld(placement, x + 0.5, z + 0.5);
    return { x: Math.floor(p.x), z: Math.floor(p.z) };
  };
  const inBounds = (t: { x: number; z: number }) => t.x >= 0 && t.z >= 0 && t.x < size && t.z < size;

  // Level the ground under the whole footprint (at the height in its middle).
  const cx = Math.round(placement.x0 + placement.w / 2);
  const cz = Math.round(placement.z0 + placement.d / 2);
  const y = out.heights[Math.min(size, Math.max(0, cz)) * (size + 1) + Math.min(size, Math.max(0, cx))] ?? 0;
  for (let z = placement.z0; z <= placement.z0 + placement.d; z++) {
    for (let x = placement.x0; x <= placement.x0 + placement.w; x++) {
      if (x >= 0 && z >= 0 && x <= size && z <= size) out.heights[z * (size + 1) + x] = y;
    }
  }
  // Walls everywhere, then the room's floor and the doorway.
  for (let z = 0; z < id; z++) {
    for (let x = 0; x < iw; x++) {
      const t = tile(x, z);
      if (!inBounds(t)) continue;
      // Bare ground under the floor, so no grass grows through it.
      out.kinds[t.z * size + t.x] = TILE.dirt;
      out.walkable[t.z * size + t.x] = x >= 1 && x <= slot.cols && z >= 1 && z <= slot.rows && interior.walkable[z * interior.size + x] ? 1 : 0;
    }
  }
  const doorX = slot.doorCol + 1;
  const door = tile(doorX, slot.rows + 1);
  if (inBounds(door)) out.walkable[door.z * size + door.x] = 1;
  const inside = tile(doorX, slot.rows);
  const outside = tile(doorX, slot.rows + 2);
  if (inBounds(outside)) out.walkable[outside.z * size + outside.x] = 1;

  // The room's things, turned with it.
  const angle = roomAngle(placement);
  for (const o of interior.objects) {
    const c = roomToWorld(placement, o.x + o.w / 2, o.z + o.d / 2);
    const w = odd ? o.d : o.w;
    const d = odd ? o.w : o.d;
    out.objects.push({ ...o, id: `${slot.kind}-${o.id}`, x: Math.round(c.x - w / 2), z: Math.round(c.z - d / 2), w, d, rot: o.rot + angle });
  }
  return { kind: slot.kind, buildingId: slot.buildingId, ...placement, y, outside, inside };
}

/** Quarter turns that point a room's front (its own +Z) the way a building with this `rot` faces. */
export function turnsForFacing(rot: number): 0 | 1 | 2 | 3 {
  // A building with rotation `rot` faces (sin rot, cos rot), and so does the room's +Z turned by the same angle.
  return ((((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

/**
 * The island with its walk-in rooms built into their buildings: the theatre
 * inside the "lecture-hall" building and your dorm room inside the "dorm"
 * building. Rebuilt when the dorm is redecorated (cheap: copies two arrays).
 */
export function withRooms(world: World, dorm: Dorm): World {
  if (world.mode !== "island") return world;
  const out = { walkable: world.walkable.slice(), heights: world.heights.slice(), kinds: world.kinds.slice(), objects: [...world.objects], size: world.size };
  const rooms: PlacedRoom[] = [];
  const place = (kind: RoomKind, buildingKind: string, interior: World, cols: number, rows: number, doorCol: number) => {
    const building = world.objects.find((o) => o.kind === buildingKind);
    if (!building) return;
    const turns = turnsForFacing(building.rot);
    const odd = turns % 2 === 1;
    const w = odd ? rows + 2 : cols + 2;
    const d = odd ? cols + 2 : rows + 2;
    // Centred in the building's footprint.
    const x0 = Math.round(building.x + (building.w - w) / 2);
    const z0 = Math.round(building.z + (building.d - d) / 2);
    rooms.push(embedRoom(out, interior, { kind, buildingId: building.id, x0, z0, turns, cols, rows, doorCol }));
  };
  place("theatre", "lecture-hall", theatreWorld(world.hub), THEATRE_COLS, THEATRE_ROWS, THEATRE_DOOR_COL);
  place("dorm", "dorm", dormWorld(dorm, world.hub), ROOM_COLS, ROOM_ROWS, FIXTURES.doorCol);
  return { ...world, walkable: out.walkable, heights: out.heights, kinds: out.kinds, objects: out.objects, rooms };
}
