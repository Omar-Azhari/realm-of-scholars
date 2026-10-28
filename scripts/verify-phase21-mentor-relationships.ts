/**
 * Phase 21 (Mentor Relationships, Living Campus & Academic Companion)
 * verification harness. Run with (from the repo root):
 *   npx tsx scripts/verify-phase21-mentor-relationships.ts
 *
 * Same discipline as every prior Phase 20 harness: only pure data/logic
 * modules with zero React/Three.js/R3F imports are ever imported directly.
 * For behaviour that only exists inside a React component's body (the
 * `waving` proximity override in `NpcCharacter.tsx`/`CampusBuildingScene.tsx`,
 * the read-only Player Journal screen, the Menu's new "Memories" sub-tab
 * wiring), this harness reads the actual source text and asserts on it — a
 * deliberate, disclosed trade-off: it proves the wiring exists in the code
 * as written, not that it behaves correctly at runtime (no DOM/R3F test
 * environment exists in this harness style, the same honest limitation
 * every prior Phase 20 harness/completion report already discloses).
 *
 * This harness covers ONLY Phase 21's own new surface area — the full
 * regression sweep (typecheck, lint, build, all six Phase 20 harnesses) is
 * run separately, exactly as every prior phase has done.
 */

import { readFileSync } from "node:fs";
import { computeMentorRelationship, LEVEL_THRESHOLDS } from "../src/lib/mentorRelationship";
import {
  computeTrust,
  computeFamiliarity,
  getMentorMood,
  getGuideMood,
  getUnlockedDialogueTopics,
  buildSubjectMentorRelationshipView,
} from "../src/lib/npcRelationship";
import { computeSubjectSimState } from "../src/lib/simulation";
import { getNpcMemory, hasGreetedToday, applyRecognition } from "../src/lib/npcMemory";
import { getDailyMentorInsight } from "../src/game3d/campus/dailyMentorInsights";
import { getTodaysCampusEvent } from "../src/game3d/campus/campusEvents";
import { getCampusAtmosphere, getCampusSeason } from "../src/game3d/campus/campusAtmosphere";
import { CAMPUS_LOCATIONS } from "../src/game3d/campus/campusMap";
import { LIBRARY_WORLD, LIBRARY_NPCS } from "../src/game3d/campus/library/LibraryScene";
import { STUDENT_LOUNGE_WORLD, STUDENT_LOUNGE_NPCS } from "../src/game3d/campus/studentLounge/StudentLoungeScene";
import { getScheduleState, scheduleCycleDuration } from "../src/game3d/characters/npcSchedule";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import { confirmed, unconfirmed } from "../src/types/domain";
import { getMelbourneDateIso, shiftDateIso } from "../src/lib/selectors";
import type { SceneWorld } from "../src/world/worldTypes";
import type { UniGameSaveData } from "../src/types/domain";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`  ok   - ${name}`);
  } else {
    failed++;
    failures.push(detail ? `${name} :: ${detail}` : name);
    console.log(`  FAIL - ${name}${detail ? " :: " + detail : ""}`);
  }
}

function section(name: string, fn: () => void): void {
  console.log(`\n=== ${name} ===`);
  try {
    fn();
  } catch (error) {
    failed++;
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    failures.push(`${name} threw :: ${detail}`);
    console.log(`  FAIL - section threw: ${detail}`);
  }
}

