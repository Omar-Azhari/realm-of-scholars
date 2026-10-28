/**
 * Phase 21 Part 2 "Daily Mentor Interactions" + Part 6 "Study Companion".
 * A small, additional priority ladder of COMPARATIVE/AGGREGATE
 * observations — "only one assessment due this week," "Cloud Computing is
 * becoming your strongest subject," "you've been visiting the library a
 * lot" — none of which any existing engine derives (they all compare
 * ACROSS subjects/buildings/time, not within one). Every number is real:
 * built entirely from `mentorRelationship.ts` (points), `buildingVisits`/
 * `campusMap.ts` (visit frequency), `userProgress` (streak), and
 * `furnitureUnlocks.ts` (unlock progress) — no new academic derivation,
 * only new COMPARISONS over data that already exists.
 *
 * First-applicable-rung, same discipline as `mentorDialogue.ts`/
 * `npcGreetings.ts` — never a random pick among facts, since these are
 * observations, not flavour lines.
 */

import { computeMentorRelationship } from "../../lib/mentorRelationship";
import { getRoomUnlockProgress } from "../../data/furnitureUnlocks";
import { getMelbourneDateIso, daysBetweenDateIso } from "../../lib/selectors";
import { CAMPUS_LOCATIONS } from "./campusMap";
import type { UniGameSaveData } from "../../types/domain";

/** Confirmed assessments due within the next 7 days (inclusive), across every subject — the one place this comparison is made; nothing else counts "due this week" specifically. */
function countAssessmentsDueThisWeek(save: UniGameSaveData, now: Date): number {
  const todayIso = getMelbourneDateIso(now);
  let count = 0;
  for (const subject of save.semester.subjects) {
    for (const assessment of subject.assessments) {
      if (assessment.dueDate.status !== "confirmed" || !assessment.dueDate.value) continue;
      const days = daysBetweenDateIso(todayIso, assessment.dueDate.value);
      if (days >= 0 && days <= 7) count += 1;
    }
  }
  return count;
}

/** The subject with the clearest lead in relationship points — only reported when there's real separation (not a coin-flip between two close subjects) and the leader has actually accrued meaningful points. */
function findStrongestSubject(save: UniGameSaveData): { name: string } | null {
  if (save.semester.subjects.length < 2) return null;
  const ranked = save.semester.subjects
    .map((subject) => ({ subject, points: computeMentorRelationship(save, subject).points }))
    .sort((a, b) => b.points - a.points);
  const [leader, runnerUp] = ranked;
  if (!leader || leader.points < 20) return null;
  if (runnerUp && leader.points - runnerUp.points < 10) return null; // too close to call
  return { name: leader.subject.name };
}

/** The real campus location (of the 6 the player can actually visit) with the most distinct visit days — only reported once it's a real pattern, not a single visit. */
function findMostVisitedBuilding(save: UniGameSaveData): { label: string } | null {
  let best: { label: string; visitDays: number } | null = null;
  for (const location of CAMPUS_LOCATIONS) {
    const visit = save.buildingVisits[location.id];
    if (!visit || visit.visitDays < 3) continue;
    if (!best || visit.visitDays > best.visitDays) best = { label: location.label, visitDays: visit.visitDays };
  }
  return best ? { label: best.label } : null;
}

export type DailyMentorInsight = { kind: "assessments-due-week" | "strongest-subject" | "building-frequency" | "consistent-study" | "take-a-break" | "organise-room"; line: string };

/**
 * The single, first-applicable observation for right now — or null if
 * nothing meaningful applies yet (a brand-new save with no real signals
 * shouldn't invent one). Callers fall back to their own existing ladder
 * when this returns null (see `npcGreetings.ts`'s `getMentorAdvice`).
 */
export function getDailyMentorInsight(save: UniGameSaveData, now: Date = new Date()): DailyMentorInsight | null {
  // Part 6 "take a break" — sustained heavy load is a care signal, checked
  // first since player wellbeing outranks a status update.
  if (save.userProgress.streakCount >= 14) {
    return { kind: "take-a-break", line: `${save.userProgress.streakCount} days straight is real dedication — remember it's fine to take a lighter day too.` };
  }

  const dueThisWeek = countAssessmentsDueThisWeek(save, now);
  if (dueThisWeek === 1) {
    return { kind: "assessments-due-week", line: "Only one assessment due this week — a manageable stretch." };
  }
  if (dueThisWeek >= 2 && dueThisWeek <= 3) {
    return { kind: "assessments-due-week", line: `${dueThisWeek} assessments due this week — worth mapping out which one to start first.` };
  }

  const strongest = findStrongestSubject(save);
  if (strongest) {
    return { kind: "strongest-subject", line: `I've noticed ${strongest.name} is becoming your strongest subject.` };
  }

  const frequentBuilding = findMostVisitedBuilding(save);
  if (frequentBuilding) {
    return { kind: "building-frequency", line: `You've been visiting the ${frequentBuilding.label} a lot lately.` };
  }

  if (save.userProgress.streakCount >= 3) {
    return { kind: "consistent-study", line: `You've studied consistently this week — ${save.userProgress.streakCount} days running.` };
  }

  // Part 6 "organise your room" — only when the player has genuinely
  // unlocked nothing yet (a real, low-effort suggestion, not nagging
  // someone already decorating).
  const unlockProgress = getRoomUnlockProgress(save);
  if (unlockProgress.unlockedCount === 0 && unlockProgress.totalCount > 0) {
    return { kind: "organise-room", line: "Your room's still bare — a Focus Sprint or two would unlock your first piece of furniture." };
  }

  return null;
}
