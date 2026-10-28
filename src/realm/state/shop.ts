/**
 * The Agora bazaar: cosmetics bought with coins earned by studying.
 * Capes recolour the adventurer's cape, hats sit on their head, pets follow
 * them around. Skill capes need level 99 in that subject; the mortarboard
 * needs graduation.
 */

import { realmStore } from "./store";
import { chat, emit } from "./events";
import { spendCoins } from "./actions";
import { levelForXp, MAX_LEVEL } from "../xp";
import { THEME_STYLES } from "../world/themes";
import type { RealmState } from "../types";

export type ShopSlot = "cape" | "hat" | "pet";

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  name: string;
  price: number;
  /** Cape colour, or a hat/pet model key. */
  look: string;
  blurb: string;
  /** Why the player can't buy it yet, or null when they can. */
  locked?: (state: RealmState) => string | null;
}

const BASE_ITEMS: ShopItem[] = [
  { id: "cape-crimson", slot: "cape", name: "Crimson cloak", price: 150, look: "#a3172b", blurb: "La Trobe red." },
  { id: "cape-royal", slot: "cape", name: "Royal blue cloak", price: 150, look: "#2347a8", blurb: "Deep and dignified." },
  { id: "cape-forest", slot: "cape", name: "Forest cloak", price: 150, look: "#2e6b34", blurb: "For walks between lectures." },
  { id: "cape-gold", slot: "cape", name: "Golden cloak", price: 350, look: "#d6a419", blurb: "It catches the light." },
  { id: "cape-midnight", slot: "cape", name: "Midnight cloak", price: 350, look: "#1b1530", blurb: "For late-night study sessions." },
  { id: "hat-wizard", slot: "hat", name: "Pointed scholar's hat", price: 250, look: "wizard", blurb: "Every serious student of the arcane owns one." },
  { id: "hat-laurel", slot: "hat", name: "Laurel wreath", price: 400, look: "laurel", blurb: "Worn by scholars of renown." },
  {
    id: "hat-mortarboard",
    slot: "hat",
    name: "Mortarboard",
    price: 0,
    look: "mortarboard",
    blurb: "Free to every graduate.",
    locked: (s) => (s.progress.graduatedAt ? null : "Graduate first: complete every quest."),
  },
  { id: "pet-wisp", slot: "pet", name: "Study wisp", price: 500, look: "wisp", blurb: "A floating light that keeps you company." },
  { id: "pet-squire", slot: "pet", name: "Skeleton squire", price: 1200, look: "skeleton_minion", blurb: "A loyal (and bony) companion." },
];

/** Every item for this realm, including a skill cape per subject. */
export function shopItems(state: RealmState): ShopItem[] {
  const skillCapes: ShopItem[] = (state.curriculum?.subjects ?? []).map((subject) => ({
    id: `skillcape-${subject.id}`,
    slot: "cape",
    name: `${subject.code || subject.name} skill cape`,
    price: 990,
    look: THEME_STYLES[subject.theme].accent,
    blurb: `Proof of mastery in ${subject.name}.`,
    locked: (s) => (levelForXp(s.progress.skillXp[subject.id] ?? 0) >= MAX_LEVEL ? null : `Reach level ${MAX_LEVEL} in ${subject.name}.`),
  }));
  return [...BASE_ITEMS, ...skillCapes];
}

export function findShopItem(state: RealmState, id: string | null): ShopItem | undefined {
  return id ? shopItems(state).find((item) => item.id === id) : undefined;
}

export function buyItem(id: string): boolean {
  const state = realmStore.get();
  const item = findShopItem(state, id);
  if (!item || state.progress.wardrobe.owned.includes(id)) return false;
  const reason = item.locked?.(state);
  if (reason) {
    chat(reason);
    return false;
  }
  if (item.price > 0 && !spendCoins(item.price)) return false;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, wardrobe: { ...s.progress.wardrobe, owned: [...s.progress.wardrobe.owned, id], [item.slot]: id } } }));
  emit({ type: "sound", name: "coin" });
  chat(`You buy the ${item.name} and put it on.`);
  return true;
}

/** Equip an owned item, or pass null to take that slot off. */
export function equipItem(slot: ShopSlot, id: string | null): void {
  const state = realmStore.get();
  if (id !== null && !state.progress.wardrobe.owned.includes(id)) return;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, wardrobe: { ...s.progress.wardrobe, [slot]: id } } }));
}
