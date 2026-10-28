/**
 * Buzzer duel UI: the same question for you and a rival, in real time.
 */

import { Difficulty } from "../minigames/QuizDuel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildQuestionPool } from "../curriculum/questionBank";
import { emit } from "../state/events";
import { useRealm } from "../state/store";
import { applyBuzz, buzzerOutcome, buzzerRoundPoints, BUZZER_MAX_ROUNDS, BUZZER_ROUND_MS, BUZZER_TARGET, NEW_ROUND, planRivalBuzz, timeUp, type RoundState } from "./buzzer";
import { arenaAnswer, finishArenaMatch, type MatchReport } from "./record";
import { shuffleChoices } from "./rng";
import { formatSeconds, isControl, MatchHeader, MatchResult, NotEnough, useForfeit, useNow, type ArenaGameProps } from "./ArenaShared";
import type { MatchOutcome } from "./rating";
import { Icon } from "../hud/icons";

type Phase = "ready" | "live" | "reveal" | "done";

export function BuzzerDuel({ subject, rival, onBack, onAgain }: ArenaGameProps) {
  const playerName = useRealm((s) => s.player?.name ?? "You");
  const [questions] = useState(() => buildQuestionPool(subject, null).slice(0, BUZZER_MAX_ROUNDS).map((q) => shuffleChoices(q, Math.random)));
  const [seed] = useState(() => `${Date.now()}-${Math.random()}`);
  const maxRounds = questions.length;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState<RoundState>(NEW_ROUND);
  const [startedAt, setStartedAt] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [pickMs, setPickMs] = useState(0);
  const [rivalActed, setRivalActed] = useState(false);
  const [score, setScore] = useState({ you: 0, rival: 0, points: 0 });
  const [streak, setStreak] = useState(0);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [started, setStarted] = useState(false);

  const question = questions[index];
  const plan = useMemo(() => (question ? planRivalBuzz(rival.rating, question, `${seed}|${index}`) : null), [question, rival.rating, seed, index]);
  const now = useNow(phase === "live", 50);
  const elapsed = phase === "live" ? now - startedAt : 0;

  useForfeit(started && !report, () => {
    finishArenaMatch({ game: "buzzer", subjectId: subject.id, rival, outcome: "loss", score: 0 });
  });

  // "Get ready" pause, then the question goes live.
  useEffect(() => {
    if (phase !== "ready" || !question) return;
    const id = window.setTimeout(() => {
      setStartedAt(Date.now());
      setPhase("live");
      setStarted(true);
      emit({ type: "sound", name: "click" });
    }, 1300);
    return () => window.clearTimeout(id);
  }, [phase, question]);

  // The rival buzzes when its time comes; the clock closes the round.
  useEffect(() => {
    if (phase !== "live" || !plan) return;
    if (!rivalActed && round.open && !round.rivalLocked && elapsed >= plan.atMs) {
      setRivalActed(true);
      setRound((r) => applyBuzz(r, "rival", plan.correct));
      if (!plan.correct) emit({ type: "sound", name: "miss" });
    } else if (round.open && elapsed >= BUZZER_ROUND_MS) {
      setRound((r) => timeUp(r));
    }
  }, [phase, plan, rivalActed, round, elapsed]);

  // Round over: score it, and settle the match if it's decided.
  useEffect(() => {
    if (phase !== "live" || round.open) return;
    const you = score.you + (round.winner === "player" ? 1 : 0);
    const them = score.rival + (round.winner === "rival" ? 1 : 0);
    const points = score.points + (round.winner === "player" ? buzzerRoundPoints(pickMs) : 0);
    setScore({ you, rival: them, points });
    setStreak((s) => (round.winner === "player" ? s + 1 : 0));
    emit({ type: "sound", name: round.winner === "player" ? "hit" : round.winner === "rival" ? "miss" : "click" });
    setPhase("reveal");
    const result = buzzerOutcome(you, them, index + 1, maxRounds);
    if (result) {
      setOutcome(result);
      setReport(finishArenaMatch({ game: "buzzer", subjectId: subject.id, rival, outcome: result, score: points }));
    }
  }, [phase, round, score, pickMs, index, maxRounds, subject.id, rival]);

  const answer = useCallback(
    (choice: number) => {
      if (phase !== "live" || !question || !round.open || round.playerLocked) return;
      const correct = choice === question.answerIndex;
      arenaAnswer(subject.id, question, correct);
      setPick(choice);
      setPickMs(Date.now() - startedAt);
      setRound((r) => applyBuzz(r, "player", correct));
      if (!correct) emit({ type: "sound", name: "miss" });
    },
    [phase, question, round, subject.id, startedAt],
  );

  const next = useCallback(() => {
    if (phase !== "reveal") return;
    if (outcome) {
      setShowResult(true);
      setPhase("done");
      return;
    }
    setIndex((i) => i + 1);
    setRound(NEW_ROUND);
    setPick(null);
    setRivalActed(false);
    setPhase("ready");
  }, [phase, outcome]);

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (/^[1-4]$/.test(e.key)) answer(Number(e.key) - 1);
      else if ((e.key === "Enter" || e.key === " ") && !isControl(e.target)) {
        e.preventDefault();
        next();
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (questions.length < 5) {
    return <NotEnough onBack={onBack}>A buzzer duel needs at least five questions for {subject.name}. Add your own questions in the Codex, or study more weeks.</NotEnough>;
  }

  if (showResult && outcome) {
    return (
      <MatchResult report={report} outcome={outcome} rival={rival} yourScore={score.you} rivalScore={score.rival} onAgain={onAgain} onBack={onBack}>
        <p className="muted small">Score {score.points} (100 a round, plus up to 100 for a fast buzz).</p>
      </MatchResult>
    );
  }

  const rivalState = !plan ? "" : rivalActed ? (plan.correct ? "buzzed: correct" : "buzzed: wrong, locked out") : phase === "live" ? "thinking…" : "";
  const thinking = plan && phase === "live" && !rivalActed ? Math.min(1, elapsed / plan.atMs) : rivalActed ? 1 : 0;
  const timeLeft = BUZZER_ROUND_MS - elapsed;

  return (
    <div className="arena-game arena-buzzer">
      <MatchHeader
        you={playerName}
        rival={rival}
        yourScore={<Pips n={score.you} />}
        rivalScore={<Pips n={score.rival} />}
        middle={
          <span className="round">
            Round {index + 1}
            {streak >= 2 ? <span className="arena-combo">
                <Icon name="flame" /> ×{streak}
              </span> : null}
          </span>
        }
      />
      <div className={`arena-rival-mind ${rivalActed ? (plan?.correct ? "right" : "wrong") : ""}`}>
        <span className="name">{rival.name}</span>
        <div className="arena-bar thinking">
          <span style={{ width: `${thinking * 100}%` }} />
        </div>
        <span className="state">{rivalState}</span>
      </div>
      {phase === "ready" ? (
        <div className="arena-ready">
          <p className="big">Round {index + 1}</p>
          <p className="muted">First correct answer wins the point. A wrong answer locks you out.</p>
        </div>
      ) : question ? (
        <div className="arena-question">
          <div className="arena-clock">
            <div className="arena-bar time">
              <span style={{ width: `${phase === "live" ? Math.max(0, timeLeft / BUZZER_ROUND_MS) * 100 : 0}%` }} />
            </div>
            <span className="t">{phase === "live" ? formatSeconds(timeLeft) : ""}</span>
          </div>
          <p className="muted small">
            {question.week ? `Week ${question.week} · ` : ""}
            <Difficulty level={question.difficulty ?? 2} />
          </p>
          <p className="prompt">{question.prompt}</p>
          <div className="arena-choices">
            {question.choices.map((c, i) => {
              const reveal = phase === "reveal";
              const cls = [
                "arena-choice",
                reveal && i === question.answerIndex ? "right" : "",
                pick === i && i !== question.answerIndex ? "wrong" : "",
                rivalActed && plan && !plan.correct && plan.choice === i ? "rival-wrong" : "",
                reveal && rivalActed && plan?.correct && i === plan.choice ? "rival-pick" : "",
              ].join(" ");
              return (
                <button key={i} type="button" className={cls} onClick={() => answer(i)} disabled={phase !== "live" || round.playerLocked || !round.open}>
                  <span className="key">{i + 1}</span>
                  <span>{c}</span>
                  {rivalActed && plan && plan.choice === i ? <span className="tag">{rival.name.split(" ")[0]}</span> : null}
                </button>
              );
            })}
          </div>
          {round.playerLocked && round.open ? <p className="arena-note bad">Locked out. Waiting for {rival.name.split(" ")[0]}…</p> : null}
          {phase === "reveal" ? (
            <div className="arena-reveal">
              <p className={`verdict ${round.winner ?? "none"}`}>
                {round.winner === "player" ? `Point to you (${formatSeconds(pickMs)}).` : round.winner === "rival" ? `${rival.name} takes the point.` : "No one scores."}
              </p>
              <p className="explain">{question.explanation}</p>
              <button type="button" className="rs-button" onClick={next} autoFocus>
                {outcome ? "See the result" : `Next round (first to ${BUZZER_TARGET})`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Pips({ n }: { n: number }) {
  return (
    <span className="arena-pips" aria-label={`${n} points`}>
      {Array.from({ length: BUZZER_TARGET }, (_, i) => (
        <span key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}
