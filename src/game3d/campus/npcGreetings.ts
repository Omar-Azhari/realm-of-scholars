/**
 * Campus NPC contextual interactions (Phase 20E, Part 9 "Mentor
 * improvements" + Part 8 "NPC population"). One deterministic function per
 * NPC role, same rule-based-priority-ladder shape as `mentorDialogue.ts`/
 * `roomReactions.ts` (Phase 20D) — "no dialogue tree yet, short contextual
 * interactions only." Every line either carries no factual claim or is
 * built from real saved signals (xp, streak, achievements, unlock
 * progress) — never invented.
 *
 * "Guide" (the Campus HQ mentor) and "subject-mentor" (the 4 subject
 * buildings' mentors) get the richer Part 9 treatment — daily advice,
 * congratulations, room-unlock and study-location suggestions — since
 * they're the NPCs actually acting as guides. Every other role (librarian,
 * lab technician, lecturer, lounge staff, admin staff) gets short,
 * role-flavoured ambient lines only, matching Part 8's "population," not
 * guidance.
 */

import { getAchievementStatuses } from "../../lib/achievements";
import { getRoomUnlockProgress } from "../../data/furnitureUnlocks";
import { getTodayRecommendations } from "../../lib/todayEngine";
import { getMelbourneDateTimeKey } from "../../lib/selectors";
import { getDailyMentorInsight } from "./dailyMentorInsights";
import { getCampusLifeRemark, getMilestoneReactionLine, hasMilestoneToday } from "./campusLife";
import type { UniGameSaveData } from "../../types/domain";

export type NpcRole = "guide" | "subject-mentor" | "librarian" | "lab-technician" | "lecturer" | "lounge-staff" | "admin-staff";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

function pick(pool: string[], seed: string): string {
  return pool[hashString(seed) % pool.length];
}

const AMBIENT_LINES: Record<Exclude<NpcRole, "guide" | "subject-mentor">, string[]> = {
  librarian: ["Quiet study area's just through there.", "Let me know if you can't find what you need.", "We just got some new arrivals in, if you're browsing."],
  "lab-technician": ["Machines are all free right now.", "Let me know if anything's acting up.", "Good time to get some coding done in here."],
  lecturer: ["Lecture notes are up on the board.", "Good to see you here.", "Don't hesitate to ask if something didn't make sense."],
  "lounge-staff": ["Coffee's fresh, help yourself.", "Take a load off for a bit.", "Nice to see a familiar face."],
  "admin-staff": ["Let me know if you need anything sorted.", "Semester paperwork's all up to date on our end.", "Settings and enrolment questions — that's us."],
};

/**
 * Ambient, role-flavoured line for population NPCs (Part 8) — no
 * academic-progress logic, just atmosphere. Phase 24 "Campus Life" adds two
 * higher-priority, still fully deterministic rungs above the generic role
 * pool: a milestone-today reaction, and an era-flavoured "campus feels
 * alive" remark — both gated by a hash so they show only some of the time,
 * never on every single interaction. `save` is optional so any caller that
 * predates Phase 24 (there are none left, but the type stays honest) still
 * compiles against the original role-only behaviour.
 */
export function getAmbientNpcLine(role: Exclude<NpcRole, "guide" | "subject-mentor">, seed: string, save?: UniGameSaveData, now: Date = new Date()): string {
  const dayKey = getMelbourneDateTimeKey(now).slice(0, 10);
  const gateSeed = `${seed}-${dayKey}`;
  if (save) {
    if (hasMilestoneToday(save, now) && hashString(gateSeed) % 2 === 0) return getMilestoneReactionLine(now);
    if (hashString(`${gateSeed}-campus-life`) % 3 === 0) return getCampusLifeRemark(save, now);
  }
  return pick(AMBIENT_LINES[role], gateSeed);
}

const ENCOURAGEMENT_LINES = [
  "Whatever you tackle today, it'll add up.",
  "Small steps count just as much as big ones.",
  "Glad you're here — let's make today count.",
  "No pressure — just do what you can today.",
];

/**
 * Guide/mentor advice (Part 9) — a short priority ladder over real
 * signals: recent achievement, long streak, a locked item you're close to
 * unlocking, today's top academic recommendation, or a generic
 * encouragement line. Deterministic per (save, day) — the same day never
 * shows a different line on repeated visits.
 */
export function getMentorAdvice(save: UniGameSaveData, now: Date = new Date()): string {
  const dayKey = getMelbourneDateTimeKey(now).slice(0, 10);
  const seed = `mentor-${dayKey}`;

  const unlockedAchievements = getAchievementStatuses(save).filter((s) => s.unlocked);
  if (unlockedAchievements.length > 0 && hashString(seed) % 3 === 0) {
    const achievement = unlockedAchievements[hashString(seed + "a") % unlockedAchievements.length];
    return `Congratulations on "${achievement.definition.title}" — well earned.`;
  }

  // Phase 21 Part 2+6 — comparative/aggregate observations (assessments due
  // this week, strongest subject, building-visit frequency, consistent
  // study, take-a-break, organise-your-room) outrank the generic streak
  // line below, since they're specific to what the player actually did.
  const dailyInsight = getDailyMentorInsight(save, now);
  if (dailyInsight) {
    return dailyInsight.line;
  }

  if (save.userProgress.streakCount >= 7) {
    return `${save.userProgress.streakCount}-day streak — keep it going.`;
  }

  const unlockProgress = getRoomUnlockProgress(save);
  if (unlockProgress.nextItem) {
    return `You're getting close to unlocking the ${unlockProgress.nextItem.displayName} for your room.`;
  }

  const recommendations = getTodayRecommendations(save, now, 1);
  if (recommendations.length > 0) {
    return recommendations[0].action;
  }

  // Phase 24 "Campus Life" — an occasional, era-flavoured "campus feels
  // alive" remark, only once every real academic signal above has nothing
  // to say. Never outranks a real recommendation/insight/streak/unlock.
  if (hashString(`${seed}-campus-life`) % 2 === 0) {
    return getCampusLifeRemark(save, now);
  }

  return pick(ENCOURAGEMENT_LINES, seed);
}

/** A short, once-per-visit greeting when the player first comes near a mentor NPC this session — distinct from the fuller advice above (Part 3's "mentor greets them if nearby"). */
const GREETING_LINES = ["Hey, good to see you.", "Welcome back to campus.", "Hi there — how's it going?", "Morning! Ready for today?"];

export function getMentorGreeting(seed: string, now: Date = new Date()): string {
  const dayKey = getMelbourneDateTimeKey(now).slice(0, 10);
  return pick(GREETING_LINES, `${seed}-greet-${dayKey}`);
}
