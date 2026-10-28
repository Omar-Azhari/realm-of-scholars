/**
 * "Can this course be finished?" A reachability check over sampled player positions,
 * using the controller's own constants and integration. Used by the tests so every
 * course stays completable when it is edited, and so each trick is really needed where
 * the course says it teaches it.
 *
 * Nodes:
 *  - ground: standing spots sampled on every solid top (moving pieces at several phases);
 *    all spots on one piece connect to each other (you can walk or ride there).
 *  - wall: places where the body touches a side face at a given height.
 * Edges:
 *  - jumps (with the double jump if the course has it) and bounce-pad launches, from a
 *    ground spot to any ground spot or wall touch within the jump's reach;
 *  - wall jumps from a wall touch, away from that wall;
 *  - wall runs along the same face (when the touch came with enough speed), then the
 *    wall-run jump.
 * Hazards and ceilings are ignored, so this is "completable in principle".
 */

import { DOUBLE_JUMP_V, JUMP_V, PHYS, WALL_JUMP_V, overlapsBox, type Box } from "./physics";
import { pieceBounds, type Course } from "./courses";

export interface ReachOptions {
  /** Allow wall jumps and wall runs. */
  walls?: boolean;
  /** Override the course's double jump. */
  doubleJump?: boolean;
  /** Multiply every speed and launch by this (below 1 = demand slack, not pixel-perfect jumps). */
  margin?: number;
}

const DH_MIN = -60;
const DH_MAX = 12;
const DH_STEP = 0.05;
const GRID = Math.round((DH_MAX - DH_MIN) / DH_STEP) + 1;

/**
 * For each height change dh, the longest time a launch (one of a set of trajectories)
 * can still be at or above dh after leaving. -1 when it never gets that high.
 */
function airtimeTable(vy0: number, doubleJump: boolean, margin: number): Float64Array {
  const dt = PHYS.dt;
  const g = PHYS.gravity;
  const traj = (v0: number, djStep: number): number[] => {
    const ys: number[] = [0];
    let y = 0;
    let v = v0;
    for (let i = 1; i < 4 / dt; i++) {
      if (i === djStep) v = DOUBLE_JUMP_V * margin;
      v = Math.max(-PHYS.maxFall, v - g * dt);
      y += v * dt;
      ys.push(y);
      if (y < DH_MIN - 1) break;
    }
    return ys;
  };
  const launches: number[][] = [traj(vy0, -1)];
  if (doubleJump) {
    const apex = Math.round(vy0 / (g * dt));
    for (let k = Math.max(1, apex - 6); k <= apex + 70; k += 3) launches.push(traj(vy0, k));
  }
  const table = new Float64Array(GRID).fill(-1);
  for (const ys of launches) {
    // Walking back from the end, the first time a height level is reached is the
    // latest moment the trajectory is at or above it.
    let filled = -1;
    for (let i = ys.length - 1; i >= 0 && filled < GRID - 1; i--) {
      const top = Math.min(GRID - 1, Math.floor((ys[i] - DH_MIN) / DH_STEP + 1e-9));
      for (let gi = filled + 1; gi <= top; gi++) table[gi] = Math.max(table[gi], i * dt);
      if (top > filled) filled = top;
    }
  }
  return table;
}

const tableCache = new Map<string, Float64Array>();
function cachedTable(vy0: number, doubleJump: boolean, margin: number): Float64Array {
  const key = `${vy0.toFixed(4)}|${doubleJump}|${margin}`;
  let t = tableCache.get(key);
  if (!t) {
    t = airtimeTable(vy0, doubleJump, margin);
    tableCache.set(key, t);
  }
  return t;
}

/** Longest airtime that stays at or above dh (rounded so it never overstates). */
function airtime(table: Float64Array, dh: number): number {
  if (dh > DH_MAX) return -1;
  if (dh < DH_MIN) return table[0];
  return table[Math.ceil((dh - DH_MIN) / DH_STEP - 1e-9)];
}

