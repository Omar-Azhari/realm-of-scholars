/**
 * Trees and rocks from the KayKit Medieval Hexagon pack (CC0), drawn with
 * one instanced mesh per model so hundreds cost a handful of draw calls.
 * Leaves sway in the wind. The procedural trees in Terrain.tsx are the
 * fallback while these load or if they fail.
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { natureUrl, type NatureModelId } from "./models";
import { groundHeight, type Decor, type World } from "../world/worldGen";

interface ModelParts {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  height: number;
}

/** Bakes a model's meshes into one geometry (they all share the pack's texture atlas). */
function useModelParts(id: NatureModelId, sway: number, clock: { value: number }): ModelParts {
  const { scene } = useGLTF(natureUrl(id));
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const geometries: THREE.BufferGeometry[] = [];
    let material: THREE.Material | null = null;
    scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      for (const name of Object.keys(geometry.attributes)) if (!["position", "normal", "uv"].includes(name)) geometry.deleteAttribute(name);
      geometries.push(geometry);
      material ??= Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    });
    const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)!;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    geometry.translate(0, -box.min.y, 0);
    const base = (material ?? new THREE.MeshStandardMaterial({ color: "#6a8a4a" })) as THREE.MeshStandardMaterial;
    const patched = base.clone();
    if (sway > 0) {
      patched.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = clock;
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
          #else
            float phase = 0.0;
          #endif
          float bend = max(0.0, position.y - 0.25);
          float sway = sin(uTime * 1.5 + phase) * ${sway.toFixed(3)} * bend * bend;
          transformed.x += sway;
          transformed.z += sway * 0.6;`,
        );
      };
      patched.customProgramCacheKey = () => `kaykit-sway-${sway}`;
    }
    return { geometry, material: patched, height: box.max.y - box.min.y };
  }, [scene, sway, clock]);
}

const temp = new THREE.Object3D();
const tint = new THREE.Color();

function Instances({ world, items, parts, targetHeight, flattenRocks = false }: { world: World; items: Decor[]; parts: ModelParts; targetHeight: (d: Decor) => number; flattenRocks?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    items.forEach((item, i) => {
      const s = targetHeight(item) / parts.height;
      temp.position.set(item.x, groundHeight(world, item.x, item.z) - 0.02, item.z);
      temp.rotation.set(0, item.rot, 0);
      temp.scale.set(s, flattenRocks ? s * 0.8 : s, s);
      temp.updateMatrix();
      m.setMatrixAt(i, temp.matrix);
      const v = 0.9 + ((i * 37) % 11) / 50;
      m.setColorAt(i, tint.setRGB(v, v * (0.98 + ((i * 13) % 7) / 100), v * 0.95));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [world, items, parts, targetHeight, flattenRocks]);
  if (items.length === 0) return null;
  return <instancedMesh ref={mesh} args={[parts.geometry, parts.material, items.length]} castShadow receiveShadow={flattenRocks} raycast={() => null} />;
}

/** Splits decor between models deterministically so the forest looks varied. */
function split<T>(items: T[], buckets: number, pick: (item: T, index: number) => number): T[][] {
  const out: T[][] = Array.from({ length: buckets }, () => []);
  items.forEach((item, i) => out[pick(item, i) % buckets].push(item));
  return out;
}

export function ModelTrees({ world }: { world: World }) {
  const clock = useMemo(() => ({ value: 0 }), []);
  const round = useModelParts("tree-b", 0.035, clock);
  const pine = useModelParts("tree-a", 0.03, clock);
  const roundGrove = useModelParts("trees-b", 0.03, clock);
  const pineGrove = useModelParts("trees-a", 0.025, clock);
  const rockA = useModelParts("rock-c", 0, clock);
  const rockB = useModelParts("rock-e", 0, clock);

  useFrame((state) => {
    clock.value = state.clock.elapsedTime;
  });

  const groups = useMemo(() => {
    const conifer = world.trees.filter((t) => t.variant === 1);
    const broad = world.trees.filter((t) => t.variant !== 1);
    // Dense forest (conifers) mixes single pines with small pine groves; broadleaf likewise.
    const [pines, pineGroves] = split(conifer, 2, (_, i) => (i % 4 === 0 ? 1 : 0));
    const [rounds, roundGroves] = split(broad, 2, (_, i) => (i % 5 === 0 ? 1 : 0));
    const [rocksA, rocksB] = split(world.rocks, 2, (_, i) => i);
    return { pines, pineGroves, rounds, roundGroves, rocksA, rocksB };
  }, [world]);

  const treeHeight = useMemo(() => (d: Decor) => 2.3 * d.scale, []);
  const groveHeight = useMemo(() => (d: Decor) => 1.5 * d.scale, []);
  const rockHeight = useMemo(() => (d: Decor) => 0.55 * d.scale, []);

  return (
    <group>
      <Instances world={world} items={groups.rounds} parts={round} targetHeight={treeHeight} />
      <Instances world={world} items={groups.pines} parts={pine} targetHeight={treeHeight} />
      <Instances world={world} items={groups.roundGroves} parts={roundGrove} targetHeight={groveHeight} />
      <Instances world={world} items={groups.pineGroves} parts={pineGrove} targetHeight={groveHeight} />
      <Instances world={world} items={groups.rocksA} parts={rockA} targetHeight={rockHeight} flattenRocks />
      <Instances world={world} items={groups.rocksB} parts={rockB} targetHeight={rockHeight} flattenRocks />
    </group>
  );
}
