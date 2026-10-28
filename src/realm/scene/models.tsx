/**
 * Real 3D models (KayKit by Kay Lousberg, CC0 — see
 * public/assets/v2/licences/ASSET_LICENCES.md): animated adventurers and
 * medieval buildings. Every model has a code-built fallback that shows
 * while it loads or if the file can't be loaded, so the world never has
 * holes in it.
 */

import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { v2AssetUrl } from "../../game3d/assets/assetUrl";
import type { DyeSlot, OutfitSlot, RegionTheme } from "../types";
import { outfitClasses, partMeshes, resolveOutfit, slotOfMesh } from "../customise/outfit";

import type { AvatarId } from "../types";
export type { AvatarId };

export const AVATARS: Array<{ id: AvatarId; label: string; blurb: string }> = [
  { id: "knight", label: "Knight", blurb: "Steadfast and armoured" },
  { id: "mage", label: "Mage", blurb: "Robed scholar of the arcane" },
  { id: "rogue", label: "Rogue", blurb: "Quick and quiet" },
  { id: "rogue_hooded", label: "Hooded Rogue", blurb: "A mysterious wanderer" },
  { id: "barbarian", label: "Barbarian", blurb: "Strong and fearless" },
];

/** Every animated character file: the five adventurers plus the skeletons (deadline bosses and the squire pet). */
export type CharacterModelId = AvatarId | "skeleton_warrior" | "skeleton_mage" | "skeleton_minion";
const characterUrl = (id: CharacterModelId) => v2AssetUrl(`models/kaykit/characters/${id}.glb`);

export type NatureModelId = "tree-a" | "tree-b" | "trees-a" | "trees-b" | "rock-c" | "rock-e";
export const natureUrl = (id: NatureModelId) => v2AssetUrl(`models/kaykit/nature/${id}.glb`);

export type BuildingModelId = "home-red" | "library-red" | "castle" | "tower-blue" | "lighthouse-blue" | "market-yellow" | "blacksmith-red" | "windmill-green" | "church-blue" | "watermill-yellow" | "tavern-green";
const buildingUrl = (id: BuildingModelId) => v2AssetUrl(`models/kaykit/buildings/${id}.glb`);
export type PropModelId =
  | "target"
  | "weaponrack"
  | "flag-red"
  | "flag-blue"
  | "flag-green"
  | "flag-yellow"
  | "cloud-big"
  | "cloud-small"
  | "tent"
  | "barrel"
  | "crate"
  | "sack";
const propUrl = (id: PropModelId) => v2AssetUrl(`models/kaykit/props/${id}.glb`);

export const THEME_BUILDING: Record<RegionTheme, BuildingModelId> = {
  arcane: "tower-blue",
  guild: "market-yellow",
  forge: "blacksmith-red",
  grove: "windmill-green",
  archive: "church-blue",
  foundry: "watermill-yellow",
  tide: "lighthouse-blue",
  alchemy: "tavern-green",
};

export const THEME_FLAG: Record<RegionTheme, PropModelId> = {
  arcane: "flag-blue",
  guild: "flag-yellow",
  forge: "flag-red",
  grove: "flag-green",
  archive: "flag-blue",
  foundry: "flag-yellow",
  tide: "flag-blue",
  alchemy: "flag-green",
};

export const THEME_TUTOR: Record<RegionTheme, AvatarId> = {
  arcane: "mage",
  guild: "rogue_hooded",
  forge: "barbarian",
  grove: "rogue",
  archive: "mage",
  foundry: "knight",
  tide: "rogue",
  alchemy: "mage",
};

export function preloadRealmModels(avatar: AvatarId, themes: RegionTheme[]): void {
  useGLTF.preload(characterUrl(avatar));
  useGLTF.preload(buildingUrl("castle"));
  for (const id of ["tree-b", "trees-a", "trees-b", "tree-a", "rock-c", "rock-e"] as const) useGLTF.preload(natureUrl(id));
  for (const theme of themes) {
    useGLTF.preload(buildingUrl(THEME_BUILDING[theme]));
    useGLTF.preload(characterUrl(THEME_TUTOR[theme]));
  }
}

