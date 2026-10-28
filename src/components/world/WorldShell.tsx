/**
 * World-first application shell (Phase 15A, simplified in 15B). The playable
 * world (the router Outlet: HQ or a subject room) is the primary surface. The
 * default HUD is deliberately minimal: level+XP (top-left), location
 * (top-centre), one active objective, and a compact minimap (top-right). The
 * four-tab rail and a single overlay panel persist. Because this shell and its
 * WorldUiProvider sit ABOVE the Outlet, opening a panel or swapping HQ↔room
 * never resets panel/objective state, and opening a panel never moves the
 * player.
 */

import { Suspense, useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { WorldUiProvider, useWorldUi } from "../../world/WorldUiContext";
import { HudPlayerPanel } from "./HudPlayerPanel";
import { HudLocation } from "./HudLocation";
import { Minimap } from "./Minimap";
import { ObjectiveTracker } from "./ObjectiveTracker";
import { TabRail } from "./TabRail";
import { PanelHost } from "./panels/PanelHost";
import { SemesterSetupOverlay } from "./panels/import/SemesterSetupOverlay";
import { XpGainToast } from "../ui/XpGainToast";
import { ReminderTicker } from "../notifications/ReminderTicker";
import { SkeletonPanel } from "../ui/SkeletonPanel";
import { useSaveData } from "../../state/SaveDataContext";

export function WorldShell() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { saveData, storageOk, updateSettings } = useSaveData();
  const subject = subjectId ? saveData.semester.subjects.find((s) => s.id === subjectId) : undefined;

  const currentSceneId = subject ? `room-${subject.id}` : "hq";
  const locationName = subject ? subject.name : "Campus HQ";

  // First-run 3-step guide — only in HQ, before any room visit, dismiss-forever.
  const neverVisited = Object.keys(saveData.mentorBonds).length === 0;
  const showHint = !subject && neverVisited && !saveData.settings.onboardingHintDismissed;

  return (
    <WorldUiProvider>
      <SemesterSetupAutoOpen isFreshLaunch={neverVisited} />
      <SemesterSetupHost />
      <div className="world-shell">
        <a className="skip-link" href="#world-main">
          Skip to main content
        </a>

        <main id="world-main" className="world-main">
          {!storageOk ? (
            <div className="storage-warning-banner" role="alert">
              Your progress can't be saved right now — browser storage is full or blocked (this
              happens in private browsing). The app keeps working, but changes will be lost when this
              tab closes. Use Menu → Settings → Export as a backup.
            </div>
          ) : null}

          <div className="world-viewport">
            <Suspense fallback={<SkeletonPanel lines={4} minHeight={420} />}>
              <Outlet />
            </Suspense>

            {/* HUD — minimal, layered above the world, never blocking the player. */}
            <div className="hud-layer">
              <div className="hud-topleft">
                <HudPlayerPanel />
              </div>
              <div className="hud-topcentre">
                <HudLocation locationName={locationName} subjectId={subject?.id ?? null} />
                <ObjectiveTracker />
              </div>
              <div className="hud-topright">
                <Minimap currentSceneId={currentSceneId} />
              </div>
            </div>

            {showHint ? (
              <div className="world-coach-mark" role="status" data-testid="first-time-guide">
                <div className="world-coach-mark-body">
                  <strong>New here? Three steps:</strong>
                  <ol>
                    <li>Move around campus — click the floor or use WASD / arrow keys.</li>
                    <li>Open <b>Tasks</b> to choose what to do next.</li>
                    <li>Follow the tracked objective to the right room, then press <kbd>E</kbd>.</li>
                  </ol>
                </div>
                <button type="button" onClick={() => updateSettings({ onboardingHintDismissed: true })}>
                  <X size={14} aria-hidden="true" /> Got it
                </button>
              </div>
            ) : null}
          </div>
        </main>

        <TabRail />
        <PanelHost />
        <XpGainToast />
        <ReminderTicker />
      </div>
    </WorldUiProvider>
  );
}

/** Shows Semester Setup exactly once, unprompted, on a genuinely empty first launch — never again after. */
function SemesterSetupAutoOpen({ isFreshLaunch }: { isFreshLaunch: boolean }) {
  const { saveData, updateSettings } = useSaveData();
  const { openSemesterSetup } = useWorldUi();

  useEffect(() => {
    if (isFreshLaunch && !saveData.settings.semesterSetupOffered) {
      updateSettings({ semesterSetupOffered: true });
      openSemesterSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function SemesterSetupHost() {
  const { semesterSetupOpen } = useWorldUi();
  return semesterSetupOpen ? <SemesterSetupOverlay /> : null;
}
