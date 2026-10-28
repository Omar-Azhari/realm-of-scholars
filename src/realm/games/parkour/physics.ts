/**
 * Parkour character controller: pure, deterministic, framework-free (unit-tested in
 * scripts/verify-realm.ts).
 *
 * The player is an axis-aligned box (feet at `pos`) moving through axis-aligned boxes.
 * Physics runs at a fixed 120 Hz. Movement is split into sub-steps no longer than
 * MAX_SUBSTEP and resolved one axis at a time, so nothing tunnels even at terminal
 * velocity (a sub-step is far shorter than the player is tall or wide).
 *
 * Feel (Roblox-obby style): snappy gravity, coyote time, jump buffering, variable jump
 * height (let go early for a short hop), strong air control, Shift to sprint on a stamina
 * bar, an optional double jump, wall jumps (kick away from a wall you're touching) and
 * wall runs (sprint alongside a wall to run along it for a moment).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BoxKind = "plat" | "start" | "check" | "finish" | "kill" | "bounce" | "boost" | "conveyor" | "wall";

export interface Box {
  id: number;
  kind: BoxKind;
  /** Current bounds (moving boxes are updated by the course every step). */
  min: Vec3;
  max: Vec3;
  /** How far the box moved during the last world step (carries whoever stands on it). */
  delta: Vec3;
  solid: boolean;
  /** Conveyor / speed-pad direction (unit XZ vector) and conveyor speed. */
  dirX: number;
  dirZ: number;
  speed: number;
  /** Bounce pad launch speed. */
  power: number;
  /** Checkpoint index for "check" boxes (start = 0), otherwise -1. */
  checkpoint: number;
}

export interface PhysWorld {
  boxes: Box[];
  /** Boxes the player collides with (subset of `boxes`). */
  solids: Box[];
  /** Kill bricks (not solid: touching one is enough). */
  hazards: Box[];
  /** Falling below this height respawns you. */
  killY: number;
  /** Touching this volume finishes the course. */
  finish: { min: Vec3; max: Vec3 } | null;
  doubleJump: boolean;
}

/** Tuning. Units are metres-ish (the character is 1.75 tall) and seconds. */
export const PHYS = {
  dt: 1 / 120,
  gravity: 45,
  maxFall: 60,
  jumpHeight: 2.0,
  doubleJumpHeight: 1.5,
  walkSpeed: 7,
  sprintSpeed: 11,
  boostSpeed: 16,
  groundAccel: 90,
  groundFriction: 70,
  airAccel: 34,
  coyoteTime: 0.11,
  jumpBuffer: 0.13,
  /** Vertical speed kept when jump is let go while rising. */
  jumpCut: 0.45,
  halfWidth: 0.32,
  height: 1.75,
  stepHeight: 0.45,
  /** In the air, a ledge this close above your feet is climbed onto (forgiving ledges). */
  ledgeAssist: 0.4,
  staminaDrain: 0.3,
  staminaRegen: 0.42,
  staminaDelay: 0.45,
  /** After running dry, sprinting comes back once stamina refills to this. */
  staminaRestart: 0.25,
  wallProbe: 0.08,
  wallJumpHeight: 1.9,
  wallJumpPush: 8.5,
  wallJumpLock: 0.16,
  wallRunMinSpeed: 6.5,
  wallRunSpeed: 11,
  wallRunTime: 1.2,
  wallRunStartVy: 3,
  wallRunGravity: 6,
  wallRunCooldown: 0.25,
  /** Body overlap with the wall needed to wall run (wall jumps need less). */
  wallRunOverlap: 1.0,
  wallTouchOverlap: 0.6,
  boostTime: 1.8,
  bouncePower: 24,
  /** Landing faster than this plays a roll. */
  rollImpact: 19,
} as const;

const HW = PHYS.halfWidth;
const H = PHYS.height;
const EPS = 1e-5;
/** Longest single collision sub-step (much shorter than the player's width or height). */
export const MAX_SUBSTEP = 0.25;

/**
 * Launch speed that reaches `height` at the apex with the controller's integration
 * (velocity first, then position, at the fixed step).
 */
export function launchSpeed(height: number, gravity: number = PHYS.gravity, dt: number = PHYS.dt): number {
  return Math.sqrt(2 * gravity * height) + (gravity * dt) / 2;
}

