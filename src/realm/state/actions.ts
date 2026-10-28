/**
 * Game rules. Every way the player earns progress goes through here so
 * XP, levels, quest points and graduation stay consistent.
 */

import { addDays, realmStore, todayIso, createEmptyProgress } from "./store";
import { gainFocus } from "./focus";
import { FOCUS } from "../life/catalog";
import { comfortFocusBonus } from "../dorm/dorm";
import { buffActive, INSIGHT_BONUS } from "../life/potions";
import { familiarLevel, STUDY_FOCUS_BONUS } from "../customise/familiar";
import { recentClass } from "../curriculum/timetable";
import { chat, emit } from "./events";
import {
  DAILY_FULL_XP_WINS,
  XP_REWARDS,
  levelForXp,
  questCompletionXp,
  questPointsFor,
} from "../xp";
import type {
  InventoryItem,
  ItemId,
  QuestProgress,
  RealmAssessment,
  RealmCurriculum,
  RealmPlayer,
  RealmState,
  RealmSubject,
} from "../types";

export function getSubject(state: RealmState, subjectId: string): RealmSubject | undefined {
  return state.curriculum?.subjects.find((s) => s.id === subjectId);
}

export function findAssessment(state: RealmState, assessmentId: string): { subject: RealmSubject; assessment: RealmAssessment } | null {
  for (const subject of state.curriculum?.subjects ?? []) {
    const assessment = subject.assessments.find((a) => a.id === assessmentId);
    if (assessment) return { subject, assessment };
  }
  return null;
}

export function questProgress(state: RealmState, assessment: RealmAssessment): QuestProgress {
  return (
    state.progress.quests[assessment.id] ?? {
      status: "not-started",
      stepsDone: assessment.steps.map(() => false),
      stepsRewarded: assessment.steps.map(() => false),
      completedAt: null,
    }
  );
}

function addItem(inventory: InventoryItem[], item: Omit<InventoryItem, "quantity">, quantity = 1): InventoryItem[] {
  const index = inventory.findIndex((i) => i.id === item.id && i.subjectId === item.subjectId && i.name === item.name);
  if (index >= 0) {
    const copy = inventory.slice();
    copy[index] = { ...copy[index], quantity: copy[index].quantity + quantity };
    return copy;
  }
  if (inventory.length >= 28) {
    chat("Your inventory is too full to hold any more items.");
    return inventory;
  }
  return [...inventory, { ...item, quantity }];
}

/** Adds XP to a skill and announces drops/level-ups. Returns the new level. */
export const RESTED_BONUS = 1.1;
export const RESTED_HOURS = 4;

export function isRested(state: RealmState, now = Date.now()): boolean {
  const until = state.progress.rest.until;
  return Boolean(until) && Date.parse(until!) > now;
}

/** Sleeping in the dorm bed: once per day, heals and grants the well-rested bonus. Returns false if already slept today. */
export function restInBed(now = new Date()): boolean {
  const state = realmStore.get();
  const day = todayIso();
  if (state.progress.rest.lastDay === day) {
    chat("You've already rested today. Get some study done. The bed will be here tonight.");
    return false;
  }
  const until = new Date(now.getTime() + RESTED_HOURS * 3600_000).toISOString();
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, rest: { lastDay: day, until } } }));
  emit({ type: "sound", name: "quest" });
  chat(`You rest in your own bed. Well rested: +${Math.round((RESTED_BONUS - 1) * 100)}% study XP for the next ${RESTED_HOURS} hours.`, "quest");
  return true;
}

