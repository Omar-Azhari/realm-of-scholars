/**
 * The lecture theatre as a place you walk into: a stage with a projection
 * screen and a lectern at the back, tiered benches facing it, a centre aisle,
 * and the door. The professor at the lectern gives a week's lecture (see
 * hud/LectureWindow.tsx); the slide shows on the big screen.
 */

import type { World, WorldObject } from "../world/worldGen";

export const THEATRE_COLS = 12;
export const THEATRE_ROWS = 11;
/** Room cell (c, r) is world tile (c + THEATRE_X, r + THEATRE_Z). */
export const THEATRE_X = 1;
export const THEATRE_Z = 1;
/** Rows 0..STAGE_ROWS-1 are the stage. */
export const STAGE_ROWS = 3;
/** Bench rows: the first and last row of seating. */
export const BENCH_FIRST = 4;
export const BENCH_LAST = 9;
/** Benches run along these columns on each side of the centre aisle. */
export const BENCH_SPANS: Array<[number, number]> = [
  [1, 4],
  [7, 10],
];
/** The entrance: the front wall, at the end of the centre aisle (you walk in behind the back row). */
export const THEATRE_DOOR_COL = 5;
export const LECTERN = { c: 8, r: 1 };
/**
 * Where you sit for a lecture: the front bench's aisle end (seat top ~0.61 high),
 * facing the stage, and the aisle tile you stand up into.
 */
export const FRONT_SEAT = {
  x: THEATRE_X + 4 + 0.5,
  z: THEATRE_Z + BENCH_FIRST + 0.5 + 0.18,
  drop: 0.26,
  facing: Math.PI,
  standX: THEATRE_X + 5 + 0.5,
  standZ: THEATRE_Z + BENCH_FIRST + 0.5,
};

export function theatreWorld(hub: World["hub"]): World {
  const size = Math.max(THEATRE_COLS, THEATRE_ROWS) + 3;
  const kinds = new Uint8Array(size * size).fill(2);
  const walkable = new Uint8Array(size * size);
  const cell = (c: number, r: number) => (r + THEATRE_Z) * size + c + THEATRE_X;
  for (let r = 0; r < THEATRE_ROWS; r++) for (let c = 0; c < THEATRE_COLS; c++) walkable[cell(c, r)] = 1;
  // Benches (every other row, on risers) are solid; the aisles between them stay open.
  for (let r = BENCH_FIRST; r <= BENCH_LAST; r += 1) {
    if ((r - BENCH_FIRST) % 2 === 1) continue;
    for (const [a, b] of BENCH_SPANS) for (let c = a; c <= b; c++) walkable[cell(c, r)] = 0;
  }
  // The lectern and the professor standing behind it.
  walkable[cell(LECTERN.c, LECTERN.r)] = 0;
  walkable[cell(LECTERN.c, LECTERN.r - 1)] = 0;

  const objects: WorldObject[] = [
    {
      id: "theatre-lectern",
      kind: "lectern",
      x: LECTERN.c + THEATRE_X,
      z: LECTERN.r + THEATRE_Z,
      w: 1,
      d: 1,
      rot: 0,
      name: "Professor at the lectern",
      examine: "Choose a subject and a week and the professor gives that lecture: slides on the big screen, spoken out loud, with check-in questions.",
      actions: [{ id: "lecture", label: "Attend" }],
    },
    {
      id: "theatre-door",
      kind: "door",
      x: THEATRE_DOOR_COL + THEATRE_X,
      z: THEATRE_ROWS + THEATRE_Z,
      w: 1,
      d: 1,
      rot: -Math.PI / 2,
      name: "Door",
      examine: "The theatre doors. Walk out to head back to the Scholars' Quarter.",
      actions: [],
    },
  ];

  return {
    mode: "interior",
    interior: "theatre",
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
    spawn: { x: THEATRE_DOOR_COL + THEATRE_X + 0.5, z: THEATRE_ROWS - 1 + THEATRE_Z + 0.5 },
    plaza: { x0: THEATRE_X, z0: THEATRE_Z, x1: THEATRE_X + THEATRE_COLS, z1: THEATRE_Z + THEATRE_ROWS },
  };
}
