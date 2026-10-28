/**
 * Pieces every Arena game shares: the rank badge, the live score header,
 * the result screen, a ticking clock and forfeit-on-leave.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealmSubject } from "../types";
import { rankFor, type ArenaRival, type MatchOutcome } from "./rating";
import type { MatchReport } from "./record";
import { Icon } from "../hud/icons";

/** Props every game component takes. */
export interface ArenaGameProps {
  subject: RealmSubject;
  rival: ArenaRival;
  /** Back to the Arena hub. */
  onBack: () => void;
  /** Same game, same rival, fresh match. */
  onAgain: () => void;
}

export function RankBadge({ rating, compact = false }: { rating: number; compact?: boolean }) {
  const rank = rankFor(rating);
  return (
    <span className={`arena-rank arena-rank-${rank.tier.id}${compact ? " compact" : ""}`} title={`${rank.label} · ${rating}`}>
      <span className="gem" aria-hidden="true" />
      {compact ? rank.tier.name : rank.label}
    </span>
  );
}

/** Re-renders every `interval` ms while active; returns the current time. */
export function useNow(active: boolean, interval = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [active, interval]);
  return now;
}

/** Leaving a ranked match after it has started counts as a loss (no quitting to dodge a defeat). */
export function useForfeit(live: boolean, onForfeit: () => void): void {
  const ref = useRef({ live, onForfeit });
  useEffect(() => {
    ref.current = { live, onForfeit };
  });
  useEffect(
    () => () => {
      if (ref.current.live) ref.current.onForfeit();
    },
    [],
  );
}

export function formatSeconds(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : `${s.toFixed(s < 10 ? 1 : 0)}s`;
}

/** You vs the rival, with live scores. */
export function MatchHeader({ you, rival, yourScore, rivalScore, middle }: { you: string; rival: ArenaRival; yourScore: ReactNode; rivalScore: ReactNode; middle?: ReactNode }) {
  return (
    <div className="arena-vs">
      <div className="side you">
        <span className="who">{you}</span>
        <span className="score">{yourScore}</span>
      </div>
      <div className="mid">{middle ?? <span className="vs">VS</span>}</div>
      <div className="side rival">
        <span className="who">
          {rival.name} <RankBadge rating={rival.rating} compact />
        </span>
        <span className="score">{rivalScore}</span>
      </div>
    </div>
  );
}

const OUTCOME_TEXT: Record<MatchOutcome, string> = { win: "Victory", loss: "Defeat", draw: "Draw" };

interface MatchResultProps {
  /** Null for an unranked practice game. */
  report: MatchReport | null;
  outcome: MatchOutcome | null;
  rival: ArenaRival | null;
  yourScore: number;
  rivalScore: number | null;
  children?: ReactNode;
  onAgain: () => void;
  onBack: () => void;
  againLabel?: string;
}

export function MatchResult({ report, outcome, rival, yourScore, rivalScore, children, onAgain, onBack, againLabel = "Rematch" }: MatchResultProps) {
  return (
    <div className={`arena-result ${outcome ?? "practice"}`}>
      <p className="arena-result-title">{outcome ? OUTCOME_TEXT[outcome] : "Practice complete"}</p>
      <div className="arena-result-scores">
        <div>
          <span className="label">You</span>
          <span className="value">{yourScore.toLocaleString()}</span>
        </div>
        {rival && rivalScore !== null ? (
          <div>
            <span className="label">{rival.name}</span>
            <span className="value">{rivalScore.toLocaleString()}</span>
          </div>
        ) : null}
      </div>
      {report ? (
        <div className="arena-result-rating">
          <RankBadge rating={report.after} />
          <span className="rating">{report.after}</span>
          <span className={`delta ${report.delta >= 0 ? "up" : "down"}`}>
            <Icon name={report.delta >= 0 ? "arrowUp" : "arrowDown"} /> {report.delta >= 0 ? "+" : ""}
            {report.delta}
          </span>
          {report.promoted ? <span className="arena-flag promo">Promoted to {report.rankAfter.label}</span> : null}
          {report.demoted ? <span className="arena-flag demo">Dropped to {report.rankAfter.label}</span> : null}
          {report.newBest ? <span className="arena-flag best">New personal best</span> : null}
          {report.streak >= 2 ? <span className="arena-flag streak">{report.streak} wins in a row</span> : null}
        </div>
      ) : (
        <p className="muted small">Unranked: no rating change and no rewards.</p>
      )}
      {report ? (
        <p className="arena-rewards">
          {report.reward.xp > 0 ? <span className="chip">+{report.reward.xp} XP</span> : null}
          {report.reward.coins > 0 ? <span className="chip">+{report.reward.coins} coins</span> : null}
          {report.reward.focus > 0 ? <span className="chip focus">+{report.reward.focus} Focus upset bonus</span> : null}
          {report.reward.capped ? <span className="muted small">Today's arena rewards are capped. Real study pays more.</span> : null}
        </p>
      ) : null}
      {children}
      <div className="row">
        <button type="button" className="rs-button" onClick={onAgain} autoFocus>
          {againLabel}
        </button>
        <button type="button" className="rs-button secondary" onClick={onBack}>
          Back to the Arena
        </button>
      </div>
    </div>
  );
}

/** "You need more material" notice. */
export function NotEnough({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="arena-empty">
      <p>{children}</p>
      <button type="button" className="rs-button secondary" onClick={onBack}>
        Back to the Arena
      </button>
    </div>
  );
}

/** True when a key press is aimed at a button or field (which handles Enter/Space itself). */
export function isControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

/** Decides a scored match: higher score wins, equal is a draw. */
export function compareScores(you: number, rival: number): MatchOutcome {
  return you > rival ? "win" : you < rival ? "loss" : "draw";
}
