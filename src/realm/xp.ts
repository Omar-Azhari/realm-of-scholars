/**
 * Skill levels 1-99 on a curve shaped like RuneScape's: a steady polynomial
 * climb blended with the classic exponential curve, so the last levels are
 * the hardest. Tuned for one semester: studying a week reaches about
 * level 5; completing every quest and week of a typical subject lands
 * around level 65-70; the final climb to 99 (60,000 XP) comes from
 * sustained mastery — mini-games and real focus sessions.
 */

export const MAX_LEVEL = 99;
const RS_LEVEL_99 = 13_034_431;
const TARGET_LEVEL_99 = 60_000;
const POLY_WEIGHT = 25;
const SCALE = (TARGET_LEVEL_99 - POLY_WEIGHT * Math.pow(MAX_LEVEL - 1, 1.5)) / RS_LEVEL_99;

function rsXpForLevel(level: number): number {
  let points = 0;
  for (let n = 1; n < level; n++) {
    points += Math.floor(n + 300 * Math.pow(2, n / 7));
  }
  return Math.floor(points / 4);
}

const XP_TABLE: number[] = (() => {
  const table = [0, 0];
  for (let level = 2; level <= MAX_LEVEL; level++) {
    table[level] = Math.round(POLY_WEIGHT * Math.pow(level - 1, 1.5) + rsXpForLevel(level) * SCALE);
  }
  return table;
})();

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return XP_TABLE[Math.min(MAX_LEVEL, level)];
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= XP_TABLE[level + 1]) level++;
  return level;
}

/** 0-1 progress through the current level. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const start = XP_TABLE[level];
  const end = XP_TABLE[level + 1];
  return (xp - start) / (end - start);
}

export function xpToNextLevel(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 0;
  return XP_TABLE[level + 1] - xp;
}

/** XP rewards — one place to tune the economy. */
export const XP_REWARDS = {
  studyWeek: 220,
  questStep: 120,
  /** Base for finishing a quest; weight adds on top. */
  questComplete: 1500,
  questWeightMultiplier: 110,
  quizDuelWin: 140,
  quizDuelPerCorrect: 18,
  scrollMatch: 110,
  runeScramblePerWord: 30,
  focusPerMinute: 9,
  xpLampPerLevel: 40,
} as const;

/** After this many mini-game wins per subject per day, mini-game XP halves — real study always pays best. */
export const DAILY_FULL_XP_WINS = 6;

export function questCompletionXp(weightPercent: number | null): number {
  const weight = weightPercent ?? 20;
  return XP_REWARDS.questComplete + Math.round(weight * XP_REWARDS.questWeightMultiplier);
}

export function questPointsFor(weightPercent: number | null): number {
  const weight = weightPercent ?? 20;
  if (weight >= 40) return 4;
  if (weight >= 25) return 3;
  if (weight >= 10) return 2;
  return 1;
}
