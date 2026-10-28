import { Badge } from "./Badge";
import type { PriorityLevel } from "../../lib/priority";

const LABEL: Record<PriorityLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Thin convenience wrapper so every screen renders a PriorityLevel identically. */
export function PriorityBadge({ level }: { level: PriorityLevel }) {
  return <Badge tone={level}>{LABEL[level]}</Badge>;
}
