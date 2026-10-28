/**
 * Reads multiple-choice questions pasted from a tutorial sheet or past
 * paper, with no AI. Understands the common layouts:
 *
 *   1. Which heuristic is broken when…?          Q2) What does HTTP 404 mean?
 *   a) Visibility of system status              A. Server error
 *   b) Match with the real world                B. Not found   *
 *   c) User control and freedom                 C. Redirect
 *   d) Consistency and standards                D. Unauthorised
 *   Answer: c                                   Explanation: 404 = resource not found.
 *
 * The right answer can be given on an "Answer:" line (letter or text) or by
 * marking the choice with * or "(correct)". Questions without exactly four
 * choices or a known answer are reported as skipped, never guessed.
 */

import type { RealmQuestion } from "../types";

export interface ParsedQuestions {
  questions: Array<Omit<RealmQuestion, "id" | "week">>;
  skipped: Array<{ text: string; reason: string }>;
}

const QUESTION_START = /^\s*(?:q(?:uestion)?\s*)?(\d{1,3})\s*[.):-]\s*(.+)$/i;
const CHOICE = /^\s*\(?([a-dA-D])\s*[.):]\s*(.+)$/;
const ANSWER = /^\s*(?:correct\s+answer|answer|ans)\s*[:=-]\s*(.+)$/i;
const EXPLANATION = /^\s*(?:explanation|because|reason|why)\s*[:=-]\s*(.+)$/i;
const MARK = /(?:^\*\s*|\s*\*$|\s*\((?:correct|answer)\)$|\s*✓$)/i;

interface Draft {
  prompt: string[];
  choices: string[];
  marked: number;
  answer: string | null;
  explanation: string;
}

function finish(draft: Draft, out: ParsedQuestions): void {
  const prompt = draft.prompt.join(" ").replace(/\s+/g, " ").trim();
  if (!prompt) return;
  if (draft.choices.length !== 4) {
    out.skipped.push({ text: prompt, reason: `has ${draft.choices.length} choices (needs exactly 4)` });
    return;
  }
  let answerIndex = draft.marked;
  if (draft.answer) {
    const a = draft.answer.trim();
    const letter = /^\(?([a-dA-D])\)?(?:[.)\s]|$)/.exec(a);
    if (letter) answerIndex = letter[1].toLowerCase().charCodeAt(0) - 97;
    else {
      const byText = draft.choices.findIndex((c) => c.toLowerCase() === a.toLowerCase().replace(/[.]$/, ""));
      if (byText >= 0) answerIndex = byText;
    }
  }
  if (answerIndex < 0 || answerIndex > 3) {
    out.skipped.push({ text: prompt, reason: "no answer given (add an 'Answer: b' line or mark the right choice with *)" });
    return;
  }
  if (new Set(draft.choices.map((c) => c.toLowerCase())).size !== 4) {
    out.skipped.push({ text: prompt, reason: "two choices are the same" });
    return;
  }
  out.questions.push({ prompt, choices: draft.choices, answerIndex, explanation: draft.explanation || "From your own tutorial questions.", difficulty: 2 });
}

export function parsePastedQuestions(text: string): ParsedQuestions {
  const out: ParsedQuestions = { questions: [], skipped: [] };
  let draft: Draft | null = null;
  const fresh = (first: string): Draft => ({ prompt: [first], choices: [], marked: -1, answer: null, explanation: "" });

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const choice = CHOICE.exec(line);
    // A choice line only counts once a question has started, and letters must come in order.
    if (choice && draft && choice[1].toLowerCase().charCodeAt(0) - 97 === draft.choices.length) {
      let body = choice[2].trim();
      if (MARK.test(body)) {
        draft.marked = draft.choices.length;
        body = body.replace(MARK, "").trim();
      }
      draft.choices.push(body);
      continue;
    }
    const answer = ANSWER.exec(line);
    if (answer && draft) {
      draft.answer = answer[1];
      continue;
    }
    const explanation = EXPLANATION.exec(line);
    if (explanation && draft) {
      draft.explanation = explanation[1].trim();
      continue;
    }
    const start = QUESTION_START.exec(line);
    if (start || !draft || draft.choices.length === 4 || draft.answer !== null) {
      if (draft) finish(draft, out);
      draft = fresh(start ? start[2] : line);
      continue;
    }
    // A continuation of the question text (before its choices) or of the last choice.
    if (draft.choices.length === 0) draft.prompt.push(line);
    else draft.choices[draft.choices.length - 1] += ` ${line}`;
  }
  if (draft) finish(draft, out);
  return out;
}
