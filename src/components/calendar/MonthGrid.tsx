import type { CalendarEvent } from "../../lib/calendarEvents";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface MonthGridProps {
  dates: string[];
  events: CalendarEvent[];
  currentMonth: { year: number; month: number } | null;
  todayIso: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function MonthGrid({ dates, events, currentMonth, todayIso, selectedDate, onSelectDate }: MonthGridProps) {
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = eventsByDate.get(event.date) ?? [];
    list.push(event);
    eventsByDate.set(event.date, list);
  }

  return (
    <div className="month-grid" role="grid" aria-label="Calendar">
      {DAY_LABELS.map((label) => (
        <div key={label} className="month-grid-day-label" role="columnheader">
          {label}
        </div>
      ))}

      {dates.map((dateIso) => {
        const [, m, d] = dateIso.split("-").map(Number);
        const dayEvents = eventsByDate.get(dateIso) ?? [];
        const inMonth = currentMonth ? m - 1 === currentMonth.month : true;
        const isToday = dateIso === todayIso;
        const isSelected = dateIso === selectedDate;

        return (
          <button
            key={dateIso}
            type="button"
            role="gridcell"
            className={[
              "month-grid-cell",
              inMonth ? "" : "month-grid-cell--outside",
              isToday ? "month-grid-cell--today" : "",
              isSelected ? "month-grid-cell--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-selected={isSelected}
            aria-label={`${dateIso}${dayEvents.length ? `, ${dayEvents.length} assessment${dayEvents.length === 1 ? "" : "s"} due` : ""}`}
            onClick={() => onSelectDate(dateIso)}
          >
            <span className="month-grid-cell-number">{d}</span>
            <span className="month-grid-cell-events">
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  className="month-grid-event-dot"
                  style={{ backgroundColor: `var(${event.accentVar})` }}
                  title={event.title}
                />
              ))}
              {dayEvents.length > 3 ? <span className="month-grid-event-more">+{dayEvents.length - 3}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
