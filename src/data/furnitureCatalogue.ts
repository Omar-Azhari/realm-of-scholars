/**
 * Furniture catalogue (Phase 20D, Part 3). A modest, curated set — "avoid
 * sandbox-style unrestricted building... prefer curated, high-quality
 * customisation" (the brief's own Primary Goal) — not hundreds of items.
 * Every category from the brief is represented with 2–3 real choices,
 * enough for the unlock system (Part 6) to mean something without
 * building an exhaustive shop.
 *
 * Same shape+colour recipe as `appearanceCatalogue.ts` (Phase 20B): a
 * small, shared set of `shape` keys, rendered by
 * `src/game3d/rooms/furnitureRenderer.tsx`, stretched to more catalogue
 * entries via colour variation — never a bespoke mesh per item. No real
 * preview-image asset pipeline exists yet (Art Bible Part 13), so
 * `previewImageRef` is a stable placeholder path a future asset pass
 * resolves — the catalogue `id` is the one stable contract save data
 * ever stores, never a mesh or image path.
 *
 * `interaction`, where present, reuses the EXISTING `InteractAction`
 * union (`src/world/worldTypes.ts`) unmodified — "interaction logic must
 * be shared, avoid duplicate implementations" (Part 4) is satisfied by
 * every placed item just producing a normal `WorldInteractable`, handled
 * by the same `handleAction` switch every other interactable already
 * goes through.
 */

import type { RoomThemeId } from "../types/domain";
import type { InteractAction } from "../world/worldTypes";

// "decoration" isn't one of Part 3's 10 named catalogue categories, but
// Part 2 explicitly lists a "Decoration slot" alongside the others — added
// here to make that slot real rather than leaving it uncategorised.
export type FurnitureCategory = "desk" | "bookshelf" | "chair" | "plant" | "lamp" | "rug" | "wall-art" | "noticeboard" | "storage" | "desk-accessory" | "decoration";

export const FURNITURE_CATEGORIES: FurnitureCategory[] = ["desk", "bookshelf", "chair", "plant", "lamp", "rug", "wall-art", "noticeboard", "storage", "desk-accessory", "decoration"];

export type UnlockRequirement =
  | { type: "starter" }
  | { type: "xp"; minXp: number }
  | { type: "level"; minLevel: number }
  | { type: "streak"; minStreak: number }
  | { type: "achievement"; achievementId: string };

export interface FurnitureItem {
  id: string;
  displayName: string;
  category: FurnitureCategory;
  /** "all" = every theme (the Art Bible's default expectation: "every theme reuses the exact same furniture catalogue"); a specific list narrows it to themes it was designed to suit. */
  themeCompatibility: RoomThemeId[] | "all";
  unlockRequirement: UnlockRequirement;
  previewImageRef: string;
  shape: string;
  colors: Record<string, string>;
  interaction?: { actionLabel: string; action: InteractAction };
}

