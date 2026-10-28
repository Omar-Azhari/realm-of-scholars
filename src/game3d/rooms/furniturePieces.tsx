/**
 * Shared, colour-parameterised furniture primitives (Phase 20D, Part 8/10
 * retrofit of Milestone 20A.5's hand-built room dressing). Extracted out of
 * `TestRoomProps.tsx` into a neutral module so both `TestRoomProps.tsx`
 * (the fixed environment: walls, couch, wardrobe, coffee corner, window)
 * and `furnitureRenderer.tsx` (the slot-driven catalogue renderer) can
 * import from here without a circular dependency between the two.
 *
 * Every visual default below (colour, proportion, material) is copied
 * verbatim from the Milestone 20A.5 original so the STARTER catalogue item
 * at each slot reproduces exactly what already existed in the room —
 * colour now comes from a prop with the original hardcoded value as its
 * default, never a redesign.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";

export const WOOD = "#a97c50";
export const WOOD_DARK = "#8a5a34";
export const FABRIC_TERRACOTTA = "#c9694f";
export const RUG_TAN = "#e3b774";
export const RUG_BORDER = "#c98f4e";
export const PAPER = "#fbf6ea";
export const POT = "#a9704f";
export const LEAF = "#5a8a52";
export const METAL = "#9a9490";
export const BOOK_COLORS = ["#c1543f", "#4f7a8c", "#e3a13a", "#7a5c8f", "#5a8a52", "#d97b5f"];

/** A very subtle, slow point-light intensity jitter — "desk lamp flicker (very subtle)." Never fully off, never a jarring strobe; reads as a faint, live flame-like flutter. */
export function useLampFlicker(ref: React.RefObject<THREE.PointLight>, baseIntensity: number, seed: number) {
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    const flicker = Math.sin(t * 7.3) * 0.015 + Math.sin(t * 2.1) * 0.02;
    ref.current.intensity = baseIntensity + flicker;
  });
}

/** A soft, cheap contact-shadow blob — not a real shadow, just a dark, low-opacity disc, faking gentle ambient occlusion under a furniture piece without a postprocessing pass. */
export function ContactShadow({ x, z, radius }: { x: number; z: number; radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, z]}>
      <circleGeometry args={[radius, 16]} />
      <meshBasicMaterial color="#2a1f14" transparent opacity={0.16} depthWrite={false} />
    </mesh>
  );
}

export function PotPlant({
  x,
  y,
  z,
  scale = 1,
  potColor = POT,
  leafColor = LEAF,
}: {
  x: number;
  y: number;
  z: number;
  scale?: number;
  potColor?: string;
  leafColor?: string;
}) {
  const foliageRef = useRef<THREE.Group>(null);
  const seed = useMemo(() => (x * 3.1 + z * 1.7) % (Math.PI * 2), [x, z]);
  useFrame(({ clock }) => {
    if (!foliageRef.current) return;
    const t = clock.elapsedTime + seed;
    foliageRef.current.rotation.z = Math.sin(t / 2.6) * 0.025;
    foliageRef.current.rotation.x = Math.sin(t / 3.4) * 0.015;
  });
  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.09, 0.18, 10]} />
        <meshStandardMaterial color={potColor} roughness={0.95} metalness={0} />
      </mesh>
      <group ref={foliageRef} position={[0, 0.18, 0]}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <sphereGeometry args={[0.16, 8, 7]} />
          <meshStandardMaterial color={leafColor} roughness={0.9} metalness={0} flatShading />
        </mesh>
        <mesh position={[0.08, 0.16, 0.03]} castShadow>
          <sphereGeometry args={[0.1, 8, 7]} />
          <meshStandardMaterial color={leafColor} roughness={0.9} metalness={0} flatShading />
        </mesh>
      </group>
    </group>
  );
}

