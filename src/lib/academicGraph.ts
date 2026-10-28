/**
 * Academic Knowledge Graph (Phase 19, Part 3). A purely derived, in-memory
 * structure over Subject/Module/Assessment/Reading/ScheduleEntry/Outcome/
 * Topic — built fresh from `SemesterRecord` on every call, never stored,
 * never invalidated (same "derive, don't cache" discipline as
 * semesterCalendar.ts/simulation.ts/priority.ts). Never exposed directly to
 * any screen (Part 3's own instruction) — it is a query surface consumed
 * by the Roadmap, Workload, Today, Study Planner, and Search engines.
 *
 * "Module" doubles as the "Week" entity from Part 3's entity list —
 * ModuleRecord.moduleNumber already IS the week/module index the seed data
 * and semesterCalendar.ts both use; introducing a separate Week node would
 * just duplicate that number under a new name.
 *
 * The Assessment --dependsOn--> Module edge is the one genuinely
 * heuristic/informational edge here (no confirmable field links an
 * assessment to a module today — see docs/PHASE_19_ACADEMIC_INTELLIGENCE.md
 * §3): it is populated ONLY when the semester start date is confirmed, by
 * reusing semesterCalendar.ts's own week-of-deadline arithmetic (never a
 * second, diverging date computation) — when the start date isn't
 * confirmed, this edge is simply absent, never guessed another way.
 */

import { daysBetweenDateIso } from "./selectors";
import type { AssessmentRecord, ModuleRecord, SemesterRecord, SubjectRecord } from "../types/domain";

export interface GraphModuleNode {
  kind: "module";
  id: string;
  subjectId: string;
  weekNumber: number;
  title: string;
  scheduleEntryIds: string[];
  readingIds: string[];
  outcomeTexts: string[];
  /** Derived from the module title only — informational grouping, never a new confirmable fact. */
  topics: string[];
}

export interface GraphAssessmentNode {
  kind: "assessment";
  id: string;
  subjectId: string;
  title: string;
  /** Heuristic only — see file header. Empty when the semester start date isn't confirmed. */
  dependsOnModuleIds: string[];
}

export interface GraphReadingNode {
  kind: "reading";
  id: string;
  moduleId: string;
  subjectId: string;
  title: string;
  readingKind: "required" | "recommended";
}

export interface GraphScheduleNode {
  kind: "schedule";
  id: string;
  moduleId: string;
  subjectId: string;
  title: string;
  scheduleKind: "lecture" | "tutorial" | "lab";
}

export interface AcademicGraph {
  modules: GraphModuleNode[];
  assessments: GraphAssessmentNode[];
  readings: GraphReadingNode[];
  scheduleEntries: GraphScheduleNode[];
}

/** The teaching week a deadline falls in, given a confirmed semester start date — the SAME arithmetic semesterCalendar.ts uses for its own `assessmentWeeks`, reused (not duplicated) by academicRoadmap.ts. */
export function moduleWeekForDeadline(startDateIso: string, dueDateIso: string): number {
  return Math.floor(daysBetweenDateIso(startDateIso, dueDateIso) / 7) + 1;
}

function buildModuleNode(subject: SubjectRecord, module: ModuleRecord): GraphModuleNode {
  return {
    kind: "module",
    id: module.id,
    subjectId: subject.id,
    weekNumber: module.moduleNumber,
    title: module.title,
    scheduleEntryIds: module.schedule.map((s) => s.id),
    readingIds: module.readings.map((r) => r.id),
    outcomeTexts: module.outcomes,
    topics: [module.title],
  };
}

function buildAssessmentNode(subject: SubjectRecord, assessment: AssessmentRecord, semester: SemesterRecord): GraphAssessmentNode {
  let dependsOnModuleIds: string[] = [];
  const startConfirmed = semester.startDate.status === "confirmed" && semester.startDate.value;
  const dueConfirmed = assessment.dueDate.status === "confirmed" && assessment.dueDate.value;
  if (startConfirmed && dueConfirmed) {
    const week = moduleWeekForDeadline(semester.startDate.value as string, assessment.dueDate.value as string);
    const module = subject.modules.find((m) => m.moduleNumber === week);
    if (module) dependsOnModuleIds = [module.id];
  }
  return { kind: "assessment", id: assessment.id, subjectId: subject.id, title: assessment.title, dependsOnModuleIds };
}

export function buildAcademicGraph(semester: SemesterRecord): AcademicGraph {
  const modules: GraphModuleNode[] = [];
  const assessments: GraphAssessmentNode[] = [];
  const readings: GraphReadingNode[] = [];
  const scheduleEntries: GraphScheduleNode[] = [];

  for (const subject of semester.subjects) {
    for (const module of subject.modules) {
      modules.push(buildModuleNode(subject, module));
      for (const reading of module.readings) {
        readings.push({ kind: "reading", id: reading.id, moduleId: module.id, subjectId: subject.id, title: reading.title, readingKind: reading.kind });
      }
      for (const entry of module.schedule) {
        scheduleEntries.push({ kind: "schedule", id: entry.id, moduleId: module.id, subjectId: subject.id, title: entry.title, scheduleKind: entry.kind });
      }
    }
    for (const assessment of subject.assessments) {
      assessments.push(buildAssessmentNode(subject, assessment, semester));
    }
  }

  return { modules, assessments, readings, scheduleEntries };
}

/** Every reading/schedule-entry/outcome attached to a specific module, in one place — the lookup every consumer engine actually needs. */
export function getModuleEnrichment(graph: AcademicGraph, moduleId: string) {
  return {
    readings: graph.readings.filter((r) => r.moduleId === moduleId),
    scheduleEntries: graph.scheduleEntries.filter((s) => s.moduleId === moduleId),
  };
}

/** Every assessment whose (heuristic) dependency graph points at this module. */
export function getAssessmentsDependingOnModule(graph: AcademicGraph, moduleId: string): GraphAssessmentNode[] {
  return graph.assessments.filter((a) => a.dependsOnModuleIds.includes(moduleId));
}
