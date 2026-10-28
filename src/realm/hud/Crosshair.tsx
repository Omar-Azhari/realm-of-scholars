/**
 * First-person aiming dot (the 👁 view button switches views). Until the mouse is
 * locked it also says how to look around: click to lock, Esc to free it.
 */

import { useEffect, useState } from "react";
import { runtime } from "../scene/runtime";

export function Crosshair() {
  const [on, setOn] = useState(runtime.camera.firstPerson);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const onView = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail));
    const onLock = () => setLocked(document.pointerLockElement !== null);
    window.addEventListener("realm-view", onView);
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      window.removeEventListener("realm-view", onView);
      document.removeEventListener("pointerlockchange", onLock);
    };
  }, []);
  if (!on) return null;
  return (
    <>
      <div className="rs-crosshair" aria-hidden>
        <span />
      </div>
      {locked ? null : <div className="rs-look-hint">Click to look around with the mouse · Esc frees it</div>}
    </>
  );
}
