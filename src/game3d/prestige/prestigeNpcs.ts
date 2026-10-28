/**
 * V2 Phase 1 "Prestige Vertical Slice" — NPC content for the 4 new
 * districts. Reuses the EXISTING appearance catalogue/rig verbatim (no new
 * wardrobe assets — building a full medieval clothing catalogue is future
 * scope, disclosed in docs/V2_PHASE1_VERTICAL_SLICE.md); "improve NPC
 * presentation" this phase means real spacing and idle variety, achieved
 * by composing EXISTING options that already read as closer to scholarly
 * robes (long tunics, cardigans, loose trousers, boots) than casual wear,
 * plus genuinely varied per-NPC waypoint schedules (never identical poses
 * clustered together).
 *
 * The Hall of Artisans' own subject mentor (Iris) reuses her EXISTING,
 * already-established appearance/personality from
 * `subjectBuilding/SubjectBuildingScene.tsx` verbatim — continuity of
 * WHO she is matters more than a wardrobe change neither this phase nor
 * the underlying data model supports yet.
 */

import { SUBJECT_MENTOR_APPEARANCE, SUBJECT_MENTOR_PERSONALITY } from "../campus/subjectBuilding/SubjectBuildingScene";
import type { PrestigeNpcDefinition } from "./PrestigeSceneShell";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";
import type { NpcSchedule } from "../characters/npcSchedule";

interface ScholarLook {
  bodyId: CharacterAppearance["bodyId"];
  skinToneId: CharacterAppearance["skinToneId"];
  hairId: CharacterAppearance["hairId"];
  hairColorId: CharacterAppearance["hairColorId"];
  eyesId: CharacterAppearance["eyesId"];
  eyebrowsId: CharacterAppearance["eyebrowsId"];
  facialHairId: CharacterAppearance["facialHairId"];
  topId: CharacterAppearance["topId"];
  jacketId: CharacterAppearance["jacketId"];
  bottomId: CharacterAppearance["bottomId"];
  shoesId: CharacterAppearance["shoesId"];
  accessoryIds?: string[];
}

/** A "scholar's robe" look built from the EXISTING catalogue's tunic/cardigan/loose-trousers options — the closest approximation to medieval dress this phase's data model supports without a new wardrobe catalogue. */
function scholarLook(overrides: ScholarLook): CharacterAppearance {
  return { accessoryIds: [], ...overrides };
}

const SCHOLAR_ROBE_MOSS: ScholarLook = {
  bodyId: "body-c", skinToneId: "skin-04", hairId: "hair-side-part", hairColorId: "haircolor-grey",
  eyesId: "eyes-hazel", eyebrowsId: "brow-medium", facialHairId: "facial-full-beard",
  topId: "top-tunic-long-0", jacketId: "jacket-cardigan-0", bottomId: "bottom-loose-trousers-0", shoesId: "shoes-boots-1",
};
const SCHOLAR_ROBE_RUST: ScholarLook = {
  bodyId: "body-b", skinToneId: "skin-06", hairId: "hair-bun", hairColorId: "haircolor-darkbrown",
  eyesId: "eyes-dark-brown", eyebrowsId: "brow-thin", facialHairId: null,
  topId: "top-tunic-long-1", jacketId: "jacket-cardigan-1", bottomId: "bottom-loose-trousers-1", shoesId: "shoes-boots-0",
};
const STUDENT_ROBE_A: ScholarLook = {
  bodyId: "body-a", skinToneId: "skin-02", hairId: "hair-medium-wavy", hairColorId: "haircolor-honeyblonde",
  eyesId: "eyes-blue", eyebrowsId: "brow-soft-arch", facialHairId: null,
  topId: "top-long-sleeve-crew-0", jacketId: "jacket-cardigan-0", bottomId: "bottom-loose-trousers-1", shoesId: "shoes-boots-2",
  accessoryIds: ["acc-scarf-sage"],
};
const STUDENT_ROBE_B: ScholarLook = {
  bodyId: "body-e", skinToneId: "skin-07", hairId: "hair-tight-curls", hairColorId: "haircolor-black",
  eyesId: "eyes-dark-brown", eyebrowsId: "brow-angled", facialHairId: null,
  topId: "top-long-sleeve-crew-1", jacketId: "jacket-cardigan-1", bottomId: "bottom-loose-trousers-0", shoesId: "shoes-boots-1",
  accessoryIds: ["acc-scarf-terracotta"],
};
const GUARD_LOOK: ScholarLook = {
  bodyId: "body-d", skinToneId: "skin-05", hairId: "hair-short-crop", hairColorId: "haircolor-black",
  eyesId: "eyes-brown", eyebrowsId: "brow-thick", facialHairId: "facial-stubble",
  topId: "top-tunic-long-0", jacketId: "jacket-blazer-0", bottomId: "bottom-loose-trousers-1", shoesId: "shoes-boots-0",
  accessoryIds: ["acc-watch"],
};

const CALM_SCHOLAR: PlayerPersonality = { primaryTraitId: "trait-calm", secondaryTraitIds: ["trait-thoughtful"] };
const DILIGENT_SCHOLAR: PlayerPersonality = { primaryTraitId: "trait-diligent", secondaryTraitIds: ["trait-calm"] };
const SOCIABLE_STUDENT: PlayerPersonality = { primaryTraitId: "trait-sociable", secondaryTraitIds: ["trait-creative"] };

/** A fixed-position schedule cycling through a few real poses — natural idle variety without any risk of a straight-line walk clipping the much larger new obstacle layouts (see PrestigeSceneShell's header note on why walk-schedules stay simple this phase). */
function standingSchedule(id: string, point: { x: number; feetY: number }, poses: Array<{ activity: NpcSchedule["waypoints"][number]["activity"]; seconds: number }>, facingLeft = false): NpcSchedule {
  return {
    id,
    waypoints: poses.map((p) => ({ standPoint: point, activity: p.activity, durationSeconds: p.seconds, facingLeft })),
  };
}

