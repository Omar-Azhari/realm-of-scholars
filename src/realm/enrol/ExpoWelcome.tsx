/**
 * The expo stand's welcome screen (see expo.ts): the spinning campus diorama
 * as key art, the wordmark, an optional name and one clear prompt. Doubles as
 * the attract screen: an idle stand comes back here by itself. Any key starts
 * the demo.
 */

import { useEffect, useRef, useState } from "react";
import { EnrolBackdrop } from "./EnrolBackdrop";
import { MenuFooter, Wordmark } from "./MainMenu";
import { startDemo } from "../expo";
import "../../styles/expo.css";

const SHOWCASE = [
  "Your real subjects become skills you level up.",
  "Walk into the lecture theatre. A professor teaches each week.",
  "Ranked study games against AI rivals.",
  "Assessments become quests. Deadlines become bosses.",
  "Built for La Trobe students first.",
];

export function ExpoWelcome() {
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const [line, setLine] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(false);
    if (!(await startDemo(name))) {
      setStarting(false);
      setError(true);
    }
  };
  const startRef = useRef(start);
  startRef.current = start;

  // Any key (outside the name box) or Enter in it starts the demo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target === input.current && e.key !== "Enter") return;
      if (e.key === "Tab" || e.key === "Shift") return;
      e.preventDefault();
      void startRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // One feature at a time, cycling, for people walking past.
  useEffect(() => {
    const id = window.setInterval(() => setLine((n) => (n + 1) % SHOWCASE.length), 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="enrol enrol-title expo-welcome">
      <EnrolBackdrop />
      <section className="rs-mainmenu">
        <Wordmark kicker="Campus IT Expo" />
        <p className="expo-showcase" aria-live="polite" key={line}>
          {SHOWCASE[line]}
        </p>
        <label className="expo-name">
          <span className="expo-name-label">Your name</span>
          <input ref={input} value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Optional" maxLength={24} autoComplete="off" spellCheck={false} />
        </label>
        <button type="button" className="expo-start" onClick={() => void start()} disabled={starting}>
          <span className="expo-start-text">{starting ? "Loading" : "Press any key to start"}</span>
        </button>
        {error ? <p className="expo-note">The demo didn&apos;t start. Press any key to try again.</p> : <p className="expo-note">Progress resets for each visitor.</p>}
      </section>
      <MenuFooter right="Campus IT Expo 2026" />
    </div>
  );
}
