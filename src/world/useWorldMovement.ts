/**
 * Free player movement for the world scenes (Phase 15A): click-to-move plus
 * WASD/arrow keys, with a walkable-band + obstacle collision model. Position
 * is in scene units (1600×760 space). Reduced motion teleports instead of
 * animating. Position is ephemeral — it resets to the scene spawn whenever
 * the active scene changes (matching the pre-15A "spawn on entry" behaviour).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorPoint, SceneWorld, WorldInteractable } from "./worldTypes";

const SPEED = 640; // scene units / second
const ARRIVE_EPS = 6; // within this distance = arrived

interface MoveTarget {
  point: FloorPoint;
  interactableId?: string;
  onArrive?: () => void;
  /** Distance at the moment the move began — drives ease-in/ease-out. */
  total: number;
}

/** Gentle acceleration at the start and deceleration on arrival (Part 3 feel). */
const EASE_ZONE = 90; // scene units over which speed ramps
const EASE_FLOOR = 0.18; // minimum speed factor, so it never stalls

interface MovementApi {
  pos: FloorPoint;
  moving: boolean;
  facingLeft: boolean;
  marker: FloorPoint | null;
  /** id of the interactable the player is walking toward (for highlight). */
  pendingId: string | null;
  /** Height at the player's current depth (front→back interpolation). */
  height: number;
  moveTo: (point: FloorPoint, opts?: { interactableId?: string; onArrive?: () => void }) => void;
  /** Clamp + collide an arbitrary point into the walkable area. */
  clamp: (point: FloorPoint) => FloorPoint;
}

function dist(a: FloorPoint, b: FloorPoint): number {
  return Math.hypot(a.x - b.x, a.feetY - b.feetY);
}

export function nearestInRange(pos: FloorPoint, items: WorldInteractable[]): WorldInteractable | null {
  let best: WorldInteractable | null = null;
  let bestD = Infinity;
  for (const item of items) {
    const d = dist(pos, item.standPoint);
    if (d <= item.range && d < bestD) {
      best = item;
      bestD = d;
    }
  }
  return best;
}

