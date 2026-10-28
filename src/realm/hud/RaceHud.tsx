/**
 * Island Race HUD: the clock, gates passed, medal targets and a compass arrow
 * pointing at the next gate (relative to the camera, so "up" is ahead).
 */

import { useEffect, useState } from "react";
import { abandonRace, medalTimes, race } from "../arcade/race";
import { runtime, WALK_SPEED } from "../scene/runtime";
import { Icon } from "./icons";

interface View {
  time: number;
  next: number;
  total: number;
  arrow: number;
  dist: number;
  done: boolean;
  medals: { gold: number; silver: number; bronze: number };
}

export function RaceHud() {
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastDone = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const run = race.run;
      if (!run || run.done) {
        // Keep the final result on screen for a few seconds.
        if (run?.done && run.result && lastDone === 0) lastDone = performance.now();
        if (!run || !run.result || performance.now() - lastDone > 6000) setView((v) => (v ? null : v));
        else setView((v) => (v && v.done ? v : { ...(v ?? emptyView(run.gates.length)), time: run.result!.seconds, next: run.gates.length, done: true }));
        return;
      }
      lastDone = 0;
      const gate = run.gates[run.next];
      const dx = gate.x - runtime.player.x;
      const dz = gate.z - runtime.player.z;
      const yaw = runtime.camera.yaw;
      // Camera forward is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw).
      const ahead = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
      const right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
      setView({
        time: Math.floor(run.time * 10) / 10,
        next: run.next,
        total: run.gates.length,
        arrow: (Math.atan2(right, ahead) * 180) / Math.PI,
        dist: Math.round(Math.hypot(dx, dz)),
        done: false,
        medals: medalTimes(run.length, WALK_SPEED, run.sky),
      });
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!view) return null;
  const result = race.run?.result;
  return (
    <div className="rs-race-hud" role="status">
      <p className="clock">
        <Icon name="timer" /> {view.time.toFixed(1)}s
      </p>
      {view.done && result ? (
        <p className="result">
          {result.medal ? (
            <>
              <Icon name="medal" className={`medal-${result.medal}`} /> {result.medal[0].toUpperCase() + result.medal.slice(1)} medal
            </>
          ) : (
            "Finished"
          )}
          {result.best ? " · new best" : ""}
        </p>
      ) : (
        <>
          <p className="gates">
            Gate {view.next + 1} of {view.total} {view.next === view.total - 1 ? "· finish line" : ""}
          </p>
          <div className="compass" aria-label={`Next gate ${view.dist} tiles away`}>
            <span className="arrow" style={{ transform: `rotate(${view.arrow}deg)` }}>
              <Icon name="arrowUp" />
            </span>
            <small>{view.dist}m</small>
          </div>
          <p className="medals small">
            Gold {view.medals.gold}s · Silver {view.medals.silver}s · Bronze {view.medals.bronze}s
          </p>
          <button type="button" className="link small" onClick={abandonRace}>
            Give up
          </button>
        </>
      )}
    </div>
  );
}

function emptyView(total: number): View {
  return { time: 0, next: 0, total, arrow: 0, dist: 0, done: true, medals: { gold: 0, silver: 0, bronze: 0 } };
}
