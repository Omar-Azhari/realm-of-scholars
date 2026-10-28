/**
 * The semester yearbook: a one-page summary of the term — your character,
 * house, levels, quests, bosses, streaks, spells, and your strongest and
 * weakest weeks (by answer accuracy). Pure, so it can be tested; the window
 * draws it onto a canvas you can download.
 */

import { levelForXp } from "../xp";
import { house } from "../customise/houses";
import { knownSpells } from "../life/spells";
import { graduationStatus } from "./actions";
import type { RealmState } from "../types";

export interface WeekNote {
  subject: string;
  week: number;
  title: string;
  accuracy: number;
  answered: number;
}

export interface Yearbook {
  name: string;
  house: string | null;
  houseColours: [string, string] | null;
  university: string;
  period: string;
  totalLevel: number;
  levels: Array<{ subject: string; level: number }>;
  questsDone: number;
  questsTotal: number;
  bosses: number;
  bestStreak: number;
  focusHours: number;
  spells: number;
  secrets: number;
  stamps: number;
  ladderBest: number | null;
  best: WeekNote | null;
  worst: WeekNote | null;
}

export function yearbookFor(state: RealmState): Yearbook {
  const subjects = state.curriculum?.subjects ?? [];
  const levels = subjects.map((s) => ({ subject: s.code || s.name, level: levelForXp(state.progress.skillXp[s.id] ?? 0) }));
  const notes: WeekNote[] = [];
  for (const s of subjects) {
    for (const w of s.weeks) {
      const t = state.progress.accuracy[`${s.id}:${w.week}`];
      const answered = t ? t.right + t.wrong : 0;
      if (answered >= 3) notes.push({ subject: s.code || s.name, week: w.week, title: w.title, accuracy: t!.right / answered, answered });
    }
  }
  notes.sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered);
  const grad = graduationStatus(state);
  const h = house(state.player?.house);
  const e = state.curriculum?.enrolment;
  return {
    name: state.player?.name ?? "Scholar",
    house: h?.name ?? null,
    houseColours: h?.colours ?? null,
    university: e?.university ?? "",
    period: e ? `${e.teachingPeriod} ${e.year}` : "",
    totalLevel: levels.reduce((n, l) => n + l.level, 0),
    levels,
    questsDone: grad.done,
    questsTotal: grad.total,
    bosses: Object.keys(state.progress.bosses).length,
    bestStreak: state.progress.streak.best,
    focusHours: Math.round((state.progress.focusMinutes / 60) * 10) / 10,
    spells: knownSpells(state).length,
    secrets: Object.keys(state.progress.secrets).length,
    stamps: Object.keys(state.progress.voyages.stamps).length,
    ladderBest: state.progress.ladder.best <= 10 ? state.progress.ladder.best : null,
    best: notes[0] ?? null,
    worst: notes.length > 1 ? notes[notes.length - 1] : null,
  };
}
