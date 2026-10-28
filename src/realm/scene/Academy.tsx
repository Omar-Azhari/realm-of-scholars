/**
 * Magical-academy atmosphere for the home campus: enchanted candles that
 * float and bob over the Agora (brightest after dark), and owls wheeling
 * around the Great Hall's towers. Purely ambient; one instanced mesh each.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { World } from "../world/worldGen";
import { mulberry32 } from "../world/worldGen";
import { runtime } from "./runtime";
import { onGameEvent } from "../state/events";
import { useRealm } from "../state/store";

const CANDLES = 44;

export function FloatingCandles({ world, night }: { world: World; night: boolean }) {
  const wax = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const random = mulberry32(world.size * 131 + 7);
    const cx = (world.plaza.x0 + world.plaza.x1) / 2;
    const cz = (world.plaza.z0 + world.plaza.z1) / 2;
    const half = (world.plaza.x1 - world.plaza.x0) / 2;
    return Array.from({ length: CANDLES }, () => {
      const a = random() * Math.PI * 2;
      const r = half * (0.25 + random() * 0.75);
      return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: 3.6 + random() * 1.8, phase: random() * Math.PI * 2, h: 0.22 + random() * 0.14 };
    });
  }, [world]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    spots.forEach((c, i) => {
      const bob = Math.sin(t * 0.9 + c.phase) * 0.18;
      dummy.position.set(c.x, c.y + bob, c.z);
      dummy.rotation.set(Math.sin(t * 0.7 + c.phase) * 0.06, 0, Math.cos(t * 0.6 + c.phase) * 0.06);
      dummy.scale.set(1, c.h / 0.25, 1);
      dummy.updateMatrix();
      wax.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.y += c.h / 2 + 0.06;
      dummy.scale.setScalar(0.9 + Math.sin(t * 9 + c.phase * 3) * 0.12);
      dummy.updateMatrix();
      flames.current?.setMatrixAt(i, dummy.matrix);
    });
    if (wax.current) wax.current.instanceMatrix.needsUpdate = true;
    if (flames.current) flames.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={wax} args={[undefined, undefined, CANDLES]} castShadow={false} frustumCulled={false}>
        <cylinderGeometry args={[0.045, 0.05, 0.25, 8]} />
        <meshStandardMaterial color="#f3ead6" roughness={0.6} emissive="#fff1c8" emissiveIntensity={night ? 0.35 : 0.08} />
      </instancedMesh>
      <instancedMesh ref={flames} args={[undefined, undefined, CANDLES]} frustumCulled={false}>
        <coneGeometry args={[0.035, 0.11, 8]} />
        <meshBasicMaterial color={night ? "#ffd27a" : "#ffe6a8"} toneMapped={false} />
      </instancedMesh>
      {night ? <pointLight position={[(world.plaza.x0 + world.plaza.x1) / 2, 4.2, (world.plaza.z0 + world.plaza.z1) / 2]} color="#ffcf8a" intensity={10} distance={18} decay={1.4} /> : null}
    </group>
  );
}

const OWLS = 3;

function Owl({ index, cx, cz }: { index: number; cx: number; cz: number }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const radius = 7 + index * 2.5;
  const height = 9 + index * 1.4;
  const speed = 0.22 + index * 0.05;
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + index * 2.1;
    if (group.current) {
      group.current.position.set(cx + Math.cos(t) * radius, height + Math.sin(t * 2.3) * 0.6, cz + Math.sin(t) * radius);
      group.current.rotation.y = -t;
      group.current.rotation.z = 0.2;
    }
    // Flap in bursts, then glide.
    const flap = Math.sin(state.clock.elapsedTime * 10 + index) * (Math.sin(state.clock.elapsedTime * 0.7 + index) > 0 ? 0.7 : 0.08);
    if (left.current) left.current.rotation.z = flap;
    if (right.current) right.current.rotation.z = -flap;
  });
  return (
    <group ref={group} scale={0.9}>
      <mesh castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={index % 2 ? "#c8b49a" : "#8a6a4a"} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, 0.08]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color={index % 2 ? "#e8dcc8" : "#a8865e"} roughness={0.9} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.24, 0.2]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshBasicMaterial color="#ffcf3a" toneMapped={false} />
        </mesh>
      ))}
      <group position={[0.14, 0.05, 0]}>
        <mesh ref={right} position={[0.25, 0, 0]}>
          <boxGeometry args={[0.5, 0.03, 0.22]} />
          <meshStandardMaterial color="#6b5038" roughness={0.9} />
        </mesh>
      </group>
      <group position={[-0.14, 0.05, 0]}>
        <mesh ref={left} position={[-0.25, 0, 0]}>
          <boxGeometry args={[0.5, 0.03, 0.22]} />
          <meshStandardMaterial color="#6b5038" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export function Owls({ world }: { world: World }) {
  const hall = world.objects.find((o) => o.kind === "citadel" || o.kind === "exchange-hall");
  if (!hall) return null;
  const cx = hall.x + hall.w / 2;
  const cz = hall.z + hall.d / 2;
  return (
    <>
      {Array.from({ length: OWLS }, (_, i) => (
        <Owl key={i} index={i} cx={cx} cz={cz} />
      ))}
    </>
  );
}

/** When owl post arrives, an owl swoops down to the player, hovers a moment, and flies off. */
export function OwlCourier() {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const flight = useRef<number | null>(null);
  useEffect(
    () =>
      onGameEvent((e) => {
        if (e.type === "owl") flight.current = performance.now() / 1000;
      }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const start = flight.current;
    const t = start === null ? 99 : performance.now() / 1000 - start;
    if (t > 5) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const p = runtime.player;
    // In from high behind, a short hover beside the player, then away over the other shoulder.
    const k = t < 1.8 ? 1 - t / 1.8 : t < 3 ? 0 : (t - 3) / 2;
    const side = t < 3 ? -1 : 1;
    g.position.set(p.x + side * k * 9 + 0.6, 2.4 + k * 9 + Math.sin(t * 6) * 0.05, p.z + k * 6);
    g.rotation.y = t < 3 ? Math.PI * 0.25 : -Math.PI * 0.6;
    const flap = Math.sin(state.clock.elapsedTime * 16) * 0.8;
    if (left.current) left.current.rotation.z = flap;
    if (right.current) right.current.rotation.z = -flap;
  });
  return (
    <group ref={group} visible={false}>
      <mesh castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.18, 0.06]}>
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshStandardMaterial color="#f3ead6" roughness={0.9} />
      </mesh>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.21, 0.18]}>
          <sphereGeometry args={[0.028, 8, 6]} />
          <meshBasicMaterial color="#ffcf3a" toneMapped={false} />
        </mesh>
      ))}
      {/* The letter in its talons. */}
      <mesh position={[0, -0.24, 0.02]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.22, 0.02, 0.15]} />
        <meshStandardMaterial color="#f6ead0" />
      </mesh>
      <mesh position={[0, -0.225, 0.02]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 10]} />
        <meshStandardMaterial color="#a3172b" />
      </mesh>
      <group position={[0.13, 0.05, 0]}>
        <mesh ref={right} position={[0.24, 0, 0]}>
          <boxGeometry args={[0.48, 0.03, 0.2]} />
          <meshStandardMaterial color="#c8b49a" roughness={0.9} />
        </mesh>
      </group>
      <group position={[-0.13, 0.05, 0]}>
        <mesh ref={left} position={[-0.24, 0, 0]}>
          <boxGeometry args={[0.48, 0.03, 0.2]} />
          <meshStandardMaterial color="#c8b49a" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}


