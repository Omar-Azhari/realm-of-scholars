/**
 * Study Planner (Phase 19, Part 11) — a self-contained, router-link-free
 * screen (same convention as TimelineScreen/SettingsScreen), reached from
 * Menu. Renders the Academic Roadmap's weekly/assessment/exam views.
 *
 * "Editable" (Part 11) is scoped deliberately: modules are the one unit
 * this game already tracks completion for (`toggleModuleCompletion`,
 * unchanged, existing XP/streak mechanics) — Study Planner's weekly
 * checklist reuses that real mutation directly. Readings, schedule
 * entries, and exam info have never had individual completion tracking
 * anywhere in this codebase; adding a new granular per-item task system
 * for them is out of this phase's scope (see
 * docs/PHASE_19_ACADEMIC_INTELLIGENCE.md's completion report, "known
 * limitations") — they're shown as informational reference lists that
 * link into the relevant room via the existing `locateInWorld`, not as a
 * second, parallel task store.
 */

import { useMemo } from "react";
import { CheckCircle2, Circle, MapPin, BookOpen, GraduationCap } from "lucide-react";
import { useSaveData } from "../state/SaveDataContext";
import { useWorldUi } from "../world/WorldUiContext";
import { buildAcademicRoadmap } from "../lib/academicRoadmap";
import { computeWeeklyWorkload, type WorkloadLevel } from "../lib/academicWorkload";
import { isModuleCompleted } from "../lib/selectors";

const WORKLOAD_LABEL: Record<WorkloadLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  peak: "Peak",
};

export function StudyPlannerScreen() {
  const { saveData, toggleModuleCompletion } = useSaveData();
  const { locateInWorld } = useWorldUi();

  const roadmap = useMemo(() => buildAcademicRoadmap(saveData), [saveData]);
  const workloadByWeek = useMemo(() => {
    const workload = computeWeeklyWorkload(roadmap);
    return new Map(workload.map((w) => [w.weekNumber, w]));
  }, [roadmap]);

  const weeksWithContent = roadmap.weeks.filter((w) => w.modules.length > 0 || w.assessmentsDue.length > 0);

  return (
    <section className="screen">
      <h1 className="screen-title">Study Planner</h1>
      <p className="screen-lede">
        Your semester, week by week — modules to work through, assessments coming up, and exams
        ahead. Tick off modules as you go; everything else links straight back to its room.
      </p>

      {weeksWithContent.length === 0 ? (
        <p className="screen-lede">
          No weekly breakdown yet — this fills in once your semester start date is confirmed and
          modules/assessments are imported or entered.
        </p>
      ) : (
        <div className="panel study-planner-weeks">
          {weeksWithContent.map((week) => {
            const workload = workloadByWeek.get(week.weekNumber);
            return (
              <section key={week.weekNumber} className="study-planner-week">
                <header className="study-planner-week-head">
                  <strong>Week {week.weekNumber}</strong>
                  {workload ? (
                    <span className={`study-planner-workload study-planner-workload--${workload.level}`}>
                      {WORKLOAD_LABEL[workload.level]}
                    </span>
                  ) : null}
                </header>

                {week.modules.map((m) => (
                  <label key={m.moduleId} className="setup-item-row">
                    <input
                      type="checkbox"
                      checked={isModuleCompleted(saveData.tasks, m.moduleId)}
                      onChange={() => toggleModuleCompletion(m.moduleId)}
                    />
                    <span className="setup-item-title">{m.title}</span>
                    <button
                      type="button"
                      onClick={() => locateInWorld({ title: m.title, subjectId: m.subjectId, sceneId: `room-${m.subjectId}`, interactableId: "modules" })}
                      aria-label={`Locate ${m.title} in the world`}
                    >
                      <MapPin size={13} aria-hidden="true" />
                    </button>
                  </label>
                ))}

                {week.assessmentsDue.map((a) => (
                  <div key={a.assessmentId} className="setup-item-row">
                    <GraduationCap size={14} aria-hidden="true" />
                    <span className="setup-item-title">{a.title}</span>
                    <span className="setup-item-meta">{a.subjectName}</span>
                    <button
                      type="button"
                      onClick={() => locateInWorld({ title: a.title, subjectId: a.subjectId, sceneId: `room-${a.subjectId}`, interactableId: "assessments" })}
                      aria-label={`Locate ${a.title} in the world`}
                    >
                      <MapPin size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}

                {week.readings.length > 0 ? (
                  <p className="study-planner-reading-list">
                    <BookOpen size={13} aria-hidden="true" /> {week.readings.map((r) => r.title).join(" · ")}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {roadmap.examRoadmap.length > 0 ? (
        <div className="panel study-planner-exams">
          <h2 className="dashboard-card-title">Exams</h2>
          {roadmap.examRoadmap.map((e) => (
            <div key={e.assessmentId} className="setup-item-row">
              {e.dueDateIso ? <CheckCircle2 size={13} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}
              <span className="setup-item-title">{e.title}</span>
              <span className="setup-item-meta">
                {e.subjectName}
                {e.examInfo ? ` — ${e.examInfo}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {roadmap.breakLabels.length > 0 ? (
        <p className="screen-lede">Teaching breaks: {roadmap.breakLabels.join(", ")}</p>
      ) : null}
    </section>
  );
}
