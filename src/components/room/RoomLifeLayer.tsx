/**
 * Room life — small deterministic touches that make a subject room feel
 * occupied. Everything here is *purely visual* and derived from real state:
 *
 *  - the desk monitor cycles its idle screen content with the Melbourne hour
 *  - a desk lamp warms up in the evening/night
 *  - a coffee mug appears on the desk during busy weeks (workload ≥ 70)
 *  - the noticeboard (missions hotspot) fills with pinned notes as modules
 *    are completed, plus one extra during the late-semester era
 *  - a book stack appears near the info shelf from the mid era onward
 *
 * No randomness, no gameplay effect, nothing stored — same save + same
 * clock always renders the same room.
 */

import { assetUrl, type RoomSceneDef } from "../../engine/manifestTypes";
import { getMelbourneDateTimeKey } from "../../lib/selectors";
import { eraIndex, type SemesterEra } from "../../lib/semesterCalendar";

interface RoomLifeLayerProps {
  scene: RoomSceneDef;
  era: SemesterEra;
  workload: number;
  completedModules: number;
  /** Focus Mode owns the monitor — idle screen content hides while true. */
  focused: boolean;
  now?: Date;
}

/** Idle monitor screen variants, cycled by hour: code, document, chart. */
const SCREEN_VARIANTS = ["code", "doc", "chart"] as const;

