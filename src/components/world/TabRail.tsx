/**
 * The permanent primary navigation (Phase 15A): a vertical tab rail on the
 * right (desktop) and a compact bottom bar (mobile), both driving the SAME
 * six destinations in the fixed order Tasks · Subjects · Calendar · Resources
 * · Profile · Settings. Hover reveals the label; clicking the active tab
 * closes it; only one panel is ever open. No other primary tabs.
 */

import { useWorldUi } from "../../world/WorldUiContext";
import { PANEL_ORDER } from "../../world/worldTypes";
import { PANEL_META } from "./panelMeta";

export function TabRail() {
  const { openPanel, togglePanel } = useWorldUi();

  return (
    <nav className="tab-rail" aria-label="Primary">
      <ul>
        {PANEL_ORDER.map((id) => {
          const meta = PANEL_META[id];
          const Icon = meta.icon;
          const active = openPanel === id;
          return (
            <li key={id}>
              <button
                type="button"
                className={`tab-rail-btn${active ? " tab-rail-btn--active" : ""}`}
                aria-pressed={active}
                aria-label={meta.label}
                data-testid={`tab-${id}`}
                onClick={() => togglePanel(id)}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="tab-rail-label">{meta.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
