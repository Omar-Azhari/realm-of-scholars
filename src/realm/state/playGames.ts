/**
 * Scores for the play-world games (parkour, archery, ping pong…), shared by all of
 * them so they save and reward the same way:
 *
 *   if (!startPlay("archery")) return;            // pays the Focus to play
 *   const r = finishPlay("archery", score, { higherIsBetter: true, medals: [50, 100, 150] });
 *   // r.best, r.newBest, r.medal ("bronze" | "silver" | "gold" | null), r.coins
 *
 * Records live in progress.games (sanitised in store.ts). Rewards are coins only
 * (never study XP, never Focus), with a small daily cap per game, so play never
 * outpays studying.
 */

import { realmStore, todayIso } from "./store";
import { spendFocus } from "./focus";
import { emit, chat } from "./events";
import type { PlayRecord } from "../types";

/** Focus to start a round of a play-world game. */
export const PLAY_COST = 3;
/** Coins per medal, and the most coins one game pays in a day. */
export const MEDAL_COINS = { bronze: 10, silver: 20, gold: 35 } as const;
export const DAILY_COIN_CAP = 90;

export type Medal = keyof typeof MEDAL_COINS;

export function playRecord(gameId: string): PlayRecord {
  return realmStore.get().progress.games[gameId] ?? { best: null, plays: 0, medal: null, coinsDay: "", coinsToday: 0 };
}

/** Pays the Focus for a round. False (and a message) when there isn't enough. */
export function startPlay(gameId: string, cost = PLAY_COST): boolean {
  if (!spendFocus(cost, `play ${gameId}`)) return false;
  return true;
}

export interface PlayResult {
  best: number | null;
  newBest: boolean;
  medal: Medal | null;
  coins: number;
}

const ORDER: Medal[] = ["bronze", "silver", "gold"];

/**
 * Records a finished round. `medals` are the bronze/silver/gold thresholds (scores, or
 * times when lower is better). Pays coins for the medal earned (capped per day).
 */
export function finishPlay(gameId: string, score: number, opts: { higherIsBetter: boolean; medals?: [number, number, number] }): PlayResult {
  if (!Number.isFinite(score)) return { best: playRecord(gameId).best, newBest: false, medal: null, coins: 0 };
  const rec = playRecord(gameId);
  const better = (a: number, b: number | null) => b === null || (opts.higherIsBetter ? a > b : a < b);
  const newBest = better(score, rec.best);
  let medal: Medal | null = null;
  if (opts.medals) {
    opts.medals.forEach((threshold, i) => {
      if (opts.higherIsBetter ? score >= threshold : score <= threshold) medal = ORDER[i];
    });
  }
  const today = todayIso();
  const paidToday = rec.coinsDay === today ? rec.coinsToday : 0;
  const coins = medal ? Math.max(0, Math.min(MEDAL_COINS[medal as Medal], DAILY_COIN_CAP - paidToday)) : 0;
  const bestMedal = [rec.medal, medal].filter((m): m is Medal => m !== null).sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0] ?? null;
  realmStore.set((s) => ({
    ...s,
    progress: {
      ...s.progress,
      coins: s.progress.coins + coins,
      games: {
        ...s.progress.games,
        [gameId]: { best: newBest ? score : rec.best, plays: rec.plays + 1, medal: bestMedal, coinsDay: today, coinsToday: paidToday + coins },
      },
    },
  }));
  if (coins > 0) emit({ type: "sound", name: "coin" });
  if (newBest && rec.best !== null) chat("New personal best.", "quest");
  return { best: newBest ? score : rec.best, newBest, medal, coins };
}
