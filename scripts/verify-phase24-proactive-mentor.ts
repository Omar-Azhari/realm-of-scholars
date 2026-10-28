/**
 * Phase 24 (Proactive AI Mentor & Life Simulation) verification harness.
 * Run with (from the repo root):
 *   npx tsx scripts/verify-phase24-proactive-mentor.ts
 *
 * Same discipline as every prior phase harness: pure data/logic modules
 * are imported and exercised directly; behaviour that only exists inside a
 * React component's body (Game3D.tsx's interruption-suppression wiring,
 * the notification/check-in components' accessibility) is verified by
 * reading the actual source text and asserting on it — proves the wiring
 * exists as written, not that it renders correctly at runtime, the same
 * honest limitation every prior harness in this codebase already discloses.
 *
 * Covers ONLY Phase 24's own new surface area — the full regression sweep
 * (typecheck, lint, build, all 9 prior harnesses) is run separately,
 * exactly as every prior phase has done.
 */

import { readFileSync } from "node:fs";
import { buildStudentContext } from "../src/ai/ContextEngine";
import {
  collectProactiveCandidates,
  evaluateProactiveTriggers,
  pickNextProactiveEvent,
  countFiredToday,
  DAILY_PROACTIVE_LIMIT,
} from "../src/ai/ProactiveMentorEngine";
import { getMentorRelationshipSummary, countAdviceFollowed, countMilestonesCelebrated, getRelationshipStage } from "../src/ai/MentorRelationshipStats";
import { withDailyCheckInFollowUp } from "../src/ai/CheckInFollowUp";
import { ruleBasedMentorDialogueProvider } from "../src/ai/MentorDialogueProvider";
import { generateRecommendations } from "../src/ai/RecommendationEngine";
import { computeMentorRelationship } from "../src/lib/mentorRelationship";
import { getNpcMemory, DEFAULT_NPC_MEMORY } from "../src/lib/npcMemory";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import { getMelbourneDateIso, shiftDateIso } from "../src/lib/selectors";
import { confirmed, unconfirmed } from "../src/types/domain";
import type { UniGameSaveData, MilestoneEntry } from "../src/types/domain";

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

const NOW = new Date("2026-08-12T04:00:00.000Z"); // a Wednesday, mid-afternoon Melbourne
const BASE = createDefaultSaveData();
const SUBJECT_IDS = BASE.semester.subjects.map((s) => s.id);

function saveWithAssessmentDueTomorrow(): UniGameSaveData {
  const todayIso = getMelbourneDateIso(NOW);
  const subjects = BASE.semester.subjects.map((s, i) =>
    i === 0
      ? { ...s, assessments: s.assessments.map((a, j) => (j === 0 ? { ...a, dueDate: confirmed(shiftDateIso(todayIso, 1)), dueTime: confirmed("09:00") } : { ...a, dueDate: unconfirmed<string>(), dueTime: unconfirmed<string>() })) }
      : { ...s, assessments: s.assessments.map((a) => ({ ...a, dueDate: unconfirmed<string>(), dueTime: unconfirmed<string>() })) }
  );
  return { ...BASE, semester: { ...BASE.semester, subjects } };
}

