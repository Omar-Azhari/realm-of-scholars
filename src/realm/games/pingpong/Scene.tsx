/**
 * The table-tennis hall: a lit table in a wooden hall, your paddle under the mouse,
 * the rival (a real body) behind theirs. Everything moving is read from the engine
 * each frame; nothing here decides the game.
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HumanCharacter } from "../../scene/HumanCharacter";
import { WithFallback } from "../../scene/models";
import { surfaceMaterial } from "../../scene/textures";
import { defaultAppearance } from "../../customise/humans";
import { BALL_R, HALF_L, HALF_W, NET_HEIGHT, NET_OVERHANG, PLAYER_PADDLE_Z, RIVAL_PADDLE_Z, SIM_SPEED, TABLE_HEIGHT, TABLE_LENGTH, TABLE_WIDTH } from "./physics";
import type { PingPongEngine } from "./engine";
import type { AiProfile } from "./ai";
import type { Appearance } from "../../types";

export const CAMERA_POS: [number, number, number] = [0, 1.66, 2.85];
const CAMERA_LOOK = new THREE.Vector3(0, 0.84, -0.45);

/** Pointer position in normalised device coordinates (-1..1), written by the overlay. */
export type PointerRef = MutableRefObject<{ x: number; y: number }>;

export function PingPongScene({ engine, pointer, paused, profile }: { engine: MutableRefObject<PingPongEngine | null>; pointer: PointerRef; paused: boolean; profile: AiProfile }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...CAMERA_POS);
    camera.lookAt(CAMERA_LOOK);
  }, [camera]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLAYER_PADDLE_Z), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  useFrame((_, rawDelta) => {
    const e = engine.current;
    if (!e || paused) return;
    const dt = Math.min(rawDelta, 1 / 20);
    // The paddle sits exactly under the mouse, on its plane just behind your end.
    ndc.set(pointer.current.x, pointer.current.y);
    raycaster.setFromCamera(ndc, camera);
    // Dev-only autoplay for testing: the paddle chases the ball and swings up through it.
    if (import.meta.env.DEV && (window as unknown as { __ppAuto?: boolean }).__ppAuto) {
      const k = Math.min(1, dt * 12);
      e.setPaddle(e.paddle.x + (e.ball.x - 0.03 - e.paddle.x) * k, e.paddle.y + (e.ball.y - 0.04 + Math.sin(performance.now() / 120) * 0.05 - e.paddle.y) * k, dt);
    } else if (raycaster.ray.intersectPlane(plane, hit)) e.setPaddle(hit.x, hit.y, dt);
    e.tick(dt, dt * SIM_SPEED);
  });

  return (
    <>
      <color attach="background" args={["#14171f"]} />
      <fog attach="fog" args={["#14171f", 9, 22]} />
      <hemisphereLight args={["#fff4e0", "#3a2c22", 0.85]} />
      <directionalLight
        position={[0.6, 5, 1.2]}
        intensity={1.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-2.4}
        shadow-camera-right={2.4}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
        shadow-camera-near={1}
        shadow-camera-far={9}
        shadow-bias={-0.0006}
      />
      <Hall />
      <Table />
      <PlayerPaddle engine={engine} />
      <RivalPaddle engine={engine} />
      <BallMesh engine={engine} />
      <WithFallback fallback={null}>
        <Rival engine={engine} profile={profile} />
      </WithFallback>
    </>
  );
}