export function useWorldMovement(
  world: SceneWorld,
  options: { reduceMotion: boolean; enabled: boolean }
): MovementApi {
  const { reduceMotion, enabled } = options;
  const [pos, setPos] = useState<FloorPoint>(world.spawn);
  const [moving, setMoving] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [marker, setMarker] = useState<FloorPoint | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const posRef = useRef<FloorPoint>(world.spawn);
  const targetRef = useRef<MoveTarget | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const worldRef = useRef<SceneWorld>(world);
  worldRef.current = world;

  const inObstacle = useCallback((p: FloorPoint): boolean => {
    for (const o of worldRef.current.obstacles) {
      if (p.x >= o.xMin && p.x <= o.xMax && p.feetY >= o.feetMin && p.feetY <= o.feetMax) return true;
    }
    return false;
  }, []);

  const clamp = useCallback((p: FloorPoint): FloorPoint => {
    const w = worldRef.current.walkable;
    return {
      x: Math.max(w.xMin, Math.min(w.xMax, p.x)),
      feetY: Math.max(w.feetBack, Math.min(w.feetFront, p.feetY)),
    };
  }, []);

  /** Move from `from` toward `to` by `step`, sliding along blocked axes. */
  const advance = useCallback(
    (from: FloorPoint, to: FloorPoint, step: number): FloorPoint => {
      const dx = to.x - from.x;
      const dy = to.feetY - from.feetY;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3) return from;
      const nx = from.x + (dx / d) * Math.min(step, d);
      const ny = from.feetY + (dy / d) * Math.min(step, d);
      const full = clamp({ x: nx, feetY: ny });
      if (!inObstacle(full)) return full;
      const onlyX = clamp({ x: nx, feetY: from.feetY });
      if (!inObstacle(onlyX)) return onlyX;
      const onlyY = clamp({ x: from.x, feetY: ny });
      if (!inObstacle(onlyY)) return onlyY;
      return from; // fully blocked — fail safe, stop.
    },
    [clamp, inObstacle]
  );

  const commit = useCallback((p: FloorPoint) => {
    posRef.current = p;
    setPos((prev) => (Math.abs(prev.x - p.x) < 0.4 && Math.abs(prev.feetY - p.feetY) < 0.4 ? prev : p));
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
    setMoving(false);
  }, []);

  const tick = useCallback(
    (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;
      const step = SPEED * dt;
      let next = posRef.current;
      let stillMoving = false;

      // Keyboard velocity takes priority and cancels any click target.
      const keys = keysRef.current;
      let kx = 0;
      let ky = 0;
      if (keys.has("left")) kx -= 1;
      if (keys.has("right")) kx += 1;
      if (keys.has("up")) ky -= 1;
      if (keys.has("down")) ky += 1;
      if (kx !== 0 || ky !== 0) {
        const target = { x: posRef.current.x + kx * 1000, feetY: posRef.current.feetY + ky * 1000 };
        next = advance(posRef.current, target, step);
        if (kx < 0) setFacingLeft(true);
        else if (kx > 0) setFacingLeft(false);
        stillMoving = true;
      } else if (targetRef.current) {
        const t = targetRef.current;
        const prev = posRef.current;
        if (t.point.x < prev.x - 1) setFacingLeft(true);
        else if (t.point.x > prev.x + 1) setFacingLeft(false);
        // Ease-in from the start, ease-out into arrival.
        const remainingNow = dist(prev, t.point);
        const traveled = Math.max(0, t.total - remainingNow);
        const rampIn = Math.min(1, traveled / EASE_ZONE + EASE_FLOOR);
        const rampOut = Math.min(1, remainingNow / EASE_ZONE + EASE_FLOOR);
        const eased = step * Math.max(EASE_FLOOR, Math.min(rampIn, rampOut));
        next = advance(prev, t.point, eased);
        const remaining = dist(next, t.point);
        // "Blocked" only counts when a real step was attempted but nothing
        // moved (wall/obstacle) — never on the dt=0 first frame.
        const blocked = step > 0.01 && next.x === prev.x && next.feetY === prev.feetY;
        if (remaining <= ARRIVE_EPS || blocked) {
          commit(next);
          const arrived = t.onArrive;
          const reached = remaining <= ARRIVE_EPS + 4;
          targetRef.current = null;
          setMarker(null);
          setPendingId(null);
          if (reached && arrived) arrived();
          stopLoop();
          return;
        }
        stillMoving = true;
      }

      commit(next);
      if (stillMoving) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        stopLoop();
      }
    },
    [advance, commit, stopLoop]
  );

  const ensureLoop = useCallback(() => {
    if (rafRef.current === null) {
      setMoving(true);
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const moveTo = useCallback<MovementApi["moveTo"]>(
    (point, opts) => {
      if (!enabled) return;
      const dest = clamp(point);
      // Blocked destination → fail safe: keep the nearest reachable edge.
      const safeDest = inObstacle(dest) ? clamp({ x: dest.x, feetY: worldRef.current.walkable.feetFront }) : dest;
      keysRef.current.clear();
      if (reduceMotion) {
        // Teleport but still respect interaction: only "arrive" if the target
        // is an interactable's stand point (reachable), else just relocate.
        const finalPoint = inObstacle(safeDest) ? posRef.current : safeDest;
        commit(finalPoint);
        setMarker(null);
        setPendingId(null);
        if (opts?.onArrive) opts.onArrive();
        return;
      }
      targetRef.current = {
        point: safeDest,
        interactableId: opts?.interactableId,
        onArrive: opts?.onArrive,
        total: dist(posRef.current, safeDest),
      };
      setMarker(safeDest);
      setPendingId(opts?.interactableId ?? null);
      ensureLoop();
    },
    [clamp, commit, enabled, ensureLoop, inObstacle, reduceMotion]
  );

  // Keyboard movement — cancels the active click-to-move target.
  useEffect(() => {
    if (!enabled) return;
    const map: Record<string, string> = {
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
    };
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (!dir || isTypingTarget(e.target)) return;
      if (targetRef.current) {
        targetRef.current = null; // manual input cancels click-to-move
        setMarker(null);
        setPendingId(null);
      }
      keysRef.current.add(dir);
      if (reduceMotion) {
        // Step move for reduced motion (no continuous animation).
        const delta = 40;
        const d: FloorPoint = {
          x: posRef.current.x + (dir === "left" ? -delta : dir === "right" ? delta : 0),
          feetY: posRef.current.feetY + (dir === "up" ? -delta : dir === "down" ? delta : 0),
        };
        commit(advance(posRef.current, d, delta));
        keysRef.current.delete(dir);
        return;
      }
      ensureLoop();
    };
    const up = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) keysRef.current.delete(dir);
    };
    const keys = keysRef.current;
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.clear();
    };
  }, [advance, commit, enabled, ensureLoop, reduceMotion]);

  // Reset to spawn when the scene changes.
  useEffect(() => {
    stopLoop();
    targetRef.current = null;
    keysRef.current.clear();
    posRef.current = world.spawn;
    setPos(world.spawn);
    setMarker(null);
    setPendingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.sceneId]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  // Depth-based height: further back (smaller feetY) → shorter sprite.
  const band = world.walkable;
  const t = band.feetFront === band.feetBack ? 1 : (pos.feetY - band.feetBack) / (band.feetFront - band.feetBack);
  const height = world.heightBack + (world.heightFront - world.heightBack) * Math.max(0, Math.min(1, t));

  return { pos, moving, facingLeft, marker, pendingId, height, moveTo, clamp };
}
