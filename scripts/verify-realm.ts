/**
 * Realm of Scholars verification harness.
 * Run with (from the repo root):
 *   npx tsx scripts/verify-realm.ts
 *
 * Exercises the pure game logic directly: XP curve, curriculum
 * normalisation, question generation, outline parsing, world generation
 * (including that every interactable is reachable on foot from spawn),
 * and the progression rules (study, quests, graduation). The 3D rendering
 * and HUD are verified separately in the browser.
 */

import { xpForLevel, levelForXp, MAX_LEVEL, questCompletionXp, questPointsFor } from "../src/realm/xp";
import { normalizeSubject, dedupeSubjectIds, pickTheme } from "../src/realm/curriculum/normalize";
import { buildQuestionPool, buildTermPool } from "../src/realm/curriculum/questionBank";
import { parseOutlineText } from "../src/realm/curriculum/localOutlineParser";
import { generateWorld, isWalkable } from "../src/realm/world/worldGen";
import { findPath, interactionTiles } from "../src/realm/world/pathfinding";
import { realmStore, sanitizeState, createEmptyState } from "../src/realm/state/store";
import { graduationStatus, setCurriculum, setPlayer, setQuestStep, studyWeek, recordMinigameWin, weekKey } from "../src/realm/state/actions";
import { validateCurriculumRequest, CurriculumError } from "../src/server/realm/curriculumResearch";
import { citiesFor, universitiesFor, UNIVERSITY_DIRECTORY } from "../src/realm/curriculum/universities";
import { existsSync, readFileSync } from "node:fs";
import { laTrobeHandbookUrl, loadSavedLaTrobeSemester, defaultLaTrobePeriod, LA_TROBE } from "../src/realm/curriculum/latrobe";
import { laTrobeStartingUrls, isLaTrobeRequest } from "../src/server/realm/curriculumResearch";
import { builtInBank } from "../src/realm/curriculum/banks/latrobeBanks";
import { enrichWithBank } from "../src/realm/curriculum/enrich";
import { claimDaily, dailyChallenges, spendCoins } from "../src/realm/state/actions";
import { addDays, todayIso } from "../src/realm/state/store";
import { liveStreak, markStudyDay, STREAK_BONUS_COINS, effectiveStartDate, resolvedDueDate } from "../src/realm/state/actions";
import { answerReview, dueCards, mistakeKey, recordMistake } from "../src/realm/state/grimoire";
import { activeBoss, bossStatus, bossWeeks, defeatBoss, BOSS_COINS } from "../src/realm/state/bosses";
import { buyItem, equipItem } from "../src/realm/state/shop";
import { addGroupMember, makeShareCode, parseShareCode, subjectLeaderboard } from "../src/realm/state/group";
import { applyCalendarMatches, matchCalendar, parseCalendar, titleSimilarity, MATCH_THRESHOLD } from "../src/realm/curriculum/calendarImport";
import { validateTutorRequest, validateWeekQuestionsRequest } from "../src/server/realm/studyAi";
import { CalendarProxyError, validateCalendarUrl } from "../src/server/realm/calendarProxy";
import { extractPptxText } from "../src/realm/curriculum/pptxExtract";
import { EXPLAIN_XP_PER_POINT, isWeakWeek, keywordScore, recordAnswer, recordExplanation, weakWeeks } from "../src/realm/state/stats";
import { gradeFor, neededForTarget, setMark, subjectResult, wam } from "../src/realm/state/grades";
import { allPlans, planFor, plansToIcs, PLAN_WINDOW_DAYS } from "../src/realm/state/plan";
import { ACHIEVEMENTS, checkAchievements, setTitle } from "../src/realm/state/achievements";
import { parsePastedQuestions } from "../src/realm/curriculum/questionParser";
import { analyseNetwork, makePathPuzzle, workshopFor } from "../src/realm/curriculum/workshop";
import { finishStudyCheck, hasStudyCheck, STUDY_CHECK, studyCheckQuestions } from "../src/realm/state/studyCheck";
import { ACS_VALUES, BUG_HUNT, ETHICS, USABILITY } from "../src/realm/curriculum/banks/workshopBanks";
import { dueReminders } from "../src/realm/state/reminders";
import { siegeActive, SIEGE_BONUS_COINS } from "../src/realm/state/bosses";
import { nextStudyAdvice } from "../src/realm/dialogues";
import { skyAt } from "../src/realm/scene/sky";
import { build as tdBuild, newGame as tdNewGame, PATH as TD_PATH, runReward as tdReward, sell as tdSell, startWave as tdStartWave, step as tdStep, TOWERS as TD_TOWERS, WAVE_PLAN as TD_WAVES } from "../src/realm/arcade/td";
import { CAMP_CLEARANCE, medalTimes, planCourse, race, RACE_LIMIT_SECONDS, startRace, tickRace } from "../src/realm/arcade/race";
import { classesWith, dyeTints, DYES, buyDye, isOwnPart, OUTFIT_SLOTS, outfitClasses, partMeshes, resolveOutfit, setDye, setOutfitPart, slotOfMesh } from "../src/realm/customise/outfit";
import { EMOTES } from "../src/realm/customise/emotes";
import { availableCount, buyFurniture, comfort, comfortFocusBonus, furniture, FURNITURE, MAX_COMFORT, moveFurniture, moveIn, pickUp, placeBlocker, placeFurniture, ROOM_COLS, ROOM_ROWS, standHeight, STARTER, turnFurniture } from "../src/realm/dorm/dorm";
import { appearanceFiles, BASE_OUTFIT, boneTargets, CLIP_ALIAS, defaultAppearance, heightScale, OUTFITS, outfitFile, PART_SLOTS, sanitizeAppearance, SLOT_SUFFIX } from "../src/realm/customise/humans";
import { beatRival, beginVoyage, HOME, islandsFor, landOn, RIVAL_COINS, RIVAL_REPEAT_COINS, rivalStrength, STAMP_COINS } from "../src/realm/world/islands";
import { dormWorld } from "../src/realm/dorm/interior";
import { isExpo, startDemo, topUpFocus } from "../src/realm/expo";
import { roomToWorld, turnsForFacing, withRooms } from "../src/realm/world/rooms";
import { cleanLecture, validateLectureRequest } from "../src/server/realm/lectureAi";
import { handbookLecture, localLecture, notesLecture, sanitizeLecture } from "../src/realm/curriculum/lecture";
import { LECTURE_BANKS } from "../src/realm/curriculum/banks/lectures";
import type { LectureVisual } from "../src/realm/curriculum/banks/lectures/types";
import { drawVisual, sanitizeVisual } from "../src/realm/lecture/visuals";
import { genderOf, sentences, speakingSeconds, voiceQuality } from "../src/realm/lecture/speech";
import { FRONT_SEAT, theatreWorld, THEATRE_X, THEATRE_Z } from "../src/realm/lecture/theatre";
import { attendLecture, lectureKey, LECTURE_XP } from "../src/realm/state/lectures";
import { FIXTURES } from "../src/realm/dorm/dorm";
import { grantXp, isRested, RESTED_BONUS, restInBed } from "../src/realm/state/actions";
import { LA_TROBE_COURSES_2026 } from "../src/realm/curriculum/banks/latrobeCourses";
import { HOUSES, houseStandings, yourHousePoints } from "../src/realm/customise/houses";
import { deliver, lettersDue, markRead, unreadCount } from "../src/realm/state/mail";
import { knownSpells, spellBar, spellName } from "../src/realm/life/spells";
import { brew, brewBlocker, buffActive, drink, INSIGHT_BONUS } from "../src/realm/life/potions";
import { LADDER_SIZE, nextOpponent, opponentTier, winLadderDuel, yourRank } from "../src/realm/state/ladder";
import { familiarLevel } from "../src/realm/customise/familiar";
import { checkPassword, isOpen, openSecret, riddleFor, SECRET_COINS } from "../src/realm/state/secrets";
import { extractCards, quizFromCards, summarise } from "../src/realm/curriculum/textbook";
import { classesOn, parseTimetable, recentClass } from "../src/realm/curriculum/timetable";
import { CLASS_FOLLOW_UP_FOCUS, classFollowUp } from "../src/realm/state/actions";
import { weeklyCard } from "../src/realm/customise/houses";
import { yearbookFor } from "../src/realm/state/yearbook";
import { seasonOf, weatherAt } from "../src/realm/scene/weather";
import { broomUnlocked } from "../src/realm/life/broom";
import { abandonRace } from "../src/realm/arcade/race";
import { cinematicProgress, startCinematic } from "../src/realm/scene/cinematic";
import { CAMP_RESPAWN_SECONDS, castSpell, combat, DUNGEON_LEASH, ENEMIES, playerAttack, playerHit, spawnCamps, startDungeon, tickCombat, WAVES } from "../src/realm/combat/combat";
import { FOCUS, resource } from "../src/realm/life/catalog";
import { gainFocus } from "../src/realm/state/focus";
import { beginGather, cook, craft, craftBlocker, eat, finishGather, gatherBlocker, weaponPower } from "../src/realm/state/life";
import { withLaTrobeDates } from "../src/realm/curriculum/latrobeCalendar";
import { currentTeachingWeek, inExamPeriod, teachingWeekMonday } from "../src/realm/state/actions";
import { ARENA_REWARDS, arenaLeaderboard, boardSource, computeReward, expectedScore, kFactor, rankFor, ratingDelta, RIVALS, rivalAccuracy, rivalAnswerMs, rivalChoices, rivalRating, rollSeason, seasonId, viewRecord } from "../src/realm/arena/rating";
import { BLITZ_MS, blitzMultiplier, blitzPoints, pickBlitzQuestion, scoreAt, simulateBlitz, speedBonus, targetDifficulty } from "../src/realm/arena/blitz";
import { dailyLexicon, keyboardMarks, lexiconFeedback, lexiconScore, lexiconTerms, makePuzzle, maskTerm, rivalLexicon } from "../src/realm/arena/lexicon";
import { buildConnections, checkGroup, connectionsScore, rivalConnections, weekTileCandidates } from "../src/realm/arena/connections";
import { lectureSequences, pairAccuracy, rivalSequence, sequencePuzzles, sequenceRoundScore, weekOrderPuzzle } from "../src/realm/arena/sequence";
import { applyBuzz, BUZZER_MAX_ROUNDS, BUZZER_ROUND_MS, buzzerOutcome, buzzerRoundPoints, NEW_ROUND, planRivalBuzz } from "../src/realm/arena/buzzer";
import { dailyPlayed, finishArenaMatch } from "../src/realm/arena/record";
import { seededRng } from "../src/realm/arena/rng";
import { XP_REWARDS } from "../src/realm/xp";
import type { RealmSubject, RegionTheme } from "../src/realm/types";

/** A minimal .pptx (zip) with deflated entries, built with the platform's CompressionStream. */
async function makePptx(entries: Array<[string, string]>): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const raw = encoder.encode(text);
    const deflated = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const nameBytes = encoder.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + deflated.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, deflated.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(deflated, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, deflated.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const total = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    total.set(part, at);
    at += part.length;
  }
  return total.buffer;
}

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

function makeSubject(i: number, weeks: number, assessments: number, theme: RegionTheme = "arcane"): RealmSubject {
  return normalizeSubject(
    {
      code: `SUB${i}00`,
      name: `Subject ${i}`,
      weeks: Array.from({ length: weeks }, (_, w) => ({ week: w + 1, title: `Topic ${w + 1} of subject ${i}`, topics: [`Idea ${w + 1}`], summary: "" })),
      assessments: Array.from({ length: assessments }, (_, a) => ({ title: `Task ${a + 1}`, kind: a === 0 ? "exam" : "project", weightPercent: 100 / Math.max(1, assessments), dueWeek: a + 4, dueDate: null, description: "", steps: ["a", "b", "c"] })),
      keyTerms: Array.from({ length: 6 }, (_, k) => ({ term: `Term${k}`, definition: `Meaning number ${k}` })),
      questions: [],
    },
    { code: `SUB${i}00`, name: `Subject ${i}` },
    "manual",
    theme,
  );
}

