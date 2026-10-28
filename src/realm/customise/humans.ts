/**
 * Player bodies: realistic-proportioned characters (Quaternius Ultimate
 * Modular Men / Women, Quaternius Asset Licence — see ASSET_LICENCES.md).
 * Every outfit splits into head (face and hair), body, legs and feet, all on
 * one shared skeleton, so parts mix freely within a body type. Sliders scale
 * bones for height, build and muscle; skin, hair and outfit colours recolour
 * the flat-shaded materials.
 */

import type { Appearance, BodyType } from "../types";

export type PartSlot = "head" | "body" | "legs" | "feet";
export const PART_SLOTS: Array<{ id: PartSlot; label: string }> = [
  { id: "head", label: "Head & hair" },
  { id: "body", label: "Top" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Shoes" },
];

export interface Outfit {
  id: string;
  label: string;
}

/** The outfit whose file also carries the animations, per body type. */
export const BASE_OUTFIT: Record<BodyType, string> = { female: "casual", male: "casual-2" };

export const OUTFITS: Record<BodyType, Outfit[]> = {
  female: [
    { id: "casual", label: "Casual" },
    { id: "witch", label: "Enchanter's robes" },
    { id: "medieval", label: "Medieval" },
    { id: "adventurer", label: "Adventurer" },
    { id: "formal", label: "Formal" },
    { id: "suit", label: "Suit" },
    { id: "punk", label: "Punk" },
    { id: "worker", label: "Workwear" },
    { id: "soldier", label: "Ranger" },
    { id: "scifi", label: "Star-voyager" },
  ],
  male: [
    { id: "casual-2", label: "Casual" },
    { id: "king", label: "Royal robes" },
    { id: "adventurer", label: "Adventurer" },
    { id: "casual-hoodie", label: "Hoodie" },
    { id: "suit", label: "Suit" },
    { id: "punk", label: "Punk" },
    { id: "beach", label: "Summer" },
    { id: "worker", label: "Workwear" },
    { id: "swat", label: "Guard" },
    { id: "spacesuit", label: "Star-voyager" },
  ],
};

export function outfitFile(body: BodyType, id: string): string {
  return `models/quaternius/${body}/${id === BASE_OUTFIT[body] ? "base-" : ""}${id}.glb`;
}

export function outfit(body: BodyType, id: string): Outfit {
  return OUTFITS[body].find((o) => o.id === id) ?? OUTFITS[body][0];
}

/** Every outfit file has one mesh per slot, named "<Something>_Head" etc. */
export const SLOT_SUFFIX: Record<PartSlot, string> = { head: "Head", body: "Body", legs: "Legs", feet: "Feet" };

export const SKIN_TONES = ["#f6d7c3", "#eac0a2", "#d9a37e", "#c18660", "#9c6644", "#7a4a2e", "#5a3420", "#3e2416"];
export const HAIR_COLOURS = ["#1a1412", "#3b2416", "#6b4423", "#a0662f", "#d9b26a", "#e8dcc0", "#9a9a9a", "#a3172b", "#2347a8", "#5e2a84"];

export function defaultAppearance(body: BodyType = "female"): Appearance {
  const base = BASE_OUTFIT[body];
  return {
    body,
    parts: { head: base, body: base, legs: base, feet: base },
    height: 0,
    build: 0,
    muscle: 0.2,
    skin: SKIN_TONES[1],
    hair: HAIR_COLOURS[2],
    outfitColour: null,
  };
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);

/** Accepts anything; returns a valid appearance. */
export function sanitizeAppearance(raw: unknown): Appearance {
  const r = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
  const body: BodyType = r.body === "male" ? "male" : "female";
  const base = defaultAppearance(body);
  const parts = (typeof r.parts === "object" && r.parts ? r.parts : {}) as Record<string, unknown>;
  const valid = (v: unknown) => (typeof v === "string" && OUTFITS[body].some((o) => o.id === v) ? v : BASE_OUTFIT[body]);
  return {
    body,
    parts: { head: valid(parts.head), body: valid(parts.body), legs: valid(parts.legs), feet: valid(parts.feet) },
    height: clamp(r.height, -1, 1, 0),
    build: clamp(r.build, -1, 1, 0),
    muscle: clamp(r.muscle, 0, 1, base.muscle),
    skin: hex(r.skin, base.skin),
    hair: hex(r.hair, base.hair),
    outfitColour: r.outfitColour === null || r.outfitColour === undefined ? null : hex(r.outfitColour, "#7a4a2e"),
  };
}

/** Every outfit file an appearance needs, the animated base first. */
export function appearanceFiles(a: Appearance): string[] {
  const ids = [BASE_OUTFIT[a.body], ...Object.values(a.parts)];
  return Array.from(new Set(ids)).map((id) => outfitFile(a.body, id));
}

/**
 * How thick (x, z) and long (y) each bone should end up, from the sliders.
 * Bone scale is inherited by children, so the renderer divides each bone's
 * target by its parent's to get the local scale.
 */
export function boneTargets(a: Pick<Appearance, "height" | "build" | "muscle" | "body">): Record<string, [number, number, number]> {
  const b = a.build;
  const m = a.muscle;
  const leg = 1 + 0.09 * a.height;
  const t: Record<string, [number, number, number]> = {
    Hips: [1 + 0.22 * b, 1, 1 + 0.2 * b],
    Abdomen: [1 + 0.36 * b, 1, 1 + 0.42 * b],
    Torso: [1 + 0.28 * b + 0.06 * m, 1, 1 + 0.3 * b + 0.06 * m],
    Chest: [1 + 0.12 * b + 0.2 * m, 1, 1 + 0.1 * b + 0.16 * m],
    Neck: [1 + 0.1 * b + 0.12 * m, 1, 1 + 0.1 * b + 0.12 * m],
    Head: [1, 1, 1],
  };
  for (const side of ["L", "R"]) {
    t[`Shoulder.${side}`] = [1 + 0.06 * b + 0.12 * m, 1, 1 + 0.06 * b + 0.12 * m];
    t[`UpperArm.${side}`] = [1 + 0.22 * b + 0.36 * m, 1, 1 + 0.22 * b + 0.36 * m];
    t[`LowerArm.${side}`] = [1 + 0.14 * b + 0.22 * m, 1, 1 + 0.14 * b + 0.22 * m];
    t[`Wrist.${side}`] = [1, 1, 1];
    t[`UpperLeg.${side}`] = [1 + 0.28 * b + 0.14 * m, leg, 1 + 0.28 * b + 0.14 * m];
    t[`LowerLeg.${side}`] = [1 + 0.1 * b + 0.08 * m, leg, 1 + 0.1 * b + 0.08 * m];
    t[`Foot.${side}`] = [1, 1, 1];
  }
  return t;
}

/** Overall scale for the height slider (legs add a little more on top). */
export function heightScale(height: number): number {
  return 1 + 0.1 * height;
}

/** Animation names for the clips the game asks for (the old adventurer names still work). */
export const CLIP_ALIAS: Record<string, string> = {
  Idle: "Idle",
  Idle_Combat: "Idle",
  Running_A: "Run",
  Walking_A: "Walk",
  Interact: "Interact",
  Cheer: "Wave",
  Wave: "Wave",
  "1H_Melee_Attack_Chop": "Sword_Slash",
  Spellcast_Shoot: "Gun_Shoot",
  Cast: "Gun_Shoot",
  Point: "Idle_Gun_Pointing",
  Jump_Full_Short: "Roll",
  Roll: "Roll",
  PickUp: "Interact",
  Hit_A: "HitRecieve",
  Death_A: "Death",
  Punch: "Punch_Right",
  Kick: "Kick_Right",
};

/** Material names that keep their own colour when the outfit colour changes. */
export function isFixedMaterial(name: string): boolean {
  return /^(Skin|Hair|Eye|Eyebrow|Metal|Gold|Black|White|Glass|Tie)/i.test(name);
}
