# Phase 23 Audit — Living AI Mentor & Conversational System

Read in full before any implementation, per Phase 23's own explicit gate
("Do not begin implementation until the audit is complete"). Covers every
system named in Step 1, what's reused vs. genuinely new, integration
points, risks, and performance considerations.

## 1. What already exists

### Context Engine (`src/ai/ContextEngine.ts`, Phase 22, unchanged)
`buildStudentContext(save, now)` — one frozen `StudentContext` snapshot:
semester progress, per-subject confidence/relationship/sim state, overdue/
upcoming assessments, streak, favourite buildings, room unlocks,
achievements, `npcInteractions` (raw `npcMemory` copy), `journalMilestones`,
workload level. **This remains the single source of truth for Phase 23** —
every new module reads from it, none re-derives.

### Recommendation Engine (`src/ai/RecommendationEngine.ts`, Phase 22, unchanged)
`generateRecommendations(save, context, now, limit)` — prioritised,
evidence-backed `Recommendation[]`, each with `priority/reason/
estimatedDurationMinutes/confidence/evidence/subjectId`. Phase 23's "Study
Coaching" section is explicit: "All recommendations must originate from
the Recommendation Engine. Never duplicate logic." Phase 23 will call this
function and phrase its output personality-side, never re-score anything.

### Reflection Engine (`src/ai/ReflectionEngine.ts`, Phase 22, unchanged)
`generateWeeklyReflection(save, context, now)` — supportive,
evidence-backed `ReflectionStatement[]`, rolling 7-day windows. Phase 23's
conversation "Reflection" stage reads this directly.

### Goal System (`src/ai/GoalSystem.ts`, Phase 22, unchanged)
`generateDailyGoals`/`syncGoalMilestones` — adaptive daily goals; a
completed goal is logged as a `"goal-complete"` `MilestoneEntry`. Phase 23
references goal completions in conversation/memory by reading
`context.journalMilestones` (already includes `goal-complete` entries,
Phase 22 §2) — no new goal-tracking logic needed.

### Mentor Planner (`src/ai/MentorPlanner.ts`, Phase 22, unchanged)
`planMentorMessage(save, context, now)` — ONE line, following the fixed
priority ladder urgent-deadline > celebrate > consistency > next-action >
reflection > fallback. This already encodes exactly the priority logic
Phase 23's "Study Coaching"/"Emotional Tone" sections want. **Phase 23's
new conversation system will call the SAME underlying stage functions
`MentorPlanner.ts` already has** (extracted/reused, not reimplemented) for
its own "advice"/"encouragement" stages, so the two never disagree about
what the mentor's single most important thing to say is.

### Dashboard (`src/components/dashboard/AiMentorDashboard.tsx`, Phase 22, unchanged)
Seven cards (Academic Health, Confidence Overview, Current Focus,
Workload, Momentum, Weekly Reflection, Recommended Next Action), mounted
in `ProfileScreen.tsx` under "Your AI Mentor". The Recommended Next Action
card already has a "Why?" evidence toggle. **Not currently clickable to
open anything** — this is Phase 23's "Dashboard Connection" ask.

### Existing dialogue system (`src/lib/mentorDialogue.ts`, Phase 17/21, unchanged)
`getMentorLine(input)` — THE existing rich, single-line-per-visit priority
ladder with real, distinct personalities already authored:

| Subject | Persona | Voice |
|---|---|---|
| `user-interface-design` | Iris | warm studio designer — drafts, canvas, light |
| `cloud-based-web-application-development` | Cass | dry precise engineer — pipelines, uptime, deploys |
| `project-management` | Mara | steady coach — schedules, milestones, critical path |
| `professional-practices-and-entrepreneurship-in-it` | Theo | high-energy founder — traction, pitches, runway |

