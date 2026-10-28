import { useEffect, useState } from "react";
import { getMelbourneDateTimeKey } from "../lib/selectors";
import type { DayPhase } from "./manifestTypes";

/**
 * Melbourne wall-clock day phase — the same timezone every deadline in the
 * app already uses. Buckets: day 07:00–16:59, evening 17:00–20:59, night
 * 21:00–06:59.
 */
export function getMelbourneDayPhase(now: Date = new Date()): DayPhase {
  const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Debug/testing override: ?phase=day|evening|night on the URL. */
function readPhaseOverride(): DayPhase | null {
  const value = new URLSearchParams(window.location.search).get("phase");
  return value === "day" || value === "evening" || value === "night" ? value : null;
}

/** Current day phase, re-evaluated once a minute so the scene follows the clock. */
export function useDayPhase(): DayPhase {
  const [phase, setPhase] = useState<DayPhase>(() => readPhaseOverride() ?? getMelbourneDayPhase());

  useEffect(() => {
    const override = readPhaseOverride();
    if (override) return;
    const interval = window.setInterval(() => setPhase(getMelbourneDayPhase()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return phase;
}
