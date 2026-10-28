interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  /** CSS custom property name (e.g. "--ui-accent") to tint the ring; omitted uses the HQ accent. */
  accentVar?: string;
  size?: number;
  strokeWidth?: number;
  /** Optional short caption rendered under the percentage (e.g. "7 / 11 modules"). */
  caption?: string;
}

/**
 * Plain-SVG circular progress indicator — no chart library. Percentage is
 * always rendered as text in the centre (never colour/shape alone), same
 * accessibility rule the linear ProgressBar already follows.
 */
export function ProgressRing({
  value,
  max,
  label,
  accentVar,
  size = 96,
  strokeWidth = 8,
  caption,
}: ProgressRingProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const color = accentVar ? `var(${accentVar})` : "var(--hq-accent)";

  return (
    <div
      className="progress-ring"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{ width: size, height: size, color }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring-svg">
        <circle
          className="progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className="progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="progress-ring-label">
        <strong className="progress-ring-percent">{percent}%</strong>
        {caption ? <span className="progress-ring-caption">{caption}</span> : null}
      </div>
    </div>
  );
}
