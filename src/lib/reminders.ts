/**
 * Reminder engine.
 *
 * Auto reminders (assessment deadlines, weekly planning) are *synced* from
 * real data with deterministic ids, so regeneration can never duplicate
 * them, while their user-facing state (snoozed / dismissed / completed /
 * notified) persists on the stored record. User-created reminders are left
 * untouched by the sync.
 *
 * Hard rule (from every subject's own assessments file): deadline reminders
 * exist ONLY for assessments whose due date AND due time are both confirmed.
 * All times are Australia/Melbourne wall clock ("YYYY-MM-DDTHH:mm" keys, the
 * same convention the rest of the app compares deadlines with); the original
 * AEST/AEDT source wording travels on each reminder as `sourceWindow`.
 */

import { DEFAULT_REMINDER_OFFSETS } from "../types/domain";
import type { ReminderRecord, SubjectRecord, UniGameSaveData } from "../types/domain";
import { getMelbourneDateTimeKey, getMelbourneDateIso, shiftDateIso } from "./selectors";

/* ------------------------------------------------------------------ */
/* Wall-clock arithmetic on "YYYY-MM-DDTHH:mm" keys                     */
/* ------------------------------------------------------------------ */

/** Minutes represented by the supported ISO offsets ("P28D", "PT3H", …). */
export function isoOffsetToMinutes(isoDuration: string): number | null {
  const dayMatch = /^P(\d+)D$/.exec(isoDuration);
  if (dayMatch) return Number(dayMatch[1]) * 24 * 60;
  const hourMatch = /^PT(\d+)H$/.exec(isoDuration);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  return null;
}

/**
 * Shifts a Melbourne wall-clock key by whole minutes (negative = earlier).
 * Pure calendar arithmetic on the naive local time — a reminder "3 hours
 * before 23:59" means 20:59 on the same wall clock even across a DST change,
 * which matches how the source documents express deadlines.
 */
export function shiftMelbourneKey(key: string, deltaMinutes: number): string {
  const [datePart, timePart] = key.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute + deltaMinutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate()
  )}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** Human label for an offset, matching DEFAULT_REMINDER_OFFSETS. */
export function offsetLabel(isoDuration: string): string {
  return (
    DEFAULT_REMINDER_OFFSETS.find((offset) => offset.isoDuration === isoDuration)?.label ??
    isoDuration
  );
}

