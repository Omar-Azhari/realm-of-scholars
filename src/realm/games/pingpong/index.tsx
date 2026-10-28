/**
 * Ping Pong: a full-screen table-tennis match against a named rival.
 *
 * Physics, rules and the rival's decisions live in physics.ts, rules.ts, ai.ts and
 * engine.ts (all unit-tested); this file is the menu, the HUD and the rally quiz.
 */

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { realmStore, useRealm } from "../../state/store";
import { emit } from "../../state/events";
import { finishPlay, PLAY_COST, startPlay, type PlayResult } from "../../state/playGames";
import { recordAnswer } from "../../state/stats";
import { recordMistake } from "../../state/grimoire";
import { focusShortfall, MedalBadge, ResultsCard, useCapturedKeys } from "../archery/common";
import { judgeTrueFalse, pickQuizQuestions, trueFalseFrom, type QuizItem, type TrueFalseCard } from "../archery/quiz";
import { AI_PROFILES, DIFFICULTIES, type Difficulty } from "./ai";
import { PingPongEngine, type EngineSound } from "./engine";
import { CAMERA_POS, PingPongScene } from "./Scene";
import { isDeuce, matchRating, MATCH_MEDALS, RALLY_QUIZ_HITS, type MatchLength } from "./rules";
import { Icon } from "../../hud/icons";
import "../../../styles/pingpong.css";

type Screen = "menu" | "playing" | "results";

const LEVEL_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const QUIZ_SECONDS = 9;

export const pingPongGameId = (d: Difficulty) => `pingpong-${d}`;

interface QuizState {
  card: TrueFalseCard;
  answer: { right: boolean | null; saidTrue: boolean | null } | null;
}

