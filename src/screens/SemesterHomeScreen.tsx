import { Suspense } from "react";
import { useSaveData } from "../state/SaveDataContext";
import { WorldScene } from "../world/WorldScene";
import { Game3DLazy } from "../world/Game3DLazy";
import { Game3DErrorBoundary } from "../world/Game3DErrorBoundary";
import { PrestigeV2Lazy } from "../world/PrestigeV2Lazy";
import { CompletionCelebration } from "../components/hq/CompletionCelebration";
import { isSemesterComplete } from "../lib/semesterCalendar";

/**
 * Campus HQ — the central hub scene. World-first (Phase 15A): the walkable
 * hall fills the viewport; priorities, progress and planning now live in the
 * persistent HUD and the six overlay panels rather than a dashboard rail.
 *
 * Phase 20 (Milestone 20A, additive): when `settings.worldRenderer` is
 * `"experimental-3d"`, renders the lazy-loaded 3D prototype instead of the
 * legacy 2D WorldScene — the legacy path is completely unmodified and
 * remains the default for every existing save (see
 * docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §3/§7).
 */
export function SemesterHomeScreen() {
  const { saveData, updateSettings } = useSaveData();

  // Completion sequence still plays once at 100% (additive; never locks).
  const showCelebration = !saveData.completionCelebratedAt && isSemesterComplete(saveData);

  if (saveData.settings.worldRenderer === "experimental-3d") {
    return (
      <Game3DErrorBoundary onUseLegacy2D={() => updateSettings({ worldRenderer: "legacy-2d" })}>
        <Suspense fallback={<div className="world-scene-loading" aria-hidden="true" />}>
          <Game3DLazy />
        </Suspense>
      </Game3DErrorBoundary>
    );
  }

  // V2 Phase 1 "Prestige Vertical Slice" (additive) — a THIRD, independent
  // renderer, parallel to (never replacing) the branch above. Reuses the
  // SAME error boundary/recovery action (switch to "legacy-2d") since a
  // WebGL/lazy-chunk failure needs the identical reliable fallback
  // regardless of which 3D renderer failed.
  if (saveData.settings.worldRenderer === "prestige-v2") {
    return (
      <Game3DErrorBoundary onUseLegacy2D={() => updateSettings({ worldRenderer: "legacy-2d" })}>
        <Suspense fallback={<div className="world-scene-loading" aria-hidden="true" />}>
          <PrestigeV2Lazy />
        </Suspense>
      </Game3DErrorBoundary>
    );
  }

  return (
    <>
      {showCelebration ? <CompletionCelebration /> : null}
      <h1 className="visually-hidden">{saveData.semester.label} — Campus Headquarters</h1>
      <WorldScene />
    </>
  );
}
