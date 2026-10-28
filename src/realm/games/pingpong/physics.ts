/**
 * Table-tennis ball physics: pure functions (no React or three.js) so they can be
 * unit-tested in scripts/verify-realm.ts.
 *
 * Axes: x across the table, y up, z along it. The player's end is +z (near the camera),
 * the rival's end is -z. Real table sizes in metres; the game plays the simulation a
 * little slower than real time (SIM_SPEED) so rallies are humanly playable.
 */

export const TABLE_LENGTH = 2.74;
export const TABLE_WIDTH = 1.525;
export const TABLE_HEIGHT = 0.76;
export const NET_HEIGHT = 0.1525;
export const NET_OVERHANG = 0.1525;
export const HALF_L = TABLE_LENGTH / 2;
export const HALF_W = TABLE_WIDTH / 2;
export const BALL_R = 0.02;
export const NET_TOP = TABLE_HEIGHT + NET_HEIGHT;

export const G = 9.81;
/** Bounce: share of vertical speed kept, share of horizontal speed kept. */
export const RESTITUTION = 0.88;
export const FRICTION = 0.9;
/** Spin effects: topspin dips the ball in flight and kicks it forward on the bounce. */
export const MAGNUS_TOP = 0.8;
export const MAGNUS_SIDE = 0.3;
export const SPIN_KICK = 0.9;
export const DRAG = 0.1;
/** Game seconds per real second. */
export const SIM_SPEED = 0.75;

/** The planes the paddles move in, just beyond each end of the table. */
export const PLAYER_PADDLE_Z = 1.62;
export const RIVAL_PADDLE_Z = -1.62;
/** How far from the paddle centre the ball can be and still be hit (forgiving on purpose). */
export const PADDLE_HIT_RADIUS = 0.16;
/** Where the player's paddle can go. */
export const PADDLE_X_RANGE = 1.05;
export const PADDLE_Y_MIN = 0.8;
export const PADDLE_Y_MAX = 1.4;

export type Side = "near" | "far";
export const otherSide = (s: Side): Side => (s === "near" ? "far" : "near");
export const sideOfZ = (z: number): Side => (z >= 0 ? "near" : "far");
/** Direction of play away from a side's end: near hits toward -z. */
export const towardOpponent = (s: Side): number => (s === "near" ? -1 : 1);

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Topspin (+) or backspin (-) relative to the direction of travel, -1..1. */
  spin: number;
  /** Sidespin: curves the ball toward +x (+) or -x (-), -1..1. */
  side: number;
}

export type BallEvent =
  | { type: "table"; side: Side; x: number; z: number }
  | { type: "net" }
  | { type: "floor"; x: number; z: number };

export const cloneBall = (b: Ball): Ball => ({ ...b });

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Forces only: gravity, drag, and the spin's Magnus push. Mutates the ball. */
export function flightStep(b: Ball, dt: number): void {
  const along = Math.abs(b.vz);
  b.vx += (-DRAG * b.vx + MAGNUS_SIDE * b.side * along) * dt;
  b.vy += (-G - DRAG * b.vy - MAGNUS_TOP * b.spin * along) * dt;
  b.vz += -DRAG * b.vz * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  // Spin wears off slowly in the air.
  b.spin *= 1 - 0.08 * dt;
  b.side *= 1 - 0.08 * dt;
}

/** Whether a point (x, z) is over the table top. */
export function overTable(x: number, z: number): boolean {
  return Math.abs(x) <= HALF_W && Math.abs(z) <= HALF_L;
}

/**
 * One physics step with collisions: table bounce, net, floor. Mutates the ball and
 * returns what it touched. Keep dt small (1/240 s) so the ball can't tunnel.
 */
