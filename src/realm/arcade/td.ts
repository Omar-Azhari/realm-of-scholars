/**
 * "Siege of Procrastination" — a small tower-defence game. Distractions
 * (notifications, doomscrolling, naps, deadline panic) march along a path
 * toward your desk; you place study tools to stop them. Pure simulation so
 * it can be tested; TowerDefence.tsx draws it on a canvas.
 */

export const COLS = 14;
export const ROWS = 8;

/** The path in grid cells, from the left edge to the desk on the right. */
export const PATH: Array<[number, number]> = [
  [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [6, 5], [6, 4], [6, 3], [6, 2], [7, 2], [8, 2],
  [9, 2], [10, 2], [10, 3], [10, 4], [10, 5], [10, 6], [11, 6], [12, 6], [13, 6],
];
const PATH_SET = new Set(PATH.map(([c, r]) => `${c},${r}`));
export function onPath(c: number, r: number): boolean {
  return PATH_SET.has(`${c},${r}`);
}

export type CreepKind = "ping" | "scroll" | "nap" | "panic";
export const CREEPS: Record<CreepKind, { name: string; icon: string; hp: number; speed: number; bounty: number; color: string }> = {
  ping: { name: "Notification", icon: "🔔", hp: 14, speed: 2.4, bounty: 4, color: "#ffcf3a" },
  scroll: { name: "Doomscroll", icon: "📱", hp: 40, speed: 1.4, bounty: 7, color: "#7fb0ff" },
  nap: { name: "Sneaky Nap", icon: "💤", hp: 90, speed: 0.8, bounty: 12, color: "#b48aff" },
  panic: { name: "Deadline Panic", icon: "😱", hp: 420, speed: 0.9, bounty: 60, color: "#ff5a4a" },
};

export type TowerKind = "lamp" | "pomodoro" | "planner";
export const TOWERS: Record<TowerKind, { name: string; icon: string; cost: number; range: number; damage: number; every: number; splash: number; slow: number; blurb: string; color: string }> = {
  lamp: { name: "Focus Lamp", icon: "💡", cost: 25, range: 2.4, damage: 7, every: 0.45, splash: 0, slow: 0, blurb: "Fast, single target.", color: "#ffe28a" },
  pomodoro: { name: "Pomodoro", icon: "🍅", cost: 45, range: 2.1, damage: 18, every: 1.6, splash: 1.1, slow: 0, blurb: "Slow bursts that hit a crowd.", color: "#ff6a4a" },
  planner: { name: "Planner", icon: "📅", cost: 35, range: 1.9, damage: 3, every: 0.6, splash: 0, slow: 0.45, blurb: "Slows everything nearby.", color: "#7fd8ff" },
};

export const WAVE_PLAN: CreepKind[][] = [
  Array(8).fill("ping"),
  [...Array(8).fill("ping"), ...Array(3).fill("scroll")],
  [...Array(6).fill("scroll"), ...Array(6).fill("ping")],
  [...Array(4).fill("nap"), ...Array(8).fill("ping")],
  [...Array(8).fill("scroll"), ...Array(3).fill("nap")],
  [...Array(10).fill("ping"), ...Array(6).fill("scroll"), ...Array(3).fill("nap")],
  [...Array(6).fill("nap"), ...Array(8).fill("scroll")],
  ["panic", ...Array(10).fill("ping"), ...Array(4).fill("nap")],
];

export interface Creep {
  id: number;
  kind: CreepKind;
  /** Distance along the path in cells. */
  dist: number;
  hp: number;
  max: number;
  slowUntil: number;
}

export interface Tower {
  kind: TowerKind;
  c: number;
  r: number;
  cooldown: number;
}

export interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  until: number;
  color: string;
}

export interface TDState {
  time: number;
  gold: number;
  lives: number;
  wave: number;
  /** Creeps still to send this wave, and when the next one goes. */
  queue: CreepKind[];
  nextSpawn: number;
  waveActive: boolean;
  creeps: Creep[];
  towers: Tower[];
  shots: Shot[];
  over: "won" | "lost" | null;
  killed: number;
}

export function newGame(): TDState {
  return { time: 0, gold: 80, lives: 10, wave: 0, queue: [], nextSpawn: 0, waveActive: false, creeps: [], towers: [], shots: [], over: null, killed: 0 };
}

const PATH_LEN = PATH.length - 1;
let creepId = 0;

/** Cell-centre position of a creep. */
export function creepPos(dist: number): { x: number; y: number } {
  const i = Math.max(0, Math.min(PATH_LEN - 1, Math.floor(dist)));
  const t = Math.max(0, Math.min(1, dist - i));
  const [c1, r1] = PATH[i];
  const [c2, r2] = PATH[Math.min(PATH_LEN, i + 1)];
  return { x: c1 + 0.5 + (c2 - c1) * t, y: r1 + 0.5 + (r2 - r1) * t };
}

