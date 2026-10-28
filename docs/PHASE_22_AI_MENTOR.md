# Phase 22 — AI Mentor Core & Adaptive Study Intelligence

A new `src/ai/` module that turns UniGame's mentor system from reactive
("here's what you asked about") into proactive coaching ("here's what
matters right now, and why"). Everything is a deterministic pure function
over `UniGameSaveData` — no LLM, no internet service, no hidden scoring.
Nothing in Phase 20/21's architecture was redesigned; every AI module
composes existing engines (`mentorRelationship.ts`, `simulation.ts`,
`semesterCalendar.ts`, `priority.ts`, `roomEvolution.ts`, `todayEngine.ts`,
`academicWorkload.ts`, `campusMap.ts`, and Phase 21's `npcMemory.ts`/
`milestones.ts`) rather than re-deriving what they already compute.

## 1. Architecture

```
src/ai/
  ContextEngine.ts        Part 1 — builds the single StudentContext snapshot
  ConfidenceModel.ts       Part 2 — per-subject 5-tier confidence estimate
  RecommendationEngine.ts  Part 3 — prioritised, evidence-backed suggestions
  ReflectionEngine.ts      Part 5 — weekly, supportive, week-over-week
  GoalSystem.ts            Part 6 — adaptive daily goals + journal memories
  MentorPlanner.ts         Part 7 — one dialogue line, priority-ordered
```

Every module above other than `ContextEngine.ts` takes a `StudentContext`
(plus `save`/`now` only where an existing pre-Phase-22 engine still needs
the raw save directly — `todayEngine.ts`'s phrasing functions). Nothing
outside `ContextEngine.ts` re-derives module progress, mentor relationship
points, room-evolution stage, or workload — they all read it off the
Context or a Phase-22 sibling module.

UI consumers (Part 4/8/9):

```
DailyBriefPanel.tsx        Adaptive recommendations + "Why?" evidence toggle
AiMentorDashboard.tsx       7 cards, reusing the pre-existing (previously
                            unused) DashboardCardShell/.dashboard-grid chrome
ProfileScreen.tsx           mounts AiMentorDashboard under "Your AI Mentor"
```

## 2. Data flow

```
UniGameSaveData
      │
      ▼
buildStudentContext(save, now)  ──────────────►  StudentContext (frozen)
                                                        │
        ┌───────────────┬───────────────┬──────────────┼───────────────┐
        ▼                ▼               ▼              ▼               ▼
computeSubjectConfidence  generateRecommendations   generateWeeklyReflection
  (ConfidenceModel.ts)      (RecommendationEngine.ts)    (ReflectionEngine.ts)
        │                        │                            │
        └───────────► planMentorMessage (MentorPlanner.ts) ◄──┘
                                  │
                    generateDailyGoals / syncGoalMilestones
                              (GoalSystem.ts)
                                  │
                                  ▼
                    saveData.milestones (kind: "goal-complete")
                       — the ONE new persisted fact this phase
                         adds beyond the additive buildingVisitLog
```

`buildStudentContext` is called once per render/effect and its result is
`Object.freeze`d — "output a single immutable Context object." Every
downstream module is a pure function of that object (plus `save`/`now`
where noted); nothing mutates it, and nothing recomputes a value it
already carries.

### The one new save field

`buildingVisitLog: BuildingVisitLogEntry[]` (`{sceneId, dateIso}`,
domain.ts) — the existing `buildingVisits` record only ever stores a
lifetime total + the single most recent date, which cannot answer "how
many times did you visit the Library **this week**" (Part 5's own
example). `recordBuildingVisit` (Phase 21, `SaveDataContext.tsx`) now
appends to this log on the same "new Melbourne day" gate it already used,
capped to the most recent 90 entries so a long-lived save never grows
unbounded. `sanitizeSaveData` coerces and caps it on load; a corrupted or
missing log degrades to `[]`, never a throw.

`MilestoneEntry.kind` gained one new member, `"goal-complete"` — completed
goals need a timestamp the same way achievements/bond-levels/room-stages
already do (`milestones.ts`'s own stated reason for existing at all), so
`GoalSystem.ts`'s `syncGoalMilestones` reuses that exact log and
convergence contract rather than inventing a parallel one.

## 3. Recommendation rules (Part 3)

`generateRecommendations` pools independent candidate generators and
sorts by priority (0-100), never a first-match ladder — "generate
prioritised recommendations" means a ranked list, not one line:

| Category | Fires when | Priority |
|---|---|---|
| `overdue` | A confirmed assessment's due date/time has passed and it isn't submitted/graded | 100 (always highest) |
| `assessment-prep` | An upcoming confirmed assessment is due within 2 days | 70–95, scaled by days-until-due |
| `module-work` / `assessment-prep` | `todayEngine.ts`'s existing, unmodified `getTopPriorityItems` ranking, reused verbatim | that item's own `priority.score` |
| `lecture-review` | A real scheduled class exists today (`getTodaysClasses`) | 55 |
| `subject-focus` | One subject's 7-day focus minutes trail the others by 20+ min (real separation required, never a coin-flip) | 50–90 |
| `take-a-break` | A 14+ day streak | 65 |
| `organise-room` | Zero furniture unlocked yet | 40 |
| `visit-library` | Library visit days ≤1 AND it's the least-visited of the player's regular spots | 35 |

Every recommendation carries `priority`, `reason` (a real sentence built
from the same numbers), `estimatedDurationMinutes`, `confidence` (the
5-tier vocabulary from `ConfidenceModel.ts`, reused for a different
score — "how strong is the evidence for this suggestion," not subject
mastery), and `evidence: PriorityReason[]` — the identical `{label,
contribution, max}` shape `priority.ts` already defined for exactly this
purpose. Nothing is fabricated: a rule with no supporting evidence in the
save produces no candidate at all.

## 4. Confidence model (Part 2)

Five tiers only — Very Low, Low, Developing, Strong, Excellent — never a
percentage, letter grade, or predicted mark. A 0-100 internal score picks
the tier and is never itself displayed. Four weighted factors, each
tracing to an existing engine:

- **Module progress & recent momentum** (max 35) — `simulation.ts`'s
  existing `SubjectSimState.confidence`, reused verbatim, not recomputed.
  Deliberately distinct from THIS model: `sim.confidence` is a short-term
  mood input (module progress + a 7-day completion window) feeding room
  ambience; this model is a longer-horizon readiness estimate that also
  weighs mentor bond and room stage, neither of which `sim.confidence`
  considers.
- **Assessments completed** (max 30) — submitted/graded ratio for that
  subject's own assessments.
- **Mentor bond level** (max 20) — `computeMentorRelationship(...).level`
  (1-5), a proxy for consistency/interaction depth.
- **Room stage** (max 15) — `computeRoomEvolution(...).stage` (0-4).

## 5. Weekly reflections (Part 5)

Rolling 7-day windows ("this week" vs the 7 days before), never
calendar-week-aligned (works identically whether or not the semester
start date is confirmed). Four possible statements — consistency
(distinct active study days), building visits (from the new
`buildingVisitLog`), strongest subject routine (real separation required),
assessments completed — each independently present only when the save's
own data supports it. **Never shames**: a week that's quieter than the
last simply produces no consistency statement, rather than a negative
comparison.

## 6. Mentor Planner priority order (Part 7)

Exactly the brief's own order, first-match:

1. Urgent deadline (overdue, then due within 2 days)
2. Celebrate a recent achievement (within 48h — an old achievement
   congratulated daily would feel hollow, not personal)
3. Encourage consistency (3+ day streak)
4. Suggest next action (`RecommendationEngine`'s top pick)
5. Reflect on improvement (`ReflectionEngine`'s first statement)
6. Fallback generic encouragement (never empty)

"Avoid repetition" is deliberately NOT reimplemented here — Phase 21's
`npcMemory.ts`'s `applyRecognition` already solves exactly this; callers
pass this planner's line through that same function, one repetition guard
rather than two.

## 7. Explanation system (Part 8)

No separate module — the "system" is the combination of (a) every
recommendation already carrying `evidence` (Part 3) and (b) a "Why?"
toggle in both UI surfaces that renders it verbatim (label +
contribution/max, nothing hidden): the Daily Brief's "Recommended For
You" list and the Dashboard's "Recommended Next Action" card.

## 8. Dashboard evolution (Part 9)

Seven cards under Menu → Profile → **Your AI Mentor**
(`AiMentorDashboard.tsx`), reusing `DashboardCardShell`/`.dashboard-grid` —
Phase 5 chrome that had no live screen wired to it until now:

- **Academic Health** — "On Track" / "Needs Attention" (overdue-driven,
  never a fabricated progress-expectation curve)
- **Confidence Overview** — each subject's tier, from `ConfidenceModel.ts`
- **Current Focus** — the subject with the most Focus Sprint time this
  week (descriptive — what you've been doing)
- **Workload** — the current teaching week's Low/Medium/High/Peak
  (`academicWorkload.ts`, unchanged), or "Not available" when the
  semester start isn't confirmed
- **Momentum** — current streak + total focus minutes this week
- **Weekly Reflection** — `ReflectionEngine`'s statements
- **Recommended Next Action** — the top recommendation, with its own
  "Why?" toggle (prescriptive — what to do next)

## 9. Known limitations

- **Confidence and workload are relative/categorical by design**, never
  an absolute measure comparable across different students or courses —
  consistent with the brief's "never invent grades, never predict marks."
- **Weekly reflection windows are rolling 7-day, not calendar-week** —
  simpler and always well-defined, but "this week" won't always align
  with a Monday-Sunday view some players might expect.
- **The Mentor Planner's output isn't yet wired into the in-world 3D
  dialogue** (`Game3D.tsx`'s `npc-chat` handler still uses Phase 21's
  `getMentorAdvice`/`getMentorLine`) — deliberately scoped this way to
  avoid touching Phase 21's already-tested, per-subject-voiced dialogue
  system. `planMentorMessage` currently powers the Daily Brief/Dashboard
  surfaces only; wiring it into in-world speech is a natural, low-risk
  follow-up (see §10).
- **"Visit every subject room" (GoalSystem)** only checks `mentorBonds[
  subjectId].lastVisitDate === today`, which is already exactly what
  Phase 21's `recordRoomVisit` maintains — accurate, but it means the goal
  can only ever be evaluated for subjects the player has a room for.
- **Live browser verification** of the new UI (Daily Brief's "Why?"
  toggle, the Dashboard's 7 cards) was not possible in this session (the
  browser preview tab could not be reached); confidence instead comes
  from a clean typecheck/lint/production build, the full regression
  sweep, and reuse of already-shipped, already-styled components.

## 10. Future AI integration points

This phase's explicit goal is "the intelligence layer every future AI
capability will build upon" — concretely, the seams a future phase could
extend without touching anything above them:

- **`StudentContext` is the one integration surface.** A future
  LLM-backed conversational layer (explicitly out of scope this phase)
  would consume this same object as its prompt context — never re-derive
  save data itself — keeping any future AI service a thin, swappable
  layer over deterministic ground truth.
- **`RecommendationEngine`'s candidate-generator list is append-only** —
  a new recommendation category is one more function added to the pool in
  `generateRecommendations`, no existing rule touched.
- **`MentorPlanner`'s priority ladder is a fixed array of `?? `-chained
  functions** — inserting a new topic between two existing priorities is
  a one-line change.
- **`planMentorMessage`'s output shape (`topic`/`line`/`evidence`) is
  already what an in-world dialogue call site would need** — wiring it
  into `Game3D.tsx` alongside (not replacing) Phase 21's per-subject
  voices is the natural next integration, deferred this phase per §9.

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
```

**Total: 994 passed, 0 failed** across typecheck, lint, production build,
and 8 harnesses (7 pre-existing harnesses re-run unmodified except one
regression guard updated to match a deliberate, correct refactor — see
below — plus one new Phase 22 harness covering context generation,
confidence calculation, recommendation ordering, reflection generation,
goal generation + milestone convergence, mentor-planner priority
ordering, explanation-evidence bounds, dashboard rendering, and save
compatibility for the two new save-schema additions).

Two pre-existing regression guards needed updating, both because Phase 22
correctly changed behaviour they were pinned to, not because of a
regression:
- `verify-phase21-mentor-relationships.ts` — `PlayerJournalScreen.tsx`'s
  favourite-buildings derivation moved to a shared `getFavouriteBuildings`
  helper (`campusMap.ts`), now also used by `ContextEngine.ts` — the
  check was updated to look for the new call site.
- `verify-phase20f-vertical-slice.ts` — the Daily Brief's old two-section
  "Suggested Study Block" + "More Suggestions" split (the original source
  of that phase's duplication bug) was replaced by one unified
  "Recommended For You" list — the check was updated to confirm the new,
  structurally non-duplicating list replaced the old split, not to look
  for the old section names.

## 12. Stop condition — met

- **The AI Mentor operates entirely from the Context Engine** —
  `RecommendationEngine`, `ReflectionEngine`, `MentorPlanner`, and
  `GoalSystem` all consume `StudentContext`; none re-derives save data.
- **The Daily Brief is adaptive** — "Recommended For You" is built from
  `generateRecommendations`, with a "Why?" evidence toggle per item.
- **Recommendations are contextual** — every one traces to real,
  currently-true save data (§3).
- **Weekly reflections work** — `generateWeeklyReflection`, wired into
  the Dashboard.
- **Goals adapt automatically** — `generateDailyGoals` includes/excludes
  templates based on real context (subject count, remaining assessments,
  an active streak).
- **Everything is deterministic** — no `fetch`/`XMLHttpRequest`/
  `WebSocket` anywhere in `src/ai/` (verified in the harness, §9 of the
  harness itself).
- **All regression harnesses remain green** — 994/994 (§11).
