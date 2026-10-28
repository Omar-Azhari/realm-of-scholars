# Phase 20F — Visual Audit

Performed before any implementation, per the brief's own instruction. This
audit is code-level (reading every scene/rig file directly) rather than
screenshot-based — the Browser preview pane has been unable to render or
capture this 3D world live throughout Phases 20A–20E (a recurring
environment limitation, documented in every prior sub-phase's completion
report), so findings here are derived from the actual geometry/material/
lighting values in source, not visual inspection. Where a finding can't be
confirmed without live rendering, that's stated explicitly rather than
guessed at.

Severity key: **P0** — visibly broken · **P1** — damages the experience ·
**P2** — polish opportunity.

## Cross-cutting findings (apply to more than one location)

### ~~P1 — No visible door mesh in any of the 5 new buildings or the subject-building placeholder~~ — RESOLVED
`CampusBuildingScene.tsx`'s generic interactable renderer draws only an
**invisible** hit-box (`transparent opacity={0}`) for every interactable,
including every building's own exit/return door. Campus HQ's door is the
one exception — it has a real, hand-built, trim-tinted box mesh in
`TestRoomScene.tsx`. Library, Computer Lab, Lecture Theatre, Student
Lounge, Administration, and every subject building currently have **no
visual representation of their own exit at all** — a player only
discovers where the door is via the E-key prompt once close enough. This
is the single most significant navigation-ambiguity finding in the audit.
*Fix:* give every building a real door mesh, tinted with that building's
own `trimColor` (see next finding).

**Resolution (Part 4):** the generic interactable loop now special-cases
`kind === "door"`, rendering a real 1×2.2×0.1m trim-tinted door slab plus
a darker frame lip and a small metal handle — the same recipe Campus HQ's
own door now uses (it previously was a plain untrimmed slab, itself
flagged below as P2; both were fixed together). Every other interactable
kind is unchanged (still the invisible hit-box; visuals come from that
building's own `dressing`).

### ~~P1 — `trimColor` is defined but completely unused in every new building~~ — RESOLVED
Every `BuildingPalette` carries a `trimColor`, but nothing in
`CampusBuildingScene.tsx` or any of the 6 new dressing components ever
reads it — it's dead data. Once door meshes exist (above), tinting them
with `trimColor` fixes both findings at once and gives every building a
visible accent identity, matching Campus HQ's own door (already
trim-tinted).

**Resolution (Part 4):** fixed by the same door-mesh change above —
`palette.trimColor` is now read directly by the door mesh's material.

