import { useMemo, useState } from "react";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useSaveData } from "../state/SaveDataContext";
import { formatMelbourneKey } from "../lib/reminders";
import { getMelbourneDateTimeKey } from "../lib/selectors";
import type { MoodRating, StudyLogEntry } from "../types/domain";

const MOODS: Array<{ value: MoodRating; label: string }> = [
  { value: 1, label: "1 — rough" },
  { value: 2, label: "2 — low" },
  { value: 3, label: "3 — okay" },
  { value: 4, label: "4 — good" },
  { value: 5, label: "5 — great" },
];

type Draft = Omit<StudyLogEntry, "id">;

function emptyDraft(subjectId: string): Draft {
  return {
    subjectId,
    assessmentId: null,
    moduleId: null,
    dateTime: getMelbourneDateTimeKey(new Date()),
    durationMinutes: null,
    completed: "",
    difficulties: "",
    nextPlan: "",
    moodBefore: null,
    moodAfter: null,
    notes: "",
    focusSessionId: null,
  };
}

/**
 * Study Journal — the full study-log record (create/edit/delete with
 * confirmation, subject + date-range filters). Logs also arrive here from
 * in-room mentor check-ins, are exported as part of the save JSON, and carry
 * a reserved focusSessionId for the later Focus Sprint mini-game.
 */
export function StudyJournalScreen() {
  const { saveData, addStudyLog, updateStudyLog, deleteStudyLog } = useSaveData();
  const subjects = saveData.semester.subjects;

  const [filterSubject, setFilterSubject] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, "new" = creating
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(subjects[0]?.id ?? ""));

  const entries = useMemo(() => {
    return [...saveData.studyLog]
      .filter((entry) => (filterSubject ? entry.subjectId === filterSubject : true))
      .filter((entry) => (filterFrom ? entry.dateTime.slice(0, 10) >= filterFrom : true))
      .filter((entry) => (filterTo ? entry.dateTime.slice(0, 10) <= filterTo : true))
      .sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1));
  }, [saveData.studyLog, filterSubject, filterFrom, filterTo]);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;
  const draftSubject = subjects.find((s) => s.id === draft.subjectId);

  const startCreate = () => {
    setDraft(emptyDraft(subjects[0]?.id ?? ""));
    setEditingId("new");
  };
  const startEdit = (entry: StudyLogEntry) => {
    const { id: _id, ...rest } = entry;
    setDraft(rest);
    setEditingId(entry.id);
  };
  const saveDraft = () => {
    if (!draft.subjectId || !draft.completed.trim()) return;
    if (editingId === "new") addStudyLog(draft);
    else if (editingId) updateStudyLog(editingId, draft);
    setEditingId(null);
  };
  const confirmDelete = (entry: StudyLogEntry) => {
    if (window.confirm(`Delete this study log from ${formatMelbourneKey(entry.dateTime)}? This cannot be undone.`)) {
      deleteStudyLog(entry.id);
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">
        <NotebookPen size={26} aria-hidden="true" className="screen-title-icon" /> Study Journal
      </h1>
      <p className="screen-lede">
        Your study sessions, in your own words. Entries are saved locally and included in save-data
        exports. Times are Australia/Melbourne.
      </p>

      <div className="panel journal-filter-bar">
        <label>
          Subject
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </label>
        <button type="button" className="button--primary" onClick={startCreate}>
          <Plus size={15} aria-hidden="true" /> New entry
        </button>
      </div>

      {editingId !== null ? (
        <div className="panel journal-form" aria-label={editingId === "new" ? "New study log" : "Edit study log"}>
          <h2 className="dashboard-card-title">{editingId === "new" ? "New study log" : "Edit study log"}</h2>
          <div className="journal-form-grid">
            <label>
              Subject
              <select
                value={draft.subjectId}
                onChange={(e) => setDraft({ ...draft, subjectId: e.target.value, assessmentId: null, moduleId: null })}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assessment (optional)
              <select
                value={draft.assessmentId ?? ""}
                onChange={(e) => setDraft({ ...draft, assessmentId: e.target.value || null })}
              >
                <option value="">—</option>
                {draftSubject?.assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Module (optional)
              <select
                value={draft.moduleId ?? ""}
                onChange={(e) => setDraft({ ...draft, moduleId: e.target.value || null })}
              >
                <option value="">—</option>
                {draftSubject?.modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.moduleNumber}. {module.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={draft.dateTime.slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, dateTime: `${e.target.value}T${draft.dateTime.slice(11)}` })}
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={draft.dateTime.slice(11)}
                onChange={(e) => setDraft({ ...draft, dateTime: `${draft.dateTime.slice(0, 10)}T${e.target.value}` })}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min="0"
                value={draft.durationMinutes ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, durationMinutes: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })
                }
              />
            </label>
            <label>
              Mood before
              <select
                value={draft.moodBefore ?? ""}
                onChange={(e) => setDraft({ ...draft, moodBefore: e.target.value ? (Number(e.target.value) as MoodRating) : null })}
              >
                <option value="">—</option>
                {MOODS.map((mood) => (
                  <option key={mood.value} value={mood.value}>
                    {mood.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mood after
              <select
                value={draft.moodAfter ?? ""}
                onChange={(e) => setDraft({ ...draft, moodAfter: e.target.value ? (Number(e.target.value) as MoodRating) : null })}
              >
                <option value="">—</option>
                {MOODS.map((mood) => (
                  <option key={mood.value} value={mood.value}>
                    {mood.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="journal-form-wide">
            What did you complete?
            <textarea value={draft.completed} onChange={(e) => setDraft({ ...draft, completed: e.target.value })} rows={2} />
          </label>
          <label className="journal-form-wide">
            What was difficult / any blockers?
            <textarea value={draft.difficulties} onChange={(e) => setDraft({ ...draft, difficulties: e.target.value })} rows={2} />
          </label>
          <label className="journal-form-wide">
            What will you do next?
            <textarea value={draft.nextPlan} onChange={(e) => setDraft({ ...draft, nextPlan: e.target.value })} rows={2} />
          </label>
          <label className="journal-form-wide">
            Notes
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
          </label>
          <div className="journal-form-actions">
            <button type="button" className="button--primary" onClick={saveDraft} disabled={!draft.completed.trim()}>
              Save entry
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="screen-lede">No study logs match — create one above or check in with a mentor in any subject room.</p>
      ) : (
        <ul className="journal-list">
          {entries.map((entry) => (
            <li key={entry.id} className="panel journal-entry">
              <div className="journal-entry-header">
                <strong>{subjectName(entry.subjectId)}</strong>
                <span>
                  {formatMelbourneKey(entry.dateTime)}
                  {entry.durationMinutes !== null ? ` · ${entry.durationMinutes} min` : ""}
                  {entry.moodBefore !== null && entry.moodAfter !== null
                    ? ` · mood ${entry.moodBefore}→${entry.moodAfter}`
                    : ""}
                </span>
                <div className="journal-entry-actions">
                  <button type="button" onClick={() => startEdit(entry)}>
                    <Pencil size={14} aria-hidden="true" /> Edit
                  </button>
                  <button type="button" onClick={() => confirmDelete(entry)}>
                    <Trash2 size={14} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
              {entry.completed ? <p><strong>Completed:</strong> {entry.completed}</p> : null}
              {entry.difficulties ? <p><strong>Difficult:</strong> {entry.difficulties}</p> : null}
              {entry.nextPlan ? <p><strong>Next:</strong> {entry.nextPlan}</p> : null}
              {entry.notes ? <p><strong>Notes:</strong> {entry.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
