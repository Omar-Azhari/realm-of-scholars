# Phase 24 — Proactive AI Mentor & Life Simulation

Evolves the mentor from someone who responds (Phase 23) into someone who
occasionally approaches the player first. Every existing engine from
Phases 21–23 (`StudentContext`, `RecommendationEngine`, `ReflectionEngine`,
`GoalSystem`, `MentorPlanner`, `MentorDialogueProvider`, the Conversation
UI) remains the single source of truth, completely unchanged this phase —
Phase 24 only adds a proactive DECISION layer on top of them, plus the
small, additive relationship/check-in extensions the audit
(`docs/PHASE_24_PROACTIVE_MENTOR_AUDIT.md`) identified as genuinely
missing.

## 1. Architecture

```
src/ai/
  ProactiveMentorEngine.ts     NEW — decides whether/who/when/priority/
                               cooldown for ~15 named triggers
  MentorRelationshipStats.ts   NEW — Conversation Count / Advice Followed /
                               Milestones Celebrated + a relationship stage
  CheckInFollowUp.ts           NEW — the ONE consuming-side helper that
                               references a Daily Check-In pick in a later
                               conversation, without editing
                               MentorDialogueProvider.ts itself

src/game3d/campus/
  campusLife.ts                NEW — era-flavoured "campus feels alive"
                               remarks + a shared "milestone today?" check

src/components/mentor/
  MentorNotification.tsx       NEW — the lightweight, dismissible chip
  MentorCheckInPrompt.tsx      NEW — the Daily Check-In / Evening
                               Reflection multiple-choice mini-prompt
```

Everything else is an ADDITIVE edit to an existing file:

- `src/types/domain.ts` / `src/lib/persistence.ts` /
  `src/state/SaveDataContext.tsx` — new save fields (`proactiveMentorLog`,
  `dailyCheckIn`, `eveningCheckIn`) and two additive `NpcMemoryEntry`
  fields (`conversationCount`, `adviceLog`), all field-by-field
  safe-coerced exactly like every prior additive save field.
- `src/lib/mentorDialogue.ts` — `congrats`/`concern` pools for all 4
  voices gained 2 more lines each (content only — no selection logic
  touched), satisfying "expand dialogue pools."
- `src/game3d/campus/npcGreetings.ts` — `getAmbientNpcLine` and
  `getMentorAdvice` each gained ONE new, hash-gated rung reusing
  `campusLife.ts`'s remark/milestone-reaction helpers, ranked below every
  real academic signal already in their ladders.
- `src/game3d/Game3D.tsx` — a shared `openMentorConversation` callback
  (extracted from the existing npc-chat handler, unchanged behaviour),
  a periodic (not per-frame) proactive check, an interruption-suppression
  flag, and the new notification/check-in components rendered
  conditionally.
- `src/hooks/useMentorConversation.ts` — now also applies
  `withDailyCheckInFollowUp` before showing a conversation.
- `src/screens/PlayerJournalScreen.tsx` — each mentor's comment entry now
  shows its relationship stage + conversation count (read-only display of
  the new stats, nothing new derived here).

## 2. Trigger system

