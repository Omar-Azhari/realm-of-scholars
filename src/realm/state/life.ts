/**
 * Life-skill rules: gathering (fishing, mining, woodcutting), cooking and
 * crafting. Uses the same 1-99 XP curve as subjects. Gathering costs Focus
 * per attempt; cooking and crafting use materials instead.
 */

import { realmStore } from "./store";
import { chat, emit } from "./events";
import { spendFocus } from "./focus";
import { levelForXp } from "../xp";
import { FOCUS, FOODS, LIFE_SKILLS, RESOURCES, WEAPONS, food, resource, weapon, type LifeSkill } from "../life/catalog";
import type { RealmState } from "../types";
import { familiarLevel, GATHER_FIND_CHANCE } from "../customise/familiar";

export function lifeLevel(state: RealmState, skill: LifeSkill): number {
  return levelForXp(state.progress.lifeXp[skill] ?? 0);
}

export function grantLifeXp(skill: LifeSkill, amount: number): void {
  if (amount <= 0) return;
  const before = realmStore.get().progress.lifeXp[skill] ?? 0;
  const after = before + Math.round(amount);
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, lifeXp: { ...s.progress.lifeXp, [skill]: after } } }));
  const name = LIFE_SKILLS.find((l) => l.id === skill)?.name ?? skill;
  emit({ type: "xp-drop", subjectId: `life:${skill}`, amount: Math.round(amount) });
  const oldLevel = levelForXp(before);
  const newLevel = levelForXp(after);
  if (newLevel > oldLevel) {
    emit({ type: "level-up", subjectId: `life:${skill}`, skillName: name, level: newLevel });
    emit({ type: "sound", name: "level" });
    chat(`Congratulations, you've just advanced a ${name} level. You are now level ${newLevel}.`, "level");
    const unlocked = RESOURCES.filter((r) => r.skill === skill && r.level > oldLevel && r.level <= newLevel);
    for (const r of unlocked) chat(`You can now gather ${r.name}.`, "level");
  }
}

function addMaterial(id: string, count: number): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, materials: { ...s.progress.materials, [id]: Math.max(0, (s.progress.materials[id] ?? 0) + count) } } }));
}

export function materialCount(state: RealmState, id: string): number {
  return state.progress.materials[id] ?? 0;
}

/** Can the player work this node? Returns a reason when they can't. */
export function gatherBlocker(state: RealmState, resourceId: string): string | null {
  const r = resource(resourceId);
  if (!r) return "Nothing to gather here.";
  const level = lifeLevel(state, r.skill);
  if (level < r.level) return `You need ${LIFE_SKILLS.find((l) => l.id === r.skill)?.name} level ${r.level} to gather ${r.name} (you're level ${level}).`;
  return null;
}

/** Starts one gathering attempt: checks the level and pays its Focus. */
export function beginGather(resourceId: string): boolean {
  const state = realmStore.get();
  const blocker = gatherBlocker(state, resourceId);
  if (blocker) {
    chat(blocker);
    return false;
  }
  const r = resource(resourceId)!;
  return spendFocus(FOCUS.cost.gather, `gather ${r.name}`);
}

/**
 * Finishes an attempt with the mini-game's result. `quality` is 0-1
 * (how close to the sweet spot); a perfect hit yields a bonus item.
 */
export function finishGather(resourceId: string, success: boolean, quality: number, random: () => number = Math.random): { got: number; xp: number } {
  const r = resource(resourceId);
  if (!r) return { got: 0, xp: 0 };
  if (!success) {
    chat(r.skill === "fishing" ? `The ${r.name.toLowerCase()} slips away.` : r.skill === "mining" ? "Your pick glances off the rock." : "Your axe bites but the tree holds.");
    grantLifeXp(r.skill, Math.round(r.xp * 0.15));
    return { got: 0, xp: Math.round(r.xp * 0.15) };
  }
  // A grown familiar sometimes sniffs out one more.
  const found = familiarLevel(realmStore.get()) >= 2 && random() < GATHER_FIND_CHANCE ? 1 : 0;
  const got = (quality >= 0.9 ? 2 : 1) + found;
  if (found) chat("Your familiar finds one more.");
  addMaterial(r.id, got);
  const xp = Math.round(r.xp * (0.8 + quality * 0.4)) * got;
  grantLifeXp(r.skill, xp);
  emit({ type: "sound", name: "coin" });
  chat(`You get ${got > 1 ? "two" : "some"} ${r.name.toLowerCase()}${got > 1 ? ". A perfect strike." : "."}`);
  return { got, xp };
}