// ---------------------------------------------------------------------------
// Fallback handling
// ---------------------------------------------------------------------------

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.warn("[realm] model failed to load, using the code-built fallback:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Renders `children` (a model) with `fallback` while it loads or if it fails. */
export function WithFallback({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ModelBoundary>
  );
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/** Accessory meshes each class keeps visible (weapons and shields are hidden: this is a study game). */
const KEEP_PARTS = /(Body|Head|Arm|Leg|Cape|Cloak|Helmet|Hat|Eyes|Jaw|Skull|Spellbook$)/;
const HEADGEAR = /(Helmet|_Hat)$/;
/** The weapon mesh each class carries when the player has crafted arms. */
const CLASS_WEAPON: Partial<Record<CharacterModelId, string>> = {
  knight: "1H_Sword",
  mage: "2H_Staff",
  rogue: "Knife",
  rogue_hooded: "Knife",
  barbarian: "1H_Axe",
};

export type OneShot = string;
export type HatId = "laurel" | "mortarboard" | "wizard";

interface ModelCharacterProps {
  avatar: CharacterModelId;
  movingRef?: MutableRefObject<boolean>;
  /** Set `.current` to an animation name to play it once; it's cleared when consumed. */
  oneShotRef?: MutableRefObject<OneShot | null>;
  height?: number;
  /** Looping animations for standing and moving. */
  idleClip?: string;
  moveClip?: string;
  /** Recolours the cape (null = the class's own colours). */
  capeColor?: string | null;
  /** A hat from the bazaar; hides the class's own helmet or hat. */
  hat?: HatId | null;
  /** A crafted weapon: shows the class's own weapon model, tinted by its metal. Null = empty-handed. */
  weaponTint?: string | null;
  /** Mix-and-match parts borrowed from other classes (missing slots use the avatar's own). Adventurers only. */
  outfit?: Partial<Record<OutfitSlot, AvatarId | "none">>;
  /** Dye tints per part. */
  dyes?: Partial<Record<DyeSlot, string>>;
}

const BASE_HEIGHT = 2.45;

const capeMaterials = new Map<string, THREE.MeshStandardMaterial>();
function capeMaterial(color: string): THREE.MeshStandardMaterial {
  let material = capeMaterials.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    capeMaterials.set(color, material);
  }
  return material;
}

/** Procedural hats, sized for the KayKit head bone (model units). */
export function HatMesh({ hat }: { hat: HatId }) {
  if (hat === "wizard") {
    // A tall, slightly crooked pointed hat with a wide brim and a band.
    return (
      <group position={[0, 0.78, 0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.05, 32]} />
          <meshStandardMaterial color="#2a2140" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.5, 0.52, 0.14, 24]} />
          <meshStandardMaterial color="#b8860b" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow>
          <coneGeometry args={[0.5, 1.0, 24, 1, true]} />
          <meshStandardMaterial color="#2a2140" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.1, 1.18, -0.05]} rotation={[0.3, 0, -0.5]} castShadow>
          <coneGeometry args={[0.16, 0.42, 16]} />
          <meshStandardMaterial color="#2a2140" roughness={0.85} />
        </mesh>
      </group>
    );
  }
  if (hat === "mortarboard") {
    return (
      <group position={[0, 0.95, 0.02]}>
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.46, 0.28, 20]} />
          <meshStandardMaterial color="#1b1b22" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 0.17, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[1.1, 0.06, 1.1]} />
          <meshStandardMaterial color="#1b1b22" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#e2b23a" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.48, 0.0, 0.18]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.025, 0.04, 0.42, 6]} />
          <meshStandardMaterial color="#e2b23a" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
    );
  }
  const leaves = Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2);
  return (
    <group position={[0, 0.72, 0.02]} rotation={[0.12, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.035, 8, 32]} />
        <meshStandardMaterial color="#5b7a2a" roughness={0.8} />
      </mesh>
      {leaves.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.52, 0.04, Math.sin(a) * 0.52]} rotation={[0.5, -a, 0.6]} scale={[0.09, 0.03, 0.17]} castShadow>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={i % 2 ? "#7fa83a" : "#9cc04a"} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

const NO_OUTFIT: Partial<Record<OutfitSlot, AvatarId | "none">> = {};
const NO_DYES: Partial<Record<DyeSlot, string>> = {};
const ADVENTURERS = new Set<string>(["knight", "mage", "rogue", "rogue_hooded", "barbarian"]);

/** Copies a part from another adventurer's model onto this one's skeleton (all five share one rig). */
function borrowPart(source: THREE.Object3D, target: THREE.Object3D, bones: Map<string, THREE.Object3D>, rig: THREE.Object3D): THREE.Object3D | null {
  const skinned = source as THREE.SkinnedMesh;
  if (skinned.isSkinnedMesh) {
    const part = new THREE.SkinnedMesh(skinned.geometry, skinned.material);
    part.name = skinned.name;
    part.position.copy(skinned.position);
    part.quaternion.copy(skinned.quaternion);
    part.scale.copy(skinned.scale);
    const mapped = skinned.skeleton.bones.map((b) => bones.get(b.name) as THREE.Bone | undefined);
    if (mapped.some((b) => !b)) return null;
    part.bind(new THREE.Skeleton(mapped as THREE.Bone[], skinned.skeleton.boneInverses.map((m) => m.clone())), skinned.bindMatrix.clone());
    rig.add(part);
    return part;
  }
  // Rigid accessories (helmets, hats, capes) hang off a bone.
  const parent = source.parent ? bones.get(source.parent.name) ?? target.getObjectByName(source.parent.name) : null;
  if (!parent) return null;
  const part = source.clone(true);
  parent.add(part);
  return part;
}

