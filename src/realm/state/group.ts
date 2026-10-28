/**
 * Study group without a server: each player copies a short share code of
 * their progress and pastes in their classmates' codes. The leaderboard
 * compares subjects with the same code. Codes are a snapshot — paste a new
 * one to update a classmate. They hold only a display name, university,
 * teaching period, subject levels, quest points and streak (plus house
 * points and, in newer codes, Arena ratings and personal bests per game).
 */

import { realmStore } from "./store";
import { chat } from "./events";
import { liveStreak } from "./actions";
import { levelForXp } from "../xp";
import type { GroupMember, RealmState } from "../types";
import { HOUSES, yourHousePoints } from "../customise/houses";
import { ARENA_GAME_IDS, isArenaGame, MAX_RATING, MAX_SCORE, MIN_RATING } from "../arena/save";
import { seasonId } from "../arena/rating";

const PREFIX = "SCHOLAR1-";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function memberFromState(state: RealmState): GroupMember | null {
  if (!state.player || !state.curriculum) return null;
  const levels: Record<string, number> = {};
  let totalLevel = 0;
  for (const subject of state.curriculum.subjects) {
    const level = levelForXp(state.progress.skillXp[subject.id] ?? 0);
    levels[(subject.code || subject.name).toUpperCase().slice(0, 30)] = level;
    totalLevel += level;
  }
  const e = state.curriculum.enrolment;
  return {
    name: state.player.name.slice(0, 40),
    university: e.university.slice(0, 80),
    period: `${e.teachingPeriod} ${e.year}`.slice(0, 40),
    levels,
    totalLevel,
    questPoints: state.progress.questPoints,
    streak: liveStreak(state),
    sharedAt: new Date().toISOString(),
    house: state.player.house,
    housePoints: yourHousePoints(state),
    ...arenaSummary(state),
  };
}

/** Arena ratings and bests for the games you've played (ranked games only). */
function arenaSummary(state: RealmState): Pick<GroupMember, "arena" | "arenaSeason"> {
  const arena: NonNullable<GroupMember["arena"]> = {};
  for (const id of ARENA_GAME_IDS) {
    const r = state.progress.arena.games[id];
    if (r && r.games > 0) arena[id] = { rating: r.rating, best: r.best };
  }
  return Object.keys(arena).length > 0 ? { arena, arenaSeason: seasonId() } : {};
}

export function makeShareCode(state: RealmState): string | null {
  const member = memberFromState(state);
  if (!member) return null;
  const compact: unknown[] = [member.name, member.university, member.period, member.levels, member.totalLevel, member.questPoints, member.streak, member.sharedAt, member.house ?? "", member.housePoints ?? 0];
  // Slot 10 (newer codes): { s: season, g: { game: [rating, best] } }. Older parsers ignore extra slots.
  if (member.arena) {
    const g: Record<string, [number, number]> = {};
    for (const [id, v] of Object.entries(member.arena)) if (v) g[id] = [v.rating, v.best];
    compact.push({ s: member.arenaSeason ?? "", g });
  }
  return PREFIX + toBase64Url(JSON.stringify(compact));
}

const int = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Reads slot 10 of a share code; anything malformed is ignored, never fatal. */
function parseArena(raw: unknown): Pick<GroupMember, "arena" | "arenaSeason"> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  if (typeof r.g !== "object" || r.g === null || Array.isArray(r.g)) return {};
  const arena: NonNullable<GroupMember["arena"]> = {};
  for (const [id, v] of Object.entries(r.g as Record<string, unknown>)) {
    if (!isArenaGame(id) || !Array.isArray(v) || typeof v[0] !== "number" || !Number.isFinite(v[0])) continue;
    arena[id] = { rating: Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(v[0]))), best: int(v[1], MAX_SCORE) };
  }
  if (Object.keys(arena).length === 0) return {};
  return { arena, arenaSeason: typeof r.s === "string" && /^\d{4}-W\d{2}$/.test(r.s) ? r.s : undefined };
}

/** Parses and validates a share code. Returns null for anything malformed. */
export function parseShareCode(code: string): GroupMember | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX) || trimmed.length > 4000) return null;
  try {
    const data = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length))) as unknown;
    if (!Array.isArray(data) || data.length < 8) return null;
    const [name, university, period, levelsRaw, totalLevel, questPoints, streak, sharedAt, house, housePoints, arenaRaw] = data;
    if (typeof name !== "string" || !name.trim() || typeof levelsRaw !== "object" || levelsRaw === null || Array.isArray(levelsRaw)) return null;
    const levels: Record<string, number> = {};
    for (const [key, value] of Object.entries(levelsRaw as Record<string, unknown>).slice(0, 12)) levels[key.slice(0, 30)] = Math.max(1, int(value, 99));
    return {
      name: str(name, 40),
      university: str(university, 80),
      period: str(period, 40),
      levels,
      totalLevel: int(totalLevel, 99 * 12),
      questPoints: int(questPoints, 1000),
      streak: int(streak, 3650),
      sharedAt: typeof sharedAt === "string" && !Number.isNaN(Date.parse(sharedAt)) ? sharedAt : new Date(0).toISOString(),
      house: typeof house === "string" && HOUSES.some((h) => h.id === house) ? house : undefined,
      housePoints: house ? int(housePoints, 10_000_000) : undefined,
      ...parseArena(arenaRaw),
    };
  } catch {
    return null;
  }
}

export function memberKey(member: GroupMember): string {
  return `${member.name.toLowerCase()}|${member.university.toLowerCase()}`;
}

export function addGroupMember(code: string): GroupMember | null {
  const member = parseShareCode(code);
  if (!member) {
    chat("That isn't a valid study-group code.");
    return null;
  }
  const own = memberFromState(realmStore.get());
  if (own && memberKey(own) === memberKey(member)) {
    chat("That's your own code. Share it with your classmates instead.");
    return null;
  }
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, group: { ...s.progress.group, [memberKey(member)]: member } } }));
  chat(`${member.name} joined your study group.`);
  return member;
}

export function removeGroupMember(key: string): void {
  realmStore.set((s) => {
    const group = { ...s.progress.group };
    delete group[key];
    return { ...s, progress: { ...s.progress, group } };
  });
}

export interface LeaderRow {
  name: string;
  you: boolean;
  level: number;
}

/** Ranked rows for one subject code (members who don't take it are left out). */
export function subjectLeaderboard(state: RealmState, code: string): LeaderRow[] {
  const own = memberFromState(state);
  const rows: LeaderRow[] = [];
  if (own && own.levels[code] !== undefined) rows.push({ name: own.name, you: true, level: own.levels[code] });
  for (const member of Object.values(state.progress.group)) {
    if (member.levels[code] !== undefined) rows.push({ name: member.name, you: false, level: member.levels[code] });
  }
  return rows.sort((a, b) => b.level - a.level || Number(b.you) - Number(a.you));
}
