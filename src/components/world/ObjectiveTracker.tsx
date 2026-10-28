/**
 * Active objective (Phase 15B) — exactly ONE objective in the HUD. It is the
 * player's explicitly-tracked task if set, otherwise the single top
 * recommendation. Shows title, subject colour, urgency, a Locate action and
 * (when explicitly tracked) a Dismiss. The player changes which task is
 * tracked from the Tasks panel. Hidden entirely when there is nothing to do.
 */

import { useMemo } from "react";
import { Crosshair, X, Flag } from "lucide-react";
import { useSaveData } from "../../state/SaveDataContext";
import { useWorldUi } from "../../world/WorldUiContext";
import { getTopPriorityItems, type PriorityItem } from "../../lib/priority";
import { getSubjectAccentVar } from "../../lib/subjectTheme";
import type { WorldObjective } from "../../world/worldTypes";

function urgencyOf(item: PriorityItem): WorldObjective["urgency"] {
  return item.priority.level === "critical" ? "overdue" : item.priority.level === "high" ? "soon" : "normal";
}

export function ObjectiveTracker() {
  const { saveData } = useSaveData();
  const { objective, setObjective, locateInWorld } = useWorldUi();

  const suggestion = useMemo(() => {
    const [top] = getTopPriorityItems(
      saveData.semester.subjects,
      saveData.tasks,
      new Date(),
      1,
      saveData.settings.pinnedPriorityIds
    );
    if (!top) return null;
    const title = top.type === "module" ? top.module.title : top.assessment.title;
    const obj: WorldObjective = {
      id: `suggest-${top.subject.id}`,
      title,
      subjectId: top.subject.id,
      sceneId: `room-${top.subject.id}`,
      interactableId: top.type === "assessment" ? "assessments" : "modules",
      urgency: urgencyOf(top),
    };
    return obj;
  }, [saveData.semester.subjects, saveData.tasks, saveData.settings.pinnedPriorityIds]);

  const active = objective ?? suggestion;
  if (!active) return null;
  const explicit = Boolean(objective);

  return (
    <div className="hud-objective-bar" data-testid="objective-tracker" data-urgency={active.urgency ?? "normal"}>
      <Flag size={13} aria-hidden="true" className="hud-objective-flag" />
      <span className="hud-objective-label">{explicit ? "Objective" : "Next"}</span>
      <span
        className="tasks-dot"
        style={{ background: active.subjectId ? `var(${getSubjectAccentVar(active.subjectId)})` : "var(--hq-accent)" }}
      />
      <span className="hud-objective-title">{active.title}</span>
      <button
        type="button"
        className="hud-objective-btn"
        aria-label={`Locate ${active.title} in the world`}
        onClick={() =>
          locateInWorld({
            title: active.title,
            subjectId: active.subjectId,
            sceneId: active.sceneId,
            interactableId: active.interactableId,
            urgency: active.urgency,
          })
        }
      >
        <Crosshair size={14} aria-hidden="true" /> Locate
      </button>
      {explicit ? (
        <button type="button" className="hud-objective-btn hud-objective-dismiss" aria-label="Dismiss tracked objective" onClick={() => setObjective(null)}>
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
