/**
 * Buildings and stations. Built from primitives, but every wall carries a
 * stone-brick texture, roofs carry tiles, wood carries grain, and towers
 * are round — so the world reads as crafted architecture, not blocks.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh, PointLight } from "three";
import type { RegionTheme } from "../types";
import { THEME_STYLES } from "../world/themes";
import { surfaceMaterial, type SurfaceKind } from "./textures";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const boxCache = new Map<string, THREE.BufferGeometry>();
/** Bevelled box: edges catch the light instead of reading as sharp CG cubes. */
function bevelBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = boxCache.get(key);
  if (!g) {
    const radius = Math.min(0.06, Math.min(w, h, d) * 0.22);
    g = new RoundedBoxGeometry(w, h, d, 2, radius);
    boxCache.set(key, g);
  }
  return g;
}

/** A natural standing stone: a welded, jittered dodecahedron stretched upright. */
const stoneCache = new Map<number, THREE.BufferGeometry>();
function standingStoneGeometry(seed: number): THREE.BufferGeometry {
  const hit = stoneCache.get(seed);
  if (hit) return hit;
  const g = new THREE.DodecahedronGeometry(0.5, 1);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const welded = mergeVertices(g);
  const pos = welded.attributes.position as THREE.BufferAttribute;
  let a = seed * 9301 + 49297;
  const rnd = () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  for (let i = 0; i < pos.count; i++) {
    const o = 0.85 + rnd() * 0.3;
    pos.setXYZ(i, pos.getX(i) * o * 0.42, pos.getY(i) * o * 1.25 + 0.6, pos.getZ(i) * o * 0.32);
  }
  welded.computeVertexNormals();
  stoneCache.set(seed, welded);
  return welded;
}

type Vec3 = [number, number, number];

const STONE = "#c9c2b4";
const STONE_DARK = "#8f887c";
const SLATE = "#7f93b5";
const WOOD = "#a87a50";

function plain(color: string, emissive?: string, intensity = 0.9): JSX.Element {
  return <meshStandardMaterial color={color} roughness={0.8} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? intensity : 0} />;
}

function Box({ p, s, c, r, e, tex }: { p: Vec3; s: Vec3; c: string; r?: Vec3; e?: string; tex?: SurfaceKind }) {
  const material = useMemo(() => (tex ? surfaceMaterial(tex, Math.max(s[0], s[2]) / 1.4, s[1] / 1.4, c) : null), [tex, s, c]);
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow material={material ?? undefined} geometry={bevelBox(s[0], s[1], s[2])}>
      {material ? null : plain(c, e)}
    </mesh>
  );
}

function Cyl({ p, rt, rb, h, seg = 24, c, r, e, tex }: { p: Vec3; rt: number; rb: number; h: number; seg?: number; c: string; r?: Vec3; e?: string; tex?: SurfaceKind }) {
  const material = useMemo(() => (tex ? surfaceMaterial(tex, (Math.PI * 2 * Math.max(rt, rb)) / 1.4, h / 1.4, c) : null), [tex, rt, rb, h, c]);
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow material={material ?? undefined}>
      <cylinderGeometry args={[rt, rb, h, seg]} />
      {material ? null : plain(c, e)}
    </mesh>
  );
}

function Cone({ p, rad, h, seg = 24, c, r, tex = "roof" }: { p: Vec3; rad: number; h: number; seg?: number; c: string; r?: Vec3; tex?: SurfaceKind | null }) {
  const material = useMemo(() => (tex ? surfaceMaterial(tex, (Math.PI * 2 * rad) / 1.2, Math.hypot(rad, h) / 1.2, c) : null), [tex, rad, h, c]);
  return (
    <mesh position={p} rotation={r} castShadow material={material ?? undefined}>
      <coneGeometry args={[rad, h, seg, 3]} />
      {material ? null : plain(c)}
    </mesh>
  );
}

/** Gabled roof: a triangular prism along X. */
function GableRoof({ p, w, d, h, c }: { p: Vec3; w: number; d: number; h: number; c: string }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2 - 0.15, 0);
    shape.lineTo(d / 2 + 0.15, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: w + 0.3, bevelEnabled: false });
    g.translate(0, 0, -(w + 0.3) / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [w, d, h]);
  const material = useMemo(() => surfaceMaterial("roof", w / 1.0, Math.hypot(d / 2, h) / 1.0, c), [w, d, h, c]);
  return <mesh geometry={geometry} position={p} material={material} castShadow receiveShadow />;
}

