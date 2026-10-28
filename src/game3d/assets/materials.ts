/**
 * V2 material system (V2 Phase 2, Part 6) — the typed registry every
 * architecture/prop asset's `materialDependencies` (see
 * `assetManifestTypes.ts`) resolves against. Mirrors the Art Bible's
 * material list (`docs/UNIGAME_V2_MASTER_DESIGN.md`) as data instead of
 * ad-hoc hex strings scattered across scene files.
 *
 * As of V2 Phase 2, **no PBR texture set exists for any material** (see
 * `docs/V2_PHASE2_ASSET_AUDIT.md`) — every `resolveMaterial()` call
 * returns a flat-colour procedural fallback. Per Implementation Rule #8
 * ("procedural visuals are fallback or prototype assets, not final art")
 * and the brief's own instruction that fallbacks be "VISIBLY MARKED as
 * fallback in dev tooling," every material this module produces carries
 * `userData.isFallback = true` until real texture maps are registered —
 * never silently presented as finished PBR art.
 */

import * as THREE from "three";

export type MaterialId =
  | "limestone"
  | "weathered-stone"
  | "dark-granite"
  | "carved-stone"
  | "aged-oak"
  | "polished-oak"
  | "dark-walnut"
  | "wrought-iron"
  | "aged-brass"
  | "bronze"
  | "leaded-glass"
  | "stained-glass"
  | "plaster"
  | "parchment"
  | "leather"
  | "linen"
  | "velvet"
  | "wool"
  | "ceramic"
  | "roof-tile"
  | "cobblestone"
  | "soil"
  | "grass";

/** File paths, relative to `public/assets/v2/textures/materials/<id>/`, for each PBR map slot — all `undefined` until real textures are authored (Part 7 texture policy). */
export interface MaterialMapSlots {
  albedo?: string;
  normal?: string;
  roughness?: string;
  metalness?: string;
  ao?: string;
  emissive?: string;
  opacity?: string;
}

export interface MaterialDefinition {
  id: MaterialId;
  label: string;
  maps: MaterialMapSlots;
  /** UV repeat for tiling surfaces (walls, floors) — [u, v]. Non-tiling materials (statues, single props) use [1, 1]. */
  tiling: [number, number];
  /** Whether this material supports a randomised per-instance colour/albedo tint (e.g. slightly varied stone blocks). Declared here; not yet implemented in the resolver (see Known Gaps below). */
  supportsColourVariation: boolean;
  /** Whether a weathering/grime overlay variant is planned for this material. Declared, not yet implemented. */
  supportsWeathering: boolean;
  /** Per-district colour/tint overrides (e.g. a warmer stone tone in the Great Hall vs. a cooler one at the Main Gate). Empty until districts request one. */
  districtVariants: Partial<Record<string, string>>;
  /** Flat-colour procedural fallback, used whenever no texture set is registered (the current state for every material). */
  fallback: {
    colorHex: string;
    roughness: number;
    metalness: number;
    emissiveHex?: string;
    opacity?: number;
    transparent?: boolean;
  };
}

