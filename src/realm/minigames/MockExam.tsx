/**
 * Timed mock exam: a full practice paper under a real time limit, with no
 * feedback until you submit — like the real thing. Afterwards: score,
 * a mock grade band, a per-week breakdown showing weak weeks, and every
 * miss goes into the Grimoire of Mistakes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Window } from "../hud/Window";
import { buildQuestionPool, shuffle } from "../curriculum/questionBank";
import { grantXp, markStudyDay } from "../state/actions";
import { recordMistake } from "../state/grimoire";
import { recordAnswer } from "../state/stats";
import { gradeFor } from "../state/grades";
import { gainFocus } from "../state/focus";
import { FOCUS } from "../life/catalog";
import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import type { RealmQuestion, RealmSubject } from "../types";
import { Icon } from "../hud/icons";

export const MOCK_XP_PER_CORRECT = 12;
const LENGTHS = [
  { questions: 20, minutes: 30 },
  { questions: 40, minutes: 60 },
  { questions: 60, minutes: 120 },
];

interface Paper {
  questions: RealmQuestion[];
  minutes: number;
  startedAt: number;
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export function MockExam({ subject, onClose }: { subject: RealmSubject; onClose: () => void }) {
  const pool = useMemo(() => buildQuestionPool(subject, null), [subject]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [flags, setFlags] = useState<boolean[]>([]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);
  const submitted = useRef(false);

  const remaining = paper ? paper.startedAt + paper.minutes * 60_000 - now : 0;

  useEffect(() => {
    if (!paper || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [paper, done]);

  const submit = () => {
    if (!paper || submitted.current) return;
    submitted.current = true;
    let right = 0;
    paper.questions.forEach((q, i) => {
      const correct = answers[i] === q.answerIndex;
      if (correct) right++;
      recordAnswer(subject.id, q, correct);
      if (!correct) recordMistake(subject.id, q);
    });
    const minutes = Math.max(1, Math.round((Date.now() - paper.startedAt) / 60_000));
    realmStore.set((s) => ({
      ...s,
      progress: { ...s.progress, mockExams: [...s.progress.mockExams, { subjectId: subject.id, at: new Date().toISOString(), right, total: paper.questions.length, minutes }].slice(-30) },
    }));
    emit({ type: "sound", name: right / paper.questions.length >= 0.5 ? "victory" : "defeat" });
    chat(`Mock exam submitted: ${right}/${paper.questions.length} (${Math.round((right / paper.questions.length) * 100)}%) in ${minutes} min.`, "quest");
    if (right > 0) {
      grantXp(subject.id, right * MOCK_XP_PER_CORRECT);
      gainFocus(right * FOCUS.earn.mockCorrect, "a mock exam");
    }
    if (answers.filter((a) => a !== null).length >= 10) markStudyDay();
    setDone(true);
  };

  useEffect(() => {
    if (paper && !done && remaining <= 0) submit();
  });

  const close = () => {
    if (paper && !done && !window.confirm("Leave the mock exam? Your answers so far won't be marked.")) return;
    onClose();
  };

  if (pool.length < 10) {
    return (
      <Window title="Mock exam" onClose={onClose}>
        <p>This subject needs at least 10 practice questions for a mock exam. Upload lecture slides at the waystones, or add your tutorial questions in the Codex.</p>
      </Window>
    );
  }

  if (!paper) {
    return (
      <Window title={`Mock exam · ${subject.name}`} onClose={onClose} width={560}>
        <p>A practice paper under real exam conditions: a timer, no hints and no answers until you submit. It covers every week, harder questions first.</p>
        <div className="mock-lengths">
          {LENGTHS.filter((l, i) => i === 0 || Math.min(LENGTHS[i - 1].questions, pool.length) < Math.min(l.questions, pool.length)).map((l) => {
            const count = Math.min(l.questions, pool.length);
            return (
              <button
                key={l.questions}
                type="button"
                className="rs-button"
                onClick={() => {
                  const questions = shuffle(pool.slice(0, Math.max(count, Math.min(pool.length, count * 2)))).slice(0, count);
                  setPaper({ questions, minutes: Math.max(10, Math.round((l.minutes * count) / l.questions)), startedAt: Date.now() });
                  setAnswers(questions.map(() => null));
                  setFlags(questions.map(() => false));
                  setNow(Date.now());
                }}
              >
                {count} questions · {Math.max(10, Math.round((l.minutes * count) / l.questions))} min
              </button>
            );
          })}
        </div>
        <p className="muted small">Check your subject guide for the real exam's length and format. Every question you miss goes into your Grimoire.</p>
      </Window>
    );
  }

  if (done) {
    const right = paper.questions.filter((q, i) => answers[i] === q.answerIndex).length;
    const pct = Math.round((right / paper.questions.length) * 100);
    const band = gradeFor(pct);
    const byWeek = new Map<string, { right: number; total: number }>();
    paper.questions.forEach((q, i) => {
      const key = q.week ? `Week ${q.week}` : "Whole subject";
      const row = byWeek.get(key) ?? { right: 0, total: 0 };
      row.total++;
      if (answers[i] === q.answerIndex) row.right++;
      byWeek.set(key, row);
    });
    const rows = [...byWeek.entries()].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);
    return (
      <Window title="Mock exam results" onClose={onClose} width={680}>
        <div className="mock-score">
          <p className="big">
            {right} / {paper.questions.length} · {pct}%
          </p>
          <p>
            On La Trobe's scale that would be {band.letter === "A" || band.letter === "N" ? "an" : "a"} <strong>{band.letter}</strong> ({band.label}). +{right * MOCK_XP_PER_CORRECT} XP.
          </p>
        </div>
        <h3>By week (weakest first)</h3>
        <ul className="mock-weeks">
          {rows.map(([week, r]) => (
            <li key={week} className={r.right / r.total < 0.6 ? "weak" : ""}>
              <span>{week}</span>
              <span className="bar">
                <span style={{ width: `${(r.right / r.total) * 100}%` }} />
              </span>
              <span>
                {r.right}/{r.total}
              </span>
            </li>
          ))}
        </ul>
        <h3>Questions you missed</h3>
        <ol className="mock-review">
          {paper.questions.map((q, i) =>
            answers[i] === q.answerIndex ? null : (
              <li key={q.id}>
                <p>{q.prompt}</p>
                <p className="small">
                  {answers[i] === null ? "Not answered." : `You chose: ${q.choices[answers[i]!]}.`} <strong>Answer: {q.choices[q.answerIndex]}.</strong> {q.explanation}
                </p>
              </li>
            ),
          )}
        </ol>
        <button type="button" className="rs-button" onClick={onClose}>
          Close
        </button>
      </Window>
    );
  }

  const q = paper.questions[index];
  const answered = answers.filter((a) => a !== null).length;
  return (
    <Window title={`Mock exam · ${subject.name}`} onClose={close} width={720} className="mock-exam">
      <div className="mock-bar">
        <span className={`timer ${remaining < 5 * 60_000 ? "low" : ""}`}>
          <Icon name="hourglass" /> {formatTime(remaining)}
        </span>
        <span>
          Question {index + 1} of {paper.questions.length} · {answered} answered
        </span>
      </div>
      <div className="mock-nav" aria-label="Questions">
        {paper.questions.map((_, i) => (
          <button key={i} type="button" className={`${i === index ? "on" : ""} ${answers[i] !== null ? "answered" : ""} ${flags[i] ? "flagged" : ""}`} onClick={() => setIndex(i)}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="duel-question">
        <p className="prompt">{q.prompt}</p>
        <div className="choices">
          {q.choices.map((choice, i) => (
            <button key={i} type="button" className={`choice ${answers[index] === i ? "selected" : ""}`} onClick={() => setAnswers((a) => a.map((v, j) => (j === index ? i : v)))}>
              <span className="key">{String.fromCharCode(65 + i)}</span> {choice}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button type="button" className="rs-button secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <Icon name="chevronLeft" /> Previous
        </button>
        <button type="button" className="rs-button secondary" onClick={() => setFlags((f) => f.map((v, j) => (j === index ? !v : v)))}>
          {flags[index] ? "Unflag" : "Flag for review"}
        </button>
        {index + 1 < paper.questions.length ? (
          <button type="button" className="rs-button" onClick={() => setIndex((i) => i + 1)}>
            Next <Icon name="chevronRight" />
          </button>
        ) : null}
        <button
          type="button"
          className="rs-button danger"
          onClick={() => {
            if (answered < paper.questions.length && !window.confirm(`${paper.questions.length - answered} question(s) unanswered. Submit anyway?`)) return;
            submit();
          }}
        >
          Submit paper
        </button>
      </div>
    </Window>
  );
}
