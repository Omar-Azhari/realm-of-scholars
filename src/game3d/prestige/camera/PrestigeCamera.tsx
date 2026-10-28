/**
 * V2 Phase 1 "Prestige Vertical Slice" — a NEW, parallel camera system,
 * deliberately not a retune of `BirdsEyeCamera.tsx` (which stays
 * byte-for-byte unchanged and keeps serving the experimental-3d renderer,
 * per docs/UNIGAME_V2_MASTER_DESIGN.md §17's "the old locked bird's-eye
 * camera... may remain as a technical fallback, never as the default
 * identity"). Per §9 of the Master Design:
 *
 *  - Larger viewing distance/height than the old camera, tuned for
 *    district-scale spaces rather than a small room.
 *  - A player-influenced orbit (bounded horizontal drag) and zoom
 *    (bounded scroll), replacing the old "no rotation, no zoom" lock.
 *  - Fog, so distant architecture fades believably instead of popping.
 *  - Heavier follow damping than the old camera (slower position/look-at
 *    easing) — part of this phase's "weightier movement" feel, applied at
 *    the camera layer since `useWorldMovement.ts` itself is reused
 *    unmodified (see `PrestigeSceneShell.tsx`'s own header comment for why).
 *
 * Reduced motion still disables all of the above smoothing/orbit easing
 * (snaps straight to target), matching this codebase's one existing
 * accessibility contract everywhere else.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CAMERA_HEIGHT_M = 11;
const CAMERA_DISTANCE_M = 9.5;
const DAMP_SPEED = 3.2; // slower than BirdsEyeCamera's 5.5 — a heavier, grander follow
const LOOKAT_DAMP_SPEED = 4.2;
const ENTRY_PULLBACK = 1.5;
const FOG_NEAR_M = 18;
const FOG_FAR_M = 62;
const FOG_COLOR = "#c9b98a"; // a warm haze rather than a cold grey — reads as sunlit dust, not murk

/** Bounded player-driven orbit — a gentle look-around, not a free camera. */
const MAX_YAW_OFFSET = Math.PI / 3.2; // ~56° either side of the default facing
const MIN_ZOOM = 0.78;
const MAX_ZOOM = 1.35;
const ORBIT_DRAG_SPEED = 0.006;
const ZOOM_WHEEL_SPEED = 0.0011;
const ORBIT_EASE_BACK_SPEED = 0.6; // how quickly yaw offset drifts back toward 0 when idle

export function PrestigeCamera({
  targetRef,
  reduceMotion,
}: {
  targetRef: React.MutableRefObject<THREE.Object3D | null>;
  reduceMotion: boolean;
}) {
  const { camera, gl, scene } = useThree();
  const currentPos = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const entryEase = useRef(0);

  const yawOffset = useRef(0);
  const zoom = useRef(1);
  const dragging = useRef(false);
  const lastPointerX = useRef(0);
  const userIsSteering = useRef(0); // seconds since last user input, drives ease-back

  // Fog — set once; a warm haze so distant colonnades/towers fade rather
  // than pop, matching the Master Design's "God rays / large viewing
  // distance" ask without needing real atmospheric scattering.
  useEffect(() => {
    scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR_M, FOG_FAR_M);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // Bounded orbit/zoom input — a drag rotates the view around the player
  // within MAX_YAW_OFFSET; scroll zooms within [MIN_ZOOM, MAX_ZOOM]. Both
  // stay fully inert under reduced motion (no camera-initiated movement
  // beyond following the player).
  useEffect(() => {
    if (reduceMotion) return;
    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      dragging.current = true;
      lastPointerX.current = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPointerX.current;
      lastPointerX.current = e.clientX;
      yawOffset.current = Math.max(-MAX_YAW_OFFSET, Math.min(MAX_YAW_OFFSET, yawOffset.current - dx * ORBIT_DRAG_SPEED));
      userIsSteering.current = 1.2;
    };
    const onPointerUp = () => {
      dragging.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current + e.deltaY * ZOOM_WHEEL_SPEED));
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, reduceMotion]);

  useFrame((_, delta) => {
    const target = targetRef.current;
    if (!target) return;

    // Ease the player-orbit gently back toward centred once the player
    // stops steering, so the view never gets "stuck" looking sideways —
    // it's a look-around, not a persistent rotation.
    if (!dragging.current) {
      userIsSteering.current = Math.max(0, userIsSteering.current - delta);
      if (userIsSteering.current <= 0) {
        yawOffset.current *= Math.max(0, 1 - ORBIT_EASE_BACK_SPEED * delta);
      }
    }

    const targetYaw = target.rotation.y + Math.PI + yawOffset.current;
    const distance = CAMERA_DISTANCE_M * zoom.current;
    const height = CAMERA_HEIGHT_M * zoom.current;

    const desiredPos = new THREE.Vector3(
      target.position.x + Math.sin(targetYaw) * distance,
      height,
      target.position.z + Math.cos(targetYaw) * distance
    );
    const desiredLookAt = new THREE.Vector3(target.position.x, target.position.y + 0.9, target.position.z);

    if (!initialized.current) {
      const pullback = new THREE.Vector3(
        target.position.x + Math.sin(targetYaw) * distance * ENTRY_PULLBACK,
        height * ENTRY_PULLBACK,
        target.position.z + Math.cos(targetYaw) * distance * ENTRY_PULLBACK
      );
      currentPos.current.copy(pullback);
      currentLookAt.current.copy(desiredLookAt);
      initialized.current = true;
      entryEase.current = 0;
    }

    if (reduceMotion) {
      currentPos.current.copy(desiredPos);
      currentLookAt.current.copy(desiredLookAt);
    } else {
      entryEase.current = Math.min(1, entryEase.current + delta * 0.9);
      const posT = 1 - Math.exp(-DAMP_SPEED * delta);
      const lookT = 1 - Math.exp(-LOOKAT_DAMP_SPEED * delta);
      currentPos.current.lerp(desiredPos, posT);
      currentLookAt.current.lerp(desiredLookAt, lookT);
    }

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
