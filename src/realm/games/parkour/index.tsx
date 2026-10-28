/**
 * Parkour: a full-screen Roblox-style obby with its own canvas. Pick a course, pay the
 * Focus, and run it against the clock and your ghost. Physics and course data live in
 * the plain .ts files next to this one (tested in scripts/verify-realm.ts).
 *
 * Contract with RealmGame: named export `ParkourGame({ onClose })`, rendered when the
 * window kind is "parkour"; onClose returns to the campus.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useRealm } from "../../state/store";
import { emit } from "../../state/events";
import { defaultAppearance } from "../../customise/humans";
import type { PlayRecord } from "../../types";
import { COURSES, checkpointCount, courseById, nextCourse, type CourseDef, type CourseId } from "./courses";
import { loadGhost, saveGhostIfBest } from "./ghost";
import { newSession, resetToCheckpoint, startSessionRun, type Session, type SessionEvent } from "./session";
import { finishRun, formatDelta, formatTime, PARKOUR_COST, parkourGameId, startRun } from "./scoring";
import { ParkourScene } from "./ParkourScene";
import { Icon } from "../../hud/icons";
import "../../../styles/parkour.css";

type Screen = "select" | "run" | "done";
type Medal = "bronze" | "silver" | "gold";

interface RunResult {
  course: CourseDef;
  time: number;
  previousBest: number | null;
  newBest: boolean;
  medal: Medal | null;
  coins: number;
  splits: number[];
  ghostSplits: number[] | null;
  deaths: number;
}

const MEDAL_LABEL: Record<Medal, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };
const MEDAL_COLOUR: Record<Medal, string> = { gold: "#e2c26a", silver: "#cfd5de", bronze: "#c88a5a" };
/** A medal as a line icon in its metal's colour. */
function MedalIcon({ medal }: { medal: Medal }) {
  return <Icon name="medal" style={{ color: MEDAL_COLOUR[medal] }} />;
}
/** Keys the game uses while running (their browser defaults are blocked). */
const GAME_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "KeyQ", "KeyE", "PageUp", "PageDown", "KeyR"]);

function medalFor(course: CourseDef, time: number | null): Medal | null {
  if (time === null) return null;
  const [b, s, g] = course.medals;
  return time <= g ? "gold" : time <= s ? "silver" : time <= b ? "bronze" : null;
}

/** The next medal to chase and its time. */
function nextTarget(course: CourseDef, best: number | null): { medal: Medal; time: number } | null {
  const [b, s, g] = course.medals;
  if (best === null || best > b) return { medal: "bronze", time: b };
  if (best > s) return { medal: "silver", time: s };
  if (best > g) return { medal: "gold", time: g };
  return null;
}

