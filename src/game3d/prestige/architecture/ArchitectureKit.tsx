/**
 * V2 Phase 1 "Prestige Vertical Slice" — a reusable procedural-geometry
 * kit shared by every prestige-v2 scene (Main Gate, Grand Courtyard,
 * Great Hall, Hall of Artisans, the Dormitory preview). Everything here
 * is composed from primitive Three.js geometry (no external 3D assets —
 * this environment has no asset pipeline, see
 * docs/UNIGAME_V2_MASTER_DESIGN.md §15) but at a deliberately higher
 * detail density and scale than the existing `furniturePieces.tsx`
 * catalogue: multi-part columns, arches, vaulted ceiling strips, stained
 * glass, fireplaces with a flickering light, banners, statues, a working
 * fountain, and a "Coming Soon" locked-district gate.
 *
 * Palette follows the Master Design's material guide (§6): weathered
 * stone greys/browns, dark oak, aged brass/iron, warm candlelight — never
 * flat primary colours, never chrome/neon (metalness is always kept at or
 * near 0, the same "Art Bible" rule every prior phase's furniture already
 * follows).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { ContactShadow } from "../../rooms/furniturePieces";

export const STONE = "#8d8578";
export const STONE_DARK = "#5f594e";
export const STONE_LIGHT = "#a89f8d";
export const OAK = "#5a3e28";
export const OAK_DARK = "#3c2818";
export const IRON = "#2b2a28";
export const BRASS = "#af8a4a";
export const GOLD_LEAF = "#d7b23a";
export const CANDLE_FLAME = "#ffb454";
export const FIRE_GLOW = "#ff7a2e";
export const PARCHMENT = "#e8ddc1";

/** A tall, fluted-look stone column — a hexagonal-prism shaft (cheap "fluting" via a low segment count) with a capital and base ring. Used for colonnades, hall naves, and gatehouse framing. */
export function StoneColumn({ x, z, heightM, radius = 0.42, color = STONE }: { x: number; z: number; heightM: number; radius?: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.28, radius * 1.35, 0.28, 8]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, heightM / 2 + 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.05, heightM, 12]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      <mesh position={[0, heightM + 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.4, radius * 1.1, 0.36, 12]} />
        <meshStandardMaterial color={STONE_LIGHT} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/**
 * A pointed (Gothic) archway — two ring-segment "voussoir" curves meeting
 * at an apex, framing a walkway. `widthM`/`heightM` describe the clear
 * opening; the arch itself sits above `heightM`.
 */
