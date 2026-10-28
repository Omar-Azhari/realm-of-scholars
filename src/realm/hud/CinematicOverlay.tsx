/**
 * Letterbox bars and narrator lines over a fly-over. Any key skips.
 */

import { useEffect, useState } from "react";
import { cinematic, cinematicProgress, endCinematic } from "../scene/cinematic";

export function CinematicOverlay() {
  const [view, setView] = useState<{ line: string; key: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = cinematicProgress();
      const c = cinematic.current;
      if (t === null || !c) {
        setView((v) => (v ? null : v));
        return;
      }
      const i = Math.min(c.lines.length - 1, Math.floor(t * c.lines.length));
      setView((v) => (v && v.key === i ? v : { line: c.lines[i], key: i }));
    };
    raf = requestAnimationFrame(loop);
    const skip = (e: KeyboardEvent) => {
      if (cinematic.current && e.key !== "Shift") endCinematic();
    };
    window.addEventListener("keydown", skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
    };
  }, []);
  if (!view) return null;
  return (
    <div className="rs-cinematic" role="status">
      <div className="bar top" />
      <div className="bar bottom">
        <p key={view.key} className="line">
          {view.line}
        </p>
        <button type="button" className="skip" onClick={endCinematic}>
          Skip <kbd>Any key</kbd>
        </button>
      </div>
    </div>
  );
}
