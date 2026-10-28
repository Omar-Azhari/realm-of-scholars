/**
 * Milestone 20A test room (Phase 20, Part 22), re-scaled in Milestone 20A.5
 * (Visual Direction Lock) to a cozier ~6m x 4.8m footprint — the brief's
 * "shrink the room... avoid giant empty floor space" instruction. Still a
 * single, hand-built `SceneWorld` fixture — NOT manifest-driven, explicitly
 * a technical prototype room, not real room art. Reuses the exact same
 * renderer-neutral `SceneWorld`/`FloorPoint`/`WorldInteractable`/
 * `InteractAction` types the legacy 2D renderer already uses
 * (src/world/worldTypes.ts, unmodified) — see
 * docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §1/§3 for why no new contract was
 * invented.
 *
 * Obstacle footprints now also cover the 20A.5 furniture set (bookshelf,
 * chair/reading nook, small couch) added for room-composition richness in
 * `TestRoomProps.tsx` — not just the desk. Every furniture obstacle's
 * footprint is sized to visually match its meshes there.
 */

import type { SceneWorld } from "../../world/worldTypes";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";
import { MENTOR_SCHEDULE, STUDENT_READER_SCHEDULE, STUDENT_SOCIAL_SCHEDULE } from "./testRoomSchedules";
import type { NpcSchedule } from "../characters/npcSchedule";
import type { TimeOfDay } from "../campus/timeOfDay";

export const TEST_ROOM_SCENE_ID = "game3d-test-room";