`ai/ProactiveMentorEngine.ts` evaluates every candidate from
`StudentContext` plus the small `proactiveMentorLog` cooldown log — never
from a second copy of `RecommendationEngine`/`ReflectionEngine` scoring
(Rules #1/#2).

| Trigger | npcKey | Category | Cooldown |
|---|---|---|---|
| Assessment due tomorrow | subject | urgent | 20h |
| 3+ days without studying a subject | subject | care | 48h |
| Goal completed today | guide | celebration | permanent (per goal id) |
| Milestone (bond level) unlocked today | subject | celebration | permanent |
| Achievement earned today | guide | celebration | permanent |
| Room evolution today | subject | celebration | permanent |
| Confidence very low | subject | care | 72h |
| Confidence very high | subject | ambient | 72h |
| Heavy workload (high/peak) | guide | care | 48h |
| First login today | guide | ambient | permanent (per day) |
| Long inactivity (2–4 days) | guide | care | permanent (per day) |
| Returning after 5+ days away | guide | care | permanent (per day) |
| Semester halfway point | guide | ambient | permanent |
| Semester ending (revision/exams) | guide | ambient | permanent |
| New module unlocked today | subject | ambient | permanent (per module/day) |

**Zero new "transition detection" state was needed.** Four of the
milestone-based triggers reuse the EXISTING `save.milestones` first-seen
log (Phase 11/22) filtered to today's Melbourne date; "new module
unlocked" is derived from `tasks[].completedAt`. Continuous conditions
(confidence, workload, inactivity, assessment-due-tomorrow, neglect,
semester milestones) are all handled uniformly as "condition currently
true AND not on cooldown" — see the audit §3 for the full reasoning.

`evaluateProactiveTriggers` returns every eligible candidate sorted by
priority (urgent > celebration > care > ambient, with finer per-trigger
values); `pickNextProactiveEvent` returns the single best one, or `null`
if the caller marks the player `suppressed` or the daily cap
(`DAILY_PROACTIVE_LIMIT = 3`) is already reached.

## 3. Cooldown system

`proactiveMentorLog: { triggerId, firedAt }[]` — one small, capped,
append-only log shared by every trigger type:

- **Continuous conditions** get a finite `cooldownHours`; the SAME
  `triggerId` (e.g. `confidence-very-low:user-interface-design`) can't
  fire again until that many hours have passed since it last did.
- **Event-based triggers** get `cooldownHours: null` — a permanent,
  once-ever gate keyed by the REAL underlying event's own stable id (e.g.
  `milestone:goal:study-45:2026-08-12`, `new-module-unlocked:<moduleId>:<date>`)
  so the identical event is never surfaced twice.
