/** Small HUD pieces: hover text, right-click menu, XP drops, level-up banner. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { onHover, onNearby, type ContextMenuRequest } from "../scene/runtime";
import { onGameEvent } from "../state/events";
import { realmStore } from "../state/store";
import { Icon, lifeSkillIcon, themeIcon, type IconName } from "./icons";
import type { WorldObject } from "../world/worldGen";

export function HoverText() {
  const [text, setText] = useState<{ verb: string; target: string; extra: number } | null>(null);
  useEffect(() => onHover(setText), []);
  if (!text) return null;
  return (
    <div className="rs-hover" aria-hidden="true">
      <span className="verb">{text.verb}</span>
      {text.target ? <span className="target"> {text.target}</span> : null}
      {text.extra > 1 ? <span className="extra"> / {text.extra - 1} more options</span> : null}
    </div>
  );
}

export function ContextMenu({ request, onClose }: { request: ContextMenuRequest; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: request.x, y: request.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.min(Math.max(4, request.x - rect.width / 2), window.innerWidth - rect.width - 4),
      y: Math.min(request.y, window.innerHeight - rect.height - 4),
    });
  }, [request]);

  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const options = [...request.options, { label: "Cancel", run: () => undefined }];
  return (
    <div className="rs-menu" ref={ref} role="menu" aria-label="Actions" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()} onMouseLeave={onClose}>
      <p className="rs-menu-title" aria-hidden="true">
        Actions
      </p>
      {options.map((option, i) => (
        <button
          key={`${option.label}-${i}`}
          type="button"
          role="menuitem"
          className={option.label === "Cancel" && i === options.length - 1 ? "cancel" : undefined}
          onClick={() => {
            onClose();
            option.run();
          }}
        >
          <span className="verb">{option.label}</span>
          {"target" in option && option.target ? <span className="target"> {option.target}</span> : null}
        </button>
      ))}
    </div>
  );
}

interface Drop {
  id: number;
  icon: IconName;
  amount: number;
}

export function XpDrops() {
  const [drops, setDrops] = useState<Drop[]>([]);
  useEffect(() => {
    let id = 0;
    return onGameEvent((event) => {
      if (event.type !== "xp-drop") return;
      const subject = realmStore.get().curriculum?.subjects.find((s) => s.id === event.subjectId);
      const icon: IconName = event.subjectId.startsWith("life:") ? lifeSkillIcon(event.subjectId.slice(5)) : subject ? themeIcon(subject.theme) : "star";
      const drop = { id: ++id, icon, amount: event.amount };
      setDrops((d) => [...d.slice(-5), drop]);
      window.setTimeout(() => setDrops((d) => d.filter((x) => x.id !== drop.id)), 2200);
    });
  }, []);
  return (
    <div className="rs-xpdrops" aria-hidden="true">
      {drops.map((d) => (
        <div key={d.id} className="rs-xpdrop">
          <Icon name={d.icon} className="icon" /> +{d.amount.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export function LevelUpBanner() {
  const [banner, setBanner] = useState<{ id: number; skill: string; level: number } | null>(null);
  useEffect(() => {
    let id = 0;
    return onGameEvent((event) => {
      if (event.type !== "level-up") return;
      const current = { id: ++id, skill: event.skillName, level: event.level };
      setBanner(current);
      window.setTimeout(() => setBanner((b) => (b && b.id === current.id ? null : b)), 3800);
    });
  }, []);
  if (!banner) return null;
  return (
    <div className="rs-levelup" role="status">
      <div className="fireworks" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ ["--a" as string]: `${(i / 14) * 360}deg`, ["--d" as string]: `${(i % 3) * 0.12}s` }} />
        ))}
      </div>
      <p className="kicker">Level up</p>
      <p className="title">
        {banner.skill} <strong>Lv {banner.level}</strong>
      </p>
    </div>
  );
}

/** "E: Study Waystone of Week 3": shows what the E key will do right now. */
export function NearbyPrompt() {
  const [object, setObject] = useState<WorldObject | null>(null);
  useEffect(() => onNearby(setObject), []);
  if (!object || object.actions.length === 0) return null;
  return (
    <div className="rs-nearby" aria-live="polite">
      <kbd>E</kbd>
      <span className="verb">{object.actions[0].label}</span>
      <span className="target">{object.name}</span>
      {object.actions.length > 1 ? <span className="more">Right-click for more</span> : null}
    </div>
  );
}
