/**
 * Visuals for the life-skill nodes: shoreline fishing spots with a small
 * jetty and rippling water, ore rocks with glinting veins, ancient trees,
 * the campfire and the smithing anvil.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NatureModel, PropModel, WithFallback } from "./models";
import { surfaceMaterial } from "./textures";
import { resource } from "../life/catalog";
import type { WorldObject } from "../world/worldGen";

function FishingSpot({ tint }: { tint: string }) {
  const rings = useRef<THREE.Group>(null);
  const fish = useRef<THREE.Mesh>(null);
  const wood = useMemo(() => surfaceMaterial("wood", 1, 0.4, "#9a6a40"), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    rings.current?.children.forEach((child, i) => {
      const k = (t * 0.6 + i / 3) % 1;
      child.scale.setScalar(0.3 + k * 1.1);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    });
    if (fish.current) {
      // Every few seconds a fish leaps out of the water.
      const cycle = (t * 0.35) % 1;
      const jumping = cycle < 0.12;
      fish.current.visible = jumping;
      if (jumping) {
        const k = cycle / 0.12;
        fish.current.position.set(0.15 - k * 0.3, -0.05 + Math.sin(k * Math.PI) * 0.45, 1.1);
        fish.current.rotation.z = (k - 0.5) * 2.2;
      }
    }
  });
  return (
    <group>
      {/* A short jetty reaching over the water (the spot's rotation faces the water, +Z). */}
      <mesh position={[0, 0.12, 0.35]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.06, 1.1]} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, -0.05, 0.8]} material={wood} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
        </mesh>
      ))}
      <group ref={rings} position={[0, -0.02, 1.15]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.32, 0.36, 32]} />
            <meshBasicMaterial color="#e8f6ff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={fish} visible={false} raycast={() => null}>
        <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

function OreRock({ tint }: { tint: string }) {
  const crystals = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + i * 0.4;
        return { p: [Math.cos(a) * 0.28, 0.22 + (i % 3) * 0.1, Math.sin(a) * 0.24] as [number, number, number], r: [i * 0.7, a, 0.5] as [number, number, number], s: 0.07 + (i % 3) * 0.025 };
      }),
    [],
  );
  return (
    <group>
      <WithFallback
        fallback={
          <mesh position={[0, 0.3, 0]} castShadow>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#8a8478" roughness={0.9} />
          </mesh>
        }
      >
        <NatureModel id="rock-e" height={0.75} rotation={0.6} />
      </WithFallback>
      {crystals.map((c, i) => (
        <mesh key={i} position={c.p} rotation={c.r} castShadow>
          <octahedronGeometry args={[c.s, 0]} />
          <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function AncientTree({ tint, id }: { tint: string; id: string }) {
  const model = id === "willow" || id === "yew" ? "tree-a" : "tree-b";
  return (
    <group>
      <WithFallback
        fallback={
          <mesh position={[0, 1.2, 0]} castShadow>
            <icosahedronGeometry args={[0.8, 1]} />
            <meshStandardMaterial color={tint} />
          </mesh>
        }
      >
        <NatureModel id={model} height={3.1} tint={tint} />
      </WithFallback>
      {/* A woodcutter's stump marks it as choppable. */}
      <mesh position={[0.55, 0.12, 0.35]} castShadow>
        <cylinderGeometry args={[0.16, 0.19, 0.24, 9]} />
        <meshStandardMaterial color="#8a5a34" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Campfire() {
  const flames = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    flames.current?.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.18;
      c.rotation.y = t * (0.8 + i * 0.3);
    });
    if (light.current) light.current.intensity = 5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7) * 0.5;
  });
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2).map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.38, 0.07, Math.sin(a) * 0.38]} castShadow>
          <dodecahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color="#7a7468" roughness={1} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.1, 0]} rotation={[0, (i / 3) * Math.PI, Math.PI / 2 - 0.25]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.6, 6]} />
          <meshStandardMaterial color="#5a3a22" roughness={1} />
        </mesh>
      ))}
      <group ref={flames} position={[0, 0.16, 0]}>
        {[
          [0.16, 0.42, "#ffb03a"],
          [0.11, 0.55, "#ff6a1a"],
          [0.07, 0.62, "#fff2a0"],
        ].map(([r, h, c], i) => (
          <mesh key={i} position={[0, (h as number) / 2, 0]} raycast={() => null}>
            <coneGeometry args={[r as number, h as number, 7]} />
            <meshStandardMaterial color={c as string} emissive={c as string} emissiveIntensity={2.6} toneMapped={false} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 0.7, 0]} color="#ff9a3a" intensity={5} distance={6} decay={1.8} />
    </group>
  );
}

function Anvil() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.28, 0.4, 10]} />
        <meshStandardMaterial color="#7a5232" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[0.22, 0.16, 0.18]} />
        <meshStandardMaterial color="#3a3a42" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.52, 0.1, 0.22]} />
        <meshStandardMaterial color="#4a4a54" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <coneGeometry args={[0.07, 0.2, 8]} />
        <meshStandardMaterial color="#4a4a54" metalness={0.75} roughness={0.3} />
      </mesh>
      <WithFallback fallback={null}>
        <PropModel id="barrel" height={0.5} position={[-0.55, 0, 0.25]} />
      </WithFallback>
    </group>
  );
}

export function LifeNodeVisual({ object }: { object: WorldObject }) {
  const r = object.resource ? resource(object.resource) : undefined;
  switch (object.kind) {
    case "fishing-spot":
      return <FishingSpot tint={r?.tint ?? "#9fd8ff"} />;
    case "ore-rock":
      return <OreRock tint={r?.tint ?? "#c87a3a"} />;
    case "tree-node":
      return <AncientTree tint={r?.tint ?? "#4f8a3a"} id={object.resource ?? "oak"} />;
    case "cooking-fire":
      return <Campfire />;
    case "anvil":
      return <Anvil />;
    default:
      return null;
  }
}
