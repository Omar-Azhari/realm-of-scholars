/**
 * Public barrel for the V2 asset pipeline (V2 Phase 2, Parts 2-3). Scene
 * code should import from here, not from `assetLoaderCore.ts`/
 * `assetManifest.ts` directly — this file is the stable surface; the
 * internals are free to change behind it.
 */

import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGltfAsset, preloadGltfAsset } from "./assetLoaderCore";
import { getAssetDefinition } from "./assetManifest";

/** Imperative async load, matching the brief's named `loadAsset()` entry point. Throws for procedural/missing entries — those must be handled via `useGameAsset()`'s status field instead, since they have no file to load. */
export async function loadAsset(assetId: string): Promise<GLTF> {
  const def = getAssetDefinition(assetId);
  if (!def) throw new Error(`loadAsset: no manifest entry for "${assetId}"`);
  if (def.format === "procedural" || !def.filePath) {
    throw new Error(`loadAsset: "${assetId}" has no loadable file (status: ${def.status}) — use useGameAsset()'s status field to detect and render its procedural fallback instead.`);
  }
  return loadGltfAsset(def);
}

/** Imperative preload, matching the brief's named `preloadAsset()` entry point. No-ops silently for procedural/missing entries — nothing to warm. */
export function preloadAsset(assetId: string): void {
  const def = getAssetDefinition(assetId);
  if (!def || def.format === "procedural" || !def.filePath) return;
  preloadGltfAsset(def);
}

export { getAssetDefinition, getAudioDefinition, listAssets, listAssetsByCategory, listAssetsByDistrict, listAssetsByStatus, ASSET_MANIFEST } from "./assetManifest";
export { disposeAssetInstance, cloneGltfScene, clearAssetCache, configureKtx2Support, findNamedNode, applyMaterialOverride, configureShadows } from "./assetLoaderCore";
export { useGameAsset } from "./useGameAsset";
export type { GameAssetResult, GameAssetStatus } from "./useGameAsset";
export { useAnimatedCharacter } from "./useAnimatedCharacter";
export type { AnimatedCharacterResult } from "./useAnimatedCharacter";
export { v2AssetUrl } from "./assetUrl";
export { MATERIAL_LIBRARY, TEXTURE_RESOLUTION_TIERS, resolveMaterial, listMaterialIds, isFallbackMaterial } from "./materials";
export type { MaterialId, MaterialDefinition, MaterialMapSlots, TextureResolutionTier } from "./materials";
export { MODULAR_GRID, MODULAR_KIT, getModularPieceSpec, listModularPieceTypes } from "./modularKit";
export type { ModularKitPieceType, ModularKitPieceSpec, PivotRule } from "./modularKit";
export type {
  AssetCategory,
  AssetStatus,
  AssetFormat,
  CollisionSource,
  LodVariant,
  TextureVariant,
  AssetSourceInfo,
  AssetDefinition,
  AudioAssetDefinition,
  AssetManifest,
} from "./assetManifestTypes";
