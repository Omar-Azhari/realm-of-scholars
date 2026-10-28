/**
 * Placeholder low-poly character body (Phase 20A; proportions locked in
 * Milestone 20A.5; extended in Phase 20B with leg pivots + appearance
 * override props). This is the shared BASE SILHOUETTE every character in
 * the game is built from — the Art Bible's locked head:torso ratio (1.43)
 * and limb proportions (docs/UNIGAME_ART_BIBLE.md Part 3) never change
 * here; only colour and a couple of body-preset scale knobs do.
 *
 * `ModularCharacter.tsx` (Phase 20B) wraps this component and layers
 * catalogue-driven hair/clothing/accessories on top of it — this file
 * itself stays "just the body," matching the Art Bible's "every role
 * shares the exact same proportions" rule.
 *
 * No per-frame logic here — the parent scene wraps this in a `<group>`
 * whose transform is updated imperatively inside `useFrame` (Part 3: never
 * a React re-render per animation frame). This component stays purely
 * static geometry; the head/arm/leg pivots below are exposed as optional
 * refs purely as attachment points, driven by the shared rig
 * (`characterRig.ts`) one layer up. The player's usage (no refs passed)
 * is completely unaffected by any of this.
 */

import { forwardRef } from "react";
import type { Group } from "three";
import { RoundedBox } from "@react-three/drei";

interface PlaceholderCharacterProps {
  bodyColor: string;
  label: string;
  /** Phase 20B — defaults preserve the exact 20A.5 look for any caller not yet passing an appearance. */
  skinColor?: string;
  shoeColor?: string;
  eyeColor?: string;
  /** 0–1 eye size preset (see EYE_OPTIONS in appearanceCatalogue.ts) — maps to a small radius range, defaults to the original fixed 20A.5 size. */
  eyeScale?: number;
  /** Torso-only width multiplier (a body-preset knob) — height/limb length are scaled by the PARENT group instead, so this never distorts the locked head:torso ratio. */
  torsoWidthScale?: number;
  /** Set false when a `ModularCharacter` is rendering its own shoe shape on top (Part 4/8) — avoids two overlapping shoe meshes z-fighting. */
  showDefaultShoes?: boolean;
  headPivotRef?: React.Ref<Group>;
  armLeftPivotRef?: React.Ref<Group>;
  armRightPivotRef?: React.Ref<Group>;
  legLeftPivotRef?: React.Ref<Group>;
  legRightPivotRef?: React.Ref<Group>;
  /**
   * Content-injection slots (Phase 20B) — rendered INSIDE the named pivot
   * group, so hair/clothing/accessories automatically follow that pivot's
   * animation (head turns, arms wave, legs swing) without `ModularCharacter`
   * needing to duplicate any pivot/transform logic of its own. `torsoSlot`
   * covers tops/jackets/bottoms/most accessories — bottoms deliberately
   * hang from the torso rather than an individual leg pivot (a skirt or
   * pair of trousers reads as one connected garment, not two separately
   * swinging halves, at this character's scale).
   */
  headSlot?: React.ReactNode;
  torsoSlot?: React.ReactNode;
  armLeftSlot?: React.ReactNode;
  armRightSlot?: React.ReactNode;
  legLeftSlot?: React.ReactNode;
  legRightSlot?: React.ReactNode;
}

const SKIN = "#f4c9a0";
const SHOE = "#4a3b32";
const EYE = "#2c2320";

