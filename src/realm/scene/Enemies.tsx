/**
 * Renders the combat runtime: skeleton enemies with health bars and
 * RuneScape-style damage splats, the crypt gate, and the driver that runs
 * the fight every frame.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ModelCharacter, WithFallback, type OneShot } from "./models";
import { runtime, setHover } from "./runtime";
import { combat, ENEMIES, spawnCamps, tickCombat, type Enemy } from "../combat/combat";
import { groundHeight, type World } from "../world/worldGen";

/** Runs combat every frame and spawns the camps for this world. */
export function CombatDriver({ world }: { world: World }) {
  useEffect(() => {
    spawnCamps(world);
  }, [world]);
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    // Being knocked out no longer sends you anywhere: you come round where you fell (see tickCombat).
    tickCombat(dt, world, runtime.player.x, runtime.player.z);
  });
  return null;
}

function EnemyNode({ world, enemy }: { world: World; enemy: Enemy }) {
  const type = ENEMIES[enemy.kind];
  const group = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const oneShot = useRef<OneShot | null>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const splats = useRef<HTMLDivElement>(null);
  const shownSplats = useRef<number[]>([]);
  const lastPos = useRef({ x: enemy.x, z: enemy.z });

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const dead = enemy.state === "dead";
    const sinceDeath = combat.time - enemy.deadAt;
    g.visible = !dead || sinceDeath < 1.6;
    g.position.set(enemy.x, groundHeight(world, enemy.x, enemy.z), enemy.z);
    g.rotation.y = enemy.facing;
    moving.current = !dead && Math.hypot(enemy.x - lastPos.current.x, enemy.z - lastPos.current.z) > 0.002;
    lastPos.current = { x: enemy.x, z: enemy.z };
    if (enemy.anim) {
      oneShot.current = enemy.anim === "attack" ? (type.model === "skeleton_mage" ? "Spellcast_Shoot" : "1H_Melee_Attack_Chop") : enemy.anim === "hit" ? "Hit_A" : "Death_A";
      enemy.anim = null;
    }
    // Health bar and name only near the player or once the fight starts.
    const near = Math.hypot(runtime.player.x - enemy.x, runtime.player.z - enemy.z) < 7;
    if (label.current) label.current.style.opacity = !dead && (near || enemy.state === "chase") ? "1" : "0";
    if (bar.current) bar.current.style.width = `${Math.max(0, (enemy.hp / type.hp) * 100)}%`;
    // Damage splats: add new ones as DOM nodes that float up and fade.
    const box = splats.current;
    if (box) {
      for (const s of enemy.splats) {
        if (shownSplats.current.includes(s.id)) continue;
        shownSplats.current = [...shownSplats.current.slice(-8), s.id];
        const el = document.createElement("span");
        el.className = "hitsplat-3d";
        el.textContent = String(s.amount);
        el.style.left = `${(Math.random() - 0.5) * 24}px`;
        box.appendChild(el);
        window.setTimeout(() => el.remove(), 900);
      }
    }
  });

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        if (enemy.state === "dead") return;
        // In reach: strike. Otherwise walk up to it.
        if (Math.hypot(runtime.player.x - enemy.x, runtime.player.z - enemy.z) < 1.9) runtime.attackNow?.();
        else runtime.walkTo?.(Math.floor(enemy.x), Math.floor(enemy.z));
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover({ verb: "Attack", target: `${type.name} (level ${type.level})`, extra: 0 });
        document.body.style.cursor = "crosshair";
      }}
      onPointerOut={() => {
        setHover(null);
        document.body.style.cursor = "";
      }}
    >
      <WithFallback
        fallback={
          <mesh position={[0, type.height / 2, 0]} castShadow>
            <capsuleGeometry args={[0.22, type.height * 0.5, 4, 8]} />
            <meshStandardMaterial color="#d8d2c4" />
          </mesh>
        }
      >
        <ModelCharacter
          avatar={type.model}
          movingRef={moving}
          oneShotRef={oneShot}
          height={type.height}
          idleClip={type.model === "skeleton_minion" ? "Idle" : "Idle_Combat"}
          moveClip={type.model === "skeleton_minion" ? "Walking_A" : "Walking_D_Skeletons"}
        />
      </WithFallback>
      <Html position={[0, type.height + 0.35, 0]} center zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
        <div className="enemy-tag" ref={label}>
          <span className="enemy-name">
            {type.name} <span className="lvl">(level {type.level})</span>
          </span>
          <span className="enemy-hp">
            <span ref={bar} />
          </span>
          <div className="enemy-splats" ref={splats} />
        </div>
      </Html>
    </group>
  );
}

/** All live enemies; re-reads the list when combat spawns or removes one. */
export function Enemies({ world }: { world: World }) {
  const [version, setVersion] = useState(combat.version);
  useFrame(() => {
    if (combat.version !== version) setVersion(combat.version);
  });
  const list = useMemo(() => combat.enemies.slice(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      {list.map((e) => (
        <EnemyNode key={e.id} world={world} enemy={e} />
      ))}
    </group>
  );
}

/** The crypt: a dark stone arch with a sealed door and two braziers of ghostly fire. */
export function CryptGate() {
  const flames = useRef<THREE.Group>(null);
  useFrame((state) => {
    flames.current?.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(state.clock.elapsedTime * 8 + i * 3) * 0.2;
    });
  });
  const stone = "#5a5560";
  return (
    <group>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.6, 0.16, 8]} />
        <meshStandardMaterial color="#4a4652" roughness={0.95} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 1.0, -0.2]} castShadow>
          <boxGeometry args={[0.4, 1.9, 0.5]} />
          <meshStandardMaterial color={stone} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.05, -0.2]} castShadow>
        <boxGeometry args={[2.0, 0.4, 0.6]} />
        <meshStandardMaterial color={stone} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.45, -0.2]} castShadow>
        <coneGeometry args={[0.9, 0.5, 4]} />
        <meshStandardMaterial color="#3a3640" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.95, -0.25]}>
        <boxGeometry args={[1.1, 1.75, 0.2]} />
        <meshStandardMaterial color="#141018" roughness={1} emissive="#3a1a5a" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 2.05, 0.12]}>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial color="#efe6d0" roughness={0.6} />
      </mesh>
      <group ref={flames}>
        {[-1.15, 1.15].map((x) => (
          <group key={x} position={[x, 0, 0.45]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.08, 0.9, 8]} />
              <meshStandardMaterial color="#2b2a2e" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.08, 0]} raycast={() => null}>
              <coneGeometry args={[0.13, 0.42, 7]} />
              <meshStandardMaterial color="#b46bff" emissive="#9a3cff" emissiveIntensity={3} toneMapped={false} transparent opacity={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
