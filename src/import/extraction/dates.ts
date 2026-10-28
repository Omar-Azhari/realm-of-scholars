/**
 * Deterministic Australian date/time extraction (Phase 18A, Part 5).
 *
 * Pure pattern matching over plain text — no AI, no network, fully testable.
 * Hard rules enforced here (see docs/PHASE_18A_IMPORT_ARCHITECTURE.md §4):
 *
 * - A date with no year is NEVER given a guessed year. Callers may pass an
 *   explicit `contextYear` (only ever the user's own Study Details entry,
 *   never inferred here) to resolve those cases; without it the mention
 *   stays year-less (`isoDate: null`, `dateKind: "missing"`), rawText kept.
 * - A date-only mention never gets a time; a time is only attached when it
 *   appears in the same immediate span as a date.
 * - "Week N" is recognised as its own kind (`week_only`) and is NEVER
 *   resolved to a calendar date here — that requires a confirmed semester
 *   start date, which this module never has access to.
 * - Every mention keeps its raw matched text and character offset so a
 *   caller can build a SourceReference excerpt.
 * - Matches sitting inside an "e.g./example/such as/for instance" phrase are
 *   flagged `isExample` so callers can exclude them from real deadlines.
 */

import type { DateKind } from "../../types/domain";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_PATTERN = MONTHS.join("|");
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_PATTERN = WEEKDAYS.join("|");
/** Recognised Australian timezone abbreviations (source wording is preserved verbatim regardless). */
const TZ_PATTERN = "AEST|AEDT|ACST|ACDT|AWST";

export interface DateMention {
  rawText: string;
  index: number;
  isoDate: string | null;
  isoTime: string | null;
  sourceTimezone: string | null;
  weekNumber: number | null;
  dateKind: DateKind;
  isExample: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.toLowerCase());
}

/** 12h "11:59 pm" / "9am" / "9:00am" → 24h "HH:mm", or null if unparsable. */
function normalizeTime(hourStr: string, minuteStr: string | undefined, meridiem: string): string | null {
  let hour = Number(hourStr);
  const minute = minuteStr ? Number(minuteStr) : 0;
  if (Number.isNaN(hour) || hour < 1 || hour > 12 || minute > 59) return null;
  const isPm = /pm/i.test(meridiem);
  if (hour === 12) hour = isPm ? 12 : 0;
  else if (isPm) hour += 12;
  return `${pad2(hour)}:${pad2(minute)}`;
}

const EXAMPLE_MARKERS = /\b(e\.g\.|eg\b|example|for instance|such as)\b/i;

function looksLikeExample(text: string, index: number): boolean {
  const windowStart = Math.max(0, index - 40);
  return EXAMPLE_MARKERS.test(text.slice(windowStart, index));
}

/**
 * Resolves a (day, month-name, year|undefined) triple. `contextYear` is only
 * ever supplied by the caller from an explicit user-entered value (never
 * guessed) and is used SOLELY when the source text itself gave no year.
 */
function resolveDayMonthYear(
  day: number,
  monthName: string,
  yearText: string | undefined,
  contextYear: number | null
): { isoDate: string | null; dateKind: DateKind } {
  const month = monthIndex(monthName);
  if (month < 0 || day < 1 || day > 31) return { isoDate: null, dateKind: "missing" };
  const year = yearText ? Number(yearText) : contextYear;
  if (!year) return { isoDate: null, dateKind: "missing" };
  return { isoDate: `${year}-${pad2(month + 1)}-${pad2(day)}`, dateKind: "exact" };
}

/**
 * Finds every recognisable date/time mention in `text`. Overlapping pattern
 * classes are tried from most-specific (time+weekday+date+tz) to least
 * (week-only), and a span already consumed by an earlier, more specific
 * match is not re-matched by a looser pattern.
 */
