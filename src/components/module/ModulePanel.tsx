import type { SyntheticEvent } from "react";
import type { ModuleRecord } from "../../types/domain";

interface ModulePanelProps {
  module: ModuleRecord;
  completed: boolean;
  onToggleComplete: () => void;
  /** Called the first time this module's panel is opened (see markModuleReviewed). */
  onReview?: () => void;
}

/**
 * Native <details>/<summary> gives free keyboard support (focusable, Enter/
 * Space toggles) without hand-rolled ARIA. The completion checkbox stops
 * propagation so clicking it doesn't also toggle the expand/collapse state.
 */
export function ModulePanel({ module, completed, onToggleComplete, onReview }: ModulePanelProps) {
  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) {
      onReview?.();
    }
  }

  return (
    <details
      className={`module-panel${completed ? " module-panel--completed" : ""}`}
      onToggle={handleToggle}
    >
      <summary className="module-panel-summary">
        <span className="module-panel-number">{String(module.moduleNumber).padStart(2, "0")}</span>
        <span className="module-panel-title">{module.title}</span>
        <label className="module-panel-complete" onClick={(event) => event.stopPropagation()}>
          <input type="checkbox" checked={completed} onChange={onToggleComplete} />
          <span>{completed ? "Completed" : "Mark complete"}</span>
        </label>
      </summary>
      <div className="module-panel-body">
        <p>{module.overview}</p>

        <h4>Suggested UniGame tasks</h4>
        <ul>
          {module.suggestedTasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>

        <h4>Mini-game ideas</h4>
        <ul>
          {module.miniGameIdeas.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>

        <p className="module-panel-source-note">{module.sourceNote}</p>
      </div>
    </details>
  );
}
