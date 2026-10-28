import type { QuestionKind, RealmKeyTerm } from "../../../types";
import type { BankQuestion } from "../latrobeBanks";

/**
 * Extra questions (banks/extra/*.ts), appended after the originals so the original ids (-b1, -b2, ...) never move.
 * Same as a bank question plus an optional typed kind. For typed kinds `correct` is the canonical answer and
 * `wrong` still holds three plausible options for multiple-choice modes.
 */
export interface ExtraQuestion extends BankQuestion {
  kind?: QuestionKind;
  accept?: string[];
  tolerance?: number;
  unit?: string;
  workedExample?: string;
}

export function x(week: number, difficulty: 1 | 2 | 3, prompt: string, correct: string, wrong: [string, string, string], explanation: string, extra: Omit<ExtraQuestion, keyof BankQuestion> = {}): ExtraQuestion {
  return { week, difficulty, prompt, correct, wrong, explanation, ...extra };
}


/** A week-tagged key term (banks/extra/*.ts): kt(week, term, definition). One clear sentence, no em dashes. */
export function kt(week: number, term: string, definition: string): RealmKeyTerm {
  return { term, definition, week };
}
