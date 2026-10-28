/**
 * V2 Phase 1 "Prestige Vertical Slice" — the Hall of Artisans, replacing
 * the old "UI Design Room" prototype (docs/UNIGAME_V2_MASTER_DESIGN.md
 * §4.4). A bright, clerestory-lit workshop-guild hall: sketch tables,
 * easels, design boards, bookshelves, a mentor area for Iris (the SAME
 * real mentor, appearance/personality unchanged, see prestigeNpcs.ts), and
 * a study desk that hands off into the REAL 2D subject room — no gameplay
 * duplicated here, exactly like the old SubjectBuildingScene's own
 * `enter-room` handoff.
 */

import { RoundedBox } from "@react-three/drei";
import { PrestigeSceneShell } from "../PrestigeSceneShell";
import {
  StoneColumn,
  StainedGlassWindow,
  Banner,
  Easel,
  DraftingTable,
  PARCHMENT,
  OAK,
  OAK_DARK,
} from "../architecture/ArchitectureKit";
import { Bookshelf, PotPlant, ContactShadow } from "../../rooms/furniturePieces";
import { buildHallOfArtisansNpcs } from "../prestigeNpcs";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";

const ROOM_WIDTH_M = 32;
const ROOM_DEPTH_M = 26;

export function buildHallOfArtisansWorld(): SceneWorld {
  return {
    sceneId: "prestige-hall-of-artisans",
    width: ROOM_WIDTH_M * 100,
    height: ROOM_DEPTH_M * 100,
    walkable: { xMin: 150, xMax: ROOM_WIDTH_M * 100 - 150, feetBack: 150, feetFront: ROOM_DEPTH_M * 100 - 150 },
    heightFront: 140,
    heightBack: 100,
    spawn: { x: 1600, feetY: ROOM_DEPTH_M * 100 - 250 },
    obstacles: [
      { xMin: 750, xMax: 1050, feetMin: 1550, feetMax: 1850 }, // apprentice desk 1
      { xMin: 2550, xMax: 2850, feetMin: 1750, feetMax: 2050 }, // apprentice desk 2
      { xMin: 1650, xMax: 1950, feetMin: 750, feetMax: 1050 }, // mentor's drafting table
    ],
    interactables: [
      { id: "artisans-exit", kind: "door", label: "The Grand Courtyard", actionLabel: "Return to the Courtyard", action: { type: "travel", sceneId: "prestige-grand-courtyard" }, rect: [1480, ROOM_DEPTH_M * 100 - 180, 240, 150], standPoint: { x: 1600, feetY: ROOM_DEPTH_M * 100 - 380 }, range: 110 },
      { id: "artisans-mentor", kind: "mentor", label: "Iris", actionLabel: "Talk", action: { type: "npc-chat", role: "subject-mentor", npcLabel: "Iris", subjectId: "user-interface-design" }, rect: [1700, 800, 200, 200], standPoint: { x: 1800, feetY: 1050 }, range: 100 },
      { id: "artisans-desk", kind: "desk", label: "Study Desk", actionLabel: "Enter Room", action: { type: "enter-room", subjectId: "user-interface-design" }, rect: [1100, 1250, 200, 200], standPoint: { x: 1200, feetY: 1500 }, range: 90 },
    ],
  };
}

