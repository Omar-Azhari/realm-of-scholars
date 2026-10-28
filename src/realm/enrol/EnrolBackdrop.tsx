/**
 * A slowly orbiting 3D diorama behind the title and enrolment screens:
 * the Great Hall on a small island at dusk, surrounded by the subject
 * buildings and trees you'll find in the realm. Purely decorative; every
 * model falls back to nothing while it loads.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BuildingModel, NatureModel, WithFallback, type BuildingModelId, type NatureModelId } from "../scene/models";

const RING: Array<{ id: BuildingModelId; angle: number; r: number; span: number }> = [
  { id: "tower-blue", angle: 0.4, r: 7.5, span: 2.8 },
  { id: "library-red", angle: 1.5, r: 8, span: 3.4 },
  { id: "windmill-green", angle: 2.6, r: 7.8, span: 3 },
  { id: "blacksmith-red", angle: 3.7, r: 7.6, span: 3 },
  { id: "market-yellow", angle: 4.8, r: 7.8, span: 3 },
  { id: "church-blue", angle: 5.7, r: 7.4, span: 3 },
];

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

function Diorama() {
  const trees = useMemo(() => {
    const r = seeded(7);
    return Array.from({ length: 34 }, () => {
      const angle = r() * Math.PI * 2;
      const dist = 4.5 + r() * 9;
      const near = RING.some((b) => Math.abs(((b.angle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35 && Math.abs(b.r - dist) < 2);
      return near ? null : { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, h: 1.6 + r() * 1.4, id: (r() < 0.55 ? "tree-a" : "tree-b") as NatureModelId, rot: r() * 6 };
    }).filter((t): t is NonNullable<typeof t> => t !== null);
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[15, 64]} />
        <meshStandardMaterial color="#5f8a3e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[4.2, 48]} />
        <meshStandardMaterial color="#9a9182" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <circleGeometry args={[80, 48]} />
        <meshStandardMaterial color="#17304a" roughness={0.3} metalness={0.2} />
      </mesh>
      <WithFallback fallback={null}>
        <BuildingModel id="castle" span={6} />
      </WithFallback>
      {RING.map((b) => (
        <group key={b.id} position={[Math.cos(b.angle) * b.r, 0, Math.sin(b.angle) * b.r]} rotation={[0, Math.atan2(-Math.cos(b.angle), -Math.sin(b.angle)), 0]}>
          <WithFallback fallback={null}>
            <BuildingModel id={b.id} span={b.span} />
          </WithFallback>
        </group>
      ))}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <WithFallback fallback={null}>
            <NatureModel id={t.id} height={t.h} rotation={t.rot} />
          </WithFallback>
        </group>
      ))}
    </group>
  );
}

function OrbitCamera({ close }: { close: boolean }) {
  const angle = useRef(0.6);
  const look = useMemo(() => new THREE.Vector3(), []);
  const shift = useRef(0);
  const shiftY = useRef(0);
  useFrame(({ camera, size, scene }, delta) => {
    angle.current += Math.min(delta, 0.1) * 0.05;
    // Title screen: the town is the key art, framed right of the menu. Behind the forms: closer and centred.
    // Tall (portrait) windows need the camera further back to fit the town's width.
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 1.3 ? 1.3 / Math.max(0.5, aspect) : 1;
    const r = (close ? 30 : 36) * fit;
    const target = new THREE.Vector3(Math.cos(angle.current) * r, (close ? 10 : 10.5) * Math.sqrt(fit), Math.sin(angle.current) * r);
    camera.position.lerp(target, 0.05);
    // Fog scales with the camera distance, so a far-back (portrait) camera doesn't wash the town out.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = r * 0.95;
      scene.fog.far = r * 2.8;
    }
    look.lerp(new THREE.Vector3(0, close ? 4 : 3.2, 0), 0.05);
    camera.lookAt(look);
    // Slide the frame so the town sits in the right-hand part of a wide screen, clear of the menu.
    // On a tall phone screen it sits in the upper half instead, above the menu.
    const want = !close && aspect > 1.2 ? -0.15 : 0;
    const wantY = !close && aspect < 0.8 ? 0.2 : 0;
    shift.current += (want - shift.current) * Math.min(1, delta * 3);
    shiftY.current += (wantY - shiftY.current) * Math.min(1, delta * 3);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(shift.current) > 0.001 || Math.abs(shiftY.current) > 0.001) {
      cam.setViewOffset(size.width, size.height, shift.current * size.width, shiftY.current * size.height, size.width, size.height);
    } else if (cam.view) cam.clearViewOffset();
  });
  return null;
}

export function EnrolBackdrop({ close = false }: { close?: boolean }) {
  return (
    <div className="enrol-backdrop" aria-hidden="true">
      <Canvas shadows dpr={[1, 1.25]} camera={{ fov: 38, position: [26, 10, 20] }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
        <fog attach="fog" args={["#2b2a3c", 34, 100]} />
        <hemisphereLight args={["#ffe2c8", "#4a4a6a", 1.1]} />
        <directionalLight position={[18, 14, 10]} color="#ffc48a" intensity={2.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} />
        <Diorama />
        <OrbitCamera close={close} />
      </Canvas>
    </div>
  );
}
