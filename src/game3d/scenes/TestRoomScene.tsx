/**
 * Milestone 20A test room scene contents (Phase 20; room shell, lighting,
 * and movement feel reworked in Milestone 20A.5 "Visual Direction Lock").
 * Room shell, player, placeholder NPC, and interaction handling, driven by
 * the EXISTING, unmodified `useWorldMovement` hook
 * (src/world/useWorldMovement.ts) — see
 * docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §1 for why this hook is reused
 * verbatim rather than forked.
 *
 * Movement re-render note (Part 3 compliance, documented honestly rather
 * than silently glossed over): `useWorldMovement`'s `pos` is React state,
 * because the legacy DOM renderer needs it for CSS positioning — reusing
 * the hook unmodified means THIS component still re-renders on every
 * movement tick. To still satisfy the *spirit* of "never drive the 3D
 * scene graph from a React re-render," `movement.pos`/`facingLeft` are
 * mirrored into a ref (`liveMovementRef`) via a plain assignment on every
 * render (cheap — no effect needed), and the actual Three.js object
 * transform is written imperatively inside `useFrame`, which runs on
 * R3F's own render loop, decoupled from React commit timing. No mesh or
 * geometry is ever recreated by a movement tick; only `.position`/
 * `.rotation` are mutated. A future milestone could fork a ref-only
 * variant of the movement hook if profiling ever shows this matters at
 * real room complexity — not needed at this prototype's scale.
 *
 * 20A.5 movement-feel note: `useWorldMovement` itself is still completely
 * unmodified (it's shared with the legacy 2D renderer — changing its
 * constants would change the legacy game's feel too, well outside this
 * milestone's scope). Instead, a purely visual smoothing layer
 * (`renderedPosRef`/`renderedYawRef` below) eases the rendered Three.js
 * transform toward the hook's real position/facing every frame, giving the
 * brief's "small acceleration, small deceleration, natural turning, no
 * twitching" without touching shared logic.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldMovement, nearestInRange } from "../../world/useWorldMovement";
import { TEST_ROOM_WORLD, ROOM_NPCS } from "../rooms/testRoomWorld";
import { TestRoomProps, DeskItems, ContactShadow } from "../rooms/TestRoomProps";
import { floorPointToVector3, sceneUnitsToMetres } from "../types/coordinates";
import { ModularCharacter } from "../characters/ModularCharacter";
import { NpcCharacter } from "../characters/NpcCharacter";
import { createPoseBlender, type JointTransform, type PoseName } from "../characters/characterRig";
import { playActivitySoundOnChange } from "../characters/activitySound";
import { targetLightIntensity, lerpIntensity } from "./proximityLight";
import { BirdsEyeCamera } from "../camera/BirdsEyeCamera";
import { useSaveData } from "../../state/SaveDataContext";
import { createDefaultAppearance, createDefaultRoomCustomisation } from "../../data/playerIdentityDefaults";
import { getRoomTheme } from "../rooms/roomThemes";
import { isNpcActiveAtTime } from "../campus/timeOfDay";
import { findFurnitureItem } from "../../data/furnitureCatalogue";
import { emitSound, stopSound } from "../../lib/sound";
import { getTimeOfDayAtmosphere, type TimeOfDay } from "../campus/timeOfDay";
import type { FloorPoint, InteractAction, WorldInteractable } from "../../world/worldTypes";
import type { RoomThemeId } from "../../types/domain";

function applyJoint(group: THREE.Group | null, joint: JointTransform): void {
  if (!group) return;
  group.rotation.set(joint.rotX, joint.rotY, joint.rotZ);
}

const ROOM_WIDTH_M = sceneUnitsToMetres(TEST_ROOM_WORLD.width);
const ROOM_DEPTH_M = sceneUnitsToMetres(TEST_ROOM_WORLD.height);
/** Lowered from 20A's 2.6m — a slightly lower ceiling reads cosier at this room's now-smaller footprint. */
const WALL_HEIGHT_M = 2.3;

/** Rect-centre floor point for a `WorldInteractable`, used to place its 3D mesh — derived from the fixture rather than duplicated as a separate literal (20A's desk/door meshes drifted from `testRoomWorld.ts` once already when the room was rescaled; deriving avoids a repeat). */
function interactableMeshPoint(item: WorldInteractable): FloorPoint {
  const [rx, ry, rw, rh] = item.rect;
  return { x: rx + rw / 2, feetY: ry + rh / 2 };
}

