/**
 * Other islands: your university's other campuses and the other universities
 * in your city, reached by boat from the harbour. Each has a rival scholar
 * who duels you on your own subjects, tougher monsters and richer gathering
 * spots than home (higher tiers further out), and a passport stamp. Sailing
 * out costs Focus, so the way to explore more is to study more.
 */

import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import { spendFocus } from "../state/focus";
import { addCoinsPublic } from "../state/actions";
import { FOCUS } from "../life/catalog";
import { LA_TROBE, isLaTrobeName } from "../curriculum/latrobe";
import { universitiesFor } from "../curriculum/universities";
import type { Enrolment as RealmEnrolment } from "../types";

export interface IslandSpec {
  id: string;
  name: string;
  kind: "home" | "campus" | "university";
  /** 0 = like home, 1 = harder, 2 = hardest: shifts monster camps and gathering tiers up. */
  tier: 0 | 1 | 2;
  /** Name of the rival scholar in the exchange hall (none at home). */
  rival: string;
  blurb: string;
}

export const HOME: IslandSpec = { id: "home", name: "Home", kind: "home", tier: 0, rival: "", blurb: "Your own campus." };

/** Rough distance from the main Melbourne campus: nearer campuses are easier. */
const CAMPUS_TIER: Record<string, 0 | 1 | 2> = {
  "Melbourne (Bundoora)": 0,
  "Melbourne City": 0,
  Bendigo: 1,
  Shepparton: 1,
  "Albury-Wodonga": 1,
  Mildura: 2,
  Sydney: 2,
};

const RIVAL_NAMES = ["Aldric", "Maren", "Oswin", "Isolde", "Corwin", "Elspeth", "Thaddeus", "Rowena", "Bram", "Sabine", "Lucan", "Wren"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slugId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rivalFor(id: string, place: string): string {
  return `${RIVAL_NAMES[hash(id) % RIVAL_NAMES.length]} of ${place}`;
}

/** City used to look up neighbouring universities ("Melbourne (Bundoora)" → "Melbourne"). */
export function cityKey(city: string): string {
  const base = city.replace(/\s*\(.*\)\s*/g, "").trim();
  return /^melbourne/i.test(base) ? "Melbourne" : base;
}

/** Every island the player can sail to, home first. */
export function islandsFor(enrolment: Pick<RealmEnrolment, "university" | "city" | "country">): IslandSpec[] {
  const list: IslandSpec[] = [HOME];
  if (isLaTrobeName(enrolment.university)) {
    for (const campus of LA_TROBE.campuses) {
      if (campus === "Online" || campus === enrolment.city) continue;
      const id = `campus-${slugId(campus)}`;
      list.push({
        id,
        name: `${campus} campus`,
        kind: "campus",
        tier: CAMPUS_TIER[campus] ?? 1,
        rival: rivalFor(id, campus),
        blurb: `La Trobe's ${campus} campus.`,
      });
    }
  }
  const others = universitiesFor(enrolment.country, cityKey(enrolment.city)).filter((u) => u.toLowerCase() !== enrolment.university.trim().toLowerCase());
  others.slice(0, 5).forEach((name, i) => {
    const id = `uni-${slugId(name)}`;
    list.push({ id, name, kind: "university", tier: i < 2 ? 1 : 2, rival: rivalFor(id, name), blurb: `A neighbouring university.` });
  });
  return list;
}

export function islandById(enrolment: Pick<RealmEnrolment, "university" | "city" | "country">, id: string): IslandSpec {
  return islandsFor(enrolment).find((i) => i.id === id) ?? HOME;
}

/** Focus to sail out (going home is free). */
export function sailCost(to: IslandSpec): number {
  return to.kind === "home" ? 0 : FOCUS.cost.sail;
}

export const STAMP_COINS = 40;
export const RIVAL_COINS = [90, 150, 220] as const;
export const RIVAL_REPEAT_COINS = 30;

/** Pays the Focus for a voyage. Returns false when there isn't enough. */
export function beginVoyage(to: IslandSpec): boolean {
  const cost = sailCost(to);
  if (cost > 0 && !spendFocus(cost, `sail to ${to.name}`)) return false;
  emit({ type: "sound", name: "study" });
  return true;
}

/** First landing on an island stamps the passport (once) and pays a little. */
export function landOn(island: IslandSpec): boolean {
  if (island.kind === "home") return false;
  const state = realmStore.get();
  if (state.progress.voyages.stamps[island.id]) {
    chat(`You step ashore at ${island.name}.`);
    return false;
  }
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, voyages: { ...s.progress.voyages, stamps: { ...s.progress.voyages.stamps, [island.id]: new Date().toISOString() } } } }));
  addCoinsPublic(STAMP_COINS);
  emit({ type: "sound", name: "quest" });
  chat(`Passport stamped: ${island.name}. +${STAMP_COINS} coins. ${island.rival} waits in the exchange hall.`, "quest");
  return true;
}

/** Beating an island's rival: a big purse the first time, a small one after. Returns the coins paid. */
export function beatRival(island: IslandSpec): number {
  if (island.kind === "home") return 0;
  const first = !realmStore.get().progress.voyages.rivals[island.id];
  const coins = first ? RIVAL_COINS[island.tier] : RIVAL_REPEAT_COINS;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, voyages: { ...s.progress.voyages, rivals: { ...s.progress.voyages.rivals, [island.id]: new Date().toISOString() } } } }));
  addCoinsPublic(coins);
  chat(first ? `You beat ${island.rival}. +${coins} coins and their respect.` : `You beat ${island.rival} again. +${coins} coins.`, "quest");
  return coins;
}

/** How hard the rival is: their health and how hard they hit, by tier. */
export function rivalStrength(tier: 0 | 1 | 2): { hp: number; hit: number; questions: number } {
  return [
    { hp: 70, hit: 8, questions: 10 },
    { hp: 90, hit: 10, questions: 12 },
    { hp: 110, hit: 12, questions: 14 },
  ][tier];
}
