# Phase 24 Audit — Proactive AI Mentor & Life Simulation

Read in full before any implementation, per Phase 24's own explicit gate.
Covers every system the brief names, what's reused vs. genuinely new,
extension points, performance/notification/interruption/persistence
strategy.

## 1. What already exists (unchanged, consumed not rewritten)

- **`StudentContext`** (`src/ai/ContextEngine.ts`, Phase 22) — the frozen
  snapshot every trigger check reads from. Already carries everything
  Phase 24's triggers need EXCEPT event-timing (see §3): overdue/upcoming
  assessments, per-subject confidence/focus-minutes/relationship, streak,
  workload level, achievements (`recent`, timestamped), journal
  milestones. **Not touched this phase.**
- **`RecommendationEngine.ts`** (Phase 22) — untouched. Rule #1 ("never
  duplicate Recommendation Engine logic") means the Proactive Mentor
  Engine's job is ONLY to decide *whether/who/when* to speak — the actual
  advice content, when a proactive event opens a conversation, still comes
  from `generateRecommendations` via the existing
  `MentorDialogueProvider.ts` "advice" stage, unchanged.
- **`ReflectionEngine.ts`** (Phase 22) — untouched, for the same reason
  (Rule #2). The new "Evening Reflection" mini-interaction (§7) stores a
  new, small, honest fact but never feeds it INTO this engine's own
  derivation — it's referenced descriptively by the NEW dialogue code
  instead (see §7 for why).
- **`GoalSystem.ts`** (Phase 22) — untouched. `generateDailyGoals`/
  `syncGoalMilestones` already log a `"goal-complete"` milestone the
  moment a goal completes — this is EXACTLY the event Phase 24's "Goal
  completed" trigger needs, already timestamped, already persisted.
- **`MentorPlanner.ts`** (Phase 22) — untouched. `celebrateMessage`/
  `consistencyMessage` already have real, exported logic for "a recent
  achievement" and "a live streak" that Phase 24's triggers overlap with
  conceptually; the new engine reuses the SAME underlying signals
  (`context.achievements.recent`, `context.streak.current`) rather than
  re-deriving them differently.
- **`MentorDialogueProvider.ts`** (Phase 23) — untouched, remains THE
  dialogue interface (Rule #4). The Proactive Mentor Engine never
  generates a line itself — it decides which `npcKey` should speak and
  under which framing, then calls `ruleBasedMentorDialogueProvider.
  buildConversation(...)` exactly like `Game3D.tsx`'s npc-chat handler and
  `useMentorConversation.ts` already do.
- **`useMentorConversation.ts`** (Phase 23) — the existing portable
  "open a conversation" hook. Reused verbatim by the new notification's
  click handler — clicking a proactive notification calls
  `openConversation(npcKey, npcLabel)`, the SAME function the Dashboard's
  "Talk to..." buttons already call.
- **`AiMentorDashboard.tsx`** (Phase 22/23) — untouched. Not a trigger
  source or target this phase; the new notification is a separate, small
  UI element (see §5).
- **The existing "notification system"** (`src/lib/reminders.ts`,
  Phase 6/7, `ReminderRecord[]`, `settings.reminderOffsets`/
  `weeklyPlanningReminder`) — a COMPLETELY DIFFERENT concern: scheduled
  assessment-deadline reminders, unrelated to mentor social proactivity.
  Phase 24's new "non-intrusive mentor notification" is a SEPARATE, small,
  transient UI element — it must not be confused with, duplicate, or
  read/write `ReminderRecord[]`.
- **The Journal** (`src/screens/PlayerJournalScreen.tsx`, Phase 21) —
  read-only, composed from `saveData.milestones` + other real data.
  Already surfaces `goal-complete`/achievement/room-stage milestones.
  Phase 24 adds no new Journal section; any new persisted facts (§6/§7)
  are referenced by mentor dialogue, not by the Journal UI, keeping this
  screen's own scope unchanged.
- **Save data** — `NpcMemoryEntry` (Phase 21, extended Phase 23 with
  `recentTopics`/`flaggedAssessmentId`) is the natural home for
  per-mentor-relationship facts (§8). `milestones: MilestoneEntry[]`
  (Phase 11, extended Phase 22 with `goal-complete`) already logs
  first-observed timestamps for 5 kinds of event — see §3 for how heavily
  this is reused.

## 2. Extension points

1. **New module `src/ai/ProactiveMentorEngine.ts`** — pure trigger
   evaluation: `evaluateProactiveTriggers(save, context, now, log) →
   ProactiveEvent[]` (ranked candidates) and `pickNextProactiveEvent(...)`
   (the single highest-priority one worth surfacing right now, respecting
   daily limits/cooldowns). Never generates a dialogue line itself.
2. **New save field `proactiveMentorLog`** — an append-only, capped log of
   which trigger ids have already fired and when (cooldown + "once per
   real event" persistence — see §3/§9).
3. **`Game3D.tsx`** — one new periodic check (an interval, not per-frame)
   calling `pickNextProactiveEvent(...)` with the current UI-suppression
   state, surfacing a `MentorNotification` (new, separate from
   `speechToast` and `MentorConversationPanel`) when something clears the
   bar.
4. **`NpcMemoryEntry`** — two more additive fields: `conversationCount`
   and a small capped `adviceLog` (category/subjectId/timestamp) for the
   "advice followed" heuristic (§8).
5. **A new, small "check-in facts" save field** — `dailyCheckIn: {
   dateIso, subjectId } | null` and `eveningCheckIn: { dateIso,
   feltManageable: boolean } | null` (§7) — real, player-selected (not
   free-text) facts, referenced descriptively by dialogue only.

## 3. Trigger design — reusing existing timestamped logs, not new state

The brief's 15 example triggers split cleanly into two shapes:

**(a) Continuous-condition triggers** (fire when a condition is currently
true, gated by a cooldown so they don't repeat every visit):
assessment due tomorrow, 3 days without studying a subject, confidence
very low/very high, heavy workload, long inactivity, semester halfway
point, semester ending. All read directly off `StudentContext` — no new
persisted state needed beyond the cooldown log itself.

**(b) Event triggers** (fire once, the day the real event happened,
never again for that same event): goal completed, milestone unlocked,
achievement earned, room evolution, new module unlocked, first login of
the day, returning after several days away. **Critically, 4 of these 7
are ALREADY timestamped in `save.milestones`** (Phase 11/22): a
`"goal-complete"`/`"achievement"`/`"room-stage"`/`"bond-level"` entry
with `at` on today's Melbourne date IS the event — the Proactive Mentor
Engine filters the EXISTING log by kind + date, it does not maintain a
second one. "New module unlocked" is derived from `tasks[].completedAt`
(a preceding module completed today unblocks the next); "first login of
the day"/"returning after an absence" reuse `userProgress.lastActiveDate`
(already the exact signal `getMentorLine`'s own `welcomeBack` rung uses).

This means the ONLY genuinely new persisted state is the
**proactive-log** itself (§9) — a small, capped list of
`{ triggerId, firedAt }` so a continuous-condition trigger respects its
cooldown and an event-trigger never re-fires for the same underlying
event (keyed off the SAME id the milestones log already uses, e.g.
`goal:study-45:2026-08-12`, so no separate de-dup key needs inventing).

## 4. Priority model

Each candidate gets a 0-100 priority, same scoring VOCABULARY
`RecommendationEngine.ts` already established (a plain number, an honest
additive `evidence`-style breakdown) — NOT a new scoring philosophy:

- Overdue-adjacent (assessment due tomorrow, heavy workload with an
  imminent deadline) — highest, mirroring `MentorPlanner.ts`'s own
  urgent-deadline-first order.
- Celebratory (goal/milestone/achievement/room-evolution today) — high,
  time-sensitive (stale praise feels hollow, same reasoning
  `MentorPlanner.ts`'s `celebrateMessage` already uses for its 48h window).
- Care (long inactivity, confidence very low, heavy workload) — medium.
- Ambient/social (returning after absence, first login, confidence very
  high, semester halfway/ending, new module) — lower, "nice to mention,"
  never blocking.

## 5. Notification strategy

A NEW, separate, small UI element (`MentorNotification.tsx`) — NOT
`speechToast` (Phase 20D/E, still serves its own two unrelated uses) and
NOT `MentorConversationPanel` (Phase 23, a full conversation). A
notification is a single short line + a "Talk" affordance; clicking it
calls the EXISTING `useMentorConversation.ts`'s `openConversation(npcKey,
npcLabel)`, which builds the real conversation via
`MentorDialogueProvider.ts` at that moment — the notification itself
never pre-computes or duplicates that conversation, only the ONE-LINE
teaser text and which npcKey to open.

## 6. Interruption strategy

Never interrupts:

- **During another conversation** — suppressed whenever
  `mentorConversation`/`useMentorConversation`'s `active` is non-null.
- **During menus** — suppressed whenever a `PanelHost` panel is open
  (`WorldUiContext`'s `openPanel !== null`) or any of Game3D.tsx's own
  overlay states are true (`studyPlannerOpen`, `creatorOpen`,
  `directoryOpen`, `editorOpen`).
- **During minigames** — suppressed whenever
  `saveData.activeFocusSession !== null` (the one real "minigame" state
  this codebase has).
- **During transitions** — suppressed whenever `transitionPhase !==
  "none"` (Game3D.tsx's existing reactive transition state, Phase 20F).
- **During loading** — the Suspense boundary around `Game3D` itself; the
  periodic check only ever runs once `Game3D` has mounted, so there is no
  "loading" state to separately suppress inside it.

Daily limits + priority queue: at most N proactive notifications per
Melbourne day (a small constant, e.g. 3) tracked via the SAME proactive
log (§3/§9); the periodic check always evaluates ALL candidates and
picks the single highest-priority one currently eligible, never queuing
multiple for later delivery in the same session (a stale, backlogged
notification would feel like nagging, the opposite of the brief's own
"never become annoying").

## 7. Daily Check-In / Evening Reflection — an honest scope decision

The brief's literal wording ("the mentor may ask 'What are you planning
to focus on today?'... Responses should influence Recommendations...")
describes a free-text conversational exchange. **This game has no
free-text input anywhere** — every prior phase's dialogue is one-way
(NPC → player). Phase 22's own stop condition explicitly forbade
"free-form chatbot conversations," and nothing in this phase's brief lifts
that. The honest, implementable version: a short MULTIPLE-CHOICE
mini-interaction (a new conversation stage type) — "Which subject are you
focusing on today?" with one button per real subject (+ "not sure yet") —
whose selection is stored as a new, small, real save fact
(`dailyCheckIn: { dateIso, subjectId | null }`). This fact is NEVER fed
into `RecommendationEngine.ts`/`GoalSystem.ts`'s internals (Rule #1/#3
forbid rewriting their scoring) — instead, the NEW dialogue code
references it descriptively on a LATER visit ("Earlier you said you'd
focus on {subject} — how did that go?"), the same honest-follow-up
pattern Phase 23's struggle-flag already established. Evening Reflection
follows the identical shape: a 2-3 option check ("How did today feel? —
Great / Tough / About right") stored as `eveningCheckIn: { dateIso,
feltManageable: boolean }`, referenced by dialogue, never altering
`ReflectionEngine.ts`.

## 8. Mentor relationship progression

`computeMentorRelationship`/`npcRelationship.ts` (Phase 21) already derive
Level/Trust/Familiarity/Mood/Unlocked-Topics from real stats
(sprints/focusMinutes/modulesCompleted/assessmentsSubmitted/visitDays) —
untouched. The brief's two genuinely NEW facts:

- **Conversation count** — a new `conversationCount: number` field on
  `NpcMemoryEntry`, incremented once per REAL conversation (not a
  same-day recognition swap-in) inside `useMentorConversation.ts`/
  `Game3D.tsx`'s existing conversation-opening call sites.
- **Advice followed** — a small, capped `adviceLog: { category,
  subjectId, at }[]` on `NpcMemoryEntry`, appended once per conversation
  that had an advice stage. A pure function
  `countAdviceFollowed(save, npcKey)` checks each logged entry against
  REAL subsequent activity (e.g. a `module-work` advice entry counts as
  "followed" if that subject gained a module completion or a Focus Sprint
  within the next 48h) — an honest heuristic, disclosed as such (§ Known
  Limitations in the completion doc), not a claim of certainty about
  player intent.

"Relationship stages should evolve naturally" is satisfied by REUSING
`relationship.level` (1-5, already real) plus these two new counts as
additional dialogue-flavour inputs (e.g. a `goodbye` line variant once
`conversationCount` crosses a threshold) — never a second, competing
relationship-level system.

## 9. Persistence strategy

New save fields, all additive, all safely coerced on load (same
discipline as every prior phase's save-schema growth):

```ts
proactiveMentorLog: ProactiveLogEntry[];   // { triggerId, firedAt } — capped ~90 entries
dailyCheckIn: { dateIso: string; subjectId: string | null } | null;
eveningCheckIn: { dateIso: string; feltManageable: boolean } | null;
```

Plus two additive fields on the EXISTING `NpcMemoryEntry`:

```ts
conversationCount: number;
adviceLog: Array<{ category: string; subjectId: string | null; at: string }>; // capped ~20
```

## 10. Performance implications

- The periodic proactive check runs on a plain `setInterval` (e.g. every
  60-90s of real play time), NOT per-frame — negligible cost, an order of
  magnitude cheaper than the per-frame NPC pose/schedule work Phase 20C
  already established as the real per-frame budget.
- `evaluateProactiveTriggers` is O(number of subjects + a few array scans
  over already-small lists: `overdueAssessments`, `upcomingAssessments`,
  `journalMilestones`, `achievements.recent`) — no new O(n²) work.
- The proactive log is capped (§9), same bounded-growth discipline as
  Phase 22's `buildingVisitLog`/Phase 23's `recentTopics`.

## 11. Risks

- **Feeling naggy if miscalibrated** — mitigated by the daily cap +
  cooldown log + "pick only the single best candidate" design (§6).
- **Save-schema growth** — mitigated by the same additive/capped/
  safely-coerced discipline every prior phase already follows; verified
  by the new harness's save-compatibility section.
- **Scope of "campus life" (NPC-to-NPC ambient dialogue)** — genuinely
  new content, not just wiring. Scoped down to a light, deterministic,
  context-labelled ambient line (era-based, e.g. "exam season's got
  everyone on edge") rather than a full two-NPC dialogue system — a
  disclosed, proportionate scope decision (see completion doc's Known
  Limitations).
- **Free-text check-ins** — resolved honestly in §7; disclosed rather
  than silently mis-implemented as fake free text.
