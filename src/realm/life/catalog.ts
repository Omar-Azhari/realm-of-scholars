/**
 * Life skills: the game you play between study sessions. Fishing, mining
 * and woodcutting gather materials; cooking turns fish into food for
 * combat; crafting turns ore and logs into weapons. Every gathering attempt
 * costs Focus, and Focus only comes from studying — so studying is what
 * powers the fun.
 */

export type LifeSkill = "fishing" | "mining" | "woodcutting" | "cooking" | "crafting" | "combat";

export const LIFE_SKILLS: Array<{ id: LifeSkill; name: string; icon: string; blurb: string }> = [
  { id: "fishing", name: "Fishing", icon: "🎣", blurb: "Catch fish at shoreline spots." },
  { id: "mining", name: "Mining", icon: "⛏", blurb: "Strike ore from rocks in the wilds." },
  { id: "woodcutting", name: "Woodcutting", icon: "🪓", blurb: "Fell ancient trees for logs." },
  { id: "cooking", name: "Cooking", icon: "🍳", blurb: "Cook fish into food that heals in battle." },
  { id: "crafting", name: "Wandcraft", icon: "🪄", blurb: "Craft wands from timber and ore." },
  { id: "combat", name: "Duelling", icon: "✨", blurb: "Fight the creatures of the wilds with spells." },
];

export type GatherSkill = "fishing" | "mining" | "woodcutting";

export interface Resource {
  id: string;
  name: string;
  icon: string;
  skill: GatherSkill;
  level: number;
  xp: number;
  /** Mini-game difficulty: 0 (easy) – 1 (hard). Shrinks the sweet spot and speeds the marker. */
  difficulty: number;
  /** Colour used for the node in the world (ore veins, ripples, leaves). */
  tint: string;
}

export const RESOURCES: Resource[] = [
  { id: "minnow", name: "Minnow", icon: "🐟", skill: "fishing", level: 1, xp: 20, difficulty: 0.1, tint: "#9fd8ff" },
  { id: "trout", name: "Trout", icon: "🐟", skill: "fishing", level: 10, xp: 45, difficulty: 0.35, tint: "#7fc8ff" },
  { id: "salmon", name: "Salmon", icon: "🐠", skill: "fishing", level: 25, xp: 80, difficulty: 0.6, tint: "#ff9f8a" },
  { id: "goldfin", name: "Goldfin", icon: "🐡", skill: "fishing", level: 40, xp: 140, difficulty: 0.85, tint: "#ffd45a" },
  { id: "copper", name: "Copper ore", icon: "🟠", skill: "mining", level: 1, xp: 20, difficulty: 0.1, tint: "#c87a3a" },
  { id: "iron", name: "Iron ore", icon: "⚫", skill: "mining", level: 15, xp: 55, difficulty: 0.4, tint: "#8a8a96" },
  { id: "silver", name: "Silver ore", icon: "⚪", skill: "mining", level: 30, xp: 95, difficulty: 0.65, tint: "#dfe6f0" },
  { id: "gold", name: "Gold ore", icon: "🟡", skill: "mining", level: 45, xp: 150, difficulty: 0.9, tint: "#ffcf3a" },
  { id: "oak", name: "Oak logs", icon: "🪵", skill: "woodcutting", level: 1, xp: 20, difficulty: 0.1, tint: "#4f8a3a" },
  { id: "willow", name: "Willow logs", icon: "🪵", skill: "woodcutting", level: 15, xp: 55, difficulty: 0.4, tint: "#7aa84a" },
  { id: "maple", name: "Maple logs", icon: "🪵", skill: "woodcutting", level: 30, xp: 95, difficulty: 0.65, tint: "#d8642a" },
  { id: "yew", name: "Yew logs", icon: "🪵", skill: "woodcutting", level: 45, xp: 150, difficulty: 0.9, tint: "#2f5a3a" },
];

export function resource(id: string): Resource | undefined {
  return RESOURCES.find((r) => r.id === id);
}

export interface Food {
  id: string;
  name: string;
  icon: string;
  from: string;
  level: number;
  xp: number;
  heals: number;
}

export const FOODS: Food[] = [
  { id: "cooked-minnow", name: "Grilled minnow", icon: "🍢", from: "minnow", level: 1, xp: 15, heals: 6 },
  { id: "cooked-trout", name: "Baked trout", icon: "🍲", from: "trout", level: 10, xp: 35, heals: 12 },
  { id: "cooked-salmon", name: "Smoked salmon", icon: "🍱", from: "salmon", level: 25, xp: 60, heals: 20 },
  { id: "cooked-goldfin", name: "Goldfin feast", icon: "🥘", from: "goldfin", level: 40, xp: 100, heals: 32 },
];

export function food(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

export interface Weapon {
  id: string;
  name: string;
  tier: number;
  /** Damage bonus in combat. */
  power: number;
  level: number;
  xp: number;
  /** Materials consumed to craft it. */
  cost: Record<string, number>;
  /** Tint applied to the adventurer's own weapon model. */
  tint: string;
}

export const WEAPONS: Weapon[] = [
  { id: "copper-arms", name: "Oak wand, copper core", tier: 1, power: 2, level: 1, xp: 40, cost: { copper: 3, oak: 2 }, tint: "#c87a3a" },
  { id: "iron-arms", name: "Willow wand, iron core", tier: 2, power: 5, level: 15, xp: 110, cost: { iron: 4, willow: 3 }, tint: "#9aa0ac" },
  { id: "silver-arms", name: "Maple wand, silver core", tier: 3, power: 9, level: 30, xp: 220, cost: { silver: 5, maple: 4 }, tint: "#e6eef8" },
  { id: "gold-arms", name: "Yew wand, gold core", tier: 4, power: 14, level: 45, xp: 400, cost: { gold: 6, yew: 5, iron: 3 }, tint: "#ffcf3a" },
];

export function weapon(id: string | null | undefined): Weapon | undefined {
  return id ? WEAPONS.find((w) => w.id === id) : undefined;
}

/** What each study action pays in Focus, and what playing costs. */
export const FOCUS = {
  max: 100,
  start: 30,
  earn: {
    studyWeek: 20,
    questStep: 15,
    reviewCard: 3,
    studyGameWin: 8,
    bossWin: 25,
    mockCorrect: 1,
    meditationMinute: 1,
    explain: 10,
    dailyClaim: 20,
  },
  cost: {
    gather: 1,
    cook: 0,
    craft: 0,
    dungeon: 15,
    arcade: 5,
    race: 3,
    sail: 4,
  },
} as const;
