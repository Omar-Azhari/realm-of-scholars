/**
 * The spellbook: every teaching week you study unlocks a spell named after
 * that week's material (a key term from it, or its first topic). What the
 * spell does is fixed by its name; how strong it is comes from how well you
 * know the week — your answer accuracy on it, plus a bonus once it's
 * mastered (three trial/game wins). So the moveset you fight with is
 * literally what you've learned.
 */

import { weekKey } from "../state/actions";
import type { RealmState, RealmSubject, RealmWeek } from "../types";

export type SpellKind = "bolt" | "blast" | "mend" | "ward" | "snare";

export const SPELL_KINDS: Record<SpellKind, { label: string; icon: string; cooldown: number; blurb: string; color: string }> = {
  bolt: { label: "Bolt", icon: "⚡", cooldown: 1.2, blurb: "A strong single strike.", color: "#7fe8ff" },
  blast: { label: "Blast", icon: "💥", cooldown: 3.5, blurb: "Hits everything around the target.", color: "#ff8a5a" },
  mend: { label: "Mend", icon: "💚", cooldown: 8, blurb: "Heals you.", color: "#6fe38a" },
  ward: { label: "Ward", icon: "🛡", cooldown: 10, blurb: "Halves the damage you take for 5 seconds.", color: "#ffd45a" },
  snare: { label: "Snare", icon: "🕸", cooldown: 5, blurb: "Slows the target to a crawl for 4 seconds.", color: "#c8a0ff" },
};

const KINDS: SpellKind[] = ["bolt", "bolt", "blast", "mend", "ward", "snare"];

export interface Spell {
  id: string;
  name: string;
  kind: SpellKind;
  /** 1 (barely known) … 10 (mastered and always right). */
  power: number;
  subjectId: string;
  subjectName: string;
  week: number;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The week's spell name: a key term mentioned in it, else its first topic, else its title. */
export function spellName(subject: RealmSubject, week: RealmWeek): string {
  const text = `${week.title} ${week.topics.join(" ")} ${week.summary}`.toLowerCase();
  const term = subject.keyTerms.find((t) => t.term.length > 2 && text.includes(t.term.toLowerCase()));
  const raw = term?.term ?? week.topics[0] ?? week.title;
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 32).trim()}…` : clean;
}

/** Every spell the player has unlocked, strongest first. */
export function knownSpells(state: RealmState): Spell[] {
  const out: Spell[] = [];
  for (const subject of state.curriculum?.subjects ?? []) {
    for (const week of subject.weeks) {
      const progress = state.progress.weeks[weekKey(subject.id, week.week)];
      if (!progress?.studiedAt) continue;
      const tally = state.progress.accuracy[`${subject.id}:${week.week}`];
      const answered = tally ? tally.right + tally.wrong : 0;
      const accuracy = answered ? tally!.right / answered : 0.5;
      const mastered = (progress.minigamesWon ?? 0) >= 3;
      const power = Math.max(1, Math.min(10, Math.round(2 + accuracy * 6 + (mastered ? 2 : 0))));
      const id = `${subject.id}:${week.week}`;
      out.push({ id, name: spellName(subject, week), kind: KINDS[hash(id) % KINDS.length], power, subjectId: subject.id, subjectName: subject.name, week: week.week });
    }
  }
  return out.sort((a, b) => b.power - a.power);
}

/** The four spells on the bar: the saved picks that are still known, topped up with the strongest others. */
export function spellBar(state: RealmState): Array<Spell | null> {
  const known = knownSpells(state);
  const byId = new Map(known.map((s) => [s.id, s]));
  const picked = state.progress.spellbar.map((id) => (id ? byId.get(id) ?? null : null));
  const used = new Set(picked.filter(Boolean).map((s) => s!.id));
  for (let i = 0; i < 4; i++) {
    if (!picked[i]) {
      const next = known.find((s) => !used.has(s.id));
      picked[i] = next ?? null;
      if (next) used.add(next.id);
    }
  }
  return picked.slice(0, 4);
}

/** Damage or healing for a spell of this power. */
export function spellAmount(kind: SpellKind, power: number): number {
  switch (kind) {
    case "bolt":
      return 4 + power * 2;
    case "blast":
      return 3 + power;
    case "mend":
      return 6 + power * 2;
    default:
      return 0;
  }
}