export const JUMP_V = launchSpeed(PHYS.jumpHeight);
export const DOUBLE_JUMP_V = launchSpeed(PHYS.doubleJumpHeight);
export const WALL_JUMP_V = launchSpeed(PHYS.wallJumpHeight);

export interface WallContact {
  /** Unit normal pointing away from the wall (towards the player), on one axis. */
  nx: number;
  nz: number;
  boxId: number;
  /** How much of the body overlaps the wall vertically. */
  overlap: number;
  key: string;
}

export interface WallRun {
  key: string;
  nx: number;
  nz: number;
  /** Running direction along the wall. */
  tx: number;
  tz: number;
  time: number;
  /** +1 when the wall is on the runner's right, -1 on the left. */
  side: number;
}

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  facing: number;
  grounded: boolean;
  groundId: number;
  coyote: number;
  buffer: number;
  jumpHeld: boolean;
  /** True while a variable-height jump can still be cut short by letting go. */
  cutReady: boolean;
  airJumps: number;
  stamina: number;
  staminaWait: number;
  exhausted: boolean;
  sprinting: boolean;
  wall: WallContact | null;
  wallRun: WallRun | null;
  wallRunCooldown: number;
  lastWallRunKey: string | null;
  lastWallJumpKey: string | null;
  /** Seconds of no air control left after a wall jump. */
  lock: number;
  /** Seconds of speed-pad boost left. */
  boost: number;
  airTime: number;
  checkpoint: number;
}

export interface MoveInput {
  /** Desired move direction in world space (length 0..1). */
  x: number;
  z: number;
  jump: boolean;
  sprint: boolean;
}

export type PlayerEvent =
  | { type: "jump" }
  | { type: "doubleJump" }
  | { type: "wallJump" }
  | { type: "wallRunStart"; side: number }
  | { type: "wallRunEnd" }
  | { type: "land"; impact: number }
  | { type: "bounce" }
  | { type: "boost" }
  | { type: "checkpoint"; index: number }
  | { type: "death" }
  | { type: "finish" };

export interface Spawn {
  x: number;
  y: number;
  z: number;
  facing: number;
}

export function createPlayer(spawn: Spawn, world?: PhysWorld): PlayerState {
  return {
    pos: { x: spawn.x, y: spawn.y, z: spawn.z },
    vel: { x: 0, y: 0, z: 0 },
    facing: spawn.facing,
    grounded: true,
    groundId: -1,
    coyote: 0,
    buffer: 0,
    jumpHeld: false,
    cutReady: false,
    airJumps: world?.doubleJump ? 1 : 0,
    stamina: 1,
    staminaWait: 0,
    exhausted: false,
    sprinting: false,
    wall: null,
    wallRun: null,
    wallRunCooldown: 0,
    lastWallRunKey: null,
    lastWallJumpKey: null,
    lock: 0,
    boost: 0,
    airTime: 0,
    checkpoint: 0,
  };
}

/** Back to a spawn point: still, full stamina, nothing carried over. Keeps the checkpoint reached. */
export function respawn(s: PlayerState, spawn: Spawn, world: PhysWorld): void {
  const checkpoint = s.checkpoint;
  Object.assign(s, createPlayer(spawn, world));
  s.checkpoint = checkpoint;
}

export function overlapsBox(x: number, y: number, z: number, b: { min: Vec3; max: Vec3 }, grow = 0): boolean {
  return (
    x + HW + grow > b.min.x + EPS &&
    x - HW - grow < b.max.x - EPS &&
    y + H + grow > b.min.y + EPS &&
    y - grow < b.max.y - EPS &&
    z + HW + grow > b.min.z + EPS &&
    z - HW - grow < b.max.z - EPS
  );
}

function freeAt(world: PhysWorld, x: number, y: number, z: number): boolean {
  for (const b of world.solids) if (overlapsBox(x, y, z, b)) return false;
  return true;
}

interface MoveCtx {
  stepAllowed: number;
  landed: Box | null;
  ceiling: boolean;
  hitX: boolean;
  hitZ: boolean;
}

function moveY(s: PlayerState, world: PhysWorld, d: number, ctx: MoveCtx): void {
  if (d === 0) return;
  const p = s.pos;
  p.y += d;
  for (const b of world.solids) {
    if (!overlapsBox(p.x, p.y, p.z, b)) continue;
    if (d < 0) {
      p.y = b.max.y;
      ctx.landed = b;
    } else {
      p.y = b.min.y - H;
      ctx.ceiling = true;
    }
  }
}

