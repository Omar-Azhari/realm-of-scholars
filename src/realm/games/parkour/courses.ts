/**
 * Parkour courses as data. Each piece is a box: centre x/z, the y of its TOP surface,
 * and its size (width x, thickness y, depth z). Courses run from the start pad at the
 * origin towards -Z (straight ahead of the default camera).
 *
 * Visual language: green start, yellow checkpoints, red kill bricks, blue bounce pads,
 * cyan speed pads, striped conveyors, pale walls for wall jumps and wall runs, and a
 * gold finish pad with a glowing portal.
 */

import { PHYS, type Box, type BoxKind, type PhysWorld, type Spawn, type Vec3 } from "./physics";

export interface Piece {
  k: BoxKind;
  /** [centre x, top y, centre z] */
  at: [number, number, number];
  /** [width x, thickness y, depth z] */
  size: [number, number, number];
  /** Ping-pong movement: offset at the far end, seconds for a full there-and-back, phase 0..1. */
  move?: { by: [number, number, number]; period: number; phase?: number };
  /** Conveyor / speed pad direction on the ground plane. */
  dir?: [number, number];
  /** Conveyor speed. */
  speed?: number;
  /** Bounce pad launch speed. */
  power?: number;
}

export interface Sign {
  at: [number, number, number];
  text: string;
  /** Rotation about Y (0 faces +Z, towards a player coming from the start). */
  rot?: number;
}

export type CourseId = "meadow" | "cloudworks" | "stormspire";

export interface CourseDef {
  id: CourseId;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  blurb: string;
  teaches: string[];
  /** Bronze, silver, gold times in seconds (lower is better). */
  medals: [number, number, number];
  doubleJump: boolean;
  killY: number;
  sky: { top: string; horizon: string };
  pieces: Piece[];
  signs: Sign[];
}

const MEADOW: CourseDef = {
  id: "meadow",
  name: "Meadow Hop",
  difficulty: "Easy",
  blurb: "Your first obby. Jumps, sprints, a bounce pad and one moving platform.",
  teaches: ["Jumping", "Sprint gaps", "Bounce pads", "Kill bricks", "Moving platforms"],
  medals: [75, 48, 34],
  doubleJump: false,
  killY: -14,
  sky: { top: "#3d8fe0", horizon: "#cfe9ff" },
  pieces: [
    { k: "start", at: [0, 0, 0], size: [8, 1, 8] },
    { k: "plat", at: [0, 0, -9], size: [5, 1, 5] },
    { k: "plat", at: [0, 0.8, -16], size: [4, 1, 4] },
    { k: "plat", at: [0, 1.6, -22], size: [4, 1, 4] },
    // Sprint lesson: a runway, then a gap too wide to walk.
    { k: "plat", at: [0, 1.6, -31], size: [4, 1, 10] },
    { k: "plat", at: [0, 1.6, -43.5], size: [5, 1, 5] },
    { k: "check", at: [0, 1.6, -52], size: [6, 1, 6] },
    // Stairs up.
    { k: "plat", at: [-1, 2.4, -58.5], size: [3, 1, 3] },
    { k: "plat", at: [1, 3.2, -62.5], size: [3, 1, 3] },
    { k: "plat", at: [-1, 4.0, -66.5], size: [3, 1, 3] },
    // Bounce up to the high ledge.
    { k: "plat", at: [0, 4.0, -73], size: [6, 1, 8] },
    { k: "bounce", at: [0, 4.3, -75], size: [2.6, 0.3, 2.6], power: 24 },
    { k: "plat", at: [0, 9.0, -82], size: [6, 1, 6] },
    // Kill bricks to hop over.
    { k: "plat", at: [0, 9.0, -92], size: [3, 1, 12] },
    { k: "kill", at: [0, 9.6, -90], size: [3, 0.6, 1] },
    { k: "kill", at: [0, 9.6, -95], size: [3, 0.6, 1] },
    { k: "check", at: [0, 9.0, -102], size: [6, 1, 6] },
    // A moving platform ferries you over the big gap.
    { k: "plat", at: [0, 9.0, -109], size: [4, 1, 4], move: { by: [0, 0, -9], period: 6 } },
    { k: "plat", at: [0, 9.0, -124], size: [5, 1, 5] },
    { k: "finish", at: [0, 10.0, -132], size: [6, 1, 6] },
  ],
  signs: [
    { at: [3.2, 3.2, -26.5], text: "Hold Shift to sprint" },
    { at: [3.6, 5.6, -70], text: "Blue pads bounce you" },
    { at: [2.6, 11, -87], text: "Red bricks reset you" },
    { at: [3.6, 11, -105], text: "Ride the platform" },
  ],
};

