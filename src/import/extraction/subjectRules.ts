/**
 * Subject-identity extraction rules (Phase 18A, Part 5).
 *
 * Looks for a subject/unit name, code, and coordinator near the top of a
 * syllabus document. Deliberately conservative: a code is only reported
 * when it matches the standard AU unit-code shape (2-4 letters + 3-4
 * digits); a coordinator is only reported when introduced by an explicit
 * label. Nothing here invents a name from a filename or similar guesswork.
 */

import type { ConfidenceLevel } from "../types";
import { extractCoordinatorEmail } from "./enrichmentRules";

const CODE_PATTERN = /\b([A-Z]{2,4}\d{3,4}[A-Z]{0,2})\b/;
const UNIT_LABEL_PATTERN = /^(?:unit|subject|course)\s*(?:name|title)?\s*[:\-–]\s*(.+)$/im;
const CODE_LABEL_PATTERN = /^(?:unit|subject|course)\s*code\s*[:\-–]\s*([A-Z0-9]{4,8})/im;
const COORDINATOR_LABEL_PATTERN = /^(?:coordinator|unit coordinator|lecturer|convenor)\s*[:\-–]\s*(.+)$/im;

export interface SubjectIdentityResult {
  name: string | null;
  nameConfidence: ConfidenceLevel;
  nameIndex: number | null;
  code: string | null;
  codeConfidence: ConfidenceLevel;
  codeIndex: number | null;
  coordinator: string | null;
  coordinatorIndex: number | null;
  /** Phase 19 (additive) — only ever populated from an email found near the coordinator label itself, never from elsewhere in the document. */
  coordinatorEmail: string | null;
}

/**
 * `text` should be the first ~2000 characters of a document — subject
 * identity is a header concern; searching the whole document risks matching
 * a code mentioned in passing much later (e.g. a prerequisite reference).
 */
export function extractSubjectIdentity(text: string): SubjectIdentityResult {
  const head = text.slice(0, 2000);

  const labelMatch = UNIT_LABEL_PATTERN.exec(head);
  let name: string | null = null;
  let nameConfidence: ConfidenceLevel = "missing";
  let nameIndex: number | null = null;
  if (labelMatch) {
    name = labelMatch[1].trim();
    nameConfidence = "high";
    nameIndex = labelMatch.index;
  } else {
    // Fall back to the first substantial, non-empty line (medium confidence —
    // syllabus titles are usually the first heading, but this is a guess).
    const firstLine = head.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length >= 6 && l.length <= 120);
    if (firstLine) {
      name = firstLine;
      nameConfidence = "medium";
      nameIndex = head.indexOf(firstLine);
    }
  }

  const codeLabelMatch = CODE_LABEL_PATTERN.exec(head);
  let code: string | null = null;
  let codeConfidence: ConfidenceLevel = "missing";
  let codeIndex: number | null = null;
  if (codeLabelMatch) {
    code = codeLabelMatch[1].toUpperCase();
    codeConfidence = "high";
    codeIndex = codeLabelMatch.index;
  } else {
    const bare = CODE_PATTERN.exec(head);
    if (bare) {
      code = bare[1].toUpperCase();
      codeConfidence = "medium";
      codeIndex = bare.index;
    }
  }

  const coordMatch = COORDINATOR_LABEL_PATTERN.exec(head);
  const coordinator = coordMatch ? coordMatch[1].trim() : null;
  const coordinatorIndex = coordMatch ? coordMatch.index : null;
  const coordinatorEmail = extractCoordinatorEmail(head, coordinatorIndex);

  return { name, nameConfidence, nameIndex, code, codeConfidence, codeIndex, coordinator, coordinatorIndex, coordinatorEmail };
}
