/**
 * Top-centre HUD location chip (Phase 15B) — a slim "where am I" readout: the
 * current location name and, in a subject room, a small subject-coloured icon.
 * Replaces the large location card from 15A.
 */

import { MapPin } from "lucide-react";
import { getSubjectIcon, getSubjectAccentVar } from "../../lib/subjectTheme";
import { useWorldUi } from "../../world/WorldUiContext";

export function HudLocation({ locationName, subjectId }: { locationName: string; subjectId: string | null }) {
  // Phase 20F Part 12 "current-location indicator" — `locationName` is
  // derived from the URL route in WorldShell.tsx, which never changes as
  // the player travels between campus buildings in the 3D world
  // (deliberately — seamless travel). `Game3D.tsx` reports its actual
  // current building through this context whenever it changes; when
  // present, it overrides the route-derived label. `null` whenever the 3D
  // world isn't mounted, so the legacy 2D path is completely unaffected.
  const { current3DLocationLabel } = useWorldUi();
  const displayName = current3DLocationLabel ?? locationName;
  const Icon = subjectId ? getSubjectIcon(subjectId) : MapPin;
  const color = subjectId ? `var(${getSubjectAccentVar(subjectId)})` : "var(--hq-accent)";
  return (
    <div className="hud-location" data-testid="hud-location">
      <Icon size={14} aria-hidden="true" style={{ color }} />
      <span>{displayName}</span>
    </div>
  );
}
