# Phase 16 — Interaction Audit

Goal: wherever a panel action could be performed naturally by walking to an
object, make the **world interaction primary** and keep the menu as a
shortcut. No new menus/tabs/HUD/mechanics — only re-embedding existing
systems into the world.

## Every panel action → is there a natural world equivalent?

| Panel action (15B) | Could you walk to it? | World-primary object | Status after 16 |
| --- | --- | --- | --- |
| Tasks → see recommended next task | Partly | Mentor *tells* you; the tracked objective points to the room/object | Mentor nav-hints added; menu stays as shortcut |
| Tasks → Locate a task | Yes | The tracked objective + walking to the room already does this | Already world-first (objective Locate) |
| Tasks → Start focus | **Yes** | **Study desk** in the room | Already world-first (desk → Focus); prompt now "Start Study Session" |
| Tasks → Complete a module | Partly (study is the natural act) | Study desk / module reading | Kept in menu; study is the world act. Completion stays an explicit tap (no new mechanic) |
| Tasks → Review an assessment | **Yes** | **Assessment board** | World-primary: board → Tasks filtered; prompt "Review Assessment" |
| Subjects → open Resources/modules | **Yes** | **Bookshelf** | World-primary: bookshelf → that subject's Resources; prompt "Browse Books" |
| Subjects → subject progress | **Yes** | **Progress display** in room + visible room changes | World-primary: progress board + environmental feedback (RoomLifeLayer) |
| Subjects → enter room | **Yes** | **HQ door** | Already world-first (walk to door → Enter) |
| Calendar → deadlines/reminders | **Yes** | **Deadline board / notice board** | World-primary: board → Calendar; prompt "Check Calendar" / "Read Notice Board" |
| Menu → Achievements | **Yes** | **Trophy cabinet** | World-primary: trophy → Achievements; prompt "View Trophies" |
| Menu → Profile / Settings / Statistics | No natural world object | — | Stays in Menu (correct home) |
| Talk to mentor / study check-in | **Yes** | **Mentor** | World-first: mentor → dialogue (now navigational) |

## Conclusions / changes this phase

1. **Every room object already opens the right section** (15B wiring). Phase
   16 makes the *invitation* clearer, not the plumbing:
   - Context-sensitive prompt phrases ("Read Notice Board", "Browse Books",
     "Review Assessment", "Check Calendar", "View Trophies", "Start Study
     Session", "Talk", "Exit Room") instead of generic verbs.
   - A quiet resting affordance so objects read as interactive without
     floating arrows; a small purpose icon appears on approach/hover.
2. **Mentors become navigational helpers** — the dialogue ladder gains lines
   that point at real objects and real progress ("Have you checked the
   assessment board?", "You've almost finished the modules here", "The
   bookshelf has the next reading"), using the existing architecture.
3. **The world reflects progress** — the orphaned `RoomLifeLayer` (module
   count → notes on the board, mug on busy weeks, books, monitor life) is
   re-embedded so completing modules visibly changes the room *without
   opening a panel*.
4. **Walking is rewarding** — ease-in/ease-out arrival, footstep cadence
   while moving, a subtle camera anticipation when entering a door, and the
   player turning to face the object they stop beside.

## What deliberately stays in a menu (no natural world act)

Profile identity, Settings/accessibility, Save export/import, Statistics,
and the *full* task list — these have no physical object to walk to and
remain in Menu/Tasks as the correct home. The world never *forces* you into
them for the core loop (visit → talk → study → review → complete).
