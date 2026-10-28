import { CalendarDays, Coffee, GraduationCap, ListTodo, Menu, type LucideIcon } from "lucide-react";
import type { PanelId } from "../../world/worldTypes";

/** Label + icon for each panel. `"daily-brief"` isn't in the tab rail's fixed four (see PANEL_ORDER) but still needs an entry here since PanelHost's title bar reads from this map regardless of how the panel was opened. */
export const PANEL_META: Record<PanelId, { label: string; icon: LucideIcon }> = {
  tasks: { label: "Tasks", icon: ListTodo },
  subjects: { label: "Subjects", icon: GraduationCap },
  calendar: { label: "Calendar", icon: CalendarDays },
  menu: { label: "Menu", icon: Menu },
  "daily-brief": { label: "Daily Brief", icon: Coffee },
};
