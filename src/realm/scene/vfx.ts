/**
 * Particle bursts requested from anywhere in the game (combat hits, level
 * ups, gathering). Plain data so game logic can ask for effects without
 * importing three.js; scene/Effects.tsx draws them.
 */

export type BurstKind = "sparkle" | "hit" | "splash" | "chips" | "leaves" | "focus";

export interface Burst {
  id: number;
  kind: BurstKind;
  x: number;
  y: number;
  z: number;
  /** Seconds since the page loaded (performance.now() / 1000) when it started. */
  at: number;
  count: number;
  color: string;
}

const LIFETIME = 1.4;
export const bursts: Burst[] = [];
let nextId = 0;

const DEFAULTS: Record<BurstKind, { count: number; color: string }> = {
  sparkle: { count: 46, color: "#ffd45a" },
  hit: { count: 14, color: "#ff8a5a" },
  splash: { count: 22, color: "#bfe8ff" },
  chips: { count: 16, color: "#b9a690" },
  leaves: { count: 16, color: "#7fb04a" },
  focus: { count: 18, color: "#7fe8ff" },
};

const now = () => (typeof performance !== "undefined" ? performance.now() / 1000 : 0);

export function spawnBurst(kind: BurstKind, x: number, y: number, z: number, color?: string, count?: number): void {
  const d = DEFAULTS[kind];
  bursts.push({ id: ++nextId, kind, x, y, z, at: now(), count: count ?? d.count, color: color ?? d.color });
  // Keep the list short; old bursts have finished anyway.
  while (bursts.length > 24) bursts.shift();
}

/** Drops finished bursts. */
export function pruneBursts(t = now()): void {
  for (let i = bursts.length - 1; i >= 0; i--) if (t - bursts[i].at > LIFETIME) bursts.splice(i, 1);
}

export const BURST_LIFETIME = LIFETIME;

/** A spell bolt flying from the caster to a target (heights above the ground). */
export interface Bolt {
  id: number;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  at: number;
  color: string;
}

export const BOLT_SECONDS = 0.28;
export const bolts: Bolt[] = [];

export function spawnBolt(from: Bolt["from"], to: Bolt["to"], color = "#7fe8ff"): void {
  bolts.push({ id: ++nextId, from, to, at: now(), color });
  while (bolts.length > 8) bolts.shift();
}
