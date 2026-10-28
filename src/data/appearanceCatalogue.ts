/**
 * Appearance catalogue (Phase 20B, Part 4/5). Every option here is a
 * CATALOGUE ID — `CharacterAppearance` (src/types/domain.ts) only ever
 * stores these ids, never a mesh path, per the brief's explicit "no mesh
 * paths inside save files."
 *
 * Rendering approach (documented honestly, not overstated): rather than
 * one bespoke 3D mesh per catalogue entry — which the brief explicitly
 * rules out ("Do NOT create hundreds of clothing items... build only the
 * reusable modular system and the initial curated catalogue") — every
 * entry picks a small, shared `shape` (rendered by `ModularCharacter.tsx`,
 * one renderer function per shape key) plus its own colours and an
 * optional 0–1 `variant` the shape renderer can use to vary proportions
 * (hair length, sleeve looseness, trouser width) without needing a new
 * shape key. This is exactly the "reusable material system... never
 * create dozens of almost-identical materials" principle from
 * docs/UNIGAME_ART_BIBLE.md Part 5, applied to garments/hair instead of
 * materials. It's what makes ~97 curated entries achievable without
 * hundreds of unique meshes, while still giving every entry its own
 * stable id, label, and look.
 *
 * Modest options (Part 6) are woven into their normal category — a
 * headscarf is a `hair` entry like any hairstyle (so selecting it is
 * mutually exclusive with every other hairstyle, which is what prevents
 * hair/headscarf clipping: only one hair-slot shape ever renders at a
 * time, by construction, not by a runtime collision check), and modest
 * tops/bottoms are `top`/`bottom` entries tagged "modest" alongside every
 * other option in those same categories — never a separate tab.
 */

export type AppearanceCategory =
  | "body"
  | "skinTone"
  | "hair"
  | "hairColor"
  | "eyes"
  | "eyebrows"
  | "facialHair"
  | "top"
  | "jacket"
  | "bottom"
  | "shoes"
  | "accessory";

export interface AppearanceOption {
  id: string;
  label: string;
  category: AppearanceCategory;
  /** Shared shape/renderer key — see the file header. */
  shape: string;
  /** 0–1; shape renderers may use this to vary proportions. Defaults to 0.5 (a neutral middle) when omitted. */
  variant?: number;
  /** Named colour slots a shape renderer reads (e.g. `primary`, `accent`) — every hex here follows docs/UNIGAME_ART_BIBLE.md's material rules (matte, never a neon/hyper-saturated value). */
  colors: Record<string, string>;
  tags: string[];
  /**
   * Phase 20F (visual audit finding) — accessory ids this option is known
   * to clip against, so `ModularCharacter.tsx` can drop them rather than
   * render an overlapping mesh. Catalogue-driven: the renderer only ever
   * reads this list, never hardcodes a specific id/shape pair itself.
   */
  incompatibleAccessories?: string[];
  /** Phase 20F — for `hair` options only: "full" marks a hairstyle that covers the whole head (a headscarf), used to gate head-worn accessories via `incompatibleAccessories` above. Omitted/`"none"` = a normal hairstyle. */
  modestCoverageClass?: "none" | "full";
  /** Phase 20F — for `jacket` options only: how far (world Z, metres) to nudge a torso accessory forward so it sits visibly on the jacket's front face instead of clipping into it. */
  jacketLayerOffset?: number;
}

export interface ColorPreset {
  id: string;
  label: string;
  hex: string;
}

// ---------------------------------------------------------------------------
// Body (5 presets — Part 5). All share the exact Part 3 / PlaceholderCharacter
// proportions (head:torso ratio 1.43 is never varied); a body preset only
// adjusts overall scale and torso width, never the locked silhouette ratio.
// ---------------------------------------------------------------------------

export interface BodyPreset {
  id: string;
  label: string;
  /** Uniform scale applied to the whole locked silhouette (Part 3). */
  heightScale: number;
  /** Torso width multiplier only — head/limb proportions never change. */
  torsoWidthScale: number;
}

export const BODY_PRESETS: BodyPreset[] = [
  { id: "body-a", label: "Build A", heightScale: 0.94, torsoWidthScale: 0.92 },
  { id: "body-b", label: "Build B", heightScale: 1.0, torsoWidthScale: 1.0 },
  { id: "body-c", label: "Build C", heightScale: 1.06, torsoWidthScale: 1.0 },
  { id: "body-d", label: "Build D", heightScale: 1.0, torsoWidthScale: 1.12 },
  { id: "body-e", label: "Build E", heightScale: 1.1, torsoWidthScale: 1.08 },
];

