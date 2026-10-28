/**
 * The dorm room in 3D: plank floor, plaster walls (back and left full
 * height, right and front cut away so the camera can see in), a window of
 * daylight, a ceiling lamp, and the visuals for the furniture, wardrobe,
 * noticeboard and door objects (see dorm/interior.ts). Also the harbour pier
 * and boat used on every island.
 */

import { Suspense, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FurnitureModel } from "../dorm/DormWindow";
import {
  furniture,
  footprint,
  ROOM_COLS,
  ROOM_ROWS,
  FIXTURES,
} from "../dorm/dorm";
import { ROOM_X, ROOM_Z } from "../dorm/interior";
import { PropModel, WithFallback } from "./models";
import { RoomWalls } from "./RoomWalls";
import type { WorldObject } from "../world/worldGen";

const WALL_H = 3;
const LOW = 0.45;

function plankTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    const shade = 120 + ((i * 37) % 30);
    g.fillStyle = `rgb(${shade + 40}, ${shade}, ${shade - 50})`;
    g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = "rgba(60,35,15,0.6)";
    g.fillRect(0, i * 32 + 30, 256, 2);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ROOM_COLS / 4, ROOM_ROWS / 4);
  return t;
}

/** The dorm room. `embedded`: it stands inside its building on the island, with its own walls and roof. */
export function RoomShell({
  onFloorClick,
  onFloorHover,
  embedded = false,
  insideRef,
}: {
  onFloorClick: (x: number, z: number) => void;
  onFloorHover: () => void;
  embedded?: boolean;
  insideRef?: MutableRefObject<boolean>;
}) {
  const planks = useMemo(plankTexture, []);
  const x0 = ROOM_X;
  const z0 = ROOM_Z;
  const x1 = ROOM_X + ROOM_COLS;
  const z1 = ROOM_Z + ROOM_ROWS;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const doorX0 = FIXTURES.doorCol + ROOM_X;
  const plaster = "#e9dcc4";
  // The window in the left wall (on the island it hides when that wall drops away).
  const windowDecor = (
    <>
      <mesh
        position={[x0 + 0.01, 1.7, cz - 0.6]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[1.6, 1.1]} />
        <meshBasicMaterial color="#bfe3ff" toneMapped={false} />
      </mesh>
      {[0, Math.PI / 2].map((r, i) => (
        <mesh
          key={i}
          position={[x0 + 0.03, 1.7, cz - 0.6]}
          rotation={[r, Math.PI / 2, 0]}
        >
          <planeGeometry args={[i ? 1.25 : 1.75, 0.08]} />
          <meshStandardMaterial color="#6b4a2e" />
        </mesh>
      ))}
    </>
  );
  return (
    <group>
      {embedded ? null : (
        <>
          <color attach="background" args={["#120c08"]} />
          <hemisphereLight args={["#fff2dc", "#4a3424", 0.75]} />
          <ambientLight intensity={0.25} />
          {/* Daylight through the window in the left wall. */}
          <directionalLight
            position={[x0 - 6, 6, cz - 1]}
            intensity={1.4}
            color="#fff1d6"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          >
            <orthographicCamera
              attach="shadow-camera"
              args={[-7, 7, 7, -7, 0.5, 25]}
            />
          </directionalLight>
        </>
      )}
      {/* Ceiling lamp (on the island one shared indoor light does this: see WalkInRooms). */}
      {embedded ? null : <pointLight position={[cx, 2.8, cz]} color="#ffd9a0" intensity={18} distance={14} decay={1.6} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />}
      {embedded && insideRef ? (
        <RoomWalls
          x0={x0}
          z0={z0}
          x1={x1}
          z1={z1}
          height={WALL_H}
          door={{ x: doorX0, width: 1 }}
          insideRef={insideRef}
          inner={plaster}
          outer="#b9a27a"
          roof="#7a3b2e"
          decor={{ left: windowDecor }}
        />
      ) : null}
      <mesh
        position={[cx, 0, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 6) return;
          onFloorClick(Math.floor(e.point.x), Math.floor(e.point.z));
        }}
        onPointerMove={onFloorHover}
      >
        <planeGeometry args={[ROOM_COLS, ROOM_ROWS]} />
        <meshStandardMaterial map={planks} roughness={0.85} />
      </mesh>
      {embedded ? null : (
        <>
          {/* Back wall. */}
          <mesh position={[cx, WALL_H / 2, z0 - 0.05]} receiveShadow castShadow>
            <boxGeometry args={[ROOM_COLS + 0.2, WALL_H, 0.1]} />
            <meshStandardMaterial color={plaster} roughness={0.95} />
          </mesh>
          {/* Left wall with a window. */}
          <mesh position={[x0 - 0.05, WALL_H / 2, cz]} receiveShadow castShadow>
            <boxGeometry args={[0.1, WALL_H, ROOM_ROWS + 0.2]} />
            <meshStandardMaterial color="#dccdb2" roughness={0.95} />
          </mesh>
        </>
      )}
      {embedded ? null : windowDecor}
      {/* Right and front walls cut away low so the room stays visible. */}
      {embedded ? null : (
        <>
          <mesh position={[x1 + 0.05, LOW / 2, cz]}>
            <boxGeometry args={[0.1, LOW, ROOM_ROWS]} />
            <meshStandardMaterial color={plaster} roughness={0.95} />
          </mesh>
          {/* Front wall, with the doorway at its right-hand end. */}
          <mesh position={[(x0 + doorX0) / 2, LOW / 2, z1 + 0.05]}>
            <boxGeometry args={[doorX0 - x0, LOW, 0.1]} />
            <meshStandardMaterial color={plaster} roughness={0.95} />
          </mesh>
        </>
      )}
      {/* Skirting. */}
      <mesh position={[cx, 0.08, z0 + 0.03]}>
        <boxGeometry args={[ROOM_COLS, 0.16, 0.06]} />
        <meshStandardMaterial color="#7a5434" />
      </mesh>
      <mesh position={[x0 + 0.03, 0.08, cz]}>
        <boxGeometry args={[0.06, 0.16, ROOM_ROWS]} />
        <meshStandardMaterial color="#7a5434" />
      </mesh>
    </group>
  );
}

