/**
 * V2 Phase 1 "Prestige Vertical Slice" — the Great Hall, the vertical
 * slice's deliberate centrepiece (docs/UNIGAME_V2_MASTER_DESIGN.md §4.2):
 * a cathedral-scale nave with a ribbed vault, two full-length refectory
 * tables, twin fireplaces, stained glass down both walls, and the 4
 * subject-guild banners tying it to the wider campus. Three exits — one
 * real (back to the Grand Courtyard) and two "Coming Soon" gates —
 * satisfying the brief's "multiple exits" without inventing districts
 * this phase doesn't build.
 */

import { useState } from "react";
import { PrestigeSceneShell } from "../PrestigeSceneShell";
import {
  StoneColumn,
  VaultedCeilingBay,
  StainedGlassWindow,
  Fireplace,
  Banner,
  LongTable,
  ComingSoonGate,
  StatueFigure,
  STONE,
  STONE_LIGHT,
} from "../architecture/ArchitectureKit";
import { buildGreatHallNpcs } from "../prestigeNpcs";
import { MentorCheckInPrompt } from "../../../components/mentor/MentorCheckInPrompt";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";

const HALL_WIDTH_M = 20;
const HALL_LENGTH_M = 42;

export function buildGreatHallWorld(): SceneWorld {
  return {
    sceneId: "prestige-great-hall",
    width: HALL_WIDTH_M * 100,
    height: HALL_LENGTH_M * 100,
    walkable: { xMin: 150, xMax: HALL_WIDTH_M * 100 - 150, feetBack: 150, feetFront: HALL_LENGTH_M * 100 - 150 },
    heightFront: 140,
    heightBack: 100,
    spawn: { x: 1000, feetY: HALL_LENGTH_M * 100 - 200 },
    obstacles: [
      { xMin: 540, xMax: 860, feetMin: 800, feetMax: 3400 },
      { xMin: 1140, xMax: 1460, feetMin: 800, feetMax: 3400 },
    ],
    interactables: [
      { id: "hall-exit-south", kind: "door", label: "The Grand Courtyard", actionLabel: "Return to the Courtyard", action: { type: "travel", sceneId: "prestige-grand-courtyard" }, rect: [880, HALL_LENGTH_M * 100 - 180, 240, 150], standPoint: { x: 1000, feetY: HALL_LENGTH_M * 100 - 380 }, range: 110 },
      { id: "hall-exit-north", kind: "door", label: "The Cloisters", actionLabel: "Approach the Gate", action: { type: "locked-notice", districtName: "The Cloisters" }, rect: [880, 30, 240, 150], standPoint: { x: 1000, feetY: 330 }, range: 100 },
      { id: "hall-exit-west", kind: "door", label: "The Undercroft", actionLabel: "Approach the Gate", action: { type: "locked-notice", districtName: "The Refectory Undercroft" }, rect: [30, 1900, 150, 240], standPoint: { x: 330, feetY: 2100 }, range: 100 },
    ],
  };
}