interface Node {
  kind: "ground" | "wall";
  x: number;
  y: number;
  z: number;
  /** Piece index (ground) or face key (wall). */
  piece: number;
  face: string;
  nx: number;
  nz: number;
  /** Along-face coordinate (wall nodes). */
  u: number;
  canRun: boolean;
  bounce: boolean;
  boosted: boolean;
  /** Ground spot on the edge of its piece. */
  rim: boolean;
}

/** Speed you arrive at a wall with, for starting a wall run: 0 none, else the speed. */
type State = { node: number; speed: number; running: boolean };

export interface ReachGraph {
  nodes: Node[];
  /** Node indices sorted by z, and their z values (for range scans). */
  byZ: number[];
  zs: number[];
  /** Wall node indices per face. */
  byFace: Map<string, number[]>;
  /** Node indices per piece (ground nodes only). */
  byPiece: Map<number, number[]>;
}

const SAMPLE = 1.0;
/** Wall touch spacing along a face and in height. */
const WALL_U = 1.5;
const WALL_Y = 1.0;

function samples(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  const n = Math.max(1, Math.ceil((b - a) / step));
  for (let i = 0; i <= n; i++) out.push(i === n ? b : a + ((b - a) * i) / n);
  return out;
}

function buildGraph(course: Course): ReachGraph {
  const { def, world } = course;
  const nodes: Node[] = [];
  const byPiece = new Map<number, number[]>();
  const solids = world.solids;
  const free = (x: number, y: number, z: number, ignore?: Box) => solids.every((b) => b === ignore || !overlapsBox(x, y, z, b));
  const boostPads = def.pieces.map((p, i) => ({ p, i })).filter(({ p }) => p.k === "boost");

  def.pieces.forEach((piece, index) => {
    if (piece.k === "kill") return;
    const phases = piece.move ? Array.from({ length: 8 }, (_, k) => (k / 8) * piece.move!.period) : [0];
    for (const t of phases) {
      const { min, max } = pieceBounds(piece, t);
      const box = world.boxes[index];
      // Standing spots on the top.
      for (const x of samples(min.x, max.x, SAMPLE)) {
        for (const z of samples(min.z, max.z, SAMPLE)) {
          if (!free(x, max.y, z, box)) continue;
          const near = boostPads.some(({ p, i }) => {
            if (i === index) return true;
            const b = pieceBounds(p, 0);
            return Math.abs(b.min.y - max.y) < 0.05 && Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z)) <= 8;
          });
          const id = nodes.length;
          const rim = x === min.x || x === max.x || z === min.z || z === max.z;
          nodes.push({ kind: "ground", x, y: max.y, z, piece: index, face: "", nx: 0, nz: 0, u: 0, canRun: false, bounce: piece.k === "bounce", boosted: near, rim });
          const list = byPiece.get(index) ?? [];
          list.push(id);
          byPiece.set(index, list);
        }
      }
      if (piece.move) continue; // walls of moving pieces aren't sampled
      // Wall touches on the four side faces.
      const yLo = min.y - PHYS.height + PHYS.wallTouchOverlap;
      const yHi = max.y - PHYS.wallTouchOverlap;
      if (yHi < yLo) continue;
      const faces: Array<{ nx: number; nz: number; fixed: number; a: number; b: number }> = [
        { nx: -1, nz: 0, fixed: min.x - PHYS.halfWidth, a: min.z, b: max.z },
        { nx: 1, nz: 0, fixed: max.x + PHYS.halfWidth, a: min.z, b: max.z },
        { nx: 0, nz: -1, fixed: min.z - PHYS.halfWidth, a: min.x, b: max.x },
        { nx: 0, nz: 1, fixed: max.z + PHYS.halfWidth, a: min.x, b: max.x },
      ];
      for (const f of faces) {
        const face = `${index}:${f.nx},${f.nz}`;
        for (const u of samples(f.a, f.b, WALL_U)) {
          for (const y of samples(yLo, yHi, WALL_Y)) {
            const x = f.nx !== 0 ? f.fixed : u;
            const z = f.nx !== 0 ? u : f.fixed;
            if (!free(x, y, z)) continue;
            const overlap = Math.min(y + PHYS.height, max.y) - Math.max(y, min.y);
            nodes.push({ kind: "wall", x, y, z, piece: index, face, nx: f.nx, nz: f.nz, u, canRun: overlap >= PHYS.wallRunOverlap, bounce: false, boosted: false, rim: false });
          }
        }
      }
    }
  });
  const byZ = nodes.map((_, i) => i).sort((a, b) => nodes[a].z - nodes[b].z);
  const byFace = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    if (n.kind !== "wall") return;
    const list = byFace.get(n.face) ?? [];
    list.push(i);
    byFace.set(n.face, list);
  });
  return { nodes, byPiece, byZ, zs: byZ.map((i) => nodes[i].z), byFace };
}