export function canBuild(s: TDState, kind: TowerKind, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS || onPath(c, r)) return false;
  if (s.towers.some((t) => t.c === c && t.r === r)) return false;
  return s.gold >= TOWERS[kind].cost;
}

export function build(s: TDState, kind: TowerKind, c: number, r: number): boolean {
  if (!canBuild(s, kind, c, r)) return false;
  s.gold -= TOWERS[kind].cost;
  s.towers.push({ kind, c, r, cooldown: 0 });
  return true;
}

/** Sells a tower for half its price. */
export function sell(s: TDState, c: number, r: number): boolean {
  const i = s.towers.findIndex((t) => t.c === c && t.r === r);
  if (i < 0) return false;
  s.gold += Math.floor(TOWERS[s.towers[i].kind].cost / 2);
  s.towers.splice(i, 1);
  return true;
}

export function startWave(s: TDState): boolean {
  if (s.waveActive || s.over || s.wave >= WAVE_PLAN.length) return false;
  s.queue = WAVE_PLAN[s.wave].slice();
  s.waveActive = true;
  s.nextSpawn = s.time;
  return true;
}

export function step(s: TDState, dt: number): void {
  if (s.over) return;
  s.time += dt;
  // Spawn.
  if (s.waveActive && s.queue.length && s.time >= s.nextSpawn) {
    const kind = s.queue.shift()!;
    const hpScale = 1 + s.wave * 0.12;
    const hp = Math.round(CREEPS[kind].hp * hpScale);
    s.creeps.push({ id: ++creepId, kind, dist: 0, hp, max: hp, slowUntil: 0 });
    s.nextSpawn = s.time + (kind === "panic" ? 2 : 0.7);
  }
  // Move.
  for (const c of s.creeps) {
    const slow = s.time < c.slowUntil ? 0.55 : 1;
    c.dist += CREEPS[c.kind].speed * slow * dt;
  }
  const escaped = s.creeps.filter((c) => c.dist >= PATH_LEN);
  if (escaped.length) {
    s.lives -= escaped.reduce((n, c) => n + (c.kind === "panic" ? 5 : 1), 0);
    s.creeps = s.creeps.filter((c) => c.dist < PATH_LEN);
  }
  // Towers.
  for (const t of s.towers) {
    const spec = TOWERS[t.kind];
    t.cooldown -= dt;
    const tx = t.c + 0.5;
    const ty = t.r + 0.5;
    if (spec.slow > 0) {
      for (const c of s.creeps) {
        const p = creepPos(c.dist);
        if (Math.hypot(p.x - tx, p.y - ty) <= spec.range) c.slowUntil = s.time + 0.3;
      }
    }
    if (t.cooldown > 0) continue;
    // Target the creep furthest along the path in range.
    let target: Creep | null = null;
    for (const c of s.creeps) {
      const p = creepPos(c.dist);
      if (Math.hypot(p.x - tx, p.y - ty) <= spec.range && (!target || c.dist > target.dist)) target = c;
    }
    if (!target) continue;
    t.cooldown = spec.every;
    const tp = creepPos(target.dist);
    s.shots.push({ x1: tx, y1: ty, x2: tp.x, y2: tp.y, until: s.time + 0.12, color: spec.color });
    if (spec.splash > 0) {
      for (const c of s.creeps) {
        const p = creepPos(c.dist);
        if (Math.hypot(p.x - tp.x, p.y - tp.y) <= spec.splash) c.hp -= spec.damage;
      }
    } else target.hp -= spec.damage;
  }
  s.shots = s.shots.filter((sh) => sh.until > s.time);
  // Deaths.
  const dead = s.creeps.filter((c) => c.hp <= 0);
  if (dead.length) {
    s.gold += dead.reduce((n, c) => n + CREEPS[c.kind].bounty, 0);
    s.killed += dead.length;
    s.creeps = s.creeps.filter((c) => c.hp > 0);
  }
  if (s.lives <= 0) {
    s.lives = 0;
    s.over = "lost";
  } else if (s.waveActive && s.queue.length === 0 && s.creeps.length === 0) {
    s.waveActive = false;
    s.wave++;
    s.gold += 20 + s.wave * 5;
    if (s.wave >= WAVE_PLAN.length) s.over = "won";
  }
}

/** Coins paid out for a run: 12 per wave cleared, plus 100 for holding all eight. */
export function runReward(s: TDState): number {
  return s.wave * 12 + (s.over === "won" ? 100 : 0);
}
