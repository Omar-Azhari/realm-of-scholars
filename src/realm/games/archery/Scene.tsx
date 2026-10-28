/**
 * The archery range: an outdoor field with straw targets, lanes, distance posts, flags and
 * drifting seeds that show the wind, and a recurve bow held in first person. Moving parts
 * are read from the engine each frame; nothing here decides the game.
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NatureModel, PropModel, WithFallback, type NatureModelId } from "../../scene/models";
import { groundDetailTexture, surfaceMaterial } from "../../scene/textures";
import { EYE_HEIGHT } from "./physics";
import { TARGET_HEIGHT, type TargetSpec } from "./rules";
import { ArcheryEngine } from "./engine";

/** DOM bits of the HUD that change every frame (updated here, not through React). */
export interface HudEls {
  pins: Array<{ el: HTMLElement | null; elevation: number; distance: number }>;
  power: HTMLElement | null;
  powerMeter: HTMLElement | null;
  breath: HTMLElement | null;
  breathMeter: HTMLElement | null;
  reticle: HTMLElement | null;
}

const BASE_FOV = 62;
const ZOOM_FOV = 36;
const HOUSE_COLOURS = ["#b5452f", "#2f6fb5", "#3f8f4f", "#6a4fa3"];

export function ArcheryScene({ engine, paused, hud, targetsKey }: { engine: MutableRefObject<ArcheryEngine | null>; paused: boolean; hud: MutableRefObject<HudEls>; targetsKey: string }) {
  const targets = engine.current?.targets ?? [];
  return (
    <>
      <color attach="background" args={["#bcd3e6"]} />
      <SkyDome />
      <fog attach="fog" args={["#c9dceb", 70, 230]} />
      <hemisphereLight args={["#e6f1ff", "#5d7a3a", 0.75]} />
      <Sun />
      <CameraRig engine={engine} paused={paused} hud={hud} />
      <Field />
      <Scenery />
      <WindFlags engine={engine} />
      <Seeds engine={engine} />
      <group key={targetsKey}>
        {targets.map((t) => (
          <Target key={t.id} spec={t} engine={engine} />
        ))}
      </group>
      <Arrows engine={engine} />
      <Bow engine={engine} />
      <Burst engine={engine} />
    </>
  );
}

/** A soft summer sky: deep blue overhead fading to a hazy horizon that meets the fog. */
function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color("#4f8fd0") }, horizon: { value: new THREE.Color("#c9dceb") }, glow: { value: new THREE.Color("#fff6dc") } },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; varying vec3 vDir; void main() { float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.55)); float sun = pow(max(dot(vDir, normalize(vec3(-0.45, 0.5, 0.75))), 0.0), 24.0); c = mix(c, glow, sun * 0.6); gl_FragColor = vec4(c, 1.0); }",
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[800, 32, 16]} />
    </mesh>
  );
}

/** One sun with modest shadows, aimed down the range. */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(0, 0, -26);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <directionalLight
      ref={light}
      position={[-14, 26, 18]}
      intensity={2.2}
      color="#fff3dc"
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-camera-left={-14}
      shadow-camera-right={14}
      shadow-camera-top={32}
      shadow-camera-bottom={-32}
      shadow-camera-near={5}
      shadow-camera-far={110}
      shadow-bias={-0.0008}
      shadow-normalBias={0.03}
    />
  );
}

// ---------------------------------------------------------------------------
// Camera, zoom and the per-frame HUD (bow-sight pins, meters)
// ---------------------------------------------------------------------------

