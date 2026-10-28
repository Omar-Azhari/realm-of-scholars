/**
 * Asset-manifest schema — the contract between the rendering engine and the
 * artwork living in public/assets/.
 *
 * The engine renders whatever the manifest describes; it never hardcodes
 * artwork. Replacing any visual (a character, a room background, a prop, a
 * light, a particle field, a trophy icon) means changing files under
 * public/assets/ — no application code changes. See public/assets/README.md
 * for the replacement workflow.
 */

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

/** Placeholder sprite format: character grids + palette (see spriteEngine.ts). */
export interface PixelGridSpriteAsset {
  type: "pixel-grid";
  width: number;
  height: number;
  palette: Record<string, string>;
  /** Named frame grids, referenced by animations to avoid duplication. */
  grids: Record<string, string[]>;
  animations: Record<string, { fps: number; loop: boolean; frames: string[] }>;
}

/** Final-art sprite format: a PNG/WebP sheet of fixed-size frames, left-to-right, top-to-bottom. */
export interface SpritesheetSpriteAsset {
  type: "spritesheet";
  /** Image path relative to public/assets/. */
  image: string;
  frameWidth: number;
  frameHeight: number;
  /** Frames counted across the sheet, row-major from 0. */
  animations: Record<string, { fps: number; loop: boolean; frames: number[] }>;
}

export type SpriteAsset = PixelGridSpriteAsset | SpritesheetSpriteAsset;

export type SpriteAnimationName = "idle" | "walk" | "celebrate" | "stressed" | "wave";

/* ------------------------------------------------------------------ */
/* Scene primitives                                                    */
/* ------------------------------------------------------------------ */

export interface PlacedImage {
  id: string;
  /** Path relative to public/assets/. */
  src: string;
  /** Position + size in scene units. */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
}

/** Local-time bucket driving scene atmosphere (Melbourne wall clock). */
export type DayPhase = "day" | "evening" | "night";

export type LightDef =
  | {
      id: string;
      type: "cone";
      /** Apex of the cone. */
      x: number;
      y: number;
      spreadTop: number;
      spreadBottom: number;
      bottomY: number;
      color: string;
      opacity: number;
      /** Restrict this light to certain day phases (window glow at night, etc.). Omit = always on. */
      phases?: DayPhase[];
    }
  | {
      id: string;
      type: "glow";
      x: number;
      y: number;
      rx: number;
      ry: number;
      color: string;
      opacity: number;
      phases?: DayPhase[];
    };

/** Per-day-phase atmosphere grading applied over a scene's background. */
export interface AtmosphereDef {
  /** Full-stage tint colour + strength. */
  tint: string;
  tintOpacity: number;
  /** Multiplier on every light's opacity. */
  lightScale: number;
  /** Multiplier on ambient particle count. */
  particleScale: number;
}

/**
 * Ambient movement primitives — small looping effects composed per scene in
 * the manifest (server LEDs, network pulses, clock hands, swaying lights…).
 * All are skipped under reduced motion.
 */
export type AmbienceDef =
  | { id: string; type: "pulse-dot"; x: number; y: number; r: number; color: string; periodSeconds: number; delaySeconds?: number }
  | { id: string; type: "glow-breathe"; x: number; y: number; rx: number; ry: number; color: string; minOpacity: number; maxOpacity: number; periodSeconds: number }
  | { id: string; type: "scan-line"; x1: number; y1: number; x2: number; y2: number; color: string; r: number; periodSeconds: number; delaySeconds?: number }
  | { id: string; type: "flicker-rect"; x: number; y: number; width: number; height: number; color: string; maxOpacity: number; periodSeconds: number }
  | { id: string; type: "sway"; x: number; y: number; length: number; color: string; angleDegrees: number; periodSeconds: number };

export interface ParticleDef {
  count: number;
  color: string;
  minSize: number;
  maxSize: number;
  opacity: number;
  /** Seconds for one drift loop. */
  driftSeconds: number;
}

/* ------------------------------------------------------------------ */
/* Data-bound widgets (room scenes)                                    */
/*                                                                     */
/* Geometry, colours, and skin images come from the manifest; the      */
/* application injects live values (progress, completions, counts).    */
/* ------------------------------------------------------------------ */

/** Live values a widget can bind to — computed by the app, never stored in assets. */
export interface SceneDataBindings {
  progressPercent: number;
  completedModules: number;
  totalModules: number;
  moduleCompletion: boolean[];
  pendingMissionCount: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  upcomingCount: number;
}

export type StatBindKey = "progressPercent" | "moduleRatio" | "upcomingCount" | "pendingMissionCount";

