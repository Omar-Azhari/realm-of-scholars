/**
 * Orchestrates the modular rule files into one ImportedSubjectCandidate from
 * plain extracted text (Phase 18A, Part 5). Every provider that reduces to
 * text (PDF, DOCX, TXT, Markdown) shares this single parser — no per-format
 * duplication of extraction logic.
 */

import type {
  AssessmentCandidateField,
  ConfidenceLevel,
  ImportedAssessmentCandidate,
  ImportedModuleCandidate,
  ImportedOutcomeCandidate,
  ImportedReadingCandidate,
  ImportedScheduleEntryCandidate,
  ImportedSubjectCandidate,
  ImportWarning,
  ModuleCandidateField,
  SourceDateValue,
  SourceReference,
  SubjectCandidateField,
} from "../types";
import { extractSubjectIdentity } from "./subjectRules";
import { extractModuleMentions, extractReadingMentions } from "./moduleRules";
import { extractAssessmentMentions } from "./assessmentRules";
import { extractProseAssessmentMentions } from "./proseAssessmentRules";
import { extractScheduleMentions, extractOutcomeMentions, extractExamInfoMention } from "./enrichmentRules";
import { excerptAround } from "./textBlocks";

let candidateCounter = 0;
function nextTempId(prefix: string): string {
  candidateCounter += 1;
  return `${prefix}-${candidateCounter}`;
}

function ref(
  sourceId: string,
  filename: string,
  location: string | null,
  excerpt: string | null,
  parser: string
): SourceReference {
  return { sourceId, filename, location, excerpt, parser, importedAt: new Date().toISOString() };
}

export interface SyllabusParseOptions {
  sourceId: string;
  filename: string;
  /** Explicit user-entered academic year (Study Details step) — never inferred. */
  contextYear: number | null;
  /** Resolves a character offset to a page/section label when the source format supports it (e.g. PDF pages). */
  locate?: (charIndex: number) => string | null;
}

export interface SyllabusParseResult {
  subject: ImportedSubjectCandidate;
  warnings: ImportWarning[];
}

/** Very low extracted-text density relative to length usually means a scanned/image-only PDF. */
export function looksLikeEmptyExtraction(text: string): boolean {
  const meaningful = text.replace(/\s+/g, "");
  return meaningful.length < 40;
}

