/**
 * Semester Timeline (Phase 11 Part 6) — every recorded moment of the
 * semester in chronological order. Sources, all already in the save:
 *
 *  - semester start        semester.startDate (only when user-confirmed)
 *  - Focus Sprints         completedFocusSessions (counted ones, startedAt)
 *  - module completions    tasks[].completedAt
 *  - assessment progress   assessmentProgress[].statusChangedAt
 *  - achievements, bond levels, room stages, semester completion
 *                          milestones log (first-observed timestamps)
 *
 * Read-only; renders whatever history the save actually contains.
 */

import { useMemo } from "react";
import {
  CalendarRange,
  Timer,
  BookOpenCheck,
  ClipboardCheck,
  Medal,
  Users,
  Sparkles,
  GraduationCap,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useSaveData } from "../state/SaveDataContext";
import { getCountedSessions } from "../lib/focusSession";
import { getMelbourneDateTimeKey } from "../lib/selectors";
import { getSubjectAccentVar } from "../lib/subjectTheme";

interface TimelineEvent {
  id: string;
  /** ISO timestamp (or ISO date for date-only events) used for ordering. */
  at: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  /** CSS var for the marker colour; falls back to the HQ accent. */
  accentVar?: string;
}

export function TimelineScreen() {
  const { saveData } = useSaveData();
  const subjects = saveData.semester.subjects;

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const subjectName = (id: string | null) => (id ? subjectById.get(id)?.name ?? id : "");

    if (saveData.semester.startDate.status === "confirmed" && saveData.semester.startDate.value) {
      list.push({
        id: "semester-start",
        at: saveData.semester.startDate.value,
        icon: CalendarRange,
        title: "Semester started",
        detail: `Teaching weeks begin — ${saveData.semester.startDate.value}`,
      });
    }

    for (const session of getCountedSessions(saveData)) {
      list.push({
        id: `sprint-${session.id}`,
        at: session.startedAt,
        icon: Timer,
        title: `Focus Sprint — ${subjectName(session.subjectId)}`,
        detail: `${Math.floor(session.elapsedFocusSeconds / 60)} focused minutes`,
        accentVar: getSubjectAccentVar(session.subjectId),
      });
    }

    for (const subject of subjects) {
      for (const module of subject.modules) {
        const task = saveData.tasks.find((t) => t.linkedModuleId === module.id);
        if (task?.completed && task.completedAt) {
          list.push({
            id: `module-${module.id}`,
            at: task.completedAt,
            icon: BookOpenCheck,
            title: `Module completed — ${module.title}`,
            detail: subject.name,
            accentVar: getSubjectAccentVar(subject.id),
          });
        }
      }
      for (const assessment of subject.assessments) {
        const progress = saveData.assessmentProgress.find((p) => p.assessmentId === assessment.id);
        if (
          progress &&
          (progress.status === "submitted" || progress.status === "graded") &&
          progress.statusChangedAt
        ) {
          list.push({
            id: `assessment-${assessment.id}`,
            at: progress.statusChangedAt,
            icon: ClipboardCheck,
            title: `${progress.status === "graded" ? "Graded" : "Submitted"} — ${assessment.title}`,
            detail: subject.name,
            accentVar: getSubjectAccentVar(subject.id),
          });
        }
      }
    }

    for (const milestone of saveData.milestones) {
      const icon =
        milestone.kind === "achievement"
          ? Medal
          : milestone.kind === "bond-level"
            ? Users
            : milestone.kind === "room-stage"
              ? Sparkles
              : milestone.kind === "goal-complete"
                ? Target
                : GraduationCap;
      const subjectId = milestone.id.startsWith("bond:") || milestone.id.startsWith("stage:")
        ? milestone.id.split(":")[1]
        : null;
      list.push({
        id: `milestone-${milestone.id}`,
        at: milestone.at,
        icon,
        title: milestone.label,
        detail:
          milestone.kind === "achievement"
            ? "Achievement unlocked"
            : milestone.kind === "bond-level"
              ? "Mentor milestone"
              : milestone.kind === "room-stage"
                ? "Room upgraded"
                : milestone.kind === "goal-complete"
                  ? "Daily goal completed"
                  : "Semester milestone",
        accentVar: subjectId ? getSubjectAccentVar(subjectId) : undefined,
      });
    }

    return list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }, [saveData, subjects]);

  // Group by Melbourne calendar day for readable headers.
  const byDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      // Date-only events (semester start) already are a Melbourne date.
      const day =
        event.at.length === 10 ? event.at : getMelbourneDateTimeKey(new Date(event.at)).slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <section className="screen">
      <h1 className="screen-title">Semester Timeline</h1>
      <p className="screen-lede">
        Your semester, in order — every Focus Sprint, completed module, submission, achievement,
        mentor milestone, and room upgrade your save remembers.
      </p>

      {byDay.length === 0 ? (
        <div className="panel">
          <p className="screen-lede">
            Nothing recorded yet. Complete a module or run a Focus Sprint and it will appear here.
          </p>
        </div>
      ) : (
        <ol className="timeline" data-testid="semester-timeline">
          {byDay.map(([day, dayEvents]) => (
            <li key={day} className="timeline-day">
              <h3 className="timeline-day-label">{day}</h3>
              <ol className="timeline-day-events">
                {dayEvents.map((event) => {
                  const Icon = event.icon;
                  return (
                    <li
                      key={event.id}
                      className="timeline-event"
                      style={
                        event.accentVar
                          ? ({ "--timeline-accent": `var(${event.accentVar})` } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <span className="timeline-marker" aria-hidden="true">
                        <Icon size={13} />
                      </span>
                      <div>
                        <strong>{event.title}</strong>
                        <span className="screen-lede"> {event.detail}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