export function PointedArch({ x, z, widthM, heightM, depthM = 0.5, color = STONE, rotationY = 0 }: { x: number; z: number; widthM: number; heightM: number; depthM?: number; color?: string; rotationY?: number }) {
  const halfW = widthM / 2;
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <mesh position={[-halfW - 0.22, heightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, heightM, depthM]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      <mesh position={[halfW + 0.22, heightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, heightM, depthM]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      {/* Pointed apex — two angled slabs meeting like a peaked roofline over the opening. */}
      <mesh position={[-halfW / 2, heightM + halfW * 0.42, 0]} rotation={[0, 0, -0.62]} castShadow receiveShadow>
        <boxGeometry args={[widthM * 0.72, 0.4, depthM]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      <mesh position={[halfW / 2, heightM + halfW * 0.42, 0]} rotation={[0, 0, 0.62]} castShadow receiveShadow>
        <boxGeometry args={[widthM * 0.72, 0.4, depthM]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      <mesh position={[0, heightM + halfW * 0.78, 0]} castShadow>
        <boxGeometry args={[0.34, 0.34, depthM]} />
        <meshStandardMaterial color={GOLD_LEAF} roughness={0.6} metalness={0} />
      </mesh>
    </group>
  );
}

/**
 * One vaulted-ceiling "bay" — four angled panels rising to a central
 * ridge, repeated along a hall's length to build a full ribbed vault
 * cheaply (each bay is one component instance, not hand-authored geometry).
 */
export function VaultedCeilingBay({ x, z, widthM, apexHeightM, spanM = 3.2, color = STONE_LIGHT }: { x: number; z: number; widthM: number; apexHeightM: number; spanM?: number; color?: string }) {
  const rise = apexHeightM;
  const halfW = widthM / 2;
  const slopeLen = Math.sqrt(halfW * halfW + 1.2 * 1.2);
  const angle = Math.atan2(1.2, halfW);
  return (
    <group position={[x, rise - 1.2, z]}>
      <mesh position={[-halfW / 2, 0.6, 0]} rotation={[0, 0, angle]} receiveShadow>
        <boxGeometry args={[slopeLen, 0.12, spanM]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[halfW / 2, 0.6, 0]} rotation={[0, 0, -angle]} receiveShadow>
        <boxGeometry args={[slopeLen, 0.12, spanM]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Rib along the ridge — the "vaulted" read comes from this dark seam catching shadow. */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.16, 0.16, spanM]} />
        <meshStandardMaterial color={OAK_DARK} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/**
 * A stained-glass window — a coloured, emissive-lit pane behind a stone
 * mullion grid, meant to be set INTO a wall opening. Reads as glowing
 * jewel-toned light rather than a flat coloured square.
 */
export function StainedGlassWindow({ x, y, z, widthM, heightM, colors = ["#3a5fae", "#8a2f4a", "#c9973a", "#3a7a5f"], rotationY = 0 }: { x: number; y: number; z: number; widthM: number; heightM: number; colors?: string[]; rotationY?: number }) {
  const cols = 2;
  const rows = 3;
  const cellW = widthM / cols;
  const cellH = heightM / rows;
  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      {/* Pointed-arch stone surround. */}
      <mesh position={[0, heightM / 2, -0.03]}>
        <boxGeometry args={[widthM + 0.3, heightM + 0.3, 0.1]} />
        <meshStandardMaterial color={STONE} roughness={0.9} metalness={0} />
      </mesh>
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <mesh key={`${r}-${c}`} position={[-widthM / 2 + cellW * (c + 0.5), cellH * (r + 0.5), 0.02]}>
            <planeGeometry args={[cellW * 0.86, cellH * 0.86]} />
            <meshStandardMaterial color={colors[(r + c) % colors.length]} emissive={colors[(r + c) % colors.length]} emissiveIntensity={0.55} roughness={0.4} metalness={0} transparent opacity={0.92} />
          </mesh>
        ))
      )}
      {/* Mullion grid — thin dark bars over the glass cells. */}
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <mesh key={`v${i}`} position={[-widthM / 2 + cellW * (i + 1), heightM / 2, 0.03]}>
          <boxGeometry args={[0.04, heightM, 0.04]} />
          <meshStandardMaterial color={IRON} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <mesh key={`h${i}`} position={[0, cellH * (i + 1), 0.03]}>
          <boxGeometry args={[widthM, 0.04, 0.04]} />
          <meshStandardMaterial color={IRON} roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/** A working stone fireplace with a gently flickering warm light — the game's single warmest, most inviting light source, per the Master Design's lighting guide (§7). */
export function Fireplace({ x, z, rotationY = 0, scale = 1 }: { x: number; z: number; rotationY?: number; scale?: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const seed = useMemo(() => (x * 2.7 + z * 1.3) % (Math.PI * 2), [x, z]);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.elapsedTime + seed;
    const flicker = Math.sin(t * 9.1) * 0.09 + Math.sin(t * 3.3) * 0.12 + Math.sin(t * 17) * 0.03;
    lightRef.current.intensity = 1.35 + flicker;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]} scale={scale}>
      <ContactShadow x={0} z={0.4} radius={1.1} />
      {/* Stone surround. */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.2, 0.5]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.85, 0.26]}>
        <boxGeometry args={[1.5, 1.3, 0.02]} />
        <meshStandardMaterial color="#120c08" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[2.6, 0.3, 0.7]} />
        <meshStandardMaterial color={STONE_LIGHT} roughness={0.9} metalness={0} />
      </mesh>
      {/* Log stack + glow plane standing in for flame. */}
      {[-0.2, 0, 0.22].map((ox, i) => (
        <mesh key={i} position={[ox, 0.28 + (i % 2) * 0.1, 0.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.7, 8]} />
          <meshStandardMaterial color={OAK_DARK} roughness={1} metalness={0} />
        </mesh>
      ))}
      <mesh position={[0, 0.5, 0.32]}>
        <planeGeometry args={[0.9, 0.7]} />
        <meshStandardMaterial color={FIRE_GLOW} emissive={FIRE_GLOW} emissiveIntensity={1.4} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.7, 0.5]} color="#ff9d52" intensity={1.35} distance={5.5} decay={2} />
    </group>
  );
}

