/**
 * Schematic campus map (Phase 15A) — a clean node graph of Campus HQ plus the
 * four subject rooms, not a reproduction of scene geometry. Used two ways:
 * the compact HUD minimap (read-only, shows where you are + tracked
 * objective) and the full map inside the Subjects panel (clickable rooms).
 */

import { useSaveData } from "../../state/SaveDataContext";
import { getSubjectAccentVar } from "../../lib/subjectTheme";
import { useWorldUi } from "../../world/WorldUiContext";

/** Node layout in a 100×100 viewBox: HQ centre, four rooms around it. */
const NODES = [
  { key: "hq", label: "HQ", x: 50, y: 52, subjectId: null as string | null },
  { key: "room-0", label: "1", x: 18, y: 24, slot: 0 },
  { key: "room-1", label: "2", x: 82, y: 24, slot: 1 },
  { key: "room-2", label: "3", x: 18, y: 80, slot: 2 },
  { key: "room-3", label: "4", x: 82, y: 80, slot: 3 },
];

export function CampusMap({
  variant = "full",
  currentSceneId,
  onSelect,
}: {
  variant?: "full" | "mini";
  currentSceneId?: string;
  onSelect?: (subjectId: string) => void;
}) {
  const { saveData } = useSaveData();
  const { objective } = useWorldUi();
  const subjects = saveData.semester.subjects;

  const nodes = NODES.map((n) => {
    if (n.key === "hq") return { ...n, sceneId: "hq", accentVar: "--hq-accent", name: "Campus HQ" };
    const subject = subjects[(n as { slot: number }).slot];
    return {
      ...n,
      sceneId: subject ? `room-${subject.id}` : n.key,
      subjectId: subject?.id ?? null,
      accentVar: subject ? getSubjectAccentVar(subject.id) : "--hq-accent",
      name: subject?.name ?? n.label,
    };
  });

  return (
    <div className={`campus-map campus-map--${variant}`} aria-label="Campus map">
      <svg viewBox="0 0 100 100" role="img" aria-label="Campus map: HQ and four subject rooms">
        {/* corridors */}
        {nodes.slice(1).map((n) => (
          <line key={`edge-${n.key}`} x1="50" y1="52" x2={n.x} y2={n.y} className="campus-map-edge" />
        ))}
        {nodes.map((n) => {
          const isHere = currentSceneId === n.sceneId;
          const isObjective = objective?.sceneId === n.sceneId;
          const el = (
            <g key={n.key} className={`campus-node${isHere ? " campus-node--here" : ""}${isObjective ? " campus-node--objective" : ""}`}>
              <circle cx={n.x} cy={n.y} r={n.key === "hq" ? 9 : 7.5} fill={`var(${n.accentVar})`} />
              {isHere ? <circle cx={n.x} cy={n.y} r={n.key === "hq" ? 13 : 11} className="campus-node-here-ring" /> : null}
              <text x={n.x} y={n.y + 3} textAnchor="middle" className="campus-node-label">
                {n.label}
              </text>
            </g>
          );
          if (variant === "full" && n.subjectId && onSelect) {
            return (
              <a
                key={n.key}
                role="button"
                tabIndex={0}
                aria-label={`Enter ${n.name}`}
                onClick={() => onSelect(n.subjectId as string)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(n.subjectId as string);
                }}
                style={{ cursor: "pointer" }}
              >
                {el}
              </a>
            );
          }
          return el;
        })}
      </svg>
    </div>
  );
}
