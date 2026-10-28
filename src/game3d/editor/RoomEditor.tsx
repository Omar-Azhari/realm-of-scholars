/**
 * Room Edit Mode (Phase 20D, Part 5) — reached via the Room Planner board.
 * A plain HTML overlay (like the Study Planner/Wardrobe panels), NOT a
 * second Canvas — the live 3D room behind it renders this component's
 * in-progress DRAFT via `TestRoomScene`'s `preview*` props (wired in
 * `Game3D.tsx`), so the player sees a real preview without anything being
 * written to save data until "Apply." "Cancel" (or Escape, or the panel's
 * own close button) discards the draft outright — "no instant changes,
 * changes are confirmed before saving," per the brief.
 *
 * Deliberately plain buttons/selects rather than drag-and-drop — Part 2's
 * "avoid free-form placement, everything should remain tidy" applies just
 * as much to the EDITOR's interaction model as it does to the room itself.
 */

import { useEffect, useState } from "react";
import { Check, RotateCw, X } from "lucide-react";
import type { RoomCustomisation, RoomThemeId } from "../../types/domain";
import { ROOM_THEMES, ROOM_THEME_ORDER } from "../rooms/roomThemes";
import { ROOM_SLOTS, type RoomSlot } from "../rooms/roomSlots";
import { findFurnitureItem, furnitureByCategory } from "../../data/furnitureCatalogue";

const SLOT_LABELS: Record<string, string> = {
  "slot-desk": "Desk",
  "slot-bookshelf": "Bookshelf",
  "slot-chair": "Chair",
  "slot-plant-a": "Plant (window)",
  "slot-plant-b": "Plant (desk side)",
  "slot-lamp": "Lamp",
  "slot-rug": "Rug",
  "slot-wallart": "Wall Art",
  "slot-noticeboard": "Noticeboard",
  "slot-storage": "Storage",
  "slot-decoration": "Decoration",
  "slot-desk-accessory": "Desk Accessories",
};

/** Every option a slot can cycle through: `null` (empty) plus every catalogue item of that slot's category the player has actually unlocked — never a locked item, even to preview. */
function slotOptions(slot: RoomSlot, unlockedFurnitureIds: string[]): (string | null)[] {
  const unlocked = furnitureByCategory(slot.category).filter((item) => unlockedFurnitureIds.includes(item.id));
  return [null, ...unlocked.map((item) => item.id)];
}

function cycle<T>(options: T[], current: T, direction: 1 | -1): T {
  if (options.length === 0) return current;
  const index = options.indexOf(current);
  const next = (index + direction + options.length) % options.length;
  return options[next];
}

export interface RoomEditorProps {
  initialTheme: RoomThemeId;
  initialRoomCustomisation: RoomCustomisation;
  /** Fires on every draft change (theme/slot/rotation) so the live 3D scene behind this panel can preview it — never a save-data write. */
  onDraftChange: (theme: RoomThemeId, placedFurniture: Record<string, string | null>, rotations: Record<string, number>) => void;
  onCancel: () => void;
  onApply: (theme: RoomThemeId, roomCustomisation: RoomCustomisation) => void;
}

export function RoomEditor({ initialTheme, initialRoomCustomisation, onDraftChange, onCancel, onApply }: RoomEditorProps) {
  const [draftTheme, setDraftTheme] = useState<RoomThemeId>(initialTheme);
  const [draftPlaced, setDraftPlaced] = useState<Record<string, string | null>>(initialRoomCustomisation.placedFurniture);
  const [draftRotations, setDraftRotations] = useState<Record<string, number>>(initialRoomCustomisation.rotations);

  useEffect(() => {
    onDraftChange(draftTheme, draftPlaced, draftRotations);
    // Only the draft values should re-trigger the preview — onDraftChange
    // itself is a fresh closure from Game3D every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTheme, draftPlaced, draftRotations]);

  const setSlotItem = (slot: RoomSlot, itemId: string | null) => {
    setDraftPlaced((prev) => ({ ...prev, [slot.id]: itemId }));
  };

  const rotateSlot = (slot: RoomSlot) => {
    setDraftRotations((prev) => ({ ...prev, [slot.id]: ((prev[slot.id] ?? 0) + 90) % 360 }));
  };

  const handleApply = () => {
    onApply(draftTheme, { ...initialRoomCustomisation, placedFurniture: draftPlaced, rotations: draftRotations });
  };

  return (
    <div className="room-editor">
      <section className="room-editor-section">
        <h3 className="room-editor-heading">Room Theme</h3>
        <p className="room-editor-hint">Preview a theme, then Apply to keep it — switching back is always free.</p>
        <div className="room-editor-theme-grid" role="group" aria-label="Room theme">
          {ROOM_THEME_ORDER.map((themeId) => {
            const theme = ROOM_THEMES[themeId];
            const active = draftTheme === themeId;
            return (
              <button
                key={themeId}
                type="button"
                className={`room-editor-theme-card${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={() => setDraftTheme(themeId)}
              >
                <span className="room-editor-theme-swatch" aria-hidden="true">
                  <span style={{ background: theme.wallColor }} />
                  <span style={{ background: theme.floorColor }} />
                  <span style={{ background: theme.trimColor }} />
                </span>
                <span className="room-editor-theme-label">{theme.label}</span>
                <span className="room-editor-theme-desc">{theme.ambienceDescription}</span>
                {active ? <Check size={14} aria-hidden="true" className="room-editor-theme-check" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="room-editor-section">
        <h3 className="room-editor-heading">Furniture</h3>
        <p className="room-editor-hint">Only unlocked items can be placed — earn more through XP, streaks, and achievements.</p>
        <ul className="room-editor-slot-list">
          {ROOM_SLOTS.map((slot) => {
            const options = slotOptions(slot, initialRoomCustomisation.unlockedFurnitureIds);
            const currentId = draftPlaced[slot.id] ?? null;
            const currentItem = currentId ? findFurnitureItem(currentId) : undefined;
            const canCycle = options.length > 1;
            return (
              <li key={slot.id} className="room-editor-slot-row">
                <span className="room-editor-slot-label">{SLOT_LABELS[slot.id] ?? slot.category}</span>
                <span className="room-editor-slot-current">{currentItem ? currentItem.displayName : "Empty"}</span>
                <span className="room-editor-slot-controls">
                  <button
                    type="button"
                    disabled={!canCycle}
                    aria-label={`Previous item for ${SLOT_LABELS[slot.id] ?? slot.category}`}
                    onClick={() => setSlotItem(slot, cycle(options, currentId, -1))}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    disabled={!canCycle}
                    aria-label={`Next item for ${SLOT_LABELS[slot.id] ?? slot.category}`}
                    onClick={() => setSlotItem(slot, cycle(options, currentId, 1))}
                  >
                    ▶
                  </button>
                  {slot.rotatable ? (
                    <button type="button" aria-label={`Rotate ${SLOT_LABELS[slot.id] ?? slot.category}`} onClick={() => rotateSlot(slot)}>
                      <RotateCw size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="room-editor-footer">
        <button type="button" className="room-editor-cancel" onClick={onCancel}>
          <X size={15} aria-hidden="true" /> Cancel
        </button>
        <button type="button" className="room-editor-apply" onClick={handleApply}>
          <Check size={15} aria-hidden="true" /> Apply
        </button>
      </div>
    </div>
  );
}