function CameraRig({ engine, paused, hud }: { engine: MutableRefObject<ArcheryEngine | null>; paused: boolean; hud: MutableRefObject<HudEls> }) {
  const { camera, size } = useThree();
  const follow = useRef({ active: false, pos: new THREE.Vector3(), look: new THREE.Vector3() });
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), want: new THREE.Vector3() }), []);
  useFrame((_, raw) => {
    const e = engine.current;
    const cam = camera as THREE.PerspectiveCamera;
    const dt = Math.min(raw, 1 / 20);
    if (!e) {
      // Menu: a slow look down the range.
      cam.position.set(0, EYE_HEIGHT + 0.4, 2.5);
      cam.rotation.set(-0.02, Math.sin(performance.now() / 6000) * 0.12, 0, "YXZ");
      return;
    }
    if (!paused && e.phase !== "done") e.tick(dt);

    // Arrow camera: chase the arrow, then hold on where it landed.
    const chase = e.arrowCam && (e.arrow || (e.phase === "result" && e.landedAt));
    if (chase) {
      if (e.arrow) {
        const v = e.arrow.v;
        tmp.dir.set(v.x, v.y, v.z).normalize();
        tmp.want.set(e.arrow.p.x, e.arrow.p.y, e.arrow.p.z).addScaledVector(tmp.dir, -1.4);
        tmp.want.y += 0.22;
        if (!follow.current.active) follow.current.pos.copy(cam.position);
        follow.current.active = true;
        follow.current.pos.lerp(tmp.want, Math.min(1, dt * 14));
        follow.current.look.set(e.arrow.p.x, e.arrow.p.y, e.arrow.p.z).addScaledVector(tmp.dir, 2);
      } else if (e.landedAt) {
        follow.current.look.lerp(new THREE.Vector3(e.landedAt.x, e.landedAt.y, e.landedAt.z), Math.min(1, dt * 6));
      }
      cam.position.copy(follow.current.pos);
      cam.lookAt(follow.current.look);
    } else {
      follow.current.active = false;
      const a = e.aim;
      cam.position.set(0, EYE_HEIGHT, 0);
      cam.rotation.set(a.pitch, -a.yaw, 0, "YXZ");
    }
    // Drawing the bow narrows the view, like sighting down the arrow.
    const wantFov = chase ? 55 : BASE_FOV - (BASE_FOV - ZOOM_FOV) * e.power;
    if (Math.abs(cam.fov - wantFov) > 0.01) {
      cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 10);
      cam.updateProjectionMatrix();
    }

    // HUD: sight pins sit below the aim point by the drop for their distance.
    const h = hud.current;
    const f = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    for (const pin of h.pins) {
      if (!pin.el) continue;
      const angle = pin.elevation + Math.atan((EYE_HEIGHT - TARGET_HEIGHT) / pin.distance);
      pin.el.style.top = `${Math.tan(angle) * f}px`;
    }
    if (h.reticle) h.reticle.style.opacity = chase ? "0" : "1";
    if (h.power) h.power.style.height = `${Math.round(e.power * 100)}%`;
    if (h.powerMeter) h.powerMeter.classList.toggle("is-full", e.power >= 1);
    if (h.breath) h.breath.style.height = `${Math.round(e.breath.air * 100)}%`;
    if (h.breathMeter) h.breathMeter.classList.toggle("is-strained", e.breath.strain > 0.05 || e.fatigue > 0.3);
  });
  return null;
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? "#7aa452" : "#86b05b";
    ctx.fillRect(0, i * 64, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function labelTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string } = {}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = opts.w ?? 256;
  c.height = opts.h ?? 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = opts.bg ?? "#f3ead2";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(60,40,20,0.6)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
  ctx.fillStyle = opts.fg ?? "#2a2117";
  ctx.font = opts.font ?? "700 72px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Field() {
  const grass = useMemo(() => {
    const t = groundDetailTexture().clone();
    t.repeat.set(60, 60);
    t.needsUpdate = true;
    return t;
  }, []);
  const stripes = useMemo(() => {
    const t = stripeTexture();
    t.repeat.set(1, 9);
    return t;
  }, []);
  const markers = useMemo(() => [10, 18, 22, 30, 45, 60].map((d) => ({ d, tex: labelTexture(`${d} m`) })), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#6f9a48" map={grass} roughness={1} />
      </mesh>
      {/* The mown range. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -30]} receiveShadow>
        <planeGeometry args={[16, 64]} />
        <meshStandardMaterial map={stripes} roughness={1} />
      </mesh>
      {/* Shooting line. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -0.6]}>
        <planeGeometry args={[14, 0.08]} />
        <meshBasicMaterial color="#f8f6ee" />
      </mesh>
      {/* Lane ropes. */}
      {[-8, 8].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, -30]}>
          <planeGeometry args={[0.06, 62]} />
          <meshBasicMaterial color="#f1ead6" />
        </mesh>
      ))}
      {/* Distance posts down both sides. */}
      {markers.map(({ d, tex }) =>
        [-8.6, 8.6].map((x) => (
          <group key={`${d}${x}`} position={[x, 0, -d]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.06, 1, 10]} />
              <meshStandardMaterial color="#6b4a2b" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.05, 0.03]} rotation={[0, x < 0 ? 0.35 : -0.35, 0]}>
              <planeGeometry args={[0.7, 0.35]} />
              <meshStandardMaterial map={tex} roughness={0.8} />
            </mesh>
          </group>
        )),
      )}
      {/* Earth berm behind the targets, crowned with round bales. */}
      <mesh position={[0, -1.6, -58]} scale={[30, 4.2, 5]} receiveShadow>
        <sphereGeometry args={[1, 40, 16]} />
        <meshStandardMaterial color="#5f8a3f" roughness={1} />
      </mesh>
      {/* Distant hills. */}
      {[
        [-70, -170, 60, 22],
        [30, -200, 80, 28],
        [110, -150, 50, 18],
        [-140, -110, 40, 14],
      ].map(([x, z, r, h]) => (
        <mesh key={`${x}${z}`} position={[x, -2, z]} scale={[r, h, r * 0.7]}>
          <sphereGeometry args={[1, 32, 12]} />
          <meshStandardMaterial color="#6f9466" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

const TREE_SPOTS: Array<[number, number, number, NatureModelId]> = [
  [-15, -6, 7, "tree-a"],
  [-17, -18, 9, "tree-b"],
  [-14, -31, 8, "tree-a"],
  [-19, -44, 10, "trees-a"],
  [-13, -57, 8, "tree-b"],
  [15, -8, 8, "tree-b"],
  [18, -21, 10, "trees-b"],
  [14, -35, 7, "tree-a"],
  [19, -49, 9, "tree-b"],
  [-6, -70, 11, "trees-a"],
  [8, -72, 10, "trees-b"],
  [24, -64, 9, "tree-a"],
  [-26, -66, 9, "tree-b"],
];

function Scenery() {
  const straw = useMemo(() => surfaceMaterial("wood", 1, 1, "#d8b765"), []);
  return (
    <group>
      {TREE_SPOTS.map(([x, z, h, id], i) => (
        <group key={i} position={[x, 0, z]}>
          <WithFallback fallback={null}>
            <NatureModel id={id} height={h} rotation={i * 1.7} />
          </WithFallback>
        </group>
      ))}
      <WithFallback fallback={null}>
        <PropModel id="weaponrack" height={1.5} position={[-3.4, 0, -1.6]} rotation={0.5} />
        <PropModel id="barrel" height={0.9} position={[3.2, 0, -1.2]} />
        <PropModel id="barrel" height={0.9} position={[3.9, 0, -1.7]} rotation={1} />
        <PropModel id="crate" height={0.7} position={[3.5, 0, -2.6]} rotation={0.3} />
        <PropModel id="tent" height={3.4} position={[-11, 0, -4]} rotation={0.9} />
      </WithFallback>
      {/* Round bales along the berm and scattered at the sides. */}
      {[-12, -8, -4, 4, 8, 12, -15, 15].map((x, i) => (
        <mesh key={x} position={[x, 0.62, i < 6 ? -54.5 : -12 - i]} rotation={[0, i * 0.4, Math.PI / 2]} castShadow receiveShadow material={straw}>
          <cylinderGeometry args={[0.62, 0.62, 1.2, 24]} />
        </mesh>
      ))}
      {/* Banners in the house colours on either side of the range. */}
      {[-10.5, 10.5].map((x, side) =>
        [-14, -28, -42].map((z, i) => <Banner key={`${x}${z}`} position={[x, 0, z]} colour={HOUSE_COLOURS[(i + side * 2) % 4]} />),
      )}
    </group>
  );
}

function Banner({ position, colour }: { position: [number, number, number]; colour: string }) {
  const cloth = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 2.2, 6, 10), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const hang = (1.1 - y) / 2.2;
      pos.setZ(i, Math.sin(t * 2.2 + y * 2.5 + x * 1.5 + position[2]) * 0.09 * hang);
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={position}>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 4, 8]} />
          <meshStandardMaterial color="#5a3d24" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 3.85, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.3, 8]} />
        <meshStandardMaterial color="#d6a419" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={cloth} geometry={geo} position={[0, 2.72, 0]} rotation={[0, position[0] < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} castShadow>
        <meshStandardMaterial color={colour} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Pennants on tall poles by the targets: they stream downwind and droop in a calm. */
function WindFlags({ engine }: { engine: MutableRefObject<ArcheryEngine | null> }) {
  const spots: Array<[number, number]> = [
    [-6.5, -20],
    [6.5, -20],
    [-6.5, -44],
    [6.5, -44],
    [0, -56],
  ];
  return (
    <group>
      {spots.map(([x, z]) => (
        <WindFlag key={`${x}${z}`} x={x} z={z} engine={engine} />
      ))}
    </group>
  );
}

function WindFlag({ x, z, engine }: { x: number; z: number; engine: MutableRefObject<ArcheryEngine | null> }) {
  const pivot = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.3, 0.6, 10, 3);
    g.translate(0.65, 0, 0);
    // Taper to a pennant point.
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - (p.getX(i) / 1.3) * 0.85));
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const angle = useRef(0);
  useFrame(({ clock }, dt) => {
    const w = engine.current?.wind ?? { x: 1.2, z: 0 };
    const s = Math.hypot(w.x, w.z);
    const want = Math.atan2(-w.z, w.x);
    let d = want - angle.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    angle.current += d * Math.min(1, dt * 2);
    if (pivot.current) {
      pivot.current.rotation.set(0, angle.current, 0);
      const droop = (1 - Math.min(1, s / 4.5)) * 1.15;
      pivot.current.children[0].rotation.set(0, 0, -droop);
    }
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const freq = 5 + s * 2;
    for (let i = 0; i < pos.count; i++) {
      const px = base[i * 3];
      pos.setZ(i, Math.sin(t * freq - px * 5 + x) * 0.07 * (px / 1.3) * (0.4 + s * 0.2));
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 6, 10]} />
        <meshStandardMaterial color="#e9e4d6" roughness={0.6} />
      </mesh>
      <mesh position={[0, 6.05, 0]}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color="#d6a419" metalness={0.6} roughness={0.35} />
      </mesh>
      <group ref={pivot} position={[0, 5.65, 0]}>
        <group>
          <mesh geometry={geo} castShadow>
            <meshStandardMaterial color="#d9442f" side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Seeds and pollen drifting on the wind across the range. */
function Seeds({ engine }: { engine: MutableRefObject<ArcheryEngine | null> }) {
  const COUNT = 140;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      p[i * 3] = (Math.random() - 0.5) * 26;
      p[i * 3 + 1] = 0.4 + Math.random() * 5;
      p[i * 3 + 2] = -3 - Math.random() * 52;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 1 / 20);
    const w = engine.current?.wind ?? { x: 1, z: 0 };
    const t = clock.elapsedTime;
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      let x = p.getX(i) + (w.x * 0.9 + Math.sin(t + i) * 0.15) * dt;
      const y = p.getY(i) + Math.sin(t * 1.3 + i * 0.7) * 0.12 * dt;
      let z = p.getZ(i) + (w.z * 0.9 + Math.cos(t * 0.7 + i) * 0.1) * dt;
      if (x > 13) x -= 26;
      if (x < -13) x += 26;
      if (z > -2) z -= 53;
      if (z < -55) z += 53;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <pointsMaterial color="#fffbe6" size={0.07} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

/** World Archery colours: gold, red, blue, black, white (two rings each). */
function faceTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const colours = ["#f4f1ea", "#f4f1ea", "#1b1c20", "#1b1c20", "#2f7fc9", "#2f7fc9", "#d8332b", "#d8332b", "#f6c832", "#f6c832"];
  const r = S / 2;
  for (let i = 0; i < 10; i++) {
    const rad = r * (1 - i / 10);
    ctx.beginPath();
    ctx.arc(r, r, rad, 0, Math.PI * 2);
    ctx.fillStyle = colours[i];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = i === 2 || i === 3 ? "rgba(255,255,255,0.55)" : "rgba(20,20,20,0.55)";
    ctx.stroke();
  }
  // The X ring.
  ctx.beginPath();
  ctx.arc(r, r, r * 0.05, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(20,20,20,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r - 6, r);
  ctx.lineTo(r + 6, r);
  ctx.moveTo(r, r - 6);
  ctx.lineTo(r, r + 6);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let faceTex: THREE.CanvasTexture | null = null;
let strawTex: THREE.CanvasTexture | null = null;

function strawTexture(): THREE.CanvasTexture {
  if (strawTex) return strawTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#c9a656";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 150 + Math.floor(Math.random() * 90);
    ctx.strokeStyle = `rgba(${v + 20},${v},${Math.floor(v * 0.45)},0.7)`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = (Math.random() - 0.5) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
    ctx.stroke();
  }
  strawTex = new THREE.CanvasTexture(c);
  strawTex.colorSpace = THREE.SRGBColorSpace;
  strawTex.wrapS = THREE.RepeatWrapping;
  strawTex.wrapT = THREE.RepeatWrapping;
  return strawTex;
}

function Target({ spec, engine }: { spec: TargetSpec; engine: MutableRefObject<ArcheryEngine | null> }) {
  const g = useRef<THREE.Group>(null);
  const half = ArcheryEngine.bossHalf(spec);
  const face = useMemo(() => (faceTex ??= faceTexture()), []);
  const straw = useMemo(() => strawTexture(), []);
  const letter = useMemo(() => (spec.label ? labelTexture(spec.label, { w: 128, h: 128, bg: "#1b2a4a", fg: "#f6deaa", font: "700 92px Georgia, serif" }) : null), [spec.label]);
  useEffect(() => () => letter?.dispose(), [letter]);
  useFrame(() => {
    const e = engine.current;
    if (!e || !g.current) return;
    const p = e.targetPos(spec);
    g.current.position.set(p.x, 0, p.z);
  });
  const legH = spec.y + half;
  return (
    <group>
      {spec.moveAmp > 0 ? (
        <mesh position={[spec.x, 0.08, spec.z + 0.35]} receiveShadow castShadow>
          <boxGeometry args={[spec.moveAmp * 2 + 2 * half + 0.6, 0.08, 0.12]} />
          <meshStandardMaterial color="#5a5f68" metalness={0.5} roughness={0.5} />
        </mesh>
      ) : null}
      <group ref={g} position={[spec.x, 0, spec.z]}>
        <group position={[0, spec.y, 0]}>
          <RoundedBox args={[half * 2, half * 2, 0.4]} radius={0.06} smoothness={3} position={[0, 0, -0.2]} castShadow receiveShadow>
            <meshStandardMaterial map={straw} color="#ead09a" roughness={1} />
          </RoundedBox>
          <mesh position={[0, 0, 0.006]}>
            <circleGeometry args={[spec.radius, 64]} />
            <meshStandardMaterial map={face} roughness={0.85} />
          </mesh>
          {letter ? (
            <mesh position={[0, half + 0.42, 0]}>
              <planeGeometry args={[0.62, 0.62]} />
              <meshStandardMaterial map={letter} roughness={0.7} />
            </mesh>
          ) : null}
        </group>
        {/* A-frame stand behind the boss. */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * half * 0.75, legH / 2, -0.55]} rotation={[0.32, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.04, legH + 0.2, 8]} />
            <meshStandardMaterial color="#6b4a2b" roughness={0.8} />
          </mesh>
        ))}
        {spec.moveAmp > 0 ? (
          <mesh position={[0, 0.2, 0.1]} castShadow>
            <boxGeometry args={[half * 2 + 0.2, 0.18, 0.5]} />
            <meshStandardMaterial color="#3a3f48" metalness={0.4} roughness={0.5} />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Arrows: the one in flight and those stuck in targets or the ground (instanced)
// ---------------------------------------------------------------------------

const ARROW_LEN = 0.82;
const MAX_ARROWS = 32;

function arrowGeometries() {
  const shaft = new THREE.CylinderGeometry(0.0045, 0.0045, ARROW_LEN, 6).rotateX(Math.PI / 2);
  const tip = new THREE.ConeGeometry(0.008, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0, ARROW_LEN / 2 + 0.02);
  const vane = new THREE.PlaneGeometry(0.11, 0.03).rotateY(Math.PI / 2).translate(0, 0.016, -ARROW_LEN / 2 + 0.08);
  const fletch = mergeGeometries([vane, vane.clone().rotateZ((Math.PI * 2) / 3), vane.clone().rotateZ((Math.PI * 4) / 3)])!;
  return { shaft, tip, fletch };
}

function Arrows({ engine }: { engine: MutableRefObject<ArcheryEngine | null> }) {
  const geos = useMemo(arrowGeometries, []);
  const shaft = useRef<THREE.InstancedMesh>(null);
  const tip = useRef<THREE.InstancedMesh>(null);
  const fletch = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), d: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), fwd: new THREE.Vector3(0, 0, 1) }), []);
  useFrame(() => {
    const e = engine.current;
    const meshes = [shaft.current, tip.current, fletch.current];
    if (meshes.some((m) => !m)) return;
    let n = 0;
    const put = (x: number, y: number, z: number, dx: number, dy: number, dz: number, depth: number) => {
      if (n >= MAX_ARROWS) return;
      tmp.d.set(dx, dy, dz).normalize();
      tmp.q.setFromUnitVectors(tmp.fwd, tmp.d);
      // Place the arrow so its tip is `depth` into whatever it hit.
      tmp.p.set(x, y, z).addScaledVector(tmp.d, depth - ARROW_LEN / 2 - 0.04);
      tmp.m.compose(tmp.p, tmp.q, tmp.one);
      for (const m of meshes) m!.setMatrixAt(n, tmp.m);
      n++;
    };
    if (e) {
      if (e.arrow) put(e.arrow.p.x, e.arrow.p.y, e.arrow.p.z, e.arrow.v.x, e.arrow.v.y, e.arrow.v.z, 0);
      for (const s of e.stuck) {
        if (s.targetId) {
          const spec = e.targets.find((t) => t.id === s.targetId);
          if (!spec) continue;
          const tp = e.targetPos(spec);
          put(tp.x + s.at.x, tp.y + s.at.y, tp.z, s.dir.x, s.dir.y, s.dir.z, 0.14);
        } else put(s.at.x, s.at.y, s.at.z, s.dir.x, s.dir.y, s.dir.z, 0.18);
      }
    }
    for (const m of meshes) {
      m!.count = n;
      m!.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh ref={shaft} args={[geos.shaft, undefined, MAX_ARROWS]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#d9c29a" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={tip} args={[geos.tip, undefined, MAX_ARROWS]} frustumCulled={false}>
        <meshStandardMaterial color="#9aa1ad" metalness={0.8} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={fletch} args={[geos.fletch, undefined, MAX_ARROWS]} frustumCulled={false}>
        <meshStandardMaterial color="#e2483a" side={THREE.DoubleSide} roughness={0.7} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The bow, held in first person
// ---------------------------------------------------------------------------

function limbCurve(sign: 1 | -1): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, sign * 0.08, 0),
    new THREE.Vector3(0, sign * 0.3, -0.05),
    new THREE.Vector3(0, sign * 0.52, -0.06),
    new THREE.Vector3(0, sign * 0.66, -0.02),
    new THREE.Vector3(0, sign * 0.7, 0.03),
  ]);
}

