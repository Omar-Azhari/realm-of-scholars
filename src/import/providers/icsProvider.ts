/**
 * ICS calendar provider (Phase 18A, Part 3). A minimal, hand-rolled RFC 5545
 * subset parser — no dependency, fully testable, and deliberately narrow: it
 * reads VEVENT SUMMARY/DTSTART/DTEND/LOCATION/UID/RRULE and nothing else.
 * RRULE text is preserved verbatim and is NEVER expanded into multiple
 * occurrences here (that would silently invent calendar entries) — the
 * candidate keeps the raw recurrence rule for the user to see.
 *
 * A VEVENT missing SUMMARY or DTSTART is skipped with a warning; the rest of
 * the file is still processed. A file with no BEGIN:VCALENDAR at all is a
 * hard parse failure.
 */

import type {
  AcademicProvider,
  CalendarCandidateEventType,
  ExtractionContext,
  ImportedCalendarCandidate,
  ImportedSourcePackage,
  ImportWarning,
  ProviderInput,
  SourceDateValue,
} from "../types";
import { ImportError } from "../types";

let counter = 0;
function tempId(): string {
  counter += 1;
  return `calendar-ics-${counter}`;
}

/** RFC 5545 line unfolding: a line starting with a single space/tab continues the previous line. */
function unfold(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

interface IcsProperty {
  key: string;
  params: Record<string, string>;
  value: string;
}

const PROPERTY_PATTERN = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/;

function parseProperty(line: string): IcsProperty | null {
  const m = PROPERTY_PATTERN.exec(line);
  if (!m) return null;
  const params: Record<string, string> = {};
  if (m[2]) {
    for (const part of m[2].slice(1).split(";")) {
      const [k, v] = part.split("=");
      if (k && v) params[k.toUpperCase()] = v;
    }
  }
  return { key: m[1].toUpperCase(), params, value: m[3] };
}

/** Parses a DTSTART/DTEND value into a SourceDateValue-shaped partial. */
function parseIcsDate(prop: IcsProperty): { isoDate: string | null; isoTime: string | null; tz: string | null } {
  const raw = prop.value.trim();
  const isDateOnly = prop.params.VALUE === "DATE" || /^\d{8}$/.test(raw);
  const dtMatch = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(raw);
  if (!dtMatch) return { isoDate: null, isoTime: null, tz: null };
  const [, y, mo, d, h, mi, , z] = dtMatch;
  const isoDate = `${y}-${mo}-${d}`;
  if (isDateOnly || h === undefined) return { isoDate, isoTime: null, tz: null };
  const tz = z ? "UTC" : prop.params.TZID ?? null;
  return { isoDate, isoTime: `${h}:${mi}`, tz };
}

function classifyEvent(summary: string): CalendarCandidateEventType {
  const s = summary.toLowerCase();
  if (/\b(?:exam|examination)\b/.test(s)) return "exam";
  if (/\blecture\b/.test(s)) return "lecture";
  if (/\btut(e|orial)\b/.test(s)) return "tutorial";
  if (/\b(due|assessment|assignment)\b/.test(s)) return "assessment-due";
  if (/\b(holiday|break|recess)\b/.test(s)) return "holiday";
  return "other";
}

const CODE_PATTERN = /\b([A-Z]{2,4}\d{3,4}[A-Z]{0,2})\b/;

export function parseIcsText(
  text: string,
  sourceId: string,
  filename: string
): { events: ImportedCalendarCandidate[]; warnings: ImportWarning[] } {
  const lines = unfold(text);
  if (!lines.some((l) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) {
    throw new ImportError("parse-failed", `${filename} doesn't look like a valid ICS calendar file.`, sourceId);
  }

  const events: ImportedCalendarCandidate[] = [];
  const warnings: ImportWarning[] = [];
  let current: IcsProperty[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (trimmed.toUpperCase() === "END:VEVENT") {
      if (current) {
        const props = current;
        const summaryProp = props.find((p) => p.key === "SUMMARY");
        const dtStartProp = props.find((p) => p.key === "DTSTART");
        const dtEndProp = props.find((p) => p.key === "DTEND");
        const locationProp = props.find((p) => p.key === "LOCATION");
        const rruleProp = props.find((p) => p.key === "RRULE");
        const uidProp = props.find((p) => p.key === "UID");

        if (!summaryProp || !dtStartProp) {
          warnings.push({
            id: tempId(),
            kind: "unparsable-file",
            message: `Skipped one calendar event in ${filename} — missing a title or start date.`,
            sourceId,
          });
        } else {
          const start = parseIcsDate(dtStartProp);
          const startValue: SourceDateValue = {
            rawText: dtStartProp.value,
            isoDate: start.isoDate,
            isoTime: start.isoTime,
            sourceTimezone: start.tz,
            weekNumber: null,
            dateKind: start.isoDate ? "exact" : "missing",
          };
          const endValue: SourceDateValue | null = dtEndProp
            ? (() => {
                const end = parseIcsDate(dtEndProp);
                return {
                  rawText: dtEndProp.value,
                  isoDate: end.isoDate,
                  isoTime: end.isoTime,
                  sourceTimezone: end.tz,
                  weekNumber: null,
                  dateKind: end.isoDate ? "exact" : "missing",
                } satisfies SourceDateValue;
              })()
            : null;

          const codeMatch = CODE_PATTERN.exec(`${summaryProp.value} ${locationProp?.value ?? ""}`);

          events.push({
            temporaryId: tempId(),
            title: summaryProp.value.trim(),
            start: startValue,
            end: endValue,
            recurrence: rruleProp ? rruleProp.value : null,
            location: locationProp ? locationProp.value.trim() : null,
            subjectCode: codeMatch ? codeMatch[1].toUpperCase() : null,
            eventType: classifyEvent(summaryProp.value),
            sourceReferences: [
              {
                sourceId,
                filename,
                location: uidProp ? uidProp.value : null,
                excerpt: summaryProp.value,
                parser: "ics",
                importedAt: new Date().toISOString(),
              },
            ],
            confidence: start.isoDate ? "high" : "low",
          });
        }
      }
      current = null;
      continue;
    }
    if (current) {
      const prop = parseProperty(trimmed);
      if (prop) current.push(prop);
    }
  }

  return { events, warnings };
}

export function createIcsCalendarProvider(): AcademicProvider {
  return {
    id: "ics-calendar",
    displayName: "Calendar (.ics)",
    capabilities: {
      acceptedFileKinds: ["ics"],
      requiresNoFile: false,
      producesSubjects: false,
      producesCalendarEvents: true,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (input.kind !== "ics") return new ImportError("unsupported-file-type", `${input.filename} isn't an ICS file.`, input.sourceId);
      if (!input.text) return new ImportError("empty-file", `${input.filename} is empty.`, input.sourceId);
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.3, message: "Reading calendar…" });
      const { events, warnings } = parseIcsText(input.text ?? "", input.sourceId, input.filename);
      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return { providerId: "ics-calendar", subjects: [], calendarEvents: events, warnings };
    },
  };
}
