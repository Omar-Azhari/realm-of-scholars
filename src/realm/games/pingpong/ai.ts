/**
 * The ping-pong rival: three difficulties that differ in reaction time, footwork speed,
 * how often they mishit, and how hard and wide they play. Pure (unit-tested).
 *
 * The rival reads the ball perfectly once it has reacted (it runs the same physics), so
 * its mistakes come from being slow to react, slow to move, and occasional mishits.
 */

import { aimShot, HALF_L, PADDLE_Y_MAX, PADDLE_Y_MIN, planServe, predictCrossing, RIVAL_PADDLE_Z, type Ball, type Shot } from "./physics";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface AiProfile {
  name: string;
  title: string;
  blurb: string;
  /** Seconds (game time) before the rival starts moving to a ball. */
  reaction: number;
  /** Paddle speed, m/s. */
  speed: number;
  /** How far from the paddle centre the rival can still reach a ball, m. */
  reach: number;
  /** Chance of misjudging a ball completely (swinging at air). */
  whiffRate: number;
  /** Chance a return is a mistake: long, wide or into the net. */
  errorRate: number;
  /** Pace of their shots along the table, m/s. */
  pace: number;
  /** How close to the sidelines they aim (0..0.7 m from centre). */
  width: number;
  /** How much spin they put on the ball (0..1). */
  spin: number;
  /** Outfit and look, for the rival's body. */
  outfit: string;
  skin: string;
  hair: string;
  body: "female" | "male";
}

export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  easy: {
    name: "Pip Thornbury",
    title: "First-year",
    blurb: "Keen, friendly, and a bit slow on the wide balls.",
    reaction: 0.26,
    speed: 2.0,
    reach: 0.17,
    whiffRate: 0.12,
    errorRate: 0.14,
    pace: 4.6,
    width: 0.3,
    spin: 0.3,
    outfit: "#3f7a4f",
    skin: "#e8b48f",
    hair: "#6b3f22",
    body: "male",
  },
  medium: {
    name: "Marlowe Quill",
    title: "Club captain",
    blurb: "Steady, patient, and loves a heavy topspin loop.",
    reaction: 0.18,
    speed: 2.7,
    reach: 0.17,
    whiffRate: 0.06,
    errorRate: 0.08,
    pace: 5.6,
    width: 0.45,
    spin: 0.6,
    outfit: "#2f5d9e",
    skin: "#a8724e",
    hair: "#1d140e",
    body: "female",
  },
  hard: {
    name: "Magister Vexa",
    title: "Undefeated since first term",
    blurb: "Fast feet, sharp angles, and almost no mistakes.",
    reaction: 0.11,
    speed: 3.7,
    reach: 0.17,
    whiffRate: 0.025,
    errorRate: 0.04,
    pace: 6.8,
    width: 0.58,
    spin: 0.9,
    outfit: "#7a2f3f",
    skin: "#f1c9a5",
    hair: "#c8c2b8",
    body: "female",
  },
};

export interface AiBrain {
  x: number;
  y: number;
  /** Paddle velocity (for animation and the body's run cycle). */
  vx: number;
  goalX: number;
  goalY: number;
  /** Counting down to reacting to the current ball. */
  timer: number;
  tracking: boolean;
  planned: boolean;
  willWhiff: boolean;
}

export function newBrain(): AiBrain {
  return { x: 0, y: 1.0, vx: 0, goalX: 0, goalY: 1.0, timer: 0, tracking: false, planned: false, willWhiff: false };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * One tick of the rival's footwork. `incoming` is true while the ball is on its way to
 * the rival (the player has hit it). Mutates the brain.
 */
export function aiThink(brain: AiBrain, ball: Ball, incoming: boolean, profile: AiProfile, dt: number, rng: () => number): void {
  if (incoming) {
    if (!brain.tracking) {
      brain.tracking = true;
      brain.planned = false;
      brain.timer = profile.reaction;
      // Fast balls are harder to read.
      const pace = Math.min(1.5, Math.abs(ball.vz) / 7);
      brain.willWhiff = rng() < profile.whiffRate * (0.6 + pace);
    }
    brain.timer -= dt;
    if (brain.timer <= 0 && !brain.planned) {
      brain.planned = true;
      const at = predictCrossing(ball, RIVAL_PADDLE_Z);
      if (at) {
        const miss = brain.willWhiff ? (rng() < 0.5 ? -1 : 1) * (profile.reach + 0.12) : 0;
        brain.goalX = at.x + miss;
        brain.goalY = clamp(at.y, PADDLE_Y_MIN, PADDLE_Y_MAX);
      }
    }
  } else {
    brain.tracking = false;
    brain.planned = false;
    // Recover to the middle between shots.
    brain.goalX = brain.goalX * 0.98;
    brain.goalY = 1.0;
  }
  const step = profile.speed * dt;
  const dx = clamp(brain.goalX - brain.x, -step, step);
  const dy = clamp(brain.goalY - brain.y, -step * 0.8, step * 0.8);
  brain.x += dx;
  brain.y += dy;
  brain.vx = dt > 0 ? dx / dt : 0;
}

/** Whether the rival's paddle is close enough to the ball to play it. */
export function aiCanReach(brain: AiBrain, ball: Pick<Ball, "x" | "y">, profile: AiProfile): boolean {
  return Math.hypot(ball.x - brain.x, (ball.y - brain.y) * 0.8) <= profile.reach;
}

/** The rival's return: a target on the player's half, with the odd mistake. */
export function aiReturn(ball: Ball, profile: AiProfile, rng: () => number): { shot: Shot; mistake: boolean } {
  const mistake = rng() < profile.errorRate;
  let landing = { x: (rng() * 2 - 1) * profile.width, z: 0.45 + rng() * 0.75 };
  let pace = profile.pace * (0.85 + rng() * 0.3);
  if (mistake) {
    const kind = rng();
    if (kind < 0.4) landing = { x: (rng() < 0.5 ? -1 : 1) * (0.95 + rng() * 0.2), z: landing.z };
    else if (kind < 0.7) landing = { x: landing.x, z: HALF_L + 0.15 + rng() * 0.3 };
    else pace *= 1.9; // a flat smash that clips the net
  }
  const spin = (rng() * 1.4 - 0.4) * profile.spin;
  const side = (rng() * 2 - 1) * profile.spin * 0.4;
  return { shot: aimShot(ball, landing, pace, spin, side), mistake };
}

/** The rival's serve from where its paddle is. */
export function aiServe(brain: AiBrain, profile: AiProfile, rng: () => number): Shot {
  const target = { x: (rng() * 2 - 1) * profile.width, z: 0.7 + rng() * 0.45 };
  return planServe({ x: brain.x, y: 1.0, z: RIVAL_PADDLE_Z + 0.1 }, target, (rng() * 1.4 - 0.5) * profile.spin, (rng() * 2 - 1) * 0.3 * profile.spin);
}