// ---------------------------------------------------------------------------
// Skin tones (8) and hair colours (10) — plain colour presets, applied
// orthogonally to whichever body/hair shape is selected.
// ---------------------------------------------------------------------------

export const SKIN_TONES: ColorPreset[] = [
  { id: "skin-01", label: "Porcelain", hex: "#f6d9bf" },
  { id: "skin-02", label: "Fair", hex: "#f4c9a0" },
  { id: "skin-03", label: "Warm Beige", hex: "#e8b78a" },
  { id: "skin-04", label: "Golden Tan", hex: "#d59d6e" },
  { id: "skin-05", label: "Caramel", hex: "#b97d51" },
  { id: "skin-06", label: "Sienna", hex: "#96603c" },
  { id: "skin-07", label: "Deep Brown", hex: "#714427" },
  { id: "skin-08", label: "Espresso", hex: "#4f2e1c" },
];

export const HAIR_COLORS: ColorPreset[] = [
  { id: "haircolor-black", label: "Black", hex: "#2b2320" },
  { id: "haircolor-darkbrown", label: "Dark Brown", hex: "#3f2c22" },
  { id: "haircolor-brown", label: "Brown", hex: "#5a3d2b" },
  { id: "haircolor-chestnut", label: "Chestnut", hex: "#7a4b32" },
  { id: "haircolor-auburn", label: "Auburn", hex: "#8a4a2f" },
  { id: "haircolor-ginger", label: "Ginger", hex: "#b8632f" },
  { id: "haircolor-honeyblonde", label: "Honey Blonde", hex: "#c99a52" },
  { id: "haircolor-platinum", label: "Platinum Blonde", hex: "#e3d3ad" },
  { id: "haircolor-grey", label: "Grey", hex: "#9a958c" },
  { id: "haircolor-navy-tint", label: "Blue-Black", hex: "#262a33" },
];

// ---------------------------------------------------------------------------
// Eyes (8) and eyebrows (6) — small preset lists; current rendering is the
// simple two-dot "simple face" from Part 3, so these mostly vary colour
// and a size/shape `variant`.
// ---------------------------------------------------------------------------

export interface EyeOption {
  id: string;
  label: string;
  hex: string;
  /** 0–1: eye size, smaller = more subtle. */
  variant: number;
}

export const EYE_OPTIONS: EyeOption[] = [
  { id: "eyes-dark-brown", label: "Dark Brown", hex: "#2c2320", variant: 0.5 },
  { id: "eyes-brown", label: "Brown", hex: "#4a3324", variant: 0.5 },
  { id: "eyes-hazel", label: "Hazel", hex: "#6b5738", variant: 0.5 },
  { id: "eyes-green", label: "Green", hex: "#4a6b4f", variant: 0.5 },
  { id: "eyes-blue", label: "Blue", hex: "#3d5a73", variant: 0.5 },
  { id: "eyes-grey", label: "Grey", hex: "#5c5f63", variant: 0.5 },
  { id: "eyes-amber", label: "Amber", hex: "#8a5a2a", variant: 0.5 },
  { id: "eyes-large-dark", label: "Large & Dark", hex: "#2c2320", variant: 0.75 },
];

export interface EyebrowOption {
  id: string;
  label: string;
  shape: "thin" | "medium" | "thick" | "angled";
}

export const EYEBROW_OPTIONS: EyebrowOption[] = [
  { id: "brow-thin", label: "Thin", shape: "thin" },
  { id: "brow-medium", label: "Medium", shape: "medium" },
  { id: "brow-thick", label: "Thick", shape: "thick" },
  { id: "brow-angled", label: "Angled", shape: "angled" },
  { id: "brow-soft-arch", label: "Soft Arch", shape: "medium" },
  { id: "brow-straight", label: "Straight", shape: "thin" },
];

// ---------------------------------------------------------------------------
// Facial hair (5 real options — "None" is represented at the type level by
// `facialHairId: null`, not a catalogue entry, so the UI's "None" choice
// never needs a fake sentinel id).
// ---------------------------------------------------------------------------

export interface FacialHairOption {
  id: string;
  label: string;
  shape: "stubble" | "goatee" | "moustache" | "full-beard";
}

