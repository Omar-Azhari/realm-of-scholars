/**
 * Compact rotating minimap with a compass and a home button. Click the map to
 * walk; click the compass to face north. It folds away to a single button.
 * Purpose buildings show the same emblem (colour and pictogram) as their sign
 * and the area banner.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { runtime } from "../scene/runtime";
import { tileColor } from "../scene/Terrain";
import { PLACE_INFO, PURPOSE_STYLE, type PlaceIcon, type World } from "../world/worldGen";
import { drawEmblem, type SignColours } from "../scene/Signage";
import { Icon } from "./icons";

const PX = 3;
const RADIUS = 76;
const FOLD_KEY = "realm.minimapFolded";

function readCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(FOLD_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    // ignore
  }
  return typeof window !== "undefined" && window.innerWidth < 600;
}

interface MinimapProps {
  world: World;
  onHome: () => void;
}

export function Minimap({ world, onHome }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compassRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(FOLD_KEY, value ? "1" : "0");
    } catch {
      // Storage can be blocked; the choice just won't be remembered.
    }
  };

  const base = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = world.size * PX;
    canvas.height = world.size * PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    for (let z = 0; z < world.size; z++) {
      for (let x = 0; x < world.size; x++) {
        let [r, g, b] = tileColor(world, x, z);
        if (!world.walkable[z * world.size + x] && world.kinds[z * world.size + x] !== 3) {
          r *= 0.75;
          g *= 0.75;
          b *= 0.75;
        }
        ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        ctx.fillRect(x * PX, z * PX, PX, PX);
      }
    }
    ctx.fillStyle = "rgba(20,60,20,0.55)";
    for (const tree of world.trees) ctx.fillRect(tree.x * PX - 2, tree.z * PX - 2, 4, 4);
    // District courts, tinted in their purpose colour.
    for (const d of world.districts) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = PURPOSE_STYLE[d.purpose].main;
      ctx.beginPath();
      ctx.arc((d.x + 0.5) * PX, (d.z + 0.5) * PX, d.court * PX, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Hedges and fences along the roads, as thin dark lines.
    ctx.strokeStyle = "rgba(30,50,20,0.7)";
    ctx.lineWidth = 1.5;
    for (const run of [...(world.landscape?.hedges ?? []), ...(world.landscape?.fences ?? [])]) {
      const dx = (Math.cos(run.rot) * run.len) / 2;
      const dz = (-Math.sin(run.rot) * run.len) / 2;
      ctx.beginPath();
      ctx.moveTo((run.x - dx) * PX, (run.z - dz) * PX);
      ctx.lineTo((run.x + dx) * PX, (run.z + dz) * PX);
      ctx.stroke();
    }
    // Scenic landmarks (lookout, ruins, windmill, bell tower, picnic lawn) as stone marks.
    for (const object of world.objects) {
      if (object.kind !== "scenery") continue;
      ctx.fillStyle = "#d8cfbd";
      ctx.strokeStyle = "#4a4036";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc((object.x + object.w / 2) * PX, (object.z + object.d / 2) * PX, Math.max(object.w, object.d) * PX * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Buildings: purpose buildings in their colours, subject landmarks in stone.
    for (const object of world.objects) {
      const info = PLACE_INFO[object.kind];
      if (object.kind === "landmark" || (info && object.w * object.d >= 4)) {
        ctx.fillStyle = info ? PURPOSE_STYLE[info.purpose].accent : "#e8e2d4";
        ctx.fillRect(object.x * PX, object.z * PX, object.w * PX, object.d * PX);
        ctx.strokeStyle = info ? PURPOSE_STYLE[info.purpose].dark : "#5a5045";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(object.x * PX, object.z * PX, object.w * PX, object.d * PX);
      }
    }
    return canvas;
  }, [world]);

  const dots = useMemo(
    () =>
      world.objects
        .filter((o) => ["tutor", "quest-board", "waystone", "boss-lair", "lectern"].includes(o.kind))
        .map((o) => ({ x: o.x + o.w / 2, z: o.z + o.d / 2, kind: o.kind })),
    [world],
  );
  /** Emblems for purpose buildings, drawn upright whatever the map's rotation. */
  const emblems = useMemo(
    () =>
      world.objects.flatMap((o) => {
        const info = PLACE_INFO[o.kind];
        if (!info) return [];
        const colours: SignColours = PURPOSE_STYLE[info.purpose];
        const big = o.kind === "citadel" || o.kind === "lecture-hall" || o.kind === "exchange-hall";
        return [{ x: o.x + o.w / 2, z: o.z + o.d / 2, icon: info.icon as PlaceIcon, colours, r: big ? 8.5 : 6.5 }];
      }),
    [world],
  );

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const size = RADIUS * 2;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(RADIUS, RADIUS, RADIUS - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#2a5a8a";
      ctx.fillRect(0, 0, size, size);
      ctx.translate(RADIUS, RADIUS);
      ctx.rotate(runtime.camera.yaw);
      ctx.drawImage(base, -runtime.player.x * PX, -runtime.player.z * PX);
      for (const dot of dots) {
        const dx = (dot.x - runtime.player.x) * PX;
        const dz = (dot.z - runtime.player.z) * PX;
        if (Math.abs(dx) > RADIUS * 1.5 || Math.abs(dz) > RADIUS * 1.5) continue;
        ctx.fillStyle = dot.kind === "waystone" ? "#7fd8ff" : dot.kind === "quest-board" ? "#4ad0ff" : dot.kind === "boss-lair" ? "#b46bff" : "#ffe14a";
        ctx.beginPath();
        ctx.arc(dx, dz, dot.kind === "waystone" ? 1.6 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      // Emblems stay upright: place them by hand in screen space (still inside the round clip).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const yaw = runtime.camera.yaw;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      for (const e of emblems) {
        const dx = (e.x - runtime.player.x) * PX;
        const dz = (e.z - runtime.player.z) * PX;
        if (Math.abs(dx) > RADIUS * 1.2 || Math.abs(dz) > RADIUS * 1.2) continue;
        drawEmblem(ctx, e.icon, e.colours, RADIUS + dx * cos - dz * sin, RADIUS + dx * sin + dz * cos, e.r);
      }
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(RADIUS - 2, RADIUS - 2, 4, 4);
      if (compassRef.current) compassRef.current.style.transform = `rotate(${runtime.camera.yaw}rad)`;
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [base, dots, emblems]);

  const onMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // The canvas may be drawn smaller than its pixel size: map the click back to canvas pixels.
    const scale = (RADIUS * 2) / (rect.width || RADIUS * 2);
    const sx = (e.clientX - rect.left) * scale - RADIUS;
    const sy = (e.clientY - rect.top) * scale - RADIUS;
    if (Math.hypot(sx, sy) > RADIUS) return;
    const yaw = runtime.camera.yaw;
    const dx = sx * Math.cos(yaw) + sy * Math.sin(yaw);
    const dz = -sx * Math.sin(yaw) + sy * Math.cos(yaw);
    runtime.walkTo?.(Math.floor(runtime.player.x + dx / PX), Math.floor(runtime.player.z + dz / PX));
  };

  if (collapsed) {
    return (
      <button type="button" className="rs-minimap-toggle" onClick={() => setCollapsed(false)} aria-expanded={false} aria-label="Show minimap" title="Show minimap">
        <Icon name="map" />
      </button>
    );
  }
  return (
    <div className="rs-minimap-frame" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} width={RADIUS * 2} height={RADIUS * 2} className="rs-minimap" onClick={onMapClick} aria-label="Minimap. Click to walk there." />
      <button type="button" className="rs-compass" ref={compassRef} onClick={() => (runtime.camera.yaw = 0)} title="Face north" aria-label="Compass: face north">
        <span>N</span>
      </button>
      <button type="button" className="rs-map-home" onClick={onHome} title="Home teleport: back to the plaza fountain" aria-label="Teleport home">
        <Icon name="home" />
      </button>
      <button type="button" className="rs-map-fold" onClick={() => setCollapsed(true)} aria-expanded={true} aria-label="Hide minimap" title="Hide minimap">
        <Icon name="minus" />
      </button>
    </div>
  );
}
