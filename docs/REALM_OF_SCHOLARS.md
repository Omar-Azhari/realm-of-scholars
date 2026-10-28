# Realm of Scholars

UniGame's main experience is now an old-school fantasy MMO in the style of
RuneScape, built from the student's real curriculum. The previous campus
game is still available (Options tab → "Open classic campus", or `?classic`
in the URL) and keeps its own save; nothing in it was removed.

## How a semester becomes a realm

| Real study | In the realm |
|---|---|
| Each subject | A **skill** (levels 1–99) and a themed **region** of the island |
| Each assessment | A **quest** on the region's quest board, with practical steps |
| Each teaching week | A **waystone** on the region's trail: study it, then win its trial |
| Revision | Mini-games at each region: Duel Arena, Scroll table, Rune altar |
| Focused study time | The Meditation shrine: a real timer that pays XP only after real time passes |
| Finishing every assessment | **Graduation** in the Citadel's Great Hall, plus a Graduation Cape |

Region theme follows the subject: computing → Arcane Spire, business →
Merchant Guildhall, design → Artisans' Forge, health/biology → Verdant Grove,
humanities/law → Old Archive, engineering/maths → Clockwork Foundry,
earth/ocean sciences → Tidewatch Lighthouse, chemistry → Alchemists' Dome.

## La Trobe University first

- The enrolment screen leads with a one-click **"I study at La Trobe University"** card:
  campus picker (Melbourne/Bundoora, City, Bendigo, Albury-Wodonga, Mildura, Shepparton,
  Sydney, Online), La Trobe teaching periods, and the current semester pre-filled.
- **"Use these subjects"** imports the La Trobe subjects UniGame already holds — from the
  classic campus save if present, otherwise the built-in 2026 Semester 2 data (CSE2UI,
  CSE3CWA, Project Management, Professional Practices) — with all 12 weekly modules and
  assessments. Unconfirmed weights and dates stay blank (`src/realm/curriculum/latrobe.ts`).
- Each La Trobe-shaped code (e.g. `CSE1OOF`) gets a **Handbook ↗** link:
  `https://handbook.latrobe.edu.au/subjects/{year}/{code}` (format checked against the live site).
- Curriculum research for La Trobe starts by fetching those handbook pages and is restricted to
  `latrobe.edu.au`; it notes that weekly schedules and exact due dates usually live in the
  Subject Learning Guide on LMS, and asks students to attach it.
- A La Trobe realm's hub is **The Agora** (La Trobe's central spine since Yuncken Freeman's 1967 plan): a paved
  spine runs from the plaza's south edge past the fountain to the Great Hall, with lamp posts, benches, trees in
  planters and low stone walls framing the corners (`scene/Campus.tsx`, placed by `worldGen.ts` as `hubProps`,
  which block walking but have no actions). The **Borchardt Library** (La Trobe's main library; "Great Library"
  elsewhere) is the study hub: Grimoire, grades/WAM/plan, Moodle import, and each subject's Codex, mock exam,
  explain-it-back and add-questions.
- **Official dates** (`curriculum/latrobeCalendar.ts`): La Trobe Semester 2 2026 — teaching from Monday 13 July,
  mid-semester break 31 August–6 September, assessment period 16–24 October (La Trobe key-dates pages). Enrolment
  shows them and they're filled into existing La Trobe realms that had no start date. Week numbers skip the break,
  so week-only deadlines get real dates; the exam period (and the week before it) triggers the exam-week siege.
  Add other teaching periods to that file once confirmed from La Trobe's own pages.

## Graphics

Options → Graphics cycles three tiers (saved per browser):

| Tier | What it adds | Measured on Intel Iris Xe (1024×768) |
|---|---|---|
| Low | No post-processing; 1.25× resolution cap; MSAA | 52 FPS |
| High (default) | Bloom on glowing crystals/torches, ACES tone mapping, vignette, SMAA | 60 FPS (vsync cap) |
| Ultra | High plus N8AO ambient occlusion | 27 FPS — for discrete GPUs |

### 3D models

The player, tutors, subject buildings, the Citadel castle, banners, arena props and clouds are
real models from **KayKit** by Kay Lousberg (CC0), loaded from `public/assets/v2/models/kaykit/`
(4.2 MB in total) by `src/realm/scene/models.tsx`:

- Characters (Knight, Mage, Rogue, Hooded Rogue, Barbarian) are animated: idle, run, interact,
  cheer. They were trimmed to six animations each (~0.5 MB per file); weapons are hidden.
- Each region theme maps to one building (`THEME_BUILDING`) and one tutor class (`THEME_TUTOR`):
  computing → wizard tower + Mage, design → blacksmith + Barbarian, business → market + Hooded Rogue, etc.
- The adventurer is chosen at enrolment (or Options → Adventurer).
- Every model is wrapped in `WithFallback`: the procedural version shows while it loads or if
  the file fails, so the world never has holes.
- Every file is listed in `public/assets/v2/licences/ASSET_LICENCES.md`; in-game credit is in
  Options → Controls & help.

Measured with models loaded, High tier: 95 FPS on the dev machine (17 GLB files, 30 animated meshes).

Trees and rocks are KayKit models too (`scene/Nature.tsx`): instanced meshes with wind sway, with the
procedural trees kept as the fallback. Deadline bosses and the squire pet are from the KayKit Skeletons pack;
the bazaar uses the Hexagon pack's tent, barrels, crates and sacks. Hats (laurel, mortarboard) and the wisp
pet are code-built and attach to the character's head bone.

