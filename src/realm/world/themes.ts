import type { RegionTheme } from "../types";

export interface ThemeStyle {
  landmarkName: string;
  /** Ground tint for the region (rgb 0-1). */
  ground: [number, number, number];
  wall: string;
  roof: string;
  accent: string;
  glow: string;
  tutorTitle: string;
  tutorNames: string[];
  robe: string;
  icon: string;
}

export const THEME_STYLES: Record<RegionTheme, ThemeStyle> = {
  arcane: {
    landmarkName: "Arcane Spire",
    ground: [0.30, 0.41, 0.23],
    wall: "#8a8a99",
    roof: "#4b3a8c",
    accent: "#7b5cff",
    glow: "#a98bff",
    tutorTitle: "Magister",
    tutorNames: ["Aldric", "Ysolde", "Corvin", "Mirela"],
    robe: "#3d2f7a",
    icon: "✦",
  },
  guild: {
    landmarkName: "Merchant Guildhall",
    ground: [0.37, 0.44, 0.21],
    wall: "#b59a6e",
    roof: "#8a2f24",
    accent: "#d4a52c",
    glow: "#ffcf5a",
    tutorTitle: "Guildmaster",
    tutorNames: ["Benedikt", "Rosalind", "Oswin", "Theodora"],
    robe: "#7a4b19",
    icon: "⚖",
  },
  forge: {
    landmarkName: "Artisans' Forge",
    ground: [0.34, 0.40, 0.21],
    wall: "#7d6a5a",
    roof: "#3b3b3b",
    accent: "#e2662b",
    glow: "#ff8a3d",
    tutorTitle: "Master Artisan",
    tutorNames: ["Hilde", "Bram", "Seraphine", "Garrick"],
    robe: "#8a3b1c",
    icon: "⚒",
  },
  grove: {
    landmarkName: "Verdant Grove",
    ground: [0.23, 0.46, 0.18],
    wall: "#7a6a52",
    roof: "#2f6b2a",
    accent: "#6fcf5a",
    glow: "#b6ff8a",
    tutorTitle: "Elder",
    tutorNames: ["Fenwick", "Liora", "Briar", "Maelis"],
    robe: "#2e5a2a",
    icon: "❦",
  },
  archive: {
    landmarkName: "Old Archive",
    ground: [0.35, 0.40, 0.24],
    wall: "#c9bea4",
    roof: "#5a4632",
    accent: "#c9a96e",
    glow: "#ffe3a3",
    tutorTitle: "Archivist",
    tutorNames: ["Edmund", "Clementine", "Ambrose", "Isolde"],
    robe: "#5a4632",
    icon: "📜",
  },
  foundry: {
    landmarkName: "Clockwork Foundry",
    ground: [0.33, 0.39, 0.23],
    wall: "#6e6e72",
    roof: "#7a5a2a",
    accent: "#c08a3a",
    glow: "#ffd27a",
    tutorTitle: "Engineer",
    tutorNames: ["Tobias", "Wilhelmina", "Percival", "Agnes"],
    robe: "#4a4a52",
    icon: "⚙",
  },
  tide: {
    landmarkName: "Tidewatch Lighthouse",
    ground: [0.33, 0.44, 0.25],
    wall: "#e8e2d4",
    roof: "#a8322b",
    accent: "#3a8ad4",
    glow: "#9ad8ff",
    tutorTitle: "Navigator",
    tutorNames: ["Marina", "Caspian", "Neris", "Halden"],
    robe: "#1f4a7a",
    icon: "⚓",
  },
  alchemy: {
    landmarkName: "Alchemists' Dome",
    ground: [0.31, 0.42, 0.22],
    wall: "#9a8f7a",
    roof: "#2d7a6a",
    accent: "#3fd4a8",
    glow: "#8affd8",
    tutorTitle: "Alchemist",
    tutorNames: ["Paracel", "Hester", "Quillon", "Vesna"],
    robe: "#245a50",
    icon: "⚗",
  },
};

export function tutorName(theme: RegionTheme, index: number): string {
  const style = THEME_STYLES[theme];
  return `${style.tutorTitle} ${style.tutorNames[index % style.tutorNames.length]}`;
}
