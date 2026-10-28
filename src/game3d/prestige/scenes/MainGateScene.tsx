/**
 * V2 Phase 1 "Prestige Vertical Slice" — the Main Gate: a short, deliberate
 * arrival approach between two flanking gatehouse towers, ending at the
 * grand arch into the Grand Courtyard. Small by design (a threshold, not a
 * destination) — its whole job is the first "I am entering somewhere
 * prestigious" beat the Master Design's world philosophy (§2) asks for.
 */

import { PrestigeSceneShell } from "../PrestigeSceneShell";
import { StoneColumn, PointedArch, Banner, StatueFigure, TorchSconce, STONE, STONE_DARK } from "../architecture/ArchitectureKit";
import { buildMainGateNpcs } from "../prestigeNpcs";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";

export function buildMainGateWorld(): SceneWorld {
  return {
    sceneId: "prestige-main-gate",
    width: 2000,
    height: 1600,
    walkable: { xMin: 260, xMax: 1740, feetBack: 200, feetFront: 1450 },
    heightFront: 140,
    heightBack: 100,
    spawn: { x: 1000, feetY: 1350 },
    obstacles: [
      { xMin: 260, xMax: 760, feetMin: 150, feetMax: 1500 },
      { xMin: 1240, xMax: 1740, feetMin: 150, feetMax: 1500 },
    ],
    interactables: [
      {
        id: "gate-arch",
        kind: "door",
        label: "The Grand Courtyard",
        actionLabel: "Enter the Courtyard",
        action: { type: "travel", sceneId: "prestige-grand-courtyard" },
        rect: [880, 160, 240, 160],
        standPoint: { x: 1000, feetY: 380 },
        range: 110,
      },
    ],
  };
}

function GateTower({ x, z, side }: { x: number; z: number; side: "left" | "right" }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 10, 3.4]} />
        <meshStandardMaterial color={STONE} roughness={0.94} metalness={0} />
      </mesh>
      <mesh position={[0, 10.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.9, 0.6, 3.9]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.92} metalness={0} />
      </mesh>
      {/* Crenellations. */}
      {[-1.5, -0.5, 0.5, 1.5].map((cx) => (
        <mesh key={cx} position={[cx, 11, side === "left" ? 1.7 : -1.7]} castShadow>
          <boxGeometry args={[0.5, 0.8, 0.5]} />
          <meshStandardMaterial color={STONE_DARK} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      <StoneColumn x={side === "left" ? 1.9 : -1.9} z={0} heightM={9} radius={0.3} />
      <Banner x={side === "left" ? 1.9 : -1.9} y={7.8} z={0.05} color="#7a1f2b" rotationY={side === "left" ? 0 : Math.PI} />
      <TorchSconce x={side === "left" ? 1.85 : -1.85} y={3.4} z={1.75} rotationY={side === "left" ? 0.3 : Math.PI - 0.3} />
      <StatueFigure x={0} z={side === "left" ? 2.1 : -2.1} heightM={2.4} />
    </group>
  );
}

function MainGateDressing() {
  return (
    <>
      <GateTower x={5.1} z={5} side="left" />
      <GateTower x={14.9} z={5} side="right" />
      <PointedArch x={10} z={2.4} widthM={4.6} heightM={5.4} depthM={0.7} />
      <TorchSconce x={8.6} y={2.6} z={1.9} rotationY={0.5} />
      <TorchSconce x={11.4} y={2.6} z={1.9} rotationY={-0.5} />
    </>
  );
}

const LIGHTING = {
  ambientColor: "#c9b98a",
  ambientIntensity: 0.55,
  hemisphereSky: "#cfe0f0",
  hemisphereGround: "#8d8060",
  hemisphereIntensity: 0.5,
  sunColor: "#ffe8c2",
  sunIntensity: 1.35,
  sunPosition: [12, 18, 8] as [number, number, number],
};

export function MainGateScene({
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
      world={buildMainGateWorld()}
      lighting={LIGHTING}
      floorColor="#9c8f74"
      npcs={buildMainGateNpcs()}
      dressing={<MainGateDressing />}
      ambienceSounds={["main-gate-wind", "wind-outside"]}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
    />
  );
}

export default MainGateScene;
