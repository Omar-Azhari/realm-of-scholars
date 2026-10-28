# Phase 15B — Interface Simplification Audit

Audit of the Phase 15A world-first interface before the 15B reduction pass.
Goal: fewer visible choices, combined systems, an obvious next action — no
new features. Nothing changed while writing this.

## 1. Everything visible at once (default HQ, fresh save)

Measured from the 15A build (see p15a-hq.png):

| Region | Element | Info shown |
| --- | --- | --- |
| Top-left | Player card | avatar + "You" + Lv + XP bar + date + **location** ("Campus HQ · Main Hall") |
| Top-right | Notifications bell | count |
| Top-right | Minimap | 5-node campus |
| Right (below minimap) | **Objective tracker** | **up to 3** objectives, each with dot + title + Locate |
| Far right | Tab rail | **6 tabs** (Tasks, Subjects, Calendar, Resources, Profile, Settings) |
| World | Interaction action pill | appears near player when in range |
| Bottom-centre | Coach mark | multi-line paragraph |

At rest the player sees **~13 discrete interactive/labelled clusters** plus
4 door mentors. Two of them (player card, objective tracker) are large cards;
the objective tracker alone shows three tasks with three Locate buttons. This
is the "too busy" problem.

## 2. Duplicate actions / navigation paths

- **Tabs vs world objects**: Resources tab **and** the room bookshelf both
  open module material; Profile tab **and** the room trophy shelf both open
  achievements; a subject is reachable via the Subjects tab, an HQ door, the
  objective Locate, and the minimap.
- **Objective tracker vs Tasks panel**: both rank and Locate the same
  priority items (3 in the HUD, all of them in Tasks).
- **Location shown twice** conceptually: the player card location string and
  the minimap "you are here" node.
- **Six tabs, but Resources/Profile/Settings are low-frequency** — they take
  equal permanent space to Tasks/Subjects/Calendar.
- **Subjects panel** previously risked repeating task/deadline data that also
  lives in Tasks and Calendar.

## 3. What will be removed / combined / hidden / moved

### Primary navigation: 6 tabs → **4** (Tasks · Subjects · Calendar · Menu)
- **Resources** → a section **inside Subjects** (per-subject Overview /
  Modules / Resources).
- **Profile** → inside **Menu**.
- **Settings** → inside **Menu**.
- Achievements, relationships, collections, statistics → inside **Profile**
  (Menu → Profile sub-tabs).
- Export/import + accessibility → stay inside **Settings** (Menu → Settings).
- Reminders → managed from **Calendar**.
- Focus sessions → launched from **Tasks** or the study desk.

### HUD (removed from the permanent default)
- The large player **card** → shrunk to **level + compact XP** only; player
  name moves to a tooltip.
- **Location** → moved to a slim **top-centre** chip (name + small subject
  icon), no big card.
- Objective tracker **3 → 1** active objective (title, subject colour,
  urgency, Locate, Dismiss); the other priorities live in Tasks, where the
  player can change which one is tracked.
- The floating world **action pill** → a single **bottom-centre prompt**
  ("E — Talk to Mentor") shown only when in range, hidden otherwise; the `E`
  key also triggers it.
- The **notifications bell** leaves the permanent HUD (reminders are surfaced
  through Calendar and the objective/urgency indicators).

### Panels (progressive disclosure)
- **Tasks**: five sections → **Next · Upcoming · Completed**; "Next"
  auto-highlights the single top recommendation; compact filters; cards show
  title/subject/due/state only, expanding on click; actions trimmed to
  **Track · Locate · Start · Complete**.
- **Subjects**: four large entries (name/colour/progress/next deadline/Enter
  or Locate); opening one reveals **Overview / Modules / Resources**;
  assessments link back to Tasks rather than re-listing tasks.
- **Calendar**: **Upcoming (default) / Month**; deadlines + reminders +
  study sessions combined, subject-coloured.
- **Menu** (new): text-labelled list — Profile · Achievements · Statistics ·
  Settings · Help · Save data.

### Rooms
- Interaction labels hidden until hover/focus/approach (already mostly true;
  tighten so nothing is permanently labelled). Consistent object roles
  retained (exit near entrance, mentor, assessment board, module/resource
  area, study desk).

### First-time guidance
- Multi-line coach mark → a **3-step** dismiss-forever guide (Move · Open
  Tasks · Follow the objective).

## 4. Visual hierarchy target

- **Primary**: world · the one active objective · the interaction prompt.
- **Secondary**: four tabs · minimap · level/XP.
- **Hidden until requested**: statistics, achievements, settings,
  export/import, relationships, collections, full task descriptions.

## 5. Save compatibility

No format change. The only possible new state is an **additive, defaulted**
UI preference (e.g. a tracked-objective id) — but the tracked objective is
ephemeral in-session state and will **not** be persisted, so no save change
is needed at all. Everything else (XP, tasks, assessments, reminders,
relationships, achievements, profile, settings, export/import) reads the same
selectors, untouched.

## 6. Files expected to change

`world/worldTypes.ts` (PanelId→4, action section), `world/WorldUiContext.tsx`
(panel section + single-objective/track), `world/sceneWorld.ts` (remap object
actions to 4 panels), `world/WorldScene.tsx` (E-key + bottom-centre prompt),
`components/world/panelMeta.ts`, `TabRail.tsx`, `HudPlayerPanel.tsx` (+ new
`HudLocation.tsx`), `ObjectiveTracker.tsx`, `WorldShell.tsx`, panels
(`TasksPanel`, `SubjectsPanel`, `CalendarPanel`, new `MenuPanel`,
`ProfilePanel`, `PanelHost`; retire `ResourcesPanel`/`SettingsPanel` as
standalone), `styles/world.css`.
