/**
 * Canvas connection management (Phase 18E, Part 19). Lives in Settings —
 * separate from the Semester Setup import wizard — since Disconnect,
 * Reauthorise, Refresh, and "Remove imported Canvas data" are all things a
 * user does AFTER an import, independent of running the wizard again.
 * Every action here is explicit and separately confirmed; disconnecting
 * never removes already-imported academic data, and removing imported data
 * is a distinct, separately-confirmed destructive action with its own
 * preview (Part 19: "Disconnect... preserve imported academic data by
 * default" / "Removing imported Canvas data must be a separate destructive
 * action with a clear preview").
 */

import { useEffect, useState } from "react";
import { GraduationCap, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Unplug } from "lucide-react";
import { useSaveData } from "../../../../state/SaveDataContext";
import { CANVAS_INSTITUTION_PUBLIC_LIST } from "../../../../import/canvasInstitutionPublicList";
import { fetchCanvasStatus, disconnectCanvas, refreshCanvasConnection, beginCanvasConnect, type CanvasStatusResponse } from "../../../../import/canvasBackendClient";
import { previewCanvasDataRemoval, removeCanvasImportedData } from "../../../../import/canvasSync";
import { backupCurrentSave, markImportBackupKind } from "../../../../lib/persistence";

interface ConnectionRow {
  institutionId: string;
  displayName: string;
  status: CanvasStatusResponse;
}

export function CanvasSettingsSection() {
  const { saveData, setSaveData } = useSaveData();
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(CANVAS_INSTITUTION_PUBLIC_LIST.map(async (inst) => ({ inst, status: await fetchCanvasStatus(inst.id) }))).then((results) => {
      if (cancelled) return;
      const rows = results
        .filter((r): r is { inst: (typeof CANVAS_INSTITUTION_PUBLIC_LIST)[number]; status: CanvasStatusResponse } => r.status !== null && r.status.connected || r.status?.reauthorisationRequired === true)
        .map((r) => ({ institutionId: r.inst.id, displayName: r.inst.displayName, status: r.status }));
      setConnections(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh(institutionId: string) {
    setBusyId(institutionId);
    const ok = await refreshCanvasConnection(institutionId);
    setMessage(ok ? "Canvas connection refreshed." : "Couldn't refresh the Canvas connection right now.");
    setBusyId(null);
  }

  async function handleDisconnect(institutionId: string, displayName: string) {
    const confirmed = window.confirm(`Disconnect Canvas for ${displayName}? Your already-imported academic data stays exactly as it is — only the connection itself is removed.`);
    if (!confirmed) return;
    setBusyId(institutionId);
    const result = await disconnectCanvas(institutionId);
    setMessage(
      result.ok
        ? result.remoteRevocationSucceeded
          ? "Disconnected — Canvas confirmed the access token was revoked."
          : "Disconnected locally. Canvas couldn't confirm the remote token revocation, but your credentials were removed from this app either way."
        : "Couldn't disconnect right now — try again shortly."
    );
    setConnections((prev) => prev?.filter((c) => c.institutionId !== institutionId) ?? null);
    setBusyId(null);
  }

  function handleRemoveImportedData() {
    const preview = previewCanvasDataRemoval(saveData.semester);
    if (preview.length === 0) {
      setMessage("No Canvas-imported academic data was found to remove.");
      return;
    }
    const lines = preview.map((p) => `${p.subjectName}: ${p.assessmentTitles.length} assessment(s), ${p.moduleTitles.length} module(s)`);
    const confirmed = window.confirm(`Remove all Canvas-imported academic data? This cannot be undone from here (export a backup first if unsure).\n\n${lines.join("\n")}`);
    if (!confirmed) return;
    backupCurrentSave(saveData);
    markImportBackupKind("semester-import");
    setSaveData((prev) => ({ ...prev, semester: removeCanvasImportedData(prev.semester) }));
    setMessage("Canvas-imported academic data removed. Your previous save was backed up automatically.");
  }

  return (
    <div className="panel settings-panel">
      <h2 className="dashboard-card-title">
        <GraduationCap size={17} aria-hidden="true" /> Canvas
      </h2>
      <p className="screen-lede">Manage any Canvas connections made during Semester Setup. Read-only — UniGame never writes back to Canvas.</p>

      {connections === null ? <p className="screen-lede">Checking Canvas connections…</p> : null}
      {connections !== null && connections.length === 0 ? (
        <p className="screen-lede">No Canvas connections yet — connect one from Semester Setup → Import sources → Connect Canvas.</p>
      ) : null}

      {connections?.map((row) => (
        <div key={row.institutionId} className="settings-toggle-row">
          {row.status.reauthorisationRequired ? <ShieldAlert size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
          <span>
            {row.displayName}
            {row.status.reauthorisationRequired ? " — needs reauthorisation" : row.status.lastSuccessfulSyncAt ? ` — last synced ${new Date(row.status.lastSuccessfulSyncAt).toLocaleString()}` : ""}
          </span>
          <button type="button" onClick={() => (row.status.reauthorisationRequired ? beginCanvasConnect(row.institutionId) : void handleRefresh(row.institutionId))} disabled={busyId === row.institutionId}>
            <RefreshCw size={14} aria-hidden="true" /> {row.status.reauthorisationRequired ? "Reauthorise" : "Refresh"}
          </button>
          <button type="button" onClick={() => void handleDisconnect(row.institutionId, row.displayName)} disabled={busyId === row.institutionId}>
            <Unplug size={14} aria-hidden="true" /> Disconnect
          </button>
        </div>
      ))}

      <button type="button" onClick={handleRemoveImportedData}>
        <Trash2 size={16} aria-hidden="true" /> Remove imported Canvas data
      </button>

      {message ? <p className="screen-lede">{message}</p> : null}
    </div>
  );
}
