/**
 * Cinematic fly-overs: the camera sweeps around the island and settles on
 * the player while narrator lines play (first arrival, first landing on an
 * island). Any key or the Skip button ends it.
 */

export interface Cinematic {
  /** performance.now() / 1000 when it started. */
  start: number;
  duration: number;
  lines: string[];
}

export const cinematic: { current: Cinematic | null; version: number } = { current: null, version: 0 };

export function startCinematic(lines: string[], duration = 9): void {
  cinematic.current = { start: performance.now() / 1000, duration, lines };
  cinematic.version++;
}

export function endCinematic(): void {
  if (!cinematic.current) return;
  cinematic.current = null;
  cinematic.version++;
}

/** 0 … 1 through the current fly-over, or null when none is playing. */
export function cinematicProgress(now = performance.now() / 1000): number | null {
  const c = cinematic.current;
  if (!c) return null;
  const t = (now - c.start) / c.duration;
  if (t >= 1) {
    endCinematic();
    return null;
  }
  return Math.max(0, t);
}