/** "Mon 3 Aug, 9:00 am" — display formatting for a Melbourne wall-clock key. */
export function formatMelbourneKey(key: string): string {
  const [datePart, timePart] = key.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const asUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][asUtc.getUTCDay()];
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "am" : "pm";
  return `${dayName} ${day} ${monthName} ${year}, ${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

/* ------------------------------------------------------------------ */
/* Auto-reminder sync                                                   */
/* ------------------------------------------------------------------ */

function autoDeadlineId(assessmentId: string, isoDuration: string): string {
  return `auto-deadline-${assessmentId}-${isoDuration}`;
}

/** Monday of the week containing `dateIso` (Melbourne calendar). */
export function mondayOfWeek(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return shiftDateIso(dateIso, delta);
}

interface DeadlineSource {
  subject: SubjectRecord;
  assessmentId: string;
  title: string;
  dueKey: string;
  sourceWindow: string;
}

function confirmedDeadlines(subjects: SubjectRecord[]): DeadlineSource[] {
  const result: DeadlineSource[] = [];
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      const { dueDate, dueTime } = assessment;
      if (
        dueDate.status === "confirmed" &&
        dueTime.status === "confirmed" &&
        dueDate.value &&
        dueTime.value
      ) {
        result.push({
          subject,
          assessmentId: assessment.id,
          title: assessment.title,
          dueKey: `${dueDate.value}T${dueTime.value}`,
          sourceWindow: assessment.dueWindowRaw || `${dueDate.value} ${dueTime.value}`,
        });
      }
    }
  }
  return result;
}

/**
 * Returns the reminder list with auto reminders brought in line with the
 * current assessment data and settings. Never touches user-created records.
 * Returns the ORIGINAL array instance when nothing changed, so callers can
 * cheaply detect "no update needed".
 */
export function syncAutoReminders(save: UniGameSaveData, now: Date = new Date()): ReminderRecord[] {
  const nowKey = getMelbourneDateTimeKey(now);
  const existingById = new Map(save.reminders.map((reminder) => [reminder.id, reminder]));
  const keptIds = new Set<string>();
  const next: ReminderRecord[] = [];
  let changed = false;

  const enabledOffsets = save.settings.reminderOffsets.filter((offset) => offset.enabled);

  // --- assessment-deadline reminders (confirmed deadlines only) ---
  for (const deadline of confirmedDeadlines(save.semester.subjects)) {
    for (const offset of enabledOffsets) {
      const minutes = isoOffsetToMinutes(offset.isoDuration);
      if (minutes === null) continue;
      const fireAt = shiftMelbourneKey(deadline.dueKey, -minutes);
      const id = autoDeadlineId(deadline.assessmentId, offset.isoDuration);
      const existing = existingById.get(id);
      const title = `${deadline.title} — ${offsetLabel(offset.isoDuration)}`;

      if (existing) {
        keptIds.add(id);
        if (existing.fireAt !== fireAt || existing.title !== title || existing.sourceWindow !== deadline.sourceWindow) {
          // Deadline was edited — re-point the reminder and re-arm it.
          next.push({ ...existing, fireAt, title, sourceWindow: deadline.sourceWindow, notifiedAt: null });
          changed = true;
        } else {
          next.push(existing);
        }
        continue;
      }

      // Don't backfill reminders that would have fired more than a day ago —
      // a freshly-confirmed deadline shouldn't flood the centre with history.
      if (fireAt < shiftMelbourneKey(nowKey, -24 * 60)) continue;

      keptIds.add(id);
      next.push({
        id,
        kind: "assessment-deadline",
        title,
        subjectId: deadline.subject.id,
        assessmentId: deadline.assessmentId,
        offsetIso: offset.isoDuration,
        fireAt,
        sourceWindow: deadline.sourceWindow,
        status: "pending",
        snoozedUntil: null,
        notifiedAt: null,
        origin: "auto",
        createdAt: nowKey,
      });
      changed = true;
    }
  }

  // --- weekly planning reminder (this week's Monday, 9:00 am) ---
  if (save.settings.weeklyPlanningReminder) {
    const monday = mondayOfWeek(getMelbourneDateIso(now));
    const id = `auto-weekly-${monday}`;
    const existing = existingById.get(id);
    if (existing) {
      keptIds.add(id);
      next.push(existing);
    } else {
      keptIds.add(id);
      next.push({
        id,
        kind: "weekly-planning",
        title: "Weekly planning — review this week's deadlines and pick your focus",
        subjectId: null,
        assessmentId: null,
        offsetIso: null,
        fireAt: `${monday}T09:00`,
        sourceWindow: null,
        status: "pending",
        snoozedUntil: null,
        notifiedAt: null,
        origin: "auto",
        createdAt: nowKey,
      });
      changed = true;
    }
  }

  // --- keep user reminders and completed/dismissed auto history ---
  for (const reminder of save.reminders) {
    if (keptIds.has(reminder.id)) continue;
    if (reminder.origin === "user") {
      next.push(reminder);
      continue;
    }
    // Auto record whose source disappeared (deadline un-confirmed, offset
    // disabled, old week). Pending ones are removed — the rule says never
    // schedule without a confirmed deadline; resolved history is kept.
    if (reminder.status === "pending") {
      changed = true;
      continue;
    }
    next.push(reminder);
  }

  return changed || next.length !== save.reminders.length ? next : save.reminders;
}

/* ------------------------------------------------------------------ */
/* Display state                                                        */
/* ------------------------------------------------------------------ */

export type ReminderDisplayState =
  | "upcoming"
  | "due-today"
  | "overdue"
  | "snoozed"
  | "dismissed"
  | "completed";

export interface ReminderView {
  reminder: ReminderRecord;
  state: ReminderDisplayState;
  /** fireAt, or the snooze target while snoozed. */
  effectiveFireAt: string;
}

export function getReminderView(reminder: ReminderRecord, now: Date = new Date()): ReminderView {
  const nowKey = getMelbourneDateTimeKey(now);
  if (reminder.status === "completed") {
    return { reminder, state: "completed", effectiveFireAt: reminder.fireAt };
  }
  if (reminder.status === "dismissed") {
    return { reminder, state: "dismissed", effectiveFireAt: reminder.fireAt };
  }
  if (reminder.snoozedUntil && reminder.snoozedUntil > nowKey) {
    return { reminder, state: "snoozed", effectiveFireAt: reminder.snoozedUntil };
  }
  const effectiveFireAt = reminder.snoozedUntil && reminder.snoozedUntil > reminder.fireAt
    ? reminder.snoozedUntil
    : reminder.fireAt;
  const today = nowKey.slice(0, 10);
  const fireDate = effectiveFireAt.slice(0, 10);
  if (fireDate < today) return { reminder, state: "overdue", effectiveFireAt };
  if (fireDate === today) return { reminder, state: "due-today", effectiveFireAt };
  return { reminder, state: "upcoming", effectiveFireAt };
}

/** All reminder views, soonest first within each state. */
export function getReminderViews(save: UniGameSaveData, now: Date = new Date()): ReminderView[] {
  return save.reminders
    .map((reminder) => getReminderView(reminder, now))
    .sort((a, b) => (a.effectiveFireAt < b.effectiveFireAt ? -1 : 1));
}

/** Pending reminders whose (effective) fire time has arrived and that haven't been surfaced yet. */
export function getDueUnnotifiedReminders(save: UniGameSaveData, now: Date = new Date()): ReminderRecord[] {
  const nowKey = getMelbourneDateTimeKey(now);
  return save.reminders.filter((reminder) => {
    if (reminder.status !== "pending" || reminder.notifiedAt !== null) return false;
    const effective = reminder.snoozedUntil && reminder.snoozedUntil > reminder.fireAt ? reminder.snoozedUntil : reminder.fireAt;
    return effective <= nowKey;
  });
}

/* ------------------------------------------------------------------ */
/* Standing warnings (derived live, not stored)                         */
/* ------------------------------------------------------------------ */

export interface ConfirmationWarning {
  id: string;
  subjectName: string;
  message: string;
}

/** Unresolved NEEDS_CONFIRMATION items — resolved by confirming the field, not dismissable. */
export function getConfirmationWarnings(save: UniGameSaveData): ConfirmationWarning[] {
  const warnings: ConfirmationWarning[] = [];
  for (const subject of save.semester.subjects) {
    if (subject.code.status !== "confirmed") {
      warnings.push({
        id: `warn-code-${subject.id}`,
        subjectName: subject.name,
        message: `${subject.name}: subject code needs confirmation`,
      });
    }
    for (const assessment of subject.assessments) {
      if (assessment.confirmationStatus !== "confirmed") {
        warnings.push({
          id: `warn-assessment-${assessment.id}`,
          subjectName: subject.name,
          message: `${assessment.title} (${subject.name}) has unconfirmed details — reminders stay inactive until the deadline is confirmed`,
        });
      }
    }
  }
  return warnings;
}

export interface OverdueAssessment {
  subjectName: string;
  assessmentId: string;
  title: string;
  dueKey: string;
  sourceWindow: string;
}

/** Confirmed deadlines already past where the work isn't submitted/graded. */
export function getOverdueAssessments(save: UniGameSaveData, now: Date = new Date()): OverdueAssessment[] {
  const nowKey = getMelbourneDateTimeKey(now);
  const progressById = new Map(save.assessmentProgress.map((p) => [p.assessmentId, p]));
  const result: OverdueAssessment[] = [];
  for (const deadline of confirmedDeadlines(save.semester.subjects)) {
    if (deadline.dueKey >= nowKey) continue;
    const progress = progressById.get(deadline.assessmentId);
    if (progress && (progress.status === "submitted" || progress.status === "graded")) continue;
    result.push({
      subjectName: deadline.subject.name,
      assessmentId: deadline.assessmentId,
      title: deadline.title,
      dueKey: deadline.dueKey,
      sourceWindow: deadline.sourceWindow,
    });
  }
  return result;
}

/** Next pending reminder for one assessment — used by the in-room assessment desk. */
export function getNextReminderForAssessment(
  save: UniGameSaveData,
  assessmentId: string,
  now: Date = new Date()
): ReminderView | null {
  const nowKey = getMelbourneDateTimeKey(now);
  const candidates = save.reminders
    .filter((r) => r.assessmentId === assessmentId && r.status === "pending")
    .map((r) => getReminderView(r, now))
    .filter((view) => view.effectiveFireAt >= nowKey)
    .sort((a, b) => (a.effectiveFireAt < b.effectiveFireAt ? -1 : 1));
  return candidates[0] ?? null;
}
