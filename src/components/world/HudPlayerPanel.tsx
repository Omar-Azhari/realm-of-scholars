/**
 * Top-left HUD (Phase 15B) — compact: level + a small XP bar only. The player
 * name is a tooltip, not permanent HUD space. Location moved to the top-centre
 * chip (HudLocation). Values derive from the save.
 */

import { useSaveData } from "../../state/SaveDataContext";
import { XP_PER_LEVEL } from "../../lib/xpRules";

export function HudPlayerPanel() {
  const { saveData } = useSaveData();
  const { userProgress } = saveData;
  const intoLevel = userProgress.xp % XP_PER_LEVEL;

  return (
    <div className="hud-player" data-testid="hud-player" title={`You — Level ${userProgress.level}, ${userProgress.xp} XP total`}>
      <span className="hud-player-lv">Lv {userProgress.level}</span>
      <span
        className="hud-player-xp"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={XP_PER_LEVEL}
        aria-valuenow={intoLevel}
        aria-label="XP to next level"
      >
        <span style={{ width: `${intoLevel}%` }} />
      </span>
    </div>
  );
}
