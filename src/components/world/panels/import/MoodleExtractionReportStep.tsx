/**
 * Moodle extraction report (Phase 18F, Part 15). Per-course summary before
 * the existing Review screen — mirrors CanvasExtractionReportStep.tsx's
 * exact discipline (never describe a partial result as a plain success) —
 * kept as its own component rather than a shared generic one because
 * `MoodleCourseImportResult`'s fields (sections/quizzes) genuinely differ
 * from Canvas's (modules only), consistent with this phase's own choice
 * not to force identical shapes where the underlying data differs (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §2).
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { MoodleCourseImportResult } from "../../../../server/lms/moodle/moodleImportOrchestrator";

export function MoodleExtractionReportStep({
  courseResults,
  onContinueToReview,
  onCancel,
}: {
  courseResults: MoodleCourseImportResult[];
  onContinueToReview: () => void;
  onCancel: () => void;
}) {
  const anyPartial = courseResults.some((r) => r.status === "partial" || r.status === "error");

  return (
    <div className="setup-step" data-testid="moodle-extraction-report-step">
      <p className="setup-lede">
        Retrieved {courseResults.length} course{courseResults.length === 1 ? "" : "s"} from Moodle
        {anyPartial ? " — some results are partial and need a closer look" : ""}. Review what was found below — nothing
        is added to your semester until you confirm it.
      </p>

      {courseResults.map((result) => (
        <section key={result.courseId} className="setup-subject-card" data-testid="moodle-course-report-card">
          <header>
            <strong>{result.courseName ?? "Untitled course"}</strong>
          </header>
          {result.status === "found" ? (
            <p className="setup-item-meta">
              <CheckCircle2 size={13} aria-hidden="true" /> {result.assignmentsFound} assignments · {result.quizzesFound} quizzes ·{" "}
              {result.sectionsFound} sections · {result.calendarEventsFound} calendar events
              {result.announcementsFound > 0 ? ` · ${result.announcementsFound} announcements` : ""}
            </p>
          ) : (
            <p className="setup-hint">
              <AlertTriangle size={13} aria-hidden="true" /> {result.status === "error" ? "Couldn't be fully retrieved" : "Partially retrieved"} (not a
              fabricated success) — {result.assignmentsFound} assignments, {result.sectionsFound} sections found so far.
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