export const TEST_ROOM_WORLD: SceneWorld = {
  sceneId: TEST_ROOM_SCENE_ID,
  width: 600,
  height: 480,
  walkable: { xMin: 40, xMax: 560, feetBack: 40, feetFront: 440 },
  heightFront: 140,
  heightBack: 90,
  spawn: { x: 300, feetY: 280 },
  obstacles: [
    // Desk footprint — proves collision (Part 22's "collision works").
    { xMin: 220, xMax: 380, feetMin: 60, feetMax: 140 },
    // Bookshelf, against the back wall to the desk's right.
    { xMin: 430, xMax: 560, feetMin: 50, feetMax: 110 },
    // Reading chair + lamp + plant nook, front-left corner.
    { xMin: 70, xMax: 160, feetMin: 350, feetMax: 420 },
    // Small couch, front-right corner.
    { xMin: 400, xMax: 545, feetMin: 340, feetMax: 415 },
    // Wardrobe/mirror/clothes-rack cluster (Phase 20B Part 8), left wall, clear of the reading nook below it.
    { xMin: 55, xMax: 155, feetMin: 165, feetMax: 235 },
    // Coffee corner (Phase 20C Part 9), open central floor area — clear of every NPC schedule's walk path (verified by hand and by scripts/verify-phase20c-living-world.ts's line-vs-rect check).
    { xMin: 200, xMax: 280, feetMin: 300, feetMax: 350 },
  ],
  interactables: [
    {
      id: "door-exit",
      kind: "door",
      label: "Campus",
      actionLabel: "Enter Campus",
      action: { type: "leave-room" },
      rect: [250, 430, 100, 30],
      standPoint: { x: 300, feetY: 410 },
      range: 70,
    },
    {
      // Phase 20C Part 5 — contextual label ("Study Computer", matching the
      // brief's own "💻 Study Computer / Open Study Planner" example);
      // action unchanged from Milestone 20A.
      id: "desk-study",
      kind: "desk",
      label: "Study Computer",
      actionLabel: "Open Study Planner",
      action: { type: "open-study-planner" },
      rect: [220, 60, 160, 80],
      standPoint: { x: 300, feetY: 170 },
      range: 70,
    },
    {
      // Phase 20C Part 5 — reuses the EXISTING `open-panel` action
      // (src/world/worldTypes.ts, unmodified) to open the Subjects panel's
      // Resources section — the same real academic-resource content the
      // 2D renderer already shows, not new content. Stand point matches
      // `testRoomSchedules.ts`'s `BOOKSHELF_POINT` exactly (also where
      // NPCs stop to "read"), so there's one shared, non-duplicated
      // coordinate for "the spot in front of the bookshelf."
      id: "bookshelf-resources",
      kind: "shelf",
      label: "Bookshelf",
      actionLabel: "Browse Learning Material",
      action: { type: "open-panel", panel: "subjects", section: "resources" },
      rect: [430, 50, 130, 60],
      standPoint: { x: 495, feetY: 140 },
      range: 70,
    },
    {
      // Phase 20C Part 5 — contextual label ("Mirror", matching the
      // brief's own "🪞 Mirror / Change Appearance" example); action
      // unchanged from Milestone 20B.
      id: "wardrobe",
      kind: "wardrobe",
      label: "Mirror",
      actionLabel: "Change Appearance",
      action: { type: "open-character-creator" },
      rect: [55, 165, 100, 70],
      standPoint: { x: 175, feetY: 230 },
      range: 70,
    },
    {
      // Phase 20D Part 4 — the noticeboard slot's starter catalogue item
      // ("noticeboard-cork") carries the same `open-panel(tasks)` action;
      // this fixed WorldInteractable is the actual click/E-key wiring,
      // matching the desk/bookshelf/wardrobe pattern (every catalogue
      // item in the "noticeboard" category shares this one interaction
      // today, so there's nothing to look up dynamically per swap yet).
      id: "noticeboard",
      kind: "notice",
      label: "Noticeboard",
      actionLabel: "Check Deadlines",
      action: { type: "open-panel", panel: "tasks" },
      rect: [578, 185, 20, 60],
      standPoint: { x: 555, feetY: 215 },
      range: 70,
    },
    {
      // Phase 20D Part 4 — "Coffee Area -> Daily Brief." Stand point is on
      // the far side of the coffee table from spawn (not the near side),
      // matching Milestone 20A.5's "spawn isn't already in range of
      // anything" invariant (scripts/verify-phase20-3d-world.ts).
      id: "coffee-area",
      kind: "info",
      label: "Coffee Corner",
      actionLabel: "Check Daily Brief",
      action: { type: "open-panel", panel: "daily-brief" },
      rect: [200, 300, 80, 50],
      standPoint: { x: 240, feetY: 375 },
      range: 70,
    },
    {
      // Phase 20D Part 4 — "Computer -> Assessments & Calendar," distinct
      // from clicking the desk surface itself (which opens the Study
      // Planner via "desk-study" above). Same stand point as the desk —
      // reached via direct click on the laptop mesh in TestRoomScene.tsx,
      // same "activate() checks just this one item's range" mechanism
      // every other interactable already uses. Kind is "board" rather
      // than "desk" so this doesn't collide with the room's "exactly one
      // desk interactable" invariant — that check identifies the ONE
      // primary desk-surface interaction, not every object sitting on it.
      id: "desk-computer",
      kind: "board",
      label: "Computer",
      actionLabel: "Check Assessments & Calendar",
      action: { type: "open-panel", panel: "calendar" },
      rect: [245, 70, 60, 60],
      standPoint: { x: 300, feetY: 170 },
      range: 70,
    },
    {
      // Phase 20D Part 5 — the Room Planner board, the one entry point
      // into Room Edit Mode. Back wall, clear of the desk/bookshelf
      // footprints on either side and far enough from spawn that it
      // isn't already "in range" on arrival (matching the room's other
      // interactables — verified by scripts/verify-phase20-3d-world.ts).
      id: "room-planner",
      kind: "board",
      label: "Room Planner",
      actionLabel: "Edit Room",
      action: { type: "open-room-editor" },
      rect: [320, 0, 60, 20],
      standPoint: { x: 350, feetY: 180 },
      range: 70,
    },
    {
      // Phase 20E Part 6 — the Campus Directory signpost, in the open
      // floor gap between the desk/bookshelf and couch/coffee-corner
      // obstacles (verified clear of all 6 — scripts/verify-phase20e-*.ts).
      // Separate from "door-exit" above, which still leaves the 3D world
      // entirely, unchanged.
      id: "campus-directory",
      kind: "board",
      label: "Campus Directory",
      actionLabel: "View Campus Map",
      action: { type: "open-campus-directory" },
      rect: [370, 180, 40, 40],
      standPoint: { x: 390, feetY: 200 },
      range: 70,
    },
  ],
};

/** Fixed placeholder NPC stand position — visible, not yet interactive (Milestone 20A only requires "one 3D NPC is visible"). Repositioned for the 20A.5 room scale, in the clear midground between the bookshelf and reading nook. */
export const TEST_ROOM_NPC_POSITION = { x: 150, feetY: 260 };