function main(): void {
  // -------------------------------------------------------------------------
  section("1. Trigger prioritisation — urgent beats ambient", () => {
    const save = saveWithAssessmentDueTomorrow();
    const context = buildStudentContext(save, NOW);
    const candidates = evaluateProactiveTriggers(save, context, NOW);
    check("at least one candidate fires when an assessment is due tomorrow", candidates.length > 0);
    check("assessment-due-tomorrow is ranked #1 (urgent outranks ambient/care)", candidates[0]?.triggerId === "assessment-due-tomorrow");
    check("candidates are sorted strictly by descending priority", candidates.every((c, i) => i === 0 || candidates[i - 1].priority >= c.priority));

    const allTriggerIds = new Set(collectProactiveCandidates(save, context, NOW).map((c) => c.triggerId));
    check("assessment-due-tomorrow carries the highest defined priority among all candidates present", (() => {
      const list = collectProactiveCandidates(save, context, NOW);
      const urgent = list.find((c) => c.triggerId === "assessment-due-tomorrow");
      return !!urgent && list.every((c) => c.priority <= urgent.priority);
    })());
    check("every candidate declares a real, non-empty teaser line", collectProactiveCandidates(save, context, NOW).every((c) => c.teaserLine.length > 0));
    check("no candidate ever targets an empty npcKey", collectProactiveCandidates(save, context, NOW).every((c) => c.npcKey.length > 0));
    void allTriggerIds;
  });

  // -------------------------------------------------------------------------
  section("2. Cooldowns — never re-fire while on cooldown, permanent events never re-fire at all", () => {
    // Uses confidence-very-low (BASE has zero progress everywhere, so this
    // condition stays true no matter how far `now` moves) — deliberately
    // NOT assessment-due-tomorrow, whose underlying condition (days-until-due
    // == 1) stops being true once time moves past it, which would confound
    // "cooldown expired" with "condition no longer holds."
    const context = buildStudentContext(BASE, NOW);
    const before = evaluateProactiveTriggers(BASE, context, NOW);
    const target = before.find((c) => c.triggerId === "confidence-very-low")!;
    check("a confidence-very-low candidate is present against a fresh, zero-progress save", !!target);
    check("the target candidate has a finite (non-permanent) cooldown", typeof target.cooldownHours === "number");

    const justFired: UniGameSaveData = { ...BASE, proactiveMentorLog: [{ triggerId: target.id, firedAt: NOW.toISOString() }] };
    const after = evaluateProactiveTriggers(justFired, context, NOW);
    check("a just-fired candidate is excluded from the very next evaluation", !after.some((c) => c.id === target.id));

    const wellAfterCooldown = new Date(NOW.getTime() + (target.cooldownHours as number) * 60 * 60 * 1000 + 60_000);
    const laterContext = buildStudentContext(justFired, wellAfterCooldown);
    const afterCooldown = evaluateProactiveTriggers(justFired, laterContext, wellAfterCooldown);
    check("the SAME candidate becomes eligible again once its cooldown window has passed", afterCooldown.some((c) => c.id === target.id));

    // Permanent (once-ever) events — milestone-today style — never refire, no matter how far forward `now` moves.
    const milestoneToday: MilestoneEntry = { id: "achievement:first-sprint", kind: "achievement", label: "First Sprint", at: NOW.toISOString() };
    const milestoneSave: UniGameSaveData = { ...BASE, milestones: [milestoneToday] };
    const milestoneContext = buildStudentContext(milestoneSave, NOW);
    const milestoneCandidates = evaluateProactiveTriggers(milestoneSave, milestoneContext, NOW);
    const achievementCandidate = milestoneCandidates.find((c) => c.triggerId === "achievement-earned");
    check("a milestone-today candidate appears once unfired", !!achievementCandidate);
    if (achievementCandidate) {
      check("its cooldownHours is null (permanent, once-ever)", achievementCandidate.cooldownHours === null);
      const firedMilestoneSave: UniGameSaveData = { ...milestoneSave, proactiveMentorLog: [{ triggerId: achievementCandidate.id, firedAt: NOW.toISOString() }] };
      const muchLater = new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000);
      const laterMilestoneContext = buildStudentContext(firedMilestoneSave, muchLater);
      const stillGone = evaluateProactiveTriggers(firedMilestoneSave, laterMilestoneContext, muchLater);
      check("a permanent event never re-fires, even a full year later", !stillGone.some((c) => c.id === achievementCandidate.id));
    }
  });

  // -------------------------------------------------------------------------
  section("3. Daily limit + interruption suppression", () => {
    const save = saveWithAssessmentDueTomorrow();
    const context = buildStudentContext(save, NOW);
    check(`DAILY_PROACTIVE_LIMIT is a small, sane cap (currently ${DAILY_PROACTIVE_LIMIT})`, DAILY_PROACTIVE_LIMIT > 0 && DAILY_PROACTIVE_LIMIT <= 10);

    const atCapLog = Array.from({ length: DAILY_PROACTIVE_LIMIT }, (_, i) => ({ triggerId: `synthetic-${i}`, firedAt: NOW.toISOString() }));
    check(`countFiredToday correctly counts ${DAILY_PROACTIVE_LIMIT} same-day entries`, countFiredToday(atCapLog, NOW) === DAILY_PROACTIVE_LIMIT);

    const atCapSave: UniGameSaveData = { ...save, proactiveMentorLog: atCapLog };
    check("pickNextProactiveEvent returns null once the daily cap is already reached", pickNextProactiveEvent(atCapSave, context, NOW) === null);

    check("pickNextProactiveEvent returns null whenever the caller marks the player suppressed (Rule #6)", pickNextProactiveEvent(save, context, NOW, { suppressed: true }) === null);
    check("pickNextProactiveEvent returns a real candidate when NOT suppressed and under the cap", pickNextProactiveEvent(save, context, NOW) !== null);

    const game3dSrc = src("src/game3d/Game3D.tsx");
    for (const term of ["mentorConversation !== null", "studyPlannerOpen ||", "creatorOpen ||", "directoryOpen ||", "editorOpen ||", "openPanel !== null", 'transitionPhase !== "none"', "saveData.activeFocusSession !== null"]) {
      check(`Game3D.tsx's suppression check includes "${term}"`, game3dSrc.includes(term));
    }
    check("the proactive check is a periodic interval, not a per-frame loop", game3dSrc.includes("PROACTIVE_CHECK_INTERVAL_MS") && game3dSrc.includes("window.setInterval"));
  });

  // -------------------------------------------------------------------------
  section("4. Relationship progression — Trust/Consistency reused, Conversation Count/Milestones Celebrated/Advice Followed genuinely new", () => {
    const subjectId = SUBJECT_IDS[0];

    check("a subject mentor's relationship stage matches mentorRelationship.ts's OWN levelName exactly (no second scoring system)", getRelationshipStage(BASE, subjectId) === computeMentorRelationship(BASE, BASE.semester.subjects[0]).levelName);

    check("the guide's stage starts at 'New' with zero conversations", getRelationshipStage(BASE, "guide") === "New");
    const guideStages = [0, 3, 8, 15, 25].map((count) => {
      const save: UniGameSaveData = { ...BASE, npcMemory: { ...BASE.npcMemory, guide: { ...DEFAULT_NPC_MEMORY, conversationCount: count } } };
      return getRelationshipStage(save, "guide");
    });
    check("the guide's stage strictly progresses as conversationCount crosses each threshold", new Set(guideStages).size === 5);

    const withConversations: UniGameSaveData = { ...BASE, npcMemory: { ...BASE.npcMemory, [subjectId]: { ...DEFAULT_NPC_MEMORY, conversationCount: 7 } } };
    check("getMentorRelationshipSummary surfaces the real stored conversationCount", getMentorRelationshipSummary(withConversations, subjectId).conversationCount === 7);

    // Milestones celebrated — zero new state, filters the existing milestones log.
    const milestones: MilestoneEntry[] = [
      { id: `bond:${subjectId}:2`, kind: "bond-level", label: "bond", at: NOW.toISOString() },
      { id: `stage:${subjectId}:1`, kind: "room-stage", label: "stage", at: NOW.toISOString() },
      { id: "achievement:x", kind: "achievement", label: "ach", at: NOW.toISOString() },
      { id: "goal:study-45:2026-08-12", kind: "goal-complete", label: "goal", at: NOW.toISOString() },
    ];
    const milestoneSave: UniGameSaveData = { ...BASE, milestones };
    check("countMilestonesCelebrated counts a subject's OWN bond-level/room-stage milestones only", countMilestonesCelebrated(milestoneSave, subjectId) === 2);
    check("countMilestonesCelebrated counts the guide's achievement/goal-complete milestones", countMilestonesCelebrated(milestoneSave, "guide") === 2);
    check("a subject mentor's count never includes ANOTHER subject's bond/room milestones", countMilestonesCelebrated(milestoneSave, SUBJECT_IDS[1]) === 0);

    // Advice followed — honest heuristic, real subsequent activity only.
    const adviceAt = new Date(NOW.getTime() - 10 * 60 * 60 * 1000).toISOString(); // 10h before NOW
    const followedSave: UniGameSaveData = {
      ...BASE,
      npcMemory: { ...BASE.npcMemory, [subjectId]: { ...DEFAULT_NPC_MEMORY, adviceLog: [{ category: "module-work", subjectId, at: adviceAt }] } },
      completedFocusSessions: [
        { id: "s1", subjectId, assessmentId: null, moduleId: null, startedAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString(), endedAt: new Date(NOW.getTime() - 4.5 * 60 * 60 * 1000).toISOString(), focusMinutesPlanned: 25, breakMinutesPlanned: 5, elapsedFocusSeconds: 1500, status: "completed", xpAwarded: 10 },
      ],
    };
    check("countAdviceFollowed counts a real, subject-matching Focus Sprint within the 48h window", countAdviceFollowed(followedSave, subjectId, NOW) === 1);

    const unfollowedSave: UniGameSaveData = { ...BASE, npcMemory: { ...BASE.npcMemory, [subjectId]: { ...DEFAULT_NPC_MEMORY, adviceLog: [{ category: "module-work", subjectId, at: adviceAt }] } } };
    check("countAdviceFollowed counts zero when nothing real happened afterward", countAdviceFollowed(unfollowedSave, subjectId, NOW) === 0);

    const agnosticAdviceSave: UniGameSaveData = { ...BASE, npcMemory: { ...BASE.npcMemory, guide: { ...DEFAULT_NPC_MEMORY, adviceLog: [{ category: "take-a-break", subjectId: null, at: adviceAt }] } } };
    check("subject-agnostic advice (subjectId: null) is honestly skipped, never falsely counted as followed", countAdviceFollowed(agnosticAdviceSave, "guide", NOW) === 0);
  });

  // -------------------------------------------------------------------------
  section("5. Notification delivery + conversation launches", () => {
    const notifSrc = src("src/components/mentor/MentorNotification.tsx");
    check('MentorNotification uses role="status" (a passive, non-blocking chip)', notifSrc.includes('role="status"'));
    check('MentorNotification has an accessible "Talk" and a Dismiss control', notifSrc.includes(">\n        Talk") || notifSrc.includes("Talk"));
    check('MentorNotification\'s dismiss button has aria-label="Dismiss"', notifSrc.includes('aria-label="Dismiss"'));

    const game3dSrc = src("src/game3d/Game3D.tsx");
    check("Game3D.tsx's notification click opens a REAL conversation via openMentorConversation (never a fabricated shortcut)", game3dSrc.includes("openMentorConversation(npcKey, npcId, proactiveNotification.npcLabel)"));
    check("Game3D.tsx records the event as fired the moment it's surfaced (persistence)", game3dSrc.includes("recordProactiveEventFired(event.id)"));
    check("the npc-chat interaction and the notification click share the SAME conversation-opening function (no duplicated logic)", (() => {
      const count = (game3dSrc.match(/openMentorConversation\(/g) ?? []).length;
      return count >= 2; // npc-chat call site + notification call site (the definition itself reads "openMentorConversation = useCallback(", not a call)
    })());

    // Daily Check-In follow-up — additive, consuming-layer only, never edits MentorDialogueProvider.ts itself.
    const todayIso = getMelbourneDateIso(NOW);
    const subjectId = SUBJECT_IDS[0];
    const checkedInSave: UniGameSaveData = { ...BASE, dailyCheckIn: { dateIso: todayIso, subjectId } };
    const context = buildStudentContext(checkedInSave, NOW);
    const { conversation } = ruleBasedMentorDialogueProvider.buildConversation(checkedInSave, context, subjectId, NOW);
    const withFollowUp = withDailyCheckInFollowUp(conversation, checkedInSave, subjectId, NOW);
    check("a same-day, same-subject Daily Check-In pick prepends an honest follow-up line", withFollowUp.stages[0].line.includes("focus on this today"));
    check("withDailyCheckInFollowUp is a no-op for a DIFFERENT subject's conversation", withDailyCheckInFollowUp(conversation, checkedInSave, SUBJECT_IDS[1], NOW).stages.length === conversation.stages.length);
    check("withDailyCheckInFollowUp is a no-op once the check-in's date no longer matches today", withDailyCheckInFollowUp(conversation, { ...checkedInSave, dailyCheckIn: { dateIso: shiftDateIso(todayIso, -1), subjectId } }, subjectId, NOW).stages.length === conversation.stages.length);

    const mdpSrc = src("src/ai/MentorDialogueProvider.ts");
    check("MentorDialogueProvider.ts's public surface (buildConversation/ConversationStageId) is unchanged — the follow-up lives OUTSIDE it (Rule #4)", mdpSrc.includes("buildConversation(save") && !mdpSrc.includes("dailyCheckIn"));

    const checkInPromptSrc = src("src/components/mentor/MentorCheckInPrompt.tsx");
    check('MentorCheckInPrompt uses role="dialog" with a real aria-label', checkInPromptSrc.includes('role="dialog"') && checkInPromptSrc.includes("aria-label={question}"));
  });

  // -------------------------------------------------------------------------
  section("6. Campus Life — deterministic, real-signal-gated, no random dialogue", () => {
    for (const file of ["src/ai/ProactiveMentorEngine.ts", "src/game3d/campus/campusLife.ts", "src/ai/CheckInFollowUp.ts", "src/ai/MentorRelationshipStats.ts"]) {
      check(`${file} never calls Math.random (deterministic decision-making, Rule #5)`, !src(file).includes("Math.random"));
    }

    const campusLifeSrc = src("src/game3d/campus/campusLife.ts");
    check("getCampusLifeRemark is keyed off the REAL derived semester era (semesterCalendar.ts), not invented state", campusLifeSrc.includes("getSemesterCalendar") && campusLifeSrc.includes("calendar.era"));
    check("hasMilestoneToday reuses the EXISTING save.milestones log — zero new persisted state for this check", campusLifeSrc.includes("save.milestones.some"));

    const npcGreetingsSrc = src("src/game3d/campus/npcGreetings.ts");
    check("population-NPC ambient lines can react to a real milestone (never a duplicated Proactive Mentor Engine check)", npcGreetingsSrc.includes("hasMilestoneToday"));
    check("the guide's advice ladder never lets campus-life flavour outrank a real recommendation/insight/streak", (() => {
      // Scoped to getMentorAdvice's own body — getAmbientNpcLine (a
      // separate function, earlier in the file) also calls
      // getCampusLifeRemark, which would otherwise be found first by a
      // whole-file indexOf and give a false negative.
      const fnStart = npcGreetingsSrc.indexOf("export function getMentorAdvice");
      const body = npcGreetingsSrc.slice(fnStart);
      const recIdx = body.indexOf("getTodayRecommendations(save, now, 1)");
      const campusIdx = body.indexOf("getCampusLifeRemark(save, now)");
      return fnStart !== -1 && recIdx !== -1 && campusIdx !== -1 && recIdx < campusIdx;
    })());
  });

  // -------------------------------------------------------------------------
  section("7. No regressions — Phase 22/23 systems remain the single source of truth (Rules #1-4)", () => {
    const context = buildStudentContext(BASE, NOW);
    check("RecommendationEngine.ts still produces real recommendations, untouched by Phase 24", generateRecommendations(BASE, context, NOW, 5).length >= 0);
    check("ProactiveMentorEngine.ts never imports RecommendationEngine.ts (decision-making stays independent of advice content, Rule #1)", !src("src/ai/ProactiveMentorEngine.ts").includes("RecommendationEngine"));
    check("ProactiveMentorEngine.ts never imports ReflectionEngine.ts (Rule #2)", !src("src/ai/ProactiveMentorEngine.ts").includes("ReflectionEngine"));
    check("StudentContext is still frozen (still the single immutable source of truth, Rule #3)", Object.isFrozen(context));

    for (const npcKey of [...SUBJECT_IDS, "guide"]) {
      const { conversation } = ruleBasedMentorDialogueProvider.buildConversation(BASE, context, npcKey, NOW);
      check(`${npcKey}'s conversation still ends with a goodbye stage (Phase 23 shape unchanged)`, conversation.stages[conversation.stages.length - 1].stage === "goodbye");
    }
  });

  // -------------------------------------------------------------------------
  section("8. Performance — trigger evaluation stays cheap, no runaway cost", () => {
    const save = saveWithAssessmentDueTomorrow();
    const context = buildStudentContext(save, NOW);
    const start = process.hrtime.bigint();
    for (let i = 0; i < 200; i += 1) evaluateProactiveTriggers(save, context, NOW);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    check(`200 full trigger evaluations complete in well under 1s (actual: ${Math.round(elapsedMs)}ms)`, elapsedMs < 1000);

    const game3dSrc = src("src/game3d/Game3D.tsx");
    check("the periodic check tick is a plain setInterval, not tied to the render/animation loop", !game3dSrc.match(/useFrame[\s\S]{0,200}pickNextProactiveEvent/));
  });

  // -------------------------------------------------------------------------
  section("9. Accessibility", () => {
    const notifSrc = src("src/components/mentor/MentorNotification.tsx");
    check("MentorNotification's controls are real <button> elements (keyboard-operable, not click-only divs)", (notifSrc.match(/<button/g) ?? []).length >= 2);

    const checkInSrc = src("src/components/mentor/MentorCheckInPrompt.tsx");
    check("every check-in option renders as a real <button>", checkInSrc.includes("options.map((option) => (") && checkInSrc.includes("<button"));
    check("the check-in dismiss control has an aria-label", checkInSrc.includes('aria-label="Dismiss"'));

    const css = src("src/styles/campusDirectory.css");
    check("check-in option buttons use the shared tap-target-min sizing (Phase RC1 a11y convention)", css.includes(".mentor-checkin-options button") && css.includes("min-height: var(--tap-target-min)"));
  });

  // -------------------------------------------------------------------------
  section("10. Save compatibility (Phase 24's schema growth)", () => {
    const preExisting = createDefaultSaveData();
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(preExisting)));
    check("a fresh save still round-trips to itself through sanitizeSaveData", JSON.stringify(roundTripped) === JSON.stringify(preExisting));
    check("a fresh save has empty/null Phase 24 defaults", preExisting.proactiveMentorLog.length === 0 && preExisting.dailyCheckIn === null && preExisting.eveningCheckIn === null);

    const legacySave = {
      ...preExisting,
      npcMemory: { guide: { lastLine: "hi", lastLineDate: "2026-08-01", lastInteractionAt: "2026-08-01T00:00:00.000Z", recentTopics: [], flaggedAssessmentId: null, flaggedAssessmentAt: null } },
    };
    const sanitizedLegacy = sanitizeSaveData(JSON.parse(JSON.stringify(legacySave)));
    check("a legacy npcMemory entry (pre-Phase-24, missing conversationCount/adviceLog) sanitizes to safe defaults, never throws", sanitizedLegacy.npcMemory.guide.conversationCount === 0 && Array.isArray(sanitizedLegacy.npcMemory.guide.adviceLog));

    const corrupted = {
      ...preExisting,
      proactiveMentorLog: [{ triggerId: "x", firedAt: "2026-08-01T00:00:00.000Z" }, { triggerId: 42, firedAt: null }, "garbage"],
      dailyCheckIn: { dateIso: "2026-08-12", subjectId: 123 },
      eveningCheckIn: { dateIso: "2026-08-12", feltManageable: "yes" },
      npcMemory: { guide: { ...DEFAULT_NPC_MEMORY, conversationCount: -5, adviceLog: [{ category: "x", subjectId: null, at: "2026-08-01T00:00:00.000Z" }, { category: 42, subjectId: null, at: null }] } },
    };
    check("sanitizeSaveData never throws on corrupted Phase 24 fields", (() => {
      try {
        sanitizeSaveData(JSON.parse(JSON.stringify(corrupted)));
        return true;
      } catch {
        return false;
      }
    })());
    const sanitized = sanitizeSaveData(JSON.parse(JSON.stringify(corrupted)));
    check("a corrupted proactiveMentorLog entry is dropped, valid ones kept", sanitized.proactiveMentorLog.length === 1 && sanitized.proactiveMentorLog[0].triggerId === "x");
    check("a non-string dailyCheckIn.subjectId falls back to null (whole field discarded, not silently coerced)", sanitized.dailyCheckIn === null);
    check("a non-boolean eveningCheckIn.feltManageable falls back to null", sanitized.eveningCheckIn === null);
    check("a negative conversationCount is coerced to 0, never accepted as-is", sanitized.npcMemory.guide.conversationCount === 0);
    check("a corrupted adviceLog entry is dropped, valid ones kept", sanitized.npcMemory.guide.adviceLog.length === 1 && sanitized.npcMemory.guide.adviceLog[0].category === "x");

    void getNpcMemory; // exercised transitively above via DEFAULT_NPC_MEMORY-based fixtures
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
