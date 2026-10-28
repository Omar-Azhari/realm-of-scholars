/**
 * Academic Roadmap (Phase 19, Part 4) — a forward-looking weekly/
 * assessment/study/exam view, distinct from the existing, RETROSPECTIVE
 * `src/screens/TimelineScreen.tsx` (a past-events log; unchanged, untouched
 * by this phase — see docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §1 for why
 * the two are deliberately kept separate despite the similar name). Built
 * entirely from `getSemesterCalendar()` (unchanged) + the Academic
 * Knowledge Graph (§academicGraph.ts) — no new date arithmetic invented
 * here beyond what those two already established.
 */

import { getSemesterCalendar } from "./semesterCalendar";
import { buildAcademicGraph, moduleWeekForDeadline, type GraphReadingNode, type GraphScheduleNode } from "./academicGraph";
import { isModuleCompleted } from "./selectors";
import type { UniGameSaveData } from "../types/domain";

export interface WeekRoadmapEntry {
  weekNumber: number;
  weekStartIso: string | null;
  modules: Array<{ subjectId: string; subjectName: string; moduleId: string; title: string; completed: boolean }>;
  assessmentsDue: Array<{ subjectId: string; subjectName: string; assessmentId: string; title: string }>;
  scheduleEntries: GraphScheduleNode[];
  readings: GraphReadingNode[];
}

export interface AssessmentRoadmapEntry {
  subjectId: string;
  subjectName: string;
  assessmentId: string;
  title: string;
  dueDateIso: string | null;
  weekNumber: number | null;
  /** Confirmed weighting only — null when unconfirmed, never a guess. */
  weighting: number | null;
}

export interface StudyRoadmapEntry {
  subjectId: string;
  subjectName: string;
  moduleId: string;
  title: string;
  weekNumber: number;
}

export interface ExamRoadmapEntry {
  subjectId: string;
  subjectName: string;
  assessmentId: string;
  title: string;
  examInfo: string | null;
  dueDateIso: string | null;
  weekNumber: number | null;
}

export interface AcademicRoadmap {
  weeks: WeekRoadmapEntry[];
  assessmentRoadmap: AssessmentRoadmapEntry[];
  studyRoadmap: StudyRoadmapEntry[];
  examRoadmap: ExamRoadmapEntry[];
  /** Confirmed break labels, surfaced as-is — their free-text `range` is never parsed into week numbers (no structured date range exists on this field; see SemesterRecord.breaks). */
  breakLabels: string[];
}

export function buildAcademicRoadmap(save: UniGameSaveData, now: Date = new Date()): AcademicRoadmap {
  const calendar = getSemesterCalendar(save, now);
  const graph = buildAcademicGraph(save.semester);
  const subjectsById = new Map(save.semester.subjects.map((s) => [s.id, s]));

  const weeks: WeekRoadmapEntry[] = calendar.weekStarts.map((weekStartIso, index) => {
    const weekNumber = index + 1;
    const modules: WeekRoadmapEntry["modules"] = [];
    const assessmentsDue: WeekRoadmapEntry["assessmentsDue"] = [];
    const scheduleEntries: GraphScheduleNode[] = [];
    const readings: GraphReadingNode[] = [];

    for (const moduleNode of graph.modules) {
      if (moduleNode.weekNumber !== weekNumber) continue;
      const subject = subjectsById.get(moduleNode.subjectId);
      if (!subject) continue;
      modules.push({
        subjectId: subject.id,
        subjectName: subject.name,
        moduleId: moduleNode.id,
        title: moduleNode.title,
        completed: isModuleCompleted(save.tasks, moduleNode.id),
      });
      scheduleEntries.push(...graph.scheduleEntries.filter((s) => s.moduleId === moduleNode.id));
      readings.push(...graph.readings.filter((r) => r.moduleId === moduleNode.id));
    }

    if (calendar.startConfirmed) {
      const start = save.semester.startDate.value as string;
      for (const subject of save.semester.subjects) {
        for (const assessment of subject.assessments) {
          if (assessment.dueDate.status !== "confirmed" || !assessment.dueDate.value) continue;
          if (moduleWeekForDeadline(start, assessment.dueDate.value) !== weekNumber) continue;
          assessmentsDue.push({ subjectId: subject.id, subjectName: subject.name, assessmentId: assessment.id, title: assessment.title });
        }
      }
    }

    return { weekNumber, weekStartIso, modules, assessmentsDue, scheduleEntries, readings };
  });

  const assessmentRoadmap: AssessmentRoadmapEntry[] = [];
  const examRoadmap: ExamRoadmapEntry[] = [];
  for (const subject of save.semester.subjects) {
    for (const assessment of subject.assessments) {
      const dueDateIso = assessment.dueDate.status === "confirmed" ? assessment.dueDate.value : null;
      const weekNumber =
        calendar.startConfirmed && dueDateIso ? moduleWeekForDeadline(save.semester.startDate.value as string, dueDateIso) : null;
      const weighting = assessment.weight.status === "confirmed" ? assessment.weight.value : null;
      assessmentRoadmap.push({ subjectId: subject.id, subjectName: subject.name, assessmentId: assessment.id, title: assessment.title, dueDateIso, weekNumber, weighting });
      if (assessment.kind === "exam") {
        examRoadmap.push({
          subjectId: subject.id,
          subjectName: subject.name,
          assessmentId: assessment.id,
          title: assessment.title,
          examInfo: assessment.examInfo.status === "confirmed" ? assessment.examInfo.value : null,
          dueDateIso,
          weekNumber,
        });
      }
    }
  }
  assessmentRoadmap.sort((a, b) => {
    if (a.dueDateIso && b.dueDateIso) return a.dueDateIso < b.dueDateIso ? -1 : a.dueDateIso > b.dueDateIso ? 1 : 0;
    if (a.dueDateIso) return -1;
    if (b.dueDateIso) return 1;
    return 0;
  });

  const studyRoadmap: StudyRoadmapEntry[] = [];
  for (const subject of save.semester.subjects) {
    for (const module of [...subject.modules].sort((a, b) => a.moduleNumber - b.moduleNumber)) {
      if (isModuleCompleted(save.tasks, module.id)) continue;
      studyRoadmap.push({ subjectId: subject.id, subjectName: subject.name, moduleId: module.id, title: module.title, weekNumber: module.moduleNumber });
    }
  }

  const breakLabels = save.semester.breaks.map((b) => b.label);

  return { weeks, assessmentRoadmap, studyRoadmap, examRoadmap, breakLabels };
}
