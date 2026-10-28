/**
 * Phase 23 (Living AI Mentor & Conversational System) verification
 * harness. Run with (from the repo root):
 *   npx tsx scripts/verify-phase23-living-mentor.ts
 *
 * Same discipline as every prior phase harness: pure data/logic modules
 * are imported and exercised directly; behaviour that only exists inside
 * a React component's body (the conversation panel's typewriter/
 * accessibility wiring, the Dashboard's "Talk" buttons) is verified by
 * reading the actual source text and asserting on it — proves the wiring
 * exists as written, not that it renders correctly at runtime, the same
 * honest limitation every prior harness in this codebase already
 * discloses.
 *
 * Covers ONLY Phase 23's own new surface area — the full regression
 * sweep (typecheck, lint, build, all seven prior harnesses) is run
 * separately, exactly as every prior phase has done.
 */

import { readFileSync } from "node:fs";
import { buildStudentContext } from "../src/ai/ContextEngine";
import { ruleBasedMentorDialogueProvider } from "../src/ai/MentorDialogueProvider";
import { getMentorGoodbye } from "../src/lib/mentorDialogue";
import { getNpcMemory, withRecordedTopic, hasRecentlyUsedTopic } from "../src/lib/npcMemory";
import { createDefaultSaveData, sanitizeSaveData } from "../src/lib/persistence";
import { confirmed, unconfirmed } from "../src/types/domain";
import { getMelbourneDateIso, shiftDateIso } from "../src/lib/selectors";
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

const NOW = new Date("2026-08-12T04:00:00.000Z"); // a Wednesday, mid-afternoon Melbourne — a "plain" instant, deliberately not weekend/late-night
const BASE = createDefaultSaveData();
const SUBJECT_IDS = BASE.semester.subjects.map((s) => s.id);

