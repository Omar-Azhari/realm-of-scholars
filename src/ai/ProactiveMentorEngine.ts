/**
 * Phase 24 "Proactive Mentor Engine" — decides WHETHER to interrupt, WHO
 * should speak, at what PRIORITY, under which CATEGORY, and whether a
 * candidate is still on COOLDOWN. It never generates dialogue: the
 * `teaserLine` here is a short, fixed, deterministic notification string
 * (see `docs/PHASE_24_PROACTIVE_MENTOR_AUDIT.md` §5) — the real
 * conversation, when the player clicks through, is still built exactly the
 * same way as Phase 23 (`ruleBasedMentorDialogueProvider.buildConversation`).
 * This split is what "Future AI Ready" (decision-making stays deterministic;
 * only text generation may later change) actually means in code: swapping
 * in an LLM later only ever touches dialogue generation, never this module.
 *
 * Every trigger reads ONLY `StudentContext` (Rule #3) plus the two small,
 * additive save fields this phase introduces (`proactiveMentorLog` for
 * cooldown/persistence, and the `milestones` log Phase 11/22 already
 * maintain for the four event-based triggers below) — no new "did X just
 * become true" tracking was needed; see the audit §3 for why.
 */

import { getMelbourneDateIso, daysBetweenDateIso } from "../lib/selectors";
import { getCountedSessions } from "../lib/focusSession";
import type { StudentContext } from "./ContextEngine";
import type { ProactiveLogEntry, UniGameSaveData } from "../types/domain";

export type ProactiveTriggerId =
  | "assessment-due-tomorrow"
  | "subject-neglected"
  | "goal-completed"
  | "milestone-unlocked"
  | "achievement-earned"
  | "room-evolution"
  | "confidence-very-low"
  | "confidence-very-high"
  | "heavy-workload"
  | "long-inactivity"
  | "first-login-today"
  | "returning-after-absence"
  | "semester-halfway"
  | "semester-ending"
  | "new-module-unlocked";

export type ProactiveCategory = "urgent" | "celebration" | "care" | "ambient";

export interface ProactiveEvent {
  /** Stable dedupe key for this specific instance — also written as `ProactiveLogEntry.triggerId` once fired. */
  id: string;
  triggerId: ProactiveTriggerId;
  npcKey: string;
  category: ProactiveCategory;
  /** 0-100; higher fires first when multiple candidates are eligible at once. */
  priority: number;
  /** Short, fixed notification text — NOT the conversation itself (see module doc comment). */
  teaserLine: string;
  /** Hours before this exact id may fire again; `null` means "once ever" (permanent, for real one-off events). */
  cooldownHours: number | null;
}

/** At most this many proactive notifications may fire in one Melbourne day — "never annoying" (brief's own words). */
export const DAILY_PROACTIVE_LIMIT = 3;

function lastFiredAt(log: ProactiveLogEntry[], id: string): string | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].triggerId === id) return log[i].firedAt;
  }
  return null;
}

function isOnCooldown(log: ProactiveLogEntry[], id: string, cooldownHours: number | null, now: Date): boolean {
  const last = lastFiredAt(log, id);
  if (!last) return false;
  if (cooldownHours === null) return true; // permanent once-ever
  const hoursSince = (now.getTime() - new Date(last).getTime()) / (1000 * 60 * 60);
  return hoursSince < cooldownHours;
}

/** How many proactive events have already fired today (Melbourne calendar day) — the daily-limit gate. */
export function countFiredToday(log: ProactiveLogEntry[], now: Date = new Date()): number {
  const todayIso = getMelbourneDateIso(now);
  return log.filter((entry) => getMelbourneDateIso(new Date(entry.firedAt)) === todayIso).length;
}

/** Real days since a subject's last counted Focus Sprint or completed module — null if the subject has never been engaged with at all (a brand-new subject shouldn't be nagged for "neglect"). */
function daysSinceLastStudied(save: UniGameSaveData, subjectId: string, now: Date): number | null {
  const lastSprintIso = getCountedSessions(save)
    .filter((s) => s.subjectId === subjectId)
    .map((s) => s.startedAt)
    .sort()
    .at(-1);
  const subject = save.semester.subjects.find((s) => s.id === subjectId);
  const moduleIds = new Set(subject?.modules.map((m) => m.id) ?? []);
  const lastModuleIso = save.tasks
    .filter((t) => t.linkedModuleId && moduleIds.has(t.linkedModuleId) && t.completed && t.completedAt)
    .map((t) => t.completedAt as string)
    .sort()
    .at(-1);
  const candidates = [lastSprintIso, lastModuleIso].filter((v): v is string => !!v);
  if (candidates.length === 0) return null;
  const lastActivityIso = candidates.sort().at(-1) as string;
  return daysBetweenDateIso(lastActivityIso, now.toISOString());
}

