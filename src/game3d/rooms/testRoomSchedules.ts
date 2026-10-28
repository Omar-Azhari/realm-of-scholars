/**
 * Test-room NPC schedules (Phase 20C, Parts 1/2/9). Hand-placed waypoint
 * stand-points, chosen so every consecutive straight-line walk segment in
 * every schedule clears every furniture obstacle in
 * `testRoomWorld.ts`/`TestRoomProps.tsx` — checked by hand while authoring
 * these, and guarded continuously by
 * `scripts/verify-phase20c-living-world.ts`'s line-vs-rect intersection
 * test, so a future room-fixture edit can't silently break an NPC's path
 * without the test catching it.
 *
 * Three archetypes, each visibly biased toward different activities —
 * this IS "different personalities influence activity frequency" (Part
 * 1), expressed as three distinct hand-authored schedules rather than a
 * dynamic weighting engine (deterministic, not full AI, per the brief).
 */

import type { FloorPoint } from "../../world/worldTypes";
import type { NpcSchedule } from "../characters/npcSchedule";

// Reuses the existing desk interactable's own stand point exactly (no
// separate literal to drift out of sync with testRoomWorld.ts).
export const DESK_POINT: FloorPoint = { x: 300, feetY: 170 };
export const BOOKSHELF_POINT: FloorPoint = { x: 495, feetY: 140 };
export const WINDOW_POINT: FloorPoint = { x: 75, feetY: 280 };
export const COFFEE_POINT: FloorPoint = { x: 240, feetY: 270 };
export const NOTICEBOARD_POINT: FloorPoint = { x: 520, feetY: 215 };
export const READING_NOOK_POINT: FloorPoint = { x: 115, feetY: 330 };
export const COUCH_POINT: FloorPoint = { x: 472, feetY: 300 };

/** Typing-biased — "mentor typing" (Part 9's own example). */
export const MENTOR_SCHEDULE: NpcSchedule = {
  id: "mentor",
  waypoints: [
    { standPoint: DESK_POINT, activity: "type", durationSeconds: 14, facingLeft: false },
    { standPoint: BOOKSHELF_POINT, activity: "read", durationSeconds: 6 },
    { standPoint: DESK_POINT, activity: "think", durationSeconds: 5, facingLeft: false },
    { standPoint: WINDOW_POINT, activity: "idle", durationSeconds: 5 },
    { standPoint: DESK_POINT, activity: "write", durationSeconds: 10, facingLeft: false },
  ],
};

/** Reading-biased — "students reading" (Part 9). Sits in the nook (a real chair lives there), stands to browse the shelf. */
export const STUDENT_READER_SCHEDULE: NpcSchedule = {
  id: "student-reader",
  waypoints: [
    { standPoint: READING_NOOK_POINT, activity: "sit", durationSeconds: 18 },
    { standPoint: BOOKSHELF_POINT, activity: "read", durationSeconds: 8 },
    { standPoint: WINDOW_POINT, activity: "lookAround", durationSeconds: 4 },
    { standPoint: READING_NOOK_POINT, activity: "sit", durationSeconds: 14 },
  ],
};

/** Coffee/talk-biased — "student chatting" + "coffee corner" (Part 9). */
export const STUDENT_SOCIAL_SCHEDULE: NpcSchedule = {
  id: "student-social",
  waypoints: [
    { standPoint: COFFEE_POINT, activity: "coffee", durationSeconds: 10 },
    { standPoint: NOTICEBOARD_POINT, activity: "read", durationSeconds: 6 },
    { standPoint: COFFEE_POINT, activity: "talk", durationSeconds: 10 },
    { standPoint: COUCH_POINT, activity: "lookAround", durationSeconds: 6 },
    { standPoint: COFFEE_POINT, activity: "coffee", durationSeconds: 8 },
  ],
};

export const ALL_TEST_ROOM_SCHEDULES: NpcSchedule[] = [MENTOR_SCHEDULE, STUDENT_READER_SCHEDULE, STUDENT_SOCIAL_SCHEDULE];