/** A black iron cauldron on a little fire, its brew glowing green and bubbling. */
export function CauldronVisual() {
  const bubbles = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    bubbles.current?.children.forEach((b, i) => {
      const k = (t * 0.8 + i * 0.37) % 1;
      b.position.set(Math.sin(i * 2.1) * 0.18, 0.72 + k * 0.35, Math.cos(i * 1.7) * 0.18);
      b.scale.setScalar(0.6 + k * 0.6);
      ((b as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.3, 0.18, Math.sin((i / 3) * Math.PI * 2) * 0.3]} rotation={[0, (-i / 3) * Math.PI * 2, 0.25]}>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.38, 20, 14, 0, Math.PI * 2, Math.PI * 0.22, Math.PI * 0.78]} />
        <meshStandardMaterial color="#222226" metalness={0.7} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.76, 0]}>
        <torusGeometry args={[0.3, 0.03, 8, 24]} />
        <meshStandardMaterial color="#2c2c30" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.29, 24]} />
        <meshBasicMaterial color="#6fe38a" toneMapped={false} />
      </mesh>
      <group ref={bubbles}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshBasicMaterial color="#b8ffc8" transparent toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 0.9, 0]} color="#6fe38a" intensity={3} distance={4} decay={1.8} />
      <mesh position={[0, 0.06, 0]}>
        <coneGeometry args={[0.16, 0.3, 8]} />
        <meshBasicMaterial color="#ff9a3a" toneMapped={false} />
      </mesh>
    </group>
  );
}


