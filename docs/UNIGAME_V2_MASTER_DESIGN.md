# UniGame V2 — Master Design Document

## Prestige Fantasy University RPG Edition

**Status: Governing creative direction for all future work.** This
document supersedes every prior visual/architectural/presentation
decision, including `docs/UNIGAME_ART_BIBLE.md` in full (its "stylised
low-poly modern-university diorama" direction, its locked bird's-eye-only
camera, its sci-fi subject character concepts) and the presentation
portions of every Phase 20–24 completion doc. It does **not** touch or
reinterpret anything those docs said about gameplay systems — see
§16/§17 for the exact boundary.

No code is written against this document yet. This is the reference every
future implementation phase must open first, the same way every prior
phase opened its own audit before writing a line of code.

---

## 0. Why this reset exists

UniGame's gameplay layer — a real semester turned into a living,
AI-mentored progression system — has worked from Phase 1 through Phase 24.
What hasn't worked is the world it lives in. A player opening the 3D
world today sees a small, blocky, low-poly room with a fixed bird's-eye
camera and a handful of coloured boxes standing in for buildings. It reads
as a prototype because it *is* one — deliberately scoped small at every
prior phase to prove the gameplay systems first. That job is done. The
systems are real, tested, and load-bearing (1135 regression checks as of
Phase 24). They have earned a world that matches their ambition.

This document is that world's constitution.

---

## 1. Overall Vision

**UniGame V2 is not "a study planner with a 3D mode." It is a prestige
fantasy university RPG in which a real university semester is the main
story.**

Picture the tonal blend of:

- **RuneScape** (classic era) — a persistent world built from real
  places the player comes to know by name and feel, not a lobby-and-instance
  structure.
- **Hogwarts Legacy** — an ancient, magical institution rendered with
  real architectural weight: stone, scale, history, reverence.
- **Oxford/Cambridge** — the real-world referent underneath the fantasy
  skin: quads, cloisters, chapels, libraries older than nations, bells
  marking the hours.
- **Dark Academia** (the aesthetic movement) — candlelight, old books,
  wood and brass, autumnal palettes, the romance of study itself.
- **Guild Wars 2** — environmental scale and verticality used as a
  storytelling tool: you *feel* small in front of a cathedral, and that
  feeling is the point.
- **A world-class AI mentor** — the one wholly original pillar, already
  built (Phases 21–24), now finally given a world worthy of it.

The player should open UniGame and think: *I actually want to spend time
here.* Not "I should check my tasks." Not "let me open the planner."
*I want to walk through the Grand Library at dusk and see what's changed.*

Every real academic action — completing a module, submitting an
assessment, holding a streak, building trust with a mentor — already
drives the gameplay layer's progression. V2's entire job is to make the
*experience* of that progression feel like advancing through a world worth
advancing through, instead of ticking boxes in a diorama.

### What this game explicitly is not

- Not a futuristic or sci-fi setting (the old `characterConcept` flavour
  text — holographic tablets, floating terminals, server drones — is
  retired; see §17).
- Not minimalist, not low-poly-cute, not a "diorama."
- Not Roblox-scale or Roblox-silhouetted.
- Not menu-driven where a diegetic alternative is possible (§14).
- Not modern-campus (no lecture halls with fluorescent lights, no
  whiteboards, no laptops as set dressing).

---

## 2. World Philosophy

**The world is the reward.** Every design decision in this document is
downstream of one rule: *a player who has nothing to do right now should
still want to be here.* That means:

1. **Scale before detail.** A convincing sense of a MASSIVE place, even
   where individual assets are simple, beats a small space rendered with
   perfect fidelity. Verticality (towers, bridges, cliffside paths),
   distance (skyline visible from every courtyard), and depth (archives
   beneath archives) are the primary tools.