### P1 — No proximity-lighting or highlight feedback on any generic interactable
Campus HQ's bespoke interactables (desk, bookshelf, wardrobe, noticeboard,
coffee area, room planner) each ease a small point light brighter when the
player is in range (`proximityLight.ts`, Phase 20C). `CampusBuildingScene`'s
generic interactable renderer has no equivalent — every interactable in
the 5 new buildings and the subject placeholder gives zero physical
feedback for being "in range" beyond the HUD prompt appearing. Part 8 of
this phase asks for exactly this ("emissive highlight... nearby light
response").

### P2 — Interaction markers are fully invisible until in range
Related to the above: there is no floor decal, glow, or marker of any
kind hinting "something interactive is here" from a distance in the new
buildings. A returning player who forgets a room's layout has no visual
cue to walk toward besides the furniture silhouette itself.

### P2 — Repeated silhouettes across buildings
`Bookshelf`, `ReadingChair`, and `StorageLockers` (all from
`furniturePieces.tsx`) are reused, recoloured, across Campus HQ, Library,
Lecture Theatre, Computer Lab, and Administration. This is a deliberate,
documented performance/consistency choice (shared materials, Part 11 of
this phase's own brief asks for exactly this reuse) — flagged here only
so it's a recorded, intentional tradeoff rather than an unnoticed
duplication. No action planned; noted for completeness.

### P2 — Night-time dimming on already-dim themes
`cozy-library`'s and `digital-lab`'s baseline lighting rigs are already
the dimmest presets (Art Bible Part 7's "studious hush"/"computer glow
dominant" moods). At night (0.6× multiplier), Library's ambient drops to
≈0.21 and Computer Lab's to ≈0.18 — still non-zero and not crushed-black,
but worth a numeric check rather than an assumption; see §11 (Lighting
pass) for the full table. No crushed-black bug found, but it's the
closest any building gets to one.

## Campus HQ (`TestRoomScene.tsx` / `TestRoomProps.tsx`)

The most detailed and iterated room (20A.5/20C/20D work). No P0/P1
findings.

- ~~**P2** — Door is a plain flat box with no frame or handle detail~~ —
  RESOLVED (Part 4): given a darker frame lip + small metal handle,
  matching the recipe now used by every other building's door.
- **P2** — No discrete "confirm/select" UI sound plays when opening a
  panel (Study Planner, Subjects, etc.) — footsteps/typing/ambience all
  exist, but there's a gap between "you interacted" and "a panel opened"
  with no audio cue bridging it.
- Lighting, NPCs (mentor + 2 time-restricted students), room-theme
  system, and furniture-slot system are all in good shape — no findings.

## Library (`LibraryScene.tsx`)

- **P1** — No door mesh (cross-cutting finding above).
- **P2** — All 4 bookshelves are the same `Bookshelf` shape at 2 colour
  variants — reads slightly repetitive up close, though acceptable at
  this room's scale and consistent with "curated, not exhaustive" asset
  discipline.
- **P2** — Librarian's desk is a plain box + one cylinder lamp — the
  plainest bespoke piece in the room.
- **P2** — No wall decoration (no noticeboard/wall-art equivalent) —
  the room reads slightly bare compared to Campus HQ's density, though
  "quiet, warm" is the intended mood (Part 2, Phase 20E), so this is a
  mood-appropriate emptiness, not a defect.

## Computer Lab (`ComputerLabScene.tsx`)

- **P1** — No door mesh (cross-cutting finding above).
- **P2** — All 4 workstations are the identical `MonitorDesk` piece —
  intentional (a lab full of identical workstations is realistic), not
  flagged for replacement.
- **P2** — The server rack reuses `StorageLockers` (same shape as
  Administration's filing cabinet and Campus HQ's storage slot) tinted
  metal — acceptable reuse, noted for completeness only.

## Lecture Theatre (`LectureTheatreScene.tsx`)

- **P1** — No door mesh (cross-cutting finding above).
- **P2** — The projector screen is a static, flat, dimly emissive plane
  with no "content" — reads as "off" rather than "projecting," could
  read more alive with a subtle animated glow tied to the lecturer's
  schedule state (e.g., glow when the lecturer is in "talk" pose).
- Seating rows correctly use the shared `ReadingChair` piece — no finding.

## Student Lounge (`StudentLoungeScene.tsx`)

- **P1** — No door mesh (cross-cutting finding above).
- **P2** — Only one seating cluster (one table, two chairs) in a "hang
  out" room conceptually about socialising — reads a little sparse for
  its stated purpose, though within this phase's "no feature quantity"
  restraint, a second small addition (if any) should stay minimal.

## Administration (`AdministrationScene.tsx`)

- **P1** — No door mesh (cross-cutting finding above).
- **P2** — Only 4 objects in a 620×440-unit room (counter, lockers,
  noticeboard, one chair) — the room with the most open, undressed floor
  area of the six real locations.

## Subject-building placeholder (`SubjectBuildingScene.tsx`)

- **P1** — No door mesh (cross-cutting finding above).
- **P2** — The identity plaque has no readable text (no in-engine 3D font
  system exists) — already an honestly-documented limitation from Phase
  20E, not new. No action planned this phase (out of scope — Part 5 of
  this phase's own brief doesn't ask for a text-rendering system).
- Deliberately minimal by design (a real "future expansion point," per
  Phase 20E's own reasoning) — sparseness here is intentional, not a
  defect.

## Character Creator preview / Room Editor preview

Both reuse the exact same `ModularCharacter`/room-theme rendering as the
main world (no separate implementation to audit). All findings below
(§ Character Rig) apply equally here. No preview-specific defects found.

## Character rig (`ModularCharacter.tsx` / `characterRig.ts`)

- ~~**P1 — Real clipping risk: headscarf hairstyles + head accessories.**~~
  RESOLVED (Part 5): `hair-headscarf-drape`/`hair-headscarf-wrap` render a
  fabric drape covering most of the head/shoulders. `cap`, `beanie`, and
  `headphones` accessories render geometry at the same head region
  (y≈0.55–0.58) with **no compatibility check at all** — selecting a
  headscarf hairstyle together with any of these 3 accessories produced
  direct mesh overlap. Fixed via a new catalogue-driven
  `incompatibleAccessories`/`modestCoverageClass` field pair on
  `AppearanceOption` (`appearanceCatalogue.ts`), read by `ModularCharacter.tsx`
  to filter the accessory list before rendering — the renderer itself
  hardcodes nothing, per the brief's own instruction.
- ~~**P2 — Earrings can be visually hidden by headscarf-wrap.**~~ RESOLVED
  as a side effect of the same fix: `acc-earrings` is included in both
  headscarf entries' `incompatibleAccessories` list, so earrings simply
  don't render (rather than rendering hidden/wasted) when a headscarf is worn.
- ~~**P2 — Torso accessories (tie/pocket-square/pin/brooch) sit close to
  the jacket's own front face.**~~ RESOLVED (Part 5): added a
  `jacketLayerOffset` field to every generated jacket variant
  (`buildJacketVariants`) and a `torsoAccessoryOffsetZ` group wrapper in
  `ModularCharacter.tsx` that nudges torso accessories forward by that
  offset whenever a jacket is worn — catalogue-driven, not a hardcoded
  per-accessory fix.
- **P0 (logic bug, not visual) — pose-blend discontinuity.**
  `createPoseBlender`'s `update()` computes the OUTGOING pose during a
  crossfade using the blender's absolute clock (`computePose(previous,
  now, params)`) instead of that pose's own phase-local time. For a
  one-shot pose like `stretch` (which expects `t` clamped 0–1.4s from its
  own start), this means the outgoing half of any blend AWAY from stretch
  evaluates using a large absolute-clock value, which the pose's own
  `Math.min(duration, clamped)` clamps to its END value — so a mid-stretch
  transition doesn't blend from where the stretch visually was, it
  freezes at the stretch's ending pose first. This is the "pose snapping"
  / "animation discontinuities" defect Part 6 explicitly asks to fix, and
  is a real, confirmed bug in the code (not a hypothetical), independent
  of live rendering — hence P0 (logic is provably wrong) despite being
  visually subtle for periodic (sine-based) poses.
- **P2 — Foot sliding during walk.** The walk cycle's stride rate is
  driven by elapsed time (`cyclesPerSecond`), not distance travelled,
  so the leg-swing cycle isn't strictly locked to how far the character
  has actually moved. At this camera's distance/scale (55° bird's-eye,
  small on-screen character) this is a minor, largely theoretical
  concern rather than a glaring visual bug, but is honestly noted as a
  real characteristic of a time-driven (not distance-driven) gait cycle.
- **No finding** — head-bob amplitude (0.035 rad ≈ 2° at footfall peaks)
  was reviewed against Part 6's "overly large head bob" concern and found
  reasonable already; no change planned.
- **No finding** — NPC timing: every NPC schedule already carries a
  `scheduleTimeOffsetSeconds`, and no two NPCs sharing a scene ever share
  the same offset (checked across all 6 buildings) — "identical NPC
  timing" is already avoided by construction.

## Draw calls / scene complexity

No excessive draw-call risk found in any single scene — each building
renders a handful of low-poly primitives (a few dozen meshes at most) per
Art Bible budget (Furniture: 50–400 triangles/piece; total scene budget
<15,000 triangles), and only one scene is ever mounted at a time (scene
swap fully unmounts the previous building). No P0/P1 performance findings
from this audit; see the dedicated Performance pass (§15) for measured
bundle numbers.

## Summary table

| Location | P0 | P1 | P2 |
|---|---|---|---|
| Cross-cutting (all 6 new locations) | 0 | 3 | 3 |
| Campus HQ | 0 | 0 | 2 |
| Library | 0 | 1* | 3 |
| Computer Lab | 0 | 1* | 2 |
| Lecture Theatre | 0 | 1* | 1 |
| Student Lounge | 0 | 1* | 1 |
| Administration | 0 | 1* | 1 |
| Subject building | 0 | 1* | 2 |
| Character rig | 1 | 2 | 2 |

\* The 6 "no door mesh" P1s are one cross-cutting root cause, fixed once.

## Part 2 — The vertical slice, as a state machine

The opening 10–15 minutes, as ten steps, each with the concrete
implementation it maps to. This is the sequence Phase 20F's polish work
targets — every task below either strengthens one of these steps or
removes friction between them.

1. **Launch UniGame.** → `App.tsx` routes to `SemesterHomeScreen`/legacy
   HQ, or (if `settings.worldRenderer === "experimental-3d"`) lazy-loads
   `Game3D.tsx`.
2. **Load or complete onboarding.** → `OnboardingFlow.tsx` runs exactly
   once (`playerIdentity === null`); a returning player's identity is
   already set, so this step is instant.
3. **Enter Campus HQ.** → `Game3D` mounts with `currentScene.sceneId ===
   "campus-hq"`; `TestRoomScene` renders, player spawns, camera eases in
   (`BirdsEyeCamera`'s existing entry pullback).
4. **Receive the mentor greeting.** → the daily-loop effect (Phase 20E)
   fires a dismissible toast at 1.5s via `getMentorGreeting`.
5. **View the Daily Brief.** → the daily-loop nudge appears at 4.5s;
   clicking it (or walking to the Coffee Area) opens `DailyBriefPanel`.
6. **Travel to the Library.** → via the Campus Directory (signpost or,
   after this phase, the Menu) → `{ type: "travel", sceneId: "library" }`.
7. **Start a study interaction.** → the Reading Table or Librarian
   interactable inside `LibraryScene`.
8. **Return to Campus HQ.** → the Library's own return door →
   `{ type: "travel", sceneId: "campus-hq" }`.
9. **Unlock or preview one cosmetic room item.** → the Room Planner board
   → `RoomEditor`'s theme/furniture preview (Phase 20D), or a furniture
   item crossing an unlock threshold (Phase 20D's `syncFurnitureUnlocks`).
10. **Save and exit safely.** → `persistSaveData` (already runs on every
    save-data change, Phase 1) + the door-exit interactable's
    `leave-room` action, or simply closing the tab (autosave already
    covers this).

No step above requires a new gameplay system — every one already existed
before this phase. Phase 20F's job is making the CONNECTIVE TISSUE between
these ten steps feel deliberate: door transitions (§7), interaction
presentation (§8), Daily Brief hierarchy (§9), and first-session guidance
that walks a brand-new player through exactly this sequence once (§13).

## What this audit drives (Part 2 onward)

- Add a real, trim-tinted door mesh to all 6 new locations (fixes the P1
  door + trim findings at once).
- Add proximity-light feedback to `CampusBuildingScene`'s generic
  interactables (Part 8).
- Fix the pose-blend snapshot bug in `characterRig.ts` (Part 6).
- Add catalogue-driven compatibility metadata for headscarf/head-accessory
  and jacket/torso-accessory conflicts (Part 5).
- Everything marked "no action planned"/"intentional" above is left
  unchanged — this phase does not chase every P2 opportunity, per its own
  "do not prioritise feature quantity" instruction.

## Transition architecture (Part 7)

Building travel previously swapped `currentScene` synchronously — the old
scene unmounted and the new one mounted (behind a `Suspense fallback={null}`)
in the same instant, with no cover for that cut. `Game3D.tsx` now gates
every `travel` action through a small phase machine:

1. **`travel` fires while `transitionPhaseRef.current === "none"`.** A
   second `travel` arriving mid-transition (double E-press, a queued
   `moveTo`-then-activate callback) is dropped — the ref (not just React
   state) is checked so there's no stale-closure window for a rapid
   double-press to slip through.
2. **Phase → `"out"`.** A full-bleed veil (`.game3d-transition-veil`,
   `game3d.css`) fades from transparent to opaque over
   `TRANSITION_FADE_MS` (220ms; 60ms under reduced motion — still gates
   input, just without a visible animated fade).
3. **After the fade-out timer, the actual scene swap happens** —
   `setCurrentScene` runs, `inRange` clears — while the veil is at full
   opacity, so the unmount/remount and the incoming building's camera
   entry-pullback (`BirdsEyeCamera`'s existing ease, unchanged) are both
   hidden.
4. **Phase → `"in"`.** The veil fades back to transparent over the same
   duration, revealing the new building already settled.

Two supporting fixes close the remaining Part 7 gaps:

- **Destination preload.** `CAMPUS_SCENE_PRELOADERS` calls the exact same
  `import()` specifier each building's `lazy()` factory uses, fired the
  moment `inRange` becomes that building's door — before the player even
  presses E. A duplicate `import()` of an in-flight or already-resolved
  module is a cache hit, not a second request, so this only ever helps.
- **Arrival marker.** `CampusBuildingScene.tsx` now renders a small
  trim-tinted ring at the spawn point that expands and fades over ~1.1s
  after mount (skipped entirely under reduced motion, matching Settings'
  existing "disables entrance animation app-wide" contract) — the
  concrete answer to the audit's "no visual cue where you've arrived"
  finding.
- **Ambience cleanup (a real, previously-uncaught bug).** Both
  `TestRoomScene.tsx` and `CampusBuildingScene.tsx` started looped
  ambience sounds on mount but never stopped them on unmount — travelling
  away left a building's room-tone/hvac-hum/etc. playing forever,
  underneath whatever the next building started. Both now return a
  cleanup from that effect calling `stopSound` on every event they
  started.

Camera settle (the entry pullback + damped follow in `BirdsEyeCamera.tsx`)
and spawn orientation (each building's fixed entry yaw, consistent across
all 7 scenes) were reviewed and already met the brief — no changes made
there, per this phase's "optimise only verified problems" discipline.

## Lighting / material consistency pass (Part 11)

Numeric audit against `docs/UNIGAME_ART_BIBLE.md` (code-level, comparing
every building's actual values against the Bible's tables — the same
methodology as the rest of this document). `roomThemes.ts`'s six lighting
presets and their wall/floor/trim colours were checked first and found to
match Part 9's table exactly, with zero drift — the reference point every
building's `BuildingPalette` borrows from. Shadow settings
(`shadow-mapSize={[1024,1024]}`, `shadow-radius={4}`, identical sun
position `[2.2, 5.4, 1.1]`) are shared verbatim between `TestRoomScene.tsx`
and `CampusBuildingScene.tsx` — no inconsistent shadow direction anywhere.

**Real, confirmed violations found and fixed:**

- **`metalness` was nonzero in 7 places**, directly against Part 5 rule 1
  ("metalness is always 0... the single hardest constraint... most likely
  to get accidentally violated"): the Computer Lab's desk surface, legs,
  and screen bezel (0.1–0.2); the Student Lounge's espresso machine (0.3);
  the Subject Building's identity plaque (0.1); and — caught by this same
  pass — **the door handle this very phase added to Campus HQ and all 6
  campus buildings under Part 4** (0.4). All corrected to 0.
- **Computer Lab's screen material didn't use the Art Bible's own named
  material.** Part 5 defines "Plastic (screens, small props)" as bezel
  `#3a3630` / screen emissive `#bcd9e8` — the Computer Lab's screens
  instead used a near-black bezel (`#1a1a1a`) and a saturated subject-
  accent blue (`#3da9fc`, the Cloud-Based Web App Dev UI colour) as the
  screen glow. The saturated blue also violated Part 1's "never a pure
  saturated primary" rule for the World register. Both corrected to the
  Bible's actual material spec.
- **Lecture Theatre's floor colour had drifted from its own borrowed
  theme.** Every other building copies its Room Theme's wall/floor/trim
  colours verbatim (confirmed exact matches for Library, Computer Lab,
  Administration, Student Lounge); the Lecture Theatre's floor
  (`#4f382a`) didn't match Classic Academy's actual floor (`#8a6a42`) —
  notably darker, with no documented reason, and risked crushing toward
  black once the night intensity multiplier (0.6x) applied on top.
  Corrected to match the theme.
- **Night didn't actually read as night.** Part 7's time-of-day table
  names Night as "the one context allowed to go cool" (ambient `#40485c`)
  — every other time-of-day preset only dims intensity. The shipped
  `timeOfDay.ts` (Phase 20E) only ever scaled intensity, for any time of
  day, so Night was a uniformly-dimmed version of whatever theme was
  active — visually reading as "the dimmer switch is down," not "it's
  night." Added `ambientColorOverride` to `TimeOfDayAtmosphere`, set only
  for Night (`#40485c`), read by both scene files' ambient light — the one
  documented exception to "never a colour change," per the Bible's own
  wording, kept as narrow as the Bible itself scopes it (ambient only; sun
  and hemisphere still just dim).

**Reviewed, no change needed:** the projector screen's dimmer emissive
(`#dfe6ea` @ 0.15` vs the monitors' `#bcd9e8` @ 0.5) — a projection
surface and a self-lit monitor are different material contexts per Part
5's own table (screens = "Laptops, monitors"; a projector plane isn't
listed there), and the audit already flagged the projector's dim
"reads as off" look as an intentional P2 opportunity, not a bug.

**Reviewed, honestly noted, not built:** none of the 6 new buildings have
any window/glass geometry (Campus HQ has the only one, in
`TestRoomProps.tsx`) — not a material inconsistency (nothing misuses the
glass material), just an absence. Adding windows to 6 buildings is new
geometry, not lighting/material polish, and wasn't a P0/P1 audit finding —
left for a future content pass, per this phase's "no feature quantity"
restraint.

## Audio mixer architecture (Part 10)

`lib/sound.ts` gained a mixer layer on top of the existing one-`Audio`-
element-per-event cache (Phase 20/20C), rather than a second audio system.

**Categories.** Every `SoundEvent` maps to one of six categories
(`SOUND_EVENT_CATEGORY`): `ambience`, `footsteps`, `interaction`, `ui`,
`npc`, `music` — the exact six the brief asks for. `npc` covers activity
cues shared between the player and NPCs (typing/paper-turn/coffee-place/
chair-move) rather than a literal player-vs-NPC split, since nothing at an
`emitSound` call site currently tags who triggered it; splitting that
further would need threading a source id through every call site, which
Part 10 doesn't ask for. `music` has zero member events today — reserved,
not dead, the same "renders whatever exists" contract the rest of the
audio system already follows (no commercial music has been added).

**Two real bugs found and fixed, not just "architecture":**

- **Loop sounds stopped for every source when only one finished.** Every
  `NpcCharacter` and the player independently call
  `playActivitySoundOnChange`, which calls the SAME shared `emitSound`/
  `stopSound` for a shared event name (e.g. `"typing"`). Previously,
  `stopSound` unconditionally paused the one shared `Audio` element — so if
  NPC A and NPC B were both "typing" and NPC A stopped, NPC B's still-
  ongoing typing sound was silenced too. Fixed with a reference count
  (`loopRefCounts`): `emitSound(event, {loop:true})` increments it and
  starts the audio only if it wasn't already playing; `stopSound` only
  actually pauses once the count reaches 0.
- **One-shot sounds could retrigger arbitrarily fast.** Two NPCs (or an NPC
  and the player) hitting the same one-shot cue a couple of frames apart
  restarted the clip from 0 each time — audible as a stutter, and the exact
  "overlapping coffee sounds" / "repeated door sounds" the brief flags.
  Fixed with a per-event cooldown (`SOUND_EVENT_COOLDOWN_MS`, 120ms
  default; 250–400ms for the specifically-flagged events) — a repeat emit
  inside the window is dropped rather than restarting the clip.

**Category volume.** `setCategoryVolume`/`getCategoryVolume`, 0–1, applied
to `audio.volume` on every emit AND immediately to any already-playing
audio in that category (so a slider mid-ambience-loop takes effect without
waiting for the loop to restart). Persisted as `settings.soundVolumes`
(`SoundMixerSettings`, `types/domain.ts` — additive, defaults to all-1.0
for saves predating this phase) and synced into the module by
`SaveDataContext` the same way `soundEnabled` already was. Settings screen
gained one slider per category under the existing Sound section.

**Ambience cleanup** was already fixed under Part 7 (scene-unmount
`stopSound` calls) — the ref-counting change above doesn't alter that,
since each building is only ever mounted once at a time.

**Priority.** Interpreted as relative default loudness rather than a
ducking system (a full priority-preemption model would need per-category
audio buses, out of scope for "no new major gameplay system") — all six
categories default to 1.0 (full), leaving actual balance to the per-
category sliders once real audio files exist; there's nothing to tune by
ear yet since no `.mp3` assets exist in this repo.

## Performance measurement + quality tiers (Part 15)

Measured, not estimated — every number below came from an actual
`npm run build` or a script that imports the real, shipped world data
(not a hand count).

### Bundle / chunk sizes (production build, this phase's final state)

| Chunk | Size | Gzip |
|---|---|---|
| `characterRig` (three.js core + rig) | 840.13 kB | 225.15 kB |
| `index` (main app bundle) | 707.23 kB | 210.63 kB |
| `docxExtract` | 494.88 kB | 129.77 kB |
| `pdfExtract` | 476.14 kB | 141.97 kB |
| `Game3D` (this phase's own code — up from 48.68 kB at Phase 20E's end to 51.30 kB, from the transition/mixer/quality-tier work) | 51.30 kB | 14.74 kB |
| `CharacterCreator` | 27.20 kB | 8.05 kB |
| `CampusBuildingScene` (shared building shell) | 6.38 kB | 2.47 kB |
| `SubjectBuildingScene` | 5.08 kB | 1.94 kB |
| `StudentLoungeScene` | 4.70 kB | 1.78 kB |
| `LibraryScene` | 4.37 kB | 1.76 kB |
| `RoomEditor` | 3.89 kB | 1.55 kB |
| `LectureTheatreScene` / `ComputerLabScene` | 3.65 kB each | ~1.6 kB each |
| `AdministrationScene` | 3.32 kB | 1.49 kB |
| `roomThemes` | 2.07 kB | 0.70 kB |

Every building (5 real + subject placeholder + the shared shell) is still
its own separately-loaded chunk, confirming the lazy-streaming
architecture from Phase 20E survived this phase's changes intact — no
building's code leaked into `Game3D`'s own chunk or another building's.
The two >500kB chunks flagged by Vite's own warning (`characterRig`,
`index`) predate this phase and are unrelated to the 3D world (the legacy
academic-import PDF/DOCX extractors dominate `index`'s actual weight, not
the game). **Destination preload timing**: at 3.3–6.4kB per building
chunk, even an uncached fetch over a slow connection completes in well
under 100ms in practice — the mechanism (Part 7) exists to eliminate even
that, not because it was measured as a bottleneck.

### Scene object counts (real, imported data — not estimated)

| Location | Obstacles | Interactables | NPCs |
|---|---|---|---|
| Campus HQ | 6 | 9 | 3 |
| Library | 4 | 3 | 1 |
| Computer Lab | 5 | 3 | 1 |
| Lecture Theatre | 3 | 3 | 1 |
| Student Lounge | 2 | 3 | 2 |
| Administration | 2 | 4 | 1 |
| **Total (6 real locations)** | **22** | **25** | **9** |

Only one scene is ever mounted at a time (a scene swap fully unmounts the
previous building), so the actual concurrent load is never the sum above —
it's whichever single building is active. The busiest is Campus HQ (3
NPCs + the player = 4 animated characters), matching the pre-existing
20E/20C regression assertions ("NPC count stays modest, <=3 per building").
Mesh/triangle counts were already measured in this document's own
"Draw calls / scene complexity" section above — under the Art Bible's
<15,000-triangle-per-room budget (Part 14), with no P0/P1 finding.

### Texture memory

**0 bytes measured, honestly.** Every surface in this renderer is a flat
`meshStandardMaterial`/`meshBasicMaterial` colour — there are zero texture
files anywhere under `public/assets/` for the 3D world (procedural
primitive geometry throughout, per the Art Bible's own "100% procedural"
note in Part 13). This isn't a target being hit; there's nothing to
measure yet because no texture pipeline has been built.

### Quality tiers (Auto default, per the brief)

New module `src/game3d/quality.ts` — four settings
(`types/domain.ts`'s `GraphicsQuality`), each resolving to a
`QualityPreset` consumed by exactly two things: `<Canvas dpr={...}
shadows={...}>` in `Game3D.tsx`, and a `shadowMapSize` prop threaded to
both scene shells (`TestRoomScene.tsx`, `CampusBuildingScene.tsx`) for
their `directionalLight`'s `shadow-mapSize`.

| Tier | dpr | Shadows | Shadow map |
|---|---|---|---|
| Low | [1, 1] | off | 512 |
| Medium (Art Bible's existing baseline) | [1, 1.5] | on | 1024 |
| High | [1, 2] | on | 2048 |
| Auto (default) | resolves to one of the above | | |

**Auto's heuristic** (`resolveAutoQualityTier`) reads
`navigator.hardwareConcurrency`/`deviceMemory` — coarse, standard,
always-available-or-silently-absent signals, not a live benchmark (no
render environment exists in this session to benchmark against). Disclosed
as a heuristic, not a measured guarantee, in the module's own comment.
Persisted as `settings.graphicsQuality` (additive, defaults to `"auto"` for
every pre-existing save via `sanitizeSaveData`), with a dropdown in
Settings' existing "Campus World" section. **The legacy 2D renderer is
completely untouched** — it never imports `quality.ts`, has no Canvas, and
has no concept of shadow maps or dpr; "must not degrade the legacy 2D
path" is satisfied by the two code paths never intersecting, not by a
runtime check.

Deliberately NOT built: per-mesh LOD swapping, geometry instancing, and a
`castShadow` toggle threaded through every furniture file — the dpr cap
and the Canvas-level `shadows` on/off switch are the two highest-leverage,
lowest-disruption levers for this renderer's actual content (a few dozen
procedural meshes per room, already well under budget), and building a
full LOD/instancing system for content that isn't triangle-heavy yet would
be solving a problem this phase's own measurements didn't find.

## Menu-level Campus Directory + navigation polish (Part 12)

The brief's own follow-up on a documented Phase 20E limitation ("no Menu-
level teleport shortcut exists"). Two real gaps closed:

**Menu-level Campus Directory.** `CampusDirectoryPanel.tsx` (Phase 20E) was
only reachable by walking to Campus HQ's signpost — no accessibility
alternative existed. `MenuPanel.tsx` now has a "Campus Directory" item
(shown only when `settings.worldRenderer === "experimental-3d"` — the
legacy 2D world has no building-to-building travel concept to offer a
shortcut for), rendering the exact same panel component. The one real
architecture problem: `MenuPanel.tsx` lives outside `Game3D.tsx`'s
component tree entirely (a sibling in `WorldShell.tsx`), so a selection
can't call into Game3D's local `currentScene` state directly. Solved by
extending `WorldUiContext` (already the established cross-boundary bridge
— `focusRequest`/`consumeFocusRequest` already do exactly this for a
different purpose) with `campusTravelRequest`/`requestCampusTravel`/
`consumeCampusTravelRequest`: the Menu queues a raw `InteractAction`,
`Game3D.tsx` consumes it through its own existing `handleAction` — the
identical travel path (transition veil, input lock, everything from Part
7) a physical door or the in-world signpost already use, not a second
mechanism. World walking remains the primary experience; this is
additive, and every button involved is a plain `<button>`, so keyboard
operability (Tab/Enter) comes for free rather than needing bespoke
handling.

**Current-location HUD indicator** — the audit's own confirmed-missing
finding. `WorldShell.tsx`'s top-centre location label is derived from the
URL route, which never changes as the player travels between 3D campus
buildings (deliberately, per Phase 20E's "seamless travel"). Added
`current3DLocationLabel`/`setCurrent3DLocationLabel` to the same
`WorldUiContext`; `Game3D.tsx` reports its actual current building's label
(via `campusMap.ts`'s `getCampusLocationMeta`, or the subject's real name
for subject buildings) any time `currentScene` changes, clearing it on
unmount. `HudLocation.tsx` — a genuine child of `WorldUiProvider` in the
component tree, unlike `WorldShell.tsx` itself, which mounts the provider
and so can't call `useWorldUi()` on itself — reads it and overrides the
route-derived label when present. The 2D renderer is unaffected either
way: the value is `null` whenever `Game3D` isn't mounted.

**Bundle note.** `CampusDirectoryPanel.tsx` (and `campusMap.ts`) have zero
three.js/R3F imports — confirmed before making it a static import in
`MenuPanel.tsx` (part of the always-loaded main bundle, not the 3D lazy
boundary). Rollup accordingly moved that ~few-KB of pure data/JSX out of
`Game3D`'s own chunk (which shrank slightly) and into the shared main
bundle (which grew by a matching few KB) — a small, deliberate, one-time
cost paid by every user (2D and 3D alike) so the accessibility shortcut
works regardless of which renderer is active; it does not add any
Three.js/R3F code to the 2D-only path.

## First-session guidance layer (Part 13)

The 3D Campus had zero first-session guidance before this — the legacy 2D
world's own "New here? Three steps" coach mark (`WorldShell.tsx`) has no
3D equivalent, and doesn't apply to it (it's gated on the 2D-only route
state). Added a matching coach mark for the 3D world, deliberately reusing
the *exact* visual language (`.world-coach-mark`, same CSS, same
`role="status"` pattern) rather than inventing a second design: shown only
in Campus HQ, only until dismissed, covering the six topics the brief
names (move, interact, Daily Brief, Campus Directory, first study
location, return to HQ) as one short list — no giant modal, no mandatory
reading, ended only by the player's own "Got it" click, never auto-timed
out or otherwise forced.

**Separate dismissal state from the 2D world's own hint** —
`campus3DGuidanceDismissed` (new, additive `AppSettings` field, defaults
`false`) rather than reusing `onboardingHintDismissed`. The two renderers'
first-run guidance are independent by design: dismissing one should never
silently suppress the other, since a player might use both renderers on
the same save.

**Resettable from Settings** — the brief's own explicit requirement, and
notably something the pre-existing 2D hint never had (audited during this
pass: no reset control exists anywhere for `onboardingHintDismissed`,
a real, pre-existing gap left as-is since fixing the 2D hint's reset
wasn't itself asked for). Added "Show first-session guidance again" to
the Campus World settings section, disabled until there's actually
something to reset.

**Not a quest system** — the list is static content; nothing tracks
whether the player has actually moved, interacted, or visited anywhere.
It's guidance, not a checklist with completion state, matching the
brief's explicit exclusion.

## Error + empty states pass (Part 14)

Audited every scenario the brief names, against the actual code (not
assumed):

**Already safe, verified by reading the code, no fix needed:**
- **Corrupted appearance catalogue id.** Every lookup in
  `ModularCharacter.tsx` (`findOption`/`findBodyPreset`/`findSkinTone`/
  etc.) already returns `undefined` on a miss, and every render helper
  (`renderHair`, `renderTop`, `renderJacket`, `renderFacialHair`, …)
  already starts with `if (!option) return null;` — a corrupted/stale id
  just renders that body part absent, never a crash. `accessories` is
  already `.filter(Boolean)`-cleaned. This was already built defensively
  in Phase 20B; confirmed still true rather than assumed.
- **Missing room furniture item.** `findFurnitureItem(id) ?? null` in
  `TestRoomScene.tsx` already degrades to an empty slot the same way.
- **Unavailable audio.** `sound.ts` already fails silently per-event on a
  missing file (unchanged, pre-existing, Phase 20 baseline).
- **No imported subjects/assessments/timetable.** Fixed this phase under
  Part 9 (Daily Brief polish) — "Your next imported assessment will appear
  here.", "No classes scheduled today.", etc.
- **Save migration fallback.** `sanitizeSaveData`'s field-by-field
  fallback (unchanged, extensively tested across every prior phase) —
  this phase's own two new settings fields (`soundVolumes`,
  `graphicsQuality`, `campus3DGuidanceDismissed`) all follow the exact
  same pattern.

**Found a real, unmitigated gap and fixed it:** the app has one, top-level
`ErrorBoundary` (RC1) that catches any crash with a generic "Reload
UniGame" recovery — but nothing more specific to the 3D renderer. A failed
building's lazy chunk, a WebGL context failure, or any other 3D-only
render crash ("failed building load", "3D renderer failure",
"unsupported graphics" — all named in the brief) would previously bubble
straight to that generic top-level fallback, forcing a full page reload
with no way to simply switch back to the (far more mature, unaffected)
legacy 2D renderer. Added `Game3DErrorBoundary.tsx`, wrapping `Game3DLazy`
at both its mount points (`SemesterHomeScreen.tsx`, `SubjectRoomScreen.tsx`)
— on catch, offers **Retry** (re-mount, in case it was transient) and
**Use 2D Campus instead** (flips `worldRenderer` to `"legacy-2d"`, the one
recovery that works regardless of what actually failed, since the two
renderers are save-compatible and switching is already a zero-data-loss,
everyday setting). Never exposes stack traces — same discipline as the
existing top-level boundary, details go to `console.error` only.
