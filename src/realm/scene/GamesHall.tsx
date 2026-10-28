/**
 * The games hall: a striped carnival pavilion in the Agora with a game
 * table under it and a chequered race flag beside it, so it reads as "the
 * place to play" from across the plaza.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PropModel, WithFallback } from "./models";

const STRIPES = 10;
const RADIUS = 1.45;

export function GamesHall() {
  const flag = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (flag.current) flag.current.rotation.y = Math.sin(state.clock.elapsedTime * 2.2) * 0.25;
  });
  return (
    <group>
      {/* Floor boards. */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[RADIUS + 0.1, RADIUS + 0.15, 0.08, STRIPES]} />
        <meshStandardMaterial color="#8a6340" roughness={0.9} />
      </mesh>
      {/* Posts. */}
      {Array.from({ length: STRIPES / 2 }, (_, i) => {
        const a = (i / (STRIPES / 2)) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * RADIUS, 0.85, Math.sin(a) * RADIUS]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 1.7, 8]} />
            <meshStandardMaterial color="#e8d6b0" roughness={0.6} />
          </mesh>
        );
      })}
      {/* Striped cone roof. */}
      {Array.from({ length: STRIPES }, (_, i) => (
        <mesh key={i} position={[0, 2.2, 0]} castShadow>
          <coneGeometry args={[RADIUS + 0.25, 1.1, 3, 1, true, (i / STRIPES) * Math.PI * 2, (Math.PI * 2) / STRIPES]} />
          <meshStandardMaterial color={i % 2 ? "#f3e6c8" : "#c8302e"} side={THREE.DoubleSide} roughness={0.75} />
        </mesh>
      ))}
      {/* Scalloped valance. */}
      {Array.from({ length: STRIPES * 2 }, (_, i) => {
        const a = ((i + 0.5) / (STRIPES * 2)) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * (RADIUS + 0.2), 1.6, Math.sin(a) * (RADIUS + 0.2)]} rotation={[0, -a + Math.PI / 2, 0]}>
            <circleGeometry args={[0.17, 12, 0, Math.PI]} />
            <meshStandardMaterial color={i % 2 ? "#ffcf3a" : "#c8302e"} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshStandardMaterial color="#ffcf3a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Pennant on top. */}
      <mesh position={[0, 3.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#5a4030" />
      </mesh>
      <mesh ref={flag} position={[0, 3.35, 0]}>
        <planeGeometry args={[0.45, 0.25]} />
        <meshStandardMaterial color="#ffcf3a" side={THREE.DoubleSide} emissive="#ffcf3a" emissiveIntensity={0.2} />
      </mesh>
      {/* Game table: a little board with pieces. */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.1, 0.08, 0.8]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.9, 0.42, 0.6]} />
        <meshStandardMaterial color="#5a3e26" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.62]} />
        <meshStandardMaterial map={boardTexture()} roughness={0.7} />
      </mesh>
      {[
        [-0.25, -0.1, "#ff6a4a"],
        [0.12, 0.14, "#ffe28a"],
        [0.3, -0.16, "#7fd8ff"],
      ].map(([x, z, c], i) => (
        <mesh key={i} position={[x as number, 0.56, z as number]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.11, 10]} />
          <meshStandardMaterial color={c as string} roughness={0.4} />
        </mesh>
      ))}
      {/* Race flag outside. */}
      <group position={[1.2, 0, 1.2]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 1.8, 8]} />
          <meshStandardMaterial color="#d8d8d8" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.28, 1.58, 0]}>
          <planeGeometry args={[0.55, 0.38]} />
          <meshStandardMaterial map={chequerTexture()} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <WithFallback fallback={null}>
        <PropModel id="barrel" height={0.55} position={[-1.15, 0, 1.15]} rotation={0.5} />
        <PropModel id="crate" height={0.4} position={[-1.2, 0, -1.15]} rotation={0.2} />
      </WithFallback>
    </group>
  );
}

let board: THREE.Texture | null = null;
function boardTexture(): THREE.Texture {
  if (board) return board;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 88;
  const g = c.getContext("2d")!;
  g.fillStyle = "#669443";
  g.fillRect(0, 0, 128, 88);
  g.fillStyle = "#c29560";
  // A winding path like the tower-defence board.
  g.fillRect(0, 12, 34, 14);
  g.fillRect(22, 12, 14, 56);
  g.fillRect(22, 56, 50, 14);
  g.fillRect(60, 22, 14, 48);
  g.fillRect(60, 22, 68, 14);
  board = new THREE.CanvasTexture(c);
  board.colorSpace = THREE.SRGBColorSpace;
  return board;
}

let chequer: THREE.Texture | null = null;
function chequerTexture(): THREE.Texture {
  if (chequer) return chequer;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 44;
  const g = c.getContext("2d")!;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
    g.fillStyle = (x + y) % 2 ? "#111" : "#f4f4f4";
    g.fillRect(x * 11, y * 11, 11, 11);
  }
  chequer = new THREE.CanvasTexture(c);
  chequer.colorSpace = THREE.SRGBColorSpace;
  chequer.magFilter = THREE.NearestFilter;
  return chequer;
}
