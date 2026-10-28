/**
 * Assessment extraction rules (Phase 18A, Part 5).
 *
 * Finds assessment-like headings (Assessment N, Assignment, Quiz,
 * Examination, Presentation, Project) and, within the text block up to the
 * next heading, the assessment's weighting, due date/time (via
 * extractDateMentions — example dates are excluded), and submission method.
 * A block with no recognisable title is skipped; a due-date match flagged
 * `isExample` is never used as the assessment's due date.
 */

import type { AssessmentCandidateType, ConfidenceLevel } from "../types";
import { extractDateMentions, type DateMention } from "./dates";
import { findSubmissionMethod, findWeighting, sliceUntilNext, type Heading } from "./textBlocks";

const HEADING_PATTERN =
  /^\s*(assessment|assignment|quiz|examination|exam|presentation|project)\s*(\d{1,2})?\s*[:\-–]?\s*(.*)$/i;

const KIND_MAP: Record<string, AssessmentCandidateType> = {
  assessment: "other",
  assignment: "assignment",
  quiz: "quiz",
  examination: "exam",
  exam: "exam",
  presentation: "presentation",
  project: "project",
};

export interface AssessmentMention {
  heading: Heading;
  kindWord: string;
  numberInHeading: number | null;
  titleFromHeading: string;
  type: AssessmentCandidateType;
  block: string;
  weighting: number | null;
  dueMention: DateMention | null;
  submissionMethod: string | null;
  titleConfidence: ConfidenceLevel;
}

function findHeadings(text: string): Array<Heading & { kindWord: string; numberInHeading: number | null; rest: string }> {
  const headings: Array<Heading & { kindWord: string; numberInHeading: number | null; rest: string }> = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const match = HEADING_PATTERN.exec(line);
    if (match) {
      headings.push({
        text: line.trim(),
        index: offset + (match.index ?? 0),
        kindWord: match[1].toLowerCase(),
        numberInHeading: match[2] ? Number(match[2]) : null,
        rest: match[3]?.trim() ?? "",
      });
    }
    offset += line.length + 1;
  }
  return headings;
}

export function extractAssessmentMentions(text: string, contextYear: number | null): AssessmentMention[] {
  const rawHeadings = findHeadings(text);
  const headings: Heading[] = rawHeadings.map((h) => ({ text: h.text, index: h.index }));
  const dateMentions = extractDateMentions(text, contextYear);

  return rawHeadings.map((h, i) => {
    const block = sliceUntilNext(text, headings, headings[i]);
    const weighting = findWeighting(block);
    const submissionMethod = findSubmissionMethod(block);

    // The nearest non-example date mention that falls WITHIN this block.
    const blockEnd = h.index + block.length;
    const candidateDates = dateMentions.filter(
      (m) => m.index >= h.index && m.index < blockEnd && !m.isExample
    );
    const dueMention = candidateDates[0] ?? null;

    const titleFromHeading =
      h.rest.length >= 3
        ? h.rest
        : `${h.kindWord[0].toUpperCase()}${h.kindWord.slice(1)}${h.numberInHeading ? ` ${h.numberInHeading}` : ""}`;

    return {
      heading: { text: h.text, index: h.index },
      kindWord: h.kindWord,
      numberInHeading: h.numberInHeading,
      titleFromHeading,
      type: KIND_MAP[h.kindWord] ?? "other",
      block,
      weighting,
      dueMention,
      submissionMethod,
      titleConfidence: h.rest.length >= 3 ? "high" : "low",
    };
  });
}
