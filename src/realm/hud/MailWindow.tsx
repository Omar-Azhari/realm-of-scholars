/**
 * Owl post: the mailbox (opened from Menu → Owl post or the dorm's letter
 * tray), and the hook that checks for new letters while the game is open.
 */

import { useEffect, useState } from "react";
import { Window } from "./Window";
import { realmStore, useRealm } from "../state/store";
import { deliver, lettersDue, markAllRead, markRead } from "../state/mail";
import { Icon } from "./icons";

export function MailWindow({ onClose }: { onClose: () => void }) {
  const mail = useRealm((s) => s.progress.mail);
  const [open, setOpen] = useState<string | null>(mail[0]?.key ?? null);
  const letter = mail.find((l) => l.key === open) ?? null;
  useEffect(() => {
    if (letter && !letter.read) markRead(letter.key);
  }, [letter]);
  return (
    <Window title="Owl post" onClose={onClose} width={720} className="mail-window">
      {mail.length === 0 ? (
        <p className="muted">No letters yet. Owls bring deadline reminders, Grimoire reviews, streak warnings, class times and house news.</p>
      ) : (
        <div className="mailbox">
          <ul className="letters" role="listbox" aria-label="Letters">
            {mail.map((l) => (
              <li key={l.key}>
                <button type="button" role="option" aria-selected={l.key === open} className={`${l.key === open ? "on" : ""} ${l.read ? "" : "unread"}`} onClick={() => setOpen(l.key)}>
                  <span className="seal" aria-hidden="true">
                    <Icon name="mail" />
                  </span>
                  <span className="text">
                    <b>{l.subject}</b>
                    <small>
                      {l.from} · {new Date(l.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <article className="parchment letter">
            {letter ? (
              <>
                <p className="muted small">From: {letter.from}</p>
                <h3>{letter.subject}</h3>
                <p>{letter.body}</p>
              </>
            ) : (
              <p className="muted">Choose a letter.</p>
            )}
          </article>
        </div>
      )}
      {mail.some((l) => !l.read) ? (
        <button type="button" className="rs-button secondary small" onClick={markAllRead}>
          Mark all read
        </button>
      ) : null}
    </Window>
  );
}

/** Checks for new letters now and every five minutes while the game is open. */
export function useOwlPost(): void {
  useEffect(() => {
    const check = () => deliver(lettersDue(realmStore.get()));
    const first = window.setTimeout(check, 4000);
    const id = window.setInterval(check, 5 * 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
}
