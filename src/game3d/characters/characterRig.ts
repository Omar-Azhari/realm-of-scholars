/**
 * Shared character rig (Phase 20B, Part 9 / Part 11). A named set of
 * pivot joints — `head`, `armLeft`, `armRight`, `legLeft`, `legRight` —
 * that every character (player, mentor, any future NPC) is built from,
 * plus a deterministic, dependency-free pose engine that computes a
 * transform for each joint given a pose name and a running clock.
 *
 * Honest framing (this is the point of writing it down, not just building
 * it): this is a PROCEDURAL rig — a shared group hierarchy driven by pure
 * sine/ease math — not a `THREE.Skeleton`/`SkinnedMesh` bone-weight
 * system. The Art Bible (docs/UNIGAME_ART_BIBLE.md Part 3) already
 * reserved "a visible leg segment... for Milestone 20B's rig," and Part
 * 15 assigns "replace today's procedural stand-ins... with a real
 * skeletal/blend animation system" to Milestone 20C specifically — so
 * this is exactly the procedural stage that document anticipated, not a
 * premature reimplementation of 20C's job. What matters for "shared
 * skeleton compatibility" (Part 13's test requirement) is that every
 * character exposes the SAME five named pivots and the SAME pose
 * vocabulary, so a future skeletal rig can replace this module's internals
 * without any caller (ModularCharacter, NpcCharacter, the Character
 * Creator preview) needing to change.
 *
 * This module has zero React/Three.js import — every function here is
 * pure numbers in, numbers out — so it's directly unit-testable in a
 * plain Node harness (scripts/verify-phase20b-character.ts) without a
 * WebGL/DOM environment.
 */

export type PoseName =
  | "idle"
  | "walk"
  | "turn"
  | "wave"
  | "lookAround"
  | "stretch"
  | "read"
  | "wardrobePreview"
  // Phase 20C (Part 1/4) — NPC daily-life activities + the animation-blend list.
  | "write"
  | "type"
  | "think"
  | "talk"
  | "coffee"
  | "sit";

export const POSE_NAMES: PoseName[] = [
  "idle",
  "walk",
  "turn",
  "wave",
  "lookAround",
  "stretch",
  "read",
  "wardrobePreview",
  "write",
  "type",
  "think",
  "talk",
  "coffee",
  "sit",
];

export interface JointTransform {
  rotX: number;
  rotY: number;
  rotZ: number;
}

export interface PoseTransform {
  head: JointTransform;
  armLeft: JointTransform;
  armRight: JointTransform;
  legLeft: JointTransform;
  legRight: JointTransform;
  /** Applied to the character's root group, not a named pivot — a whole-body breathing/bounce cue. */
  bodyBobY: number;
}

const ZERO: JointTransform = { rotX: 0, rotY: 0, rotZ: 0 };

function zeroPose(bodyBobY = 0): PoseTransform {
  return { head: { ...ZERO }, armLeft: { ...ZERO }, armRight: { ...ZERO }, legLeft: { ...ZERO }, legRight: { ...ZERO }, bodyBobY };
}

export interface PoseParams {
  /** Personality preview / idle-speed multiplier (see personalityTraits.ts) — >1 = more energetic, <1 = calmer. Defaults to 1. */
  speedMultiplier?: number;
  /** For "walk": how fast the legs cycle, in cycles/second at speedMultiplier 1. Defaults to 1.6. */
  walkCyclesPerSecond?: number;
}

/**
 * Pure function: pose name + running clock (seconds) + params -> a full
 * joint transform. Calm by construction (Art Bible Part 1/Part 10 "No
 * frantic animations") — every amplitude below was chosen to read as
 * gentle, not to be a maximal range of motion.
 */