function assessmentDueTomorrowTriggers(context: StudentContext): ProactiveEvent[] {
  return context.upcomingAssessments
    .filter((a) => a.daysUntilDue === 1)
    .map((a) => ({
      id: `assessment-due-tomorrow:${a.assessmentId}`,
      triggerId: "assessment-due-tomorrow" as const,
      npcKey: a.subjectId,
      category: "urgent" as const,
      priority: 95,
      teaserLine: "Let's chat before tomorrow's assessment.",
      cooldownHours: 20,
    }));
}

function subjectNeglectedTriggers(save: UniGameSaveData, context: StudentContext, now: Date): ProactiveEvent[] {
  const events: ProactiveEvent[] = [];
  for (const subject of context.subjects) {
    const days = daysSinceLastStudied(save, subject.subjectId, now);
    if (days === null || days < 3) continue;
    events.push({
      id: `subject-neglected:${subject.subjectId}`,
      triggerId: "subject-neglected",
      npcKey: subject.subjectId,
      category: "care",
      priority: 65,
      teaserLine: "I've got a suggestion when you have a minute.",
      cooldownHours: 48,
    });
  }
  return events;
}

const MILESTONE_TRIGGER_MAP: Record<string, { triggerId: ProactiveTriggerId; category: ProactiveCategory; priority: number }> = {
  "goal-complete": { triggerId: "goal-completed", category: "celebration", priority: 75 },
  achievement: { triggerId: "achievement-earned", category: "celebration", priority: 85 },
  "bond-level": { triggerId: "milestone-unlocked", category: "celebration", priority: 80 },
  "room-stage": { triggerId: "room-evolution", category: "celebration", priority: 82 },
};

/** Subject id embedded in a `bond:<subjectId>:<level>` / `stage:<subjectId>:<stage>` milestone id — null (guide-level) for kinds that aren't per-subject. */
function subjectIdFromMilestoneId(milestoneId: string): string | null {
  const parts = milestoneId.split(":");
  return (parts[0] === "bond" || parts[0] === "stage") && parts[1] ? parts[1] : null;
}

function milestoneTriggers(save: UniGameSaveData, now: Date): ProactiveEvent[] {
  const todayIso = getMelbourneDateIso(now);
  const events: ProactiveEvent[] = [];
  for (const entry of save.milestones) {
    if (entry.at.slice(0, 10) !== todayIso) continue;
    const mapping = MILESTONE_TRIGGER_MAP[entry.kind];
    if (!mapping) continue;
    events.push({
      id: `milestone:${entry.id}`,
      triggerId: mapping.triggerId,
      npcKey: subjectIdFromMilestoneId(entry.id) ?? "guide",
      category: mapping.category,
      priority: mapping.priority,
      teaserLine: "You've made excellent progress today.",
      cooldownHours: null,
    });
  }
  return events;
}

function confidenceTriggers(context: StudentContext): ProactiveEvent[] {
  const events: ProactiveEvent[] = [];
  for (const subject of context.subjects) {
    if (subject.confidence.level === "very-low") {
      events.push({
        id: `confidence-very-low:${subject.subjectId}`,
        triggerId: "confidence-very-low",
        npcKey: subject.subjectId,
        category: "care",
        priority: 60,
        teaserLine: "I've got a suggestion when you have a minute.",
        cooldownHours: 72,
      });
    } else if (subject.confidence.level === "excellent") {
      events.push({
        id: `confidence-very-high:${subject.subjectId}`,
        triggerId: "confidence-very-high",
        npcKey: subject.subjectId,
        category: "ambient",
        priority: 40,
        teaserLine: "You've made excellent progress today.",
        cooldownHours: 72,
      });
    }
  }
  return events;
}

function heavyWorkloadTrigger(context: StudentContext): ProactiveEvent[] {
  if (context.workloadLevel !== "peak" && context.workloadLevel !== "high") return [];
  return [
    {
      id: "heavy-workload",
      triggerId: "heavy-workload",
      npcKey: "guide",
      category: "care",
      priority: 70,
      teaserLine: "I've got a suggestion when you have a minute.",
      cooldownHours: 48,
    },
  ];
}

