# Phase 16 — Menu-Light Playthrough Report

Played the first hour attempting to use the world, not menus. Below: what the
core loop looks like now, and every point where a panel still feels forced.

## The core loop is now menu-light

1. **Campus HQ** — the four mentors stand by glowing doors. Walk to a door;
   the prompt reads **"E — Enter Project Management"**. No menu needed to
   choose a subject; the tracked objective (top-centre) and minimap both
   point the way.
2. **Enter a room** — a gentle camera push-in through the door; the mentor
   greets with a *navigational* line drawn from real progress, e.g. "The
   bookshelf has today's reading: …", "Have you checked the assessment
   board?", or "5 assessment details still need confirming."
3. **Every object invites interaction** — a quiet resting glow (no arrows);
   on approach, a purpose icon + name appear and the bottom prompt names the
   act: **Review Assessment · Browse Books · Read Notice Board · Check
   Calendar · Check Progress · View Trophies · Start Study Session · Talk ·
   Exit Room**.
4. **Study** — walk to the desk → **Start Study Session** opens Focus Mode in
   place. This is a world act, not a menu trip.
5. **See your progress without a panel** — completing modules visibly fills
   the room (notes on the board, a mug on busy weeks, books, live monitor
   content) via the re-embedded room-life layer.

Across this loop the only overlays that open are the ones the *world itself*
triggers (Focus Mode from the desk; a section from an object) — never a tab.

## Where a panel still (correctly) appears

These are **data-record acts with no physical world equivalent**, so they
stay as menu shortcuts rather than being forced into the world:

| Moment | Why it's a panel | Verdict |
| --- | --- | --- |
| Ticking a module **complete** | "Complete" is a record action, not a physical act; the *studying* is the world act (the desk) | Kept in Tasks / Subjects→Modules; not forced during exploration |
| Confirming an assessment's **date/weight** | Structured data entry from your handbook | Reached via the assessment board → Tasks; correct home |
| Choosing a **focus duration** (25/45/60) | A short setup step inside the desk's own overlay | World-triggered (desk), so already world-first |
| Profile / Settings / Statistics / Export | No object to walk to | Correctly in Menu; the loop never forces them |

## Forced-panel points found and improved

- **Choosing a subject** previously invited the Subjects tab; now the HQ
  doors + objective + minimap make walking the primary path (tab is a
  shortcut).
- **"What should I do next?"** previously meant opening Tasks; the mentor now
  *says* it and points at the relevant object, and the single objective bar
  carries a Locate.
- **Finding readings/assessments** previously meant Subjects/Tasks; the
  bookshelf and assessment board now open the right section directly, and the
  prompt names them.

## Net result

The interface got quieter (Phase 15B) and the world got richer (Phase 16):
the explore → talk → study loop runs without touching a tab, while the four
tabs remain as shortcuts for anything you'd rather do from a menu. No
mechanics, systems, or UI were added — only existing systems re-embedded into
the world.
