/**
 * Generic building scene shell (Phase 20E, Part 1/2/11). Every campus
 * building OTHER than Campus HQ (Library, Computer Lab, Lecture Theatre,
 * Student Lounge, Administration, and the 4 subject-building placeholders)
 * renders through this ONE component — "no duplicated layouts... no
 * gameplay duplication," per the brief. Campus HQ itself keeps its own
 * bespoke `TestRoomScene.tsx` unmodified (it owns the one thing this
 * shell deliberately does NOT: the room-customisation system — Part 5 of
 * this phase's own brief says do not modify that architecture, and the
 * simplest way to honour that is to not extend it to buildings that never
 * had it).
 *
 * Reuses, verbatim: `useWorldMovement` (movement/collision), `BirdsEyeCamera`
 * (camera philosophy untouched), `ModularCharacter`/`NpcCharacter`
 * (character rig), `createPoseBlender` (player pose). The only genuinely
 * new logic here is generic (rect-derived) interactable hit-boxes instead
 * of Campus HQ's hand-placed, bespoke ones — appropriate for buildings
 * whose furniture is fixed dressing, not a player-editable system.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldMovement, nearestInRange } from "../../world/useWorldMovement";
import { floorPointToVector3, sceneUnitsToMetres } from "../types/coordinates";
import { ModularCharacter } from "../characters/ModularCharacter";
import { NpcCharacter } from "../characters/NpcCharacter";
import { createPoseBlender, type JointTransform, type PoseName } from "../characters/characterRig";
import { playActivitySoundOnChange } from "../characters/activitySound";
import { BirdsEyeCamera } from "../camera/BirdsEyeCamera";
import { targetLightIntensity, lerpIntensity } from "./proximityLight";
import { useSaveData } from "../../state/SaveDataContext";
import { createDefaultAppearance } from "../../data/playerIdentityDefaults";
import { emitSound, stopSound, type SoundEvent } from "../../lib/sound";
import { getTimeOfDayAtmosphere, isNpcActiveAtTime, type TimeOfDay } from "../campus/timeOfDay";
import { getCampusAtmosphere } from "../campus/campusAtmosphere";
import type { FloorPoint, InteractAction, SceneWorld, WorldInteractable } from "../../world/worldTypes";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";
import type { NpcSchedule } from "../characters/npcSchedule";
import type { RoomLighting } from "../rooms/roomThemes";

export interface BuildingPalette {
  wallColor: string;
  floorColor: string;
  trimColor: string;
  lighting: RoomLighting;
}

export interface BuildingNpcDefinition {
  id: string;
  label: string;
  appearance: CharacterAppearance;
  personality?: PlayerPersonality;
  schedule: NpcSchedule;
  scheduleTimeOffsetSeconds?: number;
  /** Phase 20E Part 7/8 — restricts when this NPC appears (e.g. a visitor-type student only shows up during the day). Omitted = always present, matching staff/mentor NPCs who are always "on duty." */
  activeTimes?: TimeOfDay[];
  /** Phase 21 Part 4 "react to the player's presence" — the `WorldInteractable.id` this NPC waves for once the player is in range of it. Defaults to this NPC's own `id` (true for every NPC whose interactable id already matches, e.g. "lounge-staff"); only needs setting explicitly when the two diverge (e.g. the Library's "librarian" NPC talks through the "librarian-desk" interactable). */
  interactableId?: string;
}

function applyJoint(group: THREE.Group | null, joint: JointTransform): void {
  if (!group) return;
  group.rotation.set(joint.rotX, joint.rotY, joint.rotZ);
}

/** Rect-centre floor point for a `WorldInteractable` — same derivation TestRoomScene.tsx uses, so a mesh position can never silently drift from its fixture. */
function interactableMeshPoint(item: WorldInteractable): FloorPoint {
  const [rx, ry, rw, rh] = item.rect;
  return { x: rx + rw / 2, feetY: ry + rh / 2 };
}

