# Phase 19 — Academic Intelligence

Architecture for a derived-intelligence layer on top of Phases 18A–18F's
academic-import pipeline. This phase adds NO new source, NO new save-data
write path, and NO change to Review/Apply/Undo's mechanics — it only (a)
extends the canonical import model with additional optional, sourced,
never-invented fields, and (b) adds pure, derived, read-only engines that
compute structure, workload, priority, and recommendations from whatever
academic data the user has already applied to their live save. Everything
still flows through `Source → AcademicImportPackage → Review → Apply →
Undo`, exactly as documented in `docs/PHASE_18A_IMPORT_ARCHITECTURE.md`.

## 1. Pre-flight audit — what already exists (read in full this phase)

This audit's single most important finding: **much of what Phase 19 asks
for already exists**, built across Phases 2–17 as pure derived selectors
over `UniGameSaveData`. Phase 19's real job is to (a) extend the canonical
*import* model so richer academic facts can be captured and applied in the
first place, and (b) build the smaller set of genuinely new engines those
facts unlock, while explicitly reusing everything below rather than
duplicating it.

**Canonical import model** (`src/import/types.ts`, unchanged by this
phase): `ImportedSubjectCandidate` / `ImportedModuleCandidate` /
`ImportedAssessmentCandidate` / `ImportedCalendarCandidate` /
`ImportedAnnouncementCandidate` (Phase 18E) each already carry
`ConfidenceLevel`, `FieldConfidence<T>`, and `SourceReference[]` — Part 9's
"every extracted field receives confidence, source reference, document
location, extraction method" is **already the existing mechanism**, not a
new one. Part 9's "manual override flag" is the one genuinely new bit
(§9 below).

**Domain model** (`src/types/domain.ts`, unchanged by this phase):
`ModuleRecord` today is `{ id, subjectId, moduleNumber, title, overview,
suggestedTasks, miniGameIdeas, sourceNote }` — no readings, lecture/
tutorial/lab schedule, learning outcomes, or prerequisites exist yet. This
is the concrete gap Parts 1/2/8 fill, additively.

**`src/lib/semesterCalendar.ts`** (Phase 11, unchanged): `getSemesterCalendar()`
already derives `currentWeek`, `totalTeachingWeeks`, `weekStarts` (ISO
Monday of every teaching week), `assessmentWeeks`, `period`
(pre-semester/teaching/revision/exams/finished), and `era` — entirely from
the semester's own confirmed dates plus applied assessment deadlines, never
inventing a date. **This is the week-numbering foundation Part 3's "Week"
entity and Part 4's timeline both build on directly — neither reimplements
week math.**

**`src/lib/simulation.ts`** (Phase C, unchanged): `computeSubjectSimState()`
already derives a PER-SUBJECT, PER-ROOM numeric `workload` (0-100, from
incomplete-module ratio + deadline proximity) that drives mood/room-status/
mentor speech. **This is a different thing from Part 5's ask** (a
PER-WEEK, semester-wide, categorical Low/Medium/High/Peak signal for
planning). Part 5 is new, additive, and must not be confused with or
replace `sim.workload` — both coexist, serving different consumers (mood/
room ambience vs. planning/timeline).

**`src/lib/priority.ts`** (unchanged): `computeModulePriorities()` /
`computeAssessmentPriorities()` / `getTopPriorityItems()` already rank
every incomplete module and assessment by a transparent, reasoned score
(weight, urgency, confirmation state, actionability) and already power
"today's focus" on Semester HQ and the Priority Centre screen. **This is
already most of Part 6's Today Engine** — due dates, weighting, progress,
and time-remaining are already the scoring inputs, and it is already
read-only (a pure selector; nothing calls back into mutation). Part 6's
real new work is a thin recommendation-phrasing layer over
`getTopPriorityItems()` (turning a ranked module/assessment into "Read
Module 5" / "Finish Tutorial" style text using the new Part 8 module
fields) plus a "user preferences" input that doesn't exist yet (§6).

**`src/lib/mentorDialogue.ts`** (Phase 17, unchanged): `getMentorLine()`
already runs a documented priority ladder that references real streaks,
workload, calendar period/era, current module, and next-priority item —
entirely deterministic (day-of-year + subject hash indexing, no LLM). Part
12's "NPCs should understand current week/module/upcoming assessment/
workload/readings, deterministic, no LLM" is **already true for
everything except "current week" and "readings"**, which Part 8's new
module fields make addable as one or two more nav-hint lines (§12).

