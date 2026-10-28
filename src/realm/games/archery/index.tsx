/**
 * Archery Range: a full-screen, first-person archery game with two modes.
 *
 * - Target practice: three ends of six arrows at 18, 30 and 45 m (the last at a moving
 *   target), scored 10 to 1 by ring.
 * - Quiz range: four targets lettered A to D answer a question from your own subjects;
 *   hit the right one. Streaks multiply the score; wrong hits go to the Grimoire.
 *
 * Physics, scoring and rules are in physics.ts, rules.ts, quiz.ts and engine.ts (all
 * unit-tested); the 3D range is Scene.tsx. This file is the menu, HUD and input.
 */

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { realmStore, useRealm } from "../../state/store";
import { emit } from "../../state/events";
import { finishPlay, PLAY_COST, startPlay, type PlayResult } from "../../state/playGames";
import { recordAnswer } from "../../state/stats";
import { recordMistake } from "../../state/grimoire";
import { focusShortfall, MedalBadge, ResultsCard, useCapturedKeys } from "./common";
import { pickQuizQuestions } from "./quiz";
import { pinElevation } from "./physics";
import { GAME_IDS, LETTERS, PRACTICE_MAX, PRACTICE_MEDALS, PRACTICE_ROUNDS, QUIZ_ARROWS_PER_QUESTION, QUIZ_DISTANCE, QUIZ_MEDALS, QUIZ_QUESTIONS, TARGET_HEIGHT, windSpeed, type ArcheryMode } from "./rules";
import { ArcheryEngine, type Popup } from "./engine";
import { ArcheryScene, type HudEls } from "./Scene";
import { Icon } from "../../hud/icons";

type Screen = "menu" | "playing" | "results";

/** Radians of aim per pixel of mouse movement. */
const LOOK_SPEED = 0.0021;
const PIN_DISTANCES = [18, 30, 45];

interface RoundResult {
  mode: ArcheryMode;
  play: PlayResult;
  total: number;
  ends: number[][];
  xs: number;
  right: number;
  wrong: number;
  skipped: number;
  bestStreak: number;
}

const fmt = (n: number) => n.toLocaleString("en-AU");

function windWords(x: number, z: number): string {
  const s = Math.hypot(x, z);
  if (s < 0.4) return "Calm";
  if (Math.abs(x) >= Math.abs(z)) return x > 0 ? "Left to right" : "Right to left";
  return z > 0 ? "Into your face" : "At your back";
}

