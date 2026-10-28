/**
 * Bird's-eye follow camera (Phase 20, Part 4; retuned in Milestone 20A.5
 * "Visual Direction Lock"; eased further in Milestone 20C "Living World &
 * Animation" Part 7). Perspective camera at a ~55° downward angle (the
 * brief's explicit target, up from 20A's ~48.8°), pulled back further so
 * the shrunk test room (`testRoomWorld.ts`, ~6m x 4.8m) reads as mostly
 * visible in frame and the player reads as a small, diorama-scale figure
 * rather than a third-person-action-game subject. Smoothly damped toward
 * the player. Reduced motion snaps instantly instead of interpolating —
 * reusing the same `useMotionPreference()` signal the legacy renderer
 * already reads (never a second reduced-motion concept, per
 * docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §8).
 *
 * 20C explicitly must NOT change camera philosophy (angle/distance/FOV are
 * untouched below) — only easing quality. Two additions: (1) the look-at
 * target is now damped too, not just position (previously `camera.lookAt`
 * snapped to the target's exact position every frame even though the
 * camera's own position eased — a subtle inconsistency fixed here so the
 * whole camera, aim included, settles rather than part-snapping); (2) an
 * optional, tiny "interaction zoom" (`zoomBoost`, 0–1) pulls the camera
 * slightly closer while near an interactable, scaling height and distance
 * by the SAME factor so the 55° angle never changes — "keep existing
 * framing," per the brief.
 *
 * All position math happens inside `useFrame`, never via React state —
 * Part 3's "no React rerender every animation frame" rule, applied here
 * without exception (unlike the movement hook itself — see
 * TestRoomScene.tsx's header comment for why that one case differs).
 *
 * Deliberately NOT implemented (see the 20A.5 completion report, §14 of
 * the Phase 20 doc, for the original reasoning — still true in 20C):
 * player-controlled camera rotation or zoom, and multi-room "door
 * transitions" (this prototype still has exactly one room — the existing
 * entry-ease below already covers "arriving in a room," which is as much
 * of "door transitions" as a single-room scene can meaningfully exercise).
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/** atan(CAMERA_HEIGHT / CAMERA_DISTANCE) ≈ 55.1°, matching the brief's "approximately 55 degrees downward". Unchanged this phase — Part 7 says "keep existing framing." */
const CAMERA_HEIGHT_M = 8.5;
const CAMERA_DISTANCE_M = 5.95;
/** Higher = snappier follow; softened slightly from 20A's 6 for the brief's "subtle camera damping". */
const DAMP_SPEED = 5.5;
/** The look-at target damps a little faster than position — the aim should feel like it's tracking, not lagging behind, while still never snapping. */
const LOOKAT_DAMP_SPEED = 7;
/** On room entry, the camera starts this much further out than its resting framing, then eases in via the normal damped lerp below — "camera eases into place... not cinematic... just polished," not a snap. */
const ENTRY_PULLBACK = 1.35;
/** Part 7 "interaction zoom" — at full `zoomBoost`, the camera sits this fraction closer. Small on purpose ("barely notice the camera"); height and distance scale together so the 55° angle is exactly preserved. */
const MAX_ZOOM_IN = 0.06;
const ZOOM_DAMP_SPEED = 3;

export function BirdsEyeCamera({
  targetRef,
  reduceMotion,
  zoomBoost = 0,
}: {
  targetRef: React.MutableRefObject<THREE.Object3D | null>;
  reduceMotion: boolean;
  /** 0–1 — how close to full "interaction zoom" to ease toward right now (Part 7). Defaults to 0 (resting framing). */
  zoomBoost?: number;
}) {
  const { camera } = useThree();
  const desiredPos = useRef(new THREE.Vector3());
  const desiredLookAt = useRef(new THREE.Vector3());
  const dampedLookAt = useRef(new THREE.Vector3());
  const zoomEase = useRef(0);

  // One-time entry pose: pulled back from the resting framing so the very
  // first frames ease inward via the same damped lerp used every frame
  // after, rather than special-casing a snap for frame one.
  useEffect(() => {
    const target = targetRef.current;
    const x = target?.position.x ?? 0;
    const z = target?.position.z ?? 0;
    if (reduceMotion) {
      camera.position.set(x, CAMERA_HEIGHT_M, z + CAMERA_DISTANCE_M);
    } else {
      camera.position.set(x, CAMERA_HEIGHT_M * ENTRY_PULLBACK, z + CAMERA_DISTANCE_M * ENTRY_PULLBACK);
    }
    dampedLookAt.current.set(x, 0.8, z);
    camera.lookAt(dampedLookAt.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const target = targetRef.current;
    if (!target) return;

    if (reduceMotion) {
      zoomEase.current = zoomBoost;
    } else {
      zoomEase.current += (zoomBoost - zoomEase.current) * (1 - Math.exp(-ZOOM_DAMP_SPEED * delta));
    }
    const zoomScale = 1 - MAX_ZOOM_IN * zoomEase.current;

    desiredPos.current.set(target.position.x, CAMERA_HEIGHT_M * zoomScale, target.position.z + CAMERA_DISTANCE_M * zoomScale);
    desiredLookAt.current.set(target.position.x, 0.8, target.position.z);

    if (reduceMotion) {
      camera.position.copy(desiredPos.current);
      dampedLookAt.current.copy(desiredLookAt.current);
    } else {
      const t = 1 - Math.exp(-DAMP_SPEED * delta);
      camera.position.lerp(desiredPos.current, t);

      const lookT = 1 - Math.exp(-LOOKAT_DAMP_SPEED * delta);
      dampedLookAt.current.lerp(desiredLookAt.current, lookT);
    }
    camera.lookAt(dampedLookAt.current);
  });

  return null;
}
