/**
 * The campus: dressing for the Agora and the district courts (lamp posts
 * that glow after dark, benches, planters, low walls, statues, stalls,
 * gateway arches), and the purpose buildings themselves.
 *
 * Every purpose building is built to be recognised from across the campus:
 * its own architecture (a columned lecture theatre, a library with a wall
 * of lit windows, a striped games tent, market stalls, a duelling ring, a
 * residence hall), a big painted sign with its name and pictogram, and a
 * floating icon beacon in its purpose colour — the same colour and icon the
 * minimap and the area banner use.
 *
 * Local frame for buildings: origin = footprint centre, entrance faces +Z.
 */

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BuildingModel, NatureModel, PropModel, WithFallback } from "./models";
import { surfaceMaterial } from "./textures";
import { Gateway, IconBeacon, Sign, medallionTexture } from "./Signage";
import { DuelArena, Fountain, QuestBoard, TrophyPavilion, Citadel } from "./Structures";
import { GamesHall } from "./GamesHall";
import { LifeNodeVisual } from "./LifeNodes";
import { CauldronVisual } from "./Academy";
import { HarbourVisual } from "./DormInterior";
import { Landscape, SceneryLandmark } from "./Landscape";
import { HumanCharacter } from "./HumanCharacter";
import { MERCHANT_LOOK } from "../customise/npcs";
import { useRealm } from "../state/store";
import { runtime } from "./runtime";
import { THEME_STYLES } from "../world/themes";
import { groundHeight, PLACE_INFO, PURPOSE_STYLE, type District, type HubProp, type HubStyle, type World, type WorldObject } from "../world/worldGen";

