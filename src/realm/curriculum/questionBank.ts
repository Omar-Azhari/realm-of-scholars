/**
 * Builds the question pool a mini-game draws from. Prefers the subject's
 * own researched practice questions; tops up with questions generated
 * deterministically from its key terms and weekly topics so every subject
 * always has enough material to play with, even a hand-entered one.
 */

import type { RealmKeyTerm, RealmQuestion, RealmSubject } from "../types";

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractors<T>(pool: T[], exclude: T, count: number): T[] {
  return shuffle(pool.filter((item) => item !== exclude)).slice(0, count);
}

function termQuestions(subject: RealmSubject): RealmQuestion[] {
  const terms = subject.keyTerms;
  if (terms.length < 4) return [];
  const questions: RealmQuestion[] = [];
  terms.forEach((term: RealmKeyTerm, index) => {
    const others = pickDistractors(terms, term, 3);
    if (index % 2 === 0) {
      const choices = shuffle([term.term, ...others.map((o) => o.term)]);
      questions.push({
        id: `${subject.id}-gt${index}`,
        prompt: `Which term matches this description? "${term.definition}"`,
        choices,
        answerIndex: choices.indexOf(term.term),
        explanation: `${term.term}: ${term.definition}`,
        week: null,
      });
    } else {
      const choices = shuffle([term.definition, ...others.map((o) => o.definition)]);
      questions.push({
        id: `${subject.id}-gd${index}`,
        prompt: `What best describes "${term.term}"?`,
        choices,
        answerIndex: choices.indexOf(term.definition),
        explanation: `${term.term}: ${term.definition}`,
        week: null,
      });
    }
  });
  return questions;
}

function weekQuestions(subject: RealmSubject): RealmQuestion[] {
  const weeks = subject.weeks.filter((w) => w.title);
  if (weeks.length < 4) return [];
  return weeks.map((week) => {
    const others = pickDistractors(weeks, week, 3);
    const choices = shuffle([week.title, ...others.map((o) => o.title)]);
    return {
      id: `${subject.id}-gw${week.week}`,
      prompt: `In the ${subject.name} course plan, which topic is studied in Week ${week.week}?`,
      choices,
      answerIndex: choices.indexOf(week.title),
      explanation: `Week ${week.week}: ${week.title}${week.summary ? `. ${week.summary}` : ""}`,
      week: week.week,
    };
  });
}

/**
 * Questions for a duel.
 * - Trial at a waystone (week given): that week's questions first, then earlier weeks.
 * - Exam duel (no week): harder questions first, across the whole subject.
 * Real curriculum questions always win; generated "which week" questions are only
 * used when a subject has almost no real material.
 */
export function buildQuestionPool(subject: RealmSubject, week: number | null = null): RealmQuestion[] {
  const real = subject.questions;
  const fromTerms = termQuestions(subject);
  let pool: RealmQuestion[];
  if (real.length >= 8) pool = [...real, ...shuffle(fromTerms).slice(0, 3)];
  else pool = [...real, ...fromTerms, ...weekQuestions(subject)];

  if (week !== null) {
    const thisWeek = shuffle(pool.filter((q) => q.week === week));
    const earlier = shuffle(pool.filter((q) => q.week !== null && q.week < week));
    const other = shuffle(pool.filter((q) => q.week === null || q.week > week));
    return [...thisWeek, ...earlier, ...other];
  }
  const weight = (q: RealmQuestion) => (q.difficulty ?? 2) + Math.random() * 1.2;
  return pool.map((q) => ({ q, w: weight(q) })).sort((a, b) => b.w - a.w).map((x) => x.q);
}

/** Key terms for matching/scramble games — falls back to week titles when a subject has no glossary. */
export function buildTermPool(subject: RealmSubject): RealmKeyTerm[] {
  if (subject.keyTerms.length >= 4) return shuffle(subject.keyTerms);
  const fromWeeks = subject.weeks.map((w) =>
    w.topics.length > 0
      ? { term: w.topics[0], definition: `Covered in Week ${w.week}: ${w.title}` }
      : { term: w.title, definition: `The Week ${w.week} topic${w.summary ? `: ${w.summary}` : ""}` },
  );
  return shuffle([...subject.keyTerms, ...fromWeeks]);
}
