/**
 * Phase 23 "Living AI Mentor & Conversational System" — the mentor as a
 * multi-stage CONVERSATION (greeting → context awareness → advice →
 * optional encouragement → optional reflection → goodbye) rather than one
 * line. Every stage reuses an existing engine — nothing here re-scores a
 * recommendation, re-derives a reflection, or invents a second dialogue
 * ladder:
 *
 *  - context-awareness reuses `mentorDialogue.ts`'s `getMentorLine` (the
 *    subject-voiced ladder, unchanged) or `npcGreetings.ts`'s
 *    `getMentorAdvice` for the guide — both ALREADY produce exactly "the
 *    mentor references real recent activity."
 *  - advice reuses `RecommendationEngine.ts`'s `generateRecommendations`
 *    verbatim — "all recommendations must originate from the
 *    Recommendation Engine, never duplicate logic."
 *  - encouragement reuses `MentorPlanner.ts`'s exported
 *    `celebrateMessage`/`consistencyMessage` checks verbatim.
 *  - reflection reuses `ReflectionEngine.ts`'s `generateWeeklyReflection`
 *    verbatim.
 *  - goodbye reuses `mentorDialogue.ts`'s new (Phase 23) `getMentorGoodbye`
 *    per-subject voice pool.
 *
 * `MentorDialogueProvider` is the "clean interface... no UI changes
 * required" the brief's "Future AI Ready" section asks for: today,
 * `ruleBasedMentorDialogueProvider` implements it with zero network calls;
 * a future LLM-backed provider would satisfy the SAME interface and be
 * swapped in at the one place a UI component calls `buildConversation`.
 *
 * Every function here is pure — no save mutation. Callers (UI code) apply
 * the returned `memoryUpdate` via `SaveDataContext`'s
 * `recordNpcInteraction`/`flagAssessmentStruggle`, the same "engines don't
 * mutate, callers do" discipline every prior `src/ai/` module already
 * follows.
 */

import { getMentorLine, getMentorGoodbye } from "../lib/mentorDialogue";
import { getMentorAdvice } from "../game3d/campus/npcGreetings";
import { computeSubjectSimState } from "../lib/simulation";
import { getSemesterCalendar } from "../lib/semesterCalendar";
import { getTopPriorityItems } from "../lib/priority";
import { getMelbourneDateIso, getMelbourneDateTimeKey } from "../lib/selectors";
import { generateRecommendations } from "./RecommendationEngine";
import { generateWeeklyReflection } from "./ReflectionEngine";
import { celebrateMessage, consistencyMessage } from "./MentorPlanner";
import { getNpcMemory } from "../lib/npcMemory";
import type { PriorityReason } from "../lib/priority";
import type { StudentContext } from "./ContextEngine";
import type { UniGameSaveData } from "../types/domain";

export type ConversationStageId = "greeting" | "context-awareness" | "advice" | "encouragement" | "reflection" | "goodbye";

export interface ConversationStage {
  stage: ConversationStageId;
  line: string;
  evidence?: PriorityReason[];
}

export interface MentorConversation {
  npcKey: string;
  stages: ConversationStage[];
}

/** What the UI should persist after showing this conversation — pure data, no mutation happens here. */
export interface ConversationMemoryUpdate {
  /** The whole conversation's headline, for `NpcMemoryEntry.lastLine`/recognition. */
  summaryLine: string;
  /** The advice stage's category (or null if there was no advice) — folded into `recentTopics` so the next visit can avoid repeating it. */
  topic: string | null;
  /** Set (or cleared, if null) as the subject's flagged struggle assessment. Only ever set for a SUBJECT mentor, never the guide. */
  flagAssessmentId?: string | null;
}

export interface MentorDialogueProvider {
  buildConversation(save: UniGameSaveData, context: StudentContext, npcKey: string, now: Date): { conversation: MentorConversation; memoryUpdate: ConversationMemoryUpdate };
}

function isWeekend(now: Date): boolean {
  const day = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", weekday: "short" }).format(now);
  return day === "Sat" || day === "Sun";
}

function isLateNight(now: Date): boolean {
  const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
  return hour >= 22 || hour < 5;
}

/** A short, real-data assessment-due-tomorrow line, lightly voiced per subject (a few fixed phrasings, not a full new pool — see docs/PHASE_23_LIVING_MENTOR.md for why this is a deliberately smaller scope than the 14-category pools). */
const ASSESSMENT_TOMORROW_PHRASING: Record<string, (title: string) => string> = {
  "user-interface-design": (title) => `One more thing before you settle in — "${title}" is due tomorrow.`,
  "cloud-based-web-application-development": (title) => `Heads up: "${title}" is due tomorrow. Deploy window's closing.`,
  "project-management": (title) => `Milestone check — "${title}" is due tomorrow.`,
  "professional-practices-and-entrepreneurship-in-it": (title) => `Pitch clock's ticking — "${title}"'s due tomorrow.`,
};