function Bow({ engine }: { engine: MutableRefObject<ArcheryEngine | null> }) {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const nocked = useRef<THREE.Group>(null);
  const geos = useMemo(arrowGeometries, []);
  const limbs = useMemo(() => [new THREE.TubeGeometry(limbCurve(1), 24, 0.013, 8), new THREE.TubeGeometry(limbCurve(-1), 24, 0.013, 8)], []);
  const stringGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    return g;
  }, []);
  const stringLine = useMemo(() => new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: "#f3efe6" })), [stringGeo]);
  useFrame(({ clock }) => {
    const e = engine.current;
    if (!root.current) return;
    const chase = !!e && e.arrowCam && (!!e.arrow || (e.phase === "result" && !!e.landedAt));
    root.current.visible = !!e && !chase && e.phase !== "done";
    if (!e) return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    const p = e.power;
    // The nock point comes back toward the face as the bow is drawn.
    const nockZ = 0.03 + p * 0.5;
    const pos = stringGeo.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, 0, 0.7, 0.03);
    pos.setXYZ(1, 0, 0, nockZ);
    pos.setXYZ(2, 0, -0.7, 0.03);
    pos.needsUpdate = true;
    if (nocked.current) {
      nocked.current.visible = e.phase === "aim" || e.phase === "intro";
      nocked.current.position.set(0.012, 0, nockZ - ARROW_LEN / 2);
    }
    // A breath of idle movement.
    const bob = Math.sin(clock.elapsedTime * 1.4) * 0.003 * (1 - p);
    root.current.children[0].position.set(-0.27 + p * 0.06, -0.25 + p * 0.05 + bob, -0.78);
  });
  return (
    <group ref={root}>
      <group rotation={[0, 0.1, 0.32]} scale={0.8}>
        {limbs.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color="#5b3720" roughness={0.45} metalness={0.1} />
          </mesh>
        ))}
        {/* Riser and grip. */}
        <mesh>
          <boxGeometry args={[0.03, 0.2, 0.045]} />
          <meshStandardMaterial color="#2b2d33" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.02, 0.012]}>
          <boxGeometry args={[0.034, 0.08, 0.04]} />
          <meshStandardMaterial color="#7b4a2a" roughness={0.9} />
        </mesh>
        <primitive object={stringLine} />
        <group ref={nocked} rotation={[0, Math.PI, 0]}>
          <mesh geometry={geos.shaft}>
            <meshStandardMaterial color="#d9c29a" roughness={0.6} />
          </mesh>
          <mesh geometry={geos.tip}>
            <meshStandardMaterial color="#9aa1ad" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh geometry={geos.fletch}>
            <meshStandardMaterial color="#e2483a" side={THREE.DoubleSide} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bullseye burst
