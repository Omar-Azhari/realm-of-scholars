/**
 * Ground, water and scenery.
 *
 * The ground is a smooth, subdivided heightmap: colours blend softly
 * between tiles, a detail texture breaks up flat areas, and the central
 * plaza is laid with cobblestones. Trees are organic clusters, grass tufts
 * sway in the wind, the water ripples and reflects the sky. Everything is
 * instanced so the whole island stays at a handful of draw calls.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GROUND, TILE, groundHeight, mulberry32, type World } from "../world/worldGen";
import { THEME_STYLES } from "../world/themes";
import { groundDetailTexture, surface, surfaceMaterial, waterNormalTexture } from "./textures";
import { PropModel, WithFallback } from "./models";
import { ModelTrees } from "./Nature";

const BASE: Record<number, [number, number, number]> = {
  [TILE.grass]: [0.27, 0.46, 0.15],
  [TILE.path]: [0.6, 0.48, 0.32],
  [TILE.plaza]: [0.62, 0.6, 0.55],
  [TILE.water]: [0.42, 0.38, 0.28],
  [TILE.sand]: [0.86, 0.78, 0.56],
  [TILE.dirt]: [0.52, 0.42, 0.28],
};

/** Open-country grass by area (see GROUND in worldGen.ts): plain, meadow, bushland, forest floor, campus lawn. */
const GROUND_COLOUR: Record<number, [number, number, number] | undefined> = {
  [GROUND.meadow]: [0.4, 0.54, 0.19],
  [GROUND.bush]: [0.39, 0.42, 0.21],
  [GROUND.forest]: [0.2, 0.36, 0.13],
  [GROUND.lawn]: [0.25, 0.52, 0.17],
};