**`src/world/WorldUiContext.tsx`**'s `locateInWorld({ title, subjectId,
sceneId, interactableId, urgency })` (Phase 15A, unchanged) is the existing,
proven "jump to a room and track an objective" mechanism —
`SubjectsPanel.tsx` already calls it with `sceneId: "room-<subjectId>"` and
`interactableId: "assessments" | "modules"`. **Part 13's search results
"link directly into rooms" by calling this exact function** — no new
navigation primitive is needed.

**`src/screens/TimelineScreen.tsx`** (Phase 11) is a RETROSPECTIVE event
log (semester start, focus sprints, module completions, achievements — all
past, all already-recorded). **This is a different concept from Part 4's
"Timeline"** (a forward-looking weekly/assessment/study/exam roadmap). To
avoid confusion, this phase's new forward-looking construct is called the
**Academic Roadmap** internally (`src/lib/academicRoadmap.ts`) — the
existing `TimelineScreen.tsx` is untouched; the new roadmap is surfaced via
the Study Planner (Part 11) and, where useful, the existing Calendar screen.

**Merge/conflict engine** (`src/import/merge/mergeEngine.ts`, `ConflictKind`
in `src/import/types.ts`): already additively extended twice (Phase 18E's
`canvas-remote-item-removed`, Phase 18F's `moodle-remote-item-removed`).
Part 7's new conflict kinds follow the identical pattern — new union
members, new detection functions, flowing through the same
`mergeSourcePackages`/`resolveConflict`/Review pipeline, preserving every
existing regression test (`scripts/verify-phase18d-conflicts.ts`).

**Apply/Undo** (`src/import/applyImport.ts`): confirmed, again, to be a
pure `(save, pkg, selection) => save` reducer operating only on
`AcademicImportPackage`'s existing candidate shapes — extending those
shapes additively (Part 1/2) requires new merge logic INSIDE
`mergeModuleIntoSubject`/`mergeAssessmentIntoSubject` to carry the new
fields onto `ModuleRecord`/`AssessmentRecord`, but the transactional
validate→backup→diff→confirm→commit shape and the whole-save-snapshot Undo
mechanism need zero changes — new fields ride along with the record they
belong to, exactly like every field added in Phases 18A–18F.

**Extraction engine** (`src/import/extraction/{subjectRules,moduleRules,
assessmentRules,proseAssessmentRules}.ts`): a deterministic, rules-based
(regex/keyword/positional heuristics — no ML/LLM) extractor already
production-proven across PDF/DOCX/text/JSON providers. Part 1/2's new
fields (readings, learning outcomes, lecture/tutorial/lab schedule, exam
info, coordinator email) are added as new rule modules in this SAME
directory, following the identical "never invent, confidence + source
reference per field" discipline — not a parallel extraction system.

## 2. What genuinely does NOT exist yet (the real Phase 19 scope)

1. Canonical-model + domain-model additive fields for readings, learning
   outcomes, lecture/tutorial/lab timetable entries, exam info, prerequisite
   links, coordinator email (Part 1/2/8).
2. Extraction rules populating the above from subject/assessment guides,
   teaching plans, lecture schedules, reading lists (Part 1/2).
3. An internal, derived **Academic Knowledge Graph** connecting Subject/
   Module/Week/Assessment/Reading/Lecture/Tutorial/Lab/Exam/Outcome/Topic
   entities (Part 3) — never rendered directly; every other new engine
   reads it.
4. The **Academic Roadmap** (Part 4) — weekly/assessment/study/exam
   roadmap views built from the knowledge graph + `semesterCalendar.ts`.
5. The **Workload Level engine** (Part 5) — per-week Low/Medium/High/Peak,
   distinct from `simulation.ts`'s per-subject numeric workload.
6. A thin **Today Engine** recommendation-phrasing layer over the existing
   `getTopPriorityItems()` (Part 6), plus a genuinely new "user
   preferences" input.
7. New `ConflictKind` members + detection functions (Part 7).
8. Review UI support for the new candidate field types (Part 10) — Accept/
   Reject/Edit/Merge/Ignore already exist as concepts in `ReviewStep.tsx`;
   the new field types need rows/controls added.
9. The **Study Planner** screen/panel (Part 11) — new UI, built on the
   existing `TaskRecord` store and the new roadmap/workload engines.
10. A handful of new mentor nav-hint lines referencing current week/readings
    (Part 12) — additive lines inside the existing ladder.
11. **Academic search** (Part 13) — new search function over knowledge-graph
    entities, results routed through the existing `locateInWorld`.

## 3. Additive canonical-model extensions (Part 1/2/8/9)

**Design choice, made before writing any code:** unlike Canvas's
announcements (Phase 18E) or Moodle's calendar events (Phase 18F) — which
are independent top-level package entities linked to a module/subject only
by a cross-reference, because they have their own identity and lifecycle —
readings, schedule entries, and learning outcomes are logically OWNED by
exactly one module (a teaching week) and never exist independently of it.
They are therefore embedded as NESTED arrays directly on
`ImportedModuleCandidate`, not top-level package arrays with a
resolve-at-Apply cross-reference step. This is simpler, has less surface
area, and avoids inventing an unnecessary indirection — the same "why"
Phase 18E's own audit gave for keeping module→assignment linking a direct
reference rather than a third top-level collection.

New candidate types in `src/import/types.ts` (all optional/additive on
existing interfaces — no required field changes anywhere):

```ts
export interface ImportedReadingCandidate {
  temporaryId: string;
  title: string;
  kind: "required" | "recommended";
  author: string | null;
  url: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

export interface ImportedScheduleEntryCandidate {
  temporaryId: string;
  kind: "lecture" | "tutorial" | "lab";
  title: string;
  dayOfWeek: string | null;   // as stated in source, e.g. "Tuesday" — never computed from a week number
  startTime: string | null;   // "HH:mm", only when explicit
  endTime: string | null;
  location: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}

export interface ImportedOutcomeCandidate {
  temporaryId: string;
  text: string;
  /** Learning outcomes are usually numbered in the source ("LO1", "CLO3") — kept verbatim, never renumbered. */
  code: string | null;
  sourceReferences: SourceReference[];
  confidence: ConfidenceLevel;
}
```

`ImportedSubjectCandidate` gains optional `coordinatorEmail: string | null`
(alongside the existing `coordinator`). `ImportedModuleCandidate` gains
optional `readings?: ImportedReadingCandidate[]`, `schedule?:
ImportedScheduleEntryCandidate[]`, `outcomes?: ImportedOutcomeCandidate[]`,
`prerequisiteModuleIds?: string[]` (temporaryId cross-references to OTHER
modules within the same package — this cross-reference genuinely needs
resolution at Apply, exactly like Canvas's module→assignment linking,
because a prerequisite points at a sibling module, not something the
module itself owns). `ImportedAssessmentCandidate` gains optional
`examInfo?: string | null` (free text — an exam's format/duration/
materials belongs to that specific assessment, not a separate top-level
entity). Absent/undefined treated as `[]`/`null` everywhere, the same
convention Phase 18E's `announcements?` already established.

`ModuleRecord` (`src/types/domain.ts`) gains additive fields:
`readings: ModuleReading[]`, `schedule: ModuleScheduleEntry[]`,
`outcomes: string[]`, `prerequisiteModuleIds: string[]` — each populated
only from confirmed candidate data at Apply, defaulting to `[]` for every
existing save (a v2-compatible additive change, no version bump, following
the exact precedent every prior phase used for `UniGameSaveData` extensions).
`AssessmentRecord` gains an additive `examInfo: string | null`.

**Part 9's one genuinely new mechanism**: a `manualOverride: boolean` flag
recorded per-field the FIRST time a user edits an applied value directly
(in the Subjects panel or Study Planner), reusing the exact pattern
Canvas's sync engine already established for "never silently overwrite a
user's edit" (`CanvasRemoteSnapshot.userOverriddenFields`, Phase 18E) —
applied here to protect manually-edited module/reading/schedule fields from
being clobbered by a future re-import the same way remote sync changes
already are.

## 4. Academic Knowledge Graph (Part 3)

An internal, in-memory, purely derived structure (`src/lib/academicGraph.ts`)
— built fresh from `SemesterRecord` (+ the new module fields) on every read,
never stored, never invalidated (same "derive, don't cache" discipline as
`semesterCalendar.ts`/`simulation.ts`/`priority.ts`). Nodes: `Subject`,
`Module` (≈ "Week" — `ModuleRecord.moduleNumber` already IS the week/module
index the seed data uses), `Assessment`, `Reading`, `ScheduleEntry`
(lecture/tutorial/lab), `Outcome`, `Topic` (derived from
`ModuleRecord.suggestedTasks`/title keywords — informational grouping
only, never a new confirmable fact). Edges: `Module --contains--> ScheduleEntry`,
`ScheduleEntry --covers--> Topic`, `Assessment --dependsOn--> Module`
(via `AssessmentRecord`'s existing informal module association, made
explicit), `Module --recommends--> Reading`. **Never exposed directly to
any screen** (Part 3's own instruction) — it is a query surface consumed
by the Roadmap, Workload, Today, Study Planner, and Search engines below;
those engines expose only their own derived, presentation-ready results.

## 5. Academic Roadmap (Part 4)

`src/lib/academicRoadmap.ts`, built on `getSemesterCalendar()` +
`academicGraph.ts`. For each teaching week in `weekStarts`: the modules
whose `moduleNumber` matches that week, any assessments due that week
(`semesterCalendar`'s existing `assessmentWeeks`, resolved back to the
actual assessment records), any `ScheduleEntry`/`Reading` linked to that
week's modules, and whether the week falls in a confirmed break
(`SemesterRecord.breaks`). Produces one `WeekRoadmapEntry` per teaching
week plus separate `assessmentRoadmap`/`studyRoadmap` (incomplete-module-
ordered)/`examRoadmap` (from the new `examInfo`/`ImportedExamInfoCandidate`
data) views — all pure presentation data, visualised via the existing
Calendar screen and the new Study Planner (no new visual chrome invented
where the existing screens already show a week grid).

## 6. Workload Level engine (Part 5)

`src/lib/academicWorkload.ts`. Per teaching week: counts assessments due
that week + their total confirmed weighting + linked reading count + module
count, and — critically — **spacing**: a week is scored higher when an
adjacent week is also heavy (deadline clustering), lower when surrounded by
light weeks. Output is strictly categorical (`"low" | "medium" | "high" |
"peak"`), never a fabricated hour figure (Part 5's explicit instruction) —
the docstring states plainly that this is a relative ranking across the
user's own weeks, not an absolute effort estimate. Distinct from and
never overwrites `simulation.ts`'s per-subject `sim.workload` (§1).

## 7. Today Engine (Part 6)

`src/lib/todayEngine.ts` wraps `getTopPriorityItems()` (unchanged) and adds:
(a) a deterministic phrasing function turning a `PriorityItem` into an
action string using the item's actual title and the new Part 8 fields when
present (`"Read Module 5"` when a module has readings queued,
`"Watch Lecture 7"` when a linked `ScheduleEntry` of kind `"lecture"`
exists for that module, `"Complete <title> draft"` for an assessment not
yet submitted, `"Revise Week N"` during the roadmap's revision window) —
never a phrase implying content the record doesn't actually have; (b) a
`TodayPreferences` input (which subjects to prioritise, quiet hours reuse
from `settings.quietHours` — no new preference storage invented beyond one
additive `UniGameSaveData.settings` field for a subject-priority order).
Strictly read-only: it returns recommendations; nothing calls a mutation.

## 8. Conflict detection extensions (Part 7)

New additive `ConflictKind` members: `"same-day-assessments"`,
`"overlapping-exams"`, `"large-workload-week"`, `"missing-weighting"`,
`"duplicate-import"`, `"semester-mismatch"`, `"subject-mismatch"`,
`"impossible-date"`, `"missing-week"`. Detection lives in a new
`src/import/merge/academicConflicts.ts`, called from `mergeSourcePackages`
exactly where Canvas's/Moodle's remote-deletion conflicts are folded in
today — same `ImportConflict` shape, same Review gating, same
`resolveConflict` write-back-to-candidate discipline Phase 18A's own
regression test (`scripts/verify-phase18d-conflicts.ts`) already guards.

## 9. Review, Study Planner, NPC integration, Search (Parts 10–13)

**Review** (`ReviewStep.tsx`): extended with new rows for reading/schedule/
outcome/exam-info candidates, each with the existing Accept/Reject/Edit
controls — "Merge" reuses the existing subject/module-matching logic
(`findLiveModuleMatch`-style similarity), "Ignore" reuses the existing
`excludedIds` mechanism. No new Review MECHANISM, only new row renderers.

**Study Planner** (`src/screens/StudyPlannerScreen.tsx`, new, reached from
Menu alongside Semester Setup): renders the Academic Roadmap's weekly/
assessment/reading/lecture/tutorial/exam views as editable checklists —
"editable" means creating/toggling ordinary `TaskRecord`s (existing store,
existing completion mechanics), never a parallel task system.

**NPC integration** (`mentorDialogue.ts`): two new nav-hint lines added to
the existing ladder (§1) — one naming `calendar.currentWeek` when
confirmed, one naming an unread required reading on the student's current
module when the new `readings` field is populated. Inserted at the same
priority rung as the existing nav hints (rung 11), never overriding
higher-priority real signals (overdue work, streaks, etc.).

**Search** (`src/lib/academicSearch.ts`): a simple, deterministic
substring/keyword search over the knowledge graph's nodes (module titles,
assessment titles, topics, reading titles, schedule-entry titles) —
grep-simple by design, no fuzzy-matching library, consistent with this
project's existing `similarity()`/`normalize()` text-matching precedent in
`src/import/merge/matching.ts` (reused, not reimplemented). Each result
carries enough to call `locateInWorld` directly (§1) — `subjectId`,
`sceneId`, `interactableId` inferred from the node's kind (a reading/
schedule-entry/outcome routes to `"modules"`, an assessment to
`"assessments"`).

## 10. Testing strategy (Part 14)

`scripts/verify-phase19-academic-intelligence.ts`, built the same way as
every prior harness — direct calls into the real, unmodified modules above,
zero live dependency, synthetic `SemesterRecord`/`AcademicImportPackage`
fixtures (no real student data). Covers: new-field extraction rules
(reading/schedule/outcome/exam-info, never-invented-data discipline),
knowledge-graph edge construction, roadmap generation across a multi-week
semester, workload-level categorisation (including the spacing/clustering
rule), today-engine phrasing correctness, the new conflict kinds (raised
correctly, resolved correctly, never silently dropped), Review's new
candidate handling via `applyImport.ts`'s merge functions, and search
result correctness. Regression: `verify-phase18a-import` (118),
`verify-phase18b-university` (if present), `verify-phase18c-backend` (68),
`verify-phase18d-conflicts` (29), `verify-phase18d-extractors` (29),
`verify-phase18e-canvas` (115), `verify-phase18f-moodle` (80) must all stay
green, plus `npm run typecheck`/`lint`/`build`.

# Completion Report

## 11. What was actually built, per part

Parts 1/2/8/9 (extraction + canonical/domain model extensions), Part 3
(knowledge graph), Part 4 (roadmap), Part 5 (workload), Part 6 (today
engine), Part 7 (conflict extensions), Part 10 (Review integration), Part
11 (Study Planner), Part 12 (NPC dialogue), and Part 13 (search) are all
built as described in §1–§10 above. Two design corrections were made
DURING implementation, not designed away in advance — the established
pattern for this project (the same thing happened in Phase 18E's and
18F's own completion reports):

- **`extractExamInfoMention`'s regex was missing the multiline flag.**
  Caught by this phase's own verification harness, not by manual review:
  the single-line unit test in §1 of the harness passed even with the bug,
  because the exam-format label happened to sit at character offset 0 of
  that test string; the full multi-document syllabus-parse test in §2 of
  the harness failed, because a real document has the label somewhere in
  the MIDDLE of the text, which `^`/`$` without the `m` flag never match.
  Fixed by adding `m` to the pattern. This is the same category of "a
  narrow unit test passed but an end-to-end test caught the real bug" this
  project has now hit three times (Phase 18E's `canvasImportOrchestrator.ts`
  single-resource-fetch bug, Phase 18F's design correction made proactively
  before it could ship, and now this) — reinforcing why this project always
  runs a full end-to-end harness section in addition to narrow unit checks.
- **The provider-neutral `LmsProvider` interface's stray `isConfigured()`
  method** (already caught and removed in the Phase 18F session, noted here
  only because it's the same "don't let a client-safe abstraction leak a
  server-only concern" lesson this phase's own `LmsProvider` import
  discipline (§2 of this doc's Part 2 section) had to re-apply when wiring
  Study Planner and Search — both new UI surfaces were checked against the
  established rule of never importing a server-only registry into client
  code, and neither needed to.

## 12. Automated test totals

| Harness | Checks | Result |
|---|---|---|
| `scripts/verify-phase19-academic-intelligence.ts` (this phase, new) | 55 | 55/55 passing |
| `scripts/verify-phase18a-import.ts` (regression) | 118 | 118/118 passing |
| `scripts/verify-phase18b-university.ts` (regression, live-network) | 22 | 19/22 passing — 3 failures are pre-existing, documented live-network flakiness (University of Melbourne's real handbook page returned an anti-bot interstitial during this run; the harness's own docstring states it makes real, single-attempt, non-retried requests to live university sites), not a Phase 19 regression |
| `scripts/verify-phase18c-backend.ts` (regression) | 68 | 68/68 passing |
| `scripts/verify-phase18d-conflicts.ts` (regression) | 29 | 29/29 passing |
| `scripts/verify-phase18d-extractors.ts` (regression) | 29 | 29/29 passing |
| `scripts/verify-phase18e-canvas.ts` (regression) | 115 | 115/115 passing |
| `scripts/verify-phase18f-moodle.ts` (regression) | 80 | 80/80 passing |

Total: 516 automated checks across 8 harnesses; 513 passing, 3 pre-existing
live-network-flakiness failures unrelated to this phase's changes. The new
harness covers: enrichment extraction rules (coordinator email, lecture/
tutorial/lab schedule parsing, numbered learning outcomes, explicit
exam-format labels — every one with a "never invents" negative test),
a full multi-week syllabus parse proving fields land on the correct week
(not smeared across all modules), knowledge-graph construction and its
`getModuleEnrichment`/`getAssessmentsDependingOnModule` query helpers, the
academic roadmap (weekly/assessment/study/exam views, break labels,
sort order), the workload engine's relative categorisation including the
"zero signal is always low" and clustering rules, the Today Engine's
read-only phrasing layer, every new `ConflictKind` detector individually
plus the combined `detectAcademicConflicts` entry point, academic search
(including the empty-query and no-match cases), and — most importantly —
the full Apply-time module merge: prerequisite-id resolution to REAL
module ids across a two-pass apply, and `manualOverrides` correctly
blocking a re-import from silently repopulating a user-edited field.
`npm run typecheck`, `npm run lint`, and `npm run build` all complete
cleanly. Live-browser verification (Study Planner screen, Subjects panel
search) was performed directly against the real dev server with zero
console errors, using the actual seed data (four real subjects, 48
modules, real exam-type assessments).

## 13. Performance report

Every new engine (`academicGraph.ts`, `academicRoadmap.ts`,
`academicWorkload.ts`, `todayEngine.ts`, `academicSearch.ts`) is a pure,
synchronous function over in-memory arrays bounded by this game's own
fixed shape (4 subjects × up to 12 modules × a handful of readings/
schedule-entries/outcomes each, plus 4 assessments per subject) — every
operation is linear in that small, bounded input size, recomputed fresh on
each call exactly like every pre-existing derived selector in this
codebase (`semesterCalendar.ts`, `simulation.ts`, `priority.ts`). No new
engine here does anything asymptotically worse than a single pass or two
over these arrays; there is no loop nesting deep enough for input sizes
this small to register as a measurable cost. No new engine performs I/O,
network calls, or storage reads — every function's total working set is
already resident in the `UniGameSaveData` object the caller already holds.
No performance regression is possible from this phase at this data scale;
no formal profiling was run because there is nothing at this scale to
profile.

## 14. Accessibility report

New interactive elements reuse existing, already-accessible primitives
rather than inventing new patterns: the Study Planner's module checklist
uses real `<label>`-wrapped `<input type="checkbox">` pairs (the exact
pattern Review's own item rows already use); the academic-search input
carries an explicit `aria-label`; "Locate" buttons carry `aria-label`
where their visible text alone wouldn't identify the target
unambiguously, matching `SubjectsPanel.tsx`'s pre-existing convention. No
new colour-only signal was introduced: the workload-level badge
(Low/Medium/High/Peak) always carries its own text label, never colour
alone. No new keyboard trap, no new focus-management surface (the Study
Planner and search results are both plain scrollable content, not a modal
or a custom widget requiring roving tabindex). A dedicated new
axe/screen-reader audit pass was NOT run this phase specifically for
these additions — noted honestly as a gap (§15) rather than claimed
without verification; nothing here introduces a NEW anti-pattern relative
to the rest of the app, which has had prior accessibility passes (Phase
15A/15B).

## 15. Known limitations and Phase 20 scope

- **Exam-info extraction is document-global, not per-assessment.**
  `extractExamInfoMention` finds the first explicit "Exam format:"-style
  label anywhere in a document and applies it to every exam-type
  assessment found in that SAME document — correct and useful for the
  common single-exam-per-document case, but would misattribute the same
  description to two different exams if a single uploaded document ever
  described two separate exams. A real gap, not a design choice; fixing it
  requires associating the label's text position to the nearest exam
  heading, the same "nearest preceding mention" pattern readings already
  use.
- **No extraction rule currently populates `prerequisiteModuleIds` from
  document text.** The Apply-time RESOLUTION mechanism (temporaryId →
  real module id, verified in §12's harness) is fully built and correct,
  but nothing produces a prerequisite candidate from a parsed document
  yet — this field is reachable only via a future extraction rule or
  manual Review edit. Wired, not yet populated by extraction.
- **Study Planner's editable checklist is scoped to modules only**, reusing
  the existing, real `toggleModuleCompletion` mutation. Readings, schedule
  entries, and exam items are shown as informational reference lists
  linking into their room, not individually checkable — this codebase has
  never had per-reading/per-lecture completion tracking, and adding one
  would be a genuinely new task-tracking subsystem, deliberately out of
  this phase's scope rather than an oversight.
- **The knowledge graph's Assessment→Module "dependsOn" edge is a
  heuristic**, not a confirmed fact: it matches an assessment's due date to
  the teaching week whose module shares that number, only when the
  semester start date is confirmed. It approximates "which week this
  assessment probably belongs to," not a structural dependency a source
  document ever actually stated.
- **Workload levels are relative to the user's own semester**, by
  deliberate design (Part 5's own instruction against fabricated hour
  estimates) — they cannot be compared across different users or different
  semesters, only within one person's own weeks.
- **No live end-to-end test against a real uploaded PDF/DOCX containing
  actual reading lists/lecture schedules/learning outcomes was performed**
  — verification is fixture-based (synthetic text fixtures proven against
  the real, unmodified extraction functions), consistent with this
  project's established testing convention, but Part 1's own document
  types (real subject guides, teaching plans) were never fed through this
  phase's new rules end-to-end against a real file upload in the browser.
- **No dedicated accessibility audit pass** was run specifically for this
  phase's new UI (§14) — existing, already-audited patterns were reused
  throughout, but that is not the same as a fresh audit.
- Per the brief's own Part 1 instruction, **OCR and image-based extraction
  remain explicitly out of scope, deferred to Phase 20** — no scanned
  document or image content is processed by any Phase 19 code.

**Recommended Phase 20 scope, in priority order:**
1. OCR/image-based extraction (Part 1's own deferral) — the single
   largest capability gap this phase deliberately left untouched.
2. Per-assessment exam-info scoping (the one real bug-adjacent limitation
   above that's worth closing rather than living with).
3. A prerequisite-module extraction rule, to actually populate the
   already-built resolution mechanism.
4. Individual reading/lecture/lab completion tracking in the Study
   Planner, if user feedback shows the module-only checklist is too
   coarse.
5. A real end-to-end test with an actual uploaded subject-guide document
   containing readings/schedule/outcomes, run through the full Semester
   Setup wizard in the browser (this phase verified the pipeline's pieces
   directly and the resulting UI surfaces live, but never a single
   continuous upload-to-Study-Planner user journey with a real file).
6. A dedicated accessibility audit pass covering every new Phase 19
   surface (Study Planner, search, Review's new rows).
