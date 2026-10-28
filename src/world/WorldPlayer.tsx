/**
 * Renders the free-moving player plus the click-to-move destination marker,
 * driven by useWorldMovement state. Position/size are in scene units and
 * converted to stage percentages, matching the Actor convention.
 */

import { Actor } from "../engine/Actor";
import type { FloorPoint } from "./worldTypes";

export function WorldPlayer({
  pos,
  height,
  facingLeft,
  moving,
  marker,
  sceneWidth,
  sceneHeight,
  reduceMotion,
}: {
  pos: FloorPoint;
  height: number;
  facingLeft: boolean;
  moving: boolean;
  marker: FloorPoint | null;
  sceneWidth: number;
  sceneHeight: number;
  reduceMotion: boolean;
}) {
  return (
    <>
      {marker && !reduceMotion ? (
        <div
          className="world-move-marker"
          style={{
            left: `${(marker.x / sceneWidth) * 100}%`,
            top: `${(marker.feetY / sceneHeight) * 100}%`,
          }}
          aria-hidden="true"
        >
          <span className="world-move-marker-ring" />
        </div>
      ) : null}

      <Actor
        spriteId="player"
        pose={{ x: pos.x, feetY: pos.feetY, height }}
        transition={{ duration: 0 }}
        sceneWidth={sceneWidth}
        sceneHeight={sceneHeight}
        animation={moving && !reduceMotion ? "walk" : "idle"}
        flip={facingLeft}
        walking={moving && !reduceMotion}
        label="You — your campus avatar"
        plate={{ text: "You", accent: true }}
      />
    </>
  );
}