/** Cooks one raw fish. Low cooking level burns it sometimes. */
export function cook(foodId: string, random: () => number = Math.random): "cooked" | "burnt" | "missing" | "level" {
  const state = realmStore.get();
  const f = food(foodId);
  if (!f) return "missing";
  if ((state.progress.materials[f.from] ?? 0) <= 0) return "missing";
  const level = lifeLevel(state, "cooking");
  if (level < f.level) {
    chat(`You need Cooking level ${f.level} to cook ${f.name.toLowerCase()}.`);
    return "level";
  }
  addMaterial(f.from, -1);
  // Burn chance falls from 40% at the recipe's level to 0% twenty levels above it.
  const burn = Math.max(0, 0.4 - (level - f.level) * 0.02);
  if (random() < burn) {
    chat(`You accidentally burn the ${resource(f.from)?.name.toLowerCase() ?? "fish"}.`);
    grantLifeXp("cooking", Math.round(f.xp * 0.2));
    return "burnt";
  }
  addMaterial(f.id, 1);
  grantLifeXp("cooking", f.xp);
  chat(`You cook ${f.name.toLowerCase()}.`);
  return "cooked";
}

export function craftBlocker(state: RealmState, weaponId: string): string | null {
  const w = weapon(weaponId);
  if (!w) return "Unknown recipe.";
  if (state.progress.weapons.includes(w.id)) return "You already own this.";
  const level = lifeLevel(state, "crafting");
  if (level < w.level) return `Needs Crafting level ${w.level}.`;
  const missing = Object.entries(w.cost).filter(([id, n]) => (state.progress.materials[id] ?? 0) < n);
  if (missing.length) return `Needs ${missing.map(([id, n]) => `${n} ${resource(id)?.name.toLowerCase() ?? id}`).join(", ")}.`;
  return null;
}

export function craft(weaponId: string): boolean {
  const state = realmStore.get();
  const blocker = craftBlocker(state, weaponId);
  const w = weapon(weaponId);
  if (blocker || !w) {
    chat(blocker ?? "You can't craft that.");
    return false;
  }
  for (const [id, n] of Object.entries(w.cost)) addMaterial(id, -n);
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, weapons: [...s.progress.weapons, w.id], weapon: w.id } }));
  grantLifeXp("crafting", w.xp);
  emit({ type: "sound", name: "quest" });
  chat(`You forge ${w.name.toLowerCase()} and take them up. (+${w.power} power)`, "quest");
  return true;
}

export function equipWeapon(id: string | null): void {
  const state = realmStore.get();
  if (id !== null && !state.progress.weapons.includes(id)) return;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, weapon: id } }));
}

/** Eats one cooked food; returns how much it heals (0 if none). */
export function eat(foodId: string): number {
  const f = food(foodId);
  const state = realmStore.get();
  if (!f || (state.progress.materials[f.id] ?? 0) <= 0) return 0;
  addMaterial(f.id, -1);
  return f.heals;
}

/** Best cooked food the player is carrying (for combat's quick-eat). */
export function bestFood(state: RealmState): string | null {
  const have = FOODS.filter((f) => (state.progress.materials[f.id] ?? 0) > 0);
  return have.length ? have[have.length - 1].id : null;
}

export function weaponPower(state: RealmState): number {
  return weapon(state.progress.weapon)?.power ?? 0;
}

export { WEAPONS };