function Hall() {
  const floor = useMemo(() => surfaceMaterial("wood", 6, 6, "#b58a5c"), []);
  const banner = useMemo(() => bannerTexture(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floor}>
        <planeGeometry args={[14, 16]} />
      </mesh>
      {/* Court mat under the table. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[5.5, 9]} />
        <meshStandardMaterial color="#7a2c2c" roughness={0.95} />
      </mesh>
      {/* Walls. */}
      <mesh position={[0, 3, -7]}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#2a2f3d" roughness={0.9} />
      </mesh>
      <mesh position={[-7, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#262a36" roughness={0.9} />
      </mesh>
      <mesh position={[7, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[16, 6]} />
        <meshStandardMaterial color="#262a36" roughness={0.9} />
      </mesh>
      {/* House banners on the far wall. */}
      {["#b5452f", "#2f6fb5", "#3f8f4f", "#6a4fa3"].map((c, i) => (
        <group key={c} position={[-3.9 + i * 2.6, 3.3, -6.95]}>
          <mesh>
            <planeGeometry args={[1.3, 2.4]} />
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.24, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 1.5, 10]} />
            <meshStandardMaterial color="#d6a419" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {/* Barriers around the court, with the hall's name. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.7, 0.35, -1]} rotation={[0, (s * Math.PI) / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 0.7, 0.04]} />
          <meshStandardMaterial map={banner} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.35, -4.2]} receiveShadow>
        <boxGeometry args={[5.4, 0.7, 0.04]} />
        <meshStandardMaterial map={banner} roughness={0.7} />
      </mesh>
      {/* Lamps over the table. */}
      {[-0.9, 0.9].map((z) => (
        <group key={z} position={[0, 3.2, z]}>
          <mesh>
            <cylinderGeometry args={[0.32, 0.42, 0.18, 24, 1, true]} />
            <meshStandardMaterial color="#1c1f27" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.3, 24]} />
            <meshBasicMaterial color="#fff3d6" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 2.2, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function bannerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#1b2a4a");
  g.addColorStop(1, "#0f1830");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = "#e8c47a";
  ctx.fillRect(0, 10, 1024, 3);
  ctx.fillRect(0, 115, 1024, 3);
  ctx.font = "600 54px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f6deaa";
  ctx.fillText("SCHOLARS TABLE TENNIS CLUB", 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function netTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 32);
  ctx.strokeStyle = "rgba(20,24,32,0.9)";
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 32);
    ctx.stroke();
  }
  for (let y = 0; y <= 32; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

function Table() {
  const net = useMemo(() => netTexture(), []);
  const top = TABLE_HEIGHT;
  const line = 0.02;
  return (
    <group>
      <mesh position={[0, top - 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, 0.03, TABLE_LENGTH]} />
        <meshStandardMaterial color="#1f4f8c" roughness={0.55} />
      </mesh>
      {/* White lines: edges and the centre line. */}
      <mesh position={[0, top + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.003, TABLE_LENGTH]} />
        <meshBasicMaterial color="#f4f6fa" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`s${s}`} position={[s * (HALF_W - line / 2), top + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[line, TABLE_LENGTH]} />
          <meshBasicMaterial color="#f4f6fa" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`e${s}`} position={[0, top + 0.001, s * (HALF_L - line / 2)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[TABLE_WIDTH, line]} />
          <meshBasicMaterial color="#f4f6fa" />
        </mesh>
      ))}
      {/* Legs and frame. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (HALF_W - 0.12), (top - 0.03) / 2, sz * (HALF_L - 0.3)]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, top - 0.03, 10]} />
            <meshStandardMaterial color="#20232b" metalness={0.5} roughness={0.4} />
          </mesh>
        )),
      )}
      <mesh position={[0, top - 0.06, 0]}>
        <boxGeometry args={[TABLE_WIDTH - 0.2, 0.04, TABLE_LENGTH - 0.3]} />
        <meshStandardMaterial color="#15171d" roughness={0.8} />
      </mesh>
      {/* Net: mesh, white tape, posts. */}
      <mesh position={[0, top + NET_HEIGHT / 2, 0]}>
        <planeGeometry args={[TABLE_WIDTH + NET_OVERHANG * 2, NET_HEIGHT]} />
        <meshStandardMaterial map={net} transparent alphaTest={0.05} side={THREE.DoubleSide} roughness={0.9} color="#ffffff" />
      </mesh>
      <mesh position={[0, top + NET_HEIGHT - 0.008, 0]}>
        <boxGeometry args={[TABLE_WIDTH + NET_OVERHANG * 2, 0.016, 0.006]} />
        <meshStandardMaterial color="#f4f6fa" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (HALF_W + NET_OVERHANG), top + NET_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, NET_HEIGHT + 0.02, 8]} />
          <meshStandardMaterial color="#20232b" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/** A paddle: a red rubber face, a black back and a wooden handle. */
function PaddleMesh({ faceColor, backColor, see = false }: { faceColor: string; backColor: string; see?: boolean }) {
  // Your own paddle is slightly see-through, so it never hides the ball.
  const o = see ? { transparent: true, opacity: 0.8 } : {};
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.08]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.012, 28]} />
        <meshStandardMaterial color="#c9a36b" roughness={0.6} {...o} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0075]} scale={[1, 1, 1.08]}>
        <cylinderGeometry args={[0.098, 0.098, 0.004, 28]} />
        <meshStandardMaterial color={faceColor} roughness={0.75} {...o} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.0075]} scale={[1, 1, 1.08]}>
        <cylinderGeometry args={[0.098, 0.098, 0.004, 28]} />
        <meshStandardMaterial color={backColor} roughness={0.75} {...o} />
      </mesh>
      <mesh position={[0, -0.15, 0]} castShadow>
        <boxGeometry args={[0.03, 0.1, 0.024]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.6} {...o} />
      </mesh>
    </group>
  );
}