export function Bookshelf({ x, z, color = WOOD }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.75} />
      <RoundedBox args={[1.3, 1.5, 0.32]} radius={0.03} smoothness={1} position={[0, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </RoundedBox>
      {[0.5, 1.0].map((y) => (
        <mesh key={y} position={[0, y, 0.02]} castShadow>
          <boxGeometry args={[1.22, 0.03, 0.28]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      {[0.16, 0.66, 1.16].map((rowY, rowIdx) =>
        Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`${rowIdx}-${i}`} position={[-0.5 + i * 0.19, rowY, 0.02 + (i % 2) * 0.02]} castShadow>
            <boxGeometry args={[0.13, 0.3, 0.2]} />
            <meshStandardMaterial color={BOOK_COLORS[(rowIdx * 6 + i) % BOOK_COLORS.length]} roughness={1} metalness={0} />
          </mesh>
        ))
      )}
      <RoundedBox args={[0.32, 0.05, 0.22]} radius={0.01} position={[0.4, 1.32, 0.02]} castShadow>
        <meshStandardMaterial color="#e3a13a" roughness={0.95} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.1, 0.16, 0.1]} radius={0.02} position={[-0.45, 1.4, 0]} castShadow>
        <meshStandardMaterial color="#d7b23a" roughness={0.6} metalness={0} />
      </RoundedBox>
      <PotPlant x={0.5} y={1.32} z={0.05} scale={0.6} />
    </group>
  );
}