export function grantXp(subjectId: string, amount: number): number {
  const state = realmStore.get();
  const subject = getSubject(state, subjectId);
  if (!subject || amount <= 0) return levelForXp(state.progress.skillXp[subjectId] ?? 0);
  // A night in the dorm bed leaves you "well rested": +10% study XP for a few hours.
  if (isRested(state)) amount *= RESTED_BONUS;
  if (buffActive(state, "insight")) amount *= INSIGHT_BONUS;
  const before = state.progress.skillXp[subjectId] ?? 0;
  const after = before + Math.round(amount);
  const oldLevel = levelForXp(before);
  const newLevel = levelForXp(after);
  realmStore.set((s) => ({
    ...s,
    progress: { ...s.progress, skillXp: { ...s.progress.skillXp, [subjectId]: after } },
  }));
  emit({ type: "xp-drop", subjectId, amount: Math.round(amount) });
  if (newLevel > oldLevel) {
    emit({ type: "level-up", subjectId, skillName: subject.name, level: newLevel });
    emit({ type: "sound", name: "level" });
    chat(
      newLevel - oldLevel > 1
        ? `Congratulations, you've just advanced ${newLevel - oldLevel} ${subject.name} levels. You are now level ${newLevel}.`
        : `Congratulations, you've just advanced ${/^[aeiou]/i.test(subject.name) ? "an" : "a"} ${subject.name} level. You are now level ${newLevel}.`,
      "level",
    );
  }
  return newLevel;
}

function addCoins(amount: number): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, coins: s.progress.coins + amount } }));
}

function giveItem(id: ItemId, name: string, subjectId: string | null, quantity = 1): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, inventory: addItem(s.progress.inventory, { id, name, subjectId }, quantity) } }));
}

/** Today's counters, reset when the date changes. */
function today(daily: RealmState["progress"]["daily"]): RealmState["progress"]["daily"] {
  const date = todayIso();
  return daily.date === date ? daily : { date, wins: {}, studied: 0, steps: 0, claimed: false };
}

function bumpDaily(field: "studied" | "steps"): void {
  realmStore.set((s) => {
    const d = today(s.progress.daily);
    return { ...s, progress: { ...s.progress, daily: { ...d, [field]: (d[field] ?? 0) + 1 } } };
  });
}

export interface DailyChallenge {
  label: string;
  done: boolean;
  progress: string;
}

export const DAILY_REWARD_COINS = 150;

export function dailyChallenges(state: RealmState): { items: DailyChallenge[]; claimed: boolean; complete: boolean } {
  const d = today(state.progress.daily);
  const wins = Object.values(d.wins).reduce((a, b) => a + b, 0);
  const items: DailyChallenge[] = [
    { label: "Study a week's material at any waystone", done: (d.studied ?? 0) >= 1, progress: `${Math.min(1, d.studied ?? 0)}/1` },
    { label: "Win two trials, duels or study games", done: wins >= 2, progress: `${Math.min(2, wins)}/2` },
    { label: "Complete a step of any quest (a real assessment task)", done: (d.steps ?? 0) >= 1, progress: `${Math.min(1, d.steps ?? 0)}/1` },
  ];
  return { items, claimed: d.claimed === true, complete: items.every((i) => i.done) };
}

export function claimDaily(): boolean {
  const status = dailyChallenges(realmStore.get());
  if (!status.complete || status.claimed) return false;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, daily: { ...today(s.progress.daily), claimed: true } } }));
  addCoins(DAILY_REWARD_COINS);
  giveItem("xp-lamp", "Lamp of Insight", null);
  const cosy = comfortFocusBonus(realmStore.get().progress.dorm);
  gainFocus(FOCUS.earn.dailyClaim + cosy, "daily challenges");
  emit({ type: "sound", name: "quest" });
  chat(
    `The fountain glows. Daily challenges complete: +${DAILY_REWARD_COINS} coins and a Lamp of Insight.${cosy > 0 ? ` Your cosy dorm adds +${cosy} Focus.` : ""}`,
    "quest",
  );
  return true;
}

/** Spends coins if the player has enough. */
export function spendCoins(amount: number): boolean {
  if (realmStore.get().progress.coins < amount) {
    chat("You don't have enough coins.");
    return false;
  }
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, coins: s.progress.coins - amount } }));
  emit({ type: "sound", name: "coin" });
  return true;
}

export function weekKey(subjectId: string, week: number): string {
  return `${subjectId}:${week}`;
}

