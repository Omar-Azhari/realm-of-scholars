/**
 * Phase 20C (Living World & Animation) verification harness. Direct calls
 * into the real, unmodified modules — no React/R3F/DOM needed, since every
 * genuinely NEW piece of logic this phase added (the schedule engine, the
 * new poses, proximity-light math, activity-sound mapping) is plain
 * data/functions with zero React or Three.js import — the same discipline
 * established by characterRig.ts/npcSchedule.ts/historyStack.ts in earlier
 * phases. `ModularCharacter.tsx`/`NpcCharacter.tsx`/`TestRoomScene.tsx`
 * themselves (JSX, need a WebGL-ish environment) are intentionally NOT
 * imported here — this harness proves the logic underneath them.
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase20c-living-world.ts .tmp/verify-phase20c-living-world.cjs
 *   node .tmp/verify-phase20c-living-world.cjs
 */

import { computePose, blendPoseTransforms, createPoseBlender, POSE_NAMES } from "../src/game3d/characters/characterRig";
import { getScheduleState, scheduleCycleDuration, type NpcSchedule } from "../src/game3d/characters/npcSchedule";
import { targetLightIntensity, lerpIntensity } from "../src/game3d/scenes/proximityLight";
import {
  TEST_ROOM_WORLD,
  ROOM_NPCS,
  MENTOR_APPEARANCE,
  MENTOR_PERSONALITY,
  STUDENT_READER_APPEARANCE,
  STUDENT_SOCIAL_APPEARANCE,
} from "../src/game3d/rooms/testRoomWorld";
import { MENTOR_SCHEDULE, STUDENT_READER_SCHEDULE, STUDENT_SOCIAL_SCHEDULE } from "../src/game3d/rooms/testRoomSchedules";
import { isValidAppearance } from "../src/data/appearanceCatalogue";
import { isValidPersonality, buildPersonalityPreview } from "../src/data/personalityTraits";
import { sanitizeSaveData, createDefaultSaveData } from "../src/lib/persistence";
import type { FloorObstacle, FloorPoint } from "../src/world/worldTypes";

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

function segmentIntersectsRect(a: FloorPoint, b: FloorPoint, rect: FloorObstacle): boolean {
  // Coarse but sufficient for these hand-placed, axis-aligned-obstacle
  // paths: sample along the segment and check each point against the
  // rect. Sampling density is generous relative to every obstacle's
  // smallest dimension in this room (>= 40 units), so a real crossing
  // could never hide between samples.
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const feetY = a.feetY + (b.feetY - a.feetY) * t;
    if (x >= rect.xMin && x <= rect.xMax && feetY >= rect.feetMin && feetY <= rect.feetMax) return true;
  }
  return false;
}

