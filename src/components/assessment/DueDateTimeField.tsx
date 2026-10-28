import { useId, useState } from "react";
import { Badge } from "../ui/Badge";
import { useSaveData } from "../../state/SaveDataContext";
import type { AssessmentRecord } from "../../types/domain";

interface DueDateTimeFieldProps {
  assessment: AssessmentRecord;
}

/**
 * Due date and due time are confirmed together (one deadline, two fields),
 * so this is a specialised editor rather than two independent
 * ConfirmableFields — one "Save" action confirms both at once.
 */
export function DueDateTimeField({ assessment }: DueDateTimeFieldProps) {
  const { confirmAssessmentDueDate, confirmAssessmentDueTime } = useSaveData();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(assessment.dueDate.value ?? "");
  const [time, setTime] = useState(assessment.dueTime.value ?? "");
  const dateId = useId();
  const timeId = useId();

  const bothConfirmed = assessment.dueDate.status === "confirmed" && assessment.dueTime.status === "confirmed";

  function handleSave() {
    if (date) confirmAssessmentDueDate(assessment.id, date);
    if (time) confirmAssessmentDueTime(assessment.id, time);
    setEditing(false);
  }

  return (
    <div className="confirmable-field">
      <div className="confirmable-field-status">
        {bothConfirmed ? (
          <Badge tone="confirmed">Due date &amp; time confirmed</Badge>
        ) : (
          <Badge tone="warning">Due date/time: NEEDS_CONFIRMATION</Badge>
        )}
        <button type="button" onClick={() => setEditing((prev) => !prev)}>
          {editing ? "Cancel" : bothConfirmed ? "Edit" : "Enter confirmed date/time"}
        </button>
      </div>
      <p className="screen-lede">{assessment.dueWindowRaw}</p>

      {editing ? (
        <div className="confirmable-field-editor">
          <label htmlFor={dateId}>Date</label>
          <input id={dateId} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <label htmlFor={timeId}>Time (24h)</label>
          <input id={timeId} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          <button type="button" onClick={handleSave}>
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}
