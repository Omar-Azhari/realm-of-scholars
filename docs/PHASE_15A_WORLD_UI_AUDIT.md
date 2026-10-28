# Phase 15A — World-First Navigation Audit

Audit of the interface as it stands before Phase 15A, and the plan to make
the playable world the primary surface. No code changed while writing this.

## 1. Current routing

`src/App.tsx` mounts `BrowserRouter` → one `AppShell` layout route wrapping
**12 sibling routes**, each a full-screen page that *replaces* the world:

| Route | Screen | Nature |
| --- | --- | --- |
| `/` | SemesterHomeScreen → HQScene | **World scene** (campus hall) |
| `/subjects/:id` | SubjectRoomScreen → SubjectRoomScene | **World scene** (subject room) |
| `/subjects/:id/assessments/:aid` | AssessmentDetailScreen | Page |
| `/calendar` | CalendarScreen | Page |
| `/priority` | PriorityCentreScreen | Page |
| `/missions` | WeeklyMissionsScreen | Page |
| `/reminders` | RemindersScreen | Page |
| `/profile` | ProfileScreen | Page |
| `/journal` | StudyJournalScreen | Page |
| `/collections` | CollectionsScreen | Page |
| `/timeline` | TimelineScreen | Page |
| `/settings` | SettingsScreen | Page |

**Problem:** only two routes are the "world"; the other ten are flat app
pages. Moving between them unmounts the world scene entirely. This is the
"collection of separate pages" feel the phase targets.

## 2. Current shell / navigation (`AppShell.tsx`, `navItems.ts`)

- A **desktop sidebar** and a **mobile bottom-nav** both render the same
  `NAV_ITEMS` list — **15 destinations** (Home, 4 subjects, Calendar,
  Priority, Missions, Reminders, Journal, Collections, Timeline, Profile,
  Settings). Two full navigation systems, 15 links each.
- A **NotificationBell** (its own popover) in the sidebar.
- A persistent **TopHud** (`header`) with avatar, level, XP bar, streak,
  modules, next-deadline chip.
- `AnimatedOutlet` cross-fades between routes (full-page transitions).

**Duplicated / confusing navigation to consolidate:**
- Sidebar **and** bottom-nav are two parallel menus (keep one model per
  breakpoint, same 6 destinations).
- Four subject links in the nav duplicate entering rooms via HQ doors.
- Priority / Missions / Journal / Collections / Timeline are five separate
  destinations that are really facets of Tasks and Profile.
- Entering a subject is possible **three** ways (nav link, HQ door, deadline
  links) with different transitions.

## 3. Current HUD (`TopHud.tsx`)

Already close to a HUD but full-width and top-docked. Has avatar, level, XP%,
streak, modules, next-deadline. **No minimap, no objective tracker, no
location readout.** Becomes the top-left player panel + feeds the new HUD.

## 4. Current player controls / scenes

Movement is **not** free-roam. Both scenes use a **scripted pose state
machine**:

- `HQScene`: player idles at `playerHome` (x 800). Clicking a door runs
  `turning → walking → threshold → veil → navigate("/subjects/:id")`. The
  player only ever moves along a fixed door path; there is no arbitrary
  movement, no keyboard control, no click-to-ground.
- `SubjectRoomScene` (1062 lines): player at `playerHome`; phases
  `entering / idle / to-desk / sitting / focused / leaving`. Clicking the
  study-desk hotspot walks to the desk and opens Focus Mode; clicking the
  exit door walks out. Seven in-room `RoomPanel` overlays (modules,
  missions, info, progress, achievements, assessments, deadlines) open on
  hotspot click — these are effectively per-room duplicates of the global
  pages.
- Geometry lives in `public/assets/manifest.json`: each scene is 1600×760
  with `playerHome`, door/hotspot rects, `mentor`, `focusDesk`. This is the
  raw material for the new movement grid and interactables.

**Implication:** click-to-move + WASD + interaction-range is a genuinely new
movement subsystem layered onto the existing manifest geometry. There is no
prior collision system to reuse beyond the fixed walkable floor line, so a
lightweight walkable-band + obstacle model is introduced.

## 5. Persistence (`persistence.ts`, `SaveDataContext.tsx`)

- One localStorage entry `unigame:saveData:v1`, version 2, field-level
  coercers, additive-field convention, auto-backups. Settings already hold
  additive UI flags (`reducedMotion`, `onboardingHintDismissed`).
- **Plan:** any new world-UI state (last panel, whether the movement hint
  was seen) is **optional + additive** in `settings`, coerced with a default,
  **no version bump, no migration.** Player world position is ephemeral
  (per scene visit) and intentionally **not** persisted — refreshing spawns
  at the scene's spawn point, matching the current behaviour.

## 6. Pages → panels mapping

| Old route/page | Becomes |
| --- | --- |
| `/calendar` | **Calendar panel** |
| `/priority` | **Tasks panel** (Pinned + Due-soon sections) |
| `/missions` | **Tasks panel** (Weekly study section) |
| `/reminders` | **Calendar panel** (reminders overlaid) + Tasks urgency |
| `/journal` | **Profile panel** (Study Journal section) |
| `/collections` | **Profile panel** (Collections section) |
| `/timeline` | **Profile panel** (Timeline section) |
| `/profile` | **Profile panel** |
| `/settings` | **Settings panel** (incl. export/import) |
| `/subjects/:id/assessments/:aid` | **Tasks panel** task-detail view |
| 4 subject nav links | HQ doors + **Subjects panel** Enter/Locate |

Remaining full routes (world scenes only): `/` (HQ) and `/subjects/:id`
(room). Old page routes become **redirects to `/`** so existing bookmarks
never 404. Fatal-error recovery is the existing global ErrorBoundary;
onboarding stays the in-world coach mark (not a route).

## 7. Six primary tabs (fixed order) and where secondary systems live

1. **Tasks** — priorities, assessments, weekly study, completed, task detail.
2. **Subjects** — 4 subject cards, enter/locate room.
3. **Calendar** — month + upcoming, deadlines + reminders + study sessions.
4. **Resources** — subject → module → resource type, links.
5. **Profile** — identity, XP, **achievements, relationships, collections,
   timeline, statistics, study journal, export shortcut**.
6. **Settings** — preferences, notifications, data **export/import**, About.

No other primary tabs are added.

## 8. World-first shell plan

- `WorldShell` replaces `AppShell` as the router layout: it renders the
  **one** active scene via `<Outlet/>` (HQ or room) and, persistently above
  it, the HUD (player panel, minimap, objective tracker), the 6-tab rail
  (desktop) / bottom bar (mobile), and a single **panel host** overlay.
- Panel open/close and the tracked objective live in a `WorldUiContext`
  mounted **above** the outlet, so opening a panel or swapping HQ↔room never
  resets panel state, and opening a panel never navigates or moves the
  player. Only one panel open at a time; Escape closes; clicking the active
  tab closes.
- Movement state lives inside each scene (per-visit), driven by
  `useWorldMovement`; interactions route through a shared `Interactable`
  model with hover/focus highlight, name, range, context action, keyboard.
- `locateInWorld(target)` closes the panel, sets the tracked objective, and
  navigates to the target room; on arrival the objective's interactable is
  highlighted.

## 9. Compatibility guarantees

Progress, tasks/assessments, reminders, XP, relationships, achievements,
profile, settings, export/import all read the same save and selectors —
untouched. The only save change is one additive, defaulted settings flag for
the movement hint; no migration. Deep links to `/` and `/subjects/:id`
survive refresh; removed page routes redirect instead of 404.
