/**
 * Browser reminders. The rules are pure (and tested); useReminders shows
 * each one at most once a day while the game is open. There's no push
 * server, so nothing arrives while the game is closed.
 */

import { useEffect } from "react";
import { addDays, realmStore, todayIso } from "./store";
import { liveStreak, questProgress, resolvedDueDate } from "./actions";
import { dueCards } from "./grimoire";
import type { RealmState } from "../types";

export const REMIND_DAYS_BEFORE = 3;
export const STREAK_WARNING_HOUR = 19;
const SENT_KEY = "unigame.realm.reminded";

export interface Reminder {
  key: string;
  title: string;
  body: string;
}

export function dueReminders(state: RealmState, now: Date = new Date()): Reminder[] {
  const today = todayIso();
  const out: Reminder[] = [];
  for (const subject of state.curriculum?.subjects ?? []) {
    for (const a of subject.assessments) {
      if (questProgress(state, a).status === "complete") continue;
      const due = resolvedDueDate(a, state.curriculum);
      if (!due || due < today || due > addDays(today, REMIND_DAYS_BEFORE)) continue;
      const days = Math.round((new Date(`${due}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
      out.push({
        key: `due:${a.id}:${today}`,
        title: `${subject.code || subject.name}: ${a.title}`,
        body: days === 0 ? "Due today. Check the exact time in your subject guide." : `Due in ${days} day${days === 1 ? "" : "s"}. Its boss is awake in the lair.`,
      });
    }
  }
  const cards = dueCards(state).length;
  if (cards > 0) out.push({ key: `grimoire:${today}`, title: "Grimoire of Mistakes", body: `${cards} question${cards === 1 ? " is" : "s are"} due for review today.` });
  const streak = liveStreak(state);
  if (streak > 0 && state.progress.streak.lastDay !== today && now.getHours() >= STREAK_WARNING_HOUR) {
    out.push({ key: `streak:${today}`, title: `${streak}-day study streak`, body: "Study something today to keep it going. One waystone or a Grimoire review is enough." });
  }
  return out;
}

function sentLog(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

async function show(reminder: Reminder): Promise<void> {
  const options = { body: reminder.body, icon: "/icons/icon-192.png", tag: reminder.key };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(reminder.title, options);
    else new Notification(reminder.title, options);
  } catch {
    // Notifications blocked mid-session: nothing to do.
  }
}

/** Asks for permission. Returns whether reminders can be shown. */
export async function enableReminders(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function useReminders(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") return;
    const check = () => {
      if (Notification.permission !== "granted") return;
      const log = sentLog();
      const today = todayIso();
      for (const [key, day] of Object.entries(log)) if (day !== today) delete log[key];
      for (const reminder of dueReminders(realmStore.get())) {
        if (log[reminder.key]) continue;
        log[reminder.key] = today;
        void show(reminder);
      }
      try {
        localStorage.setItem(SENT_KEY, JSON.stringify(log));
      } catch {
        // ignore
      }
    };
    const first = window.setTimeout(check, 4000);
    const id = window.setInterval(check, 10 * 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [enabled]);
}
