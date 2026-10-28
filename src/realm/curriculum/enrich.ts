/** Adds UniGame's built-in question banks and key terms to subjects that have them. */

import { builtInBank } from "./banks/latrobeBanks";
import type { RealmKeyTerm, RealmSubject } from "../types";

export function enrichWithBank(subject: RealmSubject): RealmSubject {
  const bank = builtInBank(subject.code, subject.name, subject.id);
  if (!bank) return subject;
  const haveIds = new Set(subject.questions.map((q) => q.id));
  const havePrompts = new Set(subject.questions.map((q) => q.prompt.toLowerCase()));
  const extraQuestions = bank.questions.filter((q) => !haveIds.has(q.id) && !havePrompts.has(q.prompt.toLowerCase()));
  const haveTerms = new Set(subject.keyTerms.map((t) => t.term.toLowerCase()));
  const extraTerms = bank.keyTerms.filter((t) => !haveTerms.has(t.term.toLowerCase()));
  // Terms saved before they had a week pick it up from the bank.
  const bankWeeks = new Map(bank.keyTerms.filter((t) => t.week !== undefined).map((t) => [t.term.toLowerCase(), t.week]));
  const needsWeek = (t: RealmKeyTerm) => t.week === undefined && bankWeeks.has(t.term.toLowerCase());
  const backfill = subject.keyTerms.some(needsWeek);
  if (extraQuestions.length === 0 && extraTerms.length === 0 && !backfill) return subject;
  const keyTerms = backfill ? subject.keyTerms.map((t) => (needsWeek(t) ? { ...t, week: bankWeeks.get(t.term.toLowerCase()) } : t)) : subject.keyTerms;
  return { ...subject, questions: [...subject.questions, ...extraQuestions], keyTerms: [...keyTerms, ...extraTerms] };
}

/** True when a subject could gain material from the built-in banks. */
export function needsBank(subject: RealmSubject): boolean {
  return enrichWithBank(subject) !== subject;
}
