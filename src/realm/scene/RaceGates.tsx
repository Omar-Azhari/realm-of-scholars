/**
 * The Island Race in 3D: drives the race clock each frame and draws the
 * gates — a glowing hoop for every gate still to pass, with a beam of light
 * over the next one so it can be seen from across the island.
 */

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { race, SKY_GATE_HEIGHT, tickRace } from "../arcade/race";
import { runtime, WALK_SPEED } from "./runtime";
import { groundHeight, type World } from "../world/worldGen";

export function RaceDriver() {
  useFrame((_, raw) => {
    tickRace(Math.min(raw, 0.1), runtime.player.x, runtime.player.z, WALK_SPEED, runtime.player.flying);
  });
  return null;
}

export function RaceGates({ world }: { world: World }) {
  const [version, setVersion] = useState(race.version);
  useFrame(() => {
    if (race.version !== version) setVersion(race.version);
  });
  const run = race.run;
  if (!run || run.done) return null;
  return (
    <>
      {run.gates.map((g, i) =>
        // Passed gates vanish; the finish (back at the start) only appears once it's the next gate.
        i < run.next || (i === run.gates.length - 1 && i !== run.next) ? null : <Gate key={`${version}-${i}`} x={g.x} z={g.z} y={groundHeight(world, g.x, g.z) + (run.sky && i < run.gates.length - 1 ? SKY_GATE_HEIGHT : 0)} next={i === run.next} finish={i === run.gates.length - 1} />,
      )}
    </>
  );
}

function Gate({ x, z, y, next, finish }: { x: number; z: number; y: number; next: boolean; finish: boolean }) {
  const hoop = useRef<THREE.Mesh>(null);
  const color = finish ? "#ffd45a" : next ? "#7fe8ff" : "#6a8aa8";
  useFrame((state) => {
    if (!hoop.current) return;
    // Turn to face the player so the hoop always reads as a gate.
    hoop.current.rotation.y = Math.atan2(runtime.player.x - x, runtime.player.z - z);
    if (next) hoop.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.06);
  });
  return (
    <group position={[x, y, z]}>
      <mesh ref={hoop} position={[0, 1.4, 0]}>
        <torusGeometry args={[1.25, next ? 0.11 : 0.07, 10, 40]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={next ? 2.4 : 0.6} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.2, 1.5, 36]} />
        <meshBasicMaterial color={color} transparent opacity={next ? 0.7 : 0.3} depthWrite={false} />
      </mesh>
      {next ? (
        <>
          <mesh position={[0, 9, 0]}>
            <cylinderGeometry args={[0.35, 0.6, 18, 16, 1, true]} />
            <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 1.6, 0]} color={color} intensity={6} distance={7} decay={1.6} />
        </>
      ) : null}
    </group>
  );
}
