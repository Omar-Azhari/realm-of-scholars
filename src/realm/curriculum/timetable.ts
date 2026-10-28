/**
 * Class timetable from a calendar file (.ics) — e.g. La Trobe's timetable
 * export. Each weekly class becomes one entry (weekday, start, end, room),
 * matched to a subject by its code. The game shows today's classes, an owl
 * brings them in the morning, and studying that subject soon after a class
 * pays a "follow-up" Focus bonus once per class per day.
 */

import type { RealmSubject, TimetableEntry } from "../types";

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

/** DTSTART;TZID=…:20260714T100000 or …Z → a Date (local for TZID/floating, UTC for Z). */
function parseStamp(value: string): Date | null {
  const m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export const CLASS_WORDS = /\b(lecture|lec|tutorial|tut|workshop|lab|laboratory|practical|prac|seminar|class|studio|pass)\b/i;

/** Weekly classes from an .ics file. Deadlines and all-day events are ignored. */
export function parseTimetable(ics: string, subjects: RealmSubject[]): TimetableEntry[] {
  const out = new Map<string, TimetableEntry>();
  let cur: Record<string, string> | null = null;
  for (const line of unfold(ics)) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur) {
        const start = parseStamp(cur.DTSTART ?? "");
        const end = parseStamp(cur.DTEND ?? "");
        const summary = (cur.SUMMARY ?? "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
        const timed = /T\d{4}/.test(cur.DTSTART ?? "");
        if (start && end && timed && summary) {
          const subject = subjects.find((s) => s.code && new RegExp(`\\b${s.code}\\b`, "i").test(summary)) ?? null;
          if (subject || CLASS_WORDS.test(summary)) {
            const kind = summary.match(CLASS_WORDS)?.[0] ?? "Class";
            const entry: TimetableEntry = {
              key: `${subject?.id ?? summary.toLowerCase()}|${start.getDay()}|${hhmm(start)}`,
              subjectId: subject?.id ?? null,
              title: subject ? `${subject.code} ${kind.charAt(0).toUpperCase()}${kind.slice(1).toLowerCase()}` : summary.slice(0, 60),
              weekday: start.getDay(),
              start: hhmm(start),
              end: hhmm(end),
              location: (cur.LOCATION ?? "").replace(/\\,/g, ",").slice(0, 80),
            };
            out.set(entry.key, entry);
          }
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i > 0) cur[line.slice(0, i).split(";")[0].toUpperCase()] = line.slice(i + 1);
    }
  }
  return [...out.values()].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)).slice(0, 40);
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Classes on this day of the week, in time order. */
export function classesOn(timetable: TimetableEntry[], date: Date): TimetableEntry[] {
  return timetable.filter((c) => c.weekday === date.getDay()).sort((a, b) => a.start.localeCompare(b.start));
}

export const FOLLOW_UP_HOURS = 3;

/** A class of this subject that's on now, or ended within the follow-up window. */
export function recentClass(timetable: TimetableEntry[], subjectId: string, now: Date): TimetableEntry | null {
  const t = now.getHours() * 60 + now.getMinutes();
  return (
    classesOn(timetable, now).find((c) => c.subjectId === subjectId && t >= minutes(c.start) && t <= minutes(c.end) + FOLLOW_UP_HOURS * 60) ?? null
  );
}
