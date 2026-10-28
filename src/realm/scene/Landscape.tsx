/**
 * The open country between the campus's places (see the "open country" section of
 * world/worldGen.ts): lamp posts along the main roads, hedges and fences lining some
 * of them, stone bridges over the creek, and the scenic landmarks (hilltop lookout,
 * ruins, windmill, bell tower, picnic lawn).
 *
 * Roadside dressing is instanced: a few draw calls for every lamp, hedge and fence
 * on the island. Landmarks are a handful of simple meshes each.
 *
 * Local frame for landmarks: origin = footprint centre, front faces +Z.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { groundHeight, mulberry32, type Bridge, type RoadsideRun, type World, type WorldObject } from "../world/worldGen";
import { surfaceMaterial } from "./textures";

const IRON = "#2b2a2e";
const temp = new THREE.Object3D();
const tint = new THREE.Color();

// ---------------------------------------------------------------------------
// Roadside dressing
// ---------------------------------------------------------------------------

function lampPostGeometry(): THREE.BufferGeometry {
  const base = new THREE.CylinderGeometry(0.2, 0.26, 0.16, 10);
  base.translate(0, 0.08, 0);
  const pole = new THREE.CylinderGeometry(0.055, 0.075, 2.7, 8);
  pole.translate(0, 1.45, 0);
  const cap = new THREE.ConeGeometry(0.26, 0.2, 4);
  cap.translate(0, 3.18, 0);
  return mergeGeometries([base, pole, cap])!;
}

function RoadLamps({ world, night }: { world: World; night: boolean }) {
  const lamps = useMemo(() => world.landscape?.lamps ?? [], [world]);
  const posts = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const postGeometry = useMemo(lampPostGeometry, []);
  const headGeometry = useMemo(() => {
    const g = new THREE.BoxGeometry(0.3, 0.38, 0.3);
    g.translate(0, 2.92, 0);
    return g;
  }, []);
  const postMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.5, metalness: 0.5 }), []);
  const headMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffb04a", emissiveIntensity: 0.6, toneMapped: false }), []);
  useEffect(() => {
    headMaterial.emissiveIntensity = night ? 3.2 : 0.6;
  }, [night, headMaterial]);
  useEffect(
    () => () => {
      postGeometry.dispose();
      headGeometry.dispose();
      postMaterial.dispose();
      headMaterial.dispose();
    },
    [postGeometry, headGeometry, postMaterial, headMaterial],
  );
  useLayoutEffect(() => {
    lamps.forEach((lamp, i) => {
      temp.position.set(lamp.x, groundHeight(world, lamp.x, lamp.z), lamp.z);
      temp.rotation.set(0, 0, 0);
      temp.scale.setScalar(1);
      temp.updateMatrix();
      posts.current?.setMatrixAt(i, temp.matrix);
      heads.current?.setMatrixAt(i, temp.matrix);
    });
    for (const m of [posts.current, heads.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [world, lamps]);
  if (lamps.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={posts} args={[postGeometry, postMaterial, lamps.length]} castShadow raycast={() => null} />
      <instancedMesh ref={heads} args={[headGeometry, headMaterial, lamps.length]} raycast={() => null} />
    </group>
  );
}

/** A clipped box hedge, one tile long, with a lumpy top (stretched along X per run). */
function hedgeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 0.9, 0.7, 6, 3, 3);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const welded = mergeVertices(g);
  const pos = welded.attributes.position as THREE.BufferAttribute;
  const random = mulberry32(4242);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const bump = 1 + (random() - 0.5) * 0.18;
    pos.setXYZ(i, pos.getX(i), (y + 0.45) * (y > 0.25 ? bump : 1), pos.getZ(i) * (y > -0.35 ? bump : 1));
  }
  welded.computeVertexNormals();
  return welded;
}

