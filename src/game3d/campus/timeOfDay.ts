/**
 * Time-of-day atmosphere (Phase 20E, Part 7 — "introduce atmosphere only...
 * no gameplay penalties"). Purely a function of the real clock (the same
 * `getMelbourneDateTimeKey` every other real-time derivation in this
 * codebase already uses — Australia/Melbourne, matching the semester
 * calendar/reminders/streak logic, not a second timezone concept).
 *
 * Deliberately narrow: an intensity multiplier applied on top of whatever
 * lighting rig is already active (a Room Theme in Campus HQ, or a fixed
 * building palette elsewhere) — never a lighting-philosophy change, just
 * dimmer at night and slightly brighter at midday, the same warm/soft
 * recipe throughout. NPC "density" and ambience sound selection are the
 * only other things this drives — nothing here ever touches an
 * interactable, an obstacle, XP, or any gameplay value.
 */

import { getMelbourneDateTimeKey } from "../../lib/selectors";
import type { SoundEvent } from "../../lib/sound";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export interface TimeOfDayAtmosphere {
  label: string;
  /** Scales every lighting rig's ambient/hemisphere/sun intensities together — never their colours (except `ambientColorOverride` below), never geometry. */
  intensityMultiplier: number;
  /** Additional loop-once-on-mount ambience for whichever building is active, layered under that building's own ambience events. */
  ambienceSounds: SoundEvent[];
  /**
   * Phase 20F Part 11 — the Art Bible's Part 7 time-of-day table names
   * Night as "the one context allowed to go cool" (ambient `#40485c`),
   * unlike every other time-of-day preset which only ever dims the
   * existing warm rig. A uniformly-dimmed warm room doesn't read as
   * "night" — it reads as a dimmer switch on an otherwise unchanged
   * afternoon — so Night alone overrides the ambient light's colour
   * (never the sun or hemisphere, and the sun is already ~off at this
   * multiplier); every other time of day leaves colour untouched, per
   * Part 7 rule "no room may invent its own lighting rig."
   */
  ambientColorOverride?: string;
}

export const TIME_OF_DAY_ATMOSPHERES: Record<TimeOfDay, TimeOfDayAtmosphere> = {
  morning: { label: "Morning", intensityMultiplier: 0.95, ambienceSounds: ["birds-outside"] },
  afternoon: { label: "Afternoon", intensityMultiplier: 1.0, ambienceSounds: ["birds-outside"] },
  evening: { label: "Evening", intensityMultiplier: 0.8, ambienceSounds: [] },
  night: { label: "Night", intensityMultiplier: 0.6, ambienceSounds: ["wind-outside"], ambientColorOverride: "#40485c" },
};

export function getTimeOfDayAtmosphere(timeOfDay: TimeOfDay): TimeOfDayAtmosphere {
  return TIME_OF_DAY_ATMOSPHERES[timeOfDay];
}

/**
 * How large a fraction of a building's optional/"visitor-weight" NPCs
 * should appear at this time — campus reads busier by day, quieter at
 * night, per Part 7/8. Only NPCs whose `BuildingNpcDefinition.activeTimes`
 * restricts them are affected; an NPC with no restriction is always
 * present (e.g. staff on duty, the mentor).
 */
export function isNpcActiveAtTime(activeTimes: TimeOfDay[] | undefined, timeOfDay: TimeOfDay): boolean {
  if (!activeTimes) return true;
  return activeTimes.includes(timeOfDay);
}
