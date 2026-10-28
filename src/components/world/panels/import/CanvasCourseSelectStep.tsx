/**
 * Canvas course selection (Phase 18E, Part 7/14). Every visible Canvas
 * course is shown and reviewable — nothing is silently imported. Default
 * selection favours active courses that don't look like
 * orientation/test/club courses, but every default can be overridden.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { getOrCreateCanvasInstallationId } from "../../../../import/canvasBackendClient";

interface CanvasCourseListItem {
  courseId: number;
  name: string | null;
  courseCode: string | null;
  classification: "active" | "completed" | "future" | "unavailable" | "unknown";
  suggestedSelected: boolean;
  suggestionReason: string;
  htmlUrl: string | null;
}

export function CanvasCourseSelectStep({
  institutionId,
  onImport,
  onCancel,
  onBack,
}: {
  institutionId: string;
  onImport: (courseIds: number[], includeAnnouncements: boolean) => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  const [courses, setCourses] = useState<CanvasCourseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [includeAnnouncements, setIncludeAnnouncements] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ownerId = getOrCreateCanvasInstallationId();
    void fetch(`/api/lms/canvas/courses?institutionId=${encodeURIComponent(institutionId)}&ownerId=${encodeURIComponent(ownerId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("couldn't load courses");
        return (await res.json()) as { courses: CanvasCourseListItem[] };
      })
      .then((data) => {
        if (cancelled) return;
        setCourses(data.courses);
        setSelected(new Set(data.courses.filter((c) => c.suggestedSelected).map((c) => c.courseId)));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't retrieve your Canvas courses right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  function toggle(courseId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  const academicSelectedCount = selected.size;

  return (
    <div className="setup-step" data-testid="canvas-course-select-step">
      <p className="setup-lede">Select the courses that belong to this semester. Nothing is imported until you confirm.</p>

      {error ? (
        <p className="setup-error">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {!error && !courses ? <p className="setup-hint">Retrieving your Canvas courses…</p> : null}

      {academicSelectedCount > 4 ? (
        <p className="setup-hint">
          <AlertTriangle size={13} aria-hidden="true" /> {academicSelectedCount} courses selected — UniGame has 4 subject
          rooms, so you'll need to choose which ones map to a room during Review; the rest can still be imported as
          calendar-only or excluded.
        </p>
      ) : null}

      {courses ? (
        <ul className="setup-file-list" data-testid="canvas-course-list">
          {courses.map((course) => {
            const isSelected = selected.has(course.courseId);
            return (
              <li key={course.courseId} className="setup-file-row">
                <button
                  type="button"
                  onClick={() => toggle(course.courseId)}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${course.name ?? "course"}`}
                >
                  {isSelected ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                </button>
                <span className="setup-file-name">
                  {course.name ?? "Untitled course"} {course.courseCode ? <span className="setup-subject-code">{course.courseCode}</span> : null}
                </span>
                <span className="setup-file-message">
                  {course.classification} — {course.suggestionReason}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <label className="setup-mapping-row">
        <input type="checkbox" checked={includeAnnouncements} onChange={(e) => setIncludeAnnouncements(e.target.checked)} />
        Show important Canvas announcements in UniGame (optional, calm and dismissible)
      </label>

      <div className="setup-actions">
        <button
          type="button"
          className="button--primary"
          onClick={() => onImport([...selected], includeAnnouncements)}
          disabled={selected.size === 0}
        >
          Import {selected.size} course{selected.size === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