Procedural building blocks (`src/realm/scene/`) for everything else: canvas textures (`textures.ts`: stone
brick, roof tiles, wood grain, bark, cobblestone, plaster, each with a bump map); a smooth
3×-subdivided terrain with blended tile colours and a detail texture (`Terrain.tsx`); rippling
reflective water; organic merged-blob trees and three-tier pines; ~14k instanced grass tufts and
foliage swaying in a wind shader; drifting clouds; a physical sky (`Sky`) that also lights the
scene (`Environment`); round towers, gabled roofs, arched doorways and flickering torches
(`Structures.tsx`); and smooth-shaded characters with capsule limbs, a lathe-turned tunic, hair,
eyes and a billowing cape (`Character.tsx`).

## Look and feel

- Title and enrolment sit over a slowly orbiting 3D diorama at dusk (`enrol/EnrolBackdrop.tsx`): the Great Hall
  and subject buildings on a small island. On the title screen it is key art framed to the right of the menu (to the
  top on a phone); behind the forms it is darkened and centred.
- The title screen is a main menu (`enrol/MainMenu.tsx`): the wordmark, one line about the game, a vertical text menu
  (New game, Credits; arrow keys and Enter work) and a footer with the version. The expo welcome uses the same pieces.
- Enrolment has a labelled stepper (Character, University, Course, Subjects, Research, Review); the review
  shows each subject's realm colour and icon and warns when weightings don't add to 100%.
- A loading screen (`hud/SceneLoader.tsx`) shows real model-download progress and a study tip instead of a black
  canvas; it never blocks for more than 20 seconds.
- Every window shares one chrome (see "Art direction" below): a dark glass panel, a gold hairline along the top edge,
  the title in display capitals, an icon close button, underline tabs and hairline list rows.

## Art direction

The interface should look like a big studio made it, with its own identity (not RuneScape) and nothing cluttered.
References: Hogwarts Legacy (dark translucent panels, thin ivory and gold hairlines, serif titles in tracked capitals,
menus as vertical text lists), Tears of the Kingdom (a minimal HUD, crisp white type with a soft shadow, round icon
buttons, key glyphs for prompts) and Genshin Impact (one consistent icon set, clear title/subtitle/body hierarchy,
ornament only for emphasis). Tokens live at the top of `src/styles/realm.css`; other stylesheets use them.

- **No emoji in the interface.** Buttons, tabs, headers, the HUD, menu items, badges, window titles and message lines
  use words or icons from `src/realm/hud/icons.tsx` (`<Icon name="..." />`). Game data keeps its own `icon` fields;
  the interface maps ids to icons with the helpers there (`themeIcon`, `itemIcon`, `furnitureIcon`, `spellIcon`,
  `arenaIcon`, `houseIcon`, `siegeIcon`, `weatherIcon`). Canvas drawings use `drawIcon`.
- **Icon set:** a 24 px grid, 1.75 stroke, round caps and joins, `currentColor`, no fills (except a filled star for
  difficulty). Add new icons to the same file in the same style rather than mixing in another set.
- **Type:** two faces. `--font-display` (Cinzel) for titles only, in capitals with letter-spacing (`--track-caps`):
  window titles, the wordmark, menu items, place names. `--font-ui` (Alegreya Sans) for everything else. Fallbacks
  are Palatino Linotype/Georgia and Segoe UI/system-ui, so the look holds if the bundled fonts fail. Scale:
  `--fs-12` labels, `--fs-13` small text, `--fs-15` body, `--fs-18` lead text and dialogue, `--fs-24` step titles,
  `--fs-32` area names, `--fs-48` and up for the wordmark. Small labels are `--fs-12` bold capitals with
  `--track-label`.
- **Colour:** deep navy-charcoal glass (`--glass`, `--glass-solid`), ivory text (`--text`, `--text-strong`), and one
  accent, gold (`--gold`), used only for focus, selection, primary actions and the single top hairline on a panel.
  A muted cool slate (`--muted-accent`) is the secondary; `--focus` blue marks the Focus resource only. No gradient
  fills on controls, no outer glows, no pill chips.
- **Shape:** small radii (`--radius-s/m/l` are 2, 4 and 6 px), hairline borders (`--line`, `--line-strong`), soft
  shadows (`--shadow-1/2`). Round shapes only for round icon buttons and the minimap.
- **Controls:** primary button = solid gold with dark text; secondary = hairline outline; tertiary = underlined text
  link. Tabs use an underline indicator. List rows are separated by hairlines and show a gold bar on hover.
  Checkboxes, radios and sliders are drawn to match.
- **HUD:** text sits on soft top and bottom scrims instead of boxes. Top bar: place, skill level, Focus and coins.
  Round icon buttons (view, menu, log) carry a small key cap. Context prompts are a drawn key cap plus the action
  ("[E] Enter Library").
- **Writing:** short, confident, Australian English. No em dashes in anything the player sees, no "embark",
  "journey", "delve", "unlock", "seamless", and exclamation marks only where something is genuinely exciting.

## Enrolment flow