const CLOUDWORKS: CourseDef = {
  id: "cloudworks",
  name: "Cloud Works",
  difficulty: "Medium",
  blurb: "Double jumps, a wall-jump chimney, conveyors, speed pads and moving kill bricks.",
  teaches: ["Double jump", "Wall jumps", "Conveyors", "Speed pads", "Timing"],
  medals: [110, 72, 50],
  doubleJump: true,
  killY: -14,
  sky: { top: "#5b6fd6", horizon: "#f3d9ff" },
  pieces: [
    { k: "start", at: [0, 0, 0], size: [8, 1, 8] },
    { k: "plat", at: [0, 0, -11], size: [4, 1, 4] },
    // Too high for one jump: double jump.
    { k: "plat", at: [0, 2.6, -18], size: [4, 1, 4] },
    { k: "plat", at: [0, 3, -29], size: [4, 1, 4] },
    { k: "check", at: [0, 3, -37], size: [6, 1, 6] },
    // Wall-jump chimney: kick between the two walls to climb.
    { k: "plat", at: [0, 3, -46], size: [4, 1, 6] },
    { k: "wall", at: [-2.5, 11.5, -46], size: [1, 10, 6] },
    { k: "wall", at: [2.5, 11.5, -46], size: [1, 10, 6] },
    { k: "check", at: [0, 10, -53], size: [6, 1, 6] },
    // Conveyor pushing back at you.
    { k: "conveyor", at: [0, 10, -64], size: [3, 1, 14], dir: [0, 1], speed: 4 },
    // Speed pad and a long gap.
    { k: "plat", at: [0, 10, -76], size: [4, 1, 8] },
    { k: "boost", at: [0, 10.25, -77], size: [3, 0.25, 3], dir: [0, -1] },
    { k: "plat", at: [0, 10, -92], size: [5, 1, 5] },
    // Moving platforms over the void.
    { k: "plat", at: [-2.5, 10, -99], size: [3, 1, 3], move: { by: [5, 0, 0], period: 3.2 } },
    { k: "plat", at: [2.5, 11, -105.5], size: [3, 1, 3], move: { by: [-5, 0, 0], period: 3.2, phase: 0.5 } },
    { k: "plat", at: [0, 12, -112], size: [3, 1, 3], move: { by: [0, 3, 0], period: 3 } },
    { k: "check", at: [0, 12, -119], size: [6, 1, 6] },
    // Sweeping kill bricks.
    { k: "plat", at: [0, 12, -131], size: [4, 1, 14] },
    { k: "kill", at: [-3, 13.2, -128.5], size: [1.4, 1.2, 1.4], move: { by: [6, 0, 0], period: 2.4 } },
    { k: "kill", at: [3, 13.2, -133.5], size: [1.4, 1.2, 1.4], move: { by: [-6, 0, 0], period: 2.4 } },
    { k: "finish", at: [0, 14.6, -144], size: [6, 1, 6] },
  ],
  signs: [
    { at: [3.4, 5.3, -13.5], text: "Space in the air: double jump" },
    { at: [3.8, 5.3, -41], text: "Jump into a wall, then jump to kick off" },
    { at: [2.6, 12.3, -57.5], text: "Sprint against the belt" },
    { at: [3.2, 12.3, -73], text: "Cyan pads: speed boost" },
  ],
};

