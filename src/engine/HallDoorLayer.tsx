import { motion } from "framer-motion";
import { assetUrl } from "./manifestTypes";
import type { HallSceneDef } from "./manifestTypes";

/** Live per-door state injected by the app — the engine renders, it never decides. */
export interface DoorVisualState {
  statusLabel: string;
  statusColor: string;
  urgent: boolean;
  hovered: boolean;
  open: boolean;
}

const IDLE_DOOR_STATE: DoorVisualState = {
  statusLabel: "",
  statusColor: "#9aa6c0",
  urgent: false,
  hovered: false,
  open: false,
};

/**
 * The hall's subject doors: sliding panels, transom strip, emblem, signage,
 * status lamp, and floor glow. All geometry and colours come from the scene
 * manifest; a door with `panelSrc` set renders artist-supplied panel images
 * instead of the placeholder gradient fill. Door frames/recesses are part of
 * the background artwork and must align with the manifest door anchors (see
 * public/assets/README.md).
 */
export function HallDoorLayer({
  scene,
  states,
}: {
  scene: HallSceneDef;
  states: Record<string, DoorVisualState>;
}) {
  const { width, height, doorTop, doorWidth, floorY } = scene;

  return (
    <svg
      className="scene-overlay-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {scene.doors.map((door, index) => {
        const state = states[door.subjectId] ?? IDLE_DOOR_STATE;
        const left = door.x - doorWidth / 2;
        const doorHeight = floorY - doorTop;

        return (
          <g key={door.subjectId}>
            <linearGradient id={`door-glow-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={door.accent} stopOpacity="0.75" />
              <stop offset="45%" stopColor={door.accent} stopOpacity="0.3" />
              <stop offset="100%" stopColor={door.accent} stopOpacity="0.55" />
            </linearGradient>

            {/* transom light strip */}
            <rect x={left - 4} y={doorTop - 20} width={doorWidth + 8} height="7" rx="3" fill={door.accent} opacity="0.95" />

            {/* light spilling when open — bright interior + a beam across the floor */}
            <linearGradient id={`door-spill-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={door.accent2} stopOpacity="0.55" />
              <stop offset="100%" stopColor={door.accent2} stopOpacity="0" />
            </linearGradient>
            <motion.rect
              x={left}
              y={doorTop}
              width={doorWidth}
              height={doorHeight}
              fill={door.accent2}
              initial={false}
              animate={{ opacity: state.open ? 0.95 : 0 }}
              transition={{ duration: 0.35 }}
            />
            <motion.polygon
              points={`${left + 8},${floorY} ${left + doorWidth - 8},${floorY} ${left + doorWidth + 46},${floorY + 150} ${left - 46},${floorY + 150}`}
              fill={`url(#door-spill-${index})`}
              initial={false}
              animate={{ opacity: state.open ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              pointerEvents="none"
            />

            {/* sliding panels — placeholder gradient fill, or artist panel image when provided */}
            {[0, 1].map((panelIndex) => {
              const closedX = left + (panelIndex * doorWidth) / 2;
              const openX = panelIndex === 0 ? left - doorWidth / 2 + 6 : left + doorWidth - 6;
              return (
                <motion.g
                  key={panelIndex}
                  initial={false}
                  animate={{ x: state.open ? openX - closedX : 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  {door.panelSrc ? (
                    <image
                      href={assetUrl(door.panelSrc)}
                      x={closedX}
                      y={doorTop}
                      width={doorWidth / 2}
                      height={doorHeight}
                      preserveAspectRatio="none"
                      transform={panelIndex === 1 ? `scale(-1,1) translate(${-(2 * closedX + doorWidth / 2)},0)` : undefined}
                    />
                  ) : (
                    <>
                      <rect x={closedX} y={doorTop} width={doorWidth / 2} height={doorHeight} fill={door.panel} />
                      <rect x={closedX} y={doorTop} width={doorWidth / 2} height={doorHeight} fill={`url(#door-glow-${index})`} />
                      <rect
                        x={closedX + 8}
                        y={doorTop + 10}
                        width={doorWidth / 2 - 16}
                        height={doorHeight - 22}
                        fill="none"
                        stroke="rgba(8,12,24,0.55)"
                        strokeWidth="3"
                      />
                    </>
                  )}
                </motion.g>
              );
            })}

            {/* emblem + split line (placeholder detail, hidden under panelSrc art) */}
            {!door.panelSrc ? (
              <>
                <circle cx={door.x} cy={doorTop + 88} r="26" fill="rgba(8,12,24,0.4)" stroke="#eaf2ff" strokeOpacity="0.9" strokeWidth="3" />
                <circle cx={door.x} cy={doorTop + 88} r="10" fill="#eaf2ff" opacity="0.95" />
                {!state.open ? <line x1={door.x} y1={doorTop} x2={door.x} y2={floorY} stroke="#0a101f" strokeWidth="3" /> : null}
              </>
            ) : null}

            {/* floor glow */}
            <ellipse
              cx={door.x}
              cy={floorY + 16}
              rx={doorWidth * 0.85}
              ry="17"
              fill={door.accent}
              opacity={state.open ? 0.45 : state.hovered ? 0.4 : 0.28}
            />

            {/* signage */}
            <g opacity={state.hovered || state.open ? 1 : 0.92}>
              <rect
                x={door.x - 104}
                y="186"
                width="208"
                height="42"
                rx="8"
                fill="rgba(7,10,20,0.94)"
                stroke={door.accent}
                strokeWidth={state.hovered || state.open ? 3 : 2}
              />
              <rect x={door.x - 96} y="194" width="26" height="26" rx="5" fill={door.accent} />
              <text
                x={door.x - 83}
                y="213"
                textAnchor="middle"
                fill="#0a0d18"
                fontSize="14"
                fontWeight="800"
                fontFamily="'Segoe UI', system-ui, sans-serif"
              >
                {String(index + 1).padStart(2, "0")}
              </text>
              <text
                x={door.x - 60}
                y="207"
                fill="#eef2fb"
                fontSize="15"
                fontWeight="700"
                fontFamily="'Segoe UI', system-ui, sans-serif"
              >
                {door.label}
              </text>
              <text
                x={door.x - 60}
                y="222"
                fill={state.statusColor}
                fontSize="11"
                fontWeight="700"
                letterSpacing="1"
                fontFamily="'Segoe UI', system-ui, sans-serif"
              >
                {state.statusLabel.toUpperCase()}
              </text>
            </g>

            {/* status lamp */}
            <circle cx={door.x + 88} cy={207} r="6" fill={state.urgent ? "#ffb238" : door.accent}>
              {state.urgent ? (
                <animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite" />
              ) : null}
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
