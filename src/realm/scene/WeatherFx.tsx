/**
 * Weather in the 3D scene: rain streaks around the player, lightning flashes
 * with thunder in storms. (Fog distance and light are set by the scene.)
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { runtime } from "./runtime";
import { realmStore } from "../state/store";
import { emit } from "../state/events";
import type { Weather } from "./weather";

const DROPS = 900;

function Rain({ heavy }: { heavy: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => Array.from({ length: DROPS }, () => ({ x: (Math.random() - 0.5) * 36, y: Math.random() * 14, z: (Math.random() - 0.5) * 36, v: 14 + Math.random() * 6 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const m = mesh.current;
    if (!m) return;
    // No rain indoors (the roof lifts away so you can see in, but you're still under it).
    m.visible = runtime.room === null;
    if (!m.visible) return;
    const { x: px, z: pz } = runtime.player;
    drops.forEach((d, i) => {
      d.y -= d.v * dt;
      d.x += (heavy ? -4 : -1.5) * dt;
      if (d.y < 0) {
        d.y = 12 + Math.random() * 3;
        d.x = (Math.random() - 0.5) * 36;
        d.z = (Math.random() - 0.5) * 36;
      }
      dummy.position.set(px + d.x, d.y, pz + d.z);
      dummy.rotation.set(0, 0, heavy ? 0.25 : 0.1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} frustumCulled={false}>
      <boxGeometry args={[0.012, 0.45, 0.012]} />
      <meshBasicMaterial color="#b8cfe8" transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}

function Lightning() {
  const light = useRef<THREE.PointLight>(null);
  const next = useRef(4 + Math.random() * 6);
  const flash = useRef(0);
  useFrame((state, raw) => {
    const t = state.clock.elapsedTime;
    if (t > next.current) {
      next.current = t + 6 + Math.random() * 10;
      flash.current = 0.35;
      window.setTimeout(() => emit({ type: "sound", name: "thunder" }), 600 + Math.random() * 900);
    }
    flash.current = Math.max(0, flash.current - raw);
    if (light.current) {
      light.current.intensity = flash.current > 0 ? (Math.sin(flash.current * 60) > 0 ? 1200 : 300) : 0;
      light.current.position.set(runtime.player.x + 20, 40, runtime.player.z - 10);
    }
  });
  return <pointLight ref={light} color="#dfe8ff" intensity={0} distance={200} decay={0.8} />;
}

export function WeatherFx({ weather }: { weather: Weather }) {
  const calm = realmStore.get().settings.reduceMotion;
  return (
    <>
      {weather === "rain" || weather === "storm" ? <Rain heavy={weather === "storm"} /> : null}
      {weather === "storm" && !calm ? <Lightning /> : null}
    </>
  );
}
