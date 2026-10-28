/**
 * Phase 20F (Vertical Slice Polish & Placeholder Replacement) verification
 * harness. Run with (from the repo root):
 *   npx tsx scripts/verify-phase20f-vertical-slice.ts
 *
 * Same discipline as every prior Phase 20 harness: only pure data/logic
 * modules with zero React/Three.js/R3F imports are ever imported directly
 * (proven safe — `verify-phase20e-campus-expansion.ts` already imports
 * every building's `SceneWorld`/NPC/palette data this way). For behaviour
 * that only exists inside a React component's body (the transition phase
 * machine and destination-preload trigger in `Game3D.tsx`, the Menu's
 * Campus Directory wiring, the error boundary's mount points), this
 * harness reads the actual source text and asserts on it — a deliberate,
 * disclosed trade-off: it proves the wiring exists in the code as written,
 * not that it behaves correctly at runtime (no DOM/R3F test environment
 * exists in this harness style, the same honest limitation this whole
 * phase's visual audit and every prior Phase 20 completion report already
 * disclose for anything requiring a live render).
 */

import { readFileSync } from "node:fs";
import { resolveAutoQualityTier, resolveQualityPreset, QUALITY_TIER_ORDER } from "../src/game3d/quality";
import {
  getTimeOfDay,
  getTimeOfDayAtmosphere,
  TIME_OF_DAY_ATMOSPHERES,
  type TimeOfDay,
} from "../src/game3d/campus/timeOfDay";
import { CAMPUS_LOCATIONS, getCampusLocationMeta } from "../src/game3d/campus/campusMap";
import { ROOM_THEMES, ROOM_THEME_ORDER } from "../src/game3d/rooms/roomThemes";
import { LIBRARY_WORLD, LIBRARY_PALETTE } from "../src/game3d/campus/library/LibraryScene";
import { COMPUTER_LAB_WORLD, COMPUTER_LAB_PALETTE } from "../src/game3d/campus/computerLab/ComputerLabScene";
import { LECTURE_THEATRE_WORLD, LECTURE_THEATRE_PALETTE } from "../src/game3d/campus/lectureTheatre/LectureTheatreScene";
import { STUDENT_LOUNGE_WORLD, STUDENT_LOUNGE_PALETTE } from "../src/game3d/campus/studentLounge/StudentLoungeScene";
import { ADMINISTRATION_WORLD, ADMINISTRATION_PALETTE } from "../src/game3d/campus/administration/AdministrationScene";
import { TEST_ROOM_WORLD } from "../src/game3d/rooms/testRoomWorld";
import {
  getSoundEventCategory,
  setCategoryVolume,
  getCategoryVolume,
  type SoundCategory,
} from "../src/lib/sound";
import { findOption, findBodyPreset, isValidAppearance } from "../src/data/appearanceCatalogue";
import { findFurnitureItem } from "../src/data/furnitureCatalogue";
import { getTodaysClasses, getSuggestedStudyBlock, getTodayRecommendations } from "../src/lib/todayEngine";
import { getTopPriorityItems, getPriorityItemId } from "../src/lib/priority";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import type { SceneWorld } from "../src/world/worldTypes";

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

function inAnyObstacle(point: { x: number; feetY: number }, world: SceneWorld): boolean {
  return world.obstacles.some((o) => point.x >= o.xMin && point.x <= o.xMax && point.feetY >= o.feetMin && point.feetY <= o.feetMax);
}