const IRON = "#2b2a2e";
const WOOD = "#8a5a34";
const STONE = "#d9d0bf";
const STONE_DARK = "#a39a8a";

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function Lamp({ night }: { night: boolean }) {
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (glass.current) glass.current.emissiveIntensity = (night ? 3.2 : 0.6) + Math.sin(state.clock.elapsedTime * 3.1) * (night ? 0.25 : 0);
  });
  return (
    <group>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.16, 10]} />
        <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, 2.7, 8]} />
        <meshStandardMaterial color={IRON} roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.92, 0]}>
        <boxGeometry args={[0.3, 0.38, 0.3]} />
        <meshStandardMaterial ref={glass} color="#ffe2a8" emissive="#ffb04a" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.18, 0]} castShadow>
        <coneGeometry args={[0.26, 0.2, 4]} />
        <meshStandardMaterial color={IRON} roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Bench() {
  const wood = useMemo(() => surfaceMaterial("wood", 1, 0.4, WOOD), []);
  return (
    <group>
      <mesh position={[0, 0.45, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.07, 1.6]} />
      </mesh>
      <mesh position={[-0.21, 0.76, 0]} rotation={[0, 0, 0.12]} material={wood} castShadow>
        <boxGeometry args={[0.06, 0.4, 1.6]} />
      </mesh>
      {[-0.65, 0.65].map((z) => (
        <mesh key={z} position={[0, 0.22, z]} castShadow>
          <boxGeometry args={[0.4, 0.44, 0.07]} />
          <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Planter() {
  const stone = useMemo(() => surfaceMaterial("stone", 0.7, 0.4, "#c9c2b4"), []);
  return (
    <group>
      <mesh position={[0, 0.25, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.5, 1.0]} />
      </mesh>
      <mesh position={[0, 0.51, 0]}>
        <boxGeometry args={[0.86, 0.02, 0.86]} />
        <meshStandardMaterial color="#4a3622" roughness={1} />
      </mesh>
      <group position={[0, 0.5, 0]}>
        <WithFallback
          fallback={
            <mesh position={[0, 0.9, 0]} castShadow>
              <icosahedronGeometry args={[0.5, 1]} />
              <meshStandardMaterial color="#3f6a2e" roughness={0.9} />
            </mesh>
          }
        >
          <NatureModel id="tree-b" height={2.4} />
        </WithFallback>
      </group>
    </group>
  );
}

/** A low dressed-stone wall with a capping course, one tile long. */
function LowWall() {
  const stone = useMemo(() => surfaceMaterial("stone", 1, 0.5, "#cfc6b6"), []);
  const cap = useMemo(() => surfaceMaterial("stoneDark", 1, 0.25, "#a89f90"), []);
  return (
    <group>
      <mesh position={[0, 0.27, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.54, 1.0]} />
      </mesh>
      <mesh position={[0, 0.58, 0]} material={cap} castShadow>
        <boxGeometry args={[0.44, 0.08, 1.04]} />
      </mesh>
    </group>
  );
}

/** A plinth for statues. */
function Plinth({ h = 1, w = 1.1 }: { h?: number; w?: number }) {
  const stone = useMemo(() => surfaceMaterial("stone", 1, 1, STONE), []);
  const cap = useMemo(() => surfaceMaterial("stoneDark", 1, 0.3, STONE_DARK), []);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[w, h, w]} />
      </mesh>
      <mesh position={[0, h + 0.06, 0]} material={cap} castShadow>
        <boxGeometry args={[w + 0.16, 0.12, w + 0.16]} />
      </mesh>
    </group>
  );
}

/** A giant stack of books with an open book on top, outside the library. */
function BookStatue() {
  const books: Array<[number, number, number, string]> = [
    [1.0, 0.32, 0.1, "#2a56b8"],
    [0.9, 0.28, -0.25, "#a3172b"],
    [0.95, 0.3, 0.35, "#2e6b34"],
  ];
  let y = 1.12;
  return (
    <group>
      <Plinth h={1} w={1.0} />
      {books.map(([w, h, r, c], i) => {
        const at = y + h / 2;
        y += h;
        return (
          <group key={i} position={[0, at, 0]} rotation={[0, r, 0]}>
            <mesh castShadow>
              <boxGeometry args={[w, h, w * 0.72]} />
              <meshStandardMaterial color={c} roughness={0.7} />
            </mesh>
            <mesh position={[0.02, 0, 0]}>
              <boxGeometry args={[w - 0.06, h - 0.07, w * 0.72 + 0.01]} />
              <meshStandardMaterial color="#f3ead6" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      {/* The open book, pages fanned. */}
      <group position={[0, y + 0.08, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.3, 0.06, 0]} rotation={[0, 0, side * -0.22]} castShadow>
            <boxGeometry args={[0.6, 0.06, 0.8]} />
            <meshStandardMaterial color="#f6efdc" roughness={0.85} emissive="#fff3c8" emissiveIntensity={0.15} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[1.3, 0.04, 0.86]} />
          <meshStandardMaterial color="#6b2a1a" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

const GOLD = new THREE.MeshStandardMaterial({ color: "#e8b830", metalness: 0.85, roughness: 0.28, emissive: "#6a4a08", emissiveIntensity: 0.25 });

/** A golden cup: two handles, a stem and a foot. `scale` 1 is about 1 m tall. */
function GoldCup({ scale = 1 }: { scale?: number }) {
  const cup = useMemo(() => {
    const points = [
      [0.0, 0.0],
      [0.32, 0.0],
      [0.3, 0.08],
      [0.12, 0.14],
      [0.08, 0.36],
      [0.14, 0.44],
      [0.4, 0.62],
      [0.44, 0.98],
      [0.4, 1.0],
      [0.0, 0.7],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(points, 28);
  }, []);
  return (
    <group scale={scale}>
      <mesh geometry={cup} material={GOLD} castShadow />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.44, 0.78, 0]} rotation={[0, 0, side * 0.2]} material={GOLD} castShadow>
          <torusGeometry args={[0.16, 0.04, 8, 16, Math.PI]} />
        </mesh>
      ))}
    </group>
  );
}

function TrophyStatue() {
  return (
    <group>
      <Plinth h={1.1} w={0.9} />
      <group position={[0, 1.18, 0]}>
        <GoldCup scale={1.15} />
      </group>
    </group>
  );
}

const AWNING_STRIPES = ["#e8731f", "#fff0c8"];

/** A small market stall: counter, four posts and a striped awning. Front faces +Z. */
function Stall({ width = 1.6, depth = 1.0, colours = AWNING_STRIPES }: { width?: number; depth?: number; colours?: string[] }) {
  const wood = useMemo(() => surfaceMaterial("wood", 1, 1, "#9a6a40"), []);
  const stripes = 6;
  return (
    <group>
      <mesh position={[0, 0.5, 0.05]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[width, 1.0, depth * 0.6]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * width) / 2, 1.15, (sz * depth) / 2]} material={wood} castShadow>
            <boxGeometry args={[0.08, 2.3, 0.08]} />
          </mesh>
        )),
      )}
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} position={[-width / 2 + (width / stripes) * (i + 0.5), 2.3, 0.1]} rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[width / stripes, 0.05, depth + 0.5]} />
          <meshStandardMaterial color={colours[i % colours.length]} roughness={0.85} />
        </mesh>
      ))}
      {/* Goods on the counter. */}
      {[-0.45, 0, 0.45].map((x, i) => (
        <mesh key={x} position={[x * (width / 1.6), 1.1, 0.15]} castShadow>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color={["#c8102e", "#e8b830", "#3f9a46"][i]} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** A tall pole flying a long pennant in the purpose colours. */
function Flagpole({ colour = "#e8731f", accent = "#fff0c8" }: { colour?: string; accent?: string }) {
  const flag = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.6, 0.8, 8, 2);
    g.translate(0.8, 0, 0);
    return g;
  }, []);
  const base = useMemo(() => geometry.attributes.position.array.slice(), [geometry]);
  useFrame((state) => {
    const mesh = flag.current;
    if (!mesh) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const t = state.clock.elapsedTime * 3;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      pos.setZ(i, Math.sin(t + x * 2.5) * 0.12 * x);
    }
    pos.needsUpdate = true;
  });
  return (
    <group>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 4.8, 8]} />
        <meshStandardMaterial color="#d8d2c6" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.85, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#e8b830" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={flag} geometry={geometry} position={[0.05, 4.3, 0]} castShadow>
        <meshStandardMaterial color={colour} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      <mesh position={[0.9, 4.3, 0.02]}>
        <circleGeometry args={[0.22, 16]} />
        <meshStandardMaterial color={accent} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Woodpile() {
  const bark = useMemo(() => surfaceMaterial("bark", 1, 1, "#8a6a4a"), []);
  const logs: Array<[number, number]> = [
    [-0.3, 0.16],
    [0.0, 0.16],
    [0.3, 0.16],
    [-0.15, 0.42],
    [0.15, 0.42],
    [0, 0.68],
  ];
  return (
    <group>
      {logs.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={bark} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 1.1, 10]} />
        </mesh>
      ))}
      <mesh position={[0.6, 0.45, 0.2]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
      <mesh position={[0.78, 0.8, 0.2]} rotation={[0, 0, -0.5]} castShadow>
        <boxGeometry args={[0.25, 0.12, 0.05]} />
        <meshStandardMaterial color="#8a8a90" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Crates() {
  return (
    <WithFallback
      fallback={
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshStandardMaterial color="#9a6a40" />
        </mesh>
      }
    >
      <PropModel id="crate" height={0.7} position={[-0.15, 0, 0]} rotation={0.3} />
      <PropModel id="crate" height={0.55} position={[-0.1, 0.7, 0.05]} rotation={1.0} />
      <PropModel id="barrel" height={0.85} position={[0.45, 0, 0.25]} />
    </WithFallback>
  );
}

function PropVisual({ prop, night }: { prop: HubProp; night: boolean }) {
  switch (prop.kind) {
    case "lamp":
      return <Lamp night={night} />;
    case "bench":
      return <Bench />;
    case "planter":
      return <Planter />;
    case "fence":
      return <LowWall />;
    case "book-statue":
      return <BookStatue />;
    case "trophy-statue":
      return <TrophyStatue />;
    case "stall":
      return <Stall />;
    case "flagpole":
      return <Flagpole />;
    case "woodpile":
      return <Woodpile />;
    case "crates":
      return <Crates />;
  }
}

// ---------------------------------------------------------------------------
// Ground: plaza paving and district courts
// ---------------------------------------------------------------------------

/** Warm paving: a ring around the fountain and the spine from the south edge to the Great Hall. */
function Paving({ world }: { world: World }) {
  const brick = useMemo(() => {
    const m = surfaceMaterial("cobble", 2.2, 2.2, "#c98a6a");
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    return m;
  }, []);
  const C = (world.plaza.x0 + world.plaza.x1) / 2;
  const fountain = world.objects.find((o) => o.kind === "fountain");
  if (!fountain) return null;
  const fx = fountain.x + fountain.w / 2;
  const fz = fountain.z + fountain.d / 2;
  const ring = fountain.w / 2 + 0.4;
  const spineStart = world.objects.find((o) => o.kind === "citadel");
  const top = spineStart ? spineStart.z + spineStart.d : C + 2;
  const bottom = world.plaza.z1;
  const y = 0.025;
  const width = 2.6;
  return (
    <group>
      <mesh position={[fx, groundHeight(world, fx, fz) + y, fz]} rotation={[-Math.PI / 2, 0, 0]} material={brick} receiveShadow raycast={() => null}>
        <ringGeometry args={[ring, ring + 1.3, 56]} />
      </mesh>
      <mesh position={[fx, groundHeight(world, fx, (top + fz - ring) / 2) + y, (top + fz - ring) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={brick} receiveShadow raycast={() => null}>
        <planeGeometry args={[width, Math.max(0.1, fz - ring - top)]} />
      </mesh>
      <mesh position={[fx, groundHeight(world, fx, (fz + ring + bottom) / 2) + y, (fz + ring + bottom) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={brick} receiveShadow raycast={() => null}>
        <planeGeometry args={[width, Math.max(0.1, bottom - fz - ring)]} />
      </mesh>
    </group>
  );
}

/** A district's court: cobbles, a ring in the district colour, its emblem inlaid at the centre, and the gateway arch. */
function DistrictGround({ world, district }: { world: World; district: District }) {
  const style = PURPOSE_STYLE[district.purpose];
  const cobble = useMemo(() => {
    const m = surfaceMaterial("cobble", district.court / 1.1, district.court / 1.1, "#d8d0c2");
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    return m;
  }, [district.court]);
  const emblem = useMemo(() => {
    const texture = medallionTexture(district.icon, district.purpose);
    return new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3 });
  }, [district.icon, district.purpose]);
  const cx = district.x + 0.5;
  const cz = district.z + 0.5;
  const y = groundHeight(world, cx, cz) + 0.03;
  const gy = groundHeight(world, district.gate.x, district.gate.z);
  return (
    <group>
      <mesh position={[cx, y, cz]} rotation={[-Math.PI / 2, 0, 0]} material={cobble} receiveShadow raycast={() => null}>
        <circleGeometry args={[district.court + 0.3, 48]} />
      </mesh>
      <mesh position={[cx, y + 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[district.court - 0.1, district.court + 0.3, 48]} />
        <meshStandardMaterial color={style.main} roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position={[cx, y + 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} material={emblem} raycast={() => null}>
        <circleGeometry args={[Math.min(1.6, district.court * 0.4), 40]} />
      </mesh>
      <group position={[district.gate.x, gy, district.gate.z]} rotation={[0, district.gate.rot, 0]}>
        <Gateway district={district} />
      </group>
    </group>
  );
}

export function Campus({ world, night }: { world: World; night: boolean }) {
  return (
    <group>
      <Paving world={world} />
      <Landscape world={world} night={night} />
      {world.districts.map((d) => (
        <DistrictGround key={d.id} world={world} district={d} />
      ))}
      {world.hubProps.map((prop, i) => (
        <group key={i} position={[prop.x, groundHeight(world, prop.x, prop.z), prop.z]} rotation={[0, prop.rot, 0]}>
          <PropVisual prop={prop} night={night} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Purpose buildings
// ---------------------------------------------------------------------------

/** Width (along the front) and depth of an object's footprint in its own frame. */
export function localSize(object: WorldObject): { w: number; d: number } {
  const alongX = Math.abs(Math.cos(object.rot)) > 0.5;
  return alongX ? { w: object.w, d: object.d } : { w: object.d, d: object.w };
}

/** A triangular prism (gable roof or pediment): triangle in X/Y, `depth` along Z, base at y = 0. */
function Prism({ w, h, depth, material, position }: { w: number; h: number; depth: number; material: THREE.Material; position: [number, number, number] }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [w, h, depth]);
  return <mesh geometry={geometry} material={material} position={position} castShadow receiveShadow />;
}

function GlowPane({ w, h, position, rotation = 0, colour = "#ffcf6a", intensity = 0.9 }: { w: number; h: number; position: [number, number, number]; rotation?: number; colour?: string; intensity?: number }) {
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color="#2a2014" emissive={colour} emissiveIntensity={intensity} roughness={0.4} />
    </mesh>
  );
}

/** A tall standing brazier with a flame, for grand entrances. */
function Brazier() {
  const flame = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (flame.current) flame.current.scale.y = 0.9 + Math.sin(state.clock.elapsedTime * 8) * 0.12;
  });
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.12, 1.2, 8]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.16, 0.22, 12]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={flame} position={[0, 1.55, 0]}>
        <coneGeometry args={[0.2, 0.55, 10]} />
        <meshStandardMaterial color="#ffcf6a" emissive="#ff8a2a" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A tall hanging banner with the place's medallion, for facades. */
function MedallionBanner({ purpose, icon, h = 3, w = 1.1 }: { purpose: keyof typeof PURPOSE_STYLE; icon: Parameters<typeof medallionTexture>[0]; h?: number; w?: number }) {
  const style = PURPOSE_STYLE[purpose];
  const medal = useMemo(() => {
    const texture = medallionTexture(icon, purpose);
    return new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.4, emissiveMap: texture, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.3 });
  }, [icon, purpose]);
  return (
    <group>
      <mesh position={[0, -h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, 0.04]} />
        <meshStandardMaterial color={style.main} roughness={0.85} />
      </mesh>
      <mesh position={[0, -h + 0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[w * 0.7, w * 0.7, 0.035]} />
        <meshStandardMaterial color={style.main} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[w + 0.12, 0.1, 0.08]} />
        <meshStandardMaterial color={style.accent} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, -h * 0.42, 0.03]} material={medal}>
        <circleGeometry args={[w * 0.38, 32]} />
      </mesh>
    </group>
  );
}

/** Hides a walk-in building's front decorations and beacon while you're inside it (its front wall drops away then). */
function OutsideOnly({ room, children }: { room: "dorm" | "theatre"; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = runtime.room !== room;
  });
  return <group ref={group}>{children}</group>;
}

