/**
 * Computer Lab building (Phase 20E, Part 1/2) — "technology, programming,
 * multiple monitors." Reuses the generic `CampusBuildingScene` shell;
 * only the multi-monitor workstation is new geometry (nothing existing
 * matches "a desk with several glowing screens"). Lighting borrows the
 * existing `digital-lab` Room Theme's rig (Phase 20D) — "computer glow
 * dominant, dimmer ambient" is exactly this building's mood already.
 */

import { RoundedBox } from "@react-three/drei";
import { CampusBuildingScene, type BuildingNpcDefinition, type BuildingPalette } from "../../scenes/CampusBuildingScene";
import { ContactShadow, ReadingChair, StorageLockers, METAL } from "../../rooms/furniturePieces";
import { floorPointToVector3 } from "../../types/coordinates";
import { ROOM_THEMES } from "../../rooms/roomThemes";
import type { NpcSchedule } from "../../characters/npcSchedule";
import type { CharacterAppearance, PlayerPersonality } from "../../../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";
import type { TimeOfDay } from "../timeOfDay";

export const COMPUTER_LAB_WORLD: SceneWorld = {
  sceneId: "campus-computer-lab",
  width: 680,
  height: 460,
  walkable: { xMin: 40, xMax: 640, feetBack: 40, feetFront: 420 },
  heightFront: 140,
  heightBack: 90,
  spawn: { x: 340, feetY: 360 },
  obstacles: [
    { xMin: 80, xMax: 260, feetMin: 100, feetMax: 180 },
    { xMin: 380, xMax: 560, feetMin: 100, feetMax: 180 },
    { xMin: 80, xMax: 260, feetMin: 220, feetMax: 300 },
    { xMin: 380, xMax: 560, feetMin: 220, feetMax: 300 },
    { xMin: 560, xMax: 640, feetMin: 340, feetMax: 400 },
  ],
  interactables: [
    { id: "lab-exit", kind: "door", label: "Campus HQ", actionLabel: "Return to Campus HQ", action: { type: "travel", sceneId: "campus-hq" }, rect: [290, 420, 100, 30], standPoint: { x: 340, feetY: 400 }, range: 60 },
    { id: "workstation", kind: "desk", label: "Workstation", actionLabel: "Check Assessments & Calendar", action: { type: "open-panel", panel: "calendar" }, rect: [80, 100, 180, 80], standPoint: { x: 170, feetY: 200 }, range: 70 },
    { id: "lab-technician", kind: "info", label: "Lab Technician", actionLabel: "Talk", action: { type: "npc-chat", role: "lab-technician", npcLabel: "Lab Technician" }, rect: [560, 340, 80, 60], standPoint: { x: 560, feetY: 300 }, range: 70 },
  ],
};

function MonitorDesk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.9} />
      {/* Phase 20F Part 11 lighting/material pass — metalness forced to 0 throughout (Art Bible Part 5 rule 1); the screen bezel/surface now use the Bible's own named "Plastic (screens, small props)" material (#3a3630 bezel, #bcd9e8 cool emissive) instead of a near-black bezel + saturated subject-accent blue, which was a mismatch against the material library, not an intentional choice. */}
      <RoundedBox args={[1.6, 0.06, 0.7]} radius={0.02} smoothness={1} position={[0, 0.72, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0} />
      </RoundedBox>
      {[-0.7, 0.7].map((legX) => (
        <mesh key={legX} position={[legX, 0.36, 0]} castShadow>
          <boxGeometry args={[0.06, 0.72, 0.6]} />
          <meshStandardMaterial color="#232323" roughness={0.6} metalness={0} />
        </mesh>
      ))}
      {[-0.45, 0, 0.45].map((screenX) => (
        <group key={screenX} position={[screenX, 0.75, -0.2]}>
          <mesh castShadow>
            <boxGeometry args={[0.36, 0.24, 0.02]} />
            <meshStandardMaterial color="#3a3630" roughness={0.4} metalness={0} />
          </mesh>
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.32, 0.2]} />
            <meshStandardMaterial color="#bcd9e8" emissive="#bcd9e8" emissiveIntensity={0.5} roughness={0.3} metalness={0} />
          </mesh>
        </group>
      ))}
      <ReadingChair x={0} z={0.55} color="#4f7a8c" />
    </group>
  );
}

const LAB_TECH_APPEARANCE: CharacterAppearance = {
  bodyId: "body-a",
  skinToneId: "skin-05",
  hairId: "hair-short-textured",
  hairColorId: "haircolor-black",
  eyesId: "eyes-dark-brown",
  eyebrowsId: "brow-thin",
  facialHairId: null,
  topId: "top-hoodie-1",
  jacketId: null,
  bottomId: "bottom-joggers-0",
  shoesId: "shoes-sneakers-2",
  accessoryIds: ["acc-glasses-round"],
};

const LAB_TECH_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-thoughtful", secondaryTraitIds: [] };

const LAB_TECH_SCHEDULE: NpcSchedule = {
  id: "lab-technician",
  waypoints: [
    { standPoint: { x: 560, feetY: 320 }, activity: "type", durationSeconds: 26, facingLeft: true },
    { standPoint: { x: 560, feetY: 320 }, activity: "think", durationSeconds: 12, facingLeft: true },
  ],
};

export const COMPUTER_LAB_NPCS: BuildingNpcDefinition[] = [
  { id: "lab-technician", label: "Lab Technician", appearance: LAB_TECH_APPEARANCE, personality: LAB_TECH_PERSONALITY, schedule: LAB_TECH_SCHEDULE, scheduleTimeOffsetSeconds: 0 },
];

export const COMPUTER_LAB_PALETTE: BuildingPalette = {
  wallColor: "#d9d3c8",
  floorColor: "#787672",
  trimColor: "#9a9490",
  lighting: ROOM_THEMES["digital-lab"].lighting,
};

export function ComputerLabDressing() {
  const desk1 = floorPointToVector3({ x: 170, feetY: 140 });
  const desk2 = floorPointToVector3({ x: 470, feetY: 140 });
  const desk3 = floorPointToVector3({ x: 170, feetY: 260 });
  const desk4 = floorPointToVector3({ x: 470, feetY: 260 });
  const rack = floorPointToVector3({ x: 600, feetY: 370 });

  return (
    <>
      <MonitorDesk x={desk1[0]} z={desk1[2]} />
      <MonitorDesk x={desk2[0]} z={desk2[2]} />
      <MonitorDesk x={desk3[0]} z={desk3[2]} />
      <MonitorDesk x={desk4[0]} z={desk4[2]} />
      <StorageLockers x={rack[0]} z={rack[2]} color={METAL} />
    </>
  );
}

export function ComputerLabScene({
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
      world={COMPUTER_LAB_WORLD}
      palette={COMPUTER_LAB_PALETTE}
      npcs={COMPUTER_LAB_NPCS}
      dressing={<ComputerLabDressing />}
      ambienceSounds={["typing", "hvac-hum"]}
      timeOfDay={timeOfDay}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default ComputerLabScene;
