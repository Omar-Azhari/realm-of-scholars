/**
 * Secret doors: hidden around the wilds, each sealed by a password — a key
 * term from your own subjects. The door shows the term's definition; type
 * the term to open it (typing it from memory is harder, and better practice,
 * than picking it from a list). Inside: coins and a page of academy lore.
 */

import { realmStore } from "./store";
import { chat, emit } from "./events";
import { addCoinsPublic } from "./actions";
import { bumpCounter } from "./stats";
import type { RealmKeyTerm, RealmState } from "../types";

export const SECRET_COINS = 120;

export const LORE = [
  "The founders hid these rooms so that only those who truly knew their craft could find them. Most students walk past them for years.",
  "Long ago the academy's first scholars wrote every lesson on the stones themselves. The words faded, but the doors still remember.",
  "The floating candles were a dare: an alchemy student bet she could make wax forget gravity. She won, and nobody has ever relit them.",
  "The owls choose who they deliver to. They have never once been late with a deadline, which some find comforting and others do not.",
  "The four houses were founded after an argument about whether it is better to be bold, curious, steadfast or clever. It has not been settled.",
];

export interface Riddle {
  doorId: string;
  subjectId: string;
  subjectName: string;
  term: RealmKeyTerm;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The door's password today: a key term from one of your subjects (it changes daily). */
export function riddleFor(state: RealmState, doorId: string, day: string): Riddle | null {
  const pool = (state.curriculum?.subjects ?? []).flatMap((s) => s.keyTerms.filter((t) => t.term.trim().length > 2 && t.definition.trim().length > 10).map((t) => ({ s, t })));
  if (pool.length === 0) return null;
  const pick = pool[hash(`${doorId}:${day}`) % pool.length];
  return { doorId, subjectId: pick.s.id, subjectName: pick.s.name, term: pick.t };
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

/** Right if it matches the term, allowing a small typo (1 letter per 6). */
export function checkPassword(term: string, guess: string): boolean {
  const a = normalise(term);
  const b = normalise(guess);
  if (!b) return false;
  if (a === b) return true;
  return distance(a, b) <= Math.floor(a.length / 6);
}

/** A hint: the first letters and the length of each word. */
export function passwordHint(term: string, shown = 1): string {
  return term
    .split(/\s+/)
    .map((w) => w.slice(0, shown) + "·".repeat(Math.max(0, w.length - shown)))
    .join(" ");
}

export function isOpen(state: RealmState, doorId: string): boolean {
  return Boolean(state.progress.secrets[doorId]);
}

/** Opens a door for good and pays out. Returns the lore page shown. */
export function openSecret(doorId: string): string {
  const state = realmStore.get();
  const page = LORE[(Object.keys(state.progress.secrets).length + hash(doorId)) % LORE.length];
  if (isOpen(state, doorId)) return page;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, secrets: { ...s.progress.secrets, [doorId]: new Date().toISOString() } } }));
  addCoinsPublic(SECRET_COINS);
  bumpCounter("secrets");
  emit({ type: "sound", name: "victory" });
  chat(`The door grinds open. Inside: ${SECRET_COINS} coins and a page of old lore.`, "quest");
  return page;
}
