/**
 * Moodle connect + course selection (Phase 18F, Part 15). Unlike Canvas's
 * four-step OAuth redirect choreography (connect → callback → select →
 * importing), Moodle's confirmed connection mode (an institution-issued
 * token, never an OAuth redirect — see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §3/§5) needs only ONE step:
 * check status, and either show the honest unconfigured message with
 * equally-weighted fallbacks, or — once ever configured — the course list
 * to select from. No fake connection, no fake courses, ever.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, GraduationCap, ShieldAlert, ShieldCheck } from "lucide-react";
import { MOODLE_INSTITUTION_PUBLIC_LIST } from "../../../../import/moodleInstitutionPublicList";
import { fetchMoodleStatus, fetchMoodleCourses, type MoodleCourseListItem } from "../../../../import/moodleBackendClient";

export function MoodleConnectStep({
  institutionId,
  onImport,
  onUseFallback,
  onBack,
}: {
  institutionId: string;
  onImport: (courses: Array<{ courseId: number; shortName: string | null; fullName: string | null; viewUrl: string | null }>, includeAnnouncements: boolean) => void;
  onUseFallback: () => void;
  onBack: () => void;
}) {
  const institution = MOODLE_INSTITUTION_PUBLIC_LIST.find((i) => i.institutionId === institutionId) ?? null;
  const [checking, setChecking] = useState(true);
  const [statusReachable, setStatusReachable] = useState(true);
  const [institutionConfigured, setInstitutionConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [courses, setCourses] = useState<MoodleCourseListItem[] | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [includeAnnouncements, setIncludeAnnouncements] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void fetchMoodleStatus(institutionId).then((status) => {
      if (cancelled) return;
      setChecking(false);
      if (!status) {
        setStatusReachable(false);
        return;
      }
      setStatusReachable(true);
      setInstitutionConfigured(status.institutionConfigured);
      setConnected(status.connected && !status.reauthorisationRequired);
    });
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void fetchMoodleCourses(institutionId).then((result) => {
      if (cancelled) return;
      if (!result) {
        setCoursesError("Couldn't retrieve your Moodle courses right now.");
        return;
      }
      setCourses(result);
      setSelected(new Set(result.filter((c) => c.suggestedSelected).map((c) => c.courseId)));
    });
    return () => {
      cancelled = true;
    };
  }, [connected, institutionId]);

  function toggle(courseId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function handleImport() {
    if (!courses) return;
    const chosen = courses.filter((c) => selected.has(c.courseId)).map((c) => ({ courseId: c.courseId, shortName: c.shortName, fullName: c.fullName, viewUrl: c.viewUrl }));
    onImport(chosen, includeAnnouncements);
  }

  return (
    <div className="setup-step" data-testid="moodle-connect-step">
      <p className="setup-lede">
        <GraduationCap size={16} aria-hidden="true" /> {institution?.displayName ?? "This institution"} uses Moodle as its
        Learning Management System.
      </p>

      {checking ? <p className="setup-hint">Checking Moodle connection…</p> : null}

      {!checking && !statusReachable ? (
        <p className="setup-hint">
          <ShieldAlert size={13} aria-hidden="true" /> Couldn't reach the Moodle connection service right now. Every
          other import method (subject guides, calendar files, official subject search, manual entry) still works
          normally.
        </p>
      ) : null}

      {!checking && statusReachable && !institutionConfigured ? (
        <>
          <p className="setup-hint">
            <ShieldAlert size={13} aria-hidden="true" /> La Trobe Moodle automatic connection is not currently
            configured. You can still import your Moodle calendar or upload your subject documents.
          </p>
          <p className="setup-hint">
            La Trobe uses Moodle, but UniGame does not currently have approved access to your private LMS data.
          </p>
        </>
      ) : null}

      {!checking && statusReachable && institutionConfigured && connected ? (
        <p className="setup-hint">
          <ShieldCheck size={13} aria-hidden="true" /> Connected to {institution?.displayName}.
        </p>
      ) : null}

      {!checking && statusReachable && institutionConfigured && !connected ? (
        <p className="setup-hint">
          <ShieldAlert size={13} aria-hidden="true" /> A Moodle connection for {institution?.displayName} isn't active
          for this device right now.
        </p>
      ) : null}

      {connected ? (
        <>
          <p className="setup-lede">Select the courses that belong to this semester. Nothing is imported until you confirm.</p>
          {coursesError ? (
            <p className="setup-error">
              <AlertTriangle size={14} aria-hidden="true" /> {coursesError}
            </p>
          ) : null}
          {!coursesError && !courses ? <p className="setup-hint">Retrieving your Moodle courses…</p> : null}
          {selected.size > 4 ? (
            <p className="setup-hint">
              <AlertTriangle size={13} aria-hidden="true" /> {selected.size} courses selected — UniGame has 4 subject
              rooms, so you'll need to choose which ones map to a room during Review; the rest can still be imported as
              calendar-only or excluded.
            </p>
          ) : null}
          {courses ? (
            <ul className="setup-file-list" data-testid="moodle-course-list">
              {courses.map((course) => {
                const isSelected = selected.has(course.courseId);
                return (
                  <li key={course.courseId} className="setup-file-row">
                    <button
                      type="button"
                      onClick={() => toggle(course.courseId)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${course.fullName ?? "course"}`}
                    >
                      {isSelected ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                    </button>
                    <span className="setup-file-name">
                      {course.fullName ?? "Untitled course"} {course.shortName ? <span className="setup-subject-code">{course.shortName}</span> : null}
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
            Show recent La Trobe LMS announcements in UniGame (optional, calm and dismissible)
          </label>
        </>
      ) : null}

      <div className="setup-actions">
        {connected ? (
          <button type="button" className="button--primary" onClick={handleImport} disabled={!courses || selected.size === 0}>
            Import {selected.size} course{selected.size === 1 ? "" : "s"}
          </button>
        ) : null}
        <button type="button" onClick={onUseFallback}>
          Use a different source instead
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
