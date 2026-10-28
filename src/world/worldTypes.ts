/**
 * World-first navigation model (Phase 15A).
 *
 * A "SceneWorld" is the walkable interpretation of a manifest scene: where
 * the player may stand, where they spawn, and the interactable objects they
 * can approach and act on. It is derived from the existing manifest geometry
 * (public/assets/manifest.json) — no new art, no duplicate coordinates.
 */

/** A point on the floor in scene units (1600×760 space). */
export interface FloorPoint {
  x: number;
  /** Ground line the feet rest on; smaller = further back (depth). */
  feetY: number;
}

/** The action fired when the player interacts with an object (interpreted by WorldScene). */
export type InteractAction =
  | { type: "enter-room"; subjectId: string }
  | { type: "leave-room" }
  | { type: "talk" }
  | { type: "focus" }
  | { type: "open-panel"; panel: PanelId; subjectId?: string; section?: string }
  | { type: "inspect"; title: string; body: string }
  /** Phase 20 (additive) — opens the existing Study Planner screen (Phase 19, unmodified). No manifest-driven legacy scene currently produces this action, so the legacy WorldScene.tsx switch needs no new case; reserved for the 3D prototype's own desk interaction. */
  | { type: "open-study-planner" }
  /** Phase 20B (additive) — opens the Character Creator (src/game3d/creator/CharacterCreator.tsx). Same "no legacy case needed" reasoning as open-study-planner above: no 2D manifest scene produces this action. */
  | { type: "open-character-creator" }
  /** Phase 20D (additive) — opens Room Edit Mode (src/game3d/editor/RoomEditor.tsx) from the Room Planner board. Same "no legacy case needed" reasoning as the two entries above. */
  | { type: "open-room-editor" }
  /** Phase 20E (additive) — travels to another campus building (src/game3d/campus/campusMap.ts). `subjectId` is only meaningful when `sceneId === "subject-building"` (which of the 4 subject-building placeholders to enter). Same "no legacy case needed" reasoning as the three entries above — no manifest-driven 2D scene ever produces this action. */
  | { type: "travel"; sceneId: CampusSceneId; subjectId?: string }
  /** Phase 20E Part 9 (additive) — a short, deterministic contextual line from a campus NPC (src/game3d/campus/npcGreetings.ts), shown as a dismissible toast. Not a dialogue tree — one line per interaction. `subjectId` (Phase 21, additive) identifies WHICH subject a "subject-mentor" belongs to, so Game3D.tsx can call the same rich, per-subject `getMentorLine` (mentorDialogue.ts) the 2D world already uses instead of the generic guide-only advice — previously missing, so every 3D subject mentor sounded identical regardless of subject. */
  | { type: "npc-chat"; role: "guide" | "subject-mentor" | "librarian" | "lab-technician" | "lecturer" | "lounge-staff" | "admin-staff"; npcLabel: string; subjectId?: string }
  /** Phase 20E Part 6 (additive) — opens the Campus Directory (a way-finding list of every building, Part 6's "campus map"), from Campus HQ's signpost. Deliberately separate from the existing exit door's `leave-room` action, unchanged since Phase 20. */
  | { type: "open-campus-directory" }
  /** V2 Phase 1 (additive) — a locked district's gate: shown "Coming Soon" rather than a real travel target. `districtName` is the real, in-world name shown on the notice (e.g. "North Tower"). Fired only by the new prestige-v2 renderer's own gates; the existing experimental-3d/legacy-2d switch statements never produce or match this case. */
  | { type: "locked-notice"; districtName: string };

/**
 * Every location the 3D campus renderer can travel to (Phase 20E, Part 1).
 * Lives here (not in game3d/campus/campusMap.ts) so `InteractAction` above
 * can reference it without a cross-directory type import — the same
 * "world contract" file `PanelId` already lives in.
 */
export type CampusSceneId =
  | "campus-hq"
  | "library"
  | "computer-lab"
  | "lecture-theatre"
  | "student-lounge"
  | "administration"
  | "subject-building"
  /**
   * V2 Phase 1 "Prestige Vertical Slice" (additive) — the four real,
   * walkable districts the new prestige-v2 renderer builds
   * (docs/UNIGAME_V2_MASTER_DESIGN.md §3/§4), plus one preview-only
   * dormitory room. The existing experimental-3d renderer's own scene
   * switch (`Game3D.tsx`) never matches any of these ids — they're only
   * ever produced/consumed by the new, wholly separate `PrestigeWorld.tsx`.
   */
  | "prestige-main-gate"
  | "prestige-grand-courtyard"
  | "prestige-great-hall"
  | "prestige-hall-of-artisans"
  | "prestige-dorm-preview";

export type InteractableKind =
  | "door"
  | "exit"
  | "mentor"
  | "board"
  | "shelf"
  | "desk"
  | "notice"
  | "info"
  | "progress"
  | "trophy"
  /** Phase 20B (additive) — the wardrobe/mirror/clothes-rack interaction point. Requires a one-line icon addition in the legacy `Interactable.tsx`'s `KIND_ICON` map (a `Record` keyed by this whole union) to keep compiling, but no manifest-driven 2D scene ever produces this kind, so it's dead code there, not a behaviour change. */
  | "wardrobe";

export interface WorldInteractable {
  id: string;
  kind: InteractableKind;
  /** Readable object name shown on hover/focus. */
  label: string;
  /** Verb shown in the action pill, e.g. "Enter", "Talk", "Study". */
  actionLabel: string;
  action: InteractAction;
  /** Highlight box in scene units [x, y, w, h] — where the object visually lives. */
  rect: [number, number, number, number];
  /** Where the player stands to be "in range". */
  standPoint: FloorPoint;
  /** Interaction radius around the stand point, scene units. */
  range: number;
}

/** A rectangle of floor the player cannot walk into (furniture). */
export interface FloorObstacle {
  xMin: number;
  xMax: number;
  feetMin: number;
  feetMax: number;
}

export interface SceneWorld {
  sceneId: string;
  width: number;
  height: number;
  /** Walkable band: x range and near/far ground lines. */
  walkable: { xMin: number; xMax: number; feetBack: number; feetFront: number };
  /** Player height at the front (near) and back (far) of the band — depth cue. */
  heightFront: number;
  heightBack: number;
  spawn: FloorPoint;
  obstacles: FloorObstacle[];
  interactables: WorldInteractable[];
}

/**
 * The four primary panels, in the fixed order required by Phase 15B —
 * `PANEL_ORDER` (and so the tab rail) stays exactly these four.
 * `"daily-brief"` (Phase 20D, Part 4 "Coffee Area -> Daily Brief") is a
 * fifth, non-tab-rail panel reachable only via `openPanelFor("daily-brief")`
 * from the Coffee Area interactable, the same way the bookshelf reaches
 * "subjects" with `section: "resources"` without adding a tab.
 */
export type PanelId = "tasks" | "subjects" | "calendar" | "menu" | "daily-brief";
export const PANEL_ORDER: PanelId[] = ["tasks", "subjects", "calendar", "menu"];

/** A tracked objective shown in the HUD and highlighted in the world. */
export interface WorldObjective {
  id: string;
  title: string;
  subjectId: string | null;
  /** Room scene the objective lives in, e.g. "room-project-management" or "hq". */
  sceneId: string;
  /** Interactable id to highlight once the player is in that scene. */
  interactableId?: string;
  urgency?: "overdue" | "soon" | "normal";
}
