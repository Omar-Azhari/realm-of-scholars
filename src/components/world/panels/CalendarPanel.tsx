/**
 * Calendar panel (Phase 15B) — two views: Upcoming (default) and Month.
 * Combines assessment deadlines, reminders and scheduled study sessions,
 * colour-coded by subject, anchored to the Australia/Melbourne date. Not a
 * second task manager — it shows dates, it doesn't manage tasks.
 */

import { useMemo, useState } from "react";
import { CalendarDays, AlarmClock, Timer, ChevronLeft, ChevronRight } from "lucide-react";
import { useSaveData } from "../../../state/SaveDataContext";
import { MonthGrid } from "../../calendar/MonthGrid";
import { SemesterWeekStrip } from "../../calendar/SemesterWeekStrip";
import { getCalendarEvents, getMonthGridDates, formatMonthLabel } from "../../../lib/calendarEvents";
import { getReminderViews } from "../../../lib/reminders";
import { getSemesterCalendar } from "../../../lib/semesterCalendar";
import { getMelbourneDateIso } from "../../../lib/selectors";
import { getSubjectAccentVar } from "../../../lib/subjectTheme";

type View = "upcoming" | "month";

export function CalendarPanel() {
  const { saveData } = useSaveData();
  const subjects = saveData.semester.subjects;
  const todayIso = getMelbourneDateIso();
  const [view, setView] = useState<View>("upcoming");
  const [cursor, setCursor] = useState(todayIso);
  const [selected, setSelected] = useState<string | null>(todayIso);

  const semesterCalendar = useMemo(() => getSemesterCalendar(saveData), [saveData]);
  const events = useMemo(() => getCalendarEvents(subjects), [subjects]);
  const [year, month] = cursor.split("-").map(Number);
  const monthDates = useMemo(() => getMonthGridDates(year, month - 1), [year, month]);
  const subjectName = (id: string | null) => subjects.find((s) => s.id === id)?.name ?? "";

  const upcoming = useMemo(() => {
    const rows: { date: string; label: string; kind: "deadline" | "reminder" | "study"; subjectId: string | null }[] = [];
    for (const e of events) if (e.date >= todayIso) rows.push({ date: e.date, label: e.title, kind: "deadline", subjectId: e.subjectId });
    for (const v of getReminderViews(saveData)) {
      const d = v.effectiveFireAt.slice(0, 10);
      if (d >= todayIso) rows.push({ date: d, label: v.reminder.title, kind: "reminder", subjectId: v.reminder.subjectId });
    }
    for (const log of saveData.studyLog) {
      const d = log.dateTime.slice(0, 10);
      if (d >= todayIso) rows.push({ date: d, label: `Study — ${subjectName(log.subjectId)}`, kind: "study", subjectId: log.subjectId });
    }
    return rows.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, saveData, todayIso]);

  function shiftMonth(delta: number) {
    const nextD = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCursor(nextD.toISOString().slice(0, 10));
  }

  return (
    <div className="calendar-panel">
      <div className="calendar-viewtoggle" role="tablist" aria-label="Calendar view">
        <button type="button" role="tab" aria-selected={view === "upcoming"} className={view === "upcoming" ? "is-active" : ""} onClick={() => setView("upcoming")}>
          Upcoming
        </button>
        <button type="button" role="tab" aria-selected={view === "month"} className={view === "month" ? "is-active" : ""} onClick={() => setView("month")}>
          Month
        </button>
      </div>

      {view === "upcoming" ? (
        upcoming.length === 0 ? (
          <p className="tasks-empty">Nothing scheduled ahead.</p>
        ) : (
          <ul className="calendar-panel-upcoming">
            {upcoming.map((row, i) => (
              <li key={`${row.kind}-${i}`}>
                <span className="tasks-dot" style={{ background: row.subjectId ? `var(${getSubjectAccentVar(row.subjectId)})` : "var(--hq-accent)" }} />
                <span className="calendar-panel-upcoming-icon" aria-hidden="true">
                  {row.kind === "reminder" ? <AlarmClock size={13} /> : row.kind === "study" ? <Timer size={13} /> : <CalendarDays size={13} />}
                </span>
                <span className="calendar-panel-upcoming-title">{row.label}</span>
                <time className="calendar-panel-upcoming-date">{row.date}</time>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <SemesterWeekStrip calendar={semesterCalendar} />
          <div className="calendar-panel-navrow">
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="calendar-panel-monthlabel">
              <CalendarDays size={15} aria-hidden="true" /> {formatMonthLabel(year, month - 1)}
            </span>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <MonthGrid dates={monthDates} events={events} currentMonth={{ year, month: month - 1 }} todayIso={todayIso} selectedDate={selected} onSelectDate={setSelected} />
        </>
      )}
    </div>
  );
}