/** Arched doorway (dark recess + wooden doors + stone arch). */
function Doorway({ p, w = 0.9, h = 1.5, rot = 0 }: { p: Vec3; w?: number; h?: number; rot?: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, h / 2 - 0.1, -0.02]} s={[w, h - 0.2, 0.06]} c="#5e3c22" tex="wood" />
      <mesh position={[0, h - 0.2, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[w / 2, w / 2, 0.06, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#5e3c22" roughness={0.8} />
      </mesh>
      <mesh position={[0, h - 0.2, 0.02]} rotation={[0, 0, 0]}>
        <torusGeometry args={[w / 2 + 0.06, 0.07, 8, 20, Math.PI]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
      </mesh>
      <Box p={[0, h * 0.45, 0.02]} s={[0.03, h * 0.75, 0.02]} c="#2a1a0e" />
      <mesh position={[w * 0.22, h * 0.42, 0.03]}>
        <torusGeometry args={[0.04, 0.012, 6, 12]} />
        <meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Window({ p, rot = 0, glow, w = 0.32, h = 0.55 }: { p: Vec3; rot?: number; glow: string; w?: number; h?: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0, 0]} s={[w + 0.1, h + 0.1, 0.05]} c={STONE_DARK} />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#3a2a14" emissive={glow} emissiveIntensity={1.1} roughness={0.4} />
      </mesh>
      <Box p={[0, 0, 0.04]} s={[0.025, h, 0.02]} c="#2a1a0e" />
      <Box p={[0, 0, 0.04]} s={[w, 0.025, 0.02]} c="#2a1a0e" />
    </group>
  );
}

function RingWindows({ y, radius, count, color }: { y: number; radius: number; count: number; color: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return <Window key={i} p={[Math.sin(a) * radius, y, Math.cos(a) * radius]} rot={a} glow={color} w={0.22} h={0.42} />;
      })}
    </>
  );
}

function Banner({ p, color, h = 1.1, w = 0.5 }: { p: Vec3; color: string; h?: number; w?: number }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 4, 8);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -h / 2 + 0.01) pos.setY(i, y - (Math.abs(pos.getX(i)) < 0.01 ? 0.12 : 0));
    }
    g.translate(0, -h / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [h, w]);
  const base = useMemo(() => geometry.attributes.position.array.slice(), [geometry]);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const t = state.clock.elapsedTime * 1.6 + p[0];
    for (let i = 0; i < pos.count; i++) {
      const y = base[i * 3 + 1];
      pos.setZ(i, Math.sin(t + y * 3) * 0.05 * (-y / h));
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={p}>
      <Cyl p={[0, 0.02, 0]} rt={0.025} rb={0.025} h={w + 0.15} c="#6b4a2b" r={[0, 0, Math.PI / 2]} seg={8} />
      <mesh ref={ref} geometry={geometry} position={[0, 0, 0.02]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -h * 0.45, 0.04]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.13, 0.13, 0.01]} />
        <meshStandardMaterial color="#e8c35a" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Torch({ p, light: withLight = false }: { p: Vec3; light?: boolean }) {
  const light = useRef<PointLight>(null);
  const flame = useRef<Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 9 + p[0] * 3;
    const f = 0.85 + Math.sin(t) * 0.08 + Math.sin(t * 2.3) * 0.06;
    if (light.current) light.current.intensity = 2.4 * f;
    if (flame.current) flame.current.scale.set(1, f * 1.1, 1);
  });
  return (
    <group position={p}>
      <Cyl p={[0, 0, 0]} rt={0.03} rb={0.02} h={0.32} c="#3a2a1a" seg={8} />
      <Cyl p={[0, 0.17, 0]} rt={0.06} rb={0.04} h={0.06} c="#2a2a2a" seg={10} />
      <mesh ref={flame} position={[0, 0.27, 0]}>
        <coneGeometry args={[0.05, 0.16, 10]} />
        <meshStandardMaterial color="#ffcf6a" emissive="#ff8a2a" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {withLight ? <pointLight ref={light} position={[0, 0.35, 0.1]} color="#ffa04a" distance={4.5} intensity={2.4} decay={1.6} /> : null}
    </group>
  );
}

/** The central castle. Local origin = footprint centre, gate faces +Z. */
export function Citadel({ bannerA = "#8a1f2b", bannerB = "#1f3f8a" }: { bannerA?: string; bannerB?: string }) {
  const towers: Array<[number, number]> = [
    [-3, -2.6],
    [3, -2.6],
    [-3, 2.3],
    [3, 2.3],
  ];
  return (
    <group>
      <Box p={[0, 0.12, 0]} s={[7.2, 0.24, 6.2]} c={STONE_DARK} tex="stoneDark" />
      {/* Keep */}
      <Box p={[0, 2.0, -0.4]} s={[4.6, 3.8, 3.6]} c={STONE} tex="stone" />
      <GableRoof p={[0, 3.9, -0.4]} w={4.4} d={3.6} h={1.7} c={SLATE} />
      {Array.from({ length: 8 }, (_, i) => (
        <Window key={`kw${i}`} p={[-1.75 + (i % 4) * 1.17, i < 4 ? 2.4 : 3.35, 1.41]} glow="#ffcf6a" w={0.26} h={0.5} />
      ))}
      {/* Great hall wing with gate */}
      <Box p={[0, 1.2, 1.9]} s={[3.2, 2.4, 1.5]} c={STONE} tex="stone" />
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={`cr${i}`} p={[-1.5 + i * 0.5, 2.55, 2.6]} s={[0.28, 0.3, 0.26]} c={STONE} tex="stone" />
      ))}
      <Doorway p={[0, 0.24, 2.66]} w={1.1} h={1.75} />
      <Torch p={[-0.85, 1.3, 2.75]} light />
      <Torch p={[0.85, 1.3, 2.75]} light />
      <Box p={[0, 0.1, 3.0]} s={[1.8, 0.2, 0.7]} c={STONE_DARK} tex="stoneDark" />
      {/* Round corner towers */}
      {towers.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl p={[0, 2.6, 0]} rt={0.8} rb={0.92} h={5.2} c={STONE} tex="stone" />
          <Cyl p={[0, 5.3, 0]} rt={0.98} rb={0.98} h={0.24} c={STONE_DARK} tex="stoneDark" />
          <Cone p={[0, 6.35, 0]} rad={1.08} h={1.9} c={SLATE} />
          <RingWindows y={3.6} radius={0.84} count={4} color="#ffcf6a" />
          <Cyl p={[0, 7.6, 0]} rt={0.02} rb={0.02} h={0.9} c="#6b4a2b" seg={6} />
          <Banner p={[0.28, 8.0, 0]} color={i % 2 === 0 ? bannerA : bannerB} h={0.5} w={0.5} />
        </group>
      ))}
      <Banner p={[-1.9, 2.3, 2.66]} color={bannerA} h={1.3} />
      <Banner p={[1.9, 2.3, 2.66]} color={bannerB} h={1.3} />
    </group>
  );
}

