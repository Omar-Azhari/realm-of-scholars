/**
 * The study check at a waystone: three of the week's own questions, two right
 * to pass. Passing studies the week (the full study reward); a miss pays
 * nothing and goes to the Grimoire, so the student reads again and retakes it.
 */

import { useState } from "react";
import { emit } from "../state/events";
import { recordMistake } from "../state/grimoire";
import { recordAnswer } from "../state/stats";
import { finishStudyCheck, STUDY_CHECK, studyCheckQuestions } from "../state/studyCheck";
import type { RealmSubject } from "../types";

export function WeekCheck({ subject, week, onDone }: { subject: RealmSubject; week: number; onDone: () => void }) {
  const [questions] = useState(() => studyCheckQuestions(subject, week));
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);

  if (questions.length < STUDY_CHECK.questions) {
    return <p className="muted small">This week needs at least {STUDY_CHECK.questions} questions of its own for a check. Attend its lecture instead.</p>;
  }

  if (result !== null) {
    return (
      <div className="rs-lecture-check">
        <p className="rs-lecture-kicker">{result ? "Week studied" : "Not yet"}</p>
        <p className="small">
          {result
            ? `${right} of ${questions.length} right. The week is studied: tome, study XP and Focus.`
            : `${right} of ${questions.length} right. You need ${STUDY_CHECK.toPass}. Read the week again, then retake the check.`}
        </p>
        <button type="button" className="rs-button" onClick={onDone}>
          {result ? "Done" : "Back to the week"}
        </button>
      </div>
    );
  }

  const q = questions[index];
  const answer = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    const correct = i === q.answerIndex;
    recordAnswer(subject.id, q, correct);
    if (correct) setRight((n) => n + 1);
    else recordMistake(subject.id, q);
    emit({ type: "sound", name: correct ? "coin" : "miss" });
  };
  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setChosen(null);
      return;
    }
    setResult(finishStudyCheck(subject.id, week, right));
  };

  return (
    <div className="rs-lecture-check">
      <p className="rs-lecture-kicker">
        Study check {index + 1} of {questions.length}
      </p>
      <p className="rs-lecture-prompt">{q.prompt}</p>
      <div className="rs-lecture-choices">
        {q.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`rs-button secondary ${chosen !== null && i === q.answerIndex ? "right" : ""} ${chosen === i && i !== q.answerIndex ? "wrong" : ""}`}
            disabled={chosen !== null}
            onClick={() => answer(i)}
          >
            {String.fromCharCode(65 + i)}. {c}
          </button>
        ))}
      </div>
      {chosen !== null ? (
        <>
          <p className="small">
            {chosen === q.answerIndex ? "Correct. " : `The answer is ${String.fromCharCode(65 + q.answerIndex)}. `}
            {q.explanation}
          </p>
          <button type="button" className="rs-button" onClick={next}>
            {index + 1 < questions.length ? "Next question" : "Finish the check"}
          </button>
        </>
      ) : null}
    </div>
  );
}
