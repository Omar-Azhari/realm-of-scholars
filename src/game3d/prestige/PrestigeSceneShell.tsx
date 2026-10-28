/**
 * V2 Phase 1 "Prestige Vertical Slice" — the shared scene shell every
 * prestige-v2 district renders through, the direct sibling of
 * `CampusBuildingScene.tsx` for the OLD renderer (that file stays
 * completely unmodified — see docs/UNIGAME_V2_MASTER_DESIGN.md §16/§17).
 *
 * Reused verbatim from the existing renderer: `useWorldMovement`
 * (collision/keyboard/click-to-move — proven, and retuning its SPEED/
 * EASE_ZONE constants would also affect experimental-3d since they live in
 * a shared file), `ModularCharacter`/`NpcCharacter`/`createPoseBlender`
 * (character rig), `nearestInRange`, `floorPointToVector3`.
 *
 * Genuinely NEW here: `PrestigeCamera` (bigger distance, fog, bounded
 * orbit/zoom — see its own header), heavier position/yaw follow damping
 * plus a lean-into-turn tilt (the "weightier movement" feel the brief
 * asks for, delivered at the visual-smoothing layer rather than by
 * forking the shared movement hook's own physics), and a longer pose
 * cross-fade for the player (graceful transitions, per the Master
 * Design's animation philosophy).
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldMovement, nearestInRange } from "../../world/useWorldMovement";
import { floorPointToVector3, sceneUnitsToMetres } from "../types/coordinates";
import { ModularCharacter } from "../characters/ModularCharacter";
import { NpcCharacter } from "../characters/NpcCharacter";
import { createPoseBlender, type JointTransform, type PoseName } from "../characters/characterRig";
import { playActivitySoundOnChange } from "../characters/activitySound";
import { PrestigeCamera } from "./camera/PrestigeCamera";
import { useSaveData } from "../../state/SaveDataContext";
import { createDefaultAppearance } from "../../data/playerIdentityDefaults";
import { emitSound, stopSound, type SoundEvent } from "../../lib/sound";
import type { FloorPoint, InteractAction, SceneWorld, WorldInteractable } from "../../world/worldTypes";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";
import type { NpcSchedule } from "../characters/npcSchedule";

export interface PrestigeNpcDefinition {
  id: string;
  label: string;
  appearance: CharacterAppearance;
  personality?: PlayerPersonality;
  schedule: NpcSchedule;
  scheduleTimeOffsetSeconds?: number;
  interactableId?: string;
}

/** A district's warm/cool lighting rig — one authored mood per scene, per the Master Design's lighting guide (§7), not a shared generic preset. */
export interface PrestigeLighting {
  ambientColor: string;
  ambientIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition?: [number, number, number];
}

function applyJoint(group: THREE.Group | null, joint: JointTransform): void {
  if (!group) return;
  group.rotation.set(joint.rotX, joint.rotY, joint.rotZ);
}

function interactableMeshPoint(item: WorldInteractable): FloorPoint {
  const [rx, ry, rw, rh] = item.rect;
  return { x: rx + rw / 2, feetY: ry + rh / 2 };
}

// Heavier than CampusBuildingScene's POS_SMOOTH_SPEED=9/YAW_SMOOTH_SPEED=7 —
// a slower follow/turn reads as more weight, per the brief's "walking
// should feel weighty... proper turning... no snapping."
const POS_SMOOTH_SPEED = 6;
const YAW_SMOOTH_SPEED = 4.2;
/** A subtle bank into turns — how much the player visually tilts (radians) proportional to yaw rate, capped so it never looks like a vehicle. */
const MAX_TURN_LEAN = 0.05;
const TURN_LEAN_SMOOTH_SPEED = 5;
const GENERIC_HITBOX_HEIGHT_M = 1.8;
/** A slower, more graceful pose cross-fade than the default 0.35s — the Master Design's "no snapping" applied to animation blending too. */
const POSE_BLEND_SECONDS = 0.5;

