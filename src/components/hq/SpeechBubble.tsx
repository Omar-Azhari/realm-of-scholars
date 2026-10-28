import { AnimatePresence, motion } from "framer-motion";
import { useMotionPreference } from "../../hooks/useMotionPreference";

interface SpeechBubbleProps {
  text: string;
  visible: boolean;
}

/** A small reusable speech bubble anchored above a StudentCharacter (or, later, a room object). */
export function SpeechBubble({ text, visible }: SpeechBubbleProps) {
  const reduceMotion = useMotionPreference();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="speech-bubble"
          initial={reduceMotion ? undefined : { opacity: 0, y: 6, scale: 0.9 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 6, scale: 0.9 }}
          transition={{ duration: 0.18 }}
        >
          {text}
          <span className="speech-bubble-tail" aria-hidden="true" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