/** First index in sorted `zs` with value >= v. */
function lowerBound(zs: number[], v: number): number {
  let lo = 0;
  let hi = zs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (zs[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Furthest horizontal distance any launch is checked over. */
const MAX_REACH = 32;

export interface ReachResult {
  /** Visited node flags. */
  reached: boolean[];
  graph: ReachGraph;
}

/** Explores everything reachable from the ground spots of `fromPiece`. */
export function explore(course: Course, fromPiece: number, options: ReachOptions = {}, graph: ReachGraph = buildGraph(course)): ReachResult {
  const walls = options.walls ?? true;
  const dj = options.doubleJump ?? course.def.doubleJump;
  const m = options.margin ?? 1;
  const { nodes, byPiece, byZ, zs } = graph;
  const jumpT = cachedTable(JUMP_V * m, dj, m);
  const wallT = cachedTable(WALL_JUMP_V * m, dj, m);
  const bounceT = (power: number) => cachedTable(power * m, dj, m);

  const reached = new Array<boolean>(nodes.length).fill(false);
  /** Best wall-arrival speed seen per wall node (to allow re-expansion with more speed). */
  const bestSpeed = new Float64Array(nodes.length).fill(-1);
  const runVisited = new Array<boolean>(nodes.length).fill(false);
  const queue: State[] = [];
  const visitGround = (id: number) => {
    const n = nodes[id];
    if (reached[id]) return;
    if (n.bounce) {
      reached[id] = true;
      queue.push({ node: id, speed: 0, running: false });
      return;
    }
    for (const other of byPiece.get(n.piece) ?? []) {
      if (reached[other]) continue;
      reached[other] = true;
      queue.push({ node: other, speed: 0, running: false });
    }
  };
  const visitWall = (id: number, speed: number, running: boolean) => {
    if (running) {
      if (runVisited[id]) return;
      runVisited[id] = true;
      reached[id] = true;
      queue.push({ node: id, speed, running: true });
      return;
    }
    if (bestSpeed[id] >= speed) return;
    bestSpeed[id] = speed;
    reached[id] = true;
    queue.push({ node: id, speed, running: false });
  };
  for (const id of byPiece.get(fromPiece) ?? []) visitGround(id);

  /** Launch from (x,y,z) at horizontal speed S with an airtime table; optional half-space (away from a wall). */
  const launch = (from: Node, S: number, table: Float64Array, arrivalSpeed: number, away?: { nx: number; nz: number; face: string }) => {
    const end = lowerBound(zs, from.z + MAX_REACH + 1e-9);
    for (let k = lowerBound(zs, from.z - MAX_REACH); k < end; k++) {
      const j = byZ[k];
      const t = nodes[j];
      if (t.kind === "ground" && t.piece === from.piece && from.kind === "ground" && !from.bounce) continue;
      if (t.kind === "wall" && !walls) continue;
      const dx = t.x - from.x;
      const dz = t.z - from.z;
      if (away) {
        if (t.kind === "wall" && t.face === away.face) continue;
        // Only things out on the open side of the wall (you're kicked away from it).
        if (dx * away.nx + dz * away.nz < 0.3) continue;
      }
      const d = Math.hypot(dx, dz);
      if (d > MAX_REACH) continue;
      if (t.kind === "ground") {
        if (reached[j]) continue;
        const air = airtime(table, t.y - from.y);
        if (air >= 0 && d <= S * air) visitGround(j);
      } else {
        // Touch the wall anywhere in the band around this height.
        const air = airtime(table, t.y - from.y - WALL_Y / 2);
        if (air >= 0 && d <= S * air) visitWall(j, arrivalSpeed, false);
      }
    }
  };

  // A higher launch from the same spot on a wall reaches everything a lower one does
  // (more airtime for every target), so lower ones are skipped once a higher one launched.
  const launched = new Map<string, Array<[number, number]>>();
  const dominated = (n: Node, speed: number, running: boolean): boolean => {
    const k = `${n.face}|${n.u}|${running}`;
    const list = launched.get(k) ?? [];
    if (list.some(([s, y]) => s >= speed && y >= n.y)) return true;
    list.push([speed, n.y]);
    launched.set(k, list);
    return false;
  };

  for (let head = 0; head < queue.length; head++) {
    const st = queue[head];
    const n = nodes[st.node];
    if (n.kind === "ground") {
      // Only the rim launches: from inside a piece you'd run to its edge first.
      if (!n.rim && !n.bounce) continue;
      const S = (n.boosted ? PHYS.boostSpeed : PHYS.sprintSpeed) * m;
      if (n.bounce) launch(n, PHYS.sprintSpeed * m, bounceT(course.world.boxes[n.piece].power), S);
      else launch(n, S, jumpT, S);
      continue;
    }
    if (!walls) continue;
    if (dominated(n, st.speed, st.running)) continue;
    if (st.running) {
      // Wall-run jump: speed along the wall carries on, plus the kick away.
      launch(n, Math.max(PHYS.sprintSpeed * m, st.speed) * 0.85, wallT, Math.max(PHYS.sprintSpeed * m, st.speed) * 0.85, { nx: n.nx, nz: n.nz, face: n.face });
      continue;
    }
    // Plain wall jump: kicked away at the push speed; no wall run straight after.
    launch(n, PHYS.wallJumpPush * m, wallT, 0, { nx: n.nx, nz: n.nz, face: n.face });
    // Wall run along this face, if you arrived fast enough.
    if (n.canRun && st.speed >= PHYS.wallRunMinSpeed) {
      const runSpeed = Math.max(PHYS.wallRunSpeed * m, st.speed);
      const reach = runSpeed * PHYS.wallRunTime * 0.9;
      for (const j of graph.byFace.get(n.face) ?? []) {
        const t = nodes[j];
        if (!t.canRun) continue;
        if (Math.abs(t.u - n.u) > reach) continue;
        if (t.y < n.y - 1 || t.y > n.y + 0.6) continue;
        visitWall(j, runSpeed, true);
      }
    }
  }
  return { reached, graph };
}

/** Is any ground spot of `toPiece` reachable from `fromPiece`? */
export function canReach(course: Course, fromPiece: number, toPiece: number, options: ReachOptions = {}): boolean {
  const { reached, graph } = explore(course, fromPiece, options);
  return (graph.byPiece.get(toPiece) ?? []).some((id) => reached[id]);
}

/** Start to finish, and every checkpoint both reachable from the start and able to reach the finish. */
export function courseCompletable(course: Course, options: ReachOptions = {}): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const start = course.spawnBoxes[0];
  const finish = course.finishBox;
  if (start === undefined || finish < 0) return { ok: false, problems: ["missing start or finish"] };
  const graph = buildGraph(course);
  const fromStart = explore(course, start, options, graph);
  const reaches = (res: ReachResult, piece: number) => (graph.byPiece.get(piece) ?? []).some((id) => res.reached[id]);
  if (!reaches(fromStart, finish)) problems.push("finish not reachable from the start");
  course.spawnBoxes.forEach((piece, i) => {
    if (i === 0) return;
    if (!reaches(fromStart, piece)) problems.push(`checkpoint ${i} not reachable from the start`);
    const fromCp = explore(course, piece, options, graph);
    if (!reaches(fromCp, finish)) problems.push(`finish not reachable from checkpoint ${i}`);
  });
  return { ok: problems.length === 0, problems };
}