const STORMSPIRE: CourseDef = {
  id: "stormspire",
  name: "Storm Spire",
  difficulty: "Hard",
  blurb: "Wall runs over open sky, a tall chimney, pillar hops and a boosted finale.",
  teaches: ["Wall runs", "Wall-run jumps", "Chimney climbs", "Precision", "Combos"],
  medals: [150, 100, 70],
  doubleJump: true,
  killY: -16,
  sky: { top: "#27325e", horizon: "#f6b77a" },
  pieces: [
    { k: "start", at: [0, 0, 0], size: [8, 1, 8] },
    // Wall run lesson: the gap is far too wide to jump.
    { k: "plat", at: [0, 0, -11], size: [4, 1, 10] },
    { k: "wall", at: [-3.5, 6, -27], size: [1, 9, 18] },
    { k: "check", at: [0, 0.5, -39], size: [8, 1, 6] },
    // Zigzag: right wall, then left wall.
    { k: "wall", at: [3.5, 7, -52], size: [1, 9, 12] },
    { k: "wall", at: [-3.5, 7, -66], size: [1, 9, 12] },
    { k: "check", at: [0, 2, -78], size: [8, 1, 6] },
    // Pillar hops.
    { k: "plat", at: [2, 3, -85], size: [1.6, 1, 1.6] },
    { k: "plat", at: [-1, 4, -90], size: [1.6, 1, 1.6] },
    { k: "plat", at: [2, 5, -95], size: [1.6, 1, 1.6] },
    { k: "plat", at: [-1, 6, -100], size: [1.6, 1, 1.6] },
    { k: "check", at: [0, 6, -106], size: [5, 1, 5] },
    // Chimney over the void.
    { k: "wall", at: [-2.25, 18, -115], size: [1, 14, 6] },
    { k: "wall", at: [2.25, 18, -115], size: [1, 14, 6] },
    { k: "plat", at: [0, 15, -123], size: [6, 1, 6] },
    // Bounce over the gap.
    { k: "bounce", at: [0, 12.5, -130], size: [4, 0.5, 4], power: 24 },
    { k: "check", at: [0, 17, -138], size: [5, 1, 4] },
    // Boosted wall run to the finish.
    { k: "plat", at: [0, 17, -146], size: [4, 1, 12] },
    { k: "boost", at: [0, 17.25, -143], size: [3, 0.25, 2], dir: [0, -1] },
    { k: "wall", at: [-3.5, 22, -164], size: [1, 10, 22] },
    { k: "finish", at: [0, 17, -182], size: [6, 1, 6] },
  ],
  signs: [
    { at: [3.6, 2.6, -8], text: "Sprint along the wall to wall run" },
    { at: [-3.6, 4.6, -40], text: "Jump off one wall onto the next" },
    { at: [3.4, 8.6, -103], text: "Climb the chimney" },
  ],
};

export const COURSES: CourseDef[] = [MEADOW, CLOUDWORKS, STORMSPIRE];

export function courseById(id: string): CourseDef | undefined {
  return COURSES.find((c) => c.id === id);
}

/** The next course in the list, if any. */
export function nextCourse(id: CourseId): CourseDef | undefined {
  const i = COURSES.findIndex((c) => c.id === id);
  return i >= 0 ? COURSES[i + 1] : undefined;
}

/** Ping-pong offset of a moving piece at `time` (eased at both ends). */
export function pieceOffset(piece: Piece, time: number): [number, number, number] {
  if (!piece.move) return [0, 0, 0];
  const { by, period, phase = 0 } = piece.move;
  const f = 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / period + phase));
  return [by[0] * f, by[1] * f, by[2] * f];
}