// ---------------------------------------------------------------------------

function Burst({ engine }: { engine: MutableRefObject<ArcheryEngine | null> }) {
  const COUNT = 60;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);
  const mat = useRef<THREE.PointsMaterial>(null);
  const state = useRef({ id: 0, age: 9, vel: new Float32Array(COUNT * 3) });
  useFrame((_, raw) => {
    const dt = Math.min(raw, 1 / 20);
    const e = engine.current;
    const s = state.current;
    const p = geo.attributes.position as THREE.BufferAttribute;
    if (e?.burst && e.burst.id !== s.id) {
      s.id = e.burst.id;
      s.age = 0;
      for (let i = 0; i < COUNT; i++) {
        p.setXYZ(i, e.burst.at.x, e.burst.at.y, e.burst.at.z + 0.05);
        const a = Math.random() * Math.PI * 2;
        const sp = 1.2 + Math.random() * 2.4;
        s.vel[i * 3] = Math.cos(a) * sp;
        s.vel[i * 3 + 1] = Math.sin(a) * sp + 1;
        s.vel[i * 3 + 2] = Math.random() * 1.5;
      }
    }
    if (s.age > 1.2) {
      if (mat.current) mat.current.opacity = 0;
      return;
    }
    s.age += dt;
    for (let i = 0; i < COUNT; i++) {
      s.vel[i * 3 + 1] -= 4 * dt;
      p.setXYZ(i, p.getX(i) + s.vel[i * 3] * dt, p.getY(i) + s.vel[i * 3 + 1] * dt, p.getZ(i) + s.vel[i * 3 + 2] * dt);
    }
    p.needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.max(0, 1 - s.age / 1.2);
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial ref={mat} color="#ffd75e" size={0.09} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  );
}
