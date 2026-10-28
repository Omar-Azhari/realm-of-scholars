/**
 * Activity -> sound mapping (Phase 20C, Part 8). A tiny table plus one
 * function that fires (or stops) the right sound whenever a character's
 * activity actually CHANGES — never every frame, so a continuously-held
 * activity (e.g. minutes of "type") doesn't retrigger its clip. Reuses the
 * existing `sound.ts` architecture (opt-in, missing-file-safe) rather than
 * building a second audio system; "footsteps" and "chair-move" reuse
 * event names that already existed before this phase.
 */

import type { PoseName } from "./characterRig";
import { emitSound, stopSound, type SoundEvent } from "../../lib/sound";

interface ActivitySoundMapping {
  event: SoundEvent;
  /** Continuous (footsteps while walking, typing while at the keyboard) vs a one-shot cue (a page turning, a mug set down) fired once on entry. */
  loop?: boolean;
}

const ACTIVITY_SOUND: Partial<Record<PoseName, ActivitySoundMapping>> = {
  walk: { event: "footsteps", loop: true },
  type: { event: "typing", loop: true },
  read: { event: "paper-turn" },
  write: { event: "paper-turn" },
  coffee: { event: "coffee-place" },
  sit: { event: "chair-move" },
};

/** Call every frame with the current + previous activity — internally a no-op unless they differ. */
export function playActivitySoundOnChange(activity: PoseName, previousActivity: PoseName | null): void {
  if (activity === previousActivity) return;

  if (previousActivity) {
    const previousMapping = ACTIVITY_SOUND[previousActivity];
    if (previousMapping?.loop) stopSound(previousMapping.event);
  }

  const mapping = ACTIVITY_SOUND[activity];
  if (mapping) emitSound(mapping.event, { loop: mapping.loop });
}
