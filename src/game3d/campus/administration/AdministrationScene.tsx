/**
 * Administration building (Phase 20E, Part 1/2) — "student services,
 * semester management, university settings." Reuses the generic
 * `CampusBuildingScene` shell and shared pieces (`StorageLockers`,
 * `Noticeboard`, `ReadingChair`); only the service counter is new
 * geometry. The Service Counter routes to the existing Menu panel — which
 * already contains Semester Setup, Settings, and Save/Import — the exact
 * "semester management... university settings" content this building's
 * purpose describes, reused rather than duplicated into a second screen.
 */

import { RoundedBox } from "@react-three/drei";
import { CampusBuildingScene, type BuildingNpcDefinition, type BuildingPalette } from "../../scenes/CampusBuildingScene";
import { ContactShadow, Noticeboard, ReadingChair, StorageLockers, WOOD_DARK } from "../../rooms/furniturePieces";
import { floorPointToVector3 } from "../../types/coordinates";
import { ROOM_THEMES } from "../../rooms/roomThemes";
import type { NpcSchedule } from "../../characters/npcSchedule";
import type { CharacterAppearance, PlayerPersonality } from "../../../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";
import type { TimeOfDay } from "../timeOfDay";

export const ADMINISTRATION_WORLD: SceneWorld = {
  sceneId: "campus-administration",
  width: 620,
  height: 440,
  walkable: { xMin: 40, xMax: 580, feetBack: 40, feetFront: 400 },
  heightFront: 140,
  heightBack: 90,
  spawn: { x: 310, feetY: 340 },
  obstacles: [
    { xMin: 220, xMax: 400, feetMin: 60, feetMax: 130 },
    { xMin: 60, xMax: 160, feetMin: 200, feetMax: 260 },
  ],
  interactables: [
    { id: "admin-exit", kind: "door", label: "Campus HQ", actionLabel: "Return to Campus HQ", action: { type: "travel", sceneId: "campus-hq" }, rect: [260, 400, 100, 30], standPoint: { x: 310, feetY: 380 }, range: 60 },
    { id: "service-counter", kind: "board", label: "Service Counter", actionLabel: "Semester Setup & Settings", action: { type: "open-panel", panel: "menu" }, rect: [220, 60, 180, 70], standPoint: { x: 310, feetY: 170 }, range: 70 },
    { id: "admin-staff", kind: "info", label: "Admin Staff", actionLabel: "Talk", action: { type: "npc-chat", role: "admin-staff", npcLabel: "Admin Staff" }, rect: [220, 130, 100, 40], standPoint: { x: 270, feetY: 210 }, range: 70 },
    { id: "admin-noticeboard", kind: "notice", label: "Noticeboard", actionLabel: "Check Deadlines", action: { type: "open-panel", panel: "tasks" }, rect: [560, 150, 20, 80], standPoint: { x: 530, feetY: 190 }, range: 70 },
  ],
};

function ServiceCounter({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={1.1} />
      <RoundedBox args={[2.2, 1.0, 0.5]} radius={0.03} smoothness={1} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.02, 0.22]} radius={0.01} position={[-0.7, 1.02, 0]} castShadow>
        <meshStandardMaterial color="#e8e2d6" roughness={0.6} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.02, 0.22]} radius={0.01} position={[0.7, 1.02, 0]} castShadow>
        <meshStandardMaterial color="#e8e2d6" roughness={0.6} metalness={0} />
      </RoundedBox>
    </group>
  );
}

const ADMIN_STAFF_APPEARANCE: CharacterAppearance = {
  bodyId: "body-a",
  skinToneId: "skin-01",
  hairId: "hair-medium-straight",
  hairColorId: "haircolor-chestnut",
  eyesId: "eyes-grey",
  eyebrowsId: "brow-straight",
  facialHairId: null,
  topId: "top-button-shirt-1",
  jacketId: null,
  bottomId: "bottom-pleated-trousers-1",
  shoesId: "shoes-loafers-1",
  accessoryIds: [],
};

const ADMIN_STAFF_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-calm", secondaryTraitIds: [] };

const ADMIN_STAFF_SCHEDULE: NpcSchedule = {
  id: "admin-staff",
  waypoints: [
    { standPoint: { x: 270, feetY: 190 }, activity: "type", durationSeconds: 22, facingLeft: false },
    { standPoint: { x: 270, feetY: 190 }, activity: "talk", durationSeconds: 14, facingLeft: false },
  ],
};

export const ADMINISTRATION_NPCS: BuildingNpcDefinition[] = [
  { id: "admin-staff", label: "Admin Staff", appearance: ADMIN_STAFF_APPEARANCE, personality: ADMIN_STAFF_PERSONALITY, schedule: ADMIN_STAFF_SCHEDULE, scheduleTimeOffsetSeconds: 0 },
];

export const ADMINISTRATION_PALETTE: BuildingPalette = {
  wallColor: "#f7f2e8",
  floorColor: "#e8dcc8",
  trimColor: "#a97c50",
  lighting: ROOM_THEMES["minimal-study"].lighting,
};

export function AdministrationDressing() {
  const counter = floorPointToVector3({ x: 310, feetY: 95 });
  const lockers = floorPointToVector3({ x: 110, feetY: 230 });
  const board = floorPointToVector3({ x: 598, feetY: 190 });
  const waitingChair = floorPointToVector3({ x: 420, feetY: 320 });

  return (
    <>
      <ServiceCounter x={counter[0]} z={counter[2]} />
      <StorageLockers x={lockers[0]} z={lockers[2]} color="#9a9490" />
      <Noticeboard x={board[0]} y={1.3} z={board[2]} />
      <ReadingChair x={waitingChair[0]} z={waitingChair[2]} color="#a97c50" />
    </>
  );
}

export function AdministrationScene({
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
      world={ADMINISTRATION_WORLD}
      palette={ADMINISTRATION_PALETTE}
      npcs={ADMINISTRATION_NPCS}
      dressing={<AdministrationDressing />}
      ambienceSounds={["typing"]}
      timeOfDay={timeOfDay}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default AdministrationScene;
