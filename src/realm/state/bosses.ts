/**
 * Deadline bosses. Each assessment has a boss that rises one week before it
 * is due and stays until the quest is complete or the boss is beaten (up to
 * a week after the deadline, for extensions). Beating it means answering
 * hard questions on everything that assessment covers.
 *
 * When the exact due date is unknown, the teaching week is used; when that
 * is unknown too, the boss of the subject's next unfinished quest is awake.
 */

import { addDays, realmStore, todayIso } from "./store";
import { chat, emit } from "./events";
import { currentTeachingWeek, findAssessment, inExamPeriod, giveItemPublic, addCoinsPublic, grantXp, markStudyDay, questProgress, resolvedDueDate } from "./actions";

export { resolvedDueDate };
import { gainFocus } from "./focus";
import { FOCUS } from "../life/catalog";
import type { RealmAssessment, RealmState, RealmSubject } from "../types";

export const BOSS_WINDOW_DAYS = 7;
export const BOSS_XP = 650;
export const BOSS_COINS = 200;

export type BossStatus =
  | { awake: true; daysLeft: number | null; reason: string }
  | { awake: false; reason: string; risesOn: string | null };

/**
 * Exam-week siege: every boss wakes at once. It runs from two weeks before
 * the first unfinished exam, and through the official exam period (from a week before it; from
 * teaching week 13 when the period isn't known).
 */
export const SIEGE_DAYS = 14;
export const SIEGE_BONUS_COINS = 1000;

export function siegeActive(state: RealmState, today: string = todayIso()): boolean {
  if (inExamPeriod(state.curriculum, today)) return true;
  for (const subject of state.curriculum?.subjects ?? []) {
    for (const a of subject.assessments) {
      if (a.kind !== "exam" || questProgress(state, a).status === "complete") continue;
      const due = resolvedDueDate(a, state.curriculum);
      if (due && due >= today && due <= addDays(today, SIEGE_DAYS)) return true;
    }
  }
  return false;
}

export function bossStatus(state: RealmState, subject: RealmSubject, assessment: RealmAssessment, today: string = todayIso()): BossStatus {
  if (questProgress(state, assessment).status === "complete") return { awake: false, reason: "The quest is complete. Its boss has fled.", risesOn: null };
  if (state.progress.bosses[assessment.id]) return { awake: false, reason: "You have already beaten this boss.", risesOn: null };
  const due = resolvedDueDate(assessment, state.curriculum);
  if (siegeActive(state, today) && !(due && today > addDays(due, BOSS_WINDOW_DAYS))) {
    return { awake: true, daysLeft: due ? Math.round((new Date(`${due}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000) : null, reason: "Exam-week siege: every boss is awake." };
  }
  if (due) {
    const rises = addDays(due, -BOSS_WINDOW_DAYS);
    const fades = addDays(due, BOSS_WINDOW_DAYS);
    const daysLeft = Math.round((new Date(`${due}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
    if (today < rises) return { awake: false, reason: `It rises on ${rises}, one week before the deadline.`, risesOn: rises };
    if (today > fades) return { awake: false, reason: "The deadline has long passed; the boss has faded.", risesOn: null };
    return { awake: true, daysLeft, reason: daysLeft >= 0 ? `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.` : `Overdue by ${-daysLeft} day${daysLeft === -1 ? "" : "s"}.` };
  }
  const week = currentTeachingWeek(state.curriculum);
  if (assessment.dueWeek !== null && week !== null) {
    if (week >= assessment.dueWeek - 1 && week <= assessment.dueWeek + 1) return { awake: true, daysLeft: null, reason: `Due in Week ${assessment.dueWeek}.` };
    return { awake: false, reason: `It rises in Week ${assessment.dueWeek - 1}, one week before the deadline.`, risesOn: null };
  }
  // No dates at all: the next unfinished quest of this subject keeps its boss awake.
  const next = subject.assessments.find((a) => questProgress(state, a).status !== "complete" && !state.progress.bosses[a.id]);
  if (next?.id === assessment.id) return { awake: true, daysLeft: null, reason: "No due date is recorded, so this boss guards your next quest." };
  return { awake: false, reason: "It waits behind your earlier quests.", risesOn: null };
}

/** The awake boss in a subject's lair, if any (soonest deadline first). */
export function activeBoss(state: RealmState, subject: RealmSubject): { assessment: RealmAssessment; status: Extract<BossStatus, { awake: true }> } | null {
  const awake = subject.assessments
    .map((assessment) => ({ assessment, status: bossStatus(state, subject, assessment) }))
    .filter((x): x is { assessment: RealmAssessment; status: Extract<BossStatus, { awake: true }> } => x.status.awake);
  awake.sort((a, b) => (a.status.daysLeft ?? 99) - (b.status.daysLeft ?? 99));
  return awake[0] ?? null;
}

/** The weeks a boss asks about: every week up to the assessment's due week (all weeks when unknown). */
export function bossWeeks(subject: RealmSubject, assessment: RealmAssessment): number[] {
  const all = subject.weeks.map((w) => w.week);
  if (assessment.dueWeek === null) return all;
  const covered = all.filter((w) => w <= assessment.dueWeek!);
  return covered.length >= 2 ? covered : all;
}

export function bossName(assessment: RealmAssessment): string {
  switch (assessment.kind) {
    case "exam":
    case "quiz":
      return "The Examiner Lich";
    case "essay":
    case "report":
      return "The Blank-Page Wraith";
    case "presentation":
      return "The Stage-Fright Revenant";
    case "project":
    case "lab":
      return "The Deadline Warlord";
    default:
      return "The Deadline Revenant";
  }
}

/** Mage skeleton for written work, warrior for everything else. */
export function bossModel(assessment: RealmAssessment): "skeleton_mage" | "skeleton_warrior" {
  return assessment.kind === "essay" || assessment.kind === "report" || assessment.kind === "presentation" ? "skeleton_mage" : "skeleton_warrior";
}

export function defeatBoss(assessmentId: string): void {
  const state = realmStore.get();
  const found = findAssessment(state, assessmentId);
  if (!found || state.progress.bosses[assessmentId]) return;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, bosses: { ...s.progress.bosses, [assessmentId]: new Date().toISOString() } } }));
  emit({ type: "sound", name: "quest" });
  chat(`${bossName(found.assessment)} crumbles to dust. You are ready for ${found.assessment.title}. (+${BOSS_COINS} coins)`, "quest");
  addCoinsPublic(BOSS_COINS);
  giveItemPublic("xp-lamp", "Lamp of Insight", null);
  grantXp(found.subject.id, BOSS_XP);
  gainFocus(FOCUS.earn.bossWin, "beating a deadline boss");
  markStudyDay();
  checkSiegeCleared();
}

/** During a siege, clearing every remaining boss pays a one-off bonus. */
export function checkSiegeCleared(): boolean {
  const state = realmStore.get();
  if (state.progress.siegeClaimed || !siegeActive(state)) return false;
  const subjects = state.curriculum?.subjects ?? [];
  const anyAwake = subjects.some((s) => activeBoss(state, s) !== null);
  const anyBeaten = Object.keys(state.progress.bosses).length > 0;
  if (anyAwake || !anyBeaten) return false;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, siegeClaimed: true } }));
  addCoinsPublic(SIEGE_BONUS_COINS);
  emit({ type: "sound", name: "level" });
  chat(`The siege is broken. Every boss has fallen. +${SIEGE_BONUS_COINS} coins.`, "quest");
  return true;
}