function Hedges({ world, runs }: { world: World; runs: RoadsideRun[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(hedgeGeometry, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    runs.forEach((run, i) => {
      temp.position.set(run.x, groundHeight(world, run.x, run.z) - 0.04, run.z);
      temp.rotation.set(0, run.rot, 0);
      temp.scale.set(run.len + 0.6, 1, 1);
      temp.updateMatrix();
      m.setMatrixAt(i, temp.matrix);
      m.setColorAt(i, tint.setRGB(0.2 + (i % 5) * 0.012, 0.36 + (i % 3) * 0.02, 0.15));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [world, runs]);
  if (runs.length === 0) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, runs.length]} castShadow receiveShadow raycast={() => null} />;
}

/** One tile of split-rail fence: a post at each end and two rails (stretched along X). */
function fenceGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.5, 0.5]) {
    const post = new THREE.BoxGeometry(0.1, 1.0, 0.1);
    post.translate(x, 0.5, 0);
    parts.push(post);
  }
  for (const y of [0.45, 0.8]) {
    const rail = new THREE.BoxGeometry(1.02, 0.08, 0.06);
    rail.translate(0, y, 0);
    parts.push(rail);
  }
  return mergeGeometries(parts)!;
}

function Fences({ world, runs }: { world: World; runs: RoadsideRun[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(fenceGeometry, []);
  const material = useMemo(() => surfaceMaterial("wood", 1, 0.3, "#8a6040"), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  /** Each run becomes whole one-tile sections. */
  const sections = useMemo(() => {
    const list: Array<{ x: number; z: number; rot: number; len: number }> = [];
    for (const run of runs) {
      const count = Math.max(1, Math.round(run.len));
      const unit = run.len / count;
      const dx = Math.cos(run.rot);
      const dz = -Math.sin(run.rot);
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) * unit - run.len / 2;
        list.push({ x: run.x + dx * t, z: run.z + dz * t, rot: run.rot, len: unit });
      }
    }
    return list;
  }, [runs]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    sections.forEach((s, i) => {
      temp.position.set(s.x, groundHeight(world, s.x, s.z) - 0.02, s.z);
      temp.rotation.set(0, s.rot, 0);
      temp.scale.set(s.len, 1, 1);
      temp.updateMatrix();
      m.setMatrixAt(i, temp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [world, sections]);
  if (sections.length === 0) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, sections.length]} castShadow raycast={() => null} />;
}

/** A stone bridge over the creek: a deck on the road, parapets, and arches showing on both faces. */
function StoneBridge({ world, bridge }: { world: World; bridge: Bridge }) {
  const stone = useMemo(() => surfaceMaterial("stone", 3, 1, "#cfc4b0"), []);
  const cap = useMemo(() => surfaceMaterial("stoneDark", 3, 0.3, "#a59a88"), []);
  const deck = useMemo(() => {
    const m = surfaceMaterial("cobble", 1.6, 2, "#c9b9a0");
    return m;
  }, []);
  const { length: L, width: W } = bridge;
  const y = groundHeight(world, bridge.x, bridge.z);
  return (
    <group position={[bridge.x, y, bridge.z]} rotation={[0, bridge.rot, 0]}>
      {/* Deck (local Z runs along the road). */}
      <mesh position={[0, 0.02, 0]} material={deck} receiveShadow raycast={() => null}>
        <boxGeometry args={[W - 0.5, 0.12, L]} />
      </mesh>
      {/* Body of the bridge, down into the water. */}
      <mesh position={[0, -0.42, 0]} material={stone} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[W, 0.8, L - 0.4]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Parapet and its capping. */}
          <mesh position={[side * (W / 2 - 0.15), 0.32, 0]} material={stone} castShadow raycast={() => null}>
            <boxGeometry args={[0.3, 0.6, L]} />
          </mesh>
          <mesh position={[side * (W / 2 - 0.15), 0.66, 0]} material={cap} castShadow raycast={() => null}>
            <boxGeometry args={[0.42, 0.1, L + 0.1]} />
          </mesh>
          {/* The arch's dark opening, on the face the creek flows out of. */}
          <mesh position={[side * (W / 2 + 0.01), -0.32, 0]} rotation={[0, (side * Math.PI) / 2, 0]} scale={[1, 0.28, 1]} raycast={() => null}>
            <circleGeometry args={[Math.min(1.6, L / 3), 24, 0, Math.PI]} />
            <meshStandardMaterial color="#1c2a30" roughness={0.6} />
          </mesh>
          {/* Corner piers. */}
          {[-1, 1].map((end) => (
            <mesh key={end} position={[side * (W / 2 - 0.15), 0.45, end * (L / 2 - 0.1)]} material={cap} castShadow raycast={() => null}>
              <boxGeometry args={[0.5, 0.95, 0.5]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Everything along the roads: lamps, hedges, fences and bridges. */
export function Landscape({ world, night }: { world: World; night: boolean }) {
  const land = world.landscape;
  if (!land) return null;
  return (
    <group>
      <RoadLamps world={world} night={night} />
      <Hedges world={world} runs={land.hedges} />
      <Fences world={world} runs={land.fences} />
      {land.bridges.map((b, i) => (
        <StoneBridge key={i} world={world} bridge={b} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

const BRASS = new THREE.MeshStandardMaterial({ color: "#c8a040", metalness: 0.85, roughness: 0.3 });

function SimpleBench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const wood = useMemo(() => surfaceMaterial("wood", 1, 0.4, "#8a5a34"), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} material={wood} castShadow>
        <boxGeometry args={[1.5, 0.07, 0.46]} />
      </mesh>
      <mesh position={[0, 0.76, -0.2]} rotation={[-0.12, 0, 0]} material={wood} castShadow>
        <boxGeometry args={[1.5, 0.4, 0.06]} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]} castShadow>
          <boxGeometry args={[0.07, 0.44, 0.4]} />
          <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Hilltop lookout: an octagonal stone platform with a railing, a brass telescope and a bench. */
function Lookout() {
  const stone = useMemo(() => surfaceMaterial("stone", 3, 0.6, "#d4cab8"), []);
  const wood = useMemo(() => surfaceMaterial("wood", 1, 1, "#6b4a2b"), []);
  const posts = useMemo(() => Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4 + Math.PI / 8), []);
  return (
    <group>
      <mesh position={[0, 0.25, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[1.45, 1.6, 0.5, 8]} />
      </mesh>
      {posts.map((a, k) =>
        k === 0 ? null : (
          <mesh key={k} position={[Math.sin(a) * 1.3, 0.95, Math.cos(a) * 1.3]} material={wood} castShadow>
            <boxGeometry args={[0.09, 0.9, 0.09]} />
          </mesh>
        ),
      )}
      <mesh position={[0, 1.38, 0]} rotation={[Math.PI / 2, 0, 0]} material={wood}>
        <torusGeometry args={[1.3, 0.045, 6, 32, Math.PI * 1.75]} />
      </mesh>
      {/* Telescope on a tripod, looking out over the island. */}
      <group position={[0.35, 0.5, -0.5]}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.18, 0.42, Math.cos(a) * 0.18]} rotation={[Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]} material={wood}>
            <cylinderGeometry args={[0.025, 0.03, 0.9, 6]} />
          </mesh>
        ))}
        <group position={[0, 0.92, 0]} rotation={[0.45, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={BRASS} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 1.0, 12]} />
          </mesh>
          <mesh position={[0, 0, -0.52]} rotation={[Math.PI / 2, 0, 0]} material={BRASS}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 12]} />
          </mesh>
        </group>
      </group>
      <SimpleBench position={[-0.45, 0.5, 0.45]} rotation={Math.PI * 0.85} />
    </group>
  );
}

/** Ruins: a cracked floor, broken columns of different heights, a surviving arch, a fallen drum. */
function Ruins() {
  const stone = useMemo(() => surfaceMaterial("stone", 1, 2, "#cbc3b2"), []);
  const floor = useMemo(() => surfaceMaterial("stoneDark", 3, 3, "#a69d8c"), []);
  const moss = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4f6e32", roughness: 1 }), []);
  const columns: Array<[number, number, number]> = [
    [-1.45, -1.45, 2.8],
    [0, -1.6, 2.8],
    [1.45, -1.45, 1.3],
    [-1.6, 0.2, 1.9],
    [1.6, 0.3, 0.7],
    [-1.3, 1.45, 1.1],
    [1.35, 1.4, 2.2],
  ];
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={floor} receiveShadow castShadow>
        <boxGeometry args={[3.9, 0.2, 3.9]} />
      </mesh>
      {columns.map(([x, z, h], k) => (
        <group key={k} position={[x, 0.2, z]}>
          <mesh position={[0, h / 2, 0]} material={stone} castShadow>
            <cylinderGeometry args={[0.2, 0.24, h, 10]} />
          </mesh>
          <mesh position={[0, 0.1, 0]} material={stone} castShadow>
            <boxGeometry args={[0.6, 0.2, 0.6]} />
          </mesh>
          {h > 2.5 ? (
            <mesh position={[0, h + 0.1, 0]} material={stone} castShadow>
              <boxGeometry args={[0.55, 0.2, 0.55]} />
            </mesh>
          ) : (
            <mesh position={[0.05, h + 0.02, 0]} scale={[1, 0.35, 1]} material={moss}>
              <sphereGeometry args={[0.24, 8, 6]} />
            </mesh>
          )}
        </group>
      ))}
      {/* The arch still standing between the two tall columns at the back. */}
      <mesh position={[-0.72, 3.15, -1.52]} rotation={[0, 0.05, 0]} material={stone} castShadow>
        <boxGeometry args={[2.0, 0.32, 0.5]} />
      </mesh>
      {/* A fallen column drum. */}
      <mesh position={[0.3, 0.42, 0.4]} rotation={[0, 0.7, Math.PI / 2]} material={stone} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 1.4, 10]} />
      </mesh>
      <mesh position={[-0.4, 0.22, -0.2]} scale={[1.4, 0.25, 1]} material={moss}>
        <sphereGeometry args={[0.35, 8, 6]} />
      </mesh>
    </group>
  );
}

