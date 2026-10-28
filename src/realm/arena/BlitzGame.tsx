/**
 * Blitz UI: a minute of rapid-fire questions against a rival's live score.
 */

import { Difficulty } from "../minigames/QuizDuel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildQuestionPool } from "../curriculum/questionBank";
import { emit } from "../state/events";
import { useRealm } from "../state/store";
import type { RealmQuestion } from "../types";
import { blitzMultiplier, blitzPoints, BLITZ_MS, BLITZ_WRONG_PENALTY_MS, pickBlitzQuestion, scoreAt, simulateBlitz, speedBonus } from "./blitz";
import { arenaAnswer, finishArenaMatch, type MatchReport } from "./record";
import { shuffleChoices } from "./rng";
import { compareScores, formatSeconds, MatchHeader, MatchResult, NotEnough, useForfeit, useNow, type ArenaGameProps } from "./ArenaShared";
import type { MatchOutcome } from "./rating";

type Phase = "intro" | "countdown" | "live" | "done";

interface Flash {
  correct: boolean;
  text: string;
}

export function BlitzGame({ subject, rival, onBack, onAgain }: ArenaGameProps) {
  const playerName = useRealm((s) => s.player?.name ?? "You");
  const [pool] = useState(() => {
    const seen = new Set<string>();
    return buildQuestionPool(subject, null).filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  });
  const [seed] = useState(() => `${Date.now()}-${Math.random()}`);
  const ghost = useMemo(() => simulateBlitz(rival.rating, seed), [rival.rating, seed]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdownAt, setCountdownAt] = useState(0);
  const [liveAt, setLiveAt] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [question, setQuestion] = useState<RealmQuestion | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<RealmQuestion[]>([]);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const used = useRef(new Set<string>());
  const scoreRef = useRef(0);

  const now = useNow(phase === "countdown" || phase === "live", 100);
  const timeLeft = phase === "live" ? deadline - now : BLITZ_MS;
  const rivalNow = phase === "live" ? scoreAt(ghost.events, Math.min(BLITZ_MS, now - liveAt)) : phase === "done" ? ghost.score : 0;

  useForfeit(phase === "live" && !report, () => {
    finishArenaMatch({ game: "blitz", subjectId: subject.id, rival, outcome: "loss", score: 0 });
  });

  const nextQuestion = useCallback(
    (streakNow: number) => {
      const q = pickBlitzQuestion(pool, streakNow, used.current, Math.random);
      if (!q) return;
      used.current.add(q.id);
      setQuestion(shuffleChoices(q, Math.random));
      setPicked(null);
      setFlash(null);
      setShownAt(Date.now());
    },
    [pool],
  );

  // 3-2-1, then go.
  useEffect(() => {
    if (phase === "countdown" && now - countdownAt >= 3000) {
      const t = Date.now();
      setLiveAt(t);
      setDeadline(t + BLITZ_MS);
      setPhase("live");
      emit({ type: "sound", name: "spell" });
      nextQuestion(0);
    }
  }, [phase, now, countdownAt, nextQuestion]);

  // Time's up.
  useEffect(() => {
    if (phase !== "live" || timeLeft > 0) return;
    setPhase("done");
    const result = compareScores(scoreRef.current, ghost.score);
    setOutcome(result);
    setReport(finishArenaMatch({ game: "blitz", subjectId: subject.id, rival, outcome: result, score: scoreRef.current }));
  }, [phase, timeLeft, ghost.score, subject.id, rival]);

  const answer = useCallback(
    (choice: number) => {
      if (phase !== "live" || !question || picked !== null) return;
      const correct = choice === question.answerIndex;
      const ms = Date.now() - shownAt;
      const points = blitzPoints(correct, streak, ms);
      arenaAnswer(subject.id, question, correct);
      setPicked(choice);
      setAnswered((n) => n + 1);
      const nextStreak = correct ? streak + 1 : 0;
      if (correct) {
        scoreRef.current += points;
        setScore(scoreRef.current);
        setRight((n) => n + 1);
        setBestStreak((b) => Math.max(b, nextStreak));
        const bonus = speedBonus(ms);
        setFlash({ correct: true, text: `+${points}${blitzMultiplier(streak) > 1 ? ` (×${blitzMultiplier(streak)})` : ""}${bonus >= 40 ? " · fast" : ""}` });
        emit({ type: "sound", name: blitzMultiplier(nextStreak) > blitzMultiplier(streak) ? "spell" : "hit" });
      } else {
        setDeadline((d) => d - BLITZ_WRONG_PENALTY_MS);
        setMissed((m) => [...m, question]);
        setFlash({ correct: false, text: `−${BLITZ_WRONG_PENALTY_MS / 1000}s` });
        emit({ type: "sound", name: "miss" });
      }
      setStreak(nextStreak);
      window.setTimeout(() => nextQuestion(nextStreak), correct ? 380 : 1100);
    },
    [phase, question, picked, shownAt, streak, subject.id, nextQuestion],
  );

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (/^[1-4]$/.test(e.key)) answer(Number(e.key) - 1);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pool.length < 8) {
    return <NotEnough onBack={onBack}>Blitz needs at least eight questions for {subject.name}. Add your own questions in the Codex, or study more weeks.</NotEnough>;
  }

  if (phase === "done" && outcome) {
    return (
      <MatchResult report={report} outcome={outcome} rival={rival} yourScore={score} rivalScore={ghost.score} onAgain={onAgain} onBack={onBack}>
        <p className="muted small">
          {right}/{answered} right · best streak {bestStreak} · {rival.name} answered {ghost.events.length} ({ghost.events.filter((e) => e.correct).length} right).
        </p>
        {missed.length > 0 ? (
          <details className="arena-missed" open={missed.length <= 3}>
            <summary>
              Review your {missed.length} miss{missed.length === 1 ? "" : "es"} (also saved to the Grimoire)
            </summary>
            <ul>
              {missed.map((q, i) => (
                <li key={`${q.id}-${i}`}>
                  <b>{q.prompt}</b>
                  <span>
                    {q.choices[q.answerIndex]}. {q.explanation}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </MatchResult>
    );
  }

  if (phase === "intro" || phase === "countdown") {
    const count = Math.max(1, 3 - Math.floor((now - countdownAt) / 1000));
    return (
      <div className="arena-game arena-blitz">
        <MatchHeader you={playerName} rival={rival} yourScore="0" rivalScore="0" />
        {phase === "intro" ? (
          <div className="arena-ready">
            <p className="big">60 seconds. Go fast, stay right.</p>
            <ul className="arena-rules">
              <li>Every 3 in a row raises your multiplier (up to ×5).</li>
              <li>Answer within 2 s for the full speed bonus.</li>
              <li>A wrong answer resets the streak and costs 3 seconds.</li>
              <li>Questions get harder as your streak grows. Keys 1-4 answer.</li>
            </ul>
            <button
              type="button"
              className="rs-button big"
              autoFocus
              onClick={() => {
                setCountdownAt(Date.now());
                setPhase("countdown");
              }}
            >
              Start
            </button>
          </div>
        ) : (
          <div className="arena-ready">
            <p className="arena-count" key={count}>
              {count}
            </p>
          </div>
        )}
      </div>
    );
  }

  const mult = blitzMultiplier(streak);
  return (
    <div className={`arena-game arena-blitz ${flash ? (flash.correct ? "flash-good" : "flash-bad") : ""}`}>
      <MatchHeader you={playerName} rival={rival} yourScore={score.toLocaleString()} rivalScore={rivalNow.toLocaleString()} middle={<span className={`arena-timer ${timeLeft < 10_000 ? "low" : ""}`}>{formatSeconds(timeLeft)}</span>} />
      <div className="arena-clock">
        <div className="arena-bar time">
          <span style={{ width: `${Math.max(0, timeLeft / BLITZ_MS) * 100}%` }} />
        </div>
      </div>
      <div className="arena-streak">
        <span className={`mult m${mult}`}>×{mult}</span>
        <span className="muted small">
          streak {streak}
          {mult < 5 ? ` · ${3 - (streak % 3)} more for ×${mult + 1}` : " · max"}
        </span>
        {flash ? <span className={`arena-pop ${flash.correct ? "good" : "bad"}`}>{flash.text}</span> : null}
      </div>
      {question ? (
        <div className="arena-question">
          <p className="muted small">
            {question.week ? `Week ${question.week} · ` : ""}
            <Difficulty level={question.difficulty ?? 2} />
          </p>
          <p className="prompt">{question.prompt}</p>
          <div className="arena-choices">
            {question.choices.map((c, i) => (
              <button
                key={i}
                type="button"
                className={`arena-choice ${picked !== null && i === question.answerIndex ? "right" : ""} ${picked === i && i !== question.answerIndex ? "wrong" : ""}`}
                onClick={() => answer(i)}
                disabled={picked !== null}
              >
                <span className="key">{i + 1}</span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
