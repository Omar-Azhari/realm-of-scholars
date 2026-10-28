/**
 * Library desk tools: import your class timetable (.ics), and book a study
 * room — a timed focus session where every classmate in your study group who
 * "joins" adds 10% XP (up to +30%).
 */

import { useState } from "react";
import { Window } from "./Window";
import { realmStore, useRealm } from "../state/store";
import { classesOn, parseTimetable } from "../curriculum/timetable";
import { startFocus } from "../state/actions";
import { chat } from "../state/events";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TimetableWindow({ onClose }: { onClose: () => void }) {
  const timetable = useRealm((s) => s.progress.timetable);
  const subjects = useRealm((s) => s.curriculum?.subjects ?? []);
  const [error, setError] = useState<string | null>(null);
  const load = async (file: File) => {
    setError(null);
    const text = await file.text();
    const entries = parseTimetable(text, subjects);
    if (entries.length === 0) {
      setError("No weekly classes found in that file. Export your class timetable (not your Moodle deadlines) as an .ics calendar.");
      return;
    }
    realmStore.set((s) => ({ ...s, progress: { ...s.progress, timetable: entries } }));
    chat(`Timetable imported: ${entries.length} weekly class${entries.length === 1 ? "" : "es"}.`, "quest");
  };
  return (
    <Window title="Class timetable" onClose={onClose} width={640}>
      <p className="muted small">
        Import your class timetable as an .ics calendar file (most university timetable systems can export one). Studying a subject within {3} hours after its
        class pays a follow-up bonus of 5 Focus, and an owl brings each day&apos;s classes.
      </p>
      <label className="rs-button small">
        Choose .ics file
        <input type="file" accept=".ics,text/calendar" hidden onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
      </label>
      {error ? <p className="bad">{error}</p> : null}
      {timetable.length ? (
        <table className="timetable">
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const day = classesOn(timetable, new Date(2026, 0, 4 + d));
              return day.length ? (
                <tr key={d}>
                  <th>{DAYS[d]}</th>
                  <td>
                    {day.map((c) => (
                      <div key={c.key}>
                        <b>
                          {c.start}–{c.end}
                        </b>{" "}
                        {c.title}
                        {c.location ? <small className="muted"> · {c.location}</small> : null}
                      </div>
                    ))}
                  </td>
                </tr>
              ) : null;
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted">No timetable yet.</p>
      )}
    </Window>
  );
}

const ROOMS = ["Reading Room A", "Group Study Room 2", "The Quiet Carrel", "Seminar Room 4"];

export function StudyRoomWindow({ onClose, onStarted }: { onClose: () => void; onStarted: (subjectId: string) => void }) {
  const subjects = useRealm((s) => s.curriculum?.subjects ?? []);
  const group = useRealm((s) => s.progress.group);
  const busy = useRealm((s) => Boolean(s.progress.activeFocus));
  const members = Object.values(group).map((m) => m.name);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [minutes, setMinutes] = useState(25);
  const [room, setRoom] = useState(ROOMS[0]);
  const bonus = Math.min(3, members.length) * 10;
  return (
    <Window title="Book a study room" onClose={onClose} width={560}>
      <p className="muted small">
        A real timed study session in a library room. Classmates in your study group are invited and each adds 10% XP (up to +30%). Leave the game open, or come
        back later. It pays when the time is up.
      </p>
      <div className="field">
        <span>Room</span>
        <select value={room} onChange={(e) => setRoom(e.target.value)}>
          {ROOMS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>Subject</span>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        {[25, 50].map((m) => (
          <button key={m} type="button" className={`chip ${minutes === m ? "on" : ""}`} onClick={() => setMinutes(m)}>
            {m} minutes
          </button>
        ))}
      </div>
      <p className="small">
        Joining: {members.length ? members.join(", ") : "nobody yet. Add classmates' share codes at the study-group board."}
        {bonus ? ` (+${bonus}% XP)` : ""}.
      </p>
      <button
        type="button"
        className="rs-button"
        disabled={busy || !subjectId}
        onClick={() => {
          startFocus(subjectId, minutes, { name: room, members: members.slice(0, 3) });
          onStarted(subjectId);
        }}
      >
        {busy ? "A session is already running" : `Start ${minutes} minutes in ${room}`}
      </button>
    </Window>
  );
}
