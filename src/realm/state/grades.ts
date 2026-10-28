/**
 * Grade and WAM tracker, using La Trobe's rules:
 *   coursework grades A 80-100, B 70-79, C 60-69, D 50-59, N 0-49;
 *   WAM = Σ(subject mark × credit points) ÷ Σ credit points.
 * Source: La Trobe Assessment Procedure – Grades and Administrative Codes.
 *
 * A subject's mark so far is built from the assessments the student has
 * recorded, weighted by each assessment's % of the grade. Only weights the
 * curriculum actually knows are used — unknown weights are never guessed.
 */

import { realmStore } from "./store";
import { chat } from "./events";
import type { RealmAssessment, RealmState, RealmSubject } from "../types";

export const DEFAULT_CREDIT_POINTS = 15;

export interface GradeBand {
  letter: "A" | "B" | "C" | "D" | "N";
  min: number;
  label: string;
}

export const GRADE_BANDS: GradeBand[] = [
  { letter: "A", min: 80, label: "A (80–100)" },
  { letter: "B", min: 70, label: "B (70–79)" },
  { letter: "C", min: 60, label: "C (60–69)" },
  { letter: "D", min: 50, label: "D (50–59)" },
  { letter: "N", min: 0, label: "N (fail, 0–49)" },
];

export function gradeFor(mark: number): GradeBand {
  return GRADE_BANDS.find((b) => mark >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
}

export function setMark(assessmentId: string, score: number | null, outOf = 100): void {
  realmStore.set((s) => {
    const marks = { ...s.progress.marks };
    if (score === null || !Number.isFinite(score) || !Number.isFinite(outOf) || outOf <= 0) delete marks[assessmentId];
    else marks[assessmentId] = { score: Math.max(0, Math.min(outOf, score)), outOf };
    return { ...s, progress: { ...s.progress, marks } };
  });
}

export interface SubjectResult {
  subject: RealmSubject;
  /** Weighted % points earned so far (out of `markedWeight`). */
  earned: number;
  markedWeight: number;
  /** Weight of assessments with a known weight but no mark yet. */
  remainingWeight: number;
  /** Assessments whose weight is unknown (can't be counted). */
  unknownWeight: RealmAssessment[];
  /** Average % across marked work, or null when nothing is marked. */
  average: number | null;
  /** Final mark, only when every weighted assessment is marked and weights add to ~100. */
  final: number | null;
  creditPoints: number;
}

export function subjectResult(state: RealmState, subject: RealmSubject): SubjectResult {
  let earned = 0;
  let markedWeight = 0;
  let remainingWeight = 0;
  const unknownWeight: RealmAssessment[] = [];
  for (const a of subject.assessments) {
    const mark = state.progress.marks[a.id];
    if (a.weightPercent === null) {
      unknownWeight.push(a);
      continue;
    }
    if (mark) {
      earned += (mark.score / mark.outOf) * a.weightPercent;
      markedWeight += a.weightPercent;
    } else remainingWeight += a.weightPercent;
  }
  const totalWeight = markedWeight + remainingWeight;
  const complete = remainingWeight === 0 && markedWeight > 0 && Math.abs(totalWeight - 100) <= 1;
  return {
    subject,
    earned,
    markedWeight,
    remainingWeight,
    unknownWeight,
    average: markedWeight > 0 ? (earned / markedWeight) * 100 : null,
    final: complete ? Math.round(earned) : null,
    creditPoints: subject.creditPoints ?? DEFAULT_CREDIT_POINTS,
  };
}

/**
 * Average % needed on the remaining weighted work to finish on `target`.
 * null = no remaining work to change it; >100 = out of reach; <=0 = already secured.
 */
export function neededForTarget(result: SubjectResult, target: number): number | null {
  if (result.remainingWeight <= 0) return null;
  return ((target - result.earned) / result.remainingWeight) * 100;
}

/**
 * WAM over subjects with a final mark (or, when `projected`, with an average so far).
 * Returns null when no subject qualifies.
 */
export function wam(state: RealmState, projected = false): { value: number; credit: number; subjects: number } | null {
  let sum = 0;
  let credit = 0;
  let subjects = 0;
  for (const subject of state.curriculum?.subjects ?? []) {
    const r = subjectResult(state, subject);
    const mark = r.final ?? (projected ? r.average : null);
    if (mark === null) continue;
    sum += mark * r.creditPoints;
    credit += r.creditPoints;
    subjects++;
  }
  return credit > 0 ? { value: sum / credit, credit, subjects } : null;
}

export function setCreditPoints(subjectId: string, points: number): void {
  const value = Math.max(0, Math.min(120, Math.round(points)));
  realmStore.set((s) =>
    s.curriculum ? { ...s, curriculum: { ...s.curriculum, subjects: s.curriculum.subjects.map((sub) => (sub.id === subjectId ? { ...sub, creditPoints: value } : sub)) } } : s,
  );
}

export function setWeight(assessmentId: string, weight: number | null): void {
  const value = weight === null || !Number.isFinite(weight) ? null : Math.max(0, Math.min(100, Math.round(weight)));
  realmStore.set((s) =>
    s.curriculum
      ? {
          ...s,
          curriculum: {
            ...s.curriculum,
            subjects: s.curriculum.subjects.map((sub) => ({ ...sub, assessments: sub.assessments.map((a) => (a.id === assessmentId ? { ...a, weightPercent: value } : a)) })),
          },
        }
      : s,
  );
  if (value !== null) chat(`Weighting recorded: ${value}% of the grade.`);
}