export function ModelCharacter({
  avatar,
  movingRef,
  oneShotRef,
  height = 1.38,
  idleClip = "Idle",
  moveClip = "Running_A",
  capeColor = null,
  hat = null,
  weaponTint = null,
  outfit = NO_OUTFIT,
  dyes = NO_DYES,
}: ModelCharacterProps) {
  const isAdventurer = ADVENTURERS.has(avatar);
  const classes = isAdventurer ? outfitClasses(avatar as AvatarId, outfit) : [avatar];
  const gltfs = useGLTF(classes.map((c) => characterUrl(c))) as unknown as Array<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>;
  const { scene, animations } = gltfs[0];
  const outfitKey = isAdventurer ? JSON.stringify(resolveOutfit(avatar as AvatarId, outfit)) : "";
  const model = useMemo(() => {
    const copy = cloneSkinned(scene);
    const bones = new Map<string, THREE.Object3D>();
    let rig: THREE.Object3D | null = null;
    copy.traverse((node) => {
      if ((node as THREE.Bone).isBone) bones.set(node.name, node);
      if (!rig && (node as THREE.SkinnedMesh).isSkinnedMesh) rig = node.parent;
    });
    if (isAdventurer && rig) {
      const resolved = resolveOutfit(avatar as AvatarId, outfit);
      for (const [slot, from] of Object.entries(resolved) as Array<[OutfitSlot, AvatarId | "none"]>) {
        if (from === avatar) continue;
        for (const name of partMeshes(avatar as AvatarId, slot)) {
          const own = copy.getObjectByName(name);
          own?.parent?.remove(own);
        }
        if (from === "none") continue;
        const source = gltfs[classes.indexOf(from)]?.scene;
        if (!source) continue;
        for (const name of partMeshes(from, slot)) {
          const src = source.getObjectByName(name);
          const part = src ? borrowPart(src, copy, bones, rig) : null;
          if (part) part.userData.slot = slot;
        }
      }
    }
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (node.name && !KEEP_PARTS.test(node.name)) node.visible = false;
      if (/Cape$/.test(node.name)) mesh.userData.originalMaterial = mesh.material;
      mesh.userData.baseMaterial = mesh.material;
      if (isAdventurer && !mesh.userData.slot) mesh.userData.slot = slotOfMesh(avatar as AvatarId, node.name);
    });
    return copy;
    // outfitKey stands in for the outfit object; the loaded files change only with the class list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, outfitKey, classes.join(",")]);
  const headBone = useMemo(() => {
    let found: THREE.Object3D | null = null;
    model.traverse((node) => {
      if (!found && (node as THREE.Bone).isBone && node.name === "head") found = node;
    });
    return found as THREE.Object3D | null;
  }, [model]);

  // Cape colour, dyes and headgear follow the wardrobe.
  const dyeKey = JSON.stringify(dyes);
  useEffect(() => {
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const slot = mesh.userData.slot as OutfitSlot | null | undefined;
      const tint = slot && slot !== "cape" && slot !== "head" ? dyes[slot as DyeSlot] : undefined;
      if (/Cape$/.test(node.name)) {
        const original = mesh.userData.originalMaterial as THREE.Material;
        mesh.material = capeColor ? capeMaterial(capeColor) : original;
      } else if (tint) {
        const base = mesh.userData.baseMaterial as THREE.MeshStandardMaterial;
        const cache = (mesh.userData.dyed ??= {}) as Record<string, THREE.MeshStandardMaterial>;
        cache[tint] ??= base.clone();
        cache[tint].color.set(tint);
        mesh.material = cache[tint];
      } else if (mesh.userData.baseMaterial && node.name !== CLASS_WEAPON[avatar]) {
        mesh.material = mesh.userData.baseMaterial as THREE.Material;
      }
      if (HEADGEAR.test(node.name)) node.visible = !hat;
      if (node.name === CLASS_WEAPON[avatar]) {
        node.visible = Boolean(weaponTint);
        if (weaponTint) {
          mesh.userData.weaponMaterial ??= (mesh.material as THREE.MeshStandardMaterial).clone();
          const material = mesh.userData.weaponMaterial as THREE.MeshStandardMaterial;
          material.color.set(weaponTint);
          material.metalness = 0.55;
          material.roughness = 0.35;
          mesh.material = material;
        }
      }
    });
    // dyeKey stands in for the dyes object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, capeColor, hat, weaponTint, avatar, dyeKey]);

  // A fresh animator per built model: the mixer binds to the bones of the model it first sees.
  return (
    <Animated
      key={model.uuid}
      model={model}
      animations={animations}
      movingRef={movingRef}
      oneShotRef={oneShotRef}
      idleClip={idleClip}
      moveClip={moveClip}
      height={height}
      hat={hat}
      headBone={headBone}
    />
  );
}

