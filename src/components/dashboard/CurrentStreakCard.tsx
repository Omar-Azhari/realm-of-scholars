import { Flame } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";

interface CurrentStreakCardProps {
  streakCount: number;
}

export function CurrentStreakCard({ streakCount }: CurrentStreakCardProps) {
  return (
    <DashboardCardShell title="Current Streak" icon={Flame}>
      <strong className="dashboard-stat-value">
        {streakCount} day{streakCount === 1 ? "" : "s"}
      </strong>
      <p className="screen-lede">
        {streakCount > 0
          ? "Complete a module today to keep it going."
          : "Complete a module today to start a streak."}
      </p>
    </DashboardCardShell>
  );
}
