/**
 * Default `PlayerIdentity` construction (Phase 20B, Part 10). Used only
 * for migrating a save that predates this phase entirely — a genuinely
 * fresh save gets `playerIdentity: null` instead (see
 * `createDefaultSaveData` in persistence.ts), so the onboarding flow shows
 * exactly once, for exactly the players who've never set one up.
 *
 * "Old saves receive: default appearance, default clothing, default
 * personality. No save corruption." — this file is that default.
 */

import type { CharacterAppearance, PlayerIdentity, PlayerPersonality, RoomCustomisation } from "../types/domain";
import { ROOM_SLOTS } from "../game3d/rooms/roomSlots";
import { FURNITURE_CATALOGUE, STARTER_FURNITURE_IDS } from "./furnitureCatalogue";

export function createDefaultAppearance(): CharacterAppearance {
  return {
    bodyId: "body-b",
    skinToneId: "skin-03",
    hairId: "hair-side-part",
    hairColorId: "haircolor-brown",
    eyesId: "eyes-dark-brown",
    eyebrowsId: "brow-medium",
    facialHairId: null,
    topId: "top-crew-tee-0",
    jacketId: null,
    bottomId: "bottom-jeans-straight-0",
    shoesId: "shoes-sneakers-0",
    accessoryIds: [],
  };
}

export function createDefaultPersonality(): PlayerPersonality {
  return {
    primaryTraitId: "trait-calm",
    secondaryTraitIds: [],
  };
}

/**
 * Every slot gets its "starter" catalogue item (the one already unlocked
 * for everyone, per `furnitureCatalogue.ts`) if one exists for that slot's
 * category — reproducing exactly today's room, not a different one. The
 * two genuinely new slots (storage, decoration — Phase 20D Part 9) have
 * no starter item, so they default to empty, matching the fact nothing
 * occupies those spots in the room shipped before this phase.
 */
export function createDefaultRoomCustomisation(): RoomCustomisation {
  const placedFurniture: Record<string, string | null> = {};
  const rotations: Record<string, number> = {};
  for (const slot of ROOM_SLOTS) {
    const starter = FURNITURE_CATALOGUE.find((item) => item.category === slot.category && STARTER_FURNITURE_IDS.includes(item.id));
    placedFurniture[slot.id] = starter?.id ?? null;
    rotations[slot.id] = 0;
  }
  return {
    unlockedFurnitureIds: [...STARTER_FURNITURE_IDS],
    placedFurniture,
    rotations,
  };
}

export function createDefaultPlayerIdentity(): PlayerIdentity {
  const now = new Date(0).toISOString();
  return {
    preferredName: "Student",
    displayName: null,
    university: null,
    degree: null,
    yearLevel: null,
    appearance: createDefaultAppearance(),
    personality: createDefaultPersonality(),
    preferredRoomTheme: "modern-campus",
    favouriteColour: "#ff8a4c",
    createdAt: now,
    lastModifiedAt: now,
    schemaVersion: 1,
    roomCustomisation: createDefaultRoomCustomisation(),
  };
}