type Style = (typeof THEME_STYLES)[RegionTheme];

function ArcaneSpire({ style }: { style: Style }) {
  const crystal = useRef<Mesh>(null);
  useFrame((state) => {
    if (crystal.current) {
      crystal.current.rotation.y = state.clock.elapsedTime * 0.8;
      crystal.current.position.y = 8.5 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
    }
  });
  return (
    <group>
      <Cyl p={[0, 0.3, 0]} rt={2.3} rb={2.45} h={0.6} c={STONE_DARK} tex="stoneDark" />
      <Cyl p={[0, 3.4, 0]} rt={1.15} rb={1.6} h={5.8} c={style.wall} tex="stone" />
      <Cyl p={[0, 6.4, 0]} rt={1.35} rb={1.35} h={0.25} c={STONE_DARK} tex="stoneDark" />
      <Cone p={[0, 7.4, 0]} rad={1.55} h={2.4} c={style.roof} />
      <RingWindows y={2.6} radius={1.5} count={6} color={style.glow} />
      <RingWindows y={4.8} radius={1.3} count={6} color={style.glow} />
      <Doorway p={[0, 0.6, 1.5]} w={0.8} h={1.4} />
      <mesh ref={crystal} position={[0, 8.5, 0]}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color={style.accent} emissive={style.glow} emissiveIntensity={2.5} toneMapped={false} roughness={0.2} />
      </mesh>
      <pointLight position={[0, 8.5, 0]} color={style.glow} intensity={8} distance={9} />
    </group>
  );
}

function Guildhall({ style }: { style: Style }) {
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[4.8, 0.3, 4.0]} c={STONE_DARK} tex="stoneDark" />
      <Box p={[0, 0.95, 0]} s={[4.4, 1.3, 3.6]} c={style.wall} tex="stone" />
      <Box p={[0, 2.25, 0]} s={[4.5, 1.3, 3.7]} c="#e6dcc4" tex="plaster" />
      {[-2.2, -1.1, 0, 1.1, 2.2].map((x) => (
        <Box key={x} p={[x, 2.25, 1.86]} s={[0.14, 1.3, 0.08]} c={WOOD} tex="wood" />
      ))}
      <Box p={[0, 2.9, 1.86]} s={[4.5, 0.12, 0.09]} c={WOOD} tex="wood" />
      <Box p={[0, 1.62, 1.86]} s={[4.5, 0.12, 0.09]} c={WOOD} tex="wood" />
      <GableRoof p={[0, 2.9, 0]} w={4.6} d={3.8} h={1.7} c={style.roof} />
      <Doorway p={[0, 0.3, 1.81]} w={1.0} h={1.5} />
      <Window p={[-1.5, 2.3, 1.88]} glow={style.glow} />
      <Window p={[1.5, 2.3, 1.88]} glow={style.glow} />
      <Window p={[-1.5, 1.0, 1.81]} glow={style.glow} />
      <Window p={[1.5, 1.0, 1.81]} glow={style.glow} />
      <Banner p={[0, 3.6, 1.95]} color={style.accent} h={0.9} />
      <Box p={[1.7, 0.55, 2.4]} s={[0.5, 0.5, 0.5]} c={WOOD} tex="wood" />
      <Box p={[2.1, 0.5, 2.6]} s={[0.4, 0.4, 0.4]} c={WOOD} tex="wood" />
      <Cyl p={[-1.8, 0.6, 2.5]} rt={0.24} rb={0.28} h={0.6} c={WOOD} tex="wood" />
    </group>
  );
}