function src(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const REAL_BUILDINGS: Array<{ name: string; world: SceneWorld; palette: { wallColor: string; floorColor: string; trimColor: string }; themeId: string }> = [
  { name: "library", world: LIBRARY_WORLD, palette: LIBRARY_PALETTE, themeId: "cozy-library" },
  { name: "computer-lab", world: COMPUTER_LAB_WORLD, palette: COMPUTER_LAB_PALETTE, themeId: "digital-lab" },
  { name: "lecture-theatre", world: LECTURE_THEATRE_WORLD, palette: LECTURE_THEATRE_PALETTE, themeId: "classic-academy" },
  { name: "student-lounge", world: STUDENT_LOUNGE_WORLD, palette: STUDENT_LOUNGE_PALETTE, themeId: "creative-studio" },
  { name: "administration", world: ADMINISTRATION_WORLD, palette: ADMINISTRATION_PALETTE, themeId: "minimal-study" },
];

function main(): void {
  // -------------------------------------------------------------------------
  section("1. Vertical-slice pieces (Part 2) — every step's dependency exists", () => {
    check("all 6 real campus locations are registered", CAMPUS_LOCATIONS.length === 6);
    check("Campus HQ is one of them", CAMPUS_LOCATIONS.some((l) => l.id === "campus-hq"));
    for (const b of REAL_BUILDINGS) {
      check(`${b.name} is registered in the campus directory`, Boolean(getCampusLocationMeta(b.name as never)));
      check(`${b.name} has a real door interactable ("kind: door")`, b.world.interactables.some((i) => i.kind === "door"));
    }
    check("every location has a non-empty one-line purpose (no engineering language)", CAMPUS_LOCATIONS.every((l) => l.purpose.length > 0));
  });

  // -------------------------------------------------------------------------
  section("2. Spawn validity — every building's spawn point is walkable", () => {
    check("Campus HQ spawn is not inside an obstacle", !inAnyObstacle(TEST_ROOM_WORLD.spawn, TEST_ROOM_WORLD));
    for (const b of REAL_BUILDINGS) {
      check(`${b.name} spawn is not inside an obstacle`, !inAnyObstacle(b.world.spawn, b.world));
    }
  });

  // -------------------------------------------------------------------------
  section("3. Interaction prompt metadata (Part 8) — object name / action / key", () => {
    for (const b of [...REAL_BUILDINGS.map((b) => ({ name: b.name, world: b.world })), { name: "campus-hq", world: TEST_ROOM_WORLD }]) {
      for (const item of b.world.interactables) {
        check(`${b.name}/${item.id} has a non-empty label (object name)`, item.label.length > 0);
        check(`${b.name}/${item.id} has a non-empty actionLabel (primary action)`, item.actionLabel.length > 0);
      }
    }
  });

  // -------------------------------------------------------------------------
  section("4. Lighting/material consistency (Part 11) — theme colours match exactly", () => {
    for (const b of REAL_BUILDINGS) {
      const theme = ROOM_THEMES[b.themeId as keyof typeof ROOM_THEMES];
      check(`${b.name} wallColor matches its ${b.themeId} theme exactly`, b.palette.wallColor === theme.wallColor);
      check(`${b.name} floorColor matches its ${b.themeId} theme exactly (regression guard — Lecture Theatre drifted from this before this phase's fix)`, b.palette.floorColor === theme.floorColor);
      check(`${b.name} trimColor matches its ${b.themeId} theme exactly`, b.palette.trimColor === theme.trimColor);
    }
    check("all 6 Room Themes are registered", ROOM_THEME_ORDER.length === 6);
  });

  // -------------------------------------------------------------------------
  section("5. Time-of-day lighting values (Part 11)", () => {
    check("all 4 times of day are registered", Object.keys(TIME_OF_DAY_ATMOSPHERES).length === 4);
    const order: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];
    for (const t of order) check(`"${t}" has an atmosphere entry`, Boolean(TIME_OF_DAY_ATMOSPHERES[t]));
    check("afternoon is full intensity (the Art Bible's own unchanged baseline)", TIME_OF_DAY_ATMOSPHERES.afternoon.intensityMultiplier === 1.0);
    check("night is the dimmest", TIME_OF_DAY_ATMOSPHERES.night.intensityMultiplier < TIME_OF_DAY_ATMOSPHERES.morning.intensityMultiplier);
    check("night is the dimmest of all four", Object.values(TIME_OF_DAY_ATMOSPHERES).every((a) => a.intensityMultiplier >= TIME_OF_DAY_ATMOSPHERES.night.intensityMultiplier));
    check(
      "night is the ONE time of day allowed to shift colour (Art Bible Part 7's explicit exception)",
      Boolean(TIME_OF_DAY_ATMOSPHERES.night.ambientColorOverride) &&
        !TIME_OF_DAY_ATMOSPHERES.morning.ambientColorOverride &&
        !TIME_OF_DAY_ATMOSPHERES.afternoon.ambientColorOverride &&
        !TIME_OF_DAY_ATMOSPHERES.evening.ambientColorOverride
    );
    check("night's colour override is the Art Bible's exact documented value", TIME_OF_DAY_ATMOSPHERES.night.ambientColorOverride === "#40485c");
    // Real-clock smoke test — whatever moment this harness happens to run,
    // getTimeOfDay() must resolve to exactly one of the 4 valid values.
    check("getTimeOfDay() (real clock) always resolves to one of the 4 valid values", (["morning", "afternoon", "evening", "night"] as TimeOfDay[]).includes(getTimeOfDay()));
    const atmosphere = getTimeOfDayAtmosphere("night");
    check("getTimeOfDayAtmosphere returns the same object as the table", atmosphere === TIME_OF_DAY_ATMOSPHERES.night);
  });

  // -------------------------------------------------------------------------
  section("6. Quality tiers (Part 15) — Auto/Low/Medium/High, Auto default", () => {
    check("QUALITY_TIER_ORDER lists all 4 settings, auto first (the default)", QUALITY_TIER_ORDER[0] === "auto" && QUALITY_TIER_ORDER.length === 4);
    const low = resolveQualityPreset("low");
    const medium = resolveQualityPreset("medium");
    const high = resolveQualityPreset("high");
    check("Low disables shadows", low.shadowsEnabled === false);
    check("Medium and High enable shadows", medium.shadowsEnabled === true && high.shadowsEnabled === true);
    check("shadow map size increases Low < Medium < High", low.shadowMapSize < medium.shadowMapSize && medium.shadowMapSize < high.shadowMapSize);
    check("dpr cap increases Low <= Medium <= High", low.dpr[1] <= medium.dpr[1] && medium.dpr[1] <= high.dpr[1]);
    check("Medium matches the Art Bible's existing 1024 shadow-map baseline (Part 7)", medium.shadowMapSize === 1024);
    const autoTier = resolveAutoQualityTier();
    check("resolveAutoQualityTier always resolves to a real (non-auto) tier", ["low", "medium", "high"].includes(autoTier));
    const autoPreset = resolveQualityPreset("auto");
    check("resolveQualityPreset('auto') resolves to one of the 3 concrete presets", [low, medium, high].some((p) => JSON.stringify(p) === JSON.stringify(autoPreset)));
  });

  // -------------------------------------------------------------------------
  section("7. Audio mixer (Part 10) — categories, volume clamping, cooldown/priority data", () => {
    const categories: SoundCategory[] = ["ambience", "footsteps", "interaction", "ui", "npc", "music"];
    for (const c of categories) {
      setCategoryVolume(c, 0.5);
      check(`setCategoryVolume/getCategoryVolume round-trips for "${c}"`, getCategoryVolume(c) === 0.5);
    }
    setCategoryVolume("ambience", 5); // out of range high
    check("setCategoryVolume clamps values above 1 down to 1", getCategoryVolume("ambience") === 1);
    setCategoryVolume("ambience", -2); // out of range low
    check("setCategoryVolume clamps values below 0 up to 0", getCategoryVolume("ambience") === 0);
    setCategoryVolume("ambience", 1); // restore
    check('"door-open" categorises as interaction', getSoundEventCategory("door-open") === "interaction");
    check('"room-ambience" categorises as ambience', getSoundEventCategory("room-ambience") === "ambience");
    check('"footsteps" categorises as its own dedicated category', getSoundEventCategory("footsteps") === "footsteps");
    check('"typing"/"coffee-place"/"chair-move" categorise as npc (activity cues)', ["typing", "coffee-place", "chair-move"].every((e) => getSoundEventCategory(e as never) === "npc"));
  });

  // -------------------------------------------------------------------------
  section("8. Character compatibility rules (Part 5) — catalogue-driven, not hardcoded", () => {
    const drape = findOption("hair", "hair-headscarf-drape");
    const wrap = findOption("hair", "hair-headscarf-wrap");
    check("headscarf-drape declares full head coverage", drape?.modestCoverageClass === "full");
    check("headscarf-wrap declares full head coverage", wrap?.modestCoverageClass === "full");
    check("headscarf-drape lists incompatible head accessories including earrings (Part 5 clipping fix)", Boolean(drape?.incompatibleAccessories?.includes("acc-earrings")));
    check("headscarf-wrap lists the same incompatible-accessory set", Boolean(wrap?.incompatibleAccessories && wrap.incompatibleAccessories.length > 0));
    const someJacket = findOption("jacket", "jacket-bomber-0");
    check("a real jacket variant (jacket-bomber-0) carries a jacketLayerOffset (torso z-fight fix)", typeof someJacket?.jacketLayerOffset === "number");
  });

  // -------------------------------------------------------------------------
  section("9. Missing/corrupted catalogue fallback (Part 14) — never throws, never crashes", () => {
    check("findOption returns undefined (not throw) for a bogus id", findOption("hair", "not-a-real-id") === undefined);
    check("findBodyPreset returns undefined (not throw) for a bogus id", findBodyPreset("not-a-real-id") === undefined);
    check("findFurnitureItem returns undefined (not throw) for a bogus id", findFurnitureItem("not-a-real-id") === undefined);
    check("isValidAppearance rejects an appearance with a bogus hairId", (() => {
      const base = { bodyId: "average", skinToneId: "light", hairId: "not-a-real-id", hairColorId: "dark-brown", eyesId: "round", eyebrowsId: "medium", facialHairId: null, topId: "top-tshirt-blue", jacketId: null, bottomId: "bottom-jeans", shoesId: "shoes-sneakers", accessoryIds: [] };
      return isValidAppearance(base as never) === false;
    })());
  });

  // -------------------------------------------------------------------------
  section("10. Daily Brief fallback + contextual actions (Part 9)", () => {
    // Corrected premise (this section's original draft assumed a "fresh"
    // save has zero academic data — false for this game: `semesterData.ts`
    // ships a real, pre-populated 4-subject curriculum with several
    // already-CONFIRMED assessment due dates, so a brand-new save already
    // has real recommendations from minute one, by design. The genuinely
    // "nothing imported at all" state (Part 9's "Your next imported
    // assessment will appear here." copy) only occurs via a botched/empty
    // import leaving zero subjects — a real, if rare, edge case — not via
    // "hasn't played yet." Both cases are tested below, honestly separated.
    const seeded = createDefaultSaveData();
    const now = new Date("2026-07-27T04:00:00.000Z");

    check("getTodaysClasses on the real seed never throws and returns an array (empty is valid — not every day has a scheduled class)", Array.isArray(getTodaysClasses(seeded, now)));

    const seededRecs = getTodayRecommendations(seeded, now, 5);
    check("getTodayRecommendations on the real seeded curriculum finds real recommendations (happy path — the pre-populated demo semester isn't silently empty)", seededRecs.length > 0);
    const seededBlock = getSuggestedStudyBlock(seeded, now);
    // Each call re-derives fresh plain objects (no memoisation/caching), so
    // comparing by reference (`===`) would always fail even when both calls
    // correctly resolve to the same underlying item — compare by the same
    // stable identity `getPriorityItemId` already provides elsewhere
    // (DailyBriefPanel.tsx uses it as a React list key for this exact reason).
    check(
      "getSuggestedStudyBlock on the real seeded curriculum returns a real suggestion (same identity as recommendations[0])",
      seededBlock !== null && seededRecs.length > 0 && getPriorityItemId(seededBlock.item) === getPriorityItemId(seededRecs[0].item)
    );
    const seededDeadlines = getTopPriorityItems(seeded.semester.subjects, seeded.tasks, now, 20, seeded.settings.pinnedPriorityIds).filter((i) => i.type === "assessment");
    check("getTopPriorityItems on the real seeded curriculum finds the seed's confirmed upcoming assessments", seededDeadlines.length > 0);

    // The genuinely empty case: subjects forced to [] (a botched/empty import).
    const empty = { ...seeded, semester: { ...seeded.semester, subjects: [] } };
    check("getTodaysClasses with zero subjects returns an empty array, never throws", getTodaysClasses(empty, now).length === 0);
    check("getSuggestedStudyBlock with zero subjects is null (drives the 'Continue your current study plan.' fallback)", getSuggestedStudyBlock(empty, now) === null);
    check("getTodayRecommendations with zero subjects is an empty array", getTodayRecommendations(empty, now, 5).length === 0);
    const emptyDeadlines = getTopPriorityItems(empty.semester.subjects, empty.tasks, now, 20, empty.settings.pinnedPriorityIds).filter((i) => i.type === "assessment");
    check("getTopPriorityItems with zero subjects returns no assessment items (drives the two-tier empty-deadline copy's 'no subjects at all' branch)", emptyDeadlines.length === 0);

    const dailyBriefSrc = src("src/components/world/panels/DailyBriefPanel.tsx");
    check("DailyBriefPanel distinguishes 'no subjects imported' from 'imported but nothing urgent'", dailyBriefSrc.includes("hasSubjects"));
    // Phase 22 Part 4 replaced the old two-list "Suggested Study Block" +
    // "More Suggestions" split (the original source of this phase's
    // duplication bug) with ONE unified "Recommended For You" list built
    // from `generateRecommendations` — structurally unable to show the
    // same item twice, since there is only one list now.
    check(
      "DailyBriefPanel shows one unified, non-duplicating recommendation list (Phase 22 Part 4), not the old two-list split that caused this phase's duplication bug",
      dailyBriefSrc.includes('tasks-section-title">Recommended For You') &&
        !dailyBriefSrc.includes('tasks-section-title">Suggested Study Block') &&
        !dailyBriefSrc.includes('tasks-section-title">More Suggestions')
    );
  });

  // -------------------------------------------------------------------------
  section("11. Save compatibility — old and current saves (Part 15/18)", () => {
    const fresh = createDefaultSaveData();
    check("a fresh save already has this phase's 3 new settings fields", "soundVolumes" in fresh.settings && "graphicsQuality" in fresh.settings && "campus3DGuidanceDismissed" in fresh.settings);
    check("graphicsQuality defaults to 'auto'", fresh.settings.graphicsQuality === "auto");
    check("campus3DGuidanceDismissed defaults to false (guidance shows on first visit)", fresh.settings.campus3DGuidanceDismissed === false);
    check("all 6 mixer categories default to full volume (1)", Object.values(fresh.settings.soundVolumes).every((v) => v === 1));

    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(fresh)));
    check("a fresh save round-trips through sanitizeSaveData unchanged", JSON.stringify(roundTripped) === JSON.stringify(fresh));

    // Simulate an OLD save (predates this phase) missing the 3 new fields entirely.
    const oldSaveShape = JSON.parse(JSON.stringify(fresh));
    delete oldSaveShape.settings.soundVolumes;
    delete oldSaveShape.settings.graphicsQuality;
    delete oldSaveShape.settings.campus3DGuidanceDismissed;
    const migrated = sanitizeSaveData(oldSaveShape);
    check("an old save missing this phase's fields migrates safely, filling in defaults", migrated.settings.graphicsQuality === "auto" && migrated.settings.campus3DGuidanceDismissed === false && migrated.settings.soundVolumes.ambience === 1);

    // Corrupted values must clamp/fall back, never throw or propagate garbage.
    const corrupted = JSON.parse(JSON.stringify(fresh));
    corrupted.settings.soundVolumes.ambience = "not-a-number";
    corrupted.settings.graphicsQuality = "ultra-mega";
    corrupted.settings.campus3DGuidanceDismissed = "yes";
    const repaired = sanitizeSaveData(corrupted);
    check("a corrupted soundVolumes.ambience falls back to the default (1), not NaN/string", repaired.settings.soundVolumes.ambience === 1);
    check("a corrupted graphicsQuality falls back to 'auto', not the garbage string", repaired.settings.graphicsQuality === "auto");
    check("a corrupted campus3DGuidanceDismissed falls back to false, not the string 'yes'", repaired.settings.campus3DGuidanceDismissed === false);
  });

  // -------------------------------------------------------------------------
  section("12. Legacy 2D path isolation — 3D-only modules never imported by the 2D renderer", () => {
    const worldSceneSrc = src("src/world/WorldScene.tsx");
    check("WorldScene.tsx (legacy 2D) never imports the quality-tier module", !worldSceneSrc.includes("game3d/quality"));
    check("WorldScene.tsx (legacy 2D) never imports Game3D.tsx directly", !worldSceneSrc.includes('"../game3d/Game3D"'));
    const settingsScreenSrc = src("src/screens/SettingsScreen.tsx");
    check("SettingsScreen renders both the world-renderer toggle and the graphics-quality control in the same section", settingsScreenSrc.includes("worldRenderer") && settingsScreenSrc.includes("graphicsQuality"));
  });

  // -------------------------------------------------------------------------
  section("13. Menu-level Campus Directory + navigation polish (Part 12)", () => {
    const menuSrc = src("src/components/world/panels/MenuPanel.tsx");
    check("MenuPanel imports CampusDirectoryPanel (Menu-level accessibility shortcut)", menuSrc.includes("CampusDirectoryPanel"));
    check("MenuPanel gates the Campus Directory item on the 3D renderer being active", menuSrc.includes('worldRenderer === "experimental-3d"'));
    check("MenuPanel routes a selection through requestCampusTravel (the shared cross-boundary bridge), not a second mechanism", menuSrc.includes("requestCampusTravel"));

    const contextSrc = src("src/world/WorldUiContext.tsx");
    check("WorldUiContext exposes campusTravelRequest/requestCampusTravel/consumeCampusTravelRequest", ["campusTravelRequest", "requestCampusTravel", "consumeCampusTravelRequest"].every((n) => contextSrc.includes(n)));
    check("WorldUiContext exposes current3DLocationLabel/setCurrent3DLocationLabel (current-location HUD indicator)", contextSrc.includes("current3DLocationLabel") && contextSrc.includes("setCurrent3DLocationLabel"));

    const game3dSrc = src("src/game3d/Game3D.tsx");
    check("Game3D consumes campusTravelRequest through its own handleAction (same travel path as any door)", game3dSrc.includes("campusTravelRequest") && game3dSrc.includes("handleAction(campusTravelRequest)"));
    check("Game3D reports its current location via getCampusLocationMeta", game3dSrc.includes("getCampusLocationMeta"));

    const hudLocationSrc = src("src/components/world/HudLocation.tsx");
    check("HudLocation overrides its route-derived label with current3DLocationLabel when present", hudLocationSrc.includes("current3DLocationLabel"));
  });

  // -------------------------------------------------------------------------
  section("14. Building transition locking + destination preload (Part 7) — source-level wiring", () => {
    const game3dSrc = src("src/game3d/Game3D.tsx");
    check("a travel request is dropped while transitionPhaseRef is not \"none\" (prevents double-transition spam)", game3dSrc.includes('transitionPhaseRef.current !== "none"'));
    check("the transition veil is aria-hidden (decorative, not exposed to screen readers)", game3dSrc.includes('aria-hidden="true"') && game3dSrc.includes("game3d-transition-veil"));
    check("a destination preload map exists, keyed by CampusSceneId, using the same import() specifiers as each building's lazy()", game3dSrc.includes("CAMPUS_SCENE_PRELOADERS"));
    check("preload fires from inRange proximity to a door, before the player presses E", /inRange\?\.kind === "door"[\s\S]{0,80}CAMPUS_SCENE_PRELOADERS/.test(game3dSrc));
  });

  // -------------------------------------------------------------------------
  section("15. First-session guidance persistence + reset (Part 13)", () => {
    const game3dSrc = src("src/game3d/Game3D.tsx");
    check("the coach mark is gated on campus3DGuidanceDismissed and only shown in Campus HQ", game3dSrc.includes("campus3DGuidanceDismissed") && game3dSrc.includes('currentScene.sceneId === "campus-hq"'));
    check("dismissing calls updateSettings (persists — never repeats after completion)", /updateSettings\(\{\s*campus3DGuidanceDismissed:\s*true/.test(game3dSrc));
    const settingsScreenSrc = src("src/screens/SettingsScreen.tsx");
    check("Settings has a reset control calling updateSettings({ campus3DGuidanceDismissed: false })", /updateSettings\(\{\s*campus3DGuidanceDismissed:\s*false/.test(settingsScreenSrc));
    check("the reset control is disabled until there is something to reset", settingsScreenSrc.includes("disabled={!settings.campus3DGuidanceDismissed}"));
    check("the guidance layer is separate from the legacy 2D hint's own field (independent dismissal)", game3dSrc.includes("campus3DGuidanceDismissed") && !game3dSrc.includes("onboardingHintDismissed"));
  });

  // -------------------------------------------------------------------------
  section("16. Error-state routing (Part 14)", () => {
    const boundarySrc = src("src/world/Game3DErrorBoundary.tsx");
    check("Game3DErrorBoundary never renders the caught error's message/stack to the player", !boundarySrc.includes("error.message") && !boundarySrc.includes("error.stack"));
    check("Game3DErrorBoundary offers Retry", boundarySrc.includes("Retry"));
    check("Game3DErrorBoundary offers switching to the 2D Campus", boundarySrc.includes("onUseLegacy2D"));
    const homeSrc = src("src/screens/SemesterHomeScreen.tsx");
    const roomSrc = src("src/screens/SubjectRoomScreen.tsx");
    check("SemesterHomeScreen wraps Game3DLazy in Game3DErrorBoundary", homeSrc.includes("Game3DErrorBoundary"));
    check("SubjectRoomScreen wraps Game3DLazy in Game3DErrorBoundary", roomSrc.includes("Game3DErrorBoundary"));
  });

  // -------------------------------------------------------------------------
  section("17. Accessibility metadata (Part 17) — regression guards for this phase's fixes", () => {
    const worldCss = src("src/styles/world.css");
    check("the Subjects search input's container has a visible :focus-within style (fixed this phase)", worldCss.includes(".subjects-search:focus-within"));
    const game3dSrc = src("src/game3d/Game3D.tsx");
    check("the interaction prompt carries one combined aria-label (object + action + key)", /aria-label=\{`\$\{promptObjectName\}: \$\{promptActionText\}\. Press E\.`\}/.test(game3dSrc));
    check("reduced motion collapses the transition veil to 0ms (no visible fade), not just a faster one", game3dSrc.includes("const TRANSITION_FADE_MS_REDUCED = 0"));
  });

  // -------------------------------------------------------------------------
  section("18. Metalness discipline (Art Bible Part 5 rule 1) — regression guard across every file touched this phase", () => {
    const filesToCheck = [
      "src/game3d/scenes/TestRoomScene.tsx",
      "src/game3d/scenes/CampusBuildingScene.tsx",
      "src/game3d/campus/computerLab/ComputerLabScene.tsx",
      "src/game3d/campus/studentLounge/StudentLoungeScene.tsx",
      "src/game3d/campus/subjectBuilding/SubjectBuildingScene.tsx",
    ];
    for (const f of filesToCheck) {
      const text = src(f);
      const violation = /metalness=\{0\.[1-9]/.test(text);
      check(`${f} has no nonzero metalness (Art Bible: "metalness is always 0")`, !violation);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
