/** Memory pairs: match each term scroll to its meaning scroll. */

import { useEffect, useMemo, useState } from "react";
import { Window } from "../hud/Window";
import { buildTermPool, shuffle } from "../curriculum/questionBank";
import { recordMinigameWin } from "../state/actions";
import { emit } from "../state/events";
import { XP_REWARDS } from "../xp";
import type { RealmSubject } from "../types";
import { Icon } from "../hud/icons";

interface Card {
  id: number;
  pair: number;
  text: string;
  kind: "term" | "definition";
}

export function ScrollMatch({ subject, onClose }: { subject: RealmSubject; onClose: () => void }) {
  const cards = useMemo<Card[]>(() => {
    const terms = buildTermPool(subject).slice(0, 6);
    return shuffle(
      terms.flatMap((t, i) => [
        { id: i * 2, pair: i, text: t.term, kind: "term" as const },
        { id: i * 2 + 1, pair: i, text: t.definition, kind: "definition" as const },
      ]),
    );
  }, [subject]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [xp, setXp] = useState<number | null>(null);
  const pairs = cards.length / 2;

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((id) => cards.find((c) => c.id === id)!);
    const timer = window.setTimeout(
      () => {
        if (a.pair === b.pair) {
          setMatched((m) => new Set(m).add(a.pair));
          emit({ type: "sound", name: "coin" });
        }
        setOpen([]);
      },
      a.pair === b.pair ? 250 : 900,
    );
    return () => window.clearTimeout(timer);
  }, [open, cards]);

  useEffect(() => {
    if (pairs > 0 && matched.size === pairs && xp === null) {
      const efficiency = Math.max(0.5, Math.min(1.3, (pairs * 1.6) / Math.max(1, moves)));
      setXp(recordMinigameWin(subject.id, Math.round(XP_REWARDS.scrollMatch * efficiency), null, "the scroll table"));
      emit({ type: "sound", name: "victory" });
    }
  }, [matched, pairs, moves, subject.id, xp]);

  if (pairs < 3) {
    return (
      <Window title="Scroll table" onClose={onClose}>
        <p>Too few scrolls lie here. This subject needs key terms or weekly topics before you can play.</p>
      </Window>
    );
  }

  const flip = (card: Card) => {
    if (open.length >= 2 || open.includes(card.id) || matched.has(card.pair)) return;
    if (open.length === 1) setMoves((m) => m + 1);
    setOpen((o) => [...o, card.id]);
  };

  return (
    <Window title={`Scroll table · ${subject.name}`} onClose={onClose} width={720}>
      <p className="muted">Pair every term with its meaning. Fewer attempts earn more experience.</p>
      <div className="scroll-grid">
        {cards.map((card) => {
          const shown = open.includes(card.id) || matched.has(card.pair);
          return (
            <button
              key={card.id}
              type="button"
              className={`scroll-card ${shown ? "shown" : ""} ${matched.has(card.pair) ? "matched" : ""} ${card.kind}`}
              onClick={() => flip(card)}
              aria-label={shown ? card.text : "Hidden scroll"}
            >
              {shown ? card.text : <Icon name="quests" />}
            </button>
          );
        })}
      </div>
      <p className="scroll-status">
        Matched {matched.size}/{pairs} · Attempts {moves}
      </p>
      {xp !== null ? (
        <div className="duel-result won">
          <p className="big">Every scroll is paired.</p>
          <p>
            You gained <strong>{xp} {subject.name} XP</strong>.
          </p>
          <button type="button" className="rs-button" onClick={onClose}>
            Done
          </button>
        </div>
      ) : null}
    </Window>
  );
}