/**
 * The lecture theatre from outside. Its walls and roof are the walk-in room's own
 * (scene/WalkInRooms.tsx: you walk straight through the doors). What makes it
 * recognisable from the plaza is dressed onto the front: a colonnade of pilasters,
 * the glowing "LECTURE THEATRE" sign over the doors, emblem banners, braziers and
 * a floating lectern beacon over the roof.
 */
function LectureTheatre({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["lecture-hall"]!;
  const column = useMemo(() => surfaceMaterial("plaster", 1, 3, "#f7f2e6"), []);
  const stone = useMemo(() => surfaceMaterial("stone", w / 1.4, 1, "#e6dccb"), [w]);
  const H = 5;
  const front = d / 2 + 0.11;
  // The doors are at the end of the centre aisle, half a tile left of the middle.
  const doorX = -0.5;
  const pilasters = [-w / 2 + 0.5, -w / 2 + 2.6, doorX - 1.3, doorX + 1.3, w / 2 - 2.6, w / 2 - 0.5];
  return (
    <group>
      <OutsideOnly room="theatre">
        {pilasters.map((x) => (
          <group key={x} position={[x, 0, front + 0.18]}>
            <mesh position={[0, 0.12, 0]} material={stone} castShadow>
              <boxGeometry args={[0.62, 0.24, 0.5]} />
            </mesh>
            <mesh position={[0, H / 2, 0]} material={column} castShadow>
              <cylinderGeometry args={[0.2, 0.24, H - 0.4, 14]} />
            </mesh>
            <mesh position={[0, H - 0.12, 0]} material={stone} castShadow>
              <boxGeometry args={[0.62, 0.24, 0.5]} />
            </mesh>
          </group>
        ))}
        {/* The entablature along the top of the front, carrying the sign. */}
        <mesh position={[0, H + 0.35, front + 0.2]} material={stone} castShadow>
          <boxGeometry args={[w + 0.3, 0.7, 0.6]} />
        </mesh>
        <Sign title={info.sign} icon={info.icon} purpose={info.purpose} width={Math.min(9, w - 3)} height={1.1} position={[doorX, H - 1.0, front + 0.06]} />
        {/* The lectern emblem, centred on the entablature. */}
        <group position={[doorX, H + 0.35, front + 0.52]}>
          <EmblemDisc purpose={info.purpose} icon={info.icon} radius={0.42} />
        </group>
        {[-1, 1].map((side) => (
          <group key={side} position={[doorX + side * 1.9, H - 1.7, front + 0.06]}>
            <MedallionBanner purpose={info.purpose} icon={info.icon} h={2.6} w={0.9} />
          </group>
        ))}
        {[-1, 1].map((side) => (
          <group key={side} position={[doorX + side * 2.4, 0, front + 0.75]}>
            <Brazier />
          </group>
        ))}
        <IconBeacon icon={info.icon} purpose={info.purpose} height={H + 3.2} size={2.2} />
      </OutsideOnly>
    </group>
  );
}

function EmblemDisc({ purpose, icon, radius }: { purpose: keyof typeof PURPOSE_STYLE; icon: Parameters<typeof medallionTexture>[0]; radius: number }) {
  const material = useMemo(() => {
    const texture = medallionTexture(icon, purpose);
    return new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.4, emissiveMap: texture, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.35 });
  }, [icon, purpose]);
  return (
    <mesh material={material}>
      <circleGeometry args={[radius, 36]} />
    </mesh>
  );
}