/** A cork-and-parchment design board with a few pinned sketch swatches — "design boards" from the brief, built from primitives since no in-engine image/text system exists yet. */
function DesignBoard({ x, y, z, rotationY = 0 }: { x: number; y: number; z: number; rotationY?: number }) {
  const swatches = ["#c9694f", "#4f7a8c", "#e3a13a", "#7a5c8f", "#5a8a52", "#3d5a73"];
  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[2.2, 1.5, 0.06]} radius={0.02} castShadow receiveShadow>
        <meshStandardMaterial color="#8a6a4a" roughness={0.9} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[2.0, 1.3]} />
        <meshStandardMaterial color="#c9b98a" roughness={0.95} metalness={0} />
      </mesh>
      {swatches.map((c, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <mesh key={i} position={[-0.6 + col * 0.6, 0.32 - row * 0.6, 0.04]} rotation={[0, 0, (i % 2 === 0 ? 1 : -1) * 0.05]} castShadow>
            <planeGeometry args={[0.42, 0.32]} />
            <meshStandardMaterial color={c} roughness={0.95} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A small sculptural maquette on a plinth — "models," a tabletop-scale cousin of the courtyard's full statues. */
function Maquette({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.08, 10]} />
        <meshStandardMaterial color={OAK_DARK} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <coneGeometry args={[0.13, 0.28, 8]} />
        <meshStandardMaterial color={PARCHMENT} roughness={0.7} metalness={0} />
      </mesh>
    </group>
  );
}

function HallOfArtisansDressing() {
  return (
    <>
      {/* Bright clerestory windows down both long walls — warmer, greener glass than the Great Hall's jewel tones, matching Iris's own established creative-studio palette. */}
      {[6, 14, 22].map((z) => (
        <group key={z}>
          <StainedGlassWindow x={0.1} y={4} z={z} widthM={2.2} heightM={3} rotationY={Math.PI / 2} colors={["#8fc1a9", "#e3a13a", "#c9974a"]} />
          <StainedGlassWindow x={ROOM_WIDTH_M - 0.1} y={4} z={z} widthM={2.2} heightM={3} rotationY={-Math.PI / 2} colors={["#e3a13a", "#8fc1a9", "#7a5c8f"]} />
        </group>
      ))}

      <StoneColumn x={2.5} z={ROOM_DEPTH_M - 1.5} heightM={4.6} radius={0.3} />
      <StoneColumn x={ROOM_WIDTH_M - 2.5} z={ROOM_DEPTH_M - 1.5} heightM={4.6} radius={0.3} />

      <Banner x={2.5} y={5.6} z={ROOM_DEPTH_M - 3} color="#b24bf3" />
      <Banner x={ROOM_WIDTH_M - 2.5} y={5.6} z={ROOM_DEPTH_M - 3} color="#b24bf3" />

      {/* Mentor area — Iris's own drafting table, a design board, and a bookshelf of reference volumes. */}
      <DraftingTable x={18} z={9} rotationY={Math.PI} trimColor="#b24bf3" />
      <DesignBoard x={19.6} y={2} z={7.6} rotationY={Math.PI} />
      <Bookshelf x={21.5} z={8.5} color="#7a5c8f" />

      {/* Apprentice workspaces. */}
      <Easel x={8} z={16.5} rotationY={0.3} canvasColor="#f2e2c8" />
      <DraftingTable x={9.2} z={17.4} rotationY={-0.4} />
      <ContactShadow x={8} z={16.5} radius={0.6} />
      <PotPlant x={7} z={15.6} y={0} />

      <Easel x={26} z={18.5} rotationY={-0.3} canvasColor="#e8d9c0" />
      <DraftingTable x={27.2} z={19.4} rotationY={0.4} />
      <Maquette x={25.4} y={0.86} z={19.6} />

      {/* Study desk (real 2D room handoff) + its own small library corner. */}
      <mesh position={[12, 0.4, 15]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.8, 0.9]} />
        <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
      </mesh>
      <Bookshelf x={10.3} z={14.5} color="#4f7a8c" />
      <PotPlant x={13.4} z={15} y={0} scale={1.1} />
    </>
  );
}

const LIGHTING = {
  ambientColor: "#e3d3a8",
  ambientIntensity: 0.72,
  hemisphereSky: "#e8e0c0",
  hemisphereGround: "#7a6a4a",
  hemisphereIntensity: 0.55,
  sunColor: "#fff2cf",
  sunIntensity: 1.6,
  sunPosition: [16, 20, 20] as [number, number, number],
};

export function HallOfArtisansScene({
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
  return (
    <PrestigeSceneShell
      world={buildHallOfArtisansWorld()}
      lighting={LIGHTING}
      floorColor="#8a7358"
      npcs={buildHallOfArtisansNpcs()}
      dressing={<HallOfArtisansDressing />}
      ambienceSounds={["artisans-workshop-ambience", "birds-outside"]}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default HallOfArtisansScene;
