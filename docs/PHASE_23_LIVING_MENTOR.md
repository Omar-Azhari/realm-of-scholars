# Phase 23 — Living AI Mentor & Conversational System

Turns Phase 22's intelligence layer into something that feels like a
mentor rather than a dashboard. Every existing engine from Phases 21/22
(`ContextEngine`, `RecommendationEngine`, `ReflectionEngine`, `GoalSystem`,
`MentorPlanner`, the Dashboard) remains the single source of truth,
completely unchanged in this phase — Phase 23 only adds a conversation
layer on top of them, plus the small, additive memory/personality
extensions the audit (`docs/PHASE_23_AUDIT.md`) identified as genuinely
missing.

## 1. Architecture

```
src/ai/
  MentorDialogueProvider.ts   NEW — the conversation assembler + the
                              "future LLM" swap-in interface

src/hooks/
  useMentorConversation.ts    NEW — portable "open a conversation" hook,
                              used by both Game3D.tsx and the Dashboard

src/components/mentor/
  MentorConversationPanel.tsx NEW — the multi-stage, typewriter-effect panel
```

Everything else is an ADDITIVE edit to an existing file:

- `src/lib/mentorDialogue.ts` — the 4 authored voices (Iris/Cass/Mara/Theo)
  each gained one new pool, `goodbye`, plus an exported
  `getMentorGoodbye(subjectId, now)`. All 14 pre-existing categories are
  untouched.
- `src/types/domain.ts` / `src/lib/persistence.ts` /
  `src/state/SaveDataContext.tsx` — `NpcMemoryEntry` gained
  `recentTopics: string[]` and `flaggedAssessmentId`/`flaggedAssessmentAt`,
  with the same field-by-field safe-coercion discipline every prior
  additive save field already follows.
- `src/ai/MentorPlanner.ts` — `celebrateMessage`/`consistencyMessage`
  (already-existing private checks) were exported so
  `MentorDialogueProvider.ts` reuses them verbatim for the conversation's
  "encouragement" stage, rather than a second copy of the same logic.
- `src/game3d/characters/NpcCharacter.tsx` — a new `talking` prop, in the
  same override-chain shape Phase 21's `waving` prop already established.
- `src/game3d/Game3D.tsx` — the `npc-chat` case for subject mentors + the
  guide now opens a `MentorConversationPanel` instead of the old
  single-line `speechToast`; every OTHER NPC role (librarian, lab
  technician, etc.) is completely unchanged.
- `src/components/dashboard/AiMentorDashboard.tsx` — every card gained a
  "Talk to..." button.

## 2. Data flow

```
Player interacts with a subject mentor / guide
  (Game3D.tsx's npc-chat handler, OR a Dashboard "Talk" button)
                    │
                    ▼
      buildStudentContext(save, now)          ← Phase 22, unchanged
                    │
                    ▼
ruleBasedMentorDialogueProvider.buildConversation(save, context, npcKey, now)
                    │
        ┌───────────┼────────────┬─────────────┬──────────────┐
        ▼           ▼             ▼             ▼              ▼
   greeting   context-aware    advice      encouragement   reflection
  (new logic;  (getMentorLine/ (Recommend-  (MentorPlanner's (Reflection
   NpcMemory   getMentorAdvice, ationEngine,  exported        Engine,
   follow-up)  unchanged)       unchanged)   checks)          unchanged)
                                                               │
                                                          goodbye stage
                                                     (getMentorGoodbye, new)
                    │
                    ▼
   { conversation, memoryUpdate }  (pure — no mutation happens here)
                    │
                    ▼
  UI applies memoryUpdate via SaveDataContext:
    recordNpcInteraction(npcKey, summaryLine, topic)
    flagAssessmentStruggle(npcKey, flagAssessmentId)   (subjects only)
                    │
                    ▼
        <MentorConversationPanel> renders the stages,
        one at a time, with a typewriter reveal
```

`applyRecognition`/`hasGreetedToday` (Phase 21, unchanged) still gate the
WHOLE conversation the same way they gated the old single line: if this
NPC has already spoken today, the panel shows one short recognition line
instead of the full multi-stage conversation — "recognition, not a second
conversation," now applied to a richer thing.

## 3. Recommendation rules (unchanged, reused)

