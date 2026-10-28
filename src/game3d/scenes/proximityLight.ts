/**
 * Proximity-lighting response (Phase 20C, Part 5: "Lighting should
 * subtly respond when nearby"). Two tiny pure functions — no
 * React/Three.js import — so the intensity math is directly testable
 * without a WebGL/DOM environment, same discipline as characterRig.ts and
 * npcSchedule.ts.
 */

/** Which intensity a light SHOULD be heading toward right now. */
export function targetLightIntensity(isInRange: boolean, baseIntensity: number, boostIntensity: number): number {
  return isInRange ? boostIntensity : baseIntensity;
}

/** Exponential ease toward `target` — the same damping shape used everywhere else in this module (camera, movement), applied to a light's intensity instead of a transform. */
export function lerpIntensity(current: number, target: number, speed: number, delta: number): number {
  const t = 1 - Math.exp(-speed * delta);
  return current + (target - current) * t;
}
