import { Zap } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";
import { getWeeklyXp } from "../../lib/selectors";
import type { TaskRecord } from "../../types/domain";

interface WeeklyXpCardProps {
  tasks: TaskRecord[];
  days?: number;
}

export function WeeklyXpCard({ tasks, days = 7 }: WeeklyXpCardProps) {
  const xp = getWeeklyXp(tasks, days);

  return (
    <DashboardCardShell title="Weekly XP" icon={Zap}>
      <strong className="dashboard-stat-value">{xp} XP</strong>
      <p className="screen-lede">Earned in the last {days} days from module completions and reviews.</p>
    </DashboardCardShell>
  );
}
