/**
 * La Trobe University comes first. Campuses, teaching periods, handbook
 * links, and a one-click import of the La Trobe subjects already stored in
 * UniGame (the classic campus save, or its built-in 2026 Semester 2 data).
 */

import { defaultQuestSteps, normalizeSubject, slug } from "./normalize";
import { enrichWithBank } from "./enrich";
import type { RealmAssessmentKind, RealmSubject } from "../types";
import type { AssessmentRecord, SemesterRecord, SubjectRecord } from "../../types/domain";

export const LA_TROBE = {
  name: "La Trobe University",
  country: "Australia",
  campuses: ["Melbourne (Bundoora)", "Melbourne City", "Bendigo", "Albury-Wodonga", "Mildura", "Shepparton", "Sydney", "Online"],
  teachingPeriods: ["Semester 1", "Semester 2", "Summer Semester", "Winter Semester"],
  /** e.g. CSE1OOF, CSE2UI, CSE3CWA — 3 letters, year level digit, 2-4 letters/digits. */
  codePattern: /^[A-Z]{3}[1-5][A-Z0-9]{2,4}$/,
  lms: "https://lms.latrobe.edu.au",
} as const;

export function isLaTrobeName(university: string): boolean {
  return /la\s*trobe/i.test(university);
}

export function laTrobeHandbookUrl(code: string, year: number): string | null {
  const clean = code.trim().toUpperCase();
  if (!LA_TROBE.codePattern.test(clean)) return null;
  return `https://handbook.latrobe.edu.au/subjects/${year}/${clean.toLowerCase()}`;
}

export function defaultLaTrobePeriod(date = new Date()): string {
  return date.getMonth() >= 6 ? "Semester 2" : "Semester 1";
}

const KIND_MAP: Record<string, RealmAssessmentKind> = {
  essay: "essay",
  report: "report",
  exam: "exam",
  project: "project",
  presentation: "presentation",
  quiz: "quiz",
  other: "other",
};

function convertAssessment(a: AssessmentRecord) {
  const kind = KIND_MAP[a.kind] ?? "other";
  const title = a.part ? `${a.title}: ${a.part}` : a.title;
  const week = /week\s*(\d{1,2})/i.exec(a.dueWindowRaw ?? "");
  return {
    title,
    kind,
    weightPercent: a.weight.status === "confirmed" ? a.weight.value : null,
    dueWeek: week ? Number(week[1]) : null,
    dueDate: a.dueDate.status === "confirmed" ? a.dueDate.value : null,
    description: [a.description, a.dueWindowRaw && a.dueDate.status !== "confirmed" ? `Due: ${a.dueWindowRaw}` : ""].filter(Boolean).join(" "),
    steps: defaultQuestSteps(kind, title),
  };
}

function convertSubject(subject: SubjectRecord, label: string): RealmSubject {
  const code = subject.code.status === "confirmed" && subject.code.value ? subject.code.value : "";
  const raw = {
    code,
    name: subject.name,
    summary: "",
    weeks: subject.modules.map((m) => ({ week: m.moduleNumber, title: m.title, topics: m.outcomes.slice(0, 4), summary: m.overview })),
    assessments: subject.assessments.map(convertAssessment),
    keyTerms: [],
    questions: [],
    learningOutcomes: Array.from(new Set(subject.modules.flatMap((m) => m.outcomes))).slice(0, 8),
    sourceNote: `From your saved La Trobe subject data (${label}). Weights and dates still marked unconfirmed in your records stay blank here. Check your Subject Learning Guide on LMS.`,
  };
  const realm = normalizeSubject(raw, { code, name: subject.name }, "document", "arcane");
  return enrichWithBank({ ...realm, id: slug(code || subject.name) });
}

export interface SavedLaTrobeSemester {
  label: string;
  year: number | null;
  teachingPeriod: string | null;
  subjects: RealmSubject[];
  source: "your classic save" | "built-in data";
}

/** Reads the La Trobe subjects UniGame already knows about. */
export async function loadSavedLaTrobeSemester(): Promise<SavedLaTrobeSemester | null> {
  let semester: SemesterRecord | null = null;
  let source: SavedLaTrobeSemester["source"] = "built-in data";
  try {
    const text = localStorage.getItem("unigame:saveData:v1");
    if (text) {
      const parsed = JSON.parse(text) as { semester?: SemesterRecord };
      if (parsed.semester && Array.isArray(parsed.semester.subjects) && parsed.semester.subjects.length > 0) {
        semester = parsed.semester;
        source = "your classic save";
      }
    }
  } catch {
    semester = null;
  }
  if (!semester) {
    const { semesterData } = await import("../../data/semesterData");
    semester = semesterData;
  }
  const subjects = semester.subjects.filter((s) => s && typeof s.name === "string" && Array.isArray(s.modules) && Array.isArray(s.assessments));
  if (subjects.length === 0) return null;
  const year = /\b(20\d{2})\b/.exec(semester.label ?? "");
  const period = /(semester\s*\d|summer|winter)/i.exec(semester.label ?? "");
  return {
    label: semester.label,
    year: year ? Number(year[1]) : null,
    teachingPeriod: period ? period[1].replace(/^\w/, (c) => c.toUpperCase()).replace(/semester\s*/i, "Semester ") : null,
    subjects: subjects.map((s) => convertSubject(s, semester!.label)),
    source,
  };
}