const POS_SMOOTH_SPEED = 9;
const YAW_SMOOTH_SPEED = 7;
/** A generic hit-box height for interactables in this shell — tall enough to comfortably cover a standing prop/desk/signpost without needing a bespoke size per building. */
const GENERIC_HITBOX_HEIGHT_M = 1.6;
/** Phase 20F Part 7 "arrival marker" — how long the spawn-point pulse ring is visible after travelling in, seconds. */
const ARRIVAL_MARKER_DURATION_S = 1.1;
/** Phase 20F Part 8 — proximity-light response for this shell's generic interactables (the audit's P1 "no proximity-lighting... on any generic interactable" finding). Same tuning as TestRoomScene.tsx's per-item lights, but ONE light that moves to whichever interactable is currently in range instead of one fixture per item — appropriate for a shell whose interactable set varies per building. */
const PROXIMITY_LIGHT_BASE = 0.15;
const PROXIMITY_LIGHT_BOOST = 0.55;
const PROXIMITY_LIGHT_SPEED = 4;
/** How much a door's frame group scales up while in range — deliberately tiny ("subtle... no aggressive outlines/arcade effects", Part 8). */
const DOOR_SCALE_BOOST = 1.05;
const DOOR_SCALE_SPEED = 10;

export function CampusBuildingScene({
  world,
  palette,
  npcs,
  dressing,
  wallHeightM = 2.3,
  ambienceSounds = [],
  timeOfDay,
  reduceMotion,
  shadowMapSize = 1024,
  onAction,
  onInRangeChange,
  talkingNpcId = null,
}: {
  world: SceneWorld;
  palette: BuildingPalette;
  npcs: BuildingNpcDefinition[];
  /** Building-specific furniture/props — a plain, self-contained group of meshes; this shell owns only the shared shell (floor/walls/lighting/camera/movement/interaction), never furniture. */
  dressing: ReactNode;
  wallHeightM?: number;
  /** Looped on mount, stopped implicitly on unmount (a scene swap unmounts this component entirely). */
  ambienceSounds?: SoundEvent[];
  /** Phase 20E Part 7 — atmosphere only: dims/brightens the lighting rig and filters time-restricted NPCs. Never affects gameplay. */
  timeOfDay: TimeOfDay;
  reduceMotion: boolean;
  /** Phase 20F Part 15 quality tiers — the directional light's shadow-map resolution (512/1024/2048 per tier). Shadow rendering itself is toggled at the `<Canvas shadows={...}>` level in Game3D.tsx, not here. */
  shadowMapSize?: number;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
  /** Phase 23 "Visual Improvements" — the `BuildingNpcDefinition.id` a `MentorConversationPanel` is currently open with, if any. Only ever matches one NPC (or none) per building. */
  talkingNpcId?: string | null;
}) {
  const { saveData } = useSaveData();
  const playerAppearance = saveData.playerIdentity?.appearance ?? createDefaultAppearance();

  const roomWidthM = sceneUnitsToMetres(world.width);
  const roomDepthM = sceneUnitsToMetres(world.height);
  const atmosphere = getTimeOfDayAtmosphere(timeOfDay);
  const visibleNpcs = useMemo(() => npcs.filter((npc) => isNpcActiveAtTime(npc.activeTimes, timeOfDay)), [npcs, timeOfDay]);

  const movement = useWorldMovement(world, { reduceMotion, enabled: true });

  const playerGroupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armLeftRef = useRef<THREE.Group>(null);
  const armRightRef = useRef<THREE.Group>(null);
  const legLeftRef = useRef<THREE.Group>(null);
  const legRightRef = useRef<THREE.Group>(null);
  const poseClockRef = useRef(0);
  const poseBlenderRef = useRef(createPoseBlender("idle"));
  const previousPlayerActivityRef = useRef<PoseName | null>(null);
  const liveMovementRef = useRef({ pos: movement.pos, facingLeft: movement.facingLeft, moving: movement.moving });
  liveMovementRef.current = { pos: movement.pos, facingLeft: movement.facingLeft, moving: movement.moving };

  useEffect(() => {
    // Phase 21 Part 9 "Campus Atmosphere" — exam-week/break/season, layered
    // under this building's own ambience and the time-of-day layer above;
    // never a replacement for either.
    const campusAtmosphere = getCampusAtmosphere(saveData);
    const events = [...ambienceSounds, ...atmosphere.ambienceSounds, ...campusAtmosphere.ambienceSounds];
    for (const event of events) emitSound(event, { loop: true });
    // Phase 20F Part 7 — a scene swap unmounts this component entirely, so
    // this is the one place that can reliably stop THIS building's own
    // loops before the next building starts its own (previously missing —
    // ambience just kept playing forever once started, the audit's
    // "audio continuing after leaving a building" / "overlapping ambience"
    // defect).
    return () => {
      for (const event of events) stopSound(event);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawnVec = floorPointToVector3(world.spawn);
  const renderedPos = useRef(new THREE.Vector3(spawnVec[0], spawnVec[1], spawnVec[2]));
  const renderedYaw = useRef(Math.PI * 0.25);

  // Phase 20F Part 7 "arrival marker" — a brief pulse ring at the spawn
  // point confirming "you've arrived" (the audit's cross-cutting finding
  // that a returning player has no visual cue where they've landed).
  // Skipped entirely under reduced motion, matching Settings' existing
  // "disables... entrance animation app-wide" contract rather than
  // introducing a second reduced-motion behaviour for one effect.
  const arrivalClockRef = useRef(0);
  const arrivalRingRef = useRef<THREE.Mesh>(null);
  const [arrivalMarkerDone, setArrivalMarkerDone] = useState(reduceMotion);

  // Phase 20F Part 8 — proximity light (follows the in-range interactable)
  // and per-door scale response (a Map since the door count varies per
  // building — populated by each door's own ref callback below).
  const proximityLightRef = useRef<THREE.PointLight>(null);
  const proximityLightTarget = useRef(new THREE.Vector3(spawnVec[0], 1.1, spawnVec[2]));
  const doorGroupRefs = useRef(new Map<string, THREE.Group>());

  const inRange = useMemo(() => nearestInRange(movement.pos, world.interactables), [movement.pos, world.interactables]);
  useEffect(() => {
    onInRangeChange(inRange);
  }, [inRange, onInRangeChange]);

  // Phase 20F Part 8 — same "hover" cue as TestRoomScene.tsx, fired once
  // per NEW interactable entering range (not every frame).
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
      group.rotation.y = targetYaw;
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
      group.rotation.y = renderedYaw.current;
    }

    if (!arrivalMarkerDone) {
      arrivalClockRef.current += delta;
      const t = Math.min(1, arrivalClockRef.current / ARRIVAL_MARKER_DURATION_S);
      const ring = arrivalRingRef.current;
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 * (1 - t);
        const s = 1 + t * 1.6;
        ring.scale.set(s, s, s);
      }
      if (t >= 1) setArrivalMarkerDone(true);
    }

    // Proximity light (Part 8) — eases toward whichever interactable is
    // currently in range; parked at its last target position (and eased
    // back down to base intensity) when nothing's in range, rather than
    // needing a dedicated "idle" position.
    if (inRange) {
      const [ix, , iz] = floorPointToVector3(interactableMeshPoint(inRange));
      proximityLightTarget.current.set(ix, 1.1, iz);
    }
    if (proximityLightRef.current) {
      const light = proximityLightRef.current;
      const posT = reduceMotion ? 1 : 1 - Math.exp(-10 * delta);
      light.position.lerp(proximityLightTarget.current, posT);
      light.intensity = reduceMotion
        ? targetLightIntensity(!!inRange, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST)
        : lerpIntensity(light.intensity, targetLightIntensity(!!inRange, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST), PROXIMITY_LIGHT_SPEED, delta);
    }

    // Door scale response (Part 8) — a tiny, subtle grow while in range.
    doorGroupRefs.current.forEach((group, id) => {
      const target = inRange?.id === id ? DOOR_SCALE_BOOST : 1;
      const s = reduceMotion ? target : group.scale.x + (target - group.scale.x) * (1 - Math.exp(-DOOR_SCALE_SPEED * delta));
      group.scale.set(s, s, s);
    });

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
      <BirdsEyeCamera
        targetRef={playerGroupRef as unknown as React.MutableRefObject<THREE.Object3D | null>}
        reduceMotion={reduceMotion}
        zoomBoost={inRange ? 1 : 0}
      />

      <ambientLight color={atmosphere.ambientColorOverride ?? palette.lighting.ambientColor} intensity={palette.lighting.ambientIntensity * atmosphere.intensityMultiplier} />
      <hemisphereLight color={palette.lighting.hemisphereSky} groundColor={palette.lighting.hemisphereGround} intensity={palette.lighting.hemisphereIntensity * atmosphere.intensityMultiplier} />
      <directionalLight
        position={[2.2, 5.4, 1.1]}
        color={palette.lighting.sunColor}
        intensity={palette.lighting.sunIntensity * atmosphere.intensityMultiplier}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0006}
        shadow-radius={4}
      />

      {/* Proximity light (Part 8) — one fixture that eases toward whichever interactable is currently in range. */}
      <pointLight ref={proximityLightRef} position={[spawnVec[0], 1.1, spawnVec[2]]} color="#ffe3ad" intensity={PROXIMITY_LIGHT_BASE} distance={1.6} decay={2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomWidthM / 2, 0, roomDepthM / 2]} receiveShadow>
        <planeGeometry args={[roomWidthM, roomDepthM]} />
        <meshStandardMaterial color={palette.floorColor} roughness={0.95} metalness={0} />
      </mesh>

      <mesh position={[roomWidthM / 2, wallHeightM / 2, 0]} receiveShadow>
        <boxGeometry args={[roomWidthM, wallHeightM, 0.15]} />
        <meshStandardMaterial color={palette.wallColor} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, wallHeightM / 2, roomDepthM / 2]} receiveShadow>
        <boxGeometry args={[0.15, wallHeightM, roomDepthM]} />
        <meshStandardMaterial color={palette.wallColor} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[roomWidthM, wallHeightM / 2, roomDepthM / 2]} receiveShadow>
        <boxGeometry args={[0.15, wallHeightM, roomDepthM]} />
        <meshStandardMaterial color={palette.wallColor} roughness={1} metalness={0} />
      </mesh>

      {dressing}

      {!arrivalMarkerDone ? (
        <mesh ref={arrivalRingRef} position={[spawnVec[0], 0.02, spawnVec[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.5, 24]} />
          <meshBasicMaterial color={palette.trimColor} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ) : null}

      {/* Generic interactable meshes. Doors (kind "door") get a real,
          trim-tinted frame — same box-door recipe TestRoomScene.tsx uses
          for Campus HQ's own door (fixed 1x2.2x0.1m regardless of the
          rect's click-target size, so it reads as a door rather than a
          rect-shaped slab) — fixing the Phase 20F audit's "no visible door
          mesh" / "trimColor unused" findings in one place for every
          building that uses this shell. Every other interactable kind
          keeps the original invisible hit-box; their visual comes from
          the building's own `dressing` group. */}
      {world.interactables.map((item) => {
        const [x, , z] = floorPointToVector3(interactableMeshPoint(item));
        if (item.kind === "door") {
          return (
            <group
              key={item.id}
              position={[x, 0, z]}
              ref={(g) => {
                if (g) doorGroupRefs.current.set(item.id, g);
                else doorGroupRefs.current.delete(item.id);
              }}
            >
              <mesh position={[0, 1.1, -0.03]}>
                <boxGeometry args={[1.12, 2.32, 0.06]} />
                <meshStandardMaterial color="#3a2a1c" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[0, 1.1, 0]} onClick={() => activate(item)}>
                <boxGeometry args={[1.0, 2.2, 0.1]} />
                <meshStandardMaterial color={palette.trimColor} roughness={0.85} metalness={0} />
              </mesh>
              <mesh position={[0.34, 1.05, 0.07]} castShadow>
                <boxGeometry args={[0.03, 0.16, 0.03]} />
                {/* Art Bible Part 5 rule 1 — metalness is always 0, even for "Metal (simple, matte)" (#9a9490). */}
                <meshStandardMaterial color="#9a9490" roughness={0.5} metalness={0} />
              </mesh>
            </group>
          );
        }
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

      {visibleNpcs.map((npc) => (
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
