/**
 * Sequence UI: put each process's steps in order, three rounds, against the clock.
 */

import { useMemo, useState } from "react";
import { emit } from "../state/events";
import { useRealm } from "../state/store";
import { pairAccuracy, rivalSequence, sequenceMatchScore, sequencePuzzles, sequenceRoundScore, type SequencePuzzle } from "./sequence";
import { arenaWeekResult, finishArenaMatch, type MatchReport } from "./record";
import { shuffleWith } from "./rng";
import { compareScores, formatSeconds, MatchHeader, MatchResult, NotEnough, useForfeit, useNow, type ArenaGameProps } from "./ArenaShared";
import type { MatchOutcome } from "./rating";
import { Icon } from "../hud/icons";

function deal(p: SequencePuzzle): { placed: string[]; pool: string[] } {
  const placed = p.fixedFirst ? [p.steps[0]] : [];
  const rest = p.steps.filter((s) => !placed.includes(s));
  let pool = shuffleWith(rest, Math.random);
  // Never deal the answer already in order.
  for (let i = 0; i < 5 && pool.join("|") === rest.join("|"); i++) pool = shuffleWith(rest, Math.random);
  return { placed, pool };
}

export function SequenceGame({ subject, rival, onBack, onAgain }: ArenaGameProps) {
  const playerName = useRealm((s) => s.player?.name ?? "You");
  const [puzzles] = useState(() => sequencePuzzles(subject, Math.random));
  const [seed] = useState(() => `${Date.now()}-${Math.random()}`);
  const rivalRun = useMemo(() => rivalSequence(rival.rating, Math.max(1, puzzles.length), seed), [rival.rating, puzzles.length, seed]);
  const [round, setRound] = useState(0);
  const [hand, setHand] = useState(() => (puzzles[0] ? deal(puzzles[0]) : { placed: [], pool: [] }));
  const [checked, setChecked] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [spent, setSpent] = useState(0);
  const [roundStart, setRoundStart] = useState(() => Date.now());
  const [started, setStarted] = useState(false);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const now = useNow(!checked && !report, 250);
  const elapsed = spent + (checked || report ? 0 : now - roundStart);

  useForfeit(started && !report, () => {
    finishArenaMatch({ game: "sequence", subjectId: subject.id, rival, outcome: "loss", score: 0 });
  });

  const puzzle = puzzles[round];
  if (!puzzle) {
    return <NotEnough onBack={onBack}>Sequence needs at least four weekly topics for {subject.name} (or lecture diagrams). Add topics in the Codex.</NotEnough>;
  }

  const fixed = puzzle.fixedFirst ? 1 : 0;
  const place = (step: string) => {
    if (checked) return;
    setStarted(true);
    setHand((h) => ({ placed: [...h.placed, step], pool: h.pool.filter((s) => s !== step) }));
    emit({ type: "sound", name: "click" });
  };
  const unplace = (i: number) => {
    if (checked || i < fixed) return;
    setHand((h) => ({ placed: h.placed.filter((_, j) => j !== i), pool: [...h.pool, h.placed[i]] }));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (checked || i < fixed || j < fixed || j >= hand.placed.length) return;
    setHand((h) => {
      const placed = h.placed.slice();
      [placed[i], placed[j]] = [placed[j], placed[i]];
      return { ...h, placed };
    });
  };

  const submit = () => {
    if (hand.pool.length > 0 || checked) return;
    const s = sequenceRoundScore(hand.placed, puzzle.steps);
    const perfect = s >= 300;
    setChecked(true);
    setSpent((x) => x + (Date.now() - roundStart));
    setScores((list) => [...list, s]);
    if (puzzle.week !== null) arenaWeekResult(subject.id, puzzle.week, perfect);
    emit({ type: "sound", name: perfect ? "hit" : "miss" });
  };

  const next = () => {
    if (!checked) return;
    if (round + 1 < puzzles.length) {
      setRound(round + 1);
      setHand(deal(puzzles[round + 1]));
      setChecked(false);
      setRoundStart(Date.now());
      return;
    }
    const total = sequenceMatchScore(scores, spent / 1000);
    const result = compareScores(total, rivalRun.score);
    setOutcome(result);
    setReport(finishArenaMatch({ game: "sequence", subjectId: subject.id, rival, outcome: result, score: total }));
  };

  if (report && outcome) {
    return (
      <MatchResult report={report} outcome={outcome} rival={rival} yourScore={sequenceMatchScore(scores, spent / 1000)} rivalScore={rivalRun.score} onAgain={onAgain} onBack={onBack}>
        <p className="muted small">
          {scores.filter((s) => s >= 300).length}/{puzzles.length} perfect in {formatSeconds(spent)} (speed bonus up to 150). {rival.name} took {formatSeconds(rivalRun.seconds * 1000)}.
        </p>
      </MatchResult>
    );
  }

  const total = scores.reduce((a, b) => a + b, 0);
  const accuracy = checked ? pairAccuracy(hand.placed, puzzle.steps) : 0;
  return (
    <div className="arena-game arena-sequence">
      <MatchHeader
        you={playerName}
        rival={rival}
        yourScore={total.toLocaleString()}
        rivalScore="?"
        middle={
          <span className="arena-timer">
            {round + 1}/{puzzles.length} · {formatSeconds(elapsed)}
          </span>
        }
      />
      <p className="seq-title">{puzzle.title}</p>
      <p className="muted small">
        {puzzle.source}
        {puzzle.fixedFirst ? " · a cycle: the first step is given" : ""}
      </p>
      <ol className="seq-answer">
        {hand.placed.map((step, i) => {
          const state = checked ? (puzzle.steps[i] === step ? "right" : "wrong") : i < fixed ? "fixed" : "";
          return (
            <li key={step} className={`seq-item ${state}`}>
              <span className="n">{i + 1}</span>
              <button type="button" className="seq-text" onClick={() => unplace(i)} disabled={checked || i < fixed} title={i < fixed ? "Given" : "Send back"}>
                {step}
              </button>
              {!checked && i >= fixed ? (
                <span className="seq-move">
                  <button type="button" onClick={() => move(i, -1)} disabled={i <= fixed} aria-label="Move up">
                    <Icon name="chevronUp" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i >= hand.placed.length - 1} aria-label="Move down">
                    <Icon name="chevronDown" />
                  </button>
                </span>
              ) : null}
              {checked && puzzle.steps[i] !== step ? <span className="seq-should">Should be: {puzzle.steps[i]}</span> : null}
            </li>
          );
        })}
        {Array.from({ length: hand.pool.length }, (_, i) => (
          <li key={`empty-${i}`} className="seq-item empty">
            <span className="n">{hand.placed.length + i + 1}</span>
            <span className="seq-text muted">…</span>
          </li>
        ))}
      </ol>
      {!checked ? (
        <>
          <div className="seq-pool">
            {hand.pool.map((step) => (
              <button key={step} type="button" className="seq-chip" onClick={() => place(step)}>
                {step}
              </button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="rs-button" onClick={submit} disabled={hand.pool.length > 0}>
              Lock in order
            </button>
            <span className="muted small">Click steps in order; click a placed step to send it back.</span>
          </div>
        </>
      ) : (
        <div className="arena-reveal">
          <p className={`verdict ${accuracy === 1 ? "player" : "none"}`}>
            {accuracy === 1 ? "Perfect order. +300" : `${Math.round(accuracy * 100)}% of pairs in order: +${scores[scores.length - 1]}`}
          </p>
          <button type="button" className="rs-button" onClick={next} autoFocus>
            {round + 1 < puzzles.length ? "Next process" : "Finish"}
          </button>
        </div>
      )}
    </div>
  );
}
