# UniGame v1.0.0-rc.1 — Release Notes

**First release candidate, approved for external playtesting.**
Build identity appears in Settings → About; quote it in every report.

## What UniGame is

A university semester (4 real subjects, 48 modules, 14 assessments) as a
small living campus: walkable HQ, four mentor-staffed subject rooms, Focus
Sprints that reward real study time, deadlines/reminders/journal/planner
tools, and a semester that visibly progresses around the player — all
derived from one client-side save.

## Release highlights (since 0.11.0)

- **Calmer first launch**: urgent-only notification badge, one consolidated
  setup prompt, "Suggested First Steps" framing, and a skippable welcome
  coach mark.
- **Touch & keyboard parity for mentors**: entry greetings on every room
  visit, focusable speech.
- **Accessibility**: all touch targets ≥ 44 px, labelled landmarks,
  safe-area support; contrast/scaling/reduced-motion verified.
- **Resilience**: friendly recovery for render crashes, failed chunks,
  missing assets, and blocked storage — no stack traces, saves always safe.
- **Tooling**: ESLint 9 green, semantic versioning, build metadata,
  deployment packaging for four hosting options.

## Final audit (Phase 14)

| Check | Result |
| --- | --- |
| Production build | ✅ `dist/` 1.1 MB; 146.8 kB gzip core JS + 10.7 kB CSS; 9 lazy chunks; no source maps; favicon/manifest/robots present |
| Artifact smoke test | ✅ deep-link SPA fallback, HQ renders, About shows v1.0.0-rc.1, static files 200, zero console errors (vite preview) |
| Lint | ✅ ESLint 9, 0 errors / 0 warnings |
| Typecheck | ✅ tsc strict, clean |
| QA batteries | ✅ 35/35 gameplay · 20/20 cross-cutting · 34/35 living-semester (1 known test artifact, behaviour covered 4/4 by dialogue battery) · 20/20 RC1 × Chrome & Edge |
| Browser matrix | ✅ Chrome/Edge verified; Firefox/Safari static-audited, flagged for first-device pass (planning/BROWSER_SUPPORT.md) |
| Accessibility | ✅ RC1 items closed: 44 px targets, landmarks, focusable speech, storage warnings; contrast ≥ 7:1, 200 % scaling, reduced-motion |
| Save compatibility | ✅ v1→v2 migration + pre-Phase-11 saves tested; additive-only freeze in effect; auto-backups verified |
| Performance | ✅ 117–120 fps heaviest scene; 89 ms panel open; ≈158 kB gzip first load |
| Documentation | ✅ deployment (DEPLOYMENT.md), backup (BACKUP_GUIDE.md), testers (TESTER_README.md, PLAYTEST_GUIDE.md), audit set under planning/, CHANGELOG with policy + full phase history |

## Known limitations (by design, this RC)

- Placeholder art (all sprites + rooms); no audio; English only.
- Safari and Firefox awaiting first real-device passes.
- Week numbering requires the user to confirm the semester start date
  (no dates are ever guessed).
- No crash-reporting service (privacy-first choice for the playtest —
  see planning/CRASH_REPORTING.md for the future integration plan).

## Deploy & distribute

DEPLOYMENT.md covers Vercel (config committed), Netlify (`_redirects`
committed), GitHub Pages (subpath + 404 fallback), and generic static
hosting, each with cache rules, rollback, and a 2-minute post-deploy smoke
test. Keep the playtest URL stable — saves are per-origin.
