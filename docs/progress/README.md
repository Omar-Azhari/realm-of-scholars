# UniGame — Progress Screenshot Workflow

A repeatable checklist for capturing the 3D Campus's visual state, for
before/after comparison across future phases. Established in Phase 20F
(Part 16) as the vertical slice's documentation baseline.

## Current status: screenshots not captured this session — documented honestly

The Browser preview pane in this working environment cannot composite live
3D frames: `preview_start` successfully launches the dev server and the
page loads (confirmed via server logs — Vite serves the app correctly),
but every screenshot attempt fails with *"the Browser pane is not
displayed, so the page is not compositing frames."* This is not new to
this session — it's the same environment condition documented in every
prior Phase 20 completion report (20A, 20A.5, 20B) going back to the
original 3D world prototype. Retried fresh at the start of this task
rather than assumed from precedent; the result was identical.

**No screenshot in this checklist has been fabricated.** Where a capture
would go, this file gives the exact manual steps and camera/viewport
values a human (or a future session with a foregrounded preview pane) can
use to produce it identically.

## How to capture manually

1. `npm run dev`, open the app in a real, foregrounded browser window.
2. Set the browser viewport to **1280×800** (desktop) unless a checklist
   row says otherwise — matches this project's `resize_window` "desktop"
   preset, keeping every screenshot directly comparable.
3. In Settings → Campus World, enable **"Use the 3D Campus"**.
4. The camera is permanently fixed (Art Bible Part 2, unchanged this
   phase) — there is no camera positioning to do by hand. Every capture
   below is simply "walk/travel to the location, wait for the character
   to stop moving, then screenshot." Fixed values, for reference:
   - Downward angle: ~55° (`atan(8.5m / 5.95m)`)
   - Camera height: 8.5m · horizontal distance: 5.95m
   - Vertical FOV: 46° (perspective)
5. Save as PNG, filename pattern `YYYY-MM-phase<phase>-<location-slug>.png`
   — e.g. `2026-07-phase20f-campus-hq.png`. Use the current
   year-month, not a fixed date, so re-runs in later phases sort
   chronologically.
6. Do not commit generated screenshots to the repo unless they actually
   exist on disk — an empty or placeholder image is worse than no image;
   this checklist itself is the deliverable when captures aren't possible.

## Checklist

| # | Location / screen | How to reach it | Filename |
|---|---|---|---|
| 1 | Campus HQ | Default spawn point | `2026-07-phase20f-campus-hq.png` |
| 2 | Library | Walk through Campus HQ's Library door, or Menu → Campus Directory → Library | `2026-07-phase20f-library.png` |
| 3 | Computer Lab | Campus Directory → Computer Lab | `2026-07-phase20f-computer-lab.png` |
| 4 | Lecture Theatre | Campus Directory → Lecture Theatre | `2026-07-phase20f-lecture-theatre.png` |
| 5 | Student Lounge | Campus Directory → Student Lounge | `2026-07-phase20f-student-lounge.png` |
| 6 | Administration | Campus Directory → Administration | `2026-07-phase20f-administration.png` |
| 7 | Character Creator | Menu → Character Creator (or the in-world Wardrobe) | `2026-07-phase20f-character-creator.png` |
| 8 | Room Editor | Menu → Room Planner (or the in-world Room Planner board, Campus HQ) | `2026-07-phase20f-room-editor.png` |
| 9 | Daily Brief | Campus HQ's Coffee Area, or the Daily Brief nudge chip on spawn | `2026-07-phase20f-daily-brief.png` |
| 10a | Time-of-day: Morning | Visit Campus HQ between 5am–11am Melbourne time | `2026-07-phase20f-timeofday-morning.png` |
| 10b | Time-of-day: Afternoon | Visit between 11am–5pm | `2026-07-phase20f-timeofday-afternoon.png` |
| 10c | Time-of-day: Evening | Visit between 5pm–9pm | `2026-07-phase20f-timeofday-evening.png` |
| 10d | Time-of-day: Night | Visit between 9pm–5am | `2026-07-phase20f-timeofday-night.png` |

**Time-of-day capture note**: `getTimeOfDay()` (`src/game3d/campus/
timeOfDay.ts`) derives the atmosphere from the real Melbourne clock — there
is no in-app time-skip control (deliberately: "atmosphere only... no
gameplay penalties," not a simulated day/night cycle to build UI for).
Capturing all four requires either visiting across real elapsed hours, or
— for a developer only, never a documented player-facing feature —
temporarily overriding the system clock / mocking `Date` in a local dev
session. Do not build a fake "time cheat" control into the shipped app
just to make this checklist faster; that would be a real feature, not
documentation tooling.

## What changed this phase

Every location's lighting/material values were audited and, where
inconsistent, corrected against the Art Bible (see
`docs/PHASE_20F_VISUAL_AUDIT.md`'s "Lighting / material consistency pass"
section) — most visibly, every building now has a real, trim-tinted door
mesh (previously invisible), and Night now tints ambient light cool
(`#40485c`) instead of just dimming the daytime palette. A screenshot
comparison against any pre-20F capture (none exist in this repo, per the
same limitation above) would show these differences most clearly at the
door meshes and at Night.
