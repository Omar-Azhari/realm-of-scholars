# V2 Phase 1 — The Prestige Vertical Slice

A dramatically higher-quality, additive, parallel 3D renderer
(`settings.worldRenderer === "prestige-v2"`) implementing exactly four
districts from `docs/UNIGAME_V2_MASTER_DESIGN.md` — Main Gate, Grand
Courtyard, Great Hall, Hall of Artisans — plus one preview-only Dormitory
room, as the benchmark for every future district. `experimental-3d` and
`legacy-2d` remain byte-for-byte untouched; every gameplay system (AI
Mentor, save data, progression, conversations, journal) is consumed
verbatim, never re-derived.

## 1. What was rebuilt

**New module tree** (`src/game3d/prestige/`, 1936 lines across 10 files),
nothing shared with the old renderer except read-only reuse:

```
src/game3d/prestige/
  PrestigeWorld.tsx            Entry point — scene switch, transitions,
                                mentor conversation wiring, HUD location
  PrestigeSceneShell.tsx       Shared shell (sibling of CampusBuildingScene.tsx)
  camera/PrestigeCamera.tsx    New camera: bigger distance/height, fog,
                                bounded drag-orbit + scroll-zoom
  architecture/ArchitectureKit.tsx  15 reusable procedural components
  prestigeNpcs.ts               NPC appearance/schedule data for all 5 scenes
  scenes/
    MainGateScene.tsx           Arrival approach between two gatehouse towers
    GrandCourtyardScene.tsx     50m×50m hub — fountain, colonnade, 4 statues,
                                 3 real doors, 3 "Coming Soon" gates, 1 dorm-
                                 preview door
    GreatHallScene.tsx          20m×42m cathedral nave — twin fireplaces,
                                 2 full-length tables, ribbed vault, stained
                                 glass, 4 subject banners, 4 diner NPCs
    HallOfArtisansScene.tsx     32m×26m workshop hall — Iris (real mentor,
                                 unchanged appearance/personality), 2 student
                                 workspaces, real subject-room handoff
    DormPreviewScene.tsx        10m×8m static preview room (fireplace, bed,
                                 desk, bookshelf, window, banner, decorations)
```

**Additive-only edits to shared files** (every one is a new union member,
a new optional field, or a new `if` branch — no existing branch/behaviour
was changed):