const CONFIDENCE_HIGH_PHRASING: Record<string, string> = {
  "user-interface-design": "Your work in here has been genuinely strong lately.",
  "cloud-based-web-application-development": "Your build history here is solid — green across the board.",
  "project-management": "You're running this room like someone well ahead of schedule.",
  "professional-practices-and-entrepreneurship-in-it": "You're pitching from a position of real strength right now.",
};

const CONFIDENCE_LOW_PHRASING: Record<string, string> = {
  "user-interface-design": "This subject's felt a bit unfamiliar lately — that's fine, we'll ease back in.",
  "cloud-based-web-application-development": "This one's been a bit quiet — no alarms, just room to rebuild.",
  "project-management": "This subject's plan has drifted a little — nothing a small step won't fix.",
  "professional-practices-and-entrepreneurship-in-it": "This one's had a slow patch — every founder has them.",
};

/** Builds the greeting stage. Priority: long absence > goal completed today > assessment due tomorrow > confidence extreme > busy/quiet week > late-night > weekend > plain time-of-day (via getMentorLine's own greeting fallback, reused rather than duplicated). */
function buildGreeting(save: UniGameSaveData, context: StudentContext, subjectId: string | null, now: Date): string | null {
  const todayIso = getMelbourneDateIso(now);

  if (save.userProgress.lastActiveDate && save.userProgress.lastActiveDate !== todayIso) {
    return null; // long absence is already the FIRST rung inside getMentorLine (welcomeBack) — avoid saying it twice.
  }

  const goalCompletedToday = context.journalMilestones.some((m) => m.kind === "goal-complete" && m.at.slice(0, 10) === todayIso);
  if (goalCompletedToday) return null; // covered by getMentorLine's own justCelebrated/congrats rung for subjects; guide covers it via getMentorAdvice's achievement rung.

  if (subjectId) {
    const upcomingForSubject = context.upcomingAssessments.find((a) => a.subjectId === subjectId && a.daysUntilDue === 1);
    if (upcomingForSubject) {
      const phrase = ASSESSMENT_TOMORROW_PHRASING[subjectId];
      if (phrase) return phrase(upcomingForSubject.title);
    }

    const subjectContext = context.subjects.find((s) => s.subjectId === subjectId);
    if (subjectContext?.confidence.level === "excellent") return CONFIDENCE_HIGH_PHRASING[subjectId] ?? null;
    if (subjectContext?.confidence.level === "very-low") return CONFIDENCE_LOW_PHRASING[subjectId] ?? null;
  }

  if (context.workloadLevel === "peak" || context.workloadLevel === "high") return null; // covered by getMentorLine's busy rung for subjects.
  if (isLateNight(now)) return "Studying late tonight — good dedication, just don't run yourself down.";
  if (isWeekend(now)) return "Weekend session — nice to see you here even off the clock.";

  return null;
}

/**
 * A subject mentor must never namedrop a DIFFERENT subject's specific
 * module/assessment by name — that breaks the whole personality illusion.
 * So the fallback, when this subject has no recommendation of its own,
 * is restricted to subject-AGNOSTIC candidates (`subjectId: null` —
 * take-a-break/organise-room/visit-library), never another subject's
 * item. The guide has no such restriction (it's the one NPC that's
 * always allowed to speak about any subject).
 */
function findAdviceForSubject(save: UniGameSaveData, context: StudentContext, subjectId: string | null, now: Date, avoidTopic: string | null) {
  const candidates = generateRecommendations(save, context, now, 10);
  const pool = subjectId
    ? (() => {
        const scoped = candidates.filter((c) => c.subjectId === subjectId);
        return scoped.length > 0 ? scoped : candidates.filter((c) => c.subjectId === null);
      })()
    : candidates;
  if (pool.length === 0) return null;
  if (avoidTopic) {
    const fresh = pool.find((c) => c.category !== avoidTopic);
    if (fresh) return fresh;
  }
  return pool[0];
}

/** A struggling assessment for THIS subject worth flagging — real overdue/near-due pressure only, never invented. */
function findStruggleAssessment(context: StudentContext, subjectId: string): string | null {
  const overdue = context.overdueAssessments.find((a) => a.subjectId === subjectId);
  if (overdue) return overdue.assessmentId;
  const pressing = context.upcomingAssessments.find((a) => a.subjectId === subjectId && a.daysUntilDue <= 3);
  return pressing ? pressing.assessmentId : null;
}

/** A resolved follow-up line for a previously-flagged assessment, or null if it's still pending (or nothing was flagged). Never claims the player "said" anything — only that the mentor noticed the outcome. */
function findFollowUpLine(save: UniGameSaveData, subject: { id: string; assessments: Array<{ id: string; title: string }> }, flaggedAssessmentId: string | null): string | null {
  if (!flaggedAssessmentId) return null;
  const assessment = subject.assessments.find((a) => a.id === flaggedAssessmentId);
  if (!assessment) return null;
  const progress = save.assessmentProgress.find((p) => p.assessmentId === flaggedAssessmentId);
  if (progress?.status === "submitted" || progress?.status === "graded") {
    return `Before anything else — how did "${assessment.title}" go?`;
  }
  return null;
}

