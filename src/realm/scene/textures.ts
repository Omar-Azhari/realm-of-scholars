/**
 * Procedural surface textures, painted once onto canvases at startup — no
 * image files. Each material kind gets a colour map plus a matching bump
 * map so light catches mortar lines, roof tiles and wood grain.
 */

import * as THREE from "three";

export type SurfaceKind = "stone" | "stoneDark" | "plaster" | "roof" | "wood" | "cobble" | "bark";

const SIZE = 256;

function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  return [c, c.getContext("2d")!];
}

function speckle(ctx: CanvasRenderingContext2D, random: () => number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(random() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * random()})`;
    ctx.fillRect(random() * SIZE, random() * SIZE, 1 + random() * 2, 1 + random() * 2);
  }
}

/** Paints colour (into `color`) and height (into `height`, greyscale) with the same layout. */
function paint(kind: SurfaceKind, color: CanvasRenderingContext2D, height: CanvasRenderingContext2D): void {
  const random = rand(kind.length * 977 + kind.charCodeAt(0));
  const base: Record<SurfaceKind, [number, number, number]> = {
    stone: [168, 160, 146],
    stoneDark: [118, 112, 102],
    plaster: [214, 204, 182],
    roof: [96, 112, 140],
    wood: [120, 84, 52],
    cobble: [150, 146, 138],
    bark: [94, 66, 42],
  };
  const [r, g, b] = base[kind];
  color.fillStyle = `rgb(${r},${g},${b})`;
  color.fillRect(0, 0, SIZE, SIZE);
  height.fillStyle = "rgb(128,128,128)";
  height.fillRect(0, 0, SIZE, SIZE);

  const shade = (x: number, y: number, w: number, h: number, amount: number, hv: number) => {
    const k = 1 + amount;
    color.fillStyle = `rgb(${Math.min(255, r * k)},${Math.min(255, g * k)},${Math.min(255, b * k)})`;
    color.fillRect(x, y, w, h);
    height.fillStyle = `rgb(${hv},${hv},${hv})`;
    height.fillRect(x, y, w, h);
  };

  if (kind === "stone" || kind === "stoneDark") {
    const rows = 8;
    const rowH = SIZE / rows;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 === 0 ? 0 : -rowH;
      while (x < SIZE) {
        const w = rowH * (1.2 + random() * 0.9);
        shade(x + 2, row * rowH + 2, w - 4, rowH - 4, (random() - 0.5) * 0.22, 170 + random() * 50);
        x += w;
      }
    }
  } else if (kind === "cobble") {
    for (let i = 0; i < 140; i++) {
      const cx = random() * SIZE;
      const cy = random() * SIZE;
      const rad = 9 + random() * 9;
      const k = 1 + (random() - 0.5) * 0.25;
      const hv = 180 + random() * 50;
      const ry = rad * (0.7 + random() * 0.3);
      const rot = random() * Math.PI;
      color.fillStyle = `rgb(${r * k},${g * k},${b * k})`;
      height.fillStyle = `rgb(${hv},${hv},${hv})`;
      for (const ctx of [color, height]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (kind === "roof") {
    const rows = 10;
    const rowH = SIZE / rows;
    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 0 ? 0 : 12;
      for (let x = -24 + offset; x < SIZE; x += 24) {
        shade(x + 1, row * rowH, 22, rowH - 3, (random() - 0.5) * 0.25, 150 + random() * 40);
        color.fillStyle = "rgba(0,0,0,0.14)";
        color.fillRect(x + 1, row * rowH + rowH - 6, 22, 3);
        height.fillStyle = "rgb(200,200,200)";
        height.fillRect(x + 1, row * rowH + rowH - 7, 22, 4);
      }
    }
  } else if (kind === "wood" || kind === "bark") {
    const planks = kind === "wood" ? 6 : 1;
    for (let p = 0; p < planks; p++) {
      const x0 = (p * SIZE) / planks;
      shade(x0 + 1, 0, SIZE / planks - 2, SIZE, (random() - 0.5) * 0.2, 150);
      for (let i = 0; i < (kind === "bark" ? 90 : 26); i++) {
        const x = x0 + random() * (SIZE / planks);
        color.strokeStyle = `rgba(30,18,8,${0.15 + random() * 0.25})`;
        height.strokeStyle = `rgba(60,60,60,${0.4 + random() * 0.4})`;
        color.lineWidth = height.lineWidth = 1 + random() * 1.5;
        for (const ctx of [color, height]) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + (random() - 0.5) * 8, SIZE * 0.3, x + (random() - 0.5) * 8, SIZE * 0.7, x, SIZE);
          ctx.stroke();
        }
      }
    }
  } else if (kind === "plaster") {
    speckle(color, random, 2500, 0.18);
    speckle(height, random, 2500, 0.4);
  }
  speckle(color, random, 1800, 0.12);
  speckle(height, random, 1200, 0.25);
}

interface SurfaceSet {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

const cache = new Map<SurfaceKind, SurfaceSet>();

export function surface(kind: SurfaceKind): SurfaceSet {
  const hit = cache.get(kind);
  if (hit) return hit;
  const [colorCanvas, colorCtx] = canvas();
  const [heightCanvas, heightCtx] = canvas();
  paint(kind, colorCtx, heightCtx);
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(heightCanvas);
  for (const t of [map, bump]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const set = { map, bump };
  cache.set(kind, set);
  return set;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/** A textured material whose texture repeat matches an object's size (in metres), so bricks stay brick-sized. */
export function surfaceMaterial(kind: SurfaceKind, repeatU: number, repeatV: number, tint = "#ffffff"): THREE.MeshStandardMaterial {
  const ru = Math.max(0.25, Math.round(repeatU * 4) / 4);
  const rv = Math.max(0.25, Math.round(repeatV * 4) / 4);
  const key = `${kind}|${ru}|${rv}|${tint}`;
  const hit = materialCache.get(key);
  if (hit) return hit;
  const { map, bump } = surface(kind);
  const m = map.clone();
  const b = bump.clone();
  m.repeat.set(ru, rv);
  b.repeat.set(ru, rv);
  // Sharp at an angle (walls and paving seen from the third-person camera).
  m.anisotropy = 8;
  b.anisotropy = 8;
  m.needsUpdate = true;
  b.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    map: m,
    bumpMap: b,
    bumpScale: kind === "roof" ? 2.2 : 1.6,
    color: tint,
    roughness: kind === "wood" || kind === "bark" ? 0.85 : 0.92,
    metalness: 0,
  });
  materialCache.set(key, material);
  return material;
}

/** Soft greyscale noise used as a detail map on the ground. */
let groundDetail: THREE.CanvasTexture | null = null;
export function groundDetailTexture(): THREE.CanvasTexture {
  if (groundDetail) return groundDetail;
  const [c, ctx] = canvas();
  const random = rand(42);
  ctx.fillStyle = "rgb(235,235,235)";
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 9000; i++) {
    const v = 170 + Math.floor(random() * 85);
    ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
    const x = random() * SIZE;
    const y = random() * SIZE;
    ctx.fillRect(x, y, 1, 2 + random() * 3);
  }
  for (let i = 0; i < 70; i++) {
    const v = 200 + Math.floor(random() * 55);
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.beginPath();
    ctx.arc(random() * SIZE, random() * SIZE, 6 + random() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  groundDetail = new THREE.CanvasTexture(c);
  groundDetail.colorSpace = THREE.SRGBColorSpace;
  groundDetail.wrapS = THREE.RepeatWrapping;
  groundDetail.wrapT = THREE.RepeatWrapping;
  groundDetail.anisotropy = 8;
  return groundDetail;
}

/** Tileable ripple normal map for water. */
let waterNormals: THREE.CanvasTexture | null = null;
export function waterNormalTexture(): THREE.CanvasTexture {
  if (waterNormals) return waterNormals;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const fx = (x / 128) * Math.PI * 2;
      const fy = (y / 128) * Math.PI * 2;
      const dx = Math.cos(fx * 3 + Math.sin(fy * 2)) * 0.5 + Math.cos(fx * 5 - fy * 2) * 0.3;
      const dy = Math.cos(fy * 3 + Math.sin(fx * 2)) * 0.5 + Math.sin(fy * 4 + fx * 3) * 0.3;
      const i = (y * 128 + x) * 4;
      img.data[i] = 128 + dx * 60;
      img.data[i + 1] = 128 + dy * 60;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  waterNormals = new THREE.CanvasTexture(c);
  waterNormals.wrapS = THREE.RepeatWrapping;
  waterNormals.wrapT = THREE.RepeatWrapping;
  return waterNormals;
}