/** Bounds of a piece at `time`. */
export function pieceBounds(piece: Piece, time = 0): { min: Vec3; max: Vec3 } {
  const [ox, oy, oz] = pieceOffset(piece, time);
  const [x, top, z] = piece.at;
  const [w, h, d] = piece.size;
  return {
    min: { x: x + ox - w / 2, y: top + oy - h, z: z + oz - d / 2 },
    max: { x: x + ox + w / 2, y: top + oy, z: z + oz + d / 2 },
  };
}

export interface Course {
  def: CourseDef;
  world: PhysWorld;
  /** Index 0 is the start pad; then each checkpoint in course order. */
  spawns: Spawn[];
  /** Box index of each spawn's pad. */
  spawnBoxes: number[];
  /** The finish pad's box index. */
  finishBox: number;
  /** World time the boxes are currently at. */
  time: number;
}

/** Facing -Z (straight down the course). */
const FORWARD = Math.PI;

/** Builds the collision world for a course. */
export function buildCourse(def: CourseDef): Course {
  const boxes: Box[] = [];
  const spawns: Spawn[] = [];
  const spawnBoxes: number[] = [];
  let finishBox = -1;
  let checkpoints = 0;
  for (const piece of def.pieces) {
    const { min, max } = pieceBounds(piece, 0);
    const id = boxes.length;
    let checkpoint = -1;
    if (piece.k === "start") checkpoint = 0;
    if (piece.k === "check") checkpoint = ++checkpoints;
    const dir = piece.dir ?? [0, 0];
    const len = Math.hypot(dir[0], dir[1]) || 1;
    boxes.push({
      id,
      kind: piece.k,
      min,
      max,
      delta: { x: 0, y: 0, z: 0 },
      solid: piece.k !== "kill",
      dirX: dir[0] / len,
      dirZ: dir[1] / len,
      speed: piece.speed ?? 0,
      power: piece.power ?? PHYS.bouncePower,
      checkpoint,
    });
    if (checkpoint >= 0) {
      spawns[checkpoint] = { x: (min.x + max.x) / 2, y: max.y, z: (min.z + max.z) / 2, facing: FORWARD };
      spawnBoxes[checkpoint] = id;
    }
    if (piece.k === "finish") finishBox = id;
  }
  const fb = finishBox >= 0 ? boxes[finishBox] : null;
  // The portal: a volume standing on the finish pad.
  const finish = fb
    ? {
        min: { x: fb.min.x + 0.8, y: fb.max.y + 0.05, z: fb.min.z + 0.8 },
        max: { x: fb.max.x - 0.8, y: fb.max.y + 4, z: fb.max.z - 0.8 },
      }
    : null;
  const world: PhysWorld = {
    boxes,
    solids: boxes.filter((b) => b.solid),
    hazards: boxes.filter((b) => b.kind === "kill"),
    killY: def.killY,
    finish,
    doubleJump: def.doubleJump,
  };
  return { def, world, spawns, spawnBoxes, finishBox, time: 0 };
}

/** Moves the moving pieces to `time`, recording how far each moved (for carrying the player). */
export function advanceCourse(course: Course, time: number): void {
  const { pieces } = course.def;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const box = course.world.boxes[i];
    if (!piece.move) continue;
    const { min, max } = pieceBounds(piece, time);
    box.delta.x = min.x - box.min.x;
    box.delta.y = min.y - box.min.y;
    box.delta.z = min.z - box.min.z;
    box.min = min;
    box.max = max;
  }
  course.time = time;
}

/** Centre and size of a course, for framing the preview camera. */
export function courseBounds(def: CourseDef): { center: Vec3; radius: number } {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of def.pieces) {
    const { min, max } = pieceBounds(p, 0);
    minX = Math.min(minX, min.x);
    minY = Math.min(minY, min.y);
    minZ = Math.min(minZ, min.z);
    maxX = Math.max(maxX, max.x);
    maxY = Math.max(maxY, max.y);
    maxZ = Math.max(maxZ, max.z);
  }
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
  return { center, radius };
}

/** Number of checkpoints (not counting the start). */
export function checkpointCount(def: CourseDef): number {
  return def.pieces.filter((p) => p.k === "check").length;
}