/**
 * Phase 20B — the mentor/guide NPC's fixed appearance + personality, built
 * from the exact same catalogues a player picks from in the Character
 * Creator (Part 11: "NPCs should also use... appearance catalogue...
 * personality"). A hand-picked, valid combination of real catalogue ids —
 * not a bespoke NPC-only look.
 */
export const MENTOR_APPEARANCE: CharacterAppearance = {
  bodyId: "body-c",
  skinToneId: "skin-05",
  hairId: "hair-side-part",
  hairColorId: "haircolor-darkbrown",
  eyesId: "eyes-brown",
  eyebrowsId: "brow-medium",
  facialHairId: null,
  topId: "top-button-shirt-1",
  jacketId: "jacket-cardigan-1",
  bottomId: "bottom-pleated-trousers-1",
  shoesId: "shoes-loafers-1",
  accessoryIds: ["acc-glasses-round"],
};

export const MENTOR_PERSONALITY: PlayerPersonality = {
  primaryTraitId: "trait-calm",
  secondaryTraitIds: ["trait-thoughtful"],
};

/**
 * Phase 20C — two background student NPCs, populating Campus HQ (Part 9:
 * "students reading... student chatting"). Same reuse discipline as the
 * mentor: real catalogue ids, real personality traits, no bespoke look.
 */
export const STUDENT_READER_APPEARANCE: CharacterAppearance = {
  bodyId: "body-a",
  skinToneId: "skin-06",
  hairId: "hair-long-wavy",
  hairColorId: "haircolor-auburn",
  eyesId: "eyes-hazel",
  eyebrowsId: "brow-soft-arch",
  facialHairId: null,
  topId: "top-long-sleeve-crew-0",
  jacketId: null,
  bottomId: "bottom-jeans-straight-1",
  shoesId: "shoes-sneakers-1",
  accessoryIds: ["acc-scarf-sage"],
};

export const STUDENT_READER_PERSONALITY: PlayerPersonality = {
  primaryTraitId: "trait-thoughtful",
  secondaryTraitIds: ["trait-calm"],
};

export const STUDENT_SOCIAL_APPEARANCE: CharacterAppearance = {
  bodyId: "body-d",
  skinToneId: "skin-02",
  hairId: "hair-ponytail",
  hairColorId: "haircolor-honeyblonde",
  eyesId: "eyes-blue",
  eyebrowsId: "brow-thick",
  facialHairId: null,
  topId: "top-hoodie-1",
  jacketId: null,
  bottomId: "bottom-joggers-0",
  shoesId: "shoes-sneakers-2",
  accessoryIds: ["acc-beanie-tan"],
};

export const STUDENT_SOCIAL_PERSONALITY: PlayerPersonality = {
  primaryTraitId: "trait-sociable",
  secondaryTraitIds: ["trait-humorous"],
};

export interface RoomNpcDefinition {
  id: string;
  label: string;
  appearance: CharacterAppearance;
  personality: PlayerPersonality;
  schedule: NpcSchedule;
  /** Offsets this NPC's schedule clock so multiple NPCs never move in visual lockstep, even if they shared a schedule shape. */
  scheduleTimeOffsetSeconds: number;
  /** Phase 20E Part 7/8 — restricts when this NPC appears (atmosphere only). Omitted = always present. */
  activeTimes?: TimeOfDay[];
}

/** Every NPC populating this room — Campus HQ's "believable shared space" (Part 9), driven entirely by the deterministic schedule system (Parts 1/2). */
export const ROOM_NPCS: RoomNpcDefinition[] = [
  {
    id: "mentor",
    label: "Guide NPC",
    appearance: MENTOR_APPEARANCE,
    personality: MENTOR_PERSONALITY,
    schedule: MENTOR_SCHEDULE,
    scheduleTimeOffsetSeconds: 0,
  },
  {
    id: "student-reader",
    label: "Student (Reading)",
    appearance: STUDENT_READER_APPEARANCE,
    personality: STUDENT_READER_PERSONALITY,
    schedule: STUDENT_READER_SCHEDULE,
    scheduleTimeOffsetSeconds: 7,
    activeTimes: ["morning", "afternoon", "evening"],
  },
  {
    id: "student-social",
    label: "Student (Social)",
    appearance: STUDENT_SOCIAL_APPEARANCE,
    personality: STUDENT_SOCIAL_PERSONALITY,
    schedule: STUDENT_SOCIAL_SCHEDULE,
    scheduleTimeOffsetSeconds: 3,
    activeTimes: ["morning", "afternoon", "evening"],
  },
];
