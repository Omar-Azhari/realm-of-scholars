/**
 * One parkour session: the course, the player, the clock, the ghost and the camera
 * state, stepped at a fixed rate and read by the renderer and HUD. Plain TypeScript
 * (no React) so a run can be simulated in tests.
 */

import { advanceCourse, buildCourse, type Course, type CourseDef } from "./courses";
import { cameraRelative, createPlayer, PHYS, respawn, stepPlayer, type PlayerEvent, type PlayerState, type Vec3 } from "./physics";
import { GhostRecorder, type Ghost } from "./ghost";

export type SessionMode = "preview" | "run" | "done";

export interface CameraState {
  yaw: number;
  /** Third person: angle above the horizon. */
  pitch: number;
  /** Third person: wanted distance (scroll to zoom) and the current, collision-limited one. */
  dist: number;
  distNow: number;
  /** First person: look up/down. */
  look: number;
  firstPerson: boolean;
  roll: number;
  fovKick: number;
}

export interface Session {
  course: Course;
  player: PlayerState;
  /** Position at the previous physics step (rendering interpolates between the two). */
  prev: Vec3;
  /** Interpolated position for this frame, and the world time to draw moving pieces at. */
  render: Vec3;
  renderTime: number;
  worldTime: number;
  acc: number;
  mode: SessionMode;
  paused: boolean;
  /** Held keys (KeyboardEvent.code). */
  keys: Set<string>;
  /** A jump tap that may start and end between two frames. */
  jumpTap: boolean;
  cam: CameraState;
  timer: { started: boolean; time: number; splits: number[] };
  ghost: Ghost | null;
  recorder: GhostRecorder;
  /** Set when the camera should jump straight to the player (respawn, new run). */
  snap: boolean;
  /** Seconds the red flash shows after a reset. */
  flash: number;
  deaths: number;
  /** A hard landing happened: the character plays a roll (consumed by the renderer). */
  rollQueued: boolean;
}

export function newSession(def: CourseDef): Session {
  const course = buildCourse(def);
  const spawn = course.spawns[0];
  const player = createPlayer(spawn, course.world);
  return {
    course,
    player,
    prev: { ...player.pos },
    render: { ...player.pos },
    renderTime: 0,
    worldTime: 0,
    acc: 0,
    mode: "preview",
    paused: false,
    keys: new Set(),
    jumpTap: false,
    cam: { yaw: 0, pitch: 0.42, dist: 8, distNow: 8, look: -0.1, firstPerson: false, roll: 0, fovKick: 0 },
    timer: { started: false, time: 0, splits: [] },
    ghost: null,
    recorder: new GhostRecorder(),
    snap: true,
    flash: 0,
    deaths: 0,
    rollQueued: false,
  };
}

/** Starts (or restarts) a run from the start pad. Keeps the camera settings. */
export function startSessionRun(s: Session, ghost: Ghost | null): void {
  const fresh = buildCourse(s.course.def);
  s.course = fresh;
  s.player = createPlayer(fresh.spawns[0], fresh.world);
  s.prev = { ...s.player.pos };
  s.render = { ...s.player.pos };
  s.worldTime = 0;
  s.renderTime = 0;
  s.acc = 0;
  s.mode = "run";
  s.paused = false;
  s.jumpTap = false;
  s.timer = { started: false, time: 0, splits: [] };
  s.ghost = ghost;
  s.recorder.reset();
  s.cam.yaw = 0;
  s.snap = true;
  s.flash = 0;
  s.deaths = 0;
}

/** Back to the last checkpoint (R, or after falling). */
export function resetToCheckpoint(s: Session): void {
  const spawn = s.course.spawns[s.player.checkpoint] ?? s.course.spawns[0];
  respawn(s.player, spawn, s.course.world);
  s.prev = { ...s.player.pos };
  s.render = { ...s.player.pos };
  s.cam.yaw = spawn.facing - Math.PI;
  s.snap = true;
  s.flash = 0.45;
  s.deaths++;
}

export type SessionEvent = PlayerEvent | { type: "timerStart" } | { type: "split"; index: number; time: number };