const DOOR = TEST_ROOM_WORLD.interactables.find((i) => i.id === "door-exit")!;
const DESK = TEST_ROOM_WORLD.interactables.find((i) => i.id === "desk-study")!;
const BOOKSHELF = TEST_ROOM_WORLD.interactables.find((i) => i.id === "bookshelf-resources")!;
const WARDROBE = TEST_ROOM_WORLD.interactables.find((i) => i.id === "wardrobe")!;
/** Phase 20D Part 4 — three new interactive routes, same fixed-fixture pattern as the four above. */
const NOTICEBOARD = TEST_ROOM_WORLD.interactables.find((i) => i.id === "noticeboard")!;
const COFFEE_AREA = TEST_ROOM_WORLD.interactables.find((i) => i.id === "coffee-area")!;
const DESK_COMPUTER = TEST_ROOM_WORLD.interactables.find((i) => i.id === "desk-computer")!;
const ROOM_PLANNER = TEST_ROOM_WORLD.interactables.find((i) => i.id === "room-planner")!;
const CAMPUS_DIRECTORY = TEST_ROOM_WORLD.interactables.find((i) => i.id === "campus-directory")!;

/** Higher = the rendered transform catches up to the real position faster. Tuned low enough to visibly smooth the movement hook's discrete per-tick steps into an eased glide, high enough that it never feels laggy or disconnected from input. */
const POS_SMOOTH_SPEED = 9;
const YAW_SMOOTH_SPEED = 7;

/** Proximity-lighting response (Phase 20C, Part 5) — every highlight light eases between these two intensities rather than snapping, staying "subtle" per the brief. */
const PROXIMITY_LIGHT_BASE = 0.15;
const PROXIMITY_LIGHT_BOOST = 0.55;
const PROXIMITY_LIGHT_SPEED = 4;

