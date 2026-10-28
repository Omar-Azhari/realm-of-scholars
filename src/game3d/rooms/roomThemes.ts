/**
 * Room theme system (Phase 20D, Part 1). Every value here is taken
 * directly from `docs/UNIGAME_ART_BIBLE.md` Part 9's theme table (and
 * Part 7's lighting presets, referenced by each theme) — this file makes
 * that documentation real rather than reinterpreting it. A theme is
 * *only* a palette/lighting choice ("no theme requires its own art
 * pass," per the Art Bible) — it never introduces new geometry, so
 * switching themes is cheap and always reversible (it's one save-data
 * field, `PlayerIdentity.roomCustomisation.currentThemeId`).
 *
 * `RoomThemeId` itself already existed (`src/types/domain.ts`, Phase
 * 20B) as a player preference stored ahead of this exact consumer — this
 * phase is what finally reads it. The chosen theme lives in the existing
 * `PlayerIdentity.preferredRoomTheme` (not duplicated inside
 * `RoomCustomisation` — see the "avoid storing the same fact twice"
 * reasoning in `persistence.ts`'s `coerceRoomCustomisation`), so switching
 * themes is one save-data field, and reversible by simply setting it back.
 */

import type { RoomThemeId } from "../../types/domain";

export interface RoomLighting {
  ambientColor: string;
  ambientIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  sunColor: string;
  sunIntensity: number;
}

export interface RoomTheme {
  id: RoomThemeId;
  label: string;
  wallColor: string;
  floorColor: string;
  trimColor: string;
  lighting: RoomLighting;
  /** The Art Bible's own one-line "Ambience" description for this theme. */
  ambienceDescription: string;
}

/** Afternoon — the shipped 20A.5 baseline, unchanged. */
const AFTERNOON_LIGHTING: RoomLighting = {
  ambientColor: "#fff2df",
  ambientIntensity: 0.4,
  hemisphereSky: "#fff6e6",
  hemisphereGround: "#c9a876",
  hemisphereIntensity: 0.5,
  sunColor: "#ffdca6",
  sunIntensity: 1.15,
};

const MORNING_LIGHTING: RoomLighting = {
  ambientColor: "#fff4e2",
  ambientIntensity: 0.45,
  hemisphereSky: "#fff6e6",
  hemisphereGround: "#c9a876",
  hemisphereIntensity: 0.5,
  sunColor: "#fff0d4",
  sunIntensity: 1.0,
};

const EVENING_LIGHTING: RoomLighting = {
  ambientColor: "#f5e6d0",
  ambientIntensity: 0.35,
  hemisphereSky: "#fff6e6",
  hemisphereGround: "#c9a876",
  hemisphereIntensity: 0.45,
  sunColor: "#ffb066",
  sunIntensity: 0.8,
};

/** "Studious hush — dimmer, relies on lamps" — no direct sun. */
const LIBRARY_LIGHTING: RoomLighting = {
  ambientColor: "#eef1f0",
  ambientIntensity: 0.35,
  hemisphereSky: "#eef1f0",
  hemisphereGround: "#c9a876",
  hemisphereIntensity: 0.4,
  sunColor: "#ffdca6",
  sunIntensity: 0.5,
};

/** Afternoon base + "extra lamp warmth" (the lamp props themselves carry the extra warmth — see TestRoomProps.tsx; the room-wide rig here is the same afternoon baseline). */
const CREATIVE_LIGHTING: RoomLighting = AFTERNOON_LIGHTING;

/** "Computer glow (dominant) + dimmer ambient" — the ONE theme allowed to lean cooler (Art Bible Part 1's bounded exception), still never cold/harsh. */
const DIGITAL_LAB_LIGHTING: RoomLighting = {
  ambientColor: "#e7e6e2",
  ambientIntensity: 0.3,
  hemisphereSky: "#e7e6e2",
  hemisphereGround: "#9a9490",
  hemisphereIntensity: 0.4,
  sunColor: "#e3d8c4",
  sunIntensity: 0.85,
};

export const ROOM_THEMES: Record<RoomThemeId, RoomTheme> = {
  "modern-campus": {
    id: "modern-campus",
    label: "Modern Campus",
    wallColor: "#f2e6d2",
    floorColor: "#d8bd8f",
    trimColor: "#8a5a34",
    lighting: AFTERNOON_LIGHTING,
    ambienceDescription: "Productive, tidy, sunlit",
  },
  "cozy-library": {
    id: "cozy-library",
    label: "Cozy Library",
    wallColor: "#c9a876",
    floorColor: "#6b4a2f",
    trimColor: "#8a5a34",
    lighting: LIBRARY_LIGHTING,
    ambienceDescription: "Hushed, warm, book-lined",
  },
  "minimal-study": {
    id: "minimal-study",
    label: "Minimal Study",
    wallColor: "#f7f2e8",
    floorColor: "#e8dcc8",
    trimColor: "#a97c50",
    lighting: MORNING_LIGHTING,
    ambienceDescription: "Calm, uncluttered, focus-first",
  },
  "creative-studio": {
    id: "creative-studio",
    label: "Creative Studio",
    wallColor: "#d98a68",
    floorColor: "#b9a888",
    trimColor: "#4f7a8c",
    lighting: CREATIVE_LIGHTING,
    ambienceDescription: "Expressive, a little messier, personal",
  },
  "digital-lab": {
    id: "digital-lab",
    label: "Digital Lab",
    wallColor: "#d9d3c8",
    floorColor: "#787672",
    trimColor: "#9a9490",
    lighting: DIGITAL_LAB_LIGHTING,
    ambienceDescription: "Focused, quietly technical",
  },
  "classic-academy": {
    id: "classic-academy",
    label: "Classic Academy",
    wallColor: "#6b4a2f",
    floorColor: "#8a6a42",
    trimColor: "#8a5a34",
    lighting: EVENING_LIGHTING,
    ambienceDescription: "Traditional, distinguished, warm wood everywhere",
  },
};

export const ROOM_THEME_ORDER: RoomThemeId[] = [
  "modern-campus",
  "cozy-library",
  "minimal-study",
  "creative-studio",
  "digital-lab",
  "classic-academy",
];

export function getRoomTheme(id: RoomThemeId): RoomTheme {
  return ROOM_THEMES[id];
}