export function stepBall(b: Ball, dt: number): BallEvent[] {
  const events: BallEvent[] = [];
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  flightStep(b, dt);

  // Net: a crossing of z = 0 low enough to touch the tape or the mesh.
  if ((pz > 0 && b.z <= 0) || (pz < 0 && b.z >= 0)) {
    const f = pz === b.z ? 0 : pz / (pz - b.z);
    const y = py + (b.y - py) * f;
    const x = px + (b.x - px) * f;
    if (Math.abs(x) <= HALF_W + NET_OVERHANG && y - BALL_R < NET_TOP && y + BALL_R > TABLE_HEIGHT) {
      events.push({ type: "net" });
      if (y > NET_TOP - BALL_R * 0.9) {
        // Clipped the tape: it dribbles over, slowly.
        b.vz *= 0.3;
        b.vx *= 0.6;
        b.vy = Math.max(0, b.vy) * 0.3 + 0.55;
        b.spin = 0;
        b.side = 0;
      } else {
        // Into the mesh: it drops back on the hitter's side.
        b.z = Math.sign(pz || 1) * BALL_R * 1.05;
        b.vz = -b.vz * 0.12;
        b.vx *= 0.4;
        b.vy = Math.min(b.vy, 0) * 0.5;
        b.spin = 0;
        b.side = 0;
      }
    }
  }

  // Table top.
  if (b.vy < 0 && b.y - BALL_R <= TABLE_HEIGHT && py - BALL_R > TABLE_HEIGHT - 1e-9) {
    const f = (py - BALL_R - TABLE_HEIGHT) / Math.max(1e-9, py - b.y);
    const x = px + (b.x - px) * f;
    const z = pz + (b.z - pz) * f;
    if (overTable(x, z)) {
      events.push({ type: "table", side: sideOfZ(z), x, z });
      b.y = TABLE_HEIGHT + BALL_R;
      b.vy = -b.vy * RESTITUTION * (1 - 0.1 * b.spin);
      const dir = Math.sign(b.vz) || 1;
      const kicked = Math.abs(b.vz) * FRICTION + b.spin * SPIN_KICK;
      b.vz = dir * Math.max(Math.abs(b.vz) * 0.3, kicked);
      b.vx = b.vx * FRICTION + b.side * 0.25;
      b.spin *= 0.5;
      b.side *= 0.6;
    }
  }

  // Floor.
  if (b.y - BALL_R <= 0 && b.vy < 0) {
    events.push({ type: "floor", x: b.x, z: b.z });
    b.y = BALL_R;
    b.vy = -b.vy * 0.5;
    b.vx *= 0.7;
    b.vz *= 0.7;
    b.spin = 0;
    b.side = 0;
  }
  return events;
}

export const STEP = 1 / 240;

/** Where a ball in flight (no collisions) first comes down to table height, and when. */
export function landingPoint(b: Ball, maxT = 3): { x: number; z: number; t: number } | null {
  const c = cloneBall(b);
  let t = 0;
  while (t < maxT) {
    flightStep(c, STEP);
    t += STEP;
    if (c.vy < 0 && c.y - BALL_R <= TABLE_HEIGHT) return { x: c.x, z: c.z, t };
  }
  return null;
}

/** How far above the net tape a ball in flight passes (negative: it hits the net). Null if it never crosses. */
export function netClearance(b: Ball, maxT = 3): number | null {
  const c = cloneBall(b);
  let t = 0;
  while (t < maxT) {
    const pz = c.z;
    flightStep(c, STEP);
    t += STEP;
    if ((pz > 0 && c.z <= 0) || (pz < 0 && c.z >= 0)) return c.y - BALL_R - NET_TOP;
    if (c.y < 0) return null;
  }
  return null;
}

export interface Shot {
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  side: number;
}

/**
 * The velocity that sends a ball from `from` to land on the table at `landing`, travelling
 * at about `speed` m/s along the table, with the given spin. Spin is compensated for, so the
 * ball lands where aimed — but nothing guarantees it clears the net: a fast, flat shot from a
 * low contact point goes into the net, as it should.
 */
export function aimShot(from: { x: number; y: number; z: number }, landing: { x: number; z: number }, speed: number, spin: number, side = 0): Shot {
  const dx = landing.x - from.x;
  const dz = landing.z - from.z;
  const dist = Math.max(0.2, Math.hypot(dx, dz));
  const T = dist / Math.max(1, speed);
  let vx = dx / T;
  let vz = dz / T;
  const vy = (TABLE_HEIGHT + BALL_R - from.y + 0.5 * G * T * T) / T;
  let shot: Shot = { vx, vy, vz, spin, side };
  for (let i = 0; i < 6; i++) {
    const land = landingPoint({ x: from.x, y: from.y, z: from.z, ...shot });
    if (!land) break;
    const ex = land.x - landing.x;
    const ez = land.z - landing.z;
    if (Math.abs(ex) < 0.004 && Math.abs(ez) < 0.004) break;
    vx -= ex / land.t;
    vz -= ez / land.t;
    shot = { ...shot, vx, vz };
  }
  return shot;
}

