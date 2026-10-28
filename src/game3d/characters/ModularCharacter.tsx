/**
 * Modular, catalogue-driven character (Phase 20B, Part 3/4). Wraps the
 * locked-proportion `PlaceholderCharacter` body and layers
 * hair/clothing/accessories on top of it via that component's content
 * slots (headSlot/torsoSlot/arm*Slot/leg*Slot) — every layer follows
 * whichever pivot it's attached to automatically, since it's rendered
 * INSIDE that pivot's group, not positioned independently.
 *
 * Honest framing (see also characterRig.ts's header): every shape below
 * is a small composition of primitives (spheres/boxes/cones/capsules),
 * not sculpted character art — consistent with the brief's "Do NOT create
 * hundreds of clothing items... build only the reusable modular system,"
 * and with docs/UNIGAME_ART_BIBLE.md Part 13's asset pipeline, which
 * expects these to be replaced by real GLB models in a later milestone
 * without any save data or catalogue id changing (catalogue ids are
 * already the stable contract — only what renders for a given id changes
 * when real art lands).
 *
 * NPCs and the player use this exact same component — see
 * `NpcCharacter.tsx` and `TestRoomScene.tsx` — which is what makes "NPCs
 * should also use... appearance catalogue... shared skeleton" (Part 11)
 * true by construction rather than by convention.
 */

import { forwardRef } from "react";
import type { Group } from "three";
import { RoundedBox } from "@react-three/drei";
import {
  findBodyPreset,
  findEyebrowOption,
  findEyeOption,
  findFacialHairOption,
  findHairColor,
  findOption,
  findSkinTone,
  type AppearanceOption,
} from "../../data/appearanceCatalogue";
import { PlaceholderCharacter } from "./PlaceholderCharacter";
import type { CharacterAppearance } from "../../types/domain";

interface ModularCharacterProps {
  appearance: CharacterAppearance;
  label: string;
  headPivotRef?: React.Ref<Group>;
  armLeftPivotRef?: React.Ref<Group>;
  armRightPivotRef?: React.Ref<Group>;
  legLeftPivotRef?: React.Ref<Group>;
  legRightPivotRef?: React.Ref<Group>;
}

// ---------------------------------------------------------------------------
// Hair (9 shapes) — a small cranium-hugging cap, several with a back/tail
// extension. All positions are local to the head pivot (see
// PlaceholderCharacter.tsx: head sphere centre is at [0, 0.3, 0] within
// that pivot, radius 0.3, face is +Z).
// ---------------------------------------------------------------------------