interface MatchResult {
  play: PlayResult;
  rating: number;
  won: boolean;
  you: number;
  rival: number;
  target: MatchLength;
  longest: number;
  quizRight: number;
  quizAsked: number;
  difficulty: Difficulty;
}

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function PingPongGame({ onClose }: { onClose: () => void }) {
  const subjects = useRealm((s) => s.curriculum?.subjects);
  const focus = useRealm((s) => s.progress.focus);
  const records = useRealm((s) => s.progress.games);
  const playerName = useRealm((s) => s.player?.name) || "You";
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [length, setLength] = useState<MatchLength>(11);
  const [quizOn, setQuizOn] = useState(true);
  const [screen, setScreen] = useState<Screen>("menu");
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [, setVersion] = useState(0);
  const engine = useRef<PingPongEngine | null>(null);
  const pointer = useRef({ x: 0, y: -0.2 });
  const deck = useRef<QuizItem[]>([]);
  const finished = useRef(false);

  const hasQuestions = useMemo(() => pickQuizQuestions(subjects ?? [], 1).length > 0, [subjects]);
  const profile = AI_PROFILES[engine.current?.difficulty ?? difficulty];
  const e = engine.current;

  const finish = () => {
    const eng = engine.current;
    if (!eng || finished.current) return;
    finished.current = true;
    const { you, rival } = eng.score;
    const rating = matchRating(you, rival, eng.match.target);
    const play = finishPlay(pingPongGameId(eng.difficulty), rating, { higherIsBetter: true, medals: MATCH_MEDALS });
    setResult({ play, rating, won: you > rival, you, rival, target: eng.match.target, longest: eng.longestRally, quizRight: eng.quizRight, quizAsked: eng.quizAsked, difficulty: eng.difficulty });
    setScreen("results");
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const nextCard = (): TrueFalseCard | null => {
    if (deck.current.length === 0) deck.current = pickQuizQuestions(realmStore.get().curriculum?.subjects ?? [], 40);
    const item = deck.current.shift();
    return item ? trueFalseFrom(item) : null;
  };
  const nextCardRef = useRef(nextCard);
  nextCardRef.current = nextCard;

  const start = () => {
    setNotice("");
    if (!startPlay(pingPongGameId(difficulty))) {
      setNotice(focusShortfall(realmStore.get().progress.focus));
      return;
    }
    deck.current = quizOn ? pickQuizQuestions(subjects ?? [], 40) : [];
    finished.current = false;
    engine.current = new PingPongEngine(difficulty, length, quizOn && deck.current.length > 0, {
      sound: (name: EngineSound) => emit({ type: "sound", name }),
      changed: () => {
        setVersion((v) => (v + 1) % 1_000_000);
        const phase = engine.current?.phase;
        if (phase !== "quiz" && phase !== "resume") setQuiz(null);
        if (phase === "over") finishRef.current();
      },
      quiz: () => {
        const card = nextCardRef.current();
        if (card) setQuiz({ card, answer: null });
        else engine.current?.answerQuiz(null);
      },
    });
    if (import.meta.env.DEV) (window as unknown as { __pingpong?: unknown }).__pingpong = engine;
    setResult(null);
    setQuiz(null);
    setPaused(false);
    setScreen("playing");
    emit({ type: "sound", name: "click" });
  };

  const toMenu = () => {
    engine.current = null;
    setQuiz(null);
    setPaused(false);
    setScreen("menu");
  };

  const answer = (saidTrue: boolean | null) => {
    if (!quiz || quiz.answer) return;
    const q = quiz.card.item;
    if (saidTrue === null) {
      engine.current?.answerQuiz(null);
      setQuiz({ ...quiz, answer: { right: null, saidTrue: null } });
      return;
    }
    const right = judgeTrueFalse(quiz.card, saidTrue);
    recordAnswer(q.subjectId, q.question, right);
    if (!right) recordMistake(q.subjectId, q.question);
    engine.current?.answerQuiz(right);
    setQuiz({ ...quiz, answer: { right, saidTrue } });
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  // The quiz card times out (no answer recorded).
  useEffect(() => {
    if (!quiz || quiz.answer || paused) return;
    const t = window.setTimeout(() => answerRef.current(null), QUIZ_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [quiz, paused]);

  useCapturedKeys((ev, down) => {
    if (!down || ev.repeat) return;
    const k = ev.key.toLowerCase();
    if (k === "escape" || (k === "p" && screen === "playing")) {
      ev.preventDefault();
      if (screen === "playing") setPaused((p) => !p);
      else if (k === "escape") onClose();
      return;
    }
    if (screen === "playing" && quiz && !quiz.answer && !paused) {
      if (k === "t" || k === "1") answerRef.current(true);
      if (k === "f" || k === "2") answerRef.current(false);
    }
  });

  // Losing the window pauses the match.
  useEffect(() => {
    if (screen !== "playing") return;
    const pause = () => setPaused(true);
    const onVis = () => document.hidden && pause();
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [screen]);

  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    pointer.current = { x: ((ev.clientX - r.left) / r.width) * 2 - 1, y: -(((ev.clientY - r.top) / r.height) * 2 - 1) };
  };
  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (screen !== "playing" || paused || (ev.target as HTMLElement).tagName !== "CANVAS") return;
    engine.current?.playerServe();
  };

  const playing = screen === "playing";
  const youServe = e?.server === "near";
  const target = e?.match.target ?? length;
  const score = e?.score ?? { you: 0, rival: 0 };
  const deuce = e ? isDeuce(e.match) : false;
  const matchPoint = e && !deuce && Math.max(score.you, score.rival) >= target - 1 && score.you !== score.rival;
  const advantage = e && deuce && score.you !== score.rival ? (score.you > score.rival ? "Advantage you" : `Advantage ${profile.name}`) : null;

  return (
    <div className={`pg-root pp-root${playing && !paused && !quiz ? " pp-hide-cursor" : ""}`} onPointerMove={onPointerMove} onPointerDown={onPointerDown}>
      <Canvas className="pg-canvas" shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ fov: 50, position: CAMERA_POS, near: 0.05, far: 60 }}>
        <PingPongScene engine={engine} pointer={pointer} paused={paused || !playing} profile={profile} />
      </Canvas>

      {playing && e ? (
        <>
          <div className="pp-scoreboard" aria-live="polite">
            <div className={`pp-side${youServe ? " is-serving" : ""}`}>
              <span className="pp-name">{playerName}</span>
              <span className="pp-points">{score.you}</span>
            </div>
            <div className="pp-mid">
              <span className="pp-tag">{advantage ?? (deuce ? "Deuce" : matchPoint ? "Match point" : `First to ${target}`)}</span>
              <span className="pp-rally">{e.phase === "rally" || e.phase === "quiz" || e.phase === "resume" ? `Rally ${e.rally.hits}` : LEVEL_LABEL[e.difficulty]}</span>
            </div>
            <div className={`pp-side pp-side-rival${!youServe ? " is-serving" : ""}`}>
              <span className="pp-points">{score.rival}</span>
              <span className="pp-name">{profile.name}</span>
            </div>
          </div>

          {e.phase === "serve" ? (
            <div className="pp-callout">
              {youServe ? (
                <>
                  <strong>Your serve</strong>
                  <span>Click to serve. Paddle high for a long serve, low for a short one. Flick up or down as you click for spin.</span>
                </>
              ) : (
                <strong>{profile.name} to serve</strong>
              )}
            </div>
          ) : null}
          {e.phase === "point" ? (
            <div className={`pp-callout pp-point${e.lastPoint?.to === "near" ? " is-good" : e.lastPoint ? " is-bad" : ""}`}>
              {e.lastPoint ? (
                <>
                  <strong>{e.lastPoint.to === "near" ? "Point to you" : `Point to ${profile.name}`}</strong>
                  <span>{capitalise(e.lastPoint.reason)}</span>
                </>
              ) : (
                <>
                  <strong>Let</strong>
                  <span>The serve clipped the net. Serve again.</span>
                </>
              )}
            </div>
          ) : null}

          {quiz ? (
            <div className="pg-panel pp-quiz" role="dialog" aria-label="Rally quiz">
              <p className="pg-kicker">
                Rally quiz · {quiz.card.item.subjectCode || quiz.card.item.subjectName}
              </p>
              <p className="pp-quiz-q">{quiz.card.item.question.prompt}</p>
              <p className="pp-quiz-a">
                <span>Answer:</span> {quiz.card.shown}
              </p>
              {quiz.answer ? (
                <div className={`pp-quiz-result${quiz.answer.right ? " is-good" : " is-bad"}`}>
                  <strong>{quiz.answer.right === null ? "Time's up" : quiz.answer.right ? "Right! Bonus point." : "Not quite."}</strong>
                  {quiz.answer.right ? null : (
                    <span>
                      {quiz.card.isTrue ? "That was the right answer." : `The answer is ${quiz.card.item.question.choices[quiz.card.item.question.answerIndex]}.`}{" "}
                      {quiz.answer.right === false ? "Added to your Grimoire." : ""}
                    </span>
                  )}
                  <small>Play resumes…</small>
                </div>
              ) : (
                <>
                  <p className="pp-quiz-ask">Is that answer right?</p>
                  <div className="pg-actions">
                    <button type="button" className="pg-btn pg-btn-gold" onClick={() => answer(true)}>
                      True <kbd>T</kbd>
                    </button>
                    <button type="button" className="pg-btn" onClick={() => answer(false)}>
                      False <kbd>F</kbd>
                    </button>
                  </div>
                  <div className="pp-quiz-timer" key={quiz.card.item.question.id + quiz.card.shown}>
                    <span style={{ animationDuration: `${QUIZ_SECONDS}s`, animationPlayState: paused ? "paused" : "running" }} />
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="pg-controls-bar">
            <span>
              <kbd>Mouse</kbd> move paddle
            </span>
            <span>
              <kbd>Click</kbd> serve
            </span>
            <span>Swing up for topspin, down for backspin</span>
            <span>
              <kbd>Esc</kbd> pause
            </span>
          </div>
        </>
      ) : null}

      {playing && paused ? (
        <div className="pg-overlay">
          <div className="pg-panel pg-pause" role="dialog" aria-label="Paused">
            <h2 className="pg-title">Paused</h2>
            <p className="pg-lede">
              {score.you} : {score.rival} against {profile.name}
            </p>
            <div className="pg-actions pg-actions-col">
              <button type="button" className="pg-btn pg-btn-gold" onClick={() => setPaused(false)} autoFocus>
                Resume
              </button>
              <button type="button" className="pg-btn" onClick={toMenu}>
                Forfeit match
              </button>
              <button type="button" className="pg-btn pg-btn-quiet" onClick={onClose}>
                Back to campus
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {screen === "menu" ? (
        <div className="pg-overlay pg-overlay-menu">
          <div className="pg-panel pp-menu">
            <p className="pg-kicker">Scholars Table Tennis Club</p>
            <h2 className="pg-title">Ping Pong</h2>
            <p className="pg-lede">Pick your rival. First to {length}, win by two.</p>
            <div className="pp-rivals" role="radiogroup" aria-label="Rival">
              {DIFFICULTIES.map((d) => {
                const p = AI_PROFILES[d];
                const rec = records[pingPongGameId(d)];
                return (
                  <button key={d} type="button" role="radio" aria-checked={difficulty === d} className={`pp-rival${difficulty === d ? " is-on" : ""}`} onClick={() => setDifficulty(d)}>
                    <span className={`pp-level pp-level-${d}`}>{LEVEL_LABEL[d]}</span>
                    <strong>{p.name}</strong>
                    <small>{p.title}</small>
                    <span className="pp-blurb">{p.blurb}</span>
                    <span className="pp-record">
                      {rec?.best != null ? `Best rating ${rec.best}` : "Not played yet"} <MedalBadge medal={rec?.medal ?? null} size="s" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pg-options">
              <div className="pg-option">
                <span className="pg-option-label">Match</span>
                <div className="pg-seg">
                  <button type="button" className={length === 11 ? "is-on" : ""} onClick={() => setLength(11)}>
                    11 points
                  </button>
                  <button type="button" className={length === 7 ? "is-on" : ""} onClick={() => setLength(7)}>
                    Quick 7
                  </button>
                </div>
              </div>
              <label className={`pg-toggle${hasQuestions ? "" : " is-disabled"}`}>
                <input type="checkbox" checked={quizOn && hasQuestions} disabled={!hasQuestions} onChange={(ev) => setQuizOn(ev.target.checked)} />
                <span>
                  <strong>Rally quiz</strong>
                  <small>
                    {hasQuestions
                      ? `When a rally reaches ${RALLY_QUIZ_HITS} hits, play pauses for a quick true or false question from your subjects. Right answers score a bonus point.`
                      : "Add subjects with questions to play the rally quiz."}
                  </small>
                </span>
              </label>
            </div>
            <ul className="pg-keys">
              <li>
                <kbd>Mouse</kbd> Your paddle follows it
              </li>
              <li>
                <kbd>Click</kbd> Serve (paddle height sets the length)
              </li>
              <li>
                <kbd>Swing</kbd> Faster swings hit harder. Too hard goes long
              </li>
              <li>
                <kbd>Up / down</kbd> Topspin dips and kicks, backspin floats and checks
              </li>
              <li>
                <kbd>Edges</kbd> Hit with the paddle edge to angle the ball
              </li>
              <li>
                <kbd>Esc</kbd> Pause
              </li>
            </ul>
            {notice ? <p className="pg-notice">{notice}</p> : null}
            <div className="pg-actions">
              <button type="button" className="pg-btn pg-btn-gold" onClick={start} autoFocus>
                Play · {PLAY_COST} Focus
              </button>
              <button type="button" className="pg-btn pg-btn-quiet" onClick={onClose}>
                Back to campus
              </button>
              <span className="pg-focus">
            <Icon name="focus" /> You have {focus} Focus
          </span>
            </div>
          </div>
        </div>
      ) : null}

      {screen === "results" && result ? (
        <div className="pg-overlay">
          <ResultsCard
            subtitle={`${LEVEL_LABEL[result.difficulty]} · ${AI_PROFILES[result.difficulty].name}`}
            title={result.won ? "You win!" : `${AI_PROFILES[result.difficulty].name} wins`}
            score={`${result.you} : ${result.rival}`}
            scoreLabel={`Match rating ${result.rating}`}
            result={result.play}
            bestLabel={result.play.best != null ? `rating ${result.play.best}` : "none yet"}
            details={[
              ["Longest rally", `${result.longest} hits`],
              ["Rally quiz", result.quizAsked ? `${result.quizRight} of ${result.quizAsked} right` : "Off"],
              ["Match", `First to ${result.target}`],
            ]}
            medalHint={`Bronze for any win. Silver for winning by ${result.target === 11 ? 5 : 3}, gold by ${result.target === 11 ? 8 : 5}.`}
            againLabel={`Rematch · ${PLAY_COST} Focus`}
            onAgain={start}
            onMenu={toMenu}
            onClose={onClose}
          />
        </div>
      ) : null}
    </div>
  );
}
