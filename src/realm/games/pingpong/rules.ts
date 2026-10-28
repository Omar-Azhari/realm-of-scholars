/**
 * Table-tennis rules: who wins each rally, who serves, and when the match is over.
 * Pure functions over plain data (unit-tested in scripts/verify-realm.ts).
 *
 * Simplified ITTF rules:
 * - A serve must bounce once on the server's half, then on the receiver's half.
 *   A serve that touches the net and is otherwise good is a let (served again).
 * - In a rally, the ball must clear the net and bounce on the opponent's half.
 *   Bouncing on your own half after your hit, or missing the table, loses the point.
 * - The receiver must return it after exactly one bounce: a second bounce, or letting it
 *   reach the floor, loses the point. (The paddle can't hit before the bounce.)
 * - Service changes every two points, and every point once both players reach 10
 *   (6 in the first-to-7 game). A game is won by reaching the target with a 2-point lead.
 */

import { otherSide, type Side } from "./physics";

export interface Rally {
  server: Side;
  /** True from the serve until the receiver returns it. */
  serving: boolean;
  /** Who touched the ball last (the server, at the start). */
  lastHitter: Side;
  /** Bounces on each half since the last hit. */
  bounces: Record<Side, number>;
  /** The serve clipped the net. */
  netOnServe: boolean;
  /** The ball touched the net since the last hit. */
  netSinceHit: boolean;
  /** Paddle hits in this rally, the serve included. */
  hits: number;
  over: boolean;
}

export type RallyOutcome = { kind: "point"; to: Side; reason: string } | { kind: "let"; reason: string } | null;

export function newRally(server: Side): Rally {
  return { server, serving: true, lastHitter: server, bounces: { near: 0, far: 0 }, netOnServe: false, netSinceHit: false, hits: 0, over: false };
}

const point = (r: Rally, to: Side, reason: string): RallyOutcome => {
  r.over = true;
  return { kind: "point", to, reason };
};

/** Whether `by` may hit the ball now: it's their turn and it has bounced once on their half. */
export function canHit(r: Rally, by: Side): boolean {
  if (r.over) return false;
  if (r.hits === 0) return by === r.server;
  return r.lastHitter !== by && r.bounces[by] === 1;
}

/** A paddle hit. The first hit is the serve. */
export function onHit(r: Rally, by: Side): RallyOutcome {
  if (r.over) return null;
  if (!canHit(r, by)) return point(r, otherSide(by), "hit out of turn");
  if (r.hits > 0) r.serving = false;
  r.hits++;
  r.lastHitter = by;
  r.bounces = { near: 0, far: 0 };
  r.netSinceHit = false;
  return null;
}

export function onNet(r: Rally): RallyOutcome {
  if (r.over) return null;
  r.netSinceHit = true;
  if (r.serving) r.netOnServe = true;
  return null;
}

export function onBounce(r: Rally, side: Side): RallyOutcome {
  if (r.over || r.hits === 0) return null;
  const hitter = r.lastHitter;
  const receiver = otherSide(hitter);
  if (r.serving) {
    if (side === hitter) {
      if (r.bounces[hitter] === 0 && r.bounces[receiver] === 0) {
        r.bounces[hitter] = 1;
        return null;
      }
      return point(r, receiver, r.bounces[receiver] > 0 ? "double bounce" : r.netSinceHit ? "serve into the net" : "fault: the serve bounced twice on the server's half");
    }
    if (r.bounces[hitter] !== 1) return point(r, receiver, "fault: a serve must bounce on your own half first");
    if (r.bounces[receiver] === 0 && r.netOnServe) {
      r.over = true;
      return { kind: "let", reason: "let: the serve clipped the net" };
    }
    r.bounces[receiver]++;
    return r.bounces[receiver] >= 2 ? point(r, hitter, "ace!") : null;
  }
  if (side === hitter) return point(r, receiver, r.netSinceHit ? "into the net" : "bounced on your own side");
  r.bounces[receiver]++;
  return r.bounces[receiver] >= 2 ? point(r, hitter, "double bounce") : null;
}

/** The ball reached the floor (or flew away). */
export function onFloor(r: Rally): RallyOutcome {
  if (r.over || r.hits === 0) return null;
  const hitter = r.lastHitter;
  const receiver = otherSide(hitter);
  if (r.bounces[receiver] >= 1) return point(r, hitter, r.serving ? "ace!" : "missed the return");
  if (r.serving && r.netOnServe) return point(r, receiver, "serve into the net");
  return point(r, receiver, r.netSinceHit ? "into the net" : "out");
}

// ---------------------------------------------------------------------------
// The match
// ---------------------------------------------------------------------------

export type MatchLength = 11 | 7;

export interface MatchState {
  target: MatchLength;
  score: Record<Side, number>;
  /** Rallies finished (lets don't count). Drives service order. */
  played: number;
  firstServer: Side;
}

export function newMatch(target: MatchLength, firstServer: Side): MatchState {
  return { target, score: { near: 0, far: 0 }, played: 0, firstServer };
}

/** Both players one point from the target: deuce, service alternates every point. */
export function isDeuce(m: MatchState): boolean {
  return m.score.near >= m.target - 1 && m.score.far >= m.target - 1;
}

/** Who serves the next rally. */
export function serverFor(m: MatchState): Side {
  const block = isDeuce(m) ? m.played : Math.floor(m.played / 2);
  return block % 2 === 0 ? m.firstServer : otherSide(m.firstServer);
}

export function winnerOf(m: MatchState): Side | null {
  const { near, far } = m.score;
  if (near >= m.target && near - far >= 2) return "near";
  if (far >= m.target && far - near >= 2) return "far";
  return null;
}

/** A rally's point (counts toward service order). */
export function awardRally(m: MatchState, to: Side): MatchState {
  return { ...m, score: { ...m.score, [to]: m.score[to] + 1 }, played: m.played + 1 };
}

/** A rally-quiz bonus point: adds to the score without moving the service order. */
export function awardBonus(m: MatchState, to: Side): MatchState {
  return { ...m, score: { ...m.score, [to]: m.score[to] + 1 } };
}

/**
 * A single number for personal bests and medals, the same for both match lengths:
 * a win scores 100 plus up to 100 for the margin; a loss scores up to 99 for points won.
 */
export function matchRating(mine: number, theirs: number, target: MatchLength): number {
  if (mine > theirs && mine >= target) return 100 + Math.min(100, Math.round((100 * (mine - theirs)) / target));
  return Math.min(99, Math.round((100 * mine) / target));
}

/** Bronze for any win, silver for winning by ~5 of 11 (3 of 7), gold by ~8 of 11 (5 of 7). */
export const MATCH_MEDALS: [number, number, number] = [100, 140, 170];

/** Every this many paddle hits in one rally, the rally quiz may pause for a question. */
export const RALLY_QUIZ_HITS = 5;