/** The library: a long two-storey hall with a wall of lit windows, a central entrance bay, a book-stack sign and lamps. */
function Library({ w, d, name }: { w: number; d: number; name: string }) {
  const info = PLACE_INFO.library!;
  const brick = useMemo(() => surfaceMaterial("stone", w / 1.2, 3, "#c98f6a"), [w]);
  const trim = useMemo(() => surfaceMaterial("stoneDark", w / 1.4, 0.4, "#e8dfcc"), [w]);
  const roof = useMemo(() => surfaceMaterial("roof", w / 1.2, d / 1.2, "#2f4a7a"), [w, d]);
  const yard = Math.min(1.4, d * 0.2);
  const bodyD = d - yard - 0.2;
  const bodyZ = -d / 2 + 0.1 + bodyD / 2;
  const front = bodyZ + bodyD / 2;
  const bodyW = w - 0.3;
  const H = Math.max(4.2, w * 0.55);
  const cols = Math.max(3, Math.floor(bodyW / 1.3));
  const roofH = Math.max(1.6, bodyD * 0.38);
  return (
    <group>
      <mesh position={[0, H / 2, bodyZ]} material={brick} castShadow receiveShadow>
        <boxGeometry args={[bodyW, H, bodyD]} />
      </mesh>
      {/* Cornice and plinth bands. */}
      <mesh position={[0, H + 0.08, bodyZ]} material={trim} castShadow>
        <boxGeometry args={[bodyW + 0.25, 0.22, bodyD + 0.25]} />
      </mesh>
      <mesh position={[0, 0.2, bodyZ]} material={trim} receiveShadow>
        <boxGeometry args={[bodyW + 0.12, 0.4, bodyD + 0.12]} />
      </mesh>
      {/* Roof: a gable running along the front. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <Prism w={bodyD + 0.4} h={roofH} depth={bodyW + 0.4} material={roof} position={[-bodyZ, H + 0.18, 0]} />
      </group>
      {/* Two rows of tall warm windows across the front: a reading room full of light. */}
      {[0.32, 0.7].flatMap((row) =>
        Array.from({ length: cols }, (_, i) => {
          const x = -bodyW / 2 + (bodyW / cols) * (i + 0.5);
          if (Math.abs(x) < 1.0 && row < 0.5) return null;
          return <GlowPane key={`${row}${i}`} w={0.62} h={H * 0.24} position={[x, H * row, front + 0.01]} colour="#ffcf6a" intensity={0.85} />;
        }),
      )}
      {/* Entrance bay with a pediment and doors. */}
      <mesh position={[0, H * 0.32, front + 0.3]} material={trim} castShadow>
        <boxGeometry args={[2.4, H * 0.64, 0.6]} />
      </mesh>
      <GlowPane w={1.3} h={H * 0.4} position={[0, H * 0.2 + 0.2, front + 0.61]} colour="#ffd99a" intensity={1.0} />
      <Prism w={2.8} h={0.8} depth={0.7} material={roof} position={[0, H * 0.64, front + 0.3]} />
      {/* The sign: name and book-stack pictogram across the upper facade. */}
      <Sign title={name} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(bodyW - 0.6, 7.5)} height={Math.min(bodyW - 0.6, 7.5) / 4.4} position={[0, H * 0.86, front + 0.06]} />
      {/* Lamps in the front yard. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (bodyW / 2 - 0.4), 0, d / 2 - 0.45]}>
          <Lamp night={false} />
        </group>
      ))}
      <IconBeacon icon={info.icon} purpose={info.purpose} height={H + roofH + 1.5} size={1.8} />
    </group>
  );
}

/** The Hall of Trophies: the trophy pavilion scaled up, a golden cup on its roof and a sign under the eaves. */
function TrophyHall({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["trophy-hall"]!;
  const trophies = useRealm((s) => Object.keys(s.progress.bosses).length);
  const banners = useRealm((s) => Math.floor(Object.keys(s.progress.achievements).length / 5));
  const s = Math.min(w / 3.7, d / 2.6);
  return (
    <group>
      <group scale={s}>
        <TrophyPavilion trophies={trophies} banners={banners} />
      </group>
      <group position={[0, 3.25 * s, 0]}>
        <GoldCup scale={s * 0.75} />
      </group>
      <Sign title={info.sign} icon={info.icon} purpose={info.purpose} width={2.3 * s} height={0.42 * s} position={[0, 1.78 * s, 0.82 * s + 0.12]} />
      <IconBeacon icon={info.icon} purpose={info.purpose} height={4.4 * s} size={1.6} />
    </group>
  );
}

/** The duelling club: a ring of standing stones, with crossed giant wands over a sign at its gate. */
function DuelClub({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["duel-club"]!;
  const s = Math.min(w, d) / 3.0;
  const wood = useMemo(() => surfaceMaterial("wood", 1, 3, "#5a3a22"), []);
  return (
    <group>
      <group scale={s}>
        <DuelArena theme="arcane" />
      </group>
      <WithFallback fallback={null}>
        <PropModel id="target" height={1.4} position={[-0.9 * s, 0, -0.7 * s]} rotation={0.6} />
      </WithFallback>
      {/* Two crossed wands rising over the gate, tipped with sparks. */}
      <group position={[0, 0, d / 2 - 0.35]}>
        {[-1, 1].map((side) => (
          <group key={side} rotation={[0, 0, side * 0.42]}>
            <mesh position={[0, 2.4, 0]} material={wood} castShadow>
              <cylinderGeometry args={[0.06, 0.12, 4.8, 8]} />
            </mesh>
            <mesh position={[0, 4.85, 0]}>
              <octahedronGeometry args={[0.22, 0]} />
              <meshStandardMaterial color="#d8f4ff" emissive={side < 0 ? "#7fb0ff" : "#ffcf6a"} emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
          </group>
        ))}
        <Sign title={info.sign} icon={info.icon} purpose={info.purpose} width={Math.min(4.2, w - 0.6)} height={Math.min(4.2, w - 0.6) / 4} position={[0, 2.5, 0.08]} />
      </group>
      <IconBeacon icon={info.icon} purpose={info.purpose} height={6.4} size={1.6} />
    </group>
  );
}

/** The bazaar: a row of striped market stalls, barrels and crates, the merchant out front. */
function Bazaar({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO.bazaar!;
  const stalls = w >= 6 ? 3 : 2;
  const sw = (w - 0.4) / stalls - 0.25;
  const palettes = [
    ["#e8731f", "#fff0c8"],
    ["#c8102e", "#fff0c8"],
    ["#2a56b8", "#f2c94c"],
  ];
  return (
    <group>
      {Array.from({ length: stalls }, (_, i) => (
        <group key={i} position={[-w / 2 + 0.2 + (sw + 0.25) * (i + 0.5), 0, -d / 2 + 1.0]}>
          <Stall width={sw} depth={Math.min(1.6, d * 0.35)} colours={palettes[i % palettes.length]} />
        </group>
      ))}
      <WithFallback fallback={null}>
        <PropModel id="tent" height={2.6} position={[w / 2 - 1.2, 0, -d / 2 + 0.9]} rotation={0.3} />
        <PropModel id="barrel" height={0.75} position={[-w / 2 + 0.6, 0, d / 2 - 0.6]} />
        <PropModel id="barrel" height={0.7} position={[-w / 2 + 1.2, 0, d / 2 - 0.5]} rotation={0.8} />
        <PropModel id="crate" height={0.55} position={[w / 2 - 0.6, 0, d / 2 - 0.6]} rotation={0.3} />
        <PropModel id="sack" height={0.4} position={[w / 2 - 1.2, 0, d / 2 - 0.5]} rotation={0.6} />
        <group position={[0, 0, d / 2 - 1.1]}>
          <HumanCharacter appearance={MERCHANT_LOOK} height={1.7} idleClip="Idle" />
        </group>
      </WithFallback>
      <Sign title={info.sign} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(4.6, w - 1)} height={Math.min(4.6, w - 1) / 3.6} position={[0, 0, -d / 2 + 0.25]} mount="posts" lift={2.7} />
      <IconBeacon icon={info.icon} purpose={info.purpose} height={5.6} size={1.6} />
    </group>
  );
}

/** The games hall: a huge striped carnival tent, flags flying, its name over the entrance. */
function GamesHallBig({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["games-hall"]!;
  const s = Math.min(w, d) / 3.4;
  return (
    <group>
      <group scale={s}>
        <GamesHall />
      </group>
      <WithFallback fallback={null}>
        <PropModel id="flag-red" height={3.2} position={[-w / 2 + 0.4, 0, d / 2 - 0.4]} />
        <PropModel id="flag-yellow" height={3.2} position={[w / 2 - 0.4, 0, d / 2 - 0.4]} rotation={0.4} />
        <PropModel id="flag-blue" height={3.2} position={[-w / 2 + 0.4, 0, -d / 2 + 0.4]} />
        <PropModel id="flag-green" height={3.2} position={[w / 2 - 0.4, 0, -d / 2 + 0.4]} rotation={0.4} />
      </WithFallback>
      <Sign title={info.sign} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(5.4, w - 1.2)} height={Math.min(5.4, w - 1.2) / 3.6} position={[0, 1.75 * s, 1.5 * s + 0.12]} />
      <IconBeacon icon={info.icon} purpose={info.purpose} height={3.3 * s + 1.4} size={1.8} />
    </group>
  );
}

/**
 * The residence from outside. Your dorm room inside is walk-in (scene/WalkInRooms.tsx);
 * outside it gets lit shuttered windows on its front, a green porch over the door at
 * the right-hand end, the "RESIDENCE" sign and a floating bed beacon.
 */
function Residence({ w, d, subtitle }: { w: number; d: number; subtitle: string }) {
  const info = PLACE_INFO.dorm!;
  const timber = useMemo(() => surfaceMaterial("wood", 1, 1, "#3f6a3a"), []);
  const H = 3;
  const front = d / 2 + 0.11;
  // The door is in the front wall's right-hand end (the room's last column).
  const doorX = w / 2 - 1.5;
  return (
    <group>
      <OutsideOnly room="dorm">
        {[-w / 2 + 1.4, -w / 2 + 3.2].map((x) => (
          <group key={x} position={[x, 1.6, front + 0.02]}>
            <GlowPane w={0.7} h={1.0} position={[0, 0, 0]} colour="#ffcf6a" intensity={1.0} />
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.48, 0, 0.02]}>
                <boxGeometry args={[0.22, 1.05, 0.04]} />
                <meshStandardMaterial color="#3f9a46" roughness={0.8} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Porch over the door. */}
        <mesh position={[doorX, 2.45, front + 0.55]} castShadow>
          <boxGeometry args={[1.8, 0.12, 1.1]} />
          <meshStandardMaterial color="#2f5d34" roughness={0.8} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[doorX + x, 1.2, front + 1.0]} material={timber} castShadow>
            <boxGeometry args={[0.12, 2.4, 0.12]} />
          </mesh>
        ))}
        <Sign title={info.sign} subtitle={subtitle} icon={info.icon} purpose={info.purpose} width={4.2} height={1.17} position={[-w / 2 + 2.3 + 0.6, 2.55, front + 0.06]} />
        <IconBeacon icon={info.icon} purpose={info.purpose} height={H + 3} size={1.7} />
      </OutsideOnly>
    </group>
  );
}

