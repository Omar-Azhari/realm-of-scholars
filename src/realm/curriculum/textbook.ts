/**
 * The enchanted textbook: turns the text of a lecture (PDF, slides, notes)
 * into a summary scroll, flashcards and a quiz, entirely on this device.
 *
 *  - Flashcards: lines shaped like a definition ("Term: meaning",
 *    "Term – meaning", "Term is/means/refers to …").
 *  - Summary: the sentences that share the most important words with the
 *    whole text, kept in their original order.
 *  - Quiz: "which term matches this definition?" with the other cards'
 *    terms as the wrong answers.
 */

import type { RealmKeyTerm, RealmQuestion } from "../types";

export interface Textbook {
  summary: string[];
  cards: RealmKeyTerm[];
  quiz: RealmQuestion[];
}

const STOP = new Set(
  "the a an and or of to in on for with is are was were be been by as at it this that these those from into about can will may not no which what who how why when where your you we our their they its than then also such use used using each other more most some any all one two".split(
    " ",
  ),
);

function clean(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

/** Definition-shaped lines become flashcards. */
export function extractCards(text: string, max = 24): RealmKeyTerm[] {
  const out: RealmKeyTerm[] = [];
  const seen = new Set<string>();
  const add = (term: string, definition: string) => {
    const t = clean(term).replace(/^[•\-*\d.)\s]+/, "");
    const d = clean(definition).replace(/[.;:,\s]+$/, "");
    if (t.length < 3 || t.length > 48 || t.split(" ").length > 6) return;
    if (d.length < 12 || d.length > 240) return;
    if (/^(slide|page|week|lecture|figure|table)\b/i.test(t)) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ term: t, definition: d.charAt(0).toUpperCase() + d.slice(1) });
  };
  for (const raw of text.split(/\n+/)) {
    const line = clean(raw);
    if (line.length < 16) continue;
    let m = line.match(/^(.{3,48}?)\s*[:–—-]\s+(.{12,})$/);
    if (m) {
      add(m[1], m[2]);
      continue;
    }
    m = line.match(/^(?:an?\s+|the\s+)?([A-Z][\w'()\s/-]{2,46}?)\s+(?:is|are|means|refers to|is defined as|describes)\s+(.{12,})$/);
    if (m) add(m[1], m[2]);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/** The most representative sentences, in reading order. */
export function summarise(text: string, sentences = 6): string[] {
  const all = clean(text.replace(/\n+/g, " "))
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 320);
  if (all.length === 0) return [];
  const freq = new Map<string, number>();
  const words = (s: string) => s.toLowerCase().match(/[a-z][a-z'-]{2,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  for (const s of all) for (const w of words(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = all.map((s, i) => {
    const ws = words(s);
    const score = ws.reduce((n, w) => n + (freq.get(w) ?? 0), 0) / Math.max(4, ws.length);
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, sentences)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

/** "Which term matches…?" questions; needs at least four cards. */
export function quizFromCards(cards: RealmKeyTerm[], idPrefix: string, week: number | null, random: () => number = Math.random): RealmQuestion[] {
  if (cards.length < 4) return [];
  return cards.map((card, i) => {
    const others = cards.filter((c) => c !== card).sort(() => random() - 0.5).slice(0, 3).map((c) => c.term);
    const choices = [...others];
    const answerIndex = Math.floor(random() * 4);
    choices.splice(answerIndex, 0, card.term);
    return {
      id: `${idPrefix}${i}`,
      prompt: `Which term matches: “${card.definition}”?`,
      choices,
      answerIndex,
      explanation: `${card.term}: ${card.definition}.`,
      week,
      difficulty: 2 as const,
    };
  });
}

export function enchant(text: string, idPrefix: string, week: number | null): Textbook {
  const cards = extractCards(text);
  return { summary: summarise(text), cards, quiz: quizFromCards(cards, idPrefix, week) };
}