export const FURNITURE_CATALOGUE: FurnitureItem[] = [
  // ---- Desks ---------------------------------------------------------
  {
    id: "desk-classic",
    displayName: "Classic Desk",
    category: "desk",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/desk-classic.png",
    shape: "desk-classic",
    colors: { primary: "#8a5a34" },
    interaction: { actionLabel: "Open Study Planner", action: { type: "open-study-planner" } },
  },
  {
    id: "desk-standing",
    displayName: "Standing Desk",
    category: "desk",
    themeCompatibility: "all",
    unlockRequirement: { type: "xp", minXp: 200 },
    previewImageRef: "furniture/desk-standing.png",
    shape: "desk-standing",
    colors: { primary: "#9a9490" },
    interaction: { actionLabel: "Open Study Planner", action: { type: "open-study-planner" } },
  },
  // ---- Bookshelves ----------------------------------------------------
  {
    id: "bookshelf-short",
    displayName: "Two-Shelf Bookcase",
    category: "bookshelf",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/bookshelf-short.png",
    shape: "bookshelf-standard",
    colors: { primary: "#a97c50" },
    interaction: { actionLabel: "Browse Learning Material", action: { type: "open-panel", panel: "subjects", section: "resources" } },
  },
  {
    id: "bookshelf-tall",
    displayName: "Tall Library Shelf",
    category: "bookshelf",
    themeCompatibility: "all",
    unlockRequirement: { type: "achievement", achievementId: "first-module" },
    previewImageRef: "furniture/bookshelf-tall.png",
    shape: "bookshelf-tall",
    colors: { primary: "#6b4a2f" },
    interaction: { actionLabel: "Browse Learning Material", action: { type: "open-panel", panel: "subjects", section: "resources" } },
  },
  // ---- Chairs ----------------------------------------------------------
  {
    id: "chair-reading",
    displayName: "Reading Chair",
    category: "chair",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/chair-reading.png",
    shape: "chair-reading",
    colors: { primary: "#c9694f" },
  },
  {
    id: "chair-desk",
    displayName: "Desk Chair",
    category: "chair",
    themeCompatibility: "all",
    unlockRequirement: { type: "level", minLevel: 3 },
    previewImageRef: "furniture/chair-desk.png",
    shape: "chair-reading",
    colors: { primary: "#4f7a8c" },
  },
  // ---- Plants ------------------------------------------------------------
  {
    id: "plant-small",
    displayName: "Small Potted Plant",
    category: "plant",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/plant-small.png",
    shape: "plant-pot",
    colors: { pot: "#a9704f", leaf: "#5a8a52" },
  },
  {
    id: "plant-medium",
    displayName: "Leafy Plant",
    category: "plant",
    themeCompatibility: "all",
    unlockRequirement: { type: "streak", minStreak: 7 },
    previewImageRef: "furniture/plant-medium.png",
    shape: "plant-pot",
    colors: { pot: "#8a5a34", leaf: "#4a7a42" },
  },
  {
    id: "plant-flowering",
    displayName: "Flowering Plant",
    category: "plant",
    themeCompatibility: "all",
    unlockRequirement: { type: "achievement", achievementId: "seven-day-streak" },
    previewImageRef: "furniture/plant-flowering.png",
    shape: "plant-pot",
    colors: { pot: "#c9694f", leaf: "#5a8a52", flower: "#e88a9a" },
  },
  // ---- Lamps -------------------------------------------------------------
  {
    id: "lamp-reading-warm",
    displayName: "Reading Lamp",
    category: "lamp",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/lamp-reading-warm.png",
    shape: "lamp-standing",
    colors: { metal: "#9a9490", shade: "#e3a13a" },
  },
  {
    id: "lamp-reading-brass",
    displayName: "Brass Reading Lamp",
    category: "lamp",
    themeCompatibility: "all",
    unlockRequirement: { type: "xp", minXp: 100 },
    previewImageRef: "furniture/lamp-reading-brass.png",
    shape: "lamp-standing",
    colors: { metal: "#a9843a", shade: "#c1543f" },
  },
  // ---- Rugs --------------------------------------------------------------
  {
    id: "rug-tan",
    displayName: "Tan Rug",
    category: "rug",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/rug-tan.png",
    shape: "rug-simple",
    colors: { fill: "#e3b774", border: "#c98f4e" },
  },
  {
    id: "rug-terracotta",
    displayName: "Terracotta Rug",
    category: "rug",
    themeCompatibility: "all",
    unlockRequirement: { type: "level", minLevel: 2 },
    previewImageRef: "furniture/rug-terracotta.png",
    shape: "rug-simple",
    colors: { fill: "#c9694f", border: "#8a5a34" },
  },
  // ---- Wall art ------------------------------------------------------------
  {
    id: "wallart-whiteboard",
    displayName: "Whiteboard & Calendar",
    category: "wall-art",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/wallart-whiteboard.png",
    shape: "wallart-board",
    colors: { primary: "#fbf6ea" },
  },
  {
    id: "wallart-motivational",
    displayName: "Motivational Print",
    category: "wall-art",
    themeCompatibility: "all",
    unlockRequirement: { type: "achievement", achievementId: "hundred-xp" },
    previewImageRef: "furniture/wallart-motivational.png",
    shape: "wallart-board",
    colors: { primary: "#8fc1a9" },
  },
  // ---- Noticeboards --------------------------------------------------------
  {
    id: "noticeboard-cork",
    displayName: "Cork Noticeboard",
    category: "noticeboard",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/noticeboard-cork.png",
    shape: "noticeboard-cork",
    colors: { primary: "#c9a06a" },
    interaction: { actionLabel: "Check Deadlines", action: { type: "open-panel", panel: "tasks" } },
  },
  {
    id: "noticeboard-modern",
    displayName: "Modern Noticeboard",
    category: "noticeboard",
    themeCompatibility: "all",
    unlockRequirement: { type: "streak", minStreak: 14 },
    previewImageRef: "furniture/noticeboard-modern.png",
    shape: "noticeboard-cork",
    colors: { primary: "#9a9490" },
    interaction: { actionLabel: "Check Deadlines", action: { type: "open-panel", panel: "tasks" } },
  },
  // ---- Storage --------------------------------------------------------------
  {
    id: "storage-lockers",
    displayName: "Student Lockers",
    category: "storage",
    themeCompatibility: "all",
    unlockRequirement: { type: "xp", minXp: 50 },
    previewImageRef: "furniture/storage-lockers.png",
    shape: "storage-lockers",
    colors: { primary: "#4f7a8c" },
  },
  {
    id: "storage-cabinet",
    displayName: "Storage Cabinet",
    category: "storage",
    themeCompatibility: "all",
    unlockRequirement: { type: "level", minLevel: 4 },
    previewImageRef: "furniture/storage-cabinet.png",
    shape: "storage-lockers",
    colors: { primary: "#8a5a34" },
  },
  // ---- Desk accessories --------------------------------------------------------
  // ---- Decoration --------------------------------------------------------
  {
    id: "decoration-trophy",
    displayName: "Trophy",
    category: "decoration",
    themeCompatibility: "all",
    unlockRequirement: { type: "streak", minStreak: 3 },
    previewImageRef: "furniture/decoration-trophy.png",
    shape: "decoration-trophy",
    colors: { primary: "#d7b23a" },
  },
  {
    id: "decoration-photo-frame",
    displayName: "Photo Frame",
    category: "decoration",
    themeCompatibility: "all",
    unlockRequirement: { type: "achievement", achievementId: "first-assessment" },
    previewImageRef: "furniture/decoration-photo-frame.png",
    shape: "decoration-photo-frame",
    colors: { primary: "#8a5a34" },
  },
  {
    id: "desk-accessories-classic",
    displayName: "Study Set (Laptop, Notebook, Mug, Pen)",
    category: "desk-accessory",
    themeCompatibility: "all",
    unlockRequirement: { type: "starter" },
    previewImageRef: "furniture/desk-accessories-classic.png",
    shape: "desk-accessories",
    colors: { mug: "#c1543f" },
    // Part 4's "Computer -> Assessments & Calendar" — the laptop is this
    // set's interactive point, distinct from clicking the desk surface
    // itself (which opens the Study Planner via the desk item above).
    interaction: { actionLabel: "Check Assessments & Calendar", action: { type: "open-panel", panel: "calendar" } },
  },
];

export function findFurnitureItem(id: string): FurnitureItem | undefined {
  return FURNITURE_CATALOGUE.find((item) => item.id === id);
}

export function furnitureByCategory(category: FurnitureCategory): FurnitureItem[] {
  return FURNITURE_CATALOGUE.filter((item) => item.category === category);
}

export const STARTER_FURNITURE_IDS: string[] = FURNITURE_CATALOGUE.filter((item) => item.unlockRequirement.type === "starter").map((item) => item.id);
