/**
 * The camera view button (bottom-right, beside Menu): switches between the
 * over-the-shoulder camera and first person. The view only ever changes when
 * the player asks for it.
 */

import { useEffect, useState } from "react";
import { runtime, setFirstPerson } from "../scene/runtime";
import { Icon } from "./icons";

/** The current camera mode, kept in step with every switch (this button, Options, anything else). */
export function useFirstPerson(): boolean {
  const [on, setOn] = useState(() => runtime.camera.firstPerson);
  useEffect(() => {
    const onView = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("realm-view", onView);
    return () => window.removeEventListener("realm-view", onView);
  }, []);
  return on;
}

export function ViewButton() {
  const firstPerson = useFirstPerson();
  return (
    <button
      type="button"
      className={`rs-view-button ${firstPerson ? "first" : ""}`}
      onClick={() => setFirstPerson(!runtime.camera.firstPerson)}
      aria-pressed={firstPerson}
      aria-label={`Camera view: ${firstPerson ? "first person" : "third person"}. Switch to ${firstPerson ? "third" : "first"} person.`}
      title={`Switch to ${firstPerson ? "third person (over the shoulder)" : "first person"}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="ico" aria-hidden="true">
        <Icon name="eye" />
      </span>
      <span className="label" aria-hidden="true">
        {firstPerson ? "1st person" : "3rd person"}
      </span>
      <span className="short" aria-hidden="true">
        {firstPerson ? "1st" : "3rd"}
      </span>
    </button>
  );
}
