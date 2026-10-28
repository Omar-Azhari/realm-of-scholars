/**
 * The V2 asset manifest — the single source of truth for every visual and
 * audio asset the `prestige-v2` renderer can place (V2 Phase 2, Part 2).
 * Scene code must look assets up by ID through `assetLoader.tsx`'s hooks,
 * never import a component or file path directly for anything registered
 * here (Implementation Rule #6).
 *
 * Every entry below is honestly `status: "procedural"` — see
 * `docs/V2_PHASE2_ASSET_AUDIT.md`. Each `proceduralComponent` name is a
 * REAL, existing export from `src/game3d/prestige/architecture/
 * ArchitectureKit.tsx` (or the other files noted per-entry), confirmed by
 * re-reading those files during the Phase 2 audit. This registry does not
 * add any new visual behaviour — it is a faithful, typed map of what
 * already renders, so the loader pipeline (Part 3) and validation tooling
 * (Part 8) have real data to operate on from day one.
 *
 * Triangle estimates use the same derived-from-geometry-constructor-args
 * methodology as the audit (BoxGeometry=12, CylinderGeometry(r,r,h,seg)
 * ≈ seg*2 + 2*(seg-2), etc.) — labelled estimates, not profiler
 * measurements.
 */

import type { AssetDefinition, AssetManifest, AudioAssetDefinition } from "./assetManifestTypes";

const DATE_ADDED = "2026-07-29";

function arch(def: Omit<AssetDefinition, "category" | "dateAdded" | "dateModified" | "format" | "status" | "replacementStatus" | "version"> & Partial<Pick<AssetDefinition, "format" | "status" | "replacementStatus" | "version">>): AssetDefinition {
  return {
    category: "architecture",
    format: "procedural",
    status: "procedural",
    replacementStatus: "planned-replacement",
    version: "0.1.0",
    dateAdded: DATE_ADDED,
    dateModified: DATE_ADDED,
    ...def,
  };
}

function prop(def: Omit<AssetDefinition, "category" | "dateAdded" | "dateModified" | "format" | "status" | "replacementStatus" | "version"> & Partial<Pick<AssetDefinition, "format" | "status" | "replacementStatus" | "version">>): AssetDefinition {
  return {
    category: "prop",
    format: "procedural",
    status: "procedural",
    replacementStatus: "planned-replacement",
    version: "0.1.0",
    dateAdded: DATE_ADDED,
    dateModified: DATE_ADDED,
    ...def,
  };
}

function character(def: Omit<AssetDefinition, "category" | "dateAdded" | "dateModified" | "format" | "status" | "replacementStatus" | "version"> & Partial<Pick<AssetDefinition, "format" | "status" | "replacementStatus" | "version">>): AssetDefinition {
  return {
    category: "character",
    format: "procedural",
    status: "procedural",
    replacementStatus: "planned-replacement",
    version: "0.1.0",
    dateAdded: DATE_ADDED,
    dateModified: DATE_ADDED,
    ...def,
  };
}