async function main(): Promise<void> {
  section("1. XP curve", () => {
    check("level 1 needs 0 XP", xpForLevel(1) === 0);
    check("level 99 needs 60,000 XP", xpForLevel(MAX_LEVEL) === 60_000, String(xpForLevel(MAX_LEVEL)));
    let monotonic = true;
    for (let l = 2; l <= MAX_LEVEL; l++) if (xpForLevel(l) <= xpForLevel(l - 1)) monotonic = false;
    check("every level needs strictly more XP than the last", monotonic);
    let gapsGrow = true;
    for (let l = 60; l <= MAX_LEVEL; l++) if (xpForLevel(l) - xpForLevel(l - 1) < xpForLevel(l - 1) - xpForLevel(l - 2)) gapsGrow = false;
    check("late levels get progressively harder", gapsGrow);
    check("levelForXp inverts xpForLevel", [2, 10, 50, 98, 99].every((l) => levelForXp(xpForLevel(l)) === l && levelForXp(xpForLevel(l) - 1) === l - 1));
    check("one studied week lands at level 4-6", levelForXp(220) >= 4 && levelForXp(220) <= 6, String(levelForXp(220)));
    check("XP beyond 99 stays capped at 99", levelForXp(10_000_000) === 99);
    check("heavier assessments pay more XP", questCompletionXp(50) > questCompletionXp(10));
    check("quest points scale with weight", questPointsFor(50) === 4 && questPointsFor(30) === 3 && questPointsFor(15) === 2 && questPointsFor(5) === 1);
  });

  section("2. Curriculum normalisation (untrusted AI/file input)", () => {
    const garbage = normalizeSubject({ weeks: "nope", assessments: [null, 3, { title: "" }], questions: [{ prompt: "x", choices: ["a", "a", "b", "c"], answerIndex: 0 }] }, { code: "ABC123", name: "Fallback" }, "inferred", "guild");
    check("garbage fields fall back to empty arrays", garbage.weeks.length === 0 && garbage.assessments.length === 0);
    check("questions with duplicate choices are dropped", garbage.questions.length === 0);
    check("fallback name/code used", garbage.name === "Fallback" && garbage.code === "ABC123");
    const s = normalizeSubject(
      {
        name: "Data Structures",
        weeks: [{ week: 2, title: "Lists" }, { week: 1, title: "Intro" }, { week: 1, title: "Dup" }, { week: 99, title: "Bad" }],
        assessments: [{ title: "Exam", kind: "EXAM", weightPercent: "60", dueWeek: 14, dueDate: "not a date", steps: [] }, { title: "Lab", kind: "weird", weightPercent: 500 }],
        questions: [{ prompt: "Q?", choices: ["1", "2", "3", "4"], answerIndex: 2, explanation: "because", week: 3 }, { prompt: "Bad", choices: ["1", "2", "3", "4"], answerIndex: 7 }],
        sourceUrls: ["https://handbook.example.edu/x", "javascript:alert(1)"],
      },
      { code: "", name: "" },
      "official",
      "arcane",
    );
    check("weeks sorted, de-duplicated, out-of-range dropped", s.weeks.map((w) => w.week).join(",") === "1,2");
    check("kind is case-normalised; unknown kind becomes 'other'", s.assessments[0].kind === "exam" && s.assessments[1].kind === "other");
    check("string weight parsed; impossible weight becomes null", s.assessments[0].weightPercent === 60 && s.assessments[1].weightPercent === null);
    check("malformed date becomes null", s.assessments[0].dueDate === null);
    check("empty steps get sensible defaults", s.assessments[0].steps.length >= 3);
    check("out-of-range answerIndex question dropped", s.questions.length === 1 && s.questions[0].answerIndex === 2);
    check("only http(s) source URLs kept", s.sourceUrls.length === 1);
    const dupes = dedupeSubjectIds([makeSubject(1, 2, 1), makeSubject(1, 2, 1)]);
    check("duplicate subject ids are made unique (assessment ids too)", dupes[0].id !== dupes[1].id && dupes[0].assessments[0].id !== dupes[1].assessments[0].id);
    const taken = new Set<RegionTheme>();
    const t1 = pickTheme("Introduction to Programming", 0, taken);
    taken.add(t1);
    const t2 = pickTheme("Software Engineering", 1, taken);
    check("themes match subject keywords and never repeat", t1 === "arcane" && t2 !== "arcane");
  });

  section("3. Question bank", () => {
    const subject = makeSubject(1, 10, 2);
    const pool = buildQuestionPool(subject);
    check("generates questions from key terms and weeks", pool.length >= 10, String(pool.length));
    check("every question has 4 distinct choices and a valid answer", pool.every((q) => q.choices.length === 4 && new Set(q.choices).size === 4 && q.answerIndex >= 0 && q.answerIndex < 4));
    check("week-focused pools prefer that week when enough exist", buildQuestionPool(subject, 3).length > 0);
    const bare = normalizeSubject({ weeks: [{ week: 1, title: "A" }, { week: 2, title: "B" }, { week: 3, title: "C" }, { week: 4, title: "D" }] }, { code: "X", name: "X" }, "manual", "grove");
    check("subjects with only week titles still get term pairs", buildTermPool(bare).length === 4);
  });

  section("4. Offline outline parser", () => {
    const text = [
      "SUBJECT OUTLINE CSE1OOF",
      "Week 1: Introduction to Java",
      "Week 2 - Classes and objects",
      "Week 3. Encapsulation; constructors",
      "Assessment",
      "Programming assignment 1 30% due week 6",
      "Mid-semester quiz 10%",
      "Final exam 60%",
    ].join("\n");
    const parsed = normalizeSubject(parseOutlineText(text, "CSE1OOF", "OOP"), { code: "CSE1OOF", name: "OOP" }, "document", "arcane");
    check("reads week lines in several formats", parsed.weeks.length === 3, String(parsed.weeks.length));
    check("reads weighted assessments", parsed.assessments.length === 3, String(parsed.assessments.length));
    check("guesses assessment kinds", parsed.assessments.some((a) => a.kind === "exam") && parsed.assessments.some((a) => a.kind === "quiz"));
    check("reads the due week", parsed.assessments[0].dueWeek === 6);
    const absurd = normalizeSubject(parseOutlineText("Item 90%\nOther 90%\nThird 90%", "X", "X"), { code: "X", name: "X" }, "document", "arcane");
    check("weights summing far above 100% are not trusted", absurd.assessments.every((a) => a.weightPercent === null));
  });

  section("5. World generation & reachability", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const subjects = Array.from({ length: n }, (_, i) => makeSubject(i, i % 2 === 0 ? 12 : 6, 2, (["arcane", "guild", "forge", "grove", "archive", "foundry", "tide", "alchemy"] as RegionTheme[])[i]));
      const world = generateWorld(subjects);
      const again = generateWorld(subjects);
      check(`${n} subject(s): generation is deterministic`, world.objects.length === again.objects.length && world.trees.length === again.trees.length);
      check(`${n} subject(s): spawn is walkable`, isWalkable(world, Math.floor(world.spawn.x), Math.floor(world.spawn.z)));
      const start = { x: Math.floor(world.spawn.x), z: Math.floor(world.spawn.z) };
      const unreachable = world.objects.filter((o) => o.actions.length > 0 && findPath(world, start, interactionTiles(world, o), 40000) === null);
      check(`${n} subject(s): every interactable is reachable on foot`, unreachable.length === 0, unreachable.map((o) => o.id).join(", "));
      const waystones = world.objects.filter((o) => o.kind === "waystone").length;
      const expected = subjects.reduce((sum, s) => sum + s.weeks.length, 0);
      check(`${n} subject(s): one waystone per teaching week`, waystones === expected, `${waystones} vs ${expected}`);
      check(`${n} subject(s): one region per subject`, world.regions.length === n);
    }

    const themes: RegionTheme[] = ["arcane", "guild", "forge", "grove", "archive", "foundry", "tide", "alchemy"];
    const bad: string[] = [];
    for (let seed = 0; seed < 40; seed++) {
      const n = 1 + (seed % 8);
      const subjects = Array.from({ length: n }, (_, i) => {
        const s = makeSubject(seed * 10 + i, 3 + ((seed + i) % 12), (seed + i) % 5, themes[i]);
        return { ...s, id: `fuzz-${seed}-${i}`, name: `Fuzz subject ${seed} ${i}` };
      });
      const world = generateWorld(subjects);
      if (world.districts.length !== 5) bad.push(`seed ${seed}: only ${world.districts.length} districts`);
      const start = { x: Math.floor(world.spawn.x), z: Math.floor(world.spawn.z) };
      for (const o of world.objects) {
        if (o.actions.length > 0 && findPath(world, start, interactionTiles(world, o), 40000) === null) bad.push(`seed ${seed}: ${o.id}`);
      }
    }
    check("40 random curricula: all five districts placed and every interactable reachable", bad.length === 0, bad.slice(0, 6).join(", "));
  });

  section("6. Progression rules", () => {
    realmStore.replace(createEmptyState());
    setPlayer({ name: "Tester", look: { skin: "#fff", hair: "#000", tunic: "#f00", legs: "#00f", cape: "#0f0" } });
    const a = makeSubject(1, 4, 2, "arcane");
    const b = normalizeSubject({ code: "NOA", name: "No Assessments", weeks: [{ week: 1, title: "Only week" }] }, { code: "NOA", name: "No Assessments" }, "manual", "guild");
    setCurriculum({ enrolment: { country: "Australia", city: "Melbourne", university: "Test U", course: "", yearLevel: "First year", teachingPeriod: "Semester 1", year: 2026, startDate: null }, subjects: [a, b], createdAt: new Date().toISOString() });

    studyWeek(a.id, 1);
    const afterStudy = realmStore.get().progress.skillXp[a.id] ?? 0;
    studyWeek(a.id, 1);
    check("studying a week grants XP once", afterStudy > 0 && realmStore.get().progress.skillXp[a.id] === afterStudy);
    check("studying gives a tome", realmStore.get().progress.inventory.some((i) => i.id === "tome"));

    const quest = a.assessments[0];
    setQuestStep(quest.id, 0, true);
    const afterStep = realmStore.get().progress.skillXp[a.id];
    setQuestStep(quest.id, 0, false);
    setQuestStep(quest.id, 0, true);
    check("re-ticking a step never pays twice", realmStore.get().progress.skillXp[a.id] === afterStep);
    check("ticking a step starts the quest", realmStore.get().progress.quests[quest.id].status === "in-progress");
    setQuestStep(quest.id, 1, true);
    setQuestStep(quest.id, 2, true);
    check("finishing all steps completes the quest", realmStore.get().progress.quests[quest.id].status === "complete");
    check("quest completion awards quest points and a lamp", realmStore.get().progress.questPoints > 0 && realmStore.get().progress.inventory.some((i) => i.id === "xp-lamp"));
    setQuestStep(quest.id, 0, false);
    check("completed quests can't be un-completed", realmStore.get().progress.quests[quest.id].status === "complete");

    const xpBefore = realmStore.get().progress.skillXp[a.id];
    const wins: number[] = [];
    for (let i = 0; i < 8; i++) wins.push(recordMinigameWin(a.id, 100, 2, "a test"));
    check("mini-game XP halves after the daily full-XP wins", wins[0] === 100 && wins[7] === 50);
    check("mini-game wins are tracked per waystone", realmStore.get().progress.weeks[weekKey(a.id, 2)].minigamesWon === 8);
    check("mini-game XP is added to the skill", realmStore.get().progress.skillXp[a.id] > xpBefore);

    check("not graduated with quests outstanding", realmStore.get().progress.graduatedAt === null);
    const status = graduationStatus(realmStore.get());
    check("graduation counts quests, plus weeks for subjects without assessments", status.total === 3 && status.done === 1, `${status.done}/${status.total}`);
    a.assessments[1].steps.forEach((_, i) => setQuestStep(a.assessments[1].id, i, true));
    studyWeek(b.id, 1);
    check("completing everything graduates the player", realmStore.get().progress.graduatedAt !== null);
    check("graduation awards the cape", realmStore.get().progress.inventory.some((i) => i.id === "graduation-cape"));
  });

  section("7. Save sanitising", () => {
    check("non-object save becomes a fresh state", sanitizeState("garbage").player === null);
    check("wrong version becomes a fresh state", sanitizeState({ version: 9 }).curriculum === null);
    const s = sanitizeState({ version: 1, progress: { skillXp: { x: -5, y: 10.7, z: "a" } }, settings: { zoom: 7 } });
    check("negative/invalid XP is dropped, fractions floored", s.progress.skillXp.x === undefined && s.progress.skillXp.y === 10 && s.progress.skillXp.z === undefined);
    check("settings are clamped", s.settings.zoom === 1);
  });

  section("8. Research endpoint request validation", () => {
    let threw = false;
    try {
      validateCurriculumRequest({ subjectCode: "X" });
    } catch (error) {
      threw = error instanceof CurriculumError && error.category === "invalid-request";
    }
    check("missing university is rejected", threw);
    const req = validateCurriculumRequest({ university: "U".repeat(500), subjectName: "Algorithms", year: 1800, documentText: "   " });
    check("long fields are truncated", req.university.length === 160);
    check("impossible year falls back to the current year", req.year === new Date().getFullYear());
    check("blank document text is treated as absent", req.documentText === null);
  });

  section("9. University directory", () => {
    check("covers 25+ countries", UNIVERSITY_DIRECTORY.length >= 25, String(UNIVERSITY_DIRECTORY.length));
    check("city lookup works", citiesFor("Australia").includes("Melbourne"));
    check("university lookup by city works", universitiesFor("Australia", "Melbourne").includes("La Trobe University"));
    check("unknown city falls back to every university in the country", universitiesFor("Australia", "Nowhere").length > 10);
    check("unknown country returns nothing (free text still allowed)", universitiesFor("Atlantis", "").length === 0);
  });

  console.log("\n=== 10. La Trobe first ===");
  try {
    check("handbook URL uses year + lowercase code", laTrobeHandbookUrl("cse3cwa", 2026) === "https://handbook.latrobe.edu.au/subjects/2026/cse3cwa");
    check("non-La-Trobe-shaped codes get no handbook link", laTrobeHandbookUrl("COMP1511", 2026) === null && laTrobeHandbookUrl("", 2026) === null);
    check("default teaching period follows the calendar", defaultLaTrobePeriod(new Date(2026, 2, 1)) === "Semester 1" && defaultLaTrobePeriod(new Date(2026, 8, 1)) === "Semester 2");
    check("La Trobe campuses and periods listed", LA_TROBE.campuses.includes("Bendigo") && LA_TROBE.teachingPeriods.includes("Semester 2"));
    const req = validateCurriculumRequest({ university: "La Trobe University", subjectCode: "CSE1OOF", year: 2026 });
    check("research recognises La Trobe", isLaTrobeRequest(req) && !isLaTrobeRequest(validateCurriculumRequest({ university: "Monash University", subjectName: "X" })));
    check("research starts from the official handbook pages", laTrobeStartingUrls(req)[0] === "https://handbook.latrobe.edu.au/subjects/2026/cse1oof");
    const saved = await loadSavedLaTrobeSemester();
    check("saved La Trobe semester loads (built-in data in Node)", saved !== null && saved.subjects.length === 4, String(saved?.subjects.length));
    if (saved) {
      check("saved semester label parsed into year + period", saved.year === 2026 && saved.teachingPeriod === "Semester 2", `${saved.year} ${saved.teachingPeriod}`);
      check("every saved subject has its 12 weekly modules", saved.subjects.every((s) => s.weeks.length === 12));
      check("saved assessments become quests", saved.subjects.every((s) => s.assessments.length > 0));
      check("confirmed codes are kept", saved.subjects.some((s) => s.code === "CSE3CWA"));
      check("unconfirmed weights stay blank, confirmed ones are kept", saved.subjects.some((s) => s.assessments.some((a) => a.weightPercent === null)) && saved.subjects.some((s) => s.assessments.some((a) => a.weightPercent === 50)));
      check("saved subjects are marked as coming from the student's own data", saved.subjects.every((s) => s.confidence === "document"));
      const world = generateWorld(saved.subjects, { university: "La Trobe University" });
      check("La Trobe hub is the Agora with La Trobe red banners", world.hub.plazaName === "The Agora" && world.hub.bannerA === "#c8102e");
      const start = { x: Math.floor(world.spawn.x), z: Math.floor(world.spawn.z) };
      const unreachable = world.objects.filter((o) => o.actions.length > 0 && findPath(world, start, interactionTiles(world, o), 40000) === null);
      check("La Trobe realm: everything reachable", unreachable.length === 0, unreachable.map((o) => o.id).join(", "));
      check("other universities keep the generic hub", generateWorld(saved.subjects, { university: "Monash University" }).hub.plazaName !== "The Agora");
    }
  } catch (error) {
    failed++;
    failures.push(`La Trobe section threw :: ${error instanceof Error ? error.stack : String(error)}`);
  }

  section("11. Question banks (harder, subject-specific)", () => {
    const subjects: Array<[string, string]> = [
      ["CSE2UI", "User Interface Design"],
      ["CSE3CWA", "Cloud-Based Web Application Development"],
      ["", "Project Management"],
      ["", "Professional Practices and Entrepreneurship in Information Technology"],
    ];
    for (const [code, name] of subjects) {
      const bank = builtInBank(code, name, "x");
      check(`${name}: has a built-in bank`, bank !== null);
      if (!bank) continue;
      check(`${name}: 35+ questions`, bank.questions.length >= 35, String(bank.questions.length));
      check(`${name}: every teaching week 1-12 has questions`, Array.from({ length: 12 }, (_, i) => i + 1).every((w) => bank.questions.some((q) => q.week === w)));
      check(`${name}: well-formed (4 distinct choices, valid answer)`, bank.questions.every((q) => q.choices.length === 4 && new Set(q.choices).size === 4 && q.answerIndex >= 0 && q.answerIndex < 4 && q.explanation.length > 10));
      const hard = bank.questions.filter((q) => (q.difficulty ?? 2) >= 2).length;
      check(`${name}: at least 80% are understanding/application level`, hard / bank.questions.length >= 0.8, `${hard}/${bank.questions.length}`);
      const positions = new Set(bank.questions.map((q) => q.answerIndex));
      check(`${name}: correct answer position varies`, positions.size >= 3);
      check(`${name}: no syllabus-trivia questions`, bank.questions.every((q) => !/which topic is studied in week/i.test(q.prompt)));
      check(`${name}: 15+ key terms`, bank.keyTerms.length >= 15);
    }
    check("unknown subjects get no bank", builtInBank("ABC123", "Underwater Basket Weaving", "x") === null);
    check("the IT banks match by Handbook code", builtInBank("CSE3PM", "Project Management", "x") !== null && builtInBank("CSE3PPE", "Anything", "x") !== null && builtInBank("CSE2UI", "x", "x") !== null && builtInBank("CSE3CWA", "x", "x") !== null);
    check("other disciplines' look-alike subjects get no IT bank", [
      ["NUR3PP", "Professional Practice"],
      ["", "Professional Practice in Nursing"],
      ["MGT3PM", "Project Management"],
      ["", "Construction Project Management"],
      ["BUS2ENT", "Entrepreneurship"],
      ["CSE3PMX", "Project Management"],
      ["COMP3511", "Cloud Web Services"],
    ].every(([code, name]) => builtInBank(code, name, "x") === null));
    const bare = normalizeSubject({ code: "CSE3CWA", name: "Cloud-Based Web Application Development", weeks: Array.from({ length: 12 }, (_, i) => ({ week: i + 1, title: `Week ${i + 1} topic` })) }, { code: "CSE3CWA", name: "x" }, "manual", "arcane");
    const enriched = enrichWithBank(bare);
    check("enrichment adds the bank once (idempotent)", enriched.questions.length >= 35 && enrichWithBank(enriched) === enriched);
    const examPool = buildQuestionPool(enriched);
    check("with real questions, no generated 'which week' questions appear", examPool.every((q) => !/which topic is studied in week/i.test(q.prompt)));
    const trial = buildQuestionPool(enriched, 5).slice(0, 3);
    check("a waystone trial starts with that week's questions", trial.every((q) => q.week === 5), trial.map((q) => q.week).join(","));
    const firstTen = examPool.slice(0, 10);
    check("exam duels lean towards harder questions", firstTen.filter((q) => (q.difficulty ?? 2) >= 2).length >= 8);
  });

  section("12. Daily challenges, coins, and purpose", () => {
    realmStore.replace(createEmptyState());
    setPlayer({ name: "T", look: { skin: "#fff", hair: "#000", tunic: "#f00", legs: "#00f", cape: "#0f0" } });
    const a = makeSubject(1, 4, 1, "arcane");
    setCurriculum({ enrolment: { country: "Australia", city: "Melbourne", university: "La Trobe University", course: "", yearLevel: "", teachingPeriod: "Semester 2", year: 2026, startDate: null }, subjects: [a], createdAt: "x" });
    check("daily challenges start incomplete", !dailyChallenges(realmStore.get()).complete);
    check("can't claim an incomplete daily", claimDaily() === false);
    studyWeek(a.id, 1);
    recordMinigameWin(a.id, 50, 1, "t");
    recordMinigameWin(a.id, 50, 1, "t");
    setQuestStep(a.assessments[0].id, 0, true);
    const status = dailyChallenges(realmStore.get());
    check("studying, two wins and a quest step complete the daily", status.complete, status.items.map((i) => `${i.label}:${i.done}`).join(" | "));
    const coinsBefore = realmStore.get().progress.coins;
    check("claiming pays out once", claimDaily() === true && realmStore.get().progress.coins === coinsBefore + 150 && claimDaily() === false);
    const c = realmStore.get().progress.coins;
    check("coins can be spent on hints", spendCoins(25) === true && realmStore.get().progress.coins === c - 25);
    check("can't spend more coins than you have", spendCoins(1_000_000) === false);
    const world = generateWorld([a], { university: "La Trobe University" });
    const purposeless = world.objects.filter((o) => o.actions.length === 0);
    check("every object in the world has a use", purposeless.length === 0, purposeless.map((o) => o.id).join(", "));
    check("every subject has a fast-travel signpost", world.objects.filter((o) => o.actions.some((x) => x.id === "travel")).length === 1);
    check("every subject building opens its library", world.objects.filter((o) => o.kind === "landmark").every((o) => o.actions.some((x) => x.id === "enter-library")));
  });

  section("13. 3D model files (exist, intact, licensed)", () => {
    const base = "public/assets/v2/models/kaykit";
    const files = [
      ...["knight", "mage", "rogue", "rogue_hooded", "barbarian"].map((n) => `characters/${n}.glb`),
      ...["library-red", "castle", "tower-blue", "lighthouse-blue", "market-yellow", "blacksmith-red", "windmill-green", "church-blue", "watermill-yellow", "tavern-green"].map((n) => `buildings/${n}.glb`),
      ...["target", "weaponrack", "flag-red", "flag-blue", "flag-green", "flag-yellow", "cloud-big", "cloud-small", "tent", "barrel", "crate", "sack"].map((n) => `props/${n}.glb`),
      ...["skeleton_warrior", "skeleton_mage", "skeleton_minion"].map((n) => `characters/${n}.glb`),
      ...["tree-a", "tree-b", "trees-a", "trees-b", "rock-c", "rock-e"].map((n) => `nature/${n}.glb`),
    ];
    const ledger = readFileSync("public/assets/v2/licences/ASSET_LICENCES.md", "utf8");
    for (const file of files) {
      const path = `${base}/${file}`;
      if (!existsSync(path)) {
        check(`${file} exists`, false);
        continue;
      }
      const buf = readFileSync(path);
      const isGlb = buf.subarray(0, 4).toString("ascii") === "glTF";
      const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as {
        accessors: Array<{ bufferView?: number; sparse?: unknown }>;
        animations?: Array<{ name: string; samplers: Array<{ input: number; output: number }> }>;
        meshes: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>;
      };
      const n = json.accessors.length;
      const refs = [
        ...(json.animations ?? []).flatMap((a) => a.samplers.flatMap((s) => [s.input, s.output])),
        ...json.meshes.flatMap((m) => m.primitives.flatMap((p) => [...Object.values(p.attributes), ...(p.indices !== undefined ? [p.indices] : [])])),
      ];
      const intact = isGlb && refs.every((r) => r < n) && json.accessors.every((a) => a.bufferView !== undefined || a.sparse);
      check(`${file}: valid GLB with intact data references`, intact);
      check(`${file}: listed in the licence ledger`, ledger.includes(`models/kaykit/${file}`));
      if (file.startsWith("characters/skeleton_")) {
        const names = (json.animations ?? []).map((a) => a.name);
        const needs = file.includes("minion") ? ["Idle", "Walking_A"] : ["Idle_Combat"];
        check(`${file}: has ${needs.join(", ")}`, needs.every((a) => names.includes(a)), names.join(","));
        check(`${file}: under 700 KB`, buf.length < 700 * 1024, `${Math.round(buf.length / 1024)} KB`);
      } else if (file.startsWith("characters/")) {
        const names = (json.animations ?? []).map((a) => a.name);
        check(`${file}: has idle, run, interact, cheer, attack, hit and emote animations`, ["Idle", "Running_A", "Interact", "Cheer", "1H_Melee_Attack_Chop", "Hit_A", "Sit_Floor_Idle"].every((a) => names.includes(a)), names.join(","));
        check(`${file}: under 760 KB`, buf.length < 760 * 1024, `${Math.round(buf.length / 1024)} KB`);
      }
    }
  });

  const enrolment = { country: "Australia", city: "Melbourne", university: "La Trobe University", course: "", yearLevel: "", teachingPeriod: "Semester 2", year: 2026, startDate: null };
  const resetWith = (subjects: RealmSubject[], start: string | null = null) => {
    realmStore.replace(createEmptyState());
    setPlayer({ name: "Tester", look: { skin: "#fff", hair: "#000", tunic: "#f00", legs: "#00f", cape: "#0f0" } });
    setCurriculum({ enrolment: { ...enrolment, startDate: start }, subjects, createdAt: "x" });
  };

  section("14. Grimoire of Mistakes (spaced review)", () => {
    const a = makeSubject(1, 6, 1, "arcane");
    resetWith([a]);
    const q = a.questions[0] ?? buildQuestionPool(a, null)[0];
    recordMistake(a.id, q);
    const key = mistakeKey(a.id, q);
    const today = todayIso();
    const entry = realmStore.get().progress.mistakes[key];
    check("a wrong answer is written into the book", Boolean(entry) && entry.box === 0);
    check("it is first due tomorrow, not today", entry.dueOn === addDays(today, 1) && dueCards(realmStore.get()).length === 0);
    check("it is due when tomorrow comes", dueCards(realmStore.get(), addDays(today, 1)).length === 1);
    const shuffledCopy = { ...q, id: "other-id", choices: [...q.choices].reverse(), answerIndex: 3 - q.answerIndex };
    check("the same question with shuffled choices is the same card", mistakeKey(a.id, shuffledCopy) === key);
    recordMistake(a.id, q);
    check("missing it again counts the miss and keeps one card", Object.keys(realmStore.get().progress.mistakes).length === 1 && realmStore.get().progress.mistakes[key].misses === 2);
    const xp0 = realmStore.get().progress.skillXp[a.id] ?? 0;
    check("right answer moves it to 3 days", answerReview(key, true) === "promoted" && realmStore.get().progress.mistakes[key].dueOn === addDays(today, 3));
    check("reviewing pays XP", (realmStore.get().progress.skillXp[a.id] ?? 0) > xp0);
    check("right again moves it to 7 days", answerReview(key, true) === "promoted" && realmStore.get().progress.mistakes[key].dueOn === addDays(today, 7));
    check("a wrong review sends it back to tomorrow", answerReview(key, false) === "again" && realmStore.get().progress.mistakes[key].box === 0);
    answerReview(key, true);
    answerReview(key, true);
    check("three right in a row masters it and removes it", answerReview(key, true) === "mastered" && !realmStore.get().progress.mistakes[key]);
    const raw = JSON.parse(JSON.stringify(realmStore.get())) as { progress: Record<string, unknown> };
    raw.progress.mistakes = { bad: { subjectId: "x" }, good: { subjectId: a.id, dueOn: today, box: 0, misses: 1, addedAt: "", question: q } };
    check("save sanitising drops broken cards and keeps good ones", Object.keys(sanitizeState(raw).progress.mistakes).join() === "good");
  });

  section("15. Study streak", () => {
    const a = makeSubject(1, 6, 1, "arcane");
    resetWith([a]);
    check("no streak before studying", liveStreak(realmStore.get()) === 0);
    studyWeek(a.id, 1);
    check("studying starts a 1-day streak", liveStreak(realmStore.get()) === 1);
    studyWeek(a.id, 2);
    check("a second study on the same day doesn't double count", realmStore.get().progress.streak.current === 1);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, streak: { current: 6, best: 6, lastDay: addDays(todayIso(), -1) } } }));
    const coins = realmStore.get().progress.coins;
    markStudyDay();
    check("day 7 in a row pays the weekly bonus", realmStore.get().progress.streak.current === 7 && realmStore.get().progress.coins === coins + STREAK_BONUS_COINS);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, streak: { current: 9, best: 9, lastDay: addDays(todayIso(), -3) } } }));
    check("a missed day shows a lapsed streak", liveStreak(realmStore.get()) === 0);
    markStudyDay();
    check("studying after a gap restarts at 1 and keeps the best", realmStore.get().progress.streak.current === 1 && realmStore.get().progress.streak.best === 9);
    setCurriculum({ enrolment, subjects: [a], createdAt: "y" });
    check("re-enrolling keeps the streak", realmStore.get().progress.streak.best === 9);
  });

  section("16. Deadline bosses", () => {
    const a = makeSubject(1, 12, 2, "arcane");
    a.assessments[0] = { ...a.assessments[0], kind: "project", dueDate: addDays(todayIso(), 5), dueWeek: 6 };
    a.assessments[1] = { ...a.assessments[1], kind: "report", dueDate: addDays(todayIso(), 30), dueWeek: 10 };
    resetWith([a]);
    const st = () => realmStore.get();
    check("a boss is awake within a week of its deadline", bossStatus(st(), a, a.assessments[0]).awake);
    check("a far-off deadline's boss sleeps", !bossStatus(st(), a, a.assessments[1]).awake);
    check("the lair shows the soonest awake boss", activeBoss(st(), a)?.assessment.id === a.assessments[0].id);
    const coins = st().progress.coins;
    defeatBoss(a.assessments[0].id);
    check("beating a boss records it and pays coins", Boolean(st().progress.bosses[a.assessments[0].id]) && st().progress.coins === coins + BOSS_COINS);
    check("a beaten boss stays down", !bossStatus(st(), a, a.assessments[0]).awake && activeBoss(st(), a) === null);
    const old = { ...a.assessments[1], dueDate: addDays(todayIso(), -20) };
    check("a long-past deadline's boss has faded", !bossStatus(st(), a, old).awake);
    const b = makeSubject(2, 12, 2, "forge");
    b.assessments = b.assessments.map((x) => ({ ...x, dueDate: null, dueWeek: null }));
    resetWith([b]);
    check("with no dates, the next unfinished quest's boss is awake", activeBoss(realmStore.get(), b)?.assessment.id === b.assessments[0].id);
    check("boss questions cover the weeks up to the deadline", bossWeeks(a, { ...a.assessments[0], dueWeek: 6 }).every((w) => w <= 6));
    const world = generateWorld([a, b], { university: "La Trobe University" });
    check("every subject with assessments has a deadline lair", world.objects.filter((o) => o.kind === "boss-lair").length === 2);
    const c = makeSubject(3, 4, 1, "grove");
    c.assessments[0] = { ...c.assessments[0], dueWeek: 5, dueDate: "2026-08-21" };
    const cur = { enrolment, subjects: [c], createdAt: "x" };
    check("the semester start is worked out from a dated quest", effectiveStartDate(cur) === "2026-07-20", String(effectiveStartDate(cur)));
    check("week-only quests get a date from it", resolvedDueDate({ ...c.assessments[0], dueDate: null, dueWeek: 8 }, cur) === "2026-09-11");
  });

  section("17. Bazaar and wardrobe", () => {
    const a = makeSubject(1, 4, 1, "arcane");
    resetWith([a]);
    check("can't buy what you can't afford", buyItem("pet-squire") === false);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, coins: 1000 } }));
    check("buying a cape spends coins and wears it", buyItem("cape-crimson") === true && realmStore.get().progress.coins === 850 && realmStore.get().progress.wardrobe.cape === "cape-crimson");
    check("can't buy the same item twice", buyItem("cape-crimson") === false);
    check("the mortarboard needs graduation", buyItem("hat-mortarboard") === false);
    check("a skill cape needs level 99", buyItem(`skillcape-${a.id}`) === false);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, skillXp: { [a.id]: xpForLevel(99) }, coins: 2000 } }));
    check("at level 99 the skill cape can be bought", buyItem(`skillcape-${a.id}`) === true);
    equipItem("cape", "cape-crimson");
    check("owned items can be swapped back", realmStore.get().progress.wardrobe.cape === "cape-crimson");
    equipItem("cape", null);
    check("a slot can be emptied", realmStore.get().progress.wardrobe.cape === null);
    equipItem("pet", "pet-squire");
    check("unowned items can't be equipped", realmStore.get().progress.wardrobe.pet === null);
    const world = generateWorld([a], { university: "La Trobe University" });
    check("the Agora has a bazaar and a study-group board", ["bazaar", "group-board"].every((k) => world.objects.some((o) => o.kind === k)));
  });

  section("18. Study group share codes", () => {
    const a = makeSubject(1, 4, 1, "arcane");
    resetWith([a]);
    const code = makeShareCode(realmStore.get());
    const parsed = code ? parseShareCode(code) : null;
    const own = a.code.toUpperCase();
    check("a share code round-trips", parsed !== null && parsed.name === "Tester" && parsed.levels[own] === 1);
    check("garbage codes are rejected", parseShareCode("SCHOLAR1-!!!") === null && parseShareCode("hello") === null && parseShareCode("") === null);
    check("your own code isn't added as a classmate", addGroupMember(code ?? "") === null);
    const friendJson = JSON.stringify(["Sam", "La Trobe University", "Semester 2 2026", { [own]: 120, OTHER: 5 }, 9999, 3, 2, "2026-10-19T00:00:00Z"]);
    const added = addGroupMember("SCHOLAR1-" + Buffer.from(friendJson).toString("base64url"));
    check("a classmate's code is added", added !== null && Object.keys(realmStore.get().progress.group).length === 1);
    check("values from a code are clamped", added !== null && added.levels[own] === 99 && added.totalLevel <= 99 * 12);
    const board = subjectLeaderboard(realmStore.get(), own);
    check("the leaderboard ranks shared subjects", board.length === 2 && board[0].name === "Sam");
  });

  section("19. Moodle calendar import", () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "UID:1", "SUMMARY:Assignment 1 is due", "DTSTART:20260820T135900Z", "CATEGORIES:CSE2UI-2026-SM2", "END:VEVENT",
      "BEGIN:VEVENT", "UID:2", "SUMMARY:Week 4 lecture", "DTSTART:20260818T010000Z", "CATEGORIES:CSE2UI-2026-SM2", "END:VEVENT",
      "BEGIN:VEVENT", "UID:3", "SUMMARY:Quiz 2 closes", "DTSTART;VALUE=DATE:20260905", "CATEGORIES:CSE2UI-2026-SM2", "END:VEVENT",
      "BEGIN:VEVENT", "UID:4", "SUMMARY:Assignment 2 opens", "DTSTART:20260821T000000Z", "CATEGORIES:CSE2UI-2026-SM2", "END:VEVENT",
      "BEGIN:VEVENT", "UID:5", "SUMMARY:Essay due", "DTSTART:20260901T000000Z", "CATEGORIES:XYZ1ABC", "END:VEVENT",
      "BEGIN:VEVENT", "UID:6", "SUMMARY:Assessment 2 is", "  due", "DTSTART:20260910T000000Z", "CATEGORIES:CSE2UI-2026-SM2", "END:VEVENT",
      "END:VCALENDAR",
    ];
    const events = parseCalendar(lines.join("\r\n"));
    check("every event is read (folded lines too)", events.length === 6 && events.some((e) => e.summary === "Assessment 2 is due"));
    check("date-only events keep their date", events.find((e) => e.uid === "3")?.date === "2026-09-05");
    let threw = false;
    try {
      parseCalendar("not a calendar");
    } catch {
      threw = true;
    }
    check("a non-calendar file is rejected", threw);
    const subject = normalizeSubject(
      {
        name: "User Interface Design",
        code: "CSE2UI",
        weeks: [{ week: 1, title: "Intro" }],
        assessments: [
          { title: "Assessment 1: Personas", kind: "report" },
          { title: "Assessment 2: Prototype", kind: "project" },
        ],
      },
      { code: "CSE2UI", name: "UI" },
      "official",
      "arcane",
    );
    const matches = matchCalendar(events, [subject]);
    check("lectures and 'opens' notices are skipped", !matches.some((m) => /lecture|opens/i.test(m.event.summary)));
    check("'Assignment 1 is due' matches Assessment 1", matches.find((m) => m.event.uid === "1")?.assessmentId === subject.assessments[0].id);
    check("'Assessment 2 is due' matches Assessment 2", matches.find((m) => m.event.uid === "6")?.assessmentId === subject.assessments[1].id);
    check("an unmatched deadline becomes a new quest", matches.find((m) => m.event.uid === "3")?.assessmentId === null);
    check("events for other subjects are left out", matches.find((m) => m.event.uid === "5")?.subjectId === null);
    check("titles with different numbers don't match", titleSimilarity("Assignment 1 is due", "Assessment 2: Prototype") < MATCH_THRESHOLD);
    const chosen = matches.filter((m) => m.subjectId);
    const applied = applyCalendarMatches([subject], chosen);
    check("matched quests get the real date", applied.subjects[0].assessments[0].dueDate !== null && applied.updated === 2);
    check("new quests are added with steps", applied.added === 1 && applied.subjects[0].assessments.length === 3 && applied.subjects[0].assessments[2].steps.length >= 2);
    const again = applyCalendarMatches(applied.subjects, chosen);
    check("importing twice doesn't duplicate quests", again.subjects[0].assessments.length === 3 && again.added === 0);
  });

  section("20. AI study endpoints and calendar proxy (validation)", () => {
    let threw = false;
    try {
      validateWeekQuestionsRequest({ week: 3, slidesText: "short" });
    } catch (e) {
      threw = e instanceof CurriculumError && e.category === "invalid-request";
    }
    check("slides with almost no text are rejected", threw);
    const ok = validateWeekQuestionsRequest({ week: 3, weekTitle: "Personas", slidesText: "x".repeat(400), subjectCode: "CSE2UI" });
    check("a valid slides request passes", ok.week === 3 && ok.slidesText.length === 400);
    const tutor = validateTutorRequest({
      subject: { name: "UI", weeks: [{ week: 1, title: "Intro", topics: ["a"] }] },
      question: "What is a persona?",
      history: [
        { role: "tutor", text: "Hi" },
        { role: "hacker", text: "x" },
      ],
    });
    check("tutor requests are cleaned", tutor.history.length === 2 && tutor.history[1].role === "student" && tutor.subject.weeks.length === 1);
    threw = false;
    try {
      validateTutorRequest({ subject: { name: "UI" }, question: "" });
    } catch {
      threw = true;
    }
    check("an empty tutor question is rejected", threw);
    const good = "https://lms.latrobe.edu.au/calendar/export_execute.php?userid=1&authtoken=abc&preset_what=all";
    check("a La Trobe Moodle export link is allowed", validateCalendarUrl(good).hostname === "lms.latrobe.edu.au");
    const bad = [
      "http://lms.latrobe.edu.au/calendar/export_execute.php",
      "https://evil.example.com/calendar/export_execute.php",
      "https://lms.latrobe.edu.au.evil.com/calendar/export_execute.php",
      "https://lms.latrobe.edu.au/admin/index.php",
      "https://user:pw@lms.latrobe.edu.au/calendar/export_execute.php",
      "https://lms.latrobe.edu.au:8443/calendar/export_execute.php",
      "file:///etc/passwd",
      "not a url",
    ];
    const refused = bad.filter((u) => {
      try {
        validateCalendarUrl(u);
        return false;
      } catch (e) {
        return e instanceof CalendarProxyError;
      }
    });
    check("anything else is refused", refused.length === bad.length, bad.filter((u) => !refused.includes(u)).join(", "));
  });

  section("22. Weak-spot map", () => {
    const a = makeSubject(1, 6, 1, "arcane");
    resetWith([a]);
    const q = { week: 2 };
    for (let i = 0; i < 3; i++) recordAnswer(a.id, q, false);
    check("too few answers isn't judged yet", !isWeakWeek(realmStore.get(), a.id, 2));
    recordAnswer(a.id, q, true);
    check("1 of 4 right is a weak week", isWeakWeek(realmStore.get(), a.id, 2) && weakWeeks(realmStore.get(), a)[0]?.week === 2);
    for (let i = 0; i < 6; i++) recordAnswer(a.id, q, true);
    check("getting it right clears the warning", !isWeakWeek(realmStore.get(), a.id, 2));
    for (let i = 0; i < 5; i++) recordAnswer(a.id, { week: 4 }, false);
    check("the tutor sends you to the weak week first", nextStudyAdvice(realmStore.get(), a).includes("Week 4"));
    const raw = JSON.parse(JSON.stringify(realmStore.get())) as { progress: Record<string, unknown> };
    raw.progress.accuracy = { ok: { right: 1, wrong: 2 }, bad: { right: "x" } };
    check("save sanitising keeps valid tallies only", Object.keys(sanitizeState(raw).progress.accuracy).join() === "ok");
  });

  section("23. Grades and WAM (La Trobe rules)", () => {
    check("grade bands follow La Trobe coursework grades", gradeFor(80).letter === "A" && gradeFor(79.9).letter === "B" && gradeFor(60).letter === "C" && gradeFor(50).letter === "D" && gradeFor(49).letter === "N");
    const a = makeSubject(1, 4, 3, "arcane");
    a.assessments = a.assessments.map((x, i) => ({ ...x, weightPercent: [30, 30, 40][i] }));
    const b = makeSubject(2, 4, 1, "forge");
    b.assessments = [{ ...b.assessments[0], weightPercent: 100 }];
    b.creditPoints = 30;
    resetWith([a, b]);
    setMark(a.assessments[0].id, 24, 30);
    let r = subjectResult(realmStore.get(), a);
    check("a mark out of 30 converts to its weighted share", Math.abs(r.earned - 24) < 1e-9 && r.markedWeight === 30 && Math.round(r.average!) === 80);
    check("needed average for an A on the remaining 70%", Math.abs(neededForTarget(r, 80)! - 80) < 1e-9);
    check("an impossible target shows above 100", neededForTarget(r, 80 + 30)! > 100);
    setMark(a.assessments[1].id, 60, 100);
    setMark(a.assessments[2].id, 70, 100);
    r = subjectResult(realmStore.get(), a);
    check("a fully marked subject has a final mark", r.final === Math.round(24 + 18 + 28));
    setMark(b.assessments[0].id, 90, 100);
    const w = wam(realmStore.get());
    check("WAM is weighted by credit points", w !== null && Math.abs(w.value - (70 * 15 + 90 * 30) / 45) < 1e-9 && w.credit === 45);
    setMark(b.assessments[0].id, null);
    check("removing a mark removes it", !realmStore.get().progress.marks[b.assessments[0].id]);
    const c = makeSubject(3, 4, 2, "grove");
    c.assessments = c.assessments.map((x) => ({ ...x, weightPercent: null }));
    resetWith([c]);
    setMark(c.assessments[0].id, 50);
    check("unknown weights are never guessed", subjectResult(realmStore.get(), c).average === null && subjectResult(realmStore.get(), c).unknownWeight.length === 2);
    const raw = JSON.parse(JSON.stringify(realmStore.get())) as { progress: Record<string, unknown> };
    raw.progress.marks = { ok: { score: 5, outOf: 10 }, neg: { score: -1, outOf: 10 }, over: { score: 11, outOf: 10 } };
    check("save sanitising rejects impossible marks", Object.keys(sanitizeState(raw).progress.marks).join() === "ok");
  });

  section("24. Study plan and calendar export", () => {
    const a = makeSubject(1, 4, 1, "arcane");
    a.assessments[0] = { ...a.assessments[0], kind: "project", dueDate: addDays(todayIso(), 20), steps: ["Read", "Plan", "Build", "Submit"] };
    resetWith([a]);
    const plan = planFor(realmStore.get(), a, a.assessments[0]);
    check("a plan exists for a dated quest", plan !== null && plan.steps.length === 4);
    check("the last step lands on the due date", plan!.steps[3].date === plan!.due);
    check("steps start within two weeks of the deadline", plan!.steps[0].date >= addDays(plan!.due, -PLAN_WINDOW_DAYS) && plan!.steps.every((s, i, all) => i === 0 || s.date >= all[i - 1].date));
    setQuestStep(a.assessments[0].id, 0, true);
    const after = planFor(realmStore.get(), a, a.assessments[0])!;
    check("done steps are marked and not rescheduled", after.steps[0].done && after.steps.filter((s) => !s.done).length === 3);
    const ics = plansToIcs(allPlans(realmStore.get()), new Date("2026-10-20T00:00:00Z"));
    check("the .ics is a valid calendar with step and deadline events", ics.startsWith("BEGIN:VCALENDAR") && ics.trim().endsWith("END:VCALENDAR") && (ics.match(/BEGIN:VEVENT/g) ?? []).length === 4);
    check("calendar lines are folded under 75 characters", ics.split("\r\n").every((l) => l.length <= 75));
    check("parsing our own export gives the deadline back", parseCalendar(ics).some((e) => e.summary.startsWith("DUE") && e.date === plan!.due));
    const past = { ...a.assessments[0], dueDate: addDays(todayIso(), -2) };
    check("no plan for a deadline that has passed", planFor(realmStore.get(), a, past) === null);
  });

  section("25. Achievements and titles", () => {
    const a = makeSubject(1, 4, 1, "arcane");
    resetWith([a]);
    check("nothing is unlocked at the start", checkAchievements().length === 0);
    studyWeek(a.id, 1);
    const fresh = checkAchievements().map((x) => x.id);
    check("studying unlocks 'First steps'", fresh.includes("first-steps"));
    check("an achievement unlocks only once", checkAchievements().length === 0);
    check("a title can't be worn before it's earned", (setTitle("the Diligent"), realmStore.get().progress.title === null));
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, streak: { current: 7, best: 7, lastDay: todayIso() } } }));
    checkAchievements();
    setTitle("the Diligent");
    check("an earned title can be worn", realmStore.get().progress.title === "the Diligent");
    setCurriculum({ enrolment, subjects: [a], createdAt: "z" });
    check("achievements and titles survive re-enrolling", Boolean(realmStore.get().progress.achievements["first-steps"]) && realmStore.get().progress.title === "the Diligent");
    check("every achievement has a unique id", new Set(ACHIEVEMENTS.map((x) => x.id)).size === ACHIEVEMENTS.length);
  });

  section("26. Pasted tutorial questions", () => {
    const text = [
      "1. Which status code means Not Found?",
      "a) 200",
      "b) 301",
      "c) 404",
      "d) 500",
      "Answer: c",
      "Explanation: 404 means no resource at that URL.",
      "",
      "Q2) Which hook runs side effects",
      "after render?",
      "A. useMemo",
      "B. useEffect *",
      "C. useRef",
      "D. useId",
      "",
      "3. A question with only two choices",
      "a) yes",
      "b) no",
      "Answer: a",
      "",
      "4. No answer given here",
      "a) one",
      "b) two",
      "c) three",
      "d) four",
    ].join("\n");
    const parsed = parsePastedQuestions(text);
    check("two good questions are read", parsed.questions.length === 2, JSON.stringify(parsed));
    check("an 'Answer: c' line sets the answer", parsed.questions[0]?.answerIndex === 2 && parsed.questions[0].explanation.startsWith("404"));
    check("a * mark sets the answer and multi-line prompts join", parsed.questions[1]?.answerIndex === 1 && parsed.questions[1].prompt === "Which hook runs side effects after render?" && parsed.questions[1].choices[1] === "useEffect");
    check("bad questions are skipped with a reason, never guessed", parsed.skipped.length === 2 && parsed.skipped.every((s) => s.reason.length > 0));
    const byText = parsePastedQuestions("What is 2+2?\na) 3\nb) 4\nc) 5\nd) 22\nAnswer: 4");
    check("an answer given as text is matched", byText.questions[0]?.answerIndex === 1);
  });

  section("27b. Studying a week takes real study", () => {
    realmStore.replace(createEmptyState());
    const q = (id: string, week: number | null) => ({ id, prompt: `Question ${id}?`, choices: ["a", "b", "c", "d"], answerIndex: 0, explanation: "Because.", week });
    const s = makeSubject(7, 3, 0);
    s.questions = [q("w1a", 1), q("w1b", 1), q("w1c", 1), q("w1d", 1), q("w2a", 2), q("any", null)];
    setCurriculum({ enrolment: { country: "Australia", city: "Melbourne", university: "Test U", course: "", yearLevel: "First year", teachingPeriod: "Semester 1", year: 2026, startDate: null }, subjects: [s], createdAt: new Date().toISOString() });
    check("a week with its own questions offers a three-question check", hasStudyCheck(s, 1) && studyCheckQuestions(s, 1).length === STUDY_CHECK.questions && studyCheckQuestions(s, 1).every((x) => x.week === 1));
    check("a week with too few questions of its own has no check (the lecture is the way)", !hasStudyCheck(s, 2) && !hasStudyCheck(s, 3));
    const before = realmStore.get().progress.skillXp[s.id] ?? 0;
    check("failing the check pays nothing and leaves the week unstudied", !finishStudyCheck(s.id, 1, STUDY_CHECK.toPass - 1) && (realmStore.get().progress.skillXp[s.id] ?? 0) === before && !realmStore.get().progress.weeks[weekKey(s.id, 1)]?.studiedAt);
    check("passing the check studies the week with the full reward", finishStudyCheck(s.id, 1, STUDY_CHECK.toPass) && Boolean(realmStore.get().progress.weeks[weekKey(s.id, 1)]?.studiedAt) && (realmStore.get().progress.skillXp[s.id] ?? 0) > before);
    const after = realmStore.get().progress.skillXp[s.id] ?? 0;
    finishStudyCheck(s.id, 1, STUDY_CHECK.questions);
    check("passing again never pays twice", (realmStore.get().progress.skillXp[s.id] ?? 0) === after);
    check("a week the subject doesn't have can't be studied", !finishStudyCheck(s.id, 9, STUDY_CHECK.questions));
    realmStore.replace(createEmptyState());
  });

  section("27. Subject workshops", () => {
    const pick = (code: string, name: string) => workshopFor({ code, name });
    check("La Trobe subjects get the right workshop", pick("CSE2UI", "User Interface Design") === "usability" && pick("CSE3CWA", "Cloud-Based Web Application Development") === "bug-hunt" && pick("", "Project Management") === "critical-path" && pick("", "Professional Practices and Entrepreneurship in Information Technology") === "ethics");
    check("unrelated subjects get none", pick("BIO1GEN", "Genetics") === null);
    check("the four La Trobe codes pick their workshop", pick("CSE2UI", "x") === "usability" && pick("CSE3CWA", "x") === "bug-hunt" && pick("CSE3PM", "x") === "critical-path" && pick("CSE3PPE", "x") === "ethics");
    check("nursing and law professional practice get no ACS ethics", pick("NUR3PP", "Professional Practice") === null && pick("LAW3PRO", "Professional Ethics and Legal Practice") === null);
    check("'development' outside computing gets no Bug Hunt", pick("EDU2CHD", "Child Development") === null);
    check("computing ethics still gets the tribunal", pick("", "Ethics in Information Technology") === "ethics");
    check("bug-hunt items point at a real line", BUG_HUNT.every((b) => b.bugLine >= 0 && b.bugLine < b.lines.length && b.explanation && b.fix));
    check("usability items have 4 parts and a valid flaw", USABILITY.every((u) => u.elements.length === 4 && u.flaw >= 0 && u.flaw < 4));
    check("ethics items offer 4 distinct ACS values", ETHICS.every((e) => new Set([e.value, ...e.others]).size === 4 && [e.value, ...e.others].every((v) => v >= 0 && v < ACS_VALUES.length)));
    const tasks = [
      { id: "A", duration: 3, after: [] },
      { id: "B", duration: 2, after: ["A"] },
      { id: "C", duration: 4, after: ["A"] },
      { id: "D", duration: 1, after: ["B", "C"] },
    ];
    const an = analyseNetwork(tasks);
    check("critical path analysis is correct", an.duration === 8 && an.critical.join("") === "ACD" && an.float.B === 2);
    let ok = true;
    for (let seed = 1; seed <= 300; seed++) {
      const p = makePathPuzzle(seed);
      if (p.choices.length !== 4 || new Set(p.choices).size !== 4 || p.answerIndex < 0 || p.answerIndex > 3) ok = false;
    }
    check("300 generated network puzzles all have 4 distinct choices and a valid answer", ok);
    const world = generateWorld([makeSubject(1, 4, 1, "arcane")], { university: "La Trobe University" });
    check("the Agora has a Hall of Trophies", world.objects.some((o) => o.kind === "trophy-hall"));
    check("every Exam Arena offers a mock exam", world.objects.filter((o) => o.kind === "duel-arena").every((o) => o.actions.some((x) => x.id === "mock")));
  });

  section("28. Explain it back (offline check, XP)", () => {
    const a = makeSubject(1, 4, 1, "arcane");
    resetWith([a]);
    const ref = "Experts inspect an interface against usability principles such as Nielsen's heuristics.";
    const good = keywordScore(ref, "Usability experts inspect the interface and compare it against principles like Nielsen heuristics to find problems.");
    const bad = keywordScore(ref, "It is when you ask lots of users to try the app in a lab and watch them closely.");
    check("covering the course's ideas scores higher", good.score > bad.score);
    check("the offline check never claims more than 70", good.score <= 70);
    const xp1 = recordExplanation(a.id, "term:x", 60);
    const xp2 = recordExplanation(a.id, "term:x", 60);
    const xp3 = recordExplanation(a.id, "term:x", 75);
    check("XP only for beating your best", xp1 === 60 * EXPLAIN_XP_PER_POINT && xp2 === 0 && xp3 === 15 * EXPLAIN_XP_PER_POINT);
  });

  section("29. Reminders and exam-week siege", () => {
    const a = makeSubject(1, 4, 2, "arcane");
    a.assessments[0] = { ...a.assessments[0], kind: "project", dueDate: addDays(todayIso(), 2) };
    a.assessments[1] = { ...a.assessments[1], kind: "project", dueDate: addDays(todayIso(), 9) };
    resetWith([a]);
    let rem = dueReminders(realmStore.get(), new Date(`${todayIso()}T10:00:00`));
    check("a deadline in 2 days is reminded; one in 9 days isn't", rem.some((r) => r.key.startsWith(`due:${a.assessments[0].id}`)) && !rem.some((r) => r.key.startsWith(`due:${a.assessments[1].id}`)));
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, streak: { current: 4, best: 4, lastDay: addDays(todayIso(), -1) } } }));
    rem = dueReminders(realmStore.get(), new Date(`${todayIso()}T20:00:00`));
    check("an evening with no study warns about the streak", rem.some((r) => r.key.startsWith("streak:")));
    check("no streak warning in the morning", !dueReminders(realmStore.get(), new Date(`${todayIso()}T09:00:00`)).some((r) => r.key.startsWith("streak:")));
    check("no siege without an exam soon", !siegeActive(realmStore.get()));
    const exam = makeSubject(2, 4, 2, "forge");
    exam.assessments[0] = { ...exam.assessments[0], kind: "exam", dueDate: addDays(todayIso(), 10) };
    exam.assessments[1] = { ...exam.assessments[1], kind: "report", dueDate: addDays(todayIso(), 40) };
    resetWith([exam]);
    check("an exam within two weeks starts the siege", siegeActive(realmStore.get()));
    check("during a siege far-off bosses wake too", bossStatus(realmStore.get(), exam, exam.assessments[1]).awake);
    const coins = realmStore.get().progress.coins;
    defeatBoss(exam.assessments[0].id);
    defeatBoss(exam.assessments[1].id);
    check("clearing every boss in a siege pays the bonus once", realmStore.get().progress.siegeClaimed && realmStore.get().progress.coins === coins + 2 * BOSS_COINS + SIEGE_BONUS_COINS);
  });

  section("30. Real-clock sky", () => {
    const noon = skyAt(12);
    const night = skyAt(23);
    const dusk = skyAt(18.2);
    check("noon is day with a bright sun high up", !noon.night && noon.light.y > 15 && noon.lightIntensity > 2);
    check("11 pm is night with a dim moon", night.night && night.lightIntensity < 1);
    check("dusk is warmer and dimmer than noon", dusk.lightIntensity < noon.lightIntensity);
  });

  section("31. Semester calendar (La Trobe dates, breaks, exam period)", () => {
    const enrol = { country: "Australia", city: "Melbourne", university: "La Trobe University", course: "", yearLevel: "", teachingPeriod: "Semester 2", year: 2026, startDate: null };
    const dated = withLaTrobeDates(enrol);
    check("La Trobe Semester 2 2026 gets the official start, break and exams", dated.startDate === "2026-07-13" && dated.breakWeeks?.[0] === "2026-08-31" && dated.examPeriod?.start === "2026-10-16");
    check("other universities and periods are left alone", withLaTrobeDates({ ...enrol, university: "Monash University" }).startDate === null && withLaTrobeDates({ ...enrol, teachingPeriod: "Summer" }).startDate === null);
    check("an existing start date is never overwritten", withLaTrobeDates({ ...enrol, startDate: "2026-07-20" }).startDate === "2026-07-20");
    const cur = { enrolment: dated, subjects: [], createdAt: "x" };
    check("week 7 is the week before the break", teachingWeekMonday(cur, 7) === "2026-08-24");
    check("week 8 comes after the mid-semester break", teachingWeekMonday(cur, 8) === "2026-09-07");
    check("during the break the current week stays at 7", currentTeachingWeek(cur, "2026-09-02") === 7);
    check("the first day is week 1", currentTeachingWeek(cur, "2026-07-13") === 1 && currentTeachingWeek(cur, "2026-07-12") === null);
    check("a week-12 deadline lands on Friday 9 October", resolvedDueDate({ id: "a", title: "t", kind: "report", weightPercent: null, dueWeek: 12, dueDate: null, description: "", steps: [] }, cur) === "2026-10-09");
    check("the exam period (and the week before) counts as exam time", inExamPeriod(cur, "2026-10-20") && inExamPeriod(cur, "2026-10-10") && !inExamPeriod(cur, "2026-09-01"));
  });

  section("32. Campus hub", () => {
    for (const n of [1, 3, 4, 6, 8]) {
      const subjects = Array.from({ length: n }, (_, i) => makeSubject(i + 1, 6, 1, "arcane"));
      const world = generateWorld(subjects, { university: "La Trobe University" });
      const library = world.objects.find((o) => o.kind === "library");
      check(`${n} subjects: the Agora has the Borchardt Library`, library?.name === "Borchardt Library" && library.actions[0]?.id === "library");
      check(`${n} subjects: campus dressing is placed`, world.hubProps.filter((p) => p.kind === "lamp").length >= 2 && world.hubProps.some((p) => p.kind === "bench"));
      const onInteractable = world.hubProps.some((p) => world.objects.some((o) => Math.floor(p.x) >= o.x && Math.floor(p.x) < o.x + o.w && Math.floor(p.z) >= o.z && Math.floor(p.z) < o.z + o.d));
      check(`${n} subjects: no dressing sits on an interactable`, !onInteractable);
      const start = { x: Math.floor(world.spawn.x), z: Math.floor(world.spawn.z) };
      const unreachable = world.objects.filter((o) => findPath(world, start, interactionTiles(world, o)) === null);
      check(`${n} subjects: everything is still reachable on foot`, unreachable.length === 0, unreachable.map((o) => o.id).join(", "));
    }
    check("other universities get a Great Library", generateWorld([makeSubject(1, 4, 1, "arcane")], { university: "Monash University" }).objects.find((o) => o.kind === "library")?.name === "Great Library");
  });

  section("33. Focus: study powers play", () => {
    const a = makeSubject(1, 6, 2, "arcane");
    resetWith([a]);
    const f0 = realmStore.get().progress.focus;
    check("a new adventurer starts with some Focus", f0 === FOCUS.start);
    studyWeek(a.id, 1);
    check("studying a week earns Focus", realmStore.get().progress.focus === f0 + FOCUS.earn.studyWeek);
    setQuestStep(a.assessments[0].id, 0, true);
    check("a quest step earns Focus", realmStore.get().progress.focus === f0 + FOCUS.earn.studyWeek + FOCUS.earn.questStep);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 98 } }));
    gainFocus(50, "test");
    check("Focus is capped", realmStore.get().progress.focus === FOCUS.max);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 0 } }));
    check("playing without Focus is refused", beginGather("minnow") === false);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 5 } }));
    check("a gathering attempt costs 1 Focus", beginGather("minnow") === true && realmStore.get().progress.focus === 4);
  });

  section("34. Life skills: gathering, cooking, crafting", () => {
    const a = makeSubject(1, 4, 1, "arcane");
    resetWith([a]);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 100 } }));
    check("high-tier nodes need the level", gatherBlocker(realmStore.get(), "goldfin") !== null && gatherBlocker(realmStore.get(), "minnow") === null);
    const miss = finishGather("minnow", false, 0);
    check("a missed strike gives a little XP and no fish", miss.got === 0 && miss.xp > 0 && (realmStore.get().progress.materials.minnow ?? 0) === 0);
    const ok = finishGather("minnow", true, 0.5);
    check("a clean strike gives a fish and XP", ok.got === 1 && realmStore.get().progress.materials.minnow === 1);
    const perfect = finishGather("minnow", true, 0.95);
    check("a perfect strike gives two", perfect.got === 2 && realmStore.get().progress.materials.minnow === 3);
    check("XP reaches the fishing skill", (realmStore.get().progress.lifeXp.fishing ?? 0) > 0);
    check("cooking needs a raw fish", cook("cooked-trout") === "missing");
    let cooked = 0;
    for (let i = 0; i < 3; i++) if (cook("cooked-minnow", () => 0.99) === "cooked") cooked++;
    check("cooking turns fish into food", cooked === 3 && realmStore.get().progress.materials["cooked-minnow"] === 3 && (realmStore.get().progress.materials.minnow ?? 0) === 0);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, materials: { ...s.progress.materials, minnow: 1 } } }));
    check("low cooking level can burn food", cook("cooked-minnow", () => 0) === "burnt");
    check("eating heals and uses the food", eat("cooked-minnow") === 6 && realmStore.get().progress.materials["cooked-minnow"] === 2);
    check("crafting needs the materials", craftBlocker(realmStore.get(), "copper-arms") !== null && craft("copper-arms") === false);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, materials: { ...s.progress.materials, copper: 3, oak: 2 } } }));
    check("crafting uses materials and equips the weapon", craft("copper-arms") === true && realmStore.get().progress.weapon === "copper-arms" && (realmStore.get().progress.materials.copper ?? 0) === 0);
    check("a crafted weapon adds power", weaponPower(realmStore.get()) === 2);
    check("can't craft the same weapon twice", craftBlocker(realmStore.get(), "copper-arms") !== null);
    check("higher tiers need crafting levels", craftBlocker(realmStore.get(), "gold-arms")?.includes("Crafting level 45") === true);
    setCurriculum({ enrolment, subjects: [a], createdAt: "new-sem" });
    check("life skills, bag and weapons carry over to a new semester", realmStore.get().progress.weapon === "copper-arms" && (realmStore.get().progress.lifeXp.fishing ?? 0) > 0);
    const world = generateWorld([a], { university: "La Trobe University" });
    const kinds = (k: string) => world.objects.filter((o) => o.kind === k).length;
    check("the wilds have fishing spots, ore rocks and trees", kinds("fishing-spot") >= 4 && kinds("ore-rock") >= 4 && kinds("tree-node") >= 4);
    check("every node yields a real resource with an easy tier present", world.objects.filter((o) => o.resource).every((o) => resource(o.resource!)) && world.objects.some((o) => o.resource === "minnow") && world.objects.some((o) => o.resource === "copper") && world.objects.some((o) => o.resource === "oak"));
    check("there's a campfire and an anvil", kinds("cooking-fire") === 1 && kinds("anvil") === 1);
    const fishingOnShore = world.objects.filter((o) => o.kind === "fishing-spot").every((o) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => world.kinds[(o.z + dz) * world.size + o.x + dx] === 3));
    check("fishing spots sit next to water", fishingOnShore);
  });

  section("35. Combat and the crypt", () => {
    const a = makeSubject(1, 6, 1, "arcane");
    resetWith([a]);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 100 } }));
    const world = generateWorld([a], { university: "La Trobe University" });
    check("the wilds have monster camps and a crypt", world.camps.length >= 4 && world.objects.some((o) => o.kind === "crypt-gate"));
    const studyObjects = world.objects.filter((o) => !o.resource && o.kind !== "crypt-gate");
    check("camps keep away from study areas", world.camps.every((c) => studyObjects.every((o) => Math.hypot(o.x + o.w / 2 - c.x, o.z + o.d / 2 - c.z) >= 7)));
    spawnCamps(world);
    check("camps spawn enemies, easy ones nearest", combat.enemies.length >= 8 && world.camps[0].tier === 0);
    const hits = Array.from({ length: 200 }, () => playerHit(1, 0));
    check("player hits land in a sensible range", Math.min(...hits) >= 1 && Math.max(...hits) <= 6);
    check("a weapon makes hits stronger", playerHit(1, 9, () => 0.5) > playerHit(1, 0, () => 0.5));
    const bones = combat.enemies.find((e) => e.kind === "bones")!;
    const far = { x: bones.x + 2.5, z: bones.z };
    tickCombat(0.1, world, far.x, far.z);
    check("Restless Bones are passive until attacked", bones.state === "idle");
    const focus0 = realmStore.get().progress.focus;
    const target = playerAttack(bones.x + 1, bones.z, () => 0.5);
    check("attacking costs 1 Focus to start the fight", target === bones && realmStore.get().progress.focus === focus0 - 1 && bones.state === "chase");
    let guard = 0;
    while (bones.state !== "dead" && guard++ < 50) {
      combat.player.cooldown = 0;
      playerAttack(bones.x + 1, bones.z, () => 0.5);
    }
    check("enough hits defeat it", bones.state === "dead");
    check("a kill pays combat XP and coins", (realmStore.get().progress.lifeXp.combat ?? 0) >= ENEMIES.bones.xp && (realmStore.get().progress.counters.kills ?? 0) === 1);
    check("only the first strike of a fight costs Focus", realmStore.get().progress.focus === focus0 - 1);
    tickCombat(CAMP_RESPAWN_SECONDS + 1, world, far.x + 50, far.z + 50);
    check("camp enemies respawn", bones.state !== "dead" && bones.hp === ENEMIES.bones.hp);
    const warrior = combat.enemies.find((e) => e.kind === "warrior");
    if (warrior) {
      tickCombat(0.05, world, warrior.x + 2, warrior.z);
      check("camp creatures are neutral: walking past doesn't start a fight", warrior.state !== "chase");
      warrior.engaged = true;
      tickCombat(0.05, world, warrior.x + 2, warrior.z);
      check("once you attack, they fight back", warrior.state === "chase");
      combat.player.hp = 1;
      warrior.cooldown = 0;
      warrior.x = warrior.homeX;
      warrior.z = warrior.homeZ;
      const out = tickCombat(0.05, world, warrior.x + 0.5, warrior.z, () => 0.99);
      check("a knock-out heals you and sends enemies home", out && combat.player.hp === combat.player.max && warrior.state === "return");
    }
    // The crypt.
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 10 } }));
    const gate = world.objects.find((o) => o.kind === "crypt-gate")!;
    const gx = gate.x + 1;
    const gz = gate.z + 3;
    check("the crypt needs 15 Focus", startDungeon(gx, gz, world) === false);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 40 } }));
    check("entering the crypt spends Focus", startDungeon(gx, gz, world) === true && realmStore.get().progress.focus === 25);
    let waves = 0;
    for (let t = 0; t < 400 && combat.dungeon && !combat.dungeon.done; t++) {
      tickCombat(0.5, world, gx, gz, () => 0.5);
      for (const e of combat.enemies.filter((x) => x.dungeon && x.state !== "dead")) {
        e.hp = 0;
        e.state = "dead";
        e.deadAt = combat.time;
      }
      combat.player.hp = combat.player.max;
      waves = Math.max(waves, (combat.dungeon?.wave ?? 0) + 1);
    }
    check("clearing three waves finishes the crypt", combat.dungeon?.done === true && waves === WAVES.length && (realmStore.get().progress.counters.dungeonClears ?? 0) === 1);
    check("a clear time is recorded", (realmStore.get().progress.counters.dungeonBest ?? 0) > 0);
    startDungeon(gx, gz, world);
    tickCombat(0.1, world, gx + DUNGEON_LEASH + 2, gz);
    check("walking away abandons the crypt", combat.dungeon?.done === true && !combat.enemies.some((e) => e.dungeon));
  });

  section("36. Arcade: Siege of Procrastination and the Island Race", () => {
    const td = tdNewGame();
    check("towers can't go on the path", !tdBuild(td, "lamp", TD_PATH[3][0], TD_PATH[3][1]));
    check("building a tower spends gold", tdBuild(td, "lamp", 2, 2) && td.gold === 80 - TD_TOWERS.lamp.cost);
    check("no building twice on one square", !tdBuild(td, "lamp", 2, 2));
    check("selling refunds half", tdSell(td, 2, 2) && td.gold === 80 - TD_TOWERS.lamp.cost + Math.floor(TD_TOWERS.lamp.cost / 2));
    const open = tdNewGame();
    tdStartWave(open);
    for (let i = 0; i < 3000 && open.waveActive && !open.over; i++) tdStep(open, 0.02);
    check("undefended, every distraction reaches the desk", open.lives === 10 - TD_WAVES[0].length && open.wave === 1);
    const held = tdNewGame();
    held.gold = 999;
    for (const [c, r] of [[2, 2], [4, 2], [4, 4], [5, 4], [7, 3], [9, 3], [11, 5], [2, 0]] as Array<[number, number]>) tdBuild(held, "lamp", c, r);
    const goldBefore = held.gold;
    tdStartWave(held);
    for (let i = 0; i < 3000 && held.waveActive && !held.over; i++) tdStep(held, 0.02);
    check("a line of Focus Lamps holds wave 1", held.lives === 10 && held.wave === 1 && held.killed === TD_WAVES[0].length);
    check("kills and a cleared wave pay gold", held.gold > goldBefore);
    check("reward grows with waves held", tdReward({ ...held, wave: 3, over: "lost" }) === 36 && tdReward({ ...held, wave: 8, over: "won" }) === 196);

    // The race.
    const a = makeSubject(1, 6, 1, "arcane");
    resetWith([a]);
    const world = generateWorld([a], { university: "La Trobe University" });
    const hall = world.objects.find((o) => o.kind === "games-hall");
    check("the Agora has a games hall", Boolean(hall) && hall!.actions[0].id === "arcade");
    const sx = world.spawn.x;
    const sz = world.spawn.z;
    const course = planCourse(world, sx, sz);
    check("the course has gates around the island and finishes at the start", course.length >= 6 && Math.hypot(course[course.length - 1].x - sx, course[course.length - 1].z - sz) < 1);
    check("every gate is on walkable ground", course.every((g) => isWalkable(world, Math.floor(g.x), Math.floor(g.z))));
    check("gates keep clear of monster camps", course.slice(0, -1).every((g) => world.camps.every((c) => Math.hypot(c.x - Math.floor(g.x), c.z - Math.floor(g.z)) >= CAMP_CLEARANCE)));
    const angles = course.slice(0, -1).map((g) => Math.atan2(g.z - world.size / 2, g.x - world.size / 2));
    check("gates circle the island", Math.max(...angles) - Math.min(...angles) > Math.PI);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 2 } }));
    check("racing needs 3 Focus", startRace(world, sx, sz) === false);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 20 } }));
    check("starting a race spends Focus", startRace(world, sx, sz) === true && realmStore.get().progress.focus === 17);
    check("a second start while racing is refused", startRace(world, sx, sz) === false);
    const coins0 = realmStore.get().progress.coins;
    tickRace(1, sx + 30, sz + 30, 3.4);
    check("far from the gate, nothing happens", race.run!.next === 0);
    for (const g of race.run!.gates) tickRace(1, g.x, g.z, 3.4);
    check("passing every gate finishes the race", race.run!.done && race.run!.result !== null);
    check("a finish pays coins and records a best time", realmStore.get().progress.coins > coins0 && (realmStore.get().progress.counters.raceBest ?? 0) > 0);
    const t = medalTimes(100, 3.4);
    check("medal times get easier gold, silver, bronze", t.gold < t.silver && t.silver < t.bronze);
    startRace(world, sx, sz);
    tickRace(RACE_LIMIT_SECONDS + 1, sx + 30, sz + 30, 3.4);
    check("the race ends at the time limit", race.run!.done && race.run!.result === null);
  });

  section("37. Customisation: outfits, dyes, emotes and the dorm", () => {
    // Outfits.
    check("every adventurer has a head, torso, arms and legs", (["knight", "mage", "rogue", "rogue_hooded", "barbarian"] as const).every((a) => (["head", "torso", "arms", "legs"] as const).every((slot) => partMeshes(a, slot).length > 0)));
    check("rogues have no headgear to lend", classesWith("headgear").join(",") === "knight,mage,barbarian");
    const look = resolveOutfit("mage", { headgear: "knight", torso: "barbarian", head: "none" as never });
    check("borrowed parts resolve, required parts can't be removed", look.headgear === "knight" && look.torso === "barbarian" && look.head === "mage" && look.legs === "mage");
    check("a rogue base wears no headgear unless borrowed", resolveOutfit("rogue", {}).headgear === "none" && resolveOutfit("rogue", { headgear: "mage" }).headgear === "mage");
    check("the model files needed are the base plus each lender", outfitClasses("mage", { headgear: "knight", legs: "knight", torso: "barbarian" }).join(",") === "mage,knight,barbarian");
    check("the hooded rogue's body counts as the rogue's own", isOwnPart("rogue_hooded", "torso", "rogue") && !isOwnPart("rogue_hooded", "head", "rogue"));
    check("meshes map back to their slot", slotOfMesh("knight", "Knight_Helmet") === "headgear" && slotOfMesh("knight", "1H_Sword") === null && slotOfMesh("mage", "Spellbook") === "torso");
    const charFile = (id: string) => `public/assets/v2/models/kaykit/characters/${id}.glb`;
    const meshNames = (id: string) => {
      const b = readFileSync(charFile(id));
      const len = b.readUInt32LE(12);
      const json = JSON.parse(b.subarray(20, 20 + len).toString("utf8")) as { nodes: Array<{ name: string; mesh?: number }> };
      return new Set(json.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name));
    };
    check(
      "every part named in the outfit table exists in its model file",
      (["knight", "mage", "rogue", "rogue_hooded", "barbarian"] as const).every((a) => {
        const names = meshNames(a);
        return OUTFIT_SLOTS.every((slot) => partMeshes(a, slot.id).every((n) => names.has(n)));
      }),
    );
    const glbJson = (file: string) => {
      const b = readFileSync(file);
      return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) as { nodes: Array<{ name: string; mesh?: number; skin?: number }>; animations?: Array<{ name: string }> };
    };
    check(
      "every emote plays a real animation on both bodies",
      (["female", "male"] as const).every((body) => {
        const clips = new Set((glbJson(`public/assets/v2/${outfitFile(body, BASE_OUTFIT[body])}`).animations ?? []).map((a) => a.name));
        return EMOTES.every((e) => clips.has(CLIP_ALIAS[e.clip] ?? e.clip)) && ["Idle", "Running_A", "Interact", "Spellcast_Shoot", "Punch", "Cheer"].every((c) => clips.has(CLIP_ALIAS[c]));
      }),
    );

    // Dyes and the wardrobe.
    realmStore.replace(createEmptyState());
    setPlayer({ name: "T", look: { skin: "#fff", hair: "#000", tunic: "#f00", legs: "#00f", cape: "#0f0" } });
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, coins: 1000 } }));
    check("dyes can't be used before they're bought", setDye("torso", "dye-azure") === false);
    check("buying a dye spends coins once", buyDye("dye-azure") && realmStore.get().progress.coins === 880 && !buyDye("dye-azure"));
    check("locked dyes need the unlock", buyDye("dye-gilded") === false);
    setDye("torso", "dye-azure");
    setOutfitPart("headgear", "knight");
    setOutfitPart("head", "none");
    check("outfit and dyes are saved", realmStore.get().progress.wardrobe.outfit.headgear === "knight" && !realmStore.get().progress.wardrobe.outfit.head && dyeTints(realmStore.get().progress.wardrobe.dyes).torso === DYES.find((d) => d.id === "dye-azure")!.tint);
    const roundTrip = sanitizeState(JSON.parse(realmStore.exportJson()));
    check("outfit and dyes survive a save round-trip", roundTrip.progress.wardrobe.outfit.headgear === "knight" && roundTrip.progress.wardrobe.dyes.torso === "dye-azure");
    const hostile = sanitizeState({ version: 1, progress: { wardrobe: { owned: [], outfit: { head: "none", torso: "dragon", cape: "none" }, dyes: { legs: "<script>" } }, dorm: { owned: { "bed-single-a": 1e9, "../x": 2 }, placed: [{ uid: "a", id: "bed-single-a", c: 1.7, r: 0, rot: 7 }, { id: 3 }] } } });
    check("bad outfit and dorm data is cleaned", !hostile.progress.wardrobe.outfit.head && !hostile.progress.wardrobe.outfit.torso && hostile.progress.wardrobe.outfit.cape === "none" && !hostile.progress.wardrobe.dyes.legs && hostile.progress.dorm.owned["bed-single-a"] === 20 && !("../x" in hostile.progress.dorm.owned) && hostile.progress.dorm.placed.length === 1 && hostile.progress.dorm.placed[0].c === 1 && hostile.progress.dorm.placed[0].rot === 3);

    // The dorm.
    check("moving in furnishes the room once", moveIn() && realmStore.get().progress.dorm.placed.length === STARTER.length && !moveIn());
    const dorm = () => realmStore.get().progress.dorm;
    check("every furniture model file exists", FURNITURE.every((f) => existsSync(`public/assets/v2/models/kaykit/furniture/${f.id}.glb`)));
    check("starter furniture doesn't overlap", dorm().placed.every((p) => placeBlocker({ ...dorm(), placed: dorm().placed.filter((x) => x.uid !== p.uid) }, p.id, p.c, p.r, p.rot) === null));
    check("you can't place what you don't own", placeFurniture("couch-pillows", 3, 3, 0) === null);
    check("furniture costs coins", buyFurniture("table-medium") && buyFurniture("lamp-table") && buyFurniture("rug-oval-a") && buyFurniture("shelf-b-large-decorated"));
    check("nothing can overlap the bed", placeBlocker(dorm(), "table-medium", 0, 1, 0) !== null);
    check("furniture must fit inside the room", placeBlocker(dorm(), "table-medium", ROOM_COLS - 1, 0, 0) !== null);
    check("the doorway stays clear", placeBlocker(dorm(), "table-medium", ROOM_COLS - 2, ROOM_ROWS - 2, 0) !== null);
    check("a lamp needs a table to stand on", placeBlocker(dorm(), "lamp-table", 4, 4, 0) !== null);
    const desk = placeFurniture("table-medium", 4, 3, 0);
    check("the desk goes down", desk !== null);
    const lamp = placeFurniture("lamp-table", 5, 4, 0);
    check("a lamp stands on the desk at desk height", lamp !== null && standHeight(dorm(), lamp!) === furniture("table-medium")!.surface);
    check("a rug can go under furniture", placeFurniture("rug-oval-a", 3, 3, 0) !== null);
    check("a shelf hangs on the back wall", placeFurniture("shelf-b-large-decorated", 3, 5, 0) !== null && dorm().placed.find((p) => p.id === "shelf-b-large-decorated")!.r === 0);
    check("two things can't share a wall spot", placeBlocker({ ...dorm(), owned: { ...dorm().owned, "shelf-a-small": 1 } }, "shelf-a-small", 4, 0, 0) !== null);
    check("moving the desk carries the lamp", moveFurniture(desk!.uid, 4, 4, 0) && dorm().placed.find((p) => p.uid === lamp!.uid)!.r === 5);
    check("turning keeps it in the room", turnFurniture(desk!.uid) && dorm().placed.find((p) => p.uid === desk!.uid)!.rot === 1 && !dorm().placed.some((p) => p.uid === lamp!.uid));
    pickUp(desk!.uid);
    check("storing the desk returns it to storage", availableCount(dorm(), "table-medium") === 1 && availableCount(dorm(), "lamp-table") === 1);
    const comfy = comfort(dorm());
    check("comfort adds up and is capped", comfy > 0 && comfy <= MAX_COMFORT && comfortFocusBonus(dorm()) === Math.floor(comfy / 2));
    // A comfy room pays extra Focus with the daily reward.
    const sub = makeSubject(1, 4, 1, "arcane");
    setCurriculum({ enrolment: { country: "Australia", city: "Melbourne", university: "La Trobe University", course: "", yearLevel: "", teachingPeriod: "Semester 2", year: 2026, startDate: null }, subjects: [sub], createdAt: "x" });
    check("the dorm is kept across semesters", dorm().placed.length > 0);
    studyWeek(sub.id, 1);
    recordMinigameWin(sub.id, 50, 1, "t");
    recordMinigameWin(sub.id, 50, 1, "t");
    setQuestStep(sub.assessments[0].id, 0, true);
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, focus: 0 } }));
    claimDaily();
    check("the daily claim adds the comfort bonus", realmStore.get().progress.focus === FOCUS.earn.dailyClaim + comfortFocusBonus(dorm()));
    for (let n = 1; n <= 8; n++) {
      const subjects = Array.from({ length: n }, (_, k) => makeSubject(k + 1, 6, 2, (["arcane", "forge", "grove", "archive", "guild", "tide", "foundry", "alchemy"] as const)[k]));
      const w = generateWorld(subjects, { university: "La Trobe University" });
      const home = w.objects.find((o) => o.kind === "dorm");
      if (!home) {
        check(`${n} subject(s): the Agora has a dorm`, false);
        continue;
      }
      const onRoad = Array.from({ length: home.w * home.d }, (_, k) => w.kinds[(home.z + Math.floor(k / home.w)) * w.size + home.x + (k % home.w)]).some((t) => t === 1);
      const reach = findPath(w, { x: Math.floor(w.spawn.x), z: Math.floor(w.spawn.z) }, interactionTiles(w, home));
      check(`${n} subject(s): the dorm sits off the roads and can be reached`, !onRoad && reach !== null);
    }
  });

  section("38. Real bodies, districts, islands, the walk-in dorm and the course list", () => {
    const glbJson = (file: string) => {
      const b = readFileSync(file);
      return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) as { nodes: Array<{ name: string; mesh?: number }> };
    };
    // Bodies.
    const files = (["female", "male"] as const).flatMap((body) => OUTFITS[body].map((o) => ({ body, o, file: `public/assets/v2/${outfitFile(body, o.id)}` })));
    check("every outfit has a model file", files.every((f) => existsSync(f.file)));
    check(
      "every outfit file has a skinned head, top, legs and shoes",
      files.every(({ file }) => {
        const j = glbJson(file);
        return PART_SLOTS.every((slot) => j.nodes.some((n) => n.name.endsWith(`_${SLOT_SUFFIX[slot.id]}`)));
      }),
    );
    check("outfit files stay small (under 900 KB)", files.every(({ file }) => readFileSync(file).length < 900 * 1024));
    const odd = sanitizeAppearance({ body: "male", parts: { head: "witch", body: "king", legs: 5 }, height: 9, build: -9, muscle: "x", skin: "red", hair: "#123456", outfitColour: "#abcdef" });
    check("appearance data is cleaned", odd.parts.head === BASE_OUTFIT.male && odd.parts.body === "king" && odd.height === 1 && odd.build === -1 && odd.muscle === defaultAppearance("male").muscle && odd.skin === defaultAppearance("male").skin && odd.hair === "#123456");
    const heavy = boneTargets({ body: "female", height: 0, build: 1, muscle: 1 });
    const slim = boneTargets({ body: "female", height: 0, build: -1, muscle: 0 });
    check("build and muscle widen the body; slim narrows it", heavy.Abdomen[0] > 1.2 && slim.Abdomen[0] < 0.8 && heavy["UpperArm.L"][0] > slim["UpperArm.L"][0] + 0.4);
    check("height lengthens the legs and the whole body", boneTargets({ body: "male", height: 1, build: 0, muscle: 0 })["UpperLeg.R"][1] > 1 && heightScale(1) > heightScale(-1));
    check("the files for an outfit mix start with the animated base", appearanceFiles({ ...defaultAppearance("female"), parts: { head: "witch", body: "witch", legs: "punk", feet: "casual" } }).join(",") === ["casual", "witch", "punk"].map((id) => outfitFile("female", id)).join(","));
    // Districts and the harbour.
    for (const n of [1, 4, 8]) {
      const subjects = Array.from({ length: n }, (_, k) => makeSubject(k + 1, 6, 2, (["arcane", "forge", "grove", "archive", "guild", "tide", "foundry", "alchemy"] as const)[k]));
      const w = generateWorld(subjects, { university: "La Trobe University" });
      const start = { x: Math.floor(w.spawn.x), z: Math.floor(w.spawn.z) };
      check(`${n} subject(s): five districts and a harbour`, w.districts.map((d) => d.id).sort().join(",") === "crafts,learning,market,sports,village" && w.objects.some((o) => o.kind === "harbour"));
      // The Sports Grounds: parkour tower, archery range and ping-pong hall, in their district and reachable.
      const sports = w.districts.find((d) => d.id === "sports");
      const sportsKinds = [
        ["parkour-tower", "parkour"],
        ["archery-range", "archery"],
        ["pingpong-hall", "pingpong"],
      ] as const;
      check(
        `${n} subject(s): the Sports Grounds hold the parkour tower, archery range and ping-pong hall`,
        Boolean(sports) &&
          sportsKinds.every(([kind, action]) => {
            const o = w.objects.find((x) => x.kind === kind);
            return o && o.actions[0]?.id === action && Math.hypot(o.x + o.w / 2 - sports!.x, o.z + o.d / 2 - sports!.z) <= sports!.half + 1;
          }),
      );
      check(
        `${n} subject(s): the three sports buildings can be reached on foot`,
        sportsKinds.every(([kind]) => {
          const o = w.objects.find((x) => x.kind === kind);
          return o && findPath(w, start, interactionTiles(w, o), 60000) !== null;
        }),
      );
      // Spacing: neighbouring places (the Agora, district courts, subject regions, the harbour) are a walk apart.
      const C = w.size / 2;
      const harbour = w.objects.find((o) => o.kind === "harbour");
      const places = [
        { id: "agora", x: C, z: C },
        ...w.districts.map((d) => ({ id: d.id, x: d.x + 0.5, z: d.z + 0.5 })),
        ...w.regions.map((r) => ({ id: r.subjectId, x: r.center.x, z: r.center.z })),
        ...(harbour ? [{ id: "harbour", x: harbour.x + 0.5, z: harbour.z + 0.5 }] : []),
      ];
      const close = places.flatMap((p, i) => places.slice(i + 1).filter((q) => Math.hypot(p.x - q.x, p.z - q.z) < 25).map((q) => `${p.id}~${q.id}`));
      check(`${n} subject(s): neighbouring places are at least 25 tiles apart`, close.length === 0, close.join(", "));
      check(`${n} subject(s): every district court is a good walk (35+ tiles) from the Agora`, w.districts.every((d) => Math.hypot(d.x + 0.5 - C, d.z + 0.5 - C) >= 35));
      // The open country: lamps, a bridge, landmarks with a use, nothing roadside standing on a road.
      const land = w.landscape;
      const onRoad = (x: number, z: number) => w.kinds[Math.floor(z) * w.size + Math.floor(x)] === 1;
      check(`${n} subject(s): lamp posts line the main roads and a bridge crosses the creek`, Boolean(land) && land!.lamps.length >= 10 && land!.bridges.length >= 1);
      check(
        `${n} subject(s): no lamp, hedge or fence stands on a road`,
        Boolean(land) &&
          land!.lamps.every((l) => !onRoad(l.x, l.z)) &&
          [...land!.hedges, ...land!.fences].every((r) => [-0.5, -0.25, 0, 0.25, 0.5].every((t) => !onRoad(r.x + Math.cos(r.rot) * r.len * t, r.z - Math.sin(r.rot) * r.len * t))),
      );
      const scenery = w.objects.filter((o) => o.kind === "scenery");
      check(`${n} subject(s): five scenic landmarks, each with a use, each reachable`, scenery.length === 5 && scenery.every((o) => o.actions.length > 0 && findPath(w, start, interactionTiles(w, o), 60000) !== null));
      const roadTiles: Array<[number, number]> = [];
      for (let i = 0; i < w.size * w.size; i++) if (w.kinds[i] === 1) roadTiles.push([i % w.size, Math.floor(i / w.size)]);
      const campGap = Math.min(...w.camps.map((c) => Math.min(...roadTiles.map(([x, z]) => Math.hypot(x - c.x, z - c.z)))));
      check(`${n} subject(s): monster camps sit deep in the wilds (14+ tiles from any road)`, w.camps.length > 0 && campGap >= 14, campGap.toFixed(1));
      check(`${n} subject(s): district buildings sit off the central plaza`, ["library", "bazaar", "games-hall", "dorm", "trophy-hall", "lecture-hall"].every((k) => {
        const o = w.objects.find((x) => x.kind === k)!;
        return o && Math.max(Math.abs(o.x + o.w / 2 - (w.plaza.x0 + w.plaza.x1) / 2), Math.abs(o.z + o.d / 2 - (w.plaza.z0 + w.plaza.z1) / 2)) > (w.plaza.x1 - w.plaza.x0) / 2;
      }));
      check(`${n} subject(s): everything can be reached on foot`, w.objects.filter((o) => !o.resource).every((o) => findPath(w, start, interactionTiles(w, o)) !== null));
    }
    // Islands.
    const enrol = { university: "La Trobe University", city: "Melbourne (Bundoora)", country: "Australia" };
    const islands = islandsFor(enrol);
    check("La Trobe students can sail to other campuses and nearby universities", islands.some((i) => i.id === "campus-bendigo") && islands.some((i) => i.kind === "university") && !islands.some((i) => i.name.startsWith("Melbourne (Bundoora)")) && !islands.some((i) => /online/i.test(i.name)));
    const bendigo = islands.find((i) => i.id === "campus-bendigo")!;
    const visit = generateWorld([], { island: bendigo });
    check("a visited island has an exchange hall, a harbour and the crafts yard, and no home buildings", ["exchange-hall", "harbour", "cooking-fire", "anvil"].every((k) => visit.objects.some((o) => o.kind === k)) && !visit.objects.some((o) => ["dorm", "library", "games-hall", "crypt-gate"].includes(o.kind)));
    check("you arrive at the harbour", Math.min(...visit.objects.filter((o) => o.kind === "harbour").map((o) => Math.hypot(o.x - visit.spawn.x, o.z - visit.spawn.z))) < 3);
    const home = generateWorld([makeSubject(1, 6, 2, "arcane")], {});
    const tierOf = (w: typeof home, kind: string) => w.objects.filter((o) => o.kind === kind).map((o) => o.resource).join(",");
    check("further islands have richer gathering and tougher camps", tierOf(generateWorld([], { island: islands.find((i) => i.tier === 2)! }), "ore-rock") !== tierOf(home, "ore-rock") && generateWorld([], { island: islands.find((i) => i.tier === 2)! }).camps.every((c) => c.tier === 2));
    resetWith([makeSubject(1, 6, 2, "arcane")]);
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, focus: 3 } }));
    check("sailing out needs Focus; home is free", beginVoyage(bendigo) === false && beginVoyage(HOME) === true);
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, focus: 20 } }));
    const coins0 = realmStore.get().progress.coins;
    check("first landing stamps the passport and pays once", beginVoyage(bendigo) && landOn(bendigo) && !landOn(bendigo) && realmStore.get().progress.coins === coins0 + STAMP_COINS);
    const coins1 = realmStore.get().progress.coins;
    check("beating a rival pays a big purse once, then a small one", beatRival(bendigo) === RIVAL_COINS[bendigo.tier] && beatRival(bendigo) === RIVAL_REPEAT_COINS && realmStore.get().progress.coins === coins1 + RIVAL_COINS[bendigo.tier] + RIVAL_REPEAT_COINS);
    check("rivals get tougher further out", rivalStrength(2).hp > rivalStrength(0).hp && rivalStrength(2).questions > rivalStrength(0).questions);
    // The walk-in dorm.
    moveIn();
    const room = dormWorld(realmStore.get().progress.dorm, home.hub);
    check("the dorm is a place you walk into", room.mode === "interior" && ["door", "wardrobe", "noticeboard"].every((k) => room.objects.some((o) => o.kind === k)));
    check("the bed lets you sleep", room.objects.some((o) => o.furniture?.id === "bed-single-a" && o.actions[0]?.id === "rest"));
    const roomStart = { x: Math.floor(room.spawn.x), z: Math.floor(room.spawn.z) };
    check("everything in the room can be reached", room.objects.filter((o) => o.actions.length).every((o) => findPath(room, roomStart, interactionTiles(room, o)) !== null));
    check("furniture can't cover the wardrobe or the noticeboard", placeBlocker({ ...realmStore.get().progress.dorm, owned: { "table-small": 1, "shelf-a-small": 1 } }, "table-small", FIXTURES.wardrobe.c, FIXTURES.wardrobe.r, 0) !== null && placeBlocker({ ...realmStore.get().progress.dorm, placed: [] }, "shelf-a-small", FIXTURES.noticeboardColumn, 0, 0) !== null);
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, rest: { lastDay: null, until: null } } }));
    check("sleeping once a day makes you well rested", restInBed() && isRested(realmStore.get()) && restInBed() === false);
    const sub = realmStore.get().curriculum!.subjects[0];
    const xp0 = realmStore.get().progress.skillXp[sub.id] ?? 0;
    grantXp(sub.id, 100);
    check("well rested gives +10% study XP", (realmStore.get().progress.skillXp[sub.id] ?? 0) - xp0 === Math.round(100 * RESTED_BONUS));
    // Houses.
    check("there are four houses with their own colours", HOUSES.length === 4 && new Set(HOUSES.map((h) => h.colours[0])).size === 4);
    realmStore.set((st) => ({
      ...st,
      player: st.player ? { ...st.player, house: "tidewater" } : st.player,
      curriculum: st.curriculum ? { ...st.curriculum, enrolment: { ...st.curriculum.enrolment, startDate: addDays(todayIso(), -20) } } : st.curriculum,
    }));
    const table = houseStandings(realmStore.get());
    check("your house's points come from your study", table.find((t) => t.yours)!.points === yourHousePoints(realmStore.get()) && yourHousePoints(realmStore.get()) > 0);
    const later = houseStandings(realmStore.get(), new Date(Date.now() + 30 * 86_400_000));
    check("rival houses keep gaining points through the semester", later.filter((t) => !t.yours).every((t) => t.points > (table.find((x) => x.house.id === t.house.id)?.points ?? 0)));
    const bad = sanitizeState({ version: 1, player: { name: "X", look: {}, house: "slytherin" } });
    check("an unknown house is dropped", bad.player?.house === undefined);
    // The course list.
    check("La Trobe's 2026 course list is loaded (hundreds of courses, by level)", LA_TROBE_COURSES_2026.length > 300 && LA_TROBE_COURSES_2026.some((c) => c.name === "Bachelor of Information Technology" && c.level === "undergraduate") && LA_TROBE_COURSES_2026.some((c) => c.level === "postgraduate"));
    check("courses list the campuses they run at", LA_TROBE_COURSES_2026.find((c) => c.name === "Bachelor of Information Technology")!.campuses.includes("Melbourne (Bundoora)"));
  });

  section("39. Owl post, spells, potions, duelling club, familiars, secrets, textbook, timetable, house feed, yearbook, weather, brooms", () => {
    const sub = makeSubject(1, 6, 2, "arcane");
    resetWith([sub], addDays(todayIso(), -14));
    // Owl post.
    realmStore.set((st) => ({
      ...st,
      curriculum: st.curriculum ? { ...st.curriculum, subjects: st.curriculum.subjects.map((x) => ({ ...x, assessments: x.assessments.map((a, k) => (k === 0 ? { ...a, dueDate: addDays(todayIso(), 1) } : a)) })) } : st.curriculum,
    }));
    const due = lettersDue(realmStore.get());
    check("an owl brings a letter for a deadline tomorrow", due.some((l) => l.from === "The Registrar"));
    check("letters arrive once", deliver(due) === due.length && deliver(due) === 0 && unreadCount(realmStore.get()) === due.length);
    markRead(due[0].key);
    check("opening a letter marks it read", unreadCount(realmStore.get()) === due.length - 1);
    // Spells.
    check("no spells before studying", knownSpells(realmStore.get()).length === 0);
    studyWeek(sub.id, 1);
    studyWeek(sub.id, 2);
    const spells = knownSpells(realmStore.get());
    check("each studied week teaches a spell", spells.length === 2 && spells.every((sp) => sp.week === 1 || sp.week === 2));
    const w1 = realmStore.get().curriculum!.subjects[0].weeks[0];
    check("spells are named after the week's material", spellName(realmStore.get().curriculum!.subjects[0], w1).length > 0);
    const weak = knownSpells(realmStore.get()).find((sp) => sp.week === 1)!.power;
    for (let k = 0; k < 6; k++) recordAnswer(sub.id, { week: 1 }, true);
    check("knowing a week well makes its spell stronger", knownSpells(realmStore.get()).find((sp) => sp.week === 1)!.power > weak);
    check("the spell bar fills itself with known spells", spellBar(realmStore.get()).filter(Boolean).length === 2);
    const world = generateWorld([sub], { university: "La Trobe University" });
    spawnCamps(world);
    const foe = combat.enemies[0];
    const bolt = { ...spells[0], kind: "bolt" as const, id: "t-bolt" };
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, focus: 50 } }));
    const hp0 = foe.hp;
    check("a bolt spell hurts the nearest monster", castSpell(bolt, foe.x + 1, foe.z, () => 0.5) === foe && foe.hp < hp0);
    check("spells have cooldowns", castSpell(bolt, foe.x + 1, foe.z) === null);
    combat.player.hp = 5;
    check("mend heals you", castSpell({ ...bolt, kind: "mend", id: "t-mend" }, foe.x + 1, foe.z) === "self" && combat.player.hp > 5);
    const snared = { ...bolt, kind: "snare" as const, id: "t-snare" };
    castSpell(snared, foe.x + 1, foe.z);
    check("snare slows the target", foe.slowUntil > combat.time);
    // Potions.
    const mats = (m: Record<string, number>) => realmStore.set((st) => ({ ...st, progress: { ...st.progress, materials: { ...st.progress.materials, ...m } } }));
    check("brewing needs the ingredients", brewBlocker(realmStore.get(), "potion-insight") !== null);
    mats({ minnow: 4, oak: 2 });
    check("a wrong answer spoils the brew (ingredients used)", brew("potion-insight", false) === "spoiled" && (realmStore.get().progress.materials.minnow ?? 0) === 2);
    check("a right answer brews the potion", brew("potion-insight", true) === "brewed" && (realmStore.get().progress.materials["potion-insight"] ?? 0) === 1);
    check("drinking it starts the boost", drink("potion-insight") && buffActive(realmStore.get(), "insight"));
    const xpBefore = realmStore.get().progress.skillXp[sub.id] ?? 0;
    grantXp(sub.id, 100);
    check("Insight boosts study XP", (realmStore.get().progress.skillXp[sub.id] ?? 0) - xpBefore === Math.round(100 * INSIGHT_BONUS));
    // Duelling club.
    check("you start the season at the bottom", yourRank(realmStore.get()) === LADDER_SIZE + 1 && nextOpponent(realmStore.get())?.rank === LADDER_SIZE);
    check("a win moves you up one place", winLadderDuel() === LADDER_SIZE && yourRank(realmStore.get()) === LADDER_SIZE);
    check("the top is the toughest", opponentTier(1) === 2 && opponentTier(9) === 0);
    const nextMonth = new Date(Date.now() + 40 * 86_400_000);
    check("a new season starts you at the bottom again", yourRank(realmStore.get(), nextMonth) === LADDER_SIZE + 1);
    // Familiars.
    check("no pet, no familiar", familiarLevel(realmStore.get()) === 0);
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, wardrobe: { ...st.progress.wardrobe, pet: "pet-wisp", owned: ["pet-wisp"] } } }));
    const lvl1 = familiarLevel(realmStore.get());
    for (let w = 3; w <= 6; w++) studyWeek(sub.id, w);
    check("a familiar grows as you study", familiarLevel(realmStore.get()) > lvl1);
    // Secrets.
    const riddle = riddleFor(realmStore.get(), "secret-0", "2026-10-21");
    check("a secret door's password is one of your key terms", Boolean(riddle) && realmStore.get().curriculum!.subjects[0].keyTerms.some((t) => t.term === riddle!.term.term));
    check("the same door asks the same thing all day", riddleFor(realmStore.get(), "secret-0", "2026-10-21")!.term.term === riddle!.term.term);
    check("passwords allow a small typo but not a wrong word", checkPassword("Usability heuristic", "usability heuristc") && !checkPassword("Usability heuristic", "affordance"));
    const c0 = realmStore.get().progress.coins;
    openSecret("secret-0");
    openSecret("secret-0");
    check("a secret room pays once", realmStore.get().progress.coins === c0 + SECRET_COINS && isOpen(realmStore.get(), "secret-0"));
    check("the home island hides three secret doors", generateWorld([sub], { university: "La Trobe University" }).objects.filter((o) => o.kind === "secret-door").length === 3);
    // Enchanted textbook.
    const lecture = [
      "Usability: the extent to which a product can be used to achieve goals effectively.",
      "Affordance - a property of an object that shows how it can be used.",
      "Heuristic evaluation: an expert review of an interface against design principles.",
      "Mental model: what a user believes about how a system works.",
      "A Persona is a fictional user built from research to guide design decisions.",
      "Good design reduces the effort users must spend to reach their goals. Designers test early and often with real users to find problems. Feedback should be visible and immediate so that users know what happened.",
    ].join("\n");
    const cards = extractCards(lecture);
    check("definition lines become flashcards", cards.length >= 4 && cards.some((c) => c.term === "Usability") && cards.some((c) => c.term === "Affordance"));
    const quiz = quizFromCards(cards, "q-", 3, () => 0.3);
    check("the quiz asks which term matches each definition", quiz.length === cards.length && quiz.every((q) => q.choices.length === 4 && q.choices[q.answerIndex] === cards.find((c) => q.prompt.includes(c.definition))!.term));
    check("the summary picks whole sentences from the text", summarise(lecture, 2).length === 2 && summarise(lecture, 2).every((x) => lecture.replace(/\n/g, " ").includes(x)));
    // Timetable.
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", `DTSTART:${ymd}T090000`, `DTEND:${ymd}T110000`, "SUMMARY:SUB100 Lecture", "LOCATION:Agora Theatre", "RRULE:FREQ=WEEKLY", "END:VEVENT", "BEGIN:VEVENT", `DTSTART;VALUE=DATE:${ymd}`, "SUMMARY:Assignment 1 due", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const tt = parseTimetable(ics, realmStore.get().curriculum!.subjects);
    check("weekly classes are read from an .ics; all-day deadlines are not", tt.length === 1 && tt[0].subjectId === sub.id && tt[0].start === "09:00" && tt[0].location === "Agora Theatre");
    check("today's classes are listed", classesOn(tt, today).length === 1);
    const afterClass = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0);
    check("studying soon after class counts as a follow-up", recentClass(tt, sub.id, afterClass) !== null && recentClass(tt, sub.id, new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0)) === null);
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, timetable: tt, focus: 0 } }));
    check("the follow-up bonus pays once per class per day", classFollowUp(sub.id, afterClass) && !classFollowUp(sub.id, afterClass) && realmStore.get().progress.focus === CLASS_FOLLOW_UP_FOCUS);
    // House feed.
    realmStore.set((st) => ({ ...st, player: st.player ? { ...st.player, house: "oakhaven" } : st.player }));
    const code = makeShareCode(realmStore.get())!;
    const parsed = parseShareCode(code)!;
    check("share codes carry your house and house points", parsed.house === "oakhaven" && (parsed.housePoints ?? 0) === yourHousePoints(realmStore.get()));
    check("older share codes still parse", parseShareCode("SCHOLAR1-" + Buffer.from(JSON.stringify(["Ann", "U", "S2", { A: 3 }, 3, 1, 2, new Date().toISOString()])).toString("base64url"))?.house === undefined);
    const mate = { ...parsed, name: "Mate", housePoints: 500 };
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, group: { mate: mate } } }));
    check("classmates' points count toward their house", houseStandings(realmStore.get()).find((t) => t.house.id === "oakhaven")!.points === yourHousePoints(realmStore.get()) + 500);
    check("the weekly card lists the houses", HOUSES.every((h) => weeklyCard(realmStore.get()).includes(h.name)));
    // Yearbook.
    const book = yearbookFor(realmStore.get());
    check("the yearbook sums up the term", book.house === "Oakhaven" && book.spells >= 6 && book.secrets === 1 && book.levels.length === 1 && book.best !== null);
    // Weather.
    const noon = new Date(2026, 6, 15, 12);
    check("weather is the same for the same time", weatherAt(noon) === weatherAt(new Date(2026, 6, 15, 13)));
    check("exam week brings the storm", weatherAt(noon, true) === "storm");
    check("seasons follow the Southern Hemisphere", seasonOf(new Date(2026, 6, 1)) === "winter" && seasonOf(new Date(2026, 0, 1)) === "summer");
    const kinds = new Set(Array.from({ length: 200 }, (_, d) => weatherAt(new Date(2026, 0, 1 + d, 10))));
    check("the weather varies over the year", kinds.has("clear") && kinds.has("rain"));
    // Brooms and the Sky Race.
    check("mastering a subject earns a broom", broomUnlocked(realmStore.get()));
    realmStore.set((st) => ({ ...st, progress: { ...st.progress, focus: 20 } }));
    check("the Sky Race starts", startRace(world, world.spawn.x, world.spawn.z, true) && race.run!.sky);
    const g = race.run!.gates[0];
    tickRace(0.5, g.x, g.z, 3.4, false);
    check("sky gates don't count on foot", race.run!.next === 0);
    tickRace(0.5, g.x, g.z, 3.4, true);
    check("they count on a broom", race.run!.next === 1);
    abandonRace();
    check("sky medal times are faster than running", medalTimes(100, 3.4, true).gold < medalTimes(100, 3.4).gold);
    // Cinematic.
    startCinematic(["a", "b"], 2);
    check("a fly-over runs, then ends by itself", cinematicProgress() !== null && cinematicProgress(performance.now() / 1000 + 5) === null);
  });

  section("40. Lecture theatre", () => {
    // The request the server accepts.
    let threw = false;
    try {
      validateLectureRequest({ subjectName: "X", weekTitle: "Y" });
    } catch (e) {
      threw = e instanceof CurriculumError && e.category === "invalid-request";
    }
    check("a lecture needs a week", threw);
    const req = validateLectureRequest({ subjectCode: "CSE2UI", subjectName: "UI", week: 4, weekTitle: "Personas", topics: Array.from({ length: 30 }, (_, i) => `t${i}`), keyTerms: [{ term: "Persona", definition: "A model user" }, "junk"], slidesText: "s".repeat(200_000), year: 1800 });
    check("lecture requests are capped and cleaned", req.topics.length === 12 && req.keyTerms.length === 1 && req.slidesText.length === 80_000 && req.year === new Date().getFullYear());
    // The server keeps only well-formed parts, and only links research found.
    const cleaned = cleanLecture(
      {
        title: "Personas",
        segments: [{ heading: "Why", narration: "Because." }, { heading: "", narration: "dropped" }, { heading: "How", narration: "Like so.", points: ["a", 3] }],
        checks: [
          { after_segment: 9, prompt: "Q?", choices: ["a", "b", "c", "d"], answer_index: 2, explanation: "c" },
          { after_segment: 0, prompt: "Bad", choices: ["a", "b"], answer_index: 0 },
          { after_segment: 0, prompt: "Bad index", choices: ["a", "b", "c", "d"], answer_index: 4 },
        ],
        further_reading: [{ title: "Real", url: "https://handbook.latrobe.edu.au/subjects/2026/cse2ui" }, { title: "Made up", url: "https://example.com/fake" }],
      },
      ["https://handbook.latrobe.edu.au/subjects/2026/cse2ui", "http://insecure.example"],
    );
    check("bad segments and checks are dropped", cleaned.segments.length === 2 && cleaned.segments[1].points.join() === "a" && cleaned.checks.length === 1 && cleaned.checks[0].afterSegment === 1);
    check("further reading only links what research found", cleaned.furtherReading.length === 1 && cleaned.furtherReading[0].title === "Real" && cleaned.sources.length === 1);
    // The client re-checks whatever comes back or sits in the cache.
    check("an empty lecture is rejected", sanitizeLecture({ segments: [] }) === null && sanitizeLecture("x") === null);
    const safe = sanitizeLecture({ ...cleaned, furtherReading: [{ title: "x", url: "javascript:alert(1)" }], title: "" });
    check("unsafe links are removed and a title is filled in", safe !== null && safe.furtherReading.length === 0 && safe.title === "Why");
    // With no AI: a lecture from the handbook data.
    const sub = makeSubject(1, 6, 2, "arcane");
    sub.weeks[1] = { ...sub.weeks[1], title: "Personas and scenarios", topics: ["Personas", "Scenarios"], summary: "Who the users are." };
    sub.keyTerms = [{ term: "Persona", definition: "A model of a typical user." }, { term: "Kerning", definition: "Space between letters." }];
    sub.questions = [
      { id: "q1", prompt: "A persona is…", choices: ["a", "b", "c", "d"], answerIndex: 1, explanation: "b", week: 2 },
      { id: "q2", prompt: "Other week", choices: ["a", "b", "c", "d"], answerIndex: 0, explanation: "a", week: 3 },
    ];
    const hb = handbookLecture(sub, 2)!;
    check("a handbook lecture covers the week's topics", hb.segments.length >= 3 && hb.segments.some((s) => s.heading === "Personas") && hb.segments[0].narration.includes("Who the users are"));
    check("it uses that week's key terms and questions only", hb.segments.some((s) => s.points.some((p) => p.startsWith("Persona:"))) && !JSON.stringify(hb).includes("Kerning") && hb.checks.length === 1 && hb.checks[0].prompt === "A persona is…");
    check("check-ins come after a segment", hb.checks.every((c) => c.afterSegment >= 0 && c.afterSegment < hb.segments.length));
    check("no lecture for a week that doesn't exist", handbookLecture(sub, 40) === null);
    // The theatre.
    const theatre = theatreWorld(generateWorld([sub], {}).hub);
    const tStart = { x: Math.floor(theatre.spawn.x), z: Math.floor(theatre.spawn.z) };
    check("the theatre has a lectern and a door", theatre.interior === "theatre" && theatre.objects.some((o) => o.kind === "lectern" && o.actions[0]?.id === "lecture") && theatre.objects.some((o) => o.kind === "door"));
    check("the lectern and door can be reached", theatre.objects.every((o) => findPath(theatre, tStart, interactionTiles(theatre, o)) !== null));
    check("the seat you're taken to is on the floor, not in a bench", isWalkable(theatre, THEATRE_X + 5, THEATRE_Z + 5));
    // Attending pays out.
    resetWith([sub]);
    const xp0 = realmStore.get().progress.skillXp[sub.id] ?? 0;
    attendLecture(sub.id, 2, 1);
    const st = realmStore.get();
    check("a lecture for an unstudied week counts as studying it", Boolean(st.progress.weeks[weekKey(sub.id, 2)]?.studiedAt) && (st.progress.skillXp[sub.id] ?? 0) - xp0 >= 220 + LECTURE_XP.perCorrect);
    check("attendance is recorded by date", st.progress.lectures[lectureKey(sub.id, 2)] === todayIso());
    const xp1 = st.progress.skillXp[sub.id] ?? 0;
    attendLecture(sub.id, 2, 0);
    check("replaying the same day pays nothing without right answers", (realmStore.get().progress.skillXp[sub.id] ?? 0) === xp1);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, lectures: { ...s.progress.lectures, [lectureKey(sub.id, 2)]: "2020-01-01" } } }));
    attendLecture(sub.id, 2, 2);
    check("revising a studied week on a later day pays review XP", (realmStore.get().progress.skillXp[sub.id] ?? 0) - xp1 >= LECTURE_XP.review + 2 * LECTURE_XP.perCorrect);
    const hostile = sanitizeState({ ...realmStore.get(), progress: { ...realmStore.get().progress, lectures: { "a:2": "2026-10-21", "../x:1": "2026-10-21", "b:3": "<script>", c: "2026-10-21" } } });
    check("bad lecture records are cleaned", Object.keys(hostile.progress.lectures).join() === "a:2");
  });

  console.log("\n=== 41. Ready-made lectures for the La Trobe subjects ===");
  try {
    const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
    for (const bank of LECTURE_BANKS) {
      const weeks = Object.keys(bank.weeks).map(Number);
      const name = bank.weeks[1]?.title ?? "?";
      const segs = Object.values(bank.weeks).flatMap((l) => l.segments);
      check(`${name}: all 12 weeks are written`, weeks.length === 12 && weeks.every((w, i) => w === i + 1));
      check(`${name}: every week teaches in 6-8 parts`, Object.values(bank.weeks).every((l) => l.segments.length >= 6 && l.segments.length <= 8 && l.objectives.length >= 3 && l.takeaways.length >= 4));
      check(`${name}: every part is a real explanation (110-240 words)`, segs.every((s) => words(s.narration) >= 110 && words(s.narration) <= 240), segs.filter((s) => words(s.narration) < 110 || words(s.narration) > 240).map((s) => s.heading).join(", "));
      check(`${name}: spoken text has no markdown, links or emoji`, Object.values(bank.weeks).every((l) => [l.hook, ...l.segments.flatMap((s) => [s.narration, s.example])].every((t) => !/[*#`_]{1,}\w|https?:|\p{Extended_Pictographic}/u.test(t))));
      check(`${name}: slides have 3-4 points`, segs.every((s) => s.points.length >= 3 && s.points.length <= 4 && s.heading.length > 0));
    }
    const saved = await loadSavedLaTrobeSemester();
    check("the saved semester loads for the lecture checks", saved !== null);
    if (saved) {
      for (const sub of saved.subjects) {
        const all = sub.weeks.map((w) => localLecture(sub, w.week));
        check(`${sub.name}: every week has a full lecture, not the handbook fallback`, all.every((l) => l?.source === "notes"), all.map((l, i) => (l?.source === "notes" ? "" : String(i + 1))).filter(Boolean).join(","));
        check(
          `${sub.name}: at most two check-ins, each after the part that teaches it`,
          all.every((l) => l !== null && l.lecture.checks.length <= 2 && l.lecture.checks.every((c) => c.afterSegment >= 1 && c.afterSegment < l.lecture.segments.length)),
        );
        check(`${sub.name}: the check-ins are that week's questions`, all.every((l, i) => l!.lecture.checks.every((c) => sub.questions.some((q) => q.week === sub.weeks[i].week && q.prompt === c.prompt))));
        check(`${sub.name}: weeks with questions get a check-in`, all.every((l, i) => l!.lecture.checks.length > 0 || !sub.questions.some((q) => q.week === sub.weeks[i].week)));
      }
      const other = { ...saved.subjects[0], name: "Project Management", code: "", weeks: [{ week: 1, title: "Marine biology field work", topics: [], summary: "Coral reefs." }] };
      check("a same-named subject that teaches something else gets no ready-made lecture", notesLecture(other, 1) === null);
    }
    const sub = makeSubject(1, 4, 1, "arcane");
    sub.questions = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, prompt: `Q${i}`, choices: ["a", "b", "c", "d"], answerIndex: 0, explanation: "x", week: 1 }));
    const hb = localLecture(sub, 1)!;
    check("other subjects fall back to the handbook lecture, still with at most two check-ins", hb.source === "handbook" && hb.lecture.checks.length <= 2);
  } catch (error) {
    check("lecture bank checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 42. Lecture diagrams, voice and seat ===");
  try {
    // A pretend 2D canvas: every drawing call is accepted, text is 12px per character.
    const calls: string[] = [];
    const fakeCtx = new Proxy({} as Record<string, unknown>, {
      get: (target, prop: string) => {
        if (prop === "measureText") return (t: string) => ({ width: t.length * 12 });
        if (prop === "createLinearGradient") return () => ({ addColorStop: () => undefined });
        if (prop in target) return target[prop];
        return () => {
          calls.push(prop);
        };
      },
      set: (target, prop: string, value) => {
        target[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const all: LectureVisual[] = [
      { kind: "flow", title: "Request", steps: ["Browser", "DNS", "Server", "Response"] },
      { kind: "cycle", steps: ["Plan", "Do", "Check", "Act"] },
      { kind: "compare", left: { title: "SQL", items: ["Tables", "Joins"] }, right: { title: "NoSQL", items: ["Documents"] } },
      { kind: "stack", layers: ["UI", "API", "Database"] },
      { kind: "timeline", events: [{ label: "Start", detail: "Charter" }, { label: "End", detail: "Close" }] },
      { kind: "formula", formula: "CPI = EV / AC", steps: ["EV = 50,000", "AC = 40,000", "CPI = 1.25"] },
      { kind: "matrix", rowLabel: "Probability", colLabel: "Impact", rows: ["High", "Low"], cols: ["Low", "High"], cells: [["Watch", "Act now"], ["Accept", "Plan"]] },
      { kind: "tree", root: "Website", children: [{ label: "Design", children: ["Wireframes"] }, { label: "Build" }] },
      { kind: "bars", unit: "k", items: [{ label: "Labour", value: 60 }, { label: "Software", value: 15.5 }] },
      { kind: "definition", term: "Persona", definition: "An archetypal user built from research." },
    ];
    let drew = true;
    for (const v of all) {
      for (const p of [0, 0.3, 0.7, 1]) {
        try {
          drawVisual(fakeCtx, v, { x: 60, y: 200, w: 1160, h: 470 }, p);
        } catch {
          drew = false;
        }
      }
    }
    check("every kind of diagram draws at every stage without errors", drew && calls.length > 100);
    check("well-formed diagrams survive the checks unchanged", all.every((v) => JSON.stringify(sanitizeVisual(v)) === JSON.stringify(v)));
    check("broken diagrams are dropped", [
      { kind: "flow", steps: ["only one"] },
      { kind: "matrix", rowLabel: "a", colLabel: "b", rows: ["x", "y"], cols: ["p", "q"], cells: [["1", "2"]] },
      { kind: "bars", items: [{ label: "a", value: -3 }, { label: "b", value: Number.NaN }] },
      { kind: "laser-show" },
      "flow",
      null,
    ].every((v) => sanitizeVisual(v) === undefined));
    const bankVisuals = LECTURE_BANKS.flatMap((b) => Object.values(b.weeks).flatMap((l) => l.segments.map((sg) => sg.visual).filter((v): v is LectureVisual => v !== undefined)));
    check("every ready-made lecture diagram is well-formed", bankVisuals.every((v) => sanitizeVisual(v) !== undefined), bankVisuals.filter((v) => sanitizeVisual(v) === undefined).map((v) => v.kind).join(","));
    let bankDrew = true;
    for (const v of bankVisuals) {
      try {
        drawVisual(fakeCtx, v, { x: 60, y: 200, w: 1160, h: 470 }, 0.5);
      } catch {
        bankDrew = false;
      }
    }
    check("every ready-made lecture diagram draws", bankDrew);
    const videos = LECTURE_BANKS.flatMap((b) => Object.values(b.weeks).map((l) => l.video).filter((v) => v !== undefined));
    check("lecture videos have real-looking YouTube ids and titles", videos.every((v) => /^[\w-]{11}$/.test(v!.youtubeId) && v!.title.length > 3 && v!.channel.length > 1 && v!.intro.length > 10));
    // Voice.
    const parts = sentences("Right, so who here has pushed a pull door? Yes, all of you. " + "This sentence just keeps going, and going, and going, with clause after clause, so that it is far too long to say in one breath, which means the speaker has to split it somewhere sensible, ideally at a comma, rather than in the middle of a word.");
    check("narration is spoken sentence by sentence", parts[0] === "Right, so who here has pushed a pull door?" && parts[1] === "Yes, all of you.");
    check("very long sentences split at commas, never mid-word", parts.length > 3 && parts.slice(2).every((p) => p.length <= 220) && parts.slice(2).join(" ").split(" ").every((w) => w.length < 20));
    const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
    check("natural voices beat robotic ones", voiceQuality(v("Microsoft Natasha Online (Natural) - English (Australia)", "en-AU")) > voiceQuality(v("Microsoft Zira - English (United States)", "en-US")));
    check("voice gender is read from the name", genderOf(v("Microsoft William Online (Natural) - English (Australia)", "en-AU")) === "male" && genderOf(v("Google UK English Female", "en-GB")) === "female");
    check("slides build faster when read than when spoken", speakingSeconds("one two three four five six seven eight nine ten.", false) < speakingSeconds("one two three four five six seven eight nine ten.", true));
    // The seat.
    const hall = theatreWorld(generateWorld([makeSubject(1, 2, 1, "arcane")], {}).hub);
    check("the lecture seat is on a bench (not a walking tile) and you stand up into the aisle", !isWalkable(hall, Math.floor(FRONT_SEAT.x), Math.floor(FRONT_SEAT.z)) && isWalkable(hall, Math.floor(FRONT_SEAT.standX), Math.floor(FRONT_SEAT.standZ)) && FRONT_SEAT.facing === Math.PI);
  } catch (error) {
    check("lecture diagram checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 44. Arena: ranked study games ===");
  try {
    // Rating maths.
    check("beating a stronger rival gains more than beating a weaker one", ratingDelta(1000, 1300, "win", 20) > ratingDelta(1000, 1000, "win", 20) && ratingDelta(1000, 1000, "win", 20) > ratingDelta(1000, 700, "win", 20));
    check("losing to a weaker rival costs more than losing to a stronger one", ratingDelta(1000, 700, "loss", 20) < ratingDelta(1000, 1300, "loss", 20));
    const extremes = [ratingDelta(100, 3000, "win", 0), ratingDelta(3000, 100, "loss", 0), ratingDelta(100, 3000, "win", 50), ratingDelta(3000, 100, "loss", 50)];
    check("rating changes are bounded by the K-factor", Math.abs(extremes[0]) <= 40 && Math.abs(extremes[1]) <= 40 && Math.abs(extremes[2]) <= 24 && Math.abs(extremes[3]) <= 24, extremes.join());
    check("a win always gains and a loss always costs", ratingDelta(3000, 100, "win", 50) >= 1 && ratingDelta(100, 3000, "loss", 50) <= -1);
    check("an even draw changes nothing; provisional ratings move faster", ratingDelta(1200, 1200, "draw", 30) === 0 && kFactor(3) > kFactor(30));
    check("expected scores are symmetric", Math.abs(expectedScore(1000, 1250) + expectedScore(1250, 1000) - 1) < 1e-12 && expectedScore(1000, 1000) === 0.5);
    check("ranks run Bronze to Grandmaster with divisions", rankFor(1000).tier.id === "bronze" && rankFor(1300).label === "Gold III" && rankFor(1499).label === "Gold I" && rankFor(1950).label === "Grandmaster" && rankFor(50).tier.id === "bronze");
    const ladder = [800, 1000, 1200, 1400, 1600, 1800, 2000];
    check("higher ratings never rank lower", ladder.every((r, i) => i === 0 || rankFor(r).tier.min >= rankFor(ladder[i - 1]).tier.min));

    // Rivals scale with rating.
    check("stronger rivals are more accurate and faster", ladder.every((r, i) => i === 0 || (rivalAccuracy(r) >= rivalAccuracy(ladder[i - 1]) && rivalAnswerMs(r) < rivalAnswerMs(ladder[i - 1]))));
    check("hard questions slow rivals and cost them accuracy", rivalAccuracy(1400, 3) < rivalAccuracy(1400, 1) && rivalAnswerMs(1400, 180, 3) > rivalAnswerMs(1400, 180, 1));
    const picks = rivalChoices(1000, "buzzer", "2026-W43");
    check("matchmaking offers a warm-up, an even match and a stretch", picks.length === 3 && picks[0].rival.rating < picks[2].rival.rating && picks[0].winChance > picks[2].winChance && picks.some((p) => p.label === "Even match"));
    check("rival ratings drift a little each season, never much", RIVALS.every((r) => Math.abs(rivalRating(r, "blitz", "2026-W43") - r.base) <= 40) && RIVALS.some((r) => rivalRating(r, "blitz", "2026-W43") !== rivalRating(r, "blitz", "2026-W44")));
    const avg = (f: (seed: string) => number) => Array.from({ length: 40 }, (_, i) => f(`s${i}`)).reduce((a, b) => a + b, 0) / 40;
    check("strong rivals score more in Blitz, Lexicon, Connections and Sequence", avg((s) => simulateBlitz(2000, s).score) > avg((s) => simulateBlitz(900, s).score) && avg((s) => rivalLexicon(2000, s).score) > avg((s) => rivalLexicon(900, s).score) && avg((s) => rivalConnections(2000, s).score) > avg((s) => rivalConnections(900, s).score) && avg((s) => rivalSequence(2000, 3, s).score) > avg((s) => rivalSequence(900, 3, s).score));
    const bq = { id: "b1", prompt: "Which is right?", choices: ["a", "b", "c", "d"], answerIndex: 2, explanation: "c", week: 1, difficulty: 2 as const };
    const plan = planRivalBuzz(1500, bq, "seed");
    check("a rival's buzz is repeatable for a seed and inside the round", JSON.stringify(plan) === JSON.stringify(planRivalBuzz(1500, bq, "seed")) && plan.atMs > 0 && plan.atMs < BUZZER_ROUND_MS && (plan.correct ? plan.choice === 2 : plan.choice !== 2));
    check("strong rivals buzz sooner than weak ones on average", avg((s) => planRivalBuzz(2000, bq, s).atMs) < avg((s) => planRivalBuzz(900, bq, s).atMs));

    // Buzzer rules.
    let round = applyBuzz(NEW_ROUND, "player", false);
    check("a wrong buzz locks you out but the round stays open", round.open && round.playerLocked && applyBuzz(round, "player", true) === round);
    round = applyBuzz(round, "rival", true);
    check("the first correct answer takes the point", !round.open && round.winner === "rival");
    check("both wrong ends the round with no point", (() => {
      const r = applyBuzz(applyBuzz(NEW_ROUND, "rival", false), "player", false);
      return !r.open && r.winner === null;
    })());
    check("first to four wins; level at the end is a draw", buzzerOutcome(4, 2, 6) === "win" && buzzerOutcome(1, 4, 5) === "loss" && buzzerOutcome(2, 2, 3) === null && buzzerOutcome(3, 3, BUZZER_MAX_ROUNDS) === "draw" && buzzerOutcome(3, 2, 8, 8) === "win");
    check("faster buzzes score more", buzzerRoundPoints(2000) > buzzerRoundPoints(9000) && buzzerRoundPoints(2000) <= 200 && buzzerRoundPoints(15000) === 100);

    // Lexicon feedback (Wordle rules, repeated letters).
    const fb = (a: string, g: string) => lexiconFeedback(a, g).join(",");
    check("exact letters are hits, misplaced ones are near", fb("ABBEY", "BABES") === "near,near,hit,hit,miss", fb("ABBEY", "BABES"));
    check("a repeated guess letter is only marked as often as the answer has it", fb("CRANE", "EERIE") === "miss,miss,near,miss,hit" && fb("LEVEL", "LLLLL") === "hit,miss,miss,miss,hit", `${fb("CRANE", "EERIE")} / ${fb("LEVEL", "LLLLL")}`);
    check("a repeated answer letter can be found twice", fb("ALLOW", "LOLLY") === "near,near,hit,miss,miss", fb("ALLOW", "LOLLY"));
    check("the right guess is all hits; case and spaces don't matter", fb("Fitts's law", "fittsslaw") === Array(9).fill("hit").join(","));
    const kb = keyboardMarks("CRANE", ["EERIE", "CRONE"]);
    check("the keyboard keeps each letter's best mark", kb.E === "hit" && kb.R === "hit" && kb.I === "miss" && kb.C === "hit");
    const lexSub = makeSubject(7, 4, 1, "arcane");
    lexSub.keyTerms = [
      { term: "Fitts's law", definition: "Time to hit a target grows with distance and shrinks with size." },
      { term: "Persona", definition: "A persona is a model of a typical user; personas guide design." },
      { term: "OAuth 2.0", definition: "Delegated authorisation." },
      { term: "JWT", definition: "A signed token." },
      { term: "CI/CD", definition: "Continuous integration and delivery." },
      { term: "Affordance", definition: "What an object lets you do." },
      { term: "Signifier", definition: "A cue that shows where an action happens." },
    ];
    const terms = lexiconTerms(lexSub).map((t) => t.term);
    check("only plain-word terms of 4-14 letters become puzzles", terms.join("|") === "Fitts's law|Persona|Affordance|Signifier", terms.join("|"));
    check("the clue hides the term itself", !/persona/i.test(maskTerm("A persona is a model of a typical user; personas guide design.", "Persona")));
    const days = Array.from({ length: 12 }, (_, i) => dailyLexicon(lexSub, addDays("2026-10-01", i))!.letters);
    check("the daily puzzle is fixed per date and changes over days", dailyLexicon(lexSub, "2026-10-05")!.letters === dailyLexicon(lexSub, "2026-10-05")!.letters && new Set(days).size > 1);
    check("the puzzle board knows the word breaks", makePuzzle(lexSub.keyTerms[0]).words.join() === "6,3");
    check("Lexicon scores favour fewer guesses, then speed; a miss scores 0", lexiconScore(1, 60) > lexiconScore(2, 1) && lexiconScore(3, 10) > lexiconScore(3, 50) && lexiconScore(null, 1) === 0);

    // Blitz scoring.
    check("the multiplier rises every three in a row, capped at ×5", blitzMultiplier(0) === 1 && blitzMultiplier(2) === 1 && blitzMultiplier(3) === 2 && blitzMultiplier(6) === 3 && blitzMultiplier(12) === 5 && blitzMultiplier(40) === 5);
    check("speed bonus: full within 2 s, none after 8 s", speedBonus(1500) === 50 && speedBonus(5000) === 25 && speedBonus(9000) === 0);
    check("a fast answer on a streak of 3 scores (100 + 50) × 2; wrong scores 0", blitzPoints(true, 3, 1000) === 300 && blitzPoints(false, 9, 500) === 0);
    const bpool = [1, 1, 2, 2, 3, 3].map((d, i) => ({ ...bq, id: `p${i}`, difficulty: d as 1 | 2 | 3 }));
    check("harder questions come as the streak grows", targetDifficulty(0) === 1 && targetDifficulty(4) === 2 && targetDifficulty(7) === 3 && pickBlitzQuestion(bpool, 8, new Set(), Math.random)!.difficulty === 3 && pickBlitzQuestion(bpool, 0, new Set(), Math.random)!.difficulty === 1);
    check("used questions are skipped until the pool runs out", pickBlitzQuestion(bpool, 8, new Set(["p4"]), () => 0)!.id === "p5" && pickBlitzQuestion(bpool, 8, new Set(bpool.map((q) => q.id)), () => 0) !== null);
    const sim = simulateBlitz(1400, "x");
    check("a rival's minute fits in 60 seconds and its score adds up", sim.events.every((e) => e.atMs <= BLITZ_MS) && sim.events.reduce((a, e) => a + e.points, 0) === sim.score && scoreAt(sim.events, BLITZ_MS) === sim.score && scoreAt(sim.events, 0) === 0);

    // Sequence.
    check("order accuracy: perfect 1, reversed 0, perfect round 300", pairAccuracy(["a", "b", "c"], ["a", "b", "c"]) === 1 && pairAccuracy(["c", "b", "a"], ["a", "b", "c"]) === 0 && sequenceRoundScore(["a", "b", "c"], ["a", "b", "c"]) === 300 && sequenceRoundScore(["b", "a", "c"], ["a", "b", "c"]) < 300);
    const seqSub = makeSubject(8, 8, 1, "arcane");
    const wp = weekOrderPuzzle(seqSub, Math.random)!;
    check("the course-plan fallback lists topics in week order", wp.steps.length === 5 && wp.steps.every((s, i) => i === 0 || Number(s.split(" ")[1]) > Number(wp.steps[i - 1].split(" ")[1])));
    const fakeBank = [
      {
        match: (_c: string, n: string) => n === "Subject 8",
        weeks: {
          2: {
            title: "Topic 2 of subject 8",
            hook: "",
            objectives: [],
            takeaways: [],
            segments: [
              { heading: "Topic 2 loop", narration: "", points: [], example: "", visual: { kind: "cycle" as const, title: "PDCA", steps: ["Plan", "Do", "Check", "Act"] } },
              { heading: "Topic 2 flow", narration: "", points: [], example: "", visual: { kind: "flow" as const, steps: ["Request", "Route", "Respond"] } },
              { heading: "Topic 2 too short", narration: "", points: [], example: "", visual: { kind: "flow" as const, steps: ["One", "Two"] } },
            ],
          },
        },
      },
    ];
    const lseq = lectureSequences(seqSub, fakeBank);
    check("lecture flow and cycle diagrams become sequences (cycles give the first step)", lseq.length === 2 && lseq[0].title === "PDCA" && lseq[0].fixedFirst && !lseq[1].fixedFirst && lseq[1].steps.join() === "Request,Route,Respond");
    const sp = sequencePuzzles(seqSub, Math.random, 3, fakeBank);
    check("a match has three puzzles, lecture diagrams first", sp.length === 3 && sp.filter((p) => p.source.startsWith("Week 2 lecture")).length === 2 && sp.every((p) => p.steps.length >= 3 && new Set(p.steps).size === p.steps.length));

    // Connections grouping.
    const saved = await loadSavedLaTrobeSemester();
    let validAll = Boolean(saved);
    let built = 0;
    const issues: string[] = [];
    for (const sub of saved?.subjects ?? []) {
      for (let i = 0; i < 15; i++) {
        const p = buildConnections(sub, seededRng(`${sub.id}|${i}`));
        if (!p) {
          issues.push(`${sub.code}: no puzzle`);
          validAll = false;
          continue;
        }
        built++;
        const texts = p.tiles.map((t) => t.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
        const perGroup = p.groups.map((_, g) => p.tiles.filter((t) => t.group === g).length);
        const weeks = new Set(p.groups.map((g) => g.week));
        const fits = p.tiles.every((t) => weekTileCandidates(sub, p.groups[t.group].week).includes(t.text));
        const exclusive = p.tiles.every((t) => p.groups.every((g, gi) => gi === t.group || !weekTileCandidates(sub, g.week).some((c) => c.toLowerCase() === t.text.toLowerCase())));
        if (p.groups.length !== 4 || p.tiles.length !== 16 || perGroup.some((n) => n !== 4) || new Set(texts).size !== 16 || weeks.size !== 4 || !fits || !exclusive || new Set(p.tiles.map((t) => t.id)).size !== 16) {
          validAll = false;
          issues.push(`${sub.code}#${i}: groups ${p.groups.length}, tiles ${p.tiles.length}, per ${perGroup.join("/")}, unique ${new Set(texts).size}, fits ${fits}, exclusive ${exclusive}`);
        }
      }
    }
    check("Connections: 4 weeks × 4 tiles, no duplicate tiles, each tile only fits its own week (60 La Trobe puzzles)", validAll && built === 60, issues.slice(0, 4).join("; "));
    if (saved) {
      const p = buildConnections(saved.subjects[0], seededRng("check"))!;
      const g0 = p.tiles.filter((t) => t.group === 0).map((t) => t.id);
      const g1 = p.tiles.filter((t) => t.group === 1).map((t) => t.id);
      check("a full group is accepted; three of four is 'one away'", checkGroup(p, g0).group === 0 && checkGroup(p, [...g0.slice(0, 3), g1[0]]).group === null && checkGroup(p, [...g0.slice(0, 3), g1[0]]).best === 3 && checkGroup(p, [g0[0], g0[0], g0[1], g0[2]]).group === null);
    }
    const amb = makeSubject(11, 5, 1, "arcane");
    amb.keyTerms = [];
    amb.weeks = amb.weeks.map((w) => ({ ...w, topics: [w.week === 1 ? "The Double Diamond" : w.week === 2 ? "Double Diamond" : `Shared idea ${w.week}`, ...["alpha", "bravo", "charlie", "delta"].map((x) => `${x} topic ${w.week}`)] }));
    const ambPuzzles = Array.from({ length: 10 }, (_, i) => buildConnections(amb, seededRng(`amb${i}`), []));
    check("ideas that fit two weeks (even worded differently) never become tiles", ambPuzzles.every((p) => p !== null && !p.tiles.some((t) => /double diamond/i.test(t.text))));
    check("a subject without enough distinct material gets no Connections puzzle", buildConnections(makeSubject(9, 3, 1, "arcane"), Math.random) === null);
    check("Connections scores reward all four groups, punish mistakes", connectionsScore(4, 0, 60) > connectionsScore(4, 2, 60) && connectionsScore(4, 3, 200) > connectionsScore(3, 0, 10) && connectionsScore(0, 4, 5) === 0);

    // Results, seasons and reward caps.
    const ar = makeSubject(10, 6, 1, "arcane");
    resetWith([ar]);
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, focus: 0 } }));
    const strong = { id: "x", name: "Strong", title: "", rating: 1600 };
    const weak = { id: "y", name: "Weak", title: "", rating: 700 };
    const xp0 = realmStore.get().progress.skillXp[ar.id] ?? 0;
    const coins0 = realmStore.get().progress.coins;
    const first = finishArenaMatch({ game: "blitz", subjectId: ar.id, rival: weak, outcome: "win", score: 1234 });
    check("a win against a weaker rival pays XP and coins but no Focus", first.reward.xp === ARENA_REWARDS.winXp && first.reward.coins === ARENA_REWARDS.winCoins && first.reward.focus === 0 && realmStore.get().progress.focus === 0);
    check("results update rating, record and personal best", first.after > 1000 && realmStore.get().progress.arena.games.blitz?.games === 1 && realmStore.get().progress.arena.games.blitz?.best === 1234 && first.newBest);
    const loss = finishArenaMatch({ game: "blitz", subjectId: ar.id, rival: weak, outcome: "loss", score: 10 });
    check("a loss costs rating, resets the streak and keeps the best", loss.after < loss.before && realmStore.get().progress.arena.games.blitz?.streak === 0 && realmStore.get().progress.arena.games.blitz?.best === 1234 && loss.reward.xp === ARENA_REWARDS.lossXp && loss.reward.coins === 0);
    const upset = finishArenaMatch({ game: "buzzer", subjectId: ar.id, rival: strong, outcome: "win", score: 500 });
    check("beating a stronger rival pays the upset bonus and Focus", upset.reward.focus === ARENA_REWARDS.upsetFocus && upset.reward.xp === ARENA_REWARDS.winXp + ARENA_REWARDS.upsetXp && realmStore.get().progress.focus === ARENA_REWARDS.upsetFocus);
    for (let i = 0; i < 40; i++) finishArenaMatch({ game: "connections", subjectId: ar.id, rival: { ...strong, rating: 2900 }, outcome: "win", score: 100 });
    const day = realmStore.get().progress.arena.daily;
    const xpGained = (realmStore.get().progress.skillXp[ar.id] ?? 0) - xp0;
    check("daily caps hold however much you play", day.xp === ARENA_REWARDS.dailyXpCap && day.coins === ARENA_REWARDS.dailyCoinCap && day.focus === ARENA_REWARDS.dailyFocusCap && xpGained === ARENA_REWARDS.dailyXpCap && realmStore.get().progress.coins - coins0 === ARENA_REWARDS.dailyCoinCap, `${day.xp}/${day.coins}/${day.focus}, xp ${xpGained}`);
    check("a full day of arena pays less than two studied weeks", ARENA_REWARDS.dailyXpCap < 2 * XP_REWARDS.studyWeek && ARENA_REWARDS.dailyFocusCap < 2 * FOCUS.earn.studyWeek);
    const capped = computeReward({ xp: 390, coins: 75, focus: 11 }, "win", true);
    check("rewards are cut to what's left of the caps", capped.xp === 10 && capped.coins === 5 && capped.focus === 1 && capped.capped && computeReward({ xp: 0, coins: 0, focus: 0 }, "loss", true).focus === 0);
    finishArenaMatch({ game: "lexicon", subjectId: ar.id, rival: weak, outcome: "win", score: 300, daily: true });
    check("a ranked daily is used up once played", dailyPlayed(realmStore.get().progress.arena, "lexicon", ar.id) && !dailyPlayed(realmStore.get().progress.arena, "lexicon", "other"));
    const before = realmStore.get().progress.arena;
    const rolled = rollSeason(before, "2099-W01");
    check("a new season restarts season stats, never the rating", rolled.season === "2099-W01" && rolled.games.blitz?.rating === before.games.blitz?.rating && rolled.games.blitz?.seasonWins === 0 && viewRecord(before, "blitz", "2099-W01").seasonWins === 0 && /^\d{4}-W\d{2}$/.test(seasonId(new Date(2026, 9, 21))) && seasonId(new Date(2026, 9, 21)) === "2026-W43");

    // Share codes carry arena ratings, and old codes still parse.
    const code = makeShareCode(realmStore.get())!;
    const mine = parseShareCode(code)!;
    check("new share codes carry arena ratings and bests", mine.arena?.blitz?.rating === realmStore.get().progress.arena.games.blitz?.rating && mine.arena?.blitz?.best === 1234 && mine.arenaSeason === seasonId());
    const enc = (data: unknown[]) => "SCHOLAR1-" + Buffer.from(JSON.stringify(data)).toString("base64url");
    const old8 = parseShareCode(enc(["Ann", "U", "S2", { A: 3 }, 3, 1, 2, "2026-10-01T00:00:00Z"]));
    const old10 = parseShareCode(enc(["Ben", "U", "S2", { A: 3 }, 3, 1, 2, "2026-10-01T00:00:00Z", "oakhaven", 50]));
    check("older 8- and 10-slot codes still parse, without arena data", old8 !== null && old8.arena === undefined && old10 !== null && old10.house === "oakhaven" && old10.arena === undefined);
    const hostileCode = parseShareCode(enc(["Cat", "U", "S2", { A: 3 }, 3, 1, 2, "2026-10-01T00:00:00Z", "", 0, { s: "<b>", g: { blitz: [99999, -5], buzzer: ["x", 1], hack: [1500, 10], lexicon: [1400.6, 1e12] } }]));
    check("hostile arena data in a code is clamped or dropped", hostileCode !== null && hostileCode.arena?.blitz?.rating === 3000 && hostileCode.arena?.blitz?.best === 0 && hostileCode.arena?.buzzer === undefined && !("hack" in (hostileCode.arena ?? {})) && hostileCode.arena?.lexicon?.rating === 1401 && hostileCode.arena?.lexicon?.best === 1_000_000 && hostileCode.arenaSeason === undefined);
    check("a junk arena slot is ignored, the code still parses", parseShareCode(enc(["Dan", "U", "S2", { A: 3 }, 3, 1, 2, "2026-10-01T00:00:00Z", "", 0, "junk"]))?.name === "Dan");

    // The leaderboard mixes you, classmates and AI rivals.
    addGroupMember(enc(["Sam", "La Trobe University", "S2", { A: 3 }, 3, 1, 2, "2026-10-01T00:00:00Z", "", 0, { s: "2026-W40", g: { blitz: [2500, 9000] } }]));
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, group: { ...s.progress.group, "evil|x": { name: "Evil", levels: {}, arena: { blitz: { rating: "NaN" } } } as never } } }));
    const board = arenaLeaderboard(boardSource(realmStore.get()), "blitz");
    check("the board ranks you, classmates and rivals together by rating", board.some((r) => r.kind === "you") && board[0].name === "Sam" && board[0].kind === "classmate" && board.filter((r) => r.kind === "rival").length === RIVALS.length && board.every((r, i) => i === 0 || r.rating <= board[i - 1].rating));
    check("a classmate with broken arena data is left off; an old season is noted", !board.some((r) => r.name === "Evil") && board[0].note.includes("2026-W40"));

    // Save sanitising of the new field.
    const hostileSave = sanitizeState({
      ...realmStore.get(),
      progress: {
        ...realmStore.get().progress,
        arena: { season: "DROP TABLE", games: { buzzer: { rating: 1e9, games: 10, wins: 50, losses: -3, streak: 99, best: "x", peak: 5 }, evil: { rating: 1500 }, lexicon: "x" }, daily: { date: "<script>", xp: 9999, played: ["ok"] } },
      },
    });
    const hb = hostileSave.progress.arena;
    check("hostile arena saves are clamped and cleaned", hb.season === "" && hb.games.buzzer?.rating === 3000 && hb.games.buzzer.wins === 10 && hb.games.buzzer.losses === 0 && hb.games.buzzer.streak === 10 && hb.games.buzzer.best === 0 && hb.games.buzzer.peak === 3000 && !("evil" in hb.games) && hb.games.lexicon === undefined && hb.daily.date === "" && hb.daily.xp === 0);
    const legacy = sanitizeState({ ...realmStore.get(), progress: { ...realmStore.get().progress, arena: undefined } });
    check("older saves without an arena get an empty one", Object.keys(legacy.progress.arena.games).length === 0 && legacy.progress.arena.daily.played.length === 0 && sanitizeState({ ...realmStore.get(), progress: { ...realmStore.get().progress, arena: null } }).progress.arena.season === "");
    const kept = sanitizeState(JSON.parse(JSON.stringify(realmStore.get())));
    const live = realmStore.get().progress.arena;
    check("a real arena save survives a round trip", kept.progress.arena.season === live.season && JSON.stringify(kept.progress.arena.daily) === JSON.stringify(live.daily) && (Object.keys(live.games) as Array<keyof typeof live.games>).every((g) => JSON.stringify(kept.progress.arena.games[g]) === JSON.stringify(live.games[g])) && Object.keys(kept.progress.arena.games).length === Object.keys(live.games).length);
  } catch (error) {
    check("arena checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 43. Walk-in rooms on the island ===");
  try {
    // Turning a room keeps every corner inside its footprint, for all four facings.
    let corners = true;
    for (const turns of [0, 1, 2, 3] as const) {
      const odd = turns % 2 === 1;
      const pl = { x0: 10, z0: 20, w: odd ? 9 : 14, d: odd ? 14 : 9, turns, iw: 14, id: 9 };
      for (const [x, z] of [[0, 0], [14, 0], [0, 9], [14, 9], [7, 4.5]]) {
        const p = roomToWorld(pl, x, z);
        if (p.x < 10 - 1e-9 || p.x > 10 + pl.w + 1e-9 || p.z < 20 - 1e-9 || p.z > 20 + pl.d + 1e-9) corners = false;
      }
    }
    check("a turned room stays inside its building's footprint", corners);
    check("a room's front faces the way its building faces", turnsForFacing(0) === 0 && turnsForFacing(Math.PI / 2) === 1 && turnsForFacing(-Math.PI / 2) === 3 && turnsForFacing(Math.PI) === 2);
    const saved = await loadSavedLaTrobeSemester();
    if (!saved) throw new Error("no La Trobe semester");
    resetWith(saved.subjects);
    moveIn();
    const base = generateWorld(saved.subjects, { university: "La Trobe University" });
    const island = withRooms(base, realmStore.get().progress.dorm);
    const kinds = (island.rooms ?? []).map((r) => r.kind).sort().join(",");
    check("the dorm and the lecture theatre are built into their buildings", kinds === "dorm,theatre");
    const start = { x: Math.floor(island.spawn.x), z: Math.floor(island.spawn.z) };
    for (const room of island.rooms ?? []) {
      const walk = (t: { x: number; z: number }) => isWalkable(island, t.x, t.z);
      check(`${room.kind}: its doorway is open on both sides`, walk(room.inside) && walk(room.outside));
      check(`${room.kind}: you can walk from the plaza straight inside`, findPath(island, start, [room.inside], 60000) !== null);
      const building = island.objects.find((o) => o.id === room.buildingId)!;
      check(`${room.kind}: the room sits exactly in its building`, room.x0 === building.x && room.z0 === building.z && room.w === building.w && room.d === building.d, `${room.x0},${room.z0} ${room.w}x${room.d} vs ${building.x},${building.z} ${building.w}x${building.d}`);
      const h = island.heights;
      const n = island.size + 1;
      const flat = Array.from({ length: room.d + 1 }, (_, dz) => Array.from({ length: room.w + 1 }, (_, dx) => h[(room.z0 + dz) * n + room.x0 + dx])).flat();
      check(`${room.kind}: its floor is level`, flat.every((y) => y === flat[0]));
    }
    const lectern = island.objects.find((o) => o.kind === "lectern")!;
    const bed = island.objects.find((o) => o.furniture?.id === "bed-single-a")!;
    check("the professor's lectern and your bed are on the island and reachable", !!lectern && !!bed && [lectern, bed].every((o) => findPath(island, start, interactionTiles(island, o), 60000) !== null));
    check("everything in both rooms can be used", island.objects.filter((o) => o.id.startsWith("theatre-") || o.id.startsWith("dorm-")).filter((o) => o.actions.length).every((o) => findPath(island, start, interactionTiles(island, o), 60000) !== null));
    check("the old leave-the-room door actions are gone (you just walk out)", island.objects.filter((o) => o.kind === "door").every((o) => o.actions.length === 0));
    check("rooms are only built on your home campus", withRooms({ ...base, mode: "interior" }, realmStore.get().progress.dorm).rooms === undefined);
    check("furniture can't block the dorm doorway", placeBlocker({ owned: { "table-small": 1 }, placed: [] }, "table-small", ROOM_COLS - 1, ROOM_ROWS - 1, 0) === "Keep the doorway clear.");
  } catch (error) {
    check("walk-in room checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 45. Expo demo ===");
  try {
    realmStore.replace(createEmptyState());
    check("expo mode is off unless the page asks for it", isExpo() === false);
    const ok = await startDemo("  Ann  ");
    const st = realmStore.get();
    check("a visitor starts as a La Trobe student with the four subjects", ok && st.curriculum?.enrolment.university === "La Trobe University" && st.curriculum.subjects.length === 4);
    check("their name is used, and they make their character first", st.player?.name === "Ann" && !st.player?.appearance);
    check("each subject gets its own look", new Set(st.curriculum!.subjects.map((s) => s.theme)).size === 4);
    check("the demo starts with full Focus, plenty of coins and clear fixed skies", st.progress.focus === 100 && st.progress.coins === 5000 && st.settings.realTimeSky === false);
    realmStore.set((x) => ({ ...x, progress: { ...x.progress, focus: 20 } }));
    topUpFocus();
    check("the demo's Focus refills when it runs low", realmStore.get().progress.focus === 100);
    check("semester dates come from La Trobe's calendar", Boolean(st.curriculum?.enrolment.startDate));
    realmStore.replace(createEmptyState());
    await startDemo("");
    check("no name: a friendly default", realmStore.get().player?.name === "Guest scholar");
  } catch (error) {
    check("expo checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 46. Parkour: controller, courses, ghosts and medals ===");
  try {
    const P = await import("../src/realm/games/parkour/physics");
    const C = await import("../src/realm/games/parkour/courses");
    const R = await import("../src/realm/games/parkour/reach");
    const G = await import("../src/realm/games/parkour/ghost");
    const S = await import("../src/realm/games/parkour/scoring");
    const SS = await import("../src/realm/games/parkour/session");
    const { PHYS } = P;
    type In = { x: number; z: number; jump: boolean; sprint: boolean };
    const idle: In = { x: 0, z: 0, jump: false, sprint: false };
    let nextId = 0;
    const box = (min: [number, number, number], max: [number, number, number], kind: import("../src/realm/games/parkour/physics").BoxKind = "plat", extra: Partial<import("../src/realm/games/parkour/physics").Box> = {}) => ({
      id: nextId++,
      kind,
      min: { x: min[0], y: min[1], z: min[2] },
      max: { x: max[0], y: max[1], z: max[2] },
      delta: { x: 0, y: 0, z: 0 },
      solid: kind !== "kill",
      dirX: 0,
      dirZ: 0,
      speed: 0,
      power: PHYS.bouncePower,
      checkpoint: -1,
      ...extra,
    });
    const world = (boxes: ReturnType<typeof box>[], doubleJump = true) => {
      nextId = 0;
      boxes.forEach((b, i) => (b.id = i));
      return { boxes, solids: boxes.filter((b) => b.solid), hazards: boxes.filter((b) => b.kind === "kill"), killY: -50, finish: null, doubleJump };
    };
    const player = (x: number, y: number, z: number, w: ReturnType<typeof world>) => P.createPlayer({ x, y, z, facing: Math.PI }, w);
    const steps = (s: ReturnType<typeof player>, w: ReturnType<typeof world>, input: In | ((i: number) => In), n: number) => {
      const events: string[] = [];
      for (let i = 0; i < n; i++) for (const e of P.stepPlayer(s, typeof input === "function" ? input(i) : input, w)) events.push(e.type);
      return events;
    };
    const floor = () => box([-50, -1, -50], [50, 0, 50]);

    // Gravity and the jump arc.
    {
      const w = world([floor()], false);
      const s = player(0, 0, 0, w);
      let apex = 0;
      let air = 0;
      const ev: string[] = [];
      for (let i = 0; i < 240; i++) {
        ev.push(...P.stepPlayer(s, { ...idle, jump: true }, w).map((e) => e.type));
        apex = Math.max(apex, s.pos.y);
        if (!s.grounded) air += PHYS.dt;
      }
      const expectedAir = 2 * Math.sqrt((2 * PHYS.jumpHeight) / PHYS.gravity);
      check("a held jump peaks at the jump height", Math.abs(apex - PHYS.jumpHeight) < 0.05, `apex ${apex.toFixed(3)}`);
      check("airtime matches the ballistic arc for that gravity", Math.abs(air - expectedAir) < 0.04, `${air.toFixed(3)} vs ${expectedAir.toFixed(3)}`);
      check("one jump, then one landing (holding Space doesn't bunny hop)", ev.filter((e) => e === "jump").length === 1 && ev.includes("land"), ev.join(","));
      const tap = player(0, 0, 0, w);
      let tapApex = 0;
      for (let i = 0; i < 120; i++) {
        P.stepPlayer(tap, { ...idle, jump: i < 2 }, w);
        tapApex = Math.max(tapApex, tap.pos.y);
      }
      check("variable jump height: a quick tap is a short hop", tapApex < PHYS.jumpHeight * 0.45 && tapApex > 0.05, tapApex.toFixed(3));
      const faller = player(0, 50, 0, world([], false));
      const fw = world([], false);
      faller.grounded = false;
      steps(faller, fw, idle, 60);
      const drop = 50 - faller.pos.y;
      check("falling follows gravity (0.5 s drops about g t^2 / 2)", Math.abs(drop - 0.5 * PHYS.gravity * 0.25) < 0.25, drop.toFixed(3));
      steps(faller, fw, idle, 600);
      check("falls are capped at terminal velocity", faller.vel.y >= -PHYS.maxFall - 1e-9);
    }

    // Coyote time and jump buffering.
    {
      const w = world([box([-2, -1, -2], [2, 0, 2])], false);
      const runOff = (jumpAt: number) => {
        const s = player(1.5, 0, 0, w);
        let leftAt = -1;
        const ev: string[] = [];
        for (let i = 0; i < 200; i++) {
          const left = leftAt >= 0 ? i - leftAt : -1;
          const e = P.stepPlayer(s, { x: 1, z: 0, jump: left === jumpAt, sprint: false }, w).map((x) => x.type);
          ev.push(...e);
          if (leftAt < 0 && !s.grounded && s.pos.x > 2) leftAt = i;
        }
        return ev;
      };
      check("coyote time: jumping just after running off a ledge still jumps", runOff(Math.round(0.06 / PHYS.dt)).includes("jump"));
      check("but not long after (no double jump on this course)", !runOff(Math.round(0.2 / PHYS.dt)).includes("jump"));
      const w2 = world([floor()], true);
      const s = player(0, 0.6, 0, w2);
      s.grounded = false;
      s.vel.y = -6;
      s.coyote = 0;
      const ev = steps(s, w2, (i) => ({ ...idle, jump: i < 30 }), 40);
      check("jump buffering: Space pressed just before landing jumps on landing", ev.includes("land") && ev.includes("jump") && ev.indexOf("jump") > ev.indexOf("land"), ev.join(","));
      check("and doesn't waste the double jump in the air", !ev.includes("doubleJump"));
    }

    // Double jump.
    {
      const w = world([floor()], true);
      const s = player(0, 0, 0, w);
      const ev = steps(s, w, (i) => ({ ...idle, jump: i < 20 || (i >= 30 && i < 50) || i >= 60 }), 70);
      check("double jump: once per air time", ev.filter((e) => e === "doubleJump").length === 1, ev.join(","));
      const off = world([floor()], false);
      const s2 = player(0, 0, 0, off);
      check("no double jump on courses without it", !steps(s2, off, (i) => ({ ...idle, jump: i < 20 || (i >= 30 && i < 50) }), 60).includes("doubleJump"));
    }

    // Wall jumps.
    {
      const wallRight = box([1, -5, -5], [2, 10, 5]);
      const w = world([wallRight], true);
      const s = player(1 - PHYS.halfWidth - 0.01, 2, 0, w);
      s.grounded = false;
      steps(s, w, { x: 1, z: 0, jump: false, sprint: false }, 2);
      check("touching a wall in the air is detected (normal points away from it)", s.wall?.nx === -1, JSON.stringify(s.wall));
      const ev = steps(s, w, { x: 1, z: 0, jump: true, sprint: false }, 1);
      check("wall jump kicks away from the wall and upward", ev.includes("wallJump") && s.vel.x < -5 && s.vel.y > 5, `${ev} ${s.vel.x.toFixed(2)} ${s.vel.y.toFixed(2)}`);
      const wallLeft = world([box([-2, -5, -5], [-1, 10, 5])], false);
      const l = player(-1 + PHYS.halfWidth + 0.01, 2, 0, wallLeft);
      l.grounded = false;
      steps(l, wallLeft, { x: -1, z: 0, jump: false, sprint: false }, 2);
      steps(l, wallLeft, { x: -1, z: 0, jump: true, sprint: false }, 1);
      check("off a wall on the left you're kicked to the right", l.vel.x > 5);
      // Straight back into the same wall: no second wall jump off it.
      const again = player(1 - PHYS.halfWidth - 0.01, 2, 0, world([box([1, -5, -5], [2, 10, 5])], false));
      const againWorld = world([box([1, -5, -5], [2, 10, 5])], false);
      again.grounded = false;
      steps(again, againWorld, { x: 1, z: 0, jump: false, sprint: false }, 2);
      steps(again, againWorld, { x: 1, z: 0, jump: true, sprint: false }, 1);
      const back = steps(again, againWorld, (i) => ({ x: 1, z: 0, jump: i > 25, sprint: false }), 50);
      check("the same wall can't be wall-jumped twice in a row", !back.includes("wallJump"), back.join(","));
    }

    // Wall runs.
    {
      const tryRun = (opts: { sprint?: boolean; vz?: number; input?: [number, number]; wallLen?: number; holdFor?: number }) => {
        const len = opts.wallLen ?? 40;
        const w = world([box([-4, -5, -len], [-3, 10, 0])], true);
        const s = player(-3 + PHYS.halfWidth + 0.01, 2, -1, w);
        s.grounded = false;
        s.vel = { x: 0, y: 1, z: opts.vz ?? -11 };
        const [ix, iz] = opts.input ?? [-0.3, -1];
        const ev: string[] = [];
        let started = -1;
        let ended = -1;
        let minY = Infinity;
        let maxY = -Infinity;
        let side = 0;
        for (let i = 0; i < 240; i++) {
          const hold = opts.holdFor === undefined || i < opts.holdFor;
          const e = P.stepPlayer(s, { x: hold ? ix : 0, z: hold ? iz : 0, jump: false, sprint: opts.sprint ?? true }, w).map((x) => x.type);
          ev.push(...e);
          if (e.includes("wallRunStart") && started < 0) {
            started = i;
            side = s.wallRun?.side ?? 0;
          }
          if (e.includes("wallRunEnd") && ended < 0) ended = i;
          if (started >= 0 && ended < 0) {
            minY = Math.min(minY, s.pos.y);
            maxY = Math.max(maxY, s.pos.y);
          }
        }
        return { started, ended, ev, minY, maxY, side };
      };
      const ok = tryRun({});
      check("wall run starts when sprinting along a wall in the air", ok.started >= 0 && ok.started < 5, ok.ev.join(","));
      check("wall run holds height (no more than a metre lost)", ok.minY > 2 - 1 && ok.maxY < 2 + 1.2, `${ok.minY.toFixed(2)}..${ok.maxY.toFixed(2)}`);
      check("wall run ends after its time limit", ok.ended > 0 && Math.abs((ok.ended - ok.started) * PHYS.dt - PHYS.wallRunTime) < 0.05, String((ok.ended - ok.started) * PHYS.dt));
      check("no wall run without sprinting", tryRun({ sprint: false }).started < 0);
      const slow = tryRun({ vz: -3 });
      check("no wall run until you're moving fast along the wall", slow.started < 0 || slow.started * PHYS.dt >= (PHYS.wallRunMinSpeed - 3) / PHYS.airAccel - 0.02, String(slow.started));
      check("no wall run when steering away from the wall's direction", tryRun({ input: [0.2, 1] }).started < 0);
      const short = tryRun({ wallLen: 5 });
      check("wall run stops at the end of the wall", short.started >= 0 && short.ended > short.started && (short.ended - short.started) * PHYS.dt < PHYS.wallRunTime - 0.3);
      const let_go = tryRun({ holdFor: 20 });
      check("wall run stops when you let go of forward", let_go.started >= 0 && let_go.ended > 0 && let_go.ended <= 22);
      check("wall run knows the wall is on the runner's left (for the camera tilt and lean)", ok.side === -1);
    }

    // Collision: no tunnelling at top speed, steps and ledges.
    {
      const thin = world([box([-5, -0.1, -5], [5, 0, 5])], false);
      const s = player(0, 40, 0, thin);
      s.grounded = false;
      s.vel.y = -PHYS.maxFall;
      steps(s, thin, idle, 300);
      check("falling at terminal velocity lands on a 10 cm platform", Math.abs(s.pos.y) < 1e-6 && s.grounded, s.pos.y.toFixed(4));
      const t2 = player(0, 30, 0, thin);
      t2.grounded = false;
      P.moveAndCollide(t2, thin, 0, -40, 0);
      check("even one huge move is stopped by a thin platform (sub-steps)", Math.abs(t2.pos.y) < 1e-6);
      const wallW = world([floor(), box([5, 0, -5], [5.05, 4, 5])], false);
      const r = player(0, 0, 0, wallW);
      P.moveAndCollide(r, wallW, 12, 0, 0);
      check("a 5 cm wall stops a 12 m sideways move", r.pos.x <= 5 - PHYS.halfWidth + 1e-6, r.pos.x.toFixed(3));
      const boosted = player(0, 0, 0, wallW);
      boosted.boost = 5;
      steps(boosted, wallW, { x: 1, z: 0, jump: false, sprint: true }, 240);
      check("running at boost speed into a thin wall never passes through", boosted.pos.x < 5);
      const stepW = world([floor(), box([2, 0, -5], [6, 0.3, 5]), box([8, 0, -5], [9, 0.9, 5])], false);
      const st = player(0, 0, 0, stepW);
      steps(st, stepW, { x: 1, z: 0, jump: false, sprint: false }, 120);
      check("small steps are climbed without jumping", Math.abs(st.pos.y - 0.3) < 1e-6 || st.pos.x > 6, st.pos.y.toFixed(3));
      check("but a waist-high block stops you", st.pos.x <= 8 - PHYS.halfWidth + 1e-6, st.pos.x.toFixed(3));
    }

    // Courses: moving platforms, bounce pads, checkpoints and respawn.
    {
      const meadow = C.courseById("meadow")!;
      const course = C.buildCourse(meadow);
      const moverIndex = meadow.pieces.findIndex((p) => p.move);
      const mover = course.world.boxes[moverIndex];
      const s = P.createPlayer({ x: (mover.min.x + mover.max.x) / 2, y: mover.max.y, z: (mover.min.z + mover.max.z) / 2, facing: 0 }, course.world);
      let t = 0;
      const z0 = s.pos.z;
      for (let i = 0; i < 240; i++) {
        t += PHYS.dt;
        C.advanceCourse(course, t);
        P.stepPlayer(s, idle, course.world);
      }
      const expectedDz = C.pieceOffset(meadow.pieces[moverIndex], t)[2];
      check("moving platforms carry you", s.grounded && Math.abs(s.pos.z - z0 - expectedDz) < 0.05, `${(s.pos.z - z0).toFixed(3)} vs ${expectedDz.toFixed(3)}`);

      const bw = world([box([-2, -1, -2], [2, 0.3, 2], "bounce", { power: 24 })], false);
      const b = player(0, 2, 0, bw);
      b.grounded = false;
      const bev = steps(b, bw, idle, 40);
      check("bounce pads launch you", bev.includes("bounce") && b.vel.y > 15 && !bev.includes("land"));

      const sess = SS.newSession(meadow);
      SS.startSessionRun(sess, null);
      const cp1 = sess.course.spawns[1];
      sess.player.pos = { x: cp1.x, y: cp1.y + 0.05, z: cp1.z };
      const e1 = [...SS.stepSession(sess, 0.1), ...SS.stepSession(sess, 0.1)].map((e) => e.type);
      check("stepping onto a checkpoint saves it (with a split time)", sess.player.checkpoint === 1 && e1.includes("checkpoint") && e1.includes("split") && e1.includes("timerStart"), e1.join(","));
      sess.player.pos = { x: 0, y: meadow.killY - 5, z: -80 };
      const e2 = SS.stepSession(sess, 0.02).map((e) => e.type);
      check("falling into the void respawns you at the last checkpoint", e2.includes("death") && Math.abs(sess.player.pos.x - cp1.x) < 0.2 && Math.abs(sess.player.pos.z - cp1.z) < 0.2 && sess.player.pos.y >= cp1.y - 0.1);
      const kill = sess.course.world.hazards[0];
      sess.player.pos = { x: (kill.min.x + kill.max.x) / 2, y: kill.min.y, z: (kill.min.z + kill.max.z) / 2 };
      const e3 = SS.stepSession(sess, 0.02).map((e) => e.type);
      check("touching a kill brick respawns you", e3.includes("death") && Math.abs(sess.player.pos.z - cp1.z) < 0.2);
      const fin = sess.course.world.finish!;
      sess.player.pos = { x: (fin.min.x + fin.max.x) / 2, y: fin.min.y, z: (fin.min.z + fin.max.z) / 2 };
      const e4 = SS.stepSession(sess, 0.02).map((e) => e.type);
      check("the finish portal ends the run and stops the clock", e4.includes("finish") && sess.mode === "done");
    }

    // Every course can be finished, with slack, and needs the tricks it teaches.
    {
      const ids = new Set<string>();
      for (const def of C.COURSES) {
        ids.add(def.id);
        const course = C.buildCourse(def);
        const res = R.courseCompletable(course, { margin: 0.9 });
        check(`${def.name}: start, every checkpoint and the finish are reachable (at 90% of jump and speed)`, res.ok, res.problems.join("; "));
        const [b, s, g] = def.medals;
        check(`${def.name}: medal times run bronze > silver > gold > 0`, b > s && s > g && g > 0);
        check(`${def.name}: has a start, a finish and at least two checkpoints`, course.spawnBoxes[0] !== undefined && course.finishBox >= 0 && C.checkpointCount(def) >= 2);
        const text = [def.name, def.blurb, ...def.teaches, ...def.signs.map((x) => x.text)].join(" ");
        check(`${def.name}: no em dashes in player-facing text`, !text.includes("—"));
      }
      check("course ids are unique", ids.size === C.COURSES.length);
      const meadow = C.buildCourse(C.courseById("meadow")!);
      check("Meadow Hop needs no wall tricks or double jump", R.courseCompletable(meadow, { walls: false, doubleJump: false, margin: 0.9 }).ok);
      const cloud = C.buildCourse(C.courseById("cloudworks")!);
      check("Cloud Works can't be finished without wall jumps (the chimney)", !R.canReach(cloud, cloud.spawnBoxes[1], cloud.spawnBoxes[2], { walls: false }));
      check("Cloud Works needs the double jump", !R.courseCompletable(cloud, { doubleJump: false }).ok);
      const storm = C.buildCourse(C.courseById("stormspire")!);
      check("Storm Spire's first gap needs a wall run", !R.canReach(storm, storm.spawnBoxes[0], storm.spawnBoxes[1], { walls: false }));
      const gap: import("../src/realm/games/parkour/courses").CourseDef = {
        ...C.courseById("meadow")!,
        pieces: [
          { k: "start", at: [0, 0, 0], size: [6, 1, 6] },
          { k: "finish", at: [0, 0, -30], size: [6, 1, 6] },
        ],
        signs: [],
      };
      check("the reachability check rejects a gap nobody can jump", !R.courseCompletable(C.buildCourse(gap)).ok);

      // The real controller crosses Storm Spire's first gap with a wall run.
      const c = C.buildCourse(C.courseById("stormspire")!);
      const s = P.createPlayer({ x: -1.6, y: 0, z: -8, facing: Math.PI }, c.world);
      let phase = 0;
      let hold = 0;
      let t = 0;
      const seen: string[] = [];
      for (let i = 0; i < 700 && s.checkpoint < 1; i++) {
        t += PHYS.dt;
        C.advanceCourse(c, t);
        const inp: In = { x: 0, z: -1, jump: false, sprint: true };
        if (phase === 0 && s.pos.z < -15.6) {
          phase = 1;
          hold = 20;
        }
        if (phase === 1) inp.x = -0.6;
        if (phase === 2 && s.wallRun && s.wallRun.time > 1.0) {
          phase = 3;
          hold = 30;
        }
        if (phase === 3) inp.x = 0.2;
        if (hold > 0) {
          inp.jump = true;
          hold--;
        }
        for (const e of P.stepPlayer(s, inp, c.world)) {
          seen.push(e.type);
          if (e.type === "wallRunStart") phase = 2;
          if (e.type === "death") i = 700;
        }
      }
      check("a scripted run wall-runs across Storm Spire's opening gap to checkpoint 1", s.checkpoint === 1 && seen.includes("wallRunStart") && seen.includes("wallJump"), seen.join(","));
    }

    // Ghosts.
    {
      const rec = new G.GhostRecorder();
      for (let i = 0; i <= 120; i++) rec.sample(i * PHYS.dt, i * 0.1, 0, 0, 0, 1);
      check("ghosts record a frame every 0.05 s", rec.frames.length === Math.floor(1 / G.GHOST_INTERVAL) + 1 || rec.frames.length === Math.floor(1 / G.GHOST_INTERVAL), String(rec.frames.length));
      const ghost = { course: "meadow", time: 1, splits: [0.5], frames: rec.frames };
      const mid = G.sampleGhost(ghost, 0.525)!;
      check("ghost playback interpolates between frames", Math.abs(mid.x - 0.525 / PHYS.dt * 0.1) < 0.02, mid.x.toFixed(3));
      check("ghost playback holds the last frame after the end", G.sampleGhost(ghost, 99)!.x === rec.frames[rec.frames.length - 1].x);
      const round = G.decodeGhost(G.encodeGhost(ghost), "meadow");
      check("ghosts survive saving and loading", !!round && round.frames.length === ghost.frames.length && round.time === 1 && round.splits[0] === 0.5);
      check("a ghost for another course is ignored", G.decodeGhost(G.encodeGhost(ghost), "cloudworks") === null);
      check("broken ghost data is ignored", G.decodeGhost("{nope", "meadow") === null && G.decodeGhost(JSON.stringify({ v: 1, c: "meadow", t: 3, s: [], f: [1, 2, 3] }), "meadow") === null && G.decodeGhost(JSON.stringify({ v: 1, c: "meadow", t: 3, s: [], f: [0, "x", 0, 0, 0, 0] }), "meadow") === null);
    }

    // Focus cost, medals, personal bests and coins through the shared play-game records.
    {
      realmStore.replace(createEmptyState());
      const meadow = C.courseById("meadow")!;
      const cloud = C.courseById("cloudworks")!;
      realmStore.set((x) => ({ ...x, progress: { ...x.progress, focus: 1 } }));
      check("a run can't start without enough Focus", S.startRun(meadow) === false && realmStore.get().progress.focus === 1);
      realmStore.set((x) => ({ ...x, progress: { ...x.progress, focus: 10 } }));
      check("starting a run costs Focus", S.startRun(meadow) === true && realmStore.get().progress.focus === 10 - S.PARKOUR_COST);
      const coins0 = realmStore.get().progress.coins;
      const gold = S.finishRun(meadow, meadow.medals[2] - 1);
      check("a gold time earns gold and coins", gold.medal === "gold" && gold.newBest && gold.coins > 0 && realmStore.get().progress.coins === coins0 + gold.coins);
      const slow = S.finishRun(meadow, meadow.medals[0] + 10);
      check("a slower run earns no medal and keeps the best (lower is better)", slow.medal === null && !slow.newBest && slow.best === meadow.medals[2] - 1);
      const silver = S.finishRun(cloud, cloud.medals[1] - 0.5);
      check("each course keeps its own record (parkour-<course> ids)", silver.medal === "silver" && S.courseRecord(cloud).best === cloud.medals[1] - 0.5 && S.parkourGameId("cloudworks") === "parkour-cloudworks");
      check("the best medal is remembered", realmStore.get().progress.games["parkour-meadow"]?.medal === "gold" && realmStore.get().progress.games["parkour-meadow"]?.plays === 2);
      check("run times read like 1:02.35", S.formatTime(62.351) === "1:02.35" && S.formatTime(null) === "--:--.--" && S.formatDelta(-0.5) === "-0.50");
      realmStore.replace(createEmptyState());
    }
  } catch (error) {
    check("parkour checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 47. Archery range and ping pong ===");
  try {
    const AP = await import("../src/realm/games/archery/physics");
    const AR = await import("../src/realm/games/archery/rules");
    const AQ = await import("../src/realm/games/archery/quiz");
    const AE = await import("../src/realm/games/archery/engine");
    const PP = await import("../src/realm/games/pingpong/physics");
    const PR = await import("../src/realm/games/pingpong/rules");
    const PA = await import("../src/realm/games/pingpong/ai");
    const PG = await import("../src/realm/state/playGames");
    const rng = seededRng("archery-pingpong");

    // --- Archery: arrow flight ---
    const eye = { x: 0, y: AP.EYE_HEIGHT, z: 0 };
    const calm = { x: 0, z: 0 };
    const flat = AP.arrowAtDistance(AP.launchArrow(eye, 0, 0, 1), calm, -30);
    check("a level arrow drops under gravity", flat !== null && flat.y < AP.EYE_HEIGHT - 0.5 && Math.abs(flat.x) < 1e-9, JSON.stringify(flat));
    const weak = AP.arrowAtDistance(AP.launchArrow(eye, 0, 0.02, 0.4), calm, -18);
    const strong = AP.arrowAtDistance(AP.launchArrow(eye, 0, 0.02, 1), calm, -18);
    check("a fuller draw shoots flatter (less drop at the same distance)", weak !== null && strong !== null && strong.y > weak.y);
    const pin18 = AP.pinElevation(18, AR.TARGET_HEIGHT);
    const pin45 = AP.pinElevation(45, AR.TARGET_HEIGHT);
    const onPin = AP.arrowAtDistance(AP.launchArrow(eye, 0, pin45, 1), calm, -45);
    check("sight pins: further targets need more elevation, and the 45 m pin lands on the gold", pin45 > pin18 && pin18 > 0 && onPin !== null && Math.abs(onPin.y - AR.TARGET_HEIGHT) < 0.02, `${pin18} ${pin45} ${onPin?.y}`);
    const drift = AP.arrowAtDistance(AP.launchArrow(eye, 0, pin45, 1), { x: 4, z: 0 }, -45);
    const driftLeft = AP.arrowAtDistance(AP.launchArrow(eye, 0, pin45, 1), { x: -4, z: 0 }, -45);
    check("wind drifts the arrow downwind, symmetrically", drift !== null && driftLeft !== null && drift.x > 0.2 && Math.abs(drift.x + driftLeft.x) < 1e-6, `${drift?.x}`);
    const head = AP.arrowAtDistance(AP.launchArrow(eye, 0, pin45, 1), { x: 0, z: 3 }, -45);
    check("a headwind slows the arrow so it drops more", head !== null && head.y < onPin!.y);
    check("draw speed rises with the draw and is capped", AP.drawSpeed(0) === AP.ARROW_MIN_SPEED && AP.drawSpeed(1) === AP.ARROW_MAX_SPEED && AP.drawSpeed(2) === AP.ARROW_MAX_SPEED && AP.drawSpeed(0.5) > AP.ARROW_MIN_SPEED);

    // --- Archery: scoring ---
    const R = 0.6;
    check("ring scoring: dead centre is a 10 and an X", AP.ringScore(0, 0, R).ring === 10 && AP.ringScore(0, 0, R).x);
    check("ring scoring: each tenth of the radius drops a ring", AP.ringScore(R * 0.15, 0, R).ring === 9 && AP.ringScore(0, R * 0.55, R).ring === 5 && AP.ringScore(R * 0.95, 0, R).ring === 1);
    check("ring scoring: the edge still scores 1, off the face scores 0", AP.ringScore(R, 0, R).ring === 1 && AP.ringScore(R * 1.01, 0, R).ring === 0 && !AP.ringScore(R * 0.06, 0, R).x);
    const face = { x: 0, y: 1.3, z: -18, radius: R };
    const crossed = AP.crossTarget({ x: 0.1, y: 1.4, z: -17.5 }, { x: 0.1, y: 1.4, z: -18.5 }, face);
    check("an arrow crossing the face plane is caught where it crosses", crossed !== null && Math.abs(crossed.dx - 0.1) < 1e-9 && Math.abs(crossed.dy - 0.1) < 1e-9);
    check("arrows wide of the straw or not reaching it miss", AP.crossTarget({ x: 2, y: 1.3, z: -17.9 }, { x: 2, y: 1.3, z: -18.1 }, face) === null && AP.crossTarget({ x: 0, y: 1.3, z: -16 }, { x: 0, y: 1.3, z: -17 }, face) === null);
    const moving = AR.practiceTarget(2);
    check("practice: 3 ends of 6 arrows at 18, 30, 45 m, only the last moves", AR.PRACTICE_ROUNDS.map((r) => `${r.distance}x${r.arrows}`).join(",") === "18x6,30x6,45x6" && AR.PRACTICE_MAX === 180 && AR.practiceTarget(0).moveAmp === 0 && moving.moveAmp > 0 && AR.targetPosition(moving, 1).x !== AR.targetPosition(moving, 0).x);
    let windOk = true;
    for (let i = 0; i < 200; i++) if (AR.windSpeed(AR.rollWind(3, rng)) > 3 + 1e-9) windOk = false;
    check("rolled wind never exceeds the end's limit", windOk);
    const breathe = AP.updateBreath({ air: 1, steady: 0, strain: 0 }, true, 0.5);
    let out = breathe;
    for (let i = 0; i < 40; i++) out = AP.updateBreath(out, true, 0.25);
    check("holding your breath steadies the bow until the air runs out, then you shake", breathe.steady > 0.5 && breathe.air < 1 && out.air === 0 && out.strain > 0.5);
    const calmSway = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(AP.swayAt(i * 0.1, 1, 0).yaw)));
    const wildSway = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(AP.swayAt(i * 0.1, 0, 1).yaw)));
    check("sway: steady breath calms it, fatigue makes it worse", calmSway < wildSway / 3);

    // --- Archery: quiz range ---
    const subjects = [makeSubject(1, 6, 1, "arcane"), makeSubject(2, 6, 1, "guild")];
    subjects[0].questions = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, prompt: `Question ${i}?`, choices: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], answerIndex: i % 4, explanation: "", week: 1 }));
    const picked = AQ.pickQuizQuestions(subjects, 8, seededRng("quiz"));
    check("quiz questions: valid, distinct, from both subjects", picked.length === 8 && picked.every((p) => AQ.isUsableQuestion(p.question)) && new Set(picked.map((p) => p.question.prompt)).size === 8 && new Set(picked.map((p) => p.subjectId)).size === 2);
    const source = subjects[0].questions[1];
    const shuffled = AQ.shuffleChoices(source, seededRng(3));
    check("shuffling the choices keeps the right answer right", shuffled.choices[shuffled.answerIndex] === source.choices[source.answerIndex] && [...shuffled.choices].sort().join() === [...source.choices].sort().join());
    check("broken questions are never used", !AQ.isUsableQuestion({ ...source, choices: ["a", "b", "c"] }) && !AQ.isUsableQuestion({ ...source, answerIndex: 4 }) && !AQ.isUsableQuestion({ ...source, choices: ["a", "a", "b", "c"] }));
    const targets = AR.quizTargets();
    check("four targets, A to D from left to right", targets.map((t) => t.label).join("") === "ABCD" && targets.every((t, i) => i === 0 || t.x > targets[i - 1].x));
    check("only the target with the right letter is correct", [0, 1, 2, 3].filter((i) => AR.isCorrectTarget(i, shuffled)).join() === String(shuffled.answerIndex));
    check("streak multiplier: x1, x2 from 2 in a row, capped at x4", [0, 1, 2, 3, 4, 6, 20].map(AR.streakMultiplier).join() === "1,1,2,2,3,4,4" && AR.quizHitPoints(10, 6) === 450 && AR.quizHitPoints(0, 1) === 100);
    const tf = AQ.trueFalseFrom(picked[0], () => 0.1);
    const ff = AQ.trueFalseFrom(picked[0], () => 0.9);
    check("rally quiz true/false cards are judged right", tf.isTrue && tf.shown === picked[0].question.choices[picked[0].question.answerIndex] && !ff.isTrue && ff.shown !== tf.shown && AQ.judgeTrueFalse(tf, true) && !AQ.judgeTrueFalse(ff, true));

    // The engine end to end: a wrong hit reports a wrong answer and resets the streak.
    const answers: boolean[] = [];
    const eng = new AE.ArcheryEngine("quiz", picked.slice(0, 2), { sound: () => undefined, changed: () => undefined, popup: () => undefined, answer: (_i, c) => answers.push(c) }, seededRng(9));
    eng.wind = { x: 0, z: 0 };
    eng.tick(2);
    const aimAt = (index: number) => {
      eng.yaw = Math.atan(eng.targets[index].x / AR.QUIZ_DISTANCE);
      eng.pitch = AP.pinElevation(AR.QUIZ_DISTANCE, AR.TARGET_HEIGHT);
      eng.holdingBreath = true;
      eng.startDraw();
      for (let i = 0; i < 40; i++) eng.tick(1 / 30);
      eng.release();
      for (let i = 0; i < 120 && eng.phase === "flight"; i++) eng.tick(1 / 60);
    };
    const firstRight = eng.question!.question.answerIndex;
    aimAt(firstRight);
    check("quiz engine: hitting the right letter scores and counts as right", answers[0] === true && eng.right === 1 && eng.streak === 1 && eng.total > 0, `${answers} ${eng.phase}`);
    for (let i = 0; i < 200 && eng.phase !== "aim"; i++) eng.tick(1 / 30);
    eng.wind = { x: 0, z: 0 };
    const wrongIndex = (eng.question!.question.answerIndex + 1) % 4;
    aimAt(wrongIndex);
    check("quiz engine: a wrong letter is a wrong answer and breaks the streak", answers[1] === false && eng.wrong === 1 && eng.streak === 0);
    for (let i = 0; i < 200 && eng.phase !== "done"; i++) eng.tick(1 / 30);
    check("quiz engine: the round ends after the last question", eng.phase === "done");

    // --- Ping pong: ball physics ---
    const drop: import("../src/realm/games/pingpong/physics").Ball = { x: 0, y: PP.TABLE_HEIGHT + 0.3, z: 0.6, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
    const events: string[] = [];
    for (let t = 0; t < 1 && events.length === 0; t += PP.STEP) for (const ev of PP.stepBall(drop, PP.STEP)) events.push(ev.type === "table" ? `table-${ev.side}` : ev.type);
    check("a dropped ball bounces on the table, lower than it fell", events[0] === "table-near" && drop.vy > 0 && drop.vy < Math.sqrt(2 * PP.G * 0.3));
    const kick = (spin: number) => {
      const b = { x: 0, y: PP.TABLE_HEIGHT + 0.05, z: -0.5, vx: 0, vy: -2, vz: -4, spin, side: 0 };
      for (let t = 0; t < 0.2; t += PP.STEP) if (PP.stepBall(b, PP.STEP).some((ev) => ev.type === "table")) break;
      return b;
    };
    check("topspin kicks forward off the bounce, backspin checks up", Math.abs(kick(1).vz) > Math.abs(kick(0).vz) && Math.abs(kick(0).vz) > Math.abs(kick(-1).vz));
    const intoNet = { x: 0, y: PP.TABLE_HEIGHT + 0.06, z: 0.3, vx: 0, vy: 0, vz: -5, spin: 0, side: 0 };
    let hitNet = false;
    for (let t = 0; t < 0.2; t += PP.STEP) if (PP.stepBall(intoNet, PP.STEP).some((ev) => ev.type === "net")) hitNet = true;
    check("a low ball hits the net and drops back on the hitter's side", hitNet && intoNet.z > 0);
    const over = { x: 0, y: PP.NET_TOP + 0.15, z: 0.3, vx: 0, vy: 0, vz: -5, spin: 0, side: 0 };
    let overNet = false;
    for (let t = 0; t < 0.12; t += PP.STEP) if (PP.stepBall(over, PP.STEP).some((ev) => ev.type === "net")) overNet = true;
    check("a high ball clears the net", !overNet && over.z < 0);
    const wide = { x: PP.HALF_W + 0.2, y: PP.TABLE_HEIGHT + 0.2, z: -0.5, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
    const wideEvents: string[] = [];
    for (let t = 0; t < 2 && !wideEvents.includes("floor"); t += PP.STEP) for (const ev of PP.stepBall(wide, PP.STEP)) wideEvents.push(ev.type);
    check("a ball off the side of the table falls to the floor", !wideEvents.includes("table") && wideEvents.includes("floor"));
    const from = { x: 0.1, y: 1.0, z: PP.PLAYER_PADDLE_Z };
    const aimed = PP.aimShot(from, { x: -0.3, z: -0.9 }, 6, 0.6);
    const land = PP.landingPoint({ ...from, ...aimed });
    check("an aimed shot lands where it was aimed, spin and all", land !== null && Math.abs(land.x + 0.3) < 0.02 && Math.abs(land.z + 0.9) < 0.02, JSON.stringify(land));
    let legalServes = 0;
    for (const spin of [-0.8, 0, 0.8]) {
      for (const tz of [-0.6, -1.1]) {
        const s = PP.planServe({ x: 0.2, y: 1.06, z: 1.56 }, { x: -0.3, z: tz }, spin);
        const b = { x: 0.2, y: 1.06, z: 1.56, ...s };
        const r = PR.newRally("near");
        PR.onHit(r, "near");
        let outcome: ReturnType<typeof PR.onBounce> = null;
        for (let t = 0; t < 3 && !outcome && r.bounces.far < 1; t += PP.STEP) {
          for (const ev of PP.stepBall(b, PP.STEP)) {
            outcome = ev.type === "table" ? PR.onBounce(r, ev.side) : ev.type === "net" ? PR.onNet(r) : PR.onFloor(r);
            if (outcome) break;
          }
        }
        if (!outcome && r.bounces.near === 1 && r.bounces.far === 1 && !r.netOnServe) legalServes++;
      }
    }
    check("planned serves bounce on your half, then theirs, clear of the net", legalServes === 6, `${legalServes}/6`);
    const hard = PP.playerReturn({ x: 0, y: 1, z: PP.PLAYER_PADDLE_Z, vx: 0, vy: 0, vz: 7, spin: 0, side: 0 }, { x: 0, y: 1, vx: 0, vy: 6 });
    const soft = PP.playerReturn({ x: 0, y: 1, z: PP.PLAYER_PADDLE_Z, vx: 0, vy: 0, vz: 4, spin: 0, side: 0 }, { x: 0, y: 1, vx: 0, vy: 0.5 });
    const edge = PP.playerReturn({ x: 0.1, y: 1, z: PP.PLAYER_PADDLE_Z, vx: 0, vy: 0, vz: 4, spin: 0, side: 0 }, { x: 0, y: 1, vx: 0, vy: 0.5 });
    check("paddle: a hard upward swing hits deep with topspin (too hard goes long), the edge angles it", hard.landing.z < -PP.HALF_L && hard.shot.spin > 0.9 && soft.landing.z > -1 && Math.abs(soft.shot.spin) < 0.3 && edge.landing.x > soft.landing.x + 0.3);

    // --- Ping pong: rules ---
    const rally = (server: "near" | "far", steps: Array<["hit" | "bounce" | "net" | "floor", ("near" | "far")?]>) => {
      const r = PR.newRally(server);
      let res: ReturnType<typeof PR.onHit> = null;
      for (const [kind, side] of steps) {
        res = kind === "hit" ? PR.onHit(r, side!) : kind === "bounce" ? PR.onBounce(r, side!) : kind === "net" ? PR.onNet(r) : PR.onFloor(r);
        if (res) break;
      }
      return res;
    };
    const ace = rally("near", [["hit", "near"], ["bounce", "near"], ["bounce", "far"], ["floor"]]);
    check("rules: an unreturned serve is an ace for the server", ace?.kind === "point" && ace.to === "near");
    check("rules: a serve straight onto the far half is a fault", (rally("near", [["hit", "near"], ["bounce", "far"]]) as { to: string } | null)?.to === "far");
    check("rules: a good serve that clips the net is a let", rally("far", [["hit", "far"], ["bounce", "far"], ["net"], ["bounce", "near"]])?.kind === "let");
    check("rules: a return into the net loses the point", (rally("near", [["hit", "near"], ["bounce", "near"], ["bounce", "far"], ["hit", "far"], ["net"], ["bounce", "far"]]) as { to: string; reason: string } | null)?.to === "near");
    check("rules: a return that misses the table is out", (rally("near", [["hit", "near"], ["bounce", "near"], ["bounce", "far"], ["hit", "far"], ["floor"]]) as { to: string; reason: string } | null)?.reason === "out");
    check("rules: two bounces on your half loses the point", (rally("near", [["hit", "near"], ["bounce", "near"], ["bounce", "far"], ["hit", "far"], ["bounce", "near"], ["bounce", "near"]]) as { to: string } | null)?.to === "far");
    const volley = PR.newRally("near");
    PR.onHit(volley, "near");
    PR.onBounce(volley, "near");
    check("rules: the receiver can't hit before the ball bounces on their side", !PR.canHit(volley, "far") && (PR.onBounce(volley, "far"), PR.canHit(volley, "far")));

    // --- Ping pong: the match ---
    let m = PR.newMatch(11, "near");
    const servers: string[] = [];
    for (let i = 0; i < 8; i++) {
      servers.push(PR.serverFor(m));
      m = PR.awardRally(m, i % 2 ? "near" : "far");
    }
    check("serve changes every two points", servers.join(",") === "near,near,far,far,near,near,far,far");
    m = { ...PR.newMatch(11, "near"), score: { near: 10, far: 10 }, played: 20 };
    const deuceServers = [PR.serverFor(m), PR.serverFor(PR.awardRally(m, "near")), PR.serverFor(PR.awardRally(PR.awardRally(m, "near"), "far"))];
    check("at 10-all it's deuce and service alternates every point", PR.isDeuce(m) && deuceServers.join(",") === "near,far,near");
    check("first to 11 must win by two", PR.winnerOf({ ...m, score: { near: 11, far: 10 } }) === null && PR.winnerOf({ ...m, score: { near: 12, far: 10 } }) === "near" && PR.winnerOf({ ...m, score: { near: 11, far: 9 } }) === "near" && PR.winnerOf({ ...m, score: { near: 13, far: 15 } }) === "far");
    const quick = PR.newMatch(7, "far");
    check("the quick game is first to 7, also by two", PR.winnerOf({ ...quick, score: { near: 7, far: 5 } }) === "near" && PR.winnerOf({ ...quick, score: { near: 7, far: 6 } }) === null && PR.isDeuce({ ...quick, score: { near: 6, far: 6 } }));
    check("a rally-quiz bonus point scores without moving the service order", PR.awardBonus(m, "near").played === m.played && PR.awardBonus(m, "near").score.near === 11);
    check("match rating: any win beats any loss; bigger wins rate higher", PR.matchRating(11, 9, 11) >= 100 && PR.matchRating(10, 12, 11) < 100 && PR.matchRating(11, 0, 11) > PR.matchRating(11, 6, 11) && PR.matchRating(7, 0, 7) === 200);

    // --- Ping pong: the rival ---
    const P = PA.AI_PROFILES;
    check("rivals: harder means faster reactions, quicker feet, fewer mistakes", P.easy.reaction > P.medium.reaction && P.medium.reaction > P.hard.reaction && P.easy.speed < P.medium.speed && P.medium.speed < P.hard.speed && P.easy.errorRate > P.medium.errorRate && P.medium.errorRate > P.hard.errorRate && P.easy.whiffRate > P.hard.whiffRate);
    const reachRate = (d: "easy" | "medium" | "hard") => {
      const r = seededRng(`reach-${d}`);
      let reached = 0;
      for (let i = 0; i < 120; i++) {
        const ball = { x: (r() - 0.5) * 1.4, y: 1, z: PP.PLAYER_PADDLE_Z, vx: 0, vy: 0, vz: -5, spin: 0, side: 0 };
        Object.assign(ball, PP.playerReturn(ball, { x: ball.x + (r() - 0.5) * 0.25, y: 1, vx: (r() - 0.5) * 3, vy: r() * 2.5 }).shot);
        const brain = PA.newBrain();
        for (let t = 0; t < 3; t += PP.STEP) {
          const pz = ball.z;
          if (PP.stepBall(ball, PP.STEP).some((ev) => ev.type === "floor")) break;
          PA.aiThink(brain, ball, true, P[d], PP.STEP, r);
          if (pz > PP.RIVAL_PADDLE_Z && ball.z <= PP.RIVAL_PADDLE_Z) {
            if (PA.aiCanReach(brain, ball, P[d])) reached++;
            break;
          }
        }
      }
      return reached / 120;
    };
    const rates = PA.DIFFICULTIES.map(reachRate);
    check("rivals: the hard one gets to more of the same shots than medium, medium more than easy", rates[0] < rates[1] && rates[1] < rates[2], rates.join(" "));
    const aiShot = PA.aiReturn({ x: 0, y: 1, z: PP.RIVAL_PADDLE_Z, vx: 0, vy: 0, vz: -5, spin: 0, side: 0 }, { ...P.hard, errorRate: 0 }, seededRng(4));
    const aiLand = PP.landingPoint({ x: 0, y: 1, z: PP.RIVAL_PADDLE_Z, ...aiShot.shot });
    check("a rival's clean return lands on your half", !aiShot.mistake && aiLand !== null && aiLand.z > 0 && aiLand.z < PP.HALF_L && Math.abs(aiLand.x) < PP.HALF_W);

    // --- Medals and Focus for these games ---
    realmStore.replace(createEmptyState());
    realmStore.set((x) => ({ ...x, progress: { ...x.progress, focus: 2 } }));
    check("archery and ping pong can't start without the Focus", PG.startPlay(AR.GAME_IDS.practice) === false && PG.startPlay("pingpong-easy") === false && realmStore.get().progress.focus === 2);
    realmStore.set((x) => ({ ...x, progress: { ...x.progress, focus: 20 } }));
    check("starting a round pays its Focus", PG.startPlay(AR.GAME_IDS.quiz) && realmStore.get().progress.focus === 20 - PG.PLAY_COST);
    const practiceGold = PG.finishPlay(AR.GAME_IDS.practice, 152, { higherIsBetter: true, medals: AR.PRACTICE_MEDALS });
    const practiceNone = PG.finishPlay(AR.GAME_IDS.practice, 60, { higherIsBetter: true, medals: AR.PRACTICE_MEDALS });
    check("archery-practice: 152/180 is gold, 60 is no medal, the best is kept", practiceGold.medal === "gold" && practiceNone.medal === null && practiceNone.best === 152 && realmStore.get().progress.games["archery-practice"]?.plays === 2);
    const quizSilver = PG.finishPlay(AR.GAME_IDS.quiz, 1500, { higherIsBetter: true, medals: AR.QUIZ_MEDALS });
    check("archery-quiz: 1,500 points is silver", quizSilver.medal === "silver" && quizSilver.coins === PG.MEDAL_COINS.silver);
    const ppWin = PG.finishPlay("pingpong-hard", PR.matchRating(11, 3, 11), { higherIsBetter: true, medals: PR.MATCH_MEDALS });
    const ppNarrow = PG.finishPlay("pingpong-medium", PR.matchRating(12, 10, 11), { higherIsBetter: true, medals: PR.MATCH_MEDALS });
    const ppLoss = PG.finishPlay("pingpong-easy", PR.matchRating(9, 11, 11), { higherIsBetter: true, medals: PR.MATCH_MEDALS });
    check("pingpong-<difficulty>: winning 11-3 is gold, a narrow win bronze, a loss no medal", ppWin.medal === "gold" && ppNarrow.medal === "bronze" && ppLoss.medal === null && !!realmStore.get().progress.games["pingpong-hard"] && !!realmStore.get().progress.games["pingpong-easy"]);
    check("ping pong silver needs a 5-point win at 11 (3 at 7)", PR.matchRating(11, 6, 11) >= PR.MATCH_MEDALS[1] && PR.matchRating(11, 7, 11) < PR.MATCH_MEDALS[1] && PR.matchRating(7, 4, 7) >= PR.MATCH_MEDALS[1] && PR.matchRating(7, 5, 7) < PR.MATCH_MEDALS[1]);
    realmStore.replace(createEmptyState());
  } catch (error) {
    check("archery and ping pong checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log("\n=== 21. PowerPoint text extraction ===");
  try {
    const pptx = await makePptx([
      ["ppt/slides/slide2.xml", "<p:sld><a:p><a:r><a:t>Second slide &amp; more</a:t></a:r></a:p></p:sld>"],
      ["ppt/slides/slide1.xml", "<p:sld><a:p><a:r><a:t>Personas</a:t></a:r><a:r><a:t> and scenarios</a:t></a:r></a:p><a:p><a:r><a:t>Goals</a:t></a:r></a:p></p:sld>"],
      ["ppt/notesSlides/notesSlide1.xml", "<p:notes><a:p><a:r><a:t>Remember empathy maps</a:t></a:r></a:p></p:notes>"],
    ]);
    const text = await extractPptxText(pptx);
    check("slide text is read in slide order", text.includes("Personas and scenarios") && text.indexOf("Personas") < text.indexOf("Second slide & more"), text);
    check("paragraphs stay on their own lines", text.includes("Personas and scenarios\nGoals"));
    check("speaker notes are included", text.includes("Notes: Remember empathy maps"));
  } catch (error) {
    check("pptx extraction ran", false, error instanceof Error ? error.message : String(error));
  }

  console.log("\n=== 41. Assessment feedback endpoint (mocked SDK, no live calls) ===");
  try {
    const AF = await import("../src/server/realm/assessmentFeedback");
    const draft = "This report argues that usability testing should start early. ".repeat(12);
    const req = AF.validateFeedbackRequest({ subject: "CSE2UI", title: "Report", brief: "Evaluate a design.", rubric: [{ name: "Analysis", weight: 40, levels: ["HD: deep", "P: basic"] }, null, { name: "" }], draft: draft + "x".repeat(50_000) });
    check("feedback requests are cleaned and the draft is capped", req.rubric.length === 1 && req.rubric[0].weight === 40 && req.draft.length === AF.MAX_DRAFT_CHARS);
    let threw = false;
    try {
      AF.validateFeedbackRequest({ brief: "x", draft: "too short" });
    } catch (e) {
      threw = e instanceof CurriculumError && e.category === "invalid-request";
    }
    check("a tiny draft is rejected", threw);
    const noKey = await AF.assessmentFeedback(req, { configured: () => false, makeClient: () => { throw new Error("must not call"); } });
    check("no key gives ok:false no-key without calling Claude", !noKey.ok && noKey.reason === "no-key");
    let sent: { model?: string; system?: string } = {};
    const reply = { criteria: [{ name: "Analysis", likelyLevel: "D", evidence: "\"start early\"", improve: "Compare two methods — with data." }], rangeLow: 74, rangeHigh: 66, topFixes: ["a", "b", "c", "d"], note: "Draft only." };
    const fake = { beta: { messages: { stream: (params: { model: string; system: string }) => { sent = params; return { finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] }) }; } } } };
    const result = await AF.assessmentFeedback(req, { configured: () => true, makeClient: () => fake as never });
    check("the mocked call uses the project model and the no-rewrite prompt", sent.model === "claude-opus-5-5" && (sent.system ?? "").includes("Never write, rewrite"));
    check("feedback comes back ordered, capped and without em dashes", result.ok && result.feedback.rangeLow === 66 && result.feedback.rangeHigh === 74 && result.feedback.topFixes.length === 3 && !result.feedback.criteria[0].improve.includes("—") && result.note === "Draft only.", JSON.stringify(result));
  } catch (error) {
    check("assessment feedback checks ran", false, error instanceof Error ? error.stack : String(error));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

void main();
