/**
 * On-screen joystick and "Use" button for phones and tablets. Shown on
 * touch screens only. The stick feeds runtime.joystick, which the player
 * reads alongside WASD; "Use" does what E does and the jump button what Space does.
 */

import { useEffect, useRef, useState } from "react";
import { onNearby, runtime } from "../scene/runtime";
import type { WorldObject } from "../world/worldGen";
import { Icon } from "./icons";

const RADIUS = 46;

function isTouchScreen(): boolean {
  // Primary pointer only: a touchscreen laptop used with a mouse reports touch points but a fine pointer.
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function TouchControls() {
  const [enabled, setEnabled] = useState(isTouchScreen);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [near, setNear] = useState<WorldObject | null>(null);
  const pointer = useRef<number | null>(null);
  const base = useRef<HTMLDivElement>(null);

  useEffect(() => onNearby(setNear), []);
  // A laptop with a touchscreen: show the controls once the screen is actually touched.
  useEffect(() => {
    if (enabled) return;
    const onTouch = () => setEnabled(true);
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, [enabled]);
  useEffect(
    () => () => {
      runtime.joystick.x = 0;
      runtime.joystick.y = 0;
    },
    [],
  );

  if (!enabled) return null;

  const move = (clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    runtime.joystick.x = dx / RADIUS;
    runtime.joystick.y = -dy / RADIUS;
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    runtime.joystick.x = 0;
    runtime.joystick.y = 0;
  };

  return (
    <>
      <div
        ref={base}
        className="rs-joystick"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) move(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button type="button" className="rs-attack-button" onClick={() => runtime.attackNow?.()} aria-label="Attack">
        <Icon name="swords" />
      </button>
      <button type="button" className="rs-jump-button" onClick={() => runtime.jump?.()} aria-label="Jump">
        <Icon name="arrowUp" />
      </button>
      <button type="button" className="rs-use-button" disabled={!near} onClick={() => runtime.useNearby?.()} aria-label={near ? `${near.actions[0]?.label} ${near.name}` : "Nothing in reach"}>
        {near ? near.actions[0]?.label ?? "Use" : "Use"}
      </button>
    </>
  );
}
