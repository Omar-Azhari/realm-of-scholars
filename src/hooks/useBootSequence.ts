import { useEffect, useState } from "react";
import { useMotionPreference } from "./useMotionPreference";

/**
 * Brief "initializing" delay used only for the Semester Home skeleton on
 * first mount — a deliberate cosmetic boot moment (fits the command-centre
 * theme), not a stand-in for real async loading (there isn't any; save data
 * loads synchronously from localStorage). Skipped entirely under reduced
 * motion, where it would be pure friction with no payoff.
 */
export function useBootSequence(delayMs = 350): boolean {
  const reduceMotion = useMotionPreference();
  const [ready, setReady] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setReady(true);
      return;
    }
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, reduceMotion]);

  return ready;
}
