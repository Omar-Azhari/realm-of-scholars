/**
 * Phase 24 "Campus Life" — makes the campus feel alive without inventing
 * random dialogue: every line here is gated by a REAL signal (the
 * semester's derived era from `semesterCalendar.ts`, or whether a
 * milestone was genuinely first-observed today via `save.milestones`,
 * Phase 11/22's existing first-seen log) and picked deterministically
 * per (signal, day) — the same `hashString`-based selection every other
 * dialogue module in this codebase already uses, never a random-number call.
 *
 * "Mentors may occasionally speak to each other" is deliberately NOT
 * implemented as live two-NPC choreography (no NPC-to-NPC conversation
 * system exists, and building one is a much larger, uncertain-payoff
 * addition than this phase's scope). Instead, any mentor or population NPC
 * can pass along an OVERHEARD remark ("one of the other mentors was just
 * saying...") — an honest, disclosed simplification that still satisfies
 * "campus feels alive, mentors talk to each other" from the player's own
 * perspective. See docs/PHASE_24_PROACTIVE_MENTOR.md's Known Limitations.
 */

import { getSemesterCalendar, type SemesterEra } from "../../lib/semesterCalendar";
import { getMelbourneDateIso } from "../../lib/selectors";
import type { UniGameSaveData } from "../../types/domain";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

function pick(pool: string[], seed: string): string {
  return pool[hashString(seed) % pool.length];
}

const ERA_REMARKS: Record<SemesterEra, string[]> = {
  early: [
    "One of the other mentors mentioned things are still settling in this semester.",
    "Heard from a colleague that everyone's just finding their rhythm right now.",
  ],
  mid: [
    "Another mentor was just saying how busy assessments have gotten across every subject this week.",
    "Word around campus is the mid-semester crunch has properly hit.",
  ],
  late: [
    "One of the other mentors reckons exam season's got everyone on edge.",
    "Heard it's all hands on deck across campus this close to the end.",
  ],
  complete: [
    "The other mentors have been saying how quiet campus feels now the semester's wrapped up.",
    "Word is everyone's finally getting a breather now the semester's done.",
  ],
};

/** A short, deterministic "campus feels alive" remark — framed as something overheard around campus rather than addressed directly to the player. Shared by population-NPC ambient lines and mentor advice so campus life reads consistently regardless of which NPC says it. */
export function getCampusLifeRemark(save: UniGameSaveData, now: Date = new Date()): string {
  const calendar = getSemesterCalendar(save, now);
  const dayKey = getMelbourneDateIso(now);
  return pick(ERA_REMARKS[calendar.era], `campus-life-${dayKey}`);
}

const MILESTONE_REACTION_LINES = [
  "Heard congratulations are in order for you today.",
  "Word's gotten around that you hit a milestone today — nice one.",
  "Someone mentioned you had a good one today.",
];

/** True when at least one derived milestone (achievement/goal/bond-level/room-stage/semester-complete) was first observed TODAY — the same real signal `ai/ProactiveMentorEngine.ts`'s celebration triggers use, reused here so population NPCs can react too without a second definition of "did something happen today." */
export function hasMilestoneToday(save: UniGameSaveData, now: Date = new Date()): boolean {
  const todayIso = getMelbourneDateIso(now);
  return save.milestones.some((m) => m.at.slice(0, 10) === todayIso);
}

/** A milestone-reaction remark, deterministic per (save, day) — only ever called once `hasMilestoneToday` is confirmed true. */
export function getMilestoneReactionLine(now: Date = new Date()): string {
  return pick(MILESTONE_REACTION_LINES, `milestone-reaction-${getMelbourneDateIso(now)}`);
}