export function computePose(pose: PoseName, t: number, params: PoseParams = {}): PoseTransform {
  const speed = params.speedMultiplier ?? 1;
  const cyclesPerSecond = params.walkCyclesPerSecond ?? 1.6;

  switch (pose) {
    case "idle": {
      const s = t * speed;
      return {
        head: { rotX: Math.sin(s / 2.4) * 0.02, rotY: Math.sin(s / 3.1) * 0.05, rotZ: 0 },
        armLeft: { rotX: 0, rotY: 0, rotZ: Math.sin(s / 2.4) * 0.03 },
        armRight: { rotX: 0, rotY: 0, rotZ: -Math.sin(s / 2.4) * 0.03 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 2.4) * 0.012,
      };
    }

    case "turn": {
      // A subtle anticipatory lean, not a distinct locomotion cycle — the
      // actual yaw rotation itself is handled by the caller (the same
      // renderedYaw smoothing already shipped in TestRoomScene.tsx since
      // Milestone 20A.5); this pose only adds a small "leaning into the
      // turn" head/shoulder cue on top of that.
      const s = t * speed;
      return {
        head: { rotX: 0, rotY: Math.sin(s / 1.4) * 0.08, rotZ: 0.03 },
        armLeft: { rotX: 0, rotY: 0, rotZ: 0.05 },
        armRight: { rotX: 0, rotY: 0, rotZ: -0.05 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: 0,
      };
    }

    case "walk": {
      // `t` is phase-local (time since THIS walk began — see
      // `createPoseBlender`'s `now - poseStartClock`), which is what makes
      // a startup "anticipation" ramp possible: the first ~0.25s of any
      // walk eases the stride in from a small forward lean rather than
      // snapping straight to full swing (Part 3: "small anticipation
      // before walking"). `blendPoseTransforms`'s own idle->walk crossfade
      // (0.35s) already smooths the POSE switch itself; this ramp is a
      // second, independent effect — the stride amplitude building up
      // even once the blend has finished, mimicking a real first step.
      const anticipation = Math.min(1, t / 0.25);
      const s = t * cyclesPerSecond * speed * Math.PI * 2;
      const swing = 0.5 * anticipation;
      // Weight shift (Part 3) — a lateral roll at HALF the stride
      // frequency (a real gait shifts weight once per full left-right
      // cycle, not once per single footfall), applied to the head/arms as
      // a small rotZ lean, and independently to legs via rotY (a subtle
      // outward roll on the forward leg) so it doesn't fight the swing.
      const weightShift = Math.sin(s / 2) * 0.05 * anticipation;
      // Head bob (Part 3) — a double-bump nod per stride (abs(sin) peaks
      // twice per cycle, once per footfall), expressed as rotation since
      // this rig's joints are rotation-only (see JointTransform) rather
      // than a true vertical head translation.
      const headBob = Math.abs(Math.sin(s)) * 0.035 * anticipation;
      return {
        head: { rotX: headBob, rotY: Math.sin(s / 4) * 0.02, rotZ: weightShift * 0.6 },
        // Arms counter-swing against the opposite leg, as in a natural gait.
        armLeft: { rotX: -Math.sin(s) * swing * 0.6, rotY: 0, rotZ: weightShift },
        armRight: { rotX: Math.sin(s) * swing * 0.6, rotY: 0, rotZ: -weightShift },
        legLeft: { rotX: Math.sin(s) * swing, rotY: weightShift * 0.3, rotZ: 0 },
        legRight: { rotX: -Math.sin(s) * swing, rotY: -weightShift * 0.3, rotZ: 0 },
        bodyBobY: Math.abs(Math.sin(s)) * 0.02 * anticipation,
      };
    }

    case "wave": {
      const s = t * speed;
      return {
        head: { rotX: 0, rotY: 0.1, rotZ: 0 },
        armLeft: ZERO,
        // Raised and waving side to side.
        armRight: { rotX: -1.9, rotY: 0, rotZ: Math.sin(s * 6) * 0.35 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: 0,
      };
    }

    case "lookAround": {
      // Matches the amplitudes/periods already shipped in NpcCharacter.tsx
      // (Milestone 20A.5) — formalised here as a named, reusable pose
      // rather than left as bespoke inline math only the NPC used.
      const s = t * speed;
      return {
        head: { rotX: Math.sin(s / (6.5 * 0.63)) * 0.35 * 0.18, rotY: Math.sin(s / 6.5) * 0.35, rotZ: 0 },
        armLeft: { rotX: 0, rotY: 0, rotZ: Math.sin(s / 2.4) * 0.03 },
        armRight: { rotX: 0, rotY: 0, rotZ: -Math.sin(s / 2.4) * 0.03 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 2.4) * 0.012,
      };
    }

    case "stretch": {
      // A single eased 0->1->0 bump over a fixed 1.4s window, matching
      // NpcCharacter.tsx's existing stretch cadence — `t` is expected to
      // be phase-local (0 at the stretch's start) when the caller wants a
      // one-shot stretch rather than a repeating one.
      const duration = 1.4;
      const clamped = Math.max(0, Math.min(duration, t));
      const amount = (1 - Math.cos((clamped / duration) * Math.PI * 2)) / 2;
      return {
        head: { rotX: -0.05 * amount, rotY: 0, rotZ: 0 },
        armLeft: { rotX: 0, rotY: 0, rotZ: 2.4 * amount },
        armRight: { rotX: 0, rotY: 0, rotZ: -2.4 * amount },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: 0.02 * amount,
      };
    }

    case "read": {
      const s = t * speed;
      return {
        head: { rotX: 0.32, rotY: Math.sin(s / 4) * 0.02, rotZ: 0 },
        armLeft: { rotX: -0.9, rotY: 0, rotZ: 0.15 },
        armRight: { rotX: -0.9, rotY: 0, rotZ: -0.15 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 3) * 0.006,
      };
    }

    case "write": {
      // A notebook/pen pose — one arm resting flat on a writing surface,
      // the other making a small repeated scribble motion. Head tilted
      // down, similar angle to "read" but the arms differ (one active,
      // one resting) rather than both held symmetrically.
      const s = t * speed;
      return {
        head: { rotX: 0.3, rotY: Math.sin(s / 4.5) * 0.02, rotZ: 0 },
        armLeft: { rotX: -0.95, rotY: 0, rotZ: 0.1 },
        armRight: { rotX: -0.85, rotY: 0, rotZ: Math.sin(s * 4) * 0.08 - 0.1 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 3) * 0.006,
      };
    }

    case "type": {
      // Both hands forward at keyboard height, small alternating
      // up/down finger-strike cue (approximated at the wrist/arm level,
      // since this rig has no finger joints).
      const s = t * speed * 6;
      return {
        head: { rotX: 0.22, rotY: Math.sin(t * speed / 5) * 0.03, rotZ: 0 },
        armLeft: { rotX: -1.05, rotY: 0, rotZ: 0.08 + Math.sin(s) * 0.04 },
        armRight: { rotX: -1.05, rotY: 0, rotZ: -0.08 + Math.sin(s + Math.PI) * 0.04 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(t * speed / 3) * 0.005,
      };
    }

    case "think": {
      // One hand near the chin, head tilted, a slow, occasional-looking
      // head sway — reads as "considering something," not fidgeting.
      const s = t * speed;
      return {
        head: { rotX: 0.08, rotY: Math.sin(s / 5) * 0.12, rotZ: 0.06 },
        armLeft: ZERO,
        armRight: { rotX: -1.7, rotY: 0, rotZ: -0.3 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 3.2) * 0.006,
      };
    }

    case "talk": {
      // Gentle alternating hand-gesture cue (as if mid-conversation) plus
      // a slightly more active head nod than idle — "standing
      // conversation" from Part 4 uses this same pose.
      const s = t * speed;
      return {
        head: { rotX: 0, rotY: Math.sin(s / 2.2) * 0.1, rotZ: 0 },
        armLeft: { rotX: -0.25 + Math.sin(s / 1.8) * 0.15, rotY: 0, rotZ: 0.12 },
        armRight: { rotX: -0.3 + Math.sin(s / 1.8 + Math.PI) * 0.15, rotY: 0, rotZ: -0.12 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 2.6) * 0.01,
      };
    }

    case "coffee": {
      // One arm raised holding a mug near chest height, with an
      // occasional slow "sip" tilt of the head — the other arm rests.
      const s = t * speed;
      const sip = Math.max(0, Math.sin(s / 4.5)) ** 6; // rare, brief sip moments, not continuous
      return {
        head: { rotX: sip * 0.18, rotY: Math.sin(s / 5) * 0.05, rotZ: 0 },
        armLeft: ZERO,
        armRight: { rotX: -1.5 - sip * 0.15, rotY: 0, rotZ: -0.1 },
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 3) * 0.008,
      };
    }

    case "sit": {
      // Approximated within this rig's limits (documented honestly in
      // characterRig.ts's header and the Phase 20C completion report): no
      // separate hip/knee joint exists, so "sitting" lowers the whole
      // root (bodyBobY as a large offset, not a small oscillation here)
      // and bends both leg pivots forward as if resting on a seat.
      const s = t * speed;
      return {
        head: { rotX: 0, rotY: Math.sin(s / 4) * 0.03, rotZ: 0 },
        armLeft: { rotX: -0.15, rotY: 0, rotZ: 0.05 },
        armRight: { rotX: -0.15, rotY: 0, rotZ: -0.05 },
        legLeft: { rotX: -1.3, rotY: 0, rotZ: 0 },
        legRight: { rotX: -1.3, rotY: 0, rotZ: 0 },
        bodyBobY: -0.32 + Math.sin(s / 3) * 0.004,
      };
    }

    case "wardrobePreview": {
      // A calm, presentational stillness for the Character Creator's
      // turntable preview — deliberately the lowest-amplitude pose in the
      // set, so the player's attention stays on the appearance, not the
      // motion.
      const s = t * speed;
      return {
        head: { rotX: 0, rotY: Math.sin(s / 4) * 0.02, rotZ: 0 },
        armLeft: ZERO,
        armRight: ZERO,
        legLeft: ZERO,
        legRight: ZERO,
        bodyBobY: Math.sin(s / 3.6) * 0.008,
      };
    }

    default:
      return zeroPose();
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpJoint(a: JointTransform, b: JointTransform, t: number): JointTransform {
  return { rotX: lerp(a.rotX, b.rotX, t), rotY: lerp(a.rotY, b.rotY, t), rotZ: lerp(a.rotZ, b.rotZ, t) };
}

/** Linear blend between two full pose transforms — used during a crossfade. */
export function blendPoseTransforms(from: PoseTransform, to: PoseTransform, t: number): PoseTransform {
  return {
    head: lerpJoint(from.head, to.head, t),
    armLeft: lerpJoint(from.armLeft, to.armLeft, t),
    armRight: lerpJoint(from.armRight, to.armRight, t),
    legLeft: lerpJoint(from.legLeft, to.legLeft, t),
    legRight: lerpJoint(from.legRight, to.legRight, t),
    bodyBobY: lerp(from.bodyBobY, to.bodyBobY, t),
  };
}

export interface PoseBlender {
  /** Switch the active pose. A no-op if already the active pose (never restarts a blend into itself). */
  setPose(pose: PoseName, now: number): void;
  /** Current active pose name (the blend TARGET, not necessarily what's rendering this instant). */
  readonly current: PoseName;
  /** Compute this frame's blended transform. `now` must be monotonically increasing (a running clock, e.g. accumulated `useFrame` delta). */
  update(now: number, params?: PoseParams): PoseTransform;
}

/**
 * Every pose switch crossfades over `blendSeconds` — Part 10's "animation
 * should crossfade smoothly," applied once, here, rather than left for
 * every call site to reimplement. `poseStartClock` tracks when the
 * CURRENT pose itself began (so one-shot poses like "stretch" can compute
 * their own phase-local time via `now - poseStartClock`).
 *
 * Phase 20F fix (visual audit finding, `docs/PHASE_20F_VISUAL_AUDIT.md`):
 * the outgoing half of a blend used to re-evaluate the PREVIOUS pose at
 * the blender's absolute clock instead of that pose's own phase-local
 * time — harmless for purely periodic poses, but for a one-shot pose like
 * "stretch" (whose own `t` is expected to start at 0 and clamp at its
 * duration) this meant the outgoing pose was almost always evaluated well
 * past its own end, freezing at its final value instead of continuing
 * from wherever it visually was the instant the switch happened. Fixed by
 * blending from a literal snapshot of the last rendered transform — always
 * correct regardless of which pose (or params) produced it, and simpler
 * than tracking a second clock.
 */
export function createPoseBlender(initial: PoseName = "idle", blendSeconds = 0.35): PoseBlender {
  let current = initial;
  let poseStartClock = 0;
  let blendFrom: PoseTransform | null = null;
  let blendStartClock = 0;
  let lastTransform: PoseTransform = zeroPose();

  return {
    get current() {
      return current;
    },
    setPose(pose, now) {
      if (pose === current) return;
      blendFrom = lastTransform;
      current = pose;
      blendStartClock = now;
      poseStartClock = now;
    },
    update(now, params) {
      const currentTransform = computePose(current, now - poseStartClock, params);
      if (blendFrom === null) {
        lastTransform = currentTransform;
        return currentTransform;
      }

      const elapsed = now - blendStartClock;
      if (elapsed >= blendSeconds) {
        blendFrom = null;
        lastTransform = currentTransform;
        return currentTransform;
      }
      const raw = Math.max(0, Math.min(1, elapsed / blendSeconds));
      const eased = 1 - (1 - raw) * (1 - raw); // ease-out — ramps in quickly, settles gently
      const result = blendPoseTransforms(blendFrom, currentTransform, eased);
      lastTransform = result;
      return result;
    },
  };
}
