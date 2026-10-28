/**
 * Ghost runs: your best run on a course, recorded as positions over time and replayed
 * as a see-through runner. Stored per device in localStorage (sessionStorage in the
 * dev sandbox so test runs never stick), validated on load.
 */

export interface GhostFrame {
  t: number;
  x: number;
  y: number;
  z: number;
  facing: number;
  /** 0 standing, 1 running, 2 in the air. */
  pose: number;
}

export interface Ghost {
  course: string;
  time: number;
  /** Split time at each checkpoint (index 0 = checkpoint 1). */
  splits: number[];
  frames: GhostFrame[];
}

/** Seconds between recorded frames. */
export const GHOST_INTERVAL = 0.05;
/** Longest run we keep a ghost for (10 minutes). */
const MAX_FRAMES = Math.ceil(600 / GHOST_INTERVAL);

export class GhostRecorder {
  frames: GhostFrame[] = [];
  private next = 0;

  reset(): void {
    this.frames = [];
    this.next = 0;
  }

  /** Records a frame if one is due at run time `t`. */
  sample(t: number, x: number, y: number, z: number, facing: number, pose: number): void {
    if (t + 1e-9 < this.next || this.frames.length >= MAX_FRAMES) return;
    this.frames.push({ t, x, y, z, facing, pose });
    this.next = t + GHOST_INTERVAL;
  }
}

function angleLerp(a: number, b: number, f: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

/** Where the ghost is at run time `t` (clamped to the first and last frames). */
export function sampleGhost(ghost: Ghost, t: number): GhostFrame | null {
  const f = ghost.frames;
  if (f.length === 0) return null;
  if (t <= f[0].t) return f[0];
  if (t >= f[f.length - 1].t) return f[f.length - 1];
  // Binary search for the frame pair around t.
  let lo = 0;
  let hi = f.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = f[lo];
  const b = f[hi];
  const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return {
    t,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    facing: angleLerp(a.facing, b.facing, k),
    pose: k < 0.5 ? a.pose : b.pose,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Compact JSON: [time, splits, flat frames [t,x,y,z,facing,pose,...]]. */
export function encodeGhost(ghost: Ghost): string {
  const flat: number[] = [];
  for (const f of ghost.frames) flat.push(r2(f.t), r2(f.x), r2(f.y), r2(f.z), r2(f.facing), f.pose);
  return JSON.stringify({ v: 1, c: ghost.course, t: r2(ghost.time), s: ghost.splits.map(r2), f: flat });
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Parses a stored ghost. Anything malformed gives null. */
export function decodeGhost(raw: string | null, course: string): Ghost | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { v?: unknown; c?: unknown; t?: unknown; s?: unknown; f?: unknown };
    if (o.v !== 1 || o.c !== course || !num(o.t) || o.t <= 0 || !Array.isArray(o.s) || !Array.isArray(o.f)) return null;
    if (o.f.length % 6 !== 0 || o.f.length / 6 > MAX_FRAMES || !o.f.every(num) || !o.s.every(num)) return null;
    const flat = o.f as number[];
    const frames: GhostFrame[] = [];
    let last = -Infinity;
    for (let i = 0; i < flat.length; i += 6) {
      const t = flat[i];
      if (t < last || Math.abs(flat[i + 1]) > 1e4 || Math.abs(flat[i + 2]) > 1e4 || Math.abs(flat[i + 3]) > 1e4) return null;
      last = t;
      frames.push({ t, x: flat[i + 1], y: flat[i + 2], z: flat[i + 3], facing: flat[i + 4], pose: Math.max(0, Math.min(2, Math.round(flat[i + 5]))) });
    }
    return { course, time: o.t, splits: (o.s as number[]).slice(0, 20), frames };
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const sandbox = Boolean(import.meta.env?.DEV) && new URLSearchParams(window.location.search).has("sandbox");
    return sandbox ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

const key = (course: string) => `unigame.realm.parkour.ghost.${course}`;

export function loadGhost(course: string): Ghost | null {
  try {
    return decodeGhost(storage()?.getItem(key(course)) ?? null, course);
  } catch {
    return null;
  }
}

/** Saves the ghost if it beats the stored one. Returns true when saved. */
export function saveGhostIfBest(ghost: Ghost): boolean {
  const current = loadGhost(ghost.course);
  if (current && current.time <= ghost.time) return false;
  try {
    storage()?.setItem(key(ghost.course), encodeGhost(ghost));
    return true;
  } catch {
    return false;
  }
}
