/**
 * Expo mode, for demoing the game at a stand: open the game with `?expo`.
 *
 *  - Its own save (`unigame.realm.expo`), so the real save is never read or written.
 *  - Each visitor starts as a fresh La Trobe student with the four built-in subjects,
 *    makes a character, and gets the intro fly-over. Focus is full and refills
 *    itself (the stand is for trying everything), and there are plenty of coins.
 *  - Clear skies and a fixed golden-afternoon sky (no storms, whatever the date).
 *  - Nothing that leaves the machine or can't be undone on the spot: no file
 *    downloads or imports, no re-enrolling, no classic mode (hidden in the menu).
 *  - "New visitor" resets everything for the next person, and an idle stand
 *    resets itself after a few minutes back to the welcome screen, which doubles
 *    as the attract loop.
 */

import { blockSaving, EXPO_RESET_FLAG, realmStore } from "./state/store";
import { setCurriculum, setPlayer } from "./state/actions";
import { loadSavedLaTrobeSemester } from "./curriculum/latrobe";
import { withLaTrobeDates } from "./curriculum/latrobeCalendar";
import { pickTheme } from "./curriculum/normalize";
import { FOCUS } from "./life/catalog";
import type { RegionTheme } from "./types";

export const EXPO_KEY = "unigame.realm.expo";
/** Coins each visitor starts with: enough for the bazaar, the dorm shop and the dye merchant. */
export const EXPO_COINS = 5000;
/** Minutes without any input before the stand resets itself for the next visitor. */
export const EXPO_IDLE_MINUTES = 3;

let expo: boolean | null = null;
/** True when the page was opened with ?expo. */
export function isExpo(): boolean {
  if (expo === null) {
    try {
      expo = typeof location !== "undefined" && new URLSearchParams(location.search).has("expo");
    } catch {
      expo = false;
    }
  }
  return expo;
}

/** Wipes the demo save and starts again at the welcome screen. */
export function resetForNextVisitor(): void {
  // Stop the store saving first, so nothing writes the old visitor back on the way out.
  blockSaving();
  try {
    localStorage.removeItem(EXPO_KEY);
    // Belt and braces: the next load wipes the demo save again before reading it, in case
    // anything still wrote it back on the way out.
    sessionStorage.setItem(EXPO_RESET_FLAG, "1");
  } catch {
    // Nothing saved, nothing to clear.
  }
  window.location.reload();
}

/** Starts a visitor's game: a La Trobe student with the four built-in subjects, ready to make a character. */
export async function startDemo(name: string): Promise<boolean> {
  const saved = await loadSavedLaTrobeSemester();
  if (!saved || saved.subjects.length === 0) return false;
  const used = new Set<RegionTheme>();
  const subjects = saved.subjects.map((subject, i) => {
    const theme = pickTheme(subject.name, i, used);
    used.add(theme);
    return { ...subject, theme };
  });
  // No appearance yet: the game opens the character creator first.
  setPlayer({ name: name.trim() || "Guest scholar", look: { skin: "#e0b090", hair: "#3a2a1a", tunic: "#2e6bb8", legs: "#2a3040", cape: "#c8102e" } });
  setCurriculum({
    enrolment: withLaTrobeDates({
      country: "Australia",
      city: "Melbourne (Bundoora)",
      university: "La Trobe University",
      course: "Bachelor of Computer Science",
      yearLevel: "2",
      teachingPeriod: saved.teachingPeriod ?? "Semester 2",
      year: saved.year ?? new Date().getFullYear(),
      startDate: null,
    }),
    subjects,
    createdAt: new Date().toISOString(),
  });
  // A full tank of Focus and plenty of coins, so a visitor can try everything; clear, fixed skies.
  realmStore.set((s) => ({
    ...s,
    settings: { ...s.settings, realTimeSky: false },
    progress: { ...s.progress, focus: FOCUS.max, coins: EXPO_COINS },
  }));
  return true;
}

/** Keeps the demo's Focus topped up: whenever it falls below half, it refills. */
export function topUpFocus(): void {
  const focus = realmStore.get().progress.focus;
  if (focus < FOCUS.max / 2) realmStore.set((st) => ({ ...st, progress: { ...st.progress, focus: FOCUS.max } }));
}
