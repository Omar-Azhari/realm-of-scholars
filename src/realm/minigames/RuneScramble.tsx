/** Unscramble the runes: rebuild a key term from shuffled letters, using its definition as the clue. */

import { useMemo, useState } from "react";
import { Window } from "../hud/Window";
import { buildTermPool, shuffle } from "../curriculum/questionBank";
import { recordMinigameWin } from "../state/actions";
import { emit } from "../state/events";
import { XP_REWARDS } from "../xp";
import type { RealmSubject } from "../types";

const ROUNDS = 5;

function normalize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function scramble(word: string): string[] {
  const letters = word.split("");
  for (let tries = 0; tries < 8; tries++) {
    const mixed = shuffle(letters);
    if (mixed.join("") !== word) return mixed;
  }
  return letters.reverse();
}

export function RuneScramble({ subject, onClose }: { subject: RealmSubject; onClose: () => void }) {
  const terms = useMemo(
    () =>
      buildTermPool(subject)
        .filter((t) => {
          const n = normalize(t.term);
          return n.length >= 3 && n.length <= 16;
        })
        .slice(0, ROUNDS),
    [subject],
  );
  const [round, setRound] = useState(0);
  const [solved, setSolved] = useState(0);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<"right" | "wrong" | "revealed" | null>(null);
  const [xp, setXp] = useState<number | null>(null);

  const current = terms[round];
  const answer = current ? normalize(current.term) : "";
  const runes = useMemo(() => (current ? scramble(answer) : []), [current, answer]);

  if (terms.length < 2) {
    return (
      <Window title="Rune altar" onClose={onClose}>
        <p>The runes are silent. This subject needs key terms before the altar can test you.</p>
      </Window>
    );
  }

  const finish = (finalSolved: number) => {
    if (finalSolved === 0) {
      setXp(0);
      return;
    }
    emit({ type: "sound", name: "victory" });
    setXp(recordMinigameWin(subject.id, finalSolved * XP_REWARDS.runeScramblePerWord, null, "the rune altar"));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback) return;
    if (normalize(guess) === answer) {
      setFeedback("right");
      setSolved((s) => s + 1);
      emit({ type: "sound", name: "coin" });
    } else {
      setFeedback("wrong");
      emit({ type: "sound", name: "miss" });
    }
  };

  const next = () => {
    const finalSolved = solved;
    if (round + 1 >= terms.length) finish(finalSolved);
    else {
      setRound((r) => r + 1);
      setGuess("");
      setFeedback(null);
    }
  };

  return (
    <Window title={`Rune altar · ${subject.name}`} onClose={onClose} width={600}>
      {xp !== null ? (
        <div className={`duel-result ${xp > 0 ? "won" : "lost"}`}>
          <p className="big">{xp > 0 ? "The altar glows with approval." : "The runes fade, unread."}</p>
          <p>
            Solved {solved}/{terms.length}.{xp > 0 ? ` You gained ${xp} ${subject.name} XP.` : " Study the codex and return."}
          </p>
          <button type="button" className="rs-button" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Rune {round + 1} of {terms.length}
          </p>
          <p className="rune-clue">“{current.definition}”</p>
          <div className="rune-tiles" aria-label="Scrambled letters">
            {runes.map((letter, i) => (
              <span key={i} className="rune">
                {letter}
              </span>
            ))}
          </div>
          <form onSubmit={submit} className="rune-form">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type the term"
              autoFocus
              disabled={feedback !== null}
              aria-label="Your answer"
            />
            {feedback === null ? (
              <>
                <button type="submit" className="rs-button">
                  Speak the word
                </button>
                <button type="button" className="rs-button secondary" onClick={() => setFeedback("revealed")}>
                  Reveal
                </button>
              </>
            ) : null}
          </form>
          {feedback ? (
            <div className="explain">
              <p>
                {feedback === "right" ? "Correct: " : feedback === "wrong" ? "Not quite. The answer is " : "The runes reveal: "}
                <strong>{current.term}</strong>
              </p>
              <button type="button" className="rs-button" onClick={next}>
                {round + 1 >= terms.length ? "Finish" : "Next rune"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </Window>
  );
}