/** A placed piece of furniture, drawn at its footprint (the object node sits at the footprint centre). */
export function FurnitureVisual({ object }: { object: WorldObject }) {
  const info = object.furniture;
  const item = info ? furniture(info.id) : undefined;
  if (!info || !item) return null;
  const wall = item.layer === "wall";
  footprint(item, info.rot);
  return (
    <group
      position={[0, info.y, wall ? -0.48 : 0]}
      rotation={[0, wall ? 0 : -info.rot * (Math.PI / 2), 0]}
    >
      <Suspense fallback={null}>
        <FurnitureModel id={info.id} />
      </Suspense>
      {/* In the walk-in dorm on the island, lamps glow but don't add lights (each extra light slows the whole scene). */}
      {item.light && !object.id.startsWith("dorm-") ? (
        <pointLight
          position={[0, item.layer === "top" ? 0.8 : 2.2, 0]}
          color="#ffcf8a"
          intensity={4}
          distance={5}
          decay={1.6}
        />
      ) : null}
    </group>
  );
}

export function WardrobeVisual() {
  return (
    <group position={[0, 0, -0.1]} scale={[1.05, 1.3, 1]}>
      <Suspense fallback={null}>
        <FurnitureModel id="cabinet-small-decorated" />
      </Suspense>
    </group>
  );
}