function main(): void {
  // -------------------------------------------------------------------------
  section("1. NPC schedules — structure and determinism (Parts 1/2)", () => {
    const schedules: [string, NpcSchedule][] = [
      ["mentor", MENTOR_SCHEDULE],
      ["student-reader", STUDENT_READER_SCHEDULE],
      ["student-social", STUDENT_SOCIAL_SCHEDULE],
    ];

    for (const [name, schedule] of schedules) {
      check(`${name}: has at least 2 waypoints (a real cycle, not a single fixed spot)`, schedule.waypoints.length >= 2);
      check(`${name}: every waypoint has a positive duration`, schedule.waypoints.every((w) => w.durationSeconds > 0));
      check(`${name}: cycle duration matches the sum of its waypoint durations`, scheduleCycleDuration(schedule) === schedule.waypoints.reduce((s, w) => s + w.durationSeconds, 0));

      const cycle = scheduleCycleDuration(schedule);
      const stateAt0 = getScheduleState(schedule, 0);
      const stateAtOneCycle = getScheduleState(schedule, cycle);
      const stateAtTwoCycles = getScheduleState(schedule, cycle * 2);
      check(`${name}: state repeats exactly one cycle later (fully deterministic, no drift)`, JSON.stringify(stateAt0) === JSON.stringify(stateAtOneCycle));
      check(`${name}: state repeats exactly two cycles later too`, JSON.stringify(stateAt0) === JSON.stringify(stateAtTwoCycles));

      const stateNegative = getScheduleState(schedule, -cycle * 3.5);
      check(`${name}: negative elapsed time never throws and still returns a valid waypoint index`, stateNegative.waypointIndex >= 0 && stateNegative.waypointIndex < schedule.waypoints.length);

      // Sample the whole cycle densely — every activity pose used must be
      // a real, known pose name (catches a typo'd activity string).
      let allPosesValid = true;
      for (let t = 0; t < cycle; t += 0.5) {
        const state = getScheduleState(schedule, t);
        if (!POSE_NAMES.includes(state.pose)) allPosesValid = false;
      }
      check(`${name}: every activity/pose visited across a full cycle is a real pose name`, allPosesValid);
    }
  });

  // -------------------------------------------------------------------------
  section("2. Waypoint walk-path obstacle clearance (Part 2's own 'walk between locations')", () => {
    const schedules: [string, NpcSchedule][] = [
      ["mentor", MENTOR_SCHEDULE],
      ["student-reader", STUDENT_READER_SCHEDULE],
      ["student-social", STUDENT_SOCIAL_SCHEDULE],
    ];
    for (const [name, schedule] of schedules) {
      for (let i = 0; i < schedule.waypoints.length; i++) {
        const from = schedule.waypoints[(i - 1 + schedule.waypoints.length) % schedule.waypoints.length].standPoint;
        const to = schedule.waypoints[i].standPoint;
        for (const obstacle of TEST_ROOM_WORLD.obstacles) {
          check(
            `${name}: walk segment #${i} (waypoint ${(i - 1 + schedule.waypoints.length) % schedule.waypoints.length} -> ${i}) clears obstacle [${obstacle.xMin}-${obstacle.xMax}, ${obstacle.feetMin}-${obstacle.feetMax}]`,
            !segmentIntersectsRect(from, to, obstacle)
          );
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  section("3. Personality-driven schedule variation (Part 1: 'different personalities influence activity frequency')", () => {
    const mentorActivities = new Set(MENTOR_SCHEDULE.waypoints.map((w) => w.activity));
    const readerActivities = new Set(STUDENT_READER_SCHEDULE.waypoints.map((w) => w.activity));
    const socialActivities = new Set(STUDENT_SOCIAL_SCHEDULE.waypoints.map((w) => w.activity));

    check("mentor schedule is typing-biased (includes 'type')", mentorActivities.has("type"));
    check("reader schedule is reading-biased (includes 'sit' or 'read')", readerActivities.has("sit") || readerActivities.has("read"));
    check("social schedule is coffee/talk-biased (includes 'coffee' and 'talk')", socialActivities.has("coffee") && socialActivities.has("talk"));
    check("the three archetypes are not identical schedules", JSON.stringify(MENTOR_SCHEDULE) !== JSON.stringify(STUDENT_READER_SCHEDULE) && JSON.stringify(STUDENT_READER_SCHEDULE) !== JSON.stringify(STUDENT_SOCIAL_SCHEDULE));

    // Personality still only affects PLAYBACK SPEED, never gameplay/which activity plays (Part 10).
    const calmPreview = buildPersonalityPreview("trait-calm", []);
    const sociablePreview = buildPersonalityPreview("trait-sociable", []);
    check("different personalities produce different idle-speed multipliers (cosmetic variation exists)", calmPreview?.idleSpeedMultiplier !== sociablePreview?.idleSpeedMultiplier);

    check("mentor appearance/personality are valid against the shared catalogue", isValidAppearance(MENTOR_APPEARANCE) && isValidPersonality(MENTOR_PERSONALITY));
    check("student-reader appearance is valid against the shared catalogue", isValidAppearance(STUDENT_READER_APPEARANCE));
    check("student-social appearance is valid against the shared catalogue", isValidAppearance(STUDENT_SOCIAL_APPEARANCE));

    check("ROOM_NPCS lists exactly 3 NPCs (mentor + 2 students — Part 9's 'never feel alone')", ROOM_NPCS.length === 3);
    check("every ROOM_NPCS entry has a distinct schedule-time offset (never perfectly synced)", new Set(ROOM_NPCS.map((n) => n.scheduleTimeOffsetSeconds)).size === ROOM_NPCS.length);
  });

  // -------------------------------------------------------------------------
  section("4. New activity poses (Part 1/4) exist and blend", () => {
    const newPoses = ["write", "type", "think", "talk", "coffee", "sit"] as const;
    for (const pose of newPoses) {
      check(`"${pose}" is registered in POSE_NAMES`, POSE_NAMES.includes(pose));
      const t = computePose(pose, 1.1, {});
      const allFinite = [t.head, t.armLeft, t.armRight, t.legLeft, t.legRight].every((j) => Number.isFinite(j.rotX) && Number.isFinite(j.rotY) && Number.isFinite(j.rotZ)) && Number.isFinite(t.bodyBobY);
      check(`"${pose}" produces finite values for every joint`, allFinite);
    }

    check("'sit' visibly lowers the body (bodyBobY meaningfully negative, approximating sitting height)", computePose("sit", 0, {}).bodyBobY < -0.2);
    check("'sit' bends both legs forward (rotX negative, resting on a seat)", computePose("sit", 0, {}).legLeft.rotX < -0.5 && computePose("sit", 0, {}).legRight.rotX < -0.5);

    // Crossfade between two of the new poses actually blends, not snaps.
    const blender = createPoseBlender("idle", 0.4);
    blender.setPose("type", 0);
    const midBlend = blender.update(0.2);
    const pureIdle = computePose("idle", 0.2, {});
    const pureType = computePose("type", 0.2, {});
    check(
      "idle -> type crossfade at the halfway point is neither pure idle nor pure type",
      midBlend.armLeft.rotX !== pureIdle.armLeft.rotX && midBlend.armLeft.rotX !== pureType.armLeft.rotX
    );
  });

  // -------------------------------------------------------------------------
  section("5. Player movement polish math (Part 3)", () => {
    const earlyWalk = computePose("walk", 0.05, {});
    const fullWalk = computePose("walk", 1.0, {});
    check(
      "anticipation ramp: a walk pose sampled just after starting has a smaller stride than one sampled a full second in",
      Math.abs(earlyWalk.legLeft.rotX) < Math.abs(fullWalk.legLeft.rotX)
    );
    check("at t=0 exactly, walk produces zero stride (the anticipation ramp starts from nothing, not a snap)", computePose("walk", 0, {}).legLeft.rotX === 0);

    const walkSample = computePose("walk", 0.6, {});
    check("head bob is present during walk (non-zero head rotX at a mid-stride sample)", walkSample.head.rotX !== 0);
    check("weight shift is present during walk (non-zero head rotZ at a mid-stride sample)", walkSample.head.rotZ !== 0);

    // Idle breathing (already existed, confirmed still present) + smooth
    // stop is structural (the shared crossfade blender), not a separate
    // formula to test again here.
    const idleSample = computePose("idle", 1.3, {});
    check("idle breathing (bodyBobY oscillation) is still present", idleSample.bodyBobY !== 0);
  });

  // -------------------------------------------------------------------------
  section("6. Contextual interaction prompts (Part 5)", () => {
    const desk = TEST_ROOM_WORLD.interactables.find((i) => i.id === "desk-study");
    const wardrobe = TEST_ROOM_WORLD.interactables.find((i) => i.id === "wardrobe");
    const bookshelf = TEST_ROOM_WORLD.interactables.find((i) => i.id === "bookshelf-resources");

    check("desk label matches the brief's own example ('Study Computer')", desk?.label === "Study Computer");
    check("desk action label matches the brief's own example ('Open Study Planner')", desk?.actionLabel === "Open Study Planner");
    check("wardrobe label matches the brief's own example ('Mirror')", wardrobe?.label === "Mirror");
    check("wardrobe action label matches the brief's own example ('Change Appearance')", wardrobe?.actionLabel === "Change Appearance");
    check("a bookshelf interactable now exists (Part 5's own example)", Boolean(bookshelf));
    check("bookshelf action label matches the brief's own example ('Browse Learning Material')", bookshelf?.actionLabel === "Browse Learning Material");
    check("bookshelf reuses the EXISTING open-panel action (no new action type invented)", bookshelf?.action.type === "open-panel");
    check(
      "bookshelf's stand point is not inside its own obstacle (reachable)",
      Boolean(bookshelf) && !TEST_ROOM_WORLD.obstacles.some((o) => bookshelf!.standPoint.x >= o.xMin && bookshelf!.standPoint.x <= o.xMax && bookshelf!.standPoint.feetY >= o.feetMin && bookshelf!.standPoint.feetY <= o.feetMax)
    );
  });

  // -------------------------------------------------------------------------
  section("7. Proximity lighting (Part 5: 'lighting should subtly respond when nearby')", () => {
    check("in-range target is the boost intensity", targetLightIntensity(true, 0.15, 0.55) === 0.55);
    check("out-of-range target is the base intensity", targetLightIntensity(false, 0.15, 0.55) === 0.15);

    let intensity = 0.15;
    for (let i = 0; i < 200; i++) intensity = lerpIntensity(intensity, 0.55, 4, 1 / 60);
    check("lerpIntensity converges to the target over many small steps (doesn't overshoot or oscillate)", Math.abs(intensity - 0.55) < 0.001);

    const oneStep = lerpIntensity(0.15, 0.55, 4, 1 / 60);
    check("lerpIntensity moves gradually, not instantly, in a single small step", oneStep > 0.15 && oneStep < 0.55);
  });

  // -------------------------------------------------------------------------
  section("8. Environment ambience + performance discipline (Parts 6/11)", () => {
    // Every schedule waypoint's stand point stays within the room's walkable band — including the new coffee-corner destinations.
    const w = TEST_ROOM_WORLD.walkable;
    const allSchedules = [MENTOR_SCHEDULE, STUDENT_READER_SCHEDULE, STUDENT_SOCIAL_SCHEDULE];
    for (const schedule of allSchedules) {
      for (const waypoint of schedule.waypoints) {
        check(
          `${schedule.id}: waypoint at (${waypoint.standPoint.x}, ${waypoint.standPoint.feetY}) is within the walkable band`,
          waypoint.standPoint.x >= w.xMin && waypoint.standPoint.x <= w.xMax && waypoint.standPoint.feetY >= w.feetBack && waypoint.standPoint.feetY <= w.feetFront
        );
      }
    }

    // The coffee-corner obstacle itself doesn't overlap any other obstacle (added this phase — regression guard).
    const coffeeObstacle = TEST_ROOM_WORLD.obstacles[TEST_ROOM_WORLD.obstacles.length - 1];
    let overlapsAnother = false;
    for (let i = 0; i < TEST_ROOM_WORLD.obstacles.length - 1; i++) {
      const o = TEST_ROOM_WORLD.obstacles[i];
      if (coffeeObstacle.xMin < o.xMax && coffeeObstacle.xMax > o.xMin && coffeeObstacle.feetMin < o.feetMax && coffeeObstacle.feetMax > o.feetMin) overlapsAnother = true;
    }
    check("the new coffee-corner obstacle doesn't overlap any pre-existing obstacle", !overlapsAnother);

    check("room now has 6 obstacles (5 from 20A.5 + coffee corner)", TEST_ROOM_WORLD.obstacles.length === 6);
  });

  // -------------------------------------------------------------------------
  section("9. Save compatibility (no new required save fields this phase)", () => {
    // Phase 20C added no new PlayerIdentity/save-data fields — NPC schedules
    // are derived from a world clock, never persisted. A save from the end
    // of Phase 20B should sanitize identically before and after this phase.
    const preExisting = createDefaultSaveData();
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(preExisting)));
    check("a fresh save still sanitizes to itself (no shape change this phase)", JSON.stringify(roundTripped) === JSON.stringify(preExisting));

    const withIdentity = { ...preExisting, playerIdentity: { ...preExisting.playerIdentity } };
    check("sanitizeSaveData still runs without throwing on a save carrying a playerIdentity", (() => {
      try {
        sanitizeSaveData(JSON.parse(JSON.stringify(withIdentity)));
        return true;
      } catch {
        return false;
      }
    })());
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
