/**
 * Canvas extraction report (Phase 18E, Part 14). Per-course summary before
 * the existing Review screen — never describes a partial result as a plain
 * success (same discipline as Extraction Report V2, Phase 18D).
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CanvasCourseImportResult } from "../../../../server/lms/canvas/canvasImportOrchestrator";

export function CanvasExtractionReportStep({
  courseResults,
  onContinueToReview,
  onCancel,
}: {
  courseResults: CanvasCourseImportResult[];
  onContinueToReview: () => void;
  onCancel: () => void;
}) {
  const anyPartial = courseResults.some((r) => r.status === "partial" || r.status === "error");

  return (
    <div className="setup-step" data-testid="canvas-extraction-report-step">
      <p className="setup-lede">
        Retrieved {courseResults.length} course{courseResults.length === 1 ? "" : "s"} from Canvas
        {anyPartial ? " — some results are partial and need a closer look" : ""}. Review what was found below — nothing
        is added to your semester until you confirm it.
      </p>

      {courseResults.map((result) => (
        <section key={result.courseId} className="setup-subject-card" data-testid="canvas-course-report-card">
          <header>
            <strong>{result.courseName ?? "Untitled course"}</strong>
          </header>
          {result.status === "found" ? (
            <p className="setup-item-meta">
              <CheckCircle2 size={13} aria-hidden="true" /> {result.assignmentsFound} assignments · {result.modulesFound} modules ·{" "}
              {result.calendarEventsFound} calendar events
              {result.announcementsFound > 0 ? ` · ${result.announcementsFound} announcements` : ""}
            </p>
          ) : (
            <p className="setup-hint">
              <AlertTriangle size={13} aria-hidden="true" /> {result.status === "error" ? "Couldn't be fully retrieved" : "Partially retrieved"} (not a
              fabricated success) — {result.assignmentsFound} assignments, {result.modulesFound} modules found so far.
            </p>
          )}
          {result.warnings.length > 0 ? (
            <ul className="setup-warning-list">
              {result.warnings.map((w) => (
                <li key={w}>
                  <AlertTriangle size={13} aria-hidden="true" /> {w}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={onContinueToReview}>
          Continue
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
