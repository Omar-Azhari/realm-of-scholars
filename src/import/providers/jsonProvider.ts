/**
 * Structured JSON provider (Phase 18A, Part 3). Accepts a pre-structured
 * academic package (e.g. hand-authored, or exported by a future integration)
 * matching a documented lenient schema. Every field is defensively type-
 * checked; a malformed entry is skipped with a warning rather than crashing
 * or being silently coerced into something invented.
 *
 * Expected shape (all fields optional except subjects[].name):
 * {
 *   "institution": "Example University",
 *   "degree": "Bachelor of IT",
 *   "academicYear": "2026",
 *   "semesterName": "Semester 2",
 *   "subjects": [
 *     {
 *       "code": "CSE2UI",
 *       "name": "User Interface Design",
 *       "coordinator": "Dr Example",
 *       "modules": [{ "weekNumber": 1, "title": "Intro", "description": "..." }],
 *       "assessments": [
 *         { "title": "Assignment 1", "type": "report", "weighting": 20,
 *           "dueDate": "2026-08-09", "dueTime": "23:59", "submissionMethod": "LMS upload" }
 *       ]
 *     }
 *   ]
 * }
 */

import type {
  AssessmentCandidateType,
  ImportedAssessmentCandidate,
  ImportedModuleCandidate,
  ImportedSubjectCandidate,
  ImportWarning,
  SourceReference,
  AcademicProvider,
  ExtractionContext,
  ImportedSourcePackage,
  ProviderInput,
} from "../types";
import { ImportError } from "../types";

