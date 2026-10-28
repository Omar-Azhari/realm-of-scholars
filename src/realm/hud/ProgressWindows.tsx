/**
 * Windows for tracking real progress: grades & WAM with the study plan,
 * explain-it-back, adding your own tutorial questions, the Hall of
 * Trophies, and the achievements list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Window } from "./Window";
import { useRealm } from "../state/store";
import { chat } from "../state/events";
import { DEFAULT_CREDIT_POINTS, GRADE_BANDS, gradeFor, neededForTarget, setCreditPoints, setMark, setWeight, subjectResult, wam } from "../state/grades";
import { allPlans, plansToIcs } from "../state/plan";
import { keywordScore, recordExplanation, weakWeeks } from "../state/stats";
import { dueCards } from "../state/grimoire";
import { houseStandings } from "../customise/houses";
import { ACHIEVEMENTS, setTitle, unlockedTitles } from "../state/achievements";
import { updateSubject, questProgress } from "../state/actions";
import { bossName } from "../state/bosses";
import { gradeExplanation, CurriculumFetchError, type ExplainFeedback } from "../curriculum/curriculumClient";
import { parsePastedQuestions } from "../curriculum/questionParser";
import { THEME_STYLES } from "../world/themes";
import type { RealmSubject } from "../types";
import { houseIcon, Icon, themeIcon } from "./icons";

// ---------------------------------------------------------------------------
// Grades, WAM and study plan
// ---------------------------------------------------------------------------

function NumberInput({ value, onCommit, min = 0, max = 100, step = 1, label, width = 64 }: { value: number | null; onCommit: (v: number | null) => void; min?: number; max?: number; step?: number; label: string; width?: number }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      title={label}
      min={min}
      max={max}
      step={step}
      value={text}
      style={{ width }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim();
        if (trimmed === "") return onCommit(null);
        const n = Number(trimmed);
        if (Number.isFinite(n)) onCommit(Math.max(min, Math.min(max, n)));
        else setText(value === null ? "" : String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function GradesWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const subjects = state.curriculum?.subjects ?? [];
  const [tab, setTab] = useState<"grades" | "plan">("grades");
  const final = wam(state, false);
  const projected = wam(state, true);
  const plans = allPlans(state);

  return (
    <Window title="Grades, WAM and study plan" onClose={onClose} width={780} className="grades-window">
      <nav className="codex-tabs">
        <button type="button" className={tab === "grades" ? "active" : ""} onClick={() => setTab("grades")}>
          Grades &amp; WAM
        </button>
        <button type="button" className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>
          Study plan
        </button>
      </nav>
      {tab === "grades" ? (
        <>
          <div className="wam-box">
            <p>
              <span className="label">WAM so far</span>
              <strong>{projected ? projected.value.toFixed(2) : "-"}</strong>
              <span className="muted small">{projected ? `${projected.subjects} subject(s), ${projected.credit} credit points, from the marks you've entered` : "Enter marks below"}</span>
            </p>
            <p>
              <span className="label">Final WAM</span>
              <strong>{final ? final.value.toFixed(2) : "-"}</strong>
              <span className="muted small">{final ? "subjects with every assessment marked" : "needs a subject with every weighted assessment marked"}</span>
            </p>
          </div>
          <p className="muted small">
            La Trobe's scale: {GRADE_BANDS.map((b) => b.label).join(" · ")}. WAM = Σ(subject mark × credit points) ÷ Σ credit points. Enter weightings from your subject guide where they're missing. Unknown weights are never guessed.
          </p>
          {subjects.map((subject) => (
            <SubjectGrades key={subject.id} subject={subject} />
          ))}
        </>
      ) : (
        <>
          <p className="muted small">Each quest's steps spread over the two weeks before it's due (or from today). Tick steps in the quest journal as you do them.</p>
          {plans.length === 0 ? <p>No upcoming quests with a known due date. Import your Moodle deadlines from the Quests tab to plan them.</p> : null}
          {plans.map((plan) => (
            <div key={plan.assessment.id} className="plan-card">
              <p className="plan-head">
                <strong>
                  {plan.subject.code || plan.subject.name}: {plan.assessment.title}
                </strong>
                <span className="muted small">due {new Date(`${plan.due}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
              </p>
              <ol>
                {plan.steps.map((step) => (
                  <li key={step.index} className={step.done ? "done" : ""}>
                    <span className="date">{step.done ? "done" : new Date(`${step.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span> {step.text}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {plans.length > 0 ? (
            <div className="row">
              <button
                type="button"
                className="rs-button"
                onClick={() => {
                  download("study-plan.ics", plansToIcs(plans), "text/calendar");
                  chat("Study plan exported. Open the .ics file to add it to Google Calendar, Outlook or Apple Calendar.");
                }}
              >
                Export to calendar (.ics)
              </button>
            </div>
          ) : null}
        </>
      )}
    </Window>
  );
}

function SubjectGrades({ subject }: { subject: RealmSubject }) {
  const state = useRealm((s) => s);
  const r = subjectResult(state, subject);
  const shown = r.final ?? r.average;
  return (
    <section className="grade-subject">
      <header>
        <strong>
          <Icon name={themeIcon(subject.theme)} /> {subject.code ? `${subject.code} ` : ""}
          {subject.name}
        </strong>
        <span className="cp">
          <NumberInput label="Credit points" value={subject.creditPoints ?? DEFAULT_CREDIT_POINTS} min={0} max={120} width={52} onCommit={(v) => setCreditPoints(subject.id, v ?? DEFAULT_CREDIT_POINTS)} /> credit points
        </span>
        <span className={`result ${shown !== null ? gradeFor(shown).letter : ""}`}>
          {shown !== null ? `${shown.toFixed(1)}% ${gradeFor(shown).letter}${r.final === null ? " so far" : ""}` : "no marks yet"}
        </span>
      </header>
      <table className="grade-table">
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Weight %</th>
            <th>Your mark</th>
          </tr>
        </thead>
        <tbody>
          {subject.assessments.map((a) => (
            <MarkRow key={a.id} assessmentId={a.id} title={a.title} weight={a.weightPercent} />
          ))}
        </tbody>
      </table>
      {r.unknownWeight.length > 0 ? <p className="muted small">{r.unknownWeight.length} assessment(s) have no weighting yet, so they can't count. Add them from your subject guide.</p> : null}
      {r.remainingWeight > 0 && Math.abs(r.markedWeight + r.remainingWeight - 100) > 1 ? (
        <p className="muted small">
          The weightings entered add up to {r.markedWeight + r.remainingWeight}%, not 100%. Fill them in from your subject guide to see what you need on the rest.
        </p>
      ) : null}
      {r.remainingWeight > 0 && Math.abs(r.markedWeight + r.remainingWeight - 100) <= 1 ? (
        <p className="needed">
          To finish with:{" "}
          {GRADE_BANDS.filter((b) => b.min > 0).map((b) => {
            const need = neededForTarget(r, b.min);
            if (need === null) return null;
            return (
              <span key={b.letter} className={need > 100 ? "out" : need <= 0 ? "safe" : ""}>
                {b.letter}: {need > 100 ? "out of reach" : need <= 0 ? "secured" : `${Math.ceil(need)}% avg on the remaining ${r.remainingWeight}%`}
              </span>
            );
          })}
        </p>
      ) : null}
    </section>
  );
}

function MarkRow({ assessmentId, title, weight }: { assessmentId: string; title: string; weight: number | null }) {
  const mark = useRealm((s) => s.progress.marks[assessmentId]);
  const [outOf, setOutOf] = useState(mark?.outOf ?? 100);
  return (
    <tr>
      <td>{title}</td>
      <td>
        <NumberInput label={`Weight of ${title}`} value={weight} onCommit={(v) => setWeight(assessmentId, v)} />
      </td>
      <td className="mark-cell">
        <NumberInput label={`Mark for ${title}`} value={mark ? mark.score : null} max={outOf} step={0.5} onCommit={(v) => setMark(assessmentId, v, outOf)} />
        <span> / </span>
        <NumberInput
          label={`Marked out of, for ${title}`}
          value={outOf}
          min={1}
          max={1000}
          onCommit={(v) => {
            const next = v ?? 100;
            setOutOf(next);
            if (mark) setMark(assessmentId, Math.min(mark.score, next), next);
          }}
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Explain it back
// ---------------------------------------------------------------------------

interface Concept {
  key: string;
  name: string;
  reference: string;
}

function conceptsOf(subject: RealmSubject): Concept[] {
  return [
    ...subject.keyTerms.map((t) => ({ key: `term:${t.term}`, name: t.term, reference: t.definition })),
    ...subject.weeks.map((w) => ({ key: `week:${w.week}`, name: `Week ${w.week}: ${w.title}`, reference: [w.summary, w.topics.join(", ")].filter(Boolean).join(". ") })),
  ];
}

export function ExplainWindow({ subject, aiAvailable, initialWeek, onClose }: { subject: RealmSubject; aiAvailable: boolean; initialWeek?: number; onClose: () => void }) {
  const concepts = useMemo(() => conceptsOf(subject), [subject]);
  const [conceptKey, setConceptKey] = useState(() => (initialWeek !== undefined ? `week:${initialWeek}` : concepts[0]?.key ?? ""));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<(ExplainFeedback & { offline: boolean; xp: number }) | null>(null);
  const [error, setError] = useState("");
  const best = useRealm((s) => s.progress.explained[`${subject.id}|${conceptKey}`] ?? null);
  const concept = concepts.find((c) => c.key === conceptKey);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const submit = async () => {
    if (!concept) return;
    setError("");
    setFeedback(null);
    const offline = () => {
      const k = keywordScore(`${concept.name} ${concept.reference}`, text);
      const xp = recordExplanation(subject.id, concept.key, k.score);
      setFeedback({
        offline: true,
        xp,
        score: k.score,
        verdict: "Rough check only: this compares your words with the course's description. It can't judge understanding.",
        got_right: [],
        missing: k.missing.map((w) => `the idea of "${w}"`),
        misconceptions: [],
        tip: concept.reference ? `The course describes it as: ${concept.reference}` : "Check the Codex for this concept.",
      });
    };
    if (!aiAvailable) return offline();
    setBusy(true);
    abort.current = new AbortController();
    try {
      const result = await gradeExplanation({ subjectCode: subject.code, subjectName: subject.name, concept: concept.name, reference: concept.reference, explanation: text }, abort.current.signal);
      const xp = recordExplanation(subject.id, concept.key, result.score);
      setFeedback({ ...result, offline: false, xp });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof CurriculumFetchError && e.failure.kind === "ai-unavailable") offline();
      else setError(e instanceof Error ? e.message : "The tutor couldn't mark that.");
    } finally {
      setBusy(false);
    }
  };

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <Window title={`Explain it back · ${subject.name}`} onClose={onClose} width={680} className="explain-window">
      <p>Explain a concept in your own words, as if teaching a classmate. If you can explain it simply, you understand it.</p>
      <label className="field">
        <span>Concept</span>
        <select value={conceptKey} onChange={(e) => (setConceptKey(e.target.value), setFeedback(null))}>
          {concepts.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={3000} placeholder="In my own words…" aria-label="Your explanation" />
      <div className="row">
        <button type="button" className="rs-button" disabled={busy || words < 8 || !concept} onClick={() => void submit()}>
          {busy ? "Marking…" : "Mark my explanation"}
        </button>
        <span className="muted small">
          {words} words{best !== null ? ` · your best: ${best}/100` : ""}
          {aiAvailable ? "" : " · offline rough check (no AI server)"}
        </span>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {feedback ? (
        <div className="explain-feedback parchment">
          <p className="big">
            {feedback.score}/100 {feedback.xp > 0 ? <span className="small">(+{feedback.xp} XP for beating your best)</span> : null}
          </p>
          {feedback.verdict ? <p>{feedback.verdict}</p> : null}
          {feedback.got_right.length ? (
            <>
              <h4>You got right</h4>
              <ul>{feedback.got_right.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          ) : null}
          {feedback.missing.length ? (
            <>
              <h4>Missing</h4>
              <ul>{feedback.missing.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          ) : null}
          {feedback.misconceptions.length ? (
            <>
              <h4>Not quite right</h4>
              <ul>{feedback.misconceptions.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          ) : null}
          {feedback.tip ? <p className="small">{feedback.tip}</p> : null}
        </div>
      ) : null}
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Add your own questions
// ---------------------------------------------------------------------------

const EXAMPLE = `1. Which status code means "Not Found"?
a) 200
b) 301
c) 404
d) 500
Answer: c
Explanation: 404 means the server found no resource at that URL.`;

export function AddQuestionsWindow({ subject, onClose }: { subject: RealmSubject; onClose: () => void }) {
  const [text, setText] = useState("");
  const [week, setWeek] = useState<number | null>(null);
  const parsed = useMemo(() => parsePastedQuestions(text), [text]);
  const mine = subject.questions.filter((q) => q.id.startsWith(`${subject.id}-u`)).length;

  const add = () => {
    const stamp = Date.now().toString(36);
    const questions = parsed.questions.map((q, i) => ({ ...q, id: `${subject.id}-u${stamp}-${i}`, week }));
    updateSubject(subject.id, (s) => ({ ...s, questions: [...s.questions, ...questions] }));
    chat(`Added ${questions.length} question${questions.length === 1 ? "" : "s"} of your own to ${subject.name}. ${questions.length === 1 ? "It" : "They"} will appear in trials, duels and mock exams.`);
    setText("");
  };

  return (
    <Window title={`Add your questions · ${subject.name}`} onClose={onClose} width={700}>
      <p>
        Paste multiple-choice questions from tutorial sheets or past papers. Each needs four choices (a–d) and the answer, on an "Answer:" line or by marking the right choice with *.
        {mine > 0 ? ` You've added ${mine} so far.` : ""}
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={EXAMPLE} aria-label="Pasted questions" />
      <div className="row">
        <label className="field inline">
          <span>Week</span>
          <select value={week ?? ""} onChange={(e) => setWeek(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Whole subject</option>
            {subject.weeks.map((w) => (
              <option key={w.week} value={w.week}>
                Week {w.week}: {w.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="rs-button" disabled={parsed.questions.length === 0} onClick={add}>
          Add {parsed.questions.length} question{parsed.questions.length === 1 ? "" : "s"}
        </button>
      </div>
      {parsed.skipped.length ? (
        <ul className="skipped">
          {parsed.skipped.map((s, i) => (
            <li key={i} className="small">
              Skipped “{s.text.slice(0, 70)}{s.text.length > 70 ? "…" : ""}”: {s.reason}
            </li>
          ))}
        </ul>
      ) : null}
      {parsed.questions.length ? (
        <ol className="preview-questions">
          {parsed.questions.map((q, i) => (
            <li key={i}>
              {q.prompt} <span className="muted small">Answer: {q.choices[q.answerIndex]}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Window>
  );
}

// ---------------------------------------------------------------------------
// The library: every study tool in one place
// ---------------------------------------------------------------------------

export interface LibraryLinks {
  grimoire: () => void;
  grades: () => void;
  calendar: () => void;
  codex: (subjectId: string) => void;
  mock: (subjectId: string) => void;
  explain: (subjectId: string) => void;
  addQuestions: (subjectId: string) => void;
  textbook: () => void;
  timetable: () => void;
  studyRoom: () => void;
}

export function LibraryWindow({ name, open, onClose }: { name: string; open: LibraryLinks; onClose: () => void }) {
  const state = useRealm((s) => s);
  const subjects = state.curriculum?.subjects ?? [];
  const due = dueCards(state).length;
  const plans = allPlans(state);
  const weakCount = (s: RealmSubject) => weakWeeks(state, s).length;
  return (
    <Window title={name} onClose={onClose} width={720} className="library-window">
      <p className="lede">Quiet halls and long tables. Everything you need to study is shelved here.</p>
      <div className="library-desk">
        <button type="button" className="desk-card" onClick={open.grimoire}>
          <span className="icon">
            <Icon name="book" />
          </span>
          <strong>Grimoire of Mistakes</strong>
          <span className="small">{due > 0 ? `${due} card${due === 1 ? "" : "s"} due today` : "Nothing due today"}</span>
        </button>
        <button type="button" className="desk-card" onClick={open.grades}>
          <span className="icon">
            <Icon name="cap" />
          </span>
          <strong>Grades, WAM &amp; plan</strong>
          <span className="small">{plans.length ? `${plans.length} quest${plans.length === 1 ? "" : "s"} planned` : "Record marks, plan quests"}</span>
        </button>
        <button type="button" className="desk-card" onClick={open.calendar}>
          <span className="icon">
            <Icon name="calendar" />
          </span>
          <strong>Moodle deadlines</strong>
          <span className="small">Import real due dates</span>
        </button>
        <button type="button" className="desk-card" onClick={open.textbook}>
          <span className="icon">
            <Icon name="bookOpen" />
          </span>
          <strong>Enchanted textbook</strong>
          <span className="small">Turn a lecture file into a summary, flashcards and a quiz</span>
        </button>
        <button type="button" className="desk-card" onClick={open.timetable}>
          <span className="icon">
            <Icon name="clock" />
          </span>
          <strong>Class timetable</strong>
          <span className="small">{state.progress.timetable.length ? `${state.progress.timetable.length} weekly classes` : "Import your classes"}</span>
        </button>
        <button type="button" className="desk-card" onClick={open.studyRoom}>
          <span className="icon">
            <Icon name="door" />
          </span>
          <strong>Book a study room</strong>
          <span className="small">Focus with your study group (+XP)</span>
        </button>
      </div>
      <h3 className="section-title">Subjects</h3>
      <div className="library-shelves">
        {subjects.map((s) => (
          <div key={s.id} className="shelf" style={{ ["--accent" as string]: THEME_STYLES[s.theme].accent }}>
            <p className="shelf-title">
              <span className="icon">
                <Icon name={themeIcon(s.theme)} />
              </span>
              <strong>{s.code ? `${s.code} ` : ""}{s.name}</strong>
              {weakCount(s) > 0 ? <span className="weak-tag">
                  <Icon name="warning" /> {weakCount(s)} weak week{weakCount(s) === 1 ? "" : "s"}</span> : null}
            </p>
            <div className="shelf-actions">
              <button type="button" className="rs-button secondary" onClick={() => open.codex(s.id)}>Codex</button>
              <button type="button" className="rs-button secondary" onClick={() => open.mock(s.id)}>Mock exam</button>
              <button type="button" className="rs-button secondary" onClick={() => open.explain(s.id)}>Explain it back</button>
              <button type="button" className="rs-button secondary" onClick={() => open.addQuestions(s.id)}>Add questions</button>
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Hall of Trophies and achievements
// ---------------------------------------------------------------------------

/** The House Cup table: your house's points (from your study) against the other three. */
export function HouseCup() {
  const state = useRealm((s) => s);
  const standings = houseStandings(state);
  const mine = state.player?.house;
  return (
    <section className="house-cup">
      <h3>House Cup</h3>
      {mine ? null : <p className="muted small">Join a house in the wardrobe to compete. Every 10 study XP earns your house a point; every quest point earns five.</p>}
      <ol>
        {standings.map((st) => (
          <li key={st.house.id} className={st.yours ? "yours" : ""} style={{ borderLeftColor: st.house.colours[0] }}>
            <span className="crest" style={{ background: st.house.colours[0], color: st.house.colours[1] }}>
              <Icon name={houseIcon(st.house.id)} />
            </span>
            <b>{st.house.name}</b>
            {st.yours ? <small> (your house)</small> : null}
            <span className="pts">{st.points.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TrophyHallWindow({ onClose, onYearbook }: { onClose: () => void; onYearbook?: () => void }) {
  const state = useRealm((s) => s);
  const subjects = state.curriculum?.subjects ?? [];
  const bosses = Object.entries(state.progress.bosses)
    .map(([id, at]) => {
      for (const s of subjects) {
        const a = s.assessments.find((x) => x.id === id);
        if (a) return { subject: s, assessment: a, at };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const quests = subjects.flatMap((s) => s.assessments.filter((a) => questProgress(state, a).status === "complete").map((a) => ({ subject: s, assessment: a })));
  const unlocked = ACHIEVEMENTS.filter((a) => state.progress.achievements[a.id]);
  const best = state.progress.mockExams.reduce<{ pct: number; subject: string } | null>((b, m) => {
    const pct = Math.round((m.right / Math.max(1, m.total)) * 100);
    return !b || pct > b.pct ? { pct, subject: subjects.find((s) => s.id === m.subjectId)?.name ?? "" } : b;
  }, null);
  return (
    <Window title="Hall of Trophies" onClose={onClose} width={680}>
      <HouseCup />
      {onYearbook ? (
        <button type="button" className="rs-button secondary small" onClick={onYearbook}>
          <Icon name="book" /> Semester yearbook
        </button>
      ) : null}
      <div className="trophy-grid">
        <section>
          <h3>Bosses beaten ({bosses.length})</h3>
          {bosses.length ? (
            <ul>{bosses.map((b) => <li key={b.assessment.id}>{bossName(b.assessment)}. {b.subject.code || b.subject.name}: {b.assessment.title}</li>)}</ul>
          ) : (
            <p className="muted small">None yet. Bosses rise in each subject's lair a week before a deadline.</p>
          )}
        </section>
        <section>
          <h3>Quests completed ({quests.length})</h3>
          {quests.length ? <ul>{quests.map((q) => <li key={q.assessment.id}>{q.subject.code || q.subject.name}: {q.assessment.title}</li>)}</ul> : <p className="muted small">None yet.</p>}
        </section>
        <section>
          <h3>Achievements ({unlocked.length}/{ACHIEVEMENTS.length})</h3>
          {unlocked.length ? <ul>{unlocked.map((a) => <li key={a.id}>{a.name}</li>)}</ul> : <p className="muted small">None yet.</p>}
        </section>
        <section>
          <h3>Records</h3>
          <ul>
            <li>Best study streak: {state.progress.streak.best} day{state.progress.streak.best === 1 ? "" : "s"}</li>
            <li>Focus time: {state.progress.focusMinutes} minutes</li>
            <li>Grimoire questions mastered: {state.progress.counters.mastered ?? 0}</li>
            <li>Best mock exam: {best ? `${best.pct}% (${best.subject})` : "none yet"}</li>
          </ul>
        </section>
      </div>
    </Window>
  );
}

export function AchievementsPanel() {
  const state = useRealm((s) => s);
  const titles = unlockedTitles(state);
  const done = ACHIEVEMENTS.filter((a) => state.progress.achievements[a.id]).length;
  return (
    <div className="rs-achievements">
      <p className="small">
        {done}/{ACHIEVEMENTS.length} earned
      </p>
      <label className="field">
        <span>Title</span>
        <select value={state.progress.title ?? ""} onChange={(e) => setTitle(e.target.value || null)} disabled={titles.length === 0}>
          <option value="">{titles.length ? "No title" : "Earn achievements for titles"}</option>
          {titles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <ul className="achievement-list">
        {ACHIEVEMENTS.map((a) => {
          const at = state.progress.achievements[a.id];
          return (
            <li key={a.id} className={at ? "done" : ""} title={a.description}>
              <span className="icon">
                <Icon name={at ? "trophy" : "lock"} />
              </span>
              <span className="text">
                <strong>{a.name}</strong>
                <span className="small">
                  {a.description}
                  {a.title ? ` Title: “${a.title}”.` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
