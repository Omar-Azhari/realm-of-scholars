/**
 * Combat HUD: the player's health bar (shown while fighting or hurt), the
 * quick-eat hint, the dungeon wave tracker, and a red flash when hit.
 */

import { useEffect, useRef, useState } from "react";
import { combat, playerEat, WAVES } from "../combat/combat";
import { useRealm } from "../state/store";
import { bestFood } from "../state/life";
import { food } from "../life/catalog";
import { SpellBar } from "./Spellbook";
import { Icon } from "./icons";

interface View {
  hp: number;
  max: number;
  show: boolean;
  wave: string | null;
  hitAt: number;
}

export function CombatHud({ onOpenSpellbook }: { onOpenSpellbook: () => void }) {
  const [view, setView] = useState<View>({ hp: 30, max: 30, show: false, wave: null, hitAt: -99 });
  const best = useRealm((s) => bestFood(s));
  const foodCount = useRealm((s) => (best ? s.progress.materials[best] ?? 0 : 0));
  const flash = useRef<HTMLDivElement>(null);
  const lastHit = useRef(-99);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = combat.player;
      const run = combat.dungeon && !combat.dungeon.done ? combat.dungeon : null;
      const fighting = combat.enemies.some((e) => e.state === "chase");
      const next: View = {
        hp: Math.round(p.hp),
        max: p.max,
        show: fighting || p.hp < p.max || Boolean(run),
        wave: run ? (run.nextWaveAt !== null && run.wave === 0 ? "The crypt awakens…" : `Crypt: wave ${run.wave + 1} of ${WAVES.length}`) : null,
        hitAt: p.lastHitAt,
      };
      if (p.lastHitAt !== lastHit.current) {
        lastHit.current = p.lastHitAt;
        const el = flash.current;
        if (el) {
          el.classList.remove("on");
          void el.offsetWidth;
          el.classList.add("on");
        }
      }
      setView((v) => (v.hp === next.hp && v.max === next.max && v.show === next.show && v.wave === next.wave ? v : next));
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div className="rs-hit-flash" ref={flash} aria-hidden="true" />
      {view.show ? (
        <div className="rs-combat-hud" role="status">
          {view.wave ? <p className="wave">{view.wave}</p> : null}
          <div className="hp" aria-label={`Health ${view.hp} of ${view.max}`}>
            <span style={{ width: `${(view.hp / view.max) * 100}%` }} />
            <em>
              <Icon name="heart" /> {view.hp}/{view.max}
            </em>
          </div>
          <SpellBar onOpenBook={onOpenSpellbook} />
          <p className="keys">
            <kbd>F</kbd> attack · <kbd>1</kbd>–<kbd>4</kbd> spells ·{" "}
            {best ? (
              <button type="button" className="link" onClick={() => playerEat()}>
                <kbd>H</kbd> eat {food(best)?.name.toLowerCase()} ({foodCount})
              </button>
            ) : (
              <span className="muted">no food: fish and cook to heal</span>
            )}
          </p>
        </div>
      ) : null}
    </>
  );
}
