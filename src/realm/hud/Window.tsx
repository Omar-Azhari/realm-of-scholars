import { useEffect, useId, type ReactNode } from "react";
import { Icon } from "./icons";

interface WindowProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
}

/** A glass interface window, centred over the game. Escape closes it. */
export function Window({ title, onClose, children, width = 520, className }: WindowProps) {
  const titleId = useId();
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rs-window-backdrop" onContextMenu={(e) => e.preventDefault()}>
      <section className={`rs-window ${className ?? ""}`} style={{ maxWidth: width, ["--window-max" as string]: `${width}px` }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="rs-window-title">
          <h2 id={titleId}>{title}</h2>
          {onClose ? (
            <button type="button" className="rs-close" onClick={onClose} aria-label="Close" title="Close (Esc)">
              <Icon name="close" />
            </button>
          ) : null}
        </header>
        <div className="rs-window-body">{children}</div>
      </section>
    </div>
  );
}
