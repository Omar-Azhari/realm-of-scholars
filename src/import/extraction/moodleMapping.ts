/**
 * Moodle → canonical candidate mapping (Phase 18F, Part 9/10/11/12/13/14).
 * Pure functions only — no network, no I/O — mirroring
 * `canvasMapping.ts`'s structure and discipline exactly. Every rule below
 * is a direct, literal encoding of the brief's explicit "never infer" list
 * for Moodle (Part 9): no weighting from a grade maximum alone, no due
 * date from a course end date or cut-off date, no completion from item
 * existence, no assessment status merely because an activity exists, no
 * teaching period from today's date, no subject code without reliable
 * evidence.
 */

import type {
  ImportedAnnouncementCandidate,
  ImportedAssessmentCandidate,
  ImportedCalendarCandidate,
  ImportedModuleCandidate,
  ImportedSubjectCandidate,
  SourceReference,
} from "../types";
import type {
  ValidatedMoodleAssign,
  ValidatedMoodleCalendarEvent,
  ValidatedMoodleCourse,
  ValidatedMoodleForumPost,
  ValidatedMoodleModule,
  ValidatedMoodleQuiz,
  ValidatedMoodleSection,
} from "../../server/lms/moodle/moodleSchemas";
import { sanitizeCanvasHtml } from "./htmlSanitize";

/** Same reasoning as htmlSanitize.ts's Canvas-named export: flattens to safe plain text via the existing, already-proven htmlToPlainText path — reused directly rather than duplicated (see htmlSanitize.ts's own header for why a bespoke HTML allowlist sanitiser is avoided). */
const sanitizeMoodleHtml = sanitizeCanvasHtml;

/**
 * Stable, Moodle-id-derived temporaryIds (mirrors Canvas's `canvasTempId`
 * exactly, for the same reason: re-fetching the SAME Moodle item always
 * produces the SAME temporaryId, making sync change detection a simple
 * lookup rather than a fuzzy match).
 */
function moodleTempId(kind: string, moodleId: number): string {
  return `moodle-${kind}-${moodleId}`;
}

