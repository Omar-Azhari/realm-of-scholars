/**
 * The lecture theatre in 3D: a wooden stage with a big projection screen on
 * the back wall (it shows the current slide, see lecture/live.ts), tiered
 * benches with fold-down desks, tall windows of moonlight on the left, wall
 * sconces, and the lectern the professor stands behind.
 */

import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  BENCH_FIRST,
  BENCH_LAST,
  BENCH_SPANS,
  STAGE_ROWS,
  THEATRE_COLS,
  THEATRE_DOOR_COL,
  THEATRE_ROWS,
  THEATRE_X,
  THEATRE_Z,
} from "../lecture/theatre";
import { liveSlide, onLiveSlide, type LiveSlide } from "../lecture/live";
import { drawVisual } from "../lecture/visuals";
import { RoomWalls } from "./RoomWalls";

const WALL_H = 5;
const LOW = 0.45;
const SCREEN_W = 7;
const SCREEN_H = 3.94;

function woodTexture(
  repeatX: number,
  repeatY: number,
  dark = false,
): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    const shade = (dark ? 70 : 115) + ((i * 37) % 26);
    g.fillStyle = `rgb(${shade + 38}, ${shade + 6}, ${shade - 38})`;
    g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = "rgba(40,22,10,0.55)";
    g.fillRect(0, i * 32 + 30, 256, 2);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

function carpetTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5a1a22";
  g.fillRect(0, 0, 128, 128);
  // A faint woven diamond pattern.
  g.strokeStyle = "rgba(214,164,25,0.16)";
  g.lineWidth = 2;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.moveTo(i + 128, 0);
    g.lineTo(i, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(THEATRE_COLS / 2, (THEATRE_ROWS - STAGE_ROWS) / 2);
  return t;
}

/** Splits text into lines that fit `width` at the context's current font. */
function wrap(
  g: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** How far the slide's diagram has built (0..1). */
function revealOf(slide: LiveSlide | null, now: number): number {
  if (!slide?.visual || slide.startedAt === undefined) return 1;
  return Math.max(
    0,
    Math.min(
      1,
      (now - slide.startedAt) / Math.max(800, slide.revealMs ?? 8000),
    ),
  );
}

function drawSlide(
  g: CanvasRenderingContext2D,
  slide: LiveSlide | null,
  reveal = 1,
): void {
  const W = g.canvas.width;
  const H = g.canvas.height;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b2340");
  bg.addColorStop(1, "#0d1226");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#d6a419";
  g.lineWidth = 6;
  g.strokeRect(18, 18, W - 36, H - 36);
  g.textBaseline = "top";
  if (!slide) {
    g.fillStyle = "#f3e6c8";
    g.font = "bold 76px Georgia, serif";
    g.textAlign = "center";
    g.fillText("Lecture Theatre", W / 2, H / 2 - 110);
    g.font = "36px Georgia, serif";
    g.fillStyle = "#c9b98f";
    g.fillText("Speak to the professor at the lectern", W / 2, H / 2 + 10);
    g.fillText("to relive any week's lecture.", W / 2, H / 2 + 60);
    g.textAlign = "left";
    return;
  }
  g.textAlign = "left";
  g.font = "28px Georgia, serif";
  g.fillStyle = "#c9b98f";
  g.fillText(slide.subject, 60, 50);
  g.textAlign = "right";
  g.fillText(
    slide.index > 0 ? `${slide.index} / ${slide.total}` : slide.title,
    W - 60,
    50,
  );
  g.textAlign = "left";
  g.font = "bold 58px Georgia, serif";
  g.fillStyle = "#f6d77a";
  let y = 108;
  for (const line of wrap(g, slide.heading, W - 120).slice(0, 2)) {
    g.fillText(line, 60, y);
    y += 68;
  }
  g.fillStyle = "#d6a419";
  g.fillRect(60, y + 6, 220, 4);
  y += 40;
  if (slide.video) {
    g.font = "bold 40px Georgia, serif";
    g.fillStyle = "#f3e6c8";
    g.textAlign = "center";
    g.fillText("▶  Now showing in your lecture panel", W / 2, y + 120);
    g.font = "32px Georgia, serif";
    g.fillStyle = "#c9b98f";
    for (const [i, line] of wrap(g, slide.video, W - 200)
      .slice(0, 2)
      .entries())
      g.fillText(line, W / 2, y + 190 + i * 44);
    g.textAlign = "left";
    return;
  }
  if (slide.visual) {
    drawVisual(
      g,
      slide.visual,
      { x: 60, y, w: W - 120, h: H - y - 50 },
      reveal,
    );
    return;
  }
  g.font = "34px Georgia, serif";
  g.fillStyle = "#f3e6c8";
  for (const point of slide.points.slice(0, 6)) {
    const lines = wrap(g, point, W - 170).slice(0, 2);
    if (y + lines.length * 42 > H - 60) break;
    g.fillStyle = "#d6a419";
    g.fillText("✦", 66, y);
    g.fillStyle = "#f3e6c8";
    for (const line of lines) {
      g.fillText(line, 110, y);
      y += 42;
    }
    y += 12;
  }
}

/** The projection screen: redraws whenever the lecture moves to a new slide. */
function ProjectionScreen({
  position,
  glow = true,
}: {
  position: [number, number, number];
  glow?: boolean;
}) {
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 720;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, texture: t };
  }, []);
  const lastDraw = useRef(0);
  const settled = useRef(false);
  useEffect(() => {
    const g = canvas.getContext("2d");
    if (!g) return;
    const draw = () => {
      settled.current = false;
      lastDraw.current = 0;
      drawSlide(g, liveSlide(), revealOf(liveSlide(), performance.now()));
      texture.needsUpdate = true;
    };
    draw();
    return onLiveSlide(draw);
  }, [canvas, texture]);
  // While a diagram builds, redraw about 30 times a second; stop once it's complete.
  useFrame(() => {
    const slide = liveSlide();
    if (settled.current || !slide?.visual) return;
    const now = performance.now();
    if (now - lastDraw.current < 33) return;
    lastDraw.current = now;
    const g = canvas.getContext("2d");
    if (!g) return;
    const reveal = revealOf(slide, now);
    drawSlide(g, slide, reveal);
    texture.needsUpdate = true;
    if (reveal >= 1) settled.current = true;
  });
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[SCREEN_W + 0.3, SCREEN_H + 0.3, 0.06]} />
        <meshStandardMaterial color="#2a1c12" roughness={0.6} />
      </mesh>
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* The screen's glow on the stage. */}
      {glow ? (
        <pointLight
          position={[0, -0.5, 1.6]}
          color="#8fa6ff"
          intensity={7}
          distance={9}
          decay={1.6}
        />
      ) : null}
    </group>
  );
}

