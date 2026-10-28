/**
 * Step 5 — Apply (Phase 18A, Part 9). Shows exactly what will change before
 * anything is written, then commits through the one transactional entry
 * point (`applySemesterImportPackage`) which backs up the save first and
 * rolls back automatically on any failure — this component never mutates
 * the save directly.
 */

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSaveData } from "../../../../state/SaveDataContext";
import { buildApplyDiff, validateForApply, type ImportSelection } from "../../../../import/applyImport";
import type { AcademicImportPackage } from "../../../../import/types";

export function ApplyStep({
  pkg,
  selection,
  onBack,
  onApplied,
}: {
  pkg: AcademicImportPackage;
  selection: ImportSelection;
  onBack: () => void;
  onApplied: () => void;
}) {
  const { saveData, applySemesterImportPackage } = useSaveData();
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const validation = useMemo(() => validateForApply(pkg, selection, saveData.semester.subjects), [pkg, selection, saveData.semester.subjects]);
  const diff = useMemo(() => buildApplyDiff(pkg, selection, saveData), [pkg, selection, saveData]);

  function handleApply() {
    setApplying(true);
    setError(null);
    const result = applySemesterImportPackage(pkg, selection);
    setApplying(false);
    if (result.ok) {
      onApplied();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="setup-step" data-testid="apply-step">
      <p className="setup-lede">
        Here's exactly what will change. Your current save is backed up first — you can undo this
        import afterwards from Menu if anything looks wrong.
      </p>

      <div className="setup-diff-summary" data-testid="apply-diff">
        <span className="setup-diff-added">{diff.addedCount} added</span>
        <span className="setup-diff-updated">{diff.updatedCount} updated</span>
        <span className="setup-diff-skipped">{diff.skippedCount} unchanged</span>
      </div>

      {diff.entries.length > 0 ? (
        <ul className="setup-diff-list">
          {diff.entries.map((entry, i) => (
            <li key={`${entry.kind}-${entry.label}-${i}`} className={`setup-diff-entry setup-diff-entry--${entry.action}`}>
              <span className="setup-diff-kind">{entry.kind}</span>
              <span>{entry.label}</span>
              <span className="setup-diff-action">{entry.action}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="setup-hint">Nothing to apply — go back and include at least one item.</p>
      )}

      {!validation.ok ? (
        <ul className="setup-validation-issues">
          {validation.issues.map((issue) => (
            <li key={issue}>
              <AlertTriangle size={13} aria-hidden="true" /> {issue}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="setup-error" role="alert">
          {error} Your save was not changed — you can try again or go back to Review.
        </p>
      ) : null}

      <div className="setup-actions">
        <button
          type="button"
          className="button--primary"
          onClick={handleApply}
          disabled={!validation.ok || applying || diff.entries.length === 0}
          data-testid="confirm-apply"
        >
          <CheckCircle2 size={15} aria-hidden="true" /> {applying ? "Applying…" : "Apply approved data"}
        </button>
        <button type="button" onClick={onBack} disabled={applying}>
          Back to Review
        </button>
      </div>
    </div>
  );
}
