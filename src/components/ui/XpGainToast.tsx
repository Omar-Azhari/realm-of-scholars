import { AnimatePresence, motion } from "framer-motion";
import { useSaveData } from "../../state/SaveDataContext";
import { useXpGainEvent } from "../../hooks/useXpGainEvent";
import { useMotionPreference } from "../../hooks/useMotionPreference";

/**
 * Mounted once in AppShell so it can catch an XP change no matter which
 * screen triggered it (module completion, review bonus, streak bonus).
 * Renders nothing under reduced motion — it's a celebratory flourish, not
 * information the user depends on (the HUD's XP total is always visible).
 */
export function XpGainToast() {
  const { saveData } = useSaveData();
  const reduceMotion = useMotionPreference();
  const event = useXpGainEvent(saveData.userProgress.xp);

  if (reduceMotion) return null;

  return (
    <div className="xp-toast-region" aria-live="polite">
      <AnimatePresence>
        {event ? (
          <motion.div
            key={event.id}
            className={`xp-toast${event.delta < 0 ? " xp-toast--negative" : ""}`}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }}
            transition={{ duration: 0.25 }}
          >
            {event.delta > 0 ? `+${event.delta}` : event.delta} XP
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
