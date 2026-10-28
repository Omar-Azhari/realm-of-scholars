/**
 * Moodle (or any LMS) calendar import for the realm. Reads an .ics export,
 * keeps the events that are deadlines ("Assignment 1 is due", "Quiz 2
 * closes", exams), works out which subject each belongs to from its course
 * code, and proposes which quest it is. Nothing changes until the player
 * confirms each match.
 */

import type { RealmAssessment, RealmAssessmentKind, RealmSubject } from "../types";

export interface CalendarEvent {
  uid: string;
  summary: string;
  /** Local date YYYY-MM-DD. */
  date: string;
  /** Course shortnames / categories the LMS attached. */
  categories: string[];
  description: string;
}

function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  return lines;
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function localDate(value: string, params: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined || /VALUE=DATE(?!-)/i.test(params)) return `${y}-${mo}-${d}`;
  if (!z) return `${y}-${mo}-${d}`;
  // UTC time: convert to the student's local date (a 23:59 deadline in Melbourne is the previous day in UTC).
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Throws when the text isn't a calendar at all. */
export function parseCalendar(text: string): CalendarEvent[] {
  const lines = unfold(text);
  if (!lines.some((l) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) throw new Error("That file isn't an .ics calendar.");
  const events: CalendarEvent[] = [];
  let current: Record<string, { value: string; params: string }> | null = null;
  let categories: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = {};
      categories = [];
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current?.SUMMARY && current.DTSTART) {
        const date = localDate(current.DTSTART.value, current.DTSTART.params);
        if (date) {
          events.push({
            uid: current.UID?.value ?? `${current.SUMMARY.value}|${date}`,
            summary: unescapeIcs(current.SUMMARY.value),
            date,
            categories,
            description: unescapeIcs(current.DESCRIPTION?.value ?? "").slice(0, 400),
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const m = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toUpperCase();
    if (key === "CATEGORIES") categories.push(...m[3].split(",").map((c) => unescapeIcs(c)).filter(Boolean));
    else current[key] = { value: m[3], params: m[2] };
  }
  return events;
}

/** Deadline-looking events only — lectures, "opens" notices and holidays are skipped. */
export function isDeadline(event: CalendarEvent): boolean {
  const s = event.summary.toLowerCase();
  if (/\bopens?\b|\blecture\b|\btutorial\b|\bworkshop\b|\bholiday\b|\bbreak\b/.test(s) && !/\bdue\b/.test(s)) return false;
  return /\b(due|closes?|deadline|submission|submit|exam|examination|test|quiz|assignment|assessment|presentation|report|essay)\b/.test(s);
}

const STOP = new Set(["the", "a", "an", "of", "and", "is", "due", "closes", "close", "to", "for", "in", "on", "task", "at"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w === "assignment" || w === "assessment" ? "assess" : w));
}

/** 0-1 similarity of an event title and a quest title; matching numbers count double. */
export function titleSimilarity(a: string, b: string): number {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  let sharedWords = 0;
  wa.forEach((w) => {
    if (!wb.has(w)) return;
    if (/^\d+$/.test(w)) shared += 2;
    else {
      shared += 1;
      sharedWords += 1;
    }
  });
  const numbersA = [...wa].filter((w) => /^\d+$/.test(w));
  const numbersB = [...wb].filter((w) => /^\d+$/.test(w));
  const numberClash = numbersA.length > 0 && numbersB.length > 0 && !numbersA.some((n) => wb.has(n));
  const score = Math.min(1, shared / Math.max(wa.size, wb.size));
  if (numberClash) return score * 0.3;
  // "Quiz 2" and "Assessment 2" share only a number: not the same task.
  return sharedWords === 0 ? score * 0.4 : score;
}

export function subjectForEvent(event: CalendarEvent, subjects: RealmSubject[]): RealmSubject | null {
  const haystack = `${event.categories.join(" ")} ${event.summary} ${event.description}`.toUpperCase();
  for (const subject of subjects) {
    const code = subject.code.trim().toUpperCase();
    if (code.length >= 4 && haystack.includes(code)) return subject;
  }
  return null;
}

export interface CalendarMatch {
  event: CalendarEvent;
  subjectId: string | null;
  /** Existing quest it updates, or null to add a new quest. */
  assessmentId: string | null;
  score: number;
}

export const MATCH_THRESHOLD = 0.34;

export function matchCalendar(events: CalendarEvent[], subjects: RealmSubject[]): CalendarMatch[] {
  const used = new Set<string>();
  return events
    .filter(isDeadline)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => {
      const subject = subjectForEvent(event, subjects);
      if (!subject) return { event, subjectId: null, assessmentId: null, score: 0 };
      let best: { id: string; score: number } | null = null;
      for (const assessment of subject.assessments) {
        if (used.has(assessment.id)) continue;
        const score = titleSimilarity(event.summary, assessment.title);
        if (!best || score > best.score) best = { id: assessment.id, score };
      }
      if (best && best.score >= MATCH_THRESHOLD) {
        used.add(best.id);
        return { event, subjectId: subject.id, assessmentId: best.id, score: best.score };
      }
      return { event, subjectId: subject.id, assessmentId: null, score: best?.score ?? 0 };
    });
}

export function guessKind(title: string): RealmAssessmentKind {
  const s = title.toLowerCase();
  if (/exam/.test(s)) return "exam";
  if (/quiz|test/.test(s)) return "quiz";
  if (/essay/.test(s)) return "essay";
  if (/report/.test(s)) return "report";
  if (/presentation|pitch/.test(s)) return "presentation";
  if (/lab|practical/.test(s)) return "lab";
  if (/project|assignment|assessment/.test(s)) return "project";
  return "other";
}

const DEFAULT_STEPS: Record<RealmAssessmentKind, string[]> = {
  exam: ["Gather every week's notes", "Do a full practice paper under time", "Review your mistakes", "Sit the exam"],
  quiz: ["Review the weeks the quiz covers", "Do practice questions", "Complete the quiz"],
  essay: ["Read the task and marking guide", "Research and outline", "Write the draft", "Edit, reference and submit"],
  report: ["Read the task and marking guide", "Collect your data or sources", "Write the draft", "Edit and submit"],
  project: ["Read the brief and marking guide", "Plan the work", "Build the main deliverable", "Test and polish", "Submit"],
  presentation: ["Plan the talk", "Make the slides", "Rehearse twice", "Present"],
  lab: ["Read the lab sheet", "Do the lab", "Write it up and submit"],
  participation: ["Attend and take part"],
  other: ["Read the task", "Do the work", "Submit"],
};

/** Strips Moodle's "is due"/"closes" so the quest reads like the task name. */
export function cleanTitle(summary: string): string {
  return summary.replace(/\s+(is due|closes|is closing|due)\.?$/i, "").replace(/^(due:?\s*)/i, "").trim() || summary;
}

export function newAssessmentFromEvent(event: CalendarEvent, idSeed: string): RealmAssessment {
  const title = cleanTitle(event.summary);
  const kind = guessKind(title);
  return {
    id: `cal-${idSeed}`,
    title,
    kind,
    weightPercent: null,
    dueWeek: null,
    dueDate: event.date,
    description: "Imported from your Moodle calendar. Check the subject guide for the weighting.",
    steps: DEFAULT_STEPS[kind],
  };
}

/** Applies confirmed matches to the subjects (pure — returns new subjects). */
export function applyCalendarMatches(subjects: RealmSubject[], matches: CalendarMatch[]): { subjects: RealmSubject[]; updated: number; added: number } {
  let updated = 0;
  let added = 0;
  const next = subjects.map((subject) => {
    const mine = matches.filter((m) => m.subjectId === subject.id);
    if (mine.length === 0) return subject;
    let assessments = subject.assessments.map((a) => {
      const match = mine.find((m) => m.assessmentId === a.id);
      if (!match || a.dueDate === match.event.date) return a;
      updated++;
      return { ...a, dueDate: match.event.date };
    });
    for (const match of mine.filter((m) => m.assessmentId === null)) {
      const seed = `${subject.id}-${match.event.uid}`.replace(/[^a-zA-Z0-9-]/g, "").slice(-40);
      if (assessments.some((a) => a.id === `cal-${seed}`)) continue;
      assessments = [...assessments, newAssessmentFromEvent(match.event, seed)];
      added++;
    }
    return { ...subject, assessments };
  });
  return { subjects: next, updated, added };
}
