/**
 * Phase 24 "Mentor Relationships" — surfaces the 5 tracked dimensions the
 * brief names (Trust, Conversation count, Advice followed, Consistency,
 * Milestones celebrated) WITHOUT inventing a second relationship system:
 *
 *  - Trust / Consistency: already real, derived numbers —
 *    `mentorRelationship.ts`'s `points`/`level` (a subject mentor's trust)
 *    and `save.userProgress.streakCount` (consistency, semester-wide, the
 *    same signal `MentorPlanner.ts`'s `consistencyMessage` already uses).
 *    Nothing new to compute; this module just reuses them.
 *  - Conversation count: `NpcMemoryEntry.conversationCount` (Phase 24,
 *    additive), incremented once per real interaction in
 *    `SaveDataContext.tsx`'s `recordNpcInteraction`.
 *  - Milestones celebrated: derived, zero new state — counts the SAME
 *    `save.milestones` first-seen log every other phase already
 *    maintains, scoped to this NPC.
 *  - Advice followed: an honest HEURISTIC, disclosed as such — real
 *    subsequent activity (a Focus Sprint or completed module in the
 *    advised subject) within a time window of the advice being given.
 *    Never a certain read of the player's intent.
 */

import { getCountedSessions } from "../lib/focusSession";
import { getNpcMemory } from "../lib/npcMemory";
import { computeMentorRelationship } from "../lib/mentorRelationship";
import type { UniGameSaveData } from "../types/domain";

const ADVICE_FOLLOW_WINDOW_HOURS = 48;

function hadRealSubjectActivity(save: UniGameSaveData, subjectId: string, sinceMs: number, untilMs: number): boolean {
  const sessionHit = getCountedSessions(save).some((s) => {
    const t = new Date(s.startedAt).getTime();
    return s.subjectId === subjectId && t >= sinceMs && t <= untilMs;
  });
  if (sessionHit) return true;

  const subject = save.semester.subjects.find((s) => s.id === subjectId);
  if (!subject) return false;
  const moduleIds = new Set(subject.modules.map((m) => m.id));
  return save.tasks.some((t) => {
    if (!t.linkedModuleId || !moduleIds.has(t.linkedModuleId) || !t.completed || !t.completedAt) return false;
    const at = new Date(t.completedAt).getTime();
    return at >= sinceMs && at <= untilMs;
  });
}

/** How many of this NPC's logged advice moments were followed by real, subject-matching activity within 48h — an honest heuristic, not a certainty. Subject-agnostic advice (no `subjectId`) can't be checked this way and is skipped. */
export function countAdviceFollowed(save: UniGameSaveData, npcKey: string, now: Date = new Date()): number {
  const memory = getNpcMemory(save, npcKey);
  let followed = 0;
  for (const entry of memory.adviceLog) {
    if (!entry.subjectId) continue;
    const sinceMs = new Date(entry.at).getTime();
    const untilMs = Math.min(sinceMs + ADVICE_FOLLOW_WINDOW_HOURS * 60 * 60 * 1000, now.getTime());
    if (hadRealSubjectActivity(save, entry.subjectId, sinceMs, untilMs)) followed += 1;
  }
  return followed;
}

/** How many derived milestones have been "celebrated" for this NPC — the guide gets achievements/goals/semester-complete; a subject mentor gets that subject's own bond-level/room-stage milestones. Zero new state: filters the existing `save.milestones` first-seen log. */
export function countMilestonesCelebrated(save: UniGameSaveData, npcKey: string): number {
  if (npcKey === "guide") {
    return save.milestones.filter((m) => m.kind === "achievement" || m.kind === "goal-complete" || m.kind === "semester-complete").length;
  }
  return save.milestones.filter((m) => (m.kind === "bond-level" || m.kind === "room-stage") && m.id.split(":")[1] === npcKey).length;
}

const GUIDE_STAGE_THRESHOLDS = [0, 3, 8, 15, 25] as const;
const GUIDE_STAGE_NAMES = ["New", "Familiar", "Regular", "Trusted", "Close"] as const;

/** The relationship stage label for this NPC. A subject mentor reuses its REAL, already-computed `mentorRelationship.ts` level name (points-based Trust); the guide has no subject/points system, so a conversation-count staircase is used instead — the same "New → Close" shape, honestly derived from a different real signal. */
export function getRelationshipStage(save: UniGameSaveData, npcKey: string): string {
  if (npcKey === "guide") {
    const count = getNpcMemory(save, npcKey).conversationCount;
    let stage = 0;
    for (let i = GUIDE_STAGE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
      if (count >= GUIDE_STAGE_THRESHOLDS[i]) {
        stage = i;
        break;
      }
    }
    return GUIDE_STAGE_NAMES[stage];
  }
  const subject = save.semester.subjects.find((s) => s.id === npcKey);
  return subject ? computeMentorRelationship(save, subject).levelName : GUIDE_STAGE_NAMES[0];
}

export interface MentorRelationshipSummary {
  conversationCount: number;
  adviceFollowed: number;
  milestonesCelebrated: number;
  stage: string;
}

/** All 4 derived-or-tracked dimensions in one call, for display (Player Journal). Trust/Consistency themselves stay exactly where they already lived — `mentorRelationship.ts` / `userProgress.streakCount` — this summary only adds the genuinely new pieces plus the stage label. */
export function getMentorRelationshipSummary(save: UniGameSaveData, npcKey: string, now: Date = new Date()): MentorRelationshipSummary {
  return {
    conversationCount: getNpcMemory(save, npcKey).conversationCount,
    adviceFollowed: countAdviceFollowed(save, npcKey, now),
    milestonesCelebrated: countMilestonesCelebrated(save, npcKey),
    stage: getRelationshipStage(save, npcKey),
  };
}
