import { Lock, Trophy } from "lucide-react";
import type { AchievementStatus } from "../../lib/achievements";

interface AchievementBadgeProps {
  status: AchievementStatus;
}

export function AchievementBadge({ status }: AchievementBadgeProps) {
  const { definition, unlocked } = status;
  return (
    <div
      className={`achievement-badge${unlocked ? " achievement-badge--unlocked" : ""}`}
      title={definition.description}
    >
      <span className="achievement-badge-icon" aria-hidden="true">
        {unlocked ? <Trophy size={22} /> : <Lock size={22} />}
      </span>
      <span className="achievement-badge-title">{definition.title}</span>
      <span className="achievement-badge-status">{unlocked ? "Unlocked" : "Locked"}</span>
    </div>
  );
}