1. Create your character (name, body, outfit, colours and house, with a live 3D preview).
2. La Trobe in one click, or country → city → university (a curated directory of 29 countries; any value can be typed).
3. Course, year level, teaching period, year, optional first teaching day (lets tutors say "this week").
4. Subjects: code + name, optionally an attached outline (PDF, DOCX, TXT).
5. **Research subjects**: curriculum gathering, two subjects at a time.
6. Review and edit weeks and assessments, then **Start the semester**.

### Where the curriculum comes from

`api/realm/curriculum.ts` → `src/server/realm/curriculumResearch.ts`:

- **With an outline attached:** Claude structures the document. Confidence: "from your outline".
- **Without one:** Claude searches the web for the university's official
  handbook or unit pages (web search + web fetch), writes a research brief with
  sources, then turns it into strict JSON (weeks, assessments, key terms,
  24–30 practice questions). Anything not found officially is marked
  "partly inferred — verify", and weights and due dates are never invented.
- **No API key configured:** an attached outline is parsed offline
  (`localOutlineParser.ts`: "Week N" lines and "%" weighted assessments);
  otherwise the student types weeks and assessments in the review step.

Model: `claude-opus-5-5`, adaptive thinking, server-side refusal fallback
(`fallbacks: "default"`). Results are cached for 12 hours per
university + subject + period, and rate-limited to 12 subjects per hour per IP.

**Setup:** put `ANTHROPIC_API_KEY` in `.env.local` (see `.env.example`) for
`npm run dev`, or in the Vercel project's environment variables. The research
function's time limit is 300 s (`vercel.json`).

## Controls

- **WASD or arrow keys** walk (camera-relative). **Space** uses the object in reach (an on-screen prompt shows what it will do).
- Or left-click the ground to walk; click a person or object to use it. Right-click for every option.
- **Q / E** or drag turns the camera; **R / T** tilts; scroll zooms; click the compass to face north. **F** attacks, **H** eats.
- Click the minimap to travel; the ⌂ orb teleports home. In duels, keys 1-4 answer and Enter continues.

## Everything has a purpose

| Thing | What it does |
|---|---|
| Quests tab "Due next" | The assessment due soonest; click to open that quest |
| Fountain of Resolve | Three daily challenges (study a week, win two games, finish a quest step) for 150 coins + a Lamp of Insight |
| Agora signpost | Fast-travel menu to every subject region |
| Road signposts | Fast travel to that subject |
| Subject building | Enter to open the subject's library (weekly path, key terms, sources) |
| Tutor | Advice on what to study next, the subject overview, the quest board |
| Quest board | The subject's assessments as quests |
| Waystones | Study a week; its trial asks six questions focused on that week |
| Exam Arena | Ten hard questions from across the whole subject against the Examiner Wraith |
| Scroll table / Rune altar | Key-term matching and spelling |
| Meditation shrine | A real study timer paying XP only after real time passes |
| Coins | Buy hints in duels (25 coins removes two wrong answers) |
| Great Hall | Graduation once every quest is complete |
| Deadline lair | A boss rises one week before each assessment is due; beating it means answering hard questions on every week it covers |
| Agora bazaar | Spend coins on capes, hats and pets (skill capes at level 99, mortarboard for graduates) |
| Study-group board | Swap share codes with classmates and compare levels per subject |

Wandering background students and the Archmage Registrar were removed. The only NPCs are the
subject tutors. Progress lives in the Stats tab, due dates in the Quests tab, and re-enrolment in Options.

## Study tools

- **Grimoire of Mistakes** (Grimoire tab, `state/grimoire.ts`): every question missed in a trial, exam duel or
  boss fight is saved and asked again 1, 3 and 7 days later; three right answers in a row master it. Wrong
  again sends it back to tomorrow. Choices are shuffled at review so remembering a position doesn't help.
- **Deadline bosses** (`state/bosses.ts`): each subject with assessments has a lair. A skeleton boss (KayKit
  Skeletons) rises 7 days before a due date and stays until the quest is complete, the boss is beaten, or a
  week after the deadline. With only a due week, the date comes from the semester start; if that's unknown it
  is worked out from any quest that has both a week and a date (e.g. after a Moodle import). With no dates at
  all, the next unfinished quest's boss is awake. The fight: 12 hard questions from the weeks it covers.
- **Lecture slides → questions**: the Study window at each waystone takes PDF, PowerPoint (.pptx, read in the
  browser with no library) or Word; `api/realm/study.ts` (mode `week-questions`) writes 8–10 exam-standard
  questions from the slides. They replace that week's previous slide questions. Needs the API key.
- **Ask the tutor**: "I have a question about the subject" opens a chat (`api/realm/study.ts`, mode `tutor`)
  grounded in the subject's weeks, key terms and outcomes. It explains and guides but won't write assessments.
  Without the API key it still answers by searching the subject's codex (key terms + weekly topics).
- **Moodle deadlines** (Quests tab, then Import deadlines): upload Moodle's calendar export (.ics), or for La Trobe
  paste the "Get calendar URL" link (fetched by `api/realm/calendar.ts`, which only accepts
  `https://*.latrobe.edu.au/.../calendar/export_execute.php` and never stores the link). Deadline events are
  matched to quests by subject code and title; the player confirms each match; unmatched ones can become new quests.
- **Study streak** (shown in the menu header): a day counts when you study a waystone, tick a quest step, win a trial, finish a
  meditation or close a Grimoire review. Every 7th day in a row pays 300 coins and a Lamp of Insight.
