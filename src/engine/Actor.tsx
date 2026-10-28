import type { ReactNode } from "react";
import { motion, type Transition } from "framer-motion";
import { SpriteView } from "./SpriteView";
import { useSprite } from "./AssetContext";

/** Ease with soft acceleration and deceleration — no robotic linear starts/stops. */
export const WALK_EASE: [number, number, number, number] = [0.42, 0.05, 0.35, 1];

interface ActorPose {
  /** Horizontal centre of the actor, scene units. */
  x: number;
  /** Ground line the actor stands on, scene units. */
  feetY: number;
  /** Rendered height, scene units — depth is expressed by shrinking this. */
  height: number;
}

interface ActorProps {
  spriteId: string;
  pose: ActorPose;
  /** Pose to animate from on mount (walk-in entrances). Defaults to `pose`. */
  initialPose?: ActorPose;
  transition?: Transition;
  sceneWidth: number;
  sceneHeight: number;
  animation?: string;
  flip?: boolean;
  /** Fade the actor out/in (crossing a door threshold). */
  faded?: boolean;
  /** Adds a gentle vertical bob while moving. */
  walking?: boolean;
  label: string;
  /** Name plate under the actor's feet. */
  plate?: { text: string; accent?: boolean };
  /** Extra content anchored above the head (speech bubbles). */
  children?: ReactNode;
  hidden?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Keyboard equivalents of hover — attached to the tap button so focus can reveal speech. */
  onFocus?: () => void;
  onBlur?: () => void;
  /** Makes the actor clickable (brief reactions); keeps pointer-transparency otherwise. */
  onClick?: () => void;
  clickLabel?: string;
}

/**
 * A character in a scene. Position and size are expressed in scene units and
 * converted to percentages of the stage, so actors scale with the artwork on
 * every viewport. The sprite artwork itself comes from the asset manifest via
 * its sprite id — this component has no knowledge of how it was drawn.
 */
export function Actor({
  spriteId,
  pose,
  initialPose,
  transition,
  sceneWidth,
  sceneHeight,
  animation = "idle",
  flip = false,
  faded = false,
  walking = false,
  label,
  plate,
  children,
  hidden = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
  clickLabel,
}: ActorProps) {
  const sprite = useSprite(spriteId);
  if (!sprite || hidden) return null;

  const aspect =
    sprite.type === "pixel-grid"
      ? sprite.width / sprite.height
      : sprite.frameWidth / sprite.frameHeight;

  const toStyle = (p: ActorPose) => {
    const widthUnits = p.height * aspect;
    return {
      left: `${((p.x - widthUnits / 2) / sceneWidth) * 100}%`,
      bottom: `${((sceneHeight - p.feetY) / sceneHeight) * 100}%`,
      width: `${(widthUnits / sceneWidth) * 100}%`,
      height: `${(p.height / sceneHeight) * 100}%`,
    };
  };

  const interactive = Boolean(onMouseEnter || onMouseLeave || onClick);

  return (
    <motion.div
      className={`engine-actor${interactive ? " engine-actor--interactive" : ""}${walking ? " engine-actor--walking" : ""}`}
      initial={{ ...toStyle(initialPose ?? pose), opacity: faded ? 1 : undefined }}
      animate={{ ...toStyle(pose), opacity: faded ? 0 : 1 }}
      transition={transition ?? { duration: 0 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {onClick ? (
        <button
          type="button"
          className="engine-actor-tap"
          onClick={onClick}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-label={clickLabel ?? label}
        />
      ) : null}
      <SpriteView sprite={sprite} animation={animation} flip={flip} label={label} />
      {plate ? (
        <span className={`engine-actor-plate${plate.accent ? " engine-actor-plate--accent" : ""}`}>
          {plate.text}
        </span>
      ) : null}
    </motion.div>
  );
}