export const FACIAL_HAIR_OPTIONS: FacialHairOption[] = [
  { id: "facial-stubble", label: "Stubble", shape: "stubble" },
  { id: "facial-goatee", label: "Goatee", shape: "goatee" },
  { id: "facial-moustache", label: "Moustache", shape: "moustache" },
  { id: "facial-full-beard", label: "Full Beard", shape: "full-beard" },
  { id: "facial-light-beard", label: "Light Beard", shape: "full-beard" },
];

// ---------------------------------------------------------------------------
// Hair (15) — 9 shape renderers stretched to 15 named entries via `variant`.
// Two entries (headscarf-drape, headscarf-wrap) are the Part 6 modest
// option, tagged "modest" but living in this exact same list — never a
// separate category.
// ---------------------------------------------------------------------------

export const HAIR_OPTIONS: AppearanceOption[] = [
  { id: "hair-short-crop", label: "Short Crop", category: "hair", shape: "short-crop", variant: 0.4, colors: {}, tags: ["casual"] },
  { id: "hair-short-textured", label: "Short Textured", category: "hair", shape: "short-crop", variant: 0.6, colors: {}, tags: ["casual"] },
  { id: "hair-side-part", label: "Side Part", category: "hair", shape: "side-part", variant: 0.5, colors: {}, tags: ["casual", "formal"] },
  { id: "hair-swept-back", label: "Swept Back", category: "hair", shape: "side-part", variant: 0.7, colors: {}, tags: ["formal"] },
  { id: "hair-medium-straight", label: "Medium Straight", category: "hair", shape: "medium-straight", variant: 0.5, colors: {}, tags: ["casual"] },
  { id: "hair-medium-wavy", label: "Medium Wavy", category: "hair", shape: "medium-wavy", variant: 0.5, colors: {}, tags: ["casual"] },
  { id: "hair-long-straight", label: "Long Straight", category: "hair", shape: "long-straight", variant: 0.5, colors: {}, tags: ["casual"] },
  { id: "hair-long-sleek", label: "Long Sleek", category: "hair", shape: "long-straight", variant: 0.75, colors: {}, tags: ["formal"] },
  { id: "hair-long-wavy", label: "Long Wavy", category: "hair", shape: "long-wavy", variant: 0.5, colors: {}, tags: ["casual"] },
  { id: "hair-ponytail", label: "Ponytail", category: "hair", shape: "ponytail", variant: 0.5, colors: {}, tags: ["casual", "sporty"] },
  { id: "hair-bun", label: "Bun", category: "hair", shape: "bun", variant: 0.5, colors: {}, tags: ["formal", "sporty"] },
  { id: "hair-curly", label: "Curly", category: "hair", shape: "curly", variant: 0.5, colors: {}, tags: ["casual"] },
  { id: "hair-tight-curls", label: "Tight Curls", category: "hair", shape: "curly", variant: 0.3, colors: {}, tags: ["casual"] },
  {
    id: "hair-headscarf-drape",
    label: "Headscarf (Draped)",
    category: "hair",
    shape: "headscarf-drape",
    variant: 0.5,
    colors: { primary: "#8a5a6b" },
    tags: ["modest"],
    modestCoverageClass: "full",
    // Phase 20F: cap/beanie/headphones render over the same head region as
    // the drape and earrings would sit hidden under the fabric — dropped
    // by ModularCharacter.tsx rather than left to clip/overlap silently.
    incompatibleAccessories: ["acc-cap", "acc-beanie-tan", "acc-beanie-slate", "acc-headphones", "acc-earrings"],
  },
  {
    id: "hair-headscarf-wrap",
    label: "Headscarf (Wrapped)",
    category: "hair",
    shape: "headscarf-wrap",
    variant: 0.5,
    colors: { primary: "#4f6b8a" },
    tags: ["modest"],
    modestCoverageClass: "full",
    incompatibleAccessories: ["acc-cap", "acc-beanie-tan", "acc-beanie-slate", "acc-headphones", "acc-earrings"],
  },
];

// ---------------------------------------------------------------------------
// Tops (20) — 6 shapes. Long-sleeve and tunic shapes carry the Part 6
// "long sleeves" / "modest long tops" options, tagged "modest" alongside
// every casual/formal option in the same list.
// ---------------------------------------------------------------------------

const TOP_PALETTE = ["#c9694f", "#4f7a8c", "#8fc1a9", "#e3a13a", "#7a5c8f", "#5a8a52", "#b85c45", "#3d5a73"];