function renderHair(option: AppearanceOption | undefined, colorHex: string) {
  if (!option) return null;
  const v = option.variant ?? 0.5;
  const color = option.tags.includes("modest") ? option.colors.primary ?? colorHex : colorHex;
  const cap = (heightScale: number, yOffset = 0) => (
    <mesh position={[0, 0.53 + yOffset, 0]} scale={[1.03, heightScale, 1.03]} castShadow>
      <sphereGeometry args={[0.31, 12, 10]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
    </mesh>
  );

  switch (option.shape) {
    case "short-crop":
      return cap(0.55 + v * 0.15);
    case "side-part":
      return (
        <group position={[0.015, 0, 0]}>
          {cap(0.6)}
        </group>
      );
    case "medium-straight":
    case "medium-wavy":
      return (
        <>
          {cap(0.62)}
          <RoundedBox args={[0.34, 0.26 + v * 0.08, 0.12]} radius={0.07} smoothness={2} position={[0, 0.36, -0.2]} castShadow>
            <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
          </RoundedBox>
        </>
      );
    case "long-straight":
    case "long-wavy":
      return (
        <>
          {cap(0.62)}
          <RoundedBox args={[0.36, 0.5 + v * 0.15, 0.13]} radius={0.08} smoothness={2} position={[0, 0.16, -0.21]} castShadow>
            <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
          </RoundedBox>
        </>
      );
    case "ponytail":
      return (
        <>
          {cap(0.58)}
          <mesh position={[0, 0.3, -0.28]} rotation={[0.5, 0, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.32, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
          </mesh>
        </>
      );
    case "bun":
      return (
        <>
          {cap(0.58)}
          <mesh position={[0, 0.62, -0.16]} castShadow>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
          </mesh>
        </>
      );
    case "curly": {
      const bump = (x: number, y: number, z: number, r: number) => (
        <mesh key={`${x}-${y}-${z}`} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 8, 7]} />
          <meshStandardMaterial color={color} roughness={0.95} metalness={0} flatShading />
        </mesh>
      );
      const r = 0.13 + v * 0.05;
      return (
        <>
          {bump(0, 0.6, 0, r)}
          {bump(-0.16, 0.53, 0.05, r * 0.85)}
          {bump(0.16, 0.53, 0.05, r * 0.85)}
          {bump(0, 0.5, -0.2, r * 0.9)}
          {bump(-0.1, 0.62, -0.12, r * 0.75)}
          {bump(0.1, 0.62, -0.12, r * 0.75)}
        </>
      );
    }
    case "headscarf-drape":
      return (
        <>
          {cap(0.75, 0.03)}
          <RoundedBox args={[0.4, 0.55, 0.16]} radius={0.1} smoothness={2} position={[0, 0.18, -0.2]} castShadow>
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
          </RoundedBox>
        </>
      );
    case "headscarf-wrap":
      return (
        <>
          {cap(0.78, 0.03)}
          <RoundedBox args={[0.36, 0.3, 0.14]} radius={0.1} smoothness={2} position={[0, 0.34, -0.18]} castShadow>
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
          </RoundedBox>
        </>
      );
    default:
      return cap(0.6);
  }
}

// ---------------------------------------------------------------------------
// Eyebrows + facial hair — small head-slot extras, coloured from the same
// hair colour selection (no separate eyebrow-colour catalogue — matching
// real faces closely enough for this style, and one fewer picker for the
// player).
// ---------------------------------------------------------------------------

function renderEyebrows(shape: "thin" | "medium" | "thick" | "angled" | undefined, colorHex: string) {
  if (!shape) return null;
  const thickness = shape === "thin" ? 0.012 : shape === "thick" ? 0.028 : 0.02;
  const tilt = shape === "angled" ? 0.25 : 0;
  return (
    <>
      <mesh position={[-0.09, 0.41, 0.28]} rotation={[0, 0, tilt]}>
        <boxGeometry args={[0.09, thickness, 0.015]} />
        <meshStandardMaterial color={colorHex} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0.09, 0.41, 0.28]} rotation={[0, 0, -tilt]}>
        <boxGeometry args={[0.09, thickness, 0.015]} />
        <meshStandardMaterial color={colorHex} roughness={1} metalness={0} />
      </mesh>
    </>
  );
}