interface AnimatedProps {
  model: THREE.Object3D;
  animations: THREE.AnimationClip[];
  movingRef?: MutableRefObject<boolean>;
  oneShotRef?: MutableRefObject<OneShot | null>;
  idleClip: string;
  moveClip: string;
  height: number;
  hat: HatId | null;
  headBone: THREE.Object3D | null;
  /** Overrides the model scale (default: fits the KayKit adventurers to `height`). */
  scale?: number;
  /** How fast the character is going relative to normal walking (1); the move clip plays in step with it. */
  speedRef?: MutableRefObject<number>;
}

export function Animated({ model, animations, movingRef, oneShotRef, idleClip, moveClip, height, hat, headBone, scale, speedRef }: AnimatedProps) {
  const root = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, root);
  const current = useRef<string>("");
  const oneShotUntil = useRef(0);

  useEffect(() => {
    const idle = actions[idleClip];
    idle?.reset().play();
    current.current = idleClip;
    return () => {
      mixer.stopAllAction();
    };
  }, [actions, mixer, idleClip]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const requested = oneShotRef?.current;
    if (requested && actions[requested]) {
      oneShotRef!.current = null;
      const action = actions[requested]!;
      action.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.15).play();
      action.clampWhenFinished = true;
      if (current.current && actions[current.current]) actions[current.current]!.fadeOut(0.15);
      current.current = requested;
      oneShotUntil.current = now + action.getClip().duration * 0.92;
      return;
    }
    if (now < oneShotUntil.current) return;
    // Feet in step with the ground: the run plays faster when sprinting, slower while speeding up.
    const move = actions[moveClip];
    if (move && speedRef) move.setEffectiveTimeScale(Math.max(0.55, Math.min(1.6, speedRef.current)));
    const want = movingRef?.current ? moveClip : idleClip;
    if (want !== current.current && actions[want]) {
      actions[want]!.reset().fadeIn(0.2).play();
      if (current.current && actions[current.current]) actions[current.current]!.fadeOut(0.2);
      current.current = want;
    }
  });

  return (
    <group ref={root} scale={scale ?? height / BASE_HEIGHT}>
      <primitive object={model} />
      {hat && headBone ? createPortal(<HatMesh hat={hat} />, headBone) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Buildings and props
// ---------------------------------------------------------------------------

function useStaticModel(url: string): { object: THREE.Object3D; size: THREE.Vector3; minY: number } {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const object = scene.clone(true);
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    return { object, size, minY: box.min.y };
  }, [scene]);
}

/** A building scaled so its larger side spans `span` tiles, standing on the ground. */
export function BuildingModel({ id, span, rotation = 0 }: { id: BuildingModelId; span: number; rotation?: number }) {
  const { object, size, minY } = useStaticModel(buildingUrl(id));
  const scale = span / Math.max(size.x, size.z);
  const spinners = useMemo(() => {
    const list: THREE.Object3D[] = [];
    object.traverse((node) => {
      if (/fan|wheel/i.test(node.name)) list.push(node);
    });
    return list;
  }, [object]);
  useFrame((_, delta) => {
    for (const node of spinners) {
      if (/wheel/i.test(node.name)) node.rotation.x -= delta * 0.8;
      else node.rotation.z += delta * 0.9;
    }
  });
  return (
    <group rotation={[0, rotation, 0]} scale={scale} position={[0, -minY * scale, 0]}>
      <primitive object={object} />
    </group>
  );
}

/** A single tree or rock from the nature set, standing on the ground. */
export function NatureModel({ id, height, rotation = 0, tint }: { id: NatureModelId; height: number; rotation?: number; tint?: string }) {
  const { object, size, minY } = useStaticModel(natureUrl(id));
  const scale = height / size.y;
  // Tinted copies (e.g. autumn maples) get their own materials so other trees keep their colours.
  useEffect(() => {
    if (!tint) return;
    const target = new THREE.Color(tint);
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      const copy = material.clone();
      copy.color = material.color.clone().lerp(target, 0.55);
      mesh.material = copy;
    });
  }, [object, tint]);
  return (
    <group rotation={[0, rotation, 0]} scale={scale} position={[0, -minY * scale, 0]}>
      <primitive object={object} />
    </group>
  );
}

export function PropModel({ id, height, position = [0, 0, 0], rotation = 0 }: { id: PropModelId; height: number; position?: [number, number, number]; rotation?: number }) {
  const { object, size, minY } = useStaticModel(propUrl(id));
  const scale = height / size.y;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group scale={scale} position={[0, -minY * scale, 0]}>
        <primitive object={object} />
      </group>
    </group>
  );
}
