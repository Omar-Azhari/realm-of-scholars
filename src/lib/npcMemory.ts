/**
 * Phase 21 Part 3 "Campus Memory" — recognition, not conversation. The
 * brief is explicit: "Do not implement long conversations. Implement
 * recognition." This module's entire job is answering one question: has
 * this NPC already spoken to the player today? If so, a short
 * acknowledgement replaces a fresh greeting — never a second full line,
 * never a scripted back-and-forth.
 *
 * Reads `NpcMemoryEntry` (`types/domain.ts`, Phase 21) — the one genuinely
 * stored piece of NPC state in this whole system; everything else
 * (Level/Trust/Familiarity/Mood) is derived fresh every time from real
 * save data (see `mentorRelationship.ts`/`npcRelationship.ts`).
 */

import { getMelbourneDateIso } from "./selectors";
import type { NpcMemoryEntry, UniGameSaveData } from "../types/domain";

const RECOGNITION_LINES = [
  "Back again — good.",
  "Twice in one day! Good to see you.",
  "You're keeping busy today.",
];

/** How many recent conversation topics an NPC remembers — small on purpose, just enough to avoid an immediate repeat, never a full transcript. */
export const MAX_RECENT_TOPICS = 5;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

/** The "never met this NPC" default — the single shared shape every reader/writer of `NpcMemoryEntry` falls back to, so a new field never needs updating in more than one place. */
export const DEFAULT_NPC_MEMORY: NpcMemoryEntry = {
  lastLine: null,
  lastLineDate: null,
  lastInteractionAt: null,
  recentTopics: [],
  flaggedAssessmentId: null,
  flaggedAssessmentAt: null,
  conversationCount: 0,
  adviceLog: [],
};

/** How many advice-log entries an NPC remembers — small on purpose, just enough for the "advice followed" heuristic, never a full history. */
export const MAX_ADVICE_LOG_ENTRIES = 20;

/** Reads an NPC's stored memory, defaulting to "never met" rather than throwing when absent. */
export function getNpcMemory(save: UniGameSaveData, npcKey: string): NpcMemoryEntry {
  return save.npcMemory[npcKey] ?? DEFAULT_NPC_MEMORY;
}

/** True when `topic` is among this NPC's last few conversation topics — Phase 23 "never repeat identical conversations." */
export function hasRecentlyUsedTopic(memory: NpcMemoryEntry, topic: string): boolean {
  return memory.recentTopics.includes(topic);
}

/** Appends `topic` to the memory's recent-topics list, capped and de-duplicated (a re-used topic moves to the most-recent slot rather than appearing twice). */
export function withRecordedTopic(memory: NpcMemoryEntry, topic: string): string[] {
  return [...memory.recentTopics.filter((t) => t !== topic), topic].slice(-MAX_RECENT_TOPICS);
}

/** True when this NPC has already said something to the player today (Melbourne calendar day). */
export function hasGreetedToday(memory: NpcMemoryEntry, now: Date = new Date()): boolean {
  return memory.lastLineDate === getMelbourneDateIso(now);
}

/**
 * If the NPC already spoke today, returns a short recognition line
 * INSTEAD of the caller's fresh line — deterministic per (npcKey, day),
 * never random. If this is the first interaction today, returns the
 * fresh line unchanged (recognition only ever shortens a REPEAT visit,
 * never replaces the first one).
 */
export function applyRecognition(freshLine: string, memory: NpcMemoryEntry, npcKey: string, now: Date = new Date()): string {
  if (!hasGreetedToday(memory, now)) return freshLine;
  const dayKey = getMelbourneDateIso(now);
  return RECOGNITION_LINES[hashString(`${npcKey}-${dayKey}`) % RECOGNITION_LINES.length];
}
