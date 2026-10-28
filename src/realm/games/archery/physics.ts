/**
 * Archery physics and scoring: pure functions, no React or three.js, so they can be
 * unit-tested (scripts/verify-realm.ts).
 *
 * World axes: x right, y up, the shooter stands at the origin facing -z, and targets
 * stand at z = -distance. Units are metres and seconds.
 */

export const GRAVITY = 9.81;
/** Arrow speed at the lightest and the fullest draw (a 40-50 lb recurve shoots ~60 m/s). */
export const ARROW_MIN_SPEED = 24;
export const ARROW_MAX_SPEED = 66;
/** Air drag on the arrow (per second) and how hard the wind pushes it sideways (per m/s of wind). */
export const ARROW_DRAG = 0.06;
export const WIND_PUSH = 0.42;
/** The archer's eye (and the arrow's launch point). */
export const EYE_HEIGHT = 1.55;
/** Seconds to reach full draw. */
export const DRAW_TIME = 1.1;
/** An arrow is given up on after this long in the air. */
export const MAX_FLIGHT_SECONDS = 4;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Wind velocity over the range, m/s (x across the lanes, z along them). */
export interface Wind {
  x: number;
  z: number;
}

export interface ArrowState {
  p: Vec3;
  v: Vec3;
  t: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Launch speed for a draw between 0 (barely pulled) and 1 (full draw). */
export function drawSpeed(power: number): number {
  const p = clamp(power, 0, 1);
  return ARROW_MIN_SPEED + (ARROW_MAX_SPEED - ARROW_MIN_SPEED) * Math.pow(p, 0.75);
}

/** Unit vector for a yaw (right is positive) and pitch (up is positive), facing -z at zero. */
export function aimDirection(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

export function launchArrow(origin: Vec3, yaw: number, pitch: number, power: number): ArrowState {
  const d = aimDirection(yaw, pitch);
  const s = drawSpeed(power);
  return { p: { ...origin }, v: { x: d.x * s, y: d.y * s, z: d.z * s }, t: 0 };
}

/** Advances an arrow by dt (mutates it): gravity, air drag and the wind's push. */
export function stepArrow(a: ArrowState, wind: Wind, dt: number): void {
  a.v.x += (-ARROW_DRAG * a.v.x + WIND_PUSH * wind.x) * dt;
  a.v.z += (-ARROW_DRAG * a.v.z + WIND_PUSH * wind.z) * dt;
  a.v.y += (-ARROW_DRAG * a.v.y - GRAVITY) * dt;
  a.p.x += a.v.x * dt;
  a.p.y += a.v.y * dt;
  a.p.z += a.v.z * dt;
  a.t += dt;
}

/**
 * Where the arrow crosses the plane z = planeZ (or null if it lands or times out first).
 * Used for the bow-sight pins and the tests.
 */
export function arrowAtDistance(start: ArrowState, wind: Wind, planeZ: number, dt = 1 / 240): Vec3 | null {
  const a: ArrowState = { p: { ...start.p }, v: { ...start.v }, t: start.t };
  while (a.t < MAX_FLIGHT_SECONDS) {
    const prev = { ...a.p };
    stepArrow(a, wind, dt);
    if (a.p.z <= planeZ && prev.z > planeZ) {
      const f = (prev.z - planeZ) / (prev.z - a.p.z);
      return { x: prev.x + (a.p.x - prev.x) * f, y: prev.y + (a.p.y - prev.y) * f, z: planeZ };
    }
    if (a.p.y <= 0) return null;
  }
  return null;
}

/**
 * The pitch that drops a full-draw arrow (no wind) onto a point `distance` metres away at
 * `height`: what a bow-sight pin for that distance marks.
 */
export function pinElevation(distance: number, height: number, power = 1, eye = EYE_HEIGHT): number {
  let lo = -0.3;
  let hi = 0.6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const hit = arrowAtDistance(launchArrow({ x: 0, y: eye, z: 0 }, 0, mid, power), { x: 0, z: 0 }, -distance, 1 / 120);
    if (!hit || hit.y < height) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A target face standing upright, facing the shooter. */
export interface TargetFace {
  x: number;
  y: number;
  z: number;
  /** Radius of the scoring face. */
  radius: number;
}

/** The straw boss behind a face is a little wider than the face: arrows stick in it for 0. */
export const BOSS_SCALE = 1.25;

/**
 * Where the segment prev→next passes through the target's plane, relative to the face
 * centre, when it does so inside the boss. Null when it misses.
 */
export function crossTarget(prev: Vec3, next: Vec3, face: TargetFace): { dx: number; dy: number } | null {
  if (!(prev.z > face.z && next.z <= face.z)) return null;
  const f = (prev.z - face.z) / (prev.z - next.z);
  const x = prev.x + (next.x - prev.x) * f;
  const y = prev.y + (next.y - prev.y) * f;
  const dx = x - face.x;
  const dy = y - face.y;
  const half = face.radius * BOSS_SCALE;
  if (Math.abs(dx) > half || Math.abs(dy) > half) return null;
  return { dx, dy };
}

/**
 * World Archery 10-ring scoring: ten equal-width rings, 10 in the middle and 1 on the
 * outside; 0 off the face. The inner half of the 10 ring is the "X" (a perfect bullseye).
 */
export function ringScore(dx: number, dy: number, radius: number): { ring: number; x: boolean } {
  const r = Math.hypot(dx, dy);
  if (r > radius) return { ring: 0, x: false };
  const band = radius / 10;
  const ring = Math.max(1, 10 - Math.floor(r / band));
  return { ring, x: r <= band / 2 };
}

/**
 * Bow sway (radians of yaw and pitch) at time t. `steady` (0..1) is how much a held
 * breath calms it; `fatigue` (0..1) grows when the bow is held at full draw too long
 * or the breath runs out.
 */
export function swayAt(t: number, steady: number, fatigue: number): { yaw: number; pitch: number } {
  const amp = 0.0062 * (1 + 1.6 * clamp(fatigue, 0, 1)) * (1 - 0.82 * clamp(steady, 0, 1));
  return {
    yaw: amp * (Math.sin(t * 1.27) * 0.7 + Math.sin(t * 2.93 + 1.1) * 0.3 + Math.sin(t * 7.1 + 0.4) * 0.08),
    pitch: amp * (Math.sin(t * 1.61 + 2.3) * 0.65 + Math.sin(t * 3.37 + 0.2) * 0.35 + Math.cos(t * 6.3) * 0.08),
  };
}

export interface Breath {
  /** Lung capacity left, 0..1. */
  air: number;
  /** Current steadiness, 0..1 (eases toward the target so it isn't a switch). */
  steady: number;
  /** Shakes after the breath runs out, 0..1. */
  strain: number;
}

export const BREATH_DRAIN = 0.26;
export const BREATH_REFILL = 0.2;

/** Holding Shift holds the breath: steadier until the air runs out, then shakier. */
export function updateBreath(b: Breath, holding: boolean, dt: number): Breath {
  let air = b.air;
  let strain = b.strain;
  if (holding && air > 0) air = Math.max(0, air - BREATH_DRAIN * dt);
  else if (!holding) air = Math.min(1, air + BREATH_REFILL * dt);
  if (holding && air <= 0) strain = Math.min(1, strain + dt * 0.8);
  else strain = Math.max(0, strain - dt * 0.5);
  const goal = holding && air > 0 ? 1 : 0;
  const steady = b.steady + (goal - b.steady) * Math.min(1, dt * 6);
  return { air, steady, strain };
}
