/**
 * Focus meditation: a real study timer. XP is paid only when the real
 * time has elapsed — closing the window keeps the timer running.
 */

import { useEffect, useState } from "react";
import { Window } from "../hud/Window";
import { useRealm } from "../state/store";
import { cancelFocus, completeFocus, startFocus } from "../state/actions";
import { XP_REWARDS } from "../xp";
import type { RealmSubject } from "../types";

const LENGTHS = [15, 25, 45, 60];

export function Meditation({ subject, onClose }: { subject: RealmSubject; onClose: () => void }) {
  const focus = useRealm((s) => s.progress.activeFocus);
  const subjects = useRealm((s) => s.curriculum?.subjects);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!focus) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [focus]);

  if (focus) {
    const focusSubject = subjects?.find((s) => s.id === focus.subjectId);
    const total = focus.minutes * 60_000;
    const elapsed = now - new Date(focus.startedAt).getTime();
    const remaining = Math.max(0, total - elapsed);
    const done = remaining <= 0;
    const mm = Math.floor(remaining / 60_000);
    const ss = Math.floor((remaining % 60_000) / 1000);
    return (
      <Window title="Meditation shrine" onClose={onClose}>
        <p>
          You are meditating on <strong>{focusSubject?.name ?? "your studies"}</strong>.
        </p>
        <div className="focus-ring" style={{ ["--p" as string]: `${Math.min(1, elapsed / total) * 360}deg` }}>
          <span>{done ? "Complete" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}</span>
        </div>
        <p className="muted">Study away from the game. The candle keeps burning even if you close this window or the tab.</p>
        <div className="row">
          {done ? (
            <button
              type="button"
              className="rs-button"
              onClick={() => {
                completeFocus();
                onClose();
              }}
            >
              Claim {focus.minutes * XP_REWARDS.focusPerMinute} XP
            </button>
          ) : (
            <button
              type="button"
              className="rs-button secondary"
              onClick={() => {
                cancelFocus();
              }}
            >
              Break concentration
            </button>
          )}
        </div>
      </Window>
    );
  }

  return (
    <Window title="Meditation shrine" onClose={onClose}>
      <p>
        Sit by the still water and study <strong>{subject.name}</strong> for real. When the candle burns down, your
        focus becomes experience.
      </p>
      <div className="row wrap">
        {LENGTHS.map((minutes) => (
          <button key={minutes} type="button" className="rs-button" onClick={() => startFocus(subject.id, minutes)}>
            {minutes} min · {minutes * XP_REWARDS.focusPerMinute} XP
          </button>
        ))}
      </div>
    </Window>
  );
}