function moveH(s: PlayerState, world: PhysWorld, axis: "x" | "z", d: number, ctx: MoveCtx): void {
  if (d === 0) return;
  const p = s.pos;
  p[axis] += d;
  for (const b of world.solids) {
    if (!overlapsBox(p.x, p.y, p.z, b)) continue;
    const rise = b.max.y - p.y;
    // Small ledges and steps: climb straight on instead of stopping.
    if (rise > 0 && rise <= ctx.stepAllowed && freeAt(world, p.x, b.max.y, p.z)) {
      p.y = b.max.y;
      ctx.landed = b;
      continue;
    }
    p[axis] = d > 0 ? b.min[axis] - HW : b.max[axis] + HW;
    if (axis === "x") ctx.hitX = true;
    else ctx.hitZ = true;
  }
}

/**
 * Moves the player by (dx, dy, dz) against the solid boxes, in sub-steps of at most
 * MAX_SUBSTEP, resolving Y then X then Z. Exported for the tunnelling tests.
 */
export function moveAndCollide(s: PlayerState, world: PhysWorld, dx: number, dy: number, dz: number, stepAllowed = 0): MoveCtx {
  const ctx: MoveCtx = { stepAllowed, landed: null, ceiling: false, hitX: false, hitZ: false };
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_SUBSTEP));
  for (let i = 0; i < n; i++) {
    moveY(s, world, dy / n, ctx);
    moveH(s, world, "x", dx / n, ctx);
    moveH(s, world, "z", dz / n, ctx);
  }
  if (ctx.landed && s.vel.y < 0) s.vel.y = 0;
  if (ctx.ceiling && s.vel.y > 0) s.vel.y = 0;
  if (ctx.hitX) s.vel.x = 0;
  if (ctx.hitZ) s.vel.z = 0;
  return ctx;
}

/** Pushes the player out of anything that moved into them (moving platforms). */
function depenetrate(s: PlayerState, world: PhysWorld): Box | null {
  const p = s.pos;
  let landed: Box | null = null;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const b of world.solids) {
      if (!overlapsBox(p.x, p.y, p.z, b)) continue;
      any = true;
      const up = b.max.y - p.y;
      const down = p.y + H - b.min.y;
      const px = b.max.x - (p.x - HW);
      const nx = p.x + HW - b.min.x;
      const pz = b.max.z - (p.z - HW);
      const nz = p.z + HW - b.min.z;
      const m = Math.min(up, down, px, nx, pz, nz);
      if (m === up) {
        p.y = b.max.y;
        if (s.vel.y < 0) s.vel.y = 0;
        landed = b;
      } else if (m === down) p.y = b.min.y - H;
      else if (m === px) p.x = b.max.x + HW;
      else if (m === nx) p.x = b.min.x - HW;
      else if (m === pz) p.z = b.max.z + HW;
      else p.z = b.min.z - HW;
    }
    if (!any) break;
  }
  return landed;
}

/** Is there ground within `range` below the feet? (Used so a jump pressed just before landing is buffered, not spent on the double jump.) */
export function groundWithin(s: PlayerState, world: PhysWorld, range: number): boolean {
  const p = s.pos;
  for (const b of world.solids) {
    if (p.x + HW <= b.min.x || p.x - HW >= b.max.x || p.z + HW <= b.min.z || p.z - HW >= b.max.z) continue;
    const gap = p.y - b.max.y;
    if (gap >= -0.01 && gap <= range) return true;
  }
  return false;
}

