/**
 * Modular architecture kit spec (V2 Phase 2, Part 5) — a typed
 * description of the standard building-block pieces (walls, columns,
 * arches, doors, windows, stairs, vaults, roofs) any district, current or
 * future, assembles from. This is a SPEC, not a remodel: per
 * Implementation Rule #2 ("do not build new districts") and the brief's
 * own instruction, this proves the system against the existing 5 scenes'
 * needs — it does not retrofit them. Where an existing
 * `ArchitectureKit.tsx` component already fulfils a piece type
 * procedurally, that's recorded in `currentImplementation` so the spec
 * stays an honest map of "what exists today" alongside "what the kit
 * will look like once real modular meshes replace it."
 *
 * Dimensions/grid match `docs/V2_BLENDER_EXPORT_GUIDE.md` §9 exactly —
 * that document is the artist-facing mirror of this file; the two must
 * not drift apart.
 */

import type { CollisionSource } from "./assetManifestTypes";
import type { MaterialId } from "./materials";

export const MODULAR_GRID = {
  /** Base module width — every wall/floor span is a multiple of this. */
  moduleWidthM: 2,
  /** Storey height — matches the standard ceiling height used across Great Hall/Hall of Artisans. */
  storeyHeightM: 4,
  doorwayWidthM: 1.2,
  doorwayHeightM: 2.4,
} as const;

export type ModularKitPieceType =
  | "wall"
  | "column"
  | "arch"
  | "door"
  | "window"
  | "stair"
  | "vault"
  | "roof"
  | "floor-tile";

export type PivotRule =
  | "base-centre" // floor-standing: origin at centre of the base, Z=0
  | "back-face-centre" // wall-mounted: origin at centre of the face touching the wall
  | "hinge-floor" // doors: origin at the hinge point, floor level
  | "top-face-centre"; // ceiling-mounted: origin at centre of the top face

export interface ModularKitPieceSpec {
  pieceType: ModularKitPieceType;
  label: string;
  /** Standard dimensions in metres, following MODULAR_GRID. */
  standardDimensions: { widthM: number; heightM: number; depthM: number };
  pivotRule: PivotRule;
  /** Which material slots (see materials.ts) this piece type typically needs, in typical apply order. */
  materialSlots: MaterialId[];
  collisionSource: CollisionSource;
  /** Whether this piece type is expected to need LOD variants (large/repeated pieces seen at range). */
  needsLod: boolean;
  /** Blender export file-name prefix, per the export guide. */
  namingPrefix: string;
  /** The existing procedural component (if any) that renders this piece type today — honest cross-reference to the audit, not a claim that a modular mesh replacement exists yet. */
  currentImplementation?: string;
}

