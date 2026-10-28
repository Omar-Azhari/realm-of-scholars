import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";
import { ProgressBar } from "../ui/ProgressBar";
import { getSubjectCompletedModuleCount } from "../../lib/selectors";
import { getSubjectAccentVar } from "../../lib/subjectTheme";
import type { SubjectRecord, TaskRecord } from "../../types/domain";

interface ProgressBySubjectCardProps {
  subjects: SubjectRecord[];
  tasks: TaskRecord[];
}

export function ProgressBySubjectCard({ subjects, tasks }: ProgressBySubjectCardProps) {
  return (
    <DashboardCardShell title="Progress by Subject" icon={Layers}>
      <ul className="dashboard-list dashboard-list--progress">
        {subjects.map((subject) => {
          const accentVar = getSubjectAccentVar(subject.id);
          const completed = getSubjectCompletedModuleCount(tasks, subject);
          return (
            <li key={subject.id} style={{ "--subject-accent": `var(${accentVar})` } as CSSProperties}>
              <Link to={`/subjects/${subject.id}`}>{subject.name}</Link>
              <ProgressBar value={completed} max={subject.modules.length} label="Modules" accentVar={accentVar} />
            </li>
          );
        })}
      </ul>
    </DashboardCardShell>
  );
}
