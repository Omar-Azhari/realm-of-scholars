/**
 * Priority Engine — the single place priority is scored. Reused by the
 * Priority Centre screen, the Highest Priority dashboard card, "today's
 * focus" on Semester HQ, and the weekly mission generator — none of those
 * re-implement scoring themselves.
 *
 * Scores are always computed fresh from `tasks`/`semester.subjects` (never
 * stored), so priorities "update automatically whenever progress changes" by
 * construction — there is nothing to invalidate.
 */

import { isModuleCompleted, getMelbourneDateTimeKey, daysBetweenDateIso } from "./selectors";
import type { AssessmentRecord, ModuleRecord, SubjectRecord, TaskRecord } from "../types/domain";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

/** Checked in order; first threshold the score clears wins. */
const LEVEL_THRESHOLDS: ReadonlyArray<{ level: PriorityLevel; min: number }> = [
  { level: "critical", min: 80 },
  { level: "high", min: 60 },
  { level: "medium", min: 35 },
  { level: "low", min: 0 },
];

export function levelFromScore(score: number): PriorityLevel {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return "low";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** One scored contributing factor behind a priority score — used to render an honest "why this ranks here" breakdown. */
export interface PriorityReason {
  label: string;
  contribution: number;
  max: number;
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export interface ModulePriority {
  moduleId: string;
  subjectId: string;
  score: number;
  level: PriorityLevel;
  completed: boolean;
  reviewed: boolean;
  /** Count of earlier (lower moduleNumber) modules in the same subject that aren't complete yet. */
  blockedByCount: number;
  /** Breakdown of the components that sum (pre-clamp) to `score`. */
  reasons: PriorityReason[];
}

/**
 * Modules have no due date of their own, so priority here is about
 * actionability: a completed module scores low (nothing to do); an
 * incomplete module that's "next in line" (no earlier incomplete module in
 * the same subject) scores higher than one still blocked behind several
 * others, since it's what's actually actionable right now. This is a soft
 * ordering heuristic derived from the module numbers already in the seed
 * data — not a new academic claim about prerequisites.
 */
export function computeModulePriorities(
  tasks: TaskRecord[],
  subjects: SubjectRecord[]
): ModulePriority[] {
  const results: ModulePriority[] = [];

  for (const subject of subjects) {
    const orderedModules = [...subject.modules].sort((a, b) => a.moduleNumber - b.moduleNumber);
    let earlierIncompleteCount = 0;

    for (const module of orderedModules) {
      const completed = isModuleCompleted(tasks, module.id);
      const reviewed = tasks.some((task) => task.linkedModuleId === module.id && task.reviewedAt !== null);
      const blockedByCount = earlierIncompleteCount;

      let score: number;
      let reasons: PriorityReason[];
      if (completed) {
        score = 5;
        reasons = [{ label: "Already completed", contribution: 5, max: 100 }];
      } else {
        const actionabilityContribution = blockedByCount === 0 ? 30 : -Math.min(30, blockedByCount * 8);
        const reviewedContribution = reviewed ? 10 : 0;
        score = 40 + actionabilityContribution + reviewedContribution;
        reasons = [
          { label: "Base priority", contribution: 40, max: 40 },
          {
            label:
              blockedByCount === 0
                ? "Next actionable module"
                : `Blocked by ${blockedByCount} earlier module${blockedByCount === 1 ? "" : "s"}`,
            contribution: actionabilityContribution,
            max: 30,
          },
          { label: reviewed ? "Already reviewed" : "Not yet reviewed", contribution: reviewedContribution, max: 10 },
        ];
      }
      score = clamp(score, 0, 100);

      results.push({
        moduleId: module.id,
        subjectId: subject.id,
        score,
        level: levelFromScore(score),
        completed,
        reviewed,
        blockedByCount,
        reasons,
      });

      if (!completed) earlierIncompleteCount += 1;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export interface AssessmentPriority {
  assessmentId: string;
  subjectId: string;
  score: number;
  level: PriorityLevel;
  overdue: boolean;
  /** Breakdown of the components that sum (pre-clamp) to `score`. */
  reasons: PriorityReason[];
}

/**
 * score = weight (0-40, confirmed value or a neutral 15 scoring default when
 * unconfirmed — never displayed as a real weight, only used to rank) +
 * urgency (0-40, from days until due; a neutral nudge when the date isn't
 * confirmed) + a visibility bump for NEEDS_CONFIRMATION items so they
 * surface rather than getting buried under confirmed ones. An overdue
 * assessment always scores 100 (forces "critical"), matching the "overdue
 * always sorts to the top" rule from planning/FEATURE_PLAN.md.
 */
export function computeAssessmentPriorities(
  subjects: SubjectRecord[],
  now: Date = new Date()
): AssessmentPriority[] {
  const nowKey = getMelbourneDateTimeKey(now);
  const results: AssessmentPriority[] = [];

  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime, weight, confirmationStatus } = assessment;
      const hasConfirmedDeadline =
        dueDate.status === "confirmed" && dueTime.status === "confirmed" && Boolean(dueDate.value) && Boolean(dueTime.value);
      const dueKey = hasConfirmedDeadline ? `${dueDate.value}T${dueTime.value}` : null;
      const overdue = dueKey !== null && dueKey < nowKey;

      let score: number;
      let reasons: PriorityReason[];
      if (overdue) {
        score = 100;
        reasons = [{ label: "Overdue", contribution: 100, max: 100 }];
      } else {
        const weightComponent =
          (weight.status === "confirmed" && weight.value !== null ? clamp(weight.value, 0, 100) : 15) * 0.4;

        let urgencyComponent = 10; // neutral nudge when the due date isn't confirmed
        let urgencyLabel = "Due date not yet confirmed";
        if (dueKey) {
          const daysUntil = daysBetweenDateIso(nowKey, dueKey);
          if (daysUntil <= 1) urgencyComponent = 40;
          else if (daysUntil <= 3) urgencyComponent = 34;
          else if (daysUntil <= 7) urgencyComponent = 26;
          else if (daysUntil <= 14) urgencyComponent = 16;
          else if (daysUntil <= 28) urgencyComponent = 8;
          else urgencyComponent = 2;
          urgencyLabel = daysUntil <= 0 ? "Due today" : `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
        }

        const confirmationComponent =
          confirmationStatus === "needs_confirmation" ? 15 : confirmationStatus === "partially_confirmed" ? 8 : 0;
        const confirmationLabel =
          confirmationStatus === "needs_confirmation"
            ? "Needs confirmation"
            : confirmationStatus === "partially_confirmed"
              ? "Partially confirmed"
              : "Fully confirmed";

        score = weightComponent + urgencyComponent + confirmationComponent;
        reasons = [
          {
            label:
              weight.status === "confirmed" && weight.value !== null
                ? `Weighting (${weight.value}%)`
                : "Weighting (unconfirmed, scored as low)",
            contribution: Math.round(weightComponent),
            max: 40,
          },
          { label: urgencyLabel, contribution: urgencyComponent, max: 40 },
          { label: confirmationLabel, contribution: confirmationComponent, max: 15 },
        ];
      }
      score = clamp(score, 0, 100);

      results.push({
        assessmentId: assessment.id,
        subjectId: subject.id,
        score,
        level: levelFromScore(score),
        overdue,
        reasons,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Combined ranking (modules + assessments), for "today's focus" and the
// Highest Priority dashboard card.
// ---------------------------------------------------------------------------

export type PriorityItem =
  | { type: "module"; subject: SubjectRecord; module: ModuleRecord; priority: ModulePriority }
  | { type: "assessment"; subject: SubjectRecord; assessment: AssessmentRecord; priority: AssessmentPriority };

/** The id used to key manual pin overrides — module.id and assessment.id are already disjoint namespaces. */
export function getPriorityItemId(item: PriorityItem): string {
  return item.type === "module" ? item.module.id : item.assessment.id;
}

/**
 * Top actionable (incomplete) items across modules and assessments, highest
 * score first. `pinnedIds` is the Priority Centre's manual override: any
 * matching item is pulled to the front (still ordered by score among
 * themselves), ahead of the automatic ranking — a real, persisted decision
 * rather than a cosmetic reorder.
 */
export function getTopPriorityItems(
  subjects: SubjectRecord[],
  tasks: TaskRecord[],
  now: Date = new Date(),
  limit = 5,
  pinnedIds: readonly string[] = []
): PriorityItem[] {
  const items: PriorityItem[] = [];
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

  for (const mp of computeModulePriorities(tasks, subjects)) {
    if (mp.completed) continue;
    const subject = subjectsById.get(mp.subjectId);
    const module = subject?.modules.find((m) => m.id === mp.moduleId);
    if (subject && module) items.push({ type: "module", subject, module, priority: mp });
  }

  for (const ap of computeAssessmentPriorities(subjects, now)) {
    const subject = subjectsById.get(ap.subjectId);
    const assessment = subject?.assessments.find((a) => a.id === ap.assessmentId);
    if (subject && assessment) items.push({ type: "assessment", subject, assessment, priority: ap });
  }

  const pinnedSet = new Set(pinnedIds);
  items.sort((a, b) => {
    const aPinned = pinnedSet.has(getPriorityItemId(a));
    const bPinned = pinnedSet.has(getPriorityItemId(b));
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return b.priority.score - a.priority.score;
  });
  return items.slice(0, limit);
}
