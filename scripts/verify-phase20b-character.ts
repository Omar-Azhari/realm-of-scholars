/**
 * Phase 20B (Player Identity & Character Creator) verification harness.
 * Direct calls into the real, unmodified modules — no React/R3F runtime
 * needed, since everything genuinely NEW logic this phase added
 * (catalogues, the pose engine, the undo/redo stack, randomisation, save
 * migration) is plain data/functions with zero React or Three.js import.
 * `ModularCharacter.tsx`/`CharacterCreator.tsx`/`NpcCharacter.tsx`
 * themselves (JSX, needs a DOM/WebGL-ish environment) are intentionally
 * NOT imported here — this harness proves the logic underneath them, the
 * same split already established by `characterRig.ts`'s own header.
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase20b-character.ts .tmp/verify-phase20b-character.cjs
 *   node .tmp/verify-phase20b-character.cjs
 */

import {
  BODY_PRESETS,
  SKIN_TONES,
  HAIR_OPTIONS,
  HAIR_COLORS,
  EYE_OPTIONS,
  EYEBROW_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  TOP_OPTIONS,
  JACKET_OPTIONS,
  BOTTOM_OPTIONS,
  SHOES_OPTIONS,
  ACCESSORY_OPTIONS,
  CATALOGUE_SIZES,
  isValidAppearance,
  findOption,
} from "../src/data/appearanceCatalogue";
import { PERSONALITY_TRAITS, isValidPersonality, buildPersonalityPreview, findPersonalityTrait } from "../src/data/personalityTraits";
import { createDefaultAppearance, createDefaultPersonality, createDefaultPlayerIdentity } from "../src/data/playerIdentityDefaults";
import { sanitizeSaveData, createDefaultSaveData } from "../src/lib/persistence";
import { setPlayerIdentity } from "../src/lib/saveDataMutations";
import { TEST_ROOM_WORLD, MENTOR_APPEARANCE, MENTOR_PERSONALITY } from "../src/game3d/rooms/testRoomWorld";
import { computePose, blendPoseTransforms, createPoseBlender, POSE_NAMES, type PoseName } from "../src/game3d/characters/characterRig";
import {
  createHistoryStack,
  pushHistory,
  undoHistory,
  redoHistory,
  currentHistoryValue,
  canUndoHistory,
  canRedoHistory,
} from "../src/game3d/creator/historyStack";
import { randomiseAppearance, randomisePersonality, createSeededRng } from "../src/game3d/creator/randomise";

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