- `countFiredToday` (same log, filtered to today's Melbourne date) backs
  the daily cap.

An event is logged as fired the MOMENT it's surfaced as a notification
(`recordProactiveEventFired`), not when the player later clicks it — this
is what makes the cooldown/cap honest even if a notification is dismissed
unopened.

## 4. Interruption rules

Never interrupts: during another conversation, a menu/panel
(`WorldUiContext`'s `openPanel`), the Room Editor/Character
Creator/Campus Directory/Study Planner overlays, an active Focus Sprint
(`saveData.activeFocusSession`), or a scene transition
(`transitionPhase !== "none"`). The periodic check (a plain
`window.setInterval`, `PROACTIVE_CHECK_INTERVAL_MS = 75s` — not per-frame)
reads a single `suppressedRef` boolean computed fresh every render from
all of the above, so a notification/check-in can never appear mid-anything
listed.

## 5. Notification flow

```
setInterval tick (every 75s)
        │
   suppressed? ──yes──▶ skip this tick
        │no
        ▼
pickNextProactiveEvent(save, context, now)   ← ai/ProactiveMentorEngine.ts
        │
   null? ──yes──▶ skip this tick
        │no
        ▼
recordProactiveEventFired(event.id)   (cooldown/cap persistence)
        │
        ▼
<MentorNotification npcLabel line=event.teaserLine>
        │  (click "Talk")                (click "Dismiss")
        ▼                                       ▼
openMentorConversation(npcKey, npcId, npcLabel)  hide, no state change
        │
        ▼
  the SAME real conversation path every other mentor
  interaction uses (ruleBasedMentorDialogueProvider.buildConversation)
```

The notification's `teaserLine` is a short, FIXED string chosen by the
engine (e.g. "Let's chat before tomorrow's assessment.") — never the
conversation itself. This split is exactly what "Future AI Ready" means
in code (§8).

## 6. Daily Check-In / Evening Reflection

No free-text input exists anywhere in this game (confirmed in the audit),
so both are small, real MULTIPLE-CHOICE prompts
(`MentorCheckInPrompt.tsx`), not conversation stages — deliberately kept
OUTSIDE `MentorDialogueProvider.ts`/the Conversation UI, both of which are
explicitly protected this phase (Rule #4):

- **Daily Check-In** — offered once, shortly after the Daily Brief nudge,
  if today's pick doesn't already exist. Options: every real subject, or
  "Not sure yet." Stored as `dailyCheckIn: { dateIso, subjectId }`.
- **Evening Reflection** — offered once the real Melbourne-local hour is
  ≥18 and the player has had real activity today
  (`userProgress.lastActiveDate === today`), if not already answered.
  Options: "Pretty manageable" / "Felt like a lot." Stored as
  `eveningCheckIn: { dateIso, feltManageable }`.

Neither answer is fed into `RecommendationEngine`/`GoalSystem`/
`ReflectionEngine` internals. Instead, `ai/CheckInFollowUp.ts`'s
`withDailyCheckInFollowUp` — a pure, CONSUMING-side function, called by
`Game3D.tsx`/`useMentorConversation.ts` AFTER a conversation is built —
prepends one honest line ("Earlier you said you'd focus on this today —
how's it going?") the next time that SAME subject's mentor is spoken to,
same day. This satisfies "responses influence later conversations"
without duplicating or rewriting any protected engine.

## 7. Relationship progression

| Dimension | Source | New this phase? |
|---|---|---|
| Trust | `mentorRelationship.ts`'s `points`/`level` | No — reused as-is |
| Consistency | `userProgress.streakCount` | No — reused as-is |
| Conversation count | `NpcMemoryEntry.conversationCount` | Yes (additive) |
| Advice followed | `NpcMemoryEntry.adviceLog` + heuristic | Yes (additive) |
| Milestones celebrated | `save.milestones` (Phase 11/22), filtered | No new state |

`conversationCount` increments once per real interaction inside the
EXISTING `recordNpcInteraction` mutation (every call site already goes
through it). `adviceLog` (capped at 20) appends a `{category, subjectId,
at}` entry whenever a conversation's advice stage had a topic. Both are
read together via `ai/MentorRelationshipStats.ts`'s
`getMentorRelationshipSummary`.

**"Advice followed" is an honest heuristic, disclosed as such**: it counts
real subsequent activity (a Focus Sprint or completed module in the
advised subject) within 48h of the advice — never a claim about the
player's actual intent. Subject-agnostic advice (take-a-break,
organise-room) can't be checked this way and is skipped, not
falsely counted.

**Relationship stage** (`getRelationshipStage`) reuses a subject mentor's
REAL `levelName` (New/Familiar/Supportive/Trusted/Inspired) unchanged; the
guide — who has no points/subject system — gets a conversation-count
staircase (New → Familiar → Regular → Trusted → Close at 0/3/8/15/25
conversations), the same "evolves naturally" shape derived from a
different, equally real signal.

## 8. Campus Life

`game3d/campus/campusLife.ts` adds two real-signal-gated rungs, both
hash-selected (never `Math.random`) and both ranked BELOW every real
academic signal already in `getMentorAdvice`'s/`getAmbientNpcLine`'s
ladders:

- **Milestone reactions** (`hasMilestoneToday`/`getMilestoneReactionLine`)
  — population NPCs and the guide can acknowledge a real milestone from
  today, reusing the SAME `save.milestones` log the Proactive Mentor
  Engine's own celebration triggers already filter.
- **Era-flavoured remarks** (`getCampusLifeRemark`) — one of 2 lines per
  `semesterCalendar.ts` era (early/mid/late/complete), framed as an
  overheard remark from "one of the other mentors."

"Mentors may occasionally speak to each other" is deliberately NOT live
two-NPC choreography (no NPC-to-NPC conversation system exists, and
building one is out of proportion to this phase) — the overheard-remark
framing satisfies the brief's actual intent ("campus feels alive, mentors
talk to each other") from the player's own perspective. Disclosed scope
decision, see §10.

## 9. Persistence

```ts
proactiveMentorLog: { triggerId: string; firedAt: string }[];   // capped 90
dailyCheckIn: { dateIso: string; subjectId: string | null } | null;
eveningCheckIn: { dateIso: string; feltManageable: boolean } | null;

// NpcMemoryEntry, additive:
conversationCount: number;
adviceLog: { category: string; subjectId: string | null; at: string }[];  // capped 20
```

All four fields/additions are safely coerced field-by-field in
`persistence.ts` (never throw on a corrupted/hand-edited save; a bad
entry is dropped, not fatal) and default to empty/null/0 on a fresh save
— the same discipline every prior phase's schema growth follows.

## 10. Future AI integration

The Proactive Mentor Engine is completely independent of dialogue
generation, exactly as the brief's "Future AI Ready" section asks:

- `ProactiveMentorEngine.ts` decides WHETHER/WHO/WHEN/PRIORITY/COOLDOWN —
  it never imports `RecommendationEngine.ts` or `ReflectionEngine.ts`
  (verified by the harness) and never generates a line beyond its own
  short, fixed `teaserLine`.
- The moment a player clicks "Talk," control passes to the UNCHANGED
  `ruleBasedMentorDialogueProvider.buildConversation(...)` — the exact
  same swap-in point Phase 23 already established. A future LLM-backed
  provider would replace ONLY that one call, never anything in this
  phase's trigger/cooldown/notification code.

## 11. Known limitations / scope decisions

- **NPC-to-NPC dialogue is an overheard-remark simplification**, not live
  two-NPC choreography (§8) — disclosed rather than silently
  under-delivered.
- **"Evening Reflection" has no real 'leaving for the day' signal** in a
  web app with no logout — a real-clock evening-hour check
  (`hour >= 18`) plus "had real activity today" is the honest, disclosed
  proxy (§6).
- **Daily Check-In / Evening Reflection are simple multiple-choice
  prompts, not conversation stages** — a deliberate choice to avoid
  touching the protected `MentorDialogueProvider.ts`/Conversation UI, and
  because no free-text input exists anywhere in this game (§6).
- **"Advice followed" is a heuristic**, not a certain read of causality —
  real subsequent activity within a 48h window, disclosed as such
  everywhere it's used (§7).
- **Conversation-variety expansion is scoped to `congrats`/`concern`**
  (the two categories Phase 24's celebration/care triggers surface most),
  not all 15 categories across all 4 voices — a proportionate,
  content-only addition rather than a full authoring pass.
- **Live browser verification** was not possible this session (the
  browser preview could not be reached); confidence instead comes from a
  clean typecheck/lint/production build, the 1135-check regression sweep
  (§12), and reuse of already-shipped, already-styled components/CSS
  variables throughout.

## 12. Performance considerations

- The proactive check is a single `window.setInterval` every 75s, not
  per-frame — an order of magnitude cheaper than the existing per-frame
  NPC schedule/pose work.
- `evaluateProactiveTriggers` is O(subjects + a few small array scans);
  the harness's own benchmark shows 200 full evaluations completing in
  well under 100ms.
- `proactiveMentorLog`/`adviceLog` are capped (90/20 entries), the same
  bounded-growth discipline every prior phase's additive log follows.

## 13. Verification totals

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
npx tsx scripts/verify-phase24-proactive-mentor.ts      # 80 passed, 0 failed
```

**Total: 1135 passed, 0 failed.** One real regression was caught and
fixed during this phase's own verification sweep: extending
`getAmbientNpcLine`'s signature with a new `save?` parameter BEFORE the
existing `now` parameter shifted `verify-phase20e-campus-expansion.ts`'s
old positional call (`getAmbientNpcLine(role, seed, now)`) so `now` landed
in `save`'s slot, crashing `hasMilestoneToday` on `save.milestones`. Fixed
by updating that one call site to pass `undefined` explicitly for `save`
— the new signature is correct and was kept; the stale call site was the
one that needed updating, the same "deliberate correct refactor, older
pinned check updated" pattern every prior phase has followed.

## 14. Stop condition — met

- Mentors begin conversations naturally via non-intrusive notifications,
  never a blocking popup.
- The mentor occasionally approaches the player (15 real, StudentContext-
  derived triggers) rather than always waiting to be spoken to.
- Daily limits, cooldowns, priority ordering, and full interruption
  suppression are all real and verified.
- Natural world events (waves, greetings, congratulations, "how did that
  go," previous-conversation references, absence notice, consistency
  celebration) all pre-existed via Phases 21/23 and remain in place,
  reinforced by the new proactive layer.
- Campus feels more alive via real-signal-gated ambient remarks — no
  random dialogue anywhere.
- Daily Check-In and Evening Reflection exist as honest, real,
  multiple-choice interactions whose answers are referenced descriptively
  in later dialogue.
- Mentor relationships track Trust, Conversation Count, Advice Followed,
  Consistency, and Milestones Celebrated, with a naturally evolving stage
  label.
- Notifications are lightweight, dismissible, and open real conversations
  when clicked.
- Dialogue pools were genuinely expanded (`congrats`/`concern`, all 4
  voices) with no repetition-prevention machinery duplicated (Phase 23's
  `recentTopics` system already covers that).
- The proactive system is completely independent of dialogue generation —
  `ProactiveMentorEngine.ts` never imports `RecommendationEngine.ts` or
  `ReflectionEngine.ts`, and a future LLM would only ever replace
  `ruleBasedMentorDialogueProvider`, never this phase's code.
- StudentContext, RecommendationEngine, ReflectionEngine, MentorPlanner,
  MentorDialogueProvider, and the Conversation UI were all consumed, never
  rewritten or replaced (verified textually by the harness).
- All regression harnesses remain green — 1135/1135 (§13).
