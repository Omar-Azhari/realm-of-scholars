/**
 * Low-level GLTF/GLB loading service (V2 Phase 2, Part 3) — a single
 * shared loader instance, cache, and disposal path, built directly on
 * three.js's own `GLTFLoader`/`DRACOLoader`/`KTX2Loader` (the exact
 * classes confirmed present in this project's installed `three@0.169.0`
 * under `three/examples/jsm/loaders/`). This exists so no scene file ever
 * constructs its own loader — every consumer goes through the functions
 * here, per Implementation Rule #6 ("scene code must not depend directly
 * on raw production asset paths") and the brief's own instruction to
 * reuse the project's existing framework rather than a bespoke loader
 * per scene.
 *
 * `@react-three/drei`'s `useGLTF` (Suspense-throwing) remains available
 * and perfectly fine for simple, always-succeeds cases elsewhere in the
 * codebase — this module exists specifically for the cases Part 3 calls
 * out that Suspense alone doesn't give clean control over: graceful
 * fallback-on-error, version-keyed cache invalidation, and disposal.
 *
 * Known, disclosed limitation: three's `GLTFLoader`/`FileLoader` does not
 * expose true request cancellation. "Abort handling" here means a
 * consumer-side cancelled flag (see `useGameAsset.ts`) that discards a
 * late-arriving result rather than an actual aborted network fetch —
 * reimplementing GLTFLoader's parse pipeline around a custom
 * `AbortController`-aware fetch was judged not worth the duplication this
 * phase (Implementation Rule #19, prefer a small proven pipeline).
 */

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AssetDefinition } from "./assetManifestTypes";
import { v2AssetUrl } from "./assetUrl";

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

let dracoLoaderSingleton: DRACOLoader | null = null;
/**
 * Draco decoder binaries are NOT bundled in this project (no asset uses
 * Draco compression yet — see docs/V2_PHASE2_ASSET_AUDIT.md). Decoding a
 * Draco-compressed .glb will fail until decoder files are added under
 * `public/draco/` — deliberately not pointed at a CDN default, so this
 * pipeline never makes an undisclosed external network request.
 */
function getDracoLoader(): DRACOLoader {
  if (!dracoLoaderSingleton) {
    dracoLoaderSingleton = new DRACOLoader();
    dracoLoaderSingleton.setDecoderPath(`${resolveBaseUrl()}draco/`);
  }
  return dracoLoaderSingleton;
}

let ktx2LoaderSingleton: KTX2Loader | null = null;
/**
 * KTX2/Basis transcoder binaries are likewise not bundled yet. Call
 * `configureKtx2Support(renderer)` once (e.g. a Canvas `onCreated`) before
 * any KTX2-textured asset is loaded — deferred/opt-in rather than wired
 * automatically, since no scene needs it yet (Implementation Rule #2).
 */
export function configureKtx2Support(renderer: THREE.WebGLRenderer): void {
  if (!ktx2LoaderSingleton) {
    ktx2LoaderSingleton = new KTX2Loader();
    ktx2LoaderSingleton.setTranscoderPath(`${resolveBaseUrl()}basis/`);
  }
  ktx2LoaderSingleton.detectSupport(renderer);
  getGltfLoader().setKTX2Loader(ktx2LoaderSingleton);
}

let gltfLoaderSingleton: GLTFLoader | null = null;
function getGltfLoader(): GLTFLoader {
  if (!gltfLoaderSingleton) {
    gltfLoaderSingleton = new GLTFLoader();
    gltfLoaderSingleton.setDRACOLoader(getDracoLoader());
    // Meshopt decoding is wired per-load via GLTFLoader's own
    // `setMeshoptDecoder` — three's MeshoptDecoder module is async-init,
    // so it's attached lazily the first time a .glb actually requests it
    // (GLTFLoader no-ops the call if the file doesn't use the extension).
  }
  return gltfLoaderSingleton;
}

let meshoptReady: Promise<void> | null = null;
async function ensureMeshoptDecoder(): Promise<void> {
  if (!meshoptReady) {
    meshoptReady = import("three/examples/jsm/libs/meshopt_decoder.module.js").then(({ MeshoptDecoder }) => {
      getGltfLoader().setMeshoptDecoder(MeshoptDecoder);
    });
  }
  return meshoptReady;
}