function main(): void {
  // -------------------------------------------------------------------------
  section("1. Catalogue integrity", () => {
    check("body presets >= 5 (brief minimum)", CATALOGUE_SIZES.body >= 5);
    check("hairstyles >= 15", CATALOGUE_SIZES.hair >= 15);
    check("tops >= 20", CATALOGUE_SIZES.top >= 20);
    check("jackets >= 10", CATALOGUE_SIZES.jacket >= 10);
    check("bottoms >= 15", CATALOGUE_SIZES.bottom >= 15);
    check("shoes >= 12", CATALOGUE_SIZES.shoes >= 12);
    check("accessories >= 20", CATALOGUE_SIZES.accessory >= 20);

    const allLists: [string, { id: string }[]][] = [
      ["body", BODY_PRESETS],
      ["skinTone", SKIN_TONES],
      ["hair", HAIR_OPTIONS],
      ["hairColor", HAIR_COLORS],
      ["eyes", EYE_OPTIONS],
      ["eyebrows", EYEBROW_OPTIONS],
      ["facialHair", FACIAL_HAIR_OPTIONS],
      ["top", TOP_OPTIONS],
      ["jacket", JACKET_OPTIONS],
      ["bottom", BOTTOM_OPTIONS],
      ["shoes", SHOES_OPTIONS],
      ["accessory", ACCESSORY_OPTIONS],
    ];
    for (const [name, list] of allLists) {
      const ids = list.map((o) => o.id);
      check(`${name}: no duplicate ids`, new Set(ids).size === ids.length);
    }

    check("headscarf/hijab modest option exists in the hair list (Part 6)", HAIR_OPTIONS.some((h) => h.tags.includes("modest") && h.shape.startsWith("headscarf")));
    check("long-skirt / loose-trousers modest options exist in the bottom list (Part 6)", BOTTOM_OPTIONS.filter((b) => b.tags.includes("modest")).length >= 2);
    check("long-sleeve / long-tunic modest options exist in the top list (Part 6)", TOP_OPTIONS.some((t) => t.tags.includes("modest")));
    check(
      "modest options are mixed into their normal category, not isolated (Part 6: 'do not isolate them')",
      HAIR_OPTIONS.some((h) => !h.tags.includes("modest")) && BOTTOM_OPTIONS.some((b) => !b.tags.includes("modest"))
    );

    check("personality traits catalogue is non-trivial (>= 6, enough for 1 primary + 2 distinct secondaries)", PERSONALITY_TRAITS.length >= 6);
    check("no duplicate personality trait ids", new Set(PERSONALITY_TRAITS.map((t) => t.id)).size === PERSONALITY_TRAITS.length);
  });

  // -------------------------------------------------------------------------
  section("2. Appearance save/load round-trip", () => {
    const appearance = createDefaultAppearance();
    check("default appearance is valid against the catalogue", isValidAppearance(appearance));

    const withJacketAndAccessories = { ...appearance, jacketId: JACKET_OPTIONS[0].id, accessoryIds: [ACCESSORY_OPTIONS[0].id, ACCESSORY_OPTIONS[1].id] };
    const save = createDefaultSaveData();
    save.playerIdentity = { ...createDefaultPlayerIdentity(), appearance: withJacketAndAccessories };
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(save)));
    check("appearance survives a full JSON round-trip through sanitizeSaveData", isValidAppearance(roundTripped.playerIdentity!.appearance));
    check("jacketId survives the round-trip", roundTripped.playerIdentity!.appearance.jacketId === JACKET_OPTIONS[0].id);
    check("accessoryIds survive the round-trip", roundTripped.playerIdentity!.appearance.accessoryIds.length === 2);

    const corrupted = JSON.parse(JSON.stringify(save));
    corrupted.playerIdentity.appearance.hairId = "not-a-real-catalogue-id";
    corrupted.playerIdentity.appearance.jacketId = "also-fake";
    const repaired = sanitizeSaveData(corrupted);
    check("an invalid hairId falls back to the default hair, not a crash", repaired.playerIdentity!.appearance.hairId === createDefaultAppearance().hairId);
    check("an invalid jacketId falls back to the default (null), not a crash", repaired.playerIdentity!.appearance.jacketId === createDefaultAppearance().jacketId);
    check("every OTHER field survives untouched despite the two corrupted fields", isValidAppearance(repaired.playerIdentity!.appearance));
  });

  // -------------------------------------------------------------------------
  section("3. Personality save/load round-trip", () => {
    const personality = { primaryTraitId: "trait-curious", secondaryTraitIds: ["trait-sociable", "trait-humorous"] };
    check("hand-built personality is valid", isValidPersonality(personality));

    const save = createDefaultSaveData();
    save.playerIdentity = { ...createDefaultPlayerIdentity(), personality };
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(save)));
    check("personality survives a round-trip", isValidPersonality(roundTripped.playerIdentity!.personality));
    check("primary trait id preserved", roundTripped.playerIdentity!.personality.primaryTraitId === "trait-curious");
    check("secondary trait ids preserved", roundTripped.playerIdentity!.personality.secondaryTraitIds.length === 2);

    const tooMany = JSON.parse(JSON.stringify(save));
    tooMany.playerIdentity.personality.secondaryTraitIds = ["trait-sociable", "trait-humorous", "trait-ambitious", "trait-calm"];
    const capped = sanitizeSaveData(tooMany);
    check("more than 2 secondary traits is capped to 2, never crashes", capped.playerIdentity!.personality.secondaryTraitIds.length <= 2);

    const dupedPrimary = JSON.parse(JSON.stringify(save));
    dupedPrimary.playerIdentity.personality.secondaryTraitIds = ["trait-curious", "trait-sociable"]; // trait-curious IS the primary
    const deduped = sanitizeSaveData(dupedPrimary);
    check("a secondary trait equal to the primary is dropped (never duplicated)", !deduped.playerIdentity!.personality.secondaryTraitIds.includes("trait-curious"));

    const preview = buildPersonalityPreview("trait-diligent", ["trait-calm"]);
    check("buildPersonalityPreview returns a real preview for valid ids", preview !== null);
    check("preview posture/dialogue come from the PRIMARY trait", preview?.postureLabel === findPersonalityTrait("trait-diligent")?.postureLabel);
    check("buildPersonalityPreview returns null for an invalid primary id (never crashes)", buildPersonalityPreview("not-a-trait", []) === null);
  });

  // -------------------------------------------------------------------------
  section("4. Old-save migration (Part 10: 'no save corruption')", () => {
    const legacySave = JSON.parse(JSON.stringify(createDefaultSaveData()));
    delete legacySave.playerIdentity; // simulates a save from before Phase 20B entirely
    const migrated = sanitizeSaveData(legacySave);
    check("a save missing the playerIdentity KEY entirely gets a full default identity (not null)", migrated.playerIdentity !== null);
    check("the backfilled identity is itself valid", migrated.playerIdentity !== null && isValidAppearance(migrated.playerIdentity.appearance) && isValidPersonality(migrated.playerIdentity.personality));

    const freshSave = JSON.parse(JSON.stringify(createDefaultSaveData()));
    freshSave.playerIdentity = null; // simulates a save created post-20B that hasn't finished onboarding
    const stillNull = sanitizeSaveData(freshSave);
    check("a save with playerIdentity EXPLICITLY null stays null (onboarding still pending, not skipped)", stillNull.playerIdentity === null);

    check("createDefaultSaveData() itself defaults playerIdentity to null (fresh save shows onboarding)", createDefaultSaveData().playerIdentity === null);
  });

  // -------------------------------------------------------------------------
  section("5. setPlayerIdentity mutation (onboarding + in-game edits share one path)", () => {
    const fresh = createDefaultSaveData();
    check("fresh save starts with no identity", fresh.playerIdentity === null);

    const afterFirstWrite = setPlayerIdentity(fresh, { preferredName: "Alex" });
    check("first patch creates a full identity (defaults filled in)", afterFirstWrite.playerIdentity !== null);
    check("first patch's field is applied", afterFirstWrite.playerIdentity?.preferredName === "Alex");
    check("createdAt is stamped on first write", Boolean(afterFirstWrite.playerIdentity?.createdAt));

    const createdAt = afterFirstWrite.playerIdentity!.createdAt;
    const afterSecondWrite = setPlayerIdentity(afterFirstWrite, { university: "La Trobe" });
    check("createdAt is PRESERVED on a later patch (not re-stamped)", afterSecondWrite.playerIdentity?.createdAt === createdAt);
    check("earlier fields survive a later, unrelated patch", afterSecondWrite.playerIdentity?.preferredName === "Alex");
    check("the later patch's field is applied", afterSecondWrite.playerIdentity?.university === "La Trobe");
  });

  // -------------------------------------------------------------------------
  section("6. Wardrobe world interaction (Part 8)", () => {
    const wardrobe = TEST_ROOM_WORLD.interactables.find((i) => i.id === "wardrobe");
    check("a wardrobe interactable exists in the test room", Boolean(wardrobe));
    check("wardrobe kind is 'wardrobe'", wardrobe?.kind === "wardrobe");
    check("wardrobe action opens the Character Creator", wardrobe?.action.type === "open-character-creator");

    const obstacle = TEST_ROOM_WORLD.obstacles.find(
      (o) => wardrobe && wardrobe.standPoint.x >= o.xMin && wardrobe.standPoint.x <= o.xMax && wardrobe.standPoint.feetY >= o.feetMin && wardrobe.standPoint.feetY <= o.feetMax
    );
    check("the wardrobe's own stand point is NOT inside its own obstacle (reachable)", obstacle === undefined);

    check("mentor NPC appearance is valid against the same catalogue a player uses (Part 11: no duplicate system)", isValidAppearance(MENTOR_APPEARANCE));
    check("mentor NPC personality is valid against the same catalogue a player uses", isValidPersonality(MENTOR_PERSONALITY));
  });

  // -------------------------------------------------------------------------
  section("7. Shared rig / animation pose engine (Part 9, Part 13 'shared skeleton compatibility')", () => {
    // Regression guard, not an exact-count check — Milestone 20C added 6
    // more poses (write/type/think/talk/coffee/sit) on top of these
    // original 8, which is expected growth, not a broken assertion. What
    // this phase's brief actually needs preserved is that its own 8 never
    // got REMOVED.
    const originalPhase20bPoses: PoseName[] = ["idle", "walk", "turn", "wave", "lookAround", "stretch", "read", "wardrobePreview"];
    check("all 8 named poses from the 20B brief still exist", originalPhase20bPoses.every((p) => POSE_NAMES.includes(p)));
    for (const pose of POSE_NAMES) {
      const t = computePose(pose, 1.23, {});
      const joints = [t.head, t.armLeft, t.armRight, t.legLeft, t.legRight];
      const allFinite = joints.every((j) => Number.isFinite(j.rotX) && Number.isFinite(j.rotY) && Number.isFinite(j.rotZ)) && Number.isFinite(t.bodyBobY);
      check(`pose "${pose}" produces finite values for every one of the 5 shared joints (same set for player + any NPC)`, allFinite);
    }

    // t=0 is a degenerate instant for both poses (every sine term in
    // characterRig.ts evaluates to sin(0)=0, so idle and walk are
    // legitimately identical — an all-neutral rest pose — at that single
    // instant). A non-zero time is needed to actually distinguish them.
    const idleAt0 = computePose("idle", 0.3, {});
    const walkAt0 = computePose("walk", 0.3, {});
    check("idle and walk produce a different arm/leg transform at the same non-zero instant (they're not the same pose in disguise)", JSON.stringify(idleAt0) !== JSON.stringify(walkAt0));

    const blended = blendPoseTransforms(idleAt0, walkAt0, 0.5);
    check("blendPoseTransforms at t=0.5 lands between the two inputs (not clamped to either end)", blended.legLeft.rotX === (idleAt0.legLeft.rotX + walkAt0.legLeft.rotX) / 2);
    check("blendPoseTransforms at t=0 exactly reproduces the FROM pose", JSON.stringify(blendPoseTransforms(idleAt0, walkAt0, 0)) === JSON.stringify(idleAt0));
    check("blendPoseTransforms at t=1 exactly reproduces the TO pose", JSON.stringify(blendPoseTransforms(idleAt0, walkAt0, 1)) === JSON.stringify(walkAt0));

    const blender = createPoseBlender("idle", 0.4);
    check("a fresh blender starts on its initial pose", blender.current === "idle");
    blender.setPose("walk", 10);
    check("setPose updates the current pose", blender.current === "walk");
    const midBlend = blender.update(10.2); // 0.2s into a 0.4s blend
    const idleStillRunning = computePose("idle", 10.2, {});
    const walkNow = computePose("walk", 10.2 - 10, {});
    const isBetween = midBlend.legLeft.rotX !== idleStillRunning.legLeft.rotX && midBlend.legLeft.rotX !== walkNow.legLeft.rotX;
    check("mid-crossfade (0.2s into a 0.4s blend) produces neither the pure old nor pure new pose", isBetween);
    const afterBlend = blender.update(10.5); // past the 0.4s window
    const pureWalk = computePose("walk", 10.5 - 10, {});
    check("once the crossfade window has elapsed, the pose matches the target pose exactly (no leftover blend)", JSON.stringify(afterBlend) === JSON.stringify(pureWalk));

    check("setPose to the SAME pose is a no-op (never restarts a blend into itself)", (() => {
      const b = createPoseBlender("idle");
      b.setPose("idle", 5);
      return b.current === "idle";
    })());
  });

  // -------------------------------------------------------------------------
  section("8. Undo/redo history stack (Part 3, Part 13)", () => {
    let stack = createHistoryStack(0);
    check("fresh stack's current value is the initial value", currentHistoryValue(stack) === 0);
    check("fresh stack cannot undo", !canUndoHistory(stack));
    check("fresh stack cannot redo", !canRedoHistory(stack));

    stack = pushHistory(stack, 1);
    stack = pushHistory(stack, 2);
    stack = pushHistory(stack, 3);
    check("after 3 pushes, current is the last value", currentHistoryValue(stack) === 3);
    check("can undo after pushing", canUndoHistory(stack));

    stack = undoHistory(stack);
    check("undo once goes back one step", currentHistoryValue(stack) === 2);
    stack = undoHistory(stack);
    check("undo twice goes back two steps", currentHistoryValue(stack) === 1);
    check("can redo after undoing", canRedoHistory(stack));

    stack = redoHistory(stack);
    check("redo restores the undone step", currentHistoryValue(stack) === 2);

    stack = undoHistory(stack);
    stack = pushHistory(stack, 99);
    check("pushing after an undo discards the redo branch (standard undo/redo semantics)", !canRedoHistory(stack));
    check("the new push is now current", currentHistoryValue(stack) === 99);

    const atStart = createHistoryStack("x");
    check("undo at the very start is a no-op, never throws or goes out of bounds", currentHistoryValue(undoHistory(atStart)) === "x");
  });

  // -------------------------------------------------------------------------
  section("9. Randomise (Part 3) — deterministic when seeded, always catalogue-valid", () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const a = randomiseAppearance(rngA);
    const b = randomiseAppearance(rngB);
    check("the same seed produces the exact same randomised appearance", JSON.stringify(a) === JSON.stringify(b));
    check("a randomised appearance is always catalogue-valid", isValidAppearance(a));

    const rngC = createSeededRng(7);
    const c = randomiseAppearance(rngC);
    check("a different seed produces a different appearance (not a constant function)", JSON.stringify(a) !== JSON.stringify(c));

    const pRng1 = createSeededRng(100);
    const pRng2 = createSeededRng(100);
    const p1 = randomisePersonality(pRng1);
    const p2 = randomisePersonality(pRng2);
    check("the same seed produces the exact same randomised personality", JSON.stringify(p1) === JSON.stringify(p2));
    check("a randomised personality is always catalogue-valid (never duplicates the primary into secondaries)", isValidPersonality(p1));

    let anyNullJacket = false;
    let anyRealJacket = false;
    for (let seed = 0; seed < 40; seed++) {
      const appearance = randomiseAppearance(createSeededRng(seed));
      if (appearance.jacketId === null) anyNullJacket = true;
      else anyRealJacket = true;
      if (!findOption("jacket", appearance.jacketId ?? "") && appearance.jacketId !== null) {
        check(`randomised jacketId at seed ${seed} is either null or a real catalogue id`, false);
      }
    }
    check("randomised jacket is sometimes null and sometimes a real jacket across many seeds (not always-on or always-off)", anyNullJacket && anyRealJacket);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
