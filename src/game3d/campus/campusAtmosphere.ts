/**
 * Campus Atmosphere (Phase 21 Part 9) — "expand ambience... keep subtle."
 * Purely derived, same discipline as `timeOfDay.ts`: an intensity/sound
 * layer only, never a lighting-philosophy change, never geometry, never a
 * gameplay value. Two real, already-derivable signals feed it —
 * `semesterCalendar.ts`'s `period` (exam week; and "no active teaching
 * period" read loosely as a calm holiday/break stretch — the only honest
 * reading available, since `SemesterRecord.breaks[].range` is documented
 * free text with no parseable date range, see `academicRoadmap.ts`) — plus
 * the real calendar month for a Southern-Hemisphere season. Nothing here
 * is invented: a save with no confirmed semester dates simply reads as
 * "on break," never a fabricated exam or holiday.
 */

import { getMelbourneDateTimeKey } from "../../lib/selectors";
import { getSemesterCalendar } from "../../lib/semesterCalendar";
import type { UniGameSaveData } from "../../types/domain";
import type { SoundEvent } from "../../lib/sound";

export type CampusSeason = "summer" | "autumn" | "winter" | "spring";

/** Southern Hemisphere seasons (Melbourne) — a pure function of the real calendar month. */
export function getCampusSeason(now: Date = new Date()): CampusSeason {
  const month = Number(getMelbourneDateTimeKey(now).slice(5, 7));
  if (month === 12 || month <= 2) return "summer";
  if (month <= 5) return "autumn";
  if (month <= 8) return "winter";
  return "spring";
}

export interface CampusAtmosphere {
  season: CampusSeason;
  examWeek: boolean;
  /** No active teaching period (pre-semester, finished, or unconfirmed) — the only honestly-derivable stand-in for "holiday," never a fabricated date range. */
  onBreak: boolean;
  /** Layered UNDER a building's own ambience — never a replacement. */
  ambienceSounds: SoundEvent[];
  /** One subtle ambient sentence for the Daily Brief, or null on an ordinary teaching-period day (deliberately quiet most of the time, per the brief's own "keep subtle"). */
  note: string | null;
}

export function getCampusAtmosphere(save: UniGameSaveData, now: Date = new Date()): CampusAtmosphere {
  const calendar = getSemesterCalendar(save, now);
  const season = getCampusSeason(now);
  const examWeek = calendar.period === "exams";
  const onBreak = calendar.period === "pre-semester" || calendar.period === "finished" || calendar.period === null;

  const ambienceSounds: SoundEvent[] = [];
  if (examWeek) ambienceSounds.push("exam-week-hush");
  else if (onBreak) ambienceSounds.push("campus-quiet");

  const note = examWeek
    ? "Exam period — the campus feels quieter and more focused than usual."
    : onBreak
      ? "No classes running right now — campus is calm and quiet."
      : season === "winter"
        ? "Winter's settled in around campus."
        : season === "summer"
          ? "Campus is bright with summer sun today."
          : null;

  return { season, examWeek, onBreak, ambienceSounds, note };
}
