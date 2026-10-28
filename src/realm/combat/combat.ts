/**
 * Action combat for the wilds and the crypt. Runtime only (nothing here is
 * saved except the rewards it pays out): enemies spawn at camps, wander,
 * chase the player when they come close, and attack on a cooldown. The
 * player strikes with F (or by clicking an enemy), eats food with H, and
 * is knocked out at zero HP and comes round where they fell. Nothing is lost.
 *
 * Starting a fight costs 1 Focus; entering the crypt costs 15. Kills pay
 * Combat XP, coins and materials.
 */

import { realmStore } from "../state/store";
import { chat, emit } from "../state/events";
import { spendFocus } from "../state/focus";
import { addCoinsPublic, giveItemPublic } from "../state/actions";
import { bestFood, eat, grantLifeXp, lifeLevel, weaponPower } from "../state/life";
import { bumpCounter } from "../state/stats";
import { FOCUS, food } from "../life/catalog";
import { isWalkable, type World } from "../world/worldGen";
import { spawnBurst } from "../scene/vfx";
import { SPELL_KINDS, spellAmount, type Spell } from "../life/spells";
import { buffActive, WARDING_FACTOR } from "../life/potions";

export type EnemyKind = "bones" | "warrior" | "mage" | "crypt-king";

export interface EnemyType {
  name: string;
  model: "skeleton_minion" | "skeleton_warrior" | "skeleton_mage";
  level: number;
  hp: number;
  damage: [number, number];
  /** Seconds between attacks. */
  attackEvery: number;
  speed: number;
  /** Starts chasing within this many tiles. */
  aggro: number;
  reach: number;
  height: number;
  xp: number;
  coins: [number, number];
  loot: Array<{ id: string; chance: number; qty: [number, number] }>;
}

export const ENEMIES: Record<EnemyKind, EnemyType> = {
  bones: {
    name: "Restless Bones",
    model: "skeleton_minion",
    level: 2,
    hp: 18,
    damage: [1, 3],
    attackEvery: 1.6,
    speed: 2.2,
    // Passive: only fights back once attacked.
    aggro: 0,
    reach: 1.3,
    height: 1.5,
    xp: 40,
    coins: [3, 8],
    loot: [
      { id: "copper", chance: 0.35, qty: [1, 2] },
      { id: "oak", chance: 0.3, qty: [1, 2] },
    ],
  },
  warrior: {
    name: "Skeleton Warrior",
    model: "skeleton_warrior",
    level: 12,
    hp: 40,
    damage: [3, 6],
    attackEvery: 1.5,
    speed: 2.5,
    aggro: 4.5,
    reach: 1.4,
    height: 1.8,
    xp: 110,
    coins: [10, 25],
    loot: [
      { id: "iron", chance: 0.4, qty: [1, 2] },
      { id: "willow", chance: 0.3, qty: [1, 2] },
    ],
  },
  mage: {
    name: "Skeleton Mage",
    model: "skeleton_mage",
    level: 22,
    hp: 34,
    damage: [5, 8],
    attackEvery: 1.8,
    speed: 2.3,
    aggro: 6,
    reach: 3.5,
    height: 1.85,
    xp: 160,
    coins: [18, 40],
    loot: [
      { id: "silver", chance: 0.35, qty: [1, 2] },
      { id: "maple", chance: 0.3, qty: [1, 2] },
    ],
  },
  "crypt-king": {
    name: "The Crypt King",
    model: "skeleton_warrior",
    level: 30,
    hp: 160,
    damage: [6, 10],
    attackEvery: 1.7,
    speed: 2.3,
    aggro: 12,
    reach: 1.8,
    height: 2.8,
    xp: 600,
    coins: [120, 180],
    loot: [
      { id: "gold", chance: 1, qty: [2, 3] },
      { id: "yew", chance: 1, qty: [2, 3] },
    ],
  },
};

export interface Splat {
  id: number;
  amount: number;
  at: number;
}

export interface Enemy {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  hp: number;
  state: "idle" | "chase" | "return" | "dead";
  facing: number;
  /** Seconds until it can attack again. */
  cooldown: number;
  wanderTo: { x: number; z: number } | null;
  wanderAt: number;
  deadAt: number;
  /** Respawn time (seconds of game time); camp enemies only. */
  respawnAt: number | null;
  engaged: boolean;
  dungeon: boolean;
  splats: Splat[];
  /** Animation requests read by the renderer (cleared there). */
  anim: "attack" | "hit" | "death" | null;
  /** Snared until this game time (moves at 40%). */
  slowUntil: number;
}

