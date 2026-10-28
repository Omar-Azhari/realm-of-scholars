/**
 * The parkour world: sky, clouds, the course's boxes (instanced by kind), signs,
 * checkpoint flags, the finish portal, the player's own character, the ghost, and the
 * camera rig (third-person orbit with collision, or first person), driven by the
 * session in session.ts.
 */

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HumanCharacter } from "../../scene/HumanCharacter";
import { WithFallback, type OneShot } from "../../scene/models";
import type { Appearance } from "../../types";
import { pieceBounds, pieceOffset, courseBounds, type CourseDef, type Piece } from "./courses";
import { PHYS } from "./physics";
import { sampleGhost } from "./ghost";
import { stepSession, type Session, type SessionEvent } from "./session";

export interface SceneProps {
  session: MutableRefObject<Session>;
  def: CourseDef;
  appearance: Appearance;
  reducedMotion: boolean;
  /** Which checkpoints are reached (index into checkpoints, start excluded). */
  checkpoint: number;
  onEvents: (events: SessionEvent[]) => void;
}

/* ------------------------------------------------------------------ materials */

/** Standard material with a world-space tile grid (Roblox-style studs) and darker sides. */
function tiledMaterial(color: string, opts: { emissive?: string; emissiveIntensity?: number; flow?: { dir: [number, number]; speed: number; stripe: string } } = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02 });
  if (opts.emissive) {
    mat.emissive = new THREE.Color(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 0.4;
  }
  const uniforms = {
    uTime: { value: 0 },
    uDir: { value: new THREE.Vector2(...(opts.flow?.dir ?? [0, 1])) },
    uSpeed: { value: opts.flow?.speed ?? 0 },
    uStripe: { value: new THREE.Color(opts.flow?.stripe ?? "#ffffff") },
    uFlow: { value: opts.flow ? 1 : 0 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPkWorld;\nvarying vec3 vPkNormal;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 pkW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pkW = instanceMatrix * pkW;
        #endif
        vPkWorld = (modelMatrix * pkW).xyz;
        vPkNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vPkWorld;
        varying vec3 vPkNormal;
        uniform float uTime;
        uniform vec2 uDir;
        uniform float uSpeed;
        uniform vec3 uStripe;
        uniform float uFlow;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 pkN = abs(vPkNormal);
        vec2 pkUv = pkN.y > 0.5 ? vPkWorld.xz : (pkN.x > 0.5 ? vPkWorld.zy : vPkWorld.xy);
        vec2 pkG = abs(fract(pkUv) - 0.5);
        vec2 pkW2 = fwidth(pkUv) * 1.2;
        vec2 pkL = smoothstep(vec2(0.5) - pkW2 - 0.02, vec2(0.5) - 0.02, pkG);
        float pkLine = max(pkL.x, pkL.y);
        diffuseColor.rgb *= 1.0 - pkLine * 0.16;
        diffuseColor.rgb *= pkN.y > 0.5 ? 1.0 : 0.82;
        if (uFlow > 0.5 && pkN.y > 0.5) {
          vec2 pkPerp = vec2(-uDir.y, uDir.x);
          float pkA = dot(vPkWorld.xz, uDir) - abs(fract(dot(vPkWorld.xz, pkPerp) * 0.5) - 0.5) * 1.2 - uTime * uSpeed;
          float pkS = smoothstep(0.45, 0.55, fract(pkA * 0.6));
          diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, pkS * 0.75);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `pk-tiled-${opts.flow ? "flow" : "plain"}`;
  return mat;
}

const PLAT_COLOURS = ["#8c6cff", "#ff9a3c", "#ff6fae", "#26c6b0", "#f1f1f1"];

const KIND_STYLE: Record<string, { color: string; emissive?: string; emissiveIntensity?: number }> = {
  start: { color: "#3ddc5a", emissive: "#1f9a35", emissiveIntensity: 0.25 },
  check: { color: "#ffd23f", emissive: "#a07800", emissiveIntensity: 0.25 },
  finish: { color: "#ffcc33", emissive: "#b07a00", emissiveIntensity: 0.45 },
  kill: { color: "#ff3b3b", emissive: "#ff1a1a", emissiveIntensity: 0.6 },
  bounce: { color: "#2f8bff", emissive: "#1060ff", emissiveIntensity: 0.55 },
  wall: { color: "#dfe6f3" },
  plat: { color: "#ffffff" },
};

/* ------------------------------------------------------------------ sky */

function SkyDome({ top, horizon }: { top: string; horizon: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTop: { value: new THREE.Color(top) }, uHorizon: { value: new THREE.Color(horizon) } },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDir; void main() { float h = vDir.y; vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.6)) : mix(uHorizon, uHorizon * 0.92, clamp(-h * 3.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }",
      }),
    [top, horizon],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[700, 32, 16]} />
    </mesh>
  );
}