function PlayerPaddle({ engine }: { engine: MutableRefObject<PingPongEngine | null> }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = engine.current;
    if (!g.current) return;
    g.current.visible = !!e;
    if (!e) return;
    g.current.position.set(e.paddle.x, e.paddle.y, PLAYER_PADDLE_Z);
    // Tilt with the swing: the face closes on topspin and opens on backspin.
    const swing = Math.max(0, 1 - e.swingAge * 4);
    g.current.rotation.set(-0.25 - THREE.MathUtils.clamp(e.paddle.vy * 0.08, -0.5, 0.5), THREE.MathUtils.clamp(-e.paddle.vx * 0.06, -0.45, 0.45), -0.35 + swing * 0.3);
    g.current.scale.setScalar(0.95);
  });
  return (
    <group ref={g}>
      <PaddleMesh faceColor="#c8312b" backColor="#121316" see />
    </group>
  );
}

function RivalPaddle({ engine }: { engine: MutableRefObject<PingPongEngine | null> }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const e = engine.current;
    if (!g.current) return;
    if (!e) {
      // Waiting at the table before the match.
      g.current.position.set(0, 0.95, RIVAL_PADDLE_Z);
      g.current.rotation.set(0.25, Math.PI, 0.35);
      g.current.scale.setScalar(1.25);
      return;
    }
    const swing = Math.max(0, 1 - e.rivalSwingAge * 4);
    g.current.position.set(e.brain.x, e.brain.y, RIVAL_PADDLE_Z);
    g.current.rotation.set(0.25 + swing * 0.4, Math.PI, 0.35 - swing * 0.3);
    g.current.scale.setScalar(1.25);
  });
  return (
    <group ref={g}>
      <PaddleMesh faceColor="#121316" backColor="#c8312b" />
    </group>
  );
}

const TRAIL = 6;

function BallMesh({ engine }: { engine: MutableRefObject<PingPongEngine | null> }) {
  const ball = useRef<THREE.Mesh>(null);
  const trail = useRef<Array<THREE.Mesh | null>>([]);
  const mark = useRef<THREE.Mesh>(null);
  const markMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const e = engine.current;
    if (!ball.current) return;
    ball.current.visible = !!e;
    if (!e) {
      trail.current.forEach((m) => m && (m.visible = false));
      return;
    }
    ball.current.position.set(e.ball.x, e.ball.y, e.ball.z);
    const live = e.phase === "rally";
    for (let i = 0; i < TRAIL; i++) {
      const m = trail.current[i];
      if (!m) continue;
      const p = e.trail[e.trail.length - 2 - i];
      m.visible = live && !!p;
      if (p) m.position.set(p.x, p.y, p.z);
    }
    if (mark.current && markMat.current) {
      const age = e.lastBounce ? (performance.now() - e.lastBounce.at) / 1000 : 9;
      mark.current.visible = age < 0.6;
      if (e.lastBounce) mark.current.position.set(e.lastBounce.x, TABLE_HEIGHT + 0.002, e.lastBounce.z);
      mark.current.scale.setScalar(1 + age * 2.5);
      markMat.current.opacity = Math.max(0, 0.7 * (1 - age / 0.6));
    }
  });
  return (
    <group>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_R, 20, 14]} />
        <meshStandardMaterial color="#ff9b38" emissive="#ff7a1a" emissiveIntensity={0.25} roughness={0.4} />
      </mesh>
      {Array.from({ length: TRAIL }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            trail.current[i] = m;
          }}
          scale={1 - (i + 1) * 0.12}
        >
          <sphereGeometry args={[BALL_R, 10, 8]} />
          <meshBasicMaterial color="#ffb469" transparent opacity={0.32 - i * 0.045} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={mark} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.02, 0.032, 24]} />
        <meshBasicMaterial ref={markMat} color="#ffffff" transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function rivalAppearance(p: AiProfile): Appearance {
  return { ...defaultAppearance(p.body), skin: p.skin, hair: p.hair, outfitColour: p.outfit, build: p.body === "male" ? 0.1 : -0.1, muscle: 0.3 };
}

function Rival({ engine, profile }: { engine: MutableRefObject<PingPongEngine | null>; profile: AiProfile }) {
  const g = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const speed = useRef(1);
  const appearance = useMemo(() => rivalAppearance(profile), [profile]);
  useFrame(() => {
    const e = engine.current;
    if (!g.current) return;
    // Standing just to the side of the paddle hand, a step behind the paddle.
    g.current.position.set((e?.brain.x ?? 0) + 0.3, 0, RIVAL_PADDLE_Z - 0.42);
    if (!e) return;
    const v = Math.abs(e.brain.vx);
    moving.current = v > 0.35;
    speed.current = Math.min(1.6, 0.5 + v * 0.4);
  });
  return (
    <group ref={g}>
      <HumanCharacter appearance={appearance} movingRef={moving} speedRef={speed} height={1.74} idleClip="Idle" />
    </group>
  );
}
