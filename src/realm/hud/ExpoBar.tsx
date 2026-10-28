/**
 * The presenter's controls at the expo stand (only with ?expo; see expo.ts):
 *
 *  - Tour: jump to the showcase spots (lecture theatre, library, games hall,
 *    dorm, a subject, the harbour…) to walk someone through the game fast.
 *  - New visitor: tap twice to wipe the demo and go back to the welcome screen.
 *  - Idle reset: after a few quiet minutes the stand asks "Still there?" for
 *    10 seconds, then resets itself (so the welcome screen becomes the attract
 *    loop). Watching a lecture or its video counts as activity.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { EXPO_IDLE_MINUTES, resetForNextVisitor, topUpFocus } from "../expo";
import { runtime } from "../scene/runtime";
import { nearestWalkable } from "../world/pathfinding";
import { chat } from "../state/events";
import type { World, WorldObject } from "../world/worldGen";
import type { RealmSubject } from "../types";
import { Icon, type IconName } from "./icons";
import "../../styles/expo.css";

interface Stop {
  label: string;
  icon: IconName;
  /** Where to stand, and which way the camera looks from (yaw). */
  go: () => { x: number; z: number; yaw: number } | null;
}

/** A spot just in front of a building, with the camera looking at it. */
function inFront(world: World, object: WorldObject | undefined, back = 2.5): { x: number; z: number; yaw: number } | null {
  if (!object) return null;
  const room = world.rooms?.find((r) => r.buildingId === object.id);
  const fx = Math.sin(object.rot);
  const fz = Math.cos(object.rot);
  const cx = room ? room.outside.x + 0.5 : object.x + object.w / 2 + fx * (object.d / 2 + back);
  const cz = room ? room.outside.z + 0.5 : object.z + object.d / 2 + fz * (object.d / 2 + back);
  const tile = nearestWalkable(world, { x: Math.floor(cx + fx * (room ? back : 0)), z: Math.floor(cz + fz * (room ? back : 0)) }, 5);
  return tile ? { x: tile.x + 0.5, z: tile.z + 0.5, yaw: object.rot } : null;
}

export function ExpoBar({ world, subjects }: { world: World; subjects: RealmSubject[] }) {
  const [tourOpen, setTourOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const lastInput = useRef(performance.now());

  const stops = useMemo<Stop[]>(() => {
    const find = (kind: string) => world.objects.find((o) => o.kind === kind);
    const list: Stop[] = [
      { label: "Lecture theatre", icon: "cap", go: () => inFront(world, find("lecture-hall")) },
      { label: "Library", icon: "library", go: () => inFront(world, find("library")) },
      { label: "Games hall and Arena", icon: "shield", go: () => inFront(world, find("games-hall")) },
      { label: "Your dorm", icon: "bed", go: () => inFront(world, find("dorm")) },
      { label: "Duelling club", icon: "swords", go: () => inFront(world, find("duel-club")) },
      { label: "Hall of Trophies", icon: "trophy", go: () => inFront(world, find("trophy-hall")) },
      { label: "Great Hall and fountain", icon: "castle", go: () => inFront(world, find("fountain"), 3) },
      { label: "Harbour", icon: "anchor", go: () => inFront(world, find("harbour"), 1) },
    ];
    const region = world.regions[0];
    const subject = subjects.find((s) => s.id === region?.subjectId);
    if (region) {
      list.splice(1, 0, {
        label: `A subject: ${subject?.code || subject?.name || region.name}`,
        icon: "bookOpen",
        go: () => {
          const tile = nearestWalkable(world, { x: Math.floor(region.clearing.x), z: Math.floor(region.clearing.z) }, 5);
          return tile ? { x: tile.x + 0.5, z: tile.z + 0.5, yaw: Math.atan2(region.dir.x, region.dir.z) } : null;
        },
      });
    }
    return list;
  }, [world, subjects]);

  const go = (stop: Stop) => {
    const at = stop.go();
    setTourOpen(false);
    if (!at) {
      chat("That place isn't on this island.");
      return;
    }
    runtime.teleport?.(at.x, at.z);
    runtime.camera.yaw = at.yaw;
  };

  // Idle watch: any input is activity; so is a lecture being spoken or its video showing.
  useEffect(() => {
    const touch = () => {
      lastInput.current = performance.now();
      setCountdown(null);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    let lastMove = 0;
    const onMove = () => {
      const now = performance.now();
      if (now - lastMove > 1000) {
        lastMove = now;
        touch();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const id = window.setInterval(() => {
      topUpFocus();
      const watching = Boolean(document.querySelector(".rs-lecture-video iframe")) || (Boolean(document.querySelector(".rs-lecture")) && "speechSynthesis" in window && window.speechSynthesis.speaking);
      if (watching) lastInput.current = performance.now();
      const idle = (performance.now() - lastInput.current) / 1000;
      const limit = EXPO_IDLE_MINUTES * 60;
      if (idle >= limit + 10) resetForNextVisitor();
      else if (idle >= limit) setCountdown(Math.ceil(limit + 10 - idle));
    }, 1000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(id);
    };
  }, []);

  // "New visitor" needs a second tap within a few seconds.
  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => setConfirm(false), 3500);
    return () => window.clearTimeout(id);
  }, [confirm]);

  return (
    <>
      <div className="rs-expo-bar" role="toolbar" aria-label="Expo demo controls">
        <span className="rs-expo-badge">Expo demo</span>
        <button type="button" className={tourOpen ? "on" : ""} aria-expanded={tourOpen} onClick={() => setTourOpen((v) => !v)}>
          <Icon name="compass" /> Tour
        </button>
        <button type="button" className={confirm ? "danger" : ""} onClick={() => (confirm ? resetForNextVisitor() : setConfirm(true))}>
          {confirm ? "Tap again to reset" : <><Icon name="replay" /> New visitor</>}
        </button>
      </div>
      {tourOpen ? (
        <div className="rs-expo-tour" role="menu" aria-label="Showcase tour">
          {stops.map((stop) => (
            <button key={stop.label} type="button" role="menuitem" onClick={() => go(stop)}>
              <Icon name={stop.icon} /> {stop.label}
            </button>
          ))}
        </div>
      ) : null}
      {countdown !== null ? (
        <div className="rs-expo-idle" role="alertdialog" aria-live="assertive">
          <p>Still there?</p>
          <p className="small">Resetting for the next visitor in {countdown}…</p>
          <button type="button" onClick={() => (lastInput.current = performance.now(), setCountdown(null))}>
            I'm still playing
          </button>
        </div>
      ) : null}
    </>
  );
}