export function extractDateMentions(text: string, contextYear: number | null = null): DateMention[] {
  const mentions: DateMention[] = [];
  const consumed: Array<[number, number]> = [];
  const isConsumed = (start: number, end: number) =>
    consumed.some(([s, e]) => start < e && end > s);
  const consume = (start: number, end: number) => consumed.push([start, end]);

  // --- 1. Full form: "11:59 pm AEST, Sunday 9 August 2026" (time + tz + weekday + date) ---
  const fullPattern = new RegExp(
    `\\b(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)\\b(?:\\s*(${TZ_PATTERN}))?\\s*,?\\s*(?:(${WEEKDAY_PATTERN})\\s+)?(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?`,
    "gi"
  );
  for (const m of text.matchAll(fullPattern)) {
    const [full, hour, minute, meridiem, tz, , day, month, year] = m;
    const start = m.index ?? 0;
    const end = start + full.length;
    if (isConsumed(start, end)) continue;
    const { isoDate, dateKind } = resolveDayMonthYear(Number(day), month, year, contextYear);
    consume(start, end);
    mentions.push({
      rawText: full.trim(),
      index: start,
      isoDate,
      isoTime: normalizeTime(hour, minute, meridiem),
      sourceTimezone: tz ? tz.toUpperCase() : null,
      weekNumber: null,
      dateKind: isoDate ? dateKind : "missing",
      isExample: looksLikeExample(text, start),
    });
  }

  // --- 2. "Sunday 9 August 2026" / "Sunday 9 August" (weekday + date, no time) ---
  const weekdayDatePattern = new RegExp(
    `\\b(${WEEKDAY_PATTERN})\\s+(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?`,
    "gi"
  );
  for (const m of text.matchAll(weekdayDatePattern)) {
    const [full, , day, month, year] = m;
    const start = m.index ?? 0;
    const end = start + full.length;
    if (isConsumed(start, end)) continue;
    const { isoDate, dateKind } = resolveDayMonthYear(Number(day), month, year, contextYear);
    consume(start, end);
    mentions.push({
      rawText: full.trim(),
      index: start,
      isoDate,
      isoTime: null,
      sourceTimezone: null,
      weekNumber: null,
      dateKind: isoDate ? dateKind : "missing",
      isExample: looksLikeExample(text, start),
    });
  }

  // --- 3. "9 August 2026" / "9 August" (date only, no weekday) ---
  const datePattern = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?\\b`, "gi");
  for (const m of text.matchAll(datePattern)) {
    const [full, day, month, year] = m;
    const start = m.index ?? 0;
    const end = start + full.length;
    if (isConsumed(start, end)) continue;
    const { isoDate, dateKind } = resolveDayMonthYear(Number(day), month, year, contextYear);
    consume(start, end);
    mentions.push({
      rawText: full.trim(),
      index: start,
      isoDate,
      isoTime: null,
      sourceTimezone: null,
      weekNumber: null,
      dateKind: isoDate ? dateKind : "missing",
      isExample: looksLikeExample(text, start),
    });
  }

  // --- 4. Numeric "09/08/2026" or "9/8/26" (DD/MM/YYYY or DD/MM/YY, Australian order) ---
  const numericPattern = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  for (const m of text.matchAll(numericPattern)) {
    const [full, dayStr, monthStr, yearStr] = m;
    const start = m.index ?? 0;
    const end = start + full.length;
    if (isConsumed(start, end)) continue;
    const day = Number(dayStr);
    const month = Number(monthStr);
    let year = Number(yearStr);
    if (yearStr.length === 2) year += year < 70 ? 2000 : 1900;
    consume(start, end);
    const valid = day >= 1 && day <= 31 && month >= 1 && month <= 12;
    mentions.push({
      rawText: full,
      index: start,
      isoDate: valid ? `${year}-${pad2(month)}-${pad2(day)}` : null,
      isoTime: null,
      sourceTimezone: null,
      weekNumber: null,
      dateKind: valid ? "exact" : "missing",
      isExample: looksLikeExample(text, start),
    });
  }

  // --- 5. Week-only mentions: "Week 6, Friday" / "end of Week 8" / "Week 4" ---
  const weekPattern = new RegExp(
    `\\b(?:end of\\s+)?Week\\s+(\\d{1,2})(?:\\s*,?\\s*(${WEEKDAY_PATTERN}))?`,
    "gi"
  );
  for (const m of text.matchAll(weekPattern)) {
    const [full, weekStr] = m;
    const start = m.index ?? 0;
    const end = start + full.length;
    if (isConsumed(start, end)) continue;
    consume(start, end);
    mentions.push({
      rawText: full.trim(),
      index: start,
      isoDate: null,
      isoTime: null,
      sourceTimezone: null,
      weekNumber: Number(weekStr),
      dateKind: "week_only",
      isExample: looksLikeExample(text, start),
    });
  }

  return mentions.sort((a, b) => a.index - b.index);
}

/** The single closest date mention to a given character offset, within `maxDistance` chars. */
export function nearestMention(
  mentions: DateMention[],
  index: number,
  maxDistance = 400
): DateMention | null {
  let best: DateMention | null = null;
  let bestDistance = Infinity;
  for (const mention of mentions) {
    const distance = Math.abs(mention.index - index);
    if (distance < bestDistance && distance <= maxDistance) {
      best = mention;
      bestDistance = distance;
    }
  }
  return best;
}