/** A crafts station (2x2): the station scaled up, with a small sign on posts behind it. */
function CraftStation({ object }: { object: WorldObject }) {
  const info = PLACE_INFO[object.kind]!;
  return (
    <group>
      <group scale={1.6}>{object.kind === "cauldron" ? <CauldronVisual /> : <LifeNodeVisual object={object} />}</group>
      <Sign title={info.sign} icon={info.icon} purpose={info.purpose} width={2.2} height={0.6} position={[0, 0, -0.85]} mount="posts" lift={1.5} />
    </group>
  );
}

function GroupBoard() {
  const info = PLACE_INFO["group-board"]!;
  const hasActive = useRealm((s) => Object.keys(s.progress.group).length === 0);
  return (
    <group>
      <group scale={1.7}>
        <QuestBoard hasActive={hasActive} />
      </group>
      <Sign title={info.sign} icon={info.icon} purpose={info.purpose} width={2.4} height={0.6} position={[0, 3.25, 0.1]} />
    </group>
  );
}

/** The Great Hall (or an island's exchange hall): the castle, with its name over the gate. */
function GreatHall({ object, hub }: { object: WorldObject; hub: HubStyle | null }) {
  const info = PLACE_INFO[object.kind]!;
  const { w, d } = localSize(object);
  return (
    <group>
      <WithFallback fallback={<Citadel bannerA={hub?.bannerA} bannerB={hub?.bannerB} />}>
        <BuildingModel id="castle" span={Math.min(w, d) + 1.2} />
      </WithFallback>
      <Sign title={object.name} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(7, w - 2)} height={Math.min(7, w - 2) / 4.2} position={[0, 0, d / 2 + 0.35]} mount="posts" lift={0.5} />
    </group>
  );
}

