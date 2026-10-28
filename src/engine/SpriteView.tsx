import { useEffect, useRef } from "react";
import { useMotionPreference } from "../hooks/useMotionPreference";
import { assetUrl } from "./manifestTypes";
import type { PixelGridSpriteAsset, SpriteAsset, SpritesheetSpriteAsset } from "./manifestTypes";

interface SpriteViewProps {
  sprite: SpriteAsset;
  animation?: string;
  /** Mirror horizontally (e.g. walking left). */
  flip?: boolean;
  /** Accessible description; empty string marks the sprite decorative. */
  label: string;
}

/**
 * Renders one sprite asset into a canvas that fills its parent. Two source
 * formats are supported (see manifestTypes.ts): "pixel-grid" (the current
 * placeholder art) and "spritesheet" (a PNG/WebP sheet of frames, the format
 * final production artwork is expected to arrive in). Callers never know
 * which format is behind a sprite id — swapping the asset file is enough.
 *
 * Under reduced motion the first frame renders statically.
 */
export function SpriteView({ sprite, animation = "idle", flip = false, label }: SpriteViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useMotionPreference();

  const isPixelGrid = sprite.type === "pixel-grid";
  const canvasWidth = isPixelGrid ? sprite.width : sprite.frameWidth;
  const canvasHeight = isPixelGrid ? sprite.height : sprite.frameHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (sprite.type === "pixel-grid") {
      return runPixelGridAnimation(ctx, sprite, animation, reduceMotion);
    }
    return runSpritesheetAnimation(ctx, sprite, animation, reduceMotion);
  }, [sprite, animation, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="sprite-view"
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Pixel-grid renderer (placeholder format)                             */
/* ------------------------------------------------------------------ */

function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  palette: Record<string, string>
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x];
      if (key === ".") continue;
      const colour = palette[key];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function runPixelGridAnimation(
  ctx: CanvasRenderingContext2D,
  sprite: PixelGridSpriteAsset,
  animationName: string,
  reduceMotion: boolean
): () => void {
  const anim = sprite.animations[animationName] ?? sprite.animations.idle;
  if (!anim) return () => undefined;

  const frames = anim.frames
    .map((gridName) => sprite.grids[gridName])
    .filter((grid): grid is string[] => Array.isArray(grid));
  if (frames.length === 0) return () => undefined;

  drawPixelGrid(ctx, frames[0], sprite.palette);
  if (reduceMotion || frames.length <= 1) return () => undefined;

  let frameIndex = 0;
  const interval = window.setInterval(() => {
    frameIndex += 1;
    if (frameIndex >= frames.length) {
      if (!anim.loop) {
        window.clearInterval(interval);
        return;
      }
      frameIndex = 0;
    }
    drawPixelGrid(ctx, frames[frameIndex], sprite.palette);
  }, 1000 / anim.fps);

  return () => window.clearInterval(interval);
}

/* ------------------------------------------------------------------ */
/* Spritesheet renderer (final-art format)                              */
/* ------------------------------------------------------------------ */

const sheetCache = new Map<string, HTMLImageElement>();

function loadSheet(src: string): HTMLImageElement {
  let image = sheetCache.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    sheetCache.set(src, image);
  }
  return image;
}

function runSpritesheetAnimation(
  ctx: CanvasRenderingContext2D,
  sprite: SpritesheetSpriteAsset,
  animationName: string,
  reduceMotion: boolean
): () => void {
  const anim = sprite.animations[animationName] ?? sprite.animations.idle;
  if (!anim || anim.frames.length === 0) return () => undefined;

  const image = loadSheet(assetUrl(sprite.image));
  let interval: number | null = null;
  let disposed = false;

  const drawFrame = (frameNumber: number) => {
    const cols = Math.max(1, Math.floor((image.naturalWidth || sprite.frameWidth) / sprite.frameWidth));
    const sx = (frameNumber % cols) * sprite.frameWidth;
    const sy = Math.floor(frameNumber / cols) * sprite.frameHeight;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      sx,
      sy,
      sprite.frameWidth,
      sprite.frameHeight,
      0,
      0,
      sprite.frameWidth,
      sprite.frameHeight
    );
  };

  const start = () => {
    if (disposed) return;
    drawFrame(anim.frames[0]);
    if (reduceMotion || anim.frames.length <= 1) return;
    let index = 0;
    interval = window.setInterval(() => {
      index += 1;
      if (index >= anim.frames.length) {
        if (!anim.loop) {
          if (interval !== null) window.clearInterval(interval);
          return;
        }
        index = 0;
      }
      drawFrame(anim.frames[index]);
    }, 1000 / anim.fps);
  };

  if (image.complete && image.naturalWidth > 0) start();
  else image.addEventListener("load", start, { once: true });

  return () => {
    disposed = true;
    image.removeEventListener("load", start);
    if (interval !== null) window.clearInterval(interval);
  };
}
