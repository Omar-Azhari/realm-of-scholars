/**
 * Lexicon: a Wordle-style puzzle on the subject's key terms. The clue is the
 * term's definition (with the term itself blanked out); each guess colours
 * its letters: right place, in the word elsewhere, or not in the word.
 */

import type { RealmKeyTerm, RealmSubject } from "../types";
import { between, hashString, seededRng, shuffleWith } from "./rng";
import { rivalSkill } from "./rating";

export type LetterMark = "hit" | "near" | "miss";

export const LEXICON_MAX_GUESSES = 6;
export const LEXICON_MIN_LETTERS = 4;
export const LEXICON_MAX_LETTERS = 14;

export interface LexiconPuzzle {
  /** The term as written, e.g. "Fitts's law". */
  term: string;
  /** Letters only, upper case: "FITTSSLAW". */
  letters: string;
  /** Letter count of each word, for the board's gaps: [6, 3]. */
  words: number[];
  /** The definition with the term's words blanked out. */
  clue: string;
}

/** Upper-case letters only. */
export function lettersOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Feedback for one guess, Wordle rules: exact matches first; then each other
 * guessed letter is "near" only while unmatched copies of it remain in the
 * answer, so repeated letters are never over-counted.
 */
export function lexiconFeedback(answer: string, guess: string): LetterMark[] {
  const a = lettersOf(answer);
  const g = lettersOf(guess);
  const marks: LetterMark[] = Array.from({ length: g.length }, () => "miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = "hit";
    else left[a[i]] = (left[a[i]] ?? 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === "hit") continue;
    if ((left[g[i]] ?? 0) > 0) {
      marks[i] = "near";
      left[g[i]]--;
    }
  }
  return marks;
}

/** The best mark seen for each letter across guesses (for the on-screen keyboard). */
export function keyboardMarks(answer: string, guesses: string[]): Record<string, LetterMark> {
  const rank: Record<LetterMark, number> = { miss: 0, near: 1, hit: 2 };
  const out: Record<string, LetterMark> = {};
  for (const guess of guesses) {
    const marks = lexiconFeedback(answer, guess);
    lettersOf(guess)
      .split("")
      .forEach((ch, i) => {
        if (out[ch] === undefined || rank[marks[i]] > rank[out[ch]]) out[ch] = marks[i];
      });
  }
  return out;
}

/** Terms that make fair puzzles: plain words (letters, spaces, hyphens, apostrophes), 4-14 letters. */
export function lexiconTerms(subject: RealmSubject): RealmKeyTerm[] {
  const seen = new Set<string>();
  return subject.keyTerms.filter((t) => {
    const letters = lettersOf(t.term);
    if (!/^[\p{L}][\p{L} '’-]*$/u.test(t.term.trim()) || letters.length < LEXICON_MIN_LETTERS || letters.length > LEXICON_MAX_LETTERS) return false;
    if (!t.definition || t.definition.trim().length < 8 || seen.has(letters)) return false;
    seen.add(letters);
    return true;
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hides the term's words (and simple plurals) in its own definition so the clue doesn't give it away. */
export function maskTerm(definition: string, term: string): string {
  let clue = definition;
  const words = term.split(/[\s-]+/).filter((w) => w.replace(/[^\p{L}]/gu, "").length >= 3);
  for (const word of [term, ...words]) {
    clue = clue.replace(new RegExp(`\\b${escapeRegExp(word)}(e?s)?\\b`, "gi"), "▁▁▁");
  }
  return clue;
}

export function makePuzzle(term: RealmKeyTerm): LexiconPuzzle {
  return {
    term: term.term.trim(),
    letters: lettersOf(term.term),
    words: term.term
      .trim()
      .split(/[\s-]+/)
      .map((w) => lettersOf(w).length)
      .filter((n) => n > 0),
    clue: maskTerm(term.definition.trim(), term.term.trim()),
  };
}

/** Today's puzzle for a subject: the same for everyone on the same date. */
export function dailyLexicon(subject: RealmSubject, date: string): LexiconPuzzle | null {
  const terms = lexiconTerms(subject);
  if (terms.length === 0) return null;
  const order = shuffleWith(terms, seededRng(`lexicon|${subject.code || subject.name}|${subject.id}`));
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return makePuzzle(order[((day % order.length) + order.length) % order.length]);
}

/** A practice puzzle (unranked), avoiding today's daily when there's a choice. */
export function practiceLexicon(subject: RealmSubject, rng: () => number, avoid?: string): LexiconPuzzle | null {
  const terms = lexiconTerms(subject);
  const pool = terms.length > 1 && avoid ? terms.filter((t) => lettersOf(t.term) !== avoid) : terms;
  if (pool.length === 0) return null;
  return makePuzzle(pool[Math.floor(rng() * pool.length)]);
}

/** Score: fewer guesses count most, then speed. Unsolved scores 0. */
export function lexiconScore(solvedIn: number | null, seconds: number): number {
  if (solvedIn === null || solvedIn < 1 || solvedIn > LEXICON_MAX_GUESSES) return 0;
  return (LEXICON_MAX_GUESSES + 1 - solvedIn) * 100 + Math.max(0, Math.round(120 - seconds));
}

/** How a rival does on the same puzzle: stronger rivals know more terms outright. */
export function rivalLexicon(rating: number, seed: string): { solvedIn: number | null; seconds: number; score: number } {
  const rng = seededRng(hashString(seed));
  const s = rivalSkill(rating);
  let solvedIn: number | null = null;
  for (let g = 1; g <= LEXICON_MAX_GUESSES; g++) {
    const chance = 0.12 + 0.55 * s + 0.1 * (g - 1);
    if (rng() < chance) {
      solvedIn = g;
      break;
    }
  }
  const seconds = Math.round((solvedIn ?? LEXICON_MAX_GUESSES) * (26 - 14 * s) * between(rng, 0.7, 1.3));
  return { solvedIn, seconds, score: lexiconScore(solvedIn, seconds) };
}