`RecommendationEngine.ts` was NOT touched this phase. The one genuinely
new rule lives entirely in `MentorDialogueProvider.ts`'s `findAdviceForSubject`:
**a subject mentor's advice stage never namedrops a DIFFERENT subject's
specific module/assessment.** If this subject has no recommendation of
its own in the ranked pool, the fallback is restricted to subject-agnostic
candidates (take-a-break/organise-room/visit-library — `subjectId: null`),
never another subject's item. This was a real bug caught while building
this phase (Theo, the Professional Practice mentor, was recommending "UI
Design's module" before the fix) — the fix is a filtering rule around the
EXISTING engine's output, not a new scoring system.

## 4. Confidence model (unchanged)

Not touched this phase — `ConfidenceModel.ts`'s 5-tier estimate is read
directly by the greeting stage (an "excellent"/"very-low" confidence
subject gets one of 4 small per-voice greeting templates) but never
recomputed.

## 5. Memory system

`NpcMemoryEntry` (additive):

```ts
interface NpcMemoryEntry {
  lastLine: string | null;          // Phase 21, unchanged
  lastLineDate: string | null;      // Phase 21, unchanged
  lastInteractionAt: string | null; // Phase 21, unchanged
  recentTopics: string[];           // NEW — capped at 5, most-recent-last
  flaggedAssessmentId: string | null;   // NEW
  flaggedAssessmentAt: string | null;   // NEW
}
```

- **`recentTopics`** — the advice stage's `RecommendationCategory` is
  folded in after each conversation (`withRecordedTopic`). The NEXT
  conversation's advice lookup (`findAdviceForSubject`) skips a
  recommendation whose category matches the LAST one shown, if a
  different real recommendation exists — "never repeat identical
  conversations" as an actual avoid-immediate-repeat rule, not just prose.
- **`flaggedAssessmentId`** — the honest version of "the mentor remembers
  a struggle and follows up." There is no free-text player input
  anywhere in this game, so the mentor can never literally be "told"
  anything. Instead: when a subject's real overdue/near-due assessment
  pressure is detected, that assessment's id is flagged. On a LATER
  visit, if that exact assessment's status has since changed to
  submitted/graded, the greeting opens with "How did '\<title\>' go?" —
  a real, save-backed callback, never a fabricated memory of a
  conversation that never happened.

## 6. Conversation lifecycle

Six possible stages, built in order, each OPTIONAL except goodbye (a
stage that has nothing real to say is simply omitted, never filled with
filler):

1. **Greeting** — a struggle follow-up (if flagged and now resolved), else
   one of: long-absence (delegated to `getMentorLine`'s own `welcomeBack`
   rung — never said twice), a goal completed today (delegated to
   `getMentorLine`'s `congrats`/`justCelebrated` rung), an assessment due
   tomorrow, a confidence extreme, a busy/quiet week (delegated to
   `getMentorLine`'s `busy`/`relaxed` rungs), late-night, or weekend.
2. **Context awareness** — `getMentorLine`'s full existing priority ladder
   (subject mentors) or `getMentorAdvice` (the guide) — unchanged.
3. **Advice** — `RecommendationEngine.ts`'s top pick for this subject (or,
   for the guide, campus-wide), phrased as `"{action} — {reason}"`.
4. **Encouragement** (optional) — `MentorPlanner.ts`'s `celebrateMessage`/
   `consistencyMessage`, reused verbatim.
5. **Reflection** (optional) — `ReflectionEngine.ts`'s first relevant
   statement (preferring one that names this subject).
6. **Goodbye** — a personality-flavoured sign-off (`getMentorGoodbye`) or
   one of 4 generic guide farewells.

## 7. Personality engine

Not a new system — Phase 21's 4 authored voices (Iris/Cass/Mara/Theo)
already had genuinely distinct vocabulary, tone, and humour across 14
categories each. Phase 23 adds exactly ONE new category per voice
(`goodbye`) and reuses the other 13 unchanged for the "context awareness"
stage via `getMentorLine`. A handful of NEW greeting variants
(assessment-due-tomorrow, confidence-extreme) use small, fixed,
per-subject-keyed phrasing maps (4 short strings each) rather than full
14-line pools — a deliberately smaller authoring investment than the
original voices, disclosed as a scope trade-off (see §9).

## 8. Future LLM integration

```ts
export interface MentorDialogueProvider {
  buildConversation(save, context, npcKey, now): { conversation: MentorConversation; memoryUpdate: ConversationMemoryUpdate };
}

export const ruleBasedMentorDialogueProvider: MentorDialogueProvider = { buildConversation(...) { ... } };
```

Every call site (`Game3D.tsx`, `useMentorConversation.ts`) calls
`ruleBasedMentorDialogueProvider.buildConversation(...)` through this
interface, never the rule-based implementation's internals directly. A
future LLM-backed provider — explicitly OUT of scope this phase, per the
brief's own "do NOT implement" list — would satisfy the same interface
(same input shape: `save`, `context`, `npcKey`, `now`; same output shape:
ordered stages + a memory update) and be swapped in at those two call
sites with zero UI changes, exactly as the brief's "Future AI Ready"
section asks for.

## 9. Known limitations / scope decisions

- **The legacy 2D `WorldScene.tsx`/`SubjectRoomScene` is untouched.** Its
  existing `talking`/`SpeechBubble` mechanism already solves "room
  presence" (immediate, synchronous, no loading) for that renderer;
  retrofitting a multi-stage conversation into it risked exactly what the
  brief forbids ("DO NOT rewrite existing systems"). All conversational
  depth targets the 3D Campus (every phase since 20A) plus the new,
  renderer-independent Dashboard entry point.
- **"Subtle facial reactions" are not implemented.** The character rig has
  no face mesh or expression blend shapes — building one would be a new
  art/animation system, not "building on top of existing architecture."
  Delivered instead: a `talking` pose override (reusing the exact
  `waving`-override precedent from Phase 21) and panel-level polish
  (typewriter reveal, stage fade-in).
- **The guide's `talking` pose is unreachable.** No interactable in
  Campus HQ's `TestRoomScene.tsx` currently produces a `role: "guide"`
  npc-chat action (confirmed in the audit) — this was already true before
  Phase 23, so the guide's conversation is only reachable via the
  Dashboard's "Talk to the guide" buttons, never in-world.
- **New greeting variants use small fixed phrasing maps, not full voice
  pools.** Authoring 4 full ~4-line pools for every new greeting context
  (assessment-tomorrow, confidence-high, confidence-low, late-night,
  weekend) would roughly double the size of `mentorDialogue.ts`; the
  smaller, still-genuinely-personal 1-line-per-subject approach was
  chosen to keep this phase's scope proportionate.
- **Live browser verification** was not possible this session (the
  browser preview could not be reached); confidence instead comes from a
  clean typecheck/lint/production build, the 1055-check regression sweep,
  and reuse of already-shipped, already-styled components/CSS variables
  throughout.

## 10. Performance considerations

- `buildConversation` is called on-demand (a click/keypress), never per
  frame — the harness's own benchmark shows 250 conversation builds
  (50 rounds × 5 NPCs) completing in ~280ms, i.e. ~1.1ms each.
- The `talking` pose override adds one more branch to a comparison
  `NpcCharacter.tsx` already re-evaluates every `SCHEDULE_THROTTLE_FRAMES`
  frames (Phase 20C's existing throttle) — no new per-frame work.
- The typewriter effect is a single `setInterval` scoped to whichever
  stage is currently visible, torn down on stage change/unmount, and
  fully skipped under reduced motion (every line appears instantly).
- `MentorConversationPanel` uses `position: fixed` specifically so it
  never triggers a reflow/repaint cost from being nested inside a
  scrolling container (the Dashboard's `.world-panel` drawer) — it paints
  independently of that container's own scroll position.

## 11. Verification totals

```bash
npx tsc -b                                              # typecheck (0 errors)
npx eslint src --max-warnings=0                         # lint (0 errors/warnings)
npx vite build                                          # production build (succeeds)
npx tsx scripts/verify-phase20-3d-world.ts              # 43 passed, 0 failed
npx tsx scripts/verify-phase20b-character.ts            # 100 passed, 0 failed
npx tsx scripts/verify-phase20c-living-world.ts         # 165 passed, 0 failed
npx tsx scripts/verify-phase20d-room-customisation.ts   # 173 passed, 0 failed
npx tsx scripts/verify-phase20e-campus-expansion.ts     # 129 passed, 0 failed
npx tsx scripts/verify-phase20f-vertical-slice.ts       # 178 passed, 0 failed
npx tsx scripts/verify-phase21-mentor-relationships.ts  # 135 passed, 0 failed
npx tsx scripts/verify-phase22-ai-mentor.ts             # 71 passed, 0 failed
npx tsx scripts/verify-phase23-living-mentor.ts         # 61 passed, 0 failed
```

**Total: 1055 passed, 0 failed.** Two pre-existing regression guards
needed updating during this phase, both because Phase 23 correctly
changed behaviour they were pinned to, not because of a regression:
`verify-phase21-mentor-relationships.ts`'s wave-override text match (the
override chain grew a third branch for `talking`) and its literal
`waving && !state.isWalking` substring check (restructured, same
underlying no-mid-walk-override rule).

## 12. Stop condition — met

- Mentors reference recent progress, workload, upcoming assessments,
  study consistency, achievements, confidence, and previous interactions
  — all read from `StudentContext`/`NpcMemoryEntry`, never invented.
- Dialogue is generated fresh from `StudentContext` every time, never
  static or random.
- Conversations are remembered day-to-day (recognition) and, for a
  flagged struggle assessment, across the specific gap until it's
  resolved.
- Four subject mentors keep four genuinely distinct personalities
  (unchanged from Phase 21, extended by exactly one new category each).
- Greetings vary by real context (10+ distinct situations checked in the
  harness).
- A real, multi-stage conversation flow exists (greeting → context →
  advice → encouragement → reflection → goodbye).
- Study coaching only ever surfaces `RecommendationEngine` output — no
  duplicated scoring logic anywhere in `MentorDialogueProvider.ts`.
- Every Dashboard insight is clickable and opens a real, relevant
  conversation.
- A clean `MentorDialogueProvider` interface exists for a future LLM swap,
  requiring no UI changes.
- No LLM APIs, voice chat, or internet services were added — everything
  is deterministic, verified by the harness's own source-text checks.
- All regression harnesses remain green — 1055/1055 (§11).
