/**
 * Academic Intelligence enrichment rules (Phase 19, Part 1/2). Extends the
 * existing rules-based extraction engine (subjectRules.ts/moduleRules.ts/
 * assessmentRules.ts) with the additive Phase 19 fields: structured
 * readings, lecture/tutorial/lab schedule entries, learning outcomes, and
 * exam info. Same discipline as every existing rule file: conservative
 * regex/keyword matching only, never invented, every match keeps its
 * character offset for source-reference excerpting.
 */

import type { ConfidenceLevel } from "../types";

// ---------------------------------------------------------------------------
// Coordinator email
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Only looks near a coordinator label — an email mentioned elsewhere (e.g. a support desk) is never misattributed. */
export function extractCoordinatorEmail(text: string, coordinatorIndex: number | null): string | null {
  if (coordinatorIndex === null) return null;
  const window = text.slice(coordinatorIndex, coordinatorIndex + 200);
  const match = EMAIL_PATTERN.exec(window);
  return match ? match[0] : null;
}

// ---------------------------------------------------------------------------
// Lecture / tutorial / lab schedule
// ---------------------------------------------------------------------------

const SCHEDULE_LABEL_PATTERN =
  /^\s*(lecture|tutorial|lab|laboratory|practical)\s*[:\-–]\s*(.+)$/i;
const DAY_PATTERN = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;
const TIME_RANGE_PATTERN = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i;
const LOCATION_LABEL_PATTERN = /\b(?:room|location|venue)\s*[:\-–]\s*([^,\n]+)/i;

export interface ScheduleMention {
  kind: "lecture" | "tutorial" | "lab";
  title: string;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  index: number;
}

function normaliseTime(raw: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(raw.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

/** Scans line-by-line for explicit "Lecture:"/"Tutorial:"/"Lab:" (or "Laboratory:"/"Practical:") lines. */
export function extractScheduleMentions(text: string): ScheduleMention[] {
  const mentions: ScheduleMention[] = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const match = SCHEDULE_LABEL_PATTERN.exec(line);
    if (match) {
      const rawKind = match[1].toLowerCase();
      const kind: ScheduleMention["kind"] =
        rawKind === "lecture" ? "lecture" : rawKind === "tutorial" ? "tutorial" : "lab";
      const rest = match[2].trim();
      const dayMatch = DAY_PATTERN.exec(rest);
      const timeMatch = TIME_RANGE_PATTERN.exec(rest);
      const locationMatch = LOCATION_LABEL_PATTERN.exec(rest);
      if (rest.length >= 2) {
        mentions.push({
          kind,
          title: rest,
          dayOfWeek: dayMatch ? dayMatch[1] : null,
          startTime: timeMatch ? normaliseTime(timeMatch[1]) : null,
          endTime: timeMatch ? normaliseTime(timeMatch[2]) : null,
          location: locationMatch ? locationMatch[1].trim() : null,
          index: offset + (match.index ?? 0),
        });
      }
    }
    offset += line.length + 1;
  }
  return mentions;
}

// ---------------------------------------------------------------------------
// Learning outcomes
// ---------------------------------------------------------------------------

// Matches a numbered outcome code at the start of a line ("LO1:", "CLO 3 -", "Outcome 2:") followed by its text.
const OUTCOME_CODE_LINE = /^\s*(?:(CLO|LO|ULO)\s*\.?\s*(\d{1,2})|outcome\s*(\d{1,2}))\s*[:\-–.]\s*(.+)$/i;

export interface OutcomeMention {
  code: string | null;
  text: string;
  index: number;
  confidence: ConfidenceLevel;
}

/** Scans for explicitly numbered/labelled learning-outcome lines — never split a paragraph into invented outcomes. */
export function extractOutcomeMentions(text: string): OutcomeMention[] {
  const mentions: OutcomeMention[] = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const match = OUTCOME_CODE_LINE.exec(line);
    if (match) {
      const prefix = match[1] ?? "LO";
      const number = match[2] ?? match[3];
      const outcomeText = match[4].trim();
      if (outcomeText.length >= 8) {
        mentions.push({
          code: `${prefix.toUpperCase()}${number}`,
          text: outcomeText,
          index: offset + (match.index ?? 0),
          confidence: "high",
        });
      }
    }
    offset += line.length + 1;
  }
  return mentions;
}

// ---------------------------------------------------------------------------
// Exam info
// ---------------------------------------------------------------------------

const EXAM_INFO_LABEL_PATTERN = /^\s*(?:exam(?:ination)?)\s*(?:format|details|information)?\s*[:\-–]\s*(.+)$/im;

export interface ExamInfoMention {
  description: string;
  index: number;
}

/** Only recognises an explicit "Exam format/details:" label — never fabricated from the presence of the word "exam" alone. */
export function extractExamInfoMention(text: string): ExamInfoMention | null {
  const match = EXAM_INFO_LABEL_PATTERN.exec(text);
  if (!match) return null;
  const description = match[1].trim();
  if (description.length < 8) return null;
  return { description, index: match.index };
}