/** One row of benches: a riser, a seat with a backrest, and a desk in front. */
function BenchRow({ row, rise }: { row: number; rise: number }) {
  const parts: ReactNode[] = [];
  for (const [a, b] of BENCH_SPANS) {
    const len = b - a + 1;
    const x = THEATRE_X + a + len / 2;
    const z = THEATRE_Z + row + 0.5;
    parts.push(
      <group key={`${row}-${a}`} position={[x, rise, z]}>
        <mesh position={[0, -rise / 2, 0]} receiveShadow>
          <boxGeometry args={[len, Math.max(0.02, rise), 1]} />
          <meshStandardMaterial color="#3a2618" roughness={0.9} />
        </mesh>
        {/* Seat and backrest (facing the stage, -Z). */}
        <mesh position={[0, 0.45, 0.18]} castShadow receiveShadow>
          <boxGeometry args={[len - 0.1, 0.08, 0.42]} />
          <meshStandardMaterial color="#7a1f2a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, 0.4]} castShadow>
          <boxGeometry args={[len - 0.1, 0.6, 0.08]} />
          <meshStandardMaterial color="#6b4428" roughness={0.75} />
        </mesh>
        {/* Writing desk in front of the seats. */}
        <mesh position={[0, 0.72, -0.28]} rotation={[0.18, 0, 0]} castShadow>
          <boxGeometry args={[len - 0.1, 0.05, 0.34]} />
          <meshStandardMaterial color="#8a5a34" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.36, -0.42]} castShadow>
          <boxGeometry args={[len - 0.1, 0.72, 0.05]} />
          <meshStandardMaterial color="#6b4428" roughness={0.8} />
        </mesh>
      </group>,
    );
  }
  return <>{parts}</>;
}

