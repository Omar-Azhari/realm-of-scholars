/**
 * Animation-clip playback for a loaded character asset (V2 Phase 2, Part
 * 3/15). Builds a `THREE.AnimationMixer` over whatever `useGameAsset`
 * resolves and exposes named actions keyed by clip name.
 *
 * Honest scope note: no rigged GLB character exists in this project yet
 * (see `docs/V2_PHASE2_ASSET_AUDIT.md` — `character-player-modular`/
 * `character-npc-modular` are both `status: "procedural"`, driven by the
 * existing trig-based pose blender in `characterRig.ts`, not clips). This
 * hook is real, working infrastructure for WHEN a rigged character
 * arrives — it is not exercised against real animation data this phase,
 * and must not be described as a verified/solved retargeting path
 * (Implementation Rule #16) until it has actually been run against a real
 * asset with real clips.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useGameAsset, type GameAssetResult } from "./useGameAsset";

export interface AnimatedCharacterResult extends GameAssetResult {
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  /** Cross-fades into the named clip's action. No-ops (dev-warns) if the clip name isn't present on this asset. */
  play: (clipName: string, opts?: { fadeSeconds?: number; loop?: boolean }) => void;
}

export function useAnimatedCharacter(assetId: string): AnimatedCharacterResult {
  const base = useGameAsset(assetId);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if ((base.status !== "ready" && base.status !== "fallback") || !base.object) {
      setMixer(null);
      actionsRef.current = {};
      activeActionRef.current = null;
      return;
    }
    const nextMixer = new THREE.AnimationMixer(base.object);
    const nextActions: Record<string, THREE.AnimationAction> = {};
    for (const clip of base.animations) {
      nextActions[clip.name] = nextMixer.clipAction(clip);
    }
    actionsRef.current = nextActions;
    activeActionRef.current = null;
    setMixer(nextMixer);

    return () => {
      nextMixer.stopAllAction();
      nextMixer.uncacheRoot(base.object as THREE.Object3D);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.status, base.object]);

  useEffect(() => {
    if (!mixer) return;
    let last = performance.now();
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      mixer.update((now - last) / 1000);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mixer]);

  const play: AnimatedCharacterResult["play"] = (clipName, opts) => {
    const action = actionsRef.current[clipName];
    if (!action) {
      if (import.meta.env.DEV) {
        console.warn(`[useAnimatedCharacter] no clip named "${clipName}" on asset "${assetId}" — available: ${Object.keys(actionsRef.current).join(", ") || "(none)"}`);
      }
      return;
    }
    const fadeSeconds = opts?.fadeSeconds ?? 0.3;
    action.setLoop(opts?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.reset().fadeIn(fadeSeconds).play();
    if (activeActionRef.current && activeActionRef.current !== action) {
      activeActionRef.current.fadeOut(fadeSeconds);
    }
    activeActionRef.current = action;
  };

  return { ...base, mixer, actions: actionsRef.current, play };
}
