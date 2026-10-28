/**
 * Writes Arena results to the save: rating, record, personal bests and the
 * capped rewards. Answers also feed the study tools (weak-spot map and the
 * Grimoire), so playing still helps revision.
 */

import { realmStore, todayIso } from "../state/store";
import { addCoinsPublic, getSubject, grantXp, markStudyDay } from "../state/actions";
import { gainFocus } from "../state/focus";
import { recordAnswer } from "../state/stats";
import { recordMistake } from "../state/grimoire";
import { chat, emit } from "../state/events";
import type { ArenaGameId, ArenaProgress, RealmQuestion } from "../types";
import { emptyRecord, MAX_SCORE } from "./save";
import { ARENA_GAMES, clampRating, computeReward, rankFor, ratingDelta, rollSeason, seasonId, type ArenaReward, type ArenaRival, type MatchOutcome, type RankInfo } from "./rating";

/** A multiple-choice answer in any arena game: tallied for the weak-spot map; misses go to the Grimoire. */
export function arenaAnswer(subjectId: string, question: RealmQuestion, correct: boolean): void {
  recordAnswer(subjectId, question, correct);
  if (!correct) recordMistake(subjectId, question);
}

/** A non-question result tied to a week (a Connections group, a Sequence order): weak-spot map only. */
export function arenaWeekResult(subjectId: string, week: number | null, correct: boolean): void {
  recordAnswer(subjectId, { week }, correct);
}

function todayArena(arena: ArenaProgress): ArenaProgress {
  const date = todayIso();
  return arena.daily.date === date ? arena : { ...arena, daily: { date, xp: 0, coins: 0, focus: 0, played: [] } };
}

/** Whether today's ranked daily for this game and subject has been played. */
export function dailyPlayed(arena: ArenaProgress, game: ArenaGameId, subjectId: string): boolean {
  return arena.daily.date === todayIso() && arena.daily.played.includes(`${game}|${subjectId}`);
}

export interface MatchInput {
  game: ArenaGameId;
  subjectId: string;
  rival: ArenaRival;
  outcome: MatchOutcome;
  /** This match's score in the game's points. */
  score: number;
  /** Marks a daily puzzle as used (Lexicon). */
  daily?: boolean;
}

export interface MatchReport {
  outcome: MatchOutcome;
  before: number;
  after: number;
  delta: number;
  rankBefore: RankInfo;
  rankAfter: RankInfo;
  promoted: boolean;
  demoted: boolean;
  newBest: boolean;
  best: number;
  streak: number;
  reward: ArenaReward;
}

/** Records a finished ranked match. Ratings move only here, on a real win, loss or draw. */
export function finishArenaMatch(input: MatchInput): MatchReport {
  const state = realmStore.get();
  const season = seasonId();
  const arena = todayArena(rollSeason(state.progress.arena, season));
  const record = arena.games[input.game] ?? emptyRecord();
  const delta = ratingDelta(record.rating, input.rival.rating, input.outcome, record.games);
  const after = clampRating(record.rating + delta);
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(input.score)));
  const win = input.outcome === "win";
  const streak = win ? record.streak + 1 : 0;
  const next = {
    ...record,
    rating: after,
    peak: Math.max(record.peak, after),
    games: record.games + 1,
    wins: record.wins + (win ? 1 : 0),
    losses: record.losses + (input.outcome === "loss" ? 1 : 0),
    draws: record.draws + (input.outcome === "draw" ? 1 : 0),
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    best: Math.max(record.best, score),
    seasonPeak: Math.max(record.seasonPeak, after),
    seasonWins: record.seasonWins + (win ? 1 : 0),
  };
  const stronger = input.rival.rating > record.rating;
  const reward = getSubject(state, input.subjectId) ? computeReward(arena.daily, input.outcome, stronger) : { xp: 0, coins: 0, focus: 0, capped: false };
  const played = input.daily && !arena.daily.played.includes(`${input.game}|${input.subjectId}`) ? [...arena.daily.played, `${input.game}|${input.subjectId}`] : arena.daily.played;
  realmStore.set((s) => ({
    ...s,
    progress: {
      ...s.progress,
      arena: {
        ...arena,
        games: { ...arena.games, [input.game]: next },
        daily: { ...arena.daily, xp: arena.daily.xp + reward.xp, coins: arena.daily.coins + reward.coins, focus: arena.daily.focus + reward.focus, played },
      },
    },
  }));

  const rankBefore = rankFor(record.rating);
  const rankAfter = rankFor(after);
  const order = (r: RankInfo) => r.tier.min * 10 + (r.division === null ? 9 : 4 - r.division);
  const promoted = order(rankAfter) > order(rankBefore);
  const demoted = order(rankAfter) < order(rankBefore);
  const newBest = score > record.best && score > 0;
  const name = ARENA_GAMES[input.game].name;

  if (reward.xp > 0) grantXp(input.subjectId, reward.xp);
  if (reward.coins > 0) addCoinsPublic(reward.coins);
  if (reward.focus > 0) gainFocus(reward.focus, `an arena upset over ${input.rival.name}`);
  if (win) markStudyDay();
  emit({ type: "sound", name: win ? "victory" : input.outcome === "draw" ? "coin" : "defeat" });
  if (promoted) {
    emit({ type: "sound", name: "level" });
    chat(`${name}: promoted to ${rankAfter.label} (${after}).`, "level");
  }
  chat(
    `${name} vs ${input.rival.name}: ${win ? "victory" : input.outcome === "draw" ? "a draw" : "defeat"}. Rating ${record.rating} to ${after} (${delta >= 0 ? "+" : ""}${delta}).${newBest ? " New personal best." : ""}`,
    "game",
  );
  return { outcome: input.outcome, before: record.rating, after, delta, rankBefore, rankAfter, promoted, demoted, newBest, best: next.best, streak, reward };
}
