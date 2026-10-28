# Phase 21 — Mentor Relationships, Living Campus & Academic Companion

Extends the Phase 20-complete 3D Campus with a relationship layer, campus
memory, social life, and a private auto-generated journal. No existing
system was redesigned: every part below either composes existing engines
(`mentorRelationship.ts`, `mentorDialogue.ts`, `simulation.ts`,
`semesterCalendar.ts`, `npcSchedule.ts`, `roomEvolution.ts`, `milestones.ts`)
into something new, or adds one small, additive, save-safe module beside
them. Nothing in this phase touches Voice AI, LLM conversations,
multiplayer, procedural dialogue, backend AI services, or internet APIs —
every dialogue line, mood, and observation is a pure function of data
already in the save.

## 1. Pre-flight audit — what already existed

Before writing anything new, the following were confirmed as complete,
correct, and directly reusable:

- **`src/lib/mentorRelationship.ts`** — `computeMentorRelationship(save,
  subject)` already derives a deterministic `{ points, level (1-5),
  levelName, progress, stats }` from real sprints/modules/assessments/visit
  days. Untouched this phase.
- **`src/lib/mentorDialogue.ts`** — a ~550-line, fully-authored, per-subject
  priority-ladder dialogue engine with 4 distinct voices (one per real
  subject), 14 tonal categories each, deterministic by day-of-year +
  subject hash. Untouched — but, critically, it was **only ever wired into
  the legacy 2D `WorldScene.tsx`**; the 3D Campus's subject mentors all
  spoke through a separate, generic, non-subject-specific line generator
  (`npcGreetings.ts`'s `getMentorAdvice`), meaning every 3D subject mentor
  sounded identical. Fixing this was Part 7's actual work (§7).
- **`src/lib/simulation.ts`** — `computeSubjectSimState()` already derives a
  `MoodBucket` (`relaxed | content | focused | stressed | tired`) per
  subject. This already **is** Part 1's "Current Mood" — no new mood
  classifier was built.
- **`src/game3d/characters/npcSchedule.ts`** — a pure, deterministic,
  waypoint-list-driven NPC schedule engine (Phase 20C), directly reusable
  for Part 4's "social campus" via new CONTENT (waypoint lists), not new
  engine code.
- **A confirmed bug**: `recordRoomVisit()` — the mutation that increments a
  subject's `mentorBonds[subjectId].visitDays` once per Melbourne day — was
  called only from the legacy 2D `WorldScene.tsx`. The 3D Campus never
  called it, so the entire points-based relationship system was silently
  inert for every 3D-Campus player, regardless of what they did in-world.
  Fixed in Part 1 (§1).

## 2. Part 1 — Relationship architecture

New file **`src/lib/npcRelationship.ts`**. Every field the brief asks for
(Level, Trust, Familiarity, Mood, Unlocked Topics) is a **pure function of
existing save data** — nothing new is persisted for any of them:

- `computeTrust(relationship)` — 0–100, proportional to `points` against
  the top level threshold.
- `computeFamiliarity(visitDays)` — a 5-tier label (`New Face` →
  `Acquaintance` → `Regular` → `Familiar` → `Close`) from real visit-day
  counts.
- `getMentorMood(sim)` — returns `sim.mood` directly (already exists,
  §1).
- `getUnlockedDialogueTopics(relationship)` — gates 3 topic tiers on
  `relationship.level`.
- `buildSubjectMentorRelationshipView()` — composes all of the above into
  one object, so callers never re-derive it differently.

The one genuinely NEW persisted concept in this whole phase is
`NpcMemoryEntry` (last line said + when) — because a chosen dialogue line
cannot be re-derived after the fact. Everything else stays derived,
per the brief's "no hidden randomness" / "data-driven" requirement.

Also fixed here: `Game3D.tsx` now calls both `recordRoomVisit` (subject
buildings) and the new `recordBuildingVisit` (all 6 real campus locations)
on every scene change, closing the dead-`visitDays` bug from §1.

## 3. Part 2 + 6 — Daily mentor insights & study companion

New file **`src/game3d/campus/dailyMentorInsights.ts`**. A small,
additional priority ladder of *comparative/aggregate* observations — the
one thing no existing engine derives, since they all compare **across**
subjects/buildings/time, not within one:

1. Sustained streak (14+ days) → "take a break" care signal.
2. Confirmed assessments due within 7 days (1, or 2–3) → the brief's own
   example lines verbatim style.
3. Strongest subject — cross-subject `computeMentorRelationship` points
   comparison, only reported with real separation (never a coin-flip
   between two close subjects).
4. Most-visited building (3+ visit days) — from the new `buildingVisits`
   field.
5. Consistent study (3+ day streak).
6. Empty room (zero unlocks) → "organise your room" suggestion.

Wired as an **additional rung** into the existing `getMentorAdvice` ladder
in `npcGreetings.ts` — inserted between the achievement-congratulations
check and the old generic streak line, so specific real-data observations
outrank generic encouragement. Nothing here invents an academic fact; every
number traces back to `mentorRelationship.ts`, `buildingVisits`, or
`userProgress`.

## 4. Part 3 — Campus memory (recognition, not conversation)

New file **`src/lib/npcMemory.ts`**. Exactly what the brief asks for and
nothing more: `applyRecognition(freshLine, memory, npcKey, now)` swaps in a
short, deterministic acknowledgement ("Back again — good.") if the NPC has
already spoken to the player today; otherwise the fresh line passes through
unchanged. `recordNpcInteraction` stores whichever line was actually shown.
No dialogue tree, no branching conversation — a second same-day visit reads
as recognition, never a repeated or extended script.

## 5. Part 7 — Subject personality (wired, not invented)

The 4 subject voices the brief asks for (Software Engineering: practical/
structured/builder; Cloud Computing: technical/modern/curious; Project
Management: organised/leadership/planning; Professional Practice: career/
communication/growth) **already existed in full** in `mentorDialogue.ts`
(§1) — they simply weren't reachable from the 3D Campus. Part 7's actual
work was wiring `Game3D.tsx`'s `npc-chat` handler to call
`getMentorLine({ save, subject, sim, relationship, calendar,
nextItemTitle, nextIsAssessment })` — the exact construction pattern
`WorldScene.tsx` already used — for every subject-building mentor,
gated on a new `subjectId` field added to the `npc-chat` interact action.
No new personality content was authored; the existing rich voices are now
simply heard in both renderers.

## 6. Part 4 — Social campus

Two additions, both pure content + one small, deliberately-scoped engine
extension:

- **Proximity wave** — `BuildingNpcDefinition` gained an optional
  `interactableId` (defaults to the NPC's own id); `CampusBuildingScene`
  now passes `waving={inRange?.id === (npc.interactableId ?? npc.id)}` to
  `NpcCharacter`, which overrides its scheduled pose to `"wave"` whenever
  the player is in range of that NPC's own interactable — never mid-walk
  (no teleporting into a stopped pose). This is the one genuinely new
  runtime behaviour in this phase; everything else is content.
- **Study/sit/coffee together** — the Library gained two student NPCs
  (`study-buddy-a`/`b`) seated at the two reading-table chairs
  `LibraryDressing` already renders, running read-heavy schedules for their
  entire cycle so they read as continuously studying together. The Student
  Lounge gained a second visitor (`lounge-visitor-b`) seated at the lounge
  table's other chair, running an overlapping coffee/talk schedule with the
  existing visitor.
- **Scope decision (disclosed, not silently dropped)**: "walk between
  buildings" was interpreted narrowly. A real cross-scene NPC that persists
  and walks between the 6+4 separately-loaded campus scenes would require a
  new, larger, cross-scene NPC state system — explicitly out of scope per
  the brief's own "no new major gameplay system" discipline elsewhere in
  Phase 20. Left as a known limitation (§10) rather than over-built.

## 7. Part 5 — Campus events

New file **`src/game3d/campus/campusEvents.ts`**. One event
(Library Study Group / Coffee Break / Guest Lecture / Career Fair / Coding
Workshop / Assignment Help Session) is "on" campus-wide per calendar day,
picked by the same date-hash rule every other deterministic-per-day pick in
this codebase already uses. Surfaced as exactly one ambient sentence in the
Daily Brief — no button, no tracking, no mechanical effect, per "events
should influence ambience only, no quest system."

## 8. Part 8 — Player Journal

New screen **`src/screens/PlayerJournalScreen.tsx`**, reached via
Menu → Profile → **Memories** (a new sub-tab, deliberately distinct from
the pre-existing, player-*edited* "Journal" tab / `StudyJournalScreen.tsx`
— the brief's journal is explicit that it must be "read-only.
Auto-generated," which is a different contract from that existing
create/edit/delete study-log feature, so neither replaces the other).
Composes, read-only:

- Study streak (`userProgress`)
- Favourite places (new `buildingVisits`, cross-referenced against
  `campusMap.ts`)
- Achievements (existing `milestones` log, filtered)
- Completed assessments (existing `assessmentProgress`)
- Mentor comments (new `npcMemory`, cross-referenced to subject names)
- Milestones (existing `milestones` log, the rest)

No new derivation logic lives in this screen — only display and
re-grouping of data every other Phase 21 or earlier engine already
produces.

## 9. Part 9 — Campus atmosphere

New file **`src/game3d/campus/campusAtmosphere.ts`**. Two honestly-derivable
signals, kept deliberately subtle (the brief's own instruction):

- **Exam week** — `semesterCalendar.ts`'s existing `period === "exams"`.
- **"Holiday"** — read as "no active teaching period" (pre-semester,
  finished, or unconfirmed), the only honest stand-in available:
  `SemesterRecord.breaks[].range` is documented free text with **no
  parseable date range** (`academicRoadmap.ts`), so it was deliberately
  *not* used to fabricate a break-date check.
- **Season** — a pure function of the real calendar month (Southern
  Hemisphere, matching Melbourne).

Layered as an additional ambience-sound tier under a building's own
ambience and the existing time-of-day tier (never replacing either), plus
one optional ambient sentence in the Daily Brief — null on an ordinary
teaching-period day, so it rarely stacks with the Campus Events line.

## 10. Known limitations

- **"Walk between buildings" (Part 4)** is not literally implemented — no
  NPC currently persists across a scene boundary. Scoped out deliberately
  (§6) rather than building a new cross-scene NPC-persistence system.
- **"React to the player's presence" (Part 4)** is implemented as a
  proximity wave keyed to each NPC's own interactable, not a general
  distance-based reaction system — sufficient for every mentor/staff NPC
  (all of which have exactly one associated interactable) but not extended
  to the purely-decorative background NPCs (e.g. `ROOM_NPCS` in Campus HQ),
  which keep their Phase 20C ambient behaviour unchanged.
- **Seasonal "decorations" (Part 9)** are ambience (sound + one Daily Brief
  sentence) only, not new 3D geometry per building — consistent with this
  codebase's existing time-of-day philosophy ("never a lighting-philosophy
  change... never geometry") and the brief's own "keep subtle."
- **Live browser verification** of the new UI (Memories tab, Daily Brief's
  two new ambient lines, the in-world wave) was not possible in this
  session (the browser preview tab could not be reached); confidence
  instead comes from a clean typecheck/lint/production build, the full
  regression sweep, and the fact that every new UI element re-uses
  already-shipped, already-styled components/classes rather than
  introducing new ones.
- **No actual audio files** exist yet for the two new `SoundEvent`s
  (`exam-week-hush`, `campus-quiet`) — consistent with this codebase's
  existing "hooks now, assets later, missing files fail silently" sound
  architecture; nothing depends on them actually playing.

## 11. Verification totals

Ran from the repo root:

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
```

**Total: 923 passed, 0 failed** across typecheck, lint, production build,
and 7 harnesses (6 pre-existing Phase 20 harnesses re-run unmodified, plus
one new Phase 21 harness covering relationship determinism, recognition
timing, daily-insight correctness, NPC-schedule/wave wiring, campus-event
and campus-atmosphere determinism, Journal read-only-ness, and save
compatibility for the two new save fields).

The new Phase 21 harness follows the same discipline as every prior Phase
20 harness: pure data/logic modules are imported and exercised directly;
behaviour that only exists inside a React component body (the `waving`
proximity override, the Menu's new Memories sub-tab wiring, the Journal's
read-only markup) is verified by reading the actual source text and
asserting on it — proving the wiring exists as written, not that it
behaves correctly at runtime, the same honest trade-off every prior
harness in this codebase already discloses.

## 12. Stop condition — met

- **Mentors recognise the player** — `npcMemory.ts`'s recognition system,
  wired into every subject-mentor and guide interaction.
- **Relationships persist** — deterministic, derived entirely from
  already-persisted save data (points/visitDays/mood), plus the one new
  genuinely-persisted field (`npcMemory`'s last line).
- **Campus feels socially alive** — subject-mentor voices now heard in the
  3D Campus (§5), students studying/sitting/drinking coffee together
  (§6), NPCs waving when approached (§6), a small daily campus event (§7).
- **Journal works** — `PlayerJournalScreen.tsx`, read-only, auto-generated,
  reachable from Menu → Profile → Memories.
- **Dialogue is contextual** — `dailyMentorInsights.ts` (§3) plus the
  existing rich per-subject voice ladder (§5), both reusing only real
  Academic Intelligence data.
- **Regression passes** — 923/923 checks (§11).