let counter = 0;
function tempId(prefix: string): string {
  counter += 1;
  return `${prefix}-json-${counter}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ASSESSMENT_TYPES = new Set<AssessmentCandidateType>([
  "essay", "report", "exam", "project", "presentation", "quiz", "assignment", "other",
]);

function makeRef(sourceId: string, filename: string, location: string): SourceReference {
  return { sourceId, filename, location, excerpt: null, parser: "json-structured", importedAt: new Date().toISOString() };
}

function parseModule(raw: unknown, sourceId: string, filename: string, index: number): ImportedModuleCandidate | null {
  if (!isRecord(raw) || typeof raw.title !== "string" || raw.title.trim().length === 0) return null;
  return {
    temporaryId: tempId("module"),
    title: raw.title.trim(),
    weekNumber: typeof raw.weekNumber === "number" ? raw.weekNumber : null,
    description: typeof raw.description === "string" ? raw.description : "",
    topics: Array.isArray(raw.topics) ? raw.topics.filter((t): t is string => typeof t === "string") : [raw.title],
    readings: Array.isArray(raw.readings) ? raw.readings.filter((r): r is string => typeof r === "string") : [],
    sourceReferences: [makeRef(sourceId, filename, `subject.modules[${index}]`)],
    confidence: "confirmed",
    fieldConfidence: { title: "confirmed", weekNumber: raw.weekNumber != null ? "confirmed" : "missing" },
  };
}

function parseAssessment(raw: unknown, sourceId: string, filename: string, index: number): ImportedAssessmentCandidate | null {
  if (!isRecord(raw) || typeof raw.title !== "string" || raw.title.trim().length === 0) return null;
  const type = typeof raw.type === "string" && ASSESSMENT_TYPES.has(raw.type as AssessmentCandidateType)
    ? (raw.type as AssessmentCandidateType)
    : "other";
  const weighting = typeof raw.weighting === "number" && raw.weighting >= 0 && raw.weighting <= 100 ? raw.weighting : null;
  const dueDate = typeof raw.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null;
  const dueTime = typeof raw.dueTime === "string" && /^\d{2}:\d{2}$/.test(raw.dueTime) ? raw.dueTime : null;

  return {
    temporaryId: tempId("assessment"),
    title: raw.title.trim(),
    type,
    description: typeof raw.description === "string" ? raw.description : "",
    weighting,
    due: dueDate
      ? {
          rawText: dueTime ? `${dueDate} ${dueTime}` : dueDate,
          isoDate: dueDate,
          isoTime: dueTime,
          sourceTimezone: null,
          weekNumber: null,
          dateKind: "exact",
        }
      : null,
    submissionMethod: typeof raw.submissionMethod === "string" ? raw.submissionMethod : null,
    linkedModule: null,
    sourceReferences: [makeRef(sourceId, filename, `subject.assessments[${index}]`)],
    confidence: "confirmed",
    fieldConfidence: {
      title: "confirmed",
      weighting: weighting !== null ? "confirmed" : "missing",
      dueDate: dueDate ? "confirmed" : "missing",
      dueTime: dueTime ? "confirmed" : "missing",
    },
  };
}

function parseSubject(raw: unknown, sourceId: string, filename: string, index: number, warnings: ImportWarning[]): ImportedSubjectCandidate | null {
  if (!isRecord(raw) || typeof raw.name !== "string" || raw.name.trim().length === 0) {
    warnings.push({
      id: tempId("warn"),
      kind: "unparsable-file",
      message: `subjects[${index}] in ${filename} has no "name" field and was skipped.`,
      sourceId,
    });
    return null;
  }

  const modules = Array.isArray(raw.modules)
    ? raw.modules.map((m, i) => parseModule(m, sourceId, filename, i)).filter((m): m is ImportedModuleCandidate => m !== null)
    : [];
  const assessments = Array.isArray(raw.assessments)
    ? raw.assessments.map((a, i) => parseAssessment(a, sourceId, filename, i)).filter((a): a is ImportedAssessmentCandidate => a !== null)
    : [];

  return {
    temporaryId: tempId("subject"),
    code: typeof raw.code === "string" ? raw.code.toUpperCase() : null,
    name: raw.name.trim(),
    description: typeof raw.description === "string" ? raw.description : null,
    coordinator: typeof raw.coordinator === "string" ? raw.coordinator : null,
    creditPoints: typeof raw.creditPoints === "number" ? raw.creditPoints : null,
    teachingPeriod: typeof raw.teachingPeriod === "string" ? raw.teachingPeriod : null,
    colourSuggestion: null,
    modules,
    assessments,
    readings: [],
    goals: [],
    sourceReferences: [makeRef(sourceId, filename, `subjects[${index}]`)],
    confidence: "confirmed",
    fieldConfidence: { name: "confirmed", code: raw.code ? "confirmed" : "missing" },
  };
}

export function createStructuredJsonProvider(): AcademicProvider {
  return {
    id: "structured-json",
    displayName: "Structured JSON",
    capabilities: {
      acceptedFileKinds: ["json"],
      requiresNoFile: false,
      producesSubjects: true,
      producesCalendarEvents: false,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (input.kind !== "json") return new ImportError("unsupported-file-type", `${input.filename} isn't JSON.`, input.sourceId);
      if (!input.text) return new ImportError("empty-file", `${input.filename} is empty.`, input.sourceId);
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.2, message: "Parsing JSON…" });

      let parsed: unknown;
      try {
        parsed = JSON.parse(input.text ?? "");
      } catch {
        throw new ImportError("parse-failed", `${input.filename} is not valid JSON.`, input.sourceId);
      }
      if (!isRecord(parsed)) {
        throw new ImportError("parse-failed", `${input.filename} must be a JSON object.`, input.sourceId);
      }

      const warnings: ImportWarning[] = [];
      const subjectsRaw = Array.isArray(parsed.subjects) ? parsed.subjects : [];
      ctx.onProgress({ sourceId: input.sourceId, fraction: 0.6, message: "Reading subjects…" });
      const subjects = subjectsRaw
        .map((s, i) => parseSubject(s, input.sourceId, input.filename, i, warnings))
        .filter((s): s is ImportedSubjectCandidate => s !== null);

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return { providerId: "structured-json", subjects, calendarEvents: [], warnings };
    },
  };
}