2. **Districts, not rooms.** The old world was a room-and-hallway
   floorplan. The new world is a *place* — a university town with
   quarters, the way a real ancient university (or RuneScape's Varrock, or
   Hogwarts' grounds) is a place you navigate by landmark, not by menu.
3. **Every subject is a pilgrimage, not a tab.** Walking from the Grand
   Courtyard to the Hall of Artisans should take real, deliberate time
   and pass through real scenery — not because travel should be a chore,
   but because the JOURNEY is where "this world is alive" gets proven.
4. **History is felt, not explained.** Nothing needs a lore dump. Worn
   flagstones, patched banners, a half-finished mural, a bricked-up
   doorway — the world should look like it has been here for centuries
   and the player just arrived.
5. **Nothing is a coloured box.** Every surface earns a material: stone,
   timber, parchment, brass, stained glass, moss, rust, gold leaf. See §6.
6. **The player's own story is the main quest.** There is no separate
   fictional "save the kingdom" plot layered on top. The real semester —
   its deadlines, its subjects, its mentors, its slow accumulation of
   mastery — *is* the narrative. The fantasy world exists to make that
   story feel legendary instead of administrative.

---

## 3. World Map

The world is a single, continuous, walkable landmass — **Aldwyn
University** — arranged around one central hub with districts radiating
outward, connected by real paths, bridges, and (later) shortcuts. No
loading-screen room hopping where a walkable path can exist instead
(reserving instanced loading only for truly separate structures, per §15).

```
                              ╔══════════════════╗
                              ║   NORTH TOWER     ║
                              ║  Grand Library     ║
                              ║  Hidden Archives   ║
                              ║  The Observatory   ║
                              ╚═════════╦══════════╝
                                        │
                    ╔═══════════════════╩═══════════════════╗
                    ║                                         ║
          ╔═════════╩═════════╗                     ╔═════════╩═════════╗
          ║   WEST WING        ║                     ║   EAST WING        ║
          ║  War Council       ║                     ║  Arcane Archive    ║
          ║  Guild Hall        ║   ╔═══════════╗      ║  The Catacombs     ║
          ║  Training Grounds  ║═══╣  GRAND     ╠══════║  (undercroft)     ║
          ╚═════════╦═════════╝   ║ COURTYARD  ║      ╚═════════╦═════════╝
                    │             ║ (the Hub)  ║                │
                    │             ╚═════╦══════╝                │
                    │                   │                        │
          ╔═════════╩═════════╗   ╔═════╩══════╗      ╔═════════╩═════════╗
          ║   SOUTH TOWER      ║   ║ GREAT HALL ║      ║  THE BRIDGE        ║
          ║  Hall of Artisans  ║   ║(ceremonies,║      ║  (crosses the      ║
          ║  The Gardens       ║   ║ semester   ║      ║   ravine to the    ║
          ╚═══════════════════╝   ║ milestones)║      ║   Student Village) ║
                                   ╚════════════╝                │
                                                        ╔═════════╩═════════╗
                                                        ║  STUDENT VILLAGE   ║
                                                        ║  Dormitories       ║
                                                        ║  (Player Sanctum)  ║
                                                        ║  The Tavern        ║
                                                        ╚════════════════════╝

  Secret Passages thread beneath/between all districts — unlockable
  shortcuts, tied to real progression milestones (see §11).
```

### District index

| District | Contains | Real-world echo |
|---|---|---|
| **The Grand Courtyard** | Central plaza, fountain, the Signpost of Travel, notice boards | An Oxbridge quad / RuneScape town square |
| **The Great Hall** | Ceremony space, semester-milestone events, the sorting-adjacent "First Day" sequence | A cathedral nave / Hogwarts' Great Hall |
| **North Tower** | Grand Library, Hidden Archives, The Observatory | The Bodleian, a monastic scriptorium |
| **South Tower** | Hall of Artisans (UI Design), The Gardens | A guild workshop quarter + physic garden |
| **West Wing** | War Council Chamber (Project Management), Guild Hall (Professional Practices), Training Grounds | A castle's war room + merchants' guild |
| **East Wing** | Arcane Archive (Cloud Computing), The Catacombs | An alchemist's tower + a crypt-library |
| **The Bridge** | The stone span crossing the ravine | A Hogwarts-style viaduct |
| **Student Village** | Dormitories (the Player Sanctum), The Tavern (student commons) | A collegiate quad's residential side + its buttery |
| **Secret Passages** | Unlockable shortcut network | Marauder's-Map-style hidden routes |

Existing gameplay locations map onto this world without inventing new
gameplay, only new *place*:

| Current (V1) location | Becomes (V2) | Notes |
|---|---|---|
| Campus HQ | **The Grand Courtyard** | Arrival point, travel hub, signage |
| Library | **The Grand Library** (North Tower) | General resources, reading, quiet study |
| Computer Lab | **The Observatory** (North Tower) | Astrolabes/orreries/calculation engines replace terminals |
| Lecture Theatre | **The Great Hall** | Congregation, ceremony, semester events |
| Student Lounge | **The Tavern** (Student Village) | Social commons, NPC chatter, rest |
| Administration | **The Chancellery** (North Tower, ground floor) | Registrar, settings-as-bureaucracy flavour |
| Subject: UI Design | **Hall of Artisans** (South Tower) | Iris's domain |
| Subject: Cloud Computing | **Arcane Archive** (East Wing) | Cass's domain |
| Subject: Project Management | **War Council Chamber** (West Wing) | Mara's domain |
| Subject: Professional Practices | **Guild Hall** (West Wing) | Theo's domain |
| Room customisation | **The Player's Dormitory** (Student Village) | The sanctuary, §12 |
| Character Creator | **The Outfitter's Alcove** (Student Village, en route to Dormitories) | Reskinned, same system |

---

## 4. Every District (detail)

### 4.1 The Grand Courtyard (hub)

The heart of Aldwyn. A vast stone plaza open to the sky, worn smooth by
centuries of footsteps, centred on a working fountain. A weathered
signpost (the diegetic fast-travel point, §14) stands at its centre,
carved with the names of every district. Four covered colonnades lead off
toward North/South/East/West. Banners of the four subject-guilds hang
from the surrounding walls, weathered and real, not corporate-clean.
Pigeons. Fallen leaves in autumn. The first thing a new player sees.

### 4.2 The Great Hall

A cathedral-scale congregation space: soaring ribbed vaults, long refectory
tables, a high table on a dais, stained glass depicting the founding of
the four disciplines. This is where semester milestones are *felt* —
the semester-completion ceremony (already built as a gameplay moment in
Phase 11) becomes a literal event staged here: candles lit, bells rung,
the player's name entered into an illuminated manuscript roll of honour.

### 4.3 North Tower — Grand Library, Hidden Archives, The Observatory

A single soaring tower, spiralling upward, that a player ascends via a
grand staircase wrapping its interior. The **Grand Library** occupies the
lower floors: shelves rising three storeys, rolling ladders, reading
alcoves lit by hanging lamps, a hush that the ambient audio (§13) makes
audible. The **Hidden Archives** are a locked-until-earned upper floor —
dustier, older, lit only by what light the player brings — unlocked by
real academic milestones (a nod to the old "Collections"/"Timeline"
screens, now a physical place). **The Observatory** crowns the tower: an
open-air platform ringed by brass astrolabes, orreries, and a great
telescope, standing in for the old Computer Lab — calculation and
technology reframed as astronomy and instrumentation rather than modern
computing.

### 4.4 South Tower — Hall of Artisans, The Gardens

Iris's domain. A workshop-guild hall: high clerestory windows for natural
light (a painter's studio, scaled to cathedral proportions), drafting
tables, half-finished sculptures and stained-glass panels in progress,
paint-spattered stone floors, the smell (conveyed visually/audibly) of
turpentine and hot wax. Attached: **The Gardens** — a walled physic garden
with fountains, topiary, a greenhouse, benches for quiet reading — the
South Tower's answer to "green space," and a natural home for the
game's calmer, restorative beats (Focus Sprint breaks, evening
reflection).

### 4.5 West Wing — War Council Chamber, Guild Hall, Training Grounds

Mara's **War Council Chamber**: a fortified strategy room, a huge relief
map table at its centre (standing in for the old Gantt-chart-flavoured
UI), banners of campaigns won, a wall of pinned dispatches. Theo's
**Guild Hall**: a merchants'-guild trading floor — ledgers, contracts,
a pitch dais, the energy of a market at its busiest hour. **Training
Grounds**: an open courtyard between the two, used for Focus Sprint
"drills" and any future physical/kinetic minigame framing.

### 4.6 East Wing — Arcane Archive, The Catacombs

Cass's **Arcane Archive**: a tower of stacked brass machinery and glowing
sigil-etched conduits standing in for server infrastructure — "the
cloud" reframed as literal arcane architecture, pipes of light instead
of fibre, a control gallery of levers and dials instead of a dashboard.
Beneath it, **The Catacombs**: a crypt-like undercroft of experiment and
failure — old prototypes, cracked vessels, the "debugging" of the world
made literal — reserved for deeper, unlockable content.

### 4.7 The Bridge

A single dramatic stone span crossing a ravine between the academic core
and the Student Village — the game's signature "stop and look" moment,
timed to sunset/dawn lighting (§7) more often than not. Wide enough for
NPCs to cross in both directions, giving the world a sense of other
people living in it.

### 4.8 Student Village — Dormitories, The Tavern

The residential quarter. **Dormitories** house the player's own room
(§12) in a tower of individual chambers — the player's window is visible
from outside, and (long-term aspiration) its light/decor is visible to
represent the room's own evolution. **The Tavern** is the social commons
— firelit, low-beamed, replacing the old Student Lounge — where ambient
NPCs gather, gossip (the existing Campus Life ambient-dialogue system,
Phase 24), and the player can simply sit and listen.

### 4.9 Secret Passages

A hidden network — behind a bookshelf in the Grand Library, through a
loose stone in the Catacombs, a trapdoor in the Tavern cellar — unlocked
by real milestones (a bond level, a semester era transition, a streak
threshold) rather than discovered through puzzle-solving. These are
purely a *reward for real progress made tangible as world access*, tying
directly into the existing Room Unlock Progress / Furniture Unlock
systems (preserved, §16).

---

## 5. Every Building (landmark index)

Beyond the districts above, the skyline and grounds carry named landmarks
a player learns to navigate by sight — the RuneScape-style "everyone
knows where the Wilderness ditch is" effect:

- **The Founder's Statue** — Grand Courtyard centrepiece alternative/
  companion to the fountain; a landmark visible from multiple districts.
- **The Bell Tower** — marks in-world time-of-day audibly (§13) and
  visually (its shadow sweeps the Courtyard).
- **The Chancellery** — North Tower's ground floor; registrar's office;
  settings and account-adjacent flows live here diegetically as a
  "records office."
- **The Outfitter's Alcove** — a tailor's shop in Student Village; houses
  the Character Creator.
- **The Notice Board** — a physical board in the Grand Courtyard and a
  smaller one in the Tavern; the diegetic home for notifications (§14).
- **The Old Gate** — the original, now largely ceremonial, main entrance;
  used for the onboarding "arrival" sequence.
- **The Ravine** and **The River** — the natural landscape features that
  make The Bridge necessary and give North/East Wing genuine physical
  separation, reinforcing scale.

---

## 6. Architectural Style Guide

**One sentence rule: if it wouldn't look at home in a medieval European
university town, a monastery, or a castle, it doesn't belong.**

### Materials palette

| Material | Where it dominates | Explicitly avoid |
|---|---|---|
| Weathered sandstone/limestone | Exteriors, towers, bridges | Smooth modern concrete |
| Dark oak/aged timber | Beams, doors, furniture, shelving | Plywood/laminate look |
| Wrought iron & aged brass | Fixtures, lanterns, hinges, astrolabes | Chrome, polished steel |
| Stained glass & leaded panes | Great Hall, chapels, tower windows | Plate glass, curtain walls |
| Parchment, vellum, leather | Books, scrolls, journals, banners | Glossy paper/plastic |
| Moss, ivy, lichen | Courtyards, older stonework, the Catacombs | Sterile clean surfaces |
| Gold leaf & candle wax | Ceremonial spaces, illuminated manuscripts | Neon, LED, chrome trim |
| Rough-hewn stone floors, worn smooth at high-traffic points | Everywhere | Tile, laminate, rubber flooring |

### Silhouette & massing rules

- **Verticality wins.** Towers, spires, and stepped rooflines over flat
  boxes. A district should be recognisable from its skyline silhouette
  alone.
- **Asymmetry reads as history.** Real ancient buildings accrete unevenly
  — a later wing, a rebuilt tower, a patched wall. Perfect symmetry is
  reserved only for the most ceremonial spaces (the Great Hall's nave).
- **Depth over width.** Favour tall, deep interiors (the Grand Library's
  three storeys) over sprawling flat floorplans — this is what makes
  "massive" *feel* massive rather than merely far to walk.
- **Every subject district gets one unmistakable signature silhouette**
  (Hall of Artisans' clerestory studio roof; the Arcane Archive's stacked
  brass spire; the War Council's fortified square tower; the Guild Hall's
  market-hall timber roof) so a player glancing at the skyline always
  knows where they are.

### Explicitly banned

- Flat-coloured primitive boxes standing in for buildings.
- Right-angle-only, single-material rooms (the old room shape).
- Anything with a corporate/institutional modern-campus read (glass
  curtain walls, drop ceilings, fluorescent strip lighting, whiteboards,
  laptops as set dressing, ergonomic office furniture).
- Sci-fi materials (chrome, holograms, neon) anywhere except as a
  deliberately-contained "arcane technology" motif inside the Arcane
  Archive specifically, and even there rendered as brass-and-glow rather
  than plastic-and-LED.

---

## 7. Lighting Guide

**Lighting is a design pillar, not a finishing pass.** Every district has
a dominant, authored lighting mood; nothing defaults to flat, even,
"gameplay-visibility-first" lighting.

| Context | Lighting treatment |
|---|---|
| Grand Courtyard | Full daylight, God-rays through the colonnades at low sun angles |
| Great Hall | Stained-glass-filtered coloured light pools on the floor; candle rings for ceremonies |
| Grand Library | Warm hanging-lamp pools against deep shadow between shelves; dust motes in any shaft of window light |
| Hidden Archives | Player-carried light only (a lantern/candle prop) against near-darkness — the one district allowed real gloom |
| The Observatory | Cool moonlight/starlight as the *default* mood, regardless of real-world time |
| Hall of Artisans | Bright, even clerestory daylight — the one interior allowed to feel "workshop-bright" |
| War Council Chamber | Low, warm torchlight; long dramatic shadows across the map table |
| Guild Hall | Warm lamp-light, bustling and golden, never gloomy |
| Arcane Archive | Cool blue-violet glow from the conduits, contrasted against warm brass |
| The Catacombs | Near-dark, torchlit only, deliberately the most oppressive space in the game |
| The Bridge | Whatever the current in-world time-of-day is, deliberately favoured for sunset/dawn framing |
| The Tavern | Firelight — the warmest, coziest light in the game |
| Dormitories (Player Sanctum) | Player-controlled: candles, fireplace, window light — evolves with room customisation (§12) |

### Carried-over systems, reskinned not rebuilt

The existing Time-of-Day system (Phase 20E) and Campus Atmosphere system
(exam-week hush, seasonal notes, Phase 21 Part 9) are **preserved
wholesale as logic** — real Melbourne-local time and real semester-era
data already drive lighting/mood shifts. V2 only re-authors what those
states *look like* (torches instead of desk lamps, stained-glass colour
shifts instead of a flat colour-temperature slider), never the underlying
derivation.

### Explicitly avoid

- Perfectly even, shadowless "gameplay-clarity" lighting anywhere except
  where required for genuine readability (interaction prompts, UI).
- Cold, clinical white light as a default anywhere except the
  Observatory's intentional starlit cool tone.
- Neon or saturated RGB lighting outside the Arcane Archive's contained
  motif.

---

## 8. Animation Philosophy

**No snapping. No robotic movement. Every transition eases.** The
existing procedural rig and pose system (Phase 20B/20C) is the technical
foundation to build on, not replace — see §16 — but the animation
*vocabulary* expands substantially and the *quality bar* rises to "a
character who lives in this world," not "a character who occupies a
room."

### Required animation set (full target — built incrementally)

| Category | States |
|---|---|
| Locomotion | Walk, run, idle (with subtle breathing/weight-shift, already partly built), turn-in-place |
| Study actions | Reading (seated/standing), writing, studying-at-desk, opening a book, closing a book |
| Social | Talking (already built as the Phase 23 `talk` pose), listening, waving, pointing, sitting to converse |
| World interaction | Opening doors, climbing stairs (with real foot placement on stairs, not a straight-line slide), sitting on a bench, kneeling at a shelf |
| Idle variety | Looking around, glancing at a book, adjusting robes — small "alive" idle breaks so standing NPCs never look frozen |

### Principles

- **Ease in, ease out, always.** Every pose transition uses a real curve
  (the existing damping/lerp discipline from movement polish, Phase 20C,
  is the template) — never a hard cut between poses.
- **Weight and intention.** A character sitting down should look like
  they're choosing to sit, not teleporting into a chair pose.
  Anticipation frames (a slight lean before a turn, already partly
  present in movement polish) extend to every new action.
- **Context-appropriate idle.** An NPC in the Grand Library idles by
  reading; an NPC in the Tavern idles by leaning on the bar; an NPC in
  the Training Grounds idles by stretching. Idle animation should always
  read as "doing something," never "standing waiting to be talked to."
- **Silhouette-readable gestures.** Waving, pointing, and talking gestures
  must be recognisable from the game's actual camera distance (§9) —
  large enough, clear enough, never a subtle micro-gesture that only
  reads in a close-up.

---

## 9. Camera Philosophy

**The camera's job changes from "keep the diorama in frame" to "celebrate
the world."** The old locked bird's-eye camera (`UNIGAME_ART_BIBLE.md`
Part 2 — 55° downward angle, no rotation, no zoom, deliberately
diorama-flattening) is retired as a design target. It may remain as a
*technical* fallback/reduced-motion mode (§15), but it is no longer the
game's visual identity.

### New camera principles

- **Larger viewing distances.** Enough draw distance and FOV that a
  player standing in the Grand Courtyard can see North Tower's spire and
  the Bridge in the distance — landmarks are only landmarks if they're
  visible from elsewhere.
- **Verticality is felt, not just modelled.** The camera should tilt and
  reveal height — looking UP at a tower from its base, looking DOWN from
  an Observatory platform — rather than staying at one fixed downward
  angle everywhere.
- **Exploration-friendly follow camera.** Player-influenced orbit and
  zoom (within sane bounds, replacing the old ±0°/±0% locked values)
  so a player CAN stop and look up at a cathedral ceiling or out across
  the grounds from a tower window.
- **Establishing shots at district transitions.** Crossing into a new
  district (through a gate, over the Bridge, up the North Tower stair)
  earns a brief camera beat that shows scale before handing control back
  — the Guild Wars 2 "here's the vista" instinct.
- **Ceremony gets cinematic framing.** Semester-completion, milestone
  celebrations, and mentor-relationship-level-up moments (all real,
  already-tracked events) earn a dedicated camera treatment, not the
  default follow-cam.
- **Accessibility is never sacrificed for spectacle.** Reduced-motion
  and a "calm camera" mode (fixed angle, no dynamic sweep) remain
  available at all times — building on, not discarding, the existing
  `useMotionPreference` discipline (§16).

---

## 10. NPC Philosophy

**Every NPC is handcrafted, not a placeholder.** The existing
`ModularCharacter`/appearance-catalogue system (Phase 20B) is preserved as
the *technical* rig — swappable modular parts driven by data — but its
*content* is reauthored entirely around medieval-fantasy silhouettes.

### Wardrobe & silhouette direction

- Robes, cloaks, satchels, aprons (for the Hall of Artisans' artisans),
  ledger-books-on-belts (for the Guild Hall), scholar's stoles, guard
  livery, travelling cloaks — never modern clothing, never a "uniform"
  read as corporate.
- Proper proportions: no chibi/blocky forms — believable, human-scaled
  characters with genuinely interesting, readable silhouettes at a
  distance (a wizard-shaped silhouette should be recognisable as
  "mentor" before the player is close enough to see a face).
- Each of the four subject mentors gets a signature silhouette matching
  their already-established personality (§16 preserves the personalities
  themselves — Iris/Cass/Mara/Theo — verbatim):
  - **Iris** (Hall of Artisans) — a paint-and-charcoal-dusted artisan's
    smock, sleeves rolled, tools at the belt.
  - **Cass** (Arcane Archive) — a precise, high-collared archivist's
    coat, sigil-etched cuffs, unhurried posture.
  - **Mara** (War Council Chamber) — practical campaign leathers, a
    map-case slung across the back, upright bearing.
  - **Theo** (Guild Hall) — a flamboyant merchant-adventurer's coat,
    a satchel overflowing with contracts and prototypes.
- Population NPCs (the librarian, the lab-technician-turned-astronomer,
  the lecturer, the lounge-staff-turned-tavernkeep, the admin-staff-
  turned-clerk — all five existing ambient roles, Phase 20E) get an
  equivalent reskin, each with a clear guild/role-appropriate silhouette.

### Behavioural philosophy

- NPCs are never static mannequins: idle animation (§8), scheduled
  movement (the existing deterministic NPC schedule system, Phase 20C,
  preserved wholesale), and ambient dialogue (Phase 20E/21/24, preserved
  wholesale) all continue exactly as built — only their *look* changes.
- The player should be able to recognise "which mentor is which" from
  across a courtyard, purely from silhouette and colour — before any
  dialogue fires.

---

## 11. Player Progression

**Nothing about the underlying progression MATH changes.** XP, levels,
streaks, mentor bond points/levels, confidence, workload, goals,
achievements, milestones — all Phase 1–24 systems — are preserved exactly
(§16). What changes is how progression is *represented and felt* in the
world:

- **Bond levels become visible.** A subject mentor's relationship level
  (already computed by `mentorRelationship.ts`, unchanged) is expressed
  as literal changes to their district: banners raised, new furnishings
  appearing, previously-locked side rooms opening — the existing Room
  Evolution / Furniture Unlock systems (Phase 20D/22), now re-skinned as
  "the district responds to your standing," not "the room gets new
  furniture."
- **Milestones are ceremonies, not toasts.** A milestone (achievement,
  bond level, room stage, semester completion, goal completion — the
  existing `milestones.ts` log, unchanged) triggers an in-world moment:
  a bell toll, an NPC comment (Phase 24's Campus Life system, unchanged),
  an entry inscribed in the Great Hall's roll of honour.
- **Secret Passages as a progression reward** (§4.9) — real unlockable
  shortcuts across the world, tied to real milestone thresholds, giving
  "I've made real progress" a literal, walkable payoff distinct from any
  UI element.
- **The semester calendar becomes the seasons.** The existing derived
  semester-era system (`semesterCalendar.ts`'s early/mid/late/complete
  eras, Phase 11/24, unchanged) drives real seasonal dressing across the
  whole world — bare trees and hushed halls near exam season, banners and
  bunting at semester's end — the same underlying signal, a far more
  visible expression of it.

---

## 12. Room Customisation

**The player's Dormitory is their sanctuary — a place, not a settings
panel.** The existing save-backed customisation system (room theme,
furniture slots, unlock progression — Phase 20D, preserved exactly as
data/logic, §16) is re-skinned entirely:

Instead of wall colours and a furniture-slot grid, the player earns and
places:

- A fireplace (lit or unlit; intensity/warmth tied to real engagement —
  a direct reskin of the existing theme system)
- A proper four-poster or truckle bed
- Bookshelves that visibly fill as real modules/assessments are completed
- Candles and lanterns (a lighting-mood choice, §7)
- Rugs, tapestries, and banners (house-colour/subject-affinity flavour)
- A study desk with the player's actual in-progress work represented
  atop it
- Paintings and portraits (unlockable, decorative)
- Trophies and collectibles tied to real achievements (a physical version
  of the existing Collections screen)
- A window with a real view onto the Student Village
- Pets (a long-term aspirational unlock, cosmetic only, never gameplay-
  affecting) and plants (already a themed slot type, reskinned as
  actual herbs/flowers rather than generic "plants")
- Music (an ambient audio choice for the room itself, §13)

**Every item is earned through the existing unlock-progress engine, never
purchased or arbitrarily granted** — the same "derived over stored,
nothing fabricated" discipline every prior phase's engines already follow.

---

## 13. Audio Philosophy

**Every location has its own unshared ambient identity.** The existing
sound-mixer architecture (per-category volumes, ambience/footsteps/
interaction/ui/npc/music channels — Phase 20F Part 10) is preserved
wholesale as the *technical* mixing system; its *content* is authored
per-district:

| District | Ambient signature |
|---|---|
| Grand Courtyard | Wind, distant birdsong, a fountain's trickle, far-off chatter |
| Great Hall | A distant choir during ceremonies; otherwise vast, echoing quiet |
| Grand Library | Page-turns, quills scratching, a held hush ("library whispers") |
| Hidden Archives | Near silence — a held breath, one's own footsteps loud |
| The Observatory | Wind at height, a soft mechanical tick of instruments |
| Hall of Artisans | Brushes, chisels, the creak of easels, birdsong through open windows |
| The Gardens | Birds, bees, a fountain, rustling leaves |
| War Council Chamber | Low murmur of strategy, the shuffle of maps, a distant war-drum motif |
| Guild Hall | Bustling trade-floor chatter, coin, ledger-pages |
| Arcane Archive | A low electrical-arcane hum, rhythmic conduit pulses |
| The Catacombs | Dripping water, distant echoes, near-total silence otherwise |
| The Bridge | Wind, the river below, footsteps on stone |
| The Tavern | Fire crackle, low chatter, a lute somewhere in the middle distance |
| Dormitories | Whatever the player's own room theme implies — fire, rain on glass, quiet |
| The Bell Tower | An actual bell, tolling the in-world hour |

Music is sparse and diegetic-feeling rather than a constant score —
present at ceremonies, at the Tavern, and faintly in the Great Hall — with
long stretches of pure ambience elsewhere, matching Dark Academia's
"the quiet is part of the mood" instinct rather than a wall-to-wall
soundtrack.

---

## 14. UI Philosophy

**No floating dashboards where a diegetic object can do the same job.**
Every existing UI surface (Phase 5–24: Dashboard, Journal, Calendar,
Priority Centre, Notification Centre, Study Planner, Semester Timeline,
Collections) keeps its exact underlying data and logic (§16) and is
re-presented as an in-world object:

| Current UI | Becomes |
|---|---|
| Dashboard | **The Study Desk** in the player's Dormitory — an open ledger/planner atop the desk |
| Player Journal | **A leather-bound Journal** — a literal book the player opens |
| Semester Timeline / Collections | **An illuminated manuscript / scroll** in the Great Hall's roll of honour |
| Calendar | **An astronomical almanac** (fits The Observatory's motif) |
| Notification Centre | **The Notice Board** (Grand Courtyard + Tavern) — physical pinned notices |
| Study Planner | **A quest log** — literally framed as "today's undertakings" |
| Mentor conversation panel | Stays a focused, readable overlay (unchanged — a real conversation needs
  a real reading surface) but re-skinned with parchment/ink framing instead
  of flat panel chrome |
| Settings | **The Chancellery's records office** — same controls, diegetic framing |
| Character Creator | **The Outfitter's Alcove** |

The rule is not "hide every menu" — a genuinely modal, focused surface
(a real conversation, a confirmation dialog, accessibility settings)
stays a clean, readable overlay, because readability and accessibility
always outrank immersion when they conflict. The rule is: **wherever a
diegetic object can carry the same information without hurting
usability, use the diegetic object.**

---

## 15. Technical Implications

This is a presentation-layer rebuild, not a rewrite of the renderer
architecture that already exists:

- **React Three Fiber stays the renderer.** No engine change. The
  existing `src/game3d/` module boundary, its `React.lazy` loading
  discipline (nothing 3D-related loads until the world renderer is
  actually used), and its feature-flag gating all carry forward.
- **Asset scale increases substantially.** Districts at this scale need
  a real streaming/LOD strategy beyond the current single-scene-swap
  model (Phase 20E's multi-scene architecture is the right foundation —
  it already proves "swap scenes without losing state" — but district
  interiors this large will need chunked loading, not one scene = one
  small room).
- **A real asset pipeline becomes necessary.** The current procedural/
  primitive-composed geometry approach cannot produce cathedral-scale,
  detailed stonework by itself — this phase's design implies sourcing or
  building a proper 3D asset pipeline (modelled architecture, textured
  materials, a modular kit-bashing system for repeated elements like
  stonework, windows, and furniture) rather than continuing pure
  primitive composition.
- **Camera rework is a genuinely new system**, not a retune — moving off
  a fixed bird's-eye lock to a player-influenced follow camera with
  district-transition establishing shots is new camera code, not a
  constant change (§9).
- **Animation rework extends the existing rig**, not a new character
  system — the modular character/procedural animation foundation (Phase
  20B/20C) is reused; the new animation states (§8) are additions to its
  existing pose library.
- **Lighting needs a real per-district authoring system** — today's
  lighting is a small set of shared presets; V2 needs each district to
  carry its own authored lighting rig (§7), which is a content and
  possibly a technical (multiple light budgets, baked lighting for
  large interiors) investment.
- **Performance discipline scales up, not away.** The existing quality-
  tier system (Phase 20F Part 15) and per-frame throttling discipline
  (Phase 20C) are exactly the right tools for a much bigger world — they
  need extending (more aggressive LOD at district scale, occlusion
  culling for a world this size) rather than replacing.
- **Accessibility carries forward unconditionally.** Reduced motion,
  the "calm camera" fallback, and every existing a11y contract
  (`useMotionPreference`, tap-target sizing, ARIA patterns on every
  diegetic-UI surface) are non-negotiable requirements of the new world,
  not nice-to-haves layered on after.

---

## 16. Which Existing Systems Are Preserved

**Every gameplay system, in full, unmodified logic:**

- `StudentContext` (`src/ai/ContextEngine.ts`) — the single source of truth
- `RecommendationEngine.ts`, `ReflectionEngine.ts`, `GoalSystem.ts`,
  `MentorPlanner.ts` — the whole AI Mentor intelligence layer
- `MentorDialogueProvider.ts` + the Conversation UI's underlying logic —
  the multi-stage conversation system (its visual chrome is reskinned
  per §14, its stage logic is not touched)
- `ProactiveMentorEngine.ts` and the whole Phase 24 proactive layer —
  triggers, cooldowns, notifications (re-skinned as the Notice Board,
  §14), Daily Check-In/Evening Reflection
- `mentorRelationship.ts` / `npcRelationship.ts` — Trust/Familiarity/Mood,
  bond levels, and Phase 24's Conversation Count/Advice Followed/
  Milestones Celebrated stats
- `MentorRelationshipStats.ts`, `npcMemory.ts` — NPC memory, recognition,
  recentTopics, flagged-assessment follow-ups
- The four mentor personalities (Iris/Cass/Mara/Theo) — their voice
  pools, priority ladders, and dialogue content in `mentorDialogue.ts`
  are UNCHANGED text; only their in-world silhouette/wardrobe/district
  changes (§10)
- The whole save system — `persistence.ts`, `SaveDataContext.tsx`, every
  additive save field and coercion function built across 24 phases
- XP, levels, streaks, achievements, milestones (`milestones.ts`),
  goals, and all progression math
- The Semester Calendar / era system (`semesterCalendar.ts`) and Campus
  Atmosphere (`campusAtmosphere.ts`) — reused as the seasonal/lighting
  driver, not replaced
- The Room Unlock Progress / Furniture Unlock engine (`furnitureUnlocks.ts`)
  — reused as the Dormitory's unlock system
- The academic import pipeline (Canvas/Moodle/manual, Phases 18A–19) and
  all Academic Intelligence (workload, roadmap, timeline engines)
- The Journal, Dashboard, Calendar, Collections, Timeline, Priority
  Centre, Notification Centre — all DATA and LOGIC; only their visual
  container changes (§14)
- The NPC schedule system (Phase 20C) and ambient dialogue/Campus Life
  system (Phase 20E/21/24) — reused verbatim, only re-skinned content
- `useMotionPreference` and every existing accessibility contract
- The feature-flag/renderer-neutral world contract and the
  `React.lazy` loading discipline

**None of the above is rewritten, replaced, or removed by this document.**

---

## 17. Which Presentation Systems Are Replaced

**Everything visual, environmental, and world-architectural:**

- `docs/UNIGAME_ART_BIBLE.md`'s entire visual identity (Part 1 —
  "stylised low-poly modern-university diorama") — retired as the
  target aesthetic
- The locked bird's-eye-only camera (Part 2 of the old bible — 55° fixed
  angle, no rotation, no zoom) — replaced by §9's exploration camera
  (the old locked mode may persist as a technical reduced-motion
  fallback, never as the default identity)
- Every current room's geometry, materials, and scale — the small,
  primitive-composed rooms are retired in favour of district-scale
  authored spaces (§3–§6)
- The current character/NPC wardrobe content (modern/casual clothing
  catalogues) — replaced by medieval-fantasy wardrobe content (§10);
  the underlying `ModularCharacter` rig is kept
- The four subjects' current `characterConcept` flavour text
  (holographic tablet, floating terminal/server drone, smart clipboard,
  digital pitch board) — explicitly sci-fi and explicitly retired;
  replaced by the Iris/Cass/Mara/Theo silhouettes in §10
- The current room-theme/furniture content (colour swatches, modern
  furniture catalogue) — replaced by the Dormitory content in §12; the
  underlying unlock/slot system is kept
- The current lighting presets (a small shared set, tuned for a modern-
  diorama read) — replaced by per-district authored lighting (§7)
- The current ambient audio content (tuned for a modern-study mood) —
  replaced by per-district ambience (§13)
- The current flat-panel UI chrome for Dashboard/Journal/Calendar/etc. —
  replaced by diegetic framing (§14); underlying components/data unchanged
- The current world map (Campus HQ + 5 single-room buildings) — replaced
  by the district map in §3

---

## 18. Migration Strategy

**No big-bang rewrite.** The existing renderer-neutral, feature-flagged
architecture (`settings.worldRenderer`, the lazy `Game3D.tsx` boundary)
is exactly the right tool for an incremental migration, the same way it
already let 3D and 2D renderers coexist through Phases 20–24.

### Recommended phase sequence (for a future planning pass, not decided here)

1. **Pre-flight audit** (mandatory, per this project's own established
   discipline) — a full inventory of every current 3D asset, scene, and
   NPC role, cross-referenced against this document's district map, so
   nothing gameplay-load-bearing is accidentally dropped during the
   visual rebuild.
2. **One flagship district first.** Prove the new architectural style,
   lighting rig, and camera system in a single, complete district (the
   Grand Courtyard + one subject wing is the natural choice — it touches
   the hub, one subject mentor, and the travel system) before scaling to
   the full map. This mirrors how Phase 20A proved the *original* 3D
   world with one test room before Phase 20E built out the full campus.
3. **Camera and animation foundations before content breadth.** The new
   camera system (§9) and the expanded animation set (§8) are
   cross-cutting — build and validate them against the flagship district
   before every other district depends on them.
4. **District-by-district content build-out**, each still gated behind
   the existing feature-flag/lazy-loading discipline, so the game remains
   shippable at every intermediate step (a partially-built V2 world
   alongside a fully-working V1 world, exactly as V1's 3D and 2D
   renderers coexisted).
5. **Gameplay wiring re-validated, never re-derived**, at each step — the
   existing regression-harness discipline (a new `verify-v2-*` harness
   per district/system, following the exact `check()`/`section()`
   pattern already used by all 24 prior phase harnesses) confirms that
   re-skinning a room never silently changed what a save file means or
   how an engine scores something.
6. **Old world assets retired only once their replacement district is
   verified**, never deleted pre-emptively — matching this project's
   established "investigate before deleting, prefer reversible steps"
   discipline.
7. **A new `docs/UNIGAME_V2_ART_BIBLE.md`** (a future, separate document)
   formalises the LOCKED numeric/technical standards this document's
   creative direction implies (exact camera bounds, exact lighting
   rig parameters, exact material specs) — the same relationship the old
   Art Bible had to the original creative direction, once V2's technical
   decisions are actually made and shipped.

### What "done" looks like for V2's presentation layer

A player can walk from their Dormitory, across the Bridge, through the
Grand Courtyard, up North Tower to the Grand Library, and out to the Hall
of Artisans — several real minutes of walking, past real landmarks, real
NPCs living real schedules, real lighting and audio shifting district to
district — and never once feel like they're in a diorama, a prototype, or
a menu. Every stat, streak, mentor relationship, and semester deadline
they meet along the way is exactly the same real academic data this
project has tracked honestly since Phase 1.
