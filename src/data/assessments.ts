/**
 * Structured assessment records for all 4 subjects.
 *
 * Source: docs/UniGame_docs_from_screenshots/docs/*_/13_Assessments.md,
 * MASTER_ASSESSMENTS.md, and semester_data.json (see planning/DOCUMENT_AUDIT.md
 * for full provenance).
 *
 * Every record carries the full field set requested for Phase 2: subject,
 * assessment number, title, weight, due date, due time, confirmation status,
 * AI policy, extension eligibility, reminder schedule, and notes — even when
 * a value is NEEDS_CONFIRMATION. confirmationStatus and reminderSchedule are
 * derived (not hand-typed) from the weight/dueDate/dueTime fields so they can
 * never silently drift out of sync with them.
 */

import {
  confirmed,
  unconfirmed,
  deriveConfirmationStatus,
  deriveReminderSchedule,
  type AssessmentRecord,
} from "../types/domain";

function buildAssessment(
  input: Omit<AssessmentRecord, "confirmationStatus" | "reminderSchedule" | "examInfo"> &
    Partial<Pick<AssessmentRecord, "examInfo">>
): AssessmentRecord {
  return {
    ...input,
    confirmationStatus: deriveConfirmationStatus(
      input.weight,
      input.dueDate,
      input.dueTime
    ),
    reminderSchedule: deriveReminderSchedule(input.dueDate, input.dueTime),
    // Not present in any of the seed screenshots — none of these 14
    // assessments state exam format/duration, so this stays unconfirmed
    // rather than requiring every existing literal to repeat it.
    examInfo: input.examInfo ?? unconfirmed<string>(),
  };
}

// ---------------------------------------------------------------------------
// User Interface Design (CSE2UI)
// ---------------------------------------------------------------------------

export const uiAssessments: AssessmentRecord[] = [
  buildAssessment({
    id: "ui-assessment-1",
    subjectId: "user-interface-design",
    assessmentNumber: 1,
    part: null,
    title: "Assessment 1",
    kind: "other",
    weight: unconfirmed<number>(),
    weightRaw: "NEEDS_CONFIRMATION",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Week 4, 3-9 August 2026; exact date/time NEEDS_CONFIRMATION",
    dateKind: "week_only",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "01_User_Interface_Design/13_Assessments.md",
  }),

  buildAssessment({
    id: "ui-assessment-2",
    subjectId: "user-interface-design",
    assessmentNumber: 2,
    part: null,
    title: "Quantitative and Qualitative Data Analysis",
    kind: "report",
    weight: unconfirmed<number>(),
    weightRaw: "NEEDS_CONFIRMATION (internal split only: 40% quantitative / 40% qualitative / 20% report)",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Week 8, 7-13 September 2026; exact date/time NEEDS_CONFIRMATION",
    dateKind: "week_only",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "01_User_Interface_Design/13_Assessments.md",
  }),

  buildAssessment({
    id: "ui-assessment-3",
    subjectId: "user-interface-design",
    assessmentNumber: 3,
    part: null,
    title: "Assessment 3",
    kind: "other",
    weight: unconfirmed<number>(),
    weightRaw: "NEEDS_CONFIRMATION",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Week 12, 5-11 October 2026; exact date/time NEEDS_CONFIRMATION",
    dateKind: "week_only",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "01_User_Interface_Design/13_Assessments.md",
  }),

  buildAssessment({
    id: "ui-assessment-4",
    subjectId: "user-interface-design",
    assessmentNumber: 4,
    part: null,
    title: "Online Supervised Exam",
    kind: "exam",
    weight: confirmed(50),
    weightRaw: "50%",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Exam period; exact date/time NEEDS_CONFIRMATION",
    dateKind: "placeholder_in_source",
    aiPolicy: confirmed("No AI."),
    extensionEligibility: confirmed("Not eligible for a short extension."),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "01_User_Interface_Design/13_Assessments.md",
  }),
];

// ---------------------------------------------------------------------------
// Cloud-Based Web Application Development (CSE3CWA)
// ---------------------------------------------------------------------------