/** Cork board with pinned notes, hanging on the back wall. */
export function NoticeboardVisual() {
  const notes: Array<[number, number, string, number]> = [
    [-0.28, 0.18, "#fff6c8", 0.08],
    [0.22, 0.2, "#c8e8ff", -0.1],
    [-0.12, -0.18, "#ffd0d0", -0.05],
    [0.26, -0.16, "#d8f5c8", 0.12],
  ];
  return (
    <group position={[0, 1.65, -0.47]}>
      <mesh castShadow>
        <boxGeometry args={[1.0, 0.75, 0.05]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.9, 0.65]} />
        <meshStandardMaterial color="#b98a55" roughness={1} />
      </mesh>
      {notes.map(([x, y, c, r], i) => (
        <group key={i} position={[x, y, 0.035]} rotation={[0, 0, r]}>
          <mesh>
            <planeGeometry args={[0.28, 0.22]} />
            <meshStandardMaterial color={c} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.08, 0.01]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshStandardMaterial color="#c8302e" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A wooden door standing in the right-hand doorway, slightly ajar. */
export function DoorVisual() {
  return (
    <group position={[-0.45, 0, 0]}>
      {/* Frame. */}
      {[-0.48, 0.48].map((z) => (
        <mesh key={z} position={[0, 1.15, z]} castShadow>
          <boxGeometry args={[0.14, 2.3, 0.1]} />
          <meshStandardMaterial color="#5a3e26" />
        </mesh>
      ))}
      <mesh position={[0, 2.3, 0]} castShadow>
        <boxGeometry args={[0.14, 0.12, 1.06]} />
        <meshStandardMaterial color="#5a3e26" />
      </mesh>
      {/* Door leaf, swung fully open against the frame so it never blocks the doorway. */}
      <group position={[0, 0, -0.45]} rotation={[0, -Math.PI / 2 + 0.06, 0]}>
        <mesh position={[0, 1.08, 0.44]} castShadow>
          <boxGeometry args={[0.06, 2.12, 0.86]} />
          <meshStandardMaterial color="#8a5a34" roughness={0.7} />
        </mesh>
        <mesh position={[0.05, 1.05, 0.78]}>
          <sphereGeometry args={[0.04, 10, 8]} />
          <meshStandardMaterial
            color="#d6a419"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      </group>
      {/* Daylight spilling in. */}
      <mesh position={[0.2, 1.1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 2.2]} />
        <meshBasicMaterial color="#fff4d8" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The harbour: a short pier over the water with a small sailing boat bobbing at the end (faces +Z = out to sea). */
export function HarbourVisual() {
  const boat = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!boat.current) return;
    const t = state.clock.elapsedTime;
    boat.current.position.y = -0.2 + Math.sin(t * 1.3) * 0.05;
    boat.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    boat.current.rotation.x = Math.sin(t * 1.1 + 1) * 0.03;
  });
  return (
    <group>
      {/* Pier planks and posts. */}
      <mesh position={[0, 0.12, 1.4]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.1, 3.2]} />
        <meshStandardMaterial color="#8a6340" roughness={0.9} />
      </mesh>
      {[-0.5, 0.5].flatMap((x) =>
        [0.2, 1.4, 2.6].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -0.3, z]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 1, 8]} />
            <meshStandardMaterial color="#5a3e26" />
          </mesh>
        )),
      )}
      {/* The boat, moored alongside the end of the pier. */}
      <group ref={boat} position={[1.25, -0.2, 2.4]}>
        <mesh castShadow scale={[0.55, 0.35, 1.5]}>
          <sphereGeometry
            args={[1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#7a4a2a"
            roughness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          position={[0, 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.5, 1.4, 1]}
        >
          <circleGeometry args={[1, 24]} />
          <meshStandardMaterial color="#a8794a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.1, 0.1]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 2.2, 8]} />
          <meshStandardMaterial color="#5a3e26" />
        </mesh>
        <mesh
          position={[0, 1.2, 0.5]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
        >
          <planeGeometry args={[0.8, 1.5]} />
          <meshStandardMaterial
            color="#f3e6c8"
            side={THREE.DoubleSide}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[0, 2.25, 0.1]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.4, 0.2]} />
          <meshStandardMaterial color="#c8302e" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <WithFallback fallback={null}>
        <PropModel id="barrel" height={0.5} position={[-0.4, 0.17, 0.5]} />
        <PropModel
          id="crate"
          height={0.35}
          position={[0.35, 0.17, 0.2]}
          rotation={0.5}
        />
      </WithFallback>
    </group>
  );
}