export function studyWeek(subjectId: string, week: number): void {
  const state = realmStore.get();
  const subject = getSubject(state, subjectId);
  const info = subject?.weeks.find((w) => w.week === week);
  if (!subject || !info) return;
  const key = weekKey(subjectId, week);
  const existing = state.progress.weeks[key];
  if (existing?.studiedAt) {
    chat(`You re-read your notes on "${info.title}". The waystone's trials still await.`);
    return;
  }
  realmStore.set((s) => ({
    ...s,
    progress: { ...s.progress, weeks: { ...s.progress.weeks, [key]: { studiedAt: new Date().toISOString(), minigamesWon: existing?.minigamesWon ?? 0 } } },
  }));
  emit({ type: "sound", name: "study" });
  bumpDaily("studied");
  chat(`You study Week ${week}: ${info.title}.`);
  giveItem("tome", `Tome of ${subject.name}`, subjectId);
  grantXp(subjectId, XP_REWARDS.studyWeek);
  gainFocus(FOCUS.earn.studyWeek + (familiarLevel(realmStore.get()) >= 4 ? STUDY_FOCUS_BONUS : 0), "studying a week");
  classFollowUp(subjectId);
  markStudyDay();
  checkGraduation();
}

export function setQuestStep(assessmentId: string, stepIndex: number, done: boolean): void {
  const state = realmStore.get();
  const found = findAssessment(state, assessmentId);
  if (!found) return;
  const { subject, assessment } = found;
  const current = questProgress(state, assessment);
  if (current.status === "complete") return;
  const stepsDone = assessment.steps.map((_, i) => (i === stepIndex ? done : current.stepsDone[i] ?? false));
  const stepsRewarded = assessment.steps.map((_, i) => current.stepsRewarded?.[i] ?? false);
  const payStep = done && !stepsRewarded[stepIndex];
  if (payStep) stepsRewarded[stepIndex] = true;
  const started = current.status === "not-started" && stepsDone.some(Boolean);
  const allDone = stepsDone.every(Boolean);

  realmStore.set((s) => ({
    ...s,
    progress: {
      ...s.progress,
      quests: {
        ...s.progress.quests,
        [assessmentId]: { status: allDone ? "complete" : stepsDone.some(Boolean) ? "in-progress" : current.status, stepsDone, stepsRewarded, completedAt: current.completedAt },
      },
    },
  }));

  if (started) chat(`You've started a new quest: ${assessment.title}.`, "quest");
  if (payStep) {
    bumpDaily("steps");
    grantXp(subject.id, XP_REWARDS.questStep);
    gainFocus(FOCUS.earn.questStep, "a quest step");
    markStudyDay();
  }
  if (allDone) completeQuest(assessmentId);
}

function completeQuest(assessmentId: string): void {
  const state = realmStore.get();
  const found = findAssessment(state, assessmentId);
  if (!found) return;
  const { subject, assessment } = found;
  const points = questPointsFor(assessment.weightPercent);
  const xp = questCompletionXp(assessment.weightPercent);
  realmStore.set((s) => ({
    ...s,
    progress: {
      ...s.progress,
      questPoints: s.progress.questPoints + points,
      quests: {
        ...s.progress.quests,
        [assessmentId]: { ...s.progress.quests[assessmentId], status: "complete", completedAt: new Date().toISOString() },
      },
    },
  }));
  emit({ type: "quest-complete", assessmentId, title: assessment.title, questPoints: points, xp, skillName: subject.name });
  emit({ type: "sound", name: "quest" });
  chat(`Quest complete: ${assessment.title}. (+${points} Quest Points)`, "quest");
  addCoins(points * 60);
  giveItem("xp-lamp", "Lamp of Insight", null);
  grantXp(subject.id, xp);
  checkGraduation();
}

