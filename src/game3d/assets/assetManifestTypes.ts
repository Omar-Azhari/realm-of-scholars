/**
 * V2 asset-manifest schema (V2 Phase 2, Part 2) — the 3D counterpart to
 * `src/engine/manifestTypes.ts`. Same governing philosophy as the legacy 2D
 * manifest: the manifest is the source of truth, scene code never
 * hardcodes a raw model/texture/audio path, and "replacing artwork never
 * requires an application code change." See `public/assets/v2/README.md`
 * for the on-disk layout these entries describe.
 *
 * As of V2 Phase 2, every entry in the registry
 * (`src/game3d/assets/assetManifest.ts`) is `status: "procedural"` or
 * `"placeholder"` — see `docs/V2_PHASE2_ASSET_AUDIT.md`. This schema is
 * deliberately built to hold real production entries once real art exists;
 * it does not itself claim any exist yet (Implementation Rule #16).
 */

/** Broad taxonomy an asset falls under — drives which manifest section/dev-inspector filter it appears in. */
export type AssetCategory =
  | "architecture" // walls, columns, arches, doors, windows, roofs, stairs, ceilings
  | "prop" // furniture, fixtures, statues, banners, decorations
  | "character" // rigged humanoid base meshes, mentor-specific heads
  | "clothing" // interchangeable wardrobe pieces
  | "material" // PBR texture sets (not a mesh — see AudioAssetDefinition for sound)
  | "ui"; // manuscript/leather UI frame textures, icons

/**
 * Where a given asset currently stands. `production`/`temporary` require a
 * real file on disk (`format !== "procedural"`); `procedural` and
 * `placeholder` are honest, disclosed stand-ins (Rules #8/#14/#16).
 */
export type AssetStatus =
  | "production" // final art, licence-clear, ready to ship
  | "temporary" // an approved stand-in asset, not final, but real (a sourced/placeholder .glb)
  | "procedural" // no file — rendered by a registered procedural fallback component
  | "placeholder" // a real file exists but is explicitly a stopgap (e.g. Phase 2's pipeline-proof .glb samples)
  | "missing"; // known-required, not yet produced in any form — surfaced by validation, never silently hidden in production

export type AssetFormat = "glb" | "gltf" | "texture" | "procedural";

/** How a given asset's collision should be derived — never high-poly visual mesh by default (Rule #13). */
export type CollisionSource =
  | "authored" // a dedicated low-poly collision mesh ships alongside the visual model
  | "primitive" // a simple box/cylinder/capsule approximation, declared in the manifest or placement
  | "simplified-generated" // auto-simplified from the visual mesh at load time (last resort, not default)
  | "interaction-only" // no physical blocking; only used for an interactable's proximity range
  | "none"; // genuinely no collision (background/decorative-only asset)

/** A single detail tier for distance-based LOD swapping (Part 14). */
export interface LodVariant {
  /** Camera distance (metres) beyond which this variant becomes active. 0 = the closest/highest-detail tier. */
  minDistanceM: number;
  filePath: string;
  /** Estimated triangle count for this tier, for budget accounting (Part 19). */
  triangleEstimate: number;
}

/** An alternate texture/material dressing for the same mesh (e.g. a weathered vs. clean stone variant). */
export interface TextureVariant {
  id: string;
  label: string;
  materialId: string;
}

export interface AssetSourceInfo {
  /** Human-readable origin — "self-authored", "commissioned", or a source name/URL. */
  attribution: string;
  licence?: string;
  author?: string;
}

/**
 * The core registry entry. Every field the Phase 2 brief lists by name is
 * present, even where the honest current value is `undefined`/empty — the
 * absence itself is meaningful audit information, not an omission.
 */
export interface AssetDefinition {
  /** Unique, stable manifest key. Convention: `<category-prefix>-<kebab-name>` (see assetManifest.ts). */
  id: string;
  displayName: string;
  category: AssetCategory;
  /** Relative to `public/assets/v2/` — undefined when `format === "procedural"`. */
  filePath?: string;
  format: AssetFormat;
  /** Semantic version of THIS asset file, bumped whenever the file is replaced — drives loader cache invalidation. */
  version: string;
  status: AssetStatus;
  /** One-line description of what this asset is used for in-scene. */
  intendedUse: string;
  /** Which district(s)/scene(s) currently place this asset. Empty = defined but not yet placed anywhere. */
  districtOwnership: string[];
  /** Material IDs (from the material system, Part 6) this asset's surfaces depend on. */
  materialDependencies?: string[];
  /** Animation clip IDs this asset depends on (characters/animated props only). */
  animationDependencies?: string[];
  collisionSource: CollisionSource;
  lodVariants?: LodVariant[];
  textureVariants?: TextureVariant[];
  source?: AssetSourceInfo;
  dateAdded: string;
  dateModified: string;
  /** Whether this entry is expected to be swapped for something else, and to what. */
  replacementStatus: "final" | "planned-replacement" | "no-replacement-planned";
  /** Asset ID to render instead if this one fails to load or is absent (e.g. a procedural stand-in for a `temporary` .glb). */
  fallbackAssetId?: string;
  /** Rough estimated runtime memory footprint in KB (geometry + textures), for budget accounting — an estimate, not a measurement, until Part 19 instrumentation lands. */
  memoryEstimateKb?: number;
  /** Relative preload ordering — lower loads earlier. Undefined = load on demand only. */
  preloadPriority?: number;
  /** Estimated triangle count for the base (LOD0) representation — see the audit's documented estimate methodology. */
  triangleEstimate?: number;
  /**
   * For `status: "procedural"` entries only: the name of the
   * ArchitectureKit/scene-local component that renders this asset today,
   * so the manifest stays an accurate map of "what actually draws this"
   * even before any real file exists.
   */
  proceduralComponent?: string;
}

/** Audio manifest entry — kept separate from `AssetDefinition` per Part 16 since audio has no mesh/material/LOD concepts. */
export interface AudioAssetDefinition {
  id: string;
  displayName: string;
  /** Relative to `public/assets/v2/audio/` — undefined while no file exists (current state for all entries, Phase 2). */
  filePath?: string;
  category: "ambience" | "sfx" | "music";
  district?: string;
  loop: boolean;
  /** [min, max] playback volume, 0-1. */
  volumeRange: [number, number];
  spatial: boolean;
  preloadPriority?: number;
  source?: AssetSourceInfo;
  /** Duration in seconds — undefined until a real file exists. */
  durationSeconds?: number;
  /** Existing `SoundEvent` name (src/lib/sound.ts) this manifest entry documents, if any — see Part 16. */
  soundEvent?: string;
  status: AssetStatus;
}

export interface AssetManifest {
  version: string;
  assets: Record<string, AssetDefinition>;
  audio: Record<string, AudioAssetDefinition>;
}
