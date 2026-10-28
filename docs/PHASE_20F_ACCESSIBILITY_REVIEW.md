# Phase 20F — Accessibility Review

Code-level review (the Browser preview pane has been unable to render the
3D world live throughout this entire phase, the same recurring limitation
documented in `docs/PHASE_20F_VISUAL_AUDIT.md`) against the seven areas
Part 17 of the brief names: keyboard navigation, focus visibility, screen
readers, reduced motion, colour contrast, menu alternatives, 2D fallback.

## Keyboard navigation

- Movement in the 3D world uses `useWorldMovement` — the exact same hook
  the legacy 2D renderer already uses, WASD/arrow-key driven, unmodified
  this phase.
- Every interaction (doors, desks, the signpost, NPCs) is reachable via
  the `E` key while in range, in every scene shell (`TestRoomScene.tsx`,
  `CampusBuildingScene.tsx`) — confirmed unchanged from Phase 20C/20E.
- Every button added this phase (Settings sliders/dropdown, the Campus
  Directory's building list, the Daily Brief's "More Suggestions"
  Track/Locate buttons) is a plain `<button>`/`<select>`/`<input>` —
  natively Tab-reachable and activatable with Enter/Space, no custom
  keyboard handling needed or added.
- **Menu-level Campus Directory (Part 12, this phase)** — the one
  documented gap from Phase 20E ("no keyboard-reachable way to travel
  between buildings other than walking") is now closed: `MenuPanel.tsx` →
  Campus Directory → any building, fully keyboard-operable, no mouse
  required at any step.

## Focus visibility

- Audited every `outline: none` in the stylesheet (3 occurrences). Two are
  legitimate, pre-existing patterns: `.world-panel-title:focus` and
  `.room-panel` are containers that receive *programmatic* focus on panel
  open for screen-reader announcement (`tabIndex={-1}`) rather than being
  Tab-reachable themselves, and `.room-panel` already carries a bold 2px
  border + glow, making a redundant default outline visually wrong there.
- **Found and fixed a real gap**: `.subjects-search input:focus { outline:
  none; }` had no compensating focus style at all — a keyboard user
  tabbing into the Subjects panel's search field had zero visual
  indication it was focused. Added `.subjects-search:focus-within` (border
  colour + glow on the container) so focus is now visible. This was a
  pre-existing bug (not introduced this phase) that this review's audit
  pass caught.
- No new `outline: none` was introduced by any of this phase's own
  additions (transition veil, arrival marker, interaction prompt, mixer
  sliders, Campus Directory list) — all use default browser focus rings.

## Screen readers

- The 3D `<Canvas>` itself is not exposed to assistive tech (an
  `aria-hidden`-equivalent decorative surface, per the Art Bible's own
  "the world is the primary interface, menus support it" doctrine) — the
  real interactive surface is the 2D HUD/panel layer, which is a normal
  accessible DOM tree.
- `Game3D.tsx`'s `<h1 className="visually-hidden">UniGame Campus</h1>`
  (already fixed this phase, Part 3) gives screen-reader users a page
  landmark that no longer leaks engineering language.
- The building-transition veil (`.game3d-transition-veil`) is
  `aria-hidden="true"` — correctly excluded, since it's a purely visual
  cover with no content.
- The interaction prompt (`world-prompt`) carries a single combined
  `aria-label` ("Object: Action. Press E.") rather than exposing its two
  visual lines as separate unlabelled text nodes — one coherent
  announcement per prompt, added this phase (Part 8).
- The Daily Brief's reordered/renamed sections all keep real `<h3>`
  headings — screen-reader users can still navigate by heading after the
  Part 9 reorder.

## Reduced motion

- Every animation this phase added respects `reduceMotion`, checked
  individually: the arrival marker pulse is skipped entirely (not just
  slowed) when `reduceMotion` is true; the door scale-pulse and proximity
  light both snap instantly to their target value instead of easing; the
  building-transition veil's fade duration is `0ms` under reduced motion.
- **Found and fixed during this review**: the transition veil's reduced-
  motion duration was `60ms` — still a real (if brief) CSS opacity
  transition, contradicting its own code comment's claim of "no visible
  animated fade." Changed to `0ms`. The veil's functional role (covering
  the scene swap, gating input against double-transition) is unaffected —
  only the visual fade and the input-lock timer collapse to instant.
- No new continuous/parallax-style motion was introduced anywhere this
  phase.

## Colour contrast

- Spot-checked the new interaction-prompt object-name label
  (`--hq-text-muted` `#9aa6c0` on the prompt's `rgba(9,14,26,0.94)`
  background): computed contrast ratio ≈ 7.9:1 — passes WCAG AA (4.5:1)
  comfortably and is close to AAA (7:1), despite the small (0.66rem) type
  size.
- No new colour combination introduced this phase deviates from the
  existing `--hq-text`/`--hq-text-muted` pairing already used everywhere
  else in the HUD chrome, which predates this phase and wasn't re-audited
  wholesale (out of scope — this phase's job was auditing what changed).

## Non-colour indicators

- Every new physical-feedback cue (Part 8) combines a non-colour signal
  with any colour: the arrival marker is a shape (expanding ring) that
  fades, not a colour swap; the door scale-pulse is a size change; the
  proximity light is a brightness change; the hover sound cue is audio,
  not visual at all. None of this phase's additions rely on colour alone.

## Menu alternatives

- Character Creator, Room Planner, and (new this phase) the Campus
  Directory are all reachable from the Menu, independent of walking to
  their in-world counterpart — the established "accessibility entry"
  pattern (Phase 20B/20D) extended to cover the one remaining gap.

## 2D fallback

- `settings.worldRenderer` still switches instantly between "legacy-2d"
  and "experimental-3d" with zero data loss (unchanged mechanism). All of
  this phase's new save fields (`soundVolumes`, `graphicsQuality`) are
  Phase-20-only concepts the 2D renderer never reads — additive, no
  migration risk, confirmed by the unchanged
  `verify-phase20e-campus-expansion.ts` save-compatibility assertions
  still passing (129/129).
- The quality-tier system (`quality.ts`) and the mixer's category volumes
  only ever affect the 3D `<Canvas>`/its own scene shells — the 2D
  renderer never imports either module, so there is no code path by which
  this phase's changes could degrade the 2D experience.

## Summary

Two real, pre-existing-or-introduced issues found and fixed:
1. Subjects panel search input had no visible focus indicator at all
   (pre-existing, caught by this review).
2. The transition veil's reduced-motion duration was non-zero, contra its
   own stated intent (introduced this phase, self-corrected here).

No other critical issues found. Everything else audited above was either
already compliant or is a code-level review's practical limit — a full
manual screen-reader pass (NVDA/VoiceOver) and a real-device contrast
measurement weren't possible without a live render environment; this is
disclosed honestly rather than claimed as verified.
