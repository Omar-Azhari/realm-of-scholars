/**
 * The spellbook (every spell your studied weeks have unlocked, with what it
 * does and how strong it is) and the spell bar shown during fights.
 */

import { useEffect, useState } from "react";
import { Window } from "./Window";
import { realmStore, useRealm } from "../state/store";
import { knownSpells, spellAmount, spellBar, SPELL_KINDS, type Spell } from "../life/spells";
import { combat } from "../combat/combat";
import { runtime } from "../scene/runtime";
import { Icon, spellIcon } from "./icons";

function describe(s: Spell): string {
  const amount = spellAmount(s.kind, s.power);
  if (s.kind === "bolt") return `Deals about ${amount}.`;
  if (s.kind === "blast") return `About ${amount} to everything near the target.`;
  if (s.kind === "mend") return `Heals about ${amount}.`;
  return SPELL_KINDS[s.kind].blurb;
}

export function SpellbookWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const known = knownSpells(state);
  const bar = spellBar(state);
  const [slot, setSlot] = useState(0);
  const equip = (id: string) =>
    realmStore.set((s) => {
      const next = [0, 1, 2, 3].map((i) => bar[i]?.id ?? "");
      for (let i = 0; i < 4; i++) if (next[i] === id) next[i] = "";
      next[slot] = id;
      return { ...s, progress: { ...s.progress, spellbar: next } };
    });
  return (
    <Window title="Spellbook" onClose={onClose} width={720} className="spellbook-window">
      <p className="muted small">
        Every week you study at its waystone teaches a spell named after that week&apos;s material. Answer its questions well (and master it with three wins) to make
        the spell stronger. Cast with <kbd>1</kbd>–<kbd>4</kbd> near a monster.
      </p>
      <div className="spellbar edit" role="radiogroup" aria-label="Spell bar slot to fill">
        {bar.map((s, i) => (
          <button key={i} type="button" role="radio" aria-checked={slot === i} className={`slot ${slot === i ? "on" : ""}`} onClick={() => setSlot(i)}>
            <kbd>{i + 1}</kbd>
            <span className="ico">{s ? <Icon name={spellIcon(s.kind)} /> : null}</span>
            <small>{s ? s.name : "Empty"}</small>
          </button>
        ))}
      </div>
      {known.length === 0 ? (
        <p>No spells yet. Study a week at its waystone to learn your first.</p>
      ) : (
        <ul className="spell-list">
          {known.map((s) => (
            <li key={s.id}>
              <span className="ico" style={{ color: SPELL_KINDS[s.kind].color }}>
                <Icon name={spellIcon(s.kind)} />
              </span>
              <span className="text">
                <b>{s.name}</b>
                <small>
                  {SPELL_KINDS[s.kind].label} · power {s.power}/10 · {s.subjectName}, week {s.week}. {describe(s)}
                </small>
              </span>
              <button type="button" className="rs-button small" onClick={() => equip(s.id)} disabled={bar[slot]?.id === s.id}>
                Slot {slot + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Window>
  );
}

/** Spell bar with cooldown shading; click a slot (or press 1-4) to cast. */
export function SpellBar({ onOpenBook }: { onOpenBook: () => void }) {
  const ids = useRealm((s) => spellBar(s).map((x) => x?.id ?? "").join("|"));
  const state = useRealm((s) => s);
  const list = spellBar(state);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, []);
  if (!ids.replace(/\|/g, "")) return null;
  return (
    <div className="spellbar">
      {list.map((s, i) => {
        const ready = s ? combat.spellReady[s.id] ?? 0 : 0;
        const left = Math.max(0, ready - combat.time);
        const total = s ? SPELL_KINDS[s.kind].cooldown : 1;
        return (
          <button key={i} type="button" className="slot" disabled={!s} onClick={() => runtime.castSlot?.(i)} title={s ? `${s.name} (${SPELL_KINDS[s.kind].label}, power ${s.power})` : "Empty"}>
            <kbd>{i + 1}</kbd>
            <span className="ico">{s ? <Icon name={spellIcon(s.kind)} /> : null}</span>
            {left > 0 ? <span className="cd" style={{ height: `${(left / total) * 100}%` }} /> : null}
          </button>
        );
      })}
      <button type="button" className="slot book" onClick={onOpenBook} title="Spellbook">
        <Icon name="book" />
      </button>
    </div>
  );
}