/** One blade of a windmill sail: spar plus canvas, built once. */
function sailGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const spar = new THREE.BoxGeometry(0.08, 2.5, 0.08);
    spar.translate(0, 1.35, 0);
    const sail = new THREE.BoxGeometry(0.55, 1.9, 0.03);
    sail.translate(0.32, 1.55, 0.02);
    const blade = mergeGeometries([spar, sail])!;
    blade.rotateZ((k * Math.PI) / 2);
    blades.push(blade);
  }
  return mergeGeometries(blades)!;
}

/** Old windmill: a tapered stone tower, a cap, and sails that turn. */
function Windmill() {
  const plaster = useMemo(() => surfaceMaterial("plaster", 2, 3, "#ece2cc"), []);
  const roof = useMemo(() => surfaceMaterial("roof", 2, 1, "#5a3a2a"), []);
  const sails = useRef<THREE.Group>(null);
  const sailGeom = useMemo(sailGeometry, []);
  useEffect(() => () => sailGeom.dispose(), [sailGeom]);
  const sailMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3ead6", roughness: 0.9 }), []);
  useEffect(() => () => sailMaterial.dispose(), [sailMaterial]);
  useFrame((_, delta) => {
    if (sails.current) sails.current.rotation.z += delta * 0.7;
  });
  return (
    <group>
      <mesh position={[0, 2.6, 0]} material={plaster} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.4, 5.2, 14]} />
      </mesh>
      <mesh position={[0, 5.75, 0]} material={roof} castShadow>
        <coneGeometry args={[1.25, 1.4, 14]} />
      </mesh>
      <mesh position={[0, 0.8, 1.38]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[0.7, 1.4]} />
        <meshStandardMaterial color="#3a2414" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.3, 1.12]}>
        <planeGeometry args={[0.45, 0.6]} />
        <meshStandardMaterial color="#2a2014" emissive="#ffcf6a" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 4.75, 1.05]} rotation={[Math.PI / 2, 0, 0]} material={roof}>
        <cylinderGeometry args={[0.14, 0.14, 0.5, 10]} />
      </mesh>
      <group ref={sails} position={[0, 4.75, 1.35]}>
        <mesh geometry={sailGeom} material={sailMaterial} castShadow />
      </group>
    </group>
  );
}

