/**
 * Canonical, provider-neutral staging model for academic import (Phase 18A).
 *
 * Everything in this file describes CANDIDATE data — extracted, normalized,
 * possibly conflicting facts that have not yet been reviewed by the user.
 * Nothing here is ever written directly into `UniGameSaveData`; only the
 * apply transaction (`src/import/applyImport.ts`), acting on a package the
 * user has reviewed and approved, may do that (see
 * docs/PHASE_18A_IMPORT_ARCHITECTURE.md §7).
 *
 * Design rules this file encodes (from the architecture audit):
 * - Absent information is `null`/omitted, never invented.
 * - Every field that matters carries its own confidence and source
 *   references — confidence is per-FIELD, not just per-record, because a
 *   single assessment routinely has a confirmed weight and an unconfirmed
 *   date (see the real seed data in src/data/assessments.ts).
 * - Conflicting values are represented explicitly (`conflicting` confidence
 *   + multiple source references), never silently resolved.
 * - Dates preserve their original source wording (`rawText`) alongside any
 *   normalized ISO value, and carry the same `DateKind` vocabulary already
 *   used by the live domain model (`src/types/domain.ts`) so downstream
 *   code has one shared vocabulary for "how sure are we about this date".
 */

import type { DateKind } from "../types/domain";

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export type ConfidenceLevel =
  | "confirmed" // user has explicitly confirmed this exact value
  | "high" // extracted from a structured/tabular source with a clear label
  | "medium" // extracted from prose with a recognisable pattern
  | "low" // weakly inferred (e.g. proximity-based, ambiguous phrasing)
  | "missing" // no source said anything about this field
  | "conflicting"; // two or more sources disagree and were not reconciled

/** Field-level confidence map — keys are field names of the owning candidate. */
export type FieldConfidence<TFields extends string> = Partial<Record<TFields, ConfidenceLevel>>;

// ---------------------------------------------------------------------------
// Source tracking
// ---------------------------------------------------------------------------

export interface SourceReference {
  /** Stable id of the source file/input this reference points into. */
  sourceId: string;
  /** Safe display filename (never a full local path). */
  filename: string;
  /** Page number (PDF), paragraph/section index (DOCX/text), or VEVENT UID (ICS). */
  location: string | null;
  /** The literal text excerpt that produced this field, for user verification. */
  excerpt: string | null;
  /** Which provider/parser produced this reference, e.g. "pdf-document", "rules:assessment-weight". */
  parser: string;
  /** ISO timestamp when this reference was recorded. */
  importedAt: string;
}

/** A date/time as it appeared in a source, kept alongside any normalized form. */
export interface SourceDateValue {
  /** Original wording, verbatim, e.g. "11:59 pm AEST, Sunday 9 August 2026". */
  rawText: string;
  /** Normalized Australia/Melbourne local date (YYYY-MM-DD), or null if not resolvable. */
  isoDate: string | null;
  /** Normalized 24h local time (HH:mm), or null if the source gave no time. */
  isoTime: string | null;
  /** Timezone abbreviation/name as it appeared in the source (e.g. "AEST", "AEDT"), if any. */
  sourceTimezone: string | null;
  /** Week number (1-based) if the source expressed this as "Week N" rather than a date. */
  weekNumber: number | null;
  dateKind: DateKind;
}

// ---------------------------------------------------------------------------
// Candidate records
// ---------------------------------------------------------------------------

export type ModuleCandidateField = "title" | "weekNumber" | "description" | "topics";

/**
 * Academic Intelligence (Phase 19, Part 1/2/8). Readings/schedule entries/
 * outcomes are logically owned by exactly one module (a teaching week) and
 * never exist independently of it, so they're nested arrays here rather
 * than top-level package entities with a cross-reference — see
 * docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §3 for why this differs from
 * Canvas's/Moodle's announcement/calendar-event linking pattern.
 */
