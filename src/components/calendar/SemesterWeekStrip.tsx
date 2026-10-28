/**
 * Semester Calendar strip (Phase 11 Part 1) — the visible face of
 * src/lib/semesterCalendar.ts. Shows the current teaching week, completed
 * weeks, assessment weeks, the revision/exam tail, today's date, and the
 * countdown to the next confirmed assessment.
 *
 * The semester start/end dates ship UNCONFIRMED (no /docs source), so until
 * the user confirms the start date the strip offers the same confirm-in-place
 * editor used everywhere else — it never guesses a week number.
 */

import { CalendarRange, Hourglass } from "lucide-react";
import { useSaveData } from "../../state/SaveDataContext";
import { ConfirmableField } from "../ui/ConfirmableField";
import type { SemesterCalendar } from "../../lib/semesterCalendar";

const PERIOD_LABELS: Record<string, string> = {
  "pre-semester": "Semester hasn't started yet",
  teaching: "Teaching period",
  revision: "Revision period",
  exams: "Exam period",
  finished: "Semester finished",
};

export function SemesterWeekStrip({ calendar }: { calendar: SemesterCalendar }) {
  const { saveData, confirmSemesterStartDate, confirmSemesterEndDate } = useSaveData();
  const { startDate, endDate } = saveData.semester;

  return (
    <div className="panel semester-strip" data-era={calendar.era}>
      <h3 className="dashboard-card-title">
        <CalendarRange size={17} aria-hidden="true" /> Semester Calendar
      </h3>

      {calendar.startConfirmed ? (
        <>
          <p className="semester-strip-status" data-testid="semester-status">
            {calendar.period ? PERIOD_LABELS[calendar.period] : ""}
            {calendar.currentWeek !== null ? (
              <>
                {" — "}
                <strong>
                  Week {calendar.currentWeek} of {calendar.totalTeachingWeeks}
                </strong>
              </>
            ) : null}
            {" · "}
            {calendar.completedWeeks ?? 0} week{(calendar.completedWeeks ?? 0) === 1 ? "" : "s"} completed
            {" · today is "}
            {calendar.todayIso}
          </p>

          <ol className="semester-week-row" aria-label="Teaching weeks">
            {calendar.weekStarts.map((monday, index) => {
              const week = index + 1;
              const isCurrent = calendar.currentWeek === week;
              const isDone = calendar.currentWeek !== null ? week < calendar.currentWeek : (calendar.completedWeeks ?? 0) >= week;
              const hasAssessment = calendar.assessmentWeeks.includes(week);
              return (
                <li
                  key={monday}
                  className={[
                    "semester-week-pill",
                    isDone ? "semester-week-pill--done" : "",
                    isCurrent ? "semester-week-pill--current" : "",
                    hasAssessment ? "semester-week-pill--assessment" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={`Week ${week} · starts ${monday}${hasAssessment ? " · assessment due" : ""}`}
                  aria-current={isCurrent ? "date" : undefined}
                >
                  <span className="semester-week-num">{week}</span>
                  {hasAssessment ? <span className="semester-week-dot" aria-hidden="true" /> : null}
                </li>
              );
            })}
            <li
              className={`semester-week-pill semester-week-pill--tail${calendar.period === "revision" ? " semester-week-pill--current" : ""}`}
              title="Revision period (after teaching weeks)"
            >
              Rev
            </li>
            <li
              className={`semester-week-pill semester-week-pill--tail${calendar.period === "exams" ? " semester-week-pill--current" : ""}`}
              title={calendar.examPeriodRaw ?? "Exam period (after revision)"}
            >
              Exams
            </li>
          </ol>
        </>
      ) : (
        <div className="semester-strip-unconfirmed">
          <p className="screen-lede">
            Week numbering needs the real semester start date — it isn't in the subject documents, so
            nothing is guessed. Confirm it once and the whole campus tracks your teaching weeks.
          </p>
          <ConfirmableField
            label="Semester start date (first Monday)"
            status={startDate.status}
            displayValue={startDate.value ?? ""}
            editorType="date"
            onConfirm={(raw) => confirmSemesterStartDate(raw)}
          />
          <ConfirmableField
            label="Semester end date (optional — sets total weeks)"
            status={endDate.status}
            displayValue={endDate.value ?? ""}
            editorType="date"
            onConfirm={(raw) => confirmSemesterEndDate(raw)}
          />
        </div>
      )}

      <p className="semester-strip-countdown" data-testid="next-assessment-countdown">
        <Hourglass size={14} aria-hidden="true" />
        {calendar.daysUntilNextAssessment !== null && calendar.nextAssessmentTitle ? (
          <>
            Next assessment: <strong>{calendar.nextAssessmentTitle}</strong> in{" "}
            {calendar.daysUntilNextAssessment} day{calendar.daysUntilNextAssessment === 1 ? "" : "s"}
          </>
        ) : (
          "No confirmed upcoming assessment deadlines."
        )}
      </p>
    </div>
  );
}
