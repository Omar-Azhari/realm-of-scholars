/**
 * Prose-style assessment extraction (Phase 18B). A fallback for official
 * university handbook "Assessment" pages, which typically describe tasks as
 * plain numbered/bulleted sentences ("Essay worth 50% ... Due Week 10")
 * rather than under an "Assessment N:" heading — confirmed against the real,
 * live University of Melbourne handbook during Phase 18B research (see
 * docs/PHASE_18B_UNIVERSITY_DISCOVERY.md).
 *
 * Returns the exact same `AssessmentMention` shape as assessmentRules.ts so
 * syllabusParser.ts maps both through identical code — this is a second
 * *finder*, not a second extraction pipeline. It is only ever tried when the
 * heading-based pass finds nothing, so an ordinary uploaded syllabus's
 * behaviour is completely unchanged.
 */

import { extractDateMentions } from "./dates";
import { findSubmissionMethod, findWeighting } from "./textBlocks";
import type { AssessmentMention } from "./assessmentRules";

export function extractProseAssessmentMentions(text: string, contextYear: number | null): AssessmentMention[] {
  const dateMentions = extractDateMentions(text, contextYear);
  const mentions: AssessmentMention[] = [];
  let offset = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const lineStart = offset;
    offset += rawLine.length + 1;
    if (line.length < 15) continue; // skip stray short/noise lines

    const weighting = findWeighting(line);
    if (weighting === null) continue; // every real mention on these pages states a weighting

    const lineEnd = lineStart + line.length;
    const dueMention = dateMentions.find((m) => m.index >= lineStart && m.index < lineEnd && !m.isExample) ?? null;

    const beforeWeight = line.split(/,?\s*worth\s+\d/i)[0];
    const title =
      (beforeWeight && beforeWeight.trim().replace(/[.,;:]+$/, "").slice(0, 90)) ||
      line.slice(0, 90) ||
      `Assessment component ${mentions.length + 1}`;

    mentions.push({
      heading: { text: line, index: lineStart },
      kindWord: "assessment",
      numberInHeading: null,
      titleFromHeading: title,
      type: "other",
      block: line,
      weighting,
      dueMention,
      submissionMethod: findSubmissionMethod(line),
      // Prose-derived titles are a best-effort clause split, never a real heading — always low.
      titleConfidence: "low",
    });
  }

  return mentions;
}
