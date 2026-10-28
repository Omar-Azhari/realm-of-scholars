import type { CSSProperties } from "react";

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  /** CSS custom property name (e.g. "--ui-accent") to tint the fill; omitted uses the HQ accent. */
  accentVar?: string;
}

/** The percentage is always rendered as text alongside the bar — never colour-only. */
export function ProgressBar({ value, max, label, accentVar }: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const fillColor = accentVar ? `var(${accentVar})` : "var(--hq-accent)";
  const fillStyle = {
    width: `${percent}%`,
    color: fillColor,
    backgroundColor: fillColor,
  } as CSSProperties;

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={fillStyle} />
      </div>
      <span className="progress-bar-caption">
        {label}: {percent}% ({value}/{max})
      </span>
    </div>
  );
}