/** Bell tower: a square stone tower, clock faces, an open belfry with a bronze bell, a spire. */
function BellTower() {
  const stone = useMemo(() => surfaceMaterial("stone", 1.5, 5, "#d6ccb8"), []);
  const cap = useMemo(() => surfaceMaterial("stoneDark", 1.5, 0.4, "#a39a8a"), []);
  const roof = useMemo(() => surfaceMaterial("roof", 2, 2, "#3f5a7a"), []);
  const bell = useMemo(() => {
    const points = [
      [0.0, 0.0],
      [0.42, 0.0],
      [0.38, 0.08],
      [0.3, 0.3],
      [0.26, 0.62],
      [0.16, 0.72],
      [0.0, 0.74],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(points, 18);
  }, []);
  useEffect(() => () => bell.dispose(), [bell]);
  return (
    <group>
      <mesh position={[0, 3.3, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[2.3, 6.6, 2.3]} />
      </mesh>
      <mesh position={[0, 6.7, 0]} material={cap} castShadow>
        <boxGeometry args={[2.6, 0.25, 2.6]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 1.0, 7.65, sz * 1.0]} material={stone} castShadow>
            <boxGeometry args={[0.36, 1.7, 0.36]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 8.6, 0]} material={cap} castShadow>
        <boxGeometry args={[2.5, 0.25, 2.5]} />
      </mesh>
      <mesh geometry={bell} position={[0, 7.3, 0]} material={BRASS} castShadow />
      <mesh position={[0, 9.75, 0]} rotation={[0, Math.PI / 4, 0]} material={roof} castShadow>
        <coneGeometry args={[1.8, 2.1, 4]} />
      </mesh>
      {/* Clock faces on all four sides. */}
      {[0, 1, 2, 3].map((k) => (
        <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
          <mesh position={[0, 5.4, 1.16]}>
            <circleGeometry args={[0.6, 28]} />
            <meshStandardMaterial color="#f6efdc" emissive="#fff3c8" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0.12, 5.48, 1.17]} rotation={[0, 0, -0.9]}>
            <boxGeometry args={[0.05, 0.38, 0.01]} />
            <meshStandardMaterial color="#1c1c1c" />
          </mesh>
          <mesh position={[-0.08, 5.36, 1.17]} rotation={[0, 0, 0.9]}>
            <boxGeometry args={[0.05, 0.26, 0.01]} />
            <meshStandardMaterial color="#1c1c1c" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.85, 1.16]}>
        <planeGeometry args={[0.8, 1.7]} />
        <meshStandardMaterial color="#3a2414" roughness={0.8} />
      </mesh>
    </group>
  );
}