/** A cloth banner hanging from a wall — a subject-guild colour + a subtle idle sway, exactly the "banners" material the Master Design's guide calls for. */
export function Banner({ x, y, z, color, heightM = 2.4, widthM = 0.9, rotationY = 0 }: { x: number; y: number; z: number; color: string; heightM?: number; widthM?: number; rotationY?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => (x * 4.1 + z * 2.3) % (Math.PI * 2), [x, z]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.7 + seed) * 0.02;
  });
  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, widthM + 0.2, 8]} />
        <meshStandardMaterial color={BRASS} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh ref={ref} position={[0, -heightM / 2, 0.02]} castShadow>
        <planeGeometry args={[widthM, heightM]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** A robed, abstract statue figure on a plinth — built from stacked primitives (no sculpted mesh available in this environment), deliberately simplified rather than attempting a realistic human form. */
export function StatueFigure({ x, z, heightM = 2.6, color = STONE_LIGHT }: { x: number; z: number; heightM?: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <ContactShadow x={0} z={0} radius={0.85} />
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.7, 0.6, 8]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.6 + (heightM - 0.6) * 0.42, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.55, heightM - 0.6, 10]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, heightM - 0.05, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, heightM - 0.55, 0]} rotation={[0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.85, 0.14, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
    </group>
  );
}

/** A stone basin fountain with a gently rippling water plane and a slim central spout — the Grand Courtyard's centrepiece water feature. */
export function Fountain({ x, z, radius = 2.2 }: { x: number; z: number; radius?: number }) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!waterRef.current) return;
    const mat = waterRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.18 + Math.sin(clock.elapsedTime * 1.4) * 0.05;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.05, 0.64, 24]} />
        <meshStandardMaterial color={STONE} roughness={0.92} metalness={0} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius - 0.18, 24]} />
        <meshStandardMaterial color="#2f6f8c" emissive="#2f6f8c" emissiveIntensity={0.18} roughness={0.15} metalness={0} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.6, 10]} />
        <meshStandardMaterial color={STONE_LIGHT} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <sphereGeometry args={[0.24, 12, 10]} />
        <meshStandardMaterial color={STONE_LIGHT} roughness={0.85} metalness={0} />
      </mesh>
    </group>
  );
}

/** An iron wall-sconce torch — a small, warm, always-flickering point light for corridors and colonnades where a full fireplace doesn't fit. */
export function TorchSconce({ x, y, z, rotationY = 0 }: { x: number; y: number; z: number; rotationY?: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const seed = useMemo(() => (x * 5.3 + z * 3.1) % (Math.PI * 2), [x, z]);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.elapsedTime + seed;
    lightRef.current.intensity = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 4) * 0.06;
  });
  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={IRON} roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.2, 0.08]} castShadow>
        <coneGeometry args={[0.12, 0.32, 8]} />
        <meshStandardMaterial color={CANDLE_FLAME} emissive={CANDLE_FLAME} emissiveIntensity={1.6} roughness={0.5} metalness={0} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.22, 0.08]} color="#ffb15c" intensity={0.85} distance={3.2} decay={2} />
    </group>
  );
}

/** A cluster of candles on a stand — a smaller, tabletop-scale warm light for desks/shrines/dormitory dressing. */
export function CandleCluster({ x, y, z, count = 3 }: { x: number; y: number; z: number; count?: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    lightRef.current.intensity = 0.55 + Math.sin(clock.elapsedTime * 8 + x) * 0.06;
  });
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.03, 10]} />
        <meshStandardMaterial color={BRASS} roughness={0.5} metalness={0.3} />
      </mesh>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const r = 0.07;
        return (
          <group key={i} position={[Math.cos(angle) * r, 0.02, Math.sin(angle) * r]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.018, 0.02, 0.14, 8]} />
              <meshStandardMaterial color={PARCHMENT} roughness={0.9} metalness={0} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <coneGeometry args={[0.02, 0.05, 6]} />
              <meshStandardMaterial color={CANDLE_FLAME} emissive={CANDLE_FLAME} emissiveIntensity={1.8} roughness={0.5} metalness={0} />
            </mesh>
          </group>
        );
      })}
      <pointLight ref={lightRef} position={[0, 0.14, 0]} color="#ffcf8a" intensity={0.55} distance={2.4} decay={2} />
    </group>
  );
}

