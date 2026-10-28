/**
 * Phase 22 Part 7 "Mentor Planner" — chooses ONE dialogue topic per call,
 * from `StudentContext` plus `RecommendationEngine.ts`/`ReflectionEngine.ts`,
 * following the brief's own explicit priority order: urgent deadlines >
 * celebrate achievements > encourage consistency > suggest next actions >
 * reflect on improvements > (fallback) generic encouragement. Every line is
 * a template filled from real data — "personal without requiring AI
 * generation," never an LLM call.
 *
 * "Avoid repetition" is deliberately NOT reimplemented here — Phase 21's
 * `npcMemory.ts`'s `applyRecognition` already solves exactly this ("has
 * this NPC already spoken to the player today, swap in a short
 * acknowledgement instead"). Callers should pass this planner's `line`
 * through `applyRecognition` at the call site, the same way `Game3D.tsx`
 * already does for `getMentorAdvice`/`getMentorLine` — one repetition
 * guard, not two.
 */

import { generateRecommendations } from "./RecommendationEngine";
import { generateWeeklyReflection } from "./ReflectionEngine";
import type { PriorityReason } from "../lib/priority";
import type { StudentContext } from "./ContextEngine";
import type { UniGameSaveData } from "../types/domain";

export type MentorTopic = "urgent-deadline" | "celebrate" | "consistency" | "next-action" | "reflection" | "encouragement";

export interface MentorMessage {
  topic: MentorTopic;
  line: string;
  evidence: PriorityReason[];
}

const ENCOURAGEMENT_FALLBACK = "Whatever you tackle today, it'll add up.";

function urgentDeadlineMessage(context: StudentContext): MentorMessage | null {
  const overdue = context.overdueAssessments[0];
  if (overdue) {
    return {
      topic: "urgent-deadline",
      line: `${overdue.title} is overdue by ${overdue.daysOverdue} day${overdue.daysOverdue === 1 ? "" : "s"} — let's get it in.`,
      evidence: [{ label: `${overdue.title} overdue by ${overdue.daysOverdue} day${overdue.daysOverdue === 1 ? "" : "s"}`, contribution: 100, max: 100 }],
    };
  }
  const soon = context.upcomingAssessments.find((a) => a.daysUntilDue <= 2);
  if (soon) {
    return {
      topic: "urgent-deadline",
      line: `${soon.title} is due in ${soon.daysUntilDue} day${soon.daysUntilDue === 1 ? "" : "s"} — worth prioritising today.`,
      evidence: [{ label: `${soon.title} due in ${soon.daysUntilDue} day${soon.daysUntilDue === 1 ? "" : "s"}`, contribution: 90, max: 100 }],
    };
  }
  return null;
}

/**
 * Only celebrates a RECENT achievement (within 48h) — an achievement from
 * weeks ago congratulated every day would feel hollow, not personal.
 * Exported (Phase 23) so `MentorDialogueProvider.ts`'s conversation
 * "encouragement" stage reuses this exact check rather than a second copy.
 */
export function celebrateMessage(context: StudentContext, now: Date): MentorMessage | null {
  const recent = context.achievements.recent[0];
  if (!recent) return null;
  const hoursSince = (now.getTime() - new Date(recent.at).getTime()) / (1000 * 60 * 60);
  if (hoursSince > 48) return null;
  return {
    topic: "celebrate",
    line: `Congratulations on "${recent.title}" — well earned.`,
    evidence: [{ label: `Unlocked ${Math.round(hoursSince)}h ago`, contribution: 100, max: 100 }],
  };
}

/** Exported (Phase 23) for the same reuse reason as `celebrateMessage` above. */
export function consistencyMessage(context: StudentContext): MentorMessage | null {
  if (context.streak.current < 3) return null;
  return {
    topic: "consistency",
    line: `${context.streak.current}-day streak — keep it going.`,
    evidence: [{ label: `${context.streak.current}-day streak`, contribution: context.streak.current, max: context.streak.longest || context.streak.current }],
  };
}

function nextActionMessage(save: UniGameSaveData, context: StudentContext, now: Date): MentorMessage | null {
  const [top] = generateRecommendations(save, context, now, 1);
  if (!top) return null;
  return { topic: "next-action", line: top.action, evidence: top.evidence };
}

function reflectionMessage(save: UniGameSaveData, context: StudentContext, now: Date): MentorMessage | null {
  const [first] = generateWeeklyReflection(save, context, now).statements;
  if (!first) return null;
  return { topic: "reflection", line: first.text, evidence: first.evidence };
}

/** The mentor's single chosen line right now, following the brief's exact priority order. Always returns something — the fallback is a real, non-fabricated encouragement, never an empty message. */
export function planMentorMessage(save: UniGameSaveData, context: StudentContext, now: Date = new Date()): MentorMessage {
  return (
    urgentDeadlineMessage(context) ??
    celebrateMessage(context, now) ??
    consistencyMessage(context) ??
    nextActionMessage(save, context, now) ??
    reflectionMessage(save, context, now) ?? { topic: "encouragement", line: ENCOURAGEMENT_FALLBACK, evidence: [] }
  );
}
