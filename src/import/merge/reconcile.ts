/**
 * Reconciles a merged AcademicImportPackage against the LIVE save (Phase
 * 18A, Part 6/9). This is the second half of source-priority: after
 * providers have been merged against each other, every subject/module/
 * assessment candidate is matched against what's already in
 * `UniGameSaveData.semester`, and:
 *
 *  - a candidate field that would fill a currently `needs_confirmation`
 *    live field is left alone (no conflict — that's the normal, desired
 *    case Apply will use to fill the gap);
 *  - a candidate field that DISAGREES with an already-`confirmed` live
 *    field becomes an ImportConflict, exactly like a disagreement between
 *    two providers — a confirmed live value is never silently overwritten.
 *
 * Also attaches a default subject-mapping suggestion to each subject
 * candidate (via `suggestSubjectMapping`) so the Review screen can
 * pre-select an obvious match while still requiring explicit confirmation.
 */

import type { SemesterRecord, SubjectRecord } from "../../types/domain";
import type { AcademicImportPackage, ImportConflict, ImportedAssessmentCandidate } from "../types";
import { computeExtractionSummary } from "../types";
import { similarity, TITLE_MATCH_THRESHOLD } from "./matching";
import { suggestSubjectMapping, type SubjectMappingSuggestion } from "./subjectMapping";

let conflictCounter = 0;
function nextConflictId(): string {
  conflictCounter += 1;
  return `live-conflict-${conflictCounter}`;
}

export interface ReconciledSubject {
  temporaryId: string;
  mapping: SubjectMappingSuggestion;
}

export interface ReconcileResult {
  pkg: AcademicImportPackage;
  subjectMappings: ReconciledSubject[];
}

function findLiveAssessmentMatch(candidate: ImportedAssessmentCandidate, live: SubjectRecord) {
  let best: SubjectRecord["assessments"][number] | null = null;
  let bestScore = TITLE_MATCH_THRESHOLD;
  for (const a of live.assessments) {
    const score = similarity(a.title, candidate.title);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

export function reconcileWithLiveSemester(pkg: AcademicImportPackage, semester: SemesterRecord): ReconcileResult {
  const conflicts: ImportConflict[] = [...pkg.conflicts];
  const subjectMappings: ReconciledSubject[] = [];

  for (const subjectCandidate of pkg.subjects) {
    const mapping = suggestSubjectMapping(subjectCandidate, semester.subjects);
    subjectMappings.push({ temporaryId: subjectCandidate.temporaryId, mapping });
    if (!mapping.subjectId) continue;

    const liveSubject = semester.subjects.find((s) => s.id === mapping.subjectId);
    if (!liveSubject) continue;

    if (mapping.ambiguousWith) {
      conflicts.push({
        id: nextConflictId(),
        kind: "subject-mapping-ambiguous",
        summary: `"${subjectCandidate.name}" could match either "${liveSubject.name}" or "${mapping.ambiguousWith.subjectName}" — please confirm which one this import belongs to.`,
        candidateIds: [subjectCandidate.temporaryId],
        options: [
          { label: liveSubject.name, value: liveSubject.id, sourceReferences: [] },
          { label: mapping.ambiguousWith.subjectName, value: mapping.ambiguousWith.subjectId, sourceReferences: [] },
        ],
        resolution: null,
      });
    }

    // Subject code: only a conflict if the live code is confirmed AND differs.
    if (liveSubject.code.status === "confirmed" && subjectCandidate.code) {
      if (liveSubject.code.value?.toUpperCase() !== subjectCandidate.code.toUpperCase()) {
        conflicts.push({
          id: nextConflictId(),
          kind: "other",
          summary: `${liveSubject.name}'s code is already confirmed as "${liveSubject.code.value}", but this import says "${subjectCandidate.code}".`,
          candidateIds: [subjectCandidate.temporaryId],
          options: [
            { label: `Keep confirmed: ${liveSubject.code.value}`, value: liveSubject.code.value ?? "", sourceReferences: [] },
            { label: `Use imported: ${subjectCandidate.code}`, value: subjectCandidate.code, sourceReferences: subjectCandidate.sourceReferences },
          ],
          resolution: null,
        });
      }
    }

    for (const assessmentCandidate of subjectCandidate.assessments) {
      const liveAssessment = findLiveAssessmentMatch(assessmentCandidate, liveSubject);
      if (!liveAssessment) continue; // no live match → treated as a genuinely new assessment at Apply time

      if (
        liveAssessment.weight.status === "confirmed" &&
        assessmentCandidate.weighting !== null &&
        Math.abs((liveAssessment.weight.value ?? -1) - assessmentCandidate.weighting) > 0.01
      ) {
        conflicts.push({
          id: nextConflictId(),
          kind: "weight-mismatch",
          summary: `"${liveAssessment.title}" already has a confirmed weight of ${liveAssessment.weight.value}%, but this import says ${assessmentCandidate.weighting}%.`,
          candidateIds: [assessmentCandidate.temporaryId],
          options: [
            { label: `Keep confirmed: ${liveAssessment.weight.value}%`, value: String(liveAssessment.weight.value), sourceReferences: [] },
            { label: `Use imported: ${assessmentCandidate.weighting}%`, value: String(assessmentCandidate.weighting), sourceReferences: assessmentCandidate.sourceReferences },
          ],
          resolution: null,
        });
      }

      if (
        liveAssessment.dueDate.status === "confirmed" &&
        assessmentCandidate.due?.isoDate &&
        liveAssessment.dueDate.value !== assessmentCandidate.due.isoDate
      ) {
        conflicts.push({
          id: nextConflictId(),
          kind: "date-mismatch",
          summary: `"${liveAssessment.title}" already has a confirmed due date (${liveAssessment.dueDate.value}), but this import says ${assessmentCandidate.due.rawText}.`,
          candidateIds: [assessmentCandidate.temporaryId],
          options: [
            { label: `Keep confirmed: ${liveAssessment.dueDate.value}`, value: liveAssessment.dueDate.value ?? "", sourceReferences: [] },
            { label: `Use imported: ${assessmentCandidate.due.rawText}`, value: assessmentCandidate.due.isoDate, sourceReferences: assessmentCandidate.sourceReferences },
          ],
          resolution: null,
        });
      }
    }
  }

  const merged: AcademicImportPackage = { ...pkg, conflicts, extractionSummary: computeExtractionSummary({ ...pkg, conflicts }) };
  return { pkg: merged, subjectMappings };
}