export interface DungeonRun {
  gate: { x: number; z: number };
  wave: number;
  startedAt: number;
  nextWaveAt: number | null;
  done: boolean;
}

export const WAVES: EnemyKind[][] = [["bones", "bones", "bones"], ["warrior", "bones", "mage"], ["crypt-king"]];
export const DUNGEON_LEASH = 14;
export const CAMP_RESPAWN_SECONDS = 45;

export const combat = {
  time: 0,
  enemies: [] as Enemy[],
  player: { hp: 30, max: 30, cooldown: 0, lastHitAt: -99, splats: [] as Splat[], knockedOutAt: -99, wardUntil: -99 },
  /** Spell id -> game time it can be cast again. */
  spellReady: {} as Record<string, number>,
  dungeon: null as DungeonRun | null,
  /** Bumped when the enemy list changes (spawn/despawn), so the renderer re-reads it. */
  version: 0,
  /** Camera shake strength, decays in the camera rig. */
  shake: 0,
};

let splatId = 0;
function addSplat(list: Splat[], amount: number): void {
  list.push({ id: ++splatId, amount, at: combat.time });
  if (list.length > 4) list.shift();
}

// ---------------------------------------------------------------------------
// Numbers (pure)
// ---------------------------------------------------------------------------

export function playerMaxHp(combatLevel: number): number {
  return 30 + (combatLevel - 1) * 2;
}

export function playerHit(combatLevel: number, power: number, random: () => number = Math.random): number {
  const base = 3 + Math.floor(combatLevel / 3) + power;
  return Math.max(1, Math.round(base * (0.7 + random() * 0.6)));
}

