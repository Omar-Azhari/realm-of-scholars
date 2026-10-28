/**
 * Library building (Phase 20E, Part 1/2) — "quiet, warm, reading,
 * research." Reuses the generic `CampusBuildingScene` shell (movement,
 * camera, interaction, NPC rendering) and `furniturePieces.tsx`'s shared
 * primitives (`Bookshelf`, `ReadingChair`, `StandingLamp`, `PotPlant`,
 * `Rug`) for everything that already exists — only the reading table and
 * returns desk are new, Library-specific geometry, since nothing already
 * built matches "a long table people sit at" or "a service counter."
 * Lighting borrows the existing `cozy-library` Room Theme's rig
 * (`roomThemes.ts`, Phase 20D) rather than inventing a second "quiet
 * study" lighting recipe — the exact preset a player could ALSO choose
 * for their own room, reused here for atmospheric consistency, not
 * duplicated.
 */

import { RoundedBox } from "@react-three/drei";
import { CampusBuildingScene, type BuildingNpcDefinition, type BuildingPalette } from "../../scenes/CampusBuildingScene";
import { Bookshelf, ContactShadow, PotPlant, ReadingChair, Rug, StandingLamp, WOOD, WOOD_DARK } from "../../rooms/furniturePieces";
import { floorPointToVector3 } from "../../types/coordinates";
import { ROOM_THEMES } from "../../rooms/roomThemes";
import type { NpcSchedule } from "../../characters/npcSchedule";
import type { CharacterAppearance, PlayerPersonality } from "../../../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";
import type { TimeOfDay } from "../timeOfDay";

export const LIBRARY_WORLD: SceneWorld = {
  sceneId: "campus-library",
  width: 700,
  height: 500,
  walkable: { xMin: 40, xMax: 660, feetBack: 40, feetFront: 460 },
  heightFront: 140,
  heightBack: 90,
  spawn: { x: 350, feetY: 380 },
  obstacles: [
    { xMin: 60, xMax: 260, feetMin: 40, feetMax: 100 },
    { xMin: 440, xMax: 640, feetMin: 40, feetMax: 100 },
    { xMin: 300, xMax: 460, feetMin: 220, feetMax: 300 },
    { xMin: 60, xMax: 180, feetMin: 400, feetMax: 460 },
  ],
  interactables: [
    {
      id: "library-exit",
      kind: "door",
      label: "Campus HQ",
      actionLabel: "Return to Campus HQ",
      action: { type: "travel", sceneId: "campus-hq" },
      rect: [300, 460, 100, 30],
      standPoint: { x: 350, feetY: 440 },
      range: 60,
    },
    {
      id: "reading-table",
      kind: "shelf",
      label: "Reading Table",
      actionLabel: "Browse Learning Material",
      action: { type: "open-panel", panel: "subjects", section: "resources" },
      rect: [300, 220, 160, 80],
      standPoint: { x: 380, feetY: 320 },
      range: 70,
    },
    {
      id: "librarian-desk",
      kind: "info",
      label: "Librarian",
      actionLabel: "Talk",
      action: { type: "npc-chat", role: "librarian", npcLabel: "Librarian" },
      rect: [60, 400, 120, 60],
      standPoint: { x: 200, feetY: 400 },
      range: 70,
    },
  ],
};

const LIBRARY_APPEARANCE: CharacterAppearance = {
  bodyId: "body-c",
  skinToneId: "skin-04",
  hairId: "hair-bun",
  hairColorId: "haircolor-grey",
  eyesId: "eyes-brown",
  eyebrowsId: "brow-medium",
  facialHairId: null,
  topId: "top-button-shirt-1",
  jacketId: "jacket-cardigan-1",
  bottomId: "bottom-pleated-trousers-1",
  shoesId: "shoes-loafers-1",
  accessoryIds: ["acc-glasses-round"],
};

const LIBRARY_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-calm", secondaryTraitIds: ["trait-thoughtful"] };

