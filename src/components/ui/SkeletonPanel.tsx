interface SkeletonPanelProps {
  lines?: number;
  minHeight?: number;
}

/** Cosmetic loading placeholder — see useBootSequence for where/why this is used. */
export function SkeletonPanel({ lines = 3, minHeight = 96 }: SkeletonPanelProps) {
  return (
    <div className="panel skeleton-panel" style={{ minHeight }} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="skeleton-line" />
      ))}
    </div>
  );
}