export interface ImportedReadingCandidate {
  temporaryId: string;
  title: string;
  kind: "required" | "recommended";
  author: string | null;
  url: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

export interface ImportedScheduleEntryCandidate {
  temporaryId: string;
  kind: "lecture" | "tutorial" | "lab";
  title: string;
  /** As stated in source, e.g. "Tuesday" — never computed from a week number. */
  dayOfWeek: string | null;
  /** "HH:mm", only when explicit in source. */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

export interface ImportedOutcomeCandidate {
  temporaryId: string;
  text: string;
  /** Learning outcomes are usually numbered in the source ("LO1", "CLO3") — kept verbatim, never renumbered. */
  code: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

export interface ImportedModuleCandidate {
  temporaryId: string;
  title: string;
  weekNumber: number | null;
  description: string;
  topics: string[];
  readings: string[];
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
  fieldConfidence: FieldConfidence<ModuleCandidateField>;
  /** Phase 19 (additive, optional): structured readings — distinct from the legacy free-text `readings: string[]` above, which stays untouched for backward compatibility. Absent/undefined treated as []. */
  structuredReadings?: ImportedReadingCandidate[];
  /** Phase 19 (additive, optional): lecture/tutorial/lab timetable entries for this module. Absent/undefined treated as []. */
  schedule?: ImportedScheduleEntryCandidate[];
  /** Phase 19 (additive, optional): learning outcomes stated for this module. Absent/undefined treated as []. */
  outcomes?: ImportedOutcomeCandidate[];
  /** Phase 19 (additive, optional): temporaryIds of OTHER module candidates in the same package this one depends on — a genuine cross-reference (points at a sibling), resolved to real ModuleRecord ids only at Apply. Absent/undefined treated as []. */
  prerequisiteModuleIds?: string[];
}

export type AssessmentCandidateField =
  | "title"
  | "type"
  | "description"
  | "weighting"
  | "dueDate"
  | "dueTime"
  | "submissionMethod";

export type AssessmentCandidateType =
  | "essay"
  | "report"
  | "exam"
  | "project"
  | "presentation"
  | "quiz"
  | "assignment"
  | "other";

export interface ImportedAssessmentCandidate {
  temporaryId: string;
  title: string;
  type: AssessmentCandidateType;
  description: string;
  /** 0-100, or null if not found. */
  weighting: number | null;
  due: SourceDateValue | null;
  submissionMethod: string | null;
  /** temporaryId of an ImportedModuleCandidate this assessment relates to, if any. */
  linkedModule: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
  fieldConfidence: FieldConfidence<AssessmentCandidateField>;
  /** Phase 19 (additive, optional): free text describing an exam's format/duration/materials — never split into fields the source didn't state explicitly. Only meaningful when `type === "exam"`. Absent/undefined treated as null. */
  examInfo?: string | null;
}

export type SubjectCandidateField =
  | "code"
  | "name"
  | "description"
  | "coordinator"
  | "creditPoints"
  | "teachingPeriod";

export interface ImportedSubjectCandidate {
  temporaryId: string;
  code: string | null;
  name: string;
  description: string | null;
  coordinator: string | null;
  /** Phase 19 (additive, optional): coordinator's contact email, when explicitly stated in source. Absent/undefined treated as null. */
  coordinatorEmail?: string | null;
  creditPoints: number | null;
  teachingPeriod: string | null;
  /** Suggested accent colour only — never overrides an existing subject's theme. */
  colourSuggestion: string | null;
  modules: ImportedModuleCandidate[];
  assessments: ImportedAssessmentCandidate[];
  readings: string[];
  /** Grounded, non-invented setup suggestions (see §10 of the architecture doc). */
  goals: string[];
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
  fieldConfidence: FieldConfidence<SubjectCandidateField>;
}

export type CalendarCandidateEventType =
  | "assessment-due"
  | "lecture"
  | "tutorial"
  | "exam"
  | "holiday"
  | "other";

export interface ImportedCalendarCandidate {
  temporaryId: string;
  title: string;
  start: SourceDateValue;
  end: SourceDateValue | null;
  /** Original RRULE text, preserved verbatim; recurrence is NOT expanded into the candidate model. */
  recurrence: string | null;
  location: string | null;
  /** Subject code as it appeared in the calendar source, if any — used for matching, not identity. */
  subjectCode: string | null;
  eventType: CalendarCandidateEventType;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

/**
 * A course/subject announcement (Phase 18E, Part 11 — Canvas's own
 * "Announcements" API). Deliberately NOT an assessment and NOT a deadline —
 * informational only, opt-in per course, never forced. `body` is already
 * sanitised (see extraction/htmlSanitize.ts) before it ever reaches this
 * candidate; nothing downstream re-trusts raw HTML.
 */
export interface ImportedAnnouncementCandidate {
  temporaryId: string;
  title: string;
  /** Sanitised HTML (safe subset only) or plain-text excerpt — never raw, untrusted markup. */
  body: string;
  authorName: string | null;
  /** ISO timestamp, if the source gave one. */
  postedAt: string | null;
  sourceUrl: string | null;
  /** Subject code as it appeared in the source, for associating with a subject — used for matching, not identity, same convention as ImportedCalendarCandidate.subjectCode. */
  subjectCode: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

// ---------------------------------------------------------------------------
// Conflicts & warnings
// ---------------------------------------------------------------------------

export type ConflictKind =
  | "date-mismatch"
  | "weight-mismatch"
  | "duplicate-assessment-name"
  | "semester-date-mismatch"
  | "subject-mapping-ambiguous"
  | "academic-year-mismatch"
  | "teaching-period-mismatch"
  | "subject-code-mismatch"
  | "credit-points-mismatch"
  | "conflicting-handbook-versions"
  /** Phase 18E, Part 16/17 — a Canvas remote item (assignment/module/calendar event/announcement) was absent across two consecutive successful syncs (see canvasSync.ts's remoteDeletionState machine — never raised from a single omission). Resolution is "remove locally" or "keep it"; either way the choice is recorded, never a silent deletion. */
  | "canvas-remote-item-removed"
  /** Phase 18F, Part 17 — the same rule as canvas-remote-item-removed, for a Moodle remote item (assignment/quiz/section/calendar event/announcement) absent across two consecutive successful syncs (see moodleSync.ts's remoteDeletionState machine). */
  | "moodle-remote-item-removed"
  /** Phase 19, Part 7 (docs/PHASE_19_ACADEMIC_INTELLIGENCE.md §8) — two or more assessments across any subjects share the same confirmed due date. Not necessarily a problem, but worth surfacing before Apply; single-option acknowledgment resolution, same pattern as duplicate-assessment-name. */
  | "same-day-assessments"
  /** Phase 19, Part 7 — two or more exam-type assessments share the same confirmed due date AND time. */
  | "overlapping-exams"
  /** Phase 19, Part 7 — an otherwise well-identified assessment (confirmed title, confirmed exact due date) has no weighting at all. */
  | "missing-weighting"
  /** Phase 19, Part 7 — an assessment's confirmed due date falls outside the stated academic year, suggesting a stale or misattributed date rather than a real deadline. */
  | "impossible-date"
  /** Phase 19, Part 7 — a subject's module numbering skips a week (e.g. weeks 1,2,4,5 with no 3). */
  | "missing-week"
  /** Phase 19, Part 7 — the same subject name appears as two separate, unmerged candidates post-merge (findSubjectMatch's code/title matching didn't consider them the same subject, but their names are identical) — almost always the same content imported twice. */
  | "duplicate-import"
  | "other";

export interface ImportConflict {
  id: string;
  kind: ConflictKind;
  /** Human-readable summary, e.g. "Due date differs between two sources." */
  summary: string;
  /** temporaryId(s) of the candidate(s) this conflict concerns. */
  candidateIds: string[];
  /** The competing values, each with its own source — never pre-resolved. */
  options: Array<{ label: string; value: string; sourceReferences: SourceReference[] }>;
  /** Set once the user picks an option (its `label`) or excludes the field; null = unresolved. */
  resolution: string | null;
}

export type ImportWarningKind =
  | "scanned-document"
  | "unparsable-file"
  | "empty-extraction"
  | "unmatched-subject"
  | "week-only-date"
  | "duplicate-file"
  | "large-file-truncated"
  | "source-unreachable"
  | "robots-disallowed"
  | "no-url-pattern"
  | "js-rendered-page"
  | "stale-academic-year"
  | "ambiguous-match";

export interface ImportWarning {
  id: string;
  kind: ImportWarningKind;
  message: string;
  sourceId: string | null;
}

// ---------------------------------------------------------------------------
// The package
// ---------------------------------------------------------------------------

export interface ImportSourceFile {
  sourceId: string;
  filename: string;
  /** MIME-sniffed kind, not just the file extension. */
  kind: SupportedFileKind;
  sizeBytes: number;
  /** SHA-256 hex digest of the file bytes, used for duplicate-file detection. */
  contentHash: string;
  providerId: string;
  importedAt: string;
}

export interface ExtractionSummary {
  subjectsFound: number;
  modulesFound: number;
  assessmentsFound: number;
  calendarEventsFound: number;
  confirmedDeadlines: number;
  uncertainDeadlines: number;
  conflictsFound: number;
  missingFieldsCount: number;
}

export interface AcademicImportPackage {
  importId: string;
  createdAt: string;
  /** Every provider that contributed to this package (a package may combine several). */
  provider: string[];
  sourceFiles: ImportSourceFile[];
  institution: string | null;
  degree: string | null;
  major: string | null;
  academicYear: string | null;
  semesterName: string | null;
  campus: string | null;
  subjects: ImportedSubjectCandidate[];
  calendarEvents: ImportedCalendarCandidate[];
  /** Phase 18E (additive, optional): course announcements, opt-in and informational only — absent/undefined is treated as [] everywhere this is read. */
  announcements?: ImportedAnnouncementCandidate[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
  extractionSummary: ExtractionSummary;
}

/** Recomputes extractionSummary from the current package contents — never hand-maintained. */
export function computeExtractionSummary(pkg: {
  subjects: ImportedSubjectCandidate[];
  calendarEvents: ImportedCalendarCandidate[];
  conflicts: ImportConflict[];
}): ExtractionSummary {
  let modulesFound = 0;
  let assessmentsFound = 0;
  let confirmedDeadlines = 0;
  let uncertainDeadlines = 0;
  let missingFieldsCount = 0;

  for (const subject of pkg.subjects) {
    modulesFound += subject.modules.length;
    assessmentsFound += subject.assessments.length;
    for (const assessment of subject.assessments) {
      if (!assessment.due || assessment.due.dateKind === "missing") {
        uncertainDeadlines++;
        missingFieldsCount++;
      } else if (assessment.due.dateKind === "exact" && assessment.due.isoDate && assessment.due.isoTime) {
        confirmedDeadlines++;
      } else {
        uncertainDeadlines++;
      }
      if (assessment.weighting === null) missingFieldsCount++;
    }
    if (subject.code === null) missingFieldsCount++;
  }

  return {
    subjectsFound: pkg.subjects.length,
    modulesFound,
    assessmentsFound,
    calendarEventsFound: pkg.calendarEvents.length,
    confirmedDeadlines,
    uncertainDeadlines,
    conflictsFound: pkg.conflicts.filter((c) => c.resolution === null).length,
    missingFieldsCount,
  };
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export type SupportedFileKind = "pdf" | "docx" | "text" | "markdown" | "ics" | "json";

/** What a provider can accept and produce — used to route files and to render the UI. */
export interface ProviderCapabilities {
  acceptedFileKinds: SupportedFileKind[];
  /** True if the provider needs no file input at all (e.g. manual completion, future web/LMS providers). */
  requiresNoFile: boolean;
  producesSubjects: boolean;
  producesCalendarEvents: boolean;
  /** False for typed placeholders that exist in the type system but are not wired up yet. */
  configured: boolean;
}

export type ImportErrorCode =
  | "unsupported-file-type"
  | "file-too-large"
  | "corrupted-file"
  | "empty-file"
  | "parse-failed"
  | "cancelled"
  | "not-configured"
  | "network-disabled"
  | "unknown";

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly sourceId: string | null;
  constructor(code: ImportErrorCode, message: string, sourceId: string | null = null) {
    super(message);
    this.name = "ImportError";
    this.code = code;
    this.sourceId = sourceId;
  }
}

export interface ImportProgressEvent {
  sourceId: string | null;
  /** 0-1. */
  fraction: number;
  message: string;
}

export interface ExtractionContext {
  signal: AbortSignal;
  onProgress: (event: ImportProgressEvent) => void;
}

/** One file (or manual-entry payload) handed to a provider for extraction. */
export interface ProviderInput {
  sourceId: string;
  filename: string;
  kind: SupportedFileKind;
  /** Raw bytes for binary formats (pdf/docx); absent for text-like/manual inputs. */
  bytes: ArrayBuffer | null;
  /** Decoded text for text-like formats (txt/md/ics/json) and manual entry; absent for binary formats. */
  text: string | null;
}

/** What a single provider run yields, before merging with other providers' output. */
export interface ImportedSourcePackage {
  providerId: string;
  subjects: ImportedSubjectCandidate[];
  calendarEvents: ImportedCalendarCandidate[];
  warnings: ImportWarning[];
  /** Conflicts a provider/orchestrator already knows about at extraction time (e.g. conflicting handbook-year signals within its own fetched pages) — folded into the package's conflicts alongside cross-source conflicts detected during merge. Optional: absent/undefined is treated as `[]` by `mergeSourcePackages`, so existing providers that never raise one need no change. */
  conflicts?: ImportConflict[];
  /** Phase 18E (additive, optional): course announcements. Absent/undefined is treated as [] by mergeSourcePackages — every non-Canvas provider needs no change. */
  announcements?: ImportedAnnouncementCandidate[];
}

/**
 * Shared contract every academic data source implements — from a locally
 * parsed PDF to (later) a live LMS connection. Placeholder providers
 * implement this same interface with `capabilities.configured = false` and
 * `isAvailable() => false`, so the UI and the import manager never need a
 * special case for "not built yet".
 */
export interface AcademicProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  /** Cheap synchronous/async capability probe — no network calls for unconfigured providers. */
  isAvailable(): boolean | Promise<boolean>;
  /** Fast pre-check before committing to extraction (file kind, size, basic structural sanity). */
  validate(input: ProviderInput): ImportError | null;
  /** The actual extraction; must respect `ctx.signal` and report progress via `ctx.onProgress`. */
  extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage>;
}

// ---------------------------------------------------------------------------
// Optional server-side AI extraction adapter (Part 11 — interface only)
// ---------------------------------------------------------------------------

export interface AcademicExtractionRequest {
  documentText: string;
  sourceMetadata: { filename: string; kind: SupportedFileKind };
  /** Describes the shape the caller expects back — lets the server validate before returning. */
  expectedSchema: "subject" | "assessment" | "module" | "calendar";
}

export interface AcademicExtractionResponse {
  candidates: unknown; // validated against the canonical schema by the caller before use
  fieldConfidence: Record<string, ConfidenceLevel>;
  sourceExcerpts: string[];
  warnings: string[];
}

/**
 * Optional, NOT wired up in Phase 18A. A real implementation must call a
 * backend/serverless function — never hold an API key in browser code (see
 * docs/PHASE_18A_IMPORT_ARCHITECTURE.md §5 and
 * src/import/aiExtractionAdapter.ts for the full security contract).
 */
export interface AcademicExtractionService {
  readonly configured: boolean;
  extract(request: AcademicExtractionRequest): Promise<AcademicExtractionResponse>;
}
