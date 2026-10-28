/**
 * Browser Notification API wrapper.
 *
 * Rules (planning/FEATURE_PLAN.md §6 + this phase's brief):
 * - permission is requested only from an explicit user action in Settings;
 * - after a denial the app never re-prompts (the browser wouldn't show the
 *   prompt anyway) — Settings explains how to re-enable it manually;
 * - notifications are best-effort UI sugar: the in-app notification centre
 *   is the source of truth and works when this API is unavailable;
 * - notifications cannot fire while the app/browser is fully closed — that
 *   limitation is stated in Settings, not hidden.
 */

import { getMelbourneDateTimeKey } from "./selectors";
import type { AppSettings } from "../types/domain";

export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserPermission(): NotificationPermission | "unsupported" {
  return browserNotificationsSupported() ? Notification.permission : "unsupported";
}

/**
 * Requests permission — call ONLY from a direct user action. Returns the
 * resulting permission so the caller can persist it into settings.
 */
export async function requestBrowserPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!browserNotificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** True while the Melbourne wall clock is inside the user's quiet hours. */
export function isInQuietHours(settings: AppSettings, now: Date = new Date()): boolean {
  const { quietHours } = settings;
  if (!quietHours.enabled) return false;
  const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
  const { startHour, endHour } = quietHours;
  if (startHour === endHour) return true; // all-day quiet
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour; // wraps midnight
}

/**
 * Shows a browser notification if (and only if) the user opted in, the
 * browser granted permission, and quiet hours don't apply. Sound is NOT
 * played here — audio remains solely under the existing sound setting via
 * the sound-event bus.
 */
export function showBrowserNotification(
  settings: AppSettings,
  title: string,
  body: string,
  now: Date = new Date()
): boolean {
  if (!settings.browserNotificationsEnabled) return false;
  if (!browserNotificationsSupported() || Notification.permission !== "granted") return false;
  if (isInQuietHours(settings, now)) return false;
  try {
    new Notification(title, { body, silent: true });
    return true;
  } catch {
    return false;
  }
}
