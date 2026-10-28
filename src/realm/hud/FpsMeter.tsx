/**
 * Frame-rate readout for checking performance on the demo laptop. Shown when the
 * page address has ?fps (e.g. http://localhost:5173/?fps). Reports the average
 * FPS and the worst frame of the last second.
 */

import { useEffect, useState } from "react";

export function fpsRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("fps");
  } catch {
    return false;
  }
}

export function FpsMeter() {
  const [stats, setStats] = useState({ fps: 0, worst: 0 });
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let worst = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      worst = Math.max(worst, dt);
      if (now - windowStart >= 1000) {
        setStats({ fps: Math.round((frames * 1000) / (now - windowStart)), worst: Math.round(worst) });
        windowStart = now;
        frames = 0;
        worst = 0;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const colour = stats.fps >= 50 ? "#7be08a" : stats.fps >= 30 ? "#ffd166" : "#ff7a7a";
  return (
    <div className="rs-fps" aria-hidden>
      <strong style={{ color: colour }}>{stats.fps} FPS</strong> · worst {stats.worst} ms
    </div>
  );
}