Each has 14 tonal pools (`morning/afternoon/evening/busy/relaxed/congrats/
concern/revision/ending/complete/humour/burnout/welcomeBack/milestone`),
deterministically picked by day-of-year + subject hash — **this already
IS almost exactly Phase 23's "Personality System" ask** (distinct
vocabulary, sentence structure, encouragement, humour per subject). Phase
23 does NOT need a new personality system; it needs to (a) EXTEND these
same 4 voice pools with 2 new categories the conversation flow needs that
don't exist yet (`goodbye`, `contextAware`), and (b) compose a MULTI-STAGE
conversation around this existing single-line engine rather than replacing
it.

`getMentorAdvice`/`getAmbientNpcLine`/`getMentorGreeting`
(`src/game3d/campus/npcGreetings.ts`, Phase 20E/21, unchanged) — the
generic (non-subject-voiced) guide/ambient-NPC lines. Untouched this
phase; population NPCs (librarian, lab tech, etc.) keep their existing
ambient treatment.

`getDailyMentorInsight` (`src/game3d/campus/dailyMentorInsights.ts`, Phase
21) — comparative/aggregate observations ("strongest subject," "assessments
due this week"), already wired into `getMentorAdvice`'s ladder. Unchanged.

`getNpcMemory`/`applyRecognition` (`src/lib/npcMemory.ts`, Phase 21,
unchanged) — `NpcMemoryEntry { lastLine, lastLineDate, lastInteractionAt }`,
same-day recognition ("Back again — good."). **This is the existing memory
system** — Phase 23's "Memory System" section extends this record
additively rather than building a parallel one.

### Existing NPC architecture
- `NpcCharacter.tsx` (Phase 20C, extended Phase 21 with a `waving` prop) —
  schedule-driven position/pose, with an existing precedent for a
  proximity-triggered pose OVERRIDE (`waving && !state.isWalking ? "wave" :
  state.pose`). Phase 23's "speaking animation" reuses this exact pattern
  with a new `talking` prop, swapping in the already-existing `"talk"` pose
  (`characterRig.ts`, Phase 20C) — no new animation content required.
- `Game3D.tsx`'s `npc-chat` case (Phase 21) — the ONLY call site that
  currently builds `sim`/`relationship`/`calendar` and calls
  `getMentorLine`/`getMentorAdvice`, then `applyRecognition`, then
  `recordNpcInteraction`, then `setSpeechToast({label, line})`.
  `speechToast` is a **shared, single-line, 1-shot, auto-dismissing toast**
  also used by Phase 20D's unrelated room-customisation "cosmetic
  reaction" feature ("one UI, not two" — a deliberate Phase 20D/E
  decision). **Risk**: reusing `speechToast` for a multi-stage conversation
  would either break that shared contract or bloat an unrelated feature's
  UI. Resolved in §3 below.
- `WorldScene.tsx` (legacy 2D renderer, Phase 11–19, unchanged) — the
  SubjectRoomScene mentor already does real-time, synchronous,
  no-loading "room presence": `mentorLine` is a plain `useMemo`, and a
  room-entry `useEffect` sets `talking = true` for `GREETING_MS`, showing
  `<SpeechBubble text={mentorLine} visible={talking || urgent} />`
  immediately. **This means "no loading, immediate awareness on room
  entry" is ALREADY solved for the legacy 2D renderer** — Phase 23 doesn't
  need to build this from scratch, only decide whether to extend it (see
  §4 "scope decision").

### Existing save data
- `npcMemory: Record<string, NpcMemoryEntry>` (Phase 21) — per-NPC-key
  (subject id, or `"guide"`) last-line/last-line-date/last-interaction.
- `milestones: MilestoneEntry[]` (Phase 11, extended Phase 22 with
  `"goal-complete"`) — first-seen timestamps for achievements/bond-levels/
  room-stages/semester-complete/goal-completions. Already exposed via
  `context.journalMilestones` (Phase 22).
- `buildingVisitLog`/`buildingVisits`, `assessmentProgress`,
  `completedFocusSessions`, `userProgress` — all already flow into
  `StudentContext`; nothing new needed here for Phase 23's dialogue logic.

