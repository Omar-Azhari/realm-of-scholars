/**
 * Loading screen shown while the island and its models load, instead of a
 * black canvas. Tracks real model downloads (three.js loading manager via
 * drei's useProgress) and waits for the scene to mount, then fades out.
 */

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { runtime } from "../scene/runtime";

const TIPS = [
  "Study a waystone, then win its trial. The ideas stick better the second time.",
  "Questions you miss come back in the Grimoire 1, 3 and 7 days later.",
  "A deadline boss rises a week before each assessment is due.",
  "Record your marks in the library to see your WAM and what you need for an A.",
  "Explain a concept back to your tutor. If you can teach it, you know it.",
  "Short daily study beats one long cram: keep your streak alive.",
  "Import your Moodle deadlines so quests show the real due dates.",
];

export function SceneLoader({ placeName }: { placeName: string }) {
  const { progress, active } = useProgress();
  const [mounted, setMounted] = useState(false);
  const [gone, setGone] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    if (mounted) return;
    const id = window.setInterval(() => {
      if (runtime.objects.length > 0) setMounted(true);
    }, 150);
    return () => window.clearInterval(id);
  }, [mounted]);

  const done = mounted && (!active || progress >= 100);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setGone(true), 700);
    return () => window.clearTimeout(id);
  }, [done]);
  // Never trap the player behind the loader: give up waiting on slow models after 20 seconds.
  useEffect(() => {
    const id = window.setTimeout(() => setGone(true), 20_000);
    return () => window.clearTimeout(id);
  }, []);

  if (gone) return null;
  const shown = mounted ? Math.max(progress, 5) : Math.min(progress, 90);
  return (
    <div className={`rs-loader ${done ? "leaving" : ""}`} role="status" aria-live="polite">
      <div className="rs-loader-card">
        <div className="crest" aria-hidden="true">
          <img src="/icons/icon-192.png" alt="" width={72} height={72} />
        </div>
        <p className="title">{placeName}</p>
        <div className="bar" aria-label={`Loading ${Math.round(shown)}%`}>
          <span style={{ width: `${shown}%` }} />
        </div>
        <p className="tip">
          <strong>Tip:</strong> {tip}
        </p>
      </div>
    </div>
  );
}