function buildTopVariants(shape: string, labelPrefix: string, count: number, tags: string[], startIdx = 0): AppearanceOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `top-${shape}-${i}`,
    label: `${labelPrefix} — ${["Terracotta", "Slate Blue", "Sage", "Amber", "Plum", "Moss", "Rust", "Denim"][(startIdx + i) % 8]}`,
    category: "top" as const,
    shape,
    colors: { primary: TOP_PALETTE[(startIdx + i) % TOP_PALETTE.length] },
    tags,
  }));
}

export const TOP_OPTIONS: AppearanceOption[] = [
  ...buildTopVariants("crew-tee", "Crew Tee", 5, ["casual"]),
  ...buildTopVariants("polo", "Polo", 4, ["casual", "smart-casual"], 2),
  ...buildTopVariants("button-shirt", "Button Shirt", 4, ["formal", "smart-casual"], 4),
  ...buildTopVariants("hoodie", "Hoodie", 3, ["casual", "sporty"], 1),
  ...buildTopVariants("long-sleeve-crew", "Long-Sleeve Crew", 2, ["casual", "modest"], 3),
  ...buildTopVariants("tunic-long", "Long Tunic", 2, ["modest"], 5),
];

// ---------------------------------------------------------------------------
// Jackets (10, `null` jacketId = none) — 5 shapes.
// ---------------------------------------------------------------------------

const JACKET_PALETTE = ["#6b4a2f", "#3d5a73", "#4a4a4a", "#8a5a34", "#5a4a3a"];

function buildJacketVariants(shape: string, labelPrefix: string, count: number, tags: string[], startIdx = 0): AppearanceOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `jacket-${shape}-${i}`,
    label: `${labelPrefix} — ${["Walnut", "Slate", "Charcoal", "Umber", "Espresso"][(startIdx + i) % 5]}`,
    category: "jacket" as const,
    shape,
    colors: { primary: JACKET_PALETTE[(startIdx + i) % JACKET_PALETTE.length] },
    tags,
    // Phase 20F: every jacket shares the same `renderJacket` box geometry
    // today (see ModularCharacter.tsx), so one shared forward offset keeps
    // torso accessories (tie/pin/brooch/pocket-square) visible on the
    // jacket's front rather than z-fighting against it.
    jacketLayerOffset: 0.03,
  }));
}

export const JACKET_OPTIONS: AppearanceOption[] = [
  ...buildJacketVariants("bomber", "Bomber", 2, ["casual", "sporty"]),
  ...buildJacketVariants("denim", "Denim Jacket", 2, ["casual"], 2),
  ...buildJacketVariants("cardigan", "Cardigan", 2, ["casual", "modest"], 4),
  ...buildJacketVariants("blazer", "Blazer", 2, ["formal"], 1),
  ...buildJacketVariants("puffer", "Puffer", 2, ["casual", "sporty"], 3),
];

// ---------------------------------------------------------------------------
// Bottoms (15) — 6 shapes, including the Part 6 "long skirts" and "loose
// trousers" modest options, tagged and mixed in with every other bottom.
// ---------------------------------------------------------------------------

const BOTTOM_PALETTE = ["#3d5a73", "#4a4a4a", "#8a5a34", "#6b4a2f", "#5a4a3a", "#7a5c8f"];