## 2. Which systems will be reused (vs. genuinely new)

| Reused verbatim | New this phase |
|---|---|
| `ContextEngine.ts`, `RecommendationEngine.ts`, `ReflectionEngine.ts`, `GoalSystem.ts` | `src/ai/MentorDialogueProvider.ts` — the interface + rule-based conversation assembler |
| `mentorDialogue.ts`'s 4 authored VOICES (all 14 existing categories) | 2 new categories per voice: `goodbye`, `contextAware` |
| `MentorPlanner.ts`'s priority-ladder stage functions | A conversation-stage wrapper around them (greeting/context/advice/encouragement/reflection/goodbye) |
| `npcMemory.ts`'s `NpcMemoryEntry`/`applyRecognition` | Additive fields on `NpcMemoryEntry`: `recentTopics` (no-repeat) + a flagged-struggle-assessment follow-up |
| `NpcCharacter.tsx`'s `waving` override pattern | A parallel `talking` override, same shape |
| `AiMentorDashboard.tsx` (all 7 cards, untouched) | Click handlers opening a conversation |
| Phase 20D's `speechToast` (untouched, still serves room-customisation reactions + ambient NPCs) | A NEW, separate conversation panel/modal for subject-mentor + guide chats only |

## 3. Integration points

1. **`src/ai/MentorDialogueProvider.ts`** (new) — exports an interface
   (`MentorDialogueProvider`) and one rule-based implementation
   (`ruleBasedMentorDialogueProvider`) with a single method
   `buildConversation(save, context, subjectId | "guide", now)` →
   `MentorConversation` (ordered `ConversationStage[]`). This is the
   "clean interface... no UI changes required" the brief's "Future AI
   Ready" section asks for — a future LLM-backed implementation would
   satisfy the same interface and be swapped in at ONE call site.
2. **`Game3D.tsx`'s `npc-chat` case** — for `role === "subject-mentor"`
   (resolved subjectId) and `role === "guide"` ONLY, build a
   `MentorConversation` instead of a single `getMentorLine` string, open
   it in a NEW local state (`mentorConversation: {npcLabel, subjectId,
   conversation} | null`), rendered by a new `<MentorConversationPanel>`
   component. Every OTHER `npc-chat` role (librarian, lab-technician,
   lecturer, lounge-staff, admin-staff) is untouched — still
   `setSpeechToast`.
3. **`NpcCharacter.tsx`** — new optional `talking?: boolean` prop,
   layered into the existing pose-override chain
   (`talking ? "talk" : waving && !isWalking ? "wave" : state.pose`),
   driven by whether `mentorConversation` is currently open for that NPC.
4. **`ProfileScreen.tsx`/`AiMentorDashboard.tsx`** — each of the 7 cards
   gets an `onClick` opening the SAME `<MentorConversationPanel>` in a
   portable, renderer-independent way (its own local `useState`, not
   dependent on the 3D Canvas being mounted) — see §4 for why this must be
   a standalone component, not reached through Game3D.tsx's internal state.
5. **`npcMemory.ts`** — `applyRecognition` stays exactly as-is for the
   TOAST-based ambient roles; the new conversation path uses a parallel,
   additive memory read/write (`recentTopics`, struggle-follow-up) that
   composes with, but doesn't replace, the existing same-day recognition
   check.

## 4. Scope decisions (disclosed, not silent)

- **The legacy 2D `WorldScene.tsx`/`SubjectRoomScene` is NOT touched this
  phase.** Its `talking`/`SpeechBubble` mechanism already solves "room
  presence" for that renderer and is comparatively fragile (a bare
  `useEffect` timer keyed only on `subject?.id`); retrofitting a
  multi-stage conversation into it risks exactly what the brief forbids
  ("DO NOT rewrite existing systems... DO NOT replace working logic"). All
  Phase 23 conversational depth targets the 3D Campus (the renderer every
  phase since 20A has been built toward) plus the new, portable Dashboard
  entry point. The 2D renderer keeps its existing single-line
  `getMentorLine` treatment unchanged.
