import { Trophy } from "lucide-react";
import { AchievementBadge } from "./AchievementBadge";
import { getAchievementStatuses } from "../../lib/achievements";
import type { UniGameSaveData } from "../../types/domain";

export function AchievementStrip({ saveData }: { saveData: UniGameSaveData }) {
  const statuses = getAchievementStatuses(saveData);

  return (
    <div className="panel achievement-strip">
      <h3 className="dashboard-card-title">
        <Trophy size={17} aria-hidden="true" />
        Achievements
      </h3>
      <div className="achievement-strip-row">
        {statuses.map((status) => (
          <AchievementBadge key={status.definition.id} status={status} />
        ))}
      </div>
    </div>
  );
}