const has = (keys: Set<string>, ...codes: string[]) => codes.some((c) => keys.has(c));

/** The player's input for this step, from held keys and the camera's yaw. */
export function readInput(s: Session): { x: number; z: number; jump: boolean; sprint: boolean } {
  const k = s.keys;
  const forward = (has(k, "KeyW", "ArrowUp") ? 1 : 0) - (has(k, "KeyS", "ArrowDown") ? 1 : 0);
  const right = (has(k, "KeyD", "ArrowRight") ? 1 : 0) - (has(k, "KeyA", "ArrowLeft") ? 1 : 0);
  const dir = cameraRelative(forward, right, s.cam.yaw);
  return { x: dir.x, z: dir.z, jump: k.has("Space") || s.jumpTap, sprint: has(k, "ShiftLeft", "ShiftRight") };
}

/** Is the player still on the start pad's footprint (the clock starts when you leave it)? */
function onStartPad(s: Session): boolean {
  const pad = s.course.world.boxes[s.course.spawnBoxes[0]];
  const p = s.player.pos;
  return p.x > pad.min.x - PHYS.halfWidth && p.x < pad.max.x + PHYS.halfWidth && p.z > pad.min.z - PHYS.halfWidth && p.z < pad.max.z + PHYS.halfWidth && p.y >= pad.max.y - 0.5;
}

/**
 * Advances the session by a frame's worth of time (fixed steps). Returns everything that
 * happened, in order. Rendering reads `render` / `renderTime` afterwards.
 */
export function stepSession(s: Session, frameDt: number): SessionEvent[] {
  const out: SessionEvent[] = [];
  const dt = PHYS.dt;
  s.flash = Math.max(0, s.flash - frameDt);
  if (s.mode !== "run" || s.paused) {
    // Menus: the course keeps moving for the preview; the player waits.
    if (s.mode === "preview") {
      s.worldTime += Math.min(frameDt, 0.1);
      advanceCourse(s.course, s.worldTime);
    }
    s.renderTime = s.worldTime;
    s.render = { ...s.player.pos };
    s.prev = { ...s.player.pos };
    s.acc = 0;
    return out;
  }
  s.acc += Math.min(frameDt, 0.1);
  let steps = 0;
  while (s.acc >= dt && steps < 12) {
    s.acc -= dt;
    steps++;
    s.prev = { ...s.player.pos };
    s.worldTime += dt;
    advanceCourse(s.course, s.worldTime);
    const input = readInput(s);
    const events = stepPlayer(s.player, input, s.course.world, dt);
    if (s.jumpTap && input.jump) s.jumpTap = false;
    if (!s.timer.started && !onStartPad(s)) {
      s.timer.started = true;
      out.push({ type: "timerStart" });
    }
    if (s.timer.started) {
      s.timer.time += dt;
      const p = s.player.pos;
      const pose = !s.player.grounded && !s.player.wallRun ? 2 : Math.hypot(s.player.vel.x, s.player.vel.z) > 0.6 ? 1 : 0;
      s.recorder.sample(s.timer.time, p.x, p.y, p.z, s.player.facing, pose);
    }
    for (const e of events) {
      out.push(e);
      if (e.type === "land" && e.impact >= PHYS.rollImpact) s.rollQueued = true;
      if (e.type === "checkpoint" && s.timer.started && s.timer.splits[e.index - 1] === undefined) {
        s.timer.splits[e.index - 1] = s.timer.time;
        out.push({ type: "split", index: e.index, time: s.timer.time });
      }
    }
    if (events.some((e) => e.type === "death")) {
      resetToCheckpoint(s);
      continue;
    }
    if (events.some((e) => e.type === "finish")) {
      s.mode = "done";
      s.prev = { ...s.player.pos };
      break;
    }
  }
  const a = s.mode === "run" ? Math.min(1, s.acc / dt) : 1;
  const p = s.player.pos;
  s.render = { x: s.prev.x + (p.x - s.prev.x) * a, y: s.prev.y + (p.y - s.prev.y) * a, z: s.prev.z + (p.z - s.prev.z) * a };
  s.renderTime = s.worldTime - dt + a * dt;
  return out;
}
