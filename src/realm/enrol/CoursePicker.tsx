/**
 * Course / degree picker: a dropdown of every course (La Trobe's full 2026
 * list from the Handbook, filtered to your campus and level), plus a text
 * box for anything not listed. Other universities get a list of common
 * degree names.
 */

import { useMemo, useState } from "react";
import { LA_TROBE_COURSES_2026, type CourseEntry } from "../curriculum/banks/latrobeCourses";

const COMMON_DEGREES: CourseEntry[] = [
  "Bachelor of Arts",
  "Bachelor of Biomedical Science",
  "Bachelor of Business",
  "Bachelor of Commerce",
  "Bachelor of Computer Science",
  "Bachelor of Design",
  "Bachelor of Education",
  "Bachelor of Engineering (Honours)",
  "Bachelor of Health Sciences",
  "Bachelor of Information Technology",
  "Bachelor of Laws",
  "Bachelor of Media and Communication",
  "Bachelor of Nursing",
  "Bachelor of Psychological Science",
  "Bachelor of Science",
  "Master of Business Administration",
  "Master of Data Science",
  "Master of Information Technology",
  "Doctor of Philosophy",
].map((name) => ({ name, level: name.startsWith("Bachelor") ? "undergraduate" : "postgraduate", campuses: [] }));

type Level = "all" | "undergraduate" | "postgraduate";

/** The Handbook's own names for campuses the game spells differently. */
const CAMPUS_ALIASES: Record<string, string> = { "melbourne city": "city campus" };

/** "Melbourne (Bundoora)" and "Bundoora" match; "Online" matches "Online"; "Melbourne City" matches "City Campus". */
function atCampus(entry: CourseEntry, campus: string): boolean {
  const c = CAMPUS_ALIASES[campus.toLowerCase()] ?? campus.toLowerCase();
  return entry.campuses.some((x) => {
    const y = x.toLowerCase();
    return y === c || y.includes(c) || c.includes(y);
  });
}

export function CoursePicker({ laTrobe, campus, value, onChange }: { laTrobe: boolean; campus: string; value: string; onChange: (v: string) => void }) {
  const [level, setLevel] = useState<Level>("all");
  const [campusOnly, setCampusOnly] = useState(true);
  const source = laTrobe ? LA_TROBE_COURSES_2026 : COMMON_DEGREES;
  const filterByCampus = laTrobe && Boolean(campus) && campusOnly;
  const list = useMemo(
    () => source.filter((c) => (level === "all" || c.level === level) && (!filterByCampus || atCampus(c, campus))),
    [source, level, filterByCampus, campus],
  );
  const groups: Array<[string, CourseEntry[]]> = [
    ["Undergraduate", list.filter((c) => c.level === "undergraduate")],
    ["Postgraduate", list.filter((c) => c.level === "postgraduate")],
    ["Other programs", list.filter((c) => c.level === "other")],
  ];
  const listed = source.some((c) => c.name === value);

  return (
    <div className="field course-picker">
      <span>Course / degree</span>
      <div className="course-filters">
        {(["all", "undergraduate", "postgraduate"] as const).map((l) => (
          <button key={l} type="button" className={`chip ${level === l ? "on" : ""}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
            {l === "all" ? "All levels" : l === "undergraduate" ? "Undergraduate" : "Postgraduate"}
          </button>
        ))}
        {laTrobe && campus ? (
          <label className="check">
            <input type="checkbox" checked={campusOnly} onChange={(e) => setCampusOnly(e.target.checked)} /> Only at {campus}
          </label>
        ) : null}
      </div>
      <select value={listed ? value : ""} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Choose your course">
        <option value="">
          {laTrobe ? `Choose from ${list.length} La Trobe course${list.length === 1 ? "" : "s"}…` : "Choose a common degree…"}
        </option>
        {groups.map(([label, entries]) =>
          entries.length ? (
            <optgroup key={label} label={label}>
              {entries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or type it, e.g. Bachelor of Information Technology" aria-label="Course name" />
      {laTrobe ? <small className="muted">From the La Trobe Handbook 2026. Not listed? Type it in.</small> : null}
    </div>
  );
}
