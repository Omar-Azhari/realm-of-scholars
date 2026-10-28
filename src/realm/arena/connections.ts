/**
 * Connections: sixteen tiles from four weeks of a subject (lecture slide
 * headings, weekly topics, key terms) to sort into their four weeks.
 */

import type { RealmSubject } from "../types";
import type { SubjectLectures } from "../curriculum/banks/lectures/types";
import { LECTURE_BANKS } from "../curriculum/banks/lectures";
import { between, hashString, seededRng, shuffleWith } from "./rng";
import { rivalSkill } from "./rating";

export const CONNECTIONS_GROUPS = 4;
export const CONNECTIONS_GROUP_SIZE = 4;
export const CONNECTIONS_MAX_MISTAKES = 4;
const MAX_TILE_CHARS = 46;

export interface ConnectionsTile {
  id: string;
  text: string;
  /** Index into `groups`. */
  group: number;
}

export interface ConnectionsGroup {
  week: number;
  label: string;
}

export interface ConnectionsPuzzle {
  groups: ConnectionsGroup[];
  /** All sixteen tiles, shuffled. */
  tiles: ConnectionsTile[];
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stems = (t: string) => norm(t).split(" ").filter((w) => w.length >= 4).map((w) => w.slice(0, 6));
/** Normalised text without a leading article. */
const core = (t: string) => norm(t).replace(/^(the|a|an) /, "");
/** Same idea: equal, or one contains the other as whole words (and isn't a tiny word). */
function overlaps(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 6 && ` ${long} `.includes(` ${short} `);
}

/** The ready-made lecture for this subject's week, only if it really teaches the same topic (same check the theatre uses). */
export function bankLectureFor(subject: RealmSubject, week: number, banks: SubjectLectures[] = LECTURE_BANKS) {
  const w = subject.weeks.find((x) => x.week === week);
  const lec = banks.find((b) => b.match(subject.code, subject.name))?.weeks[week];
  if (!w || !lec) return null;
  const ours = new Set(stems(`${w.title} ${w.topics.join(" ")} ${w.summary}`));
  return stems(`${lec.title} ${lec.segments.map((s) => s.heading).join(" ")}`).some((x) => ours.has(x)) ? lec : null;
}

/** Candidate tile texts for one week, best first: slide headings, topics, then key terms that week's material mentions. */
export function weekTileCandidates(subject: RealmSubject, week: number, banks: SubjectLectures[] = LECTURE_BANKS): string[] {
  const w = subject.weeks.find((x) => x.week === week);
  if (!w) return [];
  const out: string[] = [];
  const lec = bankLectureFor(subject, week, banks);
  if (lec) out.push(...lec.segments.map((s) => s.heading));
  out.push(...w.topics);
  const material = norm(`${w.title} ${w.topics.join(" ")} ${w.summary} ${subject.questions.filter((q) => q.week === week).map((q) => `${q.prompt} ${q.explanation}`).join(" ")}`);
  for (const t of subject.keyTerms) {
    const n = norm(t.term);
    if (n.length >= 3 && ` ${material} `.includes(` ${n} `)) out.push(t.term);
  }
  const title = core(w.title);
  const seen = new Set<string>();
  return out
    .map((t) => t.trim().replace(/\s+/g, " "))
    .filter((t) => {
      const n = core(t);
      if (t.length < 3 || t.length > MAX_TILE_CHARS || !n || n === title || seen.has(n)) return false;
      seen.add(n);
      return true;
    });
}

/**
 * Builds a puzzle: four weeks with at least four tiles each that appear in
 * no other chosen week. Returns null when the subject lacks the material.
 */
export function buildConnections(subject: RealmSubject, rng: () => number, banks: SubjectLectures[] = LECTURE_BANKS): ConnectionsPuzzle | null {
  const all = subject.weeks.map((w) => ({ week: w.week, title: w.title, tiles: weekTileCandidates(subject, w.week, banks) }));
  // A text that fits several weeks is ambiguous ("The Double Diamond" in one week, "Double Diamond" in another): drop it everywhere.
  const ambiguous = new Set<string>();
  const flat = all.flatMap((w) => w.tiles.map((t) => ({ week: w.week, key: core(t) })));
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i].week !== flat[j].week && overlaps(flat[i].key, flat[j].key)) {
        ambiguous.add(flat[i].key);
        ambiguous.add(flat[j].key);
      }
    }
  }
  const usable = all.map((w) => ({ ...w, tiles: w.tiles.filter((t) => !ambiguous.has(core(t))) })).filter((w) => w.tiles.length >= CONNECTIONS_GROUP_SIZE);
  if (usable.length < CONNECTIONS_GROUPS) return null;
  const chosen = shuffleWith(usable, rng)
    .slice(0, CONNECTIONS_GROUPS)
    .sort((a, b) => a.week - b.week);
  const groups: ConnectionsGroup[] = chosen.map((w) => ({ week: w.week, label: `Week ${w.week}: ${w.title}` }));
  const tiles: ConnectionsTile[] = [];
  chosen.forEach((w, g) => {
    shuffleWith(w.tiles, rng)
      .slice(0, CONNECTIONS_GROUP_SIZE)
      .forEach((text, i) => tiles.push({ id: `${w.week}-${i}`, text, group: g }));
  });
  return { groups, tiles: shuffleWith(tiles, rng) };
}

/** Checks four selected tiles: the group they complete, or how many share the most common group ("one away" at 3). */
export function checkGroup(puzzle: ConnectionsPuzzle, tileIds: string[]): { group: number | null; best: number } {
  const picked = tileIds.map((id) => puzzle.tiles.find((t) => t.id === id)).filter((t): t is ConnectionsTile => Boolean(t));
  if (picked.length !== CONNECTIONS_GROUP_SIZE || new Set(tileIds).size !== CONNECTIONS_GROUP_SIZE) return { group: null, best: 0 };
  const counts = new Map<number, number>();
  for (const t of picked) counts.set(t.group, (counts.get(t.group) ?? 0) + 1);
  const [group, best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { group: best === CONNECTIONS_GROUP_SIZE ? group : null, best };
}

/** Score: each group found, a bonus for all four, minus mistakes, plus speed. */
export function connectionsScore(solved: number, mistakes: number, seconds: number): number {
  const full = solved === CONNECTIONS_GROUPS;
  return Math.max(0, solved * 250 + (full ? 300 : 0) - mistakes * 80 + (full ? Math.max(0, Math.round(240 - seconds)) * 2 : 0));
}

/** How a rival does on a puzzle like this. */
export function rivalConnections(rating: number, seed: string): { solved: number; mistakes: number; seconds: number; score: number } {
  const rng = seededRng(hashString(seed));
  const s = rivalSkill(rating);
  const mistakes = Math.max(0, Math.min(CONNECTIONS_MAX_MISTAKES, Math.round((1 - s) * 3.6 + between(rng, -1.2, 1.2))));
  const solved = mistakes >= CONNECTIONS_MAX_MISTAKES ? Math.floor(between(rng, 0, 3)) : CONNECTIONS_GROUPS;
  const seconds = Math.round((220 - 130 * s) * between(rng, 0.75, 1.25));
  return { solved, mistakes, seconds, score: connectionsScore(solved, mistakes, seconds) };
}