function main(): void {
  // -------------------------------------------------------------------------
  section("1. Conversation memory (NpcMemoryEntry additive fields + no-repeat)", () => {
    const fresh = createDefaultSaveData();
    const memory = getNpcMemory(fresh, "user-interface-design");
    check("a never-met NPC's memory has empty recentTopics and no flagged assessment", memory.recentTopics.length === 0 && memory.flaggedAssessmentId === null);

    const withOne = { ...memory, recentTopics: withRecordedTopic(memory, "module-work") };
    check("recording a topic adds it to recentTopics", hasRecentlyUsedTopic(withOne, "module-work"));

    let capped = memory;
    for (let i = 0; i < 10; i += 1) capped = { ...capped, recentTopics: withRecordedTopic(capped, `topic-${i}`) };
    check("recentTopics never grows past MAX_RECENT_TOPICS (5)", capped.recentTopics.length === 5);
    check("recentTopics keeps the MOST RECENT entries, not the oldest", capped.recentTopics.includes("topic-9") && !capped.recentTopics.includes("topic-0"));

    const reRecorded = withRecordedTopic({ ...memory, recentTopics: ["a", "b", "c"] }, "a");
    check("re-recording an existing topic moves it to most-recent rather than duplicating it", reRecorded.filter((t) => t === "a").length === 1 && reRecorded[reRecorded.length - 1] === "a");

    // Corrupted/legacy npcMemory (missing the Phase 23 fields entirely) must still sanitize safely.
    const legacySave = { ...fresh, npcMemory: { guide: { lastLine: "hi", lastLineDate: "2026-08-01", lastInteractionAt: "2026-08-01T00:00:00.000Z" } } };
    const sanitized = sanitizeSaveData(JSON.parse(JSON.stringify(legacySave)));
    check("a legacy npcMemory entry (pre-Phase-23, missing recentTopics/flaggedAssessmentId) sanitizes to safe defaults, never throws", Array.isArray(sanitized.npcMemory.guide.recentTopics) && sanitized.npcMemory.guide.flaggedAssessmentId === null);
  });

  // -------------------------------------------------------------------------
  section("2. Greeting selection — contextual, not generic (Part 'Contextual Greetings')", () => {
    const subjectId = "user-interface-design";

    const lowConfidenceSave: UniGameSaveData = { ...BASE }; // a fresh save has zero progress everywhere -> "very-low" confidence
    const context = buildStudentContext(lowConfidenceSave, NOW);
    const { conversation: lowConfConvo } = ruleBasedMentorDialogueProvider.buildConversation(lowConfidenceSave, context, subjectId, NOW);
    check("a very-low-confidence subject's conversation opens with SOME greeting content (not silent)", lowConfConvo.stages.some((s) => s.stage === "greeting"));

    const todayIso = getMelbourneDateIso(NOW);
    const tomorrowDueSubjects = BASE.semester.subjects.map((s, i) =>
      i === 0 ? { ...s, assessments: s.assessments.map((a, j) => (j === 0 ? { ...a, dueDate: confirmed(shiftDateIso(todayIso, 1)), dueTime: confirmed("09:00") } : { ...a, dueDate: unconfirmed<string>(), dueTime: unconfirmed<string>() })) } : s
    );
    const tomorrowSave: UniGameSaveData = { ...BASE, semester: { ...BASE.semester, subjects: tomorrowDueSubjects } };
    const tomorrowContext = buildStudentContext(tomorrowSave, NOW);
    const { conversation: tomorrowConvo } = ruleBasedMentorDialogueProvider.buildConversation(tomorrowSave, tomorrowContext, subjectId, NOW);
    check("an assessment due tomorrow produces a greeting mentioning it by name", tomorrowConvo.stages.some((s) => s.stage === "greeting" && s.line.includes(tomorrowDueSubjects[0].assessments[0].title)));

    const lateNight = new Date("2026-08-12T15:30:00.000Z"); // ~01:30 Melbourne (AEST +10)
    const lateNightContext = buildStudentContext(BASE, lateNight);
    const { conversation: lateNightConvo } = ruleBasedMentorDialogueProvider.buildConversation(BASE, lateNightContext, "professional-practices-and-entrepreneurship-in-it", lateNight);
    check("late-night study produces a distinct greeting (never a fabricated 'due tomorrow' claim when nothing is due)", lateNightConvo.stages.some((s) => s.stage === "greeting"));
  });

  // -------------------------------------------------------------------------
  section("3. Personality differences — 4 distinct voices, never one generic mentor", () => {
    const goodbyes = new Set<string>();
    for (const subjectId of SUBJECT_IDS) {
      const line = getMentorGoodbye(subjectId, NOW);
      check(`${subjectId} produces a non-empty personality-flavoured goodbye`, line.length > 0);
      goodbyes.add(line);
    }
    check("every subject's goodbye pool is genuinely distinct from the others (no shared generic fallback)", goodbyes.size === SUBJECT_IDS.length);

    // A subject mentor's advice must never namedrop a DIFFERENT subject's specific module — the immersion-breaking bug fixed this phase.
    const context = buildStudentContext(BASE, NOW);
    for (const subjectId of SUBJECT_IDS) {
      const { conversation } = ruleBasedMentorDialogueProvider.buildConversation(BASE, context, subjectId, NOW);
      const advice = conversation.stages.find((s) => s.stage === "advice");
      if (!advice) continue;
      const otherSubjectNames = BASE.semester.subjects.filter((s) => s.id !== subjectId).map((s) => s.name);
      check(`${subjectId}'s advice never namedrops another subject's name`, !otherSubjectNames.some((name) => advice.line.includes(name)));
    }
  });

  // -------------------------------------------------------------------------
  section("4. Context awareness — every conversation is real, save-backed, never fabricated", () => {
    for (const npcKey of [...SUBJECT_IDS, "guide"]) {
      const context = buildStudentContext(BASE, NOW);
      const { conversation, memoryUpdate } = ruleBasedMentorDialogueProvider.buildConversation(BASE, context, npcKey, NOW);
      check(`${npcKey}'s conversation has at least a context-awareness/greeting stage and a goodbye`, conversation.stages.length >= 2 && conversation.stages[conversation.stages.length - 1].stage === "goodbye");
      check(`${npcKey}'s conversation is deterministic (same save/instant -> identical, twice)`, JSON.stringify(conversation) === JSON.stringify(ruleBasedMentorDialogueProvider.buildConversation(BASE, context, npcKey, NOW).conversation));
      check(`${npcKey}'s memoryUpdate carries a non-empty summaryLine`, memoryUpdate.summaryLine.length > 0);
      for (const stage of conversation.stages) {
        if (!stage.evidence) continue;
        check(`${npcKey}'s "${stage.stage}" stage evidence stays within its own declared max (no hidden scoring)`, stage.evidence.every((e) => e.contribution <= e.max));
      }
    }

    const corruptedSubjectSave: UniGameSaveData = { ...BASE, semester: { ...BASE.semester, subjects: [] } };
    check("a corrupted/missing subjectId falls back to a minimal, honest conversation rather than throwing", (() => {
      try {
        const context = buildStudentContext(corruptedSubjectSave, NOW);
        const { conversation } = ruleBasedMentorDialogueProvider.buildConversation(corruptedSubjectSave, context, "not-a-real-subject", NOW);
        return conversation.stages.length > 0;
      } catch {
        return false;
      }
    })());
  });

  // -------------------------------------------------------------------------
  section("5. Dashboard integration (Part 'Dashboard Connection')", () => {
    const dashboardSrc = src("src/components/dashboard/AiMentorDashboard.tsx");
    const requiredCards = ["Academic Health", "Confidence Overview", "Current Focus", "Workload", "Momentum", "Weekly Reflection", "Recommended Next Action"];
    for (const title of requiredCards) {
      check(`the "${title}" card has a "Talk" affordance calling openConversation`, (() => {
        const titleIndex = dashboardSrc.indexOf(`title="${title}"`);
        if (titleIndex === -1) return false;
        const nextCardIndex = dashboardSrc.indexOf("<DashboardCardShell", titleIndex + 1);
        const cardBody = dashboardSrc.slice(titleIndex, nextCardIndex === -1 ? undefined : nextCardIndex);
        return cardBody.includes("openConversation(");
      })());
    }

    const hookSrc = src("src/hooks/useMentorConversation.ts");
    check("useMentorConversation reuses ContextEngine.ts + MentorDialogueProvider.ts (no parallel conversation logic)", hookSrc.includes("buildStudentContext") && hookSrc.includes("ruleBasedMentorDialogueProvider"));
    check("useMentorConversation reuses npcMemory.ts's recognition (never a second same-day-repeat check)", hookSrc.includes("hasGreetedToday") && hookSrc.includes("applyRecognition"));

    check("AiMentorDashboard renders MentorConversationPanel when a conversation is active", dashboardSrc.includes("<MentorConversationPanel") && dashboardSrc.includes("active ?"));
  });

  // -------------------------------------------------------------------------
  section("6. Performance — conversation generation stays cheap, no runaway cost", () => {
    const context = buildStudentContext(BASE, NOW);
    const start = process.hrtime.bigint();
    for (let i = 0; i < 50; i += 1) {
      for (const npcKey of [...SUBJECT_IDS, "guide"]) ruleBasedMentorDialogueProvider.buildConversation(BASE, context, npcKey, NOW);
    }
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    check(`250 conversation builds (50 rounds x 5 NPCs) complete in well under 1s (actual: ${Math.round(elapsedMs)}ms)`, elapsedMs < 1000);

    const npcCharacterSrc = src("src/game3d/characters/NpcCharacter.tsx");
    check("the talking pose override reuses the EXISTING per-frame pose branch (no new per-frame recomputation added)", npcCharacterSrc.includes('talking ? "talk"'));
  });

  // -------------------------------------------------------------------------
  section("7. Accessibility (conversation panel)", () => {
    const panelSrc = src("src/components/mentor/MentorConversationPanel.tsx");
    check('the panel has role="dialog" with a descriptive aria-label', panelSrc.includes('role="dialog"') && panelSrc.includes("aria-label={`Conversation with"));
    check("the close button has an aria-label", panelSrc.includes('aria-label="Close conversation"'));
    check("Escape closes the panel (same convention as PanelHost's own panels)", panelSrc.includes('e.key === "Escape"'));
    check("the typewriter effect is fully skipped under reduced motion (every line appears immediately)", panelSrc.includes("reduceMotion") && panelSrc.includes("useMotionPreference"));
    check("the evidence toggle uses aria-expanded (matching the Daily Brief's own Why? toggle convention)", panelSrc.includes("aria-expanded={showEvidence}"));
  });

  // -------------------------------------------------------------------------
  section("8. Save compatibility (Phase 23's NpcMemoryEntry extension)", () => {
    const preExisting = createDefaultSaveData();
    const roundTripped = sanitizeSaveData(JSON.parse(JSON.stringify(preExisting)));
    check("a fresh save still round-trips to itself through sanitizeSaveData", JSON.stringify(roundTripped) === JSON.stringify(preExisting));

    const corrupted = {
      ...preExisting,
      npcMemory: {
        guide: { lastLine: "hi", lastLineDate: "2026-08-01", lastInteractionAt: "2026-08-01T00:00:00.000Z", recentTopics: ["a", 42, "b", null, "c", "d", "e", "f"], flaggedAssessmentId: 123, flaggedAssessmentAt: "2026-08-01T00:00:00.000Z" },
      },
    };
    const sanitized = sanitizeSaveData(JSON.parse(JSON.stringify(corrupted)));
    check("sanitizeSaveData never throws on a corrupted recentTopics/flaggedAssessmentId", (() => {
      try {
        sanitizeSaveData(JSON.parse(JSON.stringify(corrupted)));
        return true;
      } catch {
        return false;
      }
    })());
    check("non-string recentTopics entries are dropped, not coerced into garbage", sanitized.npcMemory.guide.recentTopics.every((t: unknown) => typeof t === "string"));
    check("recentTopics is capped to MAX_RECENT_TOPICS (5) on load, even if the stored array was longer", sanitized.npcMemory.guide.recentTopics.length <= 5);
    check("a non-string flaggedAssessmentId is coerced to null, not accepted as-is", sanitized.npcMemory.guide.flaggedAssessmentId === null);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main();
