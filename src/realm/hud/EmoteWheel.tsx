/**
 * Emote wheel: G (or Menu → Emotes) opens a ring of emotes around the
 * centre of the screen. Click one, or press its number.
 */

import { useEffect, useState } from "react";
import { EMOTES } from "../customise/emotes";
import { runtime } from "../scene/runtime";
import { emoteIcon, Icon } from "./icons";

const OPEN_EVENT = "realm:emote-wheel";

/** Opens the emote wheel from anywhere in the interface (e.g. the menu drawer). */
export function openEmoteWheel(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function EmoteWheel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (document.querySelector(".rs-window-backdrop, .rs-dialogue")) return;
      const k = e.key.toLowerCase();
      if (k === "g") setOpen((v) => !v);
      else if (k === "escape") setOpen(false);
      else if (open && /^[1-9]$/.test(k)) {
        const emote = EMOTES[Number(k) - 1];
        if (emote) {
          runtime.emote?.(emote.id);
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="rs-emote-wheel" role="menu" aria-label="Emotes" onClick={() => setOpen(false)}>
      <div className="ring" onClick={(e) => e.stopPropagation()}>
        {EMOTES.map((emote, i) => {
          const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button
              key={emote.id}
              type="button"
              role="menuitem"
              className="emote"
              style={{ transform: `translate(${Math.cos(a) * 92}px, ${Math.sin(a) * 92}px)` }}
              onClick={() => {
                runtime.emote?.(emote.id);
                setOpen(false);
              }}
            >
              <span className="ico" aria-hidden="true">
                <Icon name={emoteIcon(emote.id)} />
              </span>
              <span className="label">
                {i + 1}. {emote.label}
              </span>
            </button>
          );
        })}
        <button type="button" className="hub" onClick={() => setOpen(false)} aria-label="Close emotes">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
