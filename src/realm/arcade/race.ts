/**
 * Island Race: a timed lap around the island through glowing gates, run in
 * the 3D world. The player sprints for the whole race. Runtime only; the
 * best time and wins are saved as counters. Entry costs 3 Focus.
 */

import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import { spendFocus } from "../state/focus";
import { addCoinsPublic } from "../state/actions";
import { bumpCounter } from "../state/stats";
import { FOCUS } from "../life/catalog";
import { isWalkable, type World } from "../world/worldGen";
import { findPath, nearestWalkable } from "../world/pathfinding";

/** Walking speed is multiplied by this during a race. */
export const RACE_SPRINT = 1.6;
/** A gate counts as passed within this many tiles. */
export const GATE_RADIUS = 1.7;
export const GATE_COUNT = 8;
/** Gates keep at least this far from monster camps. */
export const CAMP_CLEARANCE = 6;
/** Give up after this long. */
export const RACE_LIMIT_SECONDS = 240;

export interface Gate {
  x: number;
  z: number;
}

export type Medal = "gold" | "silver" | "bronze" | null;

export interface RaceRun {
  /** Sky Race: the gates hang in the air and only count on a broom. */
  sky: boolean;
  gates: Gate[];
  next: number;
  time: number;
  /** Course length in tiles, start through every gate. */
  length: number;
  done: boolean;
  result: { seconds: number; medal: Medal; best: boolean } | null;
}

export const race: { run: RaceRun | null; version: number } = { run: null, version: 0 };

/**
 * A lap of gates around the island, starting next to (sx, sz). Each gate sits
 * on open ground about two thirds of the way to the coast, and must be
 * reachable on foot from the one before it.
 */
export function planCourse(world: World, sx: number, sz: number): Gate[] {
  const C = world.size / 2;
  const radius = C * 0.62;
  const start = Math.atan2(sz - C, sx - C);
  const gates: Gate[] = [];
  let from = { x: Math.floor(sx), z: Math.floor(sz) };
  for (let i = 1; i <= GATE_COUNT; i++) {
    const a = start + (i * Math.PI * 2) / (GATE_COUNT + 1);
    const tile = gateTile(world, C + Math.cos(a) * radius, C + Math.sin(a) * radius);
    if (!tile || findPath(world, from, [tile]) === null) continue;
    gates.push({ x: tile.x + 0.5, z: tile.z + 0.5 });
    from = tile;
  }
  // The finish is back where you started.
  gates.push({ x: Math.floor(sx) + 0.5, z: Math.floor(sz) + 0.5 });
  return gates;
}

/** The closest walkable tile to (x, z) that keeps clear of monster camps, so racers aren't ambushed. */
function gateTile(world: World, x: number, z: number): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (let oz = -6; oz <= 6; oz++) {
    for (let ox = -6; ox <= 6; ox++) {
      const tx = Math.floor(x) + ox;
      const tz = Math.floor(z) + oz;
      if (!isWalkable(world, tx, tz)) continue;
      if (world.camps.some((c) => Math.hypot(c.x - tx, c.z - tz) < CAMP_CLEARANCE)) continue;
      const d = Math.hypot(ox, oz);
      if (d < bestD) {
        bestD = d;
        best = { x: tx, z: tz };
      }
    }
  }
  return best ?? nearestWalkable(world, { x: Math.floor(x), z: Math.floor(z) }, 5);
}

function courseLength(gates: Gate[], sx: number, sz: number): number {
  let total = 0;
  let px = sx;
  let pz = sz;
  for (const g of gates) {
    total += Math.hypot(g.x - px, g.z - pz);
    px = g.x;
    pz = g.z;
  }
  return total;
}

/** Medal times scale with the course: straight-line sprint time × 1.5 / 1.9 / 2.5. */
export function medalTimes(length: number, walkSpeed: number, sky = false): { gold: number; silver: number; bronze: number } {
  const ideal = length / (walkSpeed * (sky ? SKY_SPEED : RACE_SPRINT));
  return { gold: Math.round(ideal * 1.5), silver: Math.round(ideal * 1.9), bronze: Math.round(ideal * 2.5) };
}

/** Broom speed over walking (kept here so the race rules don't import the scene). */
export const SKY_SPEED = 2.2;
/** How high Sky Race gates hang. */
export const SKY_GATE_HEIGHT = 2.4;

export const MEDAL_COINS: Record<Exclude<Medal, null> | "finish", number> = { gold: 90, silver: 55, bronze: 30, finish: 15 };

export function startRace(world: World, sx: number, sz: number, sky = false): boolean {
  if (race.run && !race.run.done) {
    chat("You're already racing. Follow the glowing gates.");
    return false;
  }
  if (!spendFocus(FOCUS.cost.race, sky ? "fly the Sky Race" : "run the Island Race")) return false;
  const gates = planCourse(world, sx, sz);
  race.run = { sky, gates, next: 0, time: 0, length: courseLength(gates, sx, sz), done: false, result: null };
  race.version++;
  chat(sky ? `Go! Fly through all ${gates.length} sky gates and back (B to take off).` : `Go! Sprint through all ${gates.length} gates and back. Follow the beam of light.`, "quest");
  emit({ type: "sound", name: "quest" });
  return true;
}

export function abandonRace(): void {
  if (!race.run || race.run.done) return;
  race.run.done = true;
  race.version++;
  chat("You stop racing.");
}

/** Advances the race. Returns true on the tick a gate is passed. */
export function tickRace(dt: number, px: number, pz: number, walkSpeed: number, flying = false): boolean {
  const run = race.run;
  if (!run || run.done) return false;
  run.time += dt;
  if (run.time > RACE_LIMIT_SECONDS) {
    run.done = true;
    race.version++;
    chat("Time's up. The race is over. Try a shorter line between gates next time.");
    emit({ type: "sound", name: "defeat" });
    return false;
  }
  const gate = run.gates[run.next];
  if (Math.hypot(px - gate.x, pz - gate.z) > GATE_RADIUS) return false;
  // Sky gates only count on a broom (the finish counts on foot, so you can land there).
  if (run.sky && !flying && run.next < run.gates.length - 1) return false;
  run.next++;
  race.version++;
  if (run.next < run.gates.length) {
    emit({ type: "sound", name: "click" });
    return true;
  }
  // Finished.
  run.done = true;
  const seconds = Math.round(run.time * 10) / 10;
  const times = medalTimes(run.length, walkSpeed, run.sky);
  const medal: Medal = seconds <= times.gold ? "gold" : seconds <= times.silver ? "silver" : seconds <= times.bronze ? "bronze" : null;
  const bestKey = run.sky ? "skyRaceBest" : "raceBest";
  const prev = realmStore.get().progress.counters[bestKey] ?? 0;
  const best = !prev || seconds < prev;
  if (best) realmStore.set((s) => ({ ...s, progress: { ...s.progress, counters: { ...s.progress.counters, [bestKey]: seconds } } }));
  bumpCounter("raceFinishes");
  if (medal === "gold") bumpCounter("raceGold");
  const coins = MEDAL_COINS[medal ?? "finish"];
  addCoinsPublic(coins);
  run.result = { seconds, medal, best };
  emit({ type: "sound", name: "victory" });
  chat(`Finished in ${seconds}s${medal ? `: ${medal} medal.` : "."}${best ? " A new best time." : ""} +${coins} coins.`, "quest");
  return true;
}

// Dev-only handle for play-testing (stripped from production builds).
if (import.meta.env?.DEV && typeof window !== "undefined") {
  (window as unknown as { __race?: typeof race }).__race = race;
}
