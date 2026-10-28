/**
 * Study questions for the play-world games (the archery quiz range and the ping-pong
 * rally quiz). Pure: give it the subjects and a random source.
 */

import { buildQuestionPool } from "../../curriculum/questionBank";
import type { RealmQuestion, RealmSubject } from "../../types";

export interface QuizItem {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** A copy with its choices shuffled (answerIndex follows the right answer). */
  question: RealmQuestion;
}

/** Four distinct, non-empty choices, a prompt, and a valid answer. */
export function isUsableQuestion(q: RealmQuestion | null | undefined): q is RealmQuestion {
  if (!q || typeof q.prompt !== "string" || !q.prompt.trim()) return false;
  if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) return false;
  const texts = q.choices.map((c) => (typeof c === "string" ? c.trim().toLowerCase() : ""));
  return texts.every((t) => t.length > 0) && new Set(texts).size === 4;
}

/** The same question with its choices in a new order; the answer moves with them. */
export function shuffleChoices(q: RealmQuestion, rng: () => number): RealmQuestion {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, choices: order.map((i) => q.choices[i]), answerIndex: order.indexOf(q.answerIndex) };
}

/**
 * Up to `count` different questions, taking turns between subjects so every subject
 * shows up. Real questions come first; key-term questions fill thin subjects.
 */
export function pickQuizQuestions(subjects: RealmSubject[], count: number, rng: () => number = Math.random): QuizItem[] {
  const pools = subjects
    .map((s) => {
      const pool = buildQuestionPool(s).filter(isUsableQuestion);
      // Fisher-Yates with the given random source, so a seeded test is repeatable.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return { subject: s, pool };
    })
    .filter((p) => p.pool.length > 0);
  // Subjects in a random order too.
  for (let i = pools.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pools[i], pools[j]] = [pools[j], pools[i]];
  }
  const seen = new Set<string>();
  const out: QuizItem[] = [];
  let progress = true;
  while (out.length < count && progress) {
    progress = false;
    for (const p of pools) {
      if (out.length >= count) break;
      let q = p.pool.shift();
      while (q && seen.has(q.prompt.trim().toLowerCase())) q = p.pool.shift();
      if (!q) continue;
      seen.add(q.prompt.trim().toLowerCase());
      out.push({ subjectId: p.subject.id, subjectCode: p.subject.code, subjectName: p.subject.name, question: shuffleChoices(q, rng) });
      progress = true;
    }
  }
  return out;
}

/** A quick true/false card made from a multiple-choice question. */
export interface TrueFalseCard {
  item: QuizItem;
  /** The answer shown with the prompt. */
  shown: string;
  /** Whether `shown` is the right answer. */
  isTrue: boolean;
}

export function trueFalseFrom(item: QuizItem, rng: () => number = Math.random): TrueFalseCard {
  const q = item.question;
  const isTrue = rng() < 0.5;
  const wrong = [0, 1, 2, 3].filter((i) => i !== q.answerIndex);
  const shownIndex = isTrue ? q.answerIndex : wrong[Math.floor(rng() * wrong.length) % wrong.length];
  return { item, shown: q.choices[shownIndex], isTrue };
}

/** Whether a true/false answer is right. */
export function judgeTrueFalse(card: TrueFalseCard, saidTrue: boolean): boolean {
  return card.isTrue === saidTrue;
}