export const PlaceholderCharacter = forwardRef<Group, PlaceholderCharacterProps>(function PlaceholderCharacter(
  {
    bodyColor,
    label,
    skinColor = SKIN,
    shoeColor = SHOE,
    eyeColor = EYE,
    eyeScale = 0.5,
    torsoWidthScale = 1,
    showDefaultShoes = true,
    headPivotRef,
    armLeftPivotRef,
    armRightPivotRef,
    legLeftPivotRef,
    legRightPivotRef,
    headSlot,
    torsoSlot,
    armLeftSlot,
    armRightSlot,
    legLeftSlot,
    legRightSlot,
  },
  ref
) {
  return (
    <group name={label} ref={ref}>
      {/* Legs — pivoted at the hip so a walk cycle can swing them (Part 9). Feet live at the end of each leg pivot, replacing the pre-20B flat "feet glued to the torso" arrangement. */}
      <group ref={legLeftPivotRef} position={[-0.13, 0.1, 0]}>
        <mesh position={[0, -0.02, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} metalness={0} />
        </mesh>
        {showDefaultShoes ? (
          <RoundedBox args={[0.18, 0.1, 0.28]} radius={0.04} smoothness={2} position={[0, -0.09, 0.03]} castShadow>
            <meshStandardMaterial color={shoeColor} roughness={1} metalness={0} />
          </RoundedBox>
        ) : null}
        {legLeftSlot}
      </group>
      <group ref={legRightPivotRef} position={[0.13, 0.1, 0]}>
        <mesh position={[0, -0.02, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} metalness={0} />
        </mesh>
        {showDefaultShoes ? (
          <RoundedBox args={[0.18, 0.1, 0.28]} radius={0.04} smoothness={2} position={[0, -0.09, 0.03]} castShadow>
            <meshStandardMaterial color={shoeColor} roughness={1} metalness={0} />
          </RoundedBox>
        ) : null}
        {legRightSlot}
      </group>

      {/* Torso — short and rounded, so the head reads as clearly oversized. Width-only scaled per body preset; height comes from the parent group's own scale instead, so the locked head:torso ratio is never distorted. */}
      <group scale={[torsoWidthScale, 1, 1]}>
        <RoundedBox args={[0.46, 0.42, 0.32]} radius={0.09} smoothness={2} position={[0, 0.31, 0]} castShadow>
          <meshStandardMaterial color={bodyColor} roughness={0.85} metalness={0} />
        </RoundedBox>
        {torsoSlot}
      </group>

      {/* Stub arms — pivoted at the shoulder so an idle/wave/stretch animation can raise them; not articulated beyond that single pivot (a real rig is Milestone 20C's scope). */}
      <group ref={armLeftPivotRef} position={[-0.29, 0.45, 0]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} metalness={0} />
        </mesh>
        <RoundedBox args={[0.14, 0.14, 0.14]} radius={0.05} smoothness={2} position={[0, -0.25, 0]} castShadow>
          <meshStandardMaterial color={skinColor} roughness={0.75} metalness={0} />
        </RoundedBox>
        {armLeftSlot}
      </group>
      <group ref={armRightPivotRef} position={[0.29, 0.45, 0]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} metalness={0} />
        </mesh>
        <RoundedBox args={[0.14, 0.14, 0.14]} radius={0.05} smoothness={2} position={[0, -0.25, 0]} castShadow>
          <meshStandardMaterial color={skinColor} roughness={0.75} metalness={0} />
        </RoundedBox>
        {armRightSlot}
      </group>

      {/* Oversized head — the stylised low-poly proportion target: head
          diameter (0.6) noticeably larger than torso height (0.42).
          Pivoted at the neck so an idle animation can turn it ("looking
          around") independently of the body. */}
      <group ref={headPivotRef} position={[0, 0.52, 0]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.3, 16, 14]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} metalness={0} />
        </mesh>
        {/* Simple face — two small dot eyes on the head's local +Z (forward)
            face. The scene rotates the top-level group around Y to face
            travel direction, so the eyes always point the way the
            character walks (or, for the NPC, the way it's currently
            "looking"). */}
        <mesh position={[-0.09, 0.33, 0.27]}>
          <sphereGeometry args={[0.025 + eyeScale * 0.02, 8, 8]} />
          <meshStandardMaterial color={eyeColor} roughness={1} metalness={0} />
        </mesh>
        <mesh position={[0.09, 0.33, 0.27]}>
          <sphereGeometry args={[0.025 + eyeScale * 0.02, 8, 8]} />
          <meshStandardMaterial color={eyeColor} roughness={1} metalness={0} />
        </mesh>
        {headSlot}
      </group>
    </group>
  );
});