const ASSETS: Record<string, AssetDefinition> = {
  "arch-stone-column": arch({
    id: "arch-stone-column",
    displayName: "Stone column",
    intendedUse: "Load-bearing colonnade column, Gothic base/shaft/capital",
    districtOwnership: ["prestige-main-gate", "prestige-grand-courtyard", "prestige-great-hall"],
    collisionSource: "none",
    proceduralComponent: "StoneColumn (ArchitectureKit.tsx)",
    triangleEstimate: 120,
    preloadPriority: 1,
  }),
  "arch-pointed-arch": arch({
    id: "arch-pointed-arch",
    displayName: "Pointed Gothic arch",
    intendedUse: "Main Gate entry archway silhouette",
    districtOwnership: ["prestige-main-gate"],
    collisionSource: "none",
    proceduralComponent: "PointedArch (ArchitectureKit.tsx)",
    triangleEstimate: 60,
    preloadPriority: 1,
  }),
  "arch-vaulted-ceiling-bay": arch({
    id: "arch-vaulted-ceiling-bay",
    displayName: "Vaulted ceiling bay",
    intendedUse: "Repeated ribbed-vault ceiling segment along the Great Hall nave",
    districtOwnership: ["prestige-great-hall"],
    collisionSource: "none",
    proceduralComponent: "VaultedCeilingBay (ArchitectureKit.tsx)",
    triangleEstimate: 36,
    preloadPriority: 3,
  }),
  "arch-stained-glass-window": arch({
    id: "arch-stained-glass-window",
    displayName: "Stained-glass window",
    intendedUse: "Wall-mounted coloured window with mullion bars",
    districtOwnership: ["prestige-great-hall", "prestige-hall-of-artisans", "prestige-dorm-preview"],
    collisionSource: "none",
    proceduralComponent: "StainedGlassWindow (ArchitectureKit.tsx)",
    triangleEstimate: 90,
    preloadPriority: 2,
  }),
  "arch-coming-soon-gate": arch({
    id: "arch-coming-soon-gate",
    displayName: "Locked district gate",
    intendedUse: "Blocks travel into a not-yet-built district, shows a 'Coming Soon' interaction",
    districtOwnership: ["prestige-grand-courtyard", "prestige-great-hall"],
    collisionSource: "primitive",
    proceduralComponent: "ComingSoonGate (ArchitectureKit.tsx)",
    triangleEstimate: 180,
    preloadPriority: 2,
  }),
  "arch-grand-door": arch({
    id: "arch-grand-door",
    displayName: "Grand double door",
    intendedUse: "Decorative visual for a real, walkable district transition (the actual interaction hitbox is separate)",
    districtOwnership: ["prestige-grand-courtyard"],
    collisionSource: "none",
    animationDependencies: ["door-open (not yet implemented — currently static)"],
    proceduralComponent: "GrandDoor (ArchitectureKit.tsx)",
    triangleEstimate: 36,
    preloadPriority: 1,
  }),
  "arch-gate-tower": arch({
    id: "arch-gate-tower",
    displayName: "Gatehouse tower",
    intendedUse: "Flanking towers either side of the Main Gate archway",
    districtOwnership: ["prestige-main-gate"],
    collisionSource: "primitive",
    proceduralComponent: "GateTower (scenes/MainGateScene.tsx, scene-local)",
    triangleEstimate: 60,
    preloadPriority: 1,
  }),
  "arch-floor-slab": arch({
    id: "arch-floor-slab",
    displayName: "District floor slab",
    intendedUse: "Base ground plane per district — currently one flat colour per scene, no texture",
    districtOwnership: ["prestige-main-gate", "prestige-grand-courtyard", "prestige-great-hall", "prestige-hall-of-artisans", "prestige-dorm-preview"],
    collisionSource: "none",
    proceduralComponent: "inline <planeGeometry> (PrestigeSceneShell.tsx)",
    triangleEstimate: 2,
    preloadPriority: 0,
  }),

  "prop-fireplace": prop({
    id: "prop-fireplace",
    displayName: "Stone fireplace",
    intendedUse: "Hero warmth/light prop with an animated flicker glow",
    districtOwnership: ["prestige-great-hall", "prestige-dorm-preview"],
    collisionSource: "none",
    proceduralComponent: "Fireplace (ArchitectureKit.tsx)",
    triangleEstimate: 140,
    preloadPriority: 1,
  }),
  "prop-banner": prop({
    id: "prop-banner",
    displayName: "Hanging banner",
    intendedUse: "Idle-swaying heraldic cloth banner, flat colour, no emblem yet",
    districtOwnership: ["prestige-main-gate", "prestige-grand-courtyard", "prestige-great-hall", "prestige-hall-of-artisans"],
    collisionSource: "none",
    proceduralComponent: "Banner (ArchitectureKit.tsx)",
    triangleEstimate: 20,
    preloadPriority: 2,
  }),
  "prop-statue-figure": prop({
    id: "prop-statue-figure",
    displayName: "Statue figure",
    intendedUse: "Abstract cone/sphere figure standing in for a sculpted statue",
    districtOwnership: ["prestige-grand-courtyard", "prestige-great-hall"],
    collisionSource: "none",
    proceduralComponent: "StatueFigure (ArchitectureKit.tsx)",
    triangleEstimate: 330,
    preloadPriority: 2,
  }),
  "prop-fountain": prop({
    id: "prop-fountain",
    displayName: "Courtyard fountain",
    intendedUse: "Grand Courtyard centrepiece with a pulsing emissive water disc",
    districtOwnership: ["prestige-grand-courtyard"],
    collisionSource: "primitive",
    proceduralComponent: "Fountain (ArchitectureKit.tsx)",
    triangleEstimate: 200,
    preloadPriority: 1,
  }),
  "prop-torch-sconce": prop({
    id: "prop-torch-sconce",
    displayName: "Wall torch sconce",
    intendedUse: "Wall-mounted iron torch fixture with a point light",
    districtOwnership: ["prestige-main-gate", "prestige-grand-courtyard", "prestige-great-hall"],
    collisionSource: "none",
    proceduralComponent: "TorchSconce (ArchitectureKit.tsx)",
    triangleEstimate: 22,
    preloadPriority: 2,
  }),
  "prop-candle-cluster": prop({
    id: "prop-candle-cluster",
    displayName: "Candle cluster",
    intendedUse: "Tabletop candle group with a flicker light",
    districtOwnership: ["prestige-great-hall", "prestige-dorm-preview"],
    collisionSource: "none",
    proceduralComponent: "CandleCluster (ArchitectureKit.tsx)",
    triangleEstimate: 90,
    preloadPriority: 3,
  }),
  "prop-long-table": prop({
    id: "prop-long-table",
    displayName: "Long refectory table",
    intendedUse: "Great Hall dining table with attached bench seating",
    districtOwnership: ["prestige-great-hall"],
    collisionSource: "primitive",
    proceduralComponent: "LongTable (ArchitectureKit.tsx)",
    triangleEstimate: 350,
    preloadPriority: 1,
  }),
  "prop-easel": prop({
    id: "prop-easel",
    displayName: "Artist's easel",
    intendedUse: "Hall of Artisans workshop dressing",
    districtOwnership: ["prestige-hall-of-artisans"],
    collisionSource: "none",
    proceduralComponent: "Easel (ArchitectureKit.tsx)",
    triangleEstimate: 50,
    preloadPriority: 2,
  }),
  "prop-drafting-table": prop({
    id: "prop-drafting-table",
    displayName: "Drafting table",
    intendedUse: "Hall of Artisans workshop dressing, angled tabletop",
    districtOwnership: ["prestige-hall-of-artisans"],
    collisionSource: "primitive",
    proceduralComponent: "DraftingTable (ArchitectureKit.tsx)",
    triangleEstimate: 200,
    preloadPriority: 2,
  }),
  "prop-design-board": prop({
    id: "prop-design-board",
    displayName: "Design board",
    intendedUse: "Corkboard with pinned swatches, Hall of Artisans dressing",
    districtOwnership: ["prestige-hall-of-artisans"],
    collisionSource: "none",
    proceduralComponent: "DesignBoard (scenes/HallOfArtisansScene.tsx, scene-local)",
    triangleEstimate: 30,
    preloadPriority: 3,
  }),
  "prop-maquette": prop({
    id: "prop-maquette",
    displayName: "Sculptural maquette",
    intendedUse: "Small abstract model prop, explicitly a stand-in shape",
    districtOwnership: ["prestige-hall-of-artisans"],
    collisionSource: "none",
    proceduralComponent: "Maquette (scenes/HallOfArtisansScene.tsx, scene-local)",
    triangleEstimate: 24,
    preloadPriority: 3,
  }),
  "prop-study-desk-basic": prop({
    id: "prop-study-desk-basic",
    displayName: "Basic study desk",
    intendedUse: "A single untextured box standing in for a desk — the single lowest-quality prop in the renderer",
    districtOwnership: ["prestige-hall-of-artisans"],
    collisionSource: "primitive",
    proceduralComponent: "inline <boxGeometry> (scenes/HallOfArtisansScene.tsx)",
    triangleEstimate: 12,
    preloadPriority: 3,
  }),
  "prop-dorm-bed": prop({
    id: "prop-dorm-bed",
    displayName: "Dormitory bed",
    intendedUse: "Dormitory preview room furniture",
    districtOwnership: ["prestige-dorm-preview"],
    collisionSource: "primitive",
    proceduralComponent: "DormBed (scenes/DormPreviewScene.tsx, scene-local)",
    triangleEstimate: 600,
    preloadPriority: 2,
  }),
  "prop-dorm-desk": prop({
    id: "prop-dorm-desk",
    displayName: "Dormitory desk",
    intendedUse: "Dormitory preview room furniture",
    districtOwnership: ["prestige-dorm-preview"],
    collisionSource: "primitive",
    proceduralComponent: "DormDesk (scenes/DormPreviewScene.tsx, scene-local)",
    triangleEstimate: 200,
    preloadPriority: 3,
  }),
  "prop-bookshelf": prop({
    id: "prop-bookshelf",
    displayName: "Bookshelf",
    intendedUse: "Shelving with individually coloured book spines, reused from the room-customisation furniture set",
    districtOwnership: ["prestige-hall-of-artisans", "prestige-dorm-preview"],
    collisionSource: "primitive",
    proceduralComponent: "Bookshelf (src/game3d/rooms/furniturePieces.tsx, reused)",
    triangleEstimate: 220,
    preloadPriority: 2,
  }),
  "prop-pot-plant": prop({
    id: "prop-pot-plant",
    displayName: "Potted plant",
    intendedUse: "Decorative greenery, reused from the room-customisation furniture set",
    districtOwnership: ["prestige-hall-of-artisans", "prestige-dorm-preview"],
    collisionSource: "none",
    proceduralComponent: "PotPlant (src/game3d/rooms/furniturePieces.tsx, reused)",
    triangleEstimate: 50,
    preloadPriority: 3,
  }),
  "prop-rug": prop({
    id: "prop-rug",
    displayName: "Floor rug",
    intendedUse: "Flat decorative floor covering, reused from the room-customisation furniture set",
    districtOwnership: ["prestige-dorm-preview"],
    collisionSource: "none",
    proceduralComponent: "Rug (src/game3d/rooms/furniturePieces.tsx, reused)",
    triangleEstimate: 4,
    preloadPriority: 3,
  }),

  "character-player-modular": character({
    id: "character-player-modular",
    displayName: "Player character (modular/procedural)",
    intendedUse: "Player avatar — layered procedural clothing/hair from the appearance catalogue",
    districtOwnership: ["prestige-main-gate", "prestige-grand-courtyard", "prestige-great-hall", "prestige-hall-of-artisans", "prestige-dorm-preview"],
    collisionSource: "none",
    animationDependencies: ["procedural pose blender (characterRig.ts) — not clip-based, see Part 15 readiness doc"],
    proceduralComponent: "ModularCharacter (src/game3d/characters/, reused verbatim from experimental-3d)",
    triangleEstimate: 550,
    preloadPriority: 0,
  }),
  "character-npc-modular": character({
    id: "character-npc-modular",
    displayName: "NPC character (modular/procedural)",
    intendedUse: "All 12 NPCs across the 5 Prestige scenes share this same rendering path",
    districtOwnership: ["prestige-main-gate", "prestige-grand-courtyard", "prestige-great-hall", "prestige-hall-of-artisans", "prestige-dorm-preview"],
    collisionSource: "none",
    animationDependencies: ["procedural pose blender (characterRig.ts) — not clip-based, see Part 15 readiness doc"],
    proceduralComponent: "NpcCharacter (src/game3d/characters/, reused verbatim from experimental-3d)",
    triangleEstimate: 550,
    preloadPriority: 0,
  }),
};

