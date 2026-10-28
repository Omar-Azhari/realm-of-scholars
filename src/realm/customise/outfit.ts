/**
 * Mix-and-match outfits. The five KayKit adventurers share one skeleton, so
 * any class's head, torso, arms, legs, cape or headgear can be worn on any
 * other — e.g. a mage's hat with a knight's armour and rogue boots. Dyes
 * tint a part; they're bought once with coins and can be reused anywhere.
 */

import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import { spendCoins } from "../state/actions";
import type { AvatarId, DyeSlot, OutfitSlot, RealmState } from "../types";

export const OUTFIT_SLOTS: Array<{ id: OutfitSlot; label: string; optional: boolean }> = [
  { id: "headgear", label: "Headgear", optional: true },
  { id: "head", label: "Head", optional: false },
  { id: "torso", label: "Torso", optional: false },
  { id: "arms", label: "Arms", optional: false },
  { id: "legs", label: "Legs", optional: false },
  { id: "cape", label: "Cape", optional: true },
];

export const DYE_SLOTS: DyeSlot[] = ["headgear", "torso", "arms", "legs"];

const PREFIX: Record<AvatarId, string> = { knight: "Knight", mage: "Mage", rogue: "Rogue", rogue_hooded: "Rogue", barbarian: "Barbarian" };

/** The mesh names that make up a slot in a class's model file. Empty when that class has no such part. */
export function partMeshes(avatar: AvatarId, slot: OutfitSlot): string[] {
  const p = PREFIX[avatar];
  switch (slot) {
    case "head":
      return [avatar === "rogue_hooded" ? "Rogue_Head_Hooded" : `${p}_Head`];
    case "torso":
      // The mage keeps a spellbook in the off hand; it comes with the mage torso.
      return avatar === "mage" ? ["Mage_Body", "Spellbook"] : [`${p}_Body`];
    case "arms":
      return [`${p}_ArmLeft`, `${p}_ArmRight`];
    case "legs":
      return [`${p}_LegLeft`, `${p}_LegRight`];
    case "cape":
      return [`${p}_Cape`];
    case "headgear":
      return avatar === "knight" ? ["Knight_Helmet"] : avatar === "mage" ? ["Mage_Hat"] : avatar === "barbarian" ? ["Barbarian_Hat"] : [];
  }
}

/** Which slot a mesh of a class's model belongs to, or null for weapons and other extras. */
export function slotOfMesh(avatar: AvatarId, meshName: string): OutfitSlot | null {
  for (const s of OUTFIT_SLOTS) if (partMeshes(avatar, s.id).includes(meshName)) return s.id;
  return null;
}

/** Classes that have a part for this slot (the rogues have no headgear). */
export function classesWith(slot: OutfitSlot): AvatarId[] {
  return (["knight", "mage", "rogue", "rogue_hooded", "barbarian"] as AvatarId[]).filter((a) => partMeshes(a, slot).length > 0 && !(slot !== "head" && a === "rogue_hooded"));
}

/** True when picking `c` for `slot` means "the avatar's own part" (the hooded rogue shares the rogue's body). */
export function isOwnPart(avatar: AvatarId, slot: OutfitSlot, c: AvatarId): boolean {
  return c === avatar || (slot !== "head" && avatar === "rogue_hooded" && c === "rogue");
}

/** The class each slot is drawn from (or "none"), filling gaps with the base avatar. */
export function resolveOutfit(avatar: AvatarId, outfit: Partial<Record<OutfitSlot, AvatarId | "none">>): Record<OutfitSlot, AvatarId | "none"> {
  const out = {} as Record<OutfitSlot, AvatarId | "none">;
  for (const s of OUTFIT_SLOTS) {
    const chosen = outfit[s.id];
    const from = chosen === "none" && s.optional ? "none" : chosen && chosen !== "none" ? chosen : avatar;
    // A class with no such part (the rogues wear no headgear) leaves the slot empty.
    out[s.id] = from !== "none" && partMeshes(from, s.id).length === 0 ? "none" : from;
  }
  return out;
}