- **"Subtle facial reactions" (Visual Improvements) is not implementable.**
  The character rig (`characterRig.ts`) is a procedural limb/joint
  animation system with no face mesh or expression blend shapes — adding
  one would be a genuinely new art/animation system, not "building on top
  of existing architecture." Documented as a known limitation; Phase 23
  instead delivers idle/speaking pose differentiation (achievable, reuses
  the existing `waving`-override precedent) and text/panel-level polish
  (typing effect, stage transitions).
- **"How did that assessment go?" follow-ups are data-driven, not
  free-text.** There is no player text input anywhere in this game (all
  dialogue is one-way, NPC → player) — the mentor can't literally be
  "told" anything. The achievable, honest version: when the
  context-awareness stage detects a specific assessment under real
  pressure (low progress + close deadline, an existing `simulation.ts`/
  `priority.ts` signal), the mentor flags that assessment id in
  `NpcMemoryEntry`; on a LATER visit, if that assessment's status has
  since changed to submitted/graded, the mentor's greeting references it
  ("How did that go?") and the flag clears. Every word still traces to
  real save data — no simulated understanding of anything the player
  hasn't actually done in-game.

## 5. Risks

- **UI duplication risk (mitigated):** two speech-like UI elements
  (`speechToast` and the new conversation panel) coexisting in Game3D.tsx
  could look inconsistent if not deliberately differentiated. Mitigation:
  the new panel is visually distinct (a proper stage-based panel, not a
  toast) and ONLY appears for the two roles that get real conversations;
  every other NPC interaction is visually unchanged.
- **Save-schema growth risk (mitigated):** `NpcMemoryEntry` gains fields.
  Same additive-with-safe-coercion discipline as every prior phase
  (Phase 21 `npcMemory`/`buildingVisits`, Phase 22 `buildingVisitLog`) —
  a corrupted or missing field degrades to a safe default, never a throw.
- **Determinism risk:** conversation stage content must remain
  deterministic (same save + same instant → same conversation), matching
  every existing engine's contract, so the harness can assert on it and
  regressions are catchable. All new logic is pure functions over
  save/context/now, no `Math.random()`/uncontrolled `Date.now()`.
- **Regression risk to Phase 20D's cosmetic-reaction toast:** since it
  shares `speechToast`, any refactor of that state must be additive
  (a new, separate state) rather than modifying the existing one — verified
  by keeping `speechToast`'s type/usages byte-for-byte unchanged.
- **Scope risk:** this is the largest single-phase brief so far (10+
  named sections). Mitigated by the explicit scope decisions in §4 and by
  building ONE shared conversation engine/component reused across every
  entry point (npc-chat, dashboard) rather than bespoke code per surface.

## 6. Performance considerations

- `buildConversation` is a pure function called on-demand (button
  press/click), never per-frame — same cost profile as the existing
  `getMentorLine` call it wraps (a handful of already-cheap engine calls,
  no new O(n²) work). `StudentContext` itself is already built once per
  interaction in the existing `npc-chat` handler; Phase 23 doesn't add a
  second build.
- The `talking` pose override adds one more branch to a comparison
  `NpcCharacter.tsx` already re-evaluates every `SCHEDULE_THROTTLE_FRAMES`
  frames (Phase 20C's existing throttle) — negligible.
- A typing-effect text reveal is a lightweight `setInterval`/CSS
  `steps()` animation scoped to whichever conversation stage is visible,
  torn down on stage change/unmount — no measurable cost at this NPC
  density (Phase 20E/F already established a modest, curated NPC count
  per building).
- No new network/LLM calls (Phase 22's stop condition still holds) — the
  new interface's rule-based implementation is exactly as fast as calling
  `mentorDialogue.ts` directly.