function Harbour() {
  const info = PLACE_INFO.harbour!;
  return (
    <group>
      <HarbourVisual />
      <Sign title={info.sign} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={2.8} height={0.8} position={[-1.5, 0, -0.3]} rotation={Math.PI} mount="posts" lift={1.2} />
      <IconBeacon icon={info.icon} purpose={info.purpose} height={4.2} size={1.4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sports Grounds
// ---------------------------------------------------------------------------

const OBBY_COLOURS = ["#e8312e", "#f28c1f", "#f6d21f", "#3fbf4a", "#1fa0e8", "#7a4fe0", "#e84fa8"];

/**
 * The parkour tower: a tall open frame with a spiral of brightly coloured obby
 * platforms climbing it, glowing checkpoint pads, a chequered finish at the top and
 * a "PARKOUR" sign out front.
 */
function ParkourTower({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["parkour-tower"]!;
  const H = 15;
  const half = Math.min(w, d) / 2 - 0.5;
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.5, metalness: 0.2 }), []);
  const platforms = useMemo(
    () =>
      Array.from({ length: 14 }, (_, k) => {
        const a = k * 0.95;
        const r = half * 0.62;
        return { x: Math.sin(a) * r, z: Math.cos(a) * r, y: 0.9 + k * ((H - 1.6) / 14), a, colour: OBBY_COLOURS[k % OBBY_COLOURS.length], checkpoint: k % 5 === 4 };
      }),
    [half],
  );
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[w - 0.4, 0.3, d - 0.4]} />
        <meshStandardMaterial color="#2a56b8" roughness={0.7} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * half, H / 2, sz * half]} material={frame} castShadow>
            <boxGeometry args={[0.22, H, 0.22]} />
          </mesh>
        )),
      )}
      {/* Cross bracing every few metres. */}
      {[4, 8, 12].map((y) => (
        <group key={y}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, y, s * half]} material={frame}>
              <boxGeometry args={[half * 2, 0.12, 0.12]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`x${s}`} position={[s * half, y, 0]} material={frame}>
              <boxGeometry args={[0.12, 0.12, half * 2]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.4, H, 10]} />
        <meshStandardMaterial color="#e8731f" roughness={0.6} />
      </mesh>
      {platforms.map((p, k) => (
        <mesh key={k} position={[p.x, p.y, p.z]} rotation={[0, p.a, 0]} castShadow>
          <boxGeometry args={[1.25, 0.24, 1.25]} />
          <meshStandardMaterial
            color={p.checkpoint ? "#7cff8a" : p.colour}
            emissive={p.checkpoint ? "#2bd94a" : "#000000"}
            emissiveIntensity={p.checkpoint ? 1.4 : 0}
            roughness={0.45}
          />
        </mesh>
      ))}
      {/* The finish: a gold platform with a chequered flag. */}
      <mesh position={[0, H + 0.1, 0]} castShadow>
        <cylinderGeometry args={[half + 0.3, half + 0.3, 0.28, 16]} />
        <meshStandardMaterial color="#f2c94c" metalness={0.6} roughness={0.35} emissive="#6a4a08" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[half * 0.6, H + 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.8, 6]} />
        <meshStandardMaterial color="#d8d2c6" />
      </mesh>
      <group position={[half * 0.6 + 0.02, H + 2.4, 0]}>
        {Array.from({ length: 8 }, (_, k) => (
          <mesh key={k} position={[0.18 + (k % 4) * 0.25, Math.floor(k / 4) * -0.25, 0]}>
            <planeGeometry args={[0.25, 0.25]} />
            <meshStandardMaterial color={(k + Math.floor(k / 4)) % 2 === 0 ? "#111111" : "#ffffff"} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <Sign title={info.sign} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(4.6, w - 0.4)} height={Math.min(4.6, w - 0.4) / 3.4} position={[0, 0, d / 2 - 0.1]} mount="posts" lift={0.6} />
      <IconBeacon icon={info.icon} purpose={info.purpose} height={H + 4.6} size={2} />
    </group>
  );
}

