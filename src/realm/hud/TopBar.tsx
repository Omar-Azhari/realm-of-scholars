/**
 * The slim top bar: where you are (or which subject's region you stand in),
 * that skill's level and progress, Focus and coins. Everything else lives in
 * the menu drawer. A meditation in progress and the weather sit at its end.
 */

import { roomAt } from "../world/rooms";
import { useEffect, useState, type ReactNode } from "react";
import { runtime } from "../scene/runtime";
import { onGameEvent } from "../state/events";
import { useRealm } from "../state/store";
import { levelForXp, levelProgress, MAX_LEVEL, xpToNextLevel } from "../xp";
import { TILE, type World } from "../world/worldGen";
import type { RealmSubject } from "../types";
import { Icon } from "./icons";

interface Place {
  name: string;
  subjectId: string | null;
}

/** A short place name for the bar (the area banner shows the full title on arrival). */
function placeAt(world: World, x: number, z: number): Place {
  const room = roomAt(world.rooms, x, z)?.kind ?? (world.interior ?? (world.mode === "interior" ? "dorm" : null));
  if (room === "theatre") return { name: "Lecture theatre", subjectId: null };
  if (room === "dorm") return { name: "Dorm room", subjectId: null };
  for (const d of world.districts) {
    if (Math.abs(x - (d.x + 0.5)) <= d.half + 0.5 && Math.abs(z - (d.z + 0.5)) <= d.half + 0.5) return { name: d.name, subjectId: null };
  }
  const p = world.plaza;
  if (x >= p.x0 && x < p.x1 && z >= p.z0 && z < p.z1) return { name: world.hub.plazaName, subjectId: null };
  for (const o of world.objects) {
    if (o.kind === "scenery" && Math.hypot(x - (o.x + o.w / 2), z - (o.z + o.d / 2)) <= Math.max(o.w, o.d) / 2 + 5) return { name: o.name, subjectId: null };
  }
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  const region = tx >= 0 && tz >= 0 && tx < world.size && tz < world.size ? world.regionOf[tz * world.size + tx] : 0;
  if (region > 0) {
    const r = world.regions[region - 1];
    return { name: r?.name ?? "Subject region", subjectId: r?.subjectId ?? null };
  }
  // Paved ground just off the Agora still counts as the Agora; the long roads out are open country.
  const kind = tx >= 0 && tz >= 0 && tx < world.size && tz < world.size ? world.kinds[tz * world.size + tx] : -1;
  const nearPlaza = x >= p.x0 - 6 && x < p.x1 + 6 && z >= p.z0 - 6 && z < p.z1 + 6;
  if ((kind === TILE.path || kind === TILE.plaza) && nearPlaza) return { name: world.hub.plazaName, subjectId: null };
  return { name: world.hub.wildsName, subjectId: null };
}

interface TopBarProps {
  world: World;
  subjects: RealmSubject[];
  /** A focus session in progress: shown as a chip that reopens it. */
  meditation?: { label: string; onOpen: () => void } | null;
  /** Extra chips at the end of the bar (e.g. the weather). */
  children?: ReactNode;
}

export function TopBar({ world, subjects, meditation, children }: TopBarProps) {
  const [place, setPlace] = useState<Place>(() => placeAt(world, runtime.player.x, runtime.player.z));
  const [lastTrained, setLastTrained] = useState<string | null>(null);
  const skillXp = useRealm((s) => s.progress.skillXp);
  const focus = useRealm((s) => s.progress.focus);
  const coins = useRealm((s) => s.progress.coins);

  useEffect(() => {
    const tick = () => {
      const next = placeAt(world, runtime.player.x, runtime.player.z);
      setPlace((p) => (p.name === next.name && p.subjectId === next.subjectId ? p : next));
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [world]);

  // Outside a subject region the bar follows the skill you last earned XP in.
  useEffect(
    () =>
      onGameEvent((event) => {
        if (event.type === "xp-drop" && !event.subjectId.startsWith("life:")) setLastTrained(event.subjectId);
      }),
    [],
  );

  const subject =
    subjects.find((s) => s.id === place.subjectId) ?? subjects.find((s) => s.id === lastTrained) ?? subjects[0] ?? null;
  const inRegion = Boolean(place.subjectId && subject && subject.id === place.subjectId);
  const xp = subject ? skillXp[subject.id] ?? 0 : 0;
  const level = levelForXp(xp);
  const progress = Math.round(levelProgress(xp) * 100);
  const where = inRegion && subject ? subject.code || subject.name : place.name;

  return (
    <header className="rs-topbar" onContextMenu={(e) => e.preventDefault()}>
      <span className="rs-topbar-place" title={inRegion && subject ? `${place.name} · ${subject.name}` : place.name}>
        <span className="spark" aria-hidden="true">
          <Icon name="pin" />
        </span>
        <span className="name">{where}</span>
      </span>
      {subject ? (
        <span
          className="rs-topbar-level"
          title={`${subject.name}: level ${level}, ${xp.toLocaleString()} XP${level < MAX_LEVEL ? ` · ${xpToNextLevel(xp).toLocaleString()} XP to level ${level + 1}` : ""}`}
        >
          {!inRegion ? <span className="code">{subject.code || subject.name}</span> : null}
          <span className="lv">Lv {level}</span>
          <span className="bar" role="progressbar" aria-label={`${subject.code || subject.name} level progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </span>
        </span>
      ) : null}
      <span className="rs-topbar-stat focus" title="Focus: earned by studying, spent on gathering, dungeons and games">
        <Icon name="focus" />
        <span className="sr-only">Focus</span> {focus}
      </span>
      <span className="rs-topbar-stat coins" title="Coins">
        <Icon name="coin" />
        <span className="sr-only">Coins</span> {coins >= 100000 ? `${Math.floor(coins / 1000)}k` : coins.toLocaleString()}
      </span>
      {meditation ? (
        <button type="button" className="rs-topbar-chip" onClick={meditation.onOpen} title="Open your focus session">
          <Icon name="candle" /> {meditation.label}
        </button>
      ) : null}
      {children}
    </header>
  );
}
