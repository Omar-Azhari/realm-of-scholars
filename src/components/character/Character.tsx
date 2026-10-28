import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { useMotionPreference } from "../../hooks/useMotionPreference";

export type CharacterEmotion = "neutral" | "happy" | "concerned";

interface CharacterProps {
  /** CSS custom property name for the subject's accent colour, e.g. "--ui-accent". */
  accentVar: string;
  /** The character concept text from the subject overview — used as the accessible label + caption. */
  label: string;
  size?: "small" | "large";
  emotion?: CharacterEmotion;
  /** True while the character has something to say (Phase 6 will drive this from real events). */
  speaking?: boolean;
}

/**
 * Original, abstract stand-in for a subject's character — no artwork exists
 * yet, and this deliberately does not depict any recognisable figure, sprite,
 * or third-party design. It's an accent-coloured glow/panel motif with idle
 * float + blink + emotion-driven "mouth" shape, captioned with the real
 * character concept text from the subject overview.
 */
export function Character({ accentVar, label, size = "large", emotion = "neutral", speaking = false }: CharacterProps) {
  const reduceMotion = useMotionPreference();
  const style = { "--character-accent": `var(${accentVar})` } as CSSProperties;

  return (
    <div className={`character character--${size}`} style={style}>
      <motion.div
        className="character-figure"
        role="img"
        aria-label={`Placeholder illustration: ${label}${speaking ? " (speaking)" : ""}`}
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span
          className="character-glow"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { opacity: [0.45, 0.7, 0.45] }}
          transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className={`character-core character-core--${emotion}`} aria-hidden="true" />
        <motion.span
          className="character-eye"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { scaleY: [1, 1, 0.1, 1] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 4.5, repeat: Infinity, times: [0, 0.92, 0.96, 1], repeatDelay: 1.2 }
          }
        />
        <span className={`character-mouth character-mouth--${emotion}`} aria-hidden="true" />
        {speaking ? (
          <motion.span
            className="character-speaking-indicator"
            aria-hidden="true"
            animate={reduceMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={reduceMotion ? undefined : { duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </motion.div>
      {size === "large" ? <p className="character-caption">{label}</p> : null}
    </div>
  );
}