export function RoomLifeLayer({
  scene,
  era,
  workload,
  completedModules,
  focused,
  now = new Date(),
}: RoomLifeLayerProps) {
  const desk = scene.focusDesk;
  const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
  const lampOn = hour >= 17 || hour < 6;
  const screenVariant = SCREEN_VARIANTS[hour % SCREEN_VARIANTS.length];
  const busyMug = workload >= 70;
  const idx = eraIndex(era);

  const missionsSpot = scene.hotspots.find((h) => h.id === "missions");
  const infoSpot = scene.hotspots.find((h) => h.id === "info");
  const progressSpot = scene.hotspots.find((h) => h.id === "progress");
  const totalModules = 12; // per subject (fixed by the seed data)
  const noteCount = Math.min(6, completedModules + (idx >= 2 ? 1 : 0));
  // A pile of finished work accumulates by the desk as modules complete.
  const workPile = Math.min(8, completedModules);
  // The progress whiteboard fills as the subject nears completion.
  const boardFill = Math.min(1, completedModules / totalModules);

  return (
    <svg
      className="scene-overlay-svg"
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-room-life
      data-screen={focused ? "focus" : screenVariant}
      data-lamp={lampOn ? "on" : "off"}
    >
      {/* Idle monitor content — hidden while Focus Mode owns the screen. */}
      {desk && !focused ? (
        <g opacity="0.55">
          {screenVariant === "code"
            ? [0, 1, 2, 3].map((i) => (
                <rect
                  key={i}
                  x={desk.monitor.x + 6 + (i % 2) * 8}
                  y={desk.monitor.y + 7 + i * 9}
                  width={desk.monitor.width * (0.35 + (i % 3) * 0.14)}
                  height="3.5"
                  rx="1.5"
                  fill={scene.accent2}
                  opacity="0.5"
                />
              ))
            : screenVariant === "doc"
              ? [0, 1, 2, 3, 4].map((i) => (
                  <rect
                    key={i}
                    x={desk.monitor.x + 8}
                    y={desk.monitor.y + 6 + i * 7}
                    width={desk.monitor.width - 16 - (i === 4 ? desk.monitor.width * 0.4 : 0)}
                    height="2.6"
                    rx="1.3"
                    fill="#dbe4f5"
                    opacity="0.45"
                  />
                ))
              : [0, 1, 2, 3].map((i) => (
                  <rect
                    key={i}
                    x={desk.monitor.x + 8 + i * ((desk.monitor.width - 20) / 4)}
                    y={desk.monitor.y + desk.monitor.height - 8 - (8 + ((i * 7) % 18))}
                    width={(desk.monitor.width - 24) / 5}
                    height={8 + ((i * 7) % 18)}
                    rx="1.5"
                    fill={scene.accent}
                    opacity="0.5"
                  />
                ))}
        </g>
      ) : null}

      {/* Desk lamp — warms up after 5pm Melbourne time, with a faint flicker. */}
      {desk && lampOn ? (
        <ellipse
          className="room-life-lamp"
          cx={desk.monitor.x + desk.monitor.width / 2}
          cy={desk.monitor.y + desk.monitor.height + 26}
          rx={desk.monitor.width * 0.9}
          ry="16"
          fill="#ffcf7d"
          opacity="0.14"
        />
      ) : null}

      {/* Finished work piles up by the desk as real modules get completed. */}
      {desk && workPile > 0
        ? Array.from({ length: workPile }, (_, i) => (
            <rect
              key={`work-${i}`}
              x={desk.chair.x - 46 - (i % 2) * 3}
              y={desk.chair.y + desk.chair.height - 10 - i * 3}
              width="34"
              height="3"
              rx="1"
              fill={i % 3 === 0 ? scene.accent2 : "#e6ecf7"}
              opacity="0.5"
            />
          ))
        : null}

      {/* The progress whiteboard fills in as the subject nears completion. */}
      {progressSpot && boardFill > 0
        ? (() => {
            const [px, py, pw, ph] = progressSpot.rect;
            const rows = Math.round(boardFill * 5);
            return Array.from({ length: rows }, (_, i) => (
              <rect
                key={`board-${i}`}
                x={px + 14}
                y={py + 16 + i * ((ph - 30) / 5)}
                width={(pw - 28) * (0.55 + ((i * 7) % 4) * 0.11)}
                height="3.5"
                rx="1.5"
                fill={scene.accent}
                opacity="0.4"
              />
            ));
          })()
        : null}

      {/* Busy-week mug beside the monitor. */}
      {desk && busyMug ? (
        <image
          href={assetUrl("scenes/shared/props/mug.svg")}
          x={desk.monitor.x + desk.monitor.width + 14}
          y={desk.monitor.y + desk.monitor.height + 4}
          width="18"
          height="20"
        />
      ) : null}

      {/* Noticeboard fills up as modules are really completed. */}
      {missionsSpot
        ? Array.from({ length: noteCount }, (_, i) => {
            const [mx, my, mw] = missionsSpot.rect;
            const cols = 3;
            const noteW = Math.min(20, (mw - 16) / cols);
            const noteH = noteW * 1.15;
            const col = i % cols;
            const row = Math.floor(i / cols);
            return (
              <rect
                key={i}
                x={mx + 8 + col * (noteW + 5)}
                y={my + 8 + row * (noteH + 6)}
                width={noteW}
                height={noteH}
                rx="1.5"
                fill={["#f7e9b0", "#cfe6ff", "#ffd6e8"][i % 3]}
                stroke="#00000033"
                strokeWidth="0.8"
                transform={`rotate(${((i % 3) - 1) * 3} ${mx + 8 + col * (noteW + 5) + noteW / 2} ${my + 8 + row * (noteH + 6) + noteH / 2})`}
                opacity="0.85"
              />
            );
          })
        : null}

      {/* Book stacks near the info shelf grow with real progress (mid era +
          one per few completed modules) — the room becomes lived-in. */}
      {infoSpot && (idx >= 1 || completedModules > 0)
        ? Array.from({ length: Math.min(3, 1 + Math.floor(completedModules / 4)) }, (_, i) => (
            <image
              key={`books-${i}`}
              href={assetUrl("scenes/shared/props/books.svg")}
              x={infoSpot.rect[0] + infoSpot.rect[2] / 2 - 22 + i * 30}
              y={infoSpot.rect[1] + infoSpot.rect[3] + 8 - (i % 2) * 4}
              width="44"
              height="26"
            />
          ))
        : null}
    </svg>
  );
}
