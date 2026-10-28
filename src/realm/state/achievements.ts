/**
 * Achievements log. Each achievement is a rule over the saved progress, so
 * nothing can be unlocked without the real study behind it. Some grant a
 * title the player can show above their head.
 */

import { realmStore } from "./store";
import { chat, emit } from "./events";
import { liveStreak, weekKey } from "./actions";
import { levelForXp } from "../xp";
import { comfort } from "../dorm/dorm";
import { houseStandings } from "../customise/houses";
import { resolveOutfit } from "../customise/outfit";
import type { RealmState } from "../types";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Title unlocked with it, shown as "Name the Diligent". */
  title?: string;
  met: (s: RealmState) => boolean;
}

const studiedCount = (s: RealmState) => Object.values(s.progress.weeks).filter((w) => w.studiedAt).length;
const questsDone = (s: RealmState) => Object.values(s.progress.quests).filter((q) => q.status === "complete").length;
const maxLevel = (s: RealmState) => Math.max(1, ...(s.curriculum?.subjects ?? []).map((sub) => levelForXp(s.progress.skillXp[sub.id] ?? 0)));
const bestMock = (s: RealmState) => Math.max(0, ...s.progress.mockExams.map((m) => (m.total > 0 ? m.right / m.total : 0)));
const counter = (s: RealmState, name: string) => s.progress.counters[name] ?? 0;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-steps", name: "First steps", description: "Study your first waystone.", met: (s) => studiedCount(s) >= 1 },
  { id: "scholar-10", name: "Well read", description: "Study 10 waystones.", title: "the Well-Read", met: (s) => studiedCount(s) >= 10 },
  {
    id: "full-path",
    name: "The whole path",
    description: "Study every waystone of one subject.",
    met: (s) => (s.curriculum?.subjects ?? []).some((sub) => sub.weeks.length > 0 && sub.weeks.every((w) => s.progress.weeks[weekKey(sub.id, w.week)]?.studiedAt)),
  },
  { id: "first-quest", name: "Quest complete", description: "Complete your first quest (a real assessment).", met: (s) => questsDone(s) >= 1 },
  { id: "graduate", name: "Graduate", description: "Complete every quest of the semester.", title: "the Graduate", met: (s) => Boolean(s.progress.graduatedAt) },
  { id: "boss-1", name: "Deadline slayer", description: "Beat a deadline boss.", met: (s) => Object.keys(s.progress.bosses).length >= 1 },
  { id: "boss-5", name: "Bossbane", description: "Beat five deadline bosses.", title: "Bossbane", met: (s) => Object.keys(s.progress.bosses).length >= 5 },
  { id: "siege", name: "Siege breaker", description: "Clear every boss during exam-week siege.", title: "the Siege-Breaker", met: (s) => s.progress.siegeClaimed },
  { id: "streak-7", name: "Seven days strong", description: "Study 7 days in a row.", title: "the Diligent", met: (s) => s.progress.streak.best >= 7 },
  { id: "streak-30", name: "Unbroken", description: "Study 30 days in a row.", title: "the Unbroken", met: (s) => s.progress.streak.best >= 30 },
  { id: "grimoire-10", name: "Lessons learned", description: "Master 10 questions in the Grimoire of Mistakes.", met: (s) => counter(s, "mastered") >= 10 },
  { id: "grimoire-50", name: "Grimoire keeper", description: "Master 50 questions in the Grimoire of Mistakes.", title: "Keeper of the Grimoire", met: (s) => counter(s, "mastered") >= 50 },
  { id: "mock-pass", name: "Exam ready", description: "Score 50% or more on a mock exam.", met: (s) => bestMock(s) >= 0.5 },
  { id: "mock-ace", name: "Top of the class", description: "Score 80% or more on a mock exam.", title: "the Prepared", met: (s) => bestMock(s) >= 0.8 },
  { id: "level-10", name: "Apprentice", description: "Reach level 10 in any subject.", met: (s) => maxLevel(s) >= 10 },
  { id: "level-50", name: "Adept", description: "Reach level 50 in any subject.", title: "the Adept", met: (s) => maxLevel(s) >= 50 },
  { id: "level-99", name: "Master", description: "Reach level 99 in any subject.", title: "the Master", met: (s) => maxLevel(s) >= 99 },
  { id: "focus-60", name: "Deep focus", description: "Spend 60 minutes in meditation (real focus time).", met: (s) => s.progress.focusMinutes >= 60 },
  { id: "focus-600", name: "Monk of study", description: "Spend 10 hours in meditation.", title: "the Focused", met: (s) => s.progress.focusMinutes >= 600 },
  { id: "explain-80", name: "Teach it back", description: "Score 80 or more explaining a concept to your tutor.", title: "the Clear-Minded", met: (s) => Object.values(s.progress.explained).some((v) => v >= 80) },
  { id: "grade-a", name: "A-grade work", description: "Record a mark of 80% or more on an assessment.", met: (s) => Object.values(s.progress.marks).some((m) => m.score / m.outOf >= 0.8) },
  { id: "workshop", name: "Hands-on", description: "Win a subject workshop game.", met: (s) => counter(s, "workshopWins") >= 1 },
  { id: "group", name: "Study circle", description: "Add a classmate to your study group.", met: (s) => Object.keys(s.progress.group).length >= 1 },
  { id: "streak-today", name: "On a roll", description: "Have a 3-day streak going.", met: (s) => liveStreak(s) >= 3 },
  { id: "crypt", name: "Crypt clearer", description: "Clear the Crypt of the Forgotten.", title: "the Cryptbreaker", met: (s) => counter(s, "dungeonClears") >= 1 },
  { id: "td-win", name: "Undistracted", description: "Hold all eight waves in the Siege of Procrastination.", title: "the Undistracted", met: (s) => counter(s, "tdWins") >= 1 },
  { id: "cosy", name: "Home sweet home", description: "Furnish your dorm to 20 comfort.", title: "the Homebody", met: (s) => comfort(s.progress.dorm) >= 20 },
  {
    id: "mix-match",
    name: "Trendsetter",
    description: "Wear parts from three different classes at once.",
    met: (s) => new Set(Object.values(resolveOutfit(s.player?.avatar ?? "knight", s.progress.wardrobe.outfit)).filter((v) => v !== "none")).size >= 3,
  },
  {
    id: "house-lead",
    name: "Pride of the house",
    description: "Put your house top of the House Cup table.",
    title: "Head of House",
    met: (s) => {
      const top = houseStandings(s)[0];
      return Boolean(top?.yours && top.points > 0);
    },
  },
  { id: "duel-champ", name: "Duelling champion", description: "Reach first place in the duelling club.", title: "the Champion", met: (s) => (s.progress.counters.ladderChampion ?? 0) >= 1 },
  { id: "secrets", name: "Keeper of secrets", description: "Open all three secret doors.", title: "the Keeper", met: (s) => Object.keys(s.progress.secrets).length >= 3 },
  { id: "voyager", name: "Well travelled", description: "Get three passport stamps from other islands.", title: "the Well-Travelled", met: (s) => Object.keys(s.progress.voyages.stamps).length >= 3 },
  { id: "race-gold", name: "Fleet of foot", description: "Win a gold medal in the Island Race.", title: "the Swift", met: (s) => counter(s, "raceGold") >= 1 },
];

/** Unlocks every newly met achievement. Returns the ones unlocked now. */
export function checkAchievements(): Achievement[] {
  const state = realmStore.get();
  if (!state.curriculum) return [];
  const fresh = ACHIEVEMENTS.filter((a) => !state.progress.achievements[a.id] && a.met(state));
  if (fresh.length === 0) return [];
  const now = new Date().toISOString();
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, achievements: { ...s.progress.achievements, ...Object.fromEntries(fresh.map((a) => [a.id, now])) } } }));
  emit({ type: "sound", name: "quest" });
  for (const a of fresh) chat(`Achievement earned: ${a.name}${a.title ? `. New title available: "${a.title}"` : ""}.`, "quest");
  return fresh;
}

export function unlockedTitles(state: RealmState): string[] {
  return ACHIEVEMENTS.filter((a) => a.title && state.progress.achievements[a.id]).map((a) => a.title!);
}

export function setTitle(title: string | null): void {
  const state = realmStore.get();
  if (title !== null && !unlockedTitles(state).includes(title)) return;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, title } }));
}
