/**
 * Bits shared by the full-screen play games (archery and ping pong): keyboard capture,
 * the Focus notice, and the results card.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { PLAY_COST, type Medal, type PlayResult } from "../../state/playGames";
// The shared play-game styles (pg-*) live in archery.css; ping pong adds its own on top.
import "../../../styles/archery.css";

/**
 * Takes every key press while the game is open, so the campus underneath doesn't move,
 * open menus or chat. The handler gets keydown (down = true) and keyup (down = false).
 */
export function useCapturedKeys(handler: (e: KeyboardEvent, down: boolean) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      ref.current(e, true);
    };
    const onUp = (e: KeyboardEvent) => {
      e.stopPropagation();
      ref.current(e, false);
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, []);
}

export function focusShortfall(have: number, cost = PLAY_COST): string {
  return `You need ${cost} Focus to play and you have ${have}. Study a waystone, tick a quest step or review the Grimoire to earn more.`;
}

const MEDAL_LABEL: Record<Medal, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export function MedalBadge({ medal, size = "m" }: { medal: Medal | null; size?: "s" | "m" | "l" }) {
  if (!medal) return null;
  return (
    <span className={`pg-medal pg-medal-${medal} pg-medal-${size}`} title={`${MEDAL_LABEL[medal]} medal`}>
      <span className="pg-medal-disc" aria-hidden="true" />
      {size !== "s" ? MEDAL_LABEL[medal] : null}
    </span>
  );
}

export interface ResultsProps {
  title: string;
  subtitle: string;
  score: string;
  scoreLabel: string;
  result: PlayResult;
  bestLabel: string;
  details: Array<[string, string]>;
  medalHint: string;
  againLabel?: string;
  onAgain: () => void;
  onMenu: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ResultsCard(p: ResultsProps) {
  return (
    <div className="pg-panel pg-results" role="dialog" aria-label="Results">
      <p className="pg-kicker">{p.subtitle}</p>
      <h2 className="pg-title">{p.title}</h2>
      <div className="pg-score-row">
        <div className="pg-big-score">
          <span>{p.score}</span>
          <small>{p.scoreLabel}</small>
        </div>
        <div className="pg-medal-slot">
          {p.result.medal ? <MedalBadge medal={p.result.medal} size="l" /> : <span className="pg-no-medal">No medal</span>}
          {p.result.coins > 0 ? <span className="pg-coins">+{p.result.coins} coins</span> : null}
        </div>
      </div>
      <p className="pg-best">
        {p.result.newBest ? <strong className="pg-new-best">New personal best! </strong> : null}
        Best: {p.bestLabel}
      </p>
      <dl className="pg-details">
        {p.details.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {p.children}
      <p className="pg-hint">{p.medalHint}</p>
      <div className="pg-actions">
        <button type="button" className="pg-btn pg-btn-gold" onClick={p.onAgain} autoFocus>
          {p.againLabel ?? "Play again"}
        </button>
        <button type="button" className="pg-btn" onClick={p.onMenu}>
          Change settings
        </button>
        <button type="button" className="pg-btn pg-btn-quiet" onClick={p.onClose}>
          Back to campus
        </button>
      </div>
    </div>
  );
}