const LIBRARIAN_SCHEDULE: NpcSchedule = {
  id: "librarian",
  waypoints: [
    { standPoint: { x: 200, feetY: 420 }, activity: "read", durationSeconds: 30, facingLeft: false },
    { standPoint: { x: 200, feetY: 420 }, activity: "think", durationSeconds: 14, facingLeft: false },
  ],
};

// Phase 21 Part 4 "social campus" — two students sharing the reading
// table, seated at the same two chairs `LibraryDressing` already places
// (tableCenter ± the exact metre offsets those chairs render at,
// converted back to floor-point scene units). Both run "read"-heavy
// schedules for the whole cycle, so they read as studying together
// continuously rather than only briefly overlapping.
const STUDY_BUDDY_A_APPEARANCE: CharacterAppearance = {
  bodyId: "body-d",
  skinToneId: "skin-06",
  hairId: "hair-curly",
  hairColorId: "haircolor-black",
  eyesId: "eyes-dark-brown",
  eyebrowsId: "brow-thick",
  facialHairId: null,
  topId: "top-long-sleeve-crew-0",
  jacketId: null,
  bottomId: "bottom-jeans-straight-0",
  shoesId: "shoes-sneakers-1",
  accessoryIds: [],
};

const STUDY_BUDDY_A_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-thoughtful", secondaryTraitIds: ["trait-calm"] };

const STUDY_BUDDY_A_SCHEDULE: NpcSchedule = {
  id: "study-buddy-a",
  waypoints: [
    { standPoint: { x: 330, feetY: 200 }, activity: "read", durationSeconds: 40, facingLeft: false },
    { standPoint: { x: 330, feetY: 200 }, activity: "think", durationSeconds: 12, facingLeft: false },
  ],
};

const STUDY_BUDDY_B_APPEARANCE: CharacterAppearance = {
  bodyId: "body-a",
  skinToneId: "skin-03",
  hairId: "hair-short-textured",
  hairColorId: "haircolor-chestnut",
  eyesId: "eyes-hazel",
  eyebrowsId: "brow-thin",
  facialHairId: null,
  topId: "top-hoodie-1",
  jacketId: null,
  bottomId: "bottom-joggers-0",
  shoesId: "shoes-sneakers-2",
  accessoryIds: ["acc-glasses-round"],
};

const STUDY_BUDDY_B_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-calm", secondaryTraitIds: ["trait-thoughtful"] };

const STUDY_BUDDY_B_SCHEDULE: NpcSchedule = {
  id: "study-buddy-b",
  waypoints: [
    { standPoint: { x: 430, feetY: 320 }, activity: "read", durationSeconds: 36, facingLeft: true },
    { standPoint: { x: 430, feetY: 320 }, activity: "write", durationSeconds: 16, facingLeft: true },
  ],
};

export const LIBRARY_NPCS: BuildingNpcDefinition[] = [
  { id: "librarian", label: "Librarian", appearance: LIBRARY_APPEARANCE, personality: LIBRARY_PERSONALITY, schedule: LIBRARIAN_SCHEDULE, scheduleTimeOffsetSeconds: 0, interactableId: "librarian-desk" },
  { id: "study-buddy-a", label: "Student", appearance: STUDY_BUDDY_A_APPEARANCE, personality: STUDY_BUDDY_A_PERSONALITY, schedule: STUDY_BUDDY_A_SCHEDULE, scheduleTimeOffsetSeconds: 0, activeTimes: ["morning", "afternoon", "evening"] },
  { id: "study-buddy-b", label: "Student", appearance: STUDY_BUDDY_B_APPEARANCE, personality: STUDY_BUDDY_B_PERSONALITY, schedule: STUDY_BUDDY_B_SCHEDULE, scheduleTimeOffsetSeconds: 6, activeTimes: ["morning", "afternoon", "evening"] },
];

/** Borrows the `cozy-library` Room Theme's lighting rig — the same one a player could choose for Campus HQ — rather than a second bespoke "quiet study" recipe. */
export const LIBRARY_PALETTE: BuildingPalette = {
  wallColor: "#c9a876",
  floorColor: "#6b4a2f",
  trimColor: "#8a5a34",
  lighting: ROOM_THEMES["cozy-library"].lighting,
};

function LibraryReadingTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={1.1} />
      <RoundedBox args={[1.8, 0.06, 0.9]} radius={0.02} smoothness={2} position={[0, 0.72, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.9} metalness={0} />
      </RoundedBox>
      {[-0.8, 0.8].map((legX) =>
        [-0.38, 0.38].map((legZ) => (
          <mesh key={`${legX}-${legZ}`} position={[legX, 0.36, legZ]} castShadow>
            <boxGeometry args={[0.06, 0.72, 0.06]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
          </mesh>
        ))
      )}
      {/* A stack of books left on the table — reads as "in active use." */}
      <RoundedBox args={[0.3, 0.05, 0.22]} radius={0.01} position={[0.55, 0.77, 0.1]} castShadow>
        <meshStandardMaterial color="#c1543f" roughness={1} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.28, 0.05, 0.2]} radius={0.01} position={[0.55, 0.82, 0.1]} rotation={[0, 0.15, 0]} castShadow>
        <meshStandardMaterial color="#4f7a8c" roughness={1} metalness={0} />
      </RoundedBox>
    </group>
  );
}

function LibrarianDesk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.85} />
      <RoundedBox args={[1.4, 0.75, 0.6]} radius={0.03} smoothness={1} position={[0, 0.375, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.36, 0.02, 0.24]} radius={0.01} position={[-0.4, 0.77, 0]} castShadow>
        <meshStandardMaterial color="#e8e2d6" roughness={0.6} metalness={0} />
      </RoundedBox>
      <mesh position={[0.4, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial color="#9a9490" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

export function LibraryDressing() {
  const shelfA1 = floorPointToVector3({ x: 110, feetY: 70 });
  const shelfA2 = floorPointToVector3({ x: 210, feetY: 70 });
  const shelfB1 = floorPointToVector3({ x: 490, feetY: 70 });
  const shelfB2 = floorPointToVector3({ x: 590, feetY: 70 });
  const tableCenter = floorPointToVector3({ x: 380, feetY: 260 });
  const deskCenter = floorPointToVector3({ x: 120, feetY: 430 });

  return (
    <>
      <Rug x={tableCenter[0]} z={tableCenter[2]} width={2.2} depth={1.6} />
      <Bookshelf x={shelfA1[0]} z={shelfA1[2]} />
      <Bookshelf x={shelfA2[0]} z={shelfA2[2]} color="#8a5a34" />
      <Bookshelf x={shelfB1[0]} z={shelfB1[2]} />
      <Bookshelf x={shelfB2[0]} z={shelfB2[2]} color="#8a5a34" />
      <LibraryReadingTable x={tableCenter[0]} z={tableCenter[2]} />
      <ReadingChair x={tableCenter[0] - 0.5} z={tableCenter[2] - 0.6} />
      <ReadingChair x={tableCenter[0] + 0.5} z={tableCenter[2] + 0.6} />
      <StandingLamp x={tableCenter[0] - 1.1} z={tableCenter[2]} />
      <LibrarianDesk x={deskCenter[0]} z={deskCenter[2]} />
      <PotPlant x={deskCenter[0] + 0.9} y={0} z={deskCenter[2] - 0.2} />
    </>
  );
}

export function LibraryScene({
  reduceMotion,
  onAction,
  onInRangeChange,
  timeOfDay,
  talkingNpcId = null,
}: {
  reduceMotion: boolean;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
  timeOfDay: TimeOfDay;
  /** Phase 23 "Visual Improvements" — see CampusBuildingScene.tsx. */
  talkingNpcId?: string | null;
}) {
  return (
    <CampusBuildingScene
      world={LIBRARY_WORLD}
      palette={LIBRARY_PALETTE}
      npcs={LIBRARY_NPCS}
      dressing={<LibraryDressing />}
      ambienceSounds={["library-ambience"]}
      timeOfDay={timeOfDay}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default LibraryScene;
