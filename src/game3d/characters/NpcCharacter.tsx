/**
 * NPC daily-life wrapper (Milestone 20A.5 idle-only stand-in; rebuilt in
 * Phase 20C on the deterministic schedule system). Wraps `ModularCharacter`
 * and drives BOTH its position (via `npcSchedule.ts`'s `getScheduleState`)
 * and its shared-rig pose (via `characterRig.ts`'s crossfade blender) —
 * the NPC now actually walks between waypoints and performs a sequence of
 * named activities, replacing 20A.5's fixed look-around/stretch loop.
 *
 * `personality`'s `idleSpeedMultiplier` continues to only scale pose
 * *playback speed* (Part 10: cosmetic only, never which activity plays —
 * that's the schedule's job, kept deterministic per-archetype).
 *
 * Performance (Part 11 "activity throttling"): the schedule-state lookup
 * (cheap — a short loop over a handful of waypoints) is only recomputed
 * every `SCHEDULE_THROTTLE_FRAMES` frames; the pose *blend* itself still
 * updates every frame for visually smooth motion. At today's 2-3 NPCs this
 * throttle saves negligible CPU — it exists to establish the pattern
 * before Milestone 20F's larger NPC counts actually need it, documented
 * honestly rather than oversold as a real bottleneck fix today.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { ModularCharacter } from "./ModularCharacter";
import { createPoseBlender, type JointTransform } from "./characterRig";
import { getScheduleState, type NpcSchedule } from "./npcSchedule";
import { playActivitySoundOnChange } from "./activitySound";
import { floorPointToVector3 } from "../types/coordinates";
import { buildPersonalityPreview } from "../../data/personalityTraits";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";
import type { PoseName } from "./characterRig";

const SCHEDULE_THROTTLE_FRAMES = 3;

function applyJoint(group: Group | null, joint: JointTransform): void {
  if (!group) return;
  group.rotation.set(joint.rotX, joint.rotY, joint.rotZ);
}

export function NpcCharacter({
  appearance,
  personality,
  schedule,
  scheduleTimeOffsetSeconds = 0,
  label,
  waving = false,
  talking = false,
}: {
  appearance: CharacterAppearance;
  personality?: PlayerPersonality;
  schedule: NpcSchedule;
  scheduleTimeOffsetSeconds?: number;
  label: string;
  /** Phase 21 Part 4 "react to the player's presence" — true while the player is in range of this NPC's own interactable. Overrides the scheduled pose with a wave, without interrupting the schedule's position (never mid-walk — see below) or its underlying clock. */
  waving?: boolean;
  /** Phase 23 "Visual Improvements" — true while a `MentorConversationPanel` is open with this exact NPC. Same override shape as `waving` (never mid-walk), and takes priority over it — an open conversation is a stronger signal than passive proximity. */
  talking?: boolean;
}) {
  const rootRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const armLeftRef = useRef<Group>(null);
  const armRightRef = useRef<Group>(null);
  const legLeftRef = useRef<Group>(null);
  const legRightRef = useRef<Group>(null);
  const clockRef = useRef(0);
  const frameCountRef = useRef(0);
  const blenderRef = useRef(createPoseBlender("idle"));
  const lastScheduleStateRef = useRef(getScheduleState(schedule, scheduleTimeOffsetSeconds));
  const previousActivityRef = useRef<PoseName | null>(null);

  const preview = personality ? buildPersonalityPreview(personality.primaryTraitId, personality.secondaryTraitIds) : null;
  const speedMultiplier = preview?.idleSpeedMultiplier ?? 1;

  useFrame((_, delta) => {
    clockRef.current += delta;
    frameCountRef.current += 1;

    if (frameCountRef.current % SCHEDULE_THROTTLE_FRAMES === 0) {
      lastScheduleStateRef.current = getScheduleState(schedule, clockRef.current + scheduleTimeOffsetSeconds);
    }
    const state = lastScheduleStateRef.current;
    // Never overrides mid-walk (would visibly teleport into a stopped
    // pose) — only while already stationary at a waypoint. An open
    // conversation (`talking`) outranks passive proximity (`waving`).
    const activePose = state.isWalking ? state.pose : talking ? "talk" : waving ? "wave" : state.pose;

    playActivitySoundOnChange(activePose, previousActivityRef.current);
    previousActivityRef.current = activePose;

    blenderRef.current.setPose(activePose, clockRef.current);
    const pose = blenderRef.current.update(clockRef.current, { speedMultiplier });

    applyJoint(headRef.current, pose.head);
    applyJoint(armLeftRef.current, pose.armLeft);
    applyJoint(armRightRef.current, pose.armRight);
    applyJoint(legLeftRef.current, pose.legLeft);
    applyJoint(legRightRef.current, pose.legRight);

    if (rootRef.current) {
      const [x, , z] = floorPointToVector3(state.position);
      rootRef.current.position.set(x, pose.bodyBobY, z);
      rootRef.current.rotation.y = state.facingLeft ? Math.PI * 0.75 : Math.PI * 0.25;
    }
  });

  return (
    <ModularCharacter
      ref={rootRef}
      appearance={appearance}
      label={label}
      headPivotRef={headRef}
      armLeftPivotRef={armLeftRef}
      armRightPivotRef={armRightRef}
      legLeftPivotRef={legLeftRef}
      legRightPivotRef={legRightRef}
    />
  );
}
