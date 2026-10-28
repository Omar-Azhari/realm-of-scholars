/**
 * V2 Phase 1 "Prestige Vertical Slice" — the Dormitory PREVIEW room
 * (docs/UNIGAME_V2_MASTER_DESIGN.md §12: "do not build the full
 * dormitory... one preview room showing the intended customisation
 * quality"). Deliberately small, static, and non-interactive beyond
 * looking around + one inspect note explaining what it is — the future
 * benchmark for room customisation quality, not a working system yet (no
 * save-backed placement/theme wiring here; that's real future scope, not
 * faked).
 */

import { RoundedBox } from "@react-three/drei";
import { PrestigeSceneShell } from "../PrestigeSceneShell";
import { Fireplace, Banner, CandleCluster, StainedGlassWindow, OAK, OAK_DARK, PARCHMENT } from "../architecture/ArchitectureKit";
import { Bookshelf, PotPlant, Rug, RUG_TAN, RUG_BORDER } from "../../rooms/furniturePieces";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";

const ROOM_WIDTH_M = 10;
const ROOM_DEPTH_M = 8;

export function buildDormPreviewWorld(): SceneWorld {
  return {
    sceneId: "prestige-dorm-preview",
    width: ROOM_WIDTH_M * 100,
    height: ROOM_DEPTH_M * 100,
    walkable: { xMin: 100, xMax: ROOM_WIDTH_M * 100 - 100, feetBack: 100, feetFront: ROOM_DEPTH_M * 100 - 100 },
    heightFront: 140,
    heightBack: 100,
    spawn: { x: 500, feetY: ROOM_DEPTH_M * 100 - 180 },
    obstacles: [{ xMin: 620, xMax: 940, feetMin: 120, feetMax: 380 }],
    interactables: [
      { id: "dorm-exit", kind: "door", label: "The Grand Courtyard", actionLabel: "Return to the Courtyard", action: { type: "travel", sceneId: "prestige-grand-courtyard" }, rect: [400, ROOM_DEPTH_M * 100 - 180, 200, 130], standPoint: { x: 500, feetY: ROOM_DEPTH_M * 100 - 330 }, range: 100 },
      {
        id: "dorm-info",
        kind: "info",
        label: "A Preview",
        actionLabel: "Look Closer",
        action: {
          type: "inspect",
          title: "A Glimpse of Things to Come",
          body: "This is a preview of your future dormitory — a private sanctuary you'll furnish and grow over the semester. Only one room is shown for now; full customisation is a future update.",
        },
        rect: [400, 420, 200, 130],
        standPoint: { x: 500, feetY: 620 },
        range: 90,
      },
    ],
  };
}

function DormBed({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[1.9, 0.42, 2.5]} radius={0.03} position={[0, 0.21, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK_DARK} roughness={0.85} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[1.8, 0.24, 2.4]} radius={0.05} position={[0, 0.55, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e8ddc1" roughness={0.95} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[1.8, 0.18, 0.6]} radius={0.05} position={[0, 0.63, -0.9]} castShadow receiveShadow>
        <meshStandardMaterial color="#7a1f2b" roughness={0.9} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[1.9, 1.1, 0.14]} radius={0.04} position={[0, 1.0, -1.25]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.4, 0.28, 0.3]} radius={0.04} position={[0.6, 0.72, -0.6]} castShadow>
        <meshStandardMaterial color="#f2e9d8" roughness={0.9} metalness={0} />
      </RoundedBox>
    </group>
  );
}

function DormDesk({ x, z, rotationY = 0 }: { x: number; z: number; rotationY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[1.3, 0.07, 0.6]} radius={0.02} position={[0, 0.78, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
      </RoundedBox>
      {[
        [-0.55, -0.22],
        [0.55, -0.22],
        [-0.55, 0.22],
        [0.55, 0.22],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.39, lz]} castShadow>
          <boxGeometry args={[0.06, 0.78, 0.06]} />
          <meshStandardMaterial color={OAK_DARK} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      <mesh position={[-0.2, 0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, 0.3]} />
        <meshStandardMaterial color={PARCHMENT} roughness={0.95} metalness={0} />
      </mesh>
      <CandleCluster x={0.4} y={0.82} z={0} count={2} />
    </group>
  );
}

function DormPreviewDressing() {
  return (
    <>
      <Rug x={ROOM_WIDTH_M / 2} z={ROOM_DEPTH_M / 2 + 0.4} width={4.2} depth={3.2} fill={RUG_TAN} border={RUG_BORDER} />

      <Fireplace x={ROOM_WIDTH_M / 2} z={0.6} rotationY={0} scale={0.85} />
      <StainedGlassWindow x={0.1} y={2.6} z={ROOM_DEPTH_M / 2} widthM={1.6} heightM={2.2} rotationY={Math.PI / 2} colors={["#e8ddc1", "#c9974a", "#8fc1a9"]} />

      <Banner x={ROOM_WIDTH_M - 1.2} y={4.4} z={1} color="#3d5a73" />

      <DormBed x={2.4} z={ROOM_DEPTH_M - 2.4} />
      <DormDesk x={ROOM_WIDTH_M - 2.2} z={ROOM_DEPTH_M - 5.2} rotationY={Math.PI} />
      <Bookshelf x={ROOM_WIDTH_M - 1.6} z={ROOM_DEPTH_M - 1.6} color={OAK} />

      <PotPlant x={1.2} z={1.2} scale={1.1} y={0} />
      <PotPlant x={ROOM_WIDTH_M - 1.1} z={ROOM_DEPTH_M - 0.9} y={0} />
    </>
  );
}

const LIGHTING = {
  ambientColor: "#e3caa0",
  ambientIntensity: 0.5,
  hemisphereSky: "#c9b98a",
  hemisphereGround: "#4a3a2a",
  hemisphereIntensity: 0.4,
  sunColor: "#ffcf8a",
  sunIntensity: 0.6,
  sunPosition: [5, 8, 4] as [number, number, number],
};

export function DormPreviewScene({
  reduceMotion,
  onAction,
  onInRangeChange,
}: {
  reduceMotion: boolean;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
}) {
  return (
    <PrestigeSceneShell
      world={buildDormPreviewWorld()}
      lighting={LIGHTING}
      floorColor="#5a4a38"
      npcs={[]}
      dressing={<DormPreviewDressing />}
      ambienceSounds={["fireplace-crackle"]}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
    />
  );
}

export default DormPreviewScene;
