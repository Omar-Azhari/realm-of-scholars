/**
 * Main-menu pieces shared by the title screen and the expo welcome screen:
 * the "Realm of Scholars" wordmark, a vertical text menu (arrow keys move,
 * Enter chooses), the footer and the credits panel.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../hud/icons";

/** The game's wordmark: a small tracked line over the title, with a hairline rule. */
export function Wordmark({ kicker }: { kicker?: string }) {
  return (
    <div className="rs-wordmark">
      {kicker ? <p className="rs-wordmark-kicker">{kicker}</p> : null}
      <h1>
        <span className="rs-wordmark-small">Realm of</span>
        <span className="rs-wordmark-big">Scholars</span>
      </h1>
      <span className="rs-wordmark-rule" aria-hidden="true">
        <i />
      </span>
    </div>
  );
}

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

/** A vertical text menu. The first item takes focus; arrow keys move between items. */
export function MenuList({ items, label, autoFocus = true }: { items: MenuItem[]; label: string; autoFocus?: boolean }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (autoFocus) refs.current.find((b) => b && !b.disabled)?.focus({ preventScroll: true });
  }, [autoFocus]);
  const move = (from: number, step: number) => {
    const n = items.length;
    for (let k = 1; k <= n; k++) {
      const next = refs.current[(from + step * k + n * k) % n];
      if (next && !next.disabled) {
        next.focus();
        return;
      }
    }
  };
  return (
    <nav className="rs-menu-list" aria-label={label}>
      {items.map((item, i) => (
        <button
          key={item.label}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          className="rs-menu-item"
          disabled={item.disabled}
          onClick={item.onSelect}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(i, 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(i, -1);
            }
          }}
        >
          <span className="label">{item.label}</span>
          {item.hint ? <span className="hint">{item.hint}</span> : null}
        </button>
      ))}
    </nav>
  );
}

/** The thin footer along the bottom of the start screens. */
export function MenuFooter({ right }: { right?: ReactNode }) {
  return (
    <footer className="rs-menu-footer">
      <span>
        v{__APP_VERSION__.replace(/-.*$/, "")} <span className="sep" aria-hidden="true" /> A UniGame project
      </span>
      {right ? <span>{right}</span> : null}
    </footer>
  );
}

/** Who made what: models, fonts, data sources. */
export function CreditsPanel({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <section className="rs-credits" role="dialog" aria-modal="true" aria-labelledby="rs-credits-title">
      <header>
        <h2 id="rs-credits-title">Credits</h2>
        <button ref={close} type="button" className="rs-icon-button" onClick={onClose} aria-label="Close credits" title="Close (Esc)">
          <Icon name="close" />
        </button>
      </header>
      <dl>
        <dt>Design and development</dt>
        <dd>A UniGame project, built for La Trobe University students first.</dd>
        <dt>Buildings, props and adventurers</dt>
        <dd>KayKit by Kay Lousberg (CC0)</dd>
        <dt>Characters</dt>
        <dd>Ultimate Modular Men and Women by Quaternius</dd>
        <dt>Type</dt>
        <dd>Cinzel by Natanael Gama, Alegreya Sans by Juan Pablo del Peral (SIL Open Font Licence)</dd>
        <dt>Subject information</dt>
        <dd>La Trobe University Handbook and key dates. Check your Subject Learning Guide for exact dates and weights.</dd>
        <dt>Music and sound</dt>
        <dd>Generated live in the browser. No recorded audio.</dd>
      </dl>
      <button type="button" className="rs-button secondary" onClick={onClose}>
        Back
      </button>
    </section>
  );
}
