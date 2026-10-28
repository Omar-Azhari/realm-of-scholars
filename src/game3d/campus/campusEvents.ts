/**
 * Phase 21 Part 5 "Campus Events" — small, deterministic ambience only, no
 * quest system: "Library study group, Coffee break, Guest lecture, Career
 * fair, Coding workshop, Assignment help session" (the brief's own exact
 * list). One event is "on" campus-wide per calendar day, picked by a
 * date-hash — same rule as every other deterministic-per-day pick in this
 * codebase (`npcGreetings.ts`'s `pick`, `mentorDialogue.ts`'s voice
 * selection). It carries a single ambient sentence and a tagged building —
 * nothing mechanical reads it, nothing unlocks, nothing tracks it; it's
 * surfaced purely as one line in the Daily Brief (`DailyBriefPanel.tsx`).
 */

import { getMelbourneDateIso } from "../../lib/selectors";
import type { CampusSceneId } from "../../world/worldTypes";

export interface CampusEvent {
  id: string;
  title: string;
  buildingId: CampusSceneId;
  /** The one ambient sentence shown in the Daily Brief — never a call to action. */
  line: string;
}

const CAMPUS_EVENTS: CampusEvent[] = [
  { id: "library-study-group", title: "Library Study Group", buildingId: "library", line: "The Library's running a study group today." },
  { id: "coffee-break", title: "Coffee Break", buildingId: "student-lounge", line: "The Student Lounge is a bit livelier than usual — coffee break today." },
  { id: "guest-lecture", title: "Guest Lecture", buildingId: "lecture-theatre", line: "There's a guest lecture on in the Lecture Theatre today." },
  { id: "career-fair", title: "Career Fair", buildingId: "administration", line: "Administration's running a small careers fair today." },
  { id: "coding-workshop", title: "Coding Workshop", buildingId: "computer-lab", line: "The Computer Lab's hosting a coding workshop today." },
  { id: "assignment-help", title: "Assignment Help Session", buildingId: "computer-lab", line: "There's an assignment help session in the Computer Lab today." },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

/** The one campus event "on" today — deterministic per calendar day, never random. */
export function getTodaysCampusEvent(now: Date = new Date()): CampusEvent {
  const dayKey = getMelbourneDateIso(now);
  return CAMPUS_EVENTS[hashString(dayKey) % CAMPUS_EVENTS.length];
}
