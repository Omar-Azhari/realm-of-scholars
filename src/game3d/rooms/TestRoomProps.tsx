/**
 * Test room composition (Milestone 20A.5 "Visual Direction Lock"; retrofitted
 * in Phase 20D to a slot-driven furniture layer). Two layers now:
 *
 * 1. Fixed environment — Couch, Wardrobe cluster, Coffee corner, Window,
 *    Dust motes. Not a furniture category (no catalogue category exists
 *    for "couch"/"wardrobe"/"window"), so these stay hand-placed, exactly
 *    as Milestone 20A.5 built them — Phase 20D's own brief scopes
 *    Campus HQ polish as "expand modestly," not replace the built room.
 * 2. Slot-driven furniture — desk, bookshelf, chair, 2 plants, lamp, rug,
 *    wall art, noticeboard, storage, decoration. Each renders whichever
 *    catalogue item `placedFurniture` has at that `ROOM_SLOTS` position
 *    (via `FurnitureMesh`, `furnitureRenderer.tsx`), or nothing if the
 *    slot is empty. The desk-accessory slot (laptop etc.) and the desk
 *    surface itself stay owned by `TestRoomScene.tsx` (they need real
 *    collision/click meshes, not swappable dressing).
 *
 * Big furniture pieces are positioned at the exact centre of their
 * matching `TEST_ROOM_WORLD` obstacle rect (`src/game3d/rooms/testRoomWorld.ts`)
 * via `floorPointToVector3`, so the visible mesh and the collision
 * footprint can never silently drift apart.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { floorPointToVector3 } from "../types/coordinates";
import { ROOM_SLOTS } from "./roomSlots";
import { findFurnitureItem } from "../../data/furnitureCatalogue";
import { FurnitureMesh } from "./furnitureRenderer";
import {
  CampusSignpost,
  ContactShadow,
  DeskItems,
  FABRIC_TERRACOTTA,
  METAL,
  PotPlant,
  RoomPlannerBoard,
  WOOD,
  WOOD_DARK,
  useLampFlicker,
} from "./furniturePieces";

function Couch({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.85} />
      <RoundedBox args={[1.4, 0.32, 0.65]} radius={0.08} smoothness={2} position={[0, 0.2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={FABRIC_TERRACOTTA} roughness={0.95} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[1.4, 0.4, 0.16]} radius={0.08} smoothness={2} position={[0, 0.5, -0.27]} castShadow>
        <meshStandardMaterial color={FABRIC_TERRACOTTA} roughness={0.95} metalness={0} />
      </RoundedBox>
      {[-0.62, 0.62].map((armX) => (
        <RoundedBox key={armX} args={[0.16, 0.42, 0.65]} radius={0.06} position={[armX, 0.32, 0]} castShadow>
          <meshStandardMaterial color="#b85c45" roughness={0.95} metalness={0} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.24, 0.2, 0.22]} radius={0.06} rotation={[0, 0.3, 0]} position={[-0.3, 0.42, 0.05]} castShadow>
        <meshStandardMaterial color="#e3a13a" roughness={1} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.24, 0.2, 0.22]} radius={0.06} rotation={[0, -0.25, 0]} position={[0.3, 0.42, 0.05]} castShadow>
        <meshStandardMaterial color="#7a5c8f" roughness={1} metalness={0} />
      </RoundedBox>
    </group>
  );
}

/** Left-wall window — a purely visual glazing quad + frame; actual daylight comes from the room's directional "sun" light (see TestRoomScene.tsx), not a separate light source here. */
function Window({ y, z }: { y: number; z: number }) {
  const glassRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!glassRef.current) return;
    glassRef.current.emissiveIntensity = 0.35 + Math.sin(clock.elapsedTime / 9) * 0.04;
  });
  return (
    <group position={[0.02, y, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[1.3, 1.0]} />
        <meshStandardMaterial ref={glassRef} color="#fdf3d8" roughness={0.5} metalness={0} emissive="#fbe6a8" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.03, 1.0, 0.03]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[1.3, 0.03, 0.03]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </mesh>
      <PotPlant x={0.55} y={-0.42} z={0.08} scale={0.7} />
    </group>
  );
}

const DUST_MOTE_COUNT = 26;

/** Dust motes drifting in the window's sunbeam (Phase 20C, Part 6). One shared `InstancedMesh` rather than separate mesh objects. */
function DustMotes({ x, y, z, width, height, depth }: { x: number; y: number; z: number; width: number; height: number; depth: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = new THREE.Object3D();
  const particles = useRef(
    Array.from({ length: DUST_MOTE_COUNT }, () => ({
      baseX: (Math.random() - 0.5) * width,
      baseY: Math.random() * height,
      baseZ: (Math.random() - 0.5) * depth,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.15,
    }))
  ).current;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      dummy.position.set(
        x + p.baseX + Math.sin(t * p.speed + p.phase) * 0.15,
        y + p.baseY + Math.sin(t * p.speed * 0.7 + p.phase) * 0.1,
        z + p.baseZ + Math.cos(t * p.speed * 0.5 + p.phase) * 0.15
      );
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DUST_MOTE_COUNT]}>
      <sphereGeometry args={[0.006, 4, 4]} />
      <meshBasicMaterial color="#fff6da" transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

