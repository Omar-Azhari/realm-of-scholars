/**
 * Canvas import progress (Phase 18E, Part 14). Real, discrete states — the
 * actual backend call is one atomic request covering courses/assignments/
 * modules/calendar/announcements together, so this honestly shows what the
 * client can actually observe (validating → in flight → done) rather than
 * inventing a percentage or fake sub-steps it has no visibility into — the
 * exact same discipline as DiscoveryStep.tsx (Phase 18D).
 */

import { Loader2 } from "lucide-react";

export function CanvasImportingStep({ courseCount, onCancel }: { courseCount: number; onCancel: () => void }) {
  return (
    <div className="setup-step" data-testid="canvas-importing-step">
      <p className="setup-lede">
        Retrieving {courseCount} course{courseCount === 1 ? "" : "s"} from Canvas…
      </p>
      <p className="setup-file-message">
        <Loader2 size={14} className="setup-spin" aria-hidden="true" /> Fetching assignments, modules, and calendar
        events — this can take a moment for courses with a lot of content.
      </p>
      <div className="setup-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