let checkerTexture: THREE.CanvasTexture | null = null;
/** A red-and-white check, for the picnic blanket. */
function checker(): THREE.CanvasTexture {
  if (checkerTexture) return checkerTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#c8302e" : "#f6efe2";
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
  }
  checkerTexture = new THREE.CanvasTexture(canvas);
  checkerTexture.colorSpace = THREE.SRGBColorSpace;
  checkerTexture.magFilter = THREE.NearestFilter;
  return checkerTexture;
}

function PicnicTable({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const wood = useMemo(() => surfaceMaterial("wood", 1, 0.5, "#a0703f"), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.75, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.07, 0.75]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.44, side * 0.62]} material={wood} castShadow>
          <boxGeometry args={[1.7, 0.06, 0.28]} />
        </mesh>
      ))}
      {[-0.65, 0.65].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, 0.37, side * 0.3]} rotation={[side * 0.55, 0, 0]} material={wood} castShadow>
              <boxGeometry args={[0.08, 0.86, 0.08]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Picnic lawn: two tables, a checked blanket with a basket, and a striped parasol. */
function Picnic() {
  const blanket = useMemo(() => new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.95 }), []);
  useEffect(() => () => blanket.dispose(), [blanket]);
  return (
    <group>
      <PicnicTable position={[-0.75, 0, -0.1]} rotation={0.15} />
      <PicnicTable position={[0.95, 0, 0.2]} rotation={Math.PI / 2 - 0.1} />
      <mesh position={[-0.6, 0.02, 0.75]} rotation={[-Math.PI / 2, 0, 0.3]} material={blanket} receiveShadow>
        <planeGeometry args={[1.3, 0.9]} />
      </mesh>
      <mesh position={[-0.45, 0.14, 0.75]} castShadow>
        <cylinderGeometry args={[0.16, 0.13, 0.24, 10]} />
        <meshStandardMaterial color="#9a6a3a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.45, 0.28, 0.75]} rotation={[0, 0.3, 0]}>
        <torusGeometry args={[0.13, 0.015, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#7a5028" />
      </mesh>
      <group position={[0.1, 0, -0.35]}>
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.3, 6]} />
          <meshStandardMaterial color="#e8e2d4" />
        </mesh>
        <mesh position={[0, 2.25, 0]} castShadow>
          <coneGeometry args={[1.15, 0.45, 8, 1, true]} />
          <meshStandardMaterial color="#e8731f" side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/** Draws a scenic landmark object (kind "scenery"). */
export function SceneryLandmark({ object }: { object: WorldObject }) {
  switch (object.scenery) {
    case "lookout":
      return <Lookout />;
    case "ruins":
      return <Ruins />;
    case "windmill":
      return <Windmill />;
    case "bell-tower":
      return <BellTower />;
    case "picnic":
      return <Picnic />;
    default:
      return null;
  }
}