/** A round archery target on an easel (the KayKit one when loaded). */
function TargetStand() {
  return (
    <WithFallback
      fallback={
        <group>
          {[-0.35, 0.35].map((x) => (
            <mesh key={x} position={[x, 0.7, -0.15]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.08, 1.4, 0.08]} />
              <meshStandardMaterial color="#7a5232" />
            </mesh>
          ))}
          {[
            [0.62, "#f6efe2"],
            [0.48, "#1c1c1c"],
            [0.34, "#2a56b8"],
            [0.2, "#c8302e"],
            [0.09, "#f2c94c"],
          ].map(([r, c], i) => (
            <mesh key={i} position={[0, 1.05, 0.02 + i * 0.004]}>
              <circleGeometry args={[r as number, 28]} />
              <meshStandardMaterial color={c as string} roughness={0.8} />
            </mesh>
          ))}
        </group>
      }
    >
      <PropModel id="target" height={1.6} />
    </WithFallback>
  );
}

/**
 * The archery range: green shooting lanes running away from the court, a roofed
 * shooting line at the front with the "ARCHERY" sign, and targets backed by hay bales.
 */
function ArcheryRange({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["archery-range"]!;
  const wood = useMemo(() => surfaceMaterial("wood", 1, 1, "#7a5232"), []);
  const lanes = Math.max(2, Math.floor(w / 2));
  const laneW = (w - 0.4) / lanes;
  const front = d / 2;
  const back = -d / 2;
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.2, d - 0.2]} />
        <meshStandardMaterial color="#5f9a3a" roughness={0.95} />
      </mesh>
      {Array.from({ length: lanes + 1 }, (_, k) => (
        <mesh key={k} position={[-w / 2 + 0.2 + laneW * k, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, d - 0.4]} />
          <meshStandardMaterial color="#f6f2e6" />
        </mesh>
      ))}
      {/* Targets, each with a hay bale behind and an arrow in it. */}
      {Array.from({ length: lanes }, (_, k) => {
        const x = -w / 2 + 0.2 + laneW * (k + 0.5);
        return (
          <group key={k} position={[x, 0, back + 1.4]}>
            <TargetStand />
            <mesh position={[0, 0.4, -0.7]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 1.2, 12]} />
              <meshStandardMaterial color="#d9b85a" roughness={1} />
            </mesh>
            <mesh position={[0.12 - k * 0.05, 1.08, 0.3]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.65, 5]} />
              <meshStandardMaterial color="#5a3a22" />
            </mesh>
          </group>
        );
      })}
      {/* Side rails along the lanes. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w / 2 - 0.08), 0, 0]}>
          <mesh position={[0, 0.85, 0]} material={wood} castShadow>
            <boxGeometry args={[0.08, 0.08, d - 0.3]} />
          </mesh>
          {Array.from({ length: Math.floor(d / 2.2) + 1 }, (_, k) => (
            <mesh key={k} position={[0, 0.45, back + 0.2 + k * 2.2]} material={wood} castShadow>
              <boxGeometry args={[0.1, 0.9, 0.1]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* The roofed shooting line. */}
      <group position={[0, 0, front - 1.1]}>
        {[-1, 1].flatMap((sx) =>
          [-0.8, 0.8].map((z) => (
            <mesh key={`${sx}${z}`} position={[sx * (w / 2 - 0.3), 1.35, z]} material={wood} castShadow>
              <boxGeometry args={[0.14, 2.7, 0.14]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 2.75, 0]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[w - 0.2, 0.12, 2.1]} />
          <meshStandardMaterial color="#e8731f" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.95, -0.85]} material={wood} castShadow>
          <boxGeometry args={[w - 0.8, 0.1, 0.25]} />
        </mesh>
        <Sign title={info.sign} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(4.6, w - 0.6)} height={Math.min(4.6, w - 0.6) / 3.4} position={[0, 3.55, 1.0]} />
      </group>
      <IconBeacon icon={info.icon} purpose={info.purpose} height={6.2} size={1.8} />
    </group>
  );
}

