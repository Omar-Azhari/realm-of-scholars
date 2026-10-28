import type { ReactNode } from "react";

export type BadgeTone =
  | "confirmed"
  | "warning"
  | "neutral"
  | "progress"
  | "critical"
  | "high"
  | "medium"
  | "low";

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

const TONE_ICON: Record<BadgeTone, string> = {
  confirmed: "✓", // check mark
  warning: "⚠", // warning triangle
  neutral: "•", // bullet
  progress: "▶", // in progress
  critical: "▲", // priority levels — never colour alone, always paired with the label text too
  high: "▲",
  medium: "●",
  low: "▽",
};

/** Every status shown by this app pairs an icon + text + colour — never colour alone. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      <span aria-hidden="true">{TONE_ICON[tone]}</span>
      {children}
    </span>
  );
}
