/**
 * Student Lounge building (Phase 20E, Part 1/2) — "coffee, conversations,
 * relaxation." Reuses the generic `CampusBuildingScene` shell and shared
 * pieces (`ReadingChair`, `PotPlant`); a coffee counter/machine and a low
 * lounge table are new geometry — nothing existing matches either. The
 * Coffee Counter routes to the same Daily Brief panel Campus HQ's own
 * coffee corner uses (Phase 20D Part 4) — one panel, reused everywhere
 * "coffee" is the interaction metaphor, not a second one.
 */

import { RoundedBox } from "@react-three/drei";
import { CampusBuildingScene, type BuildingNpcDefinition, type BuildingPalette } from "../../scenes/CampusBuildingScene";
import { ContactShadow, PotPlant, ReadingChair, WOOD, WOOD_DARK } from "../../rooms/furniturePieces";
import { floorPointToVector3 } from "../../types/coordinates";
import { ROOM_THEMES } from "../../rooms/roomThemes";
import type { NpcSchedule } from "../../characters/npcSchedule";
import type { CharacterAppearance, PlayerPersonality } from "../../../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";
import type { TimeOfDay } from "../timeOfDay";

export const STUDENT_LOUNGE_WORLD: SceneWorld = {
  sceneId: "campus-student-lounge",
  width: 640,
  height: 460,
  walkable: { xMin: 40, xMax: 600, feetBack: 40, feetFront: 420 },
  heightFront: 140,
  heightBack: 90,
  spawn: { x: 320, feetY: 360 },
  obstacles: [
    { xMin: 60, xMax: 200, feetMin: 60, feetMax: 130 },
    { xMin: 260, xMax: 420, feetMin: 200, feetMax: 300 },
  ],
  interactables: [
    { id: "lounge-exit", kind: "door", label: "Campus HQ", actionLabel: "Return to Campus HQ", action: { type: "travel", sceneId: "campus-hq" }, rect: [270, 420, 100, 30], standPoint: { x: 320, feetY: 400 }, range: 60 },
    { id: "coffee-counter", kind: "info", label: "Coffee Counter", actionLabel: "Check Daily Brief", action: { type: "open-panel", panel: "daily-brief" }, rect: [60, 60, 140, 70], standPoint: { x: 130, feetY: 160 }, range: 70 },
    { id: "lounge-staff", kind: "info", label: "Barista", actionLabel: "Talk", action: { type: "npc-chat", role: "lounge-staff", npcLabel: "Barista" }, rect: [60, 130, 100, 40], standPoint: { x: 150, feetY: 200 }, range: 70 },
  ],
};

function CoffeeCounter({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.9} />
      <RoundedBox args={[1.6, 0.95, 0.55]} radius={0.03} smoothness={1} position={[0, 0.475, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} metalness={0} />
      </RoundedBox>
      {/* Espresso-machine-like block on the counter. */}
      <RoundedBox args={[0.4, 0.35, 0.3]} radius={0.02} position={[-0.45, 1.15, -0.05]} castShadow>
        {/* Art Bible Part 5 rule 1 — metalness always 0. */}
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0} />
      </RoundedBox>
      <mesh position={[-0.45, 1.35, 0.1]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.08, 8]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} metalness={0} />
      </mesh>
      {/* Mug stack. */}
      <mesh position={[0.4, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.08, 10]} />
        <meshStandardMaterial color="#c1543f" roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[0.55, 1.0, 0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.08, 10]} />
        <meshStandardMaterial color="#8fc1a9" roughness={0.7} metalness={0} />
      </mesh>
    </group>
  );
}

function LoungeTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.65} />
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 8]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </mesh>
      <RoundedBox args={[0.7, 0.03, 0.7]} radius={0.02} smoothness={2} position={[0, 0.44, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.9} metalness={0} />
      </RoundedBox>
    </group>
  );
}

const BARISTA_APPEARANCE: CharacterAppearance = {
  bodyId: "body-b",
  skinToneId: "skin-02",
  hairId: "hair-medium-wavy",
  hairColorId: "haircolor-ginger",
  eyesId: "eyes-green",
  eyebrowsId: "brow-soft-arch",
  facialHairId: null,
  topId: "top-crew-tee-0",
  jacketId: null,
  bottomId: "bottom-jeans-straight-0",
  shoesId: "shoes-sneakers-0",
  accessoryIds: [],
};

const BARISTA_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-sociable", secondaryTraitIds: ["trait-humorous"] };

const BARISTA_SCHEDULE: NpcSchedule = {
  id: "lounge-staff",
  waypoints: [
    { standPoint: { x: 150, feetY: 180 }, activity: "coffee", durationSeconds: 20, facingLeft: false },
    { standPoint: { x: 150, feetY: 180 }, activity: "talk", durationSeconds: 16, facingLeft: false },
  ],
};

