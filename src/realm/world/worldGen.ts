/**
 * Builds the island world from the student's curriculum. Deterministic:
 * the same curriculum always produces the same map.
 *
 * Layout: the Scholars' Citadel sits in the centre of an island. One
 * region per subject fans out around it, joined by dirt roads. Each region
 * has a themed landmark, a tutor, a quest board, four trial stations and a
 * loop trail of waystones — one waystone per teaching week.
 */

import type { RealmSubject, RegionTheme } from "../types";
import { THEME_STYLES, tutorName } from "./themes";
import { WORKSHOP_INFO, workshopFor } from "../curriculum/workshop";
import type { IslandSpec } from "./islands";
import type { PlacedRoom } from "./rooms";

export const TILE = {
  grass: 0,
  path: 1,
  plaza: 2,
  water: 3,
  sand: 4,
  dirt: 5,
} as const;
export type TileKind = (typeof TILE)[keyof typeof TILE];

export type ObjectKind =
  | "citadel"
  | "landmark"
  | "tutor"
  | "quest-board"
  | "waystone"
  | "duel-arena"
  | "scroll-table"
  | "rune-altar"
  | "meditation-shrine"
  | "signpost"
  | "fountain"
  | "boss-lair"
  | "bazaar"
  | "group-board"
  | "workshop"
  | "trophy-hall"
  | "library"
  | "fishing-spot"
  | "ore-rock"
  | "tree-node"
  | "cooking-fire"
  | "anvil"
  | "crypt-gate"
  | "games-hall"
  | "dorm"
  | "harbour"
  | "exchange-hall"
  | "door"
  | "wardrobe"
  | "noticeboard"
  | "furniture"
  | "cauldron"
  | "duel-club"
  | "secret-door"
  | "lecture-hall"
  | "lectern"
  | "parkour-tower"
  | "archery-range"
  | "pingpong-hall"
  /** A scenic landmark in the open country (lookout, ruins, windmill, ...): examine only. */
  | "scenery";

/** Which scenic landmark a "scenery" object is. */
export type SceneryKind = "lookout" | "ruins" | "windmill" | "bell-tower" | "picnic";

export type ActionId =
  | "talk"
  | "read-board"
  | "study"
  | "trial"
  | "duel"
  | "match"
  | "scramble"
  | "meditate"
  | "enter-hall"
  | "read-sign"
  | "daily"
  | "travel"
  | "travel-menu"
  | "enter-library"
  | "boss"
  | "trade"
  | "group"
  | "mock"
  | "workshop"
  | "trophies"
  | "library"
  | "gather"
  | "cook"
  | "craft"
  | "dungeon"
  | "arcade"
  | "home"
  | "sail"
  | "exchange"
  | "leave"
  | "customise"
  | "plan"
  | "decorate"
  | "rest"
  | "desk"
  | "review"
  | "sit"
  | "mail"
  | "brew"
  | "ladder"
  | "knock"
  | "enter-theatre"
  | "lecture"
  | "parkour"
  | "archery"
  | "pingpong";

export interface ObjectAction {
  id: ActionId;
  label: string;
}

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  /** Footprint min corner, in tiles. */
  x: number;
  z: number;
  w: number;
  d: number;
  /** Facing, radians around Y. */
  rot: number;
  name: string;
  examine: string;
  actions: ObjectAction[];
  subjectId?: string;
  week?: number;
  theme?: RegionTheme;
  /** Gathering nodes: the resource they yield (see life/catalog.ts). */
  resource?: string;
  /** Dorm furniture: which piece, which placement, and how it sits. */
  furniture?: { id: string; uid: string; rot: number; y: number };
  /** Scenic landmarks: which one. */
  scenery?: SceneryKind;
}

/** A straight run of roadside dressing (a hedge or a fence), centred on (x, z), `len` tiles long along `rot`. */
export interface RoadsideRun {
  x: number;
  z: number;
  /** Direction of the run, radians around Y (the run lies along its local X). */
  rot: number;
  len: number;
}

/** A bridge carrying a road over the creek: centre, direction along the road, length and width in tiles. */
export interface Bridge {
  x: number;
  z: number;
  rot: number;
  length: number;
  width: number;
}

/** Ground character of an open grass tile (see `Landscape.ground`). */
export const GROUND = { plain: 0, meadow: 1, bush: 2, forest: 3, lawn: 4 } as const;

/**
 * The open country between places: lamp posts along the main roads, hedges and fences
 * lining some of them, bridges over the creek, and the ground's character per tile.
 * All of it is decoration (drawn instanced by scene/Landscape.tsx); hedges, fences and
 * lamps block their tiles but always leave gaps.
 */
export interface Landscape {
  lamps: Array<{ x: number; z: number }>;
  hedges: RoadsideRun[];
  fences: RoadsideRun[];
  bridges: Bridge[];
  /** Per-tile GROUND value for open grass (meadow, bushland, forest floor, campus lawn). */
  ground: Uint8Array;
}

export interface Decor {
  x: number;
  z: number;
  scale: number;
  variant: number;
  rot: number;
}

export interface Region {
  subjectId: string;
  name: string;
  theme: RegionTheme;
  center: { x: number; z: number };
  clearing: { x: number; z: number };
  dir: { x: number; z: number };
}

/** University-specific dressing for the central hub. */
export interface HubStyle {
  plazaName: string;
  citadelName: string;
  libraryName: string;
  /** Where your dorm is (La Trobe: its residential colleges). */
  villageName: string;
  /** The open country between regions (La Trobe: its native bushland). */
  wildsName: string;
  bannerA: string;
  bannerB: string;
  welcome: string;
}

export interface WorldOptions {
  university?: string;
  /** Which island to build (default: home). Visit islands have no subject regions. */
  island?: IslandSpec;
  /** Start at the harbour instead of the plaza (arriving by boat). */
  arriveByBoat?: boolean;
}

export function isLaTrobe(university: string | undefined): boolean {
  return /la\s*trobe/i.test(university ?? "");
}

/** A visited island's dressing: named for the campus or university, banner colours from its name. */
function hubStyleForIsland(island: IslandSpec): HubStyle {
  const h = hashString(island.id);
  const hue = h % 360;
  return {
    plazaName: island.name,
    citadelName: "Exchange hall",
    libraryName: "Library",
    villageName: "Student Village",
    wildsName: "The Wilds",
    bannerA: `hsl(${hue}, 55%, 38%)`,
    bannerB: `hsl(${(hue + 160) % 360}, 35%, 24%)`,
    welcome: `Welcome to ${island.name}. ${island.rival} waits in the exchange hall.`,
  };
}

function hubStyleFor(university: string | undefined): HubStyle {
  if (isLaTrobe(university)) {
    return {
      plazaName: "The Agora",
      citadelName: "La Trobe Great Hall",
      libraryName: "Borchardt Library",
      villageName: "Menzies & Glenn Colleges",
      wildsName: "The Bushland",
      bannerA: "#c8102e",
      bannerB: "#2a2a2e",
      welcome: "Welcome to the Agora, the heart of La Trobe University. Your subjects lie along the roads beyond.",
    };
  }
  return {
    plazaName: "Citadel Square",
    citadelName: "Scholars' Citadel",
    libraryName: "Great Library",
    villageName: "Student Village",
    wildsName: "The Wilds",
    bannerA: "#8a1f2b",
    bannerB: "#1f3f8a",
    welcome: university ? `Welcome to the Citadel of ${university}. Your subjects lie along the roads beyond.` : "Welcome to the Citadel. Your subjects lie along the roads beyond.",
  };
}

/** Non-interactive campus dressing around the hub plaza and the district courts (they block walking but have no actions). */
export interface HubProp {
  kind: "lamp" | "bench" | "planter" | "fence" | "book-statue" | "trophy-statue" | "stall" | "flagpole" | "woodpile" | "crates";
  x: number;
  z: number;
  rot: number;
}

/**
 * What a place is for. Each purpose has one colour family, used by the building's sign,
 * its minimap marker and the area banner, so the map, the banner and the building agree.
 */
export type Purpose = "study" | "play" | "home" | "crafts" | "travel" | "hall";

/** Pictograms drawn on signs, the minimap and the area banner (see scene/Signage.tsx). */
export type PlaceIcon =
  | "lectern"
  | "books"
  | "trophy"
  | "wands"
  | "stall"
  | "dice"
  | "people"
  | "bed"
  | "hammer"
  | "cauldron"
  | "fire"
  | "anchor"
  | "castle"
  | "fountain"
  | "compass"
  | "parkour"
  | "target"
  | "paddle"
  | "medal";

export const PURPOSE_STYLE: Record<Purpose, { label: string; main: string; dark: string; accent: string }> = {
  study: { label: "Study", main: "#2a56b8", dark: "#142a5e", accent: "#f2c94c" },
  play: { label: "Play", main: "#e8731f", dark: "#6e2c06", accent: "#fff0c8" },
  home: { label: "Home", main: "#3f9a46", dark: "#1b4520", accent: "#f0f8dc" },
  crafts: { label: "Crafts", main: "#8a5a2e", dark: "#3a220e", accent: "#f3d9a8" },
  travel: { label: "Travel", main: "#1f8a96", dark: "#0b3a41", accent: "#e0f8ff" },
  hall: { label: "Great Hall", main: "#a3172b", dark: "#470912", accent: "#f2c94c" },
};

/** Signage for every purpose building: its colour family, its pictogram and the words over the door. */
export const PLACE_INFO: Partial<Record<ObjectKind, { purpose: Purpose; icon: PlaceIcon; sign: string; tagline: string }>> = {
  "lecture-hall": { purpose: "study", icon: "lectern", sign: "Lecture Theatre", tagline: "Lectures · slides · check-ins" },
  library: { purpose: "study", icon: "books", sign: "Library", tagline: "Review · grades · study plan" },
  "trophy-hall": { purpose: "study", icon: "trophy", sign: "Hall of Trophies", tagline: "Bosses beaten · House Cup" },
  "duel-club": { purpose: "study", icon: "wands", sign: "Duelling Club", tagline: "Monthly ladder of duellists" },
  bazaar: { purpose: "play", icon: "stall", sign: "Bazaar", tagline: "Capes · hats · pets" },
  "games-hall": { purpose: "play", icon: "dice", sign: "Games Hall", tagline: "Siege · Island Race · Sky Race" },
  "group-board": { purpose: "play", icon: "people", sign: "Study Groups", tagline: "Swap codes with classmates" },
  "parkour-tower": { purpose: "play", icon: "parkour", sign: "Parkour", tagline: "Climb the obby · beat your time" },
  "archery-range": { purpose: "play", icon: "target", sign: "Archery", tagline: "Aim for the bullseye" },
  "pingpong-hall": { purpose: "play", icon: "paddle", sign: "Ping Pong", tagline: "Table-tennis rallies" },
  dorm: { purpose: "home", icon: "bed", sign: "Residence", tagline: "Your room: rest · desk · wardrobe" },
  cauldron: { purpose: "crafts", icon: "cauldron", sign: "Potions", tagline: "Brew with a question" },
  anvil: { purpose: "crafts", icon: "hammer", sign: "Wandwright", tagline: "Craft wands" },
  "cooking-fire": { purpose: "crafts", icon: "fire", sign: "Campfire", tagline: "Cook your catch" },
  harbour: { purpose: "travel", icon: "anchor", sign: "Harbour", tagline: "Sail to other campuses" },
  citadel: { purpose: "hall", icon: "castle", sign: "Great Hall", tagline: "Graduation" },
  "exchange-hall": { purpose: "hall", icon: "castle", sign: "Exchange Hall", tagline: "Duel the rival scholar" },
  fountain: { purpose: "hall", icon: "fountain", sign: "Fountain", tagline: "Daily challenges" },
};

