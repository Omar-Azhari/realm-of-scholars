import { useReducedMotion } from "framer-motion";
import { useSaveData } from "../state/SaveDataContext";

/**
 * Combines the OS-level `prefers-reduced-motion` setting with the app's own
 * Settings toggle (`saveData.settings.reducedMotion`) — either one disables
 * Framer Motion animations. Plain CSS animations/transitions already respect
 * `prefers-reduced-motion` and the `[data-reduced-motion]` attribute globally
 * (see src/styles/global.css); this hook covers the cases (Framer Motion
 * `animate`/`whileHover`/etc.) that a CSS media query can't intercept.
 */
export function useMotionPreference(): boolean {
  const prefersReducedMotion = useReducedMotion();
  const { saveData } = useSaveData();
  return Boolean(prefersReducedMotion) || saveData.settings.reducedMotion;
}