const VISITOR_APPEARANCE: CharacterAppearance = {
  bodyId: "body-d",
  skinToneId: "skin-07",
  hairId: "hair-curly",
  hairColorId: "haircolor-black",
  eyesId: "eyes-brown",
  eyebrowsId: "brow-thick",
  facialHairId: null,
  topId: "top-long-sleeve-crew-0",
  jacketId: null,
  bottomId: "bottom-joggers-0",
  shoesId: "shoes-sneakers-1",
  accessoryIds: ["acc-beanie-tan"],
};

const VISITOR_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-calm", secondaryTraitIds: [] };

const VISITOR_SCHEDULE: NpcSchedule = {
  id: "lounge-visitor",
  waypoints: [
    { standPoint: { x: 340, feetY: 250 }, activity: "sit", durationSeconds: 24, facingLeft: true },
    { standPoint: { x: 340, feetY: 250 }, activity: "talk", durationSeconds: 14, facingLeft: true },
  ],
};

const VISITOR_B_APPEARANCE: CharacterAppearance = {
  bodyId: "body-a",
  skinToneId: "skin-03",
  hairId: "hair-short-textured",
  hairColorId: "haircolor-black",
  eyesId: "eyes-hazel",
  eyebrowsId: "brow-thin",
  facialHairId: null,
  topId: "top-crew-tee-0",
  jacketId: null,
  bottomId: "bottom-jeans-straight-0",
  shoesId: "shoes-sneakers-2",
  accessoryIds: [],
};

const VISITOR_B_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-humorous", secondaryTraitIds: ["trait-sociable"] };

// Phase 21 Part 4 "social campus" — seated at the lounge table's OTHER
// chair (`LoungeTable`'s two `ReadingChair`s, table ± 0.55m in x), so
// this visitor and `lounge-visitor` above read as two students sitting
// together over coffee rather than one lone visitor.
const VISITOR_B_SCHEDULE: NpcSchedule = {
  id: "lounge-visitor-b",
  waypoints: [
    { standPoint: { x: 285, feetY: 250 }, activity: "coffee", durationSeconds: 18, facingLeft: false },
    { standPoint: { x: 285, feetY: 250 }, activity: "talk", durationSeconds: 20, facingLeft: false },
  ],
};

export const STUDENT_LOUNGE_NPCS: BuildingNpcDefinition[] = [
  { id: "lounge-staff", label: "Barista", appearance: BARISTA_APPEARANCE, personality: BARISTA_PERSONALITY, schedule: BARISTA_SCHEDULE, scheduleTimeOffsetSeconds: 0 },
  // A casual visitor (Part 8 "visitors") — only present by day, matching Part 7's "NPC density."
  { id: "lounge-visitor", label: "Student", appearance: VISITOR_APPEARANCE, personality: VISITOR_PERSONALITY, schedule: VISITOR_SCHEDULE, scheduleTimeOffsetSeconds: 5, activeTimes: ["morning", "afternoon", "evening"] },
  { id: "lounge-visitor-b", label: "Student", appearance: VISITOR_B_APPEARANCE, personality: VISITOR_B_PERSONALITY, schedule: VISITOR_B_SCHEDULE, scheduleTimeOffsetSeconds: 2, activeTimes: ["morning", "afternoon", "evening"] },
];

export const STUDENT_LOUNGE_PALETTE: BuildingPalette = {
  wallColor: "#d98a68",
  floorColor: "#b9a888",
  trimColor: "#4f7a8c",
  lighting: ROOM_THEMES["creative-studio"].lighting,
};

export function StudentLoungeDressing() {
  const counter = floorPointToVector3({ x: 130, feetY: 95 });
  const table = floorPointToVector3({ x: 340, feetY: 250 });

  return (
    <>
      <CoffeeCounter x={counter[0]} z={counter[2]} />
      <LoungeTable x={table[0]} z={table[2]} />
      <ReadingChair x={table[0] - 0.55} z={table[2]} color="#c9694f" />
      <ReadingChair x={table[0] + 0.55} z={table[2]} color="#8fc1a9" />
      <PotPlant x={table[0]} y={0} z={table[2] + 0.9} scale={1.1} />
    </>
  );
}

export function StudentLoungeScene({
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
      world={STUDENT_LOUNGE_WORLD}
      palette={STUDENT_LOUNGE_PALETTE}
      npcs={STUDENT_LOUNGE_NPCS}
      dressing={<StudentLoungeDressing />}
      ambienceSounds={["coffee-machine", "distant-chatter"]}
      timeOfDay={timeOfDay}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default StudentLoungeScene;