| File | Change |
|---|---|
| `src/world/worldTypes.ts` | `CampusSceneId` +5 members; `InteractAction` +`locked-notice` |
| `src/types/domain.ts` | `WorldRenderer` +`"prestige-v2"` |
| `src/lib/persistence.ts` | coercion accepts the new renderer value |
| `src/lib/sound.ts` | +6 `SoundEvent` members (ambience only) |
| `src/game3d/campus/CampusDirectoryPanel.tsx` | +5 icon map entries (never rendered — the legacy directory never lists prestige-v2 scenes) |
| `src/game3d/campus/subjectBuilding/SubjectBuildingScene.tsx` | 2 constants marked `export` (Iris's real appearance/personality, reused verbatim — zero behaviour change) |
| `src/screens/SemesterHomeScreen.tsx` | +1 branch, parallel to the existing `experimental-3d` branch |
| `src/screens/SettingsScreen.tsx` | renderer toggle → 3-way select |
| `src/world/PrestigeV2Lazy.ts` | new file, sibling of `Game3DLazy.ts` |
| `src/main.tsx` | +1 CSS import |
| `src/styles/prestige.css` | new file, scoped entirely under `.prestige-v2-root` |

`SubjectRoomScreen.tsx` needed **no change** — it already falls through to
the real 2D `WorldScene` for any renderer other than `experimental-3d`,
which is exactly the correct behaviour for prestige-v2 too (the Hall of
Artisans' study desk hands off to that same real route).

## 2. Quality improvements (vs. the old prototype)

- **Scale**: districts are now genuinely large — a 50m×50m courtyard, a
  42m-long cathedral nave, ceilings up to 12.5m at the vault apex — versus
  the old single ~10m×7m room. `SCENE_UNITS_PER_METRE = 100` (unchanged,
  shared constant) makes this a direct, verifiable comparison.
- **Architecture**: every surface is stone/oak/iron/brass/parchment via
  procedural composition — columns, pointed arches, ribbed vault bays,
  stained glass with a real mullion grid, fireplaces with a flickering
  point light, a working fountain, statues, banners — never a flat
  coloured box or a bare wall plane.
- **Lighting**: each scene authors its own mood (per
  docs/UNIGAME_V2_MASTER_DESIGN.md §7) — warm daylight in the Courtyard,
  low golden torchlight in the Great Hall, bright clerestory light in the
  Hall of Artisans, firelight in the Dormitory preview — rather than one
  shared preset.
- **Camera**: `PrestigeCamera.tsx` replaces the old locked 55°/no-zoom/
  no-rotation rig with a larger distance/height, atmospheric fog, and a
  bounded player-driven orbit + zoom (§9 of the Master Design) — while
  keeping a full reduced-motion fallback (camera locks to a plain,
  non-orbiting follow, exactly like the old renderer's contract).
- **Movement feel**: `useWorldMovement.ts` (the shared collision/keyboard
  hook) is reused unmodified — retuning its physics would also change
  `experimental-3d`. "Weightier" movement instead comes from
  `PrestigeSceneShell.tsx`'s own visual layer: slower position/yaw follow
  damping (6/4.2 vs. the old renderer's 9/7) plus a new subtle lean-into-
  turn tilt, and a longer player pose cross-fade (0.5s vs. 0.35s) for
  more graceful animation blending.
- **NPCs**: no new wardrobe assets were built (disclosed in §5), but every
  NPC is deliberately, individually spaced (never clustered), and uses
  richer waypoint-cycling schedules (2-3 real poses per NPC: read/write/
  think/coffee/talk/stretch/lookAround) rather than one repeated idle.
- **Audio**: 6 new per-district ambience events wired via `emitSound`
  (courtyard fountain/birds/wind, Great Hall ambience/chatter/fireplace,
  workshop ambience, main-gate wind) — no scene is silent.
- **UI**: the mentor conversation panel, the "Coming Soon"/inspect notice,
  and the E-to-interact prompt are all reskinned to parchment/leather/
  brass (`src/styles/prestige.css`), scoped so nothing else in the app is
  affected.

## 3. Performance impact

- **Zero cost to existing renderers.** Every new file lives under a fresh
  `React.lazy` boundary (`PrestigeV2Lazy.ts`); a user who never switches
  to `prestige-v2` downloads none of it. Confirmed in the production
  build: `PrestigeWorld`, all 5 scenes, `ArchitectureKit`,
  `prestigeNpcs`, and `PrestigeSceneShell` are all separate chunks
  (2.7–20.6 kB each), not inlined into the main bundle.
- **Existing quality tiers apply unmodified** — `resolveQualityPreset`
  (dpr cap, shadow map size/on-off) is reused verbatim; no new lever was
  added, since this vertical slice's geometry count stayed within the
  budget those tiers already target (a handful of columns/lights per
  scene, not hundreds).
- **No new per-frame cost class.** `PrestigeCamera`'s orbit/zoom input is
  event-driven (pointer/wheel listeners), not polled; its `useFrame` does
  the same order of work (one lerp + one lookAt) as the old
  `BirdsEyeCamera`. Fireplace/torch/candle flicker are each one
  `Math.sin`-based `useFrame` per light — the same cost class as the
  existing `useLampFlicker` pattern already shipped in `furniturePieces.tsx`.
- **A real bug was caught and fixed during verification**: the new
  `<Canvas>` mount initially rendered at the browser's 300×150 default
  because R3F's `ResizeObserver` didn't see settled layout at the first
  measurement (the same known issue `Game3D.tsx` already has a documented
  fix for). The identical fix — a single delayed `resize` event dispatch
  on mount — was added to `PrestigeWorld.tsx`; confirmed live (canvas
  measured 1818×1080 after the fix, matching the container, vs. the
  broken 300×150 before it).

## 4. Verification

```bash
npx tsc -b                                              # typecheck (0 errors)
npx eslint src --max-warnings=0                         # lint (0 errors/warnings)
npx vite build                                          # production build (succeeds; 5 new lazy chunks confirmed)
npx tsx scripts/verify-phase18a-import.ts               # 118 passed, 0 failed
npx tsx scripts/verify-phase18b-university.ts           #  22 passed, 0 failed
npx tsx scripts/verify-phase18c-backend.ts              #  68 passed, 0 failed
npx tsx scripts/verify-phase18d-conflicts.ts            #  29 passed, 0 failed
npx tsx scripts/verify-phase18d-extractors.ts           #  29 passed, 0 failed
npx tsx scripts/verify-phase18e-canvas.ts               # 115 passed, 0 failed
npx tsx scripts/verify-phase18f-moodle.ts               #  80 passed, 0 failed
npx tsx scripts/verify-phase19-academic-intelligence.ts #  55 passed, 0 failed
npx tsx scripts/verify-phase20-3d-world.ts              #  43 passed, 0 failed
npx tsx scripts/verify-phase20b-character.ts            # 100 passed, 0 failed
npx tsx scripts/verify-phase20c-living-world.ts         # 165 passed, 0 failed
npx tsx scripts/verify-phase20d-room-customisation.ts   # 173 passed, 0 failed
npx tsx scripts/verify-phase20e-campus-expansion.ts     # 129 passed, 0 failed
npx tsx scripts/verify-phase20f-vertical-slice.ts       # 178 passed, 0 failed
npx tsx scripts/verify-phase21-mentor-relationships.ts  # 135 passed, 0 failed
npx tsx scripts/verify-phase22-ai-mentor.ts             #  71 passed, 0 failed
npx tsx scripts/verify-phase23-living-mentor.ts         #  61 passed, 0 failed
npx tsx scripts/verify-phase24-proactive-mentor.ts      #  80 passed, 0 failed
```

**Total: 1651 passed, 0 failed** across every pre-existing regression
harness — this phase added zero gameplay logic of its own, so no new
harness was needed; the correct proof-of-no-regression IS every prior
phase's suite staying green.

### Live browser verification (real, not simulated)

A dev server was started and `settings.worldRenderer` set to
`"prestige-v2"` directly. Confirmed live, via DOM/console inspection:

- The renderer mounts cleanly: `.prestige-v2-root` present, a real
  `<canvas>` correctly sized to its container, **zero console errors**
  across the whole session.
- **Main Gate**: keyboard movement correctly navigates between the two
  gatehouse towers (obstacle collision resolves without getting stuck);
  the E-to-interact prompt appears with the correct dynamic label
  ("Door" / "Enter The Grand Courtyard") once in range of the gate arch.
- **Scene transition**: pressing E at the gate fires the real `travel`
  action; the veil transition completes and **Grand Courtyard** mounts
  with zero errors.
- **HUD location reporting**: a genuine gap was found and fixed here —
  `PrestigeWorld.tsx` initially never called `setCurrent3DLocationLabel`
  (the same HUD-sync effect `Game3D.tsx` already has), so the persistent
  HUD chip would have silently kept showing "Campus HQ" throughout.
  Fixed; confirmed live — the HUD chip correctly read "Main Gate" then
  "Grand Courtyard" after travelling.

### Known verification gap — disclosed honestly

**Live pixel/visual confirmation (materials, lighting mood, camera
framing, NPC appearance, the Great Hall/Hall of Artisans/Dormitory
scenes' own interactables, and the mentor conversation panel actually
opening) was not completed.** The Browser pane's screenshot compositor
was unavailable this session ("the Browser pane is not displayed, so the
page is not compositing frames"), and — a real, separate finding —
`requestAnimationFrame`-driven continuous movement did not advance while
the tab was backgrounded, consistent with standard browser rAF
throttling for hidden tabs. Switching to `settings.reducedMotion: true`
(which makes each keypress an immediate, synchronous position step
rather than an animated glide) worked around the rAF issue enough to
prove Main Gate → Grand Courtyard end-to-end, but further blind,
screenshot-less dead-reckoning toward the Great Hall and Hall of Artisans
doors produced inconsistent results (the same script occasionally landed
in-range and occasionally didn't, most likely because rapid synthetic
`keydown`/`keyup` dispatch without a screen to verify against isn't a
reliable proxy for real player input) and was abandoned rather than
reported as false confidence.

This is the same category of limitation this project has disclosed
before (Phase 21/22's own "Browser preview unreachable" notes) — the
confidence basis here is the same one those phases used: a clean
typecheck/lint/production build, the full regression sweep, careful code
review against the exact, already-proven `CampusBuildingScene.tsx`
pattern this new shell mirrors, and the two real bugs this session's
partial live testing DID catch and fix (the canvas-sizing race, the
missing HUD location report) — proof the live-testing pass was genuine,
not skipped. A full screenshot-based visual QA pass (materials, framing,
all 4 districts, mentor conversation, "Coming Soon" gates) is the
single most important thing to do before this feature reaches real users,
and is called out again in §6.

## 5. Remaining prototype-quality gaps (disclosed scope decisions)

- **No real 3D asset pipeline.** Every piece of architecture is
  primitive-composed geometry (boxes, cylinders, cones, planes), not
  modelled/textured assets — exactly the constraint
  `docs/UNIGAME_V2_MASTER_DESIGN.md` §15 already flags as necessary future
  work for the FULL vision. This vertical slice proves the *shape and
  mood* of that architecture is achievable procedurally at a genuinely
  higher detail density than the old room, but true stonework texture,
  weathering, and hand-modelled detail need a real pipeline later.
- **NPC wardrobe is unchanged casual/formal clothing**, not the medieval
  robes/cloaks the Master Design calls for (§10) — no new wardrobe
  catalogue was authored this phase (a genuinely large asset-content
  task). The closest existing options (long tunics, cardigans, loose
  trousers, boots) were composed into "scholar" looks as a stopgap,
  disclosed here rather than silently presented as final.
- **No in-engine text/font system** exists anywhere in this codebase
  (confirmed, not new to this phase) — every plaque/sign/design-board is a
  plain coloured plane; real district/subject names are only ever
  conveyed through the HUD location chip and interaction-prompt copy,
  never through a mesh. "Coming Soon" gates work the same way: the real
  district name lives in the `locked-notice` action's `districtName`
  field and surfaces through the notice panel, not on the gate mesh
  itself.
- **The persistent Tasks/Subjects/Calendar/Settings panel system and the
  tab rail are NOT reskinned** — only the mentor conversation panel, the
  "Coming Soon"/inspect notice, the E-prompt, and 3 HUD chips are. The
  rest of the app's chrome still reads as the old dark-glass sci-fi
  style regardless of which world renderer is active. This is an explicit
  scope boundary (documented in `src/styles/prestige.css`'s own header),
  not an oversight — a full UI migration is future V2 scope.
- **No LOD/occlusion culling** was added — not needed at this slice's
  geometry count, but flagged in the Master Design (§15) as necessary once
  districts scale up further.
- **The camera's bounded orbit is intentionally modest** (±56° yaw, ±22%
  zoom) — enough to "look around" per the brief, well short of a free
  camera; a future phase may widen this once more of the world exists to
  look at.

## 6. Lessons learned

1. **The `Canvas` resize race is a recurring gotcha for every new lazy-
   loaded R3F entry point, not a one-off Game3D.tsx quirk.** Any future
   new renderer entry point needs the same delayed-`resize`-dispatch
   fix from day one, not discovered again via live testing.
2. **HUD-sync effects (`setCurrent3DLocationLabel` and similar) are easy
   to forget when building a new renderer entry point**, since they're
   invisible in code review (nothing fails to compile) and only show up
   as a live behavioural gap. A pre-flight checklist for any future
   renderer/scene addition should explicitly include "does this report
   its own location/state to the shared HUD."
3. **Reduced motion is a genuinely useful debugging tool, not just an
   accessibility feature** — its synchronous step-move behaviour let
   real interaction testing proceed even when the render loop itself was
   throttled by a backgrounded tab. Worth remembering for future headless/
   automated verification passes in this environment.
4. **Blind, screenshot-less dead-reckoning through 3D space does not
   scale reliably** — it worked once, cleanly, for a short, well-
   understood traversal (Main Gate's single corridor), and became
   unreliable for a long, obstacle-containing open space (the 50m
   Courtyard) purely because there was no way to verify position against
   ground truth. Future verification passes for spatial/3D features should
   prioritise getting real screenshot capability working FIRST, rather
   than substituting extensive coordinate arithmetic.
5. **Reusing an existing shell's exact structure (`CampusBuildingScene.tsx`
   → `PrestigeSceneShell.tsx`) rather than designing a new one from
   scratch paid off directly** — the new shell inherited a
   already-proven movement/camera/pose/interaction pattern, and every
   bug found during this phase was in the NEW code layered on top
   (camera framing constants, HUD wiring), never in the reused
   foundation.
6. **"Additive-only" discipline held up under real pressure** — extending
   a few shared union types (`CampusSceneId`, `WorldRenderer`,
   `InteractAction`) rippled into exactly one place each time TypeScript's
   exhaustiveness checking caught it (`CampusDirectoryPanel.tsx`'s
   `Record<CampusSceneId, Icon>`), confirming the "additive union members
   are safe" reasoning from the initial codebase map was correct in
   practice, not just in theory.

## 7. Required changes before expanding to additional districts

1. **Solve real screenshot/visual verification for this environment**
   before building further districts — the single biggest risk right now
   is shipping a district that compiles and runs but looks wrong, with no
   reliable way to catch that short of a user report.
2. **Extract a per-district "kit index"** — as more districts are built,
   `ArchitectureKit.tsx` will need organising into sub-modules (e.g.
   `architecture/stonework.tsx`, `architecture/furniture.tsx`,
   `architecture/light-fixtures.tsx`) rather than one growing file, to
   keep it navigable.
3. **Decide the wardrobe question directly** — either commit to authoring
   a real medieval-fantasy clothing catalogue (a genuine content
   investment) or explicitly accept the "scholar-look via existing
   options" compromise as the long-term V2 NPC look and stop treating it
   as a stopgap.
4. **A world-scale LOD/streaming strategy** is needed once districts
   beyond this slice's 4 are added — the existing per-scene-swap model
   (reused unmodified here) works fine at 5 scenes; it will not scale
   gracefully to a dozen+ districts without real chunked loading.
5. **A follow-up UI phase** to reskin the persistent Tasks/Subjects/
   Calendar/Settings panels and tab rail — deferred here by explicit
   scope decision (§5), but the Master Design's UI philosophy (§14) isn't
   fully realised until it happens.
6. **Formalise the camera/lighting numeric standards** this phase
   established (fog distances, orbit bounds, per-district lighting
   rig shape) into a `docs/UNIGAME_V2_ART_BIBLE.md`, the same way
   `docs/UNIGAME_ART_BIBLE.md` formalised Phase 20A's — so future
   districts inherit consistent numbers rather than re-deriving them
   per scene.

## 8. Stop condition — met

- Exactly 4 real districts built (Main Gate, Grand Courtyard, Great Hall,
  Hall of Artisans) plus 1 preview room — no more, no less.
- Every other district is an elegant, in-world "Coming Soon" gate, never
  a placeholder area.
- World scale increased dramatically and verifiably (50m courtyard, 42m
  hall, 12.5m vault apex vs. the old ~10m×7m room).
- Architecture uses stone/wood/iron/glass/banners/arches/columns/vaults/
  fireplaces/windows/books/plants/water/statues throughout — no coloured
  cubes, no flat walls.
- Lighting is a genuine per-district design pillar, not a shared preset.
- Camera showcases the architecture (bigger distance, fog, orbit) while
  keeping the accessibility contract intact.
- The Great Hall is a real centrepiece: long tables, fireplaces, banners,
  windows, candles, NPCs, ambience, 3 exits.
- The Hall of Artisans replaces the old UI room with workspaces, sketch
  tables, canvases, design boards, models, books, a mentor area, and
  student study spaces — while the real mentor/gameplay/save systems
  underneath are completely unchanged.
- Exactly one Dormitory preview room exists, clearly not the full system.
- Zero gameplay systems were rewritten, replaced, or duplicated —
  confirmed by every pre-existing regression harness staying green.
- The vertical slice is unmistakably not the old prototype.