function buildSubjectConversation(save: UniGameSaveData, context: StudentContext, subjectId: string, now: Date): { conversation: MentorConversation; memoryUpdate: ConversationMemoryUpdate } {
  const subject = save.semester.subjects.find((s) => s.id === subjectId);
  const memory = getNpcMemory(save, subjectId);
  const stages: ConversationStage[] = [];

  if (!subject) {
    // Corrupted/missing subjectId — fail safely with a minimal, honest conversation rather than throwing.
    return { conversation: { npcKey: subjectId, stages: [{ stage: "greeting", line: "Good to see you." }] }, memoryUpdate: { summaryLine: "Good to see you.", topic: null } };
  }

  const followUp = findFollowUpLine(save, subject, memory.flaggedAssessmentId);
  if (followUp) stages.push({ stage: "greeting", line: followUp });

  const greeting = buildGreeting(save, context, subjectId, now);
  if (greeting) stages.push({ stage: "greeting", line: greeting });

  const sim = computeSubjectSimState(subject, save.tasks, save.assessmentProgress);
  const relationship = context.subjects.find((s) => s.subjectId === subjectId)?.relationship;
  const calendar = getSemesterCalendar(save, now);
  if (relationship) {
    const [next] = getTopPriorityItems([subject], save.tasks, now, 1);
    const contextLine = getMentorLine({
      save,
      subject,
      sim,
      relationship,
      calendar,
      nextItemTitle: next ? (next.type === "module" ? next.module.title : next.assessment.title) : null,
      nextIsAssessment: next?.type === "assessment",
      now,
    });
    stages.push({ stage: "context-awareness", line: contextLine });
  }

  const advice = findAdviceForSubject(save, context, subjectId, now, memory.recentTopics[memory.recentTopics.length - 1] ?? null);
  if (advice) stages.push({ stage: "advice", line: `${advice.action} — ${advice.reason}`, evidence: advice.evidence });

  const encouragement = celebrateMessage(context, now) ?? consistencyMessage(context);
  if (encouragement) stages.push({ stage: "encouragement", line: encouragement.line, evidence: encouragement.evidence });

  const reflectionStatements = generateWeeklyReflection(save, context, now).statements;
  const reflection = reflectionStatements.find((s) => s.text.includes(subject.name)) ?? reflectionStatements[0];
  if (reflection) stages.push({ stage: "reflection", line: reflection.text, evidence: reflection.evidence });

  stages.push({ stage: "goodbye", line: getMentorGoodbye(subjectId, now) });

  const newStruggle = findStruggleAssessment(context, subjectId);
  const summaryLine = stages.find((s) => s.stage === "context-awareness")?.line ?? stages[0]?.line ?? "Good to see you.";

  return {
    conversation: { npcKey: subjectId, stages },
    memoryUpdate: { summaryLine, topic: advice?.category ?? null, flagAssessmentId: newStruggle },
  };
}

const GUIDE_GOODBYES = ["Go make the most of today.", "I'll be here at the desk.", "See you around campus.", "Good luck out there."];

function buildGuideConversation(save: UniGameSaveData, context: StudentContext, now: Date): { conversation: MentorConversation; memoryUpdate: ConversationMemoryUpdate } {
  const stages: ConversationStage[] = [];

  const greeting = buildGreeting(save, context, null, now);
  if (greeting) stages.push({ stage: "greeting", line: greeting });

  stages.push({ stage: "context-awareness", line: getMentorAdvice(save, now) });

  const advice = findAdviceForSubject(save, context, null, now, null);
  if (advice) stages.push({ stage: "advice", line: `${advice.action} — ${advice.reason}`, evidence: advice.evidence });

  const encouragement = celebrateMessage(context, now) ?? consistencyMessage(context);
  if (encouragement) stages.push({ stage: "encouragement", line: encouragement.line, evidence: encouragement.evidence });

  const reflection = generateWeeklyReflection(save, context, now).statements[0];
  if (reflection) stages.push({ stage: "reflection", line: reflection.text, evidence: reflection.evidence });

  const dayKey = getMelbourneDateIso(now);
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) hash = (hash * 31 + dayKey.charCodeAt(i)) % 9973;
  stages.push({ stage: "goodbye", line: GUIDE_GOODBYES[hash % GUIDE_GOODBYES.length] });

  const summaryLine = stages.find((s) => s.stage === "context-awareness")?.line ?? "Good to see you.";
  return { conversation: { npcKey: "guide", stages }, memoryUpdate: { summaryLine, topic: advice?.category ?? null } };
}

export const ruleBasedMentorDialogueProvider: MentorDialogueProvider = {
  buildConversation(save, context, npcKey, now) {
    return npcKey === "guide" ? buildGuideConversation(save, context, now) : buildSubjectConversation(save, context, npcKey, now);
  },
};