function renderFacialHair(shape: "stubble" | "goatee" | "moustache" | "full-beard" | undefined, colorHex: string) {
  if (!shape) return null;
  switch (shape) {
    case "stubble":
      return (
        <mesh position={[0, 0.14, 0.22]} scale={[0.85, 0.55, 0.6]} castShadow>
          <sphereGeometry args={[0.24, 10, 8]} />
          <meshStandardMaterial color={colorHex} roughness={1} metalness={0} transparent opacity={0.55} />
        </mesh>
      );
    case "goatee":
      return (
        <RoundedBox args={[0.14, 0.16, 0.1]} radius={0.03} position={[0, 0.08, 0.24]} castShadow>
          <meshStandardMaterial color={colorHex} roughness={0.95} metalness={0} />
        </RoundedBox>
      );
    case "moustache":
      return (
        <RoundedBox args={[0.2, 0.045, 0.05]} radius={0.02} position={[0, 0.25, 0.28]} castShadow>
          <meshStandardMaterial color={colorHex} roughness={0.95} metalness={0} />
        </RoundedBox>
      );
    case "full-beard":
      return (
        <mesh position={[0, 0.1, 0.2]} scale={[1, 0.75, 0.7]} castShadow>
          <sphereGeometry args={[0.27, 12, 10]} />
          <meshStandardMaterial color={colorHex} roughness={0.95} metalness={0} />
        </mesh>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tops / jackets — torso-slot layers, positioned local to the torso group
// (torso RoundedBox centre [0, 0.31, 0]).
// ---------------------------------------------------------------------------

function renderTop(option: AppearanceOption | undefined) {
  if (!option) return null;
  const color = option.colors.primary ?? "#c9c2b3";
  const longSleeve = option.shape === "long-sleeve-crew" || option.shape === "tunic-long";
  const long = option.shape === "tunic-long";
  return (
    <>
      <RoundedBox args={[0.5, long ? 0.6 : 0.46, 0.36]} radius={0.09} smoothness={2} position={[0, long ? 0.08 : 0.31, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </RoundedBox>
      {longSleeve ? (
        <>
          <mesh position={[-0.29, 0.34, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
          </mesh>
          <mesh position={[0.29, 0.34, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
          </mesh>
        </>
      ) : null}
    </>
  );
}

function renderJacket(option: AppearanceOption | null) {
  if (!option) return null;
  const color = option.colors.primary ?? "#4a4a4a";
  return (
    <RoundedBox args={[0.54, 0.44, 0.38]} radius={0.09} smoothness={2} position={[0, 0.31, 0.01]} castShadow>
      <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
    </RoundedBox>
  );
}

function renderBottom(option: AppearanceOption | undefined) {
  if (!option) return null;
  const color = option.colors.primary ?? "#3d5a73";
  const isSkirt = option.shape === "long-skirt";
  const isLoose = option.shape === "loose-trousers";
  if (isSkirt) {
    return (
      <mesh position={[0, -0.02, 0]} castShadow>
        <coneGeometry args={[0.32, 0.42, 12, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} side={2} />
      </mesh>
    );
  }
  return (
    <RoundedBox
      args={[isLoose ? 0.5 : 0.42, 0.28, isLoose ? 0.42 : 0.34]}
      radius={0.07}
      smoothness={2}
      position={[0, 0.02, 0]}
      castShadow
    >
      <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
    </RoundedBox>
  );
}

// ---------------------------------------------------------------------------
// Shoes — leg-slot layers, local to each leg pivot (foot centre roughly
// [0, -0.09, 0.03] within the pivot, matching PlaceholderCharacter's own
// default shoe placement).
// ---------------------------------------------------------------------------

function renderShoe(option: AppearanceOption | undefined) {
  if (!option) return null;
  const color = option.colors.primary ?? "#2b2b33";
  switch (option.shape) {
    case "boots":
      return (
        <RoundedBox args={[0.19, 0.16, 0.29]} radius={0.03} smoothness={2} position={[0, -0.06, 0.03]} castShadow>
          <meshStandardMaterial color={color} roughness={1} metalness={0} />
        </RoundedBox>
      );
    case "sandals":
      return (
        <mesh position={[0, -0.11, 0.03]} castShadow>
          <boxGeometry args={[0.18, 0.03, 0.28]} />
          <meshStandardMaterial color={color} roughness={1} metalness={0} />
        </mesh>
      );
    case "loafers":
    case "sneakers":
    default:
      return (
        <RoundedBox args={[0.18, 0.1, 0.28]} radius={0.04} smoothness={2} position={[0, -0.09, 0.03]} castShadow>
          <meshStandardMaterial color={color} roughness={option.shape === "loafers" ? 0.7 : 1} metalness={0} />
        </RoundedBox>
      );
  }
}

// ---------------------------------------------------------------------------
// Accessories — routed to whichever slot suits them; head accessories
// (glasses/earrings/headwear) go through headSlot, torso-worn ones through
// torsoSlot, wrist ones through an arm slot.
// ---------------------------------------------------------------------------

const HEAD_ACCESSORY_SHAPES = new Set(["glasses", "earrings", "cap", "beanie", "headphones"]);
const ARM_ACCESSORY_SHAPES = new Set(["watch", "bracelet", "wristband"]);

function renderAccessory(option: AppearanceOption) {
  const color = option.colors.primary ?? "#9a9490";
  switch (option.shape) {
    case "glasses":
      return (
        <group key={option.id} position={[0, 0.33, 0.3]}>
          <mesh position={[-0.09, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 8, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
          </mesh>
          <mesh position={[0.09, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 8, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
          </mesh>
        </group>
      );
    case "earrings":
      return (
        <group key={option.id}>
          <mesh position={[-0.29, 0.3, 0.05]}>
            <sphereGeometry args={[0.015, 6, 6]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0} />
          </mesh>
          <mesh position={[0.29, 0.3, 0.05]}>
            <sphereGeometry args={[0.015, 6, 6]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0} />
          </mesh>
        </group>
      );
    case "cap":
      return (
        <group key={option.id}>
          <mesh position={[0, 0.56, 0]} scale={[1.08, 0.5, 1.08]} castShadow>
            <sphereGeometry args={[0.32, 12, 10]} />
            <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
          </mesh>
          <mesh position={[0, 0.48, 0.28]} rotation={[1.4, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 12, 1, true]} />
            <meshStandardMaterial color={color} roughness={0.95} metalness={0} side={2} />
          </mesh>
        </group>
      );
    case "beanie":
      return (
        <mesh key={option.id} position={[0, 0.55, 0]} scale={[1.06, 0.62, 1.06]} castShadow>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial color={color} roughness={1} metalness={0} />
        </mesh>
      );
    case "headphones":
      return (
        <mesh key={option.id} position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.02, 8, 16, Math.PI]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0} />
        </mesh>
      );
    case "lanyard":
      return (
        <mesh key={option.id} position={[0, 0.42, 0.17]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.03, 0.35, 0.01]} />
          <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
        </mesh>
      );
    case "backpack":
      return (
        <group key={option.id}>
          <mesh position={[-0.1, 0.4, -0.05]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.03, 0.3, 0.02]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
          </mesh>
          <mesh position={[0.1, 0.4, -0.05]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.03, 0.3, 0.02]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
          </mesh>
        </group>
      );
    case "tie":
      return (
        <mesh key={option.id} position={[0, 0.32, 0.18]}>
          <boxGeometry args={[0.05, 0.28, 0.015]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0} />
        </mesh>
      );
    case "bow":
      return (
        <mesh key={option.id} position={[0, 0.47, 0.17]}>
          <boxGeometry args={[0.09, 0.04, 0.03]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
        </mesh>
      );
    case "pin":
      return (
        <mesh key={option.id} position={[0.14, 0.42, 0.16]}>
          <circleGeometry args={[0.025, 10]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
        </mesh>
      );
    case "scarf":
      return (
        <mesh key={option.id} position={[0, 0.46, 0.02]} castShadow>
          <torusGeometry args={[0.19, 0.05, 8, 14]} />
          <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
        </mesh>
      );
    case "flower":
      return (
        <mesh key={option.id} position={[0.16, 0.5, 0.14]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
        </mesh>
      );
    case "brooch":
      return (
        <mesh key={option.id} position={[-0.14, 0.42, 0.17]}>
          <circleGeometry args={[0.028, 10]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
        </mesh>
      );
    case "pocket-square":
      return (
        <mesh key={option.id} position={[0.13, 0.4, 0.18]} rotation={[0, 0, 0.2]}>
          <planeGeometry args={[0.06, 0.06]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
        </mesh>
      );
    case "watch":
      return (
        <mesh key={option.id} position={[0, -0.16, 0]}>
          <torusGeometry args={[0.075, 0.012, 6, 10]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
        </mesh>
      );
    case "bracelet":
      return (
        <mesh key={option.id} position={[0, -0.16, 0]}>
          <torusGeometry args={[0.075, 0.008, 6, 10]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0} />
        </mesh>
      );
    case "wristband":
      return (
        <mesh key={option.id} position={[0, -0.16, 0]}>
          <torusGeometry args={[0.075, 0.014, 6, 10]} />
          <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
        </mesh>
      );
    default:
      return null;
  }
}

export const ModularCharacter = forwardRef<Group, ModularCharacterProps>(function ModularCharacter(
  { appearance, label, headPivotRef, armLeftPivotRef, armRightPivotRef, legLeftPivotRef, legRightPivotRef },
  ref
) {
  const body = findBodyPreset(appearance.bodyId);
  const skin = findSkinTone(appearance.skinToneId);
  const hair = findOption("hair", appearance.hairId);
  const hairColor = findHairColor(appearance.hairColorId)?.hex ?? "#3f2c22";
  const eyes = findEyeOption(appearance.eyesId);
  const eyebrows = findEyebrowOption(appearance.eyebrowsId);
  const facialHair = appearance.facialHairId ? findFacialHairOption(appearance.facialHairId) : undefined;
  const top = findOption("top", appearance.topId);
  const jacket = appearance.jacketId ? findOption("jacket", appearance.jacketId) ?? null : null;
  const bottom = findOption("bottom", appearance.bottomId);
  const shoes = findOption("shoes", appearance.shoesId);
  const accessories = appearance.accessoryIds.map((id) => findOption("accessory", id)).filter((o): o is AppearanceOption => Boolean(o));

  // Phase 20F (visual audit finding) — a full-coverage hairstyle (a
  // headscarf) lists which accessories it clips against via its own
  // catalogue entry; dropped here rather than left to render an
  // overlapping mesh. Purely catalogue-driven — this file never names a
  // specific hairstyle or accessory id itself.
  const incompatibleWithHair = new Set(hair?.incompatibleAccessories ?? []);
  const compatibleAccessories = accessories.filter((a) => !incompatibleWithHair.has(a.id));

  const headAccessories = compatibleAccessories.filter((a) => HEAD_ACCESSORY_SHAPES.has(a.shape));
  const armAccessories = compatibleAccessories.filter((a) => ARM_ACCESSORY_SHAPES.has(a.shape));
  const torsoAccessories = compatibleAccessories.filter((a) => !HEAD_ACCESSORY_SHAPES.has(a.shape) && !ARM_ACCESSORY_SHAPES.has(a.shape));
  // Phase 20F — when a jacket is worn, nudge torso accessories forward by
  // its own `jacketLayerOffset` so they sit visibly on the jacket's front
  // face instead of z-fighting against it.
  const torsoAccessoryOffsetZ = jacket?.jacketLayerOffset ?? 0;

  const heightScale = body?.heightScale ?? 1;

  return (
    <group scale={[heightScale, heightScale, heightScale]}>
      <PlaceholderCharacter
        ref={ref}
        label={label}
        bodyColor={top?.colors.primary ?? "#c9c2b3"}
        skinColor={skin?.hex}
        eyeColor={eyes?.hex}
        eyeScale={eyes?.variant}
        torsoWidthScale={body?.torsoWidthScale ?? 1}
        showDefaultShoes={false}
        headPivotRef={headPivotRef}
        armLeftPivotRef={armLeftPivotRef}
        armRightPivotRef={armRightPivotRef}
        legLeftPivotRef={legLeftPivotRef}
        legRightPivotRef={legRightPivotRef}
        headSlot={
          <>
            {renderHair(hair, hairColor)}
            {renderEyebrows(eyebrows?.shape, hairColor)}
            {facialHair ? renderFacialHair(facialHair.shape, hairColor) : null}
            {headAccessories.map(renderAccessory)}
          </>
        }
        torsoSlot={
          <>
            {renderTop(top)}
            {renderJacket(jacket)}
            {renderBottom(bottom)}
            <group position={[0, 0, torsoAccessoryOffsetZ]}>{torsoAccessories.map(renderAccessory)}</group>
          </>
        }
        armRightSlot={<>{armAccessories.map(renderAccessory)}</>}
        legLeftSlot={renderShoe(shoes)}
        legRightSlot={renderShoe(shoes)}
      />
    </group>
  );
});
