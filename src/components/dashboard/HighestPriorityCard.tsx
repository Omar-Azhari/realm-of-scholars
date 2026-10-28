import { Link } from "react-router-dom";
import { AlertTriangle, Compass } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";
import { PriorityBadge } from "../ui/PriorityBadge";
import { getTopPriorityItems } from "../../lib/priority";
import type { SubjectRecord, TaskRecord } from "../../types/domain";

interface HighestPriorityCardProps {
  subjects: SubjectRecord[];
  tasks: TaskRecord[];
  limit?: number;
}

export function HighestPriorityCard({ subjects, tasks, limit = 5 }: HighestPriorityCardProps) {
  const items = getTopPriorityItems(subjects, tasks, new Date(), limit);

  // Before anything is completed, "High priority" chips on every intro
  // module read as "you're already behind" (FIRST_TIME_UX_REPORT.md F2).
  // Same list, friendlier frame — the chips return with the first completion.
  const freshSave = tasks.every((task) => !task.completed);

  return (
    <DashboardCardShell
      title={freshSave ? "Suggested First Steps" : "Highest Priority"}
      icon={freshSave ? Compass : AlertTriangle}
    >
      {freshSave && items.length > 0 ? (
        <p className="screen-lede">New semester — start anywhere. These are good first picks:</p>
      ) : null}
      {items.length === 0 ? (
        <p className="screen-lede">Nothing outstanding — everything is complete.</p>
      ) : (
        <ul className="dashboard-list">
          {items.map((item) => {
            const key = item.type === "module" ? item.module.id : item.assessment.id;
            const title = item.type === "module" ? item.module.title : item.assessment.title;
            return (
              <li key={key}>
                <Link to={`/subjects/${item.subject.id}`}>{title}</Link>
                {freshSave ? null : <PriorityBadge level={item.priority.level} />}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCardShell>
  );
}
