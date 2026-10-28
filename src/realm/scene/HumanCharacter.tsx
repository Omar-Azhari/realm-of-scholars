/**
 * A player or NPC with a real body (see customise/humans.ts): outfit parts
 * from several model files mixed onto one skeleton, bones scaled by the body
 * sliders, materials recoloured for skin, hair and outfit, and a wizard hat,
 * a wand and a cloak hung off the head, hand and chest bones.
 */

import { useEffect, useMemo, type MutableRefObject } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { v2AssetUrl } from "../../game3d/assets/assetUrl";
import { Animated, HatMesh, type HatId, type OneShot } from "./models";
import { appearanceFiles, boneTargets, BASE_OUTFIT, CLIP_ALIAS, heightScale, isFixedMaterial, outfitFile, PART_SLOTS, SLOT_SUFFIX, type PartSlot } from "../customise/humans";
import type { Appearance } from "../types";

interface HumanCharacterProps {
  appearance: Appearance;
  movingRef?: MutableRefObject<boolean>;
  oneShotRef?: MutableRefObject<OneShot | null>;
  /** Height in world units at the middle of the height slider. */
  height?: number;
  idleClip?: string;
  moveClip?: string;
  hat?: HatId | null;
  /** Shows a wand in the right hand, tinted by the crafted weapon's metal. */
  weaponTint?: string | null;
  /** Hangs a cloak from the shoulders in this colour. */
  capeColor?: string | null;
  /** While true, the legs are posed sitting (thighs forward, knees bent) on top of the animation. */
  sittingRef?: MutableRefObject<boolean>;
  /** Speed relative to normal walking, so the run animation matches the ground speed. */
  speedRef?: MutableRefObject<number>;
  /** 0..1 while jumping: how far the legs tuck up in the air. */
  airRef?: MutableRefObject<number>;
}

type Gltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };

/** The base file's clips plus copies under the names the game uses (Cheer, Running_A, …). */
function aliasedClips(clips: THREE.AnimationClip[]): THREE.AnimationClip[] {
  const byName = new Map(clips.map((c) => [c.name, c]));
  const out = [...clips];
  for (const [alias, target] of Object.entries(CLIP_ALIAS)) {
    const clip = byName.get(target);
    if (clip && !byName.has(alias)) {
      const copy = clip.clone();
      copy.name = alias;
      out.push(copy);
    }
  }
  return out;
}

/**
 * The body models ship with every triangle's corners separate (flat shading), which reads
 * as blocky. This welds shared corners and recomputes normals so bodies shade smoothly.
 * Hard edges remain only where the model really has a seam. Cached per source geometry,
 * so each model part is smoothed once however many characters wear it.
 */
const smoothCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function smoothed(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = smoothCache.get(geometry);
  if (hit) return hit;
  let out = geometry;
  try {
    const g = geometry.clone();
    // The files store attributes interleaved; welding needs them separate.
    for (const name of Object.keys(g.attributes)) {
      const attr = g.getAttribute(name);
      if ((attr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) g.setAttribute(name, (attr as THREE.InterleavedBufferAttribute).clone());
    }
    g.deleteAttribute("normal");
    out = mergeVertices(g, 1e-4);
    out.computeVertexNormals();
  } catch {
    out = geometry;
  }
  smoothCache.set(geometry, out);
  return out;
}

function borrow(source: THREE.Object3D, bones: Map<string, THREE.Object3D>, rig: THREE.Object3D): THREE.SkinnedMesh | null {
  const skinned = source as THREE.SkinnedMesh;
  if (!skinned.isSkinnedMesh) return null;
  const mapped = skinned.skeleton.bones.map((b) => bones.get(b.name) as THREE.Bone | undefined);
  if (mapped.some((b) => !b)) return null;
  const part = new THREE.SkinnedMesh(skinned.geometry, skinned.material);
  part.name = skinned.name;
  part.position.copy(skinned.position);
  part.quaternion.copy(skinned.quaternion);
  part.scale.copy(skinned.scale);
  part.bind(new THREE.Skeleton(mapped as THREE.Bone[], skinned.skeleton.boneInverses.map((m) => m.clone())), skinned.bindMatrix.clone());
  rig.add(part);
  return part;
}

export function HumanCharacter({ appearance, movingRef, oneShotRef, height = 1.75, idleClip = "Idle", moveClip = "Running_A", hat = null, weaponTint = null, capeColor = null, sittingRef, speedRef, airRef }: HumanCharacterProps) {
  const files = appearanceFiles(appearance);
  const gltfs = useGLTF(files.map((f) => v2AssetUrl(f))) as unknown as Gltf[];
  const base = gltfs[0];
  const partsKey = `${appearance.body}|${appearance.parts.head}|${appearance.parts.body}|${appearance.parts.legs}|${appearance.parts.feet}`;

  const built = useMemo(() => {
    const copy = cloneSkinned(base.scene);
    const bones = new Map<string, THREE.Object3D>();
    let rig: THREE.Object3D | null = null;
    copy.traverse((node) => {
      if ((node as THREE.Bone).isBone) bones.set(node.name, node);
      if (!rig && (node as THREE.SkinnedMesh).isSkinnedMesh) rig = node.parent;
    });
    const baseId = BASE_OUTFIT[appearance.body];
    /** A slot's part inside one model file: a mesh, or a group of meshes (one per material), named "<Something>_Head" etc. */
    const partIn = (root: THREE.Object3D, slot: PartSlot): THREE.Object3D | undefined => {
      let found: THREE.Object3D | undefined;
      root.traverse((n) => {
        if (!found && !(n as THREE.Bone).isBone && n.name.endsWith(`_${SLOT_SUFFIX[slot]}`)) found = n;
      });
      return found;
    };
    // Parts hang off the armature object that holds the base outfit's parts.
    const holder = partIn(copy, "body")?.parent ?? rig;
    for (const slot of PART_SLOTS) {
      const from = appearance.parts[slot.id];
      if (from === baseId || !holder) continue;
      partIn(copy, slot.id)?.removeFromParent();
      const file = gltfs[files.indexOf(outfitFile(appearance.body, from))];
      const source = file ? partIn(file.scene, slot.id) : undefined;
      if (!source) continue;
      const meshes: THREE.Object3D[] = [];
      source.traverse((n) => {
        if ((n as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(n);
      });
      for (const m of meshes) borrow(m, bones, holder);
    }
    // Own materials per character, so recolouring one never touches another; smooth shading for bodies.
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.geometry = smoothed(mesh.geometry);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const clone = (m: THREE.Material) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.userData.baseColor = (m as THREE.MeshStandardMaterial).color?.clone();
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    // Bind-pose height in model units, to size the character in the world.
    copy.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(copy);
    const modelHeight = Math.max(0.01, box.max.y - box.min.y);
    if (import.meta.env.DEV) (window as unknown as { __human?: THREE.Object3D }).__human = copy;
    return { copy, bones, modelHeight };
    // partsKey stands in for the parts; the files only change with them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, partsKey]);

  // Colours: skin, hair, and the outfit's cloth.
  useEffect(() => {
    const outfit = appearance.outfitColour ? new THREE.Color(appearance.outfitColour) : null;
    const target = { h: 0, s: 0, l: 0 };
    outfit?.getHSL(target);
    built.copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        const original = m.userData.baseColor as THREE.Color | undefined;
        if (!original) continue;
        if (/^Skin/i.test(m.name)) m.color.set(appearance.skin);
        else if (/^Hair/i.test(m.name) || /^Eyebrow/i.test(m.name)) m.color.set(appearance.hair);
        else if (outfit && !isFixedMaterial(m.name)) {
          const hsl = { h: 0, s: 0, l: 0 };
          original.getHSL(hsl);
          m.color.setHSL(target.h, Math.min(1, target.s * 0.9 + hsl.s * 0.1), hsl.l);
        } else m.color.copy(original);
      }
    });
  }, [built, appearance.skin, appearance.hair, appearance.outfitColour]);

  // Body sliders: each bone's target thickness/length, divided by its scaled parent's.
  const { build, muscle, height: heightSlider, body } = appearance;
  useEffect(() => {
    const targets = boneTargets({ build, muscle, height: heightSlider, body });
    const targetOf = (bone: THREE.Object3D | null): [number, number, number] => {
      let b = bone;
      while (b) {
        if (targets[b.name]) return targets[b.name];
        b = b.parent;
      }
      return [1, 1, 1];
    };
    for (const [name, t] of Object.entries(targets)) {
      const bone = built.bones.get(name);
      if (!bone) continue;
      const p = targetOf(bone.parent);
      bone.scale.set(t[0] / p[0], t[1] / p[1], t[2] / p[2]);
    }
  }, [built, build, muscle, heightSlider, body]);

  const clips = useMemo(() => aliasedClips(base.animations), [base]);
  const scale = (height / built.modelHeight) * heightScale(appearance.height);
  const head = built.bones.get("Head") ?? null;
  const hand = built.bones.get("Wrist.R") ?? null;
  /** Converts a size in world units into the local units of a bone (bones can carry their own scale). */
  const local = (bone: THREE.Object3D | null) => {
    if (!bone) return 1;
    const s = new THREE.Vector3();
    built.copy.updateMatrixWorld(true);
    bone.getWorldScale(s);
    return 1 / Math.max(1e-6, s.y);
  };
  const unit = built.modelHeight / 1.8;

  return (
    <>
      <Animated key={built.copy.uuid} model={built.copy} animations={clips} movingRef={movingRef} oneShotRef={oneShotRef} idleClip={idleClip} moveClip={moveClip} height={height} hat={null} headBone={null} scale={scale} speedRef={speedRef} />
      {/* Mounted after Animated (same key) so its frame callback runs after the animation mixer. */}
      {sittingRef || airRef ? <SitPose key={`sit-${built.copy.uuid}`} model={built.copy} bones={built.bones} sittingRef={sittingRef} airRef={airRef} /> : null}
      {hat && head
        ? createPortal(
            <group scale={unit * local(head) * 0.21} position={[0, unit * local(head) * 0.06, 0.01 * unit * local(head)]}>
              <HatMesh hat={hat} />
            </group>,
            head,
          )
        : null}
      {weaponTint && hand
        ? createPortal(
            <group scale={unit * local(hand) * 1.4} position={[0, unit * local(hand) * 0.06, 0]} rotation={[0, 0, Math.PI]}>
              <mesh position={[0, 0.16, 0]} castShadow>
                <cylinderGeometry args={[0.012, 0.018, 0.32, 8]} />
                <meshStandardMaterial color="#5a3a22" roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.33, 0]}>
                <sphereGeometry args={[0.016, 10, 8]} />
                <meshStandardMaterial color={weaponTint} emissive={weaponTint} emissiveIntensity={1.6} toneMapped={false} />
              </mesh>
            </group>,
            hand,
          )
        : null}
      {capeColor ? (
        <group position={[0, height * heightScale(appearance.height) * 0.79, -0.06]}>
          <mesh position={[0, -height * 0.25, -0.02]} rotation={[0.1, 0, 0]} castShadow>
            <cylinderGeometry args={[height * 0.12, height * 0.2, height * 0.52, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
            <meshStandardMaterial color={capeColor} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[height * 0.075, height * 0.012, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#d6a419" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ) : null}
    </>
  );
}

/** Leg rotations for sitting, around the character's own left-right axis: [bone, radians]. */
const SIT_POSE: Array<[string, number]> = [
  ["UpperLeg.L", -Math.PI / 2],
  ["UpperLeg.R", -Math.PI / 2],
  ["LowerLeg.L", Math.PI / 2],
  ["LowerLeg.R", Math.PI / 2],
  ["Torso", 0.06],
];

/** Legs tucked in mid-jump (scaled by how high in the jump you are). */
const AIR_POSE: Array<[string, number]> = [
  ["UpperLeg.L", -0.75],
  ["UpperLeg.R", -0.55],
  ["LowerLeg.L", 1.05],
  ["LowerLeg.R", 0.85],
];

/**
 * Poses the legs as sitting on top of whatever the animation mixer wrote this
 * frame (the models have no sitting clip). If the mixer doesn't animate a bone,
 * its quaternion still holds last frame's pose, so that is undone first.
 */
function SitPose({ model, bones, sittingRef, airRef }: { model: THREE.Object3D; bones: Map<string, THREE.Object3D>; sittingRef?: MutableRefObject<boolean>; airRef?: MutableRefObject<number> }) {
  const tmp = useMemo(
    () => ({ axis: new THREE.Vector3(), root: new THREE.Quaternion(), parent: new THREE.Quaternion(), turn: new THREE.Quaternion(), delta: new THREE.Quaternion(), base: new Map<string, THREE.Quaternion>(), wrote: new Map<string, THREE.Quaternion>() }),
    [],
  );
  useFrame(() => {
    const sitting = sittingRef?.current ?? false;
    const air = sitting ? 0 : Math.max(0, Math.min(1, airRef?.current ?? 0));
    // Undo last frame's pose on bones the mixer left alone.
    for (const [name, wrote] of tmp.wrote) {
      const bone = bones.get(name);
      const base = tmp.base.get(name);
      if (bone && base && bone.quaternion.equals(wrote)) bone.quaternion.copy(base);
    }
    tmp.wrote.clear();
    if (!sitting && air < 0.01) return;
    model.updateMatrixWorld(true);
    model.getWorldQuaternion(tmp.root);
    tmp.axis.set(1, 0, 0).applyQuaternion(tmp.root).normalize();
    const pose = sitting ? SIT_POSE : AIR_POSE.map(([name, angle]): [string, number] => [name, angle * air]);
    for (const [name, angle] of pose) {
      const bone = bones.get(name);
      if (!bone?.parent) continue;
      tmp.base.set(name, bone.quaternion.clone());
      bone.parent.getWorldQuaternion(tmp.parent);
      tmp.turn.setFromAxisAngle(tmp.axis, angle);
      // Local change = parent⁻¹ · turn · parent, applied before the bone's own rotation.
      tmp.delta.copy(tmp.parent).invert().multiply(tmp.turn).multiply(tmp.parent);
      bone.quaternion.premultiply(tmp.delta);
      bone.updateMatrixWorld(true);
      tmp.wrote.set(name, bone.quaternion.clone());
    }
  });
  return null;
}

/** Starts loading a body's animated base file early (the game's first frame needs it). */
export function preloadHuman(appearance: Appearance): void {
  for (const f of appearanceFiles(appearance)) useGLTF.preload(v2AssetUrl(f));
}
