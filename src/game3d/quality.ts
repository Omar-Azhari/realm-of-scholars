/**
 * 3D Campus quality tiers (Phase 20F Part 15). Only ever affects the R3F
 * `<Canvas>` and the two scene shells (`TestRoomScene.tsx`,
 * `CampusBuildingScene.tsx`) — the legacy 2D renderer has no equivalent
 * concept and is completely untouched by any of this, either in code or in
 * measured performance (its own bundle-splitting/CSS path never imports
 * this module).
 *
 * Deliberately narrow: dpr cap and shadow map size/on-off are the two
 * levers with the largest, most measurable GPU cost on integrated-graphics
 * laptops (the Art Bible's own target hardware, Part 14) for the LEAST
 * code disruption — no per-mesh `castShadow` threading, no LOD system, no
 * geometry swapping. "Auto" (the default) resolves from
 * `navigator.hardwareConcurrency`/`deviceMemory` once at Game3D mount —
 * both are coarse, standard, always-available-or-absent signals, not a
 * real benchmark (no live-render environment exists to benchmark against
 * here), so this is disclosed as a heuristic, not a measured guarantee.
 */

import type { GraphicsQuality } from "../types/domain";

export interface QualityPreset {
  label: string;
  /** [min, max] passed straight to `<Canvas dpr={...}>`. */
  dpr: [number, number];
  /** Passed to `<Canvas shadows={...}>` — when false, the renderer skips shadow-map computation entirely regardless of any individual mesh's `castShadow`/`receiveShadow`, the single biggest lever available without touching every furniture file. */
  shadowsEnabled: boolean;
  /** `directionalLight`'s `shadow-mapSize`, both scene shells. */
  shadowMapSize: number;
}

const QUALITY_PRESETS: Record<Exclude<GraphicsQuality, "auto">, QualityPreset> = {
  low: { label: "Low", dpr: [1, 1], shadowsEnabled: false, shadowMapSize: 512 },
  medium: { label: "Medium", dpr: [1, 1.5], shadowsEnabled: true, shadowMapSize: 1024 },
  high: { label: "High", dpr: [1, 2], shadowsEnabled: true, shadowMapSize: 2048 },
};

/**
 * Coarse, standard-API heuristic — not a benchmark. `deviceMemory` is
 * Chromium-only and absent elsewhere; both signals default to a neutral
 * assumption (4 cores / 4GB) when unavailable, landing on "medium" rather
 * than guessing toward either extreme.
 */
export function resolveAutoQualityTier(): Exclude<GraphicsQuality, "auto"> {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 2 || memoryGb <= 2) return "low";
  if (cores >= 8 && memoryGb >= 8) return "high";
  return "medium";
}

export function resolveQualityPreset(setting: GraphicsQuality): QualityPreset {
  const tier = setting === "auto" ? resolveAutoQualityTier() : setting;
  return QUALITY_PRESETS[tier];
}

export const QUALITY_TIER_ORDER: GraphicsQuality[] = ["auto", "low", "medium", "high"];