/** A long refectory table with two benches — the Great Hall's centrepiece furniture, at true banquet-hall scale. */
export function LongTable({ x, z, lengthM = 5.5, rotationY = 0 }: { x: number; z: number; lengthM?: number; rotationY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[lengthM, 0.1, 1.1]} radius={0.02} position={[0, 0.86, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
      </RoundedBox>
      {[-lengthM / 2 + 0.3, lengthM / 2 - 0.3].flatMap((lx) =>
        [-0.45, 0.45].map((lz) => (
          <mesh key={`${lx}-${lz}`} position={[lx, 0.43, lz]} castShadow>
            <boxGeometry args={[0.12, 0.86, 0.12]} />
            <meshStandardMaterial color={OAK_DARK} roughness={0.9} metalness={0} />
          </mesh>
        ))
      )}
      {[-0.75, 0.75].map((bz) => (
        <group key={bz} position={[0, 0, bz]}>
          <RoundedBox args={[lengthM - 0.6, 0.08, 0.36]} radius={0.02} position={[0, 0.46, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={OAK} roughness={0.9} metalness={0} />
          </RoundedBox>
          {[-lengthM / 2 + 0.7, lengthM / 2 - 0.7].map((lx) => (
            <mesh key={lx} position={[lx, 0.23, 0]} castShadow>
              <boxGeometry args={[0.1, 0.46, 0.3]} />
              <meshStandardMaterial color={OAK_DARK} roughness={0.9} metalness={0} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Candle clusters spaced along the table. */}
      <CandleCluster x={-lengthM / 3} y={0.92} z={0} />
      <CandleCluster x={0} y={0.92} z={0} />
      <CandleCluster x={lengthM / 3} y={0.92} z={0} />
    </group>
  );
}

/**
 * A grand, locked double-door gate for a not-yet-built district — the
 * "elegant gate with Coming Soon messaging" the brief asks for, rather
 * than a placeholder area. Fires `onClick` (the caller wires this to a
 * `{ type: "locked-notice", districtName }` action — this component itself
 * renders no text, since no in-engine font system exists yet; the real
 * district name surfaces through the interaction prompt / notice panel
 * the caller builds around it, not through a mesh here). */
export function ComingSoonGate({ x, z, rotationY = 0, onClick }: { x: number; z: number; rotationY?: number; onClick: () => void }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <StoneColumn x={-1.3} z={0} heightM={4.2} radius={0.32} />
      <StoneColumn x={1.3} z={0} heightM={4.2} radius={0.32} />
      <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.1, 0.4, 0.5]} />
        <meshStandardMaterial color={STONE_LIGHT} roughness={0.9} metalness={0} />
      </mesh>
      {/* The locked gate itself — an iron portcullis-like grille, chained shut. */}
      <mesh position={[0, 2.1, 0]} onClick={onClick} castShadow>
        <boxGeometry args={[2.3, 3.4, 0.12]} />
        <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.35} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-1 + i * 0.5, 2.1, 0.08]} castShadow>
          <boxGeometry args={[0.05, 3.2, 0.05]} />
          <meshStandardMaterial color={IRON} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, 0.1]} rotation={[0, 0, Math.PI / 5]}>
        <torusGeometry args={[0.55, 0.035, 6, 16]} />
        <meshStandardMaterial color={BRASS} roughness={0.4} metalness={0.5} />
      </mesh>
      {/* A small hanging plaque — the only "Text"-free way this codebase conveys a label is via HUD/interaction-prompt copy (no in-engine font system exists yet, see the codebase map), so the plaque itself is a plain parchment-toned plane; `districtName` surfaces through the interaction prompt / notice panel instead. */}
      <mesh position={[0, 3.15, 0.09]} castShadow>
        <planeGeometry args={[1.3, 0.55]} />
        <meshStandardMaterial color={PARCHMENT} roughness={0.85} metalness={0} />
      </mesh>
      <TorchSconce x={-1.3} y={2.6} z={0.3} />
      <TorchSconce x={1.3} y={2.6} z={0.3} />
    </group>
  );
}