// ---------------------------------------------------------------------------
// Main Gate
// ---------------------------------------------------------------------------

export function buildMainGateNpcs(): PrestigeNpcDefinition[] {
  return [
    {
      id: "gate-guard",
      label: "Gatekeeper",
      appearance: scholarLook(GUARD_LOOK),
      personality: DILIGENT_SCHOLAR,
      schedule: standingSchedule("gate-guard", { x: 1000, feetY: 900 }, [
        { activity: "idle", seconds: 14 },
        { activity: "lookAround", seconds: 6 },
        { activity: "stretch", seconds: 5 },
      ]),
      interactableId: "gate-guard",
    },
  ];
}

// ---------------------------------------------------------------------------
// Grand Courtyard
// ---------------------------------------------------------------------------

export function buildGrandCourtyardNpcs(): PrestigeNpcDefinition[] {
  return [
    {
      id: "courtyard-scholar-1",
      label: "Scholar",
      appearance: scholarLook(SCHOLAR_ROBE_MOSS),
      personality: CALM_SCHOLAR,
      schedule: standingSchedule("courtyard-scholar-1", { x: 1400, feetY: 2600 }, [
        { activity: "read", seconds: 22 },
        { activity: "think", seconds: 10 },
      ]),
    },
    {
      id: "courtyard-scholar-2",
      label: "Scholar",
      appearance: scholarLook(STUDENT_ROBE_A),
      personality: SOCIABLE_STUDENT,
      schedule: standingSchedule("courtyard-scholar-2", { x: 3600, feetY: 3200 }, [
        { activity: "lookAround", seconds: 8 },
        { activity: "wave", seconds: 3 },
        { activity: "idle", seconds: 12 },
      ]),
    },
    {
      id: "courtyard-scholar-3",
      label: "Scholar",
      appearance: scholarLook(SCHOLAR_ROBE_RUST),
      personality: DILIGENT_SCHOLAR,
      schedule: standingSchedule("courtyard-scholar-3", { x: 2500, feetY: 4200 }, [
        { activity: "think", seconds: 16 },
        { activity: "stretch", seconds: 6 },
      ], true),
    },
  ];
}

// ---------------------------------------------------------------------------
// Great Hall
// ---------------------------------------------------------------------------

export function buildGreatHallNpcs(): PrestigeNpcDefinition[] {
  // Seated near the two long tables (x≈7m/13m, spanning z≈8-34m — see
  // GreatHallScene.tsx's own table placement), well spread along their
  // length so no two diners cluster at the same spot.
  const diners: Array<{ id: string; look: ScholarLook; personality: PlayerPersonality; point: { x: number; feetY: number }; facingLeft?: boolean }> = [
    { id: "hall-diner-1", look: SCHOLAR_ROBE_MOSS, personality: CALM_SCHOLAR, point: { x: 620, feetY: 1200 } },
    { id: "hall-diner-2", look: STUDENT_ROBE_A, personality: SOCIABLE_STUDENT, point: { x: 1380, feetY: 1600 }, facingLeft: true },
    { id: "hall-diner-3", look: SCHOLAR_ROBE_RUST, personality: DILIGENT_SCHOLAR, point: { x: 620, feetY: 2600 } },
    { id: "hall-diner-4", look: STUDENT_ROBE_B, personality: SOCIABLE_STUDENT, point: { x: 1380, feetY: 3000 }, facingLeft: true },
  ];
  return diners.map((d) => ({
    id: d.id,
    label: "Student",
    appearance: scholarLook(d.look),
    personality: d.personality,
    schedule: standingSchedule(d.id, d.point, [
      { activity: "coffee", seconds: 14 },
      { activity: "talk", seconds: 8 },
      { activity: "lookAround", seconds: 7 },
    ], d.facingLeft),
  }));
}

// ---------------------------------------------------------------------------
// Hall of Artisans
// ---------------------------------------------------------------------------

/** Iris's REAL, established appearance/personality — reused verbatim, never re-authored, for continuity across renderers (see this file's own header comment). */
export function buildHallOfArtisansNpcs(): PrestigeNpcDefinition[] {
  const mentorAppearance = SUBJECT_MENTOR_APPEARANCE["user-interface-design"];
  const mentorPersonality = SUBJECT_MENTOR_PERSONALITY["user-interface-design"];
  return [
    {
      id: "user-interface-design",
      label: "Iris",
      appearance: mentorAppearance,
      personality: mentorPersonality,
      schedule: standingSchedule("user-interface-design", { x: 1800, feetY: 900 }, [
        { activity: "think", seconds: 18 },
        { activity: "talk", seconds: 10 },
      ]),
      interactableId: "artisans-mentor",
    },
    {
      id: "artisans-student-1",
      label: "Apprentice",
      appearance: scholarLook(STUDENT_ROBE_A),
      personality: SOCIABLE_STUDENT,
      schedule: standingSchedule("artisans-student-1", { x: 900, feetY: 1700 }, [
        { activity: "write", seconds: 16 },
        { activity: "think", seconds: 8 },
      ]),
    },
    {
      id: "artisans-student-2",
      label: "Apprentice",
      appearance: scholarLook(STUDENT_ROBE_B),
      personality: CALM_SCHOLAR,
      schedule: standingSchedule("artisans-student-2", { x: 2700, feetY: 1900 }, [
        { activity: "read", seconds: 20 },
        { activity: "stretch", seconds: 5 },
      ], true),
    },
  ];
}