- **Study group**: no server. A share code (`SCHOLAR1-…`) holds only display name, university, period, subject
  levels, quest points and streak; pasted codes are validated and clamped.

## Progress tools

- **Mock exam** (Exam Arena → Mock-exam, `minigames/MockExam.tsx`): 20, 40 or 60 questions under a timer
  (30/60/120 minutes, scaled when a subject has fewer questions), no feedback until you submit. Results show the
  score, the La Trobe grade band it would be, a per-week breakdown (weakest first) and every missed question
  with its explanation; misses go into the Grimoire. 12 XP per correct answer.
- **Weak-spot map** (`state/stats.ts`): every answer anywhere is tallied by week. After 4+ answers, a week under 60%
  right is weak: its waystone pulses red, the Codex shows "⚠ 40% of 10", and tutors send you there first.
- **Grades & WAM** (Quests tab, then Grades, WAM & study plan; `state/grades.ts`): enter each mark (any "out of") and
  missing weightings. Uses La Trobe's coursework scale — A 80–100, B 70–79, C 60–69, D 50–59, N 0–49 — and
  WAM = Σ(mark × credit points) ÷ Σ credit points (credit points default to 15, editable), per La Trobe's
  Assessment Procedure – Grades and Administrative Codes. Shows the average needed on the remaining work for each
  band, but only once the weightings add to 100% — unknown weights are never guessed.
- **Study plan** (same window): each quest's open steps spread over the two weeks before it's due, the last on the
  due date; export as `.ics` for Google Calendar, Outlook or Apple Calendar (`state/plan.ts`).
- **Explain it back** (tutor dialogue, Codex, or a waystone's Study window): explain a key term or a week in your own
  words. With the API key the tutor marks it (score, what you got right, what's missing, misconceptions, a tip —
  `api/realm/study.ts` mode `explain`); without it, a rough keyword check capped at 70. XP only for beating your
  best score on a concept.
- **Your own questions** (Codex → Add your own questions, `curriculum/questionParser.ts`): paste numbered
  multiple-choice questions with a–d choices and an "Answer:" line (or a * on the right choice). Anything without
  exactly four choices and a known answer is skipped with the reason, never guessed.
- **Reminders** (Options → Reminders, `state/reminders.ts`): browser notifications for deadlines in the next 3 days,
  Grimoire cards due, and a streak at risk after 7 pm — once each per day, only while the game is open.
- **Achievements** (Feats tab, `state/achievements.ts`): 24 achievements, each a rule over real progress; several grant
  a title shown above your character.
- **Exam-week siege**: from two weeks before an unfinished exam (or teaching week 13+), every boss is awake at once;
  clearing them all pays 1,000 coins once.
- **Subject workshops** (`curriculum/workshop.ts`, hand-written content in `curriculum/banks/workshopBanks.ts`),
  chosen from the subject name: Bug Hunt for web/programming (13 real JS/React/Node/SQL bugs), Spot the Flaw for
  UI design (10 screens, Nielsen's heuristics), Critical Path for project management (generated networks: duration,
  float, critical tasks — verified by a forward/backward pass), Ethics Tribunal for professional practice (10
  scenarios mapped to the six ACS Code of Professional Conduct values). Five rounds, four right wins.
- **Hall of Trophies** (Agora): a pavilion that gains a pedestal per beaten boss and banners as achievements grow;
  inside, every boss, quest, achievement and personal record.

## Sound and touch

- Music: a quiet D-dorian lute/recorder tune generated live with Web Audio (no files); Options → Music.
- Footsteps change with the ground: stone on paths and plazas, softer on grass, dirt and sand.
- Phones and tablets (primary pointer is touch) get an on-screen joystick and a Use button.
- The sky follows your real clock (dawn, day, dusk, moonlit night with a lantern around you); Options → Sky can
  keep it always day. After 11 pm the game suggests resting.
- Accessibility (Options): text size (normal / large / larger), colour-blind mode (blue/orange plus ✓/✗ instead of
  green/red), reduce motion.
- Installable app: `public/site.webmanifest`, icons in `public/icons/`, and `public/sw.js` (production only) —
  pages network-first with an offline fallback, game files and models cached and refreshed in the background,
  API calls never cached.

## Questions

- Your four La Trobe subjects ship with a hand-written bank (`src/realm/curriculum/banks/latrobeBanks.ts`):
  about 40 questions each, mapped to the real weekly modules, mostly scenario/application level (★★–★★★),
  plus 18 key terms each. They're added automatically to existing realms (progress untouched).
- AI research now asks for 40-48 exam-standard questions, ~3 per week, with a difficulty rating, plausible
  misconception distractors, and explanations of why the tempting wrong answer is wrong.
- Generated "which week covers X" questions are used only when a subject has almost no real questions.

## Progression rules (`src/realm/state/actions.ts`, `src/realm/xp.ts`)

- XP curve: polynomial plus the RuneScape exponential. Level 99 = 60,000 XP.
  One studied week ≈ level 5; a fully completed typical subject ≈ level 69.
- Studying a week: 220 XP, once. Quest step: 120 XP, once (re-ticking never pays twice).
  Quest completion: 1,500 + 110 × weight% XP, 1–4 quest points, coins, a Lamp of Insight.
- Mini-game XP halves after 6 wins per subject per day, so real study always pays best.
- Graduation: every quest complete; for a subject with no assessments recorded, every waystone studied.

## Study powers play

The game gives a reason to come back that an LMS doesn't: studying earns **Focus** (max 100), and
Focus is what every non-study activity costs. Coins, also earned by studying, buy cosmetics and furniture.

| Earn Focus (`life/catalog.ts` `FOCUS.earn`) | Spend Focus (`FOCUS.cost`) |
|---|---|
| Study a waystone 20, quest step 15, daily challenges 20 (+ dorm comfort bonus), boss win 25, explain-it-back 10, trial/game win 8, Grimoire review 3, meditation 1/min, mock-exam answer 1 | Fish / mine / chop 1, start a fight 1, the crypt 15, Siege of Procrastination 5, Island Race 3 |

- **Life skills** (`state/life.ts`, `hud/LifeWindows.tsx`): fishing, mining and woodcutting nodes in the
  wilds use a timing mini-game; cook fish at the campfire for food, forge weapons at the anvil. Skills, gear
  and materials carry over to the next semester.
- **Combat** (`combat/combat.ts`): skeleton camps in the wilds (kept 7+ tiles from study areas; the nearest are
  passive), F to attack, H to eat. Knock-outs cost nothing. The Crypt of the Forgotten runs three waves and the
  Crypt King for coins and a Lamp of Insight.
- **Arcade** (`arcade/`): the striped games hall in the Agora.
  - *Siege of Procrastination* (`td.ts`, `TowerDefence.tsx`): eight waves of notifications, doomscrolling, naps
    and Deadline Panic against Focus Lamps, Pomodoros and Planners. Your study streak adds starting gold, and
    between waves a study break asks a question from your own subjects for +30 gold (misses go to the Grimoire).
  - *Island Race* (`race.ts`, `scene/RaceGates.tsx`, `hud/RaceHud.tsx`): a timed lap through glowing gates around
    the island (kept clear of monster camps), sprinting the whole way; medal times scale with the course.
- **Customisation** (`customise/`): the five KayKit adventurers share one rig, so the wardrobe mixes any
  class's headgear, head, torso, arms, legs and cape onto any base class (`ModelCharacter` rebinds borrowed
  meshes to the base skeleton). Dyes are bought once with coins and tint any part. **G** opens the emote wheel
  (cheer, wave, jump, cast, bow, sit).
