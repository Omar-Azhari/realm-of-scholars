/**
 * Notification Centre data — UI only per this phase's scope (no browser
 * notifications yet). Every item is derived live from existing selectors;
 * nothing is persisted, so there's no read/unread state to manage yet
 * either (a deliberate simplification, not an oversight).
 */

import { getUpcomingDeadlines } from "./selectors";
import { getAchievementStatuses } from "./achievements";
import { getReminderViews } from "./reminders";
import { getWeeklyMissions, getWeeklyMissionProgress } from "./missions";
import type { UniGameSaveData } from "../types/domain";

export type NotificationTone = "info" | "success" | "warning";

export interface NotificationItem {
  id: string;
  tone: NotificationTone;
  message: string;
}

export function getNotifications(saveData: UniGameSaveData, now: Date = new Date()): NotificationItem[] {
  const items: NotificationItem[] = [];
  const { semester, tasks } = saveData;

  // Reminders that are due today or overdue come first — the urgent slice
  // of the reminder centre (full management lives on the Reminders screen).
  for (const view of getReminderViews(saveData, now)) {
    if (view.state !== "due-today" && view.state !== "overdue") continue;
    items.push({
      id: `reminder-${view.reminder.id}`,
      tone: "warning",
      message: `${view.state === "overdue" ? "Overdue reminder" : "Due today"}: ${view.reminder.title}`,
    });
  }

  for (const { subject, assessment } of getUpcomingDeadlines(semester.subjects, now).slice(0, 5)) {
    items.push({
      id: `deadline-${assessment.id}`,
      tone: "info",
      message: `${assessment.title} (${subject.name}) — ${assessment.dueWindowRaw}`,
    });
  }

  for (const status of getAchievementStatuses(saveData).filter((status) => status.unlocked)) {
    items.push({
      id: `achievement-${status.definition.id}`,
      tone: "success",
      message: `Achievement unlocked: ${status.definition.title}`,
    });
  }

  // All "needs confirmation" prompts roll into ONE calm setup item (RC1:
  // a fresh save used to boot with four per-subject warnings — overwhelming
  // for a brand-new player; see FIRST_TIME_UX_REPORT.md F1).
  const totalUnconfirmed = semester.subjects.reduce(
    (sum, subject) =>
      sum +
      subject.assessments.filter((assessment) => assessment.confirmationStatus !== "confirmed").length +
      (subject.code.status === "confirmed" ? 0 : 1),
    0
  );
  if (totalUnconfirmed > 0) {
    items.push({
      id: "setup-confirmations",
      tone: "info",
      message: `Semester setup: ${totalUnconfirmed} detail${totalUnconfirmed === 1 ? "" : "s"} (dates, weights, codes) to confirm whenever you have your subject handbook`,
    });
  }

  const missions = getWeeklyMissions(semester.subjects, tasks, now);
  const missionProgress = getWeeklyMissionProgress(missions);
  if (missionProgress.total > 0) {
    items.push({
      id: "weekly-missions",
      tone: "info",
      message: `Weekly missions: ${missionProgress.completed} of ${missionProgress.total} complete`,
    });
  }

  return items;
}

/**
 * The bell badge counts only items that need attention NOW (overdue /
 * due-today reminders) — ambient info (upcoming deadlines, achievements,
 * setup prompts, missions) stays in the panel without inflating the badge.
 * A fresh save therefore starts at zero instead of nine.
 */
export function getNotificationBadgeCount(items: NotificationItem[]): number {
  return items.filter((item) => item.tone === "warning").length;
}
