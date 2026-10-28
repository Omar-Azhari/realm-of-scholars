/**
 * Visual effects: particle bursts (see vfx.ts) drawn as one instanced mesh,
 * celebration bursts on level-ups, quests and Focus gains, and ambient
 * particles around the player — fireflies at night, drifting pollen by day.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { BOLT_SECONDS, bolts, BURST_LIFETIME, bursts, pruneBursts, spawnBurst, type BurstKind } from "./vfx";
import { runtime } from "./runtime";
import { onGameEvent } from "../state/events";
import { groundHeight, type World } from "../world/worldGen";
import { useRealm } from "../state/store";

const MAX_PARTICLES = 700;

/** How each kind moves: launch speed, upward bias, gravity, size, and how much it glows. */
const MOTION: Record<BurstKind, { speed: number; up: number; gravity: number; size: number; glow: number; spin: boolean }> = {
  sparkle: { speed: 1.6, up: 2.2, gravity: -0.6, size: 0.09, glow: 2.6, spin: true },
  focus: { speed: 0.8, up: 1.6, gravity: -0.4, size: 0.07, glow: 2.2, spin: true },
  hit: { speed: 3.2, up: 1.4, gravity: 7, size: 0.07, glow: 1.8, spin: false },
  splash: { speed: 1.4, up: 3.2, gravity: 9, size: 0.08, glow: 1.2, spin: false },
  chips: { speed: 2.2, up: 2.4, gravity: 9, size: 0.08, glow: 1, spin: true },
  leaves: { speed: 1.2, up: 1.4, gravity: 1.2, size: 0.1, glow: 1, spin: true },
};

/** A stable pseudo-random number per particle, so bursts don't need stored state. */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function Bursts({ world }: { world: World }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    m.count = 0;
  }, []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = performance.now() / 1000;
    pruneBursts(t);
    let n = 0;
    for (const b of bursts) {
      const age = t - b.at;
      if (age < 0) continue;
      const life = age / BURST_LIFETIME;
      const motion = MOTION[b.kind];
      const ground = groundHeight(world, b.x, b.z);
      color.set(b.color).multiplyScalar(motion.glow);
      for (let i = 0; i < b.count && n < MAX_PARTICLES; i++) {
        const seed = b.id * 131 + i;
        const a = hash(seed) * Math.PI * 2;
        const spread = 0.35 + hash(seed + 7) * 0.65;
        const vx = Math.cos(a) * motion.speed * spread;
        const vz = Math.sin(a) * motion.speed * spread;
        const vy = motion.up * (0.5 + hash(seed + 3));
        const x = b.x + vx * age;
        const z = b.z + vz * age;
        const y = Math.max(ground + 0.02, ground + b.y + vy * age - 0.5 * motion.gravity * age * age);
        dummy.position.set(x, y, z);
        const s = motion.size * (1 - life * life) * (0.6 + hash(seed + 11) * 0.8);
        dummy.scale.setScalar(Math.max(0.0001, s));
        if (motion.spin) dummy.rotation.set(age * 6 + i, age * 4, 0);
        else dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix);
        m.setColorAt(n, color);
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Spell bolts: a glowing orb with a short trail, flying from caster to target; a burst where it lands. */
function Bolts({ world }: { world: World }) {
  const orb = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  const landed = useRef(new Set<number>());
  useFrame(() => {
    const t = performance.now() / 1000;
    const live = bolts.filter((b) => t - b.at < BOLT_SECONDS + 0.05);
    bolts.splice(0, bolts.length, ...live);
    const b = live[live.length - 1];
    if (!orb.current || !trail.current) return;
    if (!b) {
      orb.current.visible = false;
      trail.current.visible = false;
      return;
    }
    const k = Math.min(1, (t - b.at) / BOLT_SECONDS);
    const g0 = groundHeight(world, b.from.x, b.from.z);
    const g1 = groundHeight(world, b.to.x, b.to.z);
    const x = b.from.x + (b.to.x - b.from.x) * k;
    const z = b.from.z + (b.to.z - b.from.z) * k;
    const y = g0 + b.from.y + (g1 + b.to.y - g0 - b.from.y) * k + Math.sin(k * Math.PI) * 0.4;
    orb.current.visible = true;
    orb.current.position.set(x, y, z);
    (orb.current.material as THREE.MeshBasicMaterial).color.set(b.color).multiplyScalar(3);
    trail.current.visible = true;
    const back = Math.max(0, k - 0.25);
    const bx = b.from.x + (b.to.x - b.from.x) * back;
    const bz = b.from.z + (b.to.z - b.from.z) * back;
    const by = g0 + b.from.y + (g1 + b.to.y - g0 - b.from.y) * back + Math.sin(back * Math.PI) * 0.4;
    const mid = new THREE.Vector3((x + bx) / 2, (y + by) / 2, (z + bz) / 2);
    const dir = new THREE.Vector3(x - bx, y - by, z - bz);
    const len = Math.max(0.01, dir.length());
    trail.current.position.copy(mid);
    trail.current.scale.set(1, len, 1);
    trail.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    (trail.current.material as THREE.MeshBasicMaterial).color.set(b.color).multiplyScalar(2);
    if (k >= 1 && !landed.current.has(b.id)) {
      landed.current.add(b.id);
      spawnBurst("sparkle", b.to.x, b.to.y, b.to.z, b.color, 22);
    }
  });
  return (
    <>
      <mesh ref={orb} visible={false} frustumCulled={false}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh ref={trail} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.02, 0.06, 1, 8, 1, true]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Celebrations at the player for progress made anywhere in the game. */
function CelebrationBursts() {
  useEffect(
    () =>
      onGameEvent((event) => {
        const { x, z } = runtime.player;
        if (event.type === "level-up") {
          spawnBurst("sparkle", x, 0.4, z);
          window.setTimeout(() => spawnBurst("sparkle", runtime.player.x, 1.2, runtime.player.z, "#fff2b0", 30), 180);
        } else if (event.type === "quest-complete" || event.type === "graduated") {
          spawnBurst("sparkle", x, 0.4, z, "#ffd45a", 60);
          window.setTimeout(() => spawnBurst("sparkle", runtime.player.x, 1.4, runtime.player.z, "#ff8a5a", 40), 220);
        } else if (event.type === "focus" && event.amount > 0) {
          spawnBurst("focus", x, 1.1, z);
        }
      }),
    [],
  );
  return null;
}

/** Fireflies after dark, pollen and dust motes in daylight — always around the player. */
function Ambient({ night }: { night: boolean }) {
  const group = useRef<THREE.Group>(null);
  const calm = useRealm((s) => s.settings.reduceMotion);
  useFrame(() => {
    if (group.current) group.current.position.set(runtime.player.x, 0, runtime.player.z);
  });
  if (calm) return null;
  return (
    <group ref={group}>
      {night ? (
        <Sparkles count={70} scale={[26, 3.2, 26]} position={[0, 1.6, 0]} size={7} speed={0.35} opacity={0.95} color="#ffe27a" noise={1.2} />
      ) : (
        <Sparkles count={40} scale={[22, 4, 22]} position={[0, 2, 0]} size={2.4} speed={0.18} opacity={0.5} color="#fffbe8" noise={0.8} />
      )}
    </group>
  );
}

export function Effects({ world, night, ambient = true }: { world: World; night: boolean; ambient?: boolean }) {
  return (
    <>
      <Bursts world={world} />
      <Bolts world={world} />
      <CelebrationBursts />
      {ambient ? <Ambient night={night} /> : null}
    </>
  );
}
