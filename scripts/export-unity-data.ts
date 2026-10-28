/**
 * Exports the game's hand-written content (quiz banks, lectures, workshops, houses, La Trobe dates)
 * and the imported La Trobe Handbook 2026 (handbook-subjects.json, handbook-courses.json, handbook-majors.json)
 * as JSON for the Unity version. Run: npx tsx scripts/export-unity-data.ts <output folder>
 * The Unity project loads these from Assets/StreamingAssets/GameData/.
 */

import { WORKED_EXAMPLES } from "../src/realm/curriculum/banks/workedExamples";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanWeights } from "./assessmentWeights";
import { builtInBank } from "../src/realm/curriculum/banks/latrobeBanks";
import { LECTURE_BANKS } from "../src/realm/curriculum/banks/lectures";
import { BUG_HUNT, USABILITY, ACS_VALUES, ETHICS } from "../src/realm/curriculum/banks/workshopBanks";
import { HOUSES } from "../src/realm/customise/houses";
import { LA_TROBE_DATES } from "../src/realm/curriculum/latrobeCalendar";
import { loadSavedLaTrobeSemester } from "../src/realm/curriculum/latrobe";
import { LA_TROBE_COURSES_2026 } from "../src/realm/curriculum/banks/latrobeCourses";

const out = process.argv[2];
if (!out) {
  console.error("Usage: npx tsx scripts/export-unity-data.ts <output folder>");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

/** The Handbook 2026 assessments for a subject code (official weights), or null if not imported. */
function handbookAssessments(code: string): { name: string; type: string; description: string; weightPercent: number }[] | null {
  const file = join(import.meta.dirname, "..", "src", "data", "latrobe-handbook", "subjects.json");
  if (!code || !existsSync(file)) return null;
  const data = JSON.parse(readFileSync(file, "utf8")) as { subjects: { code: string; assessments: { name: string; type: string; description: string; weightPercent: number }[] }[] };
  return data.subjects.find((x) => x.code.toUpperCase() === code.toUpperCase())?.assessments ?? null;
}

const SUBJECTS = [
  { id: "cse2ui", code: "CSE2UI", name: "User Interface Design" },
  { id: "cse3cwa", code: "CSE3CWA", name: "Cloud-Based Web Application Development" },
  { id: "pm", code: "CSE3PM", name: "Project Management" },
  { id: "ppe", code: "CSE3PPE", name: "Professional Practices and Entrepreneurship in Information Technology" },
];

/** Large data files (the Handbook) are written compact to keep StreamingAssets small. */
function write(name: string, data: unknown, compact = false): void {
  const text = compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  writeFileSync(join(out, name), text, "utf-8");
  console.log(`${name}  ${(text.length / 1024).toFixed(1)} KB`);
}

// Unity's JsonUtility can't read top-level arrays or dictionaries, so every file is an object
// and week maps become arrays with a `week` field.
// The built-in La Trobe 2026 Semester 2 data: weekly modules, assessments, outcomes.
const semester = await loadSavedLaTrobeSemester();
const official = (s: { code: string; name: string }) =>
  semester?.subjects.find((r) => (s.code && r.code.toUpperCase().startsWith(s.code)) || r.name.toLowerCase() === s.name.toLowerCase()) ?? null;

write("subjects.json", {
  semester: semester ? { label: semester.label, year: semester.year, teachingPeriod: semester.teachingPeriod } : null,
  subjects: SUBJECTS.map((s) => {
    const bank = builtInBank(s.code, s.name, s.id);
    const lectures = LECTURE_BANKS.find((l) => l.match(s.code, s.name));
    const real = official(s);
    return {
      ...s,
      code: real?.code || s.code,
      summary: real?.summary ?? "",
      theme: real?.theme ?? "arcane",
      weeks: real?.weeks ?? [],
      // Unknown weights and dates stay unknown: -1 and "" (JsonUtility has no nulls).
      assessments: cleanWeights(
        s.id,
        (real?.assessments ?? []).map((a) => ({ ...a, weightPercent: a.weightPercent ?? -1, dueWeek: a.dueWeek ?? -1, dueDate: a.dueDate ?? "" })),
        handbookAssessments(real?.code || s.code),
      ),
      learningOutcomes: real?.learningOutcomes ?? [],
      keyTerms: (bank?.keyTerms ?? []).map((t) => ({ ...t, week: t.week ?? -1 })),
      questions: bank?.questions ?? [],
      professor: lectures?.professor ?? null,
      // Matrix diagrams' cells are an array of arrays, which Unity's JsonUtility can't read, so they're also flattened (row by row).
      lectures: lectures
        ? Object.entries(lectures.weeks).map(([week, lecture]) => ({
            week: Number(week),
            ...lecture,
            segments: lecture.segments.map((seg) =>
              seg.visual && seg.visual.kind === "matrix" ? { ...seg, visual: { ...seg.visual, cellsFlat: seg.visual.cells.flat() } } : seg,
            ),
          }))
        : [],
    };
  }),
});
write("workshops.json", { bugHunt: BUG_HUNT, usability: USABILITY, acsValues: ACS_VALUES, ethics: ETHICS });
write("houses.json", { houses: HOUSES });
write("worked-examples.json", { examples: WORKED_EXAMPLES.map((e) => ({ ...e, steps: e.steps.map((st) => ({ ...st, tolerance: st.tolerance ?? 0 })) })) });
write("latrobe-dates.json", { periods: LA_TROBE_DATES });
write("latrobe-courses.json", { courses: LA_TROBE_COURSES_2026 });

// The La Trobe Handbook 2026 import (scripts/import-latrobe-handbook.ts): every subject, course and
// area of study, as the Handbook states them, with source URLs and fetch dates. Skipped if not imported yet.
// JsonUtility can't read nulls, so any that slip through become "" (the importer already uses "" and -1).
const noNulls = (value: unknown): unknown =>
  value === null || value === undefined
    ? ""
    : Array.isArray(value)
      ? value.map(noNulls)
      : typeof value === "object"
        ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, noNulls(v)]))
        : value;
const handbookDir = join(import.meta.dirname, "..", "src", "data", "latrobe-handbook");
for (const [file, out] of [
  ["subjects.json", "handbook-subjects.json"],
  ["courses.json", "handbook-courses.json"],
  ["majors.json", "handbook-majors.json"],
] as const) {
  const source = join(handbookDir, file);
  if (!existsSync(source)) {
    console.log(`${out}  skipped (run: npx tsx scripts/import-latrobe-handbook.ts)`);
    continue;
  }
  write(out, noNulls(JSON.parse(readFileSync(source, "utf-8"))), true);
}