export const MODULAR_KIT: Record<ModularKitPieceType, ModularKitPieceSpec> = {
  wall: {
    pieceType: "wall",
    label: "Wall segment",
    standardDimensions: { widthM: MODULAR_GRID.moduleWidthM, heightM: MODULAR_GRID.storeyHeightM, depthM: 0.4 },
    pivotRule: "base-centre",
    materialSlots: ["limestone", "weathered-stone", "plaster"],
    collisionSource: "primitive",
    needsLod: true,
    namingPrefix: "ARCH_wall",
    currentImplementation: undefined, // audit finding: no wall mesh is currently drawn at all in Great Hall/Hall of Artisans — see docs/V2_PHASE2_ASSET_AUDIT.md §5.1
  },
  column: {
    pieceType: "column",
    label: "Column",
    standardDimensions: { widthM: 0.84, heightM: 5, depthM: 0.84 },
    pivotRule: "base-centre",
    materialSlots: ["limestone", "carved-stone"],
    collisionSource: "primitive",
    needsLod: true,
    namingPrefix: "ARCH_column",
    currentImplementation: "StoneColumn (ArchitectureKit.tsx)",
  },
  arch: {
    pieceType: "arch",
    label: "Pointed arch",
    standardDimensions: { widthM: 3, heightM: 4.5, depthM: 0.5 },
    pivotRule: "base-centre",
    materialSlots: ["limestone", "carved-stone"],
    collisionSource: "none",
    needsLod: false,
    namingPrefix: "ARCH_arch",
    currentImplementation: "PointedArch (ArchitectureKit.tsx)",
  },
  door: {
    pieceType: "door",
    label: "Door",
    standardDimensions: { widthM: MODULAR_GRID.doorwayWidthM, heightM: MODULAR_GRID.doorwayHeightM, depthM: 0.08 },
    pivotRule: "hinge-floor",
    materialSlots: ["aged-oak", "wrought-iron", "aged-brass"],
    collisionSource: "none",
    needsLod: false,
    namingPrefix: "ARCH_door",
    currentImplementation: "GrandDoor (ArchitectureKit.tsx) — visual only, static (no hinge animation yet)",
  },
  window: {
    pieceType: "window",
    label: "Stained-glass window",
    standardDimensions: { widthM: 1.4, heightM: 3, depthM: 0.15 },
    pivotRule: "back-face-centre",
    materialSlots: ["stained-glass", "leaded-glass", "wrought-iron"],
    collisionSource: "none",
    needsLod: false,
    namingPrefix: "ARCH_window",
    currentImplementation: "StainedGlassWindow (ArchitectureKit.tsx)",
  },
  stair: {
    pieceType: "stair",
    label: "Stair run",
    standardDimensions: { widthM: MODULAR_GRID.moduleWidthM, heightM: MODULAR_GRID.storeyHeightM, depthM: 4 },
    pivotRule: "base-centre",
    materialSlots: ["limestone", "aged-oak"],
    collisionSource: "authored",
    needsLod: true,
    namingPrefix: "ARCH_stair",
    currentImplementation: undefined, // audit finding: no stair piece exists anywhere in the renderer yet
  },
  vault: {
    pieceType: "vault",
    label: "Vaulted ceiling bay",
    standardDimensions: { widthM: MODULAR_GRID.moduleWidthM * 2, heightM: 1.5, depthM: 3.2 },
    pivotRule: "top-face-centre",
    materialSlots: ["limestone", "carved-stone"],
    collisionSource: "none",
    needsLod: false,
    namingPrefix: "ARCH_vault",
    currentImplementation: "VaultedCeilingBay (ArchitectureKit.tsx)",
  },
  roof: {
    pieceType: "roof",
    label: "Roof segment",
    standardDimensions: { widthM: MODULAR_GRID.moduleWidthM * 2, heightM: 2, depthM: MODULAR_GRID.moduleWidthM * 2 },
    pivotRule: "base-centre",
    materialSlots: ["roof-tile", "dark-granite"],
    collisionSource: "primitive",
    needsLod: true,
    namingPrefix: "ARCH_roof",
    currentImplementation: "GateTower's own inline roof boxes (scenes/MainGateScene.tsx) — not a standalone reusable piece yet",
  },
  "floor-tile": {
    pieceType: "floor-tile",
    label: "Floor tile",
    standardDimensions: { widthM: MODULAR_GRID.moduleWidthM, heightM: 0.05, depthM: MODULAR_GRID.moduleWidthM },
    pivotRule: "base-centre",
    materialSlots: ["limestone", "cobblestone", "aged-oak"],
    collisionSource: "none",
    needsLod: false,
    namingPrefix: "ARCH_floor",
    currentImplementation: "inline <planeGeometry> per scene (PrestigeSceneShell.tsx) — one flat plane, not modular tiles",
  },
};

export function getModularPieceSpec(pieceType: ModularKitPieceType): ModularKitPieceSpec {
  return MODULAR_KIT[pieceType];
}

export function listModularPieceTypes(): ModularKitPieceType[] {
  return Object.keys(MODULAR_KIT) as ModularKitPieceType[];
}