- **Dorm** (`dorm/`): your cottage on the Agora. Furnish an 8×7 room with KayKit Furniture Bits: floor pieces,
  rugs, tabletop items that sit on desks, and wall shelves and paintings. Comfort (max 30) adds
  `floor(comfort / 2)` Focus to the daily challenge reward. Click a piece to turn, move or store it.
- **Effects** (`scene/Effects.tsx`, `scene/vfx.ts`): particle bursts for hits, gathering, Focus gains, level-ups
  and quests; fireflies at night and pollen by day; stylised water with shallows and rolling shore foam
  (`Terrain.tsx`); synthesised ambience — birdsong, crickets after dark, surf near the shore (`audio.ts`).

## The academy: bodies, districts, the dorm, islands, houses

- **Real bodies** (`customise/humans.ts`, `scene/HumanCharacter.tsx`, `customise/CharacterCreator.tsx`):
  Quaternius Ultimate Modular Men/Women (Quaternius Asset Licence: free in-game use, no reselling the
  models). 10 outfits per body type, each split into head & hair / top / legs / shoes on one 62-bone rig,
  so parts mix freely. Sliders scale bones for height, build (slim to heavy) and muscle; skin, hair and
  outfit colours recolour the flat materials (dyes add outfit colours). Hats and the wand hang off the head
  and hand bones; cloaks hang from the shoulders. Older saves get the creator on first load. Professors
  wear robes in their region's colours (`customise/npcs.ts`).
- **Districts** (`worldGen.ts`): the Agora keeps the Great Hall, fountain and signpost; the Scholars' Quarter
  (library, trophies), Market Row (bazaar, games hall, study group), Student Village (dorm), Crafts Yard
  (campfire, wandwright's bench) and the Sports Grounds (parkour tower, archery range, ping-pong hall; the
  games themselves are in `games/`) are separate round courts between the subject roads, each ringed by its
  buildings and entered through a named gateway arch at the end of a lamp-lit, hedge-lined road from the Agora.
  The signpost fast-travels to them and an area title shows when you enter one (`hud/AreaBanner.tsx`).