/** Every class whose model file the outfit needs (the base avatar always comes first: it supplies the animations). */
export function outfitClasses(avatar: AvatarId, outfit: Partial<Record<OutfitSlot, AvatarId | "none">>): AvatarId[] {
  const resolved = resolveOutfit(avatar, outfit);
  const list: AvatarId[] = [avatar];
  for (const v of Object.values(resolved)) if (v !== "none" && !list.includes(v)) list.push(v);
  return list;
}

export interface Dye {
  id: string;
  name: string;
  /** Multiplied over the part's texture. Light tints read best. */
  tint: string;
  price: number;
  locked?: (s: RealmState) => string | null;
}

export const DYES: Dye[] = [
  { id: "dye-scarlet", name: "Scarlet", tint: "#ff8a80", price: 120 },
  { id: "dye-azure", name: "Azure", tint: "#8ab8ff", price: 120 },
  { id: "dye-emerald", name: "Emerald", tint: "#8cf0a0", price: 120 },
  { id: "dye-amber", name: "Amber", tint: "#ffd27a", price: 120 },
  { id: "dye-violet", name: "Violet", tint: "#c8a0ff", price: 160 },
  { id: "dye-shadow", name: "Shadow", tint: "#7a7a88", price: 160 },
  { id: "dye-rose", name: "Rose", tint: "#ffb0d8", price: 160 },
  {
    id: "dye-gilded",
    name: "Gilded",
    tint: "#ffe9a0",
    price: 400,
    locked: (s) => (Object.keys(s.progress.bosses).length >= 3 ? null : "Beat three deadline bosses to earn it."),
  },
];

export function dye(id: string | null | undefined): Dye | undefined {
  return id ? DYES.find((d) => d.id === id) : undefined;
}

export function buyDye(id: string): boolean {
  const state = realmStore.get();
  const d = dye(id);
  if (!d || state.progress.wardrobe.owned.includes(id)) return false;
  const reason = d.locked?.(state);
  if (reason) {
    chat(reason);
    return false;
  }
  if (!spendCoins(d.price)) return false;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, wardrobe: { ...s.progress.wardrobe, owned: [...s.progress.wardrobe.owned, id] } } }));
  emit({ type: "sound", name: "coin" });
  chat(`You buy a pot of ${d.name} dye. Use it on any part in the wardrobe, as often as you like.`);
  return true;
}

export function setOutfitPart(slot: OutfitSlot, from: AvatarId | "none" | null): void {
  const optional = OUTFIT_SLOTS.find((s) => s.id === slot)?.optional;
  if (from === "none" && !optional) return;
  realmStore.set((s) => {
    const outfit = { ...s.progress.wardrobe.outfit };
    if (from === null) delete outfit[slot];
    else outfit[slot] = from;
    return { ...s, progress: { ...s.progress, wardrobe: { ...s.progress.wardrobe, outfit } } };
  });
}

/** Applies an owned dye to a part, or clears it with null. */
export function setDye(slot: DyeSlot, id: string | null): boolean {
  const state = realmStore.get();
  if (id !== null && !state.progress.wardrobe.owned.includes(id)) return false;
  realmStore.set((s) => {
    const dyes = { ...s.progress.wardrobe.dyes };
    if (id === null) delete dyes[slot];
    else dyes[slot] = id;
    return { ...s, progress: { ...s.progress, wardrobe: { ...s.progress.wardrobe, dyes } } };
  });
  return true;
}

/** Dye tints per slot, for the renderer. */
export function dyeTints(dyes: Partial<Record<DyeSlot, string>>): Partial<Record<DyeSlot, string>> {
  const out: Partial<Record<DyeSlot, string>> = {};
  for (const slot of DYE_SLOTS) {
    const d = dye(dyes[slot]);
    if (d) out[slot] = d.tint;
  }
  return out;
}
