/**
 * Owl post: reminders and news arrive as letters an owl drops off in-game.
 * Letters come from the same rules as browser reminders (deadlines, Grimoire
 * reviews, a streak at risk) plus house news and today's classes. Each one
 * is delivered once (keyed), kept in the mailbox (HUD envelope, dorm tray),
 * and marked read when opened.
 */

import { realmStore, todayIso } from "./store";
import { chat, emit } from "./events";
import { dueReminders } from "./reminders";
import type { Letter, RealmState } from "../types";
import { familiarLevel } from "../customise/familiar";
import { dueLabel, upcomingQuests } from "../dialogues";
import { classesOn } from "../curriculum/timetable";

export const MAX_LETTERS = 60;

/** Letters the owls should bring now (not yet filtered against what was delivered). */
export function lettersDue(state: RealmState, now: Date = new Date()): Letter[] {
  const at = now.toISOString();
  const letters: Letter[] = dueReminders(state, now).map((r) => ({
    key: `owl:${r.key}`,
    at,
    from: r.key.startsWith("due:") ? "The Registrar" : r.key.startsWith("grimoire:") ? "Your Grimoire" : "Your study streak",
    subject: r.title,
    body: r.body,
    read: false,
  }));
  // Today's classes, from the imported timetable.
  const today = classesOn(state.progress.timetable, now);
  if (today.length) {
    letters.push({
      key: `classes:${todayIso()}`,
      at,
      from: "The Timetable Office",
      subject: `Today: ${today.length} class${today.length === 1 ? "" : "es"}`,
      body: today.map((c) => `${c.start}–${c.end} ${c.title}${c.location ? ` (${c.location})` : ""}`).join("\n") + "\nStudy that subject within 3 hours after class for +5 Focus.",
      read: false,
    });
  }
  // A familiar of level 3+ leaves a daily note about the next deadline.
  if (familiarLevel(state) >= 3) {
    const next = upcomingQuests(state, state.curriculum?.subjects ?? [])[0];
    if (next) {
      letters.push({
        key: `familiar:${todayIso()}`,
        at,
        from: "Your familiar",
        subject: `Next up: ${next.assessment.title}`,
        body: `${next.subject.code || next.subject.name}: ${dueLabel(next.assessment, state.curriculum)}. (A note left on your pillow.)`,
        read: false,
      });
    }
  }
  return letters;
}

export function unreadCount(state: RealmState): number {
  return state.progress.mail.filter((l) => !l.read).length;
}

/** Adds letters that haven't been delivered before. Returns how many arrived. */
export function deliver(letters: Letter[]): number {
  const state = realmStore.get();
  const known = new Set(state.progress.mail.map((l) => l.key));
  const fresh = letters.filter((l) => !known.has(l.key));
  if (fresh.length === 0) return 0;
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, mail: [...fresh, ...s.progress.mail].slice(0, MAX_LETTERS) } }));
  emit({ type: "owl", count: fresh.length });
  emit({ type: "sound", name: "owl" });
  chat(fresh.length === 1 ? `An owl drops a letter: ${fresh[0].subject}` : `Owls drop ${fresh.length} letters at your feet.`, "quest");
  return fresh.length;
}

/** Sends one letter right away (game news: a rival's challenge, a house update…). Keyed so it arrives once. */
export function sendLetter(key: string, from: string, subject: string, body: string): boolean {
  return deliver([{ key, at: new Date().toISOString(), from, subject, body, read: false }]) > 0;
}

export function markRead(key: string): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, mail: s.progress.mail.map((l) => (l.key === key ? { ...l, read: true } : l)) } }));
}

export function markAllRead(): void {
  realmStore.set((s) => ({ ...s, progress: { ...s.progress, mail: s.progress.mail.map((l) => ({ ...l, read: true })) } }));
}

/** A day key, for letters that should come at most once a day. */
export function dayKey(): string {
  return todayIso();
}
