import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Character } from "../scene/Character";
import { ModelCharacter, WithFallback, type AvatarId } from "../scene/models";
import type { PlayerLook } from "../types";

function Spinner({ look, avatar }: { look: PlayerLook; avatar: AvatarId }) {
  const group = useRef<Group>(null);
  const moving = useRef(false);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.5;
  });
  return (
    <group ref={group} position={[0, -0.7, 0]}>
      <WithFallback key={avatar} fallback={<Character look={look} movingRef={moving} />}>
        <ModelCharacter avatar={avatar} movingRef={moving} height={1.45} />
      </WithFallback>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.85, 32]} />
        <meshStandardMaterial color="#4a6b35" />
      </mesh>
    </group>
  );
}

export function CharacterPreview({ look, avatar }: { look: PlayerLook; avatar: AvatarId }) {
  return (
    <div className="char-preview">
      <Canvas shadows camera={{ position: [0, 0.35, 2.4], fov: 40 }}>
        <hemisphereLight args={["#ffffff", "#4b6a35", 1.0]} />
        <directionalLight position={[2, 4, 3]} intensity={2} castShadow />
        <Spinner look={look} avatar={avatar} />
      </Canvas>
    </div>
  );
}
