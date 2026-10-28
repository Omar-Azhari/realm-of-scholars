import { useEffect, useRef, useState } from "react";

export interface XpGainEvent {
  id: number;
  delta: number;
}

/**
 * Watches an XP total and emits a transient event whenever it changes
 * (positive delta on gain, negative on an undo). The event self-clears after
 * `durationMs` so callers don't need their own dismiss timer.
 */
export function useXpGainEvent(xp: number, durationMs = 1600): XpGainEvent | null {
  const previousXpRef = useRef(xp);
  const nextIdRef = useRef(0);
  const [event, setEvent] = useState<XpGainEvent | null>(null);

  useEffect(() => {
    const previous = previousXpRef.current;
    if (xp !== previous) {
      nextIdRef.current += 1;
      setEvent({ id: nextIdRef.current, delta: xp - previous });
      previousXpRef.current = xp;
    }
  }, [xp]);

  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setEvent(null), durationMs);
    return () => clearTimeout(timer);
  }, [event, durationMs]);

  return event;
}
