/**
 * Subject workshops: Bug Hunt (web development), Spot the Flaw (UI design),
 * Critical Path (project management) and Ethics Tribunal (professional
 * practice). Five rounds; four right wins. Wins count toward XP like the
 * other study games (with the same daily diminishing returns).
 */

import { useMemo, useState } from "react";
import { Window } from "../hud/Window";
import { ACS_VALUES, BUG_HUNT, ETHICS, USABILITY } from "../curriculum/banks/workshopBanks";
import { makePathPuzzle, WORKSHOP_INFO, type WorkshopKind } from "../curriculum/workshop";
import { shuffle } from "../curriculum/questionBank";
import { recordMinigameWin } from "../state/actions";
import { bumpCounter, recordAnswer } from "../state/stats";
import { emit } from "../state/events";
import type { RealmSubject } from "../types";

const ROUNDS = 5;
const TO_WIN = 4;
export const WORKSHOP_XP = 160;

interface Round {
  render: (picked: number | null, pick: (i: number) => void) => JSX.Element;
  answer: number;
  explanation: string;
}

function bugRound(i: number): Round {
  const item = BUG_HUNT[i];
  return {
    answer: item.bugLine,
    explanation: `${item.explanation} Fix: ${item.fix}`,
    render: (picked, pick) => (
      <div>
        <p className="prompt">
          {item.title} <span className="muted small">({item.language})</span>. Click the line with the bug.
        </p>
        <pre className="bug-code">
          {item.lines.map((line, n) => (
            <button
              key={n}
              type="button"
              className={`code-line ${picked === null ? "" : n === item.bugLine ? "right" : n === picked ? "wrong" : ""}`}
              disabled={picked !== null}
              onClick={() => pick(n)}
            >
              <span className="ln">{n + 1}</span>
              <code>{line}</code>
            </button>
          ))}
        </pre>
      </div>
    ),
  };
}

function usabilityRound(i: number): Round {
  const item = USABILITY[i];
  return {
    answer: item.flaw,
    explanation: `Breaks "${item.heuristic}". ${item.explanation}`,
    render: (picked, pick) => (
      <div>
        <p className="prompt">{item.screen}: which part breaks a usability heuristic?</p>
        <div className="mock-screen">
          {item.elements.map((el, n) => (
            <button key={n} type="button" className={`ui-element ${picked === null ? "" : n === item.flaw ? "right" : n === picked ? "wrong" : ""}`} disabled={picked !== null} onClick={() => pick(n)}>
              <strong>{el.label}</strong>
              <span>{el.detail}</span>
            </button>
          ))}
        </div>
      </div>
    ),
  };
}

function choiceRound(prompt: JSX.Element, choices: string[], answer: number, explanation: string): Round {
  return {
    answer,
    explanation,
    render: (picked, pick) => (
      <div>
        {prompt}
        <div className="choices">
          {choices.map((c, n) => (
            <button key={n} type="button" className={`choice ${picked === null ? "" : n === answer ? "right" : n === picked ? "wrong" : "dim"}`} disabled={picked !== null} onClick={() => pick(n)}>
              <span className="key">{n + 1}</span> {c}
            </button>
          ))}
        </div>
      </div>
    ),
  };
}

function ethicsRound(i: number): Round {
  const item = ETHICS[i];
  const options = shuffle([item.value, ...item.others]);
  return choiceRound(
    <p className="prompt">
      {item.scenario}
      <br />
      <span className="muted small">Which ACS Code of Professional Conduct value is most at stake?</span>
    </p>,
    options.map((v) => ACS_VALUES[v]),
    options.indexOf(item.value),
    item.explanation,
  );
}

function pathRound(seed: number): Round {
  const puzzle = makePathPuzzle(seed);
  return choiceRound(
    <div>
      <table className="path-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Duration</th>
            <th>Depends on</th>
          </tr>
        </thead>
        <tbody>
          {puzzle.tasks.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>
                {t.duration} day{t.duration === 1 ? "" : "s"}
              </td>
              <td>{t.after.length ? t.after.join(", ") : "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="prompt">{puzzle.prompt}</p>
    </div>,
    puzzle.choices,
    puzzle.answerIndex,
    puzzle.explanation,
  );
}

function makeRounds(kind: WorkshopKind): Round[] {
  if (kind === "critical-path") return Array.from({ length: ROUNDS }, () => pathRound(Math.floor(Math.random() * 1e9)));
  const size = kind === "bug-hunt" ? BUG_HUNT.length : kind === "usability" ? USABILITY.length : ETHICS.length;
  const picks = shuffle(Array.from({ length: size }, (_, i) => i)).slice(0, ROUNDS);
  return picks.map((i) => (kind === "bug-hunt" ? bugRound(i) : kind === "usability" ? usabilityRound(i) : ethicsRound(i)));
}

export function Workshop({ subject, kind, onClose }: { subject: RealmSubject; kind: WorkshopKind; onClose: () => void }) {
  const rounds = useMemo(() => makeRounds(kind), [kind]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ won: boolean; xp: number } | null>(null);
  const info = WORKSHOP_INFO[kind];
  const round = rounds[index];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const right = i === round.answer;
    recordAnswer(subject.id, { week: null }, right);
    if (right) setScore((s) => s + 1);
    emit({ type: "sound", name: right ? "hit" : "miss" });
  };

  const next = () => {
    if (index + 1 < rounds.length) {
      setIndex((i) => i + 1);
      setPicked(null);
      return;
    }
    const won = score >= TO_WIN;
    let xp = 0;
    if (won) {
      bumpCounter("workshopWins");
      xp = recordMinigameWin(subject.id, WORKSHOP_XP + score * 20, null, info.name);
      emit({ type: "sound", name: "victory" });
    } else emit({ type: "sound", name: "defeat" });
    setResult({ won, xp });
  };

  return (
    <Window title={`${info.name} · ${subject.name}`} onClose={onClose} width={720} className="workshop">
      {result ? (
        <div className={`duel-result ${result.won ? "won" : "lost"}`}>
          <p className="big">{result.won ? "Well done" : "Not this time"}</p>
          <p>
            {score} of {rounds.length} right{result.won ? `. +${result.xp} ${subject.name} XP.` : `. You need ${TO_WIN} to win.`}
          </p>
          <button type="button" className="rs-button" onClick={onClose}>
            Leave the workshop
          </button>
        </div>
      ) : (
        <>
          <p className="muted small">
            Round {index + 1} of {rounds.length} · {score} right · {info.blurb}
          </p>
          <div className="duel-question">{round.render(picked, pick)}</div>
          {picked !== null ? (
            <div className="explain">
              <p>
                <strong>{picked === round.answer ? "Correct. " : "Not quite. "}</strong>
                {round.explanation}
              </p>
              <button type="button" className="rs-button" onClick={next}>
                {index + 1 < rounds.length ? "Next round" : "Finish"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </Window>
  );
}
