/**
 * Character Creator live 3D preview (Phase 20B, Part 3). A small, self-
 * contained Canvas — the SAME lighting recipe as the test room
 * (docs/UNIGAME_ART_BIBLE.md Part 7: "no room should invent random
 * lighting," applied here too even though this isn't a room) and the SAME
 * `ModularCharacter`/shared-rig every other character uses, playing the
 * dedicated `wardrobePreview` pose (characterRig.ts) — the calmest, most
 * presentational pose in the set, matching "the camera should never feel
 * like a third-person action game."
 *
 * Camera: `@react-three/drei`'s `OrbitControls`, deliberately constrained
 * (no pan, a narrow zoom range, a limited polar-angle band so the player
 * can never flip to look from underneath or dead-on from above) — "smooth
 * rotation, zoom... reset camera" per the brief, without inventing a
 * bespoke camera-control implementation when a proven one already exists
 * in the dependency this project already ships.
 */

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import { ModularCharacter } from "../characters/ModularCharacter";
import { createPoseBlender, type JointTransform } from "../characters/characterRig";
import type { CharacterAppearance } from "../../types/domain";

export interface CharacterCreatorPreviewHandle {
  resetCamera: () => void;
}

function applyJoint(group: Group | null, joint: JointTransform): void {
  if (!group) return;
  group.rotation.set(joint.rotX, joint.rotY, joint.rotZ);
}

function PreviewScene({ appearance, reduceMotion }: { appearance: CharacterAppearance; reduceMotion: boolean }) {
  const headRef = useRef<Group>(null);
  const armLeftRef = useRef<Group>(null);
  const armRightRef = useRef<Group>(null);
  const legLeftRef = useRef<Group>(null);
  const legRightRef = useRef<Group>(null);
  const clockRef = useRef(0);
  const blenderRef = useRef(createPoseBlender("wardrobePreview"));

  useFrame((_, delta) => {
    if (reduceMotion) return;
    clockRef.current += delta;
    const pose = blenderRef.current.update(clockRef.current);
    applyJoint(headRef.current, pose.head);
    applyJoint(armLeftRef.current, pose.armLeft);
    applyJoint(armRightRef.current, pose.armRight);
    applyJoint(legLeftRef.current, pose.legLeft);
    applyJoint(legRightRef.current, pose.legRight);
  });

  return (
    <>
      <ambientLight color="#fff2df" intensity={0.4} />
      <hemisphereLight color="#fff6e6" groundColor="#c9a876" intensity={0.5} />
      <directionalLight
        position={[1.6, 2.6, 1.8]}
        color="#ffdca6"
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-radius={4}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.9, 32]} />
        <meshStandardMaterial color="#d8bd8f" roughness={0.95} metalness={0} />
      </mesh>

      <ModularCharacter
        appearance={appearance}
        label="Preview"
        headPivotRef={headRef}
        armLeftPivotRef={armLeftRef}
        armRightPivotRef={armRightRef}
        legLeftPivotRef={legLeftRef}
        legRightPivotRef={legRightRef}
      />
    </>
  );
}

export const CharacterCreatorPreview = forwardRef<
  CharacterCreatorPreviewHandle,
  { appearance: CharacterAppearance; reduceMotion: boolean }
>(function CharacterCreatorPreview({ appearance, reduceMotion }, ref) {
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  useImperativeHandle(ref, () => ({
    resetCamera: () => controlsRef.current?.reset(),
  }));

  return (
    <div className="creator-preview-canvas" data-testid="character-creator-preview">
      <Canvas shadows camera={{ fov: 40, position: [0, 1.0, 1.8] }} dpr={[1, 1.5]}>
        <PreviewScene appearance={appearance} reduceMotion={reduceMotion} />
        <OrbitControls
          ref={controlsRef}
          target={[0, 0.55, 0]}
          enablePan={false}
          enableDamping={!reduceMotion}
          dampingFactor={0.12}
          minDistance={1.1}
          maxDistance={2.4}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.5}
          rotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
});