export const MATERIAL_LIBRARY: Record<MaterialId, MaterialDefinition> = {
  limestone: {
    id: "limestone",
    label: "Limestone",
    maps: {},
    tiling: [2, 2],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#8d8578", roughness: 0.92, metalness: 0 },
  },
  "weathered-stone": {
    id: "weathered-stone",
    label: "Weathered stone",
    maps: {},
    tiling: [2, 2],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#5f594e", roughness: 0.97, metalness: 0 },
  },
  "dark-granite": {
    id: "dark-granite",
    label: "Dark granite",
    maps: {},
    tiling: [2, 2],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#3a3733", roughness: 0.8, metalness: 0.05 },
  },
  "carved-stone": {
    id: "carved-stone",
    label: "Carved stone (ornamental)",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#a89f8d", roughness: 0.9, metalness: 0 },
  },
  "aged-oak": {
    id: "aged-oak",
    label: "Aged oak",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#5a3e28", roughness: 0.85, metalness: 0 },
  },
  "polished-oak": {
    id: "polished-oak",
    label: "Polished oak",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#7a5636", roughness: 0.45, metalness: 0 },
  },
  "dark-walnut": {
    id: "dark-walnut",
    label: "Dark walnut",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#3c2818", roughness: 0.6, metalness: 0 },
  },
  "wrought-iron": {
    id: "wrought-iron",
    label: "Wrought iron",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#2b2a28", roughness: 0.55, metalness: 0.4 },
  },
  "aged-brass": {
    id: "aged-brass",
    label: "Aged brass",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#af8a4a", roughness: 0.4, metalness: 0.6 },
  },
  bronze: {
    id: "bronze",
    label: "Bronze",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#7c5a35", roughness: 0.45, metalness: 0.65 },
  },
  "leaded-glass": {
    id: "leaded-glass",
    label: "Leaded glass",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#cfe0e6", roughness: 0.15, metalness: 0, opacity: 0.55, transparent: true },
  },
  "stained-glass": {
    id: "stained-glass",
    label: "Stained glass",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#7c4dff", roughness: 0.2, metalness: 0, emissiveHex: "#7c4dff", opacity: 0.75, transparent: true },
  },
  plaster: {
    id: "plaster",
    label: "Plaster",
    maps: {},
    tiling: [2, 2],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#ddd3bf", roughness: 0.95, metalness: 0 },
  },
  parchment: {
    id: "parchment",
    label: "Parchment",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#e8ddc1", roughness: 0.9, metalness: 0 },
  },
  leather: {
    id: "leather",
    label: "Leather",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#5c3a24", roughness: 0.7, metalness: 0 },
  },
  linen: {
    id: "linen",
    label: "Linen",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#cfc4a8", roughness: 0.85, metalness: 0 },
  },
  velvet: {
    id: "velvet",
    label: "Velvet",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#5a1f2e", roughness: 0.75, metalness: 0 },
  },
  wool: {
    id: "wool",
    label: "Wool",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#8a7a63", roughness: 0.95, metalness: 0 },
  },
  ceramic: {
    id: "ceramic",
    label: "Ceramic",
    maps: {},
    tiling: [1, 1],
    supportsColourVariation: false,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#e4ded2", roughness: 0.35, metalness: 0 },
  },
  "roof-tile": {
    id: "roof-tile",
    label: "Roof tile",
    maps: {},
    tiling: [4, 4],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#7a3b2e", roughness: 0.85, metalness: 0 },
  },
  cobblestone: {
    id: "cobblestone",
    label: "Cobblestone",
    maps: {},
    tiling: [6, 6],
    supportsColourVariation: true,
    supportsWeathering: true,
    districtVariants: {},
    fallback: { colorHex: "#6b675e", roughness: 0.95, metalness: 0 },
  },
  soil: {
    id: "soil",
    label: "Soil",
    maps: {},
    tiling: [4, 4],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#4a3826", roughness: 1, metalness: 0 },
  },
  grass: {
    id: "grass",
    label: "Grass",
    maps: {},
    tiling: [8, 8],
    supportsColourVariation: true,
    supportsWeathering: false,
    districtVariants: {},
    fallback: { colorHex: "#4c6b3a", roughness: 1, metalness: 0 },
  },
};

/** Resolution tiers (Part 7 texture policy) — enforced by the validation tool (Part 8), not just documented. */
export const TEXTURE_RESOLUTION_TIERS = {
  hero: { minPx: 2048, maxPx: 4096 },
  standardArchitecture: { minPx: 1024, maxPx: 2048 },
  smallProp: { minPx: 512, maxPx: 1024 },
  background: { minPx: 256, maxPx: 1024 },
} as const;

export type TextureResolutionTier = keyof typeof TEXTURE_RESOLUTION_TIERS;

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Builds (and caches) the material for a given ID. Every returned
 * material is currently a fallback — `userData.isFallback` and
 * `userData.fallbackReason` are always set until a real map is wired
 * in below. The dev asset inspector (Part 8) reads these two fields
 * directly to render its "FALLBACK" badge; production-mode validation
 * (Part 8) reads the same field to decide whether an asset can be
 * marked `status: "production"`.
 */
export function resolveMaterial(id: MaterialId): THREE.MeshStandardMaterial {
  const cached = materialCache.get(id);
  if (cached) return cached;

  const def = MATERIAL_LIBRARY[id];
  const hasAnyMap = Object.values(def.maps).some(Boolean);

  const material = new THREE.MeshStandardMaterial({
    color: def.fallback.colorHex,
    roughness: def.fallback.roughness,
    metalness: def.fallback.metalness,
    transparent: def.fallback.transparent ?? false,
    opacity: def.fallback.opacity ?? 1,
    name: id,
  });
  if (def.fallback.emissiveHex) {
    material.emissive = new THREE.Color(def.fallback.emissiveHex);
  }

  // No material in this library has real texture maps yet (V2 Phase 2)
  // — see docs/V2_PHASE2_ASSET_AUDIT.md. `hasAnyMap` will start
  // resolving real THREE.TextureLoader loads here once Part 7's texture
  // pipeline lands actual files; the branch already exists so adding a
  // real material later is a data change (fill in `maps`), not a code
  // change to this resolver.
  material.userData.isFallback = !hasAnyMap;
  material.userData.fallbackReason = hasAnyMap ? undefined : "no PBR texture set authored yet — flat procedural colour";

  materialCache.set(id, material);
  return material;
}

export function listMaterialIds(): MaterialId[] {
  return Object.keys(MATERIAL_LIBRARY) as MaterialId[];
}

export function isFallbackMaterial(material: THREE.Material): boolean {
  return material.userData?.isFallback === true;
}