function ArtisansForge({ style }: { style: Style }) {
  const glow = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  useFrame((state) => {
    const f = 1.1 + Math.sin(state.clock.elapsedTime * 7) * 0.25 + Math.sin(state.clock.elapsedTime * 13) * 0.1;
    if (glow.current) (glow.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 * f;
    if (light.current) light.current.intensity = 5 * f;
  });
  return (
    <group>
      <Box p={[0, 1.3, -0.4]} s={[4.2, 2.6, 3]} c={style.wall} tex="stone" />
      <GableRoof p={[0, 2.6, -0.4]} w={4.2} d={3.0} h={1.4} c={style.roof} />
      <Box p={[1.3, 3.6, -1.2]} s={[0.7, 2.6, 0.7]} c={STONE_DARK} tex="stoneDark" />
      <Box p={[0, 2.0, 1.6]} s={[4.2, 0.12, 1.5]} c={WOOD} r={[-0.18, 0, 0]} tex="wood" />
      <Cyl p={[-1.9, 1.0, 2.25]} rt={0.08} rb={0.09} h={2.0} seg={10} c={WOOD} tex="wood" />
      <Cyl p={[1.9, 1.0, 2.25]} rt={0.08} rb={0.09} h={2.0} seg={10} c={WOOD} tex="wood" />
      <Box p={[-0.6, 0.45, 1.5]} s={[0.9, 0.9, 0.9]} c={STONE_DARK} tex="stoneDark" />
      <mesh ref={glow} position={[-0.6, 0.92, 1.5]}>
        <boxGeometry args={[0.6, 0.06, 0.6]} />
        <meshStandardMaterial color="#3a1a0a" emissive={style.glow} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[-0.6, 1.5, 1.7]} color={style.glow} intensity={5} distance={7} />
      <Box p={[0.9, 0.3, 1.6]} s={[0.3, 0.6, 0.3]} c={STONE_DARK} tex="stoneDark" />
      <mesh position={[0.9, 0.66, 1.6]} castShadow>
        <boxGeometry args={[0.7, 0.14, 0.32]} />
        <meshStandardMaterial color="#4a4a52" metalness={0.8} roughness={0.35} />
      </mesh>
      <Doorway p={[0, 0, 1.11]} w={0.9} h={1.5} />
      <Banner p={[1.8, 2.4, 0.95]} color={style.accent} h={0.8} />
    </group>
  );
}

function VerdantGrove({ style }: { style: Style }) {
  const stones = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2);
  return (
    <group>
      <Cyl p={[0, 1.7, 0]} rt={0.55} rb={0.95} h={3.4} seg={14} c="#7a5a3c" tex="bark" />
      {[
        [0, 4.4, 0, 2.3],
        [1.2, 3.6, 0.7, 1.4],
        [-1.1, 3.8, -0.8, 1.5],
        [0.3, 5.6, -0.2, 1.4],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 2]} />
          <meshStandardMaterial color={i % 2 ? "#3f8034" : "#356f2c"} roughness={0.9} />
        </mesh>
      ))}
      <Doorway p={[0, 0, 0.9]} w={0.6} h={1.2} />
      <Window p={[0.35, 2.4, 0.78]} glow={style.glow} w={0.22} h={0.3} />
      {stones.map((a, i) => (
        <mesh key={i} geometry={standingStoneGeometry(i + 11)} material={surfaceMaterial("stone", 0.8, 1, STONE)} position={[Math.sin(a) * 2.3, 0, Math.cos(a) * 2.3]} rotation={[0, a, 0.04]} scale={[1.1, 1.3, 1.1]} castShadow />
      ))}
    </group>
  );
}

function OldArchive({ style }: { style: Style }) {
  return (
    <group>
      <Box p={[0, 0.2, 0.2]} s={[4.6, 0.4, 4]} c={STONE_DARK} tex="stoneDark" />
      <Box p={[0.0, 0.5, 2.05]} s={[2.4, 0.2, 0.5]} c={STONE_DARK} tex="stoneDark" />
      <Box p={[0, 1.7, -0.4]} s={[4.2, 2.6, 2.8]} c={style.wall} tex="stone" />
      {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
        <group key={x}>
          <Cyl p={[x, 1.55, 1.55]} rt={0.17} rb={0.2} h={2.3} seg={18} c={style.wall} tex="plaster" />
          <Box p={[x, 2.75, 1.55]} s={[0.46, 0.12, 0.46]} c={style.wall} tex="plaster" />
          <Box p={[x, 0.45, 1.55]} s={[0.46, 0.12, 0.46]} c={style.wall} tex="plaster" />
        </group>
      ))}
      <Box p={[0, 2.95, 1.2]} s={[4.4, 0.3, 1.3]} c={style.wall} tex="plaster" />
      <GableRoof p={[0, 3.1, 0.2]} w={4.4} d={4.0} h={0.9} c={style.roof} />
      <Doorway p={[0, 0.4, 0.98]} w={0.9} h={1.6} />
      <Window p={[-1.35, 1.7, 0.98]} glow={style.glow} w={0.4} h={0.8} />
      <Window p={[1.35, 1.7, 0.98]} glow={style.glow} w={0.4} h={0.8} />
      <Banner p={[0, 3.0, 1.88]} color="#5a1f2b" h={0.6} />
    </group>
  );
}

