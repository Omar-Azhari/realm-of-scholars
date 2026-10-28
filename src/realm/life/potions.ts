/**
 * Potions: brewed at the cauldron in the Crafts Yard from gathered
 * ingredients. Every brew asks one question from your subjects — answer it
 * right and the potion comes out; get it wrong and the brew spoils (and the
 * question goes into your Grimoire). Drinking a potion gives a timed boost.
 */

import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import { gainFocus } from "../state/focus";
import type { RealmState } from "../types";

export type BuffId = "insight" | "swiftness" | "warding";

export interface Potion {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  ingredients: Record<string, number>;
  /** Timed boost (minutes), or an instant effect. */
  buff?: { id: BuffId; minutes: number };
  focus?: number;
}

export const POTIONS: Potion[] = [
  { id: "potion-insight", name: "Draught of Insight", icon: "🧪", blurb: "+15% study XP for 45 minutes.", ingredients: { minnow: 2, oak: 1 }, buff: { id: "insight", minutes: 45 } },
  { id: "potion-swiftness", name: "Swiftness Tonic", icon: "💨", blurb: "Move 25% faster for 10 minutes (races too).", ingredients: { trout: 1, willow: 2 }, buff: { id: "swiftness", minutes: 10 } },
  { id: "potion-warding", name: "Warding Brew", icon: "🛡", blurb: "Take 30% less damage for 15 minutes.", ingredients: { iron: 2, trout: 1 }, buff: { id: "warding", minutes: 15 } },
  { id: "potion-focus", name: "Philtre of Focus", icon: "⚡", blurb: "+12 Focus at once.", ingredients: { salmon: 1, maple: 1 }, focus: 12 },
];

export const INSIGHT_BONUS = 1.15;
export const SWIFTNESS_BONUS = 1.25;
export const WARDING_FACTOR = 0.7;

export function potion(id: string): Potion | undefined {
  return POTIONS.find((p) => p.id === id);
}

export function buffActive(state: RealmState, id: BuffId, now = Date.now()): boolean {
  const until = state.progress.buffs[id];
  return Boolean(until) && Date.parse(until!) > now;
}

/** Minutes left on a buff (0 when none). */
export function buffMinutesLeft(state: RealmState, id: BuffId, now = Date.now()): number {
  const until = state.progress.buffs[id];
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000)) : 0;
}

/** Why a potion can't be brewed now, or null. */
export function brewBlocker(state: RealmState, id: string): string | null {
  const p = potion(id);
  if (!p) return "Unknown potion.";
  for (const [mat, n] of Object.entries(p.ingredients)) {
    if ((state.progress.materials[mat] ?? 0) < n) return `You need ${n} ${mat}.`;
  }
  return null;
}

function addMaterial(id: string, n: number): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, materials: { ...s.progress.materials, [id]: Math.max(0, (s.progress.materials[id] ?? 0) + n) } } }));
}

/** Uses the ingredients; the potion comes out only if the question was answered right. */
export function brew(id: string, correct: boolean): "brewed" | "spoiled" | "missing" {
  const state = realmStore.get();
  const p = potion(id);
  if (!p || brewBlocker(state, id)) return "missing";
  for (const [mat, n] of Object.entries(p.ingredients)) addMaterial(mat, -n);
  if (!correct) {
    emit({ type: "sound", name: "miss" });
    chat(`The ${p.name.toLowerCase()} curdles and smokes. Review that question and try again.`);
    return "spoiled";
  }
  addMaterial(p.id, 1);
  emit({ type: "sound", name: "coin" });
  chat(`You brew a ${p.name}.`);
  return "brewed";
}

export function drink(id: string, now = Date.now()): boolean {
  const state = realmStore.get();
  const p = potion(id);
  if (!p || (state.progress.materials[id] ?? 0) <= 0) return false;
  addMaterial(id, -1);
  if (p.buff) {
    const base = Math.max(now, Date.parse(state.progress.buffs[p.buff.id] ?? "") || 0);
    const until = new Date(base + p.buff.minutes * 60_000).toISOString();
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, buffs: { ...s.progress.buffs, [p.buff!.id]: until } } }));
  }
  if (p.focus) gainFocus(p.focus, p.name);
  emit({ type: "sound", name: "study" });
  chat(`You drink the ${p.name}. ${p.blurb}`);
  return true;
}
