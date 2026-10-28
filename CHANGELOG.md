# Changelog

All notable changes to UniGame. Format: [Keep a Changelog](https://keepachangelog.com/);
versioning: [SemVer](https://semver.org/).

## Versioning policy

- **MAJOR** — save-format breaks that field-level coercion cannot absorb
  (none so far; the coercer discipline exists precisely to avoid these), or
  removal of a player-facing system.
- **MINOR** — new player-facing features/screens (each build phase below
  was retroactively assigned a minor version).
- **PATCH** — fixes, copy, balance-value tweaks, art/asset swaps.
- Pre-releases use `-rc.N` suffixes; the playtest runs on `1.0.0-rc.N` and
  `1.0.0` ships when the playtest exit criteria in RELEASE_CHECKLIST.md are
  met.

## Release process

1. `npm ci && npm run lint && npm run typecheck && npm run build`
2. Re-run the QA batteries against the built app (see RELEASE_CHECKLIST §1).
3. Bump `version` in package.json (single source — About screen and build
   metadata read it), add the CHANGELOG entry, update RELEASE_NOTES if RC.
4. Commit, tag, deploy per DEPLOYMENT.md, run the post-deploy smoke test.

**Tagging convention** (once the project is under git): annotated tags
`v<semver>` (e.g. `v1.0.0-rc.1`), tagged on the exact commit that built the
deployed artifact so `__COMMIT_HASH__` in Settings → About matches the tag.

## [Unreleased] — Phase 17 (Content Expansion & Final Production)

Content, personality and atmosphere on the existing engine — no new gameplay
systems, UI, or save changes.

### Added
- **Mentor dialogue expanded 80 → 224 pooled lines** (14 categories/mentor):
  greetings ×3, busy, relaxed, congrats, concern, revision, ending, complete,
  plus new **humour, burnout, welcome-back, and relationship-milestone**
  pools. Four distinct voices; every line gated on real saved data
  (inactivity gap, workload, streak, relationship level, module progress).
- **Environmental storytelling** — rooms fill with your real work: finished-
  work piles by the desk, a progress whiteboard that fills toward completion,
  book stacks that grow with modules, alongside the existing note board and
  monitor life. Deterministic; verified to scale with completion (6 → 25
  elements at 8 modules done).
- **Ambient life** — a gentle night desk-lamp flicker (reduced-motion safe).
- **Polish** — soft entrance timing for the interaction prompt, objective
  bar, and object name tags (reduced-motion safe).

### Docs
- docs/PHASE_17_CONTENT_REVIEW.md, PHASE_17_ART_PRODUCTION_CHECKLIST.md,
  PHASE_17_PLAYTHROUGH.md.

## [Unreleased] — Phase 16 (World-First Gameplay)

Makes the world richer and the interface quieter so interacting with the
world replaces navigating menus where natural. No new menus/tabs/HUD/
mechanics/systems; no save change.

### Added
- **Context-sensitive interaction prompts** — objects name their act:
  Review Assessment · Browse Books · Read Notice Board · Check Calendar ·
  Check Progress · View Trophies · Start Study Session · Talk · Exit Room ·
  Enter <subject>.
- **Object affordances** — a quiet resting glow (no floating arrows) invites
  interaction; a purpose icon + name appear on hover/focus/approach.
- **Mentor navigational dialogue** — mentors point at real objects using real
  progress ("The bookshelf has today's reading…", "Have you checked the
  assessment board?", "N of M modules done — the study desk's free").

### Changed
- **Environmental feedback re-embedded** — completing modules visibly changes
  the room again (notes fill the board, mug on busy weeks, books, live
  monitor content) via the room-life layer that was orphaned in the 15A
  rewrite. No panel needed to see progress.
- **Walking feel** — ease-in/ease-out arrival, a footstep cadence while
  moving, a gentle camera push-in when entering a door, and the player turns
  to face the object they stop beside. All disabled under reduced motion.

## [Unreleased] — Phase 15B (Interface Simplification)

Reduces visible complexity on top of the 15A world-first shell. No new
features; no save-format change (the tracked objective is ephemeral session
state, not persisted).

### Changed
- **Primary navigation: 6 tabs → 4** — Tasks · Subjects · Calendar · Menu
  (right rail on desktop, same four in the mobile bottom bar). Resources
  moved inside Subjects; Profile and Settings moved inside Menu;
  achievements/relationships/statistics/timeline/journal fold into Menu →
  Profile; export/import + accessibility stay in Settings.
- **HUD trimmed to essentials** — top-left is just level + a compact XP bar
  (name is a tooltip); a slim location chip moves to top-centre (no large
  card); the minimap is smaller; the objective tracker shows **one** active
  objective (Locate + Dismiss) instead of three.
- **Single bottom-centre interaction prompt** ("E — …") shown only when near
  an object; the `E` key now triggers the in-range interaction.
- **Tasks panel** simplified to Next · Upcoming · Completed with an
  auto-highlighted top recommendation, minimal cards (title/subject/due),
  and four actions on expand: Track · Locate · Start · Complete.
- **Subjects panel**: large entries; opening one reveals Overview · Modules ·
  Resources; assessments link back to Tasks (no duplicate task lists).
- **Calendar panel**: Upcoming (default) / Month, combining deadlines,
  reminders and study sessions.
- **First-time guide** condensed to three dismiss-forever steps.
- Room interaction labels appear only on hover/focus/approach; a tracked
  object keeps its highlight ring without a permanent text label.

### Removed
- The permanent notifications bell from the HUD (reminders live in Calendar);
  the standalone Resources, Profile and Settings primary tabs/panels.

## [Unreleased] — Phase 15A (World-First Navigation)

Reorganises the interface around the playable world, inspired by classic
RPG interaction models (no RuneScape assets/branding copied). Save format
unchanged (one additive, defaulted settings flag; no migration).

### Added
- **World-first shell**: the walkable scene is the primary surface; a single
  overlay panel system layers over it. Opening a panel never navigates or
  moves the player; swapping HQ↔room never resets panel/objective state.
- **Free player movement**: click-to-move (with a destination marker) and
  WASD/arrow keys, on a walkable-band + obstacle collision model. Manual keys
  cancel a click target; blocked/invalid destinations fail safely; reduced
  motion teleports.
- **Shared interaction system**: doors, mentors, assessment boards, module
  shelves, study desks, notice boards and room exits are attached
  interactables with hover/focus highlight, name, range, a context action
  (Enter/Talk/Study/View Tasks/Open Modules/Inspect) and keyboard operation.
  Selecting one from range acts immediately; from afar the player walks over
  then acts.
- **HUD**: top-left player panel (level, XP, week/date, location), top-right
  schematic minimap (click → campus map in Subjects), and an objective
  tracker (≤3, subject colour, urgency, Locate).
- **Six primary tabs** (Tasks · Subjects · Calendar · Resources · Profile ·
  Settings) as a right rail (desktop) / bottom bar (mobile). Achievements,
  collections, timeline, journal and stats fold into Profile; export/import
  into Settings; priorities/missions into Tasks.
- **Locate in World** from Tasks and the objective tracker: closes the panel,
  tracks the objective, and guides the player to the relevant room/object.

### Changed
- Routing reduced to the two world scenes (`/`, `/subjects/:id`); all former
  planner-page routes now redirect to the world (no 404s) and open as panels.
- HQ and subject rooms unified under one `WorldScene`; the semester home is
  the world (no dashboard rail).

### Removed
- The dual sidebar + bottom-nav (15 links each), the old `AppShell`, `TopHud`,
  `HQScene`, `SubjectRoomScene`, and the standalone Calendar/Priority/Missions/
  Reminders/Collections/Assessment-detail page routes (superseded by panels).

## [1.0.0-rc.1] — 2026-07 (Phases 12–14)

First release candidate for external playtesting. Phase 12 contributed the
production review documents (planning/PROJECT_AUDIT.md and companions),
Phase 13 the fixes below, Phase 14 deployment/distribution packaging.

### Added
- First-run onboarding coach mark in the HQ hall (one beat, skippable,
  disappears after visiting any room).
- Mentors now greet for a few seconds on room entry, making living dialogue
  visible on touch devices; mentor speech is also keyboard-focusable.
- About section in Settings showing version, commit, and build time.
- ESLint 9 flat config (`npm run lint`, CI-ready, recommended TS + React
  hooks rules).
- Build metadata injection (version / commit hash / timestamp).
- Safe-area insets for notched phones.

### Changed
- Fresh saves no longer boot with a 9-count notification badge: the badge
  now counts only urgent items (overdue / due-today), and all
  needs-confirmation prompts consolidate into one calm "Semester setup"
  notification.
- Before any module is completed, the home "Highest Priority" card presents
  as "Suggested First Steps" without priority chips.
- The HUD deadline chip is now labelled ("Due next:") and ellipsizes the
  title instead of the date.
- Dashboard/agenda list links meet the 44 px touch-target minimum.
- The two navigation landmarks are distinctly labelled; the HUD is a proper
  `header` landmark.

### Fixed
- `timing` object identity churn in the HQ scene (hook-dependency
  correctness, found by the restored linter).
- Safari: added missing `-webkit-backdrop-filter` prefixes on the completion
  and focus overlays.
- Avatar/mentor tap areas now never shrink below 44 px even when the scaled
  sprite is smaller (tablet measured 41 px).
- Duplicate `computeLevel` implementations consolidated into `xpRules.ts`
  (level curve now has a single source of truth).
- Storage-write failures (private browsing, quota) now show a persistent
  in-app warning instead of failing silently; asset-load failures and render
  crashes show friendly recovery screens with no technical details.

### Removed
- Dead mentor greeting fields in room personas (superseded by the Phase 11
  dialogue ladder).

### Added in Phase 14 (deployment & distribution)
- favicon.svg, site.webmanifest, robots.txt, theme-color/description meta,
  `viewport-fit=cover`.
- SPA fallback + split cache-header configs (`vercel.json`, Netlify
  `_redirects`), deployment guides for four hosts (DEPLOYMENT.md).
- BACKUP_GUIDE.md, TESTER_README.md, RELEASE_NOTES_RC1.md, versioning
  policy + phase history in this file.

## [0.11.0] — Phase 11 (Living Semester)
- Semester calendar derivation + week strip; living mentor dialogue ladder
  (80 pooled lines); era-driven HQ dressing; deterministic room life;
  Collections and Timeline screens; first-seen milestone log; semester
  completion sequence. No balance changes (see planning/BALANCE_REVIEW.md).

## Phase history (retroactive versions)

- **[0.10.0] — Phase 10**: interim art completion pass — every room's
  hand-built vector environment finished (risk register, wall clock,
  per-room props), visual comparison QA loop.
- **[0.9.0] — Phase 9**: room evolution stages, mentor relationships
  (bonds, levels, visit tracking), achievements expansion, simulation
  moods/workload driving room status.
- **[0.8.0] — Phase 8**: sound-event architecture (opt-in, asset-driven,
  silent until files exist), micro-polish pass (contact shadows, level-up
  pop, door anticipation).
- **[0.7.0] — Phase 7**: Focus Sprints (timestamp-based timer surviving
  refresh, XP rules, journal auto-entries), save v2 migration with backups,
  study desk staging in every room.
- **[0.6.0] — Phase 6**: Study Journal + weekly missions + browser
  notifications with quiet hours.
- **[0.5.0] — Phase 5**: reminders system (auto offsets from confirmed
  deadlines, snooze/dismiss, weekly planning reminder).
- **[0.4.0] — Phase 4**: planner screens — Calendar (month/week/agenda),
  Priority Centre with pinning, Assessment Detail (progress, checklist,
  links, grades).
- **[0.3.0] — Phase 3**: walkable HQ + four subject rooms (scene engine,
  actors, widgets, day-phase atmosphere), in-room panels, NEEDS_CONFIRMATION
  confirm-in-place editors.
- **[0.2.0] — Phase 2**: design system, app shell, dashboard, save
  persistence v1 with field-level coercion.
- **[0.1.0] — Phase 1**: semester data model from the course documents (4
  subjects, 48 modules, 14 assessments), provenance audit, XP/task seed.