/**
 * A tall, iron-bound oak double door — the real, walkable gate between two
 * prestige-v2 districts (as opposed to `ComingSoonGate`, which never
 * opens). `onClick` is deliberately OPTIONAL and omitted by every real
 * scene: the actual interaction hitbox for this same door already exists
 * as a separate, correctly range-gated mesh (`PrestigeSceneShell`'s own
 * generic interactable rendering, from the matching `WorldInteractable`).
 * Giving this purely-decorative door mesh its own competing onClick would
 * let a raycast hit either mesh non-deterministically and could bypass
 * the shell's "walk into range, then interact" gating — E-to-interact
 * (which needs no mesh at all) remains the reliable way to use it either way.
 */
export function GrandDoor({ x, z, widthM = 2.2, heightM = 3.2, rotationY = 0, onClick }: { x: number; z: number; widthM?: number; heightM?: number; rotationY?: number; onClick?: () => void }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * widthM) / 4, heightM / 2, 0]} onClick={onClick} castShadow receiveShadow>
          <boxGeometry args={[widthM / 2 - 0.04, heightM, 0.14]} />
          <meshStandardMaterial color={OAK_DARK} roughness={0.85} metalness={0} />
        </mesh>
      ))}
      {[-1, 1].map((side) =>
        [0.3, 0.7].map((f) => (
          <mesh key={`${side}-${f}`} position={[(side * widthM) / 4, heightM * f, 0.08]} castShadow>
            <boxGeometry args={[widthM / 2 - 0.24, 0.06, 0.04]} />
            <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.3} />
          </mesh>
        ))
      )}
    </group>
  );
}

/** A single free-standing sketch/drafting easel with a blank canvas — Hall of Artisans dressing. */
export function Easel({ x, z, rotationY = 0, canvasColor = "#f2e9d8" }: { x: number; z: number; rotationY?: number; canvasColor?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <ContactShadow x={0} z={0.15} radius={0.55} />
      {[-0.4, 0.4].map((lx) => (
        <mesh key={lx} position={[lx, 0.7, 0]} rotation={[0, 0, lx > 0 ? -0.12 : 0.12]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 1.4, 6]} />
          <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
        </mesh>
      ))}
      <mesh position={[0, 0.5, 0.28]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.1, 6]} />
        <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, 0.9, -0.02]} rotation={[-0.06, 0, 0]} castShadow>
        <boxGeometry args={[0.72, 0.92, 0.04]} />
        <meshStandardMaterial color={OAK_DARK} roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[-0.06, 0, 0]}>
        <planeGeometry args={[0.62, 0.82]} />
        <meshStandardMaterial color={canvasColor} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

/** A drafting/sketch table with paper and pencils — an artisan's workspace surface, a taller and busier cousin of a plain desk. */
export function DraftingTable({ x, z, rotationY = 0, trimColor = BRASS }: { x: number; z: number; rotationY?: number; trimColor?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <ContactShadow x={0} z={0} radius={0.9} />
      <RoundedBox args={[1.5, 0.08, 0.9]} radius={0.02} position={[0, 0.82, 0]} rotation={[-0.18, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.85} metalness={0} />
      </RoundedBox>
      {[
        [-0.65, -0.4],
        [0.65, -0.4],
        [-0.65, 0.4],
        [0.65, 0.4],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.4, lz]} castShadow>
          <boxGeometry args={[0.08, 0.8, 0.08]} />
          <meshStandardMaterial color={OAK_DARK} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      <mesh position={[-0.2, 0.9, -0.15]} rotation={[-0.18, 0.1, 0]}>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color={PARCHMENT} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0.35, 0.92, 0.1]} rotation={[-0.18, -0.2, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
        <meshStandardMaterial color={trimColor} roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}
