/**
 * Mutable per-frame state shared between the 3D scene and the HUD
 * (minimap, compass, hover text). Kept outside React so the render loop
 * never triggers re-renders.
 */

import type { WorldObject } from "../world/worldGen";

export interface MenuOption {
  label: string;
  /** Coloured target name shown after the verb, RuneScape-style. */
  target?: string;
  run: () => void;
}

export interface ContextMenuRequest {
  x: number;
  y: number;
  options: MenuOption[];
}

/** Player walking speed in tiles per second. */
export const WALK_SPEED = 3.4;

const VIEW_KEY = "unigame.realm.firstPerson";
function readFirstPerson(): boolean {
  try {
    return localStorage.getItem(VIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/** Switches between the over-the-shoulder camera and first person (remembered on this device). */
export function setFirstPerson(on: boolean): void {
  runtime.camera.firstPerson = on;
  runtime.camera.look = 0;
  try {
    localStorage.setItem(VIEW_KEY, on ? "1" : "0");
  } catch {
    // Per-device convenience only.
  }
  window.dispatchEvent(new CustomEvent("realm-view", { detail: on }));
}

export const runtime = {
  /** hop: height of the current jump (0 on the ground), so the first-person camera can follow it. */
  /** stamina: 0..1 for the Shift sprint (drains while sprinting, refills when you stop); sprinting: boosting right now. */
  player: { x: 0, z: 0, facing: 0, flying: false, altitude: 0, hop: 0, stamina: 1, sprinting: false },
  /** The walk-in room the player is standing in (world/rooms.ts), if any. */
  room: null as null | "dorm" | "theatre",
  /** Set while the player sits (e.g. in the lecture theatre): where, how far the body drops, and where to stand up. */
  seat: null as null | { x: number; z: number; drop: number; facing: number; standX: number; standZ: number },
  /** yaw 0 = camera south of the player looking north (-Z). */
  /**
   * firstPerson: see through the character's eyes (only ever switched by the view button);
   * look: how far up (+) or down (-) you look in first person, radians.
   */
  camera: { yaw: 0, pitch: 0.82, distance: 15, firstPerson: readFirstPerson(), look: 0 },
  marker: { x: 0, z: 0, red: false, at: -10 },
  /** Set by the scene: walk the player to a tile. */
  walkTo: null as null | ((x: number, z: number) => void),
  /** Set by the scene: instantly move the player (home teleport). */
  teleport: null as null | ((x: number, z: number) => void),
  /** Every object in the current world (set by the scene). */
  objects: [] as WorldObject[],
  /** The closest usable object within reach (for the Space-to-use prompt). */
  nearby: null as WorldObject | null,
  /** Set by the scene: walk to an object and run one of its actions. */
  interact: null as null | ((object: WorldObject, actionId: string) => void),
  /** On-screen joystick for touch screens: x = right, y = forward, each -1..1. */
  joystick: { x: 0, y: 0 },
  /** Set by the scene: use the object in reach without jumping (a click in mouse-look). */
  useInFront: null as null | (() => void),
  /** Set by the scene: jump (the Space key / touch jump button). */
  jump: null as null | (() => void),
  /** Set by the scene: use the object in reach (the E key / touch "Use" button). */
  useNearby: null as null | (() => void),
  /** Set by the scene: strike the nearest enemy in reach (the F key / clicking an enemy). */
  attackNow: null as null | (() => void),
  /** Set by the scene: run an object's action right away, without walking there (menus, tests). */
  actNow: null as null | ((object: WorldObject, actionId: string) => void),
  /** Where to put the player when the next world mounts, instead of its spawn (e.g. outside the door you left by). */
  arrival: null as { x: number; z: number; mode: "island" | "interior" } | null,
  /** The NPC object the player is talking to (professors gesture and face you). */
  talkingTo: null as string | null,
  /** Set by the scene: take off or land on the broom (B). */
  toggleBroom: null as null | (() => void),
  /** Set by the scene: cast the spell in a spell-bar slot (0-3). */
  castSlot: null as null | ((slot: number) => void),
  /** Set by the scene: play an emote (see hud/EmoteWheel.tsx). */
  emote: null as null | ((id: string) => void),
};

type HoverListener = (text: { verb: string; target: string; extra: number } | null) => void;
const hoverListeners = new Set<HoverListener>();
let lastHoverKey = "";

export function setHover(text: { verb: string; target: string; extra: number } | null): void {
  const key = text ? `${text.verb}|${text.target}|${text.extra}` : "";
  if (key === lastHoverKey) return;
  lastHoverKey = key;
  hoverListeners.forEach((l) => l(text));
}

export function onHover(listener: HoverListener): () => void {
  hoverListeners.add(listener);
  return () => hoverListeners.delete(listener);
}

type NearbyListener = (object: WorldObject | null) => void;
const nearbyListeners = new Set<NearbyListener>();

export function setNearby(object: WorldObject | null): void {
  if (runtime.nearby?.id === object?.id) return;
  runtime.nearby = object;
  nearbyListeners.forEach((l) => l(object));
}

export function onNearby(listener: NearbyListener): () => void {
  nearbyListeners.add(listener);
  return () => nearbyListeners.delete(listener);
}

// Dev-only handle for debugging and automated play-testing (stripped from production builds).
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __realm?: typeof runtime }).__realm = runtime;
}
