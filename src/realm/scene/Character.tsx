/**
 * Smooth-shaded fantasy adventurer: capsule limbs, a flared tunic turned on
 * a lathe, a rounded head with hair, eyes and nose, leather boots and a
 * cape that billows as they walk. Animated procedurally — legs and arms
 * swing while `movingRef.current` is true; a gentle breath while idle.
 */

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group, Mesh } from "three";
import type { PlayerLook } from "../types";

interface CharacterProps {
  look: PlayerLook;
  movingRef?: MutableRefObject<boolean>;
  robe?: boolean;
  hat?: "wizard" | "hood" | "none";
  staff?: boolean;
  /** Random phase so crowds don't animate in lockstep. */
  phase?: number;
}

const tunicProfile = (flare: number, length: number) =>
  [
    [0.0, 0.0],
    [0.17 + flare, 0.0],
    [0.16 + flare * 0.6, length * 0.25],
    [0.15, length * 0.55],
    [0.17, length * 0.78],
    [0.19, length * 0.92],
    [0.12, length],
    [0.0, length],
  ].map(([x, y]) => new THREE.Vector2(x, y));

const geometries = {
  tunic: new THREE.LatheGeometry(tunicProfile(0.03, 0.52), 18),
  robe: new THREE.LatheGeometry(tunicProfile(0.14, 0.95), 18),
  limb: new THREE.CapsuleGeometry(0.058, 0.26, 6, 12),
  leg: new THREE.CapsuleGeometry(0.068, 0.3, 6, 12),
  hand: new THREE.SphereGeometry(0.05, 12, 10),
  head: new THREE.SphereGeometry(0.135, 24, 18),
  hair: new THREE.SphereGeometry(0.145, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
  eye: new THREE.SphereGeometry(0.018, 8, 6),
  nose: new THREE.ConeGeometry(0.018, 0.05, 8),
  neck: new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10),
  boot: new THREE.CapsuleGeometry(0.065, 0.08, 4, 10),
  belt: new THREE.TorusGeometry(0.165, 0.022, 8, 24),
  shoulder: new THREE.SphereGeometry(0.075, 12, 10),
};

function capeGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.42, 0.68, 6, 8);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (0.34 - y) / 0.68;
    pos.setX(i, x * (1 + t * 0.35));
    pos.setZ(i, -Math.cos((x / 0.21) * Math.PI * 0.5) * 0.05 - t * 0.04);
  }
  g.translate(0, -0.34, 0);
  g.computeVertexNormals();
  return g;
}
const capeGeom = capeGeometry();

function Mat({ color, roughness = 0.75, emissive }: { color: string; roughness?: number; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={roughness} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.8 : 0} />;
}