export function PrestigeSceneShell({
  world,
  lighting,
  floorColor,
  npcs,
  dressing,
  ambienceSounds = [],
  reduceMotion,
  shadowMapSize = 1024,
  onAction,
  onInRangeChange,
  talkingNpcId = null,
}: {
  world: SceneWorld;
  lighting: PrestigeLighting;
  /** Districts are tall — the shell draws no automatic wall geometry (each scene authors its own walls/columns/vaults via ArchitectureKit, since "generic box walls" is exactly the prototype look this phase retires); the shell only sizes/colours the floor slab. */
  floorColor: string;
  npcs: PrestigeNpcDefinition[];
  dressing: ReactNode;
  ambienceSounds?: SoundEvent[];
  reduceMotion: boolean;
  shadowMapSize?: number;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
  talkingNpcId?: string | null;
}) {
  const { saveData } = useSaveData();
  const playerAppearance = saveData.playerIdentity?.appearance ?? createDefaultAppearance();

  const roomWidthM = sceneUnitsToMetres(world.width);
  const roomDepthM = sceneUnitsToMetres(world.height);

  const movement = useWorldMovement(world, { reduceMotion, enabled: true });

  const playerGroupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armLeftRef = useRef<THREE.Group>(null);
  const armRightRef = useRef<THREE.Group>(null);
  const legLeftRef = useRef<THREE.Group>(null);
  const legRightRef = useRef<THREE.Group>(null);
  const poseClockRef = useRef(0);
  const poseBlenderRef = useRef(createPoseBlender("idle", POSE_BLEND_SECONDS));
  const previousPlayerActivityRef = useRef<PoseName | null>(null);
  const liveMovementRef = useRef({ pos: movement.pos, facingLeft: movement.facingLeft, moving: movement.moving });
  liveMovementRef.current = { pos: movement.pos, facingLeft: movement.facingLeft, moving: movement.moving };

  useEffect(() => {
    for (const event of ambienceSounds) emitSound(event, { loop: true });
    return () => {
      for (const event of ambienceSounds) stopSound(event);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawnVec = floorPointToVector3(world.spawn);
  const renderedPos = useRef(new THREE.Vector3(spawnVec[0], spawnVec[1], spawnVec[2]));
  const renderedYaw = useRef(Math.PI * 0.25);
  const renderedLean = useRef(0);

  const inRange = useMemo(() => nearestInRange(movement.pos, world.interactables), [movement.pos, world.interactables]);
  useEffect(() => {
    onInRangeChange(inRange);
  }, [inRange, onInRangeChange]);

  const previousInRangeIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = inRange?.id ?? null;
    if (id && id !== previousInRangeIdRef.current) emitSound("hover");
    previousInRangeIdRef.current = id;
  }, [inRange]);

  const activate = (item: WorldInteractable) => {
    const near = nearestInRange(movement.pos, [item]);
    if (near) {
      onAction(item.action);
    } else {
      movement.moveTo(item.standPoint, { interactableId: item.id, onArrive: () => onAction(item.action) });
    }
  };

  const inRangeRef = useRef(inRange);
  inRangeRef.current = inRange;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "e" && e.key !== "E") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (inRangeRef.current) onAction(inRangeRef.current.action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAction]);

  useFrame((_, delta) => {
    const group = playerGroupRef.current;
    if (!group) return;
    const [x, y, z] = floorPointToVector3(liveMovementRef.current.pos);
    const targetYaw = liveMovementRef.current.facingLeft ? Math.PI * 0.75 : Math.PI * 0.25;

    if (reduceMotion) {
      group.position.set(x, y, z);
      group.rotation.set(0, targetYaw, 0);
    } else {
      const posT = 1 - Math.exp(-POS_SMOOTH_SPEED * delta);
      renderedPos.current.set(
        renderedPos.current.x + (x - renderedPos.current.x) * posT,
        y,
        renderedPos.current.z + (z - renderedPos.current.z) * posT
      );
      group.position.copy(renderedPos.current);

      const diff = Math.atan2(Math.sin(targetYaw - renderedYaw.current), Math.cos(targetYaw - renderedYaw.current));
      const yawT = 1 - Math.exp(-YAW_SMOOTH_SPEED * delta);
      renderedYaw.current += diff * yawT;

      // A subtle bank into the turn, proportional to how fast we're
      // turning right now — pure visual weight, never affects heading.
      const turnRate = diff * yawT;
      const targetLean = liveMovementRef.current.moving ? THREE.MathUtils.clamp(-turnRate * 3.2, -MAX_TURN_LEAN, MAX_TURN_LEAN) : 0;
      const leanT = 1 - Math.exp(-TURN_LEAN_SMOOTH_SPEED * delta);
      renderedLean.current += (targetLean - renderedLean.current) * leanT;

      group.rotation.set(0, renderedYaw.current, renderedLean.current);
    }

    poseClockRef.current += delta;
    const playerActivity: PoseName = liveMovementRef.current.moving ? "walk" : "idle";
    playActivitySoundOnChange(playerActivity, previousPlayerActivityRef.current);
    previousPlayerActivityRef.current = playerActivity;
    poseBlenderRef.current.setPose(playerActivity, poseClockRef.current);
    const pose = reduceMotion
      ? { head: { rotX: 0, rotY: 0, rotZ: 0 }, armLeft: { rotX: 0, rotY: 0, rotZ: 0 }, armRight: { rotX: 0, rotY: 0, rotZ: 0 }, legLeft: { rotX: 0, rotY: 0, rotZ: 0 }, legRight: { rotX: 0, rotY: 0, rotZ: 0 }, bodyBobY: 0 }
      : poseBlenderRef.current.update(poseClockRef.current);
    applyJoint(headRef.current, pose.head);
    applyJoint(armLeftRef.current, pose.armLeft);
    applyJoint(armRightRef.current, pose.armRight);
    applyJoint(legLeftRef.current, pose.legLeft);
    applyJoint(legRightRef.current, pose.legRight);
  });

  return (
    <>
      <PrestigeCamera targetRef={playerGroupRef as unknown as React.MutableRefObject<THREE.Object3D | null>} reduceMotion={reduceMotion} />

      <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity} />
      <hemisphereLight color={lighting.hemisphereSky} groundColor={lighting.hemisphereGround} intensity={lighting.hemisphereIntensity} />
      <directionalLight
        position={lighting.sunPosition ?? [10, 16, 6]}
        color={lighting.sunColor}
        intensity={lighting.sunIntensity}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0006}
        shadow-radius={4}
        shadow-camera-left={-roomWidthM}
        shadow-camera-right={roomWidthM}
        shadow-camera-top={roomDepthM}
        shadow-camera-bottom={-roomDepthM}
        shadow-camera-far={60}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomWidthM / 2, 0, roomDepthM / 2]} receiveShadow>
        <planeGeometry args={[roomWidthM, roomDepthM]} />
        <meshStandardMaterial color={floorColor} roughness={0.96} metalness={0} />
      </mesh>

      {dressing}

      {world.interactables.map((item) => {
        const [x, , z] = floorPointToVector3(interactableMeshPoint(item));
        const [, , w, h] = item.rect;
        const widthM = Math.max(0.5, sceneUnitsToMetres(w));
        const depthM = Math.max(0.5, sceneUnitsToMetres(h));
        return (
          <mesh key={item.id} position={[x, GENERIC_HITBOX_HEIGHT_M / 2, z]} onClick={() => activate(item)}>
            <boxGeometry args={[widthM, GENERIC_HITBOX_HEIGHT_M, depthM]} />
            <meshStandardMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}

      {npcs.map((npc) => (
        <NpcCharacter
          key={npc.id}
          appearance={npc.appearance}
          personality={npc.personality}
          schedule={npc.schedule}
          scheduleTimeOffsetSeconds={npc.scheduleTimeOffsetSeconds ?? 0}
          label={npc.label}
          waving={inRange?.id === (npc.interactableId ?? npc.id)}
          talking={npc.id === talkingNpcId}
        />
      ))}

      <group ref={playerGroupRef}>
        <ModularCharacter
          appearance={playerAppearance}
          label="Player"
          headPivotRef={headRef}
          armLeftPivotRef={armLeftRef}
          armRightPivotRef={armRightRef}
          legLeftPivotRef={legLeftRef}
          legRightPivotRef={legRightRef}
        />
      </group>
    </>
  );
}
