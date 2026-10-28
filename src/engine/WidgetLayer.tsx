import { assetUrl } from "./manifestTypes";
import type { SceneDataBindings, StatBindKey, WidgetDef } from "./manifestTypes";

/**
 * Data-bound scene widgets — the in-world displays (module grids, progress
 * readouts, trophy shelves, pinned notes, holo projections) whose geometry,
 * colours, and skin images come from the asset manifest, and whose live
 * values come from the application. Rendered as one SVG overlay so text and
 * shapes scale with the artwork; skinnable pieces (trophies, notes) are
 * `<image>` elements pointing at files under public/assets/.
 */
export function WidgetLayer({
  widgets,
  data,
  width,
  height,
}: {
  widgets: WidgetDef[];
  data: SceneDataBindings;
  width: number;
  height: number;
}) {
  if (widgets.length === 0) return null;
  return (
    <svg
      className="scene-overlay-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {widgets.map((widget) => (
        <Widget key={widget.id} widget={widget} data={data} />
      ))}
    </svg>
  );
}

function resolveBind(bind: StatBindKey, data: SceneDataBindings): string {
  switch (bind) {
    case "progressPercent":
      return String(data.progressPercent);
    case "moduleRatio":
      return `${data.completedModules}/${data.totalModules}`;
    case "upcomingCount":
      return String(data.upcomingCount);
    case "pendingMissionCount":
      return String(data.pendingMissionCount);
  }
}

function Widget({ widget, data }: { widget: WidgetDef; data: SceneDataBindings }) {
  switch (widget.type) {
    case "module-grid":
      return (
        <g>
          {data.moduleCompletion.map((done, i) => (
            <rect
              key={i}
              x={widget.x + (i % widget.cols) * widget.stepX}
              y={widget.y + Math.floor(i / widget.cols) * widget.stepY}
              width={widget.cellWidth}
              height={widget.cellHeight}
              rx="3"
              fill={done ? widget.onColor : widget.offColor}
              stroke={done ? widget.onStroke : widget.offStroke}
              strokeWidth="1.5"
            />
          ))}
        </g>
      );

    case "stat-text": {
      const value = widget.bind ? resolveBind(widget.bind, data) : "";
      const template = widget.template ?? "{value}";
      const text = widget.bind ? template.replace("{value}", value) : (widget.text ?? "");
      return (
        <text
          x={widget.x}
          y={widget.y}
          textAnchor={widget.align}
          fill={widget.color}
          fontSize={widget.fontSize}
          fontWeight={widget.bold ? "bold" : undefined}
          letterSpacing={widget.letterSpacing}
          fontFamily="monospace"
        >
          {text}
        </text>
      );
    }

    case "progress-bar": {
      const percent = Math.min(100, Math.max(0, data.progressPercent));
      return (
        <g>
          <rect x={widget.x} y={widget.y} width={widget.width} height={widget.height} rx={widget.height / 2} fill={widget.bg} />
          <rect
            x={widget.x}
            y={widget.y}
            width={Math.max(widget.height, (widget.width * percent) / 100)}
            height={widget.height}
            rx={widget.height / 2}
            fill={widget.fg}
          />
        </g>
      );
    }

    case "trophy-row":
      return (
        <g>
          {widget.positions.slice(0, data.achievementsTotal).map(([x, y], i) => {
            const unlocked = i < data.achievementsUnlocked;
            return (
              <image
                key={i}
                href={assetUrl(unlocked ? widget.litSrc : widget.lockedSrc)}
                x={x}
                y={y}
                width={widget.width}
                height={widget.height}
                opacity={unlocked ? 1 : widget.lockedOpacity}
              />
            );
          })}
        </g>
      );

    case "note-board": {
      const visible = Math.min(widget.maxNotes, Math.max(1, data.pendingMissionCount));
      return (
        <g>
          {widget.positions.slice(0, visible).map(([x, y], i) => (
            <image
              key={i}
              href={assetUrl(widget.srcs[i % widget.srcs.length])}
              x={x}
              y={y}
              width={widget.width}
              height={widget.height}
              transform={`rotate(${i % 2 === 0 ? -3 : 3} ${x + widget.width / 2} ${y + widget.height / 2})`}
            />
          ))}
        </g>
      );
    }

    case "holo-cone": {
      const label = (widget.template ?? "{value}").replace("{value}", resolveBind(widget.bind, data));
      const gradientId = `holo-${widget.baseX}-${widget.topY}`;
      return (
        <g>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={widget.color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={widget.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`${widget.baseX - widget.halfBase},${widget.baseY} ${widget.baseX + widget.halfBase},${widget.baseY} ${widget.baseX + widget.halfTop},${widget.topY} ${widget.baseX - widget.halfTop},${widget.topY}`}
            fill={`url(#${gradientId})`}
          />
          <ellipse cx={widget.baseX} cy={widget.topY} rx={widget.halfTop} ry={widget.halfTop * 0.28} fill={widget.color} opacity="0.5" />
          <text
            x={widget.baseX}
            y={widget.topY - 15}
            textAnchor="middle"
            fill={widget.labelColor}
            fontSize={widget.fontSize}
            fontFamily="monospace"
          >
            {label}
          </text>
        </g>
      );
    }

    default:
      return null;
  }
}
