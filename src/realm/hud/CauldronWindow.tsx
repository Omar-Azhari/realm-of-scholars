/**
 * The cauldron: pick a recipe, answer one question from your subjects to
 * brew it, then drink potions from here (or the Materials bag).
 */

import { useState } from "react";
import { Window } from "./Window";
import { realmStore, useRealm } from "../state/store";
import { brew, brewBlocker, buffMinutesLeft, drink, POTIONS, type Potion } from "../life/potions";
import { buildQuestionPool } from "../curriculum/questionBank";
import { recordAnswer } from "../state/stats";
import { recordMistake } from "../state/grimoire";
import type { RealmQuestion } from "../types";
import { Icon } from "./icons";

interface Pending {
  potion: Potion;
  subjectId: string;
  subjectName: string;
  question: RealmQuestion;
  picked: number | null;
}

export function CauldronWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const [pending, setPending] = useState<Pending | null>(null);

  const start = (p: Potion) => {
    const subjects = realmStore.get().curriculum?.subjects ?? [];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const pool = subject ? buildQuestionPool(subject) : [];
    if (!subject || pool.length === 0) return;
    setPending({ potion: p, subjectId: subject.id, subjectName: subject.name, question: pool[Math.floor(Math.random() * Math.min(pool.length, 15))], picked: null });
  };

  const answer = (i: number) => {
    if (!pending || pending.picked !== null) return;
    const right = i === pending.question.answerIndex;
    recordAnswer(pending.subjectId, pending.question, right);
    if (!right) recordMistake(pending.subjectId, pending.question);
    brew(pending.potion.id, right);
    setPending({ ...pending, picked: i });
  };

  return (
    <Window title="Cauldron" onClose={onClose} width={640} className="cauldron-window">
      {pending ? (
        <div className="brew-question">
          <p className="muted small">
            Brewing {pending.potion.name} · {pending.subjectName}: stir in the answer.
          </p>
          <p className="q">{pending.question.prompt}</p>
          <div className="choices">
            {pending.question.choices.map((c, i) => (
              <button
                key={i}
                type="button"
                className={`rs-button secondary ${pending.picked !== null && i === pending.question.answerIndex ? "right" : ""} ${pending.picked === i && i !== pending.question.answerIndex ? "wrong" : ""}`}
                disabled={pending.picked !== null}
                onClick={() => answer(i)}
              >
                {c}
              </button>
            ))}
          </div>
          {pending.picked !== null ? (
            <>
              <p className="small">
                {pending.picked === pending.question.answerIndex ? "The brew turns clear and bright." : "It curdles."} {pending.question.explanation}
              </p>
              <button type="button" className="rs-button small" onClick={() => setPending(null)}>
                Back to the cauldron
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <ul className="potion-list">
          {POTIONS.map((p) => {
            const blocker = brewBlocker(state, p.id);
            const have = state.progress.materials[p.id] ?? 0;
            const left = p.buff ? buffMinutesLeft(state, p.buff.id) : 0;
            return (
              <li key={p.id}>
                <span className="ico">
                  <Icon name="flask" />
                </span>
                <span className="text">
                  <b>{p.name}</b>
                  <small>
                    {p.blurb} Needs{" "}
                    {Object.entries(p.ingredients)
                      .map(([m, n]) => `${n} ${m}`)
                      .join(", ")}
                    .{left ? ` Active: ${left} min left.` : ""}
                  </small>
                </span>
                <button type="button" className="rs-button small" disabled={Boolean(blocker)} title={blocker ?? ""} onClick={() => start(p)}>
                  Brew
                </button>
                <button type="button" className="rs-button secondary small" disabled={have <= 0} onClick={() => drink(p.id)}>
                  Drink ({have})
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Window>
  );
}