function src(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function inAnyObstacle(point: { x: number; feetY: number }, world: SceneWorld): boolean {
  return world.obstacles.some((o) => point.x >= o.xMin && point.x <= o.xMax && point.feetY >= o.feetMin && point.feetY <= o.feetMax);
}

const SUBJECTS = createDefaultSaveData().semester.subjects;
const UI_SUBJECT = SUBJECTS.find((s) => s.id === "user-interface-design")!;
const CLOUD_SUBJECT = SUBJECTS.find((s) => s.id === "cloud-based-web-application-development")!;

function main(): void {
  // -------------------------------------------------------------------------
  section("1. Relationship architecture (Part 1) — Trust/Familiarity/Mood/Topics", () => {
    const save = createDefaultSaveData();
    const relationship = computeMentorRelationship(save, UI_SUBJECT);

    const trust = computeTrust(relationship);
    check("trust is within [0,100]", trust >= 0 && trust <= 100);
    check(
      "trust is proportional to points against the top level threshold",
      trust === Math.round((relationship.points / LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) * 100)
    );

    check("familiarity starts as 'New Face' with zero visit days", computeFamiliarity(0) === "New Face");
    check("familiarity reaches 'Close' at 30+ visit days", computeFamiliarity(30) === "Close");
    check("familiarity is monotonic (more visits never LOWERS the tier)", (() => {
      const tiers = ["New Face", "Acquaintance", "Regular", "Familiar", "Close"];
      const days = [0, 1, 3, 5, 8, 15, 16, 25, 30, 60];
      let lastIndex = 0;
      for (const d of days) {
        const idx = tiers.indexOf(computeFamiliarity(d));
        if (idx < lastIndex) return false;
        lastIndex = idx;
      }
      return true;
    })());

    const sim = computeSubjectSimState(UI_SUBJECT, save.tasks, save.assessmentProgress);
    check("getMentorMood returns exactly the subject sim's own mood (no parallel classifier)", getMentorMood(sim) === sim.mood);
    check("getGuideMood picks the most common mood across subjects, deterministically", getGuideMood(["stressed", "stressed", "content"]) === "stressed");
    check("getGuideMood falls back to 'content' on an empty subject list", getGuideMood([]) === "content");

    check("level 1 (New) only unlocks daily-check-in", getUnlockedDialogueTopics({ ...relationship, level: 1 }).length === 1);
    check("level 2+ unlocks reflective-relationship-comment", getUnlockedDialogueTopics({ ...relationship, level: 2 }).includes("reflective-relationship-comment"));
    check("level 4+ unlocks deep-bond-milestone", getUnlockedDialogueTopics({ ...relationship, level: 4 }).includes("deep-bond-milestone"));

    const view = buildSubjectMentorRelationshipView(relationship, sim);
    check("buildSubjectMentorRelationshipView composes all Part 1 fields without re-deriving them differently", view.trust === trust && view.mood === sim.mood && view.familiarity === computeFamiliarity(relationship.stats.visitDays));

    const viewAgain = buildSubjectMentorRelationshipView(computeMentorRelationship(save, UI_SUBJECT), computeSubjectSimState(UI_SUBJECT, save.tasks, save.assessmentProgress));
    check("relationship view is deterministic (same save -> same view, twice)", JSON.stringify(view) === JSON.stringify(viewAgain));
  });

  // -------------------------------------------------------------------------
  section("2. Campus memory / NPC recognition (Part 3)", () => {
    const save = createDefaultSaveData();
    const memory = getNpcMemory(save, "guide");
    check("a never-met NPC's memory defaults to 'never spoken', not a throw", memory.lastLine === null && memory.lastLineDate === null);

    // Melbourne is AEST (UTC+10) in July (winter, outside daylight saving) —
    // both instants below land on the same Melbourne calendar day
    // (2026-07-20 spans 2026-07-19T14:00Z through 2026-07-20T13:59Z).
    const now = new Date("2026-07-20T01:00:00.000Z");
    const laterSameDay = new Date("2026-07-20T10:00:00.000Z");
    const nextDay = new Date("2026-07-21T01:00:00.000Z");

    check("hasGreetedToday is false before any interaction is recorded", !hasGreetedToday(memory, now));

    const firstLine = applyRecognition("Fresh line one.", memory, "guide", now);
    check("the first interaction of the day passes the fresh line through unchanged", firstLine === "Fresh line one.");

    const recordedMemory = { lastLine: firstLine, lastLineDate: getMelbourneDateIso(now), lastInteractionAt: now.toISOString() };
    check("hasGreetedToday is true later the SAME Melbourne day", hasGreetedToday(recordedMemory, laterSameDay));
    check("hasGreetedToday is false again on the NEXT Melbourne day", !hasGreetedToday(recordedMemory, nextDay));

    const secondLine = applyRecognition("Fresh line two.", recordedMemory, "guide", laterSameDay);
    check("a same-day repeat swaps in a short recognition line instead of the fresh one", secondLine !== "Fresh line two." && secondLine.length > 0);
    const secondLineAgain = applyRecognition("A completely different fresh line.", recordedMemory, "guide", laterSameDay);
    check("recognition is deterministic per (npcKey, day) — never random", secondLine === secondLineAgain);

    const thirdDayLine = applyRecognition("Fresh line three.", recordedMemory, "guide", nextDay);
    check("the next day's first interaction is fresh again, not a recognition line", thirdDayLine === "Fresh line three.");
  });

  // -------------------------------------------------------------------------
  section("3. Daily mentor insights (Part 2 + 6) — comparative/aggregate observations", () => {
    const base = createDefaultSaveData();

    const insightTwice = [getDailyMentorInsight(base), getDailyMentorInsight(base)];
    check("getDailyMentorInsight is deterministic (same save -> same insight, twice)", JSON.stringify(insightTwice[0]) === JSON.stringify(insightTwice[1]));

    const takeABreakSave: UniGameSaveData = { ...base, userProgress: { ...base.userProgress, streakCount: 20 } };
    const takeABreak = getDailyMentorInsight(takeABreakSave);
    check("a 14+ day streak surfaces the 'take a break' rung ahead of a status update", takeABreak?.kind === "take-a-break");

    const todayIso = getMelbourneDateIso();
    const dueInThreeDays = shiftDateIso(todayIso, 3);
    const subjectsWithOneDueSoon = base.semester.subjects.map((s, i) =>
      i === 0
        ? { ...s, assessments: s.assessments.map((a, j) => (j === 0 ? { ...a, dueDate: confirmed(dueInThreeDays) } : { ...a, dueDate: unconfirmed<string>() })) }
        : { ...s, assessments: s.assessments.map((a) => ({ ...a, dueDate: unconfirmed<string>() })) }
    );
    const oneDueSave: UniGameSaveData = { ...base, semester: { ...base.semester, subjects: subjectsWithOneDueSoon } };
    const oneDueInsight = getDailyMentorInsight(oneDueSave);
    check("exactly one confirmed assessment due within 7 days surfaces the singular 'only one assessment' line", oneDueInsight?.kind === "assessments-due-week" && oneDueInsight.line.toLowerCase().includes("one assessment"));

    const dueInThreeWeeks = shiftDateIso(todayIso, 21);
    const subjectsWithNoneSoon = base.semester.subjects.map((s) => ({ ...s, assessments: s.assessments.map((a) => ({ ...a, dueDate: confirmed(dueInThreeWeeks) })) }));
    const noneDueSave: UniGameSaveData = { ...base, semester: { ...base.semester, subjects: subjectsWithNoneSoon } };
    const noneDueInsight = getDailyMentorInsight(noneDueSave);
    check("an assessment due in 3 weeks does NOT count as 'due this week'", noneDueInsight?.kind !== "assessments-due-week");

    const noSubjectsSave: UniGameSaveData = { ...base, semester: { ...base.semester, subjects: [] } };
    check("getDailyMentorInsight never throws on a save with zero subjects", (() => {
      try {
        getDailyMentorInsight(noSubjectsSave);
        return true;
      } catch {
        return false;
      }
    })());
  });

  // -------------------------------------------------------------------------
  section("4. Social campus — NPC schedules stay collision-safe (Part 4)", () => {
    for (const npc of LIBRARY_NPCS) {
      for (const wp of npc.schedule.waypoints) {
        check(`Library NPC "${npc.id}" waypoint (${wp.standPoint.x},${wp.standPoint.feetY}) doesn't sit inside a room obstacle`, !inAnyObstacle(wp.standPoint, LIBRARY_WORLD));
      }
    }
    // Note: Student Lounge's seated visitors are NOT checked against
    // obstacles here — the lounge table itself IS an obstacle rectangle
    // (blocks the player from walking through it), and an NPC seated AT
    // that table is expected to sit within its footprint, same as the
    // pre-existing "lounge-visitor" (Phase 20E, unchanged). Only the
    // player is collision-checked (`useWorldMovement`); NPC schedules
    // never run a collision pass, so this is the correct, intentional
    // shape, not something to assert against.
    for (const npc of STUDENT_LOUNGE_NPCS) {
      for (const wp of npc.schedule.waypoints) {
        check(
          `Student Lounge NPC "${npc.id}" waypoint (${wp.standPoint.x},${wp.standPoint.feetY}) stays within the room's outer bounds`,
          wp.standPoint.x >= 0 && wp.standPoint.x <= STUDENT_LOUNGE_WORLD.width && wp.standPoint.feetY >= 0 && wp.standPoint.feetY <= STUDENT_LOUNGE_WORLD.height
        );
      }
    }

    check("Library has exactly 2 new study-buddy NPCs alongside the librarian (curated, not crowded)", LIBRARY_NPCS.length === 3);
    check("Student Lounge has exactly 1 new visitor alongside the existing barista + visitor", STUDENT_LOUNGE_NPCS.length === 3);

    const studyBuddyA = LIBRARY_NPCS.find((n) => n.id === "study-buddy-a")!;
    const state = getScheduleState(studyBuddyA.schedule, scheduleCycleDuration(studyBuddyA.schedule) / 2);
    check("a study-buddy schedule produces a valid pose/position at an arbitrary elapsed time, without throwing", typeof state.pose === "string" && Number.isFinite(state.position.x));

    const campusScene = src("src/game3d/scenes/CampusBuildingScene.tsx");
    check("BuildingNpcDefinition carries an optional interactableId (Part 4 'react to the player's presence')", campusScene.includes("interactableId?: string"));
    check("CampusBuildingScene passes a waving flag to NpcCharacter keyed off inRange", /waving=\{inRange\?\.id === \(npc\.interactableId \?\? npc\.id\)\}/.test(campusScene));

    const npcCharacterSrc = src("src/game3d/characters/NpcCharacter.tsx");
    check("NpcCharacter accepts a waving prop", /waving\??:\s*boolean/.test(npcCharacterSrc));
    // Phase 23 restructured this into a 3-way chain (talking > waving >
    // scheduled) to add the "talk" override — same underlying rule, still
    // gated on `state.isWalking` first so neither override can fire mid-walk.
    check("NpcCharacter never overrides pose to wave/talk mid-walk (no teleporting into a stopped pose)", /state\.isWalking\s*\?\s*state\.pose\s*:/.test(npcCharacterSrc) && npcCharacterSrc.includes('waving ? "wave"'));

    const librarySrc = src("src/game3d/campus/library/LibraryScene.tsx");
    check("the Library's librarian NPC is explicitly linked to the librarian-desk interactable (ids diverge)", librarySrc.includes('interactableId: "librarian-desk"'));

    const subjectBuildingSrc = src("src/game3d/campus/subjectBuilding/SubjectBuildingScene.tsx");
    check("subject-building mentors are explicitly linked to the subject-mentor interactable (per-subject npc id diverges)", subjectBuildingSrc.includes('interactableId: "subject-mentor"'));
  });

  // -------------------------------------------------------------------------
  section("5. Campus events (Part 5) — ambience only, deterministic per day", () => {
    const day = new Date("2026-08-01T04:00:00.000Z");
    const eventTwice = [getTodaysCampusEvent(day), getTodaysCampusEvent(day)];
    check("the same calendar day always picks the same event", eventTwice[0].id === eventTwice[1].id);

    const seenIds = new Set<string>();
    const seenBuildingIds = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const d = new Date(Date.UTC(2026, 0, 1 + i, 4));
      const event = getTodaysCampusEvent(d);
      seenIds.add(event.id);
      seenBuildingIds.add(event.buildingId);
      check(`event "${event.id}" on day offset ${i} is tagged to a real campus building`, CAMPUS_LOCATIONS.some((loc) => loc.id === event.buildingId), undefined);
    }
    check("more than one distinct event appears across 60 days (not stuck on a single pick)", seenIds.size > 1);
  });

  // -------------------------------------------------------------------------
  section("6. Campus atmosphere (Part 9) — exam-week/season/holiday ambience, kept subtle", () => {
    check("January reads as summer (Southern Hemisphere)", getCampusSeason(new Date("2026-01-15T00:00:00.000Z")) === "summer");
    check("April reads as autumn", getCampusSeason(new Date("2026-04-15T00:00:00.000Z")) === "autumn");
    check("July reads as winter", getCampusSeason(new Date("2026-07-15T00:00:00.000Z")) === "winter");
    check("October reads as spring", getCampusSeason(new Date("2026-10-15T00:00:00.000Z")) === "spring");
    check("December reads as summer, not a 13th month falling through", getCampusSeason(new Date("2026-12-15T00:00:00.000Z")) === "summer");

    const save = createDefaultSaveData();
    const atmosphereTwice = [getCampusAtmosphere(save), getCampusAtmosphere(save)];
    check("getCampusAtmosphere is deterministic (same save/instant -> same result, twice)", JSON.stringify(atmosphereTwice[0]) === JSON.stringify(atmosphereTwice[1]));

    const unconfirmedSemesterSave: UniGameSaveData = {
      ...save,
      semester: { ...save.semester, startDate: { value: null, status: "needs_confirmation" }, endDate: { value: null, status: "needs_confirmation" } },
    };
    const atmosphere = getCampusAtmosphere(unconfirmedSemesterSave);
    check("a save with no confirmed semester dates reads as 'on break', never a fabricated exam/holiday", atmosphere.onBreak && !atmosphere.examWeek);

    const soundSrc = src("src/lib/sound.ts");
    check('the new "exam-week-hush" SoundEvent is declared', soundSrc.includes('"exam-week-hush"'));
    check('the new "campus-quiet" SoundEvent is declared', soundSrc.includes('"campus-quiet"'));

    const buildingSceneSrc = src("src/game3d/scenes/CampusBuildingScene.tsx");
    check("CampusBuildingScene layers campus-atmosphere ambience UNDER the building's own + time-of-day ambience (never replacing them)", /events = \[\.\.\.ambienceSounds, \.\.\.atmosphere\.ambienceSounds, \.\.\.campusAtmosphere\.ambienceSounds\]/.test(buildingSceneSrc));
  });

  // -------------------------------------------------------------------------
  section("7. Player Journal (Part 8) — read-only, auto-generated, distinct from the manual Study Journal", () => {
    const journalSrc = src("src/screens/PlayerJournalScreen.tsx");
    check("the Player Journal has no <button> elements (nothing to click that mutates state)", !/<button/.test(journalSrc));
    check("the Player Journal has no <input>/<textarea> elements (nothing to type into)", !/<input|<textarea/.test(journalSrc));
    check("the screen's own copy states it is read-only", journalSrc.includes("Read-only"));
    check("it draws from npcMemory (mentor comments) without inventing a parallel derivation", journalSrc.includes("saveData.npcMemory"));
    // Phase 22 refactored this call site to the shared `getFavouriteBuildings`
    // helper (campusMap.ts) instead of an inline buildingVisits derivation —
    // still the same "no duplicated calculation" principle, now shared with
    // ContextEngine.ts too.
    check("it draws from buildingVisits (favourite places) without inventing a parallel derivation", journalSrc.includes("getFavouriteBuildings(saveData"));
    check("it draws from the existing milestones log rather than a second achievement/timeline deriver", journalSrc.includes("saveData.milestones"));

    const profilePanelSrc = src("src/components/world/panels/ProfilePanel.tsx");
    check('ProfilePanel wires a distinct "memories" sub-tab (not folded into the pre-existing manual "journal" tab)', profilePanelSrc.includes('{ id: "memories", label: "Memories" }') && profilePanelSrc.includes('{ id: "journal", label: "Journal" }'));
    check("the memories sub-tab renders PlayerJournalScreen", profilePanelSrc.includes('sub === "memories" ? <PlayerJournalScreen />'));
    check("the journal sub-tab still renders the pre-existing, unmodified StudyJournalScreen", profilePanelSrc.includes('sub === "journal" ? <StudyJournalScreen />'));
  });

  // -------------------------------------------------------------------------
  section("8. Save compatibility (Phase 21's new save fields)", () => {
    const preExisting = createDefaultSaveData();
    check("a fresh save has empty npcMemory/buildingVisits records, not undefined", JSON.stringify(preExisting.npcMemory) === "{}" && JSON.stringify(preExisting.buildingVisits) === "{}");

    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(preExisting)));
    check("a fresh save still round-trips to itself through sanitizeSaveData", JSON.stringify(roundTripped) === JSON.stringify(preExisting));

    const corrupted = {
      ...preExisting,
      npcMemory: { guide: { lastLine: 42, lastLineDate: null }, "user-interface-design": "not an object", valid: { lastLine: "hi", lastLineDate: "2026-07-20", lastInteractionAt: "2026-07-20T00:00:00.000Z" } },
      buildingVisits: { library: { visitDays: -5, lastVisitDate: 123 }, "computer-lab": null, campus: { visitDays: 4, lastVisitDate: "2026-07-20" } },
    };
    check("sanitizeSaveData never throws on corrupted npcMemory/buildingVisits shapes", (() => {
      try {
        sanitizeSaveData(JSON.parse(JSON.stringify(corrupted)));
        return true;
      } catch {
        return false;
      }
    })());

    const sanitizedCorrupted = sanitizeSaveData(JSON.parse(JSON.stringify(corrupted)));
    check("a malformed npcMemory entry is dropped to safe defaults, not the corrupted values", sanitizedCorrupted.npcMemory.guide.lastLine === null);
    check("a well-formed npcMemory entry survives sanitisation unchanged", sanitizedCorrupted.npcMemory.valid.lastLine === "hi");
    check("a negative visitDays is clamped to a safe non-negative default", sanitizedCorrupted.buildingVisits.library.visitDays === 0);
    check("a well-formed buildingVisits entry survives sanitisation unchanged", sanitizedCorrupted.buildingVisits.campus.visitDays === 4);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
