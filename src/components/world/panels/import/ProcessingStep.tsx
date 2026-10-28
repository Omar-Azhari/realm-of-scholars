/**
 * Step 3 — Processing (Phase 18A, Part 7). File-by-file status, overall
 * progress, and a Cancel button that actually aborts in-flight extraction
 * (via the AbortController the overlay owns).
 */

import { Loader2 } from "lucide-react";
import type { ImportProgressEvent } from "../../../../import/types";
import type { StagedFile } from "./SourcesStep";

export function ProcessingStep({
  files,
  progress,
  onCancel,
}: {
  files: StagedFile[];
  progress: Record<string, ImportProgressEvent>;
  onCancel: () => void;
}) {
  const overall = files.length > 0 ? files.reduce((sum, f) => sum + (progress[f.sourceId]?.fraction ?? 0), 0) / files.length : 0;

  return (
    <div className="setup-step" data-testid="processing-step">
      <p className="setup-lede">Reading your files…</p>

      <div className="setup-progress-bar" role="progressbar" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.round(overall * 100)}%` }} />
      </div>

      <ul className="setup-file-list">
        {files.map((f) => {
          const event = progress[f.sourceId];
          const fraction = event?.fraction ?? 0;
          return (
            <li key={f.sourceId} className="setup-file-row">
              {fraction < 1 ? <Loader2 size={14} className="setup-spin" aria-hidden="true" /> : <span aria-hidden="true">✓</span>}
              <span className="setup-file-name">{f.filename}</span>
              <span className="setup-file-message">{event?.message ?? "Waiting…"}</span>
            </li>
          );
        })}
      </ul>

      <div className="setup-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
