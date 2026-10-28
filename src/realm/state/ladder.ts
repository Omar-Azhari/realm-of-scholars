/**
 * The duelling club: a ladder of ten student duellists. You start at the
 * bottom each month (a "season"), challenge the duellist one rank above,
 * and swap places when you win. Duels use hard questions from your own
 * subjects, and opponents get tougher near the top. Reaching first place
 * wins the season's title.
 */

import { realmStore } from "./store";
import { chat, emit } from "./events";
import { addCoinsPublic } from "./actions";
import { bumpCounter } from "./stats";
import { HOUSES } from "../customise/houses";
import type { RealmState } from "../types";

export const LADDER_SIZE = 10;

const NAMES = ["Ottoline Vane", "Rufus Harrow", "Imogen Swale", "Caspian Reed", "Delphine Marsh", "Barnaby Thorne", "Wilhelmina Crane", "Ezra Blackwood", "Persephone Lyle", "Tobias Fenwick"];

export interface Duellist {
  rank: number;
  name: string;
  house: string;
}

/** The season is the calendar month (YYYY-MM). */
export function currentSeason(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Your rank this season (1 = top); a new season starts you at the bottom. */
export function yourRank(state: RealmState, now = new Date()): number {
  const l = state.progress.ladder;
  return l.season === currentSeason(now) ? l.rank : LADDER_SIZE + 1;
}

/** The duellists on the board this season (you take the place of whoever you beat). */
export function ladderBoard(now = new Date()): Duellist[] {
  const season = currentSeason(now);
  const shift = Number(season.replace("-", "")) % NAMES.length;
  return Array.from({ length: LADDER_SIZE }, (_, i) => ({
    rank: i + 1,
    name: NAMES[(i + shift) % NAMES.length],
    house: HOUSES[(i + shift) % HOUSES.length].name,
  }));
}

/** The next opponent: the duellist one place above you. */
export function nextOpponent(state: RealmState, now = new Date()): Duellist | null {
  const rank = yourRank(state, now);
  if (rank <= 1) return null;
  return ladderBoard(now)[rank - 2];
}

export function opponentTier(rank: number): 0 | 1 | 2 {
  return rank <= 3 ? 2 : rank <= 6 ? 1 : 0;
}

/** Records a win against the duellist above you. Returns your new rank. */
export function winLadderDuel(now = new Date()): number {
  const state = realmStore.get();
  const season = currentSeason(now);
  const rank = Math.max(1, yourRank(state, now) - 1);
  const best = state.progress.ladder.season === season ? Math.min(state.progress.ladder.best, rank) : rank;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, ladder: { season, rank, best } } }));
  const coins = 20 + (LADDER_SIZE + 1 - rank) * 6;
  addCoinsPublic(coins);
  emit({ type: "sound", name: "victory" });
  if (rank === 1) {
    bumpCounter("ladderChampion");
    chat(`You are the duelling club champion for ${season}. +${coins} coins.`, "quest");
  } else chat(`You climb to rank ${rank} in the duelling club. +${coins} coins.`, "quest");
  return rank;
}