export function ParkourGame({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [courseId, setCourseId] = useState<CourseId>(COURSES[0].id);
  const def = courseById(courseId) ?? COURSES[0];
  const session = useRef<Session>(newSession(def));
  const [screen, setScreen] = useState<Screen>("select");
  const [paused, setPaused] = useState(false);
  const [checkpoint, setCheckpoint] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [firstPerson, setFirstPerson] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; tone: "good" | "bad" | "plain" } | null>(null);

  const storedAppearance = useRealm((s) => s.player?.appearance);
  const appearance = useMemo(() => storedAppearance ?? defaultAppearance("female"), [storedAppearance]);
  const focus = useRealm((s) => s.progress.focus);
  const games = useRealm((s) => s.progress.games);
  const calmSetting = useRealm((s) => s.settings.reduceMotion);
  const prefersCalm = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true, []);
  const reducedMotion = calmSetting || prefersCalm;

  // Dev-only handle for play-testing (stripped from production builds).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __parkour?: () => Session };
    w.__parkour = () => session.current;
    return () => {
      delete w.__parkour;
    };
  }, []);

  const screenRef = useRef(screen);
  screenRef.current = screen;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const unlockAt = useRef(0);

  const record = useCallback((c: CourseDef): PlayRecord | null => games[parkourGameId(c.id)] ?? null, [games]);

  const showToast = useCallback((text: string, tone: "good" | "bad" | "plain" = "plain") => {
    setToast({ id: Date.now() + Math.random(), text, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** Selecting a course in the menu: show it in the preview. */
  const select = (id: CourseId) => {
    setError(null);
    if (id === courseId && session.current.course.def.id === id) return;
    const fp = session.current.cam.firstPerson;
    session.current = newSession(courseById(id) ?? COURSES[0]);
    session.current.cam.firstPerson = fp;
    setCourseId(id);
    emit({ type: "sound", name: "click" });
  };

  const begin = (c: CourseDef) => {
    if (!startRun(c)) {
      setError(`You need ${PARKOUR_COST} Focus to start a run. Study to earn more.`);
      return;
    }
    setError(null);
    if (session.current.course.def.id !== c.id) {
      const fp = session.current.cam.firstPerson;
      session.current = newSession(c);
      session.current.cam.firstPerson = fp;
    }
    startSessionRun(session.current, loadGhost(c.id));
    setCourseId(c.id);
    setCheckpoint(0);
    setTimerStarted(false);
    setResult(null);
    setPaused(false);
    setScreen("run");
    emit({ type: "sound", name: "click" });
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  const backToMenu = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    const s = session.current;
    const fp = s.cam.firstPerson;
    session.current = newSession(s.course.def);
    session.current.cam.firstPerson = fp;
    setPaused(false);
    setScreen("select");
  };

  const setPause = useCallback((on: boolean) => {
    const s = session.current;
    if (s.mode !== "run") return;
    s.paused = on;
    s.keys.clear();
    if (on && document.pointerLockElement) document.exitPointerLock();
    setPaused(on);
  }, []);

  const restart = () => {
    startSessionRun(session.current, loadGhost(session.current.course.def.id));
    setCheckpoint(0);
    setTimerStarted(false);
    setPaused(false);
  };

  const toCheckpoint = useCallback(() => {
    const s = session.current;
    if (s.mode !== "run") return;
    resetToCheckpoint(s);
    s.paused = false;
    setPaused(false);
  }, []);

  const toggleView = () => {
    const s = session.current;
    s.cam.firstPerson = !s.cam.firstPerson;
    s.cam.look = -0.05;
    setFirstPerson(s.cam.firstPerson);
    emit({ type: "sound", name: "click" });
  };

  const finish = useCallback(() => {
    const s = session.current;
    const c = s.course.def;
    const time = s.timer.time;
    const previousBest = record(c)?.best ?? null;
    const ghostSplits = s.ghost?.splits ?? null;
    const r = finishRun(c, time);
    saveGhostIfBest({ course: c.id, time, splits: [...s.timer.splits], frames: [...s.recorder.frames] });
    if (document.pointerLockElement) document.exitPointerLock();
    emit({ type: "sound", name: "victory" });
    if (r.newBest && previousBest !== null) window.setTimeout(() => emit({ type: "sound", name: "level" }), 700);
    setResult({ course: c, time, previousBest, newBest: r.newBest, medal: r.medal, coins: r.coins, splits: [...s.timer.splits], ghostSplits, deaths: s.deaths });
    setScreen("done");
  }, [record]);

  const onEvents = useCallback(
    (events: SessionEvent[]) => {
      for (const e of events) {
        switch (e.type) {
          case "doubleJump":
          case "wallJump":
            emit({ type: "sound", name: "click" });
            break;
          case "bounce":
          case "boost":
            emit({ type: "sound", name: "spell" });
            break;
          case "death":
            emit({ type: "sound", name: "hit" });
            break;
          case "timerStart":
            setTimerStarted(true);
            break;
          case "checkpoint":
            setCheckpoint(e.index);
            emit({ type: "sound", name: "coin" });
            break;
          case "split": {
            const ghostSplit = session.current.ghost?.splits[e.index - 1];
            const d = ghostSplit !== undefined ? e.time - ghostSplit : null;
            showToast(`Checkpoint ${e.index}  ${formatTime(e.time)}${d !== null ? `  ${formatDelta(d)}` : ""}`, d === null ? "plain" : d <= 0 ? "good" : "bad");
            break;
          }
          case "finish":
            finish();
            break;
          default:
            break;
        }
      }
    },
    [finish, showToast],
  );

  // Keyboard: captured here so the campus underneath never sees it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.stopPropagation();
      const s = session.current;
      // Space only ever jumps (it never presses a focused button).
      if (e.code === "Space") e.preventDefault();
      if (screenRef.current === "run") {
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        if (e.code === "Escape" || e.code === "KeyP") {
          // Esc while the mouse is locked only frees the mouse (the browser does that).
          if (e.code === "Escape" && (document.pointerLockElement || performance.now() - unlockAt.current < 250)) return;
          setPause(!pausedRef.current);
          return;
        }
        if (pausedRef.current) return;
        if (e.code === "KeyR") {
          if (!e.repeat) toCheckpoint();
          return;
        }
        if (e.code === "Space" && !e.repeat) s.jumpTap = true;
        s.keys.add(e.code);
      } else if (e.code === "Escape") {
        if (screenRef.current === "select") onClose();
        else backToMenuRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.code === "Space") e.preventDefault();
      session.current.keys.delete(e.code);
    };
    const onBlur = () => {
      session.current.keys.clear();
      if (screenRef.current === "run" && !pausedRef.current) setPause(true);
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onClose, setPause, toCheckpoint]);
  const backToMenuRef = useRef(backToMenu);
  backToMenuRef.current = backToMenu;

  // Mouse: drag to turn the camera, click to lock the pointer, scroll to zoom.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let down = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    const isLocked = () => document.pointerLockElement === el;
    const turn = (dx: number, dy: number, k: number) => {
      const cam = session.current.cam;
      cam.yaw -= dx * k;
      if (cam.firstPerson) cam.look = Math.max(-1.4, Math.min(1.4, cam.look - dy * k));
      else cam.pitch = Math.max(-0.2, Math.min(1.3, cam.pitch + dy * k));
    };
    const onDown = (e: PointerEvent) => {
      if (screenRef.current !== "run" || pausedRef.current || isLocked()) return;
      down = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (isLocked()) {
        turn(e.movementX, e.movementY, 0.0024);
        return;
      }
      if (!down) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      turn(dx, dy, 0.005);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      // A click (not a drag) locks the mouse for looking around, Roblox style.
      if (moved < 6 && screenRef.current === "run" && !pausedRef.current) {
        try {
          const req = el.requestPointerLock() as unknown as Promise<void> | undefined;
          req?.catch?.(() => undefined);
        } catch {
          // Pointer lock unavailable: dragging still works.
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = session.current.cam;
      if (cam.firstPerson) return;
      cam.dist = Math.max(3, Math.min(16, cam.dist * (1 + e.deltaY * 0.0012)));
    };
    const onLockChange = () => {
      const on = isLocked();
      if (!on) unlockAt.current = performance.now();
      setLocked(on);
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, []);

  const total = checkpointCount(def);
  const next = result ? nextCourse(result.course.id) : undefined;

  return (
    <div className={`pk-root ${reducedMotion ? "pk-calm" : ""}`} ref={rootRef} role="application" aria-label="Parkour">
      <div className="pk-stage" ref={stageRef}>
        <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ fov: 70, near: 0.1, far: 1000, position: [0, 6, 12] }}>
          <ParkourScene session={session} def={def} appearance={appearance} reducedMotion={reducedMotion} checkpoint={checkpoint} onEvents={onEvents} />
        </Canvas>
      </div>

      {screen === "select" ? (
        <CourseSelect
          courseId={courseId}
          focus={focus}
          error={error}
          record={record}
          onSelect={select}
          onPlay={begin}
          onClose={onClose}
        />
      ) : null}

      {screen === "run" ? (
        <>
          <RunHud
            session={session}
            def={def}
            checkpoint={checkpoint}
            total={total}
            timerStarted={timerStarted}
            locked={locked}
            paused={paused}
            firstPerson={firstPerson}
            onPause={() => setPause(true)}
            onToggleView={toggleView}
          />
          {toast ? (
            <div key={toast.id} className={`pk-toast pk-toast-${toast.tone}`} role="status">
              {toast.text}
            </div>
          ) : null}
          {paused ? (
            <div className="pk-overlay" role="dialog" aria-modal="true" aria-label="Paused">
              <div className="pk-panel pk-pause">
                <h2 className="pk-title">Paused</h2>
                <div className="pk-actions pk-actions-col">
                  <button type="button" className="pk-btn pk-btn-gold" autoFocus onClick={() => setPause(false)}>
                    Resume
                  </button>
                  <button type="button" className="pk-btn" onClick={toCheckpoint}>
                    Back to checkpoint
                  </button>
                  <button type="button" className="pk-btn" onClick={restart}>
                    Restart run
                  </button>
                  <button type="button" className="pk-btn" onClick={toggleView}>
                    <Icon name="eye" /> {firstPerson ? "Third person" : "First person"}
                  </button>
                  <button type="button" className="pk-btn" onClick={backToMenu}>
                    Courses
                  </button>
                  <button type="button" className="pk-btn pk-btn-quiet" onClick={onClose}>
                    Back to campus
                  </button>
                </div>
                <ControlsList />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {screen === "done" && result ? (
        <div className="pk-overlay" role="dialog" aria-modal="true" aria-label="Course complete">
          <div className="pk-panel pk-result">
            <p className="pk-kicker">{result.course.name} complete</p>
            <div className="pk-result-time">{formatTime(result.time)}</div>
            <p className="pk-result-line">
              {result.newBest ? (result.previousBest === null ? "First clear. Your ghost will race you next time." : `New personal best, ${formatDelta(result.time - result.previousBest)}s`) : `Best ${formatTime(result.previousBest)}`}
            </p>
            <div className="pk-result-medal">
              {result.medal ? (
                <>
                  <span className="pk-medal-big" aria-hidden="true">
                    <MedalIcon medal={result.medal} />
                  </span>
                  <span>{MEDAL_LABEL[result.medal]} medal</span>
                  {result.coins > 0 ? <span className="pk-coins">+{result.coins} coins</span> : <span className="pk-muted">Daily coin cap reached</span>}
                </>
              ) : (
                <span className="pk-muted">No medal this time. Bronze is {formatTime(result.course.medals[0])}.</span>
              )}
            </div>
            {(() => {
              const best = result.newBest ? result.time : result.previousBest;
              const target = nextTarget(result.course, best);
              return target ? (
                <p className="pk-muted">
                  Next: {MEDAL_LABEL[target.medal]} at {formatTime(target.time)}
                </p>
              ) : (
                <p className="pk-muted">Every medal earned on this course.</p>
              );
            })()}
            {result.splits.length ? (
              <table className="pk-splits">
                <tbody>
                  {result.splits.map((t, i) =>
                    t === undefined ? null : (
                      <tr key={i}>
                        <th scope="row">Checkpoint {i + 1}</th>
                        <td>{formatTime(t)}</td>
                        <td className={result.ghostSplits?.[i] === undefined ? "" : t - result.ghostSplits[i] <= 0 ? "pk-good" : "pk-bad"}>
                          {result.ghostSplits?.[i] === undefined ? "" : formatDelta(t - result.ghostSplits[i])}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : null}
            <p className="pk-muted">
              {result.deaths === 0 ? "Flawless: no resets." : `${result.deaths} reset${result.deaths === 1 ? "" : "s"}.`}
            </p>
            {error ? <p className="pk-error">{error}</p> : null}
            <div className="pk-actions">
              <button type="button" className="pk-btn pk-btn-gold" autoFocus onClick={() => begin(result.course)}>
                Retry · {PARKOUR_COST} Focus
              </button>
              {next ? (
                <button type="button" className="pk-btn" onClick={() => begin(next)}>
                  Next: {next.name} · {PARKOUR_COST} Focus
                </button>
              ) : null}
              <button type="button" className="pk-btn" onClick={backToMenu}>
                Courses
              </button>
              <button type="button" className="pk-btn pk-btn-quiet" onClick={onClose}>
                Back to campus
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

function CourseSelect({
  courseId,
  focus,
  error,
  record,
  onSelect,
  onPlay,
  onClose,
}: {
  courseId: CourseId;
  focus: number;
  error: string | null;
  record: (c: CourseDef) => PlayRecord | null;
  onSelect: (id: CourseId) => void;
  onPlay: (c: CourseDef) => void;
  onClose: () => void;
}) {
  return (
    <div className="pk-menu">
      <header className="pk-menu-head">
        <div>
          <p className="pk-kicker">Sky courses</p>
          <h1 className="pk-title">Parkour</h1>
        </div>
        <div className="pk-menu-meta">
          <span className="pk-focus" title="Focus">
            <Icon name="focus" /> {focus}
          </span>
          <button type="button" className="pk-btn pk-btn-quiet" onClick={onClose}>
            Back to campus
          </button>
        </div>
      </header>
      <ul className="pk-courses">
        {COURSES.map((c) => {
          const rec = record(c);
          const best = rec?.best ?? null;
          const medal = (rec?.medal as Medal | null | undefined) ?? medalFor(c, best);
          const selected = c.id === courseId;
          return (
            <li key={c.id}>
              <div className={`pk-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(c.id)}>
                <button type="button" className="pk-card-head" aria-pressed={selected} onClick={() => onSelect(c.id)}>
                  <span className={`pk-chip pk-chip-${c.difficulty.toLowerCase()}`}>{c.difficulty}</span>
                  <span className="pk-card-name">{c.name}</span>
                  <span className="pk-card-medal" aria-label={medal ? `${MEDAL_LABEL[medal]} medal` : "No medal yet"}>
                    {medal ? <MedalIcon medal={medal} /> : null}
                  </span>
                </button>
                <p className="pk-card-blurb">{c.blurb}</p>
                <ul className="pk-tags">
                  {c.teaches.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <div className="pk-card-stats">
                  <span>
                    Best <strong>{formatTime(best)}</strong>
                  </span>
                  <span className="pk-targets">
                    <MedalIcon medal="gold" /> {formatTime(c.medals[2])} · <MedalIcon medal="silver" /> {formatTime(c.medals[1])} · <MedalIcon medal="bronze" /> {formatTime(c.medals[0])}
                  </span>
                </div>
                {selected ? (
                  <button
                    type="button"
                    className="pk-btn pk-btn-gold pk-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(c);
                    }}
                  >
                    Play · {PARKOUR_COST} Focus
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="pk-error">{error}</p> : null}
      <ControlsList />
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="pk-controls" aria-label="Controls">
      <li>
        <kbd>WASD</kbd> move
      </li>
      <li>
        <kbd>Space</kbd> jump (again in the air to double jump)
      </li>
      <li>
        <kbd>Shift</kbd> sprint
      </li>
      <li>
        Jump at a wall to <strong>wall jump</strong>
      </li>
      <li>
        Sprint alongside a wall to <strong>wall run</strong>
      </li>
      <li>
        <kbd>R</kbd> last checkpoint
      </li>
      <li>
        Drag or <kbd>Q</kbd>
        <kbd>E</kbd> turn camera
      </li>
      <li>
        Click to lock the mouse, <kbd>Esc</kbd> to free it or pause
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ HUD */

function RunHud({
  session,
  def,
  checkpoint,
  total,
  timerStarted,
  locked,
  paused,
  firstPerson,
  onPause,
  onToggleView,
}: {
  session: React.MutableRefObject<Session>;
  def: CourseDef;
  checkpoint: number;
  total: number;
  timerStarted: boolean;
  locked: boolean;
  paused: boolean;
  firstPerson: boolean;
  onPause: () => void;
  onToggleView: () => void;
}) {
  const timerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const staminaRef = useRef<HTMLDivElement>(null);
  const staminaWrap = useRef<HTMLDivElement>(null);
  const djRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<HTMLSpanElement>(null);

  // Fast-changing readouts are written straight to the DOM each frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = session.current;
      const p = s.player;
      if (timerRef.current) timerRef.current.textContent = formatTime(s.timer.time);
      if (ghostRef.current) {
        const g = s.ghost;
        ghostRef.current.textContent = g ? `Ghost ${formatTime(g.time)}` : "";
      }
      if (staminaRef.current) staminaRef.current.style.transform = `scaleX(${p.stamina.toFixed(3)})`;
      if (staminaWrap.current) {
        staminaWrap.current.classList.toggle("is-empty", p.exhausted);
        staminaWrap.current.classList.toggle("is-boost", p.boost > 0);
        staminaWrap.current.classList.toggle("is-sprint", p.sprinting);
      }
      if (djRef.current) djRef.current.classList.toggle("is-ready", p.airJumps > 0);
      if (flashRef.current) flashRef.current.style.opacity = String(Math.min(1, s.flash * 2.2));
      if (moveRef.current) moveRef.current.textContent = p.wallRun ? "Wall run" : p.boost > 0 ? "Speed boost" : "";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  return (
    <div className="pk-hud">
      <div className="pk-flash" ref={flashRef} aria-hidden="true" />
      <div className="pk-hud-top">
        <div className="pk-hud-course">
          <span className="pk-hud-name">{def.name}</span>
          <span className="pk-hud-cp">
            Checkpoint {checkpoint}/{total}
          </span>
        </div>
        <div className="pk-hud-clock">
          <div className="pk-timer" ref={timerRef} aria-live="off">
            0:00.00
          </div>
          <div className="pk-ghost-time" ref={ghostRef} />
        </div>
        <div className="pk-hud-buttons">
          <button type="button" className="pk-btn pk-btn-small" onClick={onToggleView} aria-label={firstPerson ? "Switch to third person" : "Switch to first person"}>
            <Icon name="eye" /> {firstPerson ? "Third person" : "First person"}
          </button>
          <button type="button" className="pk-btn pk-btn-small" onClick={onPause} aria-label="Pause">
            <Icon name="pause" /> Pause
          </button>
        </div>
      </div>

      {!timerStarted ? <div className="pk-hint pk-hint-start">Leave the green pad to start the clock</div> : null}
      {!locked && !paused ? <div className="pk-hint pk-hint-look">Click to lock the mouse for looking around, or drag</div> : null}

      <div className="pk-hud-bottom">
        <span className="pk-move" ref={moveRef} />
        <div className="pk-stamina" ref={staminaWrap} title="Sprint stamina">
          <span className="pk-stamina-label">Sprint</span>
          <div className="pk-stamina-track">
            <div className="pk-stamina-fill" ref={staminaRef} />
          </div>
          {def.doubleJump ? (
            <span className="pk-dj" ref={djRef} title="Double jump ready">
              2×
            </span>
          ) : null}
        </div>
      </div>
      <div className="pk-keys" aria-hidden="true">
        <kbd>WASD</kbd> move <kbd>Space</kbd> jump <kbd>Shift</kbd> sprint <kbd>R</kbd> checkpoint <kbd>Esc</kbd> pause
      </div>
      <span className="pk-sr" aria-live="polite">
        {`Checkpoint ${checkpoint} of ${total}`}
      </span>
    </div>
  );
}
