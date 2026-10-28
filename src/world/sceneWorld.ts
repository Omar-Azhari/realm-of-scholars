/**
 * Derives a walkable SceneWorld (worldTypes.ts) from a manifest scene def.
 * HQ becomes a hall of subject doors; every subject room gets a consistent
 * set of interactables (exit, mentor, assessment board, module shelf,
 * progress display, notice board, study desk) so the player never gets lost.
 */

import type { HallSceneDef, RoomSceneDef } from "../engine/manifestTypes";
import { getRoomPersona, type RoomPanelId } from "../components/room/roomPersona";
import type { SceneWorld, WorldInteractable, InteractableKind, InteractAction } from "./worldTypes";
import type { PanelId } from "./worldTypes";

/** Front floor line the player walks on when standing near an object. */
const FRONT_MARGIN = 8;

export function buildHqWorld(scene: HallSceneDef): SceneWorld {
  const frontFeet = scene.playerHome.feetY; // 726
  const backFeet = scene.doorStandFeetY; // 580
  const interactables: WorldInteractable[] = scene.doors.map((door) => ({
    id: `door-${door.subjectId}`,
    kind: "door" as InteractableKind,
    label: door.label,
    actionLabel: "Enter",
    action: { type: "enter-room", subjectId: door.subjectId } satisfies InteractAction,
    rect: [door.x - scene.doorWidth / 2, scene.doorTop, scene.doorWidth, scene.floorY - scene.doorTop],
    standPoint: { x: door.x, feetY: backFeet + 40 },
    range: 150,
  }));

  return {
    sceneId: "hq",
    width: scene.width,
    height: scene.height,
    walkable: { xMin: 150, xMax: scene.width - 150, feetBack: backFeet + 30, feetFront: frontFeet },
    heightFront: scene.playerHeight,
    heightBack: scene.playerDoorHeight,
    spawn: { x: scene.playerHome.x, feetY: frontFeet },
    obstacles: [],
    interactables,
  };
}

/** Maps a room hotspot id to its interactable presentation + action (15B: 4 panels). */
function hotspotInteract(
  hotspotId: RoomPanelId,
  subjectId: string,
  label: string
): { kind: InteractableKind; actionLabel: string; action: InteractAction } | null {
  const open = (panel: PanelId, section?: string): InteractAction => ({ type: "open-panel", panel, subjectId, section });
  switch (hotspotId) {
    case "assessments":
      return { kind: "board", actionLabel: "Review Assessment", action: open("tasks") };
    case "modules":
      // Bookshelf → this subject's Resources section (inside Subjects).
      return { kind: "shelf", actionLabel: "Browse Books", action: open("subjects", "resources") };
    case "deadlines":
      return { kind: "board", actionLabel: "Check Calendar", action: open("calendar") };
    case "missions":
      return { kind: "notice", actionLabel: "Read Notice Board", action: open("tasks") };
    case "progress":
      return { kind: "progress", actionLabel: "Check Progress", action: open("subjects", "overview") };
    case "achievements":
      // Trophy shelf → Achievements (inside Menu → Profile).
      return { kind: "trophy", actionLabel: "View Trophies", action: open("menu", "achievements") };
    case "info":
      return {
        kind: "info",
        actionLabel: "Inspect Board",
        action: {
          type: "inspect",
          title: label,
          body: "Subject information board. Confirm subject details from the Subjects panel.",
        },
      };
    default:
      return null;
  }
}

export function buildRoomWorld(scene: RoomSceneDef, subjectId: string, subjectName: string): SceneWorld {
  const persona = getRoomPersona(subjectId);
  const frontFeet = scene.playerHome.feetY;
  const backFeet = Math.min(scene.playerDoor.feetY, frontFeet - 60);
  const interactables: WorldInteractable[] = [];

  // Exit door — always present, consistent placement/label.
  interactables.push({
    id: "exit",
    kind: "exit",
    label: "Door to Campus HQ",
    actionLabel: "Exit Room",
    action: { type: "leave-room" },
    rect: [scene.exitDoor.x - scene.exitDoor.width / 2, scene.exitDoor.top, scene.exitDoor.width, 240],
    standPoint: { x: scene.playerDoor.x + 60, feetY: scene.playerDoor.feetY },
    range: 150,
  });

  // Mentor — talk.
  interactables.push({
    id: "mentor",
    kind: "mentor",
    label: `${subjectName} mentor`,
    actionLabel: "Talk",
    action: { type: "talk" },
    rect: [scene.mentor.x - 55, scene.mentor.feetY - scene.mentor.height, 110, scene.mentor.height],
    standPoint: { x: scene.mentor.x + 90, feetY: frontFeet },
    range: 170,
  });

  // Study desk — focus session.
  if (scene.focusDesk) {
    const [hx, hy, hw, hh] = scene.focusDesk.hotspot;
    interactables.push({
      id: "desk",
      kind: "desk",
      label: "Study desk",
      actionLabel: "Start Study Session",
      action: { type: "focus" },
      rect: [hx, hy, hw, hh],
      standPoint: { x: scene.focusDesk.standX, feetY: frontFeet },
      range: 170,
    });
  }

  // Wall hotspots → consistent interactables.
  for (const spot of scene.hotspots) {
    const mapped = hotspotInteract(spot.id as RoomPanelId, subjectId, persona.hotspotLabels[spot.id as RoomPanelId]);
    if (!mapped) continue;
    const [x, y, w, h] = spot.rect;
    interactables.push({
      id: spot.id,
      kind: mapped.kind,
      label: persona.hotspotLabels[spot.id as RoomPanelId],
      actionLabel: mapped.actionLabel,
      action: mapped.action,
      rect: [x, y, w, h],
      standPoint: { x: Math.max(200, Math.min(scene.width - 200, x + w / 2)), feetY: frontFeet },
      range: 150,
    });
  }

  // The desk footprint blocks walking INTO it from the front (furniture
  // collision) while leaving the front floor — where every stand point sits —
  // walkable, so objects stay reachable.
  const obstacles = scene.focusDesk
    ? [
        {
          xMin: scene.focusDesk.hotspot[0],
          xMax: scene.focusDesk.hotspot[0] + scene.focusDesk.hotspot[2],
          feetMin: frontFeet - 70,
          feetMax: frontFeet - 14,
        },
      ]
    : [];

  return {
    sceneId: `room-${subjectId}`,
    width: scene.width,
    height: scene.height,
    walkable: {
      xMin: 130,
      xMax: scene.width - 130,
      feetBack: backFeet,
      feetFront: frontFeet + FRONT_MARGIN,
    },
    heightFront: scene.playerHeight,
    heightBack: scene.playerDoorHeight,
    spawn: { x: scene.playerHome.x, feetY: frontFeet },
    obstacles,
    interactables,
  };
}
