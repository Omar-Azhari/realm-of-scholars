/**
 * Weekly-schedule / module extraction rules (Phase 18A, Part 5).
 *
 * Recognises "Week N: Topic", "Module N - Topic", and similar heading forms
 * line-by-line, plus nearby "required/recommended reading" lines. A module
 * mention with no recognisable topic text is skipped rather than recorded
 * with an empty title.
 */

import type { ConfidenceLevel } from "../types";

const WEEK_MODULE_HEADING = /^\s*(?:week|module|topic)\s*(\d{1,2})\s*[:\-–.]?\s*(.+)$/i;
const READING_LINE = /^\s*(required|recommended)\s+reading[s]?\s*[:\-–]\s*(.+)$/i;

export interface ModuleMention {
  weekNumber: number;
  title: string;
  index: number;
  confidence: ConfidenceLevel;
}

export interface ReadingMention {
  text: string;
  /** Phase 19 (additive) — from the "required"/"recommended" label itself, never guessed. */
  kind: "required" | "recommended";
  index: number;
  /** Which nearest preceding module mention (by weekNumber) this reading likely belongs to, if any. */
  nearestWeek: number | null;
}

/** Scans line-by-line for "Week N: …" / "Module N — …" headings. */
export function extractModuleMentions(text: string): ModuleMention[] {
  const mentions: ModuleMention[] = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const match = WEEK_MODULE_HEADING.exec(line);
    if (match) {
      const title = match[2].trim();
      if (title.length >= 3) {
        mentions.push({
          weekNumber: Number(match[1]),
          title,
          index: offset + (match.index ?? 0),
          confidence: title.length >= 8 ? "high" : "medium",
        });
      }
    }
    offset += line.length + 1; // +1 for the split newline
  }
  return mentions;
}

/** Scans for "Required reading: …" / "Recommended reading: …" lines, associated to the nearest earlier module. */
export function extractReadingMentions(text: string, modules: ModuleMention[]): ReadingMention[] {
  const readings: ReadingMention[] = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const match = READING_LINE.exec(line);
    if (match) {
      const index = offset + (match.index ?? 0);
      const preceding = [...modules].filter((m) => m.index <= index).sort((a, b) => b.index - a.index)[0];
      const kind: ReadingMention["kind"] = match[1].toLowerCase() === "required" ? "required" : "recommended";
      readings.push({ text: match[2].trim(), kind, index, nearestWeek: preceding ? preceding.weekNumber : null });
    }
    offset += line.length + 1;
  }
  return readings;
}