/** The wall the player is touching (side faces within a few centimetres), if any. */
export function probeWall(s: PlayerState, world: PhysWorld): WallContact | null {
  const p = s.pos;
  let best: WallContact | null = null;
  let bestGap = Infinity;
  for (const b of world.solids) {
    const overlap = Math.min(p.y + H, b.max.y) - Math.max(p.y, b.min.y);
    if (overlap < PHYS.wallTouchOverlap) continue;
    const zOverlap = Math.min(p.z + HW, b.max.z) - Math.max(p.z - HW, b.min.z);
    if (zOverlap > 0.05) {
      const gapR = b.min.x - (p.x + HW);
      if (gapR >= -0.02 && gapR <= PHYS.wallProbe && gapR < bestGap) {
        bestGap = gapR;
        best = { nx: -1, nz: 0, boxId: b.id, overlap, key: `${b.id}:-x` };
      }
      const gapL = p.x - HW - b.max.x;
      if (gapL >= -0.02 && gapL <= PHYS.wallProbe && gapL < bestGap) {
        bestGap = gapL;
        best = { nx: 1, nz: 0, boxId: b.id, overlap, key: `${b.id}:+x` };
      }
    }
    const xOverlap = Math.min(p.x + HW, b.max.x) - Math.max(p.x - HW, b.min.x);
    if (xOverlap > 0.05) {
      const gapF = b.min.z - (p.z + HW);
      if (gapF >= -0.02 && gapF <= PHYS.wallProbe && gapF < bestGap) {
        bestGap = gapF;
        best = { nx: 0, nz: -1, boxId: b.id, overlap, key: `${b.id}:-z` };
      }
      const gapB = p.z - HW - b.max.z;
      if (gapB >= -0.02 && gapB <= PHYS.wallProbe && gapB < bestGap) {
        bestGap = gapB;
        best = { nx: 0, nz: 1, boxId: b.id, overlap, key: `${b.id}:+z` };
      }
    }
  }
  return best;
}

function accelerateTo(v: Vec3, tx: number, tz: number, rate: number, dt: number): void {
  const dx = tx - v.x;
  const dz = tz - v.z;
  const len = Math.hypot(dx, dz);
  const step = rate * dt;
  if (len <= step || len === 0) {
    v.x = tx;
    v.z = tz;
  } else {
    v.x += (dx / len) * step;
    v.z += (dz / len) * step;
  }
}

function endWallRun(s: PlayerState, ev: PlayerEvent[], pushOff: boolean): void {
  const wr = s.wallRun;
  if (!wr) return;
  s.wallRun = null;
  s.wallRunCooldown = PHYS.wallRunCooldown;
  s.lastWallRunKey = wr.key;
  if (pushOff) {
    s.vel.x += wr.nx * 2;
    s.vel.z += wr.nz * 2;
  }
  ev.push({ type: "wallRunEnd" });
}

function wallJump(s: PlayerState, nx: number, nz: number, key: string, world: PhysWorld, carry: number): void {
  // Keep some speed along the wall, kick hard away from it, and launch up.
  const along = s.vel.x * -nz + s.vel.z * nx;
  s.vel.x = nx * PHYS.wallJumpPush + -nz * along * carry;
  s.vel.z = nz * PHYS.wallJumpPush + nx * along * carry;
  s.vel.y = WALL_JUMP_V;
  s.lock = PHYS.wallJumpLock;
  s.lastWallJumpKey = key;
  s.airJumps = world.doubleJump ? 1 : 0;
  s.cutReady = false;
  s.buffer = 0;
  s.coyote = 0;
}

/**
 * One fixed physics step. The world's moving boxes must already be at their new
 * positions for this step (with `delta` set). Returns what happened.
 */
