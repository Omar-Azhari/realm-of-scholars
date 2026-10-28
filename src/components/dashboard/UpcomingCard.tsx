import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";
import { getUpcomingDeadlines } from "../../lib/selectors";
import type { SubjectRecord } from "../../types/domain";

interface UpcomingCardProps {
  subjects: SubjectRecord[];
  limit?: number;
}

export function UpcomingCard({ subjects, limit = 4 }: UpcomingCardProps) {
  const deadlines = getUpcomingDeadlines(subjects).slice(0, limit);

  return (
    <DashboardCardShell title="Upcoming" icon={CalendarClock}>
      {deadlines.length === 0 ? (
        <p className="screen-lede">No confirmed upcoming deadlines yet.</p>
      ) : (
        <ul className="dashboard-list">
          {deadlines.map(({ subject, assessment }) => (
            <li key={assessment.id}>
              <Link to={`/subjects/${subject.id}`}>{assessment.title}</Link>
              <span className="screen-lede">{assessment.dueWindowRaw}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCardShell>
  );
}
