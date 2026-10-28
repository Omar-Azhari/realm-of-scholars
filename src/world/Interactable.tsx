/**
 * A world object the player can approach and act on (door, mentor, board,
 * shelf, desk, notice…). Interactions feel attached to the object: a quiet
 * resting glow invites interaction (no floating arrows), a framed highlight +
 * a purpose icon + name appear on hover/focus/approach, and a tracked object
 * keeps a highlight ring. Keyboard-operable (button + Enter/Space);
 * controller-friendly because activation is a single semantic callback.
 */

import { useState } from "react";
import {
  DoorOpen,
  LogOut,
  MessageCircle,
  ClipboardList,
  BookOpen,
  Timer,
  StickyNote,
  Info,
  BarChart3,
  Trophy,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import type { InteractableKind, WorldInteractable } from "./worldTypes";

/** A small purpose icon per object kind — communicates what the object is for. */
const KIND_ICON: Record<InteractableKind, LucideIcon> = {
  door: DoorOpen,
  exit: LogOut,
  mentor: MessageCircle,
  board: ClipboardList,
  shelf: BookOpen,
  desk: Timer,
  notice: StickyNote,
  info: Info,
  progress: BarChart3,
  trophy: Trophy,
  // Phase 20B — no 2D manifest scene produces a "wardrobe" interactable yet; this entry exists only to satisfy this Record's exhaustiveness.
  wardrobe: Shirt,
};

export function Interactable({
  item,
  sceneWidth,
  sceneHeight,
  inRange,
  tracked,
  onActivate,
}: {
  item: WorldInteractable;
  sceneWidth: number;
  sceneHeight: number;
  inRange: boolean;
  tracked: boolean;
  onActivate: (item: WorldInteractable) => void;
}) {
  const [active, setActive] = useState(false); // hover or focus
  const [x, y, w, h] = item.rect;
  const show = active || inRange || tracked;
  // The name tag only appears on hover/focus/approach — a tracked object keeps
  // its highlight ring but no permanent text label (15B label restraint).
  const showTag = active || inRange;
  const Icon = KIND_ICON[item.kind];

  return (
    <div
      className={`world-interactable${show ? " world-interactable--show" : ""}${tracked ? " world-interactable--tracked" : ""}${inRange ? " world-interactable--near" : ""}`}
      data-kind={item.kind}
      style={{
        left: `${(x / sceneWidth) * 100}%`,
        top: `${(y / sceneHeight) * 100}%`,
        width: `${(w / sceneWidth) * 100}%`,
        height: `${(h / sceneHeight) * 100}%`,
      }}
    >
      <button
        type="button"
        className="world-interactable-hit"
        aria-label={`${item.actionLabel} — ${item.label}${inRange ? "" : " (walk over first)"}`}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onClick={(e) => {
          e.stopPropagation();
          onActivate(item);
        }}
      />
      <span className="world-interactable-frame" aria-hidden="true" />
      {showTag ? (
        <span className="world-interactable-tag" aria-hidden="true">
          <Icon size={12} className="world-interactable-icon" />
          <span className="world-interactable-name">{item.label}</span>
          <span className="world-interactable-action">{item.actionLabel}</span>
        </span>
      ) : null}
    </div>
  );
}
