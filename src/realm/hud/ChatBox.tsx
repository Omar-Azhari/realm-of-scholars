/**
 * Messages and conversations. Game messages appear as brief toasts at the
 * bottom-left and fade away; the full log (with filters) opens from the
 * Log button or the L key. Conversations show as a clear card at the
 * bottom-centre of the screen.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatChannel, ChatMessage } from "../types";
import { Icon } from "./icons";

export interface DialogueOption {
  label: string;
  run: () => void;
}

export interface Dialogue {
  speaker: string;
  /** "npc" names the speaker; "player" names the player. */
  side: "npc" | "player";
  pages: string[];
  options?: DialogueOption[];
}

type Filter = "all" | ChatChannel;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "game", label: "Game" },
  { id: "quest", label: "Quest" },
  { id: "level", label: "Levels" },
];

/** How long a toast stays up (quest and level news linger a little longer). */
const TOAST_MS = 6500;
const TOAST_LONG_MS = 9000;
const MAX_TOASTS = 4;

interface ChatBoxProps {
  messages: ChatMessage[];
  dialogue: Dialogue | null;
  onDialogueDone: () => void;
  playerName: string;
}

export function ChatBox({ messages, dialogue, onDialogueDone, playerName }: ChatBoxProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [toasts, setToasts] = useState<ChatMessage[]>([]);
  const [unseen, setUnseen] = useState(0);
  const seen = useRef(new Set<number>());
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPage(0), [dialogue]);

  // New messages become toasts that fade on their own.
  useEffect(() => {
    const fresh = messages.filter((m) => !seen.current.has(m.id));
    if (fresh.length === 0) return;
    for (const m of fresh) seen.current.add(m.id);
    setToasts((list) => [...list, ...fresh].slice(-MAX_TOASTS));
    if (!logOpen) setUnseen((n) => n + fresh.length);
    // Each toast removes itself; a late timer after unmount is a harmless no-op.
    for (const m of fresh) {
      window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== m.id)), m.channel === "quest" || m.channel === "level" ? TOAST_LONG_MS : TOAST_MS);
    }
  }, [messages, logOpen]);

  useEffect(() => {
    if (logOpen && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, filter, logOpen]);

  const lastPage = dialogue ? page >= dialogue.pages.length - 1 : false;

  const advance = () => {
    if (!dialogue) return;
    if (!lastPage) setPage((p) => p + 1);
    else if (!dialogue.options?.length) onDialogueDone();
  };

  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      } else if (lastPage && dialogue.options && /^[1-9]$/.test(e.key)) {
        const option = dialogue.options[Number(e.key) - 1];
        if (option) option.run();
      } else if (e.key === "Escape") onDialogueDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // L opens and closes the message log.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "l" && !document.querySelector(".rs-window-backdrop, .rs-dialogue")) {
        setLogOpen((v) => !v);
        setUnseen(0);
      } else if (e.key === "Escape" && logOpen && !document.querySelector(".rs-window-backdrop, .rs-dialogue")) setLogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logOpen]);

  const visible = messages.filter((m) => filter === "all" || m.channel === filter || (filter === "game" && m.channel === "npc"));
  const speaker = dialogue ? (dialogue.side === "player" ? playerName : dialogue.speaker) : "";

  return (
    <>
      {dialogue ? (
        <section className={`rs-dialogue ${dialogue.side}`} role="dialog" aria-label={`Conversation: ${speaker}`} onContextMenu={(e) => e.preventDefault()}>
          <header className="rs-dialogue-head">
            <span className="rs-dialogue-portrait" aria-hidden="true">
              {speaker.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <p className={`rs-dialogue-name ${dialogue.side}`}>{speaker}</p>
            {dialogue.pages.length > 1 ? (
              <span className="rs-dialogue-page" aria-label={`Page ${page + 1} of ${dialogue.pages.length}`}>
                {page + 1}/{dialogue.pages.length}
              </span>
            ) : null}
            <button type="button" className="rs-icon-button small" onClick={onDialogueDone} aria-label="End conversation" title="End conversation (Esc)">
              <Icon name="close" />
            </button>
          </header>
          <p className="rs-dialogue-text" aria-live="polite">
            {dialogue.pages[page]}
          </p>
          {lastPage && dialogue.options?.length ? (
            <div className="rs-dialogue-options" role="group" aria-label="Choose a reply">
              {dialogue.options.map((option, i) => (
                <button key={option.label} type="button" onClick={option.run}>
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rs-dialogue-foot">
              <button type="button" className="rs-continue" onClick={advance}>
                <kbd aria-hidden="true">Space</kbd> {lastPage ? "Done" : "Continue"}
              </button>
            </div>
          )}
        </section>
      ) : null}
      {logOpen ? null : (
        <div className="rs-toasts" role="log" aria-live="polite" aria-label="Recent messages">
          {toasts.map((m) => (
            <p key={m.id} className={`rs-toast ${m.channel}`}>
              {m.text}
            </p>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`rs-log-toggle ${logOpen ? "on" : ""}`}
        aria-expanded={logOpen}
        aria-controls="rs-log"
        aria-keyshortcuts="L"
        aria-label={`Message log (L)${unseen && !logOpen ? `, ${unseen} new` : ""}`}
        title="Message log (L)"
        onClick={() => {
          setLogOpen((v) => !v);
          setUnseen(0);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Icon name="chat" />
        {unseen && !logOpen ? (
          <span className="rs-badge" aria-hidden="true">
            {unseen > 99 ? "99+" : unseen}
          </span>
        ) : null}
      </button>
      {logOpen ? (
        <section id="rs-log" className="rs-log" aria-label="Message log" onContextMenu={(e) => e.preventDefault()}>
          <header className="rs-log-head">
            <div className="rs-segmented" role="group" aria-label="Filter messages">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={filter === f.id ? "active" : ""} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <button type="button" className="rs-icon-button small" onClick={() => setLogOpen(false)} aria-label="Close message log">
              <Icon name="close" />
            </button>
          </header>
          <div className="rs-log-list" ref={logRef} role="log" aria-live="off">
            {visible.slice(-80).map((m) => (
              <p key={m.id} className={`rs-msg ${m.channel}`}>
                {m.text}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