/** Seeded random (stable clouds per course). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function Clouds({ def }: { def: CourseDef }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const r = rng(def.id.length * 977 + def.pieces.length);
    const { center, radius } = courseBounds(def);
    const out: Array<[number, number, number, number, number, number]> = [];
    // A sea of clouds below the course, and a few clouds drifting beside it.
    for (let c = 0; c < 26; c++) {
      const below = c < 16;
      const side = r() < 0.5 ? -1 : 1;
      const cx = below ? center.x + (r() - 0.5) * 170 : center.x + side * (48 + r() * 70);
      const cz = center.z + (r() - 0.5) * (radius * 2 + 80);
      const cy = below ? def.killY - 22 - r() * 10 : center.y - 6 + r() * 26;
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const s = (below ? 10 : 5) + r() * (below ? 10 : 5);
        out.push([cx + (r() - 0.5) * s * 2.2, cy + r() * s * 0.25, cz + (r() - 0.5) * s * 1.6, s, s * (below ? 0.38 : 0.55), s * 0.9]);
      }
    }
    return out;
  }, [def]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    puffs.forEach(([x, y, z, sx, sy, sz], i) => {
      m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [puffs]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 2]} />
      <meshLambertMaterial color="#f3f6ff" emissive="#8ea6cf" emissiveIntensity={0.18} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ course */

const unitBox = new THREE.BoxGeometry(1, 1, 1);

function setBoxMatrix(m: THREE.Matrix4, piece: Piece, time: number) {
  const { min, max } = pieceBounds(piece, time);
  m.compose(new THREE.Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2), new THREE.Quaternion(), new THREE.Vector3(max.x - min.x, max.y - min.y, max.z - min.z));
}

function StaticKind({ pieces, material, colours }: { pieces: Piece[]; material: THREE.Material; colours?: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    pieces.forEach((p, i) => {
      setBoxMatrix(m, p, 0);
      mesh.setMatrixAt(i, m);
      if (colours) mesh.setColorAt(i, new THREE.Color(colours[i % colours.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pieces, colours]);
  if (pieces.length === 0) return null;
  return <instancedMesh ref={ref} args={[unitBox, material, pieces.length]} castShadow receiveShadow />;
}

function MovingPiece({ piece, material, session }: { piece: Piece; material: THREE.Material; session: MutableRefObject<Session> }) {
  const ref = useRef<THREE.Mesh>(null);
  const [w, h, d] = piece.size;
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const [ox, oy, oz] = pieceOffset(piece, session.current.renderTime);
    mesh.position.set(piece.at[0] + ox, piece.at[1] + oy - h / 2, piece.at[2] + oz);
  });
  return <mesh ref={ref} geometry={unitBox} material={material} scale={[w, h, d]} castShadow receiveShadow />;
}

function CourseMeshes({ def, session, checkpoint }: { def: CourseDef; session: MutableRefObject<Session>; checkpoint: number }) {
  const materials = useMemo(() => {
    const out: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [kind, style] of Object.entries(KIND_STYLE)) out[kind] = tiledMaterial(style.color, style);
    def.pieces.forEach((p, i) => {
      if (p.k === "conveyor") out[`conveyor${i}`] = tiledMaterial("#3a3f55", { flow: { dir: p.dir ?? [0, 1], speed: p.speed ?? 3, stripe: "#ffb020" } });
      if (p.k === "boost") out[`boost${i}`] = tiledMaterial("#00d5f5", { emissive: "#00a8ff", emissiveIntensity: 0.6, flow: { dir: [-(p.dir?.[0] ?? 0), -(p.dir?.[1] ?? -1)], speed: 6, stripe: "#e8ffff" } });
    });
    return out;
  }, [def]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const groups = useMemo(() => {
    const byKind = new Map<string, Piece[]>();
    for (const p of def.pieces) {
      if (p.move || p.k === "conveyor" || p.k === "boost") continue;
      const list = byKind.get(p.k) ?? [];
      list.push(p);
      byKind.set(p.k, list);
    }
    return byKind;
  }, [def]);

  const moving = def.pieces.filter((p) => p.move);
  const special = def.pieces.map((p, i) => ({ p, i })).filter(({ p }) => !p.move && (p.k === "conveyor" || p.k === "boost"));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    materials.kill.emissiveIntensity = 0.45 + 0.3 * Math.sin(t * 5);
    materials.bounce.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 3);
    for (const m of Object.values(materials)) (m.userData.uniforms as { uTime: { value: number } }).uTime.value = t;
  });

  return (
    <>
      {[...groups.entries()].map(([kind, pieces]) => (
        <StaticKind key={kind} pieces={pieces} material={materials[kind] ?? materials.plat} colours={kind === "plat" ? PLAT_COLOURS : undefined} />
      ))}
      {special.map(({ p, i }) => (
        <MovingPiece key={i} piece={p} material={materials[`${p.k}${i}`]} session={session} />
      ))}
      {moving.map((p, i) => (
        <MovingPiece key={`m${i}`} piece={p} material={materials[p.k] ?? materials.plat} session={session} />
      ))}
      <CheckpointFlags def={def} reached={checkpoint} />
      <FinishPortal def={def} />
      {def.signs.map((s, i) => (
        <SignBoard key={i} text={s.text} at={s.at} rot={s.rot ?? 0} />
      ))}
    </>
  );
}

