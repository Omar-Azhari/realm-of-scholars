/**
 * The single overlay-panel host (Phase 15A). Renders whichever primary panel
 * is open as a side drawer over the world — the world scene stays mounted and
 * the player never moves. Escape closes; only one panel is ever open (the
 * WorldUi state holds a single id). This is the one controlled overlay system.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useWorldUi } from "../../../world/WorldUiContext";
import { PANEL_META } from "../panelMeta";
import { TasksPanel } from "./TasksPanel";
import { SubjectsPanel } from "./SubjectsPanel";
import { CalendarPanel } from "./CalendarPanel";
import { MenuPanel } from "./MenuPanel";
import { DailyBriefPanel } from "./DailyBriefPanel";

export function PanelHost() {
  const { openPanel, closePanel } = useWorldUi();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the panel for keyboard users.
    headingRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel, closePanel]);

  if (!openPanel) return null;
  const meta = PANEL_META[openPanel];
  const Icon = meta.icon;

  return (
    <div className="world-panel-layer" data-panel={openPanel}>
      <button
        type="button"
        className="world-panel-scrim"
        aria-label="Close panel"
        onClick={closePanel}
      />
      <section
        className="world-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="world-panel-title"
        data-testid={`panel-${openPanel}`}
      >
        <header className="world-panel-head">
          <h2 id="world-panel-title" className="world-panel-title" tabIndex={-1} ref={headingRef}>
            <Icon size={18} aria-hidden="true" /> {meta.label}
          </h2>
          <button type="button" className="world-panel-close" onClick={closePanel} aria-label="Close panel">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="world-panel-body">
          {openPanel === "tasks" ? <TasksPanel /> : null}
          {openPanel === "subjects" ? <SubjectsPanel /> : null}
          {openPanel === "calendar" ? <CalendarPanel /> : null}
          {openPanel === "menu" ? <MenuPanel /> : null}
          {openPanel === "daily-brief" ? <DailyBriefPanel /> : null}
        </div>
      </section>
    </div>
  );
}
