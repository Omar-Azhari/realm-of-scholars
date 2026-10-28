/**
 * Draws the walk-in rooms (world/rooms.ts) where they stand on the island:
 * each room's shell (floor, walls, roof, its own decor) placed and turned into
 * its building. Furniture, the lectern and the door are ordinary island
 * objects, drawn by the scene like everything else.
 *
 * Also tracks which room the player is in (`runtime.room`), which lifts that
 * room's roof, drops the walls between the camera and you, and turns its
 * lights up.
 */

import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { roomAngle, roomAt, roomToWorld, type PlacedRoom } from "../world/rooms";
import { runtime } from "./runtime";
import { TheatreShell } from "./TheatreInterior";
import { RoomShell } from "./DormInterior";
import { ROOM_COLS, ROOM_ROWS } from "../dorm/dorm";
import { ROOM_X, ROOM_Z } from "../dorm/interior";
import { THEATRE_COLS, THEATRE_ROWS, THEATRE_X, THEATRE_Z } from "../lecture/theatre";

function Room({ room, onFloorClick, onFloorHover }: { room: PlacedRoom; onFloorClick: (x: number, z: number) => void; onFloorHover: () => void }) {
  const insideRef = useRef(false) as MutableRefObject<boolean>;
  useFrame(() => {
    const r = roomAt([room], runtime.player.x, runtime.player.z);
    insideRef.current = r !== null;
  });
  // The shells draw in their room grid's own coordinates: centre that grid on the room.
  const centre = useMemo(() => roomToWorld(room, room.iw / 2, room.id / 2), [room]);
  const inner =
    room.kind === "theatre"
      ? { x: THEATRE_X + THEATRE_COLS / 2, z: THEATRE_Z + THEATRE_ROWS / 2 }
      : { x: ROOM_X + ROOM_COLS / 2, z: ROOM_Z + ROOM_ROWS / 2 };
  return (
    <group position={[centre.x, room.y, centre.z]} rotation={[0, roomAngle(room), 0]}>
      <group position={[-inner.x, 0.02, -inner.z]}>
        {room.kind === "theatre" ? (
          <TheatreShell embedded insideRef={insideRef} onFloorClick={onFloorClick} onFloorHover={onFloorHover} />
        ) : (
          <RoomShell embedded insideRef={insideRef} onFloorClick={onFloorClick} onFloorHover={onFloorHover} />
        )}
      </group>
    </group>
  );
}

/** Where each room's light hangs (room-grid coordinates) and how bright it is. */
const ROOM_LIGHT = {
  theatre: { x: THEATRE_X + THEATRE_COLS / 2, z: THEATRE_Z + THEATRE_ROWS / 2 - 1, y: 4.4, intensity: 26, distance: 20, colour: "#ffe2b0" },
  dorm: { x: ROOM_X + ROOM_COLS / 2, z: ROOM_Z + ROOM_ROWS / 2, y: 2.8, intensity: 18, distance: 14, colour: "#ffd9a0" },
} as const;

export function WalkInRooms({ rooms, onFloorClick, onFloorHover }: { rooms: readonly PlacedRoom[]; onFloorClick: (x: number, z: number) => void; onFloorHover: () => void }) {
  // One indoor light, shared: it hangs in whichever room you're in and fades out when you leave.
  // (A light per room would cost every surface on campus a little, all the time.)
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, delta) => {
    const here = roomAt(rooms, runtime.player.x, runtime.player.z);
    runtime.room = here?.kind ?? null;
    const l = light.current;
    if (!l) return;
    const target = here ? ROOM_LIGHT[here.kind] : null;
    if (here && target) {
      const p = roomToWorld(here, target.x, target.z);
      l.position.set(p.x, here.y + target.y, p.z);
      l.distance = target.distance;
      l.color.set(target.colour);
    }
    l.intensity += ((target?.intensity ?? 0) - l.intensity) * Math.min(1, delta * 5);
  });
  return (
    <>
      <pointLight ref={light} intensity={0} decay={1.6} />
      {rooms.map((room) => (
        <Room key={room.kind} room={room} onFloorClick={onFloorClick} onFloorHover={onFloorHover} />
      ))}
    </>
  );
}