/**
 * Footprints of the two buildings that hold walk-in rooms, in their own frame: `w` along the
 * entrance front, `d` deep. The entrance is on the side the object's `rot` faces: (sin rot, cos rot).
 * When rot is +-PI/2 the world footprint swaps (object.w = d, object.d = w).
 */
export const LECTURE_HALL_SIZE = { w: 14, d: 13 } as const;
export const DORM_SIZE = { w: 10, d: 9 } as const;

/** A named area of the campus with its own round paved court (see the districts section of generateWorld). */
export interface District {
  id: string;
  name: string;
  blurb: string;
  purpose: Purpose;
  icon: PlaceIcon;
  /** Centre tile, and the radius of the whole district (court plus the buildings around it). */
  x: number;
  z: number;
  half: number;
  /** Radius of the paved court in the middle. */
  court: number;
  /** The gateway arch at the entrance, facing the Agora. */
  gate: { x: number; z: number; rot: number };
}

/** A monster camp in the wilds: 0 = Restless Bones, 1 = warriors, 2 = mages (harder further out). */
export interface Camp {
  x: number;
  z: number;
  tier: 0 | 1 | 2;
}

export interface World {
  /** "island" (outdoors) or "interior" (a room you walked into). */
  mode: "island" | "interior";
  /** Which room, for interiors. */
  interior?: "dorm" | "theatre";
  /** Which island this is (see world/islands.ts); "home" for your own campus. */
  islandId: string;
  hub: HubStyle;
  hubProps: HubProp[];
  camps: Camp[];
  districts: District[];
  size: number;
  kinds: Uint8Array;
  /** Per-tile region index (+1), 0 = none — used for ground tint and minimap. */
  regionOf: Uint8Array;
  /** Corner heights, (size+1)^2. */
  heights: Float32Array;
  walkable: Uint8Array;
  objects: WorldObject[];
  trees: Decor[];
  rocks: Decor[];
  flowers: Decor[];
  regions: Region[];
  spawn: { x: number; z: number };
  plaza: { x0: number; z0: number; x1: number; z1: number };
  /** Walk-in rooms built into their buildings (world/rooms.ts withRooms); absent until added. */
  rooms?: PlacedRoom[];
  /** Roadside dressing, bridges and ground character (home campus and visited islands; absent indoors). */
  landscape?: Landscape;
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed: number): (x: number, z: number) => number {
  const random = mulberry32(seed);
  const size = 64;
  const grid = new Float32Array(size * size).map(() => random());
  const at = (x: number, z: number) => grid[((z % size) + size) % size * size + (((x % size) + size) % size)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = smooth(x - x0);
    const tz = smooth(z - z0);
    const a = at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx;
    const b = at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx;
    return a * (1 - tz) + b * tz;
  };
}