export type WidgetDef =
  | {
      id: string;
      type: "module-grid";
      x: number;
      y: number;
      cols: number;
      stepX: number;
      stepY: number;
      cellWidth: number;
      cellHeight: number;
      onColor: string;
      offColor: string;
      onStroke: string;
      offStroke: string;
    }
  | {
      id: string;
      type: "stat-text";
      x: number;
      y: number;
      fontSize: number;
      color: string;
      align: "start" | "middle" | "end";
      /** Static label when no bind is given. */
      text?: string;
      bind?: StatBindKey;
      /** "{value}" is replaced with the bound value. */
      template?: string;
      letterSpacing?: number;
      bold?: boolean;
    }
  | {
      id: string;
      type: "progress-bar";
      x: number;
      y: number;
      width: number;
      height: number;
      fg: string;
      bg: string;
    }
  | {
      id: string;
      type: "trophy-row";
      positions: Array<[number, number]>;
      width: number;
      height: number;
      /** Skin images, relative to public/assets/. */
      litSrc: string;
      lockedSrc: string;
      lockedOpacity: number;
    }
  | {
      id: string;
      type: "note-board";
      positions: Array<[number, number]>;
      width: number;
      height: number;
      /** Note skin images cycled across visible notes. */
      srcs: string[];
      maxNotes: number;
    }
  | {
      id: string;
      type: "holo-cone";
      baseX: number;
      baseY: number;
      topY: number;
      halfBase: number;
      halfTop: number;
      color: string;
      labelColor: string;
      template: string;
      bind: StatBindKey;
      fontSize: number;
    };

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  feetY: number;
}

export interface SceneBase {
  width: number;
  height: number;
  /** Background artwork path relative to public/assets/. */
  background: string;
  /** Extra static props layered above the background. */
  images: PlacedImage[];
  lights: LightDef[];
  particles: ParticleDef | null;
  /** Optional time-of-day grading; phases not listed render ungraded. */
  atmosphere?: Partial<Record<DayPhase, AtmosphereDef>>;
  /** Optional ambient movement layer. */
  ambience?: AmbienceDef[];
}

export interface HallDoorDef {
  subjectId: string;
  /** Door centre, scene units. */
  x: number;
  accent: string;
  accent2: string;
  panel: string;
  /** Short in-world signage label (full name stays in accessible labels). */
  label: string;
  /** Optional final-art door panel image (slides open as one piece per half). */
  panelSrc?: string;
}

/**
 * One additive semester-era layer for the hall (0 early · 1 mid · 2 late ·
 * 3 complete). Layers accumulate as the semester progresses — same pattern
 * as room evolution stages, driven by the derived calendar era.
 */
export interface HallEraLayerDef {
  era: number;
  images?: PlacedImage[];
  lights?: LightDef[];
  ambience?: AmbienceDef[];
}

export interface HallSceneDef extends SceneBase {
  kind: "hall";
  /** Optional living-semester dressing layers, merged by current era. */
  eras?: HallEraLayerDef[];
  floorY: number;
  doorTop: number;
  doorWidth: number;
  doors: HallDoorDef[];
  playerHome: Point;
  playerHeight: number;
  /** Player height while standing at a door (depth cue). */
  playerDoorHeight: number;
  /** Ground line the player stands on when at a door. */
  doorStandFeetY: number;
  mentorFeetY: number;
  mentorHeight: number;
  /** Mentor's horizontal offset from their door centre. */
  mentorOffsetX: number;
  /** Vertical centre of the veil transition circle. */
  veilY: number;
  /** Transition timing (milliseconds), tunable without code changes. */
  transitions?: {
    turnMs?: number;
    walkBaseMs?: number;
    walkMsPerUnit?: number;
    doorOpenMs?: number;
    veilMs?: number;
  };
}

export interface HotspotRect {
  id: string;
  /** x, y, width, height in scene units. */
  rect: [number, number, number, number];
}

/** One additive room-evolution stage: extra props/lights/ambience layered on when reached. */
export interface RoomEvolutionStageDef {
  stage: number;
  images?: PlacedImage[];
  lights?: LightDef[];
  ambience?: AmbienceDef[];
}

/** The in-room study desk used by Focus Sprints. */
export interface FocusDeskDef {
  /** Where the player stands before sitting. */
  standX: number;
  standFeetY: number;
  /** Seated pose. */
  seatX: number;
  seatFeetY: number;
  seatHeight: number;
  /** Chair drawn by the scene (slides out/in); scene units. */
  chair: { x: number; y: number; width: number; height: number };
  /** Monitor glow overlay shown while Focus Mode is on. */
  monitor: { x: number; y: number; width: number; height: number };
  /** Click hotspot rect [x, y, w, h]. */
  hotspot: [number, number, number, number];
}

export interface RoomSceneDef extends SceneBase {
  kind: "room";
  accent: string;
  accent2: string;
  focusDesk?: FocusDeskDef;
  evolution?: { stages: RoomEvolutionStageDef[] };
  exitDoor: { x: number; top: number; width: number; accent: string; panel: string; panelSrc?: string };
  playerHome: Point;
  playerDoor: Point;
  playerHeight: number;
  playerDoorHeight: number;
  mentor: { x: number; feetY: number; height: number };
  hotspots: HotspotRect[];
  widgets: WidgetDef[];
  veilY: number;
  /** Transition timing (milliseconds), tunable without code changes. */
  transitions?: {
    walkBaseMs?: number;
    walkMsPerUnit?: number;
    veilMs?: number;
  };
}

export type SceneDef = HallSceneDef | RoomSceneDef;

export interface AssetManifest {
  version: number;
  /** Sprite id → sprite asset JSON path, relative to public/assets/. */
  sprites: Record<string, string>;
  scenes: Record<string, SceneDef>;
}

/** Resolves a manifest-relative asset path to a servable URL. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}assets/${path}`;
}