function loginAndAbsenceTriggers(context: StudentContext, now: Date): ProactiveEvent[] {
  const todayIso = getMelbourneDateIso(now);
  const events: ProactiveEvent[] = [];
  const lastActive = context.streak.lastActiveDate;

  if (lastActive !== todayIso) {
    events.push({
      id: `first-login-today:${todayIso}`,
      triggerId: "first-login-today",
      npcKey: "guide",
      category: "ambient",
      priority: 20,
      teaserLine: "Good to see you today.",
      cooldownHours: null,
    });
  }

  if (lastActive) {
    const gapDays = daysBetweenDateIso(lastActive, todayIso);
    if (gapDays >= 5) {
      events.push({
        id: `returning-after-absence:${todayIso}`,
        triggerId: "returning-after-absence",
        npcKey: "guide",
        category: "care",
        priority: 55,
        teaserLine: "Welcome back — it's been a few days.",
        cooldownHours: null,
      });
    } else if (gapDays >= 2) {
      events.push({
        id: `long-inactivity:${todayIso}`,
        triggerId: "long-inactivity",
        npcKey: "guide",
        category: "care",
        priority: 45,
        teaserLine: "Good to see you back.",
        cooldownHours: null,
      });
    }
  }

  return events;
}

function semesterMilestoneTriggers(context: StudentContext): ProactiveEvent[] {
  const events: ProactiveEvent[] = [];
  const { currentWeek, totalTeachingWeeks, period } = context.semester;
  if (currentWeek !== null && totalTeachingWeeks > 0 && currentWeek === Math.ceil(totalTeachingWeeks / 2)) {
    events.push({
      id: "semester-halfway",
      triggerId: "semester-halfway",
      npcKey: "guide",
      category: "ambient",
      priority: 30,
      teaserLine: "We're halfway through the semester.",
      cooldownHours: null,
    });
  }
  if (period === "revision" || period === "exams") {
    events.push({
      id: "semester-ending",
      triggerId: "semester-ending",
      npcKey: "guide",
      category: "ambient",
      priority: 35,
      teaserLine: "The semester's winding up — let's finish it well.",
      cooldownHours: null,
    });
  }
  return events;
}

/** A module counts as "newly unlocked" if the immediately-preceding module (by moduleNumber) in the same subject was completed today — no separate "unlocked" flag exists anywhere, so this is the honest, derived signal. */
function newModuleUnlockedTriggers(save: UniGameSaveData, now: Date): ProactiveEvent[] {
  const todayIso = getMelbourneDateIso(now);
  const events: ProactiveEvent[] = [];
  for (const subject of save.semester.subjects) {
    const sorted = [...subject.modules].sort((a, b) => a.moduleNumber - b.moduleNumber);
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const task = save.tasks.find((t) => t.linkedModuleId === previous.id);
      if (task?.completed && task.completedAt && task.completedAt.slice(0, 10) === todayIso) {
        events.push({
          id: `new-module-unlocked:${sorted[i].id}:${todayIso}`,
          triggerId: "new-module-unlocked",
          npcKey: subject.id,
          category: "ambient",
          priority: 25,
          teaserLine: `A new module just opened up in ${subject.name}.`,
          cooldownHours: null,
        });
      }
    }
  }
  return events;
}

/** Every currently-true candidate, regardless of cooldown — exported mainly for the verification harness; callers should use `evaluateProactiveTriggers` or `pickNextProactiveEvent`. */
export function collectProactiveCandidates(save: UniGameSaveData, context: StudentContext, now: Date = new Date()): ProactiveEvent[] {
  return [
    ...assessmentDueTomorrowTriggers(context),
    ...subjectNeglectedTriggers(save, context, now),
    ...milestoneTriggers(save, now),
    ...confidenceTriggers(context),
    ...heavyWorkloadTrigger(context),
    ...loginAndAbsenceTriggers(context, now),
    ...semesterMilestoneTriggers(context),
    ...newModuleUnlockedTriggers(save, now),
  ];
}

/** Candidates not currently on cooldown, ranked highest-priority first. */
export function evaluateProactiveTriggers(save: UniGameSaveData, context: StudentContext, now: Date = new Date()): ProactiveEvent[] {
  return collectProactiveCandidates(save, context, now)
    .filter((event) => !isOnCooldown(save.proactiveMentorLog, event.id, event.cooldownHours, now))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * The single event worth surfacing right now, or `null` when nothing
 * qualifies, the daily cap is already reached, or the caller says the
 * player is currently in a state that must never be interrupted (Rule #6 —
 * see `Game3D.tsx`'s interruption-suppression check, which is the only
 * place `suppressed` should be computed).
 */
export function pickNextProactiveEvent(
  save: UniGameSaveData,
  context: StudentContext,
  now: Date = new Date(),
  options?: { suppressed?: boolean }
): ProactiveEvent | null {
  if (options?.suppressed) return null;
  if (countFiredToday(save.proactiveMentorLog, now) >= DAILY_PROACTIVE_LIMIT) return null;
  return evaluateProactiveTriggers(save, context, now)[0] ?? null;
}