export function recordMinigameWin(subjectId: string, baseXp: number, week: number | null, label: string): number {
  const state = realmStore.get();
  if (!getSubject(state, subjectId)) return 0;
  const today = todayIso();
  const daily = state.progress.daily.date === today ? state.progress.daily : { date: today, wins: {}, studied: 0, steps: 0, claimed: false };
  const winsToday = daily.wins[subjectId] ?? 0;
  const xp = Math.round(baseXp * (winsToday < DAILY_FULL_XP_WINS ? 1 : 0.5));
  realmStore.set((s) => {
    const weeks = { ...s.progress.weeks };
    if (week !== null) {
      const key = weekKey(subjectId, week);
      const existing = weeks[key] ?? { studiedAt: null, minigamesWon: 0 };
      weeks[key] = { ...existing, minigamesWon: existing.minigamesWon + 1 };
    }
    return {
      ...s,
      progress: { ...s.progress, weeks, coins: s.progress.coins + 5, daily: { ...daily, date: today, wins: { ...daily.wins, [subjectId]: winsToday + 1 } } },
    };
  });
  if (winsToday === DAILY_FULL_XP_WINS) {
    chat("You feel the lesson sinking in less deeply. Rest, or try a different subject. Trials give half experience for the rest of today.");
  }
  chat(`You triumph at ${label}.`);
  grantXp(subjectId, xp);
  gainFocus(FOCUS.earn.studyGameWin, "a study win");
  markStudyDay();
  return xp;
}

export function rubLamp(itemIndex: number, subjectId: string): void {
  const state = realmStore.get();
  const item = state.progress.inventory[itemIndex];
  if (!item || item.id !== "xp-lamp" || !getSubject(state, subjectId)) return;
  const level = levelForXp(state.progress.skillXp[subjectId] ?? 0);
  realmStore.set((s) => {
    const inventory = s.progress.inventory.slice();
    if (inventory[itemIndex].quantity > 1) inventory[itemIndex] = { ...inventory[itemIndex], quantity: inventory[itemIndex].quantity - 1 };
    else inventory.splice(itemIndex, 1);
    return { ...s, progress: { ...s.progress, inventory } };
  });
  chat("You rub the lamp. Insight floods your mind.");
  grantXp(subjectId, Math.max(100, level * XP_REWARDS.xpLampPerLevel));
}

export function startFocus(subjectId: string, minutes: number, room?: { name: string; members: string[] }): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, activeFocus: { subjectId, minutes, startedAt: new Date().toISOString(), ...(room ? { room } : {}) } } }));
  chat(room ? `You settle into ${room.name}${room.members.length ? ` with ${room.members.join(", ")}` : ""} for ${minutes} minutes.` : `You begin a ${minutes}-minute meditation. Stay focused on your studies.`);
}

/** Studying a subject during or soon after its class (from the imported timetable) pays 5 Focus, once per class per day. */
export const CLASS_FOLLOW_UP_FOCUS = 5;
export function classFollowUp(subjectId: string, now = new Date()): boolean {
  const state = realmStore.get();
  const cls = recentClass(state.progress.timetable, subjectId, now);
  if (!cls) return false;
  const key = `${todayIso()}|${cls.key}`;
  if (state.progress.classClaims.includes(key)) return false;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, classClaims: [...s.progress.classClaims, key].slice(-30) } }));
  gainFocus(CLASS_FOLLOW_UP_FOCUS, `following up ${cls.title}`);
  chat(`Class follow-up: studying right after ${cls.title} earns +${CLASS_FOLLOW_UP_FOCUS} Focus.`, "quest");
  return true;
}

export function cancelFocus(): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, activeFocus: null } }));
  chat("Your concentration breaks. The meditation ends without reward.");
}

/** Pays out only when the real time has actually elapsed. */
export function completeFocus(): boolean {
  const state = realmStore.get();
  const focus = state.progress.activeFocus;
  if (!focus) return false;
  const elapsedMs = Date.now() - new Date(focus.startedAt).getTime();
  if (elapsedMs < focus.minutes * 60_000 - 2000) return false;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, activeFocus: null, focusMinutes: s.progress.focusMinutes + focus.minutes } }));
  emit({ type: "sound", name: "victory" });
  chat(`Your ${focus.minutes}-minute meditation is complete.`);
  const roomBonus = 1 + Math.min(3, focus.room?.members.length ?? 0) * 0.1;
  grantXp(focus.subjectId, focus.minutes * XP_REWARDS.focusPerMinute * roomBonus);
  classFollowUp(focus.subjectId);
  gainFocus(focus.minutes * FOCUS.earn.meditationMinute, "focused study");
  markStudyDay();
  return true;
}