function CheckpointFlags({ def, reached }: { def: CourseDef; reached: number }) {
  const checks = def.pieces.filter((p) => p.k === "check");
  return (
    <>
      {checks.map((p, i) => {
        const { min, max } = pieceBounds(p, 0);
        const on = i + 1 <= reached;
        return (
          <group key={i} position={[max.x - 0.5, max.y, min.z + 0.5]}>
            <mesh position={[0, 1.4, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
              <meshStandardMaterial color="#e9e9e9" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[-0.55, 2.4, 0]} castShadow>
              <boxGeometry args={[1.1, 0.7, 0.04]} />
              <meshStandardMaterial color={on ? "#ffd23f" : "#8b8f9c"} emissive={on ? "#ffb000" : "#000000"} emissiveIntensity={on ? 0.8 : 0} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function FinishPortal({ def }: { def: CourseDef }) {
  const fin = def.pieces.find((p) => p.k === "finish");
  const ring = useRef<THREE.Mesh>(null);
  const swirl = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.35, "rgba(190,150,255,0.75)");
    grad.addColorStop(0.75, "rgba(120,80,255,0.35)");
    grad.addColorStop(1, "rgba(120,80,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = 3;
    for (let a = 0; a < 3; a++) {
      g.beginPath();
      for (let k = 0; k < 60; k++) {
        const t = k / 60;
        const ang = a * ((Math.PI * 2) / 3) + t * 5;
        const r = 8 + t * 50;
        g.lineTo(64 + Math.cos(ang) * r, 64 + Math.sin(ang) * r);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ clock }) => {
    if (swirl.current) swirl.current.rotation.z = -clock.elapsedTime * 1.4;
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.3;
  });
  if (!fin) return null;
  const { max, min } = pieceBounds(fin, 0);
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  return (
    <group position={[cx, max.y + 2.2, cz]}>
      <mesh ref={ring}>
        <torusGeometry args={[1.8, 0.18, 12, 48]} />
        <meshStandardMaterial color="#ffd75e" emissive="#ffb800" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <mesh ref={swirl}>
        <circleGeometry args={[1.7, 40]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function SignBoard({ text, at, rot }: { text: string; at: [number, number, number]; rot: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(14,17,28,0.92)";
    g.beginPath();
    g.roundRect(4, 4, 504, 120, 18);
    g.fill();
    g.strokeStyle = "rgba(232,196,122,0.85)";
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = 46;
    do {
      g.font = `600 ${size}px system-ui, "Segoe UI", Arial, sans-serif`;
      size -= 2;
    } while (g.measureText(text).width > 470 && size > 18);
    g.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={at} rotation={[0, rot, 0]}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[4.4, 1.1]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.4, -0.03]}>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
        <meshStandardMaterial color="#cfc6b0" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ characters */

function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function FallbackBody() {
  return (
    <mesh position={[0, 0.88, 0]} castShadow>
      <capsuleGeometry args={[0.3, 1.1, 6, 12]} />
      <meshStandardMaterial color="#d9c2a5" />
    </mesh>
  );
}

function PlayerAvatar({ session, appearance }: { session: MutableRefObject<Session>; appearance: Appearance }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const speed = useRef(1);
  const air = useRef(0);
  const oneShot = useRef<OneShot | null>(null);
  const lastMode = useRef(session.current.mode);
  useFrame((_, delta) => {
    const s = session.current;
    const p = s.player;
    const g = outer.current;
    if (!g) return;
    g.visible = !s.cam.firstPerson || s.mode === "preview";
    g.position.set(s.render.x, s.render.y, s.render.z);
    const facing = s.cam.firstPerson && s.mode === "run" ? s.cam.yaw + Math.PI : p.facing;
    g.rotation.y = s.snap ? facing : angleLerp(g.rotation.y, facing, Math.min(1, delta * 14));
    const h = Math.hypot(p.vel.x, p.vel.z);
    const active = s.mode === "run" && !s.paused;
    moving.current = active && (p.wallRun !== null || h > 0.6);
    speed.current = Math.max(0.55, Math.min(1.6, h / 6.5));
    const tuck = active && !p.grounded && !p.wallRun ? Math.max(0.35, Math.min(1, 1 - Math.abs(p.vel.y) / 16)) : 0;
    air.current += (tuck - air.current) * Math.min(1, delta * 12);
    if (inner.current) {
      const lean = p.wallRun ? -p.wallRun.side * 0.35 : 0;
      inner.current.rotation.z += (lean - inner.current.rotation.z) * Math.min(1, delta * 10);
    }
    if (s.rollQueued) {
      s.rollQueued = false;
      oneShot.current = "Roll";
    }
    if (s.mode === "done" && lastMode.current !== "done") oneShot.current = "Wave";
    lastMode.current = s.mode;
  });
  return (
    <group ref={outer}>
      <group ref={inner}>
        <WithFallback fallback={<FallbackBody />}>
          <HumanCharacter appearance={appearance} movingRef={moving} oneShotRef={oneShot} speedRef={speed} airRef={air} height={PHYS.height} />
        </WithFallback>
      </group>
    </group>
  );
}

function GhostRunner({ session }: { session: MutableRefObject<Session> }) {
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#7fe8ff", transparent: true, opacity: 0.32, depthWrite: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const s = session.current;
    const frame = s.ghost && s.mode !== "preview" ? sampleGhost(s.ghost, s.timer.started ? s.timer.time : 0) : null;
    g.visible = !!frame;
    if (!frame) return;
    g.position.set(frame.x, frame.y + (frame.pose === 1 ? Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.06 : 0), frame.z);
    g.rotation.y = frame.facing;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.78, 0]} material={mat}>
        <capsuleGeometry args={[0.28, 0.9, 4, 10]} />
      </mesh>
      <mesh position={[0, 1.52, 0]} material={mat}>
        <sphereGeometry args={[0.2, 12, 10]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ camera + loop */

const tmpV = new THREE.Vector3();
const AXES = ["x", "y", "z"] as const;

/** Distance along a ray (origin o, unit dir d) to the nearest box, or Infinity. */
function rayBoxes(o: THREE.Vector3, d: THREE.Vector3, maxT: number, session: Session): number {
  let best = Infinity;
  for (const b of session.course.world.solids) {
    let t0 = 0;
    let t1 = maxT;
    let hit = true;
    for (const a of AXES) {
      const inv = 1 / (d[a] || 1e-9);
      let tn = (b.min[a] - 0.15 - o[a]) * inv;
      let tf = (b.max[a] + 0.15 - o[a]) * inv;
      if (tn > tf) [tn, tf] = [tf, tn];
      t0 = Math.max(t0, tn);
      t1 = Math.min(t1, tf);
      if (t0 > t1) {
        hit = false;
        break;
      }
    }
    if (hit && t0 > 0.05 && t0 < best) best = t0;
  }
  return best;
}

function Rig({ session, def, reducedMotion, onEvents }: { session: MutableRefObject<Session>; def: CourseDef; reducedMotion: boolean; onEvents: (e: SessionEvent[]) => void }) {
  const { camera, scene } = useThree();
  const light = useRef<THREE.DirectionalLight>(null);
  const focus = useRef(new THREE.Vector3());
  const orbit = useRef(0);
  useEffect(() => {
    scene.fog = new THREE.Fog(def.sky.horizon, 140, 520);
    return () => {
      scene.fog = null;
    };
  }, [scene, def.sky.horizon]);
  useEffect(() => {
    if (light.current) scene.add(light.current.target);
    const target = light.current?.target;
    return () => {
      if (target) scene.remove(target);
    };
  }, [scene]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const s = session.current;
    // Keyboard camera turn (Q/E) and tilt (Page Up / Page Down).
    if (s.mode === "run" && !s.paused) {
      if (s.keys.has("KeyQ")) s.cam.yaw -= delta * 2.2;
      if (s.keys.has("KeyE")) s.cam.yaw += delta * 2.2;
      if (s.keys.has("PageUp")) {
        if (s.cam.firstPerson) s.cam.look = Math.min(1.4, s.cam.look + delta * 1.4);
        else s.cam.pitch = Math.max(-0.2, s.cam.pitch - delta * 1.2);
      }
      if (s.keys.has("PageDown")) {
        if (s.cam.firstPerson) s.cam.look = Math.max(-1.4, s.cam.look - delta * 1.4);
        else s.cam.pitch = Math.min(1.3, s.cam.pitch + delta * 1.2);
      }
    }
    const events = stepSession(s, delta);
    if (events.length) onEvents(events);
    const p = s.render;
    const persp = camera as THREE.PerspectiveCamera;

    // Sun shadow follows the player.
    if (light.current) {
      light.current.position.set(p.x + 10, p.y + 24, p.z + 8);
      light.current.target.position.set(p.x, p.y, p.z);
    }

    if (s.mode === "preview") {
      const { center, radius } = courseBounds(def);
      orbit.current += delta * (reducedMotion ? 0 : 0.06);
      const r = Math.max(30, radius * 0.95);
      camera.position.set(center.x + Math.sin(orbit.current + 0.7) * r, center.y + r * 0.45, center.z + Math.cos(orbit.current + 0.7) * r);
      camera.lookAt(center.x, center.y, center.z);
      const fov = 50;
      if (persp.fov !== fov) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
      s.snap = true;
      return;
    }

    const cam = s.cam;
    const pl = s.player;
    // Wall-run tilt and sprint FOV kick (both off with reduced motion).
    const rollTarget = !reducedMotion && pl.wallRun ? pl.wallRun.side * (cam.firstPerson ? 0.12 : 0.06) : 0;
    cam.roll += (rollTarget - cam.roll) * Math.min(1, delta * 8);
    const kick = !reducedMotion && (pl.sprinting || pl.boost > 0) && Math.hypot(pl.vel.x, pl.vel.z) > PHYS.walkSpeed + 0.5 ? (pl.boost > 0 ? 10 : 6) : 0;
    cam.fovKick += (kick - cam.fovKick) * Math.min(1, delta * 5);
    const fov = (cam.firstPerson ? 78 : 70) + cam.fovKick;
    if (Math.abs(persp.fov - fov) > 0.01) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }

    if (cam.firstPerson) {
      const eyeY = p.y + PHYS.height - 0.18;
      camera.position.set(p.x, eyeY, p.z);
      tmpV.set(p.x - Math.sin(cam.yaw) * Math.cos(cam.look), eyeY + Math.sin(cam.look), p.z - Math.cos(cam.yaw) * Math.cos(cam.look));
      camera.lookAt(tmpV);
      camera.rotateZ(cam.roll);
      focus.current.set(p.x, p.y + 1.5, p.z);
      s.snap = false;
      return;
    }

    // Third person: rigid on the ground plane, a little softer vertically.
    const target = tmpV.set(p.x, p.y + 1.45, p.z);
    if (s.snap) focus.current.copy(target);
    else {
      focus.current.x = target.x;
      focus.current.z = target.z;
      focus.current.y += (target.y - focus.current.y) * Math.min(1, delta * 12);
    }
    const f = focus.current;
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    // Pull in when something is between the camera and the player.
    const hit = rayBoxes(f, dir, cam.dist, s);
    const want = Math.max(1.2, Math.min(cam.dist, hit - 0.3));
    if (want < cam.distNow || s.snap) cam.distNow = want;
    else cam.distNow += (want - cam.distNow) * Math.min(1, delta * 4);
    camera.position.set(f.x + dir.x * cam.distNow, f.y + dir.y * cam.distNow, f.z + dir.z * cam.distNow);
    camera.lookAt(f);
    camera.rotateZ(cam.roll);
    s.snap = false;
  });

  return (
    <>
      <hemisphereLight args={["#dbeaff", "#8a7a68", 0.9]} />
      <directionalLight
        ref={light}
        intensity={2.1}
        color="#fff3df"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}

export function ParkourScene({ session, def, appearance, reducedMotion, checkpoint, onEvents }: SceneProps) {
  return (
    <>
      <Rig session={session} def={def} reducedMotion={reducedMotion} onEvents={onEvents} />
      <SkyDome top={def.sky.top} horizon={def.sky.horizon} />
      <Clouds def={def} />
      <CourseMeshes def={def} session={session} checkpoint={checkpoint} />
      <GhostRunner session={session} />
      <Suspense fallback={null}>
        <PlayerAvatar session={session} appearance={appearance} />
      </Suspense>
    </>
  );
}
