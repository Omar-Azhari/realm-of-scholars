/** A* over the tile grid, 8-directional, no corner cutting. */

import type { World, WorldObject } from "./worldGen";
import { isWalkable } from "./worldGen";

export interface TilePoint {
  x: number;
  z: number;
}

class MinHeap {
  private items: Array<{ key: number; f: number }> = [];
  push(key: number, f: number): void {
    const items = this.items;
    items.push({ key, f });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): number | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].f < items[m].f) m = l;
        if (r < items.length && items[r].f < items[m].f) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top.key;
  }
  get size(): number {
    return this.items.length;
  }
}

const DIRS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Path from `start` to any tile in `goals` (closest by path length).
 * Returns the tile list excluding the start, or null when unreachable.
 */
export function findPath(world: World, start: TilePoint, goals: TilePoint[], maxNodes = 12000): TilePoint[] | null {
  const size = world.size;
  const key = (x: number, z: number) => z * size + x;
  const goalSet = new Set(goals.filter((g) => isWalkable(world, g.x, g.z)).map((g) => key(g.x, g.z)));
  if (goalSet.size === 0) return null;
  const startKey = key(start.x, start.z);
  if (goalSet.has(startKey)) return [];

  const heuristic = (x: number, z: number) => {
    let best = Infinity;
    for (const g of goals) {
      const dx = Math.abs(g.x - x);
      const dz = Math.abs(g.z - z);
      best = Math.min(best, Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz));
    }
    return best;
  };

  const gScore = new Map<number, number>([[startKey, 0]]);
  const cameFrom = new Map<number, number>();
  const open = new MinHeap();
  open.push(startKey, heuristic(start.x, start.z));
  const closed = new Set<number>();
  let expanded = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const current = open.pop()!;
    if (closed.has(current)) continue;
    closed.add(current);
    expanded++;
    if (goalSet.has(current)) {
      const path: TilePoint[] = [];
      let node: number | undefined = current;
      while (node !== undefined && node !== startKey) {
        path.push({ x: node % size, z: Math.floor(node / size) });
        node = cameFrom.get(node);
      }
      return path.reverse();
    }
    const cx = current % size;
    const cz = Math.floor(current / size);
    const g = gScore.get(current)!;
    for (const [dx, dz, cost] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!isWalkable(world, nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!isWalkable(world, cx + dx, cz) || !isWalkable(world, cx, cz + dz))) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const tentative = g + cost;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative);
        cameFrom.set(nk, current);
        open.push(nk, tentative + heuristic(nx, nz));
      }
    }
  }
  return null;
}

/** Walkable tiles touching an object's footprint (where the player stands to interact). */
export function interactionTiles(world: World, object: WorldObject): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let z = object.z - 1; z <= object.z + object.d; z++) {
    for (let x = object.x - 1; x <= object.x + object.w; x++) {
      const inside = x >= object.x && x < object.x + object.w && z >= object.z && z < object.z + object.d;
      if (!inside && isWalkable(world, x, z)) tiles.push({ x, z });
    }
  }
  return tiles;
}

/** Nearest walkable tile to a clicked spot (used when clicking on a tree, water, etc.). */
export function nearestWalkable(world: World, target: TilePoint, radius = 4): TilePoint | null {
  let best: TilePoint | null = null;
  let bestDist = Infinity;
  for (let z = target.z - radius; z <= target.z + radius; z++) {
    for (let x = target.x - radius; x <= target.x + radius; x++) {
      if (!isWalkable(world, x, z)) continue;
      const d = Math.hypot(x - target.x, z - target.z);
      if (d < bestDist) {
        bestDist = d;
        best = { x, z };
      }
    }
  }
  return best;
}
