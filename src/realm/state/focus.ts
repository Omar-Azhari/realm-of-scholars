/**
 * Focus: the energy that links study to play. Studying earns it; gathering,
 * dungeons, arcade games and races spend it. Capped so it can't be hoarded
 * forever — come back and study again to refill.
 */

import { realmStore } from "./store";
import { chat, emit } from "./events";
import { FOCUS } from "../life/catalog";

export function gainFocus(amount: number, reason: string): number {
  const before = realmStore.get().progress.focus;
  const after = Math.min(FOCUS.max, before + Math.max(0, Math.round(amount)));
  const gained = after - before;
  if (gained <= 0) return 0;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: after } }));
  emit({ type: "focus", amount: gained, reason });
  return gained;
}

/** Spends Focus if there's enough. Tells the player how to refill when there isn't. */
export function spendFocus(amount: number, what: string): boolean {
  const have = realmStore.get().progress.focus;
  if (have < amount) {
    chat(`You need ${amount} Focus to ${what} (you have ${have}). Study to refill it: a waystone, a quest step, a Grimoire review or a trial win.`);
    emit({ type: "sound", name: "miss" });
    return false;
  }
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: s.progress.focus - amount } }));
  emit({ type: "focus", amount: -amount, reason: what });
  return true;
}
