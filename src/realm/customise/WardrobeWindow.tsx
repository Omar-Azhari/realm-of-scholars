/**
 * The wardrobe: your character, editable any time (body type, outfit parts,
 * height, build, muscle and colours). Dyes from the dye merchant (bought with
 * study coins) add extra outfit colours.
 */

import { useState } from "react";
import { Window } from "../hud/Window";
import { realmStore, useRealm } from "../state/store";
import { findShopItem } from "../state/shop";
import { buyDye, DYES } from "./outfit";
import { emit } from "../state/events";
import { CharacterCreator } from "./CharacterCreator";
import { usePlayerAppearance } from "./usePlayerAppearance";
import type { HatId } from "../scene/models";
import type { Appearance } from "../types";
import { Icon } from "../hud/icons";

/** `doneLabel`: the big confirm button at the bottom (e.g. "Done, let's go" when making a new character). */
export function WardrobeWindow({ onClose, title = "Wardrobe", doneLabel = "Done" }: { onClose: () => void; title?: string; doneLabel?: string }) {
  const appearance = usePlayerAppearance();
  const owned = useRealm((s) => s.progress.wardrobe.owned);
  const coins = useRealm((s) => s.progress.coins);
  const state = useRealm((s) => s);
  const hat = useRealm((s) => (findShopItem(s, s.progress.wardrobe.hat)?.look as HatId | undefined) ?? null);
  const capeColor = useRealm((s) => findShopItem(s, s.progress.wardrobe.cape)?.look ?? null);
  const [shop, setShop] = useState(false);
  const house = useRealm((s) => s.player?.house ?? null);
  const save = (a: Appearance) => realmStore.set((s) => (s.player ? { ...s, player: { ...s.player, appearance: a } } : s));
  const dyeColours = DYES.filter((d) => owned.includes(d.id)).map((d) => d.tint);

  return (
    <Window title={title} onClose={onClose} width={900} className="wardrobe-window">
      <CharacterCreator
        value={appearance}
        onChange={save}
        extraColours={dyeColours}
        hat={hat}
        capeColor={capeColor}
        house={house}
        onHouse={(id) => {
          realmStore.set((s) => (s.player ? { ...s, player: { ...s.player, house: id } } : s));
          emit({ type: "sound", name: "house" });
        }}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="rs-button secondary small" onClick={() => setShop((v) => !v)} aria-expanded={shop}>
          <Icon name="palette" /> Dye merchant ({dyeColours.length}/{DYES.length} colours)
        </button>
        <span className="muted small">Hats and cloaks come from the Agora bazaar. Press G in the world for emotes.</span>
      </div>
      {shop ? (
        <ul className="dye-shop">
          {DYES.map((d) => {
            const have = owned.includes(d.id);
            const lock = have ? null : d.locked?.(state) ?? null;
            return (
              <li key={d.id}>
                <span className="pot" style={{ background: d.tint }} />
                <span className="text">
                  <b>{d.name}</b>
                  {lock ? <small className="muted">{lock}</small> : <small className="muted">An extra outfit colour, yours to keep.</small>}
                </span>
                {have ? (
                  <span className="muted small">Owned</span>
                ) : (
                  <button type="button" className="rs-button small" disabled={Boolean(lock) || coins < d.price} onClick={() => buyDye(d.id)}>
                    {d.price} coins
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="wardrobe-done">
        <button type="button" className="rs-button big" onClick={onClose}>
          {doneLabel}
        </button>
      </div>
    </Window>
  );
}
