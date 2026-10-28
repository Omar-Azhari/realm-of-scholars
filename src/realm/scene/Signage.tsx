/**
 * Campus signage: big painted signs with a name and a pictogram, floating
 * icon beacons over purpose buildings, and gateway arches at the district
 * entrances. Everything is drawn on canvas textures with system fonts (no
 * font files), cached per text, so a sign costs one texture and one draw.
 *
 * The same pictograms (`drawIcon`) and colours (`PURPOSE_STYLE` in
 * worldGen.ts) are used by the minimap and the area banner, so the building,
 * the map marker and the banner all agree.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PURPOSE_STYLE, type District, type PlaceIcon, type Purpose } from "../world/worldGen";
import { surfaceMaterial } from "./textures";

const SERIF = 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';

// ---------------------------------------------------------------------------
// Pictograms
// ---------------------------------------------------------------------------

/** Draws a pictogram centred on (cx, cy), about `size` pixels across, in `color`. */
export function drawIcon(ctx: CanvasRenderingContext2D, icon: PlaceIcon, cx: number, cy: number, size: number, color: string): void {
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const rect = (x: number, y: number, w: number, h: number) => ctx.fillRect(x, y, w, h);
  const circle = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const poly = (points: Array<[number, number]>) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  switch (icon) {
    case "lectern": {
      // Projection screen behind a lectern.
      ctx.lineWidth = 0.08;
      ctx.strokeRect(-0.85, -0.9, 1.25, 0.85);
      rect(-0.75, -0.8, 1.05, 0.12);
      rect(-0.75, -0.6, 0.7, 0.08);
      rect(-0.75, -0.45, 0.85, 0.08);
      ctx.beginPath();
      ctx.moveTo(-0.22, -0.05);
      ctx.lineTo(-0.22, 0.12);
      ctx.stroke();
      poly([
        [0.05, -0.08],
        [0.95, 0.12],
        [0.85, 0.32],
        [0.15, 0.22],
      ]);
      rect(0.42, 0.25, 0.16, 0.55);
      rect(0.15, 0.78, 0.7, 0.14);
      break;
    }
    case "books": {
      // Upright books of different heights on a shelf, the last one leaning.
      const spines: Array<[number, number, number]> = [
        [-0.85, 0.32, 1.35],
        [-0.48, 0.26, 1.1],
        [-0.17, 0.3, 1.5],
        [0.18, 0.22, 1.2],
      ];
      for (const [x, w, h] of spines) {
        rect(x, 0.7 - h, w, h);
        ctx.clearRect(x + 0.05, 0.7 - h + 0.18, w - 0.1, 0.06);
        ctx.clearRect(x + 0.05, 0.7 - 0.28, w - 0.1, 0.06);
      }
      ctx.save();
      ctx.translate(0.48, 0.7);
      ctx.rotate(0.38);
      rect(0, -1.25, 0.3, 1.25);
      ctx.restore();
      rect(-0.95, 0.72, 1.9, 0.16);
      break;
    }
    case "trophy": {
      ctx.beginPath();
      ctx.moveTo(-0.55, -0.85);
      ctx.lineTo(0.55, -0.85);
      ctx.quadraticCurveTo(0.55, 0.05, 0, 0.12);
      ctx.quadraticCurveTo(-0.55, 0.05, -0.55, -0.85);
      ctx.fill();
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.arc(-0.58, -0.5, 0.25, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0.58, -0.5, 0.25, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      rect(-0.1, 0.1, 0.2, 0.4);
      rect(-0.45, 0.5, 0.9, 0.16);
      rect(-0.6, 0.7, 1.2, 0.2);
      break;
    }
    case "wands": {
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(-0.8, 0.85);
      ctx.lineTo(0.55, -0.55);
      ctx.moveTo(0.8, 0.85);
      ctx.lineTo(-0.55, -0.55);
      ctx.stroke();
      for (const x of [-0.62, 0.62]) {
        ctx.save();
        ctx.translate(x, -0.66);
        poly([
          [0, -0.32],
          [0.09, -0.09],
          [0.32, 0],
          [0.09, 0.09],
          [0, 0.32],
          [-0.09, 0.09],
          [-0.32, 0],
          [-0.09, -0.09],
        ]);
        ctx.restore();
      }
      break;
    }
    case "stall": {
      // Scalloped awning over a counter.
      rect(-0.9, -0.75, 1.8, 0.35);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-0.72 + i * 0.36, -0.4, 0.18, 0, Math.PI);
        ctx.fill();
      }
      poly([
        [-0.9, -0.75],
        [0, -1],
        [0.9, -0.75],
      ]);
      rect(-0.8, -0.2, 0.1, 0.95);
      rect(0.7, -0.2, 0.1, 0.95);
      rect(-0.85, 0.3, 1.7, 0.18);
      circle(-0.35, 0.18, 0.13);
      circle(0, 0.16, 0.15);
      circle(0.35, 0.18, 0.13);
      rect(-0.75, 0.48, 1.5, 0.4);
      break;
    }
    case "dice": {
      ctx.save();
      ctx.rotate(-0.18);
      ctx.beginPath();
      ctx.roundRect(-0.75, -0.75, 1.5, 1.5, 0.28);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      for (const [x, y] of [
        [-0.4, -0.4],
        [0.4, -0.4],
        [0, 0],
        [-0.4, 0.4],
        [0.4, 0.4],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "people": {
      circle(-0.38, -0.42, 0.26);
      circle(0.38, -0.42, 0.26);
      ctx.beginPath();
      ctx.ellipse(-0.38, 0.45, 0.42, 0.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0.38, 0.45, 0.42, 0.5, 0, Math.PI, 0);
      ctx.fill();
      rect(-0.85, 0.45, 1.7, 0.3);
      break;
    }
    case "bed": {
      rect(-0.9, -0.55, 0.16, 1.35);
      rect(-0.9, 0.1, 1.8, 0.35);
      rect(0.74, 0.1, 0.16, 0.7);
      ctx.beginPath();
      ctx.roundRect(-0.68, -0.2, 0.5, 0.26, 0.1);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-0.1, -0.28, 0.95, 0.34, 0.12);
      ctx.fill();
      // A crescent moon.
      ctx.beginPath();
      ctx.arc(0.45, -0.72, 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(0.56, -0.8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "hammer": {
      ctx.save();
      ctx.rotate(-0.7);
      rect(-0.08, -0.35, 0.16, 1.25);
      rect(-0.5, -0.75, 1.0, 0.42);
      ctx.restore();
      break;
    }
    case "cauldron": {
      ctx.beginPath();
      ctx.ellipse(0, 0.2, 0.8, 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      rect(-0.9, -0.38, 1.8, 0.2);
      rect(-0.6, 0.7, 0.16, 0.22);
      rect(0.44, 0.7, 0.16, 0.22);
      circle(-0.25, -0.62, 0.13);
      circle(0.12, -0.8, 0.1);
      circle(0.35, -0.6, 0.08);
      break;
    }
    case "fire": {
      ctx.beginPath();
      ctx.moveTo(0, -0.95);
      ctx.bezierCurveTo(0.35, -0.45, 0.75, -0.2, 0.62, 0.35);
      ctx.bezierCurveTo(0.52, 0.8, -0.52, 0.8, -0.62, 0.35);
      ctx.bezierCurveTo(-0.72, -0.05, -0.38, -0.25, -0.25, -0.55);
      ctx.bezierCurveTo(-0.1, -0.35, 0.05, -0.4, 0, -0.95);
      ctx.fill();
      rect(-0.75, 0.75, 1.5, 0.14);
      break;
    }
    case "anchor": {
      ctx.lineWidth = 0.15;
      ctx.beginPath();
      ctx.arc(0, -0.72, 0.17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -0.55);
      ctx.lineTo(0, 0.8);
      ctx.moveTo(-0.42, -0.3);
      ctx.lineTo(0.42, -0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0.18, 0.7, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
      poly([
        [-0.78, 0.1],
        [-0.55, 0.42],
        [-0.86, 0.45],
      ]);
      poly([
        [0.78, 0.1],
        [0.55, 0.42],
        [0.86, 0.45],
      ]);
      break;
    }
    case "castle": {
      rect(-0.85, -0.2, 1.7, 1.05);
      for (const x of [-0.85, -0.35, 0.15, 0.65]) rect(x, -0.42, 0.2, 0.25);
      rect(-0.3, -0.9, 0.6, 0.75);
      poly([
        [-0.38, -0.9],
        [0, -1.15],
        [0.38, -0.9],
      ]);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(-0.25, 0.85);
      ctx.lineTo(-0.25, 0.4);
      ctx.arc(0, 0.4, 0.25, Math.PI, 0);
      ctx.lineTo(0.25, 0.85);
      ctx.fill();
      break;
    }
    case "fountain": {
      rect(-0.85, 0.45, 1.7, 0.4);
      rect(-0.12, -0.2, 0.24, 0.7);
      rect(-0.45, -0.25, 0.9, 0.14);
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(0, -0.3);
      ctx.quadraticCurveTo(-0.5, -1.0, -0.75, 0.35);
      ctx.moveTo(0, -0.3);
      ctx.quadraticCurveTo(0.5, -1.0, 0.75, 0.35);
      ctx.stroke();
      break;
    }
    case "compass": {
      poly([
        [0, -1],
        [0.2, -0.2],
        [1, 0],
        [0.2, 0.2],
        [0, 1],
        [-0.2, 0.2],
        [-1, 0],
        [-0.2, -0.2],
      ]);
      break;
    }
    case "parkour": {
      // A runner leaping from a low block to a high one.
      rect(-0.95, 0.45, 0.6, 0.45);
      rect(0.4, -0.05, 0.55, 0.95);
      circle(-0.02, -0.72, 0.15);
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(-0.08, -0.52);
      ctx.lineTo(-0.2, -0.08);
      ctx.moveTo(-0.16, -0.4);
      ctx.lineTo(0.22, -0.3);
      ctx.lineTo(0.38, -0.5);
      ctx.moveTo(-0.14, -0.38);
      ctx.lineTo(-0.48, -0.28);
      ctx.moveTo(-0.2, -0.08);
      ctx.lineTo(0.12, 0.08);
      ctx.lineTo(0.3, -0.12);
      ctx.moveTo(-0.2, -0.08);
      ctx.lineTo(-0.42, 0.22);
      ctx.lineTo(-0.66, 0.2);
      ctx.stroke();
      break;
    }
    case "target": {
      // Rings of a target with an arrow in the gold.
      ctx.lineWidth = 0.13;
      for (const r of [0.82, 0.52]) {
        ctx.beginPath();
        ctx.arc(-0.08, 0.08, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      circle(-0.08, 0.08, 0.2);
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(-0.08, 0.08);
      ctx.lineTo(0.78, -0.78);
      ctx.stroke();
      poly([
        [0.62, -0.92],
        [0.95, -0.95],
        [0.92, -0.62],
      ]);
      break;
    }
    case "paddle": {
      // A table-tennis bat and ball.
      ctx.save();
      ctx.rotate(-0.6);
      ctx.beginPath();
      ctx.ellipse(-0.1, -0.25, 0.55, 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      rect(-0.22, 0.3, 0.24, 0.7);
      ctx.restore();
      circle(0.68, -0.62, 0.2);
      break;
    }
    case "medal": {
      // A medal on a ribbon, with a star.
      poly([
        [-0.62, -1],
        [-0.25, -1],
        [0.08, -0.25],
        [-0.25, -0.15],
      ]);
      poly([
        [0.62, -1],
        [0.25, -1],
        [-0.08, -0.25],
        [0.25, -0.15],
      ]);
      circle(0, 0.32, 0.6);
      ctx.globalCompositeOperation = "destination-out";
      const star: Array<[number, number]> = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? 0.36 : 0.15;
        star.push([Math.cos(a) * r, 0.34 + Math.sin(a) * r]);
      }
      poly(star);
      break;
    }
  }
  ctx.restore();
}

const emblemCache = new Map<string, HTMLCanvasElement>();

/**
 * Draws a round emblem (coloured disc, rim, white pictogram) of radius `r` centred on (cx, cy).
 * Used by the minimap and the area banner; the pictogram is drawn on its own layer first so
 * its cut-outs never punch holes in what's underneath.
 */
export function drawEmblem(ctx: CanvasRenderingContext2D, icon: PlaceIcon, colours: SignColours, cx: number, cy: number, r: number): void {
  const px = Math.max(8, Math.ceil(r * 2));
  const key = `${icon}|${colours.main}|${colours.dark}|${colours.accent}|${px}`;
  let layer = emblemCache.get(key);
  if (!layer) {
    layer = document.createElement("canvas");
    layer.width = px * 2;
    layer.height = px * 2;
    const lctx = layer.getContext("2d");
    if (lctx) {
      const c = px;
      lctx.fillStyle = colours.accent;
      lctx.beginPath();
      lctx.arc(c, c, c - 1, 0, Math.PI * 2);
      lctx.fill();
      lctx.fillStyle = colours.main;
      lctx.beginPath();
      lctx.arc(c, c, c * 0.8, 0, Math.PI * 2);
      lctx.fill();
      const icons = document.createElement("canvas");
      icons.width = px * 2;
      icons.height = px * 2;
      const ictx = icons.getContext("2d");
      if (ictx) {
        drawIcon(ictx, icon, c, c, c * 1.05, "#fffaf0");
        lctx.drawImage(icons, 0, 0);
      }
    }
    emblemCache.set(key, layer);
  }
  ctx.drawImage(layer, cx - r, cy - r, r * 2, r * 2);
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

const textureCache = new Map<string, THREE.CanvasTexture>();

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** A painted signboard: coloured panel, gold frame, a roundel with the pictogram, and the name. */
export interface SignColours {
  main: string;
  dark: string;
  accent: string;
}

export function signTexture(title: string, subtitle: string, icon: PlaceIcon, style: SignColours, aspect: number): THREE.CanvasTexture {
  const key = `sign|${title}|${subtitle}|${icon}|${style.main}|${style.dark}|${style.accent}|${aspect.toFixed(2)}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const H = 256;
  const W = Math.round(H * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, style.main);
    grad.addColorStop(1, style.dark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Frame: a thick gold border and a fine inner line.
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.globalAlpha = 1;
    // Roundel with the pictogram.
    const r = H * 0.34;
    const iconX = 40 + r;
    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.arc(iconX, H / 2, r, 0, Math.PI * 2);
    ctx.fill();
    // Draw the icon on its own layer so the "cut-out" parts don't punch through the sign.
    const layer = document.createElement("canvas");
    layer.width = H;
    layer.height = H;
    const lctx = layer.getContext("2d");
    if (lctx) {
      drawIcon(lctx, icon, H / 2, H / 2, r * 1.25, style.dark);
      ctx.drawImage(layer, iconX - H / 2, 0);
    }
    // The name, as large as fits.
    const left = iconX + r + 28;
    const room = W - left - 40;
    const titleText = title.toUpperCase();
    let fontSize = subtitle ? 92 : 112;
    ctx.font = `bold ${fontSize}px ${SERIF}`;
    while (ctx.measureText(titleText).width > room && fontSize > 30) {
      fontSize -= 4;
      ctx.font = `bold ${fontSize}px ${SERIF}`;
    }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#fffaf0";
    const titleY = subtitle ? H * 0.42 : H / 2;
    ctx.fillText(titleText, left, titleY);
    if (subtitle) {
      let subSize = 44;
      ctx.font = `600 ${subSize}px ${SERIF}`;
      while (ctx.measureText(subtitle).width > room && subSize > 20) {
        subSize -= 2;
        ctx.font = `600 ${subSize}px ${SERIF}`;
      }
      ctx.fillStyle = style.accent;
      ctx.fillText(subtitle, left, H * 0.75);
    }
  }
  const texture = finish(canvas);
  textureCache.set(key, texture);
  return texture;
}

/** A round medallion: purpose-coloured disc, gold rim, pictogram. */
export function medallionTexture(icon: PlaceIcon, purpose: Purpose): THREE.CanvasTexture {
  const key = `medal|${icon}|${purpose}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const style = PURPOSE_STYLE[purpose];
    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(S / 2, S * 0.4, 10, S / 2, S / 2, S / 2);
    grad.addColorStop(0, style.main);
    grad.addColorStop(1, style.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 16, 0, Math.PI * 2);
    ctx.fill();
    const layer = document.createElement("canvas");
    layer.width = S;
    layer.height = S;
    const lctx = layer.getContext("2d");
    if (lctx) {
      drawIcon(lctx, icon, S / 2, S / 2, S * 0.56, "#fffaf0");
      ctx.drawImage(layer, 0, 0);
    }
  }
  const texture = finish(canvas);
  textureCache.set(key, texture);
  return texture;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface SignProps {
  title: string;
  subtitle?: string;
  icon: PlaceIcon;
  purpose: Purpose;
  /** Overrides the purpose colours (subject regions use their theme). */
  colours?: SignColours;
  /** Board size in metres (tiles). */
  width: number;
  height?: number;
  position?: [number, number, number];
  rotation?: number;
  /** "posts": free-standing on two wooden posts; "wall": flat board to hang on a facade. */
  mount?: "posts" | "wall";
  /** How far the board sits above the ground when on posts. */
  lift?: number;
}

/**
 * A big readable sign. The board is painted on both faces, so it reads from
 * the front and from behind; it glows faintly so it stays legible at dusk.
 */
export function Sign({ title, subtitle = "", icon, purpose, colours, width, height, position = [0, 0, 0], rotation = 0, mount = "wall", lift = 1.2 }: SignProps) {
  const h = height ?? width / 4;
  const aspect = width / h;
  const style = colours ?? PURPOSE_STYLE[purpose];
  const texture = useMemo(() => signTexture(title, subtitle, icon, style, aspect), [title, subtitle, icon, style, aspect]);
  const face = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.42, roughness: 0.6 }),
    [texture],
  );
  const wood = useMemo(() => surfaceMaterial("wood", 1, 2, "#7a5232"), []);
  const y = mount === "posts" ? lift + h / 2 : 0;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {mount === "posts"
        ? [-1, 1].map((side) => (
            <mesh key={side} position={[side * (width / 2 - 0.12), (lift + h + 0.15) / 2, -0.02]} material={wood} castShadow>
              <boxGeometry args={[0.16, lift + h + 0.15, 0.16]} />
            </mesh>
          ))
        : null}
      <mesh position={[0, y, 0]} castShadow>
        <boxGeometry args={[width + 0.12, h + 0.12, 0.08]} />
        <meshStandardMaterial color="#3a2814" roughness={0.8} />
      </mesh>
      <mesh position={[0, y, 0.045]} material={face}>
        <planeGeometry args={[width, h]} />
      </mesh>
      <mesh position={[0, y, -0.045]} rotation={[0, Math.PI, 0]} material={face}>
        <planeGeometry args={[width, h]} />
      </mesh>
    </group>
  );
}

/**
 * A big glowing medallion floating over a building, turning slowly, so the
 * building can be picked out from across the campus (like a map pin).
 */
export function IconBeacon({ icon, purpose, height, size = 1.6 }: { icon: PlaceIcon; purpose: Purpose; height: number; size?: number }) {
  const group = useRef<THREE.Group>(null);
  const texture = useMemo(() => medallionTexture(icon, purpose), [icon, purpose]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.7,
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 0.5,
      }),
    [texture],
  );
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.6 + phase;
    group.current.position.y = height + Math.sin(t * 1.3 + phase) * 0.12;
  });
  return (
    <group ref={group} position={[0, height, 0]}>
      <mesh material={material} raycast={() => null}>
        <circleGeometry args={[size / 2, 40]} />
      </mesh>
      <mesh position={[0, -size / 2 - 0.35, 0]} rotation={[Math.PI, 0, 0]} raycast={() => null}>
        <coneGeometry args={[0.16, 0.5, 4]} />
        <meshStandardMaterial color={PURPOSE_STYLE[purpose].accent} emissive={PURPOSE_STYLE[purpose].accent} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/** A stone gateway arch over the path into a district, its name board facing the Agora. */
export function Gateway({ district }: { district: District }) {
  const stone = useMemo(() => surfaceMaterial("stone", 1, 3, "#d9d0bf"), []);
  const cap = useMemo(() => surfaceMaterial("stoneDark", 1, 0.5, "#a89f90"), []);
  const style = PURPOSE_STYLE[district.purpose];
  const span = 6.6;
  const pillar = 4.2;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (span / 2), 0, 0]}>
          <mesh position={[0, pillar / 2, 0]} material={stone} castShadow receiveShadow>
            <boxGeometry args={[0.7, pillar, 0.7]} />
          </mesh>
          <mesh position={[0, pillar + 0.12, 0]} material={cap} castShadow>
            <boxGeometry args={[0.9, 0.24, 0.9]} />
          </mesh>
          {/* A lantern on each pillar in the district's colour. */}
          <mesh position={[0, pillar + 0.5, 0]}>
            <sphereGeometry args={[0.22, 16, 12]} />
            <meshStandardMaterial color={style.accent} emissive={style.main} emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, pillar - 0.2, 0]} material={cap} castShadow>
        <boxGeometry args={[span + 0.7, 0.4, 0.6]} />
      </mesh>
      <Sign title={district.name} subtitle={style.label} icon={district.icon} purpose={district.purpose} width={span - 0.6} height={1.25} position={[0, pillar + 0.75, 0]} />
    </group>
  );
}
