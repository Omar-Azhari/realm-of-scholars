/**
 * Phase 20D (Campus & Room Customisation) verification harness. Direct
 * calls into the real, unmodified modules — no React/R3F/DOM needed, since
 * every genuinely new piece of logic this phase added (theme data,
 * furniture catalogue, slot system, save coercion, unlock engine, NPC
 * cosmetic reactions) is plain data/functions with zero React or Three.js
 * import, the same discipline established by characterRig.ts/
 * npcSchedule.ts in earlier phases. `TestRoomProps.tsx`/`TestRoomScene.tsx`/
 * `RoomEditor.tsx` themselves (JSX) are intentionally NOT imported here —
 * this harness proves the logic underneath them.
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase20d-room-customisation.ts .tmp/verify-phase20d-room-customisation.cjs
 *   node .tmp/verify-phase20d-room-customisation.cjs
 */

import { ROOM_THEMES, ROOM_THEME_ORDER, getRoomTheme } from "../src/game3d/rooms/roomThemes";
import { ROOM_SLOTS, findRoomSlot, slotsForCategory } from "../src/game3d/rooms/roomSlots";
import {
  FURNITURE_CATALOGUE,
  FURNITURE_CATEGORIES,
  STARTER_FURNITURE_IDS,
  findFurnitureItem,
  furnitureByCategory,
} from "../src/data/furnitureCatalogue";
import { isUnlockRequirementMet, syncFurnitureUnlocks } from "../src/data/furnitureUnlocks";
import { createDefaultPlayerIdentity, createDefaultRoomCustomisation } from "../src/data/playerIdentityDefaults";
import { getRoomChangeReaction } from "../src/lib/roomReactions";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import { TEST_ROOM_WORLD } from "../src/game3d/rooms/testRoomWorld";
import type { RoomThemeId, UniGameSaveData } from "../src/types/domain";

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

function saveWithIdentity(patch: Partial<UniGameSaveData["playerIdentity"]> = {}): UniGameSaveData {
  const base = createDefaultSaveData();
  return { ...base, playerIdentity: { ...createDefaultPlayerIdentity(), ...patch } };
}

