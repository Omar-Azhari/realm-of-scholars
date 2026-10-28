import { useRef, useState } from "react";
import {
  AlarmClock,
  BellRing,
  Boxes,
  Download,
  Moon,
  RotateCcw,
  Settings as SettingsIcon,
  Upload,
  Volume2,
  Waves,
} from "lucide-react";
import { useSaveData } from "../state/SaveDataContext";
import { getBrowserPermission, requestBrowserPermission } from "../lib/browserNotifications";
import { DEFAULT_REMINDER_OFFSETS, type SoundMixerSettings } from "../types/domain";
import { CanvasSettingsSection } from "../components/world/panels/import/CanvasSettingsSection";
import { MoodleSettingsSection } from "../components/world/panels/import/MoodleSettingsSection";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Phase 20F Part 10 — one row per mixer category; order matches the brief's own list (ambience/footsteps/interactions/UI/NPC activity/music). */
const SOUND_VOLUME_ROWS: Array<{ key: keyof SoundMixerSettings; label: string }> = [
  { key: "ambience" as const, label: "Ambience" },
  { key: "footsteps" as const, label: "Footsteps" },
  { key: "interaction" as const, label: "Interactions" },
  { key: "ui" as const, label: "UI Sounds" },
  { key: "npc" as const, label: "NPC Activity" },
  { key: "music" as const, label: "Music" },
];

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? "am" : "pm"}`;
}

export function SettingsScreen() {
  const { saveData, setSaveData, updateSettings, exportSaveData, importSaveData, resetSaveData } = useSaveData();
  const { settings } = saveData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  const permission = getBrowserPermission();

  function handleReducedMotionChange(event: React.ChangeEvent<HTMLInputElement>) {
    const reducedMotion = event.target.checked;
    setSaveData((prev) => ({
      ...prev,
      settings: { ...prev.settings, reducedMotion },
    }));
  }

  async function handleEnableBrowserNotifications(checked: boolean) {
    if (!checked) {
      updateSettings({ browserNotificationsEnabled: false });
      return;
    }
    // Permission is requested here — a direct user action — and never again
    // once the browser has answered (a denial can only be undone in the
    // browser's own site settings).
    let current = getBrowserPermission();
    if (current === "default") {
      current = await requestBrowserPermission();
    }
    updateSettings({
      browserNotificationsEnabled: current === "granted",
      notificationPermission: current === "unsupported" ? "default" : current,
    });
    setPermissionMessage(
      current === "granted"
        ? "Browser notifications enabled."
        : current === "denied"
          ? "The browser has blocked notifications for this site. To use them, allow notifications in your browser's site settings, then try again."
          : "This browser does not support notifications — the in-app notification centre still covers everything."
    );
  }

  function toggleOffset(isoDuration: string, enabled: boolean) {
    updateSettings({
      reminderOffsets: settings.reminderOffsets.map((offset) =>
        offset.isoDuration === isoDuration ? { ...offset, enabled } : offset
      ),
    });
  }

  function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = importSaveData(text);
      setImportMessage(
        result.ok
          ? "Save data imported successfully. Your previous save was backed up automatically."
          : `Import failed: ${result.error}`
      );
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleReset() {
    const confirmed = window.confirm(
      "Reset all UniGame data on this device? This clears tasks, reminders, study logs, XP, and any confirmed " +
        "syllabus edits, and cannot be undone. Export a backup first if you want to keep a copy."
    );
    if (confirmed) {
      resetSaveData();
      setImportMessage("App data has been reset to defaults.");
    }
  }

  return (
    <section className="screen">
      <h1 className="screen-title">
        <SettingsIcon size={26} aria-hidden="true" className="screen-title-icon" /> Settings
      </h1>
      <p className="screen-lede">
        Notifications, reminders, quiet hours, motion, sound, and data controls. All times are
        Australia/Melbourne.
      </p>

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">
          <BellRing size={17} aria-hidden="true" /> Browser notifications
        </h2>
        <p className="screen-lede">
          Optional pop-up notifications when a reminder fires. They can only appear while this app
          is open in a browser tab — nothing fires when the browser is fully closed. The in-app
          notification centre always works regardless.
        </p>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={settings.browserNotificationsEnabled && permission === "granted"}
            disabled={permission === "denied" || permission === "unsupported"}
            onChange={(e) => void handleEnableBrowserNotifications(e.target.checked)}
          />
          Enable browser notifications
        </label>
        <p className="screen-lede">
          Status:{" "}
          {permission === "unsupported"
            ? "not supported by this browser"
            : permission === "denied"
              ? "blocked in the browser — re-enable it in your browser's site settings"
              : permission === "granted"
                ? settings.browserNotificationsEnabled
                  ? "enabled"
                  : "permitted, but switched off here"
                : "not yet requested"}
        </p>
        {permissionMessage ? <p className="screen-lede">{permissionMessage}</p> : null}
      </div>

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">
          <AlarmClock size={17} aria-hidden="true" /> Reminder defaults
        </h2>
        <p className="screen-lede">
          Deadline reminders are generated only for assessments with a confirmed due date and time.
          Choose which offsets to schedule:
        </p>
        {DEFAULT_REMINDER_OFFSETS.map((offset) => {
          const setting = settings.reminderOffsets.find((entry) => entry.isoDuration === offset.isoDuration);
          return (
            <label key={offset.isoDuration} className="settings-toggle-row">
              <input
                type="checkbox"
                checked={setting?.enabled ?? true}
                onChange={(e) => toggleOffset(offset.isoDuration, e.target.checked)}
              />
              {offset.label}
            </label>
          );
        })}
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={settings.weeklyPlanningReminder}
            onChange={(e) => updateSettings({ weeklyPlanningReminder: e.target.checked })}
          />
          Weekly planning reminder (Mondays, 9:00 am)
        </label>
      </div>

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">
          <Moon size={17} aria-hidden="true" /> Quiet hours
        </h2>
        <p className="screen-lede">
          Browser notifications are held back during quiet hours (Melbourne time). In-app
          reminders still update normally.
        </p>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={settings.quietHours.enabled}
            onChange={(e) => updateSettings({ quietHours: { ...settings.quietHours, enabled: e.target.checked } })}
          />
          Enable quiet hours
        </label>
        <div className="settings-quiet-hours">
          <label>
            From
            <select
              value={settings.quietHours.startHour}
              disabled={!settings.quietHours.enabled}
              onChange={(e) =>
                updateSettings({ quietHours: { ...settings.quietHours, startHour: Number(e.target.value) } })
              }
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Until
            <select
              value={settings.quietHours.endHour}
              disabled={!settings.quietHours.enabled}
              onChange={(e) =>
                updateSettings({ quietHours: { ...settings.quietHours, endHour: Number(e.target.value) } })
              }
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">
          <Waves size={17} aria-hidden="true" /> Motion
        </h2>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={handleReducedMotionChange}
          />
          Reduce motion (disables particle/hover/entrance animation app-wide)
        </label>
      </div>

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">
          <Boxes size={17} aria-hidden="true" /> Campus World
        </h2>
        <p className="screen-lede">
          Walk your campus in 3D — Campus HQ, Library, Computer Lab, Lecture Theatre, Student
          Lounge, and Administration. Your save, subjects, and progress are identical either way —
          switch back any time with no data loss.
        </p>
        <label className="settings-select-row">
          <span>World renderer</span>
          <select
            value={settings.worldRenderer}
            onChange={(e) => updateSettings({ worldRenderer: e.target.value as typeof settings.worldRenderer })}
          >
            <option value="legacy-2d">2D Campus (default)</option>
            <option value="experimental-3d">3D Campus (experimental)</option>
            {/* V2 Phase 1 "Prestige Vertical Slice" (additive) — a preview of 4 districts (Main Gate, Grand Courtyard, Great Hall, Hall of Artisans); every other district is a "Coming Soon" gate. */}
            <option value="prestige-v2">Prestige Campus (V2 preview — 4 districts)</option>
          </select>
        </label>
        <label className="settings-select-row">
          <span>Graphics quality</span>
          <select
            value={settings.graphicsQuality}
            onChange={(e) => updateSettings({ graphicsQuality: e.target.value as typeof settings.graphicsQuality })}
          >
            <option value="auto">Auto (recommended)</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <button
          type="button"
          className="settings-inline-action"
          onClick={() => updateSettings({ campus3DGuidanceDismissed: false })}
          disabled={!settings.campus3DGuidanceDismissed}
        >
          <RotateCcw size={14} aria-hidden="true" /> Show first-session guidance again
        </button>
      </div>

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">
          <Volume2 size={17} aria-hidden="true" /> Sound
        </h2>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
          />
          Enable sound effects (off by default; plays audio files from assets/audio once they exist)
        </label>
        <div className="settings-sound-mixer">
          {SOUND_VOLUME_ROWS.map(({ key, label }) => (
            <label key={key} className="settings-volume-row">
              <span className="settings-volume-label">{label}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.soundVolumes[key] * 100)}
                disabled={!settings.soundEnabled}
                onChange={(e) =>
                  updateSettings({
                    soundVolumes: { ...settings.soundVolumes, [key]: Number(e.target.value) / 100 },
                  })
                }
                aria-label={`${label} volume`}
              />
              <span className="settings-volume-value">{Math.round(settings.soundVolumes[key] * 100)}%</span>
            </label>
          ))}
        </div>
      </div>

      <CanvasSettingsSection />
      <MoodleSettingsSection />

      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">Data</h2>

        <button type="button" onClick={exportSaveData}>
          <Download size={16} aria-hidden="true" /> Export save data (.json)
        </button>

        <div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" /> Import save data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFileChange}
            style={{ display: "none" }}
          />
        </div>

        <button type="button" onClick={handleReset}>
          <RotateCcw size={16} aria-hidden="true" /> Reset app data
        </button>

        {importMessage ? <p className="screen-lede">{importMessage}</p> : null}
      </div>

      {/* RC1: build identity so playtest feedback can name an exact build. */}
      <div className="panel settings-panel">
        <h2 className="dashboard-card-title">About</h2>
        <p className="screen-lede" data-testid="about-version">
          UniGame v{__APP_VERSION__} · build {__COMMIT_HASH__} ·{" "}
          {new Date(__BUILD_TIME__).toLocaleString()}
        </p>
        <p className="screen-lede">
          All artwork is placeholder pending final art; audio is not yet included. Your data stays
          in this browser — use Export above for backups.
        </p>
      </div>
    </section>
  );
}
