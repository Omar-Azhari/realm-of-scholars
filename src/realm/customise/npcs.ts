/**
 * Looks for the people of the academy: each subject's professor wears robes
 * in their region's colours; the bazaar merchant dresses for the road.
 */

import { THEME_STYLES } from "../world/themes";
import { defaultAppearance, SKIN_TONES, HAIR_COLOURS } from "./humans";
import type { Appearance, RegionTheme } from "../types";
import type { HatId } from "../scene/models";

const THEMES: RegionTheme[] = ["arcane", "forge", "grove", "archive", "guild", "tide", "foundry", "alchemy"];

export function professorLook(theme: RegionTheme): { appearance: Appearance; hat: HatId | null } {
  const i = THEMES.indexOf(theme);
  const body = i % 2 === 0 ? "female" : "male";
  const robe = body === "female" ? (i % 4 === 0 ? "witch" : "medieval") : i % 4 === 1 ? "king" : "suit";
  return {
    appearance: {
      ...defaultAppearance(body),
      parts: { head: robe, body: robe, legs: robe, feet: robe },
      height: ((i * 37) % 7) / 10 - 0.3,
      build: ((i * 53) % 9) / 10 - 0.4,
      muscle: 0.2,
      skin: SKIN_TONES[(i * 3) % SKIN_TONES.length],
      hair: HAIR_COLOURS[(i * 5 + 4) % HAIR_COLOURS.length],
      outfitColour: THEME_STYLES[theme].robe,
    },
    hat: theme === "arcane" || theme === "alchemy" || theme === "archive" ? "wizard" : null,
  };
}

export const MERCHANT_LOOK: Appearance = {
  ...defaultAppearance("male"),
  parts: { head: "adventurer", body: "adventurer", legs: "adventurer", feet: "adventurer" },
  build: 0.5,
  skin: SKIN_TONES[4],
  hair: HAIR_COLOURS[1],
  outfitColour: "#7a3a1a",
};
