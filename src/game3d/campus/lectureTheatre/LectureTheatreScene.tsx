/**
 * Lecture Theatre building (Phase 20E, Part 1/2) — "rows, projector,
 * stage." Reuses the generic `CampusBuildingScene` shell and
 * `ReadingChair` (tinted, arranged in rows) for seating; the stage,
 * lectern, and projector screen are new geometry since nothing existing
 * matches a raised platform or a large flat screen. Lighting borrows the
 * `classic-academy` Room Theme's rig (Phase 20D) — a traditional, warm-wood
 * evening mood fits a lecture hall well.
 */

import { RoundedBox } from "@react-three/drei";
import { CampusBuildingScene, type BuildingNpcDefinition, type BuildingPalette } from "../../scenes/CampusBuildingScene";
import { ContactShadow, ReadingChair, WOOD_DARK } from "../../rooms/furniturePieces";
import { floorPointToVector3 } from "../../types/coordinates";
import { ROOM_THEMES } from "../../rooms/roomThemes";
import type { NpcSchedule } from "../../characters/npcSchedule";
import type { CharacterAppearance, PlayerPersonality } from "../../../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";
import type { TimeOfDay } from "../timeOfDay";

export const LECTURE_THEATRE_WORLD: SceneWorld = {
  sceneId: "campus-lecture-theatre",
  width: 700,
  height: 520,
  walkable: { xMin: 40, xMax: 660, feetBack: 40, feetFront: 480 },
  heightFront: 140,
  heightBack: 90,
  spawn: { x: 350, feetY: 440 },
  obstacles: [
    // Two seating blocks either side of a clear centre aisle (x 300-400) —
    // the player walks straight down the middle to reach the stage,
    // matching a real lecture theatre's layout.
    { xMin: 120, xMax: 280, feetMin: 120, feetMax: 400 },
    { xMin: 420, xMax: 580, feetMin: 120, feetMax: 400 },
    { xMin: 260, xMax: 440, feetMin: 60, feetMax: 110 },
  ],
  interactables: [
    { id: "theatre-exit", kind: "door", label: "Campus HQ", actionLabel: "Return to Campus HQ", action: { type: "travel", sceneId: "campus-hq" }, rect: [300, 480, 100, 30], standPoint: { x: 350, feetY: 460 }, range: 60 },
    { id: "lectern", kind: "board", label: "Lectern", actionLabel: "Check Semester Calendar", action: { type: "open-panel", panel: "calendar" }, rect: [300, 80, 100, 60], standPoint: { x: 350, feetY: 200 }, range: 90 },
    { id: "lecturer", kind: "mentor", label: "Lecturer", actionLabel: "Talk", action: { type: "npc-chat", role: "lecturer", npcLabel: "Lecturer" }, rect: [300, 40, 100, 60], standPoint: { x: 350, feetY: 180 }, range: 90 },
  ],
};

/** The row-seating obstacle above is a single large rect (not per-row) — the rows themselves are dressing-only, walked around via the aisle down the middle, matching a real theatre's centre aisle. */

function StagePlatform({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[3.2, 0.18, 1.4]} radius={0.02} smoothness={1} position={[0, 0.09, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </RoundedBox>
    </group>
  );
}

function Lectern({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.18, z]}>
      <ContactShadow x={0} z={0} radius={0.4} />
      <RoundedBox args={[0.5, 0.9, 0.4]} radius={0.03} smoothness={1} position={[0, 0.45, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} metalness={0} />
      </RoundedBox>
    </group>
  );
}

function ProjectorScreen({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <planeGeometry args={[2.6, 1.6]} />
        <meshStandardMaterial color="#e8e4da" roughness={0.7} metalness={0} emissive="#dfe6ea" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function SeatRow({ x, z, count = 2 }: { x: number; z: number; count?: number }) {
  const seats = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * 0.5);
  return (
    <>
      {seats.map((offset) => (
        <ReadingChair key={offset} x={x + offset} z={z} color="#4f7a8c" />
      ))}
    </>
  );
}

const LECTURER_APPEARANCE: CharacterAppearance = {
  bodyId: "body-c",
  skinToneId: "skin-03",
  hairId: "hair-swept-back",
  hairColorId: "haircolor-darkbrown",
  eyesId: "eyes-hazel",
  eyebrowsId: "brow-angled",
  facialHairId: "facial-light-beard",
  topId: "top-button-shirt-1",
  jacketId: "jacket-cardigan-1",
  bottomId: "bottom-pleated-trousers-1",
  shoesId: "shoes-loafers-1",
  accessoryIds: [],
};

const LECTURER_PERSONALITY: PlayerPersonality = { primaryTraitId: "trait-thoughtful", secondaryTraitIds: ["trait-calm"] };

const LECTURER_SCHEDULE: NpcSchedule = {
  id: "lecturer",
  waypoints: [
    { standPoint: { x: 350, feetY: 160 }, activity: "talk", durationSeconds: 24, facingLeft: false },
    { standPoint: { x: 350, feetY: 160 }, activity: "write", durationSeconds: 12, facingLeft: false },
  ],
};

export const LECTURE_THEATRE_NPCS: BuildingNpcDefinition[] = [
  { id: "lecturer", label: "Lecturer", appearance: LECTURER_APPEARANCE, personality: LECTURER_PERSONALITY, schedule: LECTURER_SCHEDULE, scheduleTimeOffsetSeconds: 0 },
];

// Phase 20F Part 11 — floorColor previously drifted from the Classic
// Academy theme it borrows lighting from (#4f382a vs the theme's own
// #8a6a42) — every other building copies its borrowed theme's wall/floor/
// trim colours verbatim (Library, Computer Lab, Administration, Student
// Lounge all match exactly), so this read as an unintentional divergence
// rather than a deliberate "darker theatre" choice, and risked crushing
// toward black once the night-time intensity multiplier (0.6x) applied on
// top of an already-dark floor. Corrected to match the theme exactly.
export const LECTURE_THEATRE_PALETTE: BuildingPalette = {
  wallColor: "#6b4a2f",
  floorColor: "#8a6a42",
  trimColor: "#8a5a34",
  lighting: ROOM_THEMES["classic-academy"].lighting,
};

export function LectureTheatreDressing() {
  const stage = floorPointToVector3({ x: 350, feetY: 85 });
  const lectern = floorPointToVector3({ x: 300, feetY: 100 });
  const screen = floorPointToVector3({ x: 350, feetY: 45 });
  const leftRows = [160, 240, 320].map((feetY) => floorPointToVector3({ x: 200, feetY }));
  const rightRows = [160, 240, 320].map((feetY) => floorPointToVector3({ x: 500, feetY }));

  return (
    <>
      <ProjectorScreen x={screen[0]} y={1.6} z={screen[2]} />
      <StagePlatform x={stage[0]} z={stage[2]} />
      <Lectern x={lectern[0]} z={lectern[2]} />
      {leftRows.map((row, i) => (
        <SeatRow key={`l${i}`} x={row[0]} z={row[2]} />
      ))}
      {rightRows.map((row, i) => (
        <SeatRow key={`r${i}`} x={row[0]} z={row[2]} />
      ))}
    </>
  );
}

export function LectureTheatreScene({
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
      world={LECTURE_THEATRE_WORLD}
      palette={LECTURE_THEATRE_PALETTE}
      npcs={LECTURE_THEATRE_NPCS}
      dressing={<LectureTheatreDressing />}
      ambienceSounds={["projector-hum"]}
      timeOfDay={timeOfDay}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default LectureTheatreScene;