export function TestRoomScene({
  reduceMotion,
  onAction,
  onInRangeChange,
  previewTheme,
  previewPlacedFurniture,
  previewRotations,
  editModeActive = false,
  timeOfDay,
  shadowMapSize = 1024,
}: {
  reduceMotion: boolean;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
  /**
   * Room Edit Mode (Phase 20D Part 5) overrides — while the editor is open,
   * the live 3D scene renders the player's in-progress DRAFT, not the saved
   * room, so Preview/Cancel/Apply can show a real result before anything is
   * written to save data. Omitted (the normal case) falls back to the real
   * saved theme/layout below.
   */
  previewTheme?: RoomThemeId;
  previewPlacedFurniture?: Record<string, string | null>;
  previewRotations?: Record<string, number>;
  /** Room Edit Mode is open (Phase 20D Part 5) — the camera eases to the same closer framing normally reserved for standing near an interactable, via the existing `zoomBoost` mechanism (no new camera mode). */
  editModeActive?: boolean;
  /** Phase 20E Part 7 — atmosphere only, dims/brightens the theme's own lighting rig; never changes which theme is active. */
  timeOfDay: TimeOfDay;
  /** Phase 20F Part 15 quality tiers — the directional light's shadow-map resolution. Shadow rendering itself is toggled at the `<Canvas shadows={...}>` level in Game3D.tsx, not here. */
  shadowMapSize?: number;
}) {
  const { saveData } = useSaveData();
  const playerAppearance = saveData.playerIdentity?.appearance ?? createDefaultAppearance();
  const theme = getRoomTheme(previewTheme ?? saveData.playerIdentity?.preferredRoomTheme ?? "modern-campus");
  const atmosphere = getTimeOfDayAtmosphere(timeOfDay);
  const placedFurniture = previewPlacedFurniture ?? saveData.playerIdentity?.roomCustomisation.placedFurniture ?? createDefaultRoomCustomisation().placedFurniture;
  const rotations = previewRotations ?? saveData.playerIdentity?.roomCustomisation.rotations ?? createDefaultRoomCustomisation().rotations;
  const deskItem = findFurnitureItem(placedFurniture["slot-desk"] ?? "") ?? null;
  const hasDeskAccessory = Boolean(placedFurniture["slot-desk-accessory"]);

  const movement = useWorldMovement(TEST_ROOM_WORLD, { reduceMotion, enabled: true });

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

  // Ambient room tone (Part 6/8) — started once on mount, looping for as
  // long as this room is; nothing here depends on player state, so a
  // single mount-time effect is enough (no per-frame re-triggering).
  useEffect(() => {
    emitSound("room-ambience", { loop: true });
    emitSound("birds-outside", { loop: true });
    emitSound("hvac-hum", { loop: true });
    // Phase 20F Part 7 — stop this room's own loops on unmount (travelling
    // to another building unmounts this scene entirely) so they don't keep
    // playing under whichever building's ambience starts next.
    return () => {
      stopSound("room-ambience");
      stopSound("birds-outside");
      stopSound("hvac-hum");
    };
  }, []);

  const spawnVec = floorPointToVector3(TEST_ROOM_WORLD.spawn);
  const renderedPos = useRef(new THREE.Vector3(spawnVec[0], spawnVec[1], spawnVec[2]));
  const renderedYaw = useRef(Math.PI * 0.25);

  const deskLightRef = useRef<THREE.PointLight>(null);
  const bookshelfLightRef = useRef<THREE.PointLight>(null);
  const wardrobeLightRef = useRef<THREE.PointLight>(null);
  const noticeboardLightRef = useRef<THREE.PointLight>(null);
  const coffeeLightRef = useRef<THREE.PointLight>(null);
  const roomPlannerLightRef = useRef<THREE.PointLight>(null);

  const inRange = useMemo(() => nearestInRange(movement.pos, TEST_ROOM_WORLD.interactables), [movement.pos]);
  useEffect(() => {
    onInRangeChange(inRange);
  }, [inRange, onInRangeChange]);

  // Phase 20F Part 8 — a short cue the instant a NEW interactable comes
  // into range (not every frame while already in range), wiring the
  // previously-unused "hover" sound event into the one prompt-eligibility
  // signal every interactable already shares.
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

  // "E" key interaction — mirrors WorldScene.tsx's own keydown handling,
  // reading live state through a ref so the listener never needs to re-bind.
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

      // Shortest-path angle interpolation so a left<->right facing flip
      // always turns the short way round, never the long way.
      const diff = Math.atan2(Math.sin(targetYaw - renderedYaw.current), Math.cos(targetYaw - renderedYaw.current));
      const yawT = 1 - Math.exp(-YAW_SMOOTH_SPEED * delta);
      renderedYaw.current += diff * yawT;
      group.rotation.y = renderedYaw.current;
    }

    // Player pose (Part 9: idle/walk) — the shared rig, same as any NPC.
    poseClockRef.current += delta;
    const playerActivity: PoseName = liveMovementRef.current.moving ? "walk" : "idle";
    // Footstep sound is keyed off the real MOVEMENT state (`moving`), not
    // the visual pose amplitude — so it's unaffected by reduced motion
    // turning down/off the walk-cycle bob (Part 8: "respect reduced-motion").
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

    // Proximity lighting (Part 5) — each interactable's highlight light
    // eases toward a boosted intensity while the player is in range of
    // it, and back down otherwise. Reduced motion still eases (a light
    // intensity change isn't the kind of motion that reduced-motion
    // settings are about — see Part 8's own "respect reduced-motion"
    // scope, which this project treats as movement/animation, not
    // material properties), so this runs unconditionally.
    const inRangeId = inRangeRef.current?.id ?? null;
    if (deskLightRef.current) {
      deskLightRef.current.intensity = lerpIntensity(
        deskLightRef.current.intensity,
        targetLightIntensity(inRangeId === DESK.id, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST),
        PROXIMITY_LIGHT_SPEED,
        delta
      );
    }
    if (bookshelfLightRef.current) {
      bookshelfLightRef.current.intensity = lerpIntensity(
        bookshelfLightRef.current.intensity,
        targetLightIntensity(inRangeId === BOOKSHELF.id, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST),
        PROXIMITY_LIGHT_SPEED,
        delta
      );
    }
    if (wardrobeLightRef.current) {
      wardrobeLightRef.current.intensity = lerpIntensity(
        wardrobeLightRef.current.intensity,
        targetLightIntensity(inRangeId === WARDROBE.id, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST),
        PROXIMITY_LIGHT_SPEED,
        delta
      );
    }
    if (noticeboardLightRef.current) {
      noticeboardLightRef.current.intensity = lerpIntensity(
        noticeboardLightRef.current.intensity,
        targetLightIntensity(inRangeId === NOTICEBOARD.id, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST),
        PROXIMITY_LIGHT_SPEED,
        delta
      );
    }
    if (coffeeLightRef.current) {
      coffeeLightRef.current.intensity = lerpIntensity(
        coffeeLightRef.current.intensity,
        targetLightIntensity(inRangeId === COFFEE_AREA.id, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST),
        PROXIMITY_LIGHT_SPEED,
        delta
      );
    }
    if (roomPlannerLightRef.current) {
      roomPlannerLightRef.current.intensity = lerpIntensity(
        roomPlannerLightRef.current.intensity,
        targetLightIntensity(inRangeId === ROOM_PLANNER.id, PROXIMITY_LIGHT_BASE, PROXIMITY_LIGHT_BOOST),
        PROXIMITY_LIGHT_SPEED,
        delta
      );
    }
  });

  const deskMeshPos = floorPointToVector3(interactableMeshPoint(DESK));
  const doorMeshPos = floorPointToVector3(interactableMeshPoint(DOOR));
  const bookshelfMeshPos = floorPointToVector3(interactableMeshPoint(BOOKSHELF));
  const wardrobeMeshPos = floorPointToVector3(interactableMeshPoint(WARDROBE));
  const noticeboardMeshPos = floorPointToVector3(interactableMeshPoint(NOTICEBOARD));
  const coffeeAreaMeshPos = floorPointToVector3(interactableMeshPoint(COFFEE_AREA));
  const deskComputerMeshPos = floorPointToVector3(interactableMeshPoint(DESK_COMPUTER));
  const roomPlannerMeshPos = floorPointToVector3(interactableMeshPoint(ROOM_PLANNER));
  const campusDirectoryMeshPos = floorPointToVector3(interactableMeshPoint(CAMPUS_DIRECTORY));
  const deskTopY = 0.755;

  return (
    <>
      <BirdsEyeCamera
        targetRef={playerGroupRef as unknown as React.MutableRefObject<THREE.Object3D | null>}
        reduceMotion={reduceMotion}
        zoomBoost={inRange || editModeActive ? 1 : 0}
      />

      {/* Lighting — warm and soft (Milestone 20A.5), now theme-driven
          (Phase 20D Part 1): the "afternoon" values below were the fixed
          20A.5 baseline, now `theme.lighting`'s modern-campus entry —
          switching themes swaps this whole rig, nothing else. Desk-lamp
          and reading-lamp glow live with their fixtures in TestRoomProps.tsx. */}
      <ambientLight color={atmosphere.ambientColorOverride ?? theme.lighting.ambientColor} intensity={theme.lighting.ambientIntensity * atmosphere.intensityMultiplier} />
      <hemisphereLight color={theme.lighting.hemisphereSky} groundColor={theme.lighting.hemisphereGround} intensity={theme.lighting.hemisphereIntensity * atmosphere.intensityMultiplier} />
      <directionalLight
        position={[2.2, 5.4, 1.1]}
        color={theme.lighting.sunColor}
        intensity={theme.lighting.sunIntensity * atmosphere.intensityMultiplier}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0006}
        shadow-radius={4}
      />

      {/* Floor — theme-driven (Phase 20D Part 1). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROOM_WIDTH_M / 2, 0, ROOM_DEPTH_M / 2]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH_M, ROOM_DEPTH_M]} />
        <meshStandardMaterial color={theme.floorColor} roughness={0.95} metalness={0} />
      </mesh>

      {/* Perimeter walls (simple boxes — placeholder geometry). Theme-driven (Phase 20D Part 1). */}
      <mesh position={[ROOM_WIDTH_M / 2, WALL_HEIGHT_M / 2, 0]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH_M, WALL_HEIGHT_M, 0.15]} />
        <meshStandardMaterial color={theme.wallColor} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT_M / 2, ROOM_DEPTH_M / 2]} receiveShadow>
        <boxGeometry args={[0.15, WALL_HEIGHT_M, ROOM_DEPTH_M]} />
        <meshStandardMaterial color={theme.wallColor} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[ROOM_WIDTH_M, WALL_HEIGHT_M / 2, ROOM_DEPTH_M / 2]} receiveShadow>
        <boxGeometry args={[0.15, WALL_HEIGHT_M, ROOM_DEPTH_M]} />
        <meshStandardMaterial color={theme.wallColor} roughness={1} metalness={0} />
      </mesh>

      {/* Room composition — slot-driven furniture, rug, window, wall art (Phase 20D retrofit of Milestone 20A.5). */}
      <TestRoomProps placedFurniture={placedFurniture} rotations={rotations} />

      {/* Desk (interactable — collision obstacle matches testRoomWorld.ts's obstacle rect). Colour is slot-driven (Phase 20D Part 1/2) — this mesh stays owned here rather than the generic FurnitureMesh renderer because it needs its own collision/click handling. */}
      <ContactShadow x={deskMeshPos[0]} z={deskMeshPos[2]} radius={0.85} />
      <mesh position={[deskMeshPos[0], deskTopY / 2, deskMeshPos[2]]} castShadow receiveShadow onClick={() => activate(DESK)}>
        <boxGeometry args={[1.6, deskTopY, 0.75]} />
        <meshStandardMaterial color={deskItem?.colors.primary ?? "#8a5a34"} roughness={0.85} metalness={0} />
      </mesh>
      {/* Desk accessories ("Computer -> Assessments & Calendar," Part 4) — only rendered/clickable while the desk-accessory slot is actually occupied. */}
      {hasDeskAccessory ? (
        <>
          <DeskItems x={deskMeshPos[0]} z={deskMeshPos[2]} deskTopY={deskTopY} />
          <mesh position={[deskComputerMeshPos[0], deskTopY + 0.08, deskComputerMeshPos[2]]} onClick={() => activate(DESK_COMPUTER)}>
            <boxGeometry args={[0.4, 0.3, 0.35]} />
            <meshStandardMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      ) : null}
      {/* Proximity-lighting highlight (Part 5) — a warm point light layered above the desk lamp's own fixed glow, easing brighter only while the player is in range. */}
      <pointLight ref={deskLightRef} position={[deskMeshPos[0], 1.1, deskMeshPos[2]]} color="#ffe3ad" intensity={PROXIMITY_LIGHT_BASE} distance={1.6} decay={2} />

      {/* Door marker (interactable). Colour is the theme's trim colour (Phase 20D Part 1) — the door frame is the one always-present element every theme reasonably tints. A slightly darker frame lip + a small metal handle (Phase 20F Part 4 polish — this was the audit's "plainest hero object" finding) give it a door's silhouette instead of reading as a plain slab. */}
      <mesh position={[doorMeshPos[0], 1.1, doorMeshPos[2] - 0.03]}>
        <boxGeometry args={[1.12, 2.32, 0.06]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[doorMeshPos[0], 1.1, doorMeshPos[2]]} onClick={() => activate(DOOR)}>
        <boxGeometry args={[1.0, 2.2, 0.1]} />
        <meshStandardMaterial color={theme.trimColor} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[doorMeshPos[0] + 0.34, 1.05, doorMeshPos[2] + 0.07]} castShadow>
        <boxGeometry args={[0.03, 0.16, 0.03]} />
        {/* Art Bible Part 5 rule 1 — metalness is always 0, even for "Metal (simple, matte)" (#9a9490); "metal" reads through shape and a cooler grey tone only, never actual metalness. */}
        <meshStandardMaterial color="#9a9490" roughness={0.5} metalness={0} />
      </mesh>

      {/* Bookshelf click target (interactable) — an invisible hit-box over Bookshelf's meshes (TestRoomProps.tsx), matching the desk/door/wardrobe pattern. */}
      <mesh position={[bookshelfMeshPos[0], 0.75, bookshelfMeshPos[2]]} onClick={() => activate(BOOKSHELF)}>
        <boxGeometry args={[1.3, 1.5, 0.4]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={bookshelfLightRef} position={[bookshelfMeshPos[0], 1.3, bookshelfMeshPos[2]]} color="#ffe3ad" intensity={PROXIMITY_LIGHT_BASE} distance={1.6} decay={2} />

      {/* Wardrobe click target (interactable) — an invisible hit-box over WardrobeCluster's meshes (TestRoomProps.tsx), matching the desk/door pattern of a clickable mesh at the fixture's own coordinates. Fully transparent rather than `visible={false}` so it still raycasts. */}
      <mesh position={[wardrobeMeshPos[0], 0.6, wardrobeMeshPos[2]]} onClick={() => activate(WARDROBE)}>
        <boxGeometry args={[1.0, 1.6, 0.7]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={wardrobeLightRef} position={[wardrobeMeshPos[0], 1.2, wardrobeMeshPos[2]]} color="#cfe0e6" intensity={PROXIMITY_LIGHT_BASE} distance={1.4} decay={2} />

      {/* Noticeboard click target (interactable, Phase 20D Part 4 "Check Deadlines") — an invisible hit-box over the slot-driven Noticeboard mesh (TestRoomProps.tsx), matching the bookshelf/wardrobe pattern. */}
      <mesh position={[noticeboardMeshPos[0], 1.3, noticeboardMeshPos[2]]} onClick={() => activate(NOTICEBOARD)}>
        <boxGeometry args={[0.3, 1.0, 1.3]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={noticeboardLightRef} position={[noticeboardMeshPos[0] - 0.15, 1.3, noticeboardMeshPos[2]]} color="#ffe3ad" intensity={PROXIMITY_LIGHT_BASE} distance={1.4} decay={2} />

      {/* Coffee Area click target (interactable, Phase 20D Part 4 "Check Daily Brief") — an invisible hit-box over the fixed CoffeeCorner mesh (TestRoomProps.tsx). */}
      <mesh position={[coffeeAreaMeshPos[0], 0.4, coffeeAreaMeshPos[2]]} onClick={() => activate(COFFEE_AREA)}>
        <cylinderGeometry args={[0.45, 0.45, 0.8, 10]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={coffeeLightRef} position={[coffeeAreaMeshPos[0], 0.9, coffeeAreaMeshPos[2]]} color="#ffe3ad" intensity={PROXIMITY_LIGHT_BASE} distance={1.4} decay={2} />

      {/* Room Planner board click target (interactable, Phase 20D Part 5 "Edit Room") — an invisible hit-box over the fixed RoomPlannerBoard mesh (TestRoomProps.tsx). */}
      <mesh position={[roomPlannerMeshPos[0], 1.4, roomPlannerMeshPos[2] + 0.03]} onClick={() => activate(ROOM_PLANNER)}>
        <boxGeometry args={[0.8, 0.65, 0.1]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight ref={roomPlannerLightRef} position={[roomPlannerMeshPos[0], 1.4, roomPlannerMeshPos[2] + 0.2]} color="#cfe0e6" intensity={PROXIMITY_LIGHT_BASE} distance={1.2} decay={2} />

      {/* Campus Directory signpost click target (interactable, Phase 20E Part 6 "View Campus Map") — an invisible hit-box over the fixed CampusSignpost mesh (TestRoomProps.tsx). */}
      <mesh position={[campusDirectoryMeshPos[0], 0.9, campusDirectoryMeshPos[2]]} onClick={() => activate(CAMPUS_DIRECTORY)}>
        <cylinderGeometry args={[0.3, 0.3, 1.8, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* NPCs — schedule-driven daily life (Phase 20C, Parts 1/2/9): each
          walks between waypoints and performs a sequence of activities,
          not yet interactive (still Milestone 20A scope for interaction). */}
      {ROOM_NPCS.filter((npc) => isNpcActiveAtTime(npc.activeTimes, timeOfDay)).map((npc) => (
        <NpcCharacter
          key={npc.id}
          appearance={npc.appearance}
          personality={npc.personality}
          schedule={npc.schedule}
          scheduleTimeOffsetSeconds={npc.scheduleTimeOffsetSeconds}
          label={npc.label}
        />
      ))}

      {/* Player — the real PlayerIdentity appearance (Phase 20B), idle/walk pose driven by the same shared rig every NPC uses. */}
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
