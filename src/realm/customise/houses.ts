/**
 * Academy houses. You join one when you make your character; everything you
 * study earns it points, and the House Cup standings (in the Hall of
 * Trophies) race your house against the other three. The rival houses' tallies
 * grow steadily through the semester, so keeping your house in front means
 * studying steadily too.
 */

import type { RealmState } from "../types";

export interface House {
  id: string;
  name: string;
  motto: string;
  trait: string;
  crest: string;
  /** Banner colours: field and trim. */
  colours: [string, string];
  /** Rival points gained per day of the semester (a little different for each). */
  pace: number;
}

export const HOUSES: House[] = [
  { id: "emberhold", name: "Emberhold", motto: "Kindle and carry.", trait: "Bold", crest: "🔥", colours: ["#c2410c", "#2a2a2e"], pace: 46 },
  { id: "tidewater", name: "Tidewater", motto: "Ask the deeper question.", trait: "Curious", crest: "🌊", colours: ["#0f766e", "#e5e7eb"], pace: 42 },
  { id: "oakhaven", name: "Oakhaven", motto: "Root, grow, endure.", trait: "Steadfast", crest: "🌳", colours: ["#4d7c0f", "#7c4a1e"], pace: 44 },
  { id: "duskmere", name: "Duskmere", motto: "Light in the late hours.", trait: "Clever", crest: "🌙", colours: ["#3730a3", "#c0c4cc"], pace: 48 },
];

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / 86_400_000);
}

export function house(id: string | null | undefined): House | undefined {
  return id ? HOUSES.find((h) => h.id === id) : undefined;
}

/** Your house's points: every 10 study XP is a point, every quest point is five. */
export function yourHousePoints(state: RealmState): number {
  const xp = Object.values(state.progress.skillXp).reduce((a, b) => a + b, 0);
  return Math.floor(xp / 10) + state.progress.questPoints * 5;
}

/** A rival house's points: steady daily gains since the semester started (or since you enrolled). */
export function rivalHousePoints(state: RealmState, h: House, today = new Date()): number {
  const start = state.curriculum?.enrolment.startDate ?? state.curriculum?.createdAt?.slice(0, 10) ?? null;
  const span = start ? daysBetween(start, today.toISOString().slice(0, 10)) : 0;
  const days = Number.isFinite(span) ? Math.max(0, span) : 0;
  // Small, fixed wobble per house so the table isn't in lockstep.
  const wobble = (h.pace % 7) * Math.min(days, 30);
  return Math.round(days * h.pace + wobble);
}

export interface Standing {
  house: House;
  points: number;
  yours: boolean;
}

/** Points your study-group classmates have earned for each house (from their share codes). */
export function classmatePoints(state: RealmState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of Object.values(state.progress.group)) if (m.house) out[m.house] = (out[m.house] ?? 0) + (m.housePoints ?? 0);
  return out;
}

export function houseStandings(state: RealmState, today = new Date()): Standing[] {
  const mine = state.player?.house ?? null;
  const mates = classmatePoints(state);
  return HOUSES.map((h) => ({
    house: h,
    points: (h.id === mine ? yourHousePoints(state) : rivalHousePoints(state, h, today)) + (mates[h.id] ?? 0),
    yours: h.id === mine,
  })).sort((a, b) => b.points - a.points);
}

/** A short text card of this week's House Cup and your progress, for pasting into a group chat. */
export function weeklyCard(state: RealmState, today = new Date()): string {
  const table = houseStandings(state, today);
  const lines = [`House Cup, week of ${today.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`];
  table.forEach((t, i) => lines.push(`${i + 1}. ${t.house.name}: ${t.points.toLocaleString()}${t.yours ? " (my house)" : ""}`));
  const mine = house(state.player?.house);
  lines.push("");
  lines.push(`${state.player?.name ?? "Me"}${mine ? ` of ${mine.name}` : ""}: ${yourHousePoints(state).toLocaleString()} house points · ${state.progress.questPoints} quest points · ${state.progress.streak.current}-day streak`);
  lines.push("Realm of Scholars");
  return lines.join("\n");
}
