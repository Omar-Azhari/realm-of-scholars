import { Suspense } from "react";
import { Navigate, useParams } from "react-router-dom";
import { WorldScene } from "../world/WorldScene";
import { Game3DLazy } from "../world/Game3DLazy";
import { Game3DErrorBoundary } from "../world/Game3DErrorBoundary";
import { useSaveData } from "../state/SaveDataContext";

/**
 * A subject room — one walkable scene per subject, driven by :subjectId
 * through the shared WorldScene (Phase 15A). Artwork and geometry come from
 * the `room-<subjectId>` manifest entry; movement, interactables, mentor
 * dialogue and Focus Mode are handled by WorldScene.
 *
 * Phase 20 (Milestone 20A, additive): when `settings.worldRenderer` is
 * `"experimental-3d"`, renders the same single 3D test-room prototype
 * regardless of which subject was requested — Milestone 20A has exactly
 * one 3D room; per-subject 3D rooms are Milestone 20E's scope (see
 * docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §4).
 */
export function SubjectRoomScreen() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { saveData, updateSettings } = useSaveData();
  const subject = saveData.semester.subjects.find((s) => s.id === subjectId);

  if (!subject || !subjectId) {
    return <Navigate to="/" replace />;
  }

  if (saveData.settings.worldRenderer === "experimental-3d") {
    return (
      <Game3DErrorBoundary onUseLegacy2D={() => updateSettings({ worldRenderer: "legacy-2d" })}>
        <Suspense fallback={<div className="world-scene-loading" aria-hidden="true" />}>
          <Game3DLazy />
        </Suspense>
      </Game3DErrorBoundary>
    );
  }

  return <WorldScene subject={subject} />;
}
