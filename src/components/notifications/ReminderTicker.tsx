import { useEffect } from "react";
import { useSaveData } from "../../state/SaveDataContext";
import { getDueUnnotifiedReminders, formatMelbourneKey } from "../../lib/reminders";
import { showBrowserNotification } from "../../lib/browserNotifications";
import { emitSound } from "../../lib/sound";

/**
 * Watches the clock (mounted once in AppShell) and surfaces reminders whose
 * fire time has arrived: marks them notified (never repeats), plays the
 * "warning" sound event (audible only if sound is enabled), and shows a
 * browser notification when the user has opted in, permission is granted,
 * and quiet hours don't apply. The in-app centre remains the source of truth
 * either way.
 */
export function ReminderTicker() {
  const { saveData, markRemindersNotified } = useSaveData();

  useEffect(() => {
    const check = () => {
      const due = getDueUnnotifiedReminders(saveData);
      if (due.length === 0) return;
      markRemindersNotified(due.map((reminder) => reminder.id));
      emitSound("warning");
      for (const reminder of due.slice(0, 3)) {
        showBrowserNotification(
          saveData.settings,
          reminder.title,
          reminder.sourceWindow
            ? `Due: ${reminder.sourceWindow}`
            : `Scheduled for ${formatMelbourneKey(reminder.fireAt)}`
        );
      }
    };
    check();
    const interval = window.setInterval(check, 30_000);
    return () => window.clearInterval(interval);
  }, [saveData, markRemindersNotified]);

  return null;
}
