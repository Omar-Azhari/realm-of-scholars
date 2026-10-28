import { getCalendarEvents, getWeekGridDates } from "../../lib/calendarEvents";
import { getMelbourneDateIso } from "../../lib/selectors";
import type { SubjectRecord } from "../../types/domain";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** A compact 7-day preview strip — a small taste of the full Calendar screen, for the HQ side rail. */
export function WeekStrip({ subjects }: { subjects: SubjectRecord[] }) {
  const todayIso = getMelbourneDateIso();
  const events = getCalendarEvents(subjects);
  const days = getWeekGridDates(todayIso);

  return (
    <div className="week-strip">
      {days.map((date, index) => {
        const dayEvents = events.filter((event) => event.date === date);
        const isToday = date === todayIso;
        const dayNumber = Number(date.split("-")[2]);
        return (
          <div key={date} className={`week-strip-day${isToday ? " week-strip-day--today" : ""}`}>
            <span className="week-strip-day-label">{DAY_LABELS[index]}</span>
            <span className="week-strip-day-number">{dayNumber}</span>
            <span className="week-strip-day-dots">
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  className="week-strip-dot"
                  style={{ backgroundColor: `var(${event.accentVar})` }}
                  title={event.title}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