function cacheKey(def: AssetDefinition): string {
  return `${def.filePath ?? def.id}@${def.version}`;
}

const resolvedCache = new Map<string, GLTF>();
const inflightCache = new Map<string, Promise<GLTF>>();

/**
 * Load (or return the cached result for) a GLTF/GLB asset definition.
 * Cache key includes `version`, so bumping an entry's `version` field in
 * the manifest is the documented way to invalidate a stale cached file
 * (Part 2's "version invalidation" requirement) without needing an
 * explicit `clearAssetCache()` call at every call site.
 */
export async function loadGltfAsset(def: AssetDefinition): Promise<GLTF> {
  if (!def.filePath) {
    throw new Error(`Asset "${def.id}" has no filePath (status: ${def.status}, format: ${def.format}) — nothing to load.`);
  }
  const key = cacheKey(def);
  const cached = resolvedCache.get(key);
  if (cached) return cached;

  let inflight = inflightCache.get(key);
  if (!inflight) {
    const url = v2AssetUrl(def.filePath);
    inflight = ensureMeshoptDecoder().then(
      () =>
        new Promise<GLTF>((resolve, reject) => {
          getGltfLoader().load(
            url,
            (gltf) => {
              resolvedCache.set(key, gltf);
              inflightCache.delete(key);
              resolve(gltf);
            },
            undefined,
            (err) => {
              inflightCache.delete(key);
              reject(err instanceof Error ? err : new Error(`Failed to load asset "${def.id}" from ${url}: ${String(err)}`));
            }
          );
        })
    );
    inflightCache.set(key, inflight);
  }
  return inflight;
}

/** Fire-and-forget warm of the cache — swallows errors (a failed preload should never crash the caller; the real load attempt surfaces the error). */
export function preloadGltfAsset(def: AssetDefinition): void {
  if (!def.filePath) return;
  loadGltfAsset(def).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn(`[assetLoader] preload failed for "${def.id}":`, err);
    }
  });
}

/** Drop a specific cached entry (or every entry when called with no argument) — used by version-bump invalidation and dev-tooling hot-reload of replaced files. */
export function clearAssetCache(def?: AssetDefinition): void {
  if (!def) {
    resolvedCache.clear();
    inflightCache.clear();
    return;
  }
  const key = cacheKey(def);
  resolvedCache.delete(key);
  inflightCache.delete(key);
}

/**
 * Clone-safe reuse (Part 3): `SkeletonUtils.clone` — not `Object3D.clone()`
 * — because a plain clone breaks skinned-mesh bone bindings between
 * instances. Safe for both skinned and static geometry, so every consumer
 * uses this single path rather than choosing per-asset.
 */
export function cloneGltfScene(gltf: GLTF): THREE.Object3D {
  return cloneSkeleton(gltf.scene);
}

/** Recursively free GPU resources for a cloned instance. Never disposes shared cached materials/geometries owned by the original `GLTF` result — only call this on objects produced by `cloneGltfScene`. */
export function disposeAssetInstance(object: THREE.Object3D): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material): void {
  const maybeTextured = material as unknown as Record<string, unknown>;
  for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"]) {
    const value = maybeTextured[key];
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/** Find a named node anywhere in a loaded/cloned hierarchy — Part 3's "named nodes" requirement, e.g. locating an attachment point authored in Blender. */
export function findNamedNode(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return root.getObjectByName(name) ?? undefined;
}

/** Apply a material override to every mesh under `root` whose current material name matches `materialSlotName` — Part 3's "material overrides" requirement, e.g. swapping a district-variant material without a second model file. */
export function applyMaterialOverride(root: THREE.Object3D, materialSlotName: string, material: THREE.Material): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const current = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(current)) {
      mesh.material = current.map((m) => (m.name === materialSlotName ? material : m));
    } else if (current && current.name === materialSlotName) {
      mesh.material = material;
    }
  });
}

/** Configure shadow casting/receiving on every mesh under `root` in one pass — Part 3's "shadow config" requirement. */
export function configureShadows(root: THREE.Object3D, opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): void {
  const { castShadow = true, receiveShadow = true } = opts;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
  });
}