export function Rug({
  x,
  z,
  width,
  depth,
  fill = RUG_TAN,
  border = RUG_BORDER,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  fill?: string;
  border?: string;
}) {
  return (
    <group position={[x, 0.005, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={border} roughness={1} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[width - 0.25, depth - 0.25]} />
        <meshStandardMaterial color={fill} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

/** Back-wall whiteboard + a small calendar/sticky-notes cluster beside it. */
export function WallArt({ x, y, color = PAPER }: { x: number; y: number; color?: string }) {
  return (
    <group position={[x, y, 0.02]}>
      <RoundedBox args={[1.0, 0.65, 0.03]} radius={0.02} smoothness={1}>
        <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
      </RoundedBox>
      <mesh position={[-0.28, 0.12, 0.02]}>
        <planeGeometry args={[0.35, 0.03]} />
        <meshStandardMaterial color="#c1543f" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-0.1, -0.08, 0.02]}>
        <planeGeometry args={[0.5, 0.03]} />
        <meshStandardMaterial color="#4f7a8c" roughness={1} metalness={0} />
      </mesh>
      <group position={[0.75, 0, 0]}>
        <RoundedBox args={[0.42, 0.5, 0.02]} radius={0.02}>
          <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
        </RoundedBox>
        {[-0.12, 0.02, 0.16].map((noteY, i) => (
          <mesh key={noteY} position={[i % 2 === 0 ? -0.1 : 0.1, noteY, 0.015]}>
            <planeGeometry args={[0.12, 0.1]} />
            <meshStandardMaterial color={["#f6d76a", "#8fc1a9", "#f0955c"][i]} roughness={1} metalness={0} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Right-wall noticeboard — small varied-colour squares standing in for pinned notes. `x` defaults to the room's right-wall anchor (5.98m) for direct callers; the slot-driven renderer passes 0 and lets its own positioning group supply the real offset, the same convention every other piece here follows. */
export function Noticeboard({ x = 5.98, y, z, color = "#c9a06a" }: { x?: number; y: number; z: number; color?: string }) {
  const notes = ["#f6d76a", "#f0955c", "#8fc1a9", "#f6d76a", "#e88a9a"];
  return (
    <group position={[x, y, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[1.1, 0.8]} />
        <meshStandardMaterial color={color} roughness={1} metalness={0} />
      </mesh>
      {notes.map((noteColor, i) => (
        <mesh key={noteColor + i} position={[-0.4 + i * 0.2, 0.15 - (i % 2) * 0.3, 0.01]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.08]}>
          <planeGeometry args={[0.15, 0.15]} />
          <meshStandardMaterial color={noteColor} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/** Small items scattered on the desk surface — laptop, notebook, mug, pen, lamp — so the desk reads as lived-in rather than a bare slab. `deskTopY` is the world-space Y of the desk's top surface. */
export function DeskItems({ x, z, deskTopY }: { x: number; z: number; deskTopY: number }) {
  const lampRef = useRef<THREE.PointLight>(null);
  useLampFlicker(lampRef, 0.7, 4.2);
  return (
    <group position={[x, deskTopY, z]}>
      <RoundedBox args={[0.34, 0.02, 0.24]} radius={0.01} position={[-0.25, 0.01, 0.05]} castShadow>
        <meshStandardMaterial color="#e8e2d6" roughness={0.6} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.22, 0.015]} radius={0.01} position={[-0.25, 0.12, -0.06]} rotation={[-0.18, 0, 0]} castShadow>
        <meshStandardMaterial color="#3a3630" roughness={0.4} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.18, 0.02, 0.24]} radius={0.01} position={[0.15, 0.01, 0.08]} rotation={[0, 0.15, 0]} castShadow>
        <meshStandardMaterial color="#8fc1a9" roughness={0.9} metalness={0} />
      </RoundedBox>
      <mesh position={[0.32, 0.05, -0.08]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.09, 10]} />
        <meshStandardMaterial color="#c1543f" roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[0.15, 0.015, -0.05]} rotation={[0, 0, Math.PI / 2 - 0.3]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.15, 6]} />
        <meshStandardMaterial color="#4f7a8c" roughness={0.8} metalness={0} />
      </mesh>
      <group position={[-0.42, 0, -0.12]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.03, 10]} />
          <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
        </mesh>
        <mesh position={[0, 0.22, -0.02]} rotation={[0.5, 0, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 0.36, 6]} />
          <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
        </mesh>
        <mesh position={[0, 0.38, 0.13]} rotation={[1.2, 0, 0]} castShadow>
          <coneGeometry args={[0.09, 0.12, 10, 1, true]} />
          <meshStandardMaterial color="#e3a13a" roughness={0.8} metalness={0} side={2} />
        </mesh>
        <pointLight ref={lampRef} position={[0, 0.34, 0.16]} color="#ffcf8a" intensity={0.7} distance={1.8} decay={2} />
      </group>
    </group>
  );
}

/**
 * Standalone reading chair (Phase 20D "Chair slot") — the seat/back/legs
 * geometry previously embedded in Milestone 20A.5's `ReadingNook` group,
 * now independent so it can be swapped by the slot system. Same
 * proportions and default colour as the original.
 */
export function ReadingChair({ x, z, color = FABRIC_TERRACOTTA }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.4} />
      <RoundedBox args={[0.5, 0.06, 0.5]} radius={0.03} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.5, 0.06]} radius={0.04} position={[0, 0.68, -0.22]} castShadow>
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </RoundedBox>
      {[-0.2, 0.2].map((legX) => (
        <mesh key={legX} position={[legX, 0.2, -0.2]} castShadow>
          <boxGeometry args={[0.05, 0.4, 0.05]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      {[-0.2, 0.2].map((legX) => (
        <mesh key={`f${legX}`} position={[legX, 0.2, 0.2]} castShadow>
          <boxGeometry args={[0.05, 0.4, 0.05]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Standalone standing lamp (Phase 20D "Lamp slot") — same silhouette as
 * the reading lamp previously embedded in `ReadingNook`, now independent.
 */
export function StandingLamp({ x, z, metalColor = METAL, shadeColor = "#e3a13a" }: { x: number; z: number; metalColor?: string; shadeColor?: string }) {
  const lampRef = useRef<THREE.PointLight>(null);
  const seed = useMemo(() => (x * 2.3 + z * 1.1) % (Math.PI * 2), [x, z]);
  useLampFlicker(lampRef, 0.55, seed);
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.2} />
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
        <meshStandardMaterial color={metalColor} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <coneGeometry args={[0.16, 0.18, 10, 1, true]} />
        <meshStandardMaterial color={shadeColor} roughness={0.8} metalness={0} side={2} />
      </mesh>
      <pointLight ref={lampRef} position={[0, 0.98, 0]} color="#ffcf8a" intensity={0.55} distance={2.2} decay={2} />
    </group>
  );
}

/** Student lockers (Phase 20D Part 9 "Campus HQ polish" + "Storage" category) — a small bank of narrow vertical lockers. */
export function StorageLockers({ x, z, color = "#4f7a8c" }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.55} />
      {[-0.28, 0, 0.28].map((doorX) => (
        <RoundedBox key={doorX} args={[0.24, 1.3, 0.35]} radius={0.02} smoothness={1} position={[doorX, 0.65, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
        </RoundedBox>
      ))}
      {[-0.28, 0, 0.28].map((handleX) => (
        <mesh key={`h${handleX}`} position={[handleX + 0.08, 0.7, 0.18]} castShadow>
          <boxGeometry args={[0.02, 0.1, 0.02]} />
          <meshStandardMaterial color={METAL} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/** Small desk/shelf trophy (Phase 20D decoration category). */
export function DecorationTrophy({ x, z, color = "#d7b23a" }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.15} />
      <RoundedBox args={[0.12, 0.05, 0.12]} radius={0.01} position={[0, 0.025, 0]} castShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
      </mesh>
    </group>
  );
}

/** Room Planner board (Phase 20D Part 5) — the fixed, always-present interaction point for Room Edit Mode. A small grid-pattern board (distinct from the noticeboard/whiteboard) reading as "the room's layout plan," not swappable/catalogue furniture. */
export function RoomPlannerBoard({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[0.7, 0.55, 0.03]} radius={0.02} smoothness={1}>
        <meshStandardMaterial color="#4f7a8c" roughness={0.7} metalness={0} />
      </RoundedBox>
      {[-0.18, 0, 0.18].flatMap((gx) =>
        [-0.13, 0.05].map((gy) => (
          <mesh key={`${gx}-${gy}`} position={[gx, gy, 0.02]}>
            <planeGeometry args={[0.14, 0.14]} />
            <meshStandardMaterial color="#cfe0e6" roughness={0.9} metalness={0} />
          </mesh>
        ))
      )}
    </group>
  );
}

/** Small standing photo frame (Phase 20D decoration category). */
export function DecorationPhotoFrame({ x, z, color = "#8a5a34" }: { x: number; z: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.12} />
      <RoundedBox args={[0.16, 0.2, 0.02]} radius={0.01} rotation={[-0.15, 0, 0]} position={[0, 0.11, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0.11, 0.011]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[0.12, 0.16]} />
        <meshStandardMaterial color="#cfe0e6" roughness={0.5} metalness={0} />
      </mesh>
    </group>
  );
}

/** Campus signpost (Phase 20E Part 6 "signposts... campus map... direction markers") — a simple post with two crossed arrow-boards, the in-world entry point into the Campus Directory. Reused wherever a way-finding point is needed, not redrawn per building. */
export function CampusSignpost({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.2} />
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.4, 8]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} metalness={0} />
      </mesh>
      {[
        { y: 1.1, rotY: 0.35, color: "#c1543f" },
        { y: 0.95, rotY: -0.3, color: "#4f7a8c" },
        { y: 0.8, rotY: 0.15, color: "#8fc1a9" },
      ].map((arrow, i) => (
        <RoundedBox key={i} args={[0.42, 0.12, 0.02]} radius={0.01} smoothness={1} position={[0, arrow.y, 0]} rotation={[0, arrow.rotY, 0]} castShadow>
          <meshStandardMaterial color={arrow.color} roughness={0.8} metalness={0} />
        </RoundedBox>
      ))}
    </group>
  );
}