const AUDIO: Record<string, AudioAssetDefinition> = {
  "audio-main-gate-wind": {
    id: "audio-main-gate-wind",
    displayName: "Main Gate wind ambience",
    category: "ambience",
    district: "prestige-main-gate",
    loop: true,
    volumeRange: [0.15, 0.35],
    spatial: false,
    soundEvent: "main-gate-wind",
    status: "missing",
  },
  "audio-courtyard-fountain": {
    id: "audio-courtyard-fountain",
    displayName: "Grand Courtyard fountain ambience",
    category: "ambience",
    district: "prestige-grand-courtyard",
    loop: true,
    volumeRange: [0.15, 0.35],
    spatial: true,
    soundEvent: "courtyard-fountain",
    status: "missing",
  },
  "audio-great-hall-ambience": {
    id: "audio-great-hall-ambience",
    displayName: "Great Hall ambience",
    category: "ambience",
    district: "prestige-great-hall",
    loop: true,
    volumeRange: [0.1, 0.3],
    spatial: false,
    soundEvent: "great-hall-ambience",
    status: "missing",
  },
  "audio-artisans-workshop-ambience": {
    id: "audio-artisans-workshop-ambience",
    displayName: "Hall of Artisans workshop ambience",
    category: "ambience",
    district: "prestige-hall-of-artisans",
    loop: true,
    volumeRange: [0.1, 0.3],
    spatial: false,
    soundEvent: "artisans-workshop-ambience",
    status: "missing",
  },
  "audio-fireplace-crackle": {
    id: "audio-fireplace-crackle",
    displayName: "Fireplace crackle",
    category: "ambience",
    district: undefined,
    loop: true,
    volumeRange: [0.2, 0.4],
    spatial: true,
    soundEvent: "fireplace-crackle",
    status: "missing",
  },
  "audio-bell-toll": {
    id: "audio-bell-toll",
    displayName: "Bell toll",
    category: "sfx",
    district: undefined,
    loop: false,
    volumeRange: [0.4, 0.6],
    spatial: false,
    soundEvent: "bell-toll",
    status: "missing",
  },
  "audio-door-open": {
    id: "audio-door-open",
    displayName: "Door open",
    category: "sfx",
    district: undefined,
    loop: false,
    volumeRange: [0.3, 0.5],
    spatial: false,
    soundEvent: "door-open",
    status: "missing",
  },
};

export const ASSET_MANIFEST: AssetManifest = {
  version: "2.0.0",
  assets: ASSETS,
  audio: AUDIO,
};

export function getAssetDefinition(id: string): AssetDefinition | undefined {
  return ASSET_MANIFEST.assets[id];
}

export function getAudioDefinition(id: string): AudioAssetDefinition | undefined {
  return ASSET_MANIFEST.audio[id];
}

export function listAssets(): AssetDefinition[] {
  return Object.values(ASSET_MANIFEST.assets);
}

export function listAssetsByDistrict(districtId: string): AssetDefinition[] {
  return listAssets().filter((a) => a.districtOwnership.includes(districtId));
}

export function listAssetsByStatus(status: AssetDefinition["status"]): AssetDefinition[] {
  return listAssets().filter((a) => a.status === status);
}

export function listAssetsByCategory(category: AssetDefinition["category"]): AssetDefinition[] {
  return listAssets().filter((a) => a.category === category);
}