/** Where and how the paddle is moving at contact (m/s). */
export interface PaddleMotion {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Return {
  shot: Shot;
  landing: { x: number; z: number };
  /** 0..1.3: how hard the swing was (above ~1.1 the ball sails long). */
  power: number;
}

/**
 * The player's return. Where the ball meets the paddle aims it (an edge hit angles it
 * toward that edge, like Pong); swing speed sets the pace and depth (too hard and it goes
 * long); vertical motion brushes topspin (swinging up) or backspin (chopping down);
 * sideways motion adds sidespin.
 */
export function playerReturn(ball: Ball, paddle: PaddleMotion): Return {
  const offset = clamp((ball.x - paddle.x) / PADDLE_HIT_RADIUS, -1, 1);
  const swing = Math.hypot(paddle.vx, paddle.vy);
  const incoming = Math.min(1, Math.abs(ball.vz) / 8);
  const power = clamp(0.2 + swing / 4 + incoming * 0.15, 0.2, 1.3);
  const landing = {
    x: clamp(ball.x * 0.35 + offset * 0.75 + paddle.vx * 0.05, -1.2, 1.2),
    z: -(0.5 + power * 0.8),
  };
  const spin = clamp(paddle.vy / 3, -1, 1);
  const side = clamp(-paddle.vx / 4, -0.8, 0.8);
  const speed = 4.2 + Math.min(1.1, power) * 5.2;
  return { shot: aimShot(ball, landing, speed, spin, side), landing, power };
}

/** How a served ball behaves: its first two table bounces (as signed distance into the receiver's half) and whether it touched the net. */
function traceServe(b: Ball, dir: number): { first: number | null; second: { x: number; z: number } | null; net: boolean; endZ: number } {
  let first: number | null = null;
  let net = false;
  for (let t = 0; t < 3; t += STEP) {
    for (const e of stepBall(b, STEP)) {
      if (e.type === "net") net = true;
      else if (e.type === "table") {
        if (first === null) first = e.z * dir;
        else return { first, second: { x: e.x, z: e.z }, net, endZ: b.z };
      } else return { first, second: null, net, endZ: b.z };
    }
  }
  return { first, second: null, net, endZ: b.z };
}

/**
 * A legal serve: struck from `from`, bouncing first on the server's own half, then landing
 * at `target` on the far half, clear of the net. For each first-bounce spot (from mid-half
 * back toward the server), the pace is found by bisection with the full physics, then
 * corrected sideways; the first clean serve wins.
 */
export function planServe(from: { x: number; y: number; z: number }, target: { x: number; z: number }, spin: number, side = 0): Shot {
  const dir = Math.sign(target.z - from.z) || -1;
  const make = (firstZ: number, s: number, vx: number): Shot => {
    const T1 = Math.abs(from.z - firstZ) / s;
    return { vx, vy: (TABLE_HEIGHT + BALL_R - from.y + 0.5 * G * T1 * T1) / T1, vz: dir * s, spin, side };
  };
  const run = (shot: Shot) => traceServe({ x: from.x, y: from.y, z: from.z, ...shot }, dir);
  let fallback: Shot | null = null;
  for (const frac of [0.55, 0.7, 0.85, 0.4, 0.95]) {
    const firstZ = -dir * HALF_L * frac;
    let vx = 0;
    let s = 4;
    for (let pass = 0; pass < 3; pass++) {
      let lo = 1.2;
      let hi = 10;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        const r = run(make(firstZ, mid, vx));
        // No second bounce: short (net, or off the near end) or long (off the far end).
        const reached = r.second ? r.second.z * dir : r.endZ * dir > HALF_L ? 99 : -99;
        if (reached < target.z * dir) lo = mid;
        else hi = mid;
      }
      s = (lo + hi) / 2;
      const r = run(make(firstZ, s, vx));
      const totalT = (Math.abs(from.z - firstZ) + Math.abs(firstZ - target.z)) / s;
      vx += (r.second ? target.x - r.second.x : target.x - from.x - vx * totalT) / Math.max(0.2, totalT);
    }
    const shot = make(firstZ, s, vx);
    const r = run(shot);
    const clean = !r.net && r.first !== null && r.first < 0 && r.second !== null && r.second.z * dir > 0;
    if (clean) return shot;
    fallback ??= shot;
  }
  return fallback!;
}

/**
 * Where the ball will cross a paddle plane (after bouncing on that side), following the
 * full physics. Null if it never gets there (net, floor, or out first).
 */
export function predictCrossing(ball: Ball, planeZ: number, maxT = 3): { x: number; y: number; t: number; bounced: boolean } | null {
  const c = cloneBall(ball);
  const sideOfPlane = sideOfZ(planeZ);
  let bounced = false;
  for (let t = 0; t < maxT; t += STEP) {
    const pz = c.z;
    const py = c.y;
    const pxx = c.x;
    for (const e of stepBall(c, STEP)) {
      if (e.type === "floor") return null;
      if (e.type === "table" && e.side === sideOfPlane) bounced = true;
    }
    const crossed = planeZ > 0 ? pz < planeZ && c.z >= planeZ : pz > planeZ && c.z <= planeZ;
    if (crossed) {
      const f = (planeZ - pz) / (c.z - pz || 1);
      return { x: pxx + (c.x - pxx) * f, y: py + (c.y - py) * f, t: t + STEP, bounced };
    }
  }
  return null;
}