- **A campus to cross** (`worldGen.ts`, `scene/Landscape.tsx`): every district court is about 40 tiles from the
  Agora (a 10 to 12 second walk at 3.4 tiles a second), courts are 35+ tiles apart, and the subject regions lie
  64 to 86 tiles out. In between: rolling hills that rise away from every road and court (up to about 4 m),
  groves of pine, broadleaf and autumn trees with clearings, flower meadows, rock outcrops, a lake and a pond
  joined by a creek that a road crosses on a stone bridge, lamp posts along every main road, hedges and
  fences along some, ground colour by area (campus lawn, meadow, woodland floor, dry bushland toward the
  coast), and five landmarks with dirt footpaths: a hilltop lookout (fast travel), a picnic lawn (sit and read
  a codex), an old windmill (a study-tip plaque), the ruins of the first college (review your Grimoire) and a
  bell tower (what's due today). Roadside dressing is instanced; monster camps stay 14 to 20+ tiles from any
  road or building.
- **Recognisable buildings** (`scene/Campus.tsx`, `scene/Signage.tsx`): every purpose building has its own
  architecture (columned lecture theatre, library with a wall of lit windows, trophy pavilion with a gold cup,
  duelling ring under crossed wands, striped games tent, market stalls, residence hall), a big painted sign
  (name and pictogram, drawn on a canvas with system fonts) and a floating icon beacon. Colours follow purpose
  (`PURPOSE_STYLE` in `worldGen.ts`: study blue/gold, play orange, home green, crafts brown, travel teal), and the
  minimap marker and the area banner use the same colour and pictogram. The Agora is 24 x 24 with five-tile
  roads; the lecture hall is 14 x 13 tiles and the dorm 10 x 9.
- **Walk-in dorm** (`dorm/interior.ts`, `scene/DormInterior.tsx`): entering the cottage loads the room as
  its own small world. Bed: sleep once a day for "well rested" (+10% study XP for 4 hours). Desk: study hub
  or a focus session. Bookshelf: Grimoire. Seats: read a subject's notes. Wardrobe: the character creator.
  Noticeboard: what's due, today's challenges, and "Decorate" (the furniture editor). Door: leave.
- **Islands** (`world/islands.ts`): the harbour sails (4 Focus out, home free) to your university's other
  campuses (La Trobe: Melbourne City, Bendigo, Albury-Wodonga, Shepparton, Mildura, Sydney) and nearby
  universities. Each has an exchange hall with a rival scholar who duels you on your own subjects (bigger
  purse first time), tougher camps and richer gathering further out, and a passport stamp.
- **Houses** (`customise/houses.ts`): Emberhold, Tidewater, Oakhaven, Duskmere (original names). Every 10
  study XP is a house point, every quest point five; rival houses gain steadily through the semester. The
  House Cup table is in the Hall of Trophies.
- **Atmosphere**: floating candles over the Agora, owls circling the Great Hall (`scene/Academy.tsx`),
  wands that fire spell bolts in fights, pointed scholar's hats and cloaks at the bazaar.
- **Course picker** (`enrol/CoursePicker.tsx`): all 385 La Trobe 2026 courses from the Handbook
  (`curriculum/banks/latrobeCourses.ts`), filtered by campus and level, plus free text.

## Magic and study (the 18-suggestion round)

| Feature | Where | How it ties to study |
|---|---|---|
| Owl post | `state/mail.ts`, `hud/MailWindow.tsx`, owl courier in `scene/Academy.tsx` | Deadlines, Grimoire reviews, streak warnings, today's classes and familiar notes arrive as letters (Menu, then Owl post; dorm noticeboard) |
| Spellbook | `life/spells.ts`, `hud/Spellbook.tsx`, `castSpell` in `combat/combat.ts` | Each studied week teaches a spell named after its material; accuracy and mastery set its power. Keys 1-4 cast bolt/blast/mend/ward/snare |
| Potions | `life/potions.ts`, `hud/CauldronWindow.tsx` (Crafts Yard cauldron) | Every brew asks a subject question; wrong answers spoil it (and go to the Grimoire). Insight +15% XP, Swiftness, Warding, Focus |
| Enchanted textbook | `curriculum/textbook.ts`, `hud/TextbookWindow.tsx` (library desk) | A lecture file becomes a summary scroll, flashcards (added to key terms) and a quiz (added to that week's trial), all on-device |
| Owl-post timetable & study rooms | `curriculum/timetable.ts`, `hud/TimetableWindows.tsx` | Import a class timetable (.ics); studying within 3 hours after a class pays +5 Focus once; booked study rooms add +10% XP per classmate (max +30%) |
| Duelling club | `state/ladder.ts`, `hud/LadderWindow.tsx` (Scholars' Quarter) | A monthly ladder of ten duellists; each duel is hard questions from your subjects |
| Familiars | `customise/familiar.ts` | Pets level up with weeks studied and quests done: extra gathering finds, daily deadline notes, +2 Focus per waystone, then a glow-up |
| Secret doors | `state/secrets.ts`, `hud/SecretDoorWindow.tsx` (3 in the wilds) | The password is a key term you type from its definition (recall, not recognition) |
| Weather & seasons | `scene/weather.ts`, `scene/WeatherFx.tsx`, `hud/WeatherChip.tsx` | Rain, fog and cloud by the hour (wetter in a Southern Hemisphere winter), a storm all exam period |
| Brooms & Sky Race | `life/broom.ts`, flying in `scene/RealmScene.tsx` (B) | Study every week of a subject to earn a broom; faster travel and the Sky Race in the games hall |
| Intro & polish | `scene/cinematic.ts`, `hud/CinematicOverlay.tsx`, `NightGlow`, god rays | A fly-over on first arrival and first landing on an island; buildings glow at night; sun rays (High/Ultra); professors face you and gesture while talking |
| Sound | `audio.ts` | Spell shimmer, thunder, owl hoot, house motif; music drops while a study window is open |
| House feed & yearbook | `hud/HouseFeed.tsx`, `state/yearbook.ts`, `hud/YearbookWindow.tsx` | Classmates' share codes add to their house; a weekly text card to paste into a group chat; a downloadable yearbook page |
| La Trobe names | `hubStyleFor` in `world/worldGen.ts` | Agora, Borchardt Library, Menzies & Glenn Colleges (the dorm district), The Bushland (the wilds) |

Not done: a reflective lake (too costly for the target laptops), and facial expressions or lip-sync (the character models have no face rig).

## The lecture theatre

The Scholars' Quarter has a lecture theatre (`world/worldGen.ts`, kind `lecture-hall`). You walk straight in through its doors: there is no loading or fade.

The room is laid out on its own grid (`lecture/theatre.ts`, drawn by `scene/TheatreInterior.tsx`). It has a stage, tiered benches, a big projection screen and a professor at the lectern. `world/rooms.ts` (`withRooms`) builds it into the building's footprint on the island: it turns the room to face the entrance, levels the ground, opens the doorway and adds its objects to the island. The dorm room gets the same treatment inside the residence.

`scene/WalkInRooms.tsx` and `scene/RoomWalls.tsx` draw these rooms. From outside, the building is closed. Once you're inside, the roof lifts away and the walls between the camera and you drop to knee height, so the camera never has to change. Indoor lights fade rather than switch off, so the number of lights in the scene never changes.

Attend at the lectern, pick a subject and week, and you sit on the front bench while the professor gives that week's lecture (`hud/LectureWindow.tsx`). The camera view only ever changes through the view (eye) button.

- The current slide shows on the 3D screen (`lecture/live.ts` feeds a canvas texture), and the professor gestures.
- The browser's own speech reads each segment aloud. Voice and auto-advance can be switched off, and are remembered
  per device. Narration is shown as text too.
- Check-in questions appear after the segment they test. Wrong answers go to the Grimoire, and every answer counts
  toward the weak-spot map.
- When it ends: takeaways, further reading, and rewards (`state/lectures.ts`). A week you hadn't studied counts as
  studied: tome, 220 XP and Focus, plus 25 XP per right answer. Revising a studied week on a later day pays
  60 XP + 25 per right answer and 1 Focus. Replaying the same day pays 10 XP per right answer.

Where a lecture comes from:

- **With AI**: `POST /api/realm/lecture` (`api/realm/lecture.ts` over `src/server/realm/lectureAi.ts`). Claude
  (`claude-opus-5-5`) researches the week with web search and fetch. For La Trobe subject codes it starts from the
  handbook page `handbook.latrobe.edu.au/subjects/{year}/{code}`. Its input is the handbook data the game already
  has (summary, learning outcomes, week title, topics, key terms) and, optionally, the student's own lecture slides
  (PDF, .pptx, .docx or text, up to 80,000 characters). A second structured-output step writes the lecture.
  Further-reading links are kept only if research actually visited them.
  - Limits: 8 lectures per hour per IP and 120 per hour overall; 300-second time limit.
  - The finished lecture is cached on the device (`unigame.realm.lecture.<subjectId>.<week>`) so replays are free.
    "Research again" rebuilds it.
- **Without AI**: `handbookLecture` in `curriculum/lecture.ts` builds a shorter lecture from the same handbook data.
  It splits the week summary into topics, matches key terms and question explanations to each topic, and uses the
  week's questions as check-ins. The window says that this is what it is.

Attendance is saved in `progress.lectures` ("subjectId:week" -> local date).

## Play-world games (Sports Grounds)

Three full-screen games, opened with E at their buildings in the Sports Grounds. Each lives in
`src/realm/games/<game>/`, is lazy-loaded by `RealmGame.tsx` (window kinds `parkour`, `archery`, `pingpong`), and
captures the keyboard so the campus never sees it. While one is open the campus canvas stops drawing
(`RealmScene` `paused` sets `frameloop="never"`), so only one WebGL scene runs.

All three pay Focus through `startPlay` and record through `finishPlay` (`state/playGames.ts`): coins for medals,
capped per game per day, never study XP.

- **Parkour** (`games/parkour/`): a Roblox-style obby. Double jump, wall jump, wall run (Shift), sprint stamina,
  coyote time and jump buffering, moving platforms, bounce and speed pads, kill bricks, checkpoints (R respawns).
  Three courses (Meadow Hop, Cloud Works, Storm Spire) with time medals, splits and a ghost of your best run
  (saved per device). Records: `parkour-<course>`. A reachability check in the tests confirms every course can be
  finished at 90% of jump and speed.
- **Archery** (`games/archery/`): pointer-lock aiming (drag-to-aim fallback), bow sway, held breath (Shift), wind,
  arrow drop with sight pins. Target practice (18 shots at 18/30/45 m, max 180; `archery-practice`) and a quiz range
  (shoot the right answer A to D, streak multiplier; `archery-quiz`). Wrong answers go to the Grimoire.
- **Ping pong** (`games/pingpong/`): the paddle follows the mouse; swing speed and direction set pace, spin and
  curve. Full table rules (lets, faults, deuce, serve changes). Three rivals (Pip Thornbury, Marlowe Quill,
  Magister Vexa) and a true/false rally quiz at 5 hits. Records: `pingpong-<difficulty>`.

## Expo mode (`?expo`)

For demoing at a stand (`src/realm/expo.ts`, `enrol/ExpoWelcome.tsx`, `hud/ExpoBar.tsx`).

**Running it on the day.** It works offline, and needs no API key.

1. Build and serve the game with `npm run build`, then `npm run preview` (the address is http://localhost:4173), or use `npm run dev`.
2. Open the address with `?expo` added, e.g. http://localhost:4173/?expo.
3. In Edge, press F11 for full screen.

**Behaviour.**

- **Separate save.** The demo uses its own save (`unigame.realm.expo`). The real save (`unigame.realm.v1`) is never read or written.
- **Welcome screen.** It cycles one feature line at a time over the spinning campus diorama, and has an optional name box. Any key or the button starts the demo, which also makes the welcome screen the attract loop.
- **Each visitor.** They start as a La Trobe student with the four built-in subjects, with 40 Focus and 400 coins. They make a character, then the intro fly-over plays. Skies are clear and fixed: no storms, whatever the date.
- **Presenter bar** (bottom-left; it hides during lectures).
  - **Tour:** jumps to the showcase spots, with the camera facing each one.
  - **New visitor:** tap twice to wipe the demo and return to the welcome screen.
- **Idle reset.** After 3 minutes with no input, a "Still there?" countdown runs for 10 seconds, then the stand resets itself. A lecture being spoken, or its video showing, counts as activity.
- **Hidden in expo mode.** Export, import, re-enrol, classic mode, reminders (they ask for notification permission) and Moodle import.
- **Lecture voices.** Edge's natural lecture voices are online voices. With no internet, Edge falls back to its built-in voices, which sound more robotic.

## Code map

```
src/realm/
  RealmApp.tsx            enrolment until a curriculum exists, then the game
  RealmGame.tsx           routes world interactions to dialogue, windows, mini-games
  types.ts, xp.ts         data shapes, XP curve and rewards
  state/                  localStorage store (unigame.realm.v1), rules, transient events
  curriculum/             normalisation of untrusted input, question bank, outline parser,
                          university directory, API client
  world/                  deterministic island generation, themes, A* pathfinding
  scene/                  R3F scene: terrain, scenery, buildings, characters, camera
  hud/                    chatbox + dialogue, minimap + orbs, side panel tabs, windows
  minigames/              QuizDuel, ScrollMatch, RuneScramble, Meditation
  enrol/                  enrolment wizard, character preview, subject editor
  life/, combat/          life-skill catalogue and Focus economy; action combat and the crypt
  arcade/                 Siege of Procrastination (tower defence), Island Race, games-hall menu
  customise/, dorm/       mix-and-match outfits, dyes, emotes; the furnishable dorm room
  dialogues.ts            NPC scripts built from the real curriculum and progress
  audio.ts                synthesised sound effects (Web Audio, no files)
src/styles/realm.css      the interface (design tokens, components, HUD, start screens)
src/realm/hud/icons.tsx   the line-icon set used everywhere in the interface
```

## Testing without touching your save (development only)

`?sandbox` plays a copy of your real save that is never written back; `?sandbox=fresh` starts an empty realm
(enrolment from the title screen). Both are disabled in production builds.

## Verification

`npx tsx scripts/verify-realm.ts` (also `npm run test:realm`): 611 checks
covering the XP curve, sanitising of AI/file input, question generation,
outline parsing, world generation (including that every interactable is
reachable on foot, fuzzed over 40 random curricula), progression and
graduation rules, save sanitising, API request validation, and the La Trobe path (handbook
URLs, saved-subject import, La Trobe hub, reachability of a La Trobe realm), the question
banks, daily challenges and coins, and the model files (present, intact, in the licence ledger,
characters carry the needed animations and stay under 700 KB), the Grimoire's spaced-review schedule, streaks,
deadline-boss timing and semester-start inference, the bazaar rules, share-code parsing and clamping, Moodle
calendar parsing and matching, AI request validation, the calendar-link allowlist, PowerPoint text extraction,
the weak-spot map, grades and WAM, the study plan and its .ics, achievements, pasted-question parsing, the
workshop banks and 300 generated critical-path puzzles, explain-it-back scoring, reminders, the siege, the sky,
La Trobe's semester dates and break-aware week maths, the campus hub (library, dressing, reachability for 1–8 subjects),
life skills and Focus, combat and the crypt, the tower-defence and race rules, outfit parts against the real model
files, dyes, dorm placement rules and comfort, and the lecture theatre (lecture request validation, cleaning of
AI lectures and their links, handbook lectures, theatre reachability, attendance rewards).

With an API key in `.env.local`, `npm run test:realm-ai` (`scripts/smoke-realm-ai.ts`) makes real Claude calls
to check the tutor, slide questions and curriculum research end to end (it does not cover lectures yet). It costs a little, so it never runs by default.

## Known limitations

- Curriculum research depends on what each university publishes. Some
  handbooks render content with JavaScript or block automated access; those
  subjects come back "partly inferred", and the game says so.
- Without an API key, mini-games for hand-entered subjects draw on week
  titles only (no glossary or practice questions).
- Progress is stored in the browser (export/import from the Options tab);
  there is no account sync. The study group works by swapping codes, so leaderboards are snapshots.
- The AI features (tutor chat, slide questions, curriculum research, lectures) have not been run live: no
  `ANTHROPIC_API_KEY` was configured when they were built. Run `npm run test:realm-ai` once a key is added.
- Image-only slides (scanned PDFs, slides that are pictures of text) have no text to read.
- Lecture narration uses the browser's built-in voices, so the voice depends on the device. Some browsers have none;
  the text is always shown.
- The interface is designed for desktop and tablet; very small phones work but are cramped.
