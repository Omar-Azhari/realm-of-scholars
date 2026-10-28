/**
 * Walls and roof for a walk-in building (see world/rooms.ts). From outside the
 * building is closed: four walls and a roof. Step inside and the roof lifts
 * away and the walls between the camera and the room drop to knee height, so
 * you can see in from any angle without the camera ever being changed.
 *
 * Coordinates are the room grid's own (the caller wraps this in the group
 * that places and turns the room on the island).
 */

import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** Inner floor rectangle, in room-grid units. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  height: number;
  /** The doorway in the front (+Z) wall: from x to x + width. */
  door: { x: number; width: number };
  insideRef: MutableRefObject<boolean>;
  inner: string;
  outer: string;
  roof: string;
  /** Things hung on a wall's inside (windows, a screen, lamps): hidden while that wall is dropped. */
  decor?: Partial<Record<"back" | "left" | "right", ReactNode>>;
}

const T = 0.22;
const LOW = 0.5;

interface WallSpec {
  key: string;
  /** Centre and size of the wall box. */
  x: number;
  z: number;
  sx: number;
  sz: number;
}

export function RoomWalls({
  x0,
  z0,
  x1,
  z1,
  height,
  door,
  insideRef,
  inner,
  outer,
  roof,
  decor,
}: Props) {
  const decorRefs = useRef<Partial<Record<string, THREE.Group | null>>>({});
  const walls = useMemo<WallSpec[]>(() => {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const w = x1 - x0 + T * 2;
    const list: WallSpec[] = [
      { key: "back", x: cx, z: z0 - T / 2, sx: w, sz: T },
      { key: "left", x: x0 - T / 2, z: cz, sx: T, sz: z1 - z0 },
      { key: "right", x: x1 + T / 2, z: cz, sx: T, sz: z1 - z0 },
    ];
    // The front wall, with a gap for the doorway.
    const a = door.x - (x0 - T);
    const b = x1 + T - (door.x + door.width);
    if (a > 0.01)
      list.push({
        key: "front-a",
        x: x0 - T + a / 2,
        z: z1 + T / 2,
        sx: a,
        sz: T,
      });
    if (b > 0.01)
      list.push({
        key: "front-b",
        x: door.x + door.width + b / 2,
        z: z1 + T / 2,
        sx: b,
        sz: T,
      });
    return list;
  }, [x0, z0, x1, z1, door.x, door.width]);

  const refs = useRef<Array<THREE.Group | null>>([]);
  const roofRef = useRef<THREE.Group>(null);
  const lintel = useRef<THREE.Mesh>(null);
  const center = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, delta) => {
    const inside = insideRef.current;
    const g0 = refs.current[0]?.parent;
    if (!g0) return;
    g0.localToWorld(center.set((x0 + x1) / 2, 0, (z0 + z1) / 2));
    toCam.set(camera.position.x - center.x, 0, camera.position.z - center.z);
    const k = Math.min(1, delta * 8);
    walls.forEach((wall, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.localToWorld(pos.set(0, 0, 0));
      // A wall faces the camera when it lies on the camera's side of the room.
      const facing =
        (pos.x - center.x) * toCam.x + (pos.z - center.z) * toCam.z > 0;
      const target = inside && facing ? LOW / height : 1;
      g.scale.y += (target - g.scale.y) * k;
      const hung = decorRefs.current[wall.key];
      if (hung) hung.visible = g.scale.y > 0.7;
    });
    if (roofRef.current) {
      const target = inside ? 0 : 1;
      const s =
        roofRef.current.scale.x + (target - roofRef.current.scale.x) * k;
      roofRef.current.scale.setScalar(Math.max(0.0001, s));
      roofRef.current.visible = s > 0.02;
    }
    if (lintel.current) lintel.current.visible = !inside;
  });

  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const rw = x1 - x0 + T * 2 + 0.6;
  const rd = z1 - z0 + T * 2 + 0.6;
  return (
    <group>
      {walls.map((wall, i) => (
        <group
          key={wall.key}
          ref={(g) => {
            refs.current[i] = g;
          }}
          position={[wall.x, 0, wall.z]}
        >
          {/* Inside face and outside face in their own colours; the box grows up from the floor. */}
          <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[wall.sx, height, wall.sz]} />
            <meshStandardMaterial color={outer} roughness={0.9} />
          </mesh>
          <mesh
            position={[
              wall.sx > wall.sz ? 0 : (wall.x < cx ? 1 : -1) * (T / 2 + 0.005),
              height / 2,
              wall.sx > wall.sz ? (wall.z < cz ? 1 : -1) * (T / 2 + 0.005) : 0,
            ]}
            rotation={[
              0,
              wall.sx > wall.sz
                ? wall.z < cz
                  ? 0
                  : Math.PI
                : wall.x < cx
                  ? Math.PI / 2
                  : -Math.PI / 2,
              0,
            ]}
          >
            <planeGeometry args={[Math.max(wall.sx, wall.sz), height]} />
            <meshStandardMaterial color={inner} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {(["back", "left", "right"] as const).map((key) =>
        decor?.[key] ? (
          <group
            key={`decor-${key}`}
            ref={(g) => {
              decorRefs.current[key] = g;
            }}
          >
            {decor[key]}
          </group>
        ) : null,
      )}
      {/* Over the doorway. */}
      <mesh
        ref={lintel}
        position={[door.x + door.width / 2, height - 0.35, z1 + T / 2]}
        castShadow
      >
        <boxGeometry args={[door.width, 0.7, T]} />
        <meshStandardMaterial color={outer} roughness={0.9} />
      </mesh>
      {/* A low pitched roof that lifts away when you're inside. */}
      <group ref={roofRef} position={[cx, height, cz]}>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[rw, 0.12, rd]} />
          <meshStandardMaterial color={roof} roughness={0.85} />
        </mesh>
        {/* A square pyramid (a 4-sided cone turned 45 degrees), stretched to the roof's shape. */}
        <group position={[0, 0.77, 0]} scale={[rw, 1, rd]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
            <cylinderGeometry args={[0.001, Math.SQRT1_2, 1.3, 4, 1]} />
            <meshStandardMaterial color={roof} roughness={0.85} flatShading />
          </mesh>
        </group>
      </group>
    </group>
  );
}