function ClockworkFoundry({ style }: { style: Style }) {
  const gear = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (gear.current) gear.current.rotation.z += delta * 0.6;
  });
  return (
    <group>
      <Box p={[0, 1.3, -0.3]} s={[4.2, 2.6, 3.2]} c={style.wall} tex="stone" />
      <Cyl p={[-1.3, 3.3, -0.9]} rt={0.42} rb={0.55} h={3.2} c={STONE_DARK} tex="stoneDark" />
      <Cyl p={[1.2, 3.0, -1.0]} rt={0.33} rb={0.45} h={2.6} c={STONE_DARK} tex="stoneDark" />
      <GableRoof p={[0, 2.6, -0.3]} w={4.2} d={3.2} h={1.0} c={style.roof} />
      <mesh ref={gear} position={[0, 2.05, 1.38]} castShadow>
        <torusGeometry args={[0.6, 0.15, 10, 12]} />
        <meshStandardMaterial color={style.accent} metalness={0.85} roughness={0.35} />
      </mesh>
      <Cyl p={[0, 2.05, 1.38]} rt={0.18} rb={0.18} h={0.2} c="#5a5a62" r={[Math.PI / 2, 0, 0]} />
      <Doorway p={[0, 0, 1.31]} w={0.9} h={1.45} />
      <Window p={[-1.45, 1.5, 1.33]} glow={style.glow} w={0.5} h={0.45} />
      <Window p={[1.45, 1.5, 1.33]} glow={style.glow} w={0.5} h={0.45} />
    </group>
  );
}