export const cwaAssessments: AssessmentRecord[] = [
  buildAssessment({
    id: "cwa-assessment-1",
    subjectId: "cloud-based-web-application-development",
    assessmentNumber: 1,
    part: null,
    title: "HealthCoverSim, Private Health Insurance Quote Simulator",
    kind: "project",
    weight: confirmed(20),
    weightRaw: "20%",
    dueDate: confirmed("2026-08-09"),
    dueTime: confirmed("23:59"),
    dueWindowRaw: "11:59 pm AEST, Sunday 9 August 2026",
    dateKind: "exact",
    aiPolicy: confirmed(
      "AI Collaboration category — requires an AI-use statement and a completed AI acknowledgement form."
    ),
    extensionEligibility: confirmed("Short-extension eligible."),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "02_Cloud_Based_Web_Application_Development/13_Assessments.md",
  }),

  buildAssessment({
    id: "cwa-assessment-2",
    subjectId: "cloud-based-web-application-development",
    assessmentNumber: 2,
    part: null,
    title: "Full-Stack Web Application",
    kind: "project",
    weight: confirmed(25),
    weightRaw: "25%",
    dueDate: confirmed("2026-08-30"),
    dueTime: confirmed("23:59"),
    dueWindowRaw: "11:59 pm AEST, 30 August 2026",
    dateKind: "exact",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "02_Cloud_Based_Web_Application_Development/13_Assessments.md",
  }),

  buildAssessment({
    id: "cwa-assessment-3",
    subjectId: "cloud-based-web-application-development",
    assessmentNumber: 3,
    part: null,
    title: "Cloud-Based Web Application",
    kind: "project",
    weight: confirmed(25),
    weightRaw: "25%",
    dueDate: confirmed("2026-09-20"),
    dueTime: confirmed("23:59"),
    dueWindowRaw: "11:59 pm AEST, 20 September 2026",
    dateKind: "exact",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "02_Cloud_Based_Web_Application_Development/13_Assessments.md",
  }),

  buildAssessment({
    id: "cwa-assessment-4",
    subjectId: "cloud-based-web-application-development",
    assessmentNumber: 4,
    part: null,
    title: "Final Web Application",
    kind: "project",
    weight: confirmed(30),
    weightRaw: "30%",
    dueDate: confirmed("2026-10-11"),
    dueTime: confirmed("23:59"),
    dueWindowRaw: "11:59 pm AEDT, 11 October 2026",
    dateKind: "exact",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "02_Cloud_Based_Web_Application_Development/13_Assessments.md",
  }),
];

// ---------------------------------------------------------------------------
// Project Management (subject code NEEDS_CONFIRMATION)
// ---------------------------------------------------------------------------

export const pmAssessments: AssessmentRecord[] = [
  buildAssessment({
    id: "pm-assessment-1-case-study",
    subjectId: "project-management",
    assessmentNumber: 1,
    part: null,
    title: "Case study task analysing project constraints and framework",
    kind: "other",
    weight: confirmed(30),
    weightRaw: "30% (recorded)",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Sunday 29 March 2026 (preserved from source; potentially stale)",
    dateKind: "placeholder_in_source",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "screenshots: Project Management assessment overview",
  }),

  buildAssessment({
    id: "pm-assessment-2-quizzes",
    subjectId: "project-management",
    assessmentNumber: 2,
    part: null,
    title: "Four quizzes (weekly short assessments)",
    kind: "quiz",
    weight: confirmed(10),
    weightRaw: "10% (recorded total)",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Fridays in Weeks 4, 6, 8 and 10 (exact dates not shown)",
    dateKind: "week_only",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "screenshots: Project Management assessment overview",
  }),

  buildAssessment({
    id: "pm-assessment-3-group-project",
    subjectId: "project-management",
    assessmentNumber: 3,
    part: null,
    title: "Three-part group project (total)",
    kind: "project",
    weight: confirmed(60),
    weightRaw: "60% (recorded total)",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw:
      "Overview places parts around Weeks 9, 11 and 12; individual part pages show Week 13 (Part 1) and Week 12 (Part 3) — SOURCE CONFLICT",
    dateKind: "source_conflict",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "screenshots: Project Management assessment overview and individual Part pages",
  }),

  buildAssessment({
    id: "pm-assessment-3-part1",
    subjectId: "project-management",
    assessmentNumber: 3,
    part: "Part 1: Group Project Management Plan",
    title: "Assessment 3 - Part 1: Group Project Management Plan",
    kind: "report",
    weight: confirmed(25),
    weightRaw: "25% (recorded)",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Displayed as due in Week 13 on the Part 1 page; date field was placeholder text",
    dateKind: "placeholder_in_source",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "screenshots: Project Management Assessment 3 Part 1 page",
  }),

  buildAssessment({
    id: "pm-assessment-3-part3",
    subjectId: "project-management",
    assessmentNumber: 3,
    part: "Part 3: Group Presentation",
    title: "Assessment 3 - Part 3: Group Presentation",
    kind: "presentation",
    weight: confirmed(15),
    weightRaw: "15% (recorded)",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "Displayed as due in Week 12 on the Part 3 page; date field was placeholder text",
    dateKind: "placeholder_in_source",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "screenshots: Project Management Assessment 3 Part 3 page",
  }),
];

// ---------------------------------------------------------------------------
// Professional Practices and Entrepreneurship in IT (subject code NEEDS_CONFIRMATION)
// ---------------------------------------------------------------------------

export const ppeAssessments: AssessmentRecord[] = [
  buildAssessment({
    id: "ppe-assessments-structure-not-confirmed",
    subjectId: "professional-practices-and-entrepreneurship-in-it",
    assessmentNumber: 1,
    part: null,
    title: "Assessment structure not confirmed from the supplied source material",
    kind: "other",
    weight: unconfirmed<number>(),
    weightRaw: "not_provided",
    dueDate: unconfirmed<string>(),
    dueTime: unconfirmed<string>(),
    dueWindowRaw: "NEEDS_CONFIRMATION",
    dateKind: "missing",
    aiPolicy: unconfirmed<string>(),
    extensionEligibility: unconfirmed<string>(),
    description: "Details are on the subject's LMS page.",
    notes: "",
    sourceFile: "04_Professional_Practices_and_Entrepreneurship_in_IT/13_Assessments.md",
  }),
];
