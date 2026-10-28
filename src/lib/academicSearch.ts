/**
 * Academic search (Phase 19, Part 13). A simple, deterministic keyword
 * search over modules/assessments/weeks/topics/lectures/readings —
 * grep-simple by design, no fuzzy-matching library, reusing the existing
 * `normalize()` text helper from src/import/merge/matching.ts (the same
 * normalization the merge engine already uses) rather than reimplementing
 * one. Every result carries enough to call `locateInWorld` directly
 * (see src/world/WorldUiContext.tsx) — `subjectId`, `sceneId` ("room-<id>"),
 * and `interactableId` inferred from the result's kind, the exact
 * convention `SubjectsPanel.tsx` already uses.
 */

import { normalize } from "../import/merge/matching";
import type { SemesterRecord } from "../types/domain";

export type AcademicSearchResultKind = "module" | "assessment" | "reading" | "schedule" | "outcome";

export interface AcademicSearchResult {
  kind: AcademicSearchResultKind;
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  /** Short context line, e.g. "Week 3", "Required reading", "Lecture". */
  detail: string;
  /** Ready to spread directly into `locateInWorld(...)`. */
  locate: { title: string; subjectId: string; sceneId: string; interactableId: string };
}

/** Every module/assessment/reading/schedule-entry/outcome whose title (or, for outcomes, text) contains the query as a substring, case/accent-insensitive. Returns [] for an empty/whitespace-only query — never "everything". */
export function searchAcademicContent(semester: SemesterRecord, query: string): AcademicSearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const results: AcademicSearchResult[] = [];

  for (const subject of semester.subjects) {
    const sceneId = `room-${subject.id}`;

    for (const module of subject.modules) {
      const weekLabel = `Week ${module.moduleNumber}`;
      if (normalize(module.title).includes(q)) {
        results.push({
          kind: "module",
          id: module.id,
          subjectId: subject.id,
          subjectName: subject.name,
          title: module.title,
          detail: weekLabel,
          locate: { title: module.title, subjectId: subject.id, sceneId, interactableId: "modules" },
        });
      }
      for (const reading of module.readings) {
        if (!normalize(reading.title).includes(q)) continue;
        results.push({
          kind: "reading",
          id: reading.id,
          subjectId: subject.id,
          subjectName: subject.name,
          title: reading.title,
          detail: `${reading.kind === "required" ? "Required" : "Recommended"} reading — ${weekLabel}`,
          locate: { title: reading.title, subjectId: subject.id, sceneId, interactableId: "modules" },
        });
      }
      for (const entry of module.schedule) {
        if (!normalize(entry.title).includes(q)) continue;
        results.push({
          kind: "schedule",
          id: entry.id,
          subjectId: subject.id,
          subjectName: subject.name,
          title: entry.title,
          detail: `${entry.kind[0].toUpperCase()}${entry.kind.slice(1)} — ${weekLabel}`,
          locate: { title: entry.title, subjectId: subject.id, sceneId, interactableId: "modules" },
        });
      }
      for (const outcome of module.outcomes) {
        if (!normalize(outcome).includes(q)) continue;
        results.push({
          kind: "outcome",
          id: `${module.id}-outcome-${outcome.slice(0, 20)}`,
          subjectId: subject.id,
          subjectName: subject.name,
          title: outcome,
          detail: `Learning outcome — ${weekLabel}`,
          locate: { title: outcome, subjectId: subject.id, sceneId, interactableId: "modules" },
        });
      }
    }

    for (const assessment of subject.assessments) {
      if (!normalize(assessment.title).includes(q)) continue;
      results.push({
        kind: "assessment",
        id: assessment.id,
        subjectId: subject.id,
        subjectName: subject.name,
        title: assessment.title,
        detail: assessment.dueDate.status === "confirmed" && assessment.dueDate.value ? `Due ${assessment.dueDate.value}` : "Assessment",
        locate: { title: assessment.title, subjectId: subject.id, sceneId, interactableId: "assessments" },
      });
    }
  }

  return results;
}
