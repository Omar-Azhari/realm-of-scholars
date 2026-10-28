/**
 * A secret door's riddle: read the definition, type the term. Hints reveal
 * more letters; a right answer opens the door for good.
 */

import { useMemo, useState } from "react";
import { Window } from "./Window";
import { realmStore, todayIso, useRealm } from "../state/store";
import { checkPassword, isOpen, openSecret, passwordHint, riddleFor } from "../state/secrets";
import { recordAnswer } from "../state/stats";

export function SecretDoorWindow({ doorId, onClose }: { doorId: string; onClose: () => void }) {
  const open = useRealm((s) => isOpen(s, doorId));
  const riddle = useMemo(() => riddleFor(realmStore.get(), doorId, todayIso()), [doorId]);
  const [guess, setGuess] = useState("");
  const [hints, setHints] = useState(1);
  const [wrong, setWrong] = useState(0);
  const [lore, setLore] = useState<string | null>(null);

  if (open && !lore) {
    return (
      <Window title="An open doorway" onClose={onClose} width={520}>
        <p>The secret room stands open, its chest already emptied. You read the old page again:</p>
        <p className="parchment lore">{openSecret(doorId)}</p>
      </Window>
    );
  }
  if (!riddle) {
    return (
      <Window title="A sealed door" onClose={onClose} width={520}>
        <p>Runes swirl on the stone, but they need key terms from your subjects to form a password. Add key terms in a subject&apos;s Codex first.</p>
      </Window>
    );
  }
  const submit = () => {
    const right = checkPassword(riddle.term.term, guess);
    recordAnswer(riddle.subjectId, { week: null }, right);
    if (right) setLore(openSecret(doorId));
    else {
      setWrong((w) => w + 1);
      setHints((h) => Math.min(h + 1, 4));
    }
  };
  return (
    <Window title={lore ? "The door opens" : "A sealed door"} onClose={onClose} width={560} className="secret-window">
      {lore ? (
        <>
          <p>The runes flare and the stone slides aside. A small chest holds coins and a page of lore:</p>
          <p className="parchment lore">{lore}</p>
        </>
      ) : (
        <>
          <p className="muted small">Runes from {riddle.subjectName} glow on the stone. Speak the word they describe:</p>
          <blockquote className="riddle">“{riddle.term.definition}”</blockquote>
          <p className="hint">
            Hint: <code>{passwordHint(riddle.term.term, hints)}</code>
          </p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type the term" autoFocus aria-label="Password" />
            <button type="submit" className="rs-button">
              Speak
            </button>
          </form>
          {wrong ? <p className="small">The runes dim. Not quite. Another letter appears in the hint.</p> : null}
        </>
      )}
    </Window>
  );
}
