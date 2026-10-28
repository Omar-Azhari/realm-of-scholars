import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { useMotionPreference } from "../../hooks/useMotionPreference";

interface RoomPanelProps {
  title: string;
  icon: LucideIcon;
  accent: string;
  onClose: () => void;
  children: ReactNode;
  /** Phase 20B — an optional extra class on the panel element itself, for the rare consumer (the Character Creator) that needs a wider layout than the 760px default. Every existing consumer is unaffected (defaults to none). */
  className?: string;
}

/**
 * An in-world overlay panel — opened by clicking a piece of room furniture,
 * styled as a holographic display belonging to the room rather than a modal
 * torn out of a SaaS app. One is mounted at a time, over the room scene.
 */
export function RoomPanel({ title, icon: Icon, accent, onClose, children, className }: RoomPanelProps) {
  const reduceMotion = useMotionPreference();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="room-panel-backdrop" onClick={onClose}>
      <motion.div
        ref={panelRef}
        className={className ? `room-panel ${className}` : "room-panel"}
        style={{ "--panel-accent": accent } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <header className="room-panel-header">
          <span className="room-panel-icon" aria-hidden="true">
            <Icon size={17} />
          </span>
          <h2 className="room-panel-title">{title}</h2>
          <button type="button" className="room-panel-close" onClick={onClose} aria-label="Close panel">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="room-panel-body">{children}</div>
      </motion.div>
    </div>
  );
}