function Lighthouse({ style }: { style: Style }) {
  const lamp = useRef<Mesh>(null);
  useFrame((state) => {
    if (lamp.current) lamp.current.rotation.y = state.clock.elapsedTime * 1.2;
  });
  return (
    <group>
      <Cyl p={[0, 0.3, 0]} rt={2.2} rb={2.45} h={0.6} c={STONE_DARK} tex="stoneDark" />
      {[0, 1, 2, 3].map((i) => (
        <Cyl key={i} p={[0, 1.35 + i * 1.5, 0]} rt={1.15 - i * 0.12 - 0.06} rb={1.15 - i * 0.12} h={1.5} c={i % 2 === 0 ? style.wall : style.roof} tex="plaster" />
      ))}
      <Cyl p={[0, 6.6, 0]} rt={0.85} rb={0.85} h={0.15} c={STONE_DARK} />
      <mesh ref={lamp} position={[0, 7.1, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.8, 16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#ffe08a" emissiveIntensity={2.4} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <Cone p={[0, 7.85, 0]} rad={0.75} h={0.8} c={style.roof} />
      <pointLight position={[0, 7.1, 0]} color="#ffe08a" intensity={10} distance={12} />
      <Doorway p={[0, 0.6, 1.12]} w={0.6} h={1.2} />
    </group>
  );
}

function AlchemistsDome({ style }: { style: Style }) {
  const domeMaterial = useMemo(() => surfaceMaterial("roof", 6, 2, style.roof), [style.roof]);
  return (
    <group>
      <Cyl p={[0, 1.15, 0]} rt={2.0} rb={2.1} h={2.3} c={style.wall} tex="stone" />
      <mesh position={[0, 2.3, 0]} castShadow material={domeMaterial}>
        <sphereGeometry args={[2.05, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Cyl p={[0, 4.5, 0]} rt={0.2} rb={0.3} h={0.5} c={STONE_DARK} />
      <mesh position={[0, 4.95, 0]}>
        <sphereGeometry args={[0.28, 20, 14]} />
        <meshStandardMaterial color={style.accent} emissive={style.glow} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <RingWindows y={1.35} radius={2.03} count={8} color={style.glow} />
      <Doorway p={[0, 0, 2.05]} w={0.8} h={1.45} />
      <Cyl p={[1.6, 0.35, 2.0]} rt={0.18} rb={0.3} h={0.7} c="#5a8a7a" />
      <pointLight position={[0, 4.95, 0]} color={style.glow} intensity={4} distance={8} />
    </group>
  );
}

export function Landmark({ theme }: { theme: RegionTheme }) {
  const style = THEME_STYLES[theme];
  switch (theme) {
    case "arcane":
      return <ArcaneSpire style={style} />;
    case "guild":
      return <Guildhall style={style} />;
    case "forge":
      return <ArtisansForge style={style} />;
    case "grove":
      return <VerdantGrove style={style} />;
    case "archive":
      return <OldArchive style={style} />;
    case "foundry":
      return <ClockworkFoundry style={style} />;
    case "tide":
      return <Lighthouse style={style} />;
    case "alchemy":
      return <AlchemistsDome style={style} />;
  }
}

export function Waystone({ theme, studied, mastered, weak = false }: { theme: RegionTheme; studied: boolean; mastered: boolean; weak?: boolean }) {
  const style = THEME_STYLES[theme];
  const rune = useRef<Mesh>(null);
  useFrame((state) => {
    if (rune.current) {
      const m = rune.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = weak ? 2.6 + Math.sin(state.clock.elapsedTime * 5) * 1.2 : (studied ? 2.2 : 0.6) + Math.sin(state.clock.elapsedTime * 2 + rune.current.id) * 0.3;
    }
  });
  // A weak week (answers mostly wrong) pulses red until it's revised.
  const glow = weak ? "#ff3a2a" : mastered ? "#ffd45a" : studied ? style.glow : "#6a8a9a";
  return (
    <group>
      <Box p={[0, 0.08, 0]} s={[0.78, 0.16, 0.78]} c={STONE_DARK} tex="stoneDark" />
      <Box p={[0, 0.22, 0]} s={[0.58, 0.12, 0.58]} c={STONE} tex="stone" />
      <mesh position={[0, 0.95, 0]} castShadow material={surfaceMaterial("stone", 0.6, 1.2, studied ? "#d8d2c6" : "#a8a296")}>
        <cylinderGeometry args={[0.12, 0.24, 1.35, 4, 1]} />
      </mesh>
      <mesh position={[0, 1.7, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.17, 0.2, 4]} />
        <meshStandardMaterial color={STONE} roughness={0.8} />
      </mesh>
      <mesh ref={rune} position={[0, 1.0, 0.13]} rotation={[0.1, 0, 0]}>
        <planeGeometry args={[0.1, 0.34]} />
        <meshStandardMaterial color="#1a1a1a" emissive={glow} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {mastered || weak ? (
        <mesh position={[0, 2.0, 0]}>
          <octahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={weak ? "#ff5a4a" : "#ffd45a"} emissive={weak ? "#ff2a1a" : "#ffd45a"} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * A hipped (four-sided) tiled roof on a rectangle, like the KayKit buildings' roofs: a square pyramid
 * stretched to w × d, with a timber eave band and a pale timber ceiling so the underside reads as wood,
 * not a dark slab, plus a gold finial.
 */
function HippedRoof({ y, w, d, h, c }: { y: number; w: number; d: number; h: number; c: string }) {
  const tiles = useMemo(() => surfaceMaterial("roof", (w + d) / 0.9, Math.hypot(Math.max(w, d) / 2, h) / 0.9, c), [w, d, h, c]);
  const half = Math.SQRT1_2;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, h / 2 + 0.08, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w / 2 / half, 1, d / 2 / half]} material={tiles} castShadow receiveShadow>
        <coneGeometry args={[1, h, 4, 1, true]} />
      </mesh>
      <Box p={[0, 0.04, 0]} s={[w - 0.08, 0.12, d - 0.08]} c="#7a4e2c" tex="wood" />
      <mesh position={[0, -0.025, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.2, d - 0.2]} />
        <meshStandardMaterial color="#c9a57a" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h + 0.14, 0]} castShadow>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color="#e2b23a" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** An open-sided pavilion with a pedestal for each beaten boss and a banner for each ten achievements. */
export function TrophyPavilion({ trophies, banners }: { trophies: number; banners: number }) {
  const columns: Vec3[] = [
    [-1.3, 0, -0.8],
    [1.3, 0, -0.8],
    [-1.3, 0, 0.8],
    [1.3, 0, 0.8],
  ];
  const pedestals = Array.from({ length: Math.min(8, trophies) }, (_, i) => [-1.05 + (i % 4) * 0.7, 0, i < 4 ? -0.35 : 0.35] as Vec3);
  return (
    <group>
      <Box p={[0, 0.08, 0]} s={[3, 0.16, 2]} c={STONE} tex="stone" />
      {columns.map((p, i) => (
        <Cyl key={i} p={[p[0], 1.1, p[2]]} rt={0.11} rb={0.13} h={2.0} seg={12} c="#e8e2d4" tex="plaster" />
      ))}
      <HippedRoof y={2.1} w={3.6} d={2.5} h={1.2} c="#f06a4a" />
      {/* Hanging lantern under the roof so the trophies stay visible after dark. */}
      <mesh position={[0, 1.88, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
        <meshStandardMaterial color="#2b2a2e" />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <boxGeometry args={[0.18, 0.22, 0.18]} />
        <meshStandardMaterial color="#ffe2a8" emissive="#ffb04a" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      {pedestals.map((p, i) => (
        <group key={i} position={p}>
          <Cyl p={[0, 0.4, 0]} rt={0.14} rb={0.16} h={0.5} seg={10} c={STONE_DARK} tex="stoneDark" />
          <mesh position={[0, 0.78, 0]} castShadow>
            <icosahedronGeometry args={[0.12, 1]} />
            <meshStandardMaterial color="#efe6d0" roughness={0.5} emissive="#b46bff" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: Math.min(4, banners) }, (_, i) => (
        <Banner key={i} p={[-1.0 + i * 0.66, 1.75, -0.95]} color={["#c8102e", "#2347a8", "#d6a419", "#2e6b34"][i]} h={0.6} />
      ))}
    </group>
  );
}

export function QuestBoard({ hasActive }: { hasActive: boolean }) {
  return (
    <group>
      <Cyl p={[-0.42, 0.78, 0]} rt={0.05} rb={0.06} h={1.56} seg={10} c={WOOD} tex="wood" />
      <Cyl p={[0.42, 0.78, 0]} rt={0.05} rb={0.06} h={1.56} seg={10} c={WOOD} tex="wood" />
      <Box p={[0, 1.08, 0.03]} s={[1.0, 0.72, 0.06]} c="#a07850" tex="wood" />
      <GableRoof p={[0, 1.52, 0.02]} w={1.1} d={0.4} h={0.22} c="#8a4a2a" />
      {[
        [-0.25, 1.14, 0.24, 0.3, "#efe4c8"],
        [0.12, 1.0, 0.3, 0.26, "#e8ddc1"],
        [0.28, 1.25, 0.18, 0.18, "#d9c8a0"],
        [-0.12, 0.85, 0.2, 0.16, "#f2ead6"],
      ].map(([x, y, w, h, c], i) => (
        <mesh key={i} position={[x as number, y as number, 0.065]} rotation={[0, 0, (i - 1.5) * 0.06]}>
          <planeGeometry args={[w as number, h as number]} />
          <meshStandardMaterial color={c as string} roughness={0.9} />
        </mesh>
      ))}
      {hasActive ? (
        <mesh position={[0, 1.95, 0]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial color="#ffd45a" emissive="#ffb000" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Ring of obsidian stones where a deadline boss rises; its rune circle glows while a boss is awake. */
export function BossLair({ awake }: { awake: boolean }) {
  const stones = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2 + 0.3);
  const obsidian = useMemo(() => surfaceMaterial("stone", 0.8, 1, "#4a4552"), []);
  const ground = useMemo(() => surfaceMaterial("cobble", 1.4, 1.4, "#6d6475"), []);
  const rune = useRef<Mesh>(null);
  useFrame((state) => {
    if (rune.current) {
      rune.current.rotation.z = state.clock.elapsedTime * 0.3;
      const m = rune.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = awake ? 2.2 + Math.sin(state.clock.elapsedTime * 3) * 0.8 : 0.25;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow material={ground}>
        <cylinderGeometry args={[1.05, 1.1, 0.06, 32]} />
      </mesh>
      <mesh ref={rune} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.74, 7, 1]} />
        <meshStandardMaterial color="#b46bff" emissive="#9a3cff" emissiveIntensity={awake ? 2.2 : 0.25} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {stones.map((a, i) => (
        <mesh
          key={i}
          geometry={standingStoneGeometry(i + 41)}
          material={obsidian}
          position={[Math.sin(a) * 1.0, 0, Math.cos(a) * 1.0]}
          rotation={[0.08 * ((i % 3) - 1), a, 0.1]}
          scale={[0.8, 0.75 + (i % 3) * 0.18, 0.8]}
          castShadow
        />
      ))}
    </group>
  );
}

export function DuelArena({ theme }: { theme: RegionTheme }) {
  const style = THEME_STYLES[theme];
  const stones = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  const sand = useMemo(() => surfaceMaterial("cobble", 1.8, 1.8, "#e4cc96"), []);
  return (
    <group>
      <mesh position={[0, 0.04, 0]} receiveShadow material={sand}>
        <cylinderGeometry args={[1.38, 1.42, 0.08, 40]} />
      </mesh>
      {stones.map((a, i) => (
        <mesh
          key={i}
          geometry={standingStoneGeometry(i + 3)}
          material={surfaceMaterial("stone", 0.8, 1, STONE)}
          position={[Math.sin(a) * 1.38, 0, Math.cos(a) * 1.38]}
          rotation={[0, a, 0]}
          scale={[1, 0.9 + (i % 3) * 0.12, 1]}
          castShadow
        />
      ))}
      <Cyl p={[0.9, 1.05, -0.9]} rt={0.03} rb={0.035} h={2.1} seg={8} c={WOOD} tex="wood" />
      <Banner p={[1.17, 2.0, -0.9]} color={style.accent} h={0.55} />
      <Torch p={[-0.95, 0.65, 0.95]} />
    </group>
  );
}

export function ScrollTable() {
  return (
    <group>
      <Box p={[0, 0.6, 0]} s={[1.0, 0.07, 0.62]} c="#9a6a40" tex="wood" />
      {[
        [-0.42, -0.25],
        [0.42, -0.25],
        [-0.42, 0.25],
        [0.42, 0.25],
      ].map(([x, z], i) => (
        <Cyl key={i} p={[x, 0.29, z]} rt={0.035} rb={0.04} h={0.58} seg={8} c={WOOD} tex="wood" />
      ))}
      <Cyl p={[-0.2, 0.69, 0]} rt={0.05} rb={0.05} h={0.42} seg={14} c="#efe4c8" r={[0, 0, Math.PI / 2]} />
      <Cyl p={[0.18, 0.69, 0.12]} rt={0.05} rb={0.05} h={0.36} seg={14} c="#e2d4ac" r={[0, 0.6, Math.PI / 2]} />
      <mesh position={[0.15, 0.645, -0.15]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[0.32, 0.22]} />
        <meshStandardMaterial color="#f4ecd8" roughness={0.9} />
      </mesh>
      <Cyl p={[-0.36, 0.72, -0.18]} rt={0.03} rb={0.03} h={0.14} seg={10} c="#f0e6c8" />
      <mesh position={[-0.36, 0.83, -0.18]}>
        <sphereGeometry args={[0.025, 8, 6]} />
        <meshStandardMaterial color="#ffb454" emissive="#ffb454" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function RuneAltar({ theme }: { theme: RegionTheme }) {
  const style = THEME_STYLES[theme];
  const crystal = useRef<Mesh>(null);
  useFrame((state) => {
    if (crystal.current) {
      crystal.current.rotation.y = state.clock.elapsedTime;
      crystal.current.position.y = 1.2 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
    }
  });
  return (
    <group>
      <mesh material={surfaceMaterial("stone", 2.5, 0.8, STONE)} castShadow receiveShadow>
        <latheGeometry
          args={[
            [
              [0, 0],
              [0.5, 0],
              [0.5, 0.12],
              [0.38, 0.2],
              [0.3, 0.3],
              [0.27, 0.6],
              [0.36, 0.7],
              [0.48, 0.76],
              [0.48, 0.84],
              [0, 0.84],
            ].map(([x, y]) => new THREE.Vector2(x, y)),
            28,
          ]}
        />
      </mesh>
      <mesh ref={crystal} position={[0, 1.2, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={style.accent} emissive={style.glow} emissiveIntensity={2.5} toneMapped={false} roughness={0.15} />
      </mesh>
    </group>
  );
}

export function MeditationShrine({ active }: { active: boolean }) {
  return (
    <group>
      <Cyl p={[0, 0.07, 0]} rt={0.6} rb={0.66} h={0.14} c={STONE} tex="stone" />
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.02, 32]} />
        <meshStandardMaterial color="#3a7ab0" roughness={0.1} metalness={0.3} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.sin(a) * 0.66, 0.14, Math.cos(a) * 0.66]}>
            <Cyl p={[0, 0.1, 0]} rt={0.035} rb={0.04} h={0.2} seg={10} c="#f0e6c8" />
            <mesh position={[0, 0.24, 0]}>
              <coneGeometry args={[0.022, 0.06, 8]} />
              <meshStandardMaterial color="#ffcf6a" emissive="#ff9a3a" emissiveIntensity={active ? 4 : 1.5} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {active ? <pointLight position={[0, 0.7, 0]} color="#ffb454" intensity={3} distance={3.5} /> : null}
    </group>
  );
}

export function Signpost() {
  return (
    <group>
      <Cyl p={[0, 0.78, 0]} rt={0.05} rb={0.06} h={1.56} seg={10} c={WOOD} tex="wood" />
      <Box p={[0.24, 1.28, 0]} s={[0.62, 0.2, 0.05]} c="#b08a5a" tex="wood" />
      <mesh position={[0.58, 1.28, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.1, 0.12, 3]} />
        <meshStandardMaterial color="#b08a5a" roughness={0.8} />
      </mesh>
      <Box p={[-0.2, 1.0, 0]} s={[0.5, 0.17, 0.05]} c="#a07a4a" tex="wood" r={[0, 0, 0.05]} />
    </group>
  );
}

const FOUNTAIN_BASIN = [
  [0, 0],
  [1.04, 0],
  [1.06, 0.08],
  [1.0, 0.38],
  [1.06, 0.46],
  [0.94, 0.5],
  [0.9, 0.24],
  [0, 0.24],
].map(([x, y]) => new THREE.Vector2(x, y));
const FOUNTAIN_COLUMN = [
  [0, 0.2],
  [0.24, 0.2],
  [0.16, 0.36],
  [0.13, 0.9],
  [0.2, 1.0],
  [0.44, 1.12],
  [0.46, 1.2],
  [0.36, 1.22],
  [0.1, 1.16],
  [0, 1.16],
].map(([x, y]) => new THREE.Vector2(x, y));

export function Fountain() {
  const water = useRef<Mesh>(null);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d6d0c4", roughness: 0.85 }), []);
  useFrame((state) => {
    if (water.current) water.current.position.y = 1.3 + Math.sin(state.clock.elapsedTime * 3) * 0.03;
  });
  return (
    <group>
      <mesh material={stone} castShadow receiveShadow>
        <latheGeometry args={[FOUNTAIN_BASIN, 40]} />
      </mesh>
      <mesh material={stone} castShadow>
        <latheGeometry args={[FOUNTAIN_COLUMN, 32]} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.93, 0.93, 0.03, 40]} />
        <meshStandardMaterial color="#3f86c4" roughness={0.05} metalness={0.3} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.02, 28]} />
        <meshStandardMaterial color="#5aa0d8" roughness={0.05} metalness={0.3} transparent opacity={0.88} />
      </mesh>
      <mesh ref={water} position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color="#cfeeff" emissive="#4a9ad8" emissiveIntensity={0.5} transparent opacity={0.8} roughness={0.05} />
      </mesh>
    </group>
  );
}