export function dropItem(itemIndex: number): void {
  realmStore.set((s) => {
    const inventory = s.progress.inventory.slice();
    inventory.splice(itemIndex, 1);
    return { ...s, progress: { ...s.progress, inventory } };
  });
}

/** Graduation: every quest complete (subjects with no assessments need every week studied instead). */
export function graduationStatus(state: RealmState): { done: number; total: number; ready: boolean } {
  let done = 0;
  let total = 0;
  for (const subject of state.curriculum?.subjects ?? []) {
    if (subject.assessments.length > 0) {
      for (const assessment of subject.assessments) {
        total++;
        if (state.progress.quests[assessment.id]?.status === "complete") done++;
      }
    } else {
      for (const week of subject.weeks) {
        total++;
        if (state.progress.weeks[weekKey(subject.id, week.week)]?.studiedAt) done++;
      }
    }
  }
  return { done, total, ready: total > 0 && done === total };
}

function checkGraduation(): void {
  const state = realmStore.get();
  if (state.progress.graduatedAt) return;
  if (!graduationStatus(state).ready) return;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, graduatedAt: new Date().toISOString() } }));
  giveItem("graduation-cape", "Graduation Cape", null);
  emit({ type: "graduated" });
  chat("The bells of the Citadel ring out. You have completed every quest of the semester. Visit the Great Hall to claim your graduation.", "quest");
}

export function setPlayer(player: RealmPlayer): void {
  realmStore.set((s) => ({ ...s, player }));
}

/** A new semester starts fresh, but the adventurer keeps their wardrobe, streak and study group. */
function freshProgressKeepingPlayer(old: RealmState["progress"]): RealmState["progress"] {
  // Life skills, gear and materials belong to the adventurer, not the semester.
  return {
    ...createEmptyProgress(),
    wardrobe: old.wardrobe,
    dorm: old.dorm,
    voyages: old.voyages,
    mail: old.mail,
    ladder: old.ladder,
    // Arena ratings are the player's skill, not the semester's.
    arena: old.arena,
    games: old.games,
    timetable: old.timetable,
    streak: old.streak,
    group: old.group,
    achievements: old.achievements,
    title: old.title,
    counters: old.counters,
    lifeXp: old.lifeXp,
    materials: old.materials,
    weapons: old.weapons,
    weapon: old.weapon,
    focus: old.focus,
  };
}

export function setCurriculum(curriculum: RealmCurriculum): void {
  realmStore.set((s) => ({ ...s, curriculum, progress: freshProgressKeepingPlayer(s.progress) }));
}

export function resetRealm(): void {
  realmStore.set((s) => ({ ...s, curriculum: null, progress: freshProgressKeepingPlayer(s.progress) }));
}

/** Replaces one subject's data (e.g. new questions from lecture slides) without touching progress. */
export function updateSubject(subjectId: string, update: (subject: RealmSubject) => RealmSubject): void {
  realmStore.set((s) => {
    if (!s.curriculum) return s;
    return { ...s, curriculum: { ...s.curriculum, subjects: s.curriculum.subjects.map((sub) => (sub.id === subjectId ? update(sub) : sub)) } };
  });
}

/** Replaces the questions written from one week's lecture slides (ids "<subject>-s<week>-N"). */
export function setSlideQuestions(subjectId: string, week: number, questions: RealmSubject["questions"]): void {
  const prefix = `${subjectId}-s${week}-`;
  updateSubject(subjectId, (s) => ({ ...s, questions: [...s.questions.filter((q) => !q.id.startsWith(prefix)), ...questions.map((q) => ({ ...q, week }))] }));
}

// ---------------------------------------------------------------------------
// Study streak
// ---------------------------------------------------------------------------

export const STREAK_BONUS_COINS = 300;