export function enemyHit(kind: EnemyKind, random: () => number = Math.random): number {
  const [min, max] = ENEMIES[kind].damage;
  return min + Math.floor(random() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

function makeEnemy(id: string, kind: EnemyKind, x: number, z: number, dungeon: boolean): Enemy {
  return {
    id,
    kind,
    x,
    z,
    homeX: x,
    homeZ: z,
    hp: ENEMIES[kind].hp,
    state: "idle",
    facing: Math.random() * Math.PI * 2,
    cooldown: 1,
    wanderTo: null,
    wanderAt: combat.time + Math.random() * 4,
    deadAt: 0,
    respawnAt: null,
    engaged: false,
    dungeon,
    splats: [],
    anim: null,
    slowUntil: 0,
  };
}

export function syncPlayerMax(): void {
  const level = lifeLevel(realmStore.get(), "combat");
  const max = playerMaxHp(level);
  if (combat.player.max !== max) {
    combat.player.hp = Math.min(max, combat.player.hp + (max - combat.player.max));
    combat.player.max = max;
  }
}

/** Fresh camps for a world (called when the world is built). */
export function spawnCamps(world: World): void {
  combat.enemies = [];
  combat.dungeon = null;
  world.camps.forEach((camp, c) => {
    const kinds: EnemyKind[] = camp.tier === 0 ? ["bones", "bones"] : camp.tier === 1 ? ["warrior", "bones", "bones"] : ["mage", "warrior", "bones"];
    kinds.forEach((kind, k) => {
      const a = (k / kinds.length) * Math.PI * 2;
      combat.enemies.push(makeEnemy(`camp${c}-${k}`, kind, camp.x + 0.5 + Math.cos(a) * 1.2, camp.z + 0.5 + Math.sin(a) * 1.2, false));
    });
  });
  syncPlayerMax();
  combat.player.hp = combat.player.max;
  combat.version++;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export function nearestEnemy(px: number, pz: number, within: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD = within;
  for (const e of combat.enemies) {
    if (e.state === "dead") continue;
    const d = Math.hypot(e.x - px, e.z - pz);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Swing at the nearest enemy in reach. Returns the target (for facing), or null. */
export function playerAttack(px: number, pz: number, random: () => number = Math.random): Enemy | null {
  if (combat.player.cooldown > 0 || combat.player.hp <= 0) return null;
  const target = nearestEnemy(px, pz, 1.9);
  if (!target) return null;
  if (!target.engaged && !target.dungeon) {
    if (!spendFocus(1, "start a fight")) return null;
    target.engaged = true;
  }
  const state = realmStore.get();
  const dmg = playerHit(lifeLevel(state, "combat"), weaponPower(state), random);
  combat.player.cooldown = 0.75;
  target.hp = Math.max(0, target.hp - dmg);
  addSplat(target.splats, dmg);
  spawnBurst("hit", target.x, ENEMIES[target.kind].height * 0.6, target.z);
  target.anim = target.hp > 0 ? "hit" : "death";
  if (target.state === "idle" || target.state === "return") target.state = "chase";
  emit({ type: "sound", name: "hit" });
  combat.shake = Math.max(combat.shake, 0.08);
  if (target.hp <= 0) onKill(target, random);
  return target;
}

function onKill(enemy: Enemy, random: () => number): void {
  const type = ENEMIES[enemy.kind];
  enemy.state = "dead";
  enemy.deadAt = combat.time;
  enemy.respawnAt = enemy.dungeon ? null : combat.time + CAMP_RESPAWN_SECONDS;
  enemy.engaged = false;
  grantLifeXp("combat", type.xp);
  syncPlayerMax();
  const coins = type.coins[0] + Math.floor(random() * (type.coins[1] - type.coins[0] + 1));
  addCoinsPublic(coins);
  const drops: string[] = [`${coins} coins`];
  for (const l of type.loot) {
    if (random() < l.chance) {
      const n = l.qty[0] + Math.floor(random() * (l.qty[1] - l.qty[0] + 1));
      realmStore.set((s) => ({ ...s, progress: { ...s.progress, materials: { ...s.progress.materials, [l.id]: (s.progress.materials[l.id] ?? 0) + n } } }));
      drops.push(`${n} ${l.id}`);
    }
  }
  bumpCounter("kills");
  chat(`You defeat the ${type.name}. Loot: ${drops.join(", ")}.`);
}

/** Casts a spell from the spell bar. Returns the target hit (for facing), the player for self spells, or null. */
export function castSpell(spell: Spell, px: number, pz: number, random: () => number = Math.random): Enemy | "self" | null {
  if (combat.player.hp <= 0) return null;
  const ready = combat.spellReady[spell.id] ?? 0;
  if (combat.time < ready) return null;
  const kind = SPELL_KINDS[spell.kind];
  if (spell.kind === "mend" || spell.kind === "ward") {
    emit({ type: "sound", name: "spell" });
    combat.spellReady[spell.id] = combat.time + kind.cooldown;
    if (spell.kind === "mend") combat.player.hp = Math.min(combat.player.max, combat.player.hp + spellAmount("mend", spell.power));
    else combat.player.wardUntil = combat.time + 5;
    spawnBurst("sparkle", px, 0.6, pz, kind.color, 24);
    emit({ type: "sound", name: "study" });
    return "self";
  }
  const target = nearestEnemy(px, pz, 6);
  if (!target) return null;
  if (!target.engaged && !target.dungeon) {
    if (!spendFocus(1, "start a fight")) return null;
    target.engaged = true;
  }
  combat.spellReady[spell.id] = combat.time + kind.cooldown;
  emit({ type: "sound", name: "spell" });
  const hit = (e: Enemy, amount: number) => {
    const dmg = Math.max(1, Math.round(amount * (0.85 + random() * 0.3)));
    e.hp = Math.max(0, e.hp - dmg);
    addSplat(e.splats, dmg);
    e.anim = e.hp > 0 ? "hit" : "death";
    if (e.state === "idle" || e.state === "return") e.state = "chase";
    if (e.hp <= 0) onKill(e, random);
  };
  if (spell.kind === "bolt") hit(target, spellAmount("bolt", spell.power));
  else if (spell.kind === "blast") {
    for (const e of combat.enemies) if (e.state !== "dead" && Math.hypot(e.x - target.x, e.z - target.z) <= 2.5) hit(e, spellAmount("blast", spell.power));
    spawnBurst("hit", target.x, 0.6, target.z, kind.color, 30);
  } else if (spell.kind === "snare") {
    target.slowUntil = combat.time + 4;
    if (target.state === "idle" || target.state === "return") target.state = "chase";
  }
  emit({ type: "sound", name: "hit" });
  combat.shake = Math.max(combat.shake, spell.kind === "blast" ? 0.14 : 0.06);
  return target;
}

/** Eat the best food in the bag. */
export function playerEat(): boolean {
  const id = bestFood(realmStore.get());
  if (!id || combat.player.hp >= combat.player.max) return false;
  const heal = eat(id);
  combat.player.hp = Math.min(combat.player.max, combat.player.hp + heal);
  emit({ type: "sound", name: "study" });
  chat(`You eat the ${food(id)?.name.toLowerCase()}. It heals ${heal}.`);
  return true;
}

// ---------------------------------------------------------------------------
// Dungeon
// ---------------------------------------------------------------------------

export function startDungeon(gateX: number, gateZ: number, world: World): boolean {
  if (combat.dungeon && !combat.dungeon.done) {
    chat("You're already in the crypt.");
    return false;
  }
  if (!spendFocus(FOCUS.cost.dungeon, "enter the crypt")) return false;
  combat.dungeon = { gate: { x: gateX, z: gateZ }, wave: 0, startedAt: combat.time, nextWaveAt: combat.time + 1.5, done: false };
  combat.player.hp = combat.player.max;
  chat("The crypt doors grind open. Three waves stand between you and the Crypt King.", "quest");
  emit({ type: "sound", name: "quest" });
  void world;
  return true;
}

function spawnWave(world: World): void {
  const run = combat.dungeon!;
  const kinds = WAVES[run.wave];
  kinds.forEach((kind, k) => {
    const a = (k / kinds.length) * Math.PI * 2 + run.wave;
    let x = run.gate.x + Math.cos(a) * 3;
    let z = run.gate.z + Math.sin(a) * 3;
    if (!isWalkable(world, Math.floor(x), Math.floor(z))) {
      x = run.gate.x + Math.cos(a) * 1.5;
      z = run.gate.z + Math.sin(a) * 1.5;
    }
    const e = makeEnemy(`dungeon-${run.wave}-${k}`, kind, x, z, true);
    e.state = "chase";
    combat.enemies.push(e);
  });
  combat.version++;
  chat(run.wave === WAVES.length - 1 ? "The Crypt King rises!" : `Wave ${run.wave + 1} of ${WAVES.length}.`, "quest");
  emit({ type: "sound", name: run.wave === WAVES.length - 1 ? "level" : "click" });
}

function finishDungeon(won: boolean, random: () => number = Math.random): void {
  const run = combat.dungeon;
  if (!run) return;
  run.done = true;
  combat.enemies = combat.enemies.filter((e) => !e.dungeon);
  combat.version++;
  if (!won) {
    chat("You flee the crypt. The dead return to their rest. Try again when you're stronger.");
    return;
  }
  const seconds = Math.round(combat.time - run.startedAt);
  const best = realmStore.get().progress.counters.dungeonBest ?? 0;
  if (!best || seconds < best) realmStore.set((s) => ({ ...s, progress: { ...s.progress, counters: { ...s.progress.counters, dungeonBest: seconds } } }));
  bumpCounter("dungeonClears");
  giveItemPublic("xp-lamp", "Lamp of Insight", null);
  const bonus = 60 + Math.floor(random() * 60);
  addCoinsPublic(bonus);
  emit({ type: "sound", name: "victory" });
  chat(`The crypt is cleared in ${seconds}s${!best || seconds < best ? ", a new best" : ""}. The treasure chest holds ${bonus} coins and a Lamp of Insight.`, "quest");
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

function step(e: Enemy, tx: number, tz: number, speed: number, dt: number, world: World): void {
  const dx = tx - e.x;
  const dz = tz - e.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const s = Math.min(d, speed * dt);
  const nx = e.x + (dx / d) * s;
  const nz = e.z + (dz / d) * s;
  if (isWalkable(world, Math.floor(nx), Math.floor(e.z))) e.x = nx;
  if (isWalkable(world, Math.floor(e.x), Math.floor(nz))) e.z = nz;
  e.facing = Math.atan2(dx, dz);
}

/** True when another creature of the same camp (within a few tiles of home) is already fighting you. */
function packEngaged(e: Enemy): boolean {
  return combat.enemies.some((o) => o !== e && o.engaged && o.state === "chase" && Math.hypot(o.homeX - e.homeX, o.homeZ - e.homeZ) < 6);
}

/** Advances the fight by dt seconds. Returns true when the player was knocked out this tick. */
export function tickCombat(dt: number, world: World, px: number, pz: number, random: () => number = Math.random): boolean {
  combat.time += dt;
  const p = combat.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  let knockedOut = false;

  for (const e of combat.enemies) {
    const type = ENEMIES[e.kind];
    if (e.state === "dead") {
      if (e.respawnAt !== null && combat.time >= e.respawnAt) {
        Object.assign(e, makeEnemy(e.id, e.kind, e.homeX, e.homeZ, false));
        combat.version++;
      }
      continue;
    }
    e.cooldown = Math.max(0, e.cooldown - dt);
    const toPlayer = Math.hypot(px - e.x, pz - e.z);
    const fromHome = Math.hypot(e.x - e.homeX, e.z - e.homeZ);
    if (p.hp <= 0) {
      e.state = "return";
    } else if (e.state === "idle" && (e.engaged || e.dungeon || packEngaged(e)) && toPlayer < type.aggro * 1.6) {
      // Camp creatures are neutral: they only fight once you've attacked them (or one of their pack).
      // Crypt creatures always do.
      e.state = "chase";
    } else if (e.state === "chase" && !e.dungeon && (fromHome > 9 || toPlayer > type.aggro * 2.2)) {
      e.state = "return";
      e.engaged = false;
    }
    if (e.state === "chase") {
      if (toPlayer > type.reach * 0.9) step(e, px, pz, type.speed * (combat.time < e.slowUntil ? 0.4 : 1), dt, world);
      else e.facing = Math.atan2(px - e.x, pz - e.z);
      if (toPlayer <= type.reach && e.cooldown <= 0) {
        e.cooldown = type.attackEvery;
        e.anim = "attack";
        const raw = enemyHit(e.kind, random);
        const warded = buffActive(realmStore.get(), "warding") ? Math.ceil(raw * WARDING_FACTOR) : raw;
        const dmg = combat.time < p.wardUntil ? Math.ceil(warded / 2) : warded;
        p.hp = Math.max(0, p.hp - dmg);
        p.lastHitAt = combat.time;
        addSplat(p.splats, dmg);
        spawnBurst("hit", px, 0.9, pz, "#ff4a3a", 10);
        emit({ type: "sound", name: "miss" });
        combat.shake = Math.max(combat.shake, 0.18);
        if (p.hp <= 0) knockedOut = true;
      }
    } else if (e.state === "return") {
      step(e, e.homeX, e.homeZ, type.speed, dt, world);
      e.hp = Math.min(type.hp, e.hp + dt * 4);
      if (fromHome < 0.3) e.state = "idle";
    } else if (combat.time >= e.wanderAt) {
      // Idle wander around the camp.
      e.wanderTo = { x: e.homeX + (random() - 0.5) * 3, z: e.homeZ + (random() - 0.5) * 3 };
      e.wanderAt = combat.time + 3 + random() * 4;
    } else if (e.wanderTo) {
      step(e, e.wanderTo.x, e.wanderTo.z, type.speed * 0.35, dt, world);
    }
  }

  // Out of combat for a while: slowly heal.
  if (p.hp > 0 && combat.time - p.lastHitAt > 6) p.hp = Math.min(p.max, p.hp + dt * 1.5);

  // Dungeon waves.
  const run = combat.dungeon;
  if (run && !run.done) {
    const alive = combat.enemies.filter((e) => e.dungeon && e.state !== "dead");
    if (Math.hypot(px - run.gate.x, pz - run.gate.z) > DUNGEON_LEASH) finishDungeon(false);
    else if (run.nextWaveAt !== null && combat.time >= run.nextWaveAt) {
      run.nextWaveAt = null;
      spawnWave(world);
    } else if (run.nextWaveAt === null && alive.length === 0) {
      combat.enemies = combat.enemies.filter((e) => !e.dungeon || e.state !== "dead" || combat.time - e.deadAt < 2.5);
      if (run.wave + 1 >= WAVES.length) finishDungeon(true, random);
      else {
        run.wave++;
        run.nextWaveAt = combat.time + 3;
        chat("The wave falls. More stir in the dark…");
      }
    }
  }

  if (knockedOut) {
    p.knockedOutAt = combat.time;
    if (run && !run.done) finishDungeon(false);
    for (const e of combat.enemies) {
      e.engaged = false;
      if (e.state !== "dead") e.state = "return";
    }
    p.hp = p.max;
    chat("You were knocked out. You come round a moment later and the creatures have gone back to their camp. Nothing was lost. Eat food (H) mid-fight to heal.");
    emit({ type: "sound", name: "defeat" });
  }
  return knockedOut;
}

// Dev-only handle for play-testing (stripped from production builds).
if (import.meta.env?.DEV && typeof window !== "undefined") {
  (window as unknown as { __combat?: typeof combat }).__combat = combat;
}