/** A door set into a mossy boulder. Sealed: glowing runes. Opened: a dark doorway and a little chest. */
export function SecretDoorVisual({ id }: { id: string }) {
  const open = useRealm((s) => Boolean(s.progress.secrets[id]));
  const rune = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (rune.current) (rune.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(state.clock.elapsedTime * 2) * 0.35;
  });
  return (
    <group>
      <mesh position={[0, 0.7, -0.15]} scale={[1.2, 0.95, 0.9]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color="#6b6e66" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 1.2, 0.1]} scale={[1.1, 0.5, 0.9]}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#4f7a34" roughness={1} flatShading />
      </mesh>
      {/* Door arch. */}
      <mesh position={[0, 0.55, 0.62]}>
        <boxGeometry args={[0.62, 1.1, 0.06]} />
        <meshStandardMaterial color={open ? "#0c0a08" : "#5a4a3a"} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.1, 0.62]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.06, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={open ? "#0c0a08" : "#5a4a3a"} roughness={0.9} />
      </mesh>
      {open ? (
        <group position={[0, 0, 0.9]}>
          <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.4, 0.26, 0.28]} />
            <meshStandardMaterial color="#7a4a24" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.42, 0.06, 0.3]} />
            <meshStandardMaterial color="#d6a419" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ) : (
        <mesh ref={rune} position={[0, 0.75, 0.66]}>
          <ringGeometry args={[0.12, 0.17, 6]} />
          <meshBasicMaterial color="#b48aff" transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}


const GLOW_KINDS = new Set(["citadel", "library", "dorm", "landmark", "trophy-hall", "games-hall", "bazaar", "exchange-hall", "duel-club", "lecture-hall"]);
const GLOW_LIGHTS = 5;

/** At night the buildings nearest the player glow warmly from inside (a few lights, moved as you walk). */
export function NightGlow({ world }: { world: World }) {
  const lights = useRef<Array<THREE.PointLight | null>>([]);
  const spots = useMemo(
    () =>
      world.objects
        .filter((o) => GLOW_KINDS.has(o.kind))
        .map((o) => ({ x: o.x + o.w / 2, z: o.z + o.d / 2, big: o.w >= 4 })),
    [world],
  );
  useFrame((state) => {
    const { x, z } = runtime.player;
    const nearest = spots
      .map((s) => ({ s, d: Math.hypot(s.x - x, s.z - z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, GLOW_LIGHTS);
    lights.current.forEach((l, i) => {
      if (!l) return;
      const n = nearest[i];
      if (!n) {
        l.intensity = 0;
        return;
      }
      l.position.set(n.s.x, 2.2, n.s.z);
      l.intensity = (n.s.big ? 16 : 9) * (0.92 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.08);
      l.distance = n.s.big ? 13 : 8;
    });
  });
  return (
    <>
      {Array.from({ length: GLOW_LIGHTS }, (_, i) => (
        <pointLight key={i} ref={(l) => (lights.current[i] = l)} color="#ffb766" intensity={0} distance={8} decay={1.5} />
      ))}
    </>
  );
}