function buildBottomVariants(shape: string, labelPrefix: string, count: number, tags: string[], startIdx = 0): AppearanceOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bottom-${shape}-${i}`,
    label: `${labelPrefix} — ${["Denim", "Charcoal", "Umber", "Walnut", "Espresso", "Plum"][(startIdx + i) % 6]}`,
    category: "bottom" as const,
    shape,
    colors: { primary: BOTTOM_PALETTE[(startIdx + i) % BOTTOM_PALETTE.length] },
    tags,
  }));
}

export const BOTTOM_OPTIONS: AppearanceOption[] = [
  ...buildBottomVariants("jeans-straight", "Straight Jeans", 4, ["casual"]),
  ...buildBottomVariants("pleated-trousers", "Pleated Trousers", 3, ["formal", "smart-casual"], 1),
  ...buildBottomVariants("joggers", "Joggers", 2, ["casual", "sporty"], 2),
  ...buildBottomVariants("shorts", "Shorts", 2, ["casual", "sporty"], 3),
  ...buildBottomVariants("long-skirt", "Long Skirt", 2, ["modest"], 4),
  ...buildBottomVariants("loose-trousers", "Loose Trousers", 2, ["modest", "casual"], 5),
];

// ---------------------------------------------------------------------------
// Shoes (12) — 4 shapes.
// ---------------------------------------------------------------------------

const SHOE_PALETTE = ["#2b2b33", "#8a5a34", "#e8e2d6", "#4a3b32"];

function buildShoeVariants(shape: string, labelPrefix: string, count: number, tags: string[], startIdx = 0): AppearanceOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `shoes-${shape}-${i}`,
    label: `${labelPrefix} — ${["Black", "Tan", "Cream", "Brown"][(startIdx + i) % 4]}`,
    category: "shoes" as const,
    shape,
    colors: { primary: SHOE_PALETTE[(startIdx + i) % SHOE_PALETTE.length] },
    tags,
  }));
}

export const SHOES_OPTIONS: AppearanceOption[] = [
  ...buildShoeVariants("sneakers", "Sneakers", 4, ["casual", "sporty"]),
  ...buildShoeVariants("loafers", "Loafers", 3, ["formal", "smart-casual"], 1),
  ...buildShoeVariants("boots", "Boots", 3, ["casual"], 2),
  ...buildShoeVariants("sandals", "Sandals", 2, ["casual"], 3),
];

// ---------------------------------------------------------------------------
// Accessories (20) — several genuinely distinct small shapes, stretched to
// 20 with colour variants on the ones that suit it (scarf, beanie).
// ---------------------------------------------------------------------------

export const ACCESSORY_OPTIONS: AppearanceOption[] = [
  { id: "acc-glasses-round", label: "Round Glasses", category: "accessory", shape: "glasses", variant: 0.4, colors: { primary: "#2b2320" }, tags: ["smart-casual"] },
  { id: "acc-glasses-square", label: "Square Glasses", category: "accessory", shape: "glasses", variant: 0.7, colors: { primary: "#5a4a3a" }, tags: ["smart-casual"] },
  { id: "acc-lanyard", label: "Student Lanyard", category: "accessory", shape: "lanyard", colors: { primary: "#3da9fc" }, tags: ["casual"] },
  { id: "acc-backpack-strap", label: "Backpack Straps", category: "accessory", shape: "backpack", colors: { primary: "#4f7a8c" }, tags: ["casual"] },
  { id: "acc-watch", label: "Wristwatch", category: "accessory", shape: "watch", colors: { primary: "#9a9490" }, tags: ["smart-casual", "formal"] },
  { id: "acc-bracelet", label: "Bracelet", category: "accessory", shape: "bracelet", colors: { primary: "#c99a52" }, tags: ["casual"] },
  { id: "acc-earrings", label: "Earrings", category: "accessory", shape: "earrings", colors: { primary: "#c99a52" }, tags: ["casual", "formal"] },
  { id: "acc-tie", label: "Tie", category: "accessory", shape: "tie", colors: { primary: "#8a1f2b" }, tags: ["formal"] },
  { id: "acc-bow", label: "Bow Tie", category: "accessory", shape: "bow", colors: { primary: "#4f7cff" }, tags: ["formal"] },
  { id: "acc-pin-badge", label: "Pin Badge", category: "accessory", shape: "pin", colors: { primary: "#2ed17e" }, tags: ["casual"] },
  { id: "acc-headphones", label: "Headphones (worn)", category: "accessory", shape: "headphones", colors: { primary: "#2b2b33" }, tags: ["casual"] },
  { id: "acc-cap", label: "Cap", category: "accessory", shape: "cap", colors: { primary: "#3d5a73" }, tags: ["casual", "sporty"] },
  { id: "acc-beanie-tan", label: "Beanie (Tan)", category: "accessory", shape: "beanie", colors: { primary: "#c99a52" }, tags: ["casual"] },
  { id: "acc-beanie-slate", label: "Beanie (Slate)", category: "accessory", shape: "beanie", colors: { primary: "#4a4a4a" }, tags: ["casual"] },
  { id: "acc-scarf-terracotta", label: "Scarf (Terracotta)", category: "accessory", shape: "scarf", colors: { primary: "#c9694f" }, tags: ["casual"] },
  { id: "acc-scarf-sage", label: "Scarf (Sage)", category: "accessory", shape: "scarf", colors: { primary: "#8fc1a9" }, tags: ["casual"] },
  { id: "acc-flower-pin", label: "Flower Pin", category: "accessory", shape: "flower", colors: { primary: "#e88a9a" }, tags: ["casual"] },
  { id: "acc-brooch", label: "Brooch", category: "accessory", shape: "brooch", colors: { primary: "#c99a52" }, tags: ["formal", "modest"] },
  { id: "acc-pocket-square", label: "Pocket Square", category: "accessory", shape: "pocket-square", colors: { primary: "#f0955c" }, tags: ["formal"] },
  { id: "acc-wristband", label: "Wristband", category: "accessory", shape: "wristband", colors: { primary: "#2ed17e" }, tags: ["sporty"] },
];

// ---------------------------------------------------------------------------
// Lookup helpers — every consumer (ModularCharacter, Character Creator,
// migration defaults, tests) goes through these rather than importing the
// raw arrays directly, so "does this id exist" is always checked the same
// way.
// ---------------------------------------------------------------------------

const ALL_OPTION_LISTS: Record<Exclude<AppearanceCategory, "body" | "skinTone" | "hairColor" | "eyes" | "eyebrows" | "facialHair">, AppearanceOption[]> = {
  hair: HAIR_OPTIONS,
  top: TOP_OPTIONS,
  jacket: JACKET_OPTIONS,
  bottom: BOTTOM_OPTIONS,
  shoes: SHOES_OPTIONS,
  accessory: ACCESSORY_OPTIONS,
};

export function findOption(category: keyof typeof ALL_OPTION_LISTS, id: string): AppearanceOption | undefined {
  return ALL_OPTION_LISTS[category].find((o) => o.id === id);
}

export function findBodyPreset(id: string): BodyPreset | undefined {
  return BODY_PRESETS.find((b) => b.id === id);
}

export function findSkinTone(id: string): ColorPreset | undefined {
  return SKIN_TONES.find((s) => s.id === id);
}

export function findHairColor(id: string): ColorPreset | undefined {
  return HAIR_COLORS.find((c) => c.id === id);
}

export function findEyeOption(id: string): EyeOption | undefined {
  return EYE_OPTIONS.find((e) => e.id === id);
}

export function findEyebrowOption(id: string): EyebrowOption | undefined {
  return EYEBROW_OPTIONS.find((e) => e.id === id);
}

export function findFacialHairOption(id: string): FacialHairOption | undefined {
  return FACIAL_HAIR_OPTIONS.find((f) => f.id === id);
}

/** Every catalogue id referenced by a `CharacterAppearance` is valid — used by migration/defaults and by the deterministic test harness (catalogue integrity + appearance round-trip). */
export function isValidAppearance(appearance: {
  bodyId: string;
  skinToneId: string;
  hairId: string;
  hairColorId: string;
  eyesId: string;
  eyebrowsId: string;
  facialHairId: string | null;
  topId: string;
  jacketId: string | null;
  bottomId: string;
  shoesId: string;
  accessoryIds: string[];
}): boolean {
  if (!findBodyPreset(appearance.bodyId)) return false;
  if (!findSkinTone(appearance.skinToneId)) return false;
  if (!findOption("hair", appearance.hairId)) return false;
  if (!findHairColor(appearance.hairColorId)) return false;
  if (!findEyeOption(appearance.eyesId)) return false;
  if (!findEyebrowOption(appearance.eyebrowsId)) return false;
  if (appearance.facialHairId !== null && !findFacialHairOption(appearance.facialHairId)) return false;
  if (!findOption("top", appearance.topId)) return false;
  if (appearance.jacketId !== null && !findOption("jacket", appearance.jacketId)) return false;
  if (!findOption("bottom", appearance.bottomId)) return false;
  if (!findOption("shoes", appearance.shoesId)) return false;
  if (!appearance.accessoryIds.every((id) => findOption("accessory", id))) return false;
  return true;
}

/** Every catalogue id list, for the test harness's "no duplicate ids" / "every list has at least the brief's minimum count" checks. */
export const CATALOGUE_SIZES = {
  body: BODY_PRESETS.length,
  skinTone: SKIN_TONES.length,
  hair: HAIR_OPTIONS.length,
  hairColor: HAIR_COLORS.length,
  eyes: EYE_OPTIONS.length,
  eyebrows: EYEBROW_OPTIONS.length,
  facialHair: FACIAL_HAIR_OPTIONS.length,
  top: TOP_OPTIONS.length,
  jacket: JACKET_OPTIONS.length,
  bottom: BOTTOM_OPTIONS.length,
  shoes: SHOES_OPTIONS.length,
  accessory: ACCESSORY_OPTIONS.length,
} as const;
