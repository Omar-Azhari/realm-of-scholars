# Phase 17 — Final Art & Production Checklist

Every remaining placeholder, grouped and prioritised by **player impact**
(P0 = on screen constantly / first impression; P1 = frequent; P2 = polish).
The engine renders whatever assets exist, so each item ships by replacing a
file under `public/assets/` (or adding a manifest entry) — no code changes.
See `planning/ART_BRIEFS.md` / `ART_PIPELINE.md` for specs and the geometry
freeze.

## Characters
| Item | Current | Priority |
| --- | --- | --- |
| Player avatar spritesheet (idle/walk/sit/typing/celebrate) | pixel-grid placeholder | **P0** — on screen 100% of the time |
| 4 mentor spritesheets (idle/wave/speaking/typing/reading/stressed/celebrate) | pixel-grid placeholders | **P0** — "speaking" carries the new 224-line dialogue; "reading" is the revision idle |

## Rooms
| Item | Current | Priority |
| --- | --- | --- |
| HQ hall background (final paint) | interim vector SVG | **P0** — first screen every session |
| 4 subject-room backgrounds (geometry-frozen) | interim vector SVG | **P0** — one per subject visit |
| Per-room night window art (moon/skyline) | only PM has interim variants | P1 |

## Props
| Item | Current | Priority |
| --- | --- | --- |
| Shared props — papers, books, mug, notes-cluster, banner, banner-semester, plant, cable, monitor2 | interim vector SVG | P1 — high-traffic (room-life uses them constantly now) |
| Door panels (`panelSrc`) + widget skins (trophy lit/locked, note-board) | engine-drawn/interim | P1 |
| Room-life accumulation props (finished-work stacks, filled whiteboard) | engine-drawn SVG rects | P2 — final art could paint these |

## UI
| Item | Current | Priority |
| --- | --- | --- |
| HUD chrome (player/location chips, objective bar, minimap frame) | CSS, ships now | P2 |
| Panel iconography (lucide) | fine as-is | P2 |
| Pixel display font sub-10px aliasing | reserve for ≥10px | P2 |
| Press Start 2P → WOFF2 (118 kB → ~40 kB) | TTF | P1 — cheap perf win |

## Effects
| Item | Current | Priority |
| --- | --- | --- |
| Interactable resting glow / hover frame | CSS, ships now | P2 |
| Destination marker, veil, door-burst, confetti | engine primitives | P2 — final could use sprite particles |
| Focus-mode vignette overlay | not present | P2 |

## Lighting
| Item | Current | Priority |
| --- | --- | --- |
| Baked ambient occlusion + bounce in final backgrounds | interim relies on runtime cone/glow | **P0** (part of room backgrounds) |
| Day/evening/night grading tuning per final art | manifest `atmosphere` values set for interim | P1 |
| Desk-lamp flicker / era glows | CSS + manifest ambience, ships now | P2 |

## Animation
| Item | Current | Priority |
| --- | --- | --- |
| Sprite-sheet frame sets (all characters) | pixel-grid, limited frames | **P0** |
| 2-piece door slide (`panelSrc` per half) | engine flat panel | P1 |
| Chair slide / monitor wake as layered art | engine rectangles | P2 |

## Audio (design ready, none implemented — see planning/SOUND_DESIGN_BRIEF.md)
| Item | Current | Priority |
| --- | --- | --- |
| One-shot pack (18 wired events: footsteps, hover, doors, focus, xp, achievement, celebration…) | silent, event architecture live | **P0** — footstep cadence + prompts are already firing events |
| Mentor voice blips (per-subject pitch) | proposed event | P1 — pairs with the expanded dialogue |
| Ambience loops (HQ + 4 rooms + focus) | needs a small loop channel | P1 |
| Completion fanfare | proposed | P2 |

## Suggested production order (value-first)
1. Mentor + player spritesheets (P0 characters — carry dialogue & presence).
2. HQ + 4 room backgrounds with baked lighting (P0 rooms/lighting).
3. One-shot audio pack (P0 — events already fire, incl. new footstep cadence).
4. Shared/room-life props + door panels (P1).
5. Window/night art, mentor voice blips, ambience loops (P1).
6. WOFF2 font, FX sprites, HUD polish, vignette (P1–P2).