export function ArcheryGame({ onClose }: { onClose: () => void }) {
  const subjects = useRealm((s) => s.curriculum?.subjects);
  const focus = useRealm((s) => s.progress.focus);
  const records = useRealm((s) => s.progress.games);
  const [mode, setMode] = useState<ArcheryMode>("practice");
  const [screen, setScreen] = useState<Screen>("menu");
  const [paused, setPaused] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState("");
  const [popups, setPopups] = useState<Popup[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [arrowCam, setArrowCam] = useState(false);
  const [, setVersion] = useState(0);
  const engine = useRef<ArcheryEngine | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const finished = useRef(false);
  const popupId = useRef(0);
  /** When the lock was last taken, and whether something keeps taking it away (then drag-aim is used). */
  const lockedAt = useRef(0);
  const lockUnreliable = useRef(false);

  const quizAvailable = useMemo(() => pickQuizQuestions(subjects ?? [], 4).length >= 4, [subjects]);
  const pins = useMemo(() => {
    const distances = mode === "quiz" ? [QUIZ_DISTANCE] : PIN_DISTANCES;
    return distances.map((d) => ({ distance: d, elevation: pinElevation(d, TARGET_HEIGHT) }));
  }, [mode]);
  const hud = useRef<HudEls>({ pins: [], power: null, powerMeter: null, breath: null, breathMeter: null, reticle: null });
  hud.current.pins = pins.map((p, i) => ({ ...p, el: hud.current.pins[i]?.el ?? null }));

  const e = engine.current;
  const playing = screen === "playing";

  const finish = () => {
    const eng = engine.current;
    if (!eng || finished.current) return;
    finished.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    const total = eng.total;
    const medals = eng.mode === "practice" ? PRACTICE_MEDALS : QUIZ_MEDALS;
    const play = finishPlay(GAME_IDS[eng.mode], total, { higherIsBetter: true, medals });
    emit({ type: "sound", name: play.medal ? "victory" : "defeat" });
    setResult({ mode: eng.mode, play, total, ends: eng.ends.map((x) => x.slice()), xs: eng.xs, right: eng.right, wrong: eng.wrong, skipped: eng.skipped, bestStreak: eng.bestStreak });
    setScreen("results");
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const start = () => {
    setNotice("");
    let questions: ReturnType<typeof pickQuizQuestions> = [];
    if (mode === "quiz") {
      questions = pickQuizQuestions(subjects ?? [], QUIZ_QUESTIONS);
      if (questions.length === 0) {
        setNotice("The quiz range needs subjects with questions. Add some in the Codex first.");
        return;
      }
    }
    if (!startPlay(GAME_IDS[mode])) {
      setNotice(focusShortfall(realmStore.get().progress.focus));
      return;
    }
    finished.current = false;
    const eng = new ArcheryEngine(mode, questions, {
      sound: (name) => emit({ type: "sound", name }),
      changed: () => {
        setVersion((v) => (v + 1) % 1_000_000);
        if (engine.current?.phase === "done") finishRef.current();
      },
      popup: (p) => {
        const id = ++popupId.current;
        setPopups((list) => [...list.slice(-2), { ...p, id }]);
        window.setTimeout(() => setPopups((list) => list.filter((x) => x.id !== id)), 1300);
      },
      answer: (item, correct) => {
        recordAnswer(item.subjectId, item.question, correct);
        if (!correct) recordMistake(item.subjectId, item.question);
      },
    });
    eng.arrowCam = arrowCam;
    engine.current = eng;
    if (import.meta.env.DEV) (window as unknown as { __archery?: unknown }).__archery = engine;
    setResult(null);
    setPopups([]);
    setPaused(false);
    setScreen("playing");
    emit({ type: "sound", name: "click" });
  };

  const toMenu = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    engine.current = null;
    setPaused(false);
    setScreen("menu");
  };

  const requestLock = () => {
    const el = root.current;
    if (!el || document.pointerLockElement === el || lockUnreliable.current) return;
    try {
      const r = el.requestPointerLock() as unknown as Promise<void> | undefined;
      // Some browsers reject (for example right after leaving the lock); drag-aim still works.
      r?.catch?.(() => undefined);
    } catch {
      // Drag-aim fallback.
    }
  };

  const resume = () => {
    setPaused(false);
    requestLock();
  };

  // Mouse: look while the pointer is locked or a button is held; release shoots.
  useEffect(() => {
    if (!playing) return;
    const onMove = (ev: PointerEvent) => {
      const eng = engine.current;
      if (!eng || paused) return;
      if (document.pointerLockElement === root.current || dragging.current) eng.look(ev.movementX * LOOK_SPEED, -ev.movementY * LOOK_SPEED);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      dragging.current = false;
      if (!paused) engine.current?.release();
    };
    const onLock = () => {
      const isLocked = document.pointerLockElement === root.current;
      setLocked(isLocked);
      if (isLocked) {
        lockedAt.current = performance.now();
        return;
      }
      // Lost straight away: something else on the page frees the mouse, so aim by dragging instead.
      if (performance.now() - lockedAt.current < 400) {
        lockUnreliable.current = true;
        return;
      }
      if (engine.current && engine.current.phase !== "done") {
        engine.current.cancelDraw();
        dragging.current = false;
        setPaused(true);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerlockchange", onLock);
    };
  }, [playing, paused]);

  // Leaving the game frees the mouse.
  useEffect(
    () => () => {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    [],
  );

  // Losing the window pauses.
  useEffect(() => {
    if (!playing) return;
    const pause = () => {
      engine.current?.cancelDraw();
      setPaused(true);
    };
    const onVis = () => document.hidden && pause();
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [playing]);

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!playing || paused || (ev.target as HTMLElement).tagName !== "CANVAS") return;
    const eng = engine.current;
    if (!eng) return;
    if (ev.button === 2) {
      eng.cancelDraw();
      return;
    }
    if (ev.button !== 0) return;
    requestLock();
    dragging.current = document.pointerLockElement !== root.current;
    eng.startDraw();
  };

  useCapturedKeys((ev, down) => {
    const k = ev.key.toLowerCase();
    const eng = engine.current;
    if (k === "shift" && eng) eng.holdingBreath = down;
    if (!down || ev.repeat) return;
    if (k === "escape") {
      ev.preventDefault();
      if (screen === "playing") {
        if (paused) resume();
        else {
          eng?.cancelDraw();
          setPaused(true);
        }
      } else onClose();
      return;
    }
    if (screen !== "playing") return;
    if (k === "p") {
      if (paused) resume();
      else {
        eng?.cancelDraw();
        setPaused(true);
      }
    }
    if (k === "c" && eng) {
      eng.arrowCam = !eng.arrowCam;
      setArrowCam(eng.arrowCam);
    }
  });

  const wind = e?.wind ?? { x: 0, z: 0 };
  const windDeg = (Math.atan2(wind.z, wind.x) * 180) / Math.PI;
  const q = e?.question ?? null;
  const roundSpec = e ? PRACTICE_ROUNDS[Math.min(e.round, PRACTICE_ROUNDS.length - 1)] : PRACTICE_ROUNDS[0];
  const currentDistance = e?.mode === "quiz" ? QUIZ_DISTANCE : roundSpec.distance;

  return (
    <div
      ref={root}
      className={`pg-root ar-root${playing && !paused ? (locked ? " ar-locked" : " ar-aiming") : ""}`}
      onPointerDown={onPointerDown}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      <Canvas className="pg-canvas" shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ fov: 62, near: 0.05, far: 1000, position: [0, 1.9, 2.5] }}>
        <ArcheryScene engine={engine} paused={paused || !playing} hud={hud} targetsKey={e ? `${e.mode}-${e.round}-${e.qIndex}` : "menu"} />
      </Canvas>

      {playing && e ? (
        <>
          <div className="ar-reticle" ref={(el) => void (hud.current.reticle = el)}>
            <span className="ar-reticle-ring" />
            <span className="ar-reticle-dot" />
            {pins.map((p, i) => (
              <span
                key={p.distance}
                className={`ar-pin${p.distance === currentDistance ? " is-now" : ""}`}
                ref={(el) => {
                  if (hud.current.pins[i]) hud.current.pins[i].el = el;
                }}
              >
                {p.distance} m
              </span>
            ))}
          </div>
          <div className="ar-meters" aria-hidden="true">
            <div className="ar-meter ar-meter-power" ref={(el) => void (hud.current.powerMeter = el)}>
              <span ref={(el) => void (hud.current.power = el)} />
              <i className="ar-meter-label">DRAW</i>
            </div>
            <div className="ar-meter ar-meter-breath" ref={(el) => void (hud.current.breathMeter = el)}>
              <span ref={(el) => void (hud.current.breath = el)} />
              <i className="ar-meter-label">BREATH</i>
            </div>
          </div>

          <div className="ar-hud">
            {e.mode === "practice" ? (
              <div className="ar-card ar-total">
                <small>
                  End {Math.min(e.round + 1, PRACTICE_ROUNDS.length)} of {PRACTICE_ROUNDS.length} · {roundSpec.distance} m
                </small>
                <span className="ar-total-score">{e.total}</span>
                <div className="ar-sheet">
                  {e.ends.map((end, r) => (
                    <div key={r} className={`ar-sheet-row${r === e.round ? " is-now" : ""}`}>
                      <b>{PRACTICE_ROUNDS[r].distance} m</b>
                      {Array.from({ length: PRACTICE_ROUNDS[r].arrows }, (_, i) => {
                        const v = end[i];
                        const band = v === undefined ? "" : v >= 9 ? "r10" : v >= 7 ? "r8" : v >= 5 ? "r6" : v >= 3 ? "r4" : v >= 1 ? "r2" : "r0";
                        return (
                          <span key={i} className={`ar-cell ${band}`}>
                            {v === undefined ? "" : v === 0 ? "M" : v}
                          </span>
                        );
                      })}
                      <em>{end.reduce((a, b) => a + b, 0)}</em>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ar-card ar-total">
                <small>Score</small>
                <span className="ar-total-score">{fmt(e.total)}</span>
                <div className="ar-streak">
                  <strong>x{e.multiplier}</strong>
                  <small>{e.streak} in a row</small>
                </div>
                <div className="ar-arrows-left" title="Arrows left for this question">
                  {Array.from({ length: QUIZ_ARROWS_PER_QUESTION }, (_, i) => (
                    <i key={i} className={i < e.arrowsLeft ? "" : "is-used"} />
                  ))}
                </div>
              </div>
            )}
            <div className="ar-card ar-wind" aria-label={`Wind ${windSpeed(wind).toFixed(1)} metres per second, ${windWords(wind.x, wind.z)}`}>
              <small>Wind</small>
              <div className="ar-wind-dial">
                <span className="ar-wind-arrow" style={{ transform: `rotate(${windDeg}deg)`, opacity: windSpeed(wind) < 0.4 ? 0.3 : 1 }} />
              </div>
              <strong>{windSpeed(wind).toFixed(1)} m/s</strong>
              <small>{windWords(wind.x, wind.z)}</small>
            </div>
          </div>

          {e.mode === "quiz" && q ? (
            <div className="pg-panel ar-board" aria-live="polite">
              <p className="pg-kicker">
                <span>
                  Question {e.qIndex + 1} of {e.questions.length}
                </span>
                <span>{q.subjectCode || q.subjectName}</span>
              </p>
              <p className="ar-board-q">{q.question.prompt}</p>
              <ul className="ar-board-choices">
                {q.question.choices.map((c, i) => {
                  const fb = e.feedback;
                  const cls = fb ? (i === q.question.answerIndex ? "is-right" : fb.hit === i ? "is-wrong" : "") : "";
                  return (
                    <li key={i} className={cls}>
                      <b>{LETTERS[i]}</b>
                      <span>{c}</span>
                    </li>
                  );
                })}
              </ul>
              {e.feedback && q.question.explanation ? <p className="ar-board-explain">{q.question.explanation}</p> : null}
            </div>
          ) : null}

          {e.phase === "intro" ? (
            <div className={`ar-banner${e.mode === "quiz" ? " ar-banner-low" : ""}`}>
              {e.mode === "practice" ? (
                <>
                  <strong>
                    End {e.round + 1} of {PRACTICE_ROUNDS.length}
                  </strong>
                  <span>
                    {roundSpec.distance} m · {roundSpec.moveAmp > 0 ? "moving target" : "still target"} · wind {windSpeed(wind).toFixed(1)} m/s
                  </span>
                </>
              ) : (
                <>
                  <strong>Question {e.qIndex + 1}</strong>
                  <span>Shoot the letter of the right answer</span>
                </>
              )}
            </div>
          ) : null}

          {popups.map((p) => (
            <div key={p.id} className={`ar-popup is-${p.kind}`}>
              <strong>{p.big}</strong>
              {p.small ? <span>{p.small}</span> : null}
            </div>
          ))}

          {!locked && !paused && e.phase === "aim" ? <div className="ar-lock-hint">{lockUnreliable.current ? "Hold the mouse button and drag to aim. Let go to shoot." : "Click to aim with the mouse. Hold to draw, let go to shoot."}</div> : null}

          <div className="pg-controls-bar">
            <span>
              <kbd>Mouse</kbd> aim
            </span>
            <span>
              <kbd>Hold click</kbd> draw, let go to shoot
            </span>
            <span>
              <kbd>Shift</kbd> hold breath
            </span>
            <span>
              <kbd>C</kbd> arrow cam {arrowCam ? "on" : "off"}
            </span>
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
              {e?.mode === "quiz" ? `Score ${fmt(e?.total ?? 0)}` : `${e?.total ?? 0} points so far`}. Click Resume to take the mouse again.
            </p>
            <div className="pg-actions pg-actions-col">
              <button type="button" className="pg-btn pg-btn-gold" onClick={resume} autoFocus>
                Resume
              </button>
              <button type="button" className="pg-btn" onClick={toMenu}>
                Quit to range menu
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
          <div className="pg-panel ar-menu">
            <p className="pg-kicker">The Longbow Green</p>
            <h2 className="pg-title">Archery Range</h2>
            <p className="pg-lede">Read the wind, steady your breath, and put it in the gold.</p>
            <div className="ar-modes" role="radiogroup" aria-label="Mode">
              <button type="button" role="radio" aria-checked={mode === "practice"} className={`ar-mode${mode === "practice" ? " is-on" : ""}`} onClick={() => setMode("practice")}>
                <strong>Target practice</strong>
                <small>Three ends of six arrows at 18, 30 and 45 m. The last target moves. Rings score 10 to 1.</small>
                <span className="ar-mode-best">
                  {records[GAME_IDS.practice]?.best != null ? `Best ${records[GAME_IDS.practice]!.best} / ${PRACTICE_MAX}` : "Not played yet"}
                  <MedalBadge medal={records[GAME_IDS.practice]?.medal ?? null} size="s" />
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "quiz"}
                className={`ar-mode${mode === "quiz" ? " is-on" : ""}${quizAvailable ? "" : " is-disabled"}`}
                onClick={() => setMode("quiz")}
              >
                <strong>Quiz range</strong>
                <small>
                  {quizAvailable
                    ? `${QUIZ_QUESTIONS} questions from your subjects. Shoot target A, B, C or D. Streaks multiply your score; misses go to the Grimoire.`
                    : "Needs subjects with questions. Add some in the Codex to play."}
                </small>
                <span className="ar-mode-best">
                  {records[GAME_IDS.quiz]?.best != null ? `Best ${fmt(records[GAME_IDS.quiz]!.best!)}` : "Not played yet"}
                  <MedalBadge medal={records[GAME_IDS.quiz]?.medal ?? null} size="s" />
                </span>
              </button>
            </div>
            <ul className="pg-keys" style={{ marginTop: 16 }}>
              <li>
                <kbd>Click</kbd> Take the mouse (Esc frees it)
              </li>
              <li>
                <kbd>Hold</kbd> Draw the bow, let go to shoot
              </li>
              <li>
                <kbd>Pins</kbd> Put the pin for the distance on the gold
              </li>
              <li>
                <kbd>Shift</kbd> Hold your breath to steady the sway
              </li>
              <li>
                <kbd>Wind</kbd> Aim into it: flags and seeds show where it blows
              </li>
              <li>
                <kbd>C</kbd> Follow the arrow in flight
              </li>
            </ul>
            {notice ? <p className="pg-notice">{notice}</p> : null}
            <div className="pg-actions">
              <button type="button" className="pg-btn pg-btn-gold" onClick={start} disabled={mode === "quiz" && !quizAvailable} autoFocus>
                Shoot · {PLAY_COST} Focus
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
            subtitle={result.mode === "practice" ? "Target practice" : "Quiz range"}
            title={result.play.medal === "gold" ? "Gold!" : result.play.medal ? "Well shot" : "Round complete"}
            score={result.mode === "practice" ? `${result.total}` : fmt(result.total)}
            scoreLabel={result.mode === "practice" ? `out of ${PRACTICE_MAX}` : "points"}
            result={result.play}
            bestLabel={result.play.best != null ? fmt(result.play.best) : "none yet"}
            details={
              result.mode === "practice"
                ? [
                    ...result.ends.map((end, i): [string, string] => [`${PRACTICE_ROUNDS[i].distance} m end`, `${end.reduce((a, b) => a + b, 0)} (${end.map((v) => (v === 0 ? "M" : v)).join(" ")})`]),
                    ["Bullseyes (X)", `${result.xs}`],
                  ]
                : [
                    ["Right", `${result.right} of ${result.right + result.wrong + result.skipped}`],
                    ["Best streak", `${result.bestStreak}`],
                    ["Out of arrows", `${result.skipped}`],
                  ]
            }
            medalHint={
              result.mode === "practice"
                ? `Bronze ${PRACTICE_MEDALS[0]}, silver ${PRACTICE_MEDALS[1]}, gold ${PRACTICE_MEDALS[2]} out of ${PRACTICE_MAX}.`
                : `Bronze ${fmt(QUIZ_MEDALS[0])}, silver ${fmt(QUIZ_MEDALS[1])}, gold ${fmt(QUIZ_MEDALS[2])}.${result.wrong ? " Your misses are waiting in the Grimoire." : ""}`
            }
            againLabel={`Shoot again · ${PLAY_COST} Focus`}
            onAgain={start}
            onMenu={toMenu}
            onClose={onClose}
          />
        </div>
      ) : null}
    </div>
  );
}