/** Wardrobe + mirror + clothes rack (Phase 20B, Part 8) — the world entry point into the Character Creator. Positioned to match `TEST_ROOM_WORLD`'s "wardrobe" obstacle rect exactly. */
function WardrobeCluster({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.55} />
      <RoundedBox args={[0.42, 1.5, 0.4]} radius={0.03} smoothness={1} position={[-0.28, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.9} metalness={0} />
      </RoundedBox>
      <mesh position={[-0.28, 0.75, 0.21]}>
        <planeGeometry args={[0.02, 1.3]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[-0.24, 1.05, 0.21]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-0.32, 1.05, 0.21]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
      </mesh>

      <group position={[0.02, 0, 0]}>
        <RoundedBox args={[0.34, 0.9, 0.03]} radius={0.06} smoothness={2} position={[0, 0.95, 0]} castShadow>
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
        </RoundedBox>
        <mesh position={[0, 0.95, 0.018]}>
          <planeGeometry args={[0.27, 0.78]} />
          <meshStandardMaterial color="#cfe0e6" roughness={0.35} metalness={0} />
        </mesh>
      </group>

      <group position={[0.32, 0, 0]}>
        {[-0.16, 0.16].map((legX) => (
          <mesh key={legX} position={[legX, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
            <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
          </mesh>
        ))}
        <mesh position={[0, 1.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.34, 8]} />
          <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
        </mesh>
        {[
          { x: -0.11, color: FABRIC_TERRACOTTA },
          { x: 0, color: "#4f7a8c" },
          { x: 0.11, color: "#8fc1a9" },
        ].map((garment) => (
          <mesh key={garment.x} position={[garment.x, 0.95, 0]} castShadow>
            <coneGeometry args={[0.09, 0.32, 8, 1, true]} />
            <meshStandardMaterial color={garment.color} roughness={0.95} metalness={0} side={2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Coffee corner (Phase 20C, Part 9; interactive as of Phase 20D "Coffee Area -> Daily Brief") — a small round table, coffee pot, and two mugs, matching `TEST_ROOM_WORLD`'s coffee-corner obstacle rect exactly. */
function CoffeeCorner({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.45} />
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.55, 8]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </mesh>
      <RoundedBox args={[0.5, 0.03, 0.5]} radius={0.02} smoothness={2} position={[0, 0.56, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.9} metalness={0} />
      </RoundedBox>
      <mesh position={[-0.12, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.16, 10]} />
        <meshStandardMaterial color={METAL} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[-0.12, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.02, 8, 6]} />
        <meshStandardMaterial color={METAL} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0.08, 0.605, 0.08]} castShadow>
        <cylinderGeometry args={[0.035, 0.03, 0.06, 10]} />
        <meshStandardMaterial color="#c1543f" roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[0.15, 0.605, -0.08]} castShadow>
        <cylinderGeometry args={[0.035, 0.03, 0.06, 10]} />
        <meshStandardMaterial color="#8fc1a9" roughness={0.7} metalness={0} />
      </mesh>
      <PotPlant x={0.2} y={0.575} z={0.15} scale={0.45} />
    </group>
  );
}

export function TestRoomProps({
  placedFurniture,
  rotations = {},
}: {
  placedFurniture: Record<string, string | null>;
  /** Room Edit Mode's "Rotate" (Part 5), degrees per slot id — only applied to `rotatable: true` slots. */
  rotations?: Record<string, number>;
}) {
  const couchCenter = floorPointToVector3({ x: 472.5, feetY: 377.5 });
  const wardrobeCenter = floorPointToVector3({ x: 105, feetY: 200 });
  const coffeeCenter = floorPointToVector3({ x: 240, feetY: 325 });

  return (
    <>
      {ROOM_SLOTS.filter((slot) => slot.category !== "desk-accessory").map((slot) => {
        const itemId = placedFurniture[slot.id];
        const item = itemId ? findFurnitureItem(itemId) : undefined;
        if (!item) return null;
        const [x, , z] = floorPointToVector3(slot.position);
        const rotationY = slot.rotatable ? ((rotations[slot.id] ?? 0) * Math.PI) / 180 : 0;
        return (
          <group key={slot.id} position={[x, 0, z]} rotation={[0, rotationY, 0]}>
            <FurnitureMesh item={item} x={0} z={0} />
          </group>
        );
      })}

      <Couch x={couchCenter[0]} z={couchCenter[2]} />
      <WardrobeCluster x={wardrobeCenter[0]} z={wardrobeCenter[2]} />
      <CoffeeCorner x={coffeeCenter[0]} z={coffeeCenter[2]} />
      <Window y={1.35} z={2.15} />
      <RoomPlannerBoard x={3.5} y={1.4} z={0.02} />
      <CampusSignpost x={3.9} z={2.0} />
      <DustMotes x={1.0} y={1.0} z={2.15} width={1.4} height={0.9} depth={0.9} />
    </>
  );
}

export { ContactShadow, DeskItems, useLampFlicker };
