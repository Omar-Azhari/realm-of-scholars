/**
 * House feed (study-group board): classmates' house points from their share
 * codes count toward their house in the House Cup, and the weekly card is a
 * short text summary to paste into your group chat (e.g. Discord).
 */

import { useState } from "react";
import { useRealm } from "../state/store";
import { house, weeklyCard } from "../customise/houses";
import { houseIcon, Icon } from "./icons";

export function HouseFeed() {
  const state = useRealm((s) => s);
  const [copied, setCopied] = useState(false);
  const members = Object.values(state.progress.group).filter((m) => m.house);
  const card = weeklyCard(state);
  return (
    <section className="house-feed">
      <h3>House feed</h3>
      {members.length ? (
        <ul>
          {members
            .sort((a, b) => (b.housePoints ?? 0) - (a.housePoints ?? 0))
            .map((m) => {
              const h = house(m.house);
              return (
                <li key={`${m.name}|${m.university}`}>
                  <span className="crest" style={{ background: h?.colours[0] }}>
                    {h ? <Icon name={houseIcon(h.id)} /> : null}
                  </span>
                  <b>{m.name}</b> <small className="muted">{h?.name}</small>
                  <span className="pts">{(m.housePoints ?? 0).toLocaleString()}</span>
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="muted small">Classmates with newer share codes show their house here, and their points count toward it in the House Cup.</p>
      )}
      <pre className="card-preview">{card}</pre>
      <button
        type="button"
        className="rs-button small"
        onClick={() => {
          void navigator.clipboard?.writeText(card).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? "Copied" : "Copy weekly card"}
      </button>
    </section>
  );
}
