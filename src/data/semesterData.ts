/**
 * Structured semester seed data assembled from `modules.ts` and `assessments.ts`
 * (see planning/DOCUMENT_AUDIT.md and planning/SEMESTER_DATA.md for full
 * provenance and reasoning).
 *
 * Rules this file follows:
 * - Nothing here is invented. Any field not clearly confirmed in /docs is
 *   `null` with `status: "needs_confirmation"` (see src/types/domain.ts).
 * - This is the DEFAULT/SEED layer only. At runtime, user edits are stored as
 *   a separate overlay in local storage so re-importing an updated version of
 *   this file later will not erase user progress (see planning/FEATURE_PLAN.md,
 *   section 7).
 * - This file is intentionally editable: as the user confirms real LMS
 *   details, update the relevant `ConfirmableValue` entries in `modules.ts` /
 *   `assessments.ts` (or, once Phase 2 ships the in-app editors, edit them
 *   from the UI instead).
 *
 * Import boundary: entity *types* (`AssessmentRecord`, `SubjectRecord`, etc.)
 * live only in `src/types/domain.ts` — import them from there. This file
 * exports *data* only (`subjects`, `semesterData`), so there is exactly one
 * import path for each.
 */

import { confirmed, unconfirmed, type SemesterRecord, type SubjectRecord } from "../types/domain";
import { uiModules, cwaModules, pmModules, ppeModules } from "./modules";
import { uiAssessments, cwaAssessments, pmAssessments, ppeAssessments } from "./assessments";

export const subjects: SubjectRecord[] = [
  {
    id: "user-interface-design",
    name: "User Interface Design",
    code: confirmed("CSE2UI"),
    colourTheme: "Violet / magenta",
    characterConcept: "A creative interface designer with a holographic sketch tablet.",
    modules: uiModules,
    assessments: uiAssessments,
  },
  {
    id: "cloud-based-web-application-development",
    name: "Cloud-Based Web Application Development",
    code: confirmed("CSE3CWA"),
    colourTheme: "Electric blue / silver",
    characterConcept: "A calm cloud engineer with a floating terminal and server drone.",
    modules: cwaModules,
    assessments: cwaAssessments,
  },
  {
    id: "project-management",
    name: "Project Management",
    code: unconfirmed<string>(),
    colourTheme: "Amber / navy",
    characterConcept: "A focused project coordinator carrying a smart clipboard and timeline projector.",
    modules: pmModules,
    assessments: pmAssessments,
  },
  {
    id: "professional-practices-and-entrepreneurship-in-it",
    name: "Professional Practices and Entrepreneurship in Information Technology",
    code: unconfirmed<string>(),
    colourTheme: "Emerald / gold",
    characterConcept: "An energetic startup founder with a digital pitch board and ethics compass.",
    modules: ppeModules,
    assessments: ppeAssessments,
  },
];

export const semesterData: SemesterRecord = {
  label: "2026 Semester 2",
  timezone: "Australia/Melbourne",
  startDate: unconfirmed<string>(),
  endDate: unconfirmed<string>(),
  breaks: [],
  examPeriod: unconfirmed<string>(),
  weekNumberingNote:
    "No semester start date, break dates, or exam period are stated anywhere in /docs. " +
    "Previous automated inference that a mid-semester break occurred (10-16 August 2026) was removed: " +
    "that inference was based on extrapolating from week numbers and is not supported by an explicit " +
    "source file in /docs. The application distinguishes between: confirmed current-semester dates, " +
    "placeholder dates shown in the source, conflicting or potentially stale dates, and dates inferred " +
    "only from week numbers. All non-confirmed dates are labelled with an explicit dateKind and must " +
    "be verified before being used as planner deadlines.",
  subjects,
};