export function stepPlayer(s: PlayerState, input: MoveInput, world: PhysWorld, dt: number = PHYS.dt): PlayerEvent[] {
  const ev: PlayerEvent[] = [];
  const p = s.pos;
  const v = s.vel;

  // 1. Ride whatever you're standing on (moving platforms, conveyors).
  if (s.groundId >= 0) {
    const g = world.boxes[s.groundId];
    if (g) {
      p.x += g.delta.x;
      p.y += g.delta.y;
      p.z += g.delta.z;
      if (g.kind === "conveyor") {
        p.x += g.dirX * g.speed * dt;
        p.z += g.dirZ * g.speed * dt;
      }
    }
  }
  const pushedOnto = depenetrate(s, world);
  if (pushedOnto) {
    s.grounded = true;
    s.groundId = pushedOnto.id;
  }

  // 2. Input and timers.
  let mx = input.x;
  let mz = input.z;
  const moveLen = Math.min(1, Math.hypot(mx, mz));
  if (moveLen > 1e-6) {
    const l = Math.hypot(mx, mz);
    mx = (mx / l) * moveLen;
    mz = (mz / l) * moveLen;
  } else {
    mx = 0;
    mz = 0;
  }
  const pressed = input.jump && !s.jumpHeld;
  s.jumpHeld = input.jump;
  s.buffer = pressed ? PHYS.jumpBuffer : Math.max(0, s.buffer - dt);
  s.lock = Math.max(0, s.lock - dt);
  s.wallRunCooldown = Math.max(0, s.wallRunCooldown - dt);
  s.boost = Math.max(0, s.boost - dt);

  // 3. Sprint and stamina.
  if (s.exhausted && s.stamina >= PHYS.staminaRestart) s.exhausted = false;
  const moving = moveLen > 0.1;
  s.sprinting = moving && (s.boost > 0 || (input.sprint && !s.exhausted && s.stamina > 0));
  if (s.boost > 0) {
    s.stamina = 1;
  } else if ((s.sprinting && moving) || s.wallRun) {
    s.stamina -= PHYS.staminaDrain * dt;
    s.staminaWait = PHYS.staminaDelay;
    if (s.stamina <= 0) {
      s.stamina = 0;
      s.exhausted = true;
      s.sprinting = false;
    }
  } else if (s.staminaWait > 0) {
    s.staminaWait = Math.max(0, s.staminaWait - dt);
  } else {
    s.stamina = Math.min(1, s.stamina + PHYS.staminaRegen * dt);
  }

  // 4. Jumps: wall-run jump, ground jump (with coyote time), wall jump, double jump.
  if (s.buffer > 0) {
    if (s.wallRun) {
      const wr = s.wallRun;
      const along = Math.max(PHYS.sprintSpeed, v.x * wr.tx + v.z * wr.tz);
      endWallRun(s, ev, false);
      s.vel.x = wr.tx * along;
      s.vel.z = wr.tz * along;
      wallJump(s, wr.nx, wr.nz, wr.key, world, 0.85);
      s.lock = PHYS.wallJumpLock * 0.6;
      ev.push({ type: "wallJump" });
    } else if (s.grounded || s.coyote > 0) {
      const g = s.groundId >= 0 ? world.boxes[s.groundId] : undefined;
      v.y = JUMP_V;
      if (g) {
        v.x += g.delta.x / dt;
        v.z += g.delta.z / dt;
        v.y += Math.max(0, g.delta.y / dt);
      }
      s.grounded = false;
      s.groundId = -1;
      s.coyote = 0;
      s.buffer = 0;
      s.cutReady = true;
      ev.push({ type: "jump" });
    } else if (s.wall && s.wall.key !== s.lastWallJumpKey) {
      wallJump(s, s.wall.nx, s.wall.nz, s.wall.key, world, 0.5);
      ev.push({ type: "wallJump" });
    } else if (pressed && s.airJumps > 0 && !groundWithin(s, world, Math.max(0, -v.y) * PHYS.jumpBuffer + 0.05)) {
      s.airJumps--;
      v.y = DOUBLE_JUMP_V;
      s.buffer = 0;
      s.cutReady = true;
      ev.push({ type: "doubleJump" });
    }
  }
  // Variable height: letting go while rising cuts the jump short.
  if (s.cutReady && !input.jump && v.y > 0) {
    v.y *= PHYS.jumpCut;
    s.cutReady = false;
  }
  if (v.y <= 0) s.cutReady = false;

  // 5. Horizontal velocity.
  if (s.wallRun) {
    const wr = s.wallRun;
    const spd = Math.max(PHYS.wallRunSpeed, v.x * wr.tx + v.z * wr.tz);
    v.x = wr.tx * spd - wr.nx * 1.5;
    v.z = wr.tz * spd - wr.nz * 1.5;
  } else {
    const top = s.boost > 0 ? PHYS.boostSpeed : s.sprinting ? PHYS.sprintSpeed : PHYS.walkSpeed;
    if (s.grounded) {
      accelerateTo(v, mx * top, mz * top, moving ? PHYS.groundAccel : PHYS.groundFriction, dt);
    } else if (s.lock <= 0 && moveLen > 0.05) {
      // Air control steers without bleeding off extra speed (from wall jumps or pads) too fast.
      const cur = Math.hypot(v.x, v.z);
      const keep = Math.max(top, cur - 3 * dt) * moveLen;
      const l = Math.hypot(mx, mz);
      accelerateTo(v, (mx / l) * keep, (mz / l) * keep, PHYS.airAccel, dt);
    }
  }

  // 6. Gravity.
  v.y = Math.max(-PHYS.maxFall, v.y - (s.wallRun ? PHYS.wallRunGravity : PHYS.gravity) * dt);

  // 7. Move.
  const wasGrounded = s.grounded;
  const fallSpeed = -v.y;
  const stepAllowed = wasGrounded ? PHYS.stepHeight : v.y <= 4 ? PHYS.ledgeAssist : 0;
  s.grounded = false;
  s.groundId = -1;
  const ctx = moveAndCollide(s, world, v.x * dt, v.y * dt, v.z * dt, stepAllowed);
  if (ctx.landed) {
    if (ctx.landed.kind === "bounce") {
      v.y = ctx.landed.power || PHYS.bouncePower;
      s.airJumps = world.doubleJump ? 1 : 0;
      s.lastWallJumpKey = null;
      s.lastWallRunKey = null;
      s.cutReady = false;
      s.coyote = 0;
      endWallRun(s, ev, false);
      ev.push({ type: "bounce" });
    } else {
      s.grounded = true;
      s.groundId = ctx.landed.id;
    }
  }

  // 8. Landing.
  if (s.grounded) {
    if (!wasGrounded) ev.push({ type: "land", impact: Math.max(0, fallSpeed) });
    s.airJumps = world.doubleJump ? 1 : 0;
    s.lastWallJumpKey = null;
    s.lastWallRunKey = null;
    s.coyote = PHYS.coyoteTime;
    s.airTime = 0;
    endWallRun(s, ev, false);
    const g = world.boxes[s.groundId];
    if (g?.kind === "boost") {
      if (s.boost < PHYS.boostTime - 0.3) ev.push({ type: "boost" });
      s.boost = PHYS.boostTime;
      s.stamina = 1;
      s.exhausted = false;
    }
    if (g && g.checkpoint > s.checkpoint) {
      s.checkpoint = g.checkpoint;
      ev.push({ type: "checkpoint", index: g.checkpoint });
    }
  } else {
    s.coyote = Math.max(0, s.coyote - dt);
    s.airTime += dt;
  }

  // 9. Walls: contact, wall-run start and stop.
  s.wall = s.grounded ? null : probeWall(s, world);
  if (s.wallRun) {
    const wr = s.wallRun;
    wr.time += dt;
    const along = mx * wr.tx + mz * wr.tz;
    const keep = !s.grounded && s.wall !== null && s.wall.key === wr.key && wr.time < PHYS.wallRunTime && along > 0.1 && !s.exhausted;
    if (!keep) endWallRun(s, ev, !s.grounded);
  } else if (!s.grounded && s.wall && s.wall.overlap >= PHYS.wallRunOverlap && s.wallRunCooldown <= 0 && s.wall.key !== s.lastWallRunKey && v.y > -8) {
    const w = s.wall;
    // Along-wall direction: whichever way you're already going.
    let tx = -w.nz;
    let tz = w.nx;
    let vt = v.x * tx + v.z * tz;
    if (vt < 0) {
      tx = -tx;
      tz = -tz;
      vt = -vt;
    }
    const along = mx * tx + mz * tz;
    const sprinting = s.boost > 0 || (input.sprint && !s.exhausted && s.stamina > 0);
    if (sprinting && vt >= PHYS.wallRunMinSpeed && along > 0.3) {
      // Wall on the right when (-n) points along right = (-tz, tx).
      const side = -w.nx * -tz + -w.nz * tx > 0 ? 1 : -1;
      s.wallRun = { key: w.key, nx: w.nx, nz: w.nz, tx, tz, time: 0, side };
      v.y = Math.max(v.y, PHYS.wallRunStartVy);
      s.airJumps = world.doubleJump ? 1 : 0;
      s.lastWallJumpKey = null;
      ev.push({ type: "wallRunStart", side });
    }
  }

  // 10. Facing.
  if (s.wallRun) s.facing = Math.atan2(s.wallRun.tx, s.wallRun.tz);
  else if (Math.hypot(v.x, v.z) > 0.5 && (moving || !s.grounded)) s.facing = Math.atan2(v.x, v.z);

  // 11. Hazards, the void, and the finish.
  if (p.y < world.killY) {
    ev.push({ type: "death" });
    return ev;
  }
  for (const k of world.hazards) {
    if (overlapsBox(p.x, p.y, p.z, k, 0.04)) {
      ev.push({ type: "death" });
      return ev;
    }
  }
  if (world.finish && overlapsBox(p.x, p.y, p.z, world.finish)) ev.push({ type: "finish" });
  return ev;
}

/** Camera-relative WASD: forward is where the camera looks (yaw 0 looks towards -Z). */
export function cameraRelative(forward: number, right: number, yaw: number): { x: number; z: number } {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let x = fx * forward + rx * right;
  let z = fz * forward + rz * right;
  const l = Math.hypot(x, z);
  if (l > 1) {
    x /= l;
    z /= l;
  }
  return { x, z };
}
