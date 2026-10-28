import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";
import { getRecentlyCompletedModules } from "../../lib/selectors";
import type { SubjectRecord, TaskRecord } from "../../types/domain";

interface RecentlyCompletedCardProps {
  subjects: SubjectRecord[];
  tasks: TaskRecord[];
  days?: number;
  limit?: number;
}

export function RecentlyCompletedCard({ subjects, tasks, days = 7, limit = 5 }: RecentlyCompletedCardProps) {
  const recent = getRecentlyCompletedModules(subjects, tasks, days).slice(0, limit);

  return (
    <DashboardCardShell title="Recently Completed" icon={CheckCircle2}>
      {recent.length === 0 ? (
        <p className="screen-lede">No modules completed in the last {days} days yet.</p>
      ) : (
        <ul className="dashboard-list">
          {recent.map(({ subject, module }) => (
            <li key={module.id}>
              <Link to={`/subjects/${subject.id}`}>{module.title}</Link>
              <span className="screen-lede">{subject.name}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCardShell>
  );
}
