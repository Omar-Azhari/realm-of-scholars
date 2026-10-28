/**
 * Top-right HUD minimap (Phase 15A): the schematic campus radar showing where
 * the player is (current scene node), the four rooms, HQ, and the tracked
 * objective. Clicking it opens the larger campus map inside the Subjects
 * panel — it does not create another primary tab.
 */

import { CampusMap } from "./CampusMap";
import { useWorldUi } from "../../world/WorldUiContext";

export function Minimap({ currentSceneId }: { currentSceneId: string }) {
  const { openPanelFor } = useWorldUi();
  return (
    <button
      type="button"
      className="hud-minimap"
      data-testid="hud-minimap"
      aria-label="Open campus map in the Subjects panel"
      onClick={() => openPanelFor("subjects")}
    >
      <CampusMap variant="mini" currentSceneId={currentSceneId} />
    </button>
  );
}