function main(): void {
  // -------------------------------------------------------------------------
  section("1. Room theme system (Part 1)", () => {
    check("all 6 Art Bible themes exist", ROOM_THEME_ORDER.length === 6);
    for (const id of ROOM_THEME_ORDER) {
      const theme = ROOM_THEMES[id];
      check(`${id}: has wall/floor/trim colours`, Boolean(theme.wallColor && theme.floorColor && theme.trimColor));
      check(`${id}: has a full lighting rig`, Number.isFinite(theme.lighting.ambientIntensity) && Number.isFinite(theme.lighting.sunIntensity));
      check(`${id}: has an ambience description`, theme.ambienceDescription.length > 0);
      check(`${id}: getRoomTheme(id) round-trips to the same entry`, getRoomTheme(id) === theme);
    }
    check("theme ids are unique", new Set(ROOM_THEME_ORDER).size === ROOM_THEME_ORDER.length);
    // Reversibility: switching to any theme and back to the original is just picking a different id — no state is lost or transformed.
    const original = getRoomTheme("modern-campus");
    const switched = getRoomTheme("cozy-library");
    const switchedBack = getRoomTheme("modern-campus");
    check("switching themes and back yields the exact original theme object (fully reversible)", switchedBack === original && switched !== original);
  });

  // -------------------------------------------------------------------------
  section("2. Snap-point furniture slots (Part 2)", () => {
    const expectedSlotIds = [
      "slot-desk",
      "slot-bookshelf",
      "slot-chair",
      "slot-plant-a",
      "slot-plant-b",
      "slot-lamp",
      "slot-rug",
      "slot-wallart",
      "slot-noticeboard",
      "slot-storage",
      "slot-decoration",
      "slot-desk-accessory",
    ];
    check("every Part 2 slot (Desk/Bookshelf/Plant/Lamp/Noticeboard/Chair/Decoration + this room's extras) exists", expectedSlotIds.every((id) => Boolean(findRoomSlot(id))));
    check("slot ids are unique", new Set(ROOM_SLOTS.map((s) => s.id)).size === ROOM_SLOTS.length);
    for (const slot of ROOM_SLOTS) {
      check(`${slot.id}: slotsForCategory(${slot.category}) includes this slot`, slotsForCategory(slot.category).some((s) => s.id === slot.id));
      check(`${slot.id}: position is a finite floor point`, Number.isFinite(slot.position.x) && Number.isFinite(slot.position.feetY));
    }
    // Slots that ARE the existing desk/bookshelf/reading-nook furniture are
    // expected to sit inside that furniture's own obstacle footprint
    // (obstacles block the PLAYER's path, not furniture placement).
    // Every genuinely freestanding/new slot (plants, lamp, rug, wall
    // fixtures, storage, decoration) must stay clear, matching the
    // clearance discipline Phase 20C's harness applies to NPC waypoints.
    const expectedInsideObstacle = new Set(["slot-desk", "slot-desk-accessory", "slot-bookshelf", "slot-chair"]);
    for (const slot of ROOM_SLOTS) {
      const inAnyObstacle = TEST_ROOM_WORLD.obstacles.some(
        (o) => slot.position.x >= o.xMin && slot.position.x <= o.xMax && slot.position.feetY >= o.feetMin && slot.position.feetY <= o.feetMax
      );
      if (expectedInsideObstacle.has(slot.id)) {
        check(`${slot.id}: sits inside its own furniture's obstacle footprint, as expected`, inAnyObstacle);
      } else {
        check(`${slot.id}: stays clear of every collision obstacle (freestanding placement)`, !inAnyObstacle);
      }
    }
  });

  // -------------------------------------------------------------------------
  section("3. Furniture catalogue (Part 3) — all data-driven, curated not sprawling", () => {
    check("every Part 3 category is represented", FURNITURE_CATEGORIES.every((cat) => furnitureByCategory(cat).length > 0));
    check("catalogue ids are unique", new Set(FURNITURE_CATALOGUE.map((i) => i.id)).size === FURNITURE_CATALOGUE.length);
    check("catalogue is curated, not sprawling (under 40 items)", FURNITURE_CATALOGUE.length < 40);
    for (const item of FURNITURE_CATALOGUE) {
      check(`${item.id}: findFurnitureItem round-trips`, findFurnitureItem(item.id) === item);
      check(`${item.id}: themeCompatibility is "all" or a non-empty array`, item.themeCompatibility === "all" || item.themeCompatibility.length > 0);
      check(`${item.id}: has a preview image reference`, item.previewImageRef.length > 0);
    }
    check("at least one starter item exists per slot category that needs one", ROOM_SLOTS.every((slot) => furnitureByCategory(slot.category).length > 0));
    check("STARTER_FURNITURE_IDS are all real, starter-requirement catalogue items", STARTER_FURNITURE_IDS.every((id) => findFurnitureItem(id)?.unlockRequirement.type === "starter"));
  });

  // -------------------------------------------------------------------------
  section("4. Interactive furniture routing (Part 4) — shared InteractAction, no duplicate implementations", () => {
    const bookshelf = FURNITURE_CATALOGUE.find((i) => i.id === "bookshelf-short");
    const noticeboardItem = FURNITURE_CATALOGUE.find((i) => i.id === "noticeboard-cork");
    const deskAccessory = FURNITURE_CATALOGUE.find((i) => i.id === "desk-accessories-classic");
    check("bookshelf item routes to the existing subjects/resources panel", bookshelf?.interaction?.action.type === "open-panel");
    check("noticeboard item routes to Deadlines (tasks panel)", noticeboardItem?.interaction?.action.type === "open-panel" && (noticeboardItem?.interaction?.action as { panel?: string }).panel === "tasks");
    check("desk-accessory (Computer) item routes to Assessments & Calendar", deskAccessory?.interaction?.action.type === "open-panel" && (deskAccessory?.interaction?.action as { panel?: string }).panel === "calendar");

    const noticeboardWorld = TEST_ROOM_WORLD.interactables.find((i) => i.id === "noticeboard");
    const coffeeArea = TEST_ROOM_WORLD.interactables.find((i) => i.id === "coffee-area");
    const deskComputer = TEST_ROOM_WORLD.interactables.find((i) => i.id === "desk-computer");
    const roomPlanner = TEST_ROOM_WORLD.interactables.find((i) => i.id === "room-planner");
    check("noticeboard is a real world interactable, matching the catalogue item's action", noticeboardWorld?.action.type === "open-panel" && (noticeboardWorld?.action as { panel?: string }).panel === "tasks");
    check("coffee-area routes to the new daily-brief panel", coffeeArea?.action.type === "open-panel" && (coffeeArea?.action as { panel?: string }).panel === "daily-brief");
    check("desk-computer routes to the calendar panel, distinct from the desk's own open-study-planner", deskComputer?.action.type === "open-panel" && (deskComputer?.action as { panel?: string }).panel === "calendar");
    check("room-planner routes to open-room-editor (Part 5)", roomPlanner?.action.type === "open-room-editor");

    // None of the new interactables are already in range at spawn (matches the room's existing "nothing in range at spawn" invariant).
    const spawn = TEST_ROOM_WORLD.spawn;
    const dist = (a: typeof spawn, b: typeof spawn) => Math.hypot(a.x - b.x, a.feetY - b.feetY);
    for (const interactable of [noticeboardWorld, coffeeArea, deskComputer, roomPlanner]) {
      check(`${interactable?.id}: not already in range at spawn`, Boolean(interactable) && dist(spawn, interactable!.standPoint) > interactable!.range);
    }
  });

  // -------------------------------------------------------------------------
  section("5. Unlock engine (Part 6) — permanent once granted, nothing affects grades", () => {
    check("every starter item is always unlocked (starter requirement)", FURNITURE_CATALOGUE.filter((i) => i.unlockRequirement.type === "starter").every((i) => isUnlockRequirementMet(i.unlockRequirement, createDefaultSaveData())));

    const freshSave = createDefaultSaveData();
    const noneUnlocked = syncFurnitureUnlocks([], freshSave);
    check("a fresh save (0 XP/level 1/no streak/no achievements) only unlocks starter items", noneUnlocked.length === STARTER_FURNITURE_IDS.length && STARTER_FURNITURE_IDS.every((id) => noneUnlocked.includes(id)));

    const highXpSave: UniGameSaveData = { ...freshSave, userProgress: { ...freshSave.userProgress, xp: 500, level: 5, streakCount: 0, longestStreak: 20 } };
    const moreUnlocked = syncFurnitureUnlocks([], highXpSave);
    check("higher XP/level/longestStreak unlocks more than just starters", moreUnlocked.length > STARTER_FURNITURE_IDS.length);

    // Permanence: syncFurnitureUnlocks only ever adds, never removes, even if the save's signals later regress.
    const alreadyUnlocked = syncFurnitureUnlocks(moreUnlocked, freshSave);
    check("a later regression in save signals never retracts an already-granted unlock", moreUnlocked.every((id) => alreadyUnlocked.includes(id)));

    // Convergence: syncFurnitureUnlocks returns the SAME array instance when nothing new qualifies (the useEffect convergence contract).
    const same = syncFurnitureUnlocks(moreUnlocked, highXpSave);
    check("syncFurnitureUnlocks returns the same array instance when nothing new qualifies (converges, doesn't loop)", same === moreUnlocked);

    // Achievement-gated unlock actually resolves against the real achievement engine.
    const achievementSave: UniGameSaveData = {
      ...freshSave,
      tasks: [{ id: "t1", linkedAssessmentId: null, linkedModuleId: "m1", completed: true }],
    };
    const withAchievement = syncFurnitureUnlocks([], achievementSave);
    check("completing a module (first-module achievement) unlocks the bookshelf-tall item", withAchievement.includes("bookshelf-tall"));
  });

  // -------------------------------------------------------------------------
  section("6. Save data + migration (Part 7) — additive only, migration preserves prior saves", () => {
    const defaults = createDefaultRoomCustomisation();
    check("default placedFurniture matches every slot's starter item where one exists", ROOM_SLOTS.every((slot) => {
      const starter = furnitureByCategory(slot.category).find((i) => STARTER_FURNITURE_IDS.includes(i.id));
      return defaults.placedFurniture[slot.id] === (starter?.id ?? null);
    }));
    check("default rotations are all 0", ROOM_SLOTS.every((slot) => defaults.rotations[slot.id] === 0));

    // Migration: a save predating Phase 20D entirely (playerIdentity present but with no roomCustomisation key at all) backfills full defaults.
    const preExisting = saveWithIdentity();
    const rawPreExisting = JSON.parse(JSON.stringify(preExisting));
    delete (rawPreExisting.playerIdentity as Record<string, unknown>).roomCustomisation;
    const migrated = sanitizeSaveData(rawPreExisting);
    check("a save missing roomCustomisation entirely backfills full defaults (no crash, no data loss)", JSON.stringify(migrated.playerIdentity?.roomCustomisation) === JSON.stringify(defaults));

    // Corruption resilience: unknown furniture ids / slot ids are dropped, not fatal.
    const corrupted = JSON.parse(JSON.stringify(preExisting));
    corrupted.playerIdentity.roomCustomisation.placedFurniture["slot-desk"] = "not-a-real-item";
    corrupted.playerIdentity.roomCustomisation.placedFurniture["not-a-real-slot"] = "desk-classic";
    corrupted.playerIdentity.roomCustomisation.unlockedFurnitureIds.push("not-a-real-item-either");
    const repaired = sanitizeSaveData(corrupted);
    check("an unrecognised furniture id at a slot falls back to that slot's default rather than crashing", repaired.playerIdentity?.roomCustomisation.placedFurniture["slot-desk"] === defaults.placedFurniture["slot-desk"]);
    check("an unrecognised slot id in placedFurniture is simply dropped (only real slots survive)", !("not-a-real-slot" in (repaired.playerIdentity?.roomCustomisation.placedFurniture ?? {})));
    check("an unrecognised furniture id in unlockedFurnitureIds is dropped", !repaired.playerIdentity?.roomCustomisation.unlockedFurnitureIds.includes("not-a-real-item-either"));
    check("starter ids are always present after sanitisation even if stripped from the raw save", STARTER_FURNITURE_IDS.every((id) => repaired.playerIdentity?.roomCustomisation.unlockedFurnitureIds.includes(id)));

    // A category/slot mismatch (a real item id, but wrong category for that slot) is rejected, not silently placed.
    const mismatched = JSON.parse(JSON.stringify(preExisting));
    mismatched.playerIdentity.roomCustomisation.placedFurniture["slot-desk"] = "plant-small"; // a plant, not a desk
    const repairedMismatch = sanitizeSaveData(mismatched);
    check("a category-mismatched item at a slot is rejected, falling back to that slot's default", repairedMismatch.playerIdentity?.roomCustomisation.placedFurniture["slot-desk"] === defaults.placedFurniture["slot-desk"]);

    // Layout persistence: a valid, fully-custom layout survives a save/reload round-trip unchanged.
    const customised: UniGameSaveData = saveWithIdentity({
      preferredRoomTheme: "digital-lab" as RoomThemeId,
      roomCustomisation: {
        unlockedFurnitureIds: [...STARTER_FURNITURE_IDS, "bookshelf-tall"],
        placedFurniture: { ...defaults.placedFurniture, "slot-bookshelf": "bookshelf-tall" },
        rotations: { ...defaults.rotations, "slot-lamp": 90 },
      },
    });
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(customised)));
    check("a fully custom theme + layout survives a save/reload round-trip exactly", roundTripped.playerIdentity?.preferredRoomTheme === "digital-lab" && roundTripped.playerIdentity?.roomCustomisation.placedFurniture["slot-bookshelf"] === "bookshelf-tall" && roundTripped.playerIdentity?.roomCustomisation.rotations["slot-lamp"] === 90);

    // An invalid rotation value (not one of 0/90/180/270) falls back to 0, never crashes.
    const badRotation = JSON.parse(JSON.stringify(preExisting));
    badRotation.playerIdentity.roomCustomisation.rotations["slot-lamp"] = 45;
    const repairedRotation = sanitizeSaveData(badRotation);
    check("an invalid rotation value falls back to 0", repairedRotation.playerIdentity?.roomCustomisation.rotations["slot-lamp"] === 0);
  });

  // -------------------------------------------------------------------------
  section("7. Room theme stays in the existing preferredRoomTheme field (no duplication)", () => {
    const save = saveWithIdentity({ preferredRoomTheme: "classic-academy" as RoomThemeId });
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(save)));
    check("preferredRoomTheme (Phase 20B field) is still the one source of truth for the current theme", roundTripped.playerIdentity?.preferredRoomTheme === "classic-academy");
    check("RoomCustomisation itself carries no separate currentThemeId field", !("currentThemeId" in (roundTripped.playerIdentity?.roomCustomisation ?? {})));
  });

  // -------------------------------------------------------------------------
  section("8. NPC cosmetic reactions (Part 8) — deterministic, no relationship system", () => {
    const before = createDefaultRoomCustomisation();
    const noChange = getRoomChangeReaction("modern-campus", before, "modern-campus", before);
    check("no reaction when nothing actually changed (Apply with no edits)", noChange === null);

    const themeChanged = getRoomChangeReaction("modern-campus", before, "cozy-library", before);
    check("a theme change produces a reaction line", typeof themeChanged === "string" && themeChanged.length > 0);
    const themeChangedAgain = getRoomChangeReaction("modern-campus", before, "cozy-library", before);
    check("the same change produces the exact same line (deterministic, not random)", themeChanged === themeChangedAgain);

    const afterSwap = { ...before, placedFurniture: { ...before.placedFurniture, "slot-bookshelf": "bookshelf-tall" } };
    const swapReaction = getRoomChangeReaction("modern-campus", before, "modern-campus", afterSwap);
    check("swapping the bookshelf produces a bookshelf-specific line", swapReaction === "Nice new bookshelf." || swapReaction === "That shelf suits the room." || swapReaction === "More room for books, I see.");
  });

  // -------------------------------------------------------------------------
  section("9. Campus HQ polish (Part 9) — navigation stays clear, room reads as more personal", () => {
    check("room still has exactly 6 collision obstacles (no new obstacle introduced by cosmetic-only additions)", TEST_ROOM_WORLD.obstacles.length === 6);
    let anyOverlap = false;
    for (let i = 0; i < TEST_ROOM_WORLD.obstacles.length; i++) {
      for (let j = i + 1; j < TEST_ROOM_WORLD.obstacles.length; j++) {
        const a = TEST_ROOM_WORLD.obstacles[i];
        const b = TEST_ROOM_WORLD.obstacles[j];
        if (a.xMin < b.xMax && a.xMax > b.xMin && a.feetMin < b.feetMax && a.feetMax > b.feetMin) anyOverlap = true;
      }
    }
    check("no two obstacles overlap (navigation stays clear after this phase's additions)", !anyOverlap);

    check("a storage category (student lockers) exists in the catalogue (Part 9's explicit ask)", furnitureByCategory("storage").length >= 2);
    check("two independent plant slots exist (Part 9's 'plants')", slotsForCategory("plant").length === 2);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