export function generateWorld(subjects: RealmSubject[], options: WorldOptions = {}): World {
  const island = options.island;
  const visit = Boolean(island && island.kind !== "home");
  const tierShift = island?.tier ?? 0;
  if (visit) subjects = [];
  const hub = visit ? hubStyleForIsland(island!) : hubStyleFor(options.university);
  const n = Math.max(1, Math.min(8, subjects.length));
  // Distances are in tiles (1 tile = 1 m; a student is about 1.7 m tall; walking is 3.4 tiles a
  // second). The home campus is a world to cross: every district court is a ten-second walk out
  // from the Agora along its own lamp-lit road, and the subject regions lie further out again,
  // with hills, groves, a lake and a creek in between.
  const R = visit ? 22 : n <= 2 ? 64 : n <= 4 ? 68 : n <= 6 ? 76 : n === 7 ? 82 : 86;
  const REGION_RADIUS = 15;
  const size = 2 * (R + (visit ? 18 : REGION_RADIUS + 9));
  const C = size / 2;
  const seed = hashString(visit ? `island:${island!.id}` : subjects.map((s) => s.id).join("|") || "realm");
  const random = mulberry32(seed);
  const noise = makeNoise(seed ^ 0x9e3779b9);

  const idx = (x: number, z: number) => z * size + x;
  const inBounds = (x: number, z: number) => x >= 0 && z >= 0 && x < size && z < size;

  const kinds = new Uint8Array(size * size).fill(TILE.grass);
  const regionOf = new Uint8Array(size * size);
  /** Tiles that must stay clear of trees and keep flat ground. */
  const reserved = new Uint8Array(size * size);
  const blocked = new Uint8Array(size * size);

  // Island shape: wobbling coastline.
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - C;
      const dz = z + 0.5 - C;
      const dist = Math.hypot(dx, dz);
      const wobble = (noise(x * 0.12, z * 0.12) - 0.5) * 6;
      const edge = C - 3 + wobble;
      if (dist > edge) kinds[idx(x, z)] = TILE.water;
      else if (dist > edge - 2.2) kinds[idx(x, z)] = TILE.sand;
    }
  }

  const paint = (x: number, z: number, kind: TileKind, reserve = true) => {
    if (!inBounds(x, z)) return;
    kinds[idx(x, z)] = kind;
    if (reserve) reserved[idx(x, z)] = 1;
  };

  const line = (ax: number, az: number, bx: number, bz: number, width: number, kind: TileKind) => {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      for (let ox = -width; ox <= width; ox++) {
        for (let oz = -width; oz <= width; oz++) {
          if (Math.hypot(ox, oz) > width + 0.25) continue;
          const tx = Math.floor(px + ox);
          const tz = Math.floor(pz + oz);
          // Never pave under a building that's already standing.
          if (inBounds(tx, tz) && kinds[idx(tx, tz)] !== TILE.water && !blocked[idx(tx, tz)]) paint(tx, tz, kind);
        }
      }
    }
  };

  /** The main roads as polylines (for lamp posts, hedges and bridges), and how each is dressed. */
  const roads: Array<{ pts: Array<{ x: number; z: number }>; dress: "hedge" | "fence" | "none" }> = [];
  /**
   * A road that bends gently: a quadratic curve from a to b whose middle swings `bend` tiles to
   * one side, painted `width` tiles either side of its centre line. Returns the centre line.
   */
  const road = (ax: number, az: number, bx: number, bz: number, bend: number, width: number, dress: "hedge" | "fence" | "none") => {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / (len || 1);
    const nz = (bx - ax) / (len || 1);
    const cx = (ax + bx) / 2 + nx * bend;
    const cz = (az + bz) / 2 + nz * bend;
    const segments = Math.max(2, Math.ceil(len / 4));
    const pts: Array<{ x: number; z: number }> = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const u = 1 - t;
      pts.push({ x: u * u * ax + 2 * u * t * cx + t * t * bx, z: u * u * az + 2 * u * t * cz + t * t * bz });
    }
    for (let s = 1; s < pts.length; s++) line(pts[s - 1].x, pts[s - 1].z, pts[s].x, pts[s].z, width, TILE.path);
    roads.push({ pts, dress });
    return pts;
  };

  const disc = (cx: number, cz: number, radius: number, kind: TileKind) => {
    for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= radius) paint(x, z, kind);
      }
    }
  };

  const objects: WorldObject[] = [];
  /** Footprint plus a one-tile ring around it must be clear, so every object keeps a free tile to stand on. */
  const footprintFree = (x: number, z: number, w: number, d: number) => {
    for (let tz = z - 1; tz <= z + d; tz++) {
      for (let tx = x - 1; tx <= x + w; tx++) {
        if (!inBounds(tx, tz) || blocked[idx(tx, tz)]) return false;
        const inside = tx >= x && tx < x + w && tz >= z && tz < z + d;
        if (inside && kinds[idx(tx, tz)] === TILE.water) return false;
      }
    }
    return true;
  };
  const nudge = (object: WorldObject) => {
    for (let r = 0; r <= 6; r++) {
      for (let oz = -r; oz <= r; oz++) {
        for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
          if (footprintFree(object.x + ox, object.z + oz, object.w, object.d)) {
            object.x += ox;
            object.z += oz;
            return;
          }
        }
      }
    }
  };
  const place = (object: WorldObject, block = true, avoidOverlap = true) => {
    if (avoidOverlap) nudge(object);
    objects.push(object);
    for (let z = object.z; z < object.z + object.d; z++) {
      for (let x = object.x; x < object.x + object.w; x++) {
        if (!inBounds(x, z)) continue;
        reserved[idx(x, z)] = 1;
        if (block) blocked[idx(x, z)] = 1;
      }
    }
  };

  // --- Central plaza and citadel -------------------------------------------
  const plazaHalf = visit ? 9 : 12;
  const plaza = { x0: C - plazaHalf, z0: C - plazaHalf, x1: C + plazaHalf, z1: C + plazaHalf };
  for (let z = plaza.z0; z < plaza.z1; z++) for (let x = plaza.x0; x < plaza.x1; x++) paint(x, z, TILE.plaza);

  place(
    visit
      ? {
          id: "exchange-hall",
          kind: "exchange-hall",
          x: C - 5,
          z: C - 7,
          w: 10,
          d: 8,
          rot: 0,
          name: hub.citadelName,
          examine: `${island!.rival} waits inside to duel you on your own subjects. Beat them for a purse of coins.`,
          actions: [{ id: "exchange", label: "Challenge" }],
        }
      : {
          id: "citadel",
          kind: "citadel",
          x: C - 6,
          z: C - 9,
          w: 12,
          d: 10,
          rot: 0,
          name: hub.citadelName,
          examine: "The great hall of the university. Graduates are honoured within.",
          actions: [{ id: "enter-hall", label: "Enter" }],
        },
  );
  if (!visit) {
  place({
    id: "fountain",
    kind: "fountain",
    x: C - 2,
    z: C + 3,
    w: 4,
    d: 4,
    rot: 0,
    name: "Fountain of Resolve",
    examine: "Its waters show the day's challenges to any scholar who looks in.",
    actions: [{ id: "daily", label: "Look-into" }],
  });

  place({
    id: "hub-sign",
    kind: "signpost",
    x: C + 5,
    z: C + 8,
    w: 1,
    d: 1,
    rot: 0,
    name: `${hub.plazaName} signpost`,
    examine: hub.welcome,
    actions: [
      { id: "travel-menu", label: "Travel" },
      { id: "read-sign", label: "Read" },
    ],
  });

  }

  const spawn = { x: C + 0.5, z: C + (visit ? 6.5 : 10.5) };

  // --- Regions ----------------------------------------------------------------
  const regions: Region[] = [];
  subjects.slice(0, 8).forEach((subject, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n + (n === 2 ? Math.PI / 6 : 0);
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };
    const side = { x: -dir.z, z: dir.x };
    const center = { x: C + dir.x * R, z: C + dir.z * R };
    const clearing = { x: C + dir.x * (R - 9), z: C + dir.z * (R - 9) };
    const style = THEME_STYLES[subject.theme];
    regions.push({ subjectId: subject.id, name: `${style.landmarkName} of ${subject.name}`, theme: subject.theme, center, clearing, dir });

    for (let z = Math.floor(center.z - REGION_RADIUS - 2); z <= Math.ceil(center.z + REGION_RADIUS + 2); z++) {
      for (let x = Math.floor(center.x - REGION_RADIUS - 2); x <= Math.ceil(center.x + REGION_RADIUS + 2); x++) {
        if (!inBounds(x, z)) continue;
        if (Math.hypot(x + 0.5 - center.x, z + 0.5 - center.z) <= REGION_RADIUS + (noise(x * 0.3, z * 0.3) - 0.5) * 3 && regionOf[idx(x, z)] === 0) {
          regionOf[idx(x, z)] = i + 1;
          if (kinds[idx(x, z)] === TILE.water || kinds[idx(x, z)] === TILE.sand) kinds[idx(x, z)] = TILE.grass;
        }
      }
    }

    // Wide road (about five tiles) from the plaza to the clearing, bending gently on the way.
    const bend = visit ? 0 : (random() < 0.5 ? -1 : 1) * (3 + random() * 4);
    road(C + dir.x * (plazaHalf - 0.5), C + dir.z * (plazaHalf - 0.5), clearing.x, clearing.z, bend, 2, i % 3 === 0 ? "fence" : i % 3 === 1 ? "hedge" : "none");
    disc(clearing.x, clearing.z, 4.6, TILE.dirt);

    // Landmark (7x7) beyond the clearing, its door facing the road.
    place({
      id: `landmark-${subject.id}`,
      kind: "landmark",
      x: Math.round(center.x - 3.5),
      z: Math.round(center.z - 3.5),
      w: 7,
      d: 7,
      rot: Math.atan2(-dir.x, -dir.z),
      name: style.landmarkName,
      examine: `${style.landmarkName}, seat of learning for ${subject.name}. Its library holds the subject's codex.`,
      actions: [{ id: "enter-library", label: "Enter" }],
      subjectId: subject.id,
      theme: subject.theme,
    });

    // Waystone loop: a trail around the landmark, one waystone per week.
    const trailRadius = 10.5;
    const arcStart = (-150 * Math.PI) / 180;
    const arcEnd = (150 * Math.PI) / 180;
    const outward = Math.atan2(dir.z, dir.x);
    let prev: { x: number; z: number } | null = null;
    const steps = 56;
    for (let s = 0; s <= steps; s++) {
      const phi = outward + arcStart + ((arcEnd - arcStart) * s) / steps;
      const point = { x: center.x + Math.cos(phi) * trailRadius, z: center.z + Math.sin(phi) * trailRadius };
      if (prev) line(prev.x, prev.z, point.x, point.z, 1, TILE.path);
      prev = point;
    }
    const startPhi = outward + arcStart;
    const endPhi = outward + arcEnd;
    line(center.x + Math.cos(startPhi) * trailRadius, center.z + Math.sin(startPhi) * trailRadius, clearing.x, clearing.z, 1, TILE.path);
    line(center.x + Math.cos(endPhi) * trailRadius, center.z + Math.sin(endPhi) * trailRadius, clearing.x, clearing.z, 1, TILE.path);

    const weeks = subject.weeks.length > 0 ? subject.weeks : [];
    weeks.forEach((week, w) => {
      const t = weeks.length === 1 ? 0.5 : w / (weeks.length - 1);
      const phi = outward + arcStart + 0.12 + (arcEnd - arcStart - 0.24) * t;
      const wx = Math.floor(center.x + Math.cos(phi) * (trailRadius + 2.4));
      const wz = Math.floor(center.z + Math.sin(phi) * (trailRadius + 2.4));
      place({
        id: `waystone-${subject.id}-${week.week}`,
        kind: "waystone",
        x: wx,
        z: wz,
        w: 1,
        d: 1,
        rot: phi + Math.PI,
        name: `Waystone of Week ${week.week}`,
        examine: `Week ${week.week}: ${week.title}`,
        actions: [
          { id: "study", label: "Study" },
          { id: "trial", label: "Trial" },
        ],
        subjectId: subject.id,
        week: week.week,
        theme: subject.theme,
      });
    });

    // Stations around the clearing.
    const ring = (deg: number, radius: number) => {
      const a = outward + (deg * Math.PI) / 180;
      return { x: clearing.x + Math.cos(a) * radius, z: clearing.z + Math.sin(a) * radius };
    };
    const facing = (p: { x: number; z: number }) => Math.atan2(clearing.x - p.x, clearing.z - p.z);
    const station = (
      kind: ObjectKind,
      deg: number,
      radius: number,
      size: number,
      name: string,
      examine: string,
      actions: ObjectAction[],
    ) => {
      const p = ring(deg, radius);
      const object: WorldObject = {
        id: `${kind}-${subject.id}`,
        kind,
        x: Math.round(p.x - size / 2),
        z: Math.round(p.z - size / 2),
        w: size,
        d: size,
        rot: facing(p),
        name,
        examine,
        actions,
        subjectId: subject.id,
        theme: subject.theme,
      };
      place(object);
      const placed = { x: object.x + size / 2, z: object.z + size / 2 };
      object.rot = facing(placed);
      disc(placed.x, placed.z, size / 2 + 1.2, TILE.dirt);
    };

    station("tutor", 55, 5.8, 1, tutorName(subject.theme, i), `Your guide in the ways of ${subject.name}.`, [{ id: "talk", label: "Talk-to" }]);
    station("quest-board", -55, 5.8, 1, "Quest board", `Notices for every ${subject.name} assessment.`, [{ id: "read-board", label: "Read" }]);
    station("duel-arena", 105, 8, 3, "Exam Arena", "The Examiner Wraith waits here: ten hard questions from across the whole subject. Or sit a timed mock exam.", [
      { id: "duel", label: "Challenge" },
      { id: "mock", label: "Mock-exam" },
    ]);
    const workshop = workshopFor(subject);
    if (workshop) {
      const info = WORKSHOP_INFO[workshop];
      station("workshop", -35, 9.2, 1, info.station, `${info.name}: ${info.blurb}`, [{ id: "workshop", label: "Play" }]);
    }
    station("scroll-table", -105, 7.2, 1, "Scroll table", "Scattered scrolls of terms and meanings. Can you pair them?", [{ id: "match", label: "Match" }]);
    station("rune-altar", 150, 6.6, 1, "Rune altar", "Runes shift on its surface, spelling out jumbled words.", [{ id: "scramble", label: "Unscramble" }]);
    station("meditation-shrine", -150, 6.6, 1, "Meditation shrine", "A quiet pool. Time spent here in focus is never wasted.", [{ id: "meditate", label: "Meditate" }]);
    if (subject.assessments.length > 0) {
      station(
        "boss-lair",
        35,
        9.2,
        2,
        "Deadline lair",
        "A ring of dark stones. A boss rises here one week before each assessment is due.",
        [{ id: "boss", label: "Challenge" }],
      );
    }

    // Signpost at the road's start.
    const signAt = { x: C + dir.x * (plazaHalf + 2) + side.x * 3.6, z: C + dir.z * (plazaHalf + 2) + side.z * 3.6 };
    place({
      id: `signpost-${subject.id}`,
      kind: "signpost",
      x: Math.floor(signAt.x),
      z: Math.floor(signAt.z),
      w: 1,
      d: 1,
      rot: angle,
      name: `Signpost to ${subject.name}`,
      examine: `The sign reads: "${style.landmarkName}: ${subject.name}"`,
      actions: [
        { id: "travel", label: "Travel" },
        { id: "read-sign", label: "Read" },
      ],
      subjectId: subject.id,
    });
  });

  // --- Harbour: a pier on the coast in the widest gap between subject regions ---
  let harbour: { x: number; z: number; dir: { x: number; z: number } } | null = null;
  {
    let bestAngle = Math.PI / 2;
    let bestGap = -1;
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const gap = regions.length
        ? Math.min(...regions.map((r) => Math.abs(Math.atan2(Math.sin(a - Math.atan2(r.dir.z, r.dir.x)), Math.cos(a - Math.atan2(r.dir.z, r.dir.x))))))
        : Math.PI;
      // Prefer the widest gap, then the south side (near the spawn).
      const score = gap - Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) * 0.01;
      if (score > bestGap) {
        bestGap = score;
        bestAngle = a;
      }
    }
    const dir = { x: Math.cos(bestAngle), z: Math.sin(bestAngle) };
    let last: { x: number; z: number } | null = null;
    for (let t = plazaHalf + 1; t < C; t += 0.5) {
      const tx = Math.floor(C + dir.x * t);
      const tz = Math.floor(C + dir.z * t);
      if (!inBounds(tx, tz)) break;
      if (kinds[idx(tx, tz)] === TILE.water) break;
      last = { x: tx, z: tz };
    }
    if (last) {
      road(C + dir.x * (plazaHalf - 0.5), C + dir.z * (plazaHalf - 0.5), last.x + 0.5 - dir.x, last.z + 0.5 - dir.z, 0, visit ? 1 : 2, "fence");
      line(last.x + 0.5 - dir.x, last.z + 0.5 - dir.z, last.x + 0.5, last.z + 0.5, 1, TILE.path);
      paint(last.x, last.z, TILE.sand);
      place(
        {
          id: "harbour",
          kind: "harbour",
          x: last.x,
          z: last.z,
          w: 1,
          d: 1,
          rot: Math.atan2(dir.x, dir.z),
          name: "Harbour",
          examine: visit ? "Your boat, ready to sail home or on to another island." : "A boat to your university's other campuses and the universities nearby. Sailing out costs Focus.",
          actions: [{ id: "sail", label: "Sail" }],
        },
        true,
        false,
      );
      harbour = { x: last.x, z: last.z, dir };
    }
  }

  // --- Districts: each kind of place gets its own round court off the Agora -----------
  // A district is a paved court ringed by its buildings (all facing the court), entered
  // through a gateway arch at the end of a wide path from the Agora. Courts sit between
  // the subject roads (and away from the harbour) and never cover a road, so the campus
  // reads as areas — study, play, home, crafts — with room to breathe between them.
  const districts: District[] = [];
  const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const taken: number[] = regions.map((r) => Math.atan2(r.dir.z, r.dir.x));
  if (harbour) taken.push(Math.atan2(harbour.dir.z, harbour.dir.x));
  /** A building around a court: `u` to the side and `v` toward the Agora from the court's centre, facing (fu, fv); `w` along its front, `d` deep. */
  interface DistrictBuilding {
    u: number;
    v: number;
    fu: number;
    fv: number;
    w: number;
    d: number;
    /** Placed exactly where the layout says (no nudging): the walk-in buildings. */
    exact?: boolean;
    object: Omit<WorldObject, "x" | "z" | "rot" | "w" | "d">;
  }
  interface DistrictProp {
    kind: HubProp["kind"];
    u: number;
    v: number;
    fu: number;
    fv: number;
  }
  interface DistrictSpec {
    id: string;
    name: string;
    blurb: string;
    purpose: Purpose;
    icon: PlaceIcon;
    court: number;
    buildings: DistrictBuilding[];
    props: DistrictProp[];
  }
  const DISTRICTS: DistrictSpec[] = [
    {
      id: "learning",
      name: "Scholars' Quarter",
      blurb: "The library, the lecture theatre, the duelling club and the Hall of Trophies.",
      purpose: "study",
      icon: "books",
      court: 5,
      buildings: [
        {
          // Big enough to hold the 12 x 11 theatre room plus walls (lecture/theatre.ts).
          u: 0,
          v: -10.5,
          fu: 0,
          fv: 1,
          w: LECTURE_HALL_SIZE.w,
          d: LECTURE_HALL_SIZE.d,
          exact: true,
          object: {
            id: "lecture-hall",
            kind: "lecture-hall",
            name: "Lecture theatre",
            examine: "Relive any week's lecture: the professor teaches it with slides, narration and check-in questions, researched from the handbook and the web (and your own slides if you bring them).",
            actions: [{ id: "enter-theatre", label: "Enter" }],
          },
        },
        {
          u: -9.5,
          v: 1.5,
          fu: 1,
          fv: 0,
          w: 8,
          d: 7,
          object: {
            id: "library",
            kind: "library",
            name: hub.libraryName,
            examine: "The main library. Inside: your review cards, grades, study plan and mock exams for every subject.",
            actions: [{ id: "library", label: "Enter" }],
          },
        },
        {
          u: 9,
          v: 1.5,
          fu: -1,
          fv: 0,
          w: 7,
          d: 6,
          object: {
            id: "trophy-hall",
            kind: "trophy-hall",
            name: "Hall of Trophies",
            examine: "Your beaten bosses, finished quests and achievements are displayed here.",
            actions: [{ id: "trophies", label: "View" }],
          },
        },
        {
          u: 8,
          v: 10,
          fu: -1,
          fv: 0,
          w: 6,
          d: 6,
          object: {
            id: "duel-club",
            kind: "duel-club",
            name: "Duelling club",
            examine: "A ladder of ten student duellists. Beat the one above you to climb; the board resets each month.",
            actions: [{ id: "ladder", label: "Challenge" }],
          },
        },
      ],
      props: [
        { kind: "book-statue", u: -9, v: 9.5, fu: 0, fv: 1 },
        { kind: "bench", u: -4.2, v: 0, fu: -1, fv: 0 },
        { kind: "bench", u: -4.2, v: 3, fu: -1, fv: 0 },
        { kind: "trophy-statue", u: 4.3, v: 1.5, fu: 0, fv: 1 },
      ],
    },
    {
      id: "market",
      name: "Market Row",
      blurb: "The bazaar, the games hall and the study-group board.",
      purpose: "play",
      icon: "stall",
      court: 4.5,
      buildings: [
        {
          u: 0,
          v: -9,
          fu: 0,
          fv: 1,
          w: 9,
          d: 8,
          object: {
            id: "games-hall",
            kind: "games-hall",
            name: "Games hall",
            examine: "A striped tent of games: tower defence against Procrastination and the Island Race. Each costs a little Focus.",
            actions: [{ id: "arcade", label: "Play" }],
          },
        },
        {
          u: -8,
          v: 1,
          fu: 1,
          fv: 0,
          w: 7,
          d: 5,
          object: {
            id: "bazaar",
            kind: "bazaar",
            name: `${hub.plazaName === "The Agora" ? "Agora" : "Market"} bazaar`,
            examine: "A merchant sells capes, hats and pets for the coins you earn by studying.",
            actions: [{ id: "trade", label: "Trade" }],
          },
        },
        {
          u: 6.5,
          v: 1,
          fu: -1,
          fv: 0,
          w: 2,
          d: 1,
          object: {
            id: "group-board",
            kind: "group-board",
            name: "Study-group board",
            examine: "Classmates pin their progress here. Swap codes to compare levels.",
            actions: [{ id: "group", label: "Read" }],
          },
        },
      ],
      props: [
        { kind: "stall", u: 7.5, v: -3.5, fu: -1, fv: 0 },
        { kind: "stall", u: 7.5, v: 5.5, fu: -1, fv: 0 },
        { kind: "flagpole", u: -5.5, v: -3, fu: 0, fv: 1 },
        { kind: "flagpole", u: 5.5, v: -3, fu: 0, fv: 1 },
        { kind: "crates", u: -8, v: 6.5, fu: 1, fv: 0 },
      ],
    },
    {
      id: "village",
      name: hub.villageName,
      blurb: hub.villageName === "Student Village" ? "Your dorm: rest, study at your desk, change your look, decorate." : "The residential colleges. Your room is here: rest, study, change your look, decorate.",
      purpose: "home",
      icon: "bed",
      court: 4,
      buildings: [
        {
          // Big enough to hold the dorm room plus walls (dorm/dorm.ts ROOM_COLS x ROOM_ROWS).
          u: 0,
          v: -8,
          fu: 0,
          fv: 1,
          w: DORM_SIZE.w,
          d: DORM_SIZE.d,
          exact: true,
          object: {
            id: "dorm",
            kind: "dorm",
            name: "Your dorm",
            examine: "Your room on campus: sleep, study at your desk, open your wardrobe, decorate. A comfy room pays extra Focus with the daily challenges.",
            actions: [{ id: "home", label: "Enter" }],
          },
        },
      ],
      props: [
        { kind: "bench", u: -3.5, v: 0.5, fu: 1, fv: 0 },
        { kind: "bench", u: 3.5, v: 0.5, fu: -1, fv: 0 },
        { kind: "planter", u: -6.5, v: -2, fu: 0, fv: 1 },
        { kind: "planter", u: 6.5, v: -2, fu: 0, fv: 1 },
      ],
    },
    {
      id: "crafts",
      name: "Crafts Yard",
      blurb: "Cook, brew potions and craft wands.",
      purpose: "crafts",
      icon: "hammer",
      court: 4,
      buildings: [
        {
          u: 0,
          v: -5,
          fu: 0,
          fv: 1,
          w: 2,
          d: 2,
          object: {
            id: "cauldron",
            kind: "cauldron",
            name: "Cauldron",
            examine: "Brew potions from what you gather. Every brew asks one question from your subjects.",
            actions: [{ id: "brew", label: "Brew" }],
          },
        },
        {
          u: -5,
          v: 0,
          fu: 1,
          fv: 0,
          w: 2,
          d: 2,
          object: {
            id: "cooking-fire",
            kind: "cooking-fire",
            name: "Campfire",
            examine: "A crackling fire for cooking what you catch.",
            actions: [{ id: "cook", label: "Cook" }],
          },
        },
        {
          u: 5,
          v: 0,
          fu: -1,
          fv: 0,
          w: 2,
          d: 2,
          object: {
            id: "anvil",
            kind: "anvil",
            name: "Wandwright's bench",
            examine: "Craft wands from the timber and ore you gather. A wand casts spell bolts in a fight.",
            actions: [{ id: "craft", label: "Craft" }],
          },
        },
      ],
      props: [
        { kind: "woodpile", u: -5, v: -5, fu: 1, fv: 0 },
        { kind: "crates", u: 5, v: -5, fu: -1, fv: 0 },
      ],
    },
    {
      id: "sports",
      name: "Sports Grounds",
      blurb: "The parkour tower, the archery range and the ping-pong hall.",
      purpose: "play",
      icon: "medal",
      court: 5,
      buildings: [
        {
          u: 0,
          v: -10.5,
          fu: 0,
          fv: 1,
          w: 6,
          d: 6,
          object: {
            id: "parkour-tower",
            kind: "parkour-tower",
            name: "Parkour tower",
            examine: "A towering obby of brightly coloured platforms. Climb it against the clock. A round costs a little Focus; medal times pay coins.",
            actions: [{ id: "parkour", label: "Play" }],
          },
        },
        {
          u: -12,
          v: 0,
          fu: 1,
          fv: 0,
          w: 6,
          d: 11,
          object: {
            id: "archery-range",
            kind: "archery-range",
            name: "Archery range",
            examine: "Shooting lanes with straw targets at the far end. Hit the bullseye for points. A round costs a little Focus; medal scores pay coins.",
            actions: [{ id: "archery", label: "Shoot" }],
          },
        },
        {
          u: 10.5,
          v: 0,
          fu: -1,
          fv: 0,
          w: 8,
          d: 7,
          object: {
            id: "pingpong-hall",
            kind: "pingpong-hall",
            name: "Ping-pong hall",
            examine: "A sports hall with table-tennis tables. Play a rally match. A round costs a little Focus; medals pay coins.",
            actions: [{ id: "pingpong", label: "Play" }],
          },
        },
      ],
      props: [
        { kind: "flagpole", u: -5.5, v: 6, fu: 0, fv: 1 },
        { kind: "flagpole", u: 5.5, v: 6, fu: 0, fv: 1 },
        { kind: "bench", u: -3.5, v: -6.2, fu: 0, fv: 1 },
        { kind: "bench", u: 3.5, v: -6.2, fu: 0, fv: 1 },
      ],
    },
  ];
  /** A district's own grid at a centre tile: F points (squarely) toward the Agora, S across it. */
  const districtFrame = (cx: number, cz: number) => {
    const ox = cx + 0.5;
    const oz = cz + 0.5;
    const tx = C - ox;
    const tz = C - oz;
    const F = Math.abs(tx) >= Math.abs(tz) ? { x: Math.sign(tx) || 1, z: 0 } : { x: 0, z: Math.sign(tz) || 1 };
    const S = { x: -F.z, z: F.x };
    const at = (u: number, v: number) => ({ x: ox + S.x * u + F.x * v, z: oz + S.z * u + F.z * v });
    const facing = (fu: number, fv: number) => ({ x: S.x * fu + F.x * fv, z: S.z * fu + F.z * fv });
    return { ox, oz, F, S, at, facing };
  };
  /** World footprint of a district building: axis-aligned, its front (local width) across the facing direction. */
  const buildingFootprint = (frame: ReturnType<typeof districtFrame>, b: DistrictBuilding) => {
    const p = frame.at(b.u, b.v);
    const f = frame.facing(b.fu, b.fv);
    const frontAlongX = Math.abs(f.z) > 0.5;
    const w = frontAlongX ? b.w : b.d;
    const d = frontAlongX ? b.d : b.w;
    return { x: Math.round(p.x - w / 2), z: Math.round(p.z - d / 2), w, d, rot: Math.atan2(f.x, f.z) };
  };
  /** How far the district reaches toward the Agora (its front edge), in its own v. */
  const districtFront = (spec: DistrictSpec) => Math.max(spec.court + 2.5, ...spec.buildings.map((b) => b.v + (Math.abs(b.fu) > 0.5 ? b.w : b.d) / 2)) + 1;
  /** Rough radius of the whole district (for the area banner and the reserved, tree-free ground). */
  const districtRadius = (spec: DistrictSpec) =>
    Math.max(spec.court + 3, ...spec.buildings.map((b) => Math.hypot(Math.abs(b.u) + Math.max(b.w, b.d) / 2, Math.abs(b.v) + Math.max(b.w, b.d) / 2) + 0.5));
  const tileOpen = (x: number, z: number) => {
    if (x < 2 || z < 2 || x >= size - 2 || z >= size - 2) return false;
    const i = idx(x, z);
    const k = kinds[i];
    return !(k === TILE.water || k === TILE.sand || k === TILE.plaza || k === TILE.path || regionOf[i] !== 0 || blocked[i]);
  };
  /**
   * A district fits when its court, every building footprint (with two tiles to spare all
   * round) and its entrance are on open grass: no road, square, region, water or building.
   */
  const districtFits = (spec: DistrictSpec, cx: number, cz: number) => {
    const frame = districtFrame(cx, cz);
    const r = Math.ceil(spec.court + 2);
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, z - cz) <= spec.court + 2 && !tileOpen(x, z)) return false;
    for (const b of spec.buildings) {
      const fp = buildingFootprint(frame, b);
      for (let z = fp.z - 1; z < fp.z + fp.d + 1; z++) for (let x = fp.x - 1; x < fp.x + fp.w + 1; x++) if (!tileOpen(x, z)) return false;
    }
    const front = districtFront(spec);
    // ...plus a few tiles of open ground in front of the gateway, so it never crowds the Agora.
    for (let v = spec.court; v <= front + 4; v += 0.5) {
      for (let u = -4; u <= 4; u += 1) {
        const p = frame.at(u, v);
        if (!tileOpen(Math.floor(p.x), Math.floor(p.z))) return false;
      }
    }
    return true;
  };
  /**
   * The straight road from the Agora's edge to a district's gateway must cross open country:
   * no building, no subject region and no other district on the way.
   */
  const approachClear = (fx: number, fz: number) => {
    const a = Math.atan2(fz - C, fx - C);
    const sx = C + Math.cos(a) * (plazaHalf + 1);
    const sz = C + Math.sin(a) * (plazaHalf + 1);
    const len = Math.hypot(fx - sx, fz - sz);
    for (let t = 0; t <= len; t += 1) {
      const px = sx + ((fx - sx) * t) / (len || 1);
      const pz = sz + ((fz - sz) * t) / (len || 1);
      for (const [ox, oz] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) {
        const tx = Math.floor(px + ox);
        const tz = Math.floor(pz + oz);
        if (!inBounds(tx, tz) || blocked[idx(tx, tz)] || regionOf[idx(tx, tz)] !== 0 || kinds[idx(tx, tz)] === TILE.water) return false;
      }
      if (districts.some((d) => Math.hypot(px - d.x, pz - d.z) < d.half + 2)) return false;
    }
    return true;
  };
  const pendingProps: Array<{ kind: HubProp["kind"]; x: number; z: number; rot: number }> = [];
  // Biggest districts first, so they get the roomiest spots.
  for (const spec of DISTRICTS.filter((d) => !visit || d.id === "crafts").sort((p, q) => districtRadius(q) - districtRadius(p))) {
    let chosen: { a: number; cx: number; cz: number } | null = null;
    const radius = districtRadius(spec);
    const frontReach = districtFront(spec);
    // On the home campus the gateway stands a good walk out from the Agora (about 20 tiles of
    // open road, six seconds), and courts keep well apart from each other and from the regions.
    const minR = visit ? plazaHalf + spec.court + 3 : plazaHalf + 20 + frontReach;
    const spacedOut = (cx: number, cz: number) => {
      if (visit) return true;
      if (districts.some((d) => Math.hypot(cx - d.x, cz - d.z) < Math.max(34, radius + d.half + 2))) return false;
      if (regions.some((r) => Math.hypot(cx + 0.5 - r.center.x, cz + 0.5 - r.center.z) < radius + REGION_RADIUS + 6)) return false;
      if (harbour && Math.hypot(cx - harbour.x, cz - harbour.z) < radius + 10) return false;
      return true;
    };
    const angles: Array<{ a: number; sep: number }> = [];
    for (let deg = 0; deg < 360; deg += visit ? 3 : 4) {
      const a = (deg * Math.PI) / 180;
      const sep = taken.length ? Math.min(...taken.map((t) => angDist(a, t))) : Math.PI;
      if (sep > 0.2) angles.push({ a, sep });
    }
    // Best spot: as near the Agora as the spacing allows, but well away from the roads already
    // there (one radian of clearance is worth about eight tiles of extra walk).
    let bestScore = Infinity;
    for (const { a, sep } of angles) {
      for (let r = minR; r <= C - radius - 6 && r - sep * 8 < bestScore; r += 1) {
        const cx = Math.floor(C + Math.cos(a) * r);
        const cz = Math.floor(C + Math.sin(a) * r);
        if (!spacedOut(cx, cz) || !districtFits(spec, cx, cz)) continue;
        const frame = districtFrame(cx, cz);
        const front = frame.at(0, frontReach + 0.5);
        if (!visit && !approachClear(front.x, front.z)) continue;
        bestScore = r - sep * 8;
        chosen = { a, cx, cz };
        break;
      }
    }
    if (!chosen) continue;
    const { cx, cz } = chosen;
    taken.push(chosen.a);
    const frame = districtFrame(cx, cz);
    const { ox, oz, F, S, at, facing } = frame;
    const court = spec.court;
    // A wide road from the Agora to the gateway (lined with hedges), then straight up the middle into the court.
    const frontV = districtFront(spec);
    const front = at(0, frontV + 0.5);
    const toFront = Math.atan2(front.z - C, front.x - C);
    road(C + Math.cos(toFront) * (plazaHalf - 0.5), C + Math.sin(toFront) * (plazaHalf - 0.5), front.x, front.z, 0, 2, visit ? "none" : "hedge");
    line(front.x, front.z, ox, oz, 2, TILE.path);
    // The district keeps flat, tree-free ground; the court in the middle is paved.
    // (with a few tiles of open lawn beyond it before the trees start).
    const rr = Math.ceil(radius + 3);
    for (let z = cz - rr; z <= cz + rr; z++) for (let x = cx - rr; x <= cx + rr; x++) if (inBounds(x, z) && regionOf[idx(x, z)] === 0 && Math.hypot(x - cx, z - cz) <= radius + 3) reserved[idx(x, z)] = 1;
    disc(ox, oz, court, TILE.plaza);
    for (const b of spec.buildings) {
      const fp = buildingFootprint(frame, b);
      // Buildings that will hold walk-in rooms keep their exact spot (no nudging).
      place({ ...b.object, ...fp } as WorldObject, true, !b.exact);
      for (let z = fp.z - 1; z <= fp.z + fp.d; z++) for (let x = fp.x - 1; x <= fp.x + fp.w; x++) if (inBounds(x, z)) reserved[idx(x, z)] = 1;
    }
    // Gateway arch over the path at the court's front edge; its two posts are solid.
    const gate = at(0, frontV - 0.5);
    const gateRot = Math.atan2(F.x, F.z);
    for (const side of [-1, 1]) {
      const px = Math.floor(gate.x + S.x * side * 3.3);
      const pz = Math.floor(gate.z + S.z * side * 3.3);
      const nearObject = objects.some((o) => px >= o.x - 1 && px <= o.x + o.w && pz >= o.z - 1 && pz <= o.z + o.d);
      if (inBounds(px, pz) && !nearObject) blocked[idx(px, pz)] = 1;
    }
    for (const p of spec.props) {
      const at2 = at(p.u, p.v);
      const f = facing(p.fu, p.fv);
      // Benches face along their own +X; everything else faces +Z like the buildings.
      pendingProps.push({ kind: p.kind, x: at2.x, z: at2.z, rot: p.kind === "bench" ? Math.atan2(-f.z, f.x) : Math.atan2(f.x, f.z) });
    }
    // Lamp posts around the court's rim.
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const p = at(u * (court + 0.6) * 0.72, v * (court + 0.6) * 0.72);
      pendingProps.push({ kind: "lamp", x: p.x, z: p.z, rot: 0 });
    }
    districts.push({ id: spec.id, name: spec.name, blurb: spec.blurb, purpose: spec.purpose, icon: spec.icon, x: cx, z: cz, half: radius, court, gate: { x: gate.x, z: gate.z, rot: gateRot } });
  }

  // --- Campus dressing around the plaza -----------------------------------------
  const hubProps: HubProp[] = [];
  // Every road leaving the Agora (subjects, districts, harbour) keeps its way out clear.
  const exits = roads.map((r) => {
    const dx = r.pts[0].x - C;
    const dz = r.pts[0].z - C;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dx / len, z: dz / len };
  });
  /** Distance from a point to the walkway from the plaza centre out to each road exit. */
  const nearExit = (px: number, pz: number, clearance: number) =>
    exits.some((d) => {
      const rx = px - C;
      const rz = pz - C;
      const along = rx * d.x + rz * d.z;
      if (along < 0) return false;
      return Math.abs(rx * d.z - rz * d.x) < clearance;
    });
  const propAt = (kind: HubProp["kind"], px: number, pz: number, rot: number, clearance = 3.2) => {
    const tx = Math.floor(px);
    const tz = Math.floor(pz);
    if (!inBounds(tx, tz) || blocked[idx(tx, tz)] || nearExit(px, pz, clearance)) return;
    if (kinds[idx(tx, tz)] === TILE.water) return;
    if (Math.hypot(px - spawn.x, pz - spawn.z) < 1.8) return;
    // Keep a free ring around every interactable so nothing gets walled in.
    for (const o of objects) {
      if (tx >= o.x - 1 && tx <= o.x + o.w && tz >= o.z - 1 && tz <= o.z + o.d) return;
    }
    if (hubProps.some((h) => Math.floor(h.x) === tx && Math.floor(h.z) === tz)) return;
    hubProps.push({ kind, x: px, z: pz, rot });
    blocked[idx(tx, tz)] = 1;
  };
  // Low stone walls frame each corner of the plaza, leaving the middle of every side open.
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const cx = sx < 0 ? plaza.x0 : plaza.x1 - 1;
    const cz = sz < 0 ? plaza.z0 : plaza.z1 - 1;
    for (let k = 0; k < 4; k++) {
      propAt("fence", cx + 0.5, cz + 0.5 - sz * k, 0);
      if (k > 0) propAt("fence", cx + 0.5 - sx * k, cz + 0.5, Math.PI / 2);
    }
  }
  // Lamp posts around the plaza edge.
  for (let t = -(plazaHalf - 2); t <= plazaHalf - 2; t += 5) {
    propAt("lamp", C + t + 0.5, plaza.z0 + 1.5, 0);
    propAt("lamp", C + t + 0.5, plaza.z1 - 1.5, 0);
    propAt("lamp", plaza.x0 + 1.5, C + t + 0.5, 0);
    propAt("lamp", plaza.x1 - 1.5, C + t + 0.5, 0);
  }
  // Each district's own dressing: lamps round its court, benches, statues, stalls.
  for (const p of pendingProps) propAt(p.kind, p.x, p.z, p.rot, 0.6);
  // Benches facing the fountain, and trees in planters.
  propAt("bench", C - 3.5, C + 5.5, Math.PI / 2, 1.2);
  propAt("bench", C + 3.5, C + 5.5, -Math.PI / 2, 1.2);
  for (const [px, pz] of [
    [C - 8.5, C + 0.5],
    [C + 9.5, C - 1.5],
    [C - 7.5, C + 9.5],
    [C + 9.5, C + 8.5],
  ]) {
    propAt("planter", px, pz, 0);
  }

  // --- The open country ------------------------------------------------------------
  // Everything between the places: a lake and a pond joined by a creek that a road crosses on
  // a bridge, rolling hills away from the roads, scenic landmarks with footpaths, lamp posts
  // along the main roads, hedges and fences lining some of them, rock outcrops, groves and
  // flower meadows. Decoration is cheap to draw (instanced) and never blocks a road or doorway.
  const landscape: Landscape = { lamps: [], hedges: [], fences: [], bridges: [], ground: new Uint8Array(size * size) };
  /** Open wild grass: no road, building, region, water or reserved ground. */
  const wild = (x: number, z: number) => inBounds(x, z) && kinds[idx(x, z)] === TILE.grass && !reserved[idx(x, z)] && !blocked[idx(x, z)] && regionOf[idx(x, z)] === 0;
  const nearDistrict = (x: number, z: number, pad: number) => districts.some((d) => Math.hypot(x - d.x - 0.5, z - d.z - 0.5) < d.half + pad);
  const lakes: Array<{ x: number; z: number; r: number }> = [];
  /** Fills a roughly round body of water (with a sandy rim) on wild ground only. */
  const carveWater = (lx: number, lz: number, radius: number) => {
    for (let z = Math.floor(lz - radius - 2); z <= Math.ceil(lz + radius + 2); z++) {
      for (let x = Math.floor(lx - radius - 2); x <= Math.ceil(lx + radius + 2); x++) {
        if (!wild(x, z)) continue;
        const d = Math.hypot(x + 0.5 - lx, z + 0.5 - lz) + (noise(x * 0.5, z * 0.5) - 0.5) * 1.4;
        if (d <= radius) kinds[idx(x, z)] = TILE.water;
        else if (d <= radius + 1) kinds[idx(x, z)] = TILE.sand;
      }
    }
    lakes.push({ x: lx, z: lz, r: radius });
  };
  const discIsWild = (cx: number, cz: number, radius: number) => {
    for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= radius && !wild(x, z)) return false;
      }
    }
    return true;
  };
  /** Distance along a polyline to the point at arc length `s`, with its unit tangent. */
  const along = (pts: Array<{ x: number; z: number }>, s: number) => {
    let left = s;
    for (let k = 1; k < pts.length; k++) {
      const seg = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
      if (left <= seg || k === pts.length - 1) {
        const t = seg > 0 ? Math.min(1, left / seg) : 0;
        return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, z: pts[k - 1].z + (pts[k].z - pts[k - 1].z) * t, tx: (pts[k].x - pts[k - 1].x) / (seg || 1), tz: (pts[k].z - pts[k - 1].z) / (seg || 1) };
      }
      left -= seg;
    }
    return { x: pts[0].x, z: pts[0].z, tx: 1, tz: 0 };
  };
  const polyLength = (pts: Array<{ x: number; z: number }>) => pts.reduce((sum, p, k) => (k === 0 ? 0 : sum + Math.hypot(p.x - pts[k - 1].x, p.z - pts[k - 1].z)), 0);

  if (visit) {
    // A visited island keeps a small lake in the wilds.
    for (let k = 0; k < 12 && lakes.length === 0; k++) {
      const a = random() * Math.PI * 2;
      const lx = C + Math.cos(a) * R * 0.82;
      const lz = C + Math.sin(a) * R * 0.82;
      const radius = 3.2 + random() * 2;
      if (discIsWild(lx, lz, radius + 2)) carveWater(lx, lz, radius);
    }
  } else {
    // A lake and a pond on either side of a main road, joined by a creek that the road crosses
    // on a stone bridge. Tried at a few points along each road until one fits in open country.
    const creekBand = 1.25;
    let built = false;
    // Longest roads first (usually the harbour road, out through open country).
    for (const rd of roads.slice().sort((p, q) => polyLength(q.pts) - polyLength(p.pts))) {
      if (built) break;
      const L = polyLength(rd.pts);
      for (const frac of [0.6, 0.5, 0.7, 0.4, 0.8, 0.3]) {
        if (built) break;
        const s = L * frac;
        if (s < 16 || s > L - 8) continue;
        const p = along(rd.pts, s);
        const nx = -p.tz;
        const nz = p.tx;
        for (const [side, scale] of [[1, 1], [-1, 1], [1, 0.7], [-1, 0.7]]) {
          if (built) break;
          const lakeR = (5.5 + random() * 1.5) * scale;
          const pondR = (3.2 + random() * 0.8) * Math.max(0.85, scale);
          const lake = { x: p.x + nx * side * (lakeR + 8) + p.tx * 3, z: p.z + nz * side * (lakeR + 8) + p.tz * 3 };
          const pond = { x: p.x - nx * side * (pondR + 7) - p.tx * 2, z: p.z - nz * side * (pondR + 7) - p.tz * 2 };
          if (!discIsWild(lake.x, lake.z, lakeR + 3) || !discIsWild(pond.x, pond.z, pondR + 3)) continue;
          if (nearDistrict(lake.x, lake.z, lakeR + 4) || nearDistrict(pond.x, pond.z, pondR + 4)) continue;
          // The creek: lake -> under the road -> pond, wiggling a little.
          const creek: Array<{ x: number; z: number }> = [];
          for (const [a, b] of [[lake, p], [p, pond]] as const) {
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            for (let t = 0; t <= len; t += 0.5) {
              const f = t / len;
              const wob = Math.sin(f * Math.PI) * Math.sin(t * 0.45 + seed * 0.001) * 1.4;
              creek.push({ x: a.x + (b.x - a.x) * f + p.tx * wob, z: a.z + (b.z - a.z) * f + p.tz * wob });
            }
          }
          let ok = true;
          for (const c of creek) {
            for (let oz = -2; oz <= 2 && ok; oz++) {
              for (let ox = -2; ox <= 2 && ok; ox++) {
                const tx = Math.floor(c.x + ox);
                const tz = Math.floor(c.z + oz);
                if (Math.hypot(tx + 0.5 - c.x, tz + 0.5 - c.z) > creekBand + 1) continue;
                if (!inBounds(tx, tz)) ok = false;
                else if (kinds[idx(tx, tz)] === TILE.path) ok = Math.hypot(c.x - p.x, c.z - p.z) < 6.5;
                else if (!wild(tx, tz) && !(Math.hypot(tx - lake.x, tz - lake.z) < lakeR + 1 || Math.hypot(tx - pond.x, tz - pond.z) < pondR + 1)) ok = false;
              }
            }
            if (!ok) break;
          }
          if (!ok) continue;
          carveWater(lake.x, lake.z, lakeR);
          carveWater(pond.x, pond.z, pondR);
          for (const c of creek) {
            for (let oz = -2; oz <= 2; oz++) {
              for (let ox = -2; ox <= 2; ox++) {
                const tx = Math.floor(c.x + ox);
                const tz = Math.floor(c.z + oz);
                if (Math.hypot(tx + 0.5 - c.x, tz + 0.5 - c.z) <= creekBand && inBounds(tx, tz) && (kinds[idx(tx, tz)] === TILE.grass || kinds[idx(tx, tz)] === TILE.sand) && !blocked[idx(tx, tz)]) kinds[idx(tx, tz)] = TILE.water;
              }
            }
          }
          // The road stays a causeway; the bridge is drawn over it, a little longer than the creek is wide.
          landscape.bridges.push({ x: p.x, z: p.z, rot: Math.atan2(p.tx, p.tz), length: 7, width: 5.6 });
          for (let t = -3.5; t <= 3.5; t += 0.5) {
            for (let w = -2.6; w <= 2.6; w += 0.5) {
              const tx = Math.floor(p.x + p.tx * t + nx * w);
              const tz = Math.floor(p.z + p.tz * t + nz * w);
              if (inBounds(tx, tz)) reserved[idx(tx, tz)] = 1;
            }
          }
          built = true;
          break;
        }
      }
    }
    // A second pond out in the country, where there's room.
    for (let k = 0; k < 24; k++) {
      const a = random() * Math.PI * 2;
      const rr = R * (0.45 + random() * 0.35);
      const px = C + Math.cos(a) * rr;
      const pz = C + Math.sin(a) * rr;
      const radius = 3 + random() * 1.5;
      if (lakes.some((l) => Math.hypot(l.x - px, l.z - pz) < 30)) continue;
      if (!discIsWild(px, pz, radius + 4) || nearDistrict(px, pz, radius + 6)) continue;
      carveWater(px, pz, radius);
      break;
    }
  }

  // Rolling hills: distance from anything built (roads, courts, regions, water) sets how high
  // the land may rise, so every road, court and doorway stays flat and the hills swell between.
  /** Distance (in tiles, 8-way chamfer) from every tile to the nearest tile where `source` is true. */
  const distanceFrom = (source: (i: number) => boolean) => {
    const out = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) out[i] = source(i) ? 0 : 1e6;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const i = idx(x, z);
        if (out[i] === 0) continue;
        let d = out[i];
        if (x > 0) d = Math.min(d, out[i - 1] + 1);
        if (z > 0) {
          d = Math.min(d, out[i - size] + 1);
          if (x > 0) d = Math.min(d, out[i - size - 1] + 1.414);
          if (x < size - 1) d = Math.min(d, out[i - size + 1] + 1.414);
        }
        out[i] = d;
      }
    }
    for (let z = size - 1; z >= 0; z--) {
      for (let x = size - 1; x >= 0; x--) {
        const i = idx(x, z);
        if (out[i] === 0) continue;
        let d = out[i];
        if (x < size - 1) d = Math.min(d, out[i + 1] + 1);
        if (z < size - 1) {
          d = Math.min(d, out[i + size] + 1);
          if (x < size - 1) d = Math.min(d, out[i + size + 1] + 1.414);
          if (x > 0) d = Math.min(d, out[i + size - 1] + 1.414);
        }
        out[i] = d;
      }
    }
    return out;
  };
  const far = distanceFrom((i) => kinds[i] !== TILE.grass || reserved[i] === 1 || blocked[i] === 1 || regionOf[i] !== 0);
  const corner = size + 1;
  const hill = new Float32Array(corner * corner);
  if (!visit) {
    for (let z = 0; z <= size; z++) {
      for (let x = 0; x <= size; x++) {
        let d = Infinity;
        for (let oz = -1; oz <= 0; oz++) for (let ox = -1; ox <= 0; ox++) if (inBounds(x + ox, z + oz)) d = Math.min(d, far[idx(x + ox, z + oz)]);
        if (!Number.isFinite(d) || d <= 2) continue;
        const t = Math.min(1, (d - 2) / 10);
        const amp = 6.5 * t * t * (3 - 2 * t);
        const shape = noise(x * 0.05 + 101, z * 0.05 + 57) * 0.6 + noise(x * 0.021 + 13, z * 0.021 + 91) * 0.4;
        hill[z * corner + x] = amp * Math.pow(Math.max(0, (shape - 0.25) / 0.75), 1.3);
      }
    }
  }
  const hillAt = (x: number, z: number) => {
    const cx = Math.max(0, Math.min(size, Math.round(x)));
    const cz = Math.max(0, Math.min(size, Math.round(z)));
    return hill[cz * corner + cx];
  };

  // Scenic landmarks (home campus only), each on open ground with a footpath to the nearest road.
  const groveAt = (x: number, z: number) => noise(x * 0.07 + 40, z * 0.07 + 40);
  const meadowAt = (x: number, z: number) => noise(x * 0.05 + 300, z * 0.05 + 170);
  const rocks: Decor[] = [];
  if (!visit) {
    interface LandmarkSpec {
      kind: SceneryKind;
      w: number;
      d: number;
      name: string;
      examine: string;
      actions: ObjectAction[];
      score: (x: number, z: number, dist: number) => number;
    }
    const nearestLake = (x: number, z: number) => lakes.reduce((best, l) => Math.min(best, Math.hypot(l.x - x, l.z - z) - l.r), Infinity);
    const SPECS: LandmarkSpec[] = [
      {
        kind: "lookout",
        w: 3,
        d: 3,
        name: "Hilltop lookout",
        examine: "A stone lookout on the highest hill, with a brass telescope. Spot any place on campus and head straight there.",
        actions: [{ id: "travel-menu", label: "Look-out" }],
        score: (x, z) => hillAt(x, z) * 10,
      },
      {
        kind: "picnic",
        w: 3,
        d: 2,
        name: "Picnic lawn",
        examine: "Picnic tables by the water. Sit down with your notes and read a subject's codex.",
        actions: [{ id: "sit", label: "Sit" }],
        score: (x, z) => (lakes.length ? -Math.abs(nearestLake(x, z) - 6) * 3 : meadowAt(x, z) * 20),
      },
      {
        kind: "windmill",
        w: 3,
        d: 3,
        name: "Old windmill",
        examine: "The plaque by the door reads: \"Little and often turns the mill. Twenty minutes of recall a day beats a five-hour cram.\"",
        actions: [{ id: "read-sign", label: "Read-plaque" }],
        score: (x, z, dist) => dist / R * 20 + hillAt(x, z) * 2,
      },
      {
        kind: "ruins",
        w: 4,
        d: 4,
        name: "Ruins of the first college",
        examine: "Broken columns carved with old mistakes. Study the runes to review the questions you got wrong.",
        actions: [{ id: "review", label: "Study-runes" }],
        score: (x, z) => groveAt(x, z) * 20 + hillAt(x, z),
      },
      {
        kind: "bell-tower",
        w: 3,
        d: 3,
        name: "Bell tower",
        examine: "The old bell tower rings the hours. Check what's due and today's challenges.",
        actions: [{ id: "plan", label: "Check-the-hour" }],
        score: (x, z, dist) => -Math.abs(dist - R * 0.55) * 0.5 - far[idx(x, z)],
      },
    ];
    const placedMarks: Array<{ x: number; z: number }> = [];
    for (const spec of SPECS) {
      let best: { x: number; z: number; s: number } | null = null;
      for (let z = 4; z < size - 4; z += 2) {
        for (let x = 4; x < size - 4; x += 2) {
          const i = idx(x, z);
          if (far[i] < 4 || far[i] > 16 || !wild(x, z)) continue;
          const cx = x + spec.w / 2;
          const cz = z + spec.d / 2;
          const dist = Math.hypot(cx - C, cz - C);
          if (dist < plazaHalf + 22 || dist > C - 10) continue;
          if (placedMarks.some((m) => Math.hypot(m.x - cx, m.z - cz) < 30)) continue;
          if (nearDistrict(cx, cz, 6) || regions.some((r) => Math.hypot(r.center.x - cx, r.center.z - cz) < REGION_RADIUS + 6)) continue;
          const s = spec.score(cx, cz, dist);
          if (best && s <= best.s) continue;
          let open = true;
          for (let tz = z - 2; tz < z + spec.d + 2 && open; tz++) for (let tx = x - 2; tx < x + spec.w + 2 && open; tx++) if (!wild(tx, tz)) open = false;
          if (open) best = { x, z, s };
        }
      }
      if (!best) continue;
      const cx = best.x + spec.w / 2;
      const cz = best.z + spec.d / 2;
      placedMarks.push({ x: cx, z: cz });
      place(
        {
          id: `scenery-${spec.kind}`,
          kind: "scenery",
          scenery: spec.kind,
          x: best.x,
          z: best.z,
          w: spec.w,
          d: spec.d,
          rot: Math.atan2(C - cx, C - cz),
          name: spec.name,
          examine: spec.examine,
          actions: spec.actions,
        },
        true,
        false,
      );
      for (let tz = best.z - 1; tz <= best.z + spec.d; tz++) for (let tx = best.x - 1; tx <= best.x + spec.w; tx++) if (inBounds(tx, tz)) reserved[idx(tx, tz)] = 1;
      // A dirt footpath from the landmark to the nearest road (breadth-first over open ground).
      const prev = new Map<number, number>();
      const queue: number[] = [];
      for (let tz = best.z - 1; tz <= best.z + spec.d; tz++) {
        for (let tx = best.x - 1; tx <= best.x + spec.w; tx++) {
          if (!inBounds(tx, tz) || blocked[idx(tx, tz)] || kinds[idx(tx, tz)] === TILE.water) continue;
          prev.set(idx(tx, tz), -1);
          queue.push(idx(tx, tz));
        }
      }
      let found = -1;
      for (let q = 0; q < queue.length && q < 5000; q++) {
        const cur = queue[q];
        if (kinds[cur] === TILE.path) {
          found = cur;
          break;
        }
        const x0 = cur % size;
        const z0 = Math.floor(cur / size);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tx = x0 + dx;
          const tz = z0 + dz;
          if (!inBounds(tx, tz)) continue;
          const ni = idx(tx, tz);
          if (prev.has(ni) || blocked[ni] || kinds[ni] === TILE.water || kinds[ni] === TILE.sand || regionOf[ni] !== 0) continue;
          prev.set(ni, cur);
          queue.push(ni);
        }
      }
      for (let cur = found; cur >= 0; cur = prev.get(cur) ?? -1) {
        if (kinds[cur] === TILE.grass) {
          kinds[cur] = TILE.dirt;
          reserved[cur] = 1;
        }
      }
    }

    // Rock outcrops on the hills: a few big boulders together.
    const outcrops: Array<{ x: number; z: number }> = [];
    for (let z = 6; z < size - 6 && outcrops.length < 7; z += 3) {
      for (let x = 6; x < size - 6 && outcrops.length < 7; x += 3) {
        if (!wild(x, z) || far[idx(x, z)] < 7 || hillAt(x, z) < 1.4) continue;
        if (outcrops.some((o) => Math.hypot(o.x - x, o.z - z) < 22) || placedMarks.some((m) => Math.hypot(m.x - x, m.z - z) < 10)) continue;
        if (noise(x * 0.3 + 77, z * 0.3 + 11) < 0.55) continue;
        outcrops.push({ x, z });
        const count = 4 + Math.floor(random() * 3);
        for (let k = 0; k < count; k++) {
          const a = random() * Math.PI * 2;
          const rr = k === 0 ? 0 : 1 + random() * 1.6;
          const rx = x + 0.5 + Math.cos(a) * rr;
          const rz = z + 0.5 + Math.sin(a) * rr;
          const t = idx(Math.floor(rx), Math.floor(rz));
          if (!wild(Math.floor(rx), Math.floor(rz))) continue;
          rocks.push({ x: rx, z: rz, scale: k === 0 ? 2.6 + random() * 0.8 : 1.1 + random() * 1.3, variant: 1, rot: random() * Math.PI * 2 });
          blocked[t] = 1;
        }
      }
    }
  }

  // Lamp posts along every main road, alternating sides; hedges along the roads out to the
  // districts and wooden fences along some subject roads, broken by gaps every few tiles.
  const objectNear = (x: number, z: number, pad: number) => objects.some((o) => x >= o.x - pad && x < o.x + o.w + pad && z >= o.z - pad && z < o.z + o.d + pad);
  const plazaNear = (x: number, z: number, pad: number) => x >= plaza.x0 - pad && x < plaza.x1 + pad && z >= plaza.z0 - pad && z < plaza.z1 + pad;
  for (const rd of roads) {
    const L = polyLength(rd.pts);
    let side = 1;
    for (let s = 6; s < L - 3; s += 11) {
      const p = along(rd.pts, s);
      const x = p.x - p.tz * side * 3.4;
      const z = p.z + p.tx * side * 3.4;
      side = -side;
      const tx = Math.floor(x);
      const tz = Math.floor(z);
      if (!wild(tx, tz) || plazaNear(tx, tz, 2) || objectNear(tx, tz, 2) || nearDistrict(x, z, 1)) continue;
      landscape.lamps.push({ x, z });
      blocked[idx(tx, tz)] = 1;
      reserved[idx(tx, tz)] = 1;
    }
    if (rd.dress === "none" || visit) continue;
    const runs = rd.dress === "hedge" ? landscape.hedges : landscape.fences;
    const runLen = rd.dress === "hedge" ? 4 : 5;
    for (let s = 5; s < L - runLen - 4; s += runLen + 2.5) {
      if (rd.dress === "fence" && noise(s * 0.08 + (seed % 97), 3.3) < 0.3) continue;
      for (const sd of [1, -1]) {
        const tiles: number[] = [];
        let ok = true;
        for (let t = 0; t <= runLen && ok; t += 0.5) {
          const p = along(rd.pts, s + t);
          const tx = Math.floor(p.x - p.tz * sd * 3.4);
          const tz = Math.floor(p.z + p.tx * sd * 3.4);
          const ti = inBounds(tx, tz) ? idx(tx, tz) : -1;
          if (ti < 0) ok = false;
          else if (!tiles.includes(ti)) {
            if (!wild(tx, tz) || plazaNear(tx, tz, 2) || objectNear(tx, tz, 1) || nearDistrict(tx + 0.5, tz + 0.5, 2)) ok = false;
            else tiles.push(ti);
          }
        }
        if (!ok || tiles.length === 0) continue;
        const a = along(rd.pts, s);
        const b = along(rd.pts, s + runLen);
        const ax = a.x - a.tz * sd * 3.4;
        const az = a.z + a.tx * sd * 3.4;
        const bx = b.x - b.tz * sd * 3.4;
        const bz = b.z + b.tx * sd * 3.4;
        runs.push({ x: (ax + bx) / 2, z: (az + bz) / 2, rot: Math.atan2(-(bz - az), bx - ax), len: Math.hypot(bx - ax, bz - az) });
        for (const ti of tiles) {
          blocked[ti] = 1;
          reserved[ti] = 1;
        }
      }
    }
  }

  // --- Life-skill nodes in the wilds -------------------------------------------
  // Fishing spots on the shoreline, ore rocks and ancient trees outside the subject regions,
  // with easier tiers nearer the Agora. A campfire and an anvil sit just outside the plaza.
  const wildTiles: Array<{ x: number; z: number; dist: number; shore: boolean }> = [];
  for (let z = 2; z < size - 2; z++) {
    for (let x = 2; x < size - 2; x++) {
      const i = idx(x, z);
      if (reserved[i] || blocked[i] || regionOf[i] !== 0) continue;
      if (kinds[i] !== TILE.grass && kinds[i] !== TILE.sand) continue;
      const dist = Math.hypot(x + 0.5 - C, z + 0.5 - C);
      if (dist < plazaHalf + 4) continue;
      const shore = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dz]) => kinds[idx(x + dx, z + dz)] === TILE.water);
      wildTiles.push({ x, z, dist, shore });
    }
  }
  const nodeTiers = [0, 0, 1, 1, 2, 3];
  const tierIds: Record<"fishing-spot" | "ore-rock" | "tree-node", string[]> = {
    "fishing-spot": ["minnow", "trout", "salmon", "goldfin"],
    "ore-rock": ["copper", "iron", "silver", "gold"],
    "tree-node": ["oak", "willow", "maple", "yew"],
  };
  const nodeInfo: Record<"fishing-spot" | "ore-rock" | "tree-node", { label: string; verb: string; examine: string }> = {
    "fishing-spot": { label: "fishing spot", verb: "Fish", examine: "Ripples on the water. Something's biting." },
    "ore-rock": { label: "rock", verb: "Mine", examine: "A rock with a vein of ore." },
    "tree-node": { label: "tree", verb: "Chop", examine: "An old tree with good timber." },
  };
  const placedNodes: Array<{ x: number; z: number }> = [];
  for (const kind of ["fishing-spot", "ore-rock", "tree-node"] as const) {
    const pool = wildTiles.filter((t) => (kind === "fishing-spot" ? t.shore : !t.shore));
    if (pool.length === 0) continue;
    // Spread nodes around the island: sort by angle, then take evenly spaced picks.
    const sorted = pool.slice().sort((a, b) => Math.atan2(a.z - C, a.x - C) - Math.atan2(b.z - C, b.x - C));
    const offset = Math.floor(random() * sorted.length);
    nodeTiers.forEach((tier, n) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const t = sorted[(offset + Math.floor(((n + attempt * 0.07) * sorted.length) / nodeTiers.length)) % sorted.length];
        if (placedNodes.some((p) => Math.hypot(p.x - t.x, p.z - t.z) < 4)) continue;
        if (blocked[idx(t.x, t.z)] || reserved[idx(t.x, t.z)]) continue;
        const id = tierIds[kind][Math.min(3, tier + tierShift)];
        const name = `${id[0].toUpperCase()}${id.slice(1)} ${nodeInfo[kind].label}`;
        const water = kind === "fishing-spot" ? [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => kinds[idx(t.x + dx, t.z + dz)] === TILE.water) : null;
        place(
          {
            id: `${kind}-${n}`,
            kind,
            x: t.x,
            z: t.z,
            w: 1,
            d: 1,
            rot: water ? Math.atan2(water[0], water[1]) : random() * Math.PI * 2,
            name,
            examine: nodeInfo[kind].examine,
            actions: [{ id: "gather", label: nodeInfo[kind].verb }],
            resource: id,
          },
          true,
          false,
        );
        placedNodes.push(t);
        break;
      }
    });
  }
  // Monster camps and the crypt: open wild ground away from everything else, harder further out.
  const camps: Camp[] = [];
  const clearAround = (x: number, z: number, r: number) => {
    for (let oz = -r; oz <= r; oz++) for (let ox = -r; ox <= r; ox++) {
      const tx = x + ox;
      const tz = z + oz;
      if (!inBounds(tx, tz) || reserved[idx(tx, tz)] || blocked[idx(tx, tz)] || kinds[idx(tx, tz)] === TILE.water) return false;
    }
    return true;
  };
  /** Marks every tile within `radius` of a point (a cheap lookup instead of scanning every object per tile). */
  const stamp = (mask: Uint8Array, px: number, pz: number, radius: number) => {
    for (let z = Math.floor(pz - radius); z <= Math.ceil(pz + radius); z++) {
      for (let x = Math.floor(px - radius); x <= Math.ceil(px + radius); x++) {
        if (inBounds(x, z) && Math.hypot(px - x, pz - z) < radius) mask[idx(x, z)] = 1;
      }
    }
  };
  // Monster camps keep deep in the wilds: on the home campus at least 20 tiles from every road,
  // building, district and the harbour (visited islands are small, so 7 from buildings, 3 from roads).
  const builtMask = new Uint8Array(size * size);
  for (const o of objects) {
    if (o.resource) continue;
    for (let z = o.z; z < o.z + o.d; z++) for (let x = o.x; x < o.x + o.w; x++) if (inBounds(x, z)) builtMask[idx(x, z)] = 1;
  }
  for (const d of districts) stamp(builtMask, d.x + 0.5, d.z + 0.5, d.half);
  const fromBuilt = distanceFrom((i) => builtMask[i] === 1);
  const fromRoad = distanceFrom((i) => kinds[i] === TILE.path || kinds[i] === TILE.plaza);
  const campClearance = (x: number, z: number) => Math.min(fromBuilt[idx(x, z)], fromRoad[idx(x, z)]);
  /** Keep fights away from study (see above). */
  const farFromStudy = (x: number, z: number, need: number) =>
    visit ? fromBuilt[idx(x, z)] >= 7 && fromRoad[idx(x, z)] >= 3.5 : campClearance(x, z) >= need;
  const campSpots = wildTiles
    .filter((t) => !t.shore && t.dist > plazaHalf + 7 && clearAround(t.x, t.z, 2) && farFromStudy(t.x, t.z, 14) && !placedNodes.some((p) => Math.hypot(p.x - t.x, p.z - t.z) < 4))
    .sort((a, b) => a.dist - b.dist);
  // Deepest spots first (20+ tiles clear); only if the island has too few of those, 14+.
  const strict = campSpots.filter((t) => farFromStudy(t.x, t.z, 20));
  for (const spot of [...strict, ...campSpots]) {
    if (camps.length >= 6 || (camps.length >= 3 && !farFromStudy(spot.x, spot.z, 20))) break;
    if (camps.some((c) => Math.hypot(c.x - spot.x, c.z - spot.z) < 9)) continue;
    if (!clearAround(spot.x, spot.z, 2)) continue;
    camps.push({ x: spot.x, z: spot.z, tier: 0 });
    for (let oz = -2; oz <= 2; oz++) for (let ox = -2; ox <= 2; ox++) reserved[idx(spot.x + ox, spot.z + oz)] = 1;
  }
  camps.forEach((c, i) => (c.tier = Math.min(2, (i < 2 ? 0 : i < 4 ? 1 : 2) + tierShift) as Camp["tier"]));
  const cryptSpot = wildTiles
    .filter((t) => !t.shore && clearAround(t.x, t.z, 2) && !camps.some((c) => Math.hypot(c.x - t.x, c.z - t.z) < 6))
    .sort((a, b) => b.dist - a.dist)[0];
  if (cryptSpot && !visit) {
    place({
      id: "crypt-gate",
      kind: "crypt-gate",
      x: cryptSpot.x,
      z: cryptSpot.z,
      w: 2,
      d: 2,
      rot: Math.atan2(C - cryptSpot.x, C - cryptSpot.z),
      name: "Crypt of the Forgotten",
      examine: "A sealed crypt. Three waves of the dead and the Crypt King wait inside. Entering costs 15 Focus.",
      actions: [{ id: "dungeon", label: "Enter" }],
    });
    for (let oz = -3; oz <= 4; oz++) for (let ox = -3; ox <= 4; ox++) if (inBounds(cryptSpot.x + ox, cryptSpot.z + oz)) reserved[idx(cryptSpot.x + ox, cryptSpot.z + oz)] = 1;
  }


  // Secret doors: three hidden in quiet corners of the wilds (home only), spread around the island.
  if (!visit) {
    const objectClose = new Uint8Array(size * size);
    for (const o of objects) stamp(objectClose, o.x, o.z, 5);
    const quiet = wildTiles
      .filter(
        (t) =>
          !t.shore &&
          t.dist > plazaHalf + 9 &&
          !objectClose[idx(t.x, t.z)] &&
          clearAround(t.x, t.z, 1) &&
          !camps.some((c) => Math.hypot(c.x - t.x, c.z - t.z) < 6) &&
          !placedNodes.some((p) => Math.hypot(p.x - t.x, p.z - t.z) < 3),
      )
      .sort((a, b) => Math.atan2(a.z - C, a.x - C) - Math.atan2(b.z - C, b.x - C));
    for (let k = 0; k < 3 && quiet.length; k++) {
      const t = quiet[Math.floor(((k + 0.3) * quiet.length) / 3) % quiet.length];
      if (!clearAround(t.x, t.z, 1)) continue;
      place(
        {
          id: `secret-${k}`,
          kind: "secret-door",
          x: t.x,
          z: t.z,
          w: 1,
          d: 1,
          rot: Math.atan2(C - t.x, C - t.z),
          name: "Mossy stone door",
          examine: "A door set into the rock, covered in faint runes. It wants a password.",
          actions: [{ id: "knock", label: "Read runes" }],
        },
        true,
        false,
      );
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) if (inBounds(t.x + ox, t.z + oz)) reserved[idx(t.x + ox, t.z + oz)] = 1;
    }
  }

  // --- Trees, rocks, flowers ---------------------------------------------------
  const nearReserved = (x: number, z: number) => {
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) if (inBounds(x + ox, z + oz) && reserved[idx(x + ox, z + oz)]) return true;
    return false;
  };
  const trees: Decor[] = [];
  const flowers: Decor[] = [];
  // Trees grow in groves (dense clumps with clearings between), with a few lone trees in the
  // open, pine woods in some parts and autumn colour in others; flower meadows have no trees.
  // Counts stay close to the old campus's so slow laptops cope with the bigger island.
  const thin = visit ? Math.min(1, (100 / size) ** 2 * 1.35) : 0.55;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, z);
      if (kinds[i] !== TILE.grass || reserved[i] || nearReserved(x, z)) continue;
      const dist = Math.hypot(x + 0.5 - C, z + 0.5 - C);
      if (dist < plazaHalf + 3) continue;
      const inRegion = regionOf[i] > 0;
      const grove = groveAt(x, z);
      const meadow = !inRegion && !visit && meadowAt(x, z) > 0.64;
      let chance: number;
      if (visit) {
        const forest = noise(x * 0.18 + 40, z * 0.18 + 40);
        chance = (inRegion ? 0.025 : 0.06 + Math.max(0, forest - 0.45) * 0.9) * thin;
      } else if (inRegion) chance = 0.02 + Math.max(0, grove - 0.62) * 0.25;
      else if (meadow) chance = 0.002;
      else chance = (grove > 0.58 ? 0.16 + (grove - 0.58) * 1.6 : 0.008) * thin;
      const roll = random();
      if (roll < chance) {
        const pine = noise(x * 0.035 + 900, z * 0.035 + 900) > 0.56;
        const autumn = !pine && noise(x * 0.09 + 500, z * 0.09 + 500) > 0.68;
        trees.push({ x: x + 0.2 + random() * 0.6, z: z + 0.2 + random() * 0.6, scale: (grove > 0.58 ? 0.9 : 1.1) + random() * 0.6, variant: pine ? 1 : autumn ? 2 : 0, rot: random() * Math.PI * 2 });
        blocked[i] = 1;
      } else if (roll < chance + (meadow ? 0.001 : 0.004)) {
        rocks.push({ x: x + 0.2 + random() * 0.6, z: z + 0.2 + random() * 0.6, scale: 0.5 + random() * 0.6, variant: 0, rot: random() * Math.PI * 2 });
        blocked[i] = 1;
      } else if (roll < chance + (meadow ? 0.32 : 0.035)) {
        flowers.push({ x: x + 0.2 + random() * 0.6, z: z + 0.2 + random() * 0.6, scale: (meadow ? 0.9 : 0.7) + random() * 0.5, variant: Math.floor(random() * 4), rot: 0 });
      }
    }
  }

  // Ground character: campus lawn round the Agora and the districts, meadows, woodland floor
  // under the groves, and dry bushland toward the coast.
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, z);
      if (kinds[i] !== TILE.grass || regionOf[i] !== 0) continue;
      let g: number = GROUND.plain;
      if (plazaNear(x, z, 4) || nearDistrict(x + 0.5, z + 0.5, 1)) g = GROUND.lawn;
      else if (visit) g = GROUND.plain;
      else if (meadowAt(x, z) > 0.62) g = GROUND.meadow;
      else if (groveAt(x, z) > 0.6) g = GROUND.forest;
      else if (Math.hypot(x + 0.5 - C, z + 0.5 - C) > C * 0.74) g = GROUND.bush;
      landscape.ground[i] = g;
    }
  }

  // --- Heights -----------------------------------------------------------------
  const heights = new Float32Array(corner * corner);
  const pinned = new Uint8Array(corner * corner);
  for (let z = 0; z <= size; z++) {
    for (let x = 0; x <= size; x++) {
      let flat = false;
      let water = false;
      let sand = false;
      for (let oz = -1; oz <= 0; oz++) {
        for (let ox = -1; ox <= 0; ox++) {
          const tx = x + ox;
          const tz = z + oz;
          if (!inBounds(tx, tz)) {
            water = true;
            continue;
          }
          const k = kinds[idx(tx, tz)];
          if (k === TILE.water) water = true;
          else if (k === TILE.sand) sand = true;
          if (reserved[idx(tx, tz)]) flat = true;
        }
      }
      const rise = hill[z * corner + x];
      let h = (noise(x * 0.09, z * 0.09) - 0.4) * 1.4 + (noise(x * 0.35 + 9, z * 0.35 + 9) - 0.5) * 0.25 + rise;
      // Built ground is flat (and follows the hill it stands on, out in the country).
      if (flat) h = 0.02 + rise;
      if (sand) h = Math.min(h, 0.0) * 0.3 - 0.05;
      if (water) h = -0.55;
      heights[z * corner + x] = Math.max(-0.6, h);
      pinned[z * corner + x] = flat ? 1 : 0;
    }
  }
  // Soften hills (never moves the flat ground under buildings and paths).
  for (let pass = 0; pass < 2; pass++) {
    const copy = heights.slice();
    for (let z = 1; z < size; z++) {
      for (let x = 1; x < size; x++) {
        const i = z * corner + x;
        if (pinned[i]) continue;
        let sum = 0;
        for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) sum += copy[i + oz * corner + ox];
        heights[i] = sum / 9;
      }
    }
  }

  const walkable = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) walkable[i] = kinds[i] !== TILE.water && !blocked[i] ? 1 : 0;

  // Arriving by boat: start on the path just inland of the pier.
  const start =
    (options.arriveByBoat || visit) && harbour
      ? { x: harbour.x + 0.5 - harbour.dir.x * 1.2, z: harbour.z + 0.5 - harbour.dir.z * 1.2 }
      : spawn;
  return { mode: "island", islandId: island?.id ?? "home", hub, hubProps, camps, districts, size, kinds, regionOf, heights, walkable, objects, trees, rocks, flowers, regions, spawn: start, plaza, landscape };
}

/** Bilinear ground height at a world position. */
export function groundHeight(world: World, x: number, z: number): number {
  const corner = world.size + 1;
  const cx = Math.max(0, Math.min(world.size - 0.001, x));
  const cz = Math.max(0, Math.min(world.size - 0.001, z));
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const tx = cx - x0;
  const tz = cz - z0;
  const h = (ix: number, iz: number) => world.heights[iz * corner + ix];
  const a = h(x0, z0) * (1 - tx) + h(x0 + 1, z0) * tx;
  const b = h(x0, z0 + 1) * (1 - tx) + h(x0 + 1, z0 + 1) * tx;
  return Math.max(0, a * (1 - tz) + b * tz);
}

export function isWalkable(world: World, x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= world.size || z >= world.size) return false;
  return world.walkable[z * world.size + x] === 1;
}

export function objectCenter(object: WorldObject): { x: number; z: number } {
  return { x: object.x + object.w / 2, z: object.z + object.d / 2 };
}
