/**
 * Life-skill windows: the gathering mini-game (fishing, mining,
 * woodcutting), the campfire (cooking) and the anvil (crafting).
 *
 * Gathering is a timing game: a marker sweeps along a bar and you strike
 * (Space, Enter or click) when it's in the sweet spot. Harder resources
 * have a smaller spot and a faster marker; levels above the requirement
 * widen it a little. Fishing adds a wait for the bite — strike too early
 * and the fish swims off.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Window } from "./Window";
import { useRealm } from "../state/store";
import { beginGather, cook, craft, craftBlocker, equipWeapon, finishGather, gatherBlocker, lifeLevel } from "../state/life";
import { FOCUS, FOODS, LIFE_SKILLS, WEAPONS, resource } from "../life/catalog";
import { levelProgress, xpToNextLevel } from "../xp";
import { emit } from "../state/events";
import { runtime } from "../scene/runtime";
import { spawnBurst } from "../scene/vfx";
import { Icon, itemIcon } from "./icons";

type Phase = "ready" | "waiting" | "strike" | "result";

function sweetSpot(difficulty: number, overLevel: number): { width: number; speed: number } {
  const width = Math.min(0.42, 0.34 - 0.24 * difficulty + Math.min(0.1, overLevel * 0.005));
  return { width, speed: 0.7 + 1.5 * difficulty };
}

export function GatherGame({ resourceId, nodeName, onClose }: { resourceId: string; nodeName: string; onClose: () => void }) {
  const r = resource(resourceId)!;
  const skill = LIFE_SKILLS.find((l) => l.id === r.skill)!;
  const level = useRealm((s) => lifeLevel(s, r.skill));
  const xp = useRealm((s) => s.progress.lifeXp[r.skill] ?? 0);
  const focus = useRealm((s) => s.progress.focus);
  const have = useRealm((s) => s.progress.materials[r.id] ?? 0);
  const blocker = useRealm((s) => gatherBlocker(s, resourceId));
  const { width, speed } = sweetSpot(r.difficulty, level - r.level);

  const [phase, setPhase] = useState<Phase>("ready");
  const [marker, setMarker] = useState(0);
  const [zone, setZone] = useState(0.5);
  const [hits, setHits] = useState<number[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [message, setMessage] = useState("");
  const start = useRef(0);
  const waitUntil = useRef(0);
  const deadline = useRef(0);
  const frame = useRef(0);
  const needed = r.skill === "fishing" ? 1 : 3;

  const finish = useCallback(
    (allHits: number[]) => {
      const goodHits = allHits.filter((q) => q > 0);
      const success = r.skill === "fishing" ? goodHits.length === 1 : goodHits.length >= 2;
      const quality = goodHits.length ? goodHits.reduce((a, b) => a + b, 0) / goodHits.length : 0;
      const result = finishGather(r.id, success, quality);
      if (success) {
        // A burst at the spot in front of the player: spray, rock chips or leaves.
        const { x, z, facing } = runtime.player;
        const kind = r.skill === "fishing" ? "splash" : r.skill === "mining" ? "chips" : "leaves";
        spawnBurst(kind, x + Math.sin(facing) * 0.9, 0.5, z + Math.cos(facing) * 0.9, kind === "chips" ? r.tint : undefined);
      }
      setMessage(success ? `+${result.got} ${r.name}${result.got > 1 ? " (perfect strike)" : ""} · +${result.xp} XP` : `${r.skill === "fishing" ? "It got away" : "Not enough clean strikes"} · +${result.xp} XP`);
      setPhase("result");
    },
    [r],
  );

  // Animate the marker (and the fishing bite timer).
  useEffect(() => {
    if (phase !== "waiting" && phase !== "strike") return;
    const tick = () => {
      frame.current = requestAnimationFrame(tick);
      const now = performance.now();
      if (phase === "waiting") {
        if (now >= waitUntil.current) {
          emit({ type: "sound", name: "click" });
          start.current = now;
          deadline.current = now + 2600;
          setPhase("strike");
        }
        return;
      }
      const t = ((now - start.current) / 1000) * speed;
      setMarker(Math.abs(((t % 2) + 2) % 2 - 1));
      if (r.skill === "fishing" && now > deadline.current) {
        cancelAnimationFrame(frame.current);
        finish([0]);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [phase, speed, r.skill, finish]);

  const begin = () => {
    if (!beginGather(r.id)) return;
    setHits([]);
    setStrikes(0);
    setMessage("");
    setZone(0.3 + Math.random() * 0.4);
    if (r.skill === "fishing") {
      waitUntil.current = performance.now() + 900 + Math.random() * 1700;
      setPhase("waiting");
    } else {
      start.current = performance.now();
      setPhase("strike");
    }
  };

  const strike = () => {
    if (phase === "waiting") {
      cancelAnimationFrame(frame.current);
      setMessage("Too early. The fish swims off.");
      finish([0]);
      return;
    }
    if (phase !== "strike") return;
    const off = Math.abs(marker - zone);
    const q = off <= width / 2 ? 1 - off / (width / 2) : 0;
    emit({ type: "sound", name: q > 0 ? "hit" : "miss" });
    const next = [...hits, q];
    setHits(next);
    setStrikes(next.length);
    if (next.length >= needed) {
      cancelAnimationFrame(frame.current);
      finish(next);
    } else {
      setZone(0.25 + Math.random() * 0.5);
      start.current = performance.now() - Math.random() * 600;
    }
  };

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (phase === "ready" || phase === "result") begin();
    else strike();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const verb = r.skill === "fishing" ? "Cast your line" : r.skill === "mining" ? "Swing your pick" : "Swing your axe";
  return (
    <Window title={nodeName} onClose={onClose} width={560} className="gather-window">
      <div className="gather-head">
        <span>
          {skill.name} level <strong>{level}</strong>
        </span>
        <span className="xpbar small-bar" title={`${xpToNextLevel(xp)} XP to next level`}>
          <span style={{ width: `${Math.round(levelProgress(xp) * 100)}%` }} />
        </span>
        <span>
          <Icon name={itemIcon(r.id)} /> {have} {r.name}
        </span>
        <span className="focus-chip">
          <Icon name="focus" /> {focus}
        </span>
      </div>
      {blocker ? (
        <p className="error">{blocker}</p>
      ) : (
        <>
          <div className={`gather-stage ${r.skill} ${phase}`} onClick={() => (phase === "waiting" || phase === "strike" ? strike() : undefined)}>
            {r.skill === "fishing" ? (
              <div className="bobber-water">
                <span className={`bobber ${phase === "strike" ? "dip" : ""}`} aria-hidden="true" />
                {phase === "strike" ? <span className="bite">Bite. Strike now</span> : phase === "waiting" ? <span className="wait">Waiting for a bite…</span> : null}
              </div>
            ) : (
              <div className="strike-count">
                {Array.from({ length: needed }, (_, i) => (
                  <span key={i} className={i < strikes ? (hits[i] > 0 ? "hit" : "miss") : ""}>
                    <Icon name={i < strikes ? (hits[i] > 0 ? "check" : "close") : "minus"} />
                  </span>
                ))}
              </div>
            )}
            <div className="timing-bar" aria-label="Timing bar">
              <span className="zone" style={{ left: `${(zone - width / 2) * 100}%`, width: `${width * 100}%` }} />
              <span className="perfect" style={{ left: `${zone * 100}%` }} />
              {phase === "strike" ? <span className="marker" style={{ left: `${marker * 100}%` }} /> : null}
            </div>
          </div>
          <div className="row gather-actions">
            {phase === "ready" || phase === "result" ? (
              <button type="button" className="rs-button" onClick={begin} disabled={focus < FOCUS.cost.gather}>
                {phase === "result" ? "Again" : verb} · {FOCUS.cost.gather} Focus
              </button>
            ) : (
              <button type="button" className="rs-button" onClick={strike}>
                Strike <kbd>Space</kbd>
              </button>
            )}
            {message ? <span className="gather-message">{message}</span> : <span className="muted small">Strike when the marker is in the green. Dead centre gives a bonus.</span>}
          </div>
          {focus < FOCUS.cost.gather ? <p className="muted small">Out of Focus. Study a waystone, tick a quest step or review your Grimoire to earn more.</p> : null}
        </>
      )}
    </Window>
  );
}

export function CookWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const level = lifeLevel(state, "cooking");
  const [log, setLog] = useState<string>("");
  return (
    <Window title="Campfire" onClose={onClose} width={560}>
      <p className="lede">Cook your catch into food. In battle, food heals you.</p>
      <p className="small">
        Cooking level <strong>{level}</strong>. Burning gets rarer as your level rises.
      </p>
      <ul className="craft-list">
        {FOODS.map((f) => {
          const raw = state.progress.materials[f.from] ?? 0;
          const cooked = state.progress.materials[f.id] ?? 0;
          const locked = level < f.level;
          return (
            <li key={f.id} className={locked ? "locked" : ""}>
              <span className="icon">
                <Icon name={itemIcon(f.id)} />
              </span>
              <span className="text">
                <strong>{f.name}</strong>
                <span className="small muted">
                  {locked ? `Needs Cooking ${f.level}` : `Heals ${f.heals} · ${raw} raw ${resource(f.from)?.name.toLowerCase()} · ${cooked} cooked`}
                </span>
              </span>
              <button
                type="button"
                className="rs-button secondary"
                disabled={locked || raw === 0}
                onClick={() => {
                  const result = cook(f.id);
                  setLog(result === "cooked" ? `Cooked ${f.name.toLowerCase()}.` : result === "burnt" ? "Burnt it." : "");
                }}
              >
                Cook
              </button>
              <button
                type="button"
                className="rs-button secondary"
                disabled={locked || raw < 2}
                onClick={() => {
                  let cookedN = 0;
                  let burnt = 0;
                  for (let i = 0; i < raw; i++) {
                    const result = cook(f.id);
                    if (result === "cooked") cookedN++;
                    else if (result === "burnt") burnt++;
                  }
                  setLog(`Cooked ${cookedN}, burnt ${burnt}.`);
                }}
              >
                Cook all
              </button>
            </li>
          );
        })}
      </ul>
      {log ? <p className="small">{log}</p> : null}
    </Window>
  );
}

export function CraftWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const level = lifeLevel(state, "crafting");
  return (
    <Window title="Wandwright's bench" onClose={onClose} width={600}>
      <p className="lede">Forge arms from ore and logs. Better arms hit harder in the wilds and dungeons.</p>
      <p className="small">
        Wandcraft level <strong>{level}</strong>. Carrying: <strong>{state.progress.weapon ? WEAPONS.find((w) => w.id === state.progress.weapon)?.name : "nothing"}</strong>
      </p>
      <ul className="craft-list">
        {WEAPONS.map((w) => {
          const owned = state.progress.weapons.includes(w.id);
          const blocker = owned ? null : craftBlocker(state, w.id);
          const carrying = state.progress.weapon === w.id;
          return (
            <li key={w.id} className={blocker && !owned ? "locked" : ""}>
              <span className="swatch" style={{ background: w.tint }} />
              <span className="text">
                <strong>
                  {w.name} <span className="small muted">+{w.power} power</span>
                </strong>
                <span className="small muted">
                  {Object.entries(w.cost)
                    .map(([id, n]) => `${state.progress.materials[id] ?? 0}/${n} ${resource(id)?.name.toLowerCase() ?? id}`)
                    .join(" · ")}{" "}
                  · Crafting {w.level}
                </span>
              </span>
              {owned ? (
                <button type="button" className="rs-button secondary" disabled={carrying} onClick={() => equipWeapon(w.id)}>
                  {carrying ? "Carrying" : "Carry"}
                </button>
              ) : (
                <button type="button" className="rs-button" disabled={Boolean(blocker)} title={blocker ?? undefined} onClick={() => craft(w.id)}>
                  Forge
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Window>
  );
}
