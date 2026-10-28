/**
 * Canvas connect step (Phase 18E, Part 14). Shown after "Connect Canvas" in
 * Import sources. Institution selection is always shown; whether a real
 * Developer Key is actually configured for that institution is checked
 * server-side (`institutionConfigured`) and shown honestly — no fake
 * connection, no fake courses, ever (Part 2: "Unconfigured/demo mode — No
 * fake Canvas connection").
 */

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, GraduationCap } from "lucide-react";
import { CANVAS_INSTITUTION_PUBLIC_LIST } from "../../../../import/canvasInstitutionPublicList";
import { fetchCanvasStatus, type CanvasStatusResponse } from "../../../../import/canvasBackendClient";

export function CanvasConnectStep({
  connectMessage,
  onConnected,
  onBeginConnect,
  onSkip,
  onBack,
}: {
  /** Set only right after returning from a Canvas OAuth redirect that didn't result in a successful connection (denied/expired/error/rate-limited) — shown once, honestly. */
  connectMessage: string | null;
  onConnected: (institutionId: string) => void;
  onBeginConnect: (institutionId: string) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [institutionId, setInstitutionId] = useState("");
  const [status, setStatus] = useState<CanvasStatusResponse | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!institutionId) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    void fetchCanvasStatus(institutionId).then((result) => {
      if (!cancelled) {
        setStatus(result);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  const institution = CANVAS_INSTITUTION_PUBLIC_LIST.find((i) => i.id === institutionId) ?? null;

  return (
    <div className="setup-step" data-testid="canvas-connect-step">
      <p className="setup-lede">
        <GraduationCap size={16} aria-hidden="true" /> Connect Canvas to import your courses, assignments, modules, and
        calendar — read-only, and you can disconnect at any time without losing anything already imported.
      </p>

      {connectMessage ? (
        <p className="setup-error">
          <ShieldAlert size={14} aria-hidden="true" /> {connectMessage}
        </p>
      ) : null}

      <label>
        Your institution
        <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
          <option value="">Choose your institution…</option>
          {CANVAS_INSTITUTION_PUBLIC_LIST.map((i) => (
            <option key={i.id} value={i.id}>
              {i.displayName}
            </option>
          ))}
        </select>
      </label>

      {institution && checking ? <p className="setup-hint">Checking Canvas availability…</p> : null}

      {institution && !checking && status === null ? (
        <p className="setup-hint">
          <ShieldAlert size={13} aria-hidden="true" /> Couldn't reach the Canvas connection service right now. Every
          other import method (subject guides, calendar files, web discovery, manual entry) still works normally.
        </p>
      ) : null}

      {institution && !checking && status && !status.institutionConfigured ? (
        <p className="setup-hint">
          <ShieldAlert size={13} aria-hidden="true" /> Canvas integration for {institution.displayName} hasn't been set
          up yet. Every other import method (subject guides, calendar files, web discovery, manual entry) still works
          normally.
        </p>
      ) : null}

      {institution && !checking && status?.institutionConfigured && status.connected ? (
        <p className="setup-hint">
          <ShieldCheck size={13} aria-hidden="true" /> Already connected to {institution.displayName}
          {status.lastSuccessfulSyncAt ? ` — last synced ${new Date(status.lastSuccessfulSyncAt).toLocaleString()}` : ""}.
        </p>
      ) : null}

      {institution && !checking && status?.institutionConfigured && status.reauthorisationRequired ? (
        <p className="setup-hint">
          <ShieldAlert size={13} aria-hidden="true" /> Your Canvas connection needs to be reauthorised.
        </p>
      ) : null}

      <div className="setup-actions">
        {status?.connected && !status.reauthorisationRequired ? (
          <button type="button" className="button--primary" onClick={() => onConnected(institutionId)}>
            Continue to course selection
          </button>
        ) : (
          <button
            type="button"
            className="button--primary"
            onClick={() => onBeginConnect(institutionId)}
            disabled={!institutionId || checking || !status?.institutionConfigured}
          >
            {status?.reauthorisationRequired ? "Reauthorise Canvas" : "Connect Canvas"}
          </button>
        )}
        <button type="button" onClick={onSkip}>
          Use a different source instead
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