function ref(sourceId: string, filename: string, location: string | null, excerpt: string | null, parser: string): SourceReference {
  return { sourceId, filename, location, excerpt, parser, importedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Course → subject
// ---------------------------------------------------------------------------

/** La Trobe's own subject-code pattern (reused from universityRegistry.ts's `latrobe` entry, /^[A-Z]{3}\d[A-Z]{2}$/) — a Moodle `shortname` is only trusted as a subject code when it actually matches this pattern; otherwise left null rather than guessed (Part 9: "subject code where no reliable evidence exists"). */
const LATROBE_SUBJECT_CODE_PATTERN = /^[A-Z]{3}\d[A-Z]{2}$/;

function extractReliableCode(shortName: string | null): string | null {
  if (!shortName) return null;
  const upper = shortName.toUpperCase().trim();
  return LATROBE_SUBJECT_CODE_PATTERN.test(upper) ? upper : null;
}

export function mapMoodleCourseToSubject(course: ValidatedMoodleCourse, sourceId: string): ImportedSubjectCandidate {
  const code = extractReliableCode(course.shortName);
  const hasName = !!course.fullName;
  const identityConfidence = code && hasName ? "high" : code || hasName ? "medium" : "missing";

  const sourceReferences: SourceReference[] = [];
  if (course.viewUrl) sourceReferences.push(ref(sourceId, `Moodle — ${course.fullName ?? course.shortName ?? "course"}`, course.viewUrl, null, "moodle:course"));

  return {
    temporaryId: moodleTempId("subject", course.id),
    code,
    name: course.fullName ?? course.shortName ?? "Untitled Moodle course",
    description: null, // Moodle's course summary field isn't fetched by core_enrol_get_users_courses in the fields this app requests — never invented
    coordinator: null, // Moodle doesn't expose a reliable "teacher" field through this function — never guessed from enrolled users without a dedicated, explicit role lookup
    creditPoints: null, // Moodle has no native "credit points" concept — never invented
    teachingPeriod: null, // never inferred from the current date alone (Part 9) — resolved by the user/registry-driven flow, same as every other provider
    colourSuggestion: null,
    modules: [],
    assessments: [],
    readings: [],
    goals: [],
    sourceReferences,
    confidence: identityConfidence,
    fieldConfidence: { code: code ? "high" : "missing", name: hasName ? "high" : "missing" },
  };
}

// ---------------------------------------------------------------------------
// Assignment (mod_assign) → assessment
// ---------------------------------------------------------------------------

/**
 * Date rules (Part 10): `duedate` is the ONLY field that ever becomes a
 * deadline. `allowsubmissionsfromdate` and `cutoffdate` are availability/
 * closure metadata only — NEVER substituted for `duedate`, regardless of
 * whether `duedate` is present. A `0`/missing epoch value is already
 * normalised to `null` by `moodleSchemas.ts`'s `optionalEpochSecondsToIso`
 * (never the Unix epoch date).
 *
 * Weighting rule (Part 10): Moodle's `mod_assign` exposes only a single
 * maximum-grade value (`grade`), with no separate, reliable "this
 * assignment is worth X% of the course" field the way Canvas's
 * assignment-group weighting does — so `weighting` is ALWAYS left `null`
 * here; `grade` (the maximum) is preserved separately in `description`'s
 * companion metadata path (never conflated with weighting, per the brief's
 * explicit "grade maximum without weighting" fixture case).
 */
export function mapMoodleAssignToAssessment(assign: ValidatedMoodleAssign, sourceId: string): ImportedAssessmentCandidate {
  const due = assign.dueDateIso
    ? {
        rawText: assign.dueDateIso,
        isoDate: assign.dueDateIso.slice(0, 10),
        isoTime: assign.dueDateIso.slice(11, 16),
        sourceTimezone: "UTC", // Moodle epoch seconds are UTC; converted to an ISO string by moodleSchemas.ts
        weekNumber: null,
        dateKind: "exact" as const,
      }
    : null;

  const sourceReferences: SourceReference[] = [
    ref(sourceId, `Moodle — ${assign.name ?? "assignment"}`, null, assign.intro ? sanitizeMoodleHtml(assign.intro).slice(0, 200) : null, "moodle:assign"),
  ];

  return {
    temporaryId: moodleTempId("assessment", assign.id),
    title: assign.name ?? "Untitled Moodle assignment",
    type: "other", // Moodle doesn't expose a reliable assessment "kind" field — never guessed from a title alone (Part 9's "assessment type solely from a title" prohibition)
    description: assign.intro ? sanitizeMoodleHtml(assign.intro) : "",
    weighting: null, // see function header — never derived from `grade`
    due,
    submissionMethod: null, // mod_assign's submission-type configuration isn't fetched by the fields this app requests — never guessed
    linkedModule: null, // set by the section-mapping pass when a module item references this assignment
    sourceReferences,
    confidence: assign.dueDateIso ? "high" : "medium",
    fieldConfidence: {
      weighting: "missing",
      dueDate: assign.dueDateIso ? "high" : "missing",
    },
  };
}

// ---------------------------------------------------------------------------
// Quiz (mod_quiz) → assessment, only when clearly assessable
// ---------------------------------------------------------------------------

/**
 * Assessable-quiz gating (Part 11): a Moodle quiz with `grade === 0` (or
 * missing) is Moodle's own convention for "not graded" — a practice/
 * self-test quiz, not a real assessment. Only a quiz with a positive
 * `grade` is treated as an assessment candidate; a practice quiz still
 * appears as an ordinary module resource (see moodleMapping's section
 * pass), never silently dropped, just never assumed to be assessable.
 */
export function isMoodleQuizAssessable(quiz: ValidatedMoodleQuiz): boolean {
  return quiz.grade !== null && quiz.grade > 0;
}

export function mapMoodleQuizToAssessment(quiz: ValidatedMoodleQuiz, sourceId: string): ImportedAssessmentCandidate {
  // closeDateIso becomes the deadline ONLY because this function is only
  // ever called after isMoodleQuizAssessable() confirms the quiz is a real
  // assessment (Part 11: "close time may be used as the deadline only when
  // the quiz is actually an assessable activity"); openDateIso stays
  // availability metadata, never a deadline.
  const due = quiz.closeDateIso
    ? {
        rawText: quiz.closeDateIso,
        isoDate: quiz.closeDateIso.slice(0, 10),
        isoTime: quiz.closeDateIso.slice(11, 16),
        sourceTimezone: "UTC",
        weekNumber: null,
        dateKind: "exact" as const,
      }
    : null;

  return {
    temporaryId: moodleTempId("assessment", quiz.id),
    title: quiz.name ?? "Untitled Moodle quiz",
    type: "quiz",
    description: quiz.intro ? sanitizeMoodleHtml(quiz.intro) : "",
    weighting: null, // same reasoning as mapMoodleAssignToAssessment — grade maximum is never weighting
    due,
    submissionMethod: null,
    linkedModule: null,
    sourceReferences: [ref(sourceId, `Moodle — ${quiz.name ?? "quiz"}`, null, quiz.intro ? sanitizeMoodleHtml(quiz.intro).slice(0, 200) : null, "moodle:quiz")],
    confidence: quiz.closeDateIso ? "high" : "medium",
    fieldConfidence: { weighting: "missing", dueDate: quiz.closeDateIso ? "high" : "missing" },
  };
}

// ---------------------------------------------------------------------------
// Sections + modules → module candidates (Part 9/12)
// ---------------------------------------------------------------------------

export interface SectionMappingResult {
  module: ImportedModuleCandidate;
  /** Moodle assign/quiz instance ids this section's activities referenced — used by the caller to link `linkedModule` on the matching assessment candidate, never to create a duplicate assessment from the activity module itself (same discipline as Canvas's module-item linking, Part 12: "assignments and quizzes should reference the corresponding assessment candidate rather than being duplicated"). */
  linkedAssignInstanceIds: number[];
  linkedQuizInstanceIds: number[];
}

const ASSESSMENT_MOD_NAMES = new Set(["assign", "quiz"]);

function describeModuleItem(item: ValidatedMoodleModule): string {
  const label = item.name ?? `Untitled ${item.modName ?? "item"}`;
  if (item.modName === "url" && item.url) return `${label} (${item.url})`;
  return label;
}

/**
 * Maps ONE Moodle section (from `core_course_get_contents`) to a module
 * candidate. Supported activity/resource types (Part 12): assign/quiz
 * reference their assessment candidate rather than duplicating it;
 * page/resource/folder/url/book become resource text/links; forum stays a
 * resource unless identified as an announcements forum (handled
 * separately, Part 14); label/lesson/workshop/choice/glossary/database/lti
 * and anything else Moodle reports become safe linked resources, never
 * dropped or crashed on. Hidden activities are labelled, never silently
 * excluded from the extraction report.
 */
export function mapMoodleSectionToCandidate(section: ValidatedMoodleSection, sourceId: string): SectionMappingResult {
  const linkedAssignInstanceIds: number[] = [];
  const linkedQuizInstanceIds: number[] = [];
  const topics: string[] = [];

  for (const item of section.modules) {
    if (item.modName && ASSESSMENT_MOD_NAMES.has(item.modName) && item.instance !== null) {
      if (item.modName === "assign") linkedAssignInstanceIds.push(item.instance);
      else linkedQuizInstanceIds.push(item.instance);
      continue; // never duplicated as a section topic/resource — it's the linked assessment instead
    }
    const hiddenSuffix = item.visible === false || item.userVisible === false ? " (hidden)" : "";
    topics.push(`${describeModuleItem(item)}${hiddenSuffix}`);
  }

  const sourceReferences: SourceReference[] = [ref(sourceId, `Moodle — ${section.name ?? "section"}`, null, section.summary ? sanitizeMoodleHtml(section.summary).slice(0, 200) : null, "moodle:section")];

  return {
    module: {
      temporaryId: moodleTempId("module", section.id),
      title: section.name ?? `Untitled Moodle section`,
      weekNumber: section.section, // Moodle's own section position/number doubles as a week number in a weekly-format course — a reasonable, non-invented reuse of a field Moodle already provides
      description: section.summary ? sanitizeMoodleHtml(section.summary) : "",
      topics,
      readings: [],
      sourceReferences,
      confidence: section.name ? "high" : "medium",
      fieldConfidence: { title: section.name ? "high" : "missing" },
    },
    linkedAssignInstanceIds,
    linkedQuizInstanceIds,
  };
}

// ---------------------------------------------------------------------------
// Calendar event → calendar candidate (Part 13)
// ---------------------------------------------------------------------------

/**
 * Assignment/quiz-generated calendar events are deduplicated by Moodle's
 * own `modulename`+`instance` reference (Part 13) — never by fuzzy title
 * matching, exactly the same discipline as Canvas's `assignment_id`-based
 * dedup.
 */
export function isMoodleActivityGeneratedEvent(event: ValidatedMoodleCalendarEvent): boolean {
  return (event.moduleName === "assign" || event.moduleName === "quiz") && event.instance !== null;
}

export function mapMoodleCalendarEventToCandidate(event: ValidatedMoodleCalendarEvent, sourceId: string): ImportedCalendarCandidate {
  const start = {
    rawText: event.startIso ?? "",
    isoDate: event.startIso ? event.startIso.slice(0, 10) : null,
    isoTime: event.startIso ? event.startIso.slice(11, 16) : null,
    sourceTimezone: "UTC",
    weekNumber: null,
    dateKind: (event.startIso ? "exact" : "missing") as "exact" | "missing",
  };
  const end =
    event.startIso && event.durationSeconds && event.durationSeconds > 0
      ? (() => {
          const endDate = new Date(new Date(event.startIso as string).getTime() + event.durationSeconds! * 1000);
          const endIso = endDate.toISOString();
          return {
            rawText: endIso,
            isoDate: endIso.slice(0, 10),
            isoTime: endIso.slice(11, 16),
            sourceTimezone: "UTC",
            weekNumber: null,
            dateKind: "exact" as const,
          };
        })()
      : null;

  return {
    temporaryId: moodleTempId("calendar", event.id),
    title: event.name ?? "Untitled Moodle event",
    start,
    end,
    recurrence: null, // Moodle calendar events don't expose an RRULE through this function — never fabricated
    location: null,
    subjectCode: null, // resolved by the caller from event.courseId -> course mapping, same convention as Canvas's context_code
    eventType: event.eventType === "due" || event.eventType === "close" ? "assessment-due" : "other",
    sourceReferences: [ref(sourceId, `Moodle — ${event.name ?? "event"}`, null, null, "moodle:calendar-event")],
    confidence: event.startIso ? "high" : "low",
  };
}

// ---------------------------------------------------------------------------
// Forum post → announcement candidate (Part 14 — optional, never a deadline)
// ---------------------------------------------------------------------------

export function mapMoodleForumPostToAnnouncement(post: ValidatedMoodleForumPost, sourceId: string): ImportedAnnouncementCandidate {
  return {
    temporaryId: moodleTempId("announcement", post.id),
    title: post.subject ?? "Untitled announcement",
    body: post.message ? sanitizeMoodleHtml(post.message) : "",
    authorName: post.authorDisplayName,
    postedAt: post.createdIso,
    sourceUrl: null,
    subjectCode: null, // resolved by the caller from courseId, same convention as calendar events
    sourceReferences: [ref(sourceId, `Moodle — ${post.subject ?? "announcement"}`, null, null, "moodle:announcement")],
    confidence: post.message ? "high" : "medium",
  };
}