function Sconce({
  position,
  lit = true,
}: {
  position: [number, number, number];
  lit?: boolean;
}) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#6b5434" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      {lit ? (
        <pointLight
          position={[0, 0.3, 0.2]}
          color="#ffbe6a"
          intensity={3.5}
          distance={6}
          decay={1.8}
        />
      ) : null}
    </group>
  );
}

/**
 * The theatre's room. `embedded`: it stands inside its building on the island
 * (world/rooms.ts), so it brings its own walls and roof (RoomWalls) instead of
 * a dark backdrop and scene-wide lights.
 */
export function TheatreShell({
  onFloorClick,
  onFloorHover,
  embedded = false,
  insideRef,
}: {
  onFloorClick: (x: number, z: number) => void;
  onFloorHover: () => void;
  embedded?: boolean;
  insideRef?: MutableRefObject<boolean>;
}) {
  const stageWood = useMemo(
    () => woodTexture(THEATRE_COLS / 3, STAGE_ROWS / 3),
    [],
  );
  const carpet = useMemo(carpetTexture, []);
  const x0 = THEATRE_X;
  const z0 = THEATRE_Z;
  const x1 = THEATRE_X + THEATRE_COLS;
  const z1 = THEATRE_Z + THEATRE_ROWS;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const doorX0 = THEATRE_DOOR_COL + THEATRE_X;
  const plaster = "#d9c9a8";
  const floorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    onFloorClick(Math.floor(e.point.x), Math.floor(e.point.z));
  };
  // Things hung on the walls. On the island they belong to the walls, so they hide when a wall drops away.
  const backDecor = (
    <>
      {/* Back wall (dark panelling behind the screen). */}
      {embedded ? (
        <mesh position={[cx, WALL_H / 2, z0 + 0.02]} receiveShadow>
          <planeGeometry args={[THEATRE_COLS, WALL_H]} />
          <meshStandardMaterial color="#4a2f22" roughness={0.9} />
        </mesh>
      ) : (
        <mesh position={[cx, WALL_H / 2, z0 - 0.05]} receiveShadow>
          <boxGeometry args={[THEATRE_COLS + 0.2, WALL_H, 0.1]} />
          <meshStandardMaterial color="#4a2f22" roughness={0.9} />
        </mesh>
      )}
      {/* On the island the house lights do the work: fewer lights keeps the whole scene fast. */}
      <ProjectionScreen
        position={[cx - 0.6, 2.75, z0 + 0.06]}
        glow={!embedded}
      />
      {/* House banners either side of the screen. */}
      {[
        [x0 + 0.9, "#b83a2e"],
        [x1 - 0.9, "#2e6bb8"],
      ].map(([x, colour]) => (
        <group key={String(x)} position={[x as number, 3.2, z0 + 0.06]}>
          <mesh>
            <planeGeometry args={[0.9, 2.2]} />
            <meshStandardMaterial
              color={colour as string}
              roughness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 1.12, 0.02]}>
            <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
            <meshStandardMaterial
              color="#b8892a"
              metalness={0.7}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}
    </>
  );
  const leftDecor = (
    <>
      {[cz - 2.6, cz + 0.4, cz + 3.4].map((z) => (
        <group
          key={z}
          position={[x0 + 0.02, 2.5, z]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <mesh>
            <planeGeometry args={[1.1, 2.4]} />
            <meshBasicMaterial color="#2c3a66" toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <circleGeometry args={[0.55, 20, 0, Math.PI]} />
            <meshBasicMaterial color="#2c3a66" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.2, 0.01]}>
            <planeGeometry args={[0.06, 2.8]} />
            <meshStandardMaterial color="#3a2618" />
          </mesh>
        </group>
      ))}
      <Sconce position={[x0 + 0.12, 2.6, z0 + 3]} lit={!embedded} />
      <Sconce position={[x0 + 0.12, 2.6, z1 - 1.5]} lit={!embedded} />
    </>
  );
  const rows: number[] = [];
  for (let r = BENCH_FIRST; r <= BENCH_LAST; r += 2) rows.push(r);
  return (
    <group>
      {embedded ? null : (
        <>
          <color attach="background" args={["#0b0810"]} />
          <hemisphereLight args={["#ffe9c8", "#2a1a14", 0.45]} />
          <ambientLight intensity={0.18} />
          {/* Moonlight through the tall windows. */}
          <directionalLight
            position={[x0 - 6, 7, cz]}
            intensity={0.7}
            color="#b8c8ff"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          >
            <orthographicCamera
              attach="shadow-camera"
              args={[-9, 9, 9, -9, 0.5, 30]}
            />
          </directionalLight>
        </>
      )}
      {/* Stage and house lights (on the island one shared indoor light does this: see WalkInRooms). */}
      {embedded ? null : (
        <>
          <pointLight position={[x0 + 8.5, 3.6, z0 + 3]} intensity={16} distance={9} decay={1.5} color="#fff0d6" castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
          <pointLight position={[cx, 4.2, cz + 2]} color="#ffd9a0" intensity={14} distance={16} decay={1.6} />
        </>
      )}
      {embedded && insideRef ? (
        <RoomWalls
          x0={x0}
          z0={z0}
          x1={x1}
          z1={z1}
          height={WALL_H}
          door={{ x: doorX0, width: 1 }}
          insideRef={insideRef}
          inner={plaster}
          outer="#cdbb9a"
          roof="#3c4a6e"
          decor={{ back: backDecor, left: leftDecor }}
        />
      ) : null}

      {/* Stage floor (wood) and seating floor (carpet). */}
      <mesh
        position={[cx, 0.001, z0 + STAGE_ROWS / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={floorClick}
        onPointerMove={onFloorHover}
      >
        <planeGeometry args={[THEATRE_COLS, STAGE_ROWS]} />
        <meshStandardMaterial map={stageWood} roughness={0.55} />
      </mesh>
      <mesh
        position={[cx, 0, z0 + STAGE_ROWS + (THEATRE_ROWS - STAGE_ROWS) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={floorClick}
        onPointerMove={onFloorHover}
      >
        <planeGeometry args={[THEATRE_COLS, THEATRE_ROWS - STAGE_ROWS]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      {/* Brass trim along the stage edge. */}
      <mesh position={[cx, 0.03, z0 + STAGE_ROWS]}>
        <boxGeometry args={[THEATRE_COLS, 0.06, 0.08]} />
        <meshStandardMaterial
          color="#b8892a"
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>

      {rows.map((r, i) => (
        <BenchRow key={r} row={r} rise={0.12 + i * 0.22} />
      ))}

      {embedded ? null : backDecor}
      {embedded ? null : leftDecor}
      {/* Left wall with tall arched windows. */}
      {embedded ? null : (
        <mesh position={[x0 - 0.05, WALL_H / 2, cz]} receiveShadow>
          <boxGeometry args={[0.1, WALL_H, THEATRE_ROWS + 0.2]} />
          <meshStandardMaterial color={plaster} roughness={0.95} />
        </mesh>
      )}
      {/* Right and front walls cut away low so the room stays visible. */}
      {embedded ? null : (
        <>
          <mesh position={[x1 + 0.05, LOW / 2, cz]}>
            <boxGeometry args={[0.1, LOW, THEATRE_ROWS]} />
            <meshStandardMaterial color={plaster} roughness={0.95} />
          </mesh>
          {/* Front wall, with the doorway. */}
          <mesh position={[(x0 + doorX0) / 2, LOW / 2, z1 + 0.05]}>
            <boxGeometry args={[doorX0 - x0, LOW, 0.1]} />
            <meshStandardMaterial color={plaster} roughness={0.95} />
          </mesh>
          <mesh position={[(doorX0 + 1 + x1) / 2, LOW / 2, z1 + 0.05]}>
            <boxGeometry args={[x1 - doorX0 - 1, LOW, 0.1]} />
            <meshStandardMaterial color={plaster} roughness={0.95} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** A tall wooden lectern with an open book on its sloped top (the professor stands behind it, -Z). */
export function LecternStand() {
  return (
    <group position={[0, 0, 0.1]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.6, 1.1, 0.42]} />
        <meshStandardMaterial color="#6b4428" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.14, -0.02]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.74, 0.06, 0.52]} />
        <meshStandardMaterial color="#8a5a34" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.19, -0.01]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.5, 0.03, 0.34]} />
        <meshStandardMaterial color="#f3e6c8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6, 0.215]}>
        <planeGeometry args={[0.36, 0.5]} />
        <meshStandardMaterial color="#d6a419" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}