export function Character({ look, movingRef, robe = false, hat = "none", staff = false, phase = 0 }: CharacterProps) {
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const body = useRef<Group>(null);
  const cape = useRef<Mesh>(null);
  const swing = useRef(0);

  const boot = "#4a321f";
  const trim = useMemo(() => new THREE.Color(look.tunic).multiplyScalar(0.6).getStyle(), [look.tunic]);

  useFrame((state, delta) => {
    const moving = movingRef?.current ?? false;
    const t = state.clock.elapsedTime + phase;
    swing.current += ((moving ? 1 : 0) - swing.current) * Math.min(1, delta * 9);
    const s = Math.sin(t * 10) * 0.6 * swing.current;
    const idle = (1 - swing.current) * Math.sin(t * 1.7);
    if (leftLeg.current) leftLeg.current.rotation.x = s;
    if (rightLeg.current) rightLeg.current.rotation.x = -s;
    if (leftArm.current) {
      leftArm.current.rotation.x = -s * 0.85;
      leftArm.current.rotation.z = 0.08 + idle * 0.02;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = s * 0.85;
      rightArm.current.rotation.z = -0.08 - idle * 0.02;
    }
    if (body.current) {
      body.current.position.y = Math.abs(Math.sin(t * 10)) * 0.035 * swing.current + idle * 0.006;
      body.current.rotation.x = swing.current * 0.06;
    }
    if (cape.current) cape.current.rotation.x = 0.1 + swing.current * 0.35 + Math.sin(t * 3.2) * 0.05;
  });

  return (
    <group ref={body}>
      {/* Legs + boots (under a long robe for scholars) */}
      {robe ? (
        <mesh geometry={geometries.robe} position={[0, 0.02, 0]} castShadow>
          <Mat color={look.tunic} roughness={0.85} />
        </mesh>
      ) : (
        <>
          {[-0.085, 0.085].map((x, i) => (
            <group key={x} ref={i === 0 ? leftLeg : rightLeg} position={[x, 0.5, 0]}>
              <mesh geometry={geometries.leg} position={[0, -0.21, 0]} castShadow>
                <Mat color={look.legs} roughness={0.85} />
              </mesh>
              <mesh geometry={geometries.boot} position={[0, -0.44, 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <Mat color={boot} roughness={0.6} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* Torso */}
      {robe ? null : (
        <mesh geometry={geometries.tunic} position={[0, 0.42, 0]} scale={[1, 1, 0.78]} castShadow>
          <Mat color={look.tunic} roughness={0.85} />
        </mesh>
      )}
      {robe ? (
        <mesh geometry={geometries.tunic} position={[0, 0.5, 0]} scale={[0.95, 0.9, 0.75]} castShadow>
          <Mat color={look.tunic} roughness={0.85} />
        </mesh>
      ) : null}
      <mesh geometry={geometries.belt} position={[0, robe ? 0.6 : 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.78, 1]}>
        <Mat color="#5a3a1e" roughness={0.5} />
      </mesh>
      <mesh position={[0, robe ? 0.6 : 0.55, 0.13]}>
        <boxGeometry args={[0.06, 0.05, 0.02]} />
        <meshStandardMaterial color="#d8b04a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh geometry={geometries.belt} position={[0, 0.925, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.75, 0.6, 0.6]}>
        <Mat color={trim} />
      </mesh>

      {/* Arms */}
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.215, 0.88, 0]}>
          <mesh geometry={geometries.shoulder} castShadow>
            <Mat color={look.tunic} roughness={0.85} />
          </mesh>
          <mesh geometry={geometries.limb} position={[0, -0.18, 0]} castShadow>
            <Mat color={look.tunic} roughness={0.85} />
          </mesh>
          <mesh geometry={geometries.hand} position={[0, -0.36, 0.01]} castShadow>
            <Mat color={look.skin} roughness={0.6} />
          </mesh>
          {staff && side > 0 ? (
            <group position={[0, -0.36, 0.05]}>
              <mesh position={[0, 0.28, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.028, 1.25, 8]} />
                <meshStandardMaterial color="#5a3d22" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.94, 0]}>
                <icosahedronGeometry args={[0.065, 1]} />
                <meshStandardMaterial color="#bfe6ff" emissive="#6ab8ff" emissiveIntensity={2} roughness={0.2} />
              </mesh>
            </group>
          ) : null}
        </group>
      ))}

      {/* Neck + head */}
      <mesh geometry={geometries.neck} position={[0, 0.97, 0]}>
        <Mat color={look.skin} roughness={0.6} />
      </mesh>
      <group position={[0, 1.12, 0]}>
        <mesh geometry={geometries.head} scale={[0.95, 1.05, 1]} castShadow>
          <Mat color={look.skin} roughness={0.55} />
        </mesh>
        {[-0.045, 0.045].map((x) => (
          <mesh key={x} geometry={geometries.eye} position={[x, 0.015, 0.122]}>
            <meshStandardMaterial color="#1d1410" roughness={0.2} />
          </mesh>
        ))}
        <mesh geometry={geometries.nose} position={[0, -0.02, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
          <Mat color={look.skin} roughness={0.6} />
        </mesh>
        {hat === "none" ? (
          <mesh geometry={geometries.hair} position={[0, 0.012, -0.012]} rotation={[-0.35, 0, 0]} castShadow>
            <Mat color={look.hair} roughness={0.9} />
          </mesh>
        ) : null}
        {hat === "wizard" ? (
          <group position={[0, 0.1, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.24, 0.25, 0.025, 24]} />
              <Mat color={look.cape} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.2, -0.03]} rotation={[-0.18, 0, 0.05]} castShadow>
              <coneGeometry args={[0.13, 0.42, 20]} />
              <Mat color={look.cape} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <torusGeometry args={[0.135, 0.015, 6, 20]} />
              <meshStandardMaterial color="#d8b04a" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        ) : null}
        {hat === "hood" ? (
          <mesh position={[0, 0.02, -0.02]} scale={[1.12, 1.14, 1.12]} castShadow>
            <sphereGeometry args={[0.145, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
            <Mat color={look.cape} roughness={0.9} />
          </mesh>
        ) : null}
      </group>

      {/* Cape */}
      <mesh ref={cape} geometry={capeGeom} position={[0, 0.92, -0.11]} castShadow>
        <meshStandardMaterial color={look.cape} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
