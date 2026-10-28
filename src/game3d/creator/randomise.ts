/**
 * Deterministic-when-seeded randomisation for the Character Creator's
 * "Randomise" button (Phase 20B, Part 3). `rng` defaults to `Math.random`
 * for real use, but accepts any `() => number` in [0, 1) — the test
 * harness (scripts/verify-phase20b-character.ts) passes a small seeded
 * generator so "randomise" is verifiable without depending on real
 * randomness. Every id produced is validated against the catalogue by
 * construction (it's picked FROM the catalogue arrays), so a randomised
 * appearance/personality is always `isValidAppearance`/`isValidPersonality`.
 */

import {
  BODY_PRESETS,
  SKIN_TONES,
  HAIR_OPTIONS,
  HAIR_COLORS,
  EYE_OPTIONS,
  EYEBROW_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  TOP_OPTIONS,
  JACKET_OPTIONS,
  BOTTOM_OPTIONS,
  SHOES_OPTIONS,
  ACCESSORY_OPTIONS,
} from "../../data/appearanceCatalogue";
import { PERSONALITY_TRAITS } from "../../data/personalityTraits";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";

export type Rng = () => number;

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** ~half the time picks `null` (no jacket / no facial hair) — both are meant to be common, not rare, in a random face. */
function pickNullable<T>(rng: Rng, arr: T[], noneChance = 0.5): T | null {
  return rng() < noneChance ? null : pick(rng, arr);
}

function pickAccessoryIds(rng: Rng): string[] {
  const count = Math.floor(rng() * 3); // 0, 1, or 2
  const ids = new Set<string>();
  let guard = 0;
  while (ids.size < count && guard < 20) {
    ids.add(pick(rng, ACCESSORY_OPTIONS).id);
    guard++;
  }
  return Array.from(ids);
}

export function randomiseAppearance(rng: Rng = Math.random): CharacterAppearance {
  return {
    bodyId: pick(rng, BODY_PRESETS).id,
    skinToneId: pick(rng, SKIN_TONES).id,
    hairId: pick(rng, HAIR_OPTIONS).id,
    hairColorId: pick(rng, HAIR_COLORS).id,
    eyesId: pick(rng, EYE_OPTIONS).id,
    eyebrowsId: pick(rng, EYEBROW_OPTIONS).id,
    facialHairId: pickNullable(rng, FACIAL_HAIR_OPTIONS)?.id ?? null,
    topId: pick(rng, TOP_OPTIONS).id,
    jacketId: pickNullable(rng, JACKET_OPTIONS)?.id ?? null,
    bottomId: pick(rng, BOTTOM_OPTIONS).id,
    shoesId: pick(rng, SHOES_OPTIONS).id,
    accessoryIds: pickAccessoryIds(rng),
  };
}

export function randomisePersonality(rng: Rng = Math.random): PlayerPersonality {
  const primary = pick(rng, PERSONALITY_TRAITS);
  const pool = PERSONALITY_TRAITS.filter((t) => t.id !== primary.id);
  const secondaryCount = Math.floor(rng() * 3); // 0, 1, or 2
  const secondaryIds = new Set<string>();
  let guard = 0;
  while (secondaryIds.size < secondaryCount && guard < 20) {
    secondaryIds.add(pick(rng, pool).id);
    guard++;
  }
  return { primaryTraitId: primary.id, secondaryTraitIds: Array.from(secondaryIds) };
}

/** A simple, deterministic seeded RNG (mulberry32) for tests — never used for the real in-app "Randomise" button, which always defaults to `Math.random`. */
export function createSeededRng(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
