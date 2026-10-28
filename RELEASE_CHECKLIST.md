# UniGame — Release Checklist

Status keys: ✅ done/verified · 🟡 pending decision or asset · ⬜ not started.
Current state reflects the Phase 12 audit (see planning/PROJECT_AUDIT.md).

## 1. Testing

- ✅ Gameplay regression battery (35 checks: Focus Sprint, XP, streaks,
  journal, anti-farming, migrations) — green.
- ✅ Cross-cutting QA battery (20 checks: 4 viewports, keyboard-only, all
  rooms, a11y counts, reduced motion, FPS) — green.
- ✅ Phase 11 living-semester battery (39 checks) — green.
- ✅ Re-run all batteries on RC1 (35/35, 20/20, 34/35¹, 4/4 + new RC1
  battery 20/20 on Chrome and Edge). ¹One known test-artifact, not a bug —
  see BROWSER_SUPPORT.md / RC1 report.
- ⬜ One manual pass on real hardware: 1 Windows laptop, 1 Android phone,
  1 iPhone/Safari (Safari has had zero coverage — highest-risk gap).
- ⬜ Multi-day soak: keep one save active ≥ 3 days (streaks, reminders,
  atmosphere phases, era drift).

## 2. Builds

- ✅ `npm run typecheck` green · `npm run build` green (3.9 s).
- ✅ ESLint 9 flat config installed, `npm run lint` green (RC1).
- 🟡 Decide hosting + base path — guides and configs ready for four options
  (DEPLOYMENT.md); the choice itself is the only open item.
- ✅ SPA fallback configs committed (`vercel.json`, `public/_redirects`,
  GH Pages 404 procedure documented) and verified on the built artifact.
- ✅ Version stamp in Settings → About (v1.0.0-rc.1 + build time + commit).

## 3. Save compatibility

- ✅ Field-level coercers; unknown fields dropped, missing fields defaulted.
- ✅ v1→v2 migration + Phase 11 additive fields covered by tests.
- ✅ Automatic backups before migration and before import; export/import UI.
- ⬜ Freeze rule for playtest: additive fields only, no version bump, no
  destructive migrations while external saves exist.
- ⬜ Test a save exported from the playtest build importing into the next
  build (forward-compat drill) before shipping any update.

## 4. Performance

- ✅ 117–120 fps on the heaviest scene; panel open 89 ms.
- ✅ First load ≈ 157 kB gzip JS+CSS (+ font); planner screens code-split.
- 🟡 Press Start 2P → WOFF2 (118 kB → ~40 kB) at next asset touch.
- ⬜ One Lighthouse run on the deployed URL (field data, not localhost).

## 5. Accessibility (details in planning/ACCESSIBILITY_REVIEW.md)

- ✅ Contrast ≥ 7:1 sampled · skip link · 1×h1/screen · dialogs+Escape ·
  reduced-motion (media query AND in-app toggle) · 200% font scaling.
- ✅ All interactive targets ≥ 44 px on portrait/landscape/tablet (RC1).
- ✅ Nav landmarks distinctly labelled; HUD is a `header` (RC1).
- ✅ Mentor speech reachable by keyboard focus and shown on room entry for
  touch (RC1).
- 🟡 aria-live announcements for Focus phase changes.

## 6. Artwork (details in planning/ART_PRODUCTION_CHECKLIST.md)

- 🟡 All 5 character sprites are placeholders — ship playtest with
  placeholders (known limitation), final sheets replace files with zero
  code changes.
- 🟡 5 scene backgrounds + shared props interim vector art.
- ✅ Geometry freeze documented (ART_PIPELINE.md) so art lands safely.
- ⬜ Final art acceptance pass per room against ART_BRIEFS.md when it lands.

## 7. Localisation readiness

- 🟡 All strings are hardcoded English (UI copy, dialogue pools, persona
  labels). No i18n framework — **acceptable for playtest**, flagged for any
  broader release.
- ✅ Dates/times already centralised through Melbourne helpers (one place to
  make locale-aware later); timezone is intentionally fixed to the
  semester's timezone.
- ⬜ If localisation is ever scheduled: extract dialogue pools and screen
  copy first (they're already data-shaped in mentorDialogue.ts).

## 8. Audio readiness

- ✅ Event architecture wired (20 call sites, 18 events), opt-in, silent
  when files are absent — shipping silent is safe.
- 🟡 Sound pack production per planning/SOUND_DESIGN_BRIEF.md.
- ⬜ Loop channel for ambience (small engine extension, only when audio
  lands).

## 9. Documentation

- ✅ planning/: ARCHITECTURE_GUIDE, FEATURE_PLAN, DESIGN_SYSTEM,
  ART_BRIEFS/PIPELINE + PRODUCTION_CHECKLIST, BALANCE_REVIEW (Ph11+Ph12),
  PROJECT_AUDIT, FIRST_TIME_UX_REPORT, ACCESSIBILITY_REVIEW,
  PERFORMANCE_REVIEW, SOUND_DESIGN_BRIEF.
- ✅ PLAYTEST_GUIDE.md (this release's companion).
- ✅ TESTER_README.md (Phase 14): zero-install quick start, browser
  recommendations, bug-report recipe, feedback form, backup instructions.
- ⬜ Post-playtest: file findings against FIRST_TIME_UX_REPORT items so
  hypotheses get confirmed/refuted rather than re-argued.

## Gate for "send to testers"

Minimum bar: §1 re-run green on the RC · §2 hosting + SPA fallback + version
stamp · §3 freeze rule agreed · §5 touch-target fix (one CSS change, big
mobile win). Everything else can follow the playtest.
