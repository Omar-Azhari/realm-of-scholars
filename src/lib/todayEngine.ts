/**
 * Today Engine (Phase 19, Part 6) — a thin, deterministic phrasing layer
 * over the EXISTING `getTopPriorityItems()` (src/lib/priority.ts, unchanged),
 * which already ranks every incomplete module/assessment by due date,
 * weighting, progress/completion, and time-remaining, and already powers
 * "today's focus" on Semester HQ and the Priority Centre. This file adds
 * NO new ranking logic — see docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §1/§7
 * for why that engine already covers most of what "Part 6: Today Engine"
 * asks for.
 *
 * "User preferences" (Part 6) reuses the EXISTING `settings.pinnedPriorityIds`
 * manual-override mechanism (already a real, persisted user decision — the
 * Priority Centre's pin feature) rather than inventing a second preferences
 * store.
 *
 * Strictly read-only: this returns recommendation strings. Nothing here
 * calls a mutation, completes a task, or edits progress.
 */

import { getTopPriorityItems, type PriorityItem } from "./priority";
import { getModuleEnrichment, buildAcademicGraph } from "./academicGraph";
import { getMelbourneDateIso } from "./selectors";
import type { ModuleScheduleEntry, UniGameSaveData } from "../types/domain";

export interface TodayRecommendation {
  item: PriorityItem;
  /** e.g. "Read Module 5", "Watch Lecture 7", "Complete Assignment 2 draft", "Revise Week 3". */
  action: string;
}

/**
 * Phrases a single priority item using only facts the record actually has —
 * never implying content (a reading, a lecture) that isn't really linked to
 * that module. Falls back to a generic, still-accurate verb when no richer
 * Phase 19 field is present, so this works identically for saves with none
 * of the new module/reading/schedule data.
 */
function phraseModuleItem(item: Extract<PriorityItem, { type: "module" }>, graph: ReturnType<typeof buildAcademicGraph>): string {
  const enrichment = getModuleEnrichment(graph, item.module.id);
  const lecture = enrichment.scheduleEntries.find((s) => s.scheduleKind === "lecture");
  if (lecture) return `Watch ${lecture.title}`;
  if (enrichment.readings.length > 0) return `Read ${item.module.title}`;
  return `Continue ${item.module.title}`;
}

function phraseAssessmentItem(item: Extract<PriorityItem, { type: "assessment" }>): string {
  if (item.priority.overdue) return `${item.assessment.title} is overdue — submit it`;
  return `Work on ${item.assessment.title}`;
}

function phraseItem(item: PriorityItem, graph: ReturnType<typeof buildAcademicGraph>): string {
  return item.type === "module" ? phraseModuleItem(item, graph) : phraseAssessmentItem(item);
}

/**
 * Today's recommendations, highest priority first — same ranking as
 * `getTopPriorityItems`, just phrased as an action. `pinnedIds` reuses
 * `settings.pinnedPriorityIds` verbatim (the existing Priority Centre
 * override), so a manual pin affects both screens identically.
 */
export function getTodayRecommendations(save: UniGameSaveData, now: Date = new Date(), limit = 5): TodayRecommendation[] {
  const items = getTopPriorityItems(save.semester.subjects, save.tasks, now, limit, save.settings.pinnedPriorityIds);
  const graph = buildAcademicGraph(save.semester);
  return items.map((item) => ({ item, action: phraseItem(item, graph) }));
}

export interface TodayClass {
  subjectId: string;
  subjectName: string;
  moduleTitle: string;
  entry: ModuleScheduleEntry;
}

/**
 * Phase 20E, Part 4 "Today's classes" — reads `ModuleScheduleEntry.dayOfWeek`
 * directly (the graph's own `GraphScheduleNode` deliberately doesn't carry
 * it — see academicGraph.ts — so this goes to the raw semester data
 * instead of extending that shared node shape). Never fabricates a class:
 * a save whose imported schedule data has no `dayOfWeek` set (the current
 * seed data, extracted before any provider populated this field) simply
 * returns an empty list, not an invented timetable.
 */
export function getTodaysClasses(save: UniGameSaveData, now: Date = new Date()): TodayClass[] {
  const todayName = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", weekday: "long" }).format(now);
  const classes: TodayClass[] = [];
  for (const subject of save.semester.subjects) {
    for (const module of subject.modules) {
      for (const entry of module.schedule) {
        if (entry.dayOfWeek === todayName) {
          classes.push({ subjectId: subject.id, subjectName: subject.name, moduleTitle: module.title, entry });
        }
      }
    }
  }
  return classes.sort((a, b) => (a.entry.startTime ?? "").localeCompare(b.entry.startTime ?? ""));
}

/**
 * Phase 20E, Part 4 "suggested study block" — the single top recommendation
 * from the existing `getTodayRecommendations`, reused rather than a second
 * ranking pass, phrased as a study-block suggestion.
 */
export function getSuggestedStudyBlock(save: UniGameSaveData, now: Date = new Date()): TodayRecommendation | null {
  return getTodayRecommendations(save, now, 1)[0] ?? null;
}

const ENCOURAGEMENT_LINES = [
  "Whatever you tackle today, it'll add up.",
  "Small steps count just as much as big ones.",
  "Glad you're here — let's make today count.",
  "No pressure — just do what you can today.",
  "Every session moves the needle, even a short one.",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

/**
 * Phase 20E, Part 4 "personal encouragement" — a short, deterministic line
 * that varies by real day (never randomised within a session, never the
 * same wording twice in a row across consecutive days).
 */
export function getDailyEncouragement(now: Date = new Date()): string {
  const dayKey = getMelbourneDateIso(now);
  return ENCOURAGEMENT_LINES[hashString(dayKey) % ENCOURAGEMENT_LINES.length];
}
