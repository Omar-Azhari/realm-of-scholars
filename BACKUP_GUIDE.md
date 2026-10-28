# UniGame — Backup & Save Recovery Guide

Everything a player does is stored in **one browser localStorage entry per
origin**: `unigame:saveData:v1`. No server copy exists. This guide covers
protecting, moving, and recovering that data.

## Exporting a save (the everyday backup)

Settings → Data → **Export save data (.json)**. This downloads the complete
current save (progress, sprints, journal, reminders, settings, milestones)
as a single JSON file. Recommend testers export:

- after any long study session,
- before switching browsers/devices,
- whenever a new build is announced (belt-and-braces; updates are additive).

## Importing a save

Settings → Data → **Import save data** → choose the exported `.json`.

- The file is validated first (not JSON / not a UniGame save / missing
  semester data are each rejected with a specific message — nothing is
  overwritten on a failed import).
- **Before** a successful import replaces the live save, the previous save
  is automatically copied to `unigame:saveData:backup-preimport` — one-step
  undo always exists.
- Import works across browsers and devices: export on the laptop, import on
  the phone.

## Migration strategy (how updates keep old saves working)

- Saves carry a `version` (currently 2). On load, **field-level coercers**
  rebuild a valid save from whatever is present: unknown fields are
  dropped, missing fields get defaults, damaged entries are skipped
  individually — a save is never rejected wholesale.
- New features add **additive fields only** (e.g. Phase 11's milestone log,
  RC1's onboarding flag) — these need no version bump and old saves simply
  gain defaults.
- A version bump (v1→v2 happened in Phase 7) triggers a one-time automatic
  raw backup to `unigame:saveData:backup-v1` *before* migration, kept until
  manually cleared.
- Playtest freeze rule (RELEASE_CHECKLIST §3): while external testers hold
  saves, changes stay additive; any future v3 migration must ship with the
  same auto-backup pattern and be drilled with a forward-compat import test
  first.

## Recovering a corrupt save

Corruption is rare by design (coercers absorb partial damage), but if the
app ever loads to a fresh state unexpectedly:

1. **Don't do anything that saves progress yet** (each change persists and
   overwrites).
2. Check the automatic backups — DevTools → Application → Local Storage →
   the site origin:
   - `unigame:saveData:backup-preimport` — the save as it was before the
     last import.
   - `unigame:saveData:backup-v1` — the pre-migration copy (old testers).
3. To restore one: copy its value, paste into a text file, save as `.json`,
   then Settings → Import. (Or, in DevTools, copy the value into
   `unigame:saveData:v1` and reload.)
4. If the stored JSON is truncated/mangled beyond the coercers' tolerance,
   the most recent exported file is the fallback — hence the export habit.
5. Total loss with no export and no backups: the semester *content* is
   seed data and always intact; only progress is personal.

## Preserving tester progress across the playtest

- **Keep the URL stable.** localStorage is per-origin — moving from
  `unigame.vercel.app` to a custom domain silently "resets" everyone.
  If a move is unavoidable: announce it, have every tester export first,
  import at the new address.
- Deploys/rollbacks never touch saves (client-side only).
- "Reset app data" in Settings is intentionally destructive (fresh seed) —
  it's the one button testers should treat with respect; export first.
- Browser "clear site data" / privacy-mode auto-clearing erases saves; the
  storage-failure banner (RC1) warns when saving isn't working, and
  TESTER_README.md tells testers to avoid private windows.
- If a tester wants their progress analysed with a bug report, the exported
  JSON is the perfect attachment: it reproduces their exact world state.
