/**
 * Deterministic NPC daily-life schedule (Phase 20C, Parts 1/2). A named
 * NPC archetype cycles through a fixed, hand-authored list of waypoints —
 * each one a floor position + an activity (a `PoseName` from
 * characterRig.ts) + a duration — forever, driven purely by an elapsed
 * time value. No randomness, no decision-making, no full AI: the exact
 * same `elapsedSeconds` always produces the exact same
 * position/pose/facing, which is what makes this directly unit-testable
 * (scripts/verify-phase20c-living-world.ts) and what the brief means by
 * "lightweight deterministic schedule system... do NOT build full AI."
 *
 * "Different personalities should influence activity frequency" (Part 1)
 * is expressed by giving each ARCHETYPE its own hand-authored waypoint
 * list (a diligent mentor's schedule is desk/typing-heavy; a social
 * student's is coffee/talk-heavy) rather than a dynamic weighting engine
 * — the schedule itself IS the personality expression, kept deterministic
 * per the brief's explicit instruction. Personality's `idleSpeedMultiplier`
 * (personalityTraits.ts, unchanged from Phase 20B) continues to only
 * affect pose *playback speed*, never which activity is chosen.
 *
 * Movement between waypoints is a straight-line walk over a short
 * transition window at the START of each waypoint's duration (not a full
 * pathfinding system) — waypoints are hand-placed so consecutive
 * straight-line segments never cross a room obstacle (verified in the
 * test harness), which is sufficient for this one hand-built room.
 */

import type { FloorPoint } from "../../world/worldTypes";
import type { PoseName } from "./characterRig";

export interface ScheduleWaypoint {
  standPoint: FloorPoint;
  /** The activity performed once arrived — any pose from characterRig.ts except "walk" (walking is the implicit transit phase between waypoints, never a chosen destination activity) and "wardrobePreview" (Character Creator only). */
  activity: Exclude<PoseName, "walk" | "wardrobePreview">;
  /** Total seconds spent at this waypoint, INCLUDING the walk-transition time at its start. */
  durationSeconds: number;
  /** Which way to face once arrived, while performing the activity. Defaults to facing in the direction of travel if omitted. */
  facingLeft?: boolean;
}

export interface NpcSchedule {
  id: string;
  waypoints: ScheduleWaypoint[];
}

/** How long the walk phase at the start of each waypoint takes, capped below so a very short waypoint is never ALL walking. */
export const WALK_TRANSITION_SECONDS = 2.5;

export interface ScheduleState {
  position: FloorPoint;
  pose: PoseName;
  facingLeft: boolean;
  waypointIndex: number;
  isWalking: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Pure function: schedule + elapsed seconds (any real number, including
 * negative or beyond one cycle) -> exactly where the NPC is, what they're
 * doing, and which way they're facing, right now.
 */
export function getScheduleState(schedule: NpcSchedule, elapsedSeconds: number): ScheduleState {
  const waypoints = schedule.waypoints;
  const totalDuration = waypoints.reduce((sum, w) => sum + w.durationSeconds, 0);

  if (waypoints.length === 0 || totalDuration <= 0) {
    const fallback: FloorPoint = { x: 0, feetY: 0 };
    return { position: fallback, pose: "idle", facingLeft: false, waypointIndex: 0, isWalking: false };
  }

  // Safe modulo — handles negative elapsedSeconds too (never goes out of [0, totalDuration)).
  const cyclic = ((elapsedSeconds % totalDuration) + totalDuration) % totalDuration;

  let acc = 0;
  let index = waypoints.length - 1;
  for (let i = 0; i < waypoints.length; i++) {
    if (cyclic < acc + waypoints[i].durationSeconds) {
      index = i;
      break;
    }
    acc += waypoints[i].durationSeconds;
  }

  const waypoint = waypoints[index];
  const prevIndex = (index - 1 + waypoints.length) % waypoints.length;
  const prevWaypoint = waypoints[prevIndex];
  const timeIntoWaypoint = cyclic - acc;

  const transitionDuration = Math.min(WALK_TRANSITION_SECONDS, waypoint.durationSeconds * 0.6);

  if (transitionDuration > 0 && timeIntoWaypoint < transitionDuration) {
    const raw = timeIntoWaypoint / transitionDuration;
    // Smoothstep, not linear — an eased walk start/stop (Part 4: "blend
    // everything smoothly") without changing WHICH points are visited, only
    // how fast time moves along that same straight line.
    const eased = raw * raw * (3 - 2 * raw);
    const position: FloorPoint = {
      x: lerp(prevWaypoint.standPoint.x, waypoint.standPoint.x, eased),
      feetY: lerp(prevWaypoint.standPoint.feetY, waypoint.standPoint.feetY, eased),
    };
    const facingLeft = waypoint.standPoint.x < prevWaypoint.standPoint.x;
    return { position, pose: "walk", facingLeft, waypointIndex: index, isWalking: true };
  }

  return {
    position: waypoint.standPoint,
    pose: waypoint.activity,
    facingLeft: waypoint.facingLeft ?? false,
    waypointIndex: index,
    isWalking: false,
  };
}

/** Total cycle length — used by tests and by anything wanting to know how long a full loop takes. */
export function scheduleCycleDuration(schedule: NpcSchedule): number {
  return schedule.waypoints.reduce((sum, w) => sum + w.durationSeconds, 0);
}