function GreatHallDressing({ onLocked }: { onLocked: (districtName: string) => void }) {
  const bayCount = 6;
  const bayStartZ = 6;
  const bayGapZ = 6;

  return (
    <>
      {/* Nave arcade + vaulted ceiling, repeated the length of the hall. */}
      {Array.from({ length: bayCount }).map((_, i) => {
        const z = bayStartZ + i * bayGapZ;
        return (
          <group key={i}>
            <StoneColumn x={5.5} z={z} heightM={7.5} radius={0.4} />
            <StoneColumn x={14.5} z={z} heightM={7.5} radius={0.4} />
            <VaultedCeilingBay x={HALL_WIDTH_M / 2} z={z} widthM={HALL_WIDTH_M} apexHeightM={12.5} spanM={bayGapZ} />
          </group>
        );
      })}

      {/* Stained glass down both long walls, between the arcade bays. */}
      {Array.from({ length: bayCount }).map((_, i) => {
        const z = bayStartZ + i * bayGapZ + bayGapZ / 2;
        return (
          <group key={i}>
            <StainedGlassWindow x={0.1} y={4.2} z={z} widthM={2.6} heightM={3.6} rotationY={Math.PI / 2} colors={["#3a5fae", "#8a2f4a", "#c9973a"]} />
            <StainedGlassWindow x={HALL_WIDTH_M - 0.1} y={4.2} z={z} widthM={2.6} heightM={3.6} rotationY={-Math.PI / 2} colors={["#3a7a5f", "#c9973a", "#8a2f4a"]} />
          </group>
        );
      })}

      {/* Twin fireplaces, mid-hall. */}
      <Fireplace x={0.6} z={HALL_LENGTH_M / 2} rotationY={Math.PI / 2} />
      <Fireplace x={HALL_WIDTH_M - 0.6} z={HALL_LENGTH_M / 2} rotationY={-Math.PI / 2} />

      {/* Two full-length refectory tables. */}
      <LongTable x={7} z={21} lengthM={26} rotationY={Math.PI / 2} />
      <LongTable x={13} z={21} lengthM={26} rotationY={Math.PI / 2} />

      {/* The four subject-guild banners — a small worldbuilding touch tying every district back to the campus as a whole. */}
      <Banner x={5.5} y={7} z={5} color="#b24bf3" />
      <Banner x={14.5} y={7} z={5} color="#3da9fc" />
      <Banner x={5.5} y={7} z={37} color="#ffb238" />
      <Banner x={14.5} y={7} z={37} color="#2ed17e" />

      <StatueFigure x={2.2} z={1.8} heightM={2.8} color={STONE_LIGHT} />
      <StatueFigure x={HALL_WIDTH_M - 2.2} z={1.8} heightM={2.8} color={STONE_LIGHT} />

      <ComingSoonGate x={10} z={3.3} rotationY={0} onClick={() => onLocked("The Cloisters")} />
      <ComingSoonGate x={3.3} z={21} rotationY={Math.PI / 2} onClick={() => onLocked("The Refectory Undercroft")} />
    </>
  );
}

const LIGHTING = {
  ambientColor: "#8a7a5a",
  ambientIntensity: 0.32,
  hemisphereSky: "#5a6a8a",
  hemisphereGround: "#3a2f22",
  hemisphereIntensity: 0.3,
  sunColor: "#c9973a",
  sunIntensity: 0.7,
  sunPosition: [10, 14, 21] as [number, number, number],
};

export function GreatHallScene({
  reduceMotion,
  onAction,
  onInRangeChange,
  talkingNpcId = null,
}: {
  reduceMotion: boolean;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
  talkingNpcId?: string | null;
}) {
  const [lockedDistrict, setLockedDistrict] = useState<string | null>(null);

  const handleAction = (action: InteractAction) => {
    if (action.type === "locked-notice") {
      setLockedDistrict(action.districtName);
      return;
    }
    onAction(action);
  };

  return (
    <>
      <PrestigeSceneShell
        world={buildGreatHallWorld()}
        lighting={LIGHTING}
        floorColor={STONE}
        npcs={buildGreatHallNpcs()}
        dressing={<GreatHallDressing onLocked={setLockedDistrict} />}
        ambienceSounds={["great-hall-ambience", "distant-chatter", "fireplace-crackle"]}
        reduceMotion={reduceMotion}
        onAction={handleAction}
        onInRangeChange={onInRangeChange}
        talkingNpcId={talkingNpcId}
      />
      {lockedDistrict ? (
        <MentorCheckInPrompt
          npcLabel="Notice Board"
          question={`${lockedDistrict} — Coming Soon. This district hasn't been built yet; check back in a future update.`}
          options={[{ id: "ok", label: "Understood" }]}
          onSelect={() => setLockedDistrict(null)}
          onDismiss={() => setLockedDistrict(null)}
        />
      ) : null}
    </>
  );
}

export default GreatHallScene;
