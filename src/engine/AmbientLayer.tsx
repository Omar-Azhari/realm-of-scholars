import { useMotionPreference } from "../hooks/useMotionPreference";
import type { AmbienceDef } from "./manifestTypes";

/**
 * Ambient movement layer — small looping effects (LED pulses, breathing
 * glows, travelling scan dots, screen flicker, swaying fixtures) composed
 * per scene in the asset manifest. Rendered as one SVG overlay; the whole
 * layer is skipped under reduced motion.
 */
export function AmbientLayer({
  ambience,
  width,
  height,
}: {
  ambience: AmbienceDef[];
  width: number;
  height: number;
}) {
  const reduceMotion = useMotionPreference();
  if (reduceMotion || ambience.length === 0) return null;

  return (
    <svg
      className="scene-overlay-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {ambience.map((def) => (
        <AmbientEffect key={def.id} def={def} />
      ))}
    </svg>
  );
}

function AmbientEffect({ def }: { def: AmbienceDef }) {
  switch (def.type) {
    case "pulse-dot":
      return (
        <circle cx={def.x} cy={def.y} r={def.r} fill={def.color}>
          <animate
            attributeName="opacity"
            values="1;0.15;1"
            dur={`${def.periodSeconds}s`}
            begin={`${def.delaySeconds ?? 0}s`}
            repeatCount="indefinite"
          />
        </circle>
      );

    case "glow-breathe":
      return (
        <ellipse cx={def.x} cy={def.y} rx={def.rx} ry={def.ry} fill={def.color} opacity={def.minOpacity}>
          <animate
            attributeName="opacity"
            values={`${def.minOpacity};${def.maxOpacity};${def.minOpacity}`}
            dur={`${def.periodSeconds}s`}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            keyTimes="0;0.5;1"
          />
        </ellipse>
      );

    case "scan-line":
      return (
        <circle r={def.r} fill={def.color} opacity="0.85">
          <animateMotion
            path={`M ${def.x1} ${def.y1} L ${def.x2} ${def.y2}`}
            dur={`${def.periodSeconds}s`}
            begin={`${def.delaySeconds ?? 0}s`}
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.15;0.85;1" dur={`${def.periodSeconds}s`} begin={`${def.delaySeconds ?? 0}s`} repeatCount="indefinite" />
        </circle>
      );

    case "flicker-rect":
      return (
        <rect x={def.x} y={def.y} width={def.width} height={def.height} fill={def.color} opacity="0">
          <animate
            attributeName="opacity"
            values={`0;${def.maxOpacity};0.02;${def.maxOpacity * 0.6};0`}
            keyTimes="0;0.1;0.5;0.62;1"
            dur={`${def.periodSeconds}s`}
            repeatCount="indefinite"
          />
        </rect>
      );

    case "sway": {
      // A hanging fixture: cord + lamp, swinging around its anchor point.
      return (
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`${-def.angleDegrees} ${def.x} ${def.y};${def.angleDegrees} ${def.x} ${def.y};${-def.angleDegrees} ${def.x} ${def.y}`}
            dur={`${def.periodSeconds}s`}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            keyTimes="0;0.5;1"
          />
          <line x1={def.x} y1={def.y} x2={def.x} y2={def.y + def.length} stroke={def.color} strokeWidth="2.5" opacity="0.7" />
          <circle cx={def.x} cy={def.y + def.length} r="6" fill={def.color} />
        </g>
      );
    }

    default:
      return null;
  }
}
