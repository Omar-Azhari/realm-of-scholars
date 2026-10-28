import { useId, useState } from "react";
import { Badge } from "./Badge";

interface ConfirmableFieldProps {
  label: string;
  status: "confirmed" | "needs_confirmation";
  /** Human-readable current value, already formatted for display. */
  displayValue: string;
  editorType: "text" | "number" | "date";
  /** Called with the raw input string; the caller parses/validates as needed. */
  onConfirm: (rawValue: string) => void;
}

/**
 * Generic inline editor for any ConfirmableValue<T> in the data model
 * (subject code, assessment weight/AI policy/extension eligibility, etc.).
 * NEEDS_CONFIRMATION values are always visibly badged; editing is available
 * in both states so a confirmed value can be corrected later too.
 */
export function ConfirmableField({ label, status, displayValue, editorType, onConfirm }: ConfirmableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(status === "confirmed" ? displayValue : "");
  const inputId = useId();

  function handleConfirm() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setEditing(false);
  }

  return (
    <div className="confirmable-field">
      <div className="confirmable-field-status">
        {status === "confirmed" ? (
          <Badge tone="confirmed">
            {label}: {displayValue}
          </Badge>
        ) : (
          <Badge tone="warning">{label}: NEEDS_CONFIRMATION</Badge>
        )}
        <button type="button" onClick={() => setEditing((prev) => !prev)}>
          {editing ? "Cancel" : status === "confirmed" ? "Edit" : "Enter confirmed value"}
        </button>
      </div>

      {editing ? (
        <div className="confirmable-field-editor">
          <label htmlFor={inputId}>{label}</label>
          <input
            id={inputId}
            type={editorType}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" onClick={handleConfirm}>
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}