function tileHash(x: number, z: number): number {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export function tileColor(world: World, x: number, z: number): [number, number, number] {
  const cx = Math.max(0, Math.min(world.size - 1, x));
  const cz = Math.max(0, Math.min(world.size - 1, z));
  const i = cz * world.size + cx;
  const kind = world.kinds[i];
  let [r, g, b] = BASE[kind] ?? BASE[TILE.grass];
  const region = world.regionOf[i];
  if (kind === TILE.grass && region > 0) {
    const theme = world.regions[region - 1]?.theme;
    if (theme) [r, g, b] = THEME_STYLES[theme].ground;
  } else if (kind === TILE.grass && world.landscape) {
    const zone = GROUND_COLOUR[world.landscape.ground[i]];
    if (zone) [r, g, b] = zone;
    // Hilltops catch the sun: a little lighter and warmer the higher the ground.
    const h = world.heights[cz * (world.size + 1) + cx];
    if (h > 0.8) {
      const t = Math.min(1, (h - 0.8) / 3) * 0.35;
      r += (0.5 - r) * t;
      g += (0.56 - g) * t;
      b += (0.26 - b) * t;
    }
  }
  const jitter = 0.94 + tileHash(cx, cz) * 0.1;
  return [r * jitter, g * jitter, b * jitter];
}

/** Raw (unclamped) bilinear height, used for building the mesh. */
function rawHeight(world: World, x: number, z: number): number {
  const corner = world.size + 1;
  const cx = Math.max(0, Math.min(world.size - 0.0001, x));
  const cz = Math.max(0, Math.min(world.size - 0.0001, z));
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const tx = cx - x0;
  const tz = cz - z0;
  const h = (ix: number, iz: number) => world.heights[iz * corner + ix];
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = h(x0, z0) * (1 - sx) + h(x0 + 1, z0) * sx;
  const b2 = h(x0, z0 + 1) * (1 - sx) + h(x0 + 1, z0 + 1) * sx;
  return a * (1 - sz) + b2 * sz;
}

interface TerrainProps {
  world: World;
  onGroundClick: (x: number, z: number, event: ThreeEvent<MouseEvent>) => void;
  onGroundContext: (x: number, z: number, event: ThreeEvent<MouseEvent>) => void;
  onGroundHover: () => void;
}

/** Ground vertices per tile edge: 3 on small islands, 2 on the big home campus (half the triangles, same look). */
const subdivisions = (size: number) => (size > 120 ? 2 : 3);

export function Terrain({ world, onGroundClick, onGroundContext, onGroundHover }: TerrainProps) {
  const visual = useMemo(() => {
    const SUB = subdivisions(world.size);
    const n = world.size * SUB + 1;
    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const paved = new Float32Array(n * n);
    const uvs = new Float32Array(n * n * 2);
    const random = mulberry32(world.size * 7919);
    const tileColors: Array<[number, number, number]> = [];
    for (let tz = 0; tz < world.size; tz++) for (let tx = 0; tx < world.size; tx++) tileColors.push(tileColor(world, tx, tz));
    const colorAt = (tx: number, tz: number) => tileColors[Math.max(0, Math.min(world.size - 1, tz)) * world.size + Math.max(0, Math.min(world.size - 1, tx))];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = i / SUB;
        const z = j / SUB;
        let y = rawHeight(world, x, z);
        const tile = { x: Math.floor(Math.min(x, world.size - 0.001)), z: Math.floor(Math.min(z, world.size - 0.001)) };
        const kind = world.kinds[tile.z * world.size + tile.x];
        if (y > 0.06 && kind === TILE.grass) y += (random() - 0.5) * 0.06;
        // Colour: Gaussian blend of nearby tiles, so paths and shores get soft, organic edges.
        let r = 0;
        let g = 0;
        let b = 0;
        let wsum = 0;
        let pave = 0;
        for (let tz = Math.floor(z - 1.5); tz <= Math.floor(z + 1.5); tz++) {
          for (let tx = Math.floor(x - 1.5); tx <= Math.floor(x + 1.5); tx++) {
            const dx = tx + 0.5 - x;
            const dz = tz + 0.5 - z;
            const w = Math.exp(-(dx * dx + dz * dz) / 0.6);
            const c = colorAt(tx, tz);
            const k = world.kinds[Math.max(0, Math.min(world.size - 1, tz)) * world.size + Math.max(0, Math.min(world.size - 1, tx))];
            if (k === TILE.path || k === TILE.plaza) pave += w;
            r += c[0] * w;
            g += c[1] * w;
            b += c[2] * w;
            wsum += w;
          }
        }
        const k = 0.92 / wsum;
        const v = (j * n + i) * 3;
        positions[v] = x;
        positions[v + 1] = y;
        positions[v + 2] = z;
        colors[v] = r * k;
        colors[v + 1] = g * k;
        colors[v + 2] = b * k;
        paved[j * n + i] = pave / wsum;
        uvs[(j * n + i) * 2] = x / 2.5;
        uvs[(j * n + i) * 2 + 1] = z / 2.5;
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.setAttribute("paved", new THREE.BufferAttribute(paved, 1));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    return geom;
  }, [world]);

  /** Low-resolution invisible copy used only for click picking (fast raycasts). */
  const picking = useMemo(() => {
    const n = world.size + 1;
    const positions = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = (j * n + i) * 3;
        positions[v] = i;
        positions[v + 1] = Math.max(0, world.heights[j * n + i]);
        positions[v + 2] = j;
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeBoundingSphere();
    return geom;
  }, [world]);

  useLayoutEffect(
    () => () => {
      visual.dispose();
      picking.dispose();
    },
    [visual, picking],
  );

  const detail = useMemo(() => {
    const t = groundDetailTexture();
    // Crisp ground at shallow viewing angles instead of a smear.
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, []);

  /**
   * The ground: vertex colours over a fine detail texture, plus two touches that stop big
   * areas looking flat: a slow, large-scale colour variation (patches of lighter and darker
   * grass), and real cobblestones wherever the ground is a path or plaza (blended softly at
   * the edges by the per-vertex "paved" weight).
   */
  const groundMaterial = useMemo(() => {
    const cobble = surface("cobble").map.clone();
    cobble.wrapS = cobble.wrapT = THREE.RepeatWrapping;
    cobble.anisotropy = 8;
    cobble.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.97, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.cobbleMap = { value: cobble };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float paved;\nvarying float vPaved;\nvarying vec2 vGround;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPaved = paved;\nvGround = position.xz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D cobbleMap;\nvarying float vPaved;\nvarying vec2 vGround;")
        .replace(
          "#include <color_fragment>",
          [
            "#include <color_fragment>",
            // Large soft patches (two slow waves of the detail texture), roughly +-8%.
            "float patches = texture2D(map, vGround * 0.013).r * 0.6 + texture2D(map, vGround * 0.031 + 0.37).g * 0.4;",
            "diffuseColor.rgb *= 0.9 + patches * 0.22;",
            // Cobbles on paths and plazas, tinted by the ground colour so district paths keep their hue.
            "float pave = smoothstep(0.42, 0.7, vPaved);",
            "vec3 stones = texture2D(cobbleMap, vGround * 0.55).rgb;",
            "diffuseColor.rgb = mix(diffuseColor.rgb, stones * vColor.rgb * 1.55, pave * 0.9);",
          ].join("\n"),
        );
    };
    return m;
  }, [detail]);

  const plazaMaterial = useMemo(() => surfaceMaterial("cobble", (world.plaza.x1 - world.plaza.x0) / 2.2, (world.plaza.z1 - world.plaza.z0) / 2.2, "#d8d2c6"), [world]);

  const tileFrom = (event: ThreeEvent<MouseEvent>) => ({ x: Math.floor(event.point.x), z: Math.floor(event.point.z) });
  const plazaW = world.plaza.x1 - world.plaza.x0;
  const plazaD = world.plaza.z1 - world.plaza.z0;

  return (
    <group>
      <mesh geometry={visual} material={groundMaterial} receiveShadow raycast={() => null} />
      <mesh position={[world.plaza.x0 + plazaW / 2, 0.035, world.plaza.z0 + plazaD / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plazaMaterial} raycast={() => null}>
        <planeGeometry args={[plazaW, plazaD]} />
      </mesh>
      <mesh
        geometry={picking}
        onClick={(e) => {
          if (e.delta > 6) return;
          const t = tileFrom(e);
          onGroundClick(t.x, t.z, e);
        }}
        onContextMenu={(e) => {
          const t = tileFrom(e);
          onGroundContext(t.x, t.z, e);
        }}
        onPointerMove={onGroundHover}
      >
        <meshBasicMaterial visible={false} />
      </mesh>
      <Water world={world} />
    </group>
  );
}

/**
 * Closeness to land for every tile (1 at the shore, fading to 0 three tiles
 * out), as a small texture the water shader samples for colour and foam.
 */
function shoreTexture(world: World): THREE.DataTexture {
  const n = world.size;
  const data = new Uint8Array(n * n * 4);
  const REACH = 3;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      let best = REACH + 1;
      if (world.kinds[z * n + x] !== TILE.water) best = 0;
      else {
        for (let oz = -REACH; oz <= REACH; oz++) {
          for (let ox = -REACH; ox <= REACH; ox++) {
            const tx = x + ox;
            const tz = z + oz;
            if (tx < 0 || tz < 0 || tx >= n || tz >= n) continue;
            if (world.kinds[tz * n + tx] !== TILE.water) best = Math.min(best, Math.hypot(ox, oz));
          }
        }
      }
      const v = Math.max(0, 1 - best / (REACH + 1));
      const i = (z * n + x) * 4;
      data[i] = Math.round(v * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Stylised water: deep blue far out, turquoise in the shallows, and bands
 * of foam that roll in to the shore. Two normal maps drift across each
 * other for the ripples.
 */
function Water({ world }: { world: World }) {
  const size = world.size;
  const normals = useMemo(() => {
    const a = waterNormalTexture().clone();
    a.repeat.set(size / 3, size / 3);
    a.needsUpdate = true;
    return a;
  }, [size]);
  const shore = useMemo(() => shoreTexture(world), [world]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uShore: { value: shore },
      uSize: { value: size },
      uDeep: { value: new THREE.Color("#174f7a") },
      uShallow: { value: new THREE.Color("#3fb6b2") },
    }),
    [shore, size],
  );
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#2b6f9c",
      roughness: 0.08,
      metalness: 0.2,
      normalMap: normals,
      normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true,
      opacity: 0.9,
      envMapIntensity: 1.2,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
varying vec3 vWaterWorld;`)
        .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vWaterWorld;
uniform float uTime;
uniform sampler2D uShore;
uniform float uSize;
uniform vec3 uDeep;
uniform vec3 uShallow;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
vec2 shoreUv = vWaterWorld.xz / uSize;
float inside = step(0.0, shoreUv.x) * step(shoreUv.x, 1.0) * step(0.0, shoreUv.y) * step(shoreUv.y, 1.0);
float shoreAmt = texture2D(uShore, clamp(shoreUv, 0.0, 1.0)).r * inside;
diffuseColor.rgb = mix(uDeep, uShallow, pow(shoreAmt, 1.6));
float wobble = sin(vWaterWorld.x * 1.7 + uTime * 0.9) * 0.05 + sin(vWaterWorld.z * 2.3 - uTime * 0.7) * 0.05;
float bands = fract(shoreAmt * 2.0 - uTime * 0.22 + wobble);
float foam = smoothstep(0.88, 1.0, shoreAmt) + smoothstep(0.88, 0.97, bands) * smoothstep(0.45, 0.8, shoreAmt) * 0.6;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 1.0) * 0.8);
diffuseColor.a = mix(diffuseColor.a, 1.0, clamp(foam, 0.0, 1.0));`,
        );
    };
    return m;
  }, [normals, uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    normals.offset.x += delta * 0.012;
    normals.offset.y += delta * 0.008;
    uniforms.uTime.value += delta;
  });
  return (
    <mesh position={[size / 2, -0.3, size / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[size * 5, size * 5, 1, 1]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Scenery geometry (built once)
// ---------------------------------------------------------------------------

/** Welds vertices (for smooth shading) and pushes each one in/out a little for an organic, hand-made shape. */
function organic(geometry: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("uv");
  const welded = mergeVertices(geometry);
  const pos = welded.attributes.position as THREE.BufferAttribute;
  const random = mulberry32(seed);
  for (let i = 0; i < pos.count; i++) {
    const o = 1 + (random() - 0.5) * amount;
    pos.setXYZ(i, pos.getX(i) * o, pos.getY(i) * (1 + (o - 1) * 0.6), pos.getZ(i) * o);
  }
  welded.computeVertexNormals();
  return welded;
}

function gradientColors(geometry: THREE.BufferGeometry, bottom: [number, number, number], top: [number, number, number]): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - box.min.y) / Math.max(0.001, box.max.y - box.min.y);
    colors[i * 3] = bottom[0] + (top[0] - bottom[0]) * t;
    colors[i * 3 + 1] = bottom[1] + (top[1] - bottom[1]) * t;
    colors[i * 3 + 2] = bottom[2] + (top[2] - bottom[2]) * t;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function canopyGeometry(): THREE.BufferGeometry {
  const blobs: THREE.BufferGeometry[] = [];
  const parts: Array<[number, number, number, number]> = [
    [0, 0.15, 0, 0.62],
    [0.38, -0.05, 0.12, 0.45],
    [-0.34, 0, -0.1, 0.47],
    [0.05, -0.08, 0.38, 0.42],
    [-0.08, 0.05, -0.36, 0.44],
    [0.02, 0.5, 0.02, 0.4],
  ];
  parts.forEach(([x, y, z, r], i) => {
    const g = organic(new THREE.IcosahedronGeometry(r, 2), 0.22, 11 + i);
    g.translate(x, y, z);
    blobs.push(g);
  });
  const merged = mergeGeometries(blobs);
  return gradientColors(merged, [0.5, 0.56, 0.45], [1.0, 1.05, 0.9]);
}

function pineGeometry(): THREE.BufferGeometry {
  const tiers: THREE.BufferGeometry[] = [];
  [
    [0.0, 0.75, 0.95],
    [0.55, 0.6, 0.8],
    [1.05, 0.42, 0.7],
  ].forEach(([y, r, h], i) => {
    const g = organic(new THREE.ConeGeometry(r, h, 11, 2), 0.12, 31 + i);
    g.translate(0, y, 0);
    tiers.push(g);
  });
  const merged = mergeGeometries(tiers);
  return gradientColors(merged, [0.5, 0.6, 0.5], [1.05, 1.1, 1.0]);
}

function grassTuftGeometry(): THREE.BufferGeometry {
  const blades: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI + (i % 2) * 0.4;
    const ox = Math.cos(a) * 0.05;
    const oz = Math.sin(a) * 0.05;
    const w = 0.035;
    const h = 0.22 + (i % 3) * 0.06;
    const lean = 0.06 * (i % 2 === 0 ? 1 : -1);
    blades.push(ox - Math.sin(a) * w, 0, oz + Math.cos(a) * w, ox + Math.sin(a) * w, 0, oz - Math.cos(a) * w, ox + lean, h, oz + lean);
    colors.push(0.45, 0.55, 0.4, 0.45, 0.55, 0.4, 1.15, 1.2, 0.9);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(blades, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

function rockGeometry(): THREE.BufferGeometry {
  return organic(new THREE.DodecahedronGeometry(0.4, 1), 0.35, 77);
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

/** Adds a gentle wind sway to an instanced, vertex-coloured material. */
function useWind(strength: number, doubleSided: boolean): { material: THREE.MeshStandardMaterial; uniforms: { uTime: { value: number } } } {
  return useMemo(() => {
    const uniforms = { uTime: { value: 0 } };
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
          #else
            float phase = 0.0;
          #endif
          float sway = sin(uTime * 1.6 + phase) * ${strength.toFixed(3)} * max(0.0, position.y);
          transformed.x += sway;
          transformed.z += sway * 0.6;`,
        );
    };
    return { material, uniforms };
  }, [strength, doubleSided]);
}

/** Grass, flowers and clouds, plus trees and rocks (KayKit models, with the procedural ones as fallback). */
export function Scenery({ world }: { world: World }) {
  return (
    <group>
      <WithFallback fallback={<ProceduralTrees world={world} />}>
        <ModelTrees world={world} />
      </WithFallback>
      <Ground world={world} />
      <Clouds size={world.size} />
    </group>
  );
}

function Ground({ world }: { world: World }) {
  const flowers = useRef<THREE.InstancedMesh>(null);
  const grass = useRef<THREE.InstancedMesh>(null);
  const tuftGeom = useMemo(grassTuftGeometry, []);
  const grassWind = useWind(0.18, true);

  /** Grass tufts on open grass tiles away from objects, spread evenly over the whole island (about 14,000 in all). */
  const tufts = useMemo(() => {
    const random = mulberry32(world.size * 131);
    const list: Array<{ x: number; z: number; s: number; r: number; tint: [number, number, number] }> = [];
    let open = 0;
    for (let i = 0; i < world.size * world.size; i++) if (world.kinds[i] === TILE.grass && world.walkable[i]) open++;
    const chance = Math.min(0.55, 14000 / Math.max(1, open * 2.5));
    for (let z = 0; z < world.size; z++) {
      for (let x = 0; x < world.size; x++) {
        const i = z * world.size + x;
        if (world.kinds[i] !== TILE.grass || !world.walkable[i]) continue;
        const count = random() < chance ? 2 + Math.floor(random() * 2) : 0;
        const [r, g, b] = tileColor(world, x, z);
        for (let k = 0; k < count; k++) list.push({ x: x + random(), z: z + random(), s: 0.7 + random() * 0.7, r: random() * Math.PI, tint: [r * 1.1, g * 1.1, b * 1.1] });
      }
    }
    return list.slice(0, 14000);
  }, [world]);

  useFrame((state) => {
    grassWind.uniforms.uTime.value = state.clock.elapsedTime;
  });

  useLayoutEffect(() => {
    if (flowers.current) {
      const palette = [
        [1.0, 0.86, 0.3],
        [0.95, 0.42, 0.48],
        [0.98, 0.98, 0.96],
        [0.62, 0.48, 0.95],
      ];
      world.flowers.forEach((flower, i) => {
        const y = groundHeight(world, flower.x, flower.z);
        tempObject.position.set(flower.x, y + 0.12, flower.z);
        tempObject.rotation.set(0, i, 0);
        tempObject.scale.setScalar(flower.scale);
        tempObject.updateMatrix();
        flowers.current!.setMatrixAt(i, tempObject.matrix);
        const c = palette[flower.variant % palette.length];
        flowers.current!.setColorAt(i, tempColor.setRGB(c[0], c[1], c[2]));
      });
      flowers.current.instanceMatrix.needsUpdate = true;
      if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true;
    }
    if (grass.current) {
      tufts.forEach((tuft, i) => {
        const y = groundHeight(world, tuft.x, tuft.z);
        tempObject.position.set(tuft.x, y, tuft.z);
        tempObject.rotation.set(0, tuft.r, 0);
        tempObject.scale.set(tuft.s, tuft.s * 1.1, tuft.s);
        tempObject.updateMatrix();
        grass.current!.setMatrixAt(i, tempObject.matrix);
        grass.current!.setColorAt(i, tempColor.setRGB(tuft.tint[0], tuft.tint[1], tuft.tint[2]));
      });
      grass.current.instanceMatrix.needsUpdate = true;
      if (grass.current.instanceColor) grass.current.instanceColor.needsUpdate = true;
    }
  }, [world, tufts]);

  return (
    <group>
      <instancedMesh ref={flowers} args={[undefined, undefined, Math.max(1, world.flowers.length)]} raycast={() => null}>
        <icosahedronGeometry args={[0.05, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} emissive="#222222" />
      </instancedMesh>
      <instancedMesh ref={grass} args={[tuftGeom, grassWind.material, Math.max(1, tufts.length)]} raycast={() => null} />
    </group>
  );
}

/** Code-built trees and rocks: shown while the tree models load, or if they can't be loaded. */
function ProceduralTrees({ world }: { world: World }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopies = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const pineTrunks = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const broadleaf = useMemo(() => world.trees.filter((t) => t.variant !== 1), [world]);
  const conifers = useMemo(() => world.trees.filter((t) => t.variant === 1), [world]);
  const canopyGeom = useMemo(canopyGeometry, []);
  const pineGeom = useMemo(pineGeometry, []);
  const rockGeom = useMemo(rockGeometry, []);
  const barkMaterial = useMemo(() => {
    const { map, bump } = surface("bark");
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2, roughness: 0.95 });
  }, []);
  const rockMaterial = useMemo(() => surfaceMaterial("stone", 0.6, 0.6, "#b8b2a8"), []);
  const leafWind = useWind(0.025, false);

  useFrame((state) => {
    leafWind.uniforms.uTime.value = state.clock.elapsedTime;
  });

  useLayoutEffect(() => {
    if (trunks.current) {
      broadleaf.forEach((tree, i) => {
        const y = groundHeight(world, tree.x, tree.z);
        tempObject.position.set(tree.x, y + 0.55 * tree.scale, tree.z);
        tempObject.rotation.set(0, tree.rot, 0);
        tempObject.scale.set(tree.scale, tree.scale, tree.scale);
        tempObject.updateMatrix();
        trunks.current!.setMatrixAt(i, tempObject.matrix);
      });
      trunks.current.instanceMatrix.needsUpdate = true;
    }
    if (canopies.current) {
      broadleaf.forEach((tree, i) => {
        const y = groundHeight(world, tree.x, tree.z);
        tempObject.position.set(tree.x, y + 1.55 * tree.scale, tree.z);
        tempObject.rotation.set(0, tree.rot, 0);
        tempObject.scale.set(tree.scale * 1.05, tree.scale, tree.scale * 1.05);
        tempObject.updateMatrix();
        canopies.current!.setMatrixAt(i, tempObject.matrix);
        const autumn = tree.variant === 2;
        const shade = autumn ? [0.7, 0.5, 0.16] : [0.19 + (i % 5) * 0.016, 0.37 + (i % 7) * 0.014, 0.11];
        canopies.current!.setColorAt(i, tempColor.setRGB(shade[0], shade[1], shade[2]));
      });
      canopies.current.instanceMatrix.needsUpdate = true;
      if (canopies.current.instanceColor) canopies.current.instanceColor.needsUpdate = true;
    }
    if (pines.current && pineTrunks.current) {
      conifers.forEach((tree, i) => {
        const y = groundHeight(world, tree.x, tree.z);
        tempObject.position.set(tree.x, y + 0.95 * tree.scale, tree.z);
        tempObject.rotation.set(0, tree.rot, 0);
        tempObject.scale.set(tree.scale, tree.scale * 1.2, tree.scale);
        tempObject.updateMatrix();
        pines.current!.setMatrixAt(i, tempObject.matrix);
        pines.current!.setColorAt(i, tempColor.setRGB(0.12 + (i % 4) * 0.012, 0.28 + (i % 5) * 0.012, 0.15));
        tempObject.position.set(tree.x, y + 0.3 * tree.scale, tree.z);
        tempObject.scale.set(tree.scale * 0.8, tree.scale * 0.7, tree.scale * 0.8);
        tempObject.updateMatrix();
        pineTrunks.current!.setMatrixAt(i, tempObject.matrix);
      });
      pines.current.instanceMatrix.needsUpdate = true;
      pineTrunks.current.instanceMatrix.needsUpdate = true;
      if (pines.current.instanceColor) pines.current.instanceColor.needsUpdate = true;
    }
    if (rocks.current) {
      world.rocks.forEach((rock, i) => {
        const y = groundHeight(world, rock.x, rock.z);
        tempObject.position.set(rock.x, y + 0.12 * rock.scale, rock.z);
        tempObject.rotation.set(rock.rot * 0.3, rock.rot, 0);
        tempObject.scale.set(rock.scale * 1.25, rock.scale * 0.75, rock.scale);
        tempObject.updateMatrix();
        rocks.current!.setMatrixAt(i, tempObject.matrix);
      });
      rocks.current.instanceMatrix.needsUpdate = true;
    }
  }, [world, broadleaf, conifers]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, barkMaterial, Math.max(1, broadleaf.length)]} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.09, 0.16, 1.1, 8]} />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[canopyGeom, leafWind.material, Math.max(1, broadleaf.length)]} castShadow raycast={() => null} />
      <instancedMesh ref={pineTrunks} args={[undefined, barkMaterial, Math.max(1, conifers.length)]} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.08, 0.13, 0.9, 7]} />
      </instancedMesh>
      <instancedMesh ref={pines} args={[pineGeom, leafWind.material, Math.max(1, conifers.length)]} castShadow raycast={() => null} />
      <instancedMesh ref={rocks} args={[rockGeom, rockMaterial, Math.max(1, world.rocks.length)]} castShadow receiveShadow raycast={() => null} />
    </group>
  );
}

function Clouds({ size }: { size: number }) {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const random = mulberry32(size * 3);
    return Array.from({ length: 10 }, (_, i) => ({
      x: random() * size * 1.4 - size * 0.2,
      z: random() * size * 1.4 - size * 0.2,
      y: 18 + random() * 8,
      s: 2.2 + random() * 2.2,
      big: i % 2 === 0,
      rot: random() * Math.PI * 2,
      puffs: Array.from({ length: 5 }, (_, j) => [(j - 2) * 1.1 + random() * 0.6, random() * 0.6, random() * 1.2 - 0.6, 1 + random() * 0.8] as [number, number, number, number]),
    }));
  }, [size]);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.children.forEach((child) => {
      child.position.x += delta * 0.6;
      if (child.position.x > size * 1.3) child.position.x = -size * 0.3;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} rotation={[0, c.rot, 0]}>
          <WithFallback
            fallback={
              <group scale={c.s * 0.7}>
                {c.puffs.map(([x, y, z, r], j) => (
                  <mesh key={j} position={[x, y, z]} raycast={() => null}>
                    <icosahedronGeometry args={[r, 2]} />
                    <meshStandardMaterial color="#ffffff" roughness={1} emissive="#9fb4c8" emissiveIntensity={0.35} transparent opacity={0.92} />
                  </mesh>
                ))}
              </group>
            }
          >
            <PropModel id={c.big ? "cloud-big" : "cloud-small"} height={c.s * 1.4} />
          </WithFallback>
        </group>
      ))}
    </group>
  );
}
