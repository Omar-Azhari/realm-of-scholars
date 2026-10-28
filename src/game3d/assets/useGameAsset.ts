/**
 * React hook layer over `assetLoaderCore.ts` (V2 Phase 2, Part 3). This is
 * the ONE way scene code should ever request a manifest-registered asset —
 * never `useGLTF()` directly, never a hardcoded path (Implementation Rule
 * #6). Deliberately NOT built on drei's Suspense-throwing `useGLTF`: this
 * hook needs to distinguish "no file exists yet, render the procedural
 * fallback" from "a real file failed to load, render ITS declared
 * fallback" from "still loading" as ordinary state, which a
 * Suspense/ErrorBoundary pair does not give fine-grained control over
 * without extra machinery per call site.
 */

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cloneGltfScene, disposeAssetInstance, loadGltfAsset } from "./assetLoaderCore";
import { getAssetDefinition } from "./assetManifest";
import type { AssetDefinition } from "./assetManifestTypes";

export type GameAssetStatus =
  | "procedural" // no file — caller should render `definition.proceduralComponent`'s real component
  | "missing" // manifest has no entry, or the entry is explicitly status "missing" — caller should render a dev-visible gap marker, never a silent void, in non-production quality modes (see assetQualityMode.ts)
  | "loading"
  | "ready" // `object`/`animations` are the requested asset
  | "fallback" // the primary asset failed; `object`/`animations` are its declared fallback instead (or null if the fallback is itself procedural)
  | "error"; // failed, and no usable fallback exists

export interface GameAssetResult {
  status: GameAssetStatus;
  definition: AssetDefinition | undefined;
  /** Cloned (via SkeletonUtils, clone-safe for skinned meshes) — safe to mount directly, and to dispose independently of any other instance of the same asset. */
  object: THREE.Object3D | null;
  /** The clip list from the underlying GLTF, if any — shared across clones, never cloned itself (three.js clips are immutable and instance-agnostic). */
  animations: THREE.AnimationClip[];
  error: Error | null;
}

interface InternalState {
  status: GameAssetStatus;
  object: THREE.Object3D | null;
  animations: THREE.AnimationClip[];
  error: Error | null;
}

function stateFor(def: AssetDefinition | undefined): InternalState {
  if (!def) return { status: "missing", object: null, animations: [], error: null };
  if (def.format === "procedural") return { status: "procedural", object: null, animations: [], error: null };
  if (def.status === "missing" || !def.filePath) return { status: "missing", object: null, animations: [], error: null };
  return { status: "loading", object: null, animations: [], error: null };
}

function instantiate(gltf: GLTF): { object: THREE.Object3D; animations: THREE.AnimationClip[] } {
  return { object: cloneGltfScene(gltf), animations: gltf.animations };
}

/** Requests a single manifest-registered asset by ID and manages its lifecycle for the calling component's lifetime — disposes its cloned instance on unmount or asset-id change. */
export function useGameAsset(assetId: string): GameAssetResult {
  const definition = getAssetDefinition(assetId);
  const [state, setState] = useState<InternalState>(() => stateFor(definition));
  const mountedObjectRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;
    const def = getAssetDefinition(assetId);
    setState(stateFor(def));
    if (!def || def.format === "procedural" || def.status === "missing" || !def.filePath) {
      return;
    }

    loadGltfAsset(def)
      .then((gltf) => {
        if (cancelled) return;
        const { object, animations } = instantiate(gltf);
        mountedObjectRef.current = object;
        setState({ status: "ready", object, animations, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        const primaryError = err instanceof Error ? err : new Error(String(err));
        const fallbackDef = def.fallbackAssetId ? getAssetDefinition(def.fallbackAssetId) : undefined;
        if (!fallbackDef || fallbackDef.format === "procedural") {
          setState({ status: fallbackDef ? "fallback" : "error", object: null, animations: [], error: primaryError });
          return;
        }
        if (!fallbackDef.filePath) {
          setState({ status: "error", object: null, animations: [], error: primaryError });
          return;
        }
        loadGltfAsset(fallbackDef)
          .then((gltf) => {
            if (cancelled) return;
            const { object, animations } = instantiate(gltf);
            mountedObjectRef.current = object;
            setState({ status: "fallback", object, animations, error: primaryError });
          })
          .catch(() => {
            if (cancelled) return;
            setState({ status: "error", object: null, animations: [], error: primaryError });
          });
      });

    return () => {
      cancelled = true;
      if (mountedObjectRef.current) {
        disposeAssetInstance(mountedObjectRef.current);
        mountedObjectRef.current = null;
      }
    };
  }, [assetId]);

  return { status: state.status, definition, object: state.object, animations: state.animations, error: state.error };
}
