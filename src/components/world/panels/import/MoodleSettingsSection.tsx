/**
 * Moodle connection management (Phase 18F, Part 20). Lives in Settings —
 * separate from the Semester Setup import wizard — mirroring
 * CanvasSettingsSection.tsx exactly: Refresh/Disconnect/"Remove imported
 * Moodle data" are all things a user does AFTER an import, independent of
 * running the wizard again. Disconnecting never removes already-imported
 * academic data; removing imported data is a distinct, separately-confirmed
 * destructive action with its own preview.
 */

import { useEffect, useState } from "react";
import { GraduationCap, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Unplug } from "lucide-react";
import { useSaveData } from "../../../../state/SaveDataContext";
import { MOODLE_INSTITUTION_PUBLIC_LIST } from "../../../../import/moodleInstitutionPublicList";
import { fetchMoodleStatus, disconnectMoodle, refreshMoodleConnection, type MoodleStatusResponse } from "../../../../import/moodleBackendClient";
import { previewMoodleDataRemoval, removeMoodleImportedData } from "../../../../import/moodleSync";
import { backupCurrentSave, markImportBackupKind } from "../../../../lib/persistence";

interface ConnectionRow {
  institutionId: string;
  displayName: string;
  status: MoodleStatusResponse;
}

export function MoodleSettingsSection() {
  const { saveData, setSaveData } = useSaveData();
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(MOODLE_INSTITUTION_PUBLIC_LIST.map(async (inst) => ({ inst, status: await fetchMoodleStatus(inst.institutionId) }))).then((results) => {
      if (cancelled) return;
      const rows = results
        .filter((r): r is { inst: (typeof MOODLE_INSTITUTION_PUBLIC_LIST)[number]; status: MoodleStatusResponse } => r.status !== null && (r.status.connected || r.status?.reauthorisationRequired === true))
        .map((r) => ({ institutionId: r.inst.institutionId, displayName: r.inst.displayName, status: r.status }));
      setConnections(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh(institutionId: string) {
    setBusyId(institutionId);
    const ok = await refreshMoodleConnection(institutionId);
    setMessage(ok ? "Moodle connection refreshed." : "Couldn't refresh the Moodle connection right now.");
    setBusyId(null);
  }

  async function handleDisconnect(institutionId: string, displayName: string) {
    const confirmed = window.confirm(`Disconnect the Moodle connection for ${displayName}? Your already-imported academic data stays exactly as it is — only the connection itself is removed.`);
    if (!confirmed) return;
    setBusyId(institutionId);
    const result = await disconnectMoodle(institutionId);
    setMessage(
      result.ok
        ? result.remoteRevocationSucceeded
          ? "Disconnected — the Moodle token was revoked."
          : result.remoteRevocationError ?? "Disconnected locally. The connection credentials were removed from this app."
        : "Couldn't disconnect right now — try again shortly."
    );
    setConnections((prev) => prev?.filter((c) => c.institutionId !== institutionId) ?? null);
    setBusyId(null);
  }

  function handleRemoveImportedData() {
    const preview = previewMoodleDataRemoval(saveData.semester);
    if (preview.length === 0) {
      setMessage("No Moodle-imported academic data was found to remove.");
      return;
    }
    const lines = preview.map((p) => `${p.subjectName}: ${p.assessmentTitles.length} assessment(s), ${p.moduleTitles.length} module(s)`);
    const confirmed = window.confirm(`Remove all Moodle-imported academic data? This cannot be undone from here (export a backup first if unsure).\n\n${lines.join("\n")}`);
    if (!confirmed) return;
    backupCurrentSave(saveData);
    markImportBackupKind("semester-import");
    setSaveData((prev) => ({ ...prev, semester: removeMoodleImportedData(prev.semester) }));
    setMessage("Moodle-imported academic data removed. Your previous save was backed up automatically.");
  }

  return (
    <div className="panel settings-panel">
      <h2 className="dashboard-card-title">
        <GraduationCap size={17} aria-hidden="true" /> La Trobe LMS (Moodle)
      </h2>
      <p className="screen-lede">Manage any Moodle connections made during Semester Setup. Read-only — UniGame never writes back to Moodle.</p>

      {connections === null ? <p className="screen-lede">Checking Moodle connections…</p> : null}
      {connections !== null && connections.length === 0 ? (
        <p className="screen-lede">No Moodle connections yet — connect one from Semester Setup → Import sources → Connect La Trobe LMS.</p>
      ) : null}

      {connections?.map((row) => (
        <div key={row.institutionId} className="settings-toggle-row">
          {row.status.reauthorisationRequired ? <ShieldAlert size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
          <span>
            {row.displayName}
            {row.status.reauthorisationRequired ? " — needs reconfiguration" : row.status.lastSuccessfulSyncAt ? ` — last synced ${new Date(row.status.lastSuccessfulSyncAt).toLocaleString()}` : ""}
          </span>
          <button type="button" onClick={() => void handleRefresh(row.institutionId)} disabled={busyId === row.institutionId}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          <button type="button" onClick={() => void handleDisconnect(row.institutionId, row.displayName)} disabled={busyId === row.institutionId}>
            <Unplug size={14} aria-hidden="true" /> Disconnect
          </button>
        </div>
      ))}

      <button type="button" onClick={handleRemoveImportedData}>
        <Trash2 size={16} aria-hidden="true" /> Remove imported Moodle data
      </button>

      {message ? <p className="screen-lede">{message}</p> : null}
    </div>
  );
}