/** The ping-pong hall: a sports hall with a barrel roof, lit windows, a giant bat and ball on top, "PING PONG" over the doors. */
function PingPongHall({ w, d }: { w: number; d: number }) {
  const info = PLACE_INFO["pingpong-hall"]!;
  const walls = useMemo(() => surfaceMaterial("plaster", w / 1.5, 2, "#f1e4cc"), [w]);
  const trim = useMemo(() => surfaceMaterial("stoneDark", w / 1.4, 0.4, "#c95f1a"), [w]);
  const H = 3.8;
  const front = d / 2 - 0.1;
  const r = d / 2 - 0.1;
  return (
    <group>
      <mesh position={[0, H / 2, 0]} material={walls} castShadow receiveShadow>
        <boxGeometry args={[w - 0.2, H, d - 0.2]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={trim} receiveShadow>
        <boxGeometry args={[w, 0.4, d]} />
      </mesh>
      {/* Barrel roof along the hall. */}
      <mesh position={[0, H, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.48, 1, 1]} castShadow>
        <cylinderGeometry args={[r, r, w, 24]} />
        <meshStandardMaterial color="#e8731f" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Windows along the front, the doors in the middle under a canopy. */}
      {[-1, 1].flatMap((side) =>
        [1.6, 3.0].map((x) => <GlowPane key={`${side}${x}`} w={0.9} h={1.3} position={[side * Math.min(x, w / 2 - 0.7), 2.4, front + 0.01]} colour="#fff0c8" intensity={0.8} />),
      )}
      <GlowPane w={1.8} h={2.3} position={[0, 1.35, front + 0.01]} colour="#ffd99a" intensity={0.9} />
      <mesh position={[0, 2.65, front + 0.5]} castShadow>
        <boxGeometry args={[2.6, 0.12, 1.0]} />
        <meshStandardMaterial color="#c95f1a" roughness={0.7} />
      </mesh>
      <Sign title={info.sign} subtitle={info.tagline} icon={info.icon} purpose={info.purpose} width={Math.min(5.2, w - 1)} height={Math.min(5.2, w - 1) / 3.6} position={[0, H - 0.1, front + 0.08]} />
      {/* A giant bat and ball on the roof. */}
      <group position={[0, H + r * 0.48 + 0.9, 0]} rotation={[0, 0, -0.35]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.14, 28]} />
          <meshStandardMaterial color="#c8302e" roughness={0.6} />
        </mesh>
        <mesh position={[0, -1.25, 0]} castShadow>
          <boxGeometry args={[0.28, 0.9, 0.16]} />
          <meshStandardMaterial color="#b07a46" roughness={0.7} />
        </mesh>
      </group>
      <mesh position={[1.4, H + r * 0.48 + 1.7, 0.2]} castShadow>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} emissive="#ffffff" emissiveIntensity={0.15} />
      </mesh>
      <IconBeacon icon={info.icon} purpose={info.purpose} height={H + r + 3.6} size={1.8} />
    </group>
  );
}

/** A subject region's landmark sign: subject code and name in the region's colours. */
export function LandmarkSign({ object }: { object: WorldObject }) {
  const subject = useRealm((s) => {
    const found = s.curriculum?.subjects.find((x) => x.id === object.subjectId);
    return found ? `${found.code ? `${found.code}|` : "|"}${found.name}` : "";
  });
  if (!subject) return null;
  const [code, name] = subject.split("|");
  const theme = THEME_STYLES[object.theme ?? "arcane"];
  return (
    <Sign
      title={code || name}
      subtitle={code ? name : theme.landmarkName}
      icon="books"
      purpose="study"
      colours={{ main: theme.roof, dark: theme.robe, accent: theme.glow }}
      width={3.6}
      height={1.0}
      position={[0, 0, object.w / 2 + 0.25]}
      mount="posts"
      lift={0.9}
    />
  );
}

/**
 * Draws a purpose building (or the Agora's fountain, the Great Hall, the
 * harbour) for a world object. Returns null for kinds it doesn't handle.
 */
export function CampusBuilding({ object, hub }: { object: WorldObject; hub: HubStyle | null }) {
  const { w, d } = localSize(object);
  switch (object.kind) {
    case "lecture-hall":
      return <LectureTheatre w={w} d={d} />;
    case "library":
      return <Library w={w} d={d} name={object.name} />;
    case "trophy-hall":
      return <TrophyHall w={w} d={d} />;
    case "duel-club":
      return <DuelClub w={w} d={d} />;
    case "bazaar":
      return <Bazaar w={w} d={d} />;
    case "games-hall":
      return <GamesHallBig w={w} d={d} />;
    case "dorm":
      return <Residence w={w} d={d} subtitle={hub?.villageName && hub.villageName !== "Student Village" ? hub.villageName : "Your room on campus"} />;
    case "cauldron":
    case "anvil":
    case "cooking-fire":
      return <CraftStation object={object} />;
    case "group-board":
      return <GroupBoard />;
    case "parkour-tower":
      return <ParkourTower w={w} d={d} />;
    case "archery-range":
      return <ArcheryRange w={w} d={d} />;
    case "pingpong-hall":
      return <PingPongHall w={w} d={d} />;
    case "scenery":
      return <SceneryLandmark object={object} />;
    case "citadel":
    case "exchange-hall":
      return <GreatHall object={object} hub={hub} />;
    case "harbour":
      return <Harbour />;
    case "fountain":
      return (
        <group scale={Math.min(w, d) / 2.2}>
          <Fountain />
        </group>
      );
    default:
      return null;
  }
}
