/**
 * Scene-unit ↔ 3D-world-unit conversion (Phase 20, Milestone 20A). The
 * existing `FloorPoint` (`{x, feetY}`) is in the legacy renderer's 2D scene-
 * unit space (see src/world/worldTypes.ts) — reused verbatim by
 * `useWorldMovement` for the 3D prototype too (docs/PHASE_20_3D_WORLD_CUSTOMISATION.md
 * §1). This is the one small adapter needed: scene units → metres, with the
 * 2D depth axis (`feetY`) mapped onto the 3D world's `z` axis and `y` fixed
 * at 0 for ground-level walking (no jumping/flying in this milestone).
 */

import type { FloorPoint } from "../../world/worldTypes";

/** 100 scene units = 1 metre — chosen so the 1000×700 test room (testRoomWorld.ts) reads as a plausible ~10m×7m room. */
export const SCENE_UNITS_PER_METRE = 100;

export function floorPointToVector3(point: FloorPoint): [number, number, number] {
  return [point.x / SCENE_UNITS_PER_METRE, 0, point.feetY / SCENE_UNITS_PER_METRE];
}

export function sceneUnitsToMetres(units: number): number {
  return units / SCENE_UNITS_PER_METRE;
}
