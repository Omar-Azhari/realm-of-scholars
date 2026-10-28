/**
 * Phase 21 Part 1 — relationship metadata layered ON TOP of the existing,
 * unmodified `mentorRelationship.ts` (Level/points) and `simulation.ts`
 * (per-subject Mood). Nothing here recomputes what those two modules
 * already derive correctly; this module only adds the two dimensions the
 * brief asks for that don't have a home yet — Trust and Familiarity — plus
 * a small "which dialogue topics are unlocked" query that documents
 * `mentorDialogue.ts`'s existing level-gating as explicit, readable data
 * (for the Journal/relationship UI) rather than leaving it implicit inside
 * a 500-line priority ladder.
 *
 * Everything here is a pure function of a `MentorRelationship`/`SubjectSimState`
 * already computed elsewhere — no new randomness, no new persisted state.
 * Deterministic by construction: same inputs, same outputs, always.
 */

import { LEVEL_THRESHOLDS, type MentorRelationship } from "./mentorRelationship";
import type { MoodBucket, SubjectSimState } from "./simulation";

/** Trust — a continuous (0–100) read of the same points `mentorRelationship.ts` already computes, expressed as "how far into the whole relationship arc" rather than a discrete 1–5 level. Two students at the same Level can have different Trust (one just crossed the threshold, one is about to hit the next). */
export function computeTrust(relationship: MentorRelationship): number {
  const maxPoints = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return Math.max(0, Math.min(100, Math.round((relationship.points / maxPoints) * 100)));
}

export type FamiliarityTier = "New Face" | "Acquaintance" | "Regular" | "Familiar" | "Close";

const FAMILIARITY_THRESHOLDS: Array<{ visitDays: number; tier: FamiliarityTier }> = [
  { visitDays: 0, tier: "New Face" },
  { visitDays: 3, tier: "Acquaintance" },
  { visitDays: 8, tier: "Regular" },
  { visitDays: 16, tier: "Familiar" },
  { visitDays: 30, tier: "Close" },
];

/**
 * Familiarity — deliberately a DIFFERENT axis from Trust/Level: raw
 * visit frequency only, not weighted by academic performance. A student
 * who visits constantly but hasn't completed much is "Familiar" (the
 * mentor recognises their face) without necessarily being "Trusted"
 * (that still requires real progress, per `mentorRelationship.ts`).
 */
export function computeFamiliarity(visitDays: number): FamiliarityTier {
  let tier: FamiliarityTier = "New Face";
  for (const t of FAMILIARITY_THRESHOLDS) {
    if (visitDays >= t.visitDays) tier = t.tier;
  }
  return tier;
}

/**
 * Current Mood for a SUBJECT mentor — reuses `computeSubjectSimState`'s
 * existing `MoodBucket` directly rather than inventing a parallel
 * classifier. This is an honest mapping, not a shortcut: a subject
 * mentor's mood naturally tracks how that subject's own workload/stress
 * signals are trending, which `simulation.ts` already computes from real
 * saved data every render.
 */
export function getMentorMood(sim: SubjectSimState): MoodBucket {
  return sim.mood;
}

/**
 * Current Mood for the Guide (Campus HQ's mentor — not scoped to one
 * subject, so has no single `SubjectSimState` of its own). Aggregates the
 * same signal simulation.ts uses (workload) across every subject's sim
 * state the caller already computed, landing on the majority bucket —
 * deterministic, no new derivation logic, just a tally over existing
 * per-subject moods.
 */
export function getGuideMood(subjectMoods: MoodBucket[]): MoodBucket {
  if (subjectMoods.length === 0) return "content";
  const counts: Record<MoodBucket, number> = { relaxed: 0, content: 0, focused: 0, stressed: 0, tired: 0 };
  for (const m of subjectMoods) counts[m] += 1;
  let best: MoodBucket = "content";
  let bestCount = -1;
  // Deterministic tie-break: fixed iteration order over a fixed key list,
  // never Object.keys() (whose order, while spec-guaranteed for string
  // keys here, is easy to accidentally rely on incorrectly elsewhere).
  const order: MoodBucket[] = ["stressed", "tired", "focused", "content", "relaxed"];
  for (const bucket of order) {
    if (counts[bucket] > bestCount) {
      best = bucket;
      bestCount = counts[bucket];
    }
  }
  return best;
}

export type DialogueTopic = "daily-check-in" | "reflective-relationship-comment" | "deep-bond-milestone";

/**
 * Documents `mentorDialogue.ts`'s existing level-gates as explicit,
 * queryable data — for the Journal/relationship display — rather than
 * leaving them implicit inside the priority ladder. Matches
 * `getMentorLine`'s real gating exactly: `getRelationshipLine` starts
 * contributing from level 2, and the "milestone" voice pool only plays at
 * level 4+. No new dialogue behaviour — this only reports what's already
 * true.
 */
export function getUnlockedDialogueTopics(relationship: MentorRelationship): DialogueTopic[] {
  const topics: DialogueTopic[] = ["daily-check-in"];
  if (relationship.level >= 2) topics.push("reflective-relationship-comment");
  if (relationship.level >= 4) topics.push("deep-bond-milestone");
  return topics;
}

/** Convenience bundle — everything Part 1 asks a relationship to expose, for a single subject mentor, in one call. `lastInteraction`/`recentConversation` deliberately come from `npcMemory.ts` (real persisted state), not from here (everything in THIS module is derived, never stored). */
export interface SubjectMentorRelationshipView {
  relationship: MentorRelationship;
  trust: number;
  familiarity: FamiliarityTier;
  mood: MoodBucket;
  unlockedTopics: DialogueTopic[];
}

export function buildSubjectMentorRelationshipView(relationship: MentorRelationship, sim: SubjectSimState): SubjectMentorRelationshipView {
  return {
    relationship,
    trust: computeTrust(relationship),
    familiarity: computeFamiliarity(relationship.stats.visitDays),
    mood: getMentorMood(sim),
    unlockedTopics: getUnlockedDialogueTopics(relationship),
  };
}