/** Records a day of real study. Every 7th day in a row pays a bonus. */
export function markStudyDay(): void {
  const state = realmStore.get();
  const today = todayIso();
  const streak = state.progress.streak;
  if (streak.lastDay === today) return;
  const current = streak.lastDay === addDays(today, -1) ? streak.current + 1 : 1;
  const best = Math.max(streak.best, current);
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, streak: { current, best, lastDay: today } } }));
  if (current % 7 === 0) {
    addCoins(STREAK_BONUS_COINS);
    giveItem("xp-lamp", "Lamp of Insight", null);
    emit({ type: "sound", name: "quest" });
    chat(`${current}-day study streak. +${STREAK_BONUS_COINS} coins and a Lamp of Insight.`, "quest");
  } else if (current > 1) {
    chat(`Study streak: ${current} days. ${7 - (current % 7)} more for the weekly bonus.`);
  }
}

/** The streak as it stands today: it lapses if yesterday had no study. */
export function liveStreak(state: RealmState): number {
  const { lastDay, current } = state.progress.streak;
  const today = todayIso();
  return lastDay === today || lastDay === addDays(today, -1) ? current : 0;
}

export function addCoinsPublic(amount: number): void {
  addCoins(amount);
}

export function giveItemPublic(id: ItemId, name: string, subjectId: string | null, quantity = 1): void {
  giveItem(id, name, subjectId, quantity);
}

/**
 * First teaching day: the enrolment's own, or worked out from any quest that
 * has both a due week and a real due date (e.g. after a Moodle import) —
 * Week N's Friday minus (N-1) weeks and four days. Null when unknown.
 */
export function effectiveStartDate(curriculum: RealmCurriculum | null): string | null {
  if (!curriculum) return null;
  if (curriculum.enrolment.startDate && /^\d{4}-\d{2}-\d{2}$/.test(curriculum.enrolment.startDate)) return curriculum.enrolment.startDate;
  const guesses: string[] = [];
  for (const subject of curriculum.subjects) {
    for (const a of subject.assessments) {
      if (a.dueWeek !== null && a.dueWeek >= 1 && a.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) guesses.push(addDays(a.dueDate, -((a.dueWeek - 1) * 7 + 4)));
    }
  }
  if (guesses.length === 0) return null;
  guesses.sort();
  return guesses[Math.floor(guesses.length / 2)];
}

/** Due date as YYYY-MM-DD: exact, or the Friday of the due week when the semester start is known. */
export function resolvedDueDate(assessment: RealmAssessment, curriculum: RealmCurriculum | null): string | null {
  if (assessment.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(assessment.dueDate)) return assessment.dueDate;
  const monday = teachingWeekMonday(curriculum, assessment.dueWeek);
  return monday ? addDays(monday, 4) : null;
}

/** Monday of teaching week `week` (1-based), skipping break weeks such as the mid-semester break. */
export function teachingWeekMonday(curriculum: RealmCurriculum | null, week: number | null): string | null {
  const start = effectiveStartDate(curriculum);
  if (week === null || week < 1 || !start) return null;
  const breaks = new Set(curriculum?.enrolment.breakWeeks ?? []);
  let monday = start;
  let counted = 0;
  for (let i = 0; i < 60; i++) {
    if (!breaks.has(monday)) {
      counted++;
      if (counted === week) return monday;
    }
    monday = addDays(monday, 7);
  }
  return null;
}

/** The current teaching week (during a break, the last week taught), or null outside the semester. */
export function currentTeachingWeek(curriculum: RealmCurriculum | null, today: string = todayIso()): number | null {
  const start = effectiveStartDate(curriculum);
  if (!start || Number.isNaN(new Date(`${start}T00:00:00`).getTime()) || today < start) return null;
  const breaks = new Set(curriculum?.enrolment.breakWeeks ?? []);
  let monday = start;
  let week = 0;
  for (let i = 0; i < 60 && monday <= today; i++) {
    if (!breaks.has(monday)) week++;
    monday = addDays(monday, 7);
  }
  return week >= 1 && week <= 20 ? week : null;
}

/** True during the official exam period, or from teaching week 13 when the period isn't known. */
export function inExamPeriod(curriculum: RealmCurriculum | null, today: string = todayIso()): boolean {
  const period = curriculum?.enrolment.examPeriod;
  if (period) return today >= addDays(period.start, -7) && today <= period.end;
  const week = currentTeachingWeek(curriculum, today);
  return week !== null && week >= 13 && week <= 17;
}