export function parseSyllabusText(text: string, options: SyllabusParseOptions): SyllabusParseResult {
  const { sourceId, filename, contextYear } = options;
  const locate = options.locate ?? (() => null);
  const warnings: ImportWarning[] = [];

  const identity = extractSubjectIdentity(text);
  const moduleMentions = extractModuleMentions(text);
  const readingMentions = extractReadingMentions(text, moduleMentions);
  // Phase 19 (additive): schedule entries and outcomes aren't module-scoped
  // by the extractor itself (no "Week N" prefix convention exists for
  // these), so association to the nearest preceding module heading happens
  // here — the same "nearest preceding mention by index" rule
  // extractReadingMentions already uses internally.
  const scheduleMentions = extractScheduleMentions(text);
  const outcomeMentions = extractOutcomeMentions(text);
  const nearestModuleWeek = (index: number): number | null => {
    const preceding = [...moduleMentions].filter((m) => m.index <= index).sort((a, b) => b.index - a.index)[0];
    return preceding ? preceding.weekNumber : null;
  };
  const examInfoMention = extractExamInfoMention(text);
  // The prose fallback (numbered/bulleted "Essay worth 50% ... Due Week 10"
  // sentences, as real official handbook Assessment pages use) only ever
  // runs when the heading-based pass finds nothing — an uploaded syllabus
  // with real "Assessment N:" headings is completely unaffected.
  const headingAssessmentMentions = extractAssessmentMentions(text, contextYear);
  const assessmentMentions = headingAssessmentMentions.length > 0 ? headingAssessmentMentions : extractProseAssessmentMentions(text, contextYear);

  const modules: ImportedModuleCandidate[] = moduleMentions.map((m) => {
    const readings = readingMentions.filter((r) => r.nearestWeek === m.weekNumber).map((r) => r.text);
    const structuredReadings: ImportedReadingCandidate[] = readingMentions
      .filter((r) => r.nearestWeek === m.weekNumber)
      .map((r) => ({
        temporaryId: nextTempId("reading"),
        title: r.text,
        kind: r.kind,
        author: null,
        url: null,
        sourceReferences: [ref(sourceId, filename, locate(r.index), excerptAround(text, r.index), "rules:reading")],
        confidence: "high",
      }));
    const schedule: ImportedScheduleEntryCandidate[] = scheduleMentions
      .filter((s) => nearestModuleWeek(s.index) === m.weekNumber)
      .map((s) => ({
        temporaryId: nextTempId("schedule"),
        kind: s.kind,
        title: s.title,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location,
        sourceReferences: [ref(sourceId, filename, locate(s.index), excerptAround(text, s.index), "rules:schedule")],
        confidence: "high",
      }));
    const outcomes: ImportedOutcomeCandidate[] = outcomeMentions
      .filter((o) => nearestModuleWeek(o.index) === m.weekNumber)
      .map((o) => ({
        temporaryId: nextTempId("outcome"),
        text: o.text,
        code: o.code,
        sourceReferences: [ref(sourceId, filename, locate(o.index), excerptAround(text, o.index), "rules:outcome")],
        confidence: o.confidence,
      }));
    return {
      temporaryId: nextTempId("module"),
      title: m.title,
      weekNumber: m.weekNumber,
      description: "",
      topics: [m.title],
      readings,
      structuredReadings,
      schedule,
      outcomes,
      sourceReferences: [
        ref(sourceId, filename, locate(m.index) ?? `week ${m.weekNumber}`, excerptAround(text, m.index), "rules:module-heading"),
      ],
      confidence: m.confidence,
      fieldConfidence: { title: m.confidence, weekNumber: "high" } satisfies Partial<
        Record<ModuleCandidateField, typeof m.confidence>
      >,
    };
  });

  const assessments: ImportedAssessmentCandidate[] = assessmentMentions.map((a) => {
    const dueSourceRefs: SourceReference[] = a.dueMention
      ? [ref(sourceId, filename, locate(a.dueMention.index), excerptAround(text, a.dueMention.index), "rules:date")]
      : [];
    const due: SourceDateValue | null = a.dueMention
      ? {
          rawText: a.dueMention.rawText,
          isoDate: a.dueMention.isoDate,
          isoTime: a.dueMention.isoTime,
          sourceTimezone: a.dueMention.sourceTimezone,
          weekNumber: a.dueMention.weekNumber,
          dateKind: a.dueMention.dateKind,
        }
      : null;

    if (due?.dateKind === "week_only") {
      warnings.push({
        id: nextTempId("warn"),
        kind: "week-only-date",
        message: `"${a.titleFromHeading}" only gives a week number for its due date — the exact date needs confirming.`,
        sourceId,
      });
    }

    const fieldConfidence: Partial<Record<AssessmentCandidateField, ConfidenceLevel>> = {
      title: a.titleConfidence,
      weighting: a.weighting !== null ? "high" : "missing",
      dueDate: due ? (due.dateKind === "exact" ? "high" : "medium") : "missing",
      dueTime: due?.isoTime ? "high" : "missing",
      submissionMethod: a.submissionMethod ? "medium" : "missing",
    };

    return {
      temporaryId: nextTempId("assessment"),
      title: a.titleFromHeading,
      type: a.type,
      description: a.block.split(/\r?\n/).slice(1, 4).join(" ").trim().slice(0, 400),
      weighting: a.weighting,
      due,
      submissionMethod: a.submissionMethod,
      linkedModule: null,
      sourceReferences: [
        ref(sourceId, filename, null, excerptAround(text, a.heading.index), "rules:assessment-heading"),
        ...dueSourceRefs,
      ],
      confidence: a.titleConfidence,
      fieldConfidence,
      // Phase 19 (additive): only ever attached to an exam-type assessment —
      // an explicit "Exam format:" label mentioned anywhere in the document
      // is never attributed to a non-exam assessment.
      examInfo: a.type === "exam" ? (examInfoMention?.description ?? null) : null,
    };
  });

  const subjectFieldConfidence: Partial<Record<SubjectCandidateField, ConfidenceLevel>> = {
    name: identity.nameConfidence,
    code: identity.codeConfidence,
    coordinator: identity.coordinator ? "high" : "missing",
  };

  const subjectSourceRefs: SourceReference[] = [];
  if (identity.nameIndex !== null) {
    subjectSourceRefs.push(
      ref(sourceId, filename, locate(identity.nameIndex), excerptAround(text, identity.nameIndex), "rules:subject-name")
    );
  }
  if (identity.codeIndex !== null) {
    subjectSourceRefs.push(
      ref(sourceId, filename, locate(identity.codeIndex), excerptAround(text, identity.codeIndex), "rules:subject-code")
    );
  }

  if (!identity.name) {
    warnings.push({
      id: nextTempId("warn"),
      kind: "unparsable-file",
      message: `Couldn't find a subject/unit name near the top of "${filename}".`,
      sourceId,
    });
  }

  const subject: ImportedSubjectCandidate = {
    temporaryId: nextTempId("subject"),
    code: identity.code,
    name: identity.name ?? filename,
    description: null,
    coordinator: identity.coordinator,
    coordinatorEmail: identity.coordinatorEmail,
    creditPoints: null,
    teachingPeriod: null,
    colourSuggestion: null,
    modules,
    assessments,
    readings: readingMentions.filter((r) => r.nearestWeek === null).map((r) => r.text),
    goals: [],
    sourceReferences: subjectSourceRefs,
    confidence: identity.name ? identity.nameConfidence : "missing",
    fieldConfidence: subjectFieldConfidence,
  };

  return { subject, warnings };
}
