/**
 * Siege of Procrastination: the tower-defence window. The game logic lives
 * in td.ts; this draws it on a canvas and ties it to study — your streak adds
 * starting gold, and between waves a "study break" question pays gold for a
 * right answer (wrong answers go into the Grimoire like anywhere else).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Window } from "../hud/Window";
import { realmStore, useRealm } from "../state/store";
import { spendFocus } from "../state/focus";
import { addCoinsPublic, liveStreak } from "../state/actions";
import { bumpCounter, recordAnswer } from "../state/stats";
import { recordMistake } from "../state/grimoire";
import { chat, emit } from "../state/events";
import { buildQuestionPool } from "../curriculum/questionBank";
import { FOCUS } from "../life/catalog";
import {
  build,
  canBuild,
  COLS,
  CREEPS,
  creepPos,
  newGame,
  onPath,
  PATH,
  ROWS,
  runReward,
  sell,
  startWave,
  step,
  TOWERS,
  WAVE_PLAN,
  type TDState,
  type TowerKind,
} from "./td";
import type { RealmQuestion } from "../types";
import { drawIcon, Icon, siegeIcon } from "../hud/icons";

const CELL = 48;
const W = COLS * CELL;
const H = ROWS * CELL;
const BREAK_GOLD = 30;
const STREAK_GOLD = 5;
const STREAK_GOLD_MAX = 40;

interface BreakQuestion {
  subjectId: string;
  subjectName: string;
  question: RealmQuestion;
  picked: number | null;
}

function randomQuestion(): BreakQuestion | null {
  const subjects = realmStore.get().curriculum?.subjects ?? [];
  if (subjects.length === 0) return null;
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const pool = buildQuestionPool(subject);
  if (pool.length === 0) return null;
  const question = pool[Math.floor(Math.random() * Math.min(pool.length, 12))];
  return { subjectId: subject.id, subjectName: subject.name, question, picked: null };
}

export function TowerDefence({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<TDState>(newGame());
  const [started, setStarted] = useState(false);
  const [tool, setTool] = useState<TowerKind>("lamp");
  const [speed, setSpeed] = useState(1);
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null);
  const [studyBreak, setStudyBreak] = useState<BreakQuestion | null>(null);
  const [breakUsedForWave, setBreakUsedForWave] = useState(-1);
  const paid = useRef(false);
  const focus = useRealm((s) => s.progress.focus);
  const bestWave = useRealm((s) => s.progress.counters.tdBestWave ?? 0);
  const streakGold = useMemo(() => Math.min(STREAK_GOLD_MAX, liveStreak(realmStore.get()) * STREAK_GOLD), []);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const begin = () => {
    if (!spendFocus(FOCUS.cost.arcade, "defend against Procrastination")) return;
    game.current = newGame();
    game.current.gold += streakGold;
    paid.current = false;
    setBreakUsedForWave(-1);
    setStarted(true);
    emit({ type: "sound", name: "quest" });
  };

  // Pays out once when a run ends.
  const settle = (s: TDState) => {
    if (paid.current) return;
    paid.current = true;
    const coins = runReward(s);
    if (coins > 0) addCoinsPublic(coins);
    if (s.wave > (realmStore.get().progress.counters.tdBestWave ?? 0)) {
      realmStore.set((st) => ({ ...st, progress: { ...st.progress, counters: { ...st.progress.counters, tdBestWave: s.wave } } }));
    }
    if (s.over === "won") bumpCounter("tdWins");
    emit({ type: "sound", name: s.over === "won" ? "victory" : "defeat" });
    chat(
      s.over === "won"
        ? `You held the desk against all ${WAVE_PLAN.length} waves of Procrastination. +${coins} coins.`
        : `Procrastination broke through on wave ${s.wave + 1}. You held ${s.wave} wave${s.wave === 1 ? "" : "s"}${coins ? `: +${coins} coins` : ""}.`,
      "quest",
    );
  };

  // Simulation and drawing.
  useEffect(() => {
    if (!started) return;
    let raf = 0;
    let last = performance.now();
    let lastSig = "";
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = game.current;
      const dt = Math.min(0.05, (now - last) / 1000) * speedRef.current;
      last = now;
      if (!s.over) {
        // Fixed small steps keep fast creeps from skipping tower ranges.
        let left = dt;
        while (left > 0) {
          const d = Math.min(0.02, left);
          step(s, d);
          left -= d;
        }
        if (s.over) settle(s);
      }
      draw(canvas.current, s, hoverRef.current, toolRef.current);
      // Re-render the controls only when what they show changes.
      const sig = `${s.gold}|${s.lives}|${s.wave}|${s.waveActive}|${s.over}`;
      if (sig !== lastSig) {
        lastSig = sig;
        setTick((t) => (t + 1) % 1_000_000);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    return c >= 0 && r >= 0 && c < COLS && r < ROWS ? { c, r } : null;
  };

  const onCanvasClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = game.current;
    const cell = cellAt(e);
    if (!cell || s.over) return;
    if (s.towers.some((t) => t.c === cell.c && t.r === cell.r)) {
      if (e.shiftKey || e.button === 2) {
        sell(s, cell.c, cell.r);
        emit({ type: "sound", name: "click" });
      }
      return;
    }
    if (build(s, tool, cell.c, cell.r)) emit({ type: "sound", name: "click" });
    else emit({ type: "sound", name: "miss" });
  };

  const s = game.current;
  const canBreak = started && !s.over && !s.waveActive && s.wave > 0 && breakUsedForWave !== s.wave;

  const openBreak = () => {
    const q = randomQuestion();
    if (!q) {
      chat("Add some subjects with questions first. The study break draws on your own course.");
      return;
    }
    setBreakUsedForWave(s.wave);
    setStudyBreak(q);
  };

  const answerBreak = (i: number) => {
    if (!studyBreak || studyBreak.picked !== null) return;
    const right = i === studyBreak.question.answerIndex;
    setStudyBreak({ ...studyBreak, picked: i });
    recordAnswer(studyBreak.subjectId, studyBreak.question, right);
    if (right) {
      game.current.gold += BREAK_GOLD;
      emit({ type: "sound", name: "hit" });
    } else {
      recordMistake(studyBreak.subjectId, studyBreak.question);
      emit({ type: "sound", name: "miss" });
    }
  };

  return (
    <Window title="Siege of Procrastination" onClose={onClose} width={760} className="td-window">
      {!started ? (
        <div className="td-intro">
          <p>
            Distractions are marching on your desk. Build study tools along the path to stop them. Hold all {WAVE_PLAN.length} waves to win.
          </p>
          <ul className="td-legend">
            {(Object.keys(TOWERS) as TowerKind[]).map((k) => (
              <li key={k}>
                <span className="ico" style={{ color: TOWERS[k].color }}>
                  <Icon name={siegeIcon(k)} />
                </span>{" "}
                <b>{TOWERS[k].name}</b> ({TOWERS[k].cost}g): {TOWERS[k].blurb}
              </li>
            ))}
          </ul>
          <p className="muted small">
            Enemies: {Object.values(CREEPS).map((c) => c.name).join(" · ")}
          </p>
          <p className="muted small">
            Study bonuses: your streak adds {streakGold} starting gold ({STREAK_GOLD} per day, up to {STREAK_GOLD_MAX}). Between waves, take a study break: answer a question
            from your subjects for +{BREAK_GOLD} gold.
          </p>
          <div className="row">
            <button type="button" className="rs-button" onClick={begin} disabled={focus < FOCUS.cost.arcade}>
              Defend the desk · {FOCUS.cost.arcade} Focus
            </button>
            <span className="muted small">You have {focus} Focus · best: {bestWave} wave{bestWave === 1 ? "" : "s"}</span>
          </div>
        </div>
      ) : (
        <div className="td-game">
          <div className="td-bar">
            <span title="Gold">
              <Icon name="coin" /> {s.gold}
            </span>
            <span title="Lives">
              <Icon name="heart" /> {s.lives}
            </span>
            <span>
              Wave {Math.min(s.wave + (s.waveActive ? 1 : 0), WAVE_PLAN.length) || 0}/{WAVE_PLAN.length}
            </span>
            <span className="grow" />
            <button type="button" className="rs-button secondary small" onClick={() => setSpeed(speed === 1 ? 2 : 1)} aria-pressed={speed === 2}>
              <Icon name={speed === 2 ? "fast" : "play"} /> {speed === 2 ? "2×" : "1×"}
            </button>
            <button type="button" className="rs-button small" onClick={() => startWave(s)} disabled={s.waveActive || Boolean(s.over)}>
              {s.waveActive ? "Wave under way…" : s.wave === 0 ? "Start wave 1" : `Next wave (${s.wave + 1})`}
            </button>
          </div>
          <canvas
            ref={canvas}
            width={W}
            height={H}
            className="td-canvas"
            onPointerMove={(e) => setHover(cellAt(e))}
            onPointerLeave={() => setHover(null)}
            onPointerDown={onCanvasClick}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Tower defence board. Click an empty grass square to build the selected tool; shift-click or right-click a tool to sell it for half price."
          />
          <div className="td-tools" role="radiogroup" aria-label="Study tool to build">
            {(Object.keys(TOWERS) as TowerKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={tool === k}
                className={`td-tool ${tool === k ? "on" : ""}`}
                onClick={() => setTool(k)}
                disabled={s.gold < TOWERS[k].cost && tool !== k}
              >
                <span className="ico" style={{ color: TOWERS[k].color }}>
                  <Icon name={siegeIcon(k)} />
                </span>
                <b>{TOWERS[k].name}</b>
                <small>{TOWERS[k].cost}g</small>
              </button>
            ))}
            <button type="button" className="td-tool break" onClick={openBreak} disabled={!canBreak}>
              <span className="ico">
                <Icon name="bookOpen" />
              </span>
              <b>Study break</b>
              <small>+{BREAK_GOLD}g</small>
            </button>
          </div>
          <p className="muted small">Shift-click or right-click a tool to sell it for half price.</p>
          {studyBreak ? (
            <div className="td-break" role="dialog" aria-label="Study break question">
              <p className="muted small">Study break · {studyBreak.subjectName}</p>
              <p className="q">{studyBreak.question.prompt}</p>
              <div className="choices">
                {studyBreak.question.choices.map((choice, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`rs-button secondary ${studyBreak.picked !== null && i === studyBreak.question.answerIndex ? "right" : ""} ${studyBreak.picked === i && i !== studyBreak.question.answerIndex ? "wrong" : ""}`}
                    onClick={() => answerBreak(i)}
                    disabled={studyBreak.picked !== null}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {studyBreak.picked !== null ? (
                <>
                  <p className="small">
                    {studyBreak.picked === studyBreak.question.answerIndex ? `Right. +${BREAK_GOLD} gold.` : "Not quite. It's in your Grimoire for review."} {studyBreak.question.explanation}
                  </p>
                  <button type="button" className="rs-button small" onClick={() => setStudyBreak(null)}>
                    Back to the siege
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {s.over ? (
            <div className="td-over">
              <h3>{s.over === "won" ? "The desk holds" : "Procrastination wins this round"}</h3>
              <p>
                Waves held: {s.wave} · distractions stopped: {s.killed} · reward: {runReward(s)} coins
              </p>
              <div className="row">
                <button type="button" className="rs-button" onClick={begin} disabled={focus < FOCUS.cost.arcade}>
                  Play again · {FOCUS.cost.arcade} Focus
                </button>
                <button type="button" className="rs-button secondary" onClick={onClose}>
                  Leave
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Window>
  );
}

function draw(el: HTMLCanvasElement | null, s: TDState, hover: { c: number; r: number } | null, tool: TowerKind): void {
  const ctx = el?.getContext("2d");
  if (!ctx) return;
  // Ground.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const path = onPath(c, r);
      ctx.fillStyle = path ? ((c + r) % 2 ? "#b88a55" : "#c29560") : (c + r) % 2 ? "#5d8a3c" : "#669443";
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  // Path edging.
  ctx.strokeStyle = "rgba(60,40,20,0.35)";
  ctx.lineWidth = 2;
  for (const [c, r] of PATH) ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
  // The desk at the end of the path.
  const [ec, er] = PATH[PATH.length - 1];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawIcon(ctx, "library", ec * CELL + CELL / 2, er * CELL + CELL / 2, CELL * 0.7, "#f3ecdc", 2);

  // Hover preview with range.
  if (hover && !s.over) {
    const ok = canBuild(s, tool, hover.c, hover.r);
    const existing = s.towers.find((t) => t.c === hover.c && t.r === hover.r);
    const spec = TOWERS[existing?.kind ?? tool];
    ctx.fillStyle = existing ? "rgba(255,255,255,0.15)" : ok ? "rgba(255,255,255,0.22)" : "rgba(255,60,60,0.25)";
    ctx.fillRect(hover.c * CELL, hover.r * CELL, CELL, CELL);
    if (existing || ok) {
      ctx.beginPath();
      ctx.arc((hover.c + 0.5) * CELL, (hover.r + 0.5) * CELL, spec.range * CELL, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,240,200,0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,200,0.6)";
      ctx.stroke();
    }
  }

  // Towers.
  for (const t of s.towers) {
    const spec = TOWERS[t.kind];
    const x = (t.c + 0.5) * CELL;
    const y = (t.r + 0.5) * CELL;
    ctx.beginPath();
    ctx.arc(x, y + 3, CELL * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, CELL * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2a1c";
    ctx.fill();
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    drawIcon(ctx, siegeIcon(t.kind), x, y, CELL * 0.48, spec.color, 2.2);
  }

  // Shots.
  for (const sh of s.shots) {
    ctx.strokeStyle = sh.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sh.x1 * CELL, sh.y1 * CELL);
    ctx.lineTo(sh.x2 * CELL, sh.y2 * CELL);
    ctx.stroke();
  }

  // Creeps.
  for (const c of s.creeps) {
    const spec = CREEPS[c.kind];
    const p = creepPos(c.dist);
    const x = p.x * CELL;
    const y = p.y * CELL;
    const size = c.kind === "panic" ? CELL * 0.75 : CELL * 0.5;
    if (s.time < c.slowUntil) {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(127,216,255,0.35)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12,14,22,0.88)";
    ctx.fill();
    drawIcon(ctx, siegeIcon(c.kind), x, y, size * 0.72, spec.color, 2.2);
    // Health bar.
    const bw = size * 0.9;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - bw / 2, y - size * 0.7, bw, 4);
    ctx.fillStyle = c.hp / c.max > 0.5 ? "#5fd35f" : c.hp / c.max > 0.25 ? "#ffcf3a" : "#ff5a4a";
    ctx.fillRect(x - bw / 2, y - size * 0.7, bw * Math.max(0, c.hp / c.max), 4);
  }
}
