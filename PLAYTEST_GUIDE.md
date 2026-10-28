# UniGame — Playtest Guide

Welcome, and thank you for testing! UniGame turns a real university semester
(4 subjects, 48 modules, 14 assessments) into a small living campus: walk
between subject rooms, study with Focus Sprints, track deadlines, and watch
the campus evolve as the semester progresses.

## Setup

- Chrome/Edge/Firefox, desktop or phone. No account, no install — one URL.
- Your progress saves automatically in your browser (localStorage). Nothing
  leaves your device.
- **Sound is off by default** (there is no audio yet — the toggle exists for
  a future update).

## Expected session length

- **Session 1 (~25–35 min):** first impressions + core loop.
- **Ideally 2–3 shorter return sessions (~10 min)** on later days — streaks,
  reminders, and the "living campus" only show themselves across days.

## Objectives (what we'd love you to try)

1. Start with zero instructions. Wander. Tell us where you got stuck.
2. Enter each subject room; poke at least three objects in one room.
3. Run one real Focus Sprint (even 5–10 minutes) and finish it.
4. Mark a few modules complete as you genuinely study.
5. Confirm one assessment's due date (Assessments → the "needs confirmation"
   fields) and see what changes.
6. Visit Calendar, Priority Centre, Collections, and Timeline once each.
7. On a phone, repeat #2 and #6.

## What we're observing (facilitators)

- Time-to-first-meaningful-action from a cold start (target < 60 s).
- Whether the notification badge / "High" priorities on first launch read
  as pressure (known concern — see FIRST_TIME_UX_REPORT.md F1/F2).
- Whether testers discover: mentor speech (hover), the study desk, the
  avatar cheer, the check-in form.
- Whether "needs confirmation" is understood without explanation.
- Whether per-room object names ("Sprint Board" vs generic "Missions")
  help or confuse.
- Any moment a tester asks "did that save?" or "what did that do?"

## Questions for testers (after the session)

1. In one sentence: what is this app for?
2. What was the first thing you did? Was it what the app wanted?
3. Did anything feel like nagging? Like praise? Did either feel unearned?
4. Did the campus feel *alive*? What gave you that feeling (or killed it)?
5. Was the Focus Sprint something you'd use for real study? Why/why not?
6. Did you understand why some dates need "confirming"?
7. What did the XP/level number mean to you, if anything?
8. What would you remove? What's missing before you'd use it weekly?
9. (Return sessions) Did anything visibly change since last time? Did you
   notice the mentors saying different things?

## Feedback template (copy per session)

```
Tester:            Device/browser:          Session #:    Date:
Minutes played:
First action taken:
Moments of confusion (what were you trying to do?):
1.
2.
Anything broken? (what you did → what happened → what you expected)
1.
Favourite moment:
Most annoying moment:
One-sentence description of the app:
Would you use it for your own study? (why / why not)
```

## Known limitations (don't file these)

- **All artwork is placeholder** (pixel characters, vector rooms) — final
  art replaces files without gameplay changes.
- **No audio exists yet**; the Settings toggle is forward-wiring.
- Semester start/end dates ship unconfirmed on purpose — week numbers appear
  only after you confirm the start date in Calendar.
- Mentor relationship level 5 and late-semester visuals are semester-scale;
  you won't reach them in a short playtest.
- Data is per-browser; clearing site data erases progress (Settings has
  export/import backup).

## Bugs to watch for (extra eyes appreciated)

- Any way to earn XP/achievements without doing the underlying thing.
- A Focus Sprint that survives odd sequences (refresh mid-sprint, tab
  sleeping overnight, phone lock) incorrectly.
- Reminder times that don't match the confirmed due date/time.
- The same milestone appearing twice in Timeline.
- Any place the UI claims progress you didn't make (dialogue included —
  mentors must never invent completed work).
- Horizontal scrolling on any phone screen.
