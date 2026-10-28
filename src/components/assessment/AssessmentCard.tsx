import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Badge, type BadgeTone } from "../ui/Badge";
import { ConfirmableField } from "../ui/ConfirmableField";
import { DueDateTimeField } from "./DueDateTimeField";
import { useSaveData } from "../../state/SaveDataContext";
import type { AssessmentRecord, ConfirmationStatus } from "../../types/domain";

const STATUS_TONE: Record<ConfirmationStatus, BadgeTone> = {
  confirmed: "confirmed",
  partially_confirmed: "warning",
  needs_confirmation: "warning",
};

const STATUS_LABEL: Record<ConfirmationStatus, string> = {
  confirmed: "Fully confirmed",
  partially_confirmed: "Partially confirmed",
  needs_confirmation: "Needs confirmation",
};

interface AssessmentCardProps {
  assessment: AssessmentRecord;
}

export function AssessmentCard({ assessment }: AssessmentCardProps) {
  const {
    confirmAssessmentWeight,
    confirmAssessmentAiPolicy,
    confirmAssessmentExtensionEligibility,
  } = useSaveData();

  return (
    <div className="panel assessment-card">
      <div className="assessment-card-header">
        <h3 className="assessment-card-title">
          Assessment {assessment.assessmentNumber}
          {assessment.part ? ` — ${assessment.part}` : `: ${assessment.title}`}
        </h3>
        <Badge tone={STATUS_TONE[assessment.confirmationStatus]}>
          {STATUS_LABEL[assessment.confirmationStatus]}
        </Badge>
      </div>

      <Link to={`/subjects/${assessment.subjectId}/assessments/${assessment.id}`} className="assessment-card-details-link">
        View details <ArrowUpRight size={15} aria-hidden="true" />
      </Link>

      <p>{assessment.description}</p>

      <ConfirmableField
        label="Weight"
        status={assessment.weight.status}
        displayValue={assessment.weight.status === "confirmed" ? `${assessment.weight.value}%` : assessment.weightRaw}
        editorType="number"
        onConfirm={(raw) => {
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) confirmAssessmentWeight(assessment.id, parsed);
        }}
      />

      <DueDateTimeField assessment={assessment} />

      <ConfirmableField
        label="AI policy"
        status={assessment.aiPolicy.status}
        displayValue={assessment.aiPolicy.value ?? ""}
        editorType="text"
        onConfirm={(raw) => confirmAssessmentAiPolicy(assessment.id, raw)}
      />

      <ConfirmableField
        label="Extension eligibility"
        status={assessment.extensionEligibility.status}
        displayValue={assessment.extensionEligibility.value ?? ""}
        editorType="text"
        onConfirm={(raw) => confirmAssessmentExtensionEligibility(assessment.id, raw)}
      />

      <p className="screen-lede assessment-card-notes">{assessment.notes}</p>

      {assessment.reminderSchedule.active ? (
        <p className="screen-lede">Deadline reminders active (28/14/7/3/1 day and 3 hours before).</p>
      ) : (
        <p className="screen-lede">{assessment.reminderSchedule.reason}</p>
      )}
    </div>
  );
}
