/**
 * The ping-pong match runner: ball, rally rules, rival and score stepped together.
 * No React or three.js; the scene reads its fields each frame and the overlay listens
 * to its callbacks.
 */

import { AI_PROFILES, aiCanReach, aiReturn, aiServe, aiThink, newBrain, type AiBrain, type AiProfile, type Difficulty } from "./ai";
import {
  HALF_L,
  PADDLE_HIT_RADIUS,
  PADDLE_X_RANGE,
  PADDLE_Y_MAX,
  PADDLE_Y_MIN,
  planServe,
  PLAYER_PADDLE_Z,
  playerReturn,
  RIVAL_PADDLE_Z,
  STEP,
  stepBall,
  type Ball,
  type Side,
} from "./physics";
import { awardBonus, awardRally, canHit, newMatch, newRally, onBounce, onFloor, onHit, onNet, RALLY_QUIZ_HITS, serverFor, winnerOf, type MatchLength, type MatchState, type Rally, type RallyOutcome } from "./rules";

export type EnginePhase = "serve" | "rally" | "point" | "quiz" | "resume" | "over";
export type EngineSound = "hit" | "click" | "miss" | "coin" | "victory" | "defeat";

export interface EngineCallbacks {
  sound(name: EngineSound): void;
  /** Score, server or phase changed: the overlay should redraw. */
  changed(): void;
  /** The rally just reached the quiz hit count. */
  quiz(): void;
}

/** Seconds (real time) the "point to" banner stays up, the rival waits to serve, and the post-quiz countdown. */
const POINT_PAUSE = 1.4;
const RIVAL_SERVE_DELAY = 1.1;
const RESUME_DELAY = 1.8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class PingPongEngine {
  readonly difficulty: Difficulty;
  readonly profile: AiProfile;
  readonly quizEnabled: boolean;
  ball: Ball = { x: 0, y: 1, z: PLAYER_PADDLE_Z, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
  rally: Rally;
  match: MatchState;
  brain: AiBrain = newBrain();
  phase: EnginePhase = "serve";
  /** Real seconds left in the current pause (point banner, rival serve, resume). */
  timer = 0;
  paddle = { x: 0, y: 1.0, vx: 0, vy: 0 };
  /** Seconds since the player's paddle last hit (for the swing animation). */
  swingAge = 9;
  rivalSwingAge = 9;
  lastPoint: { to: Side; reason: string } | null = null;
  lastLet = "";
  /** Longest rally (paddle hits) this match. */
  longestRally = 0;
  quizAskedThisRally = false;
  quizRight = 0;
  quizAsked = 0;
  /** Recent ball positions for the motion trail. */
  trail: Array<{ x: number; y: number; z: number }> = [];
  /** Where the ball last bounced on the table (for the bounce mark) and when (performance.now ms). */
  lastBounce: { x: number; z: number; at: number } | null = null;
  private rallyTime = 0;
  private readonly rng: () => number;
  private readonly cb: EngineCallbacks;

  constructor(difficulty: Difficulty, length: MatchLength, quizEnabled: boolean, cb: EngineCallbacks, rng: () => number = Math.random) {
    this.difficulty = difficulty;
    this.profile = AI_PROFILES[difficulty];
    this.quizEnabled = quizEnabled;
    this.cb = cb;
    this.rng = rng;
    const first: Side = rng() < 0.5 ? "near" : "far";
    this.match = newMatch(length, first);
    this.rally = newRally(first);
    this.startServe();
  }

  get server(): Side {
    return this.rally.server;
  }

  /** Moves the player's paddle (clamped to its area) and tracks its velocity, in m/s of real time. */
  setPaddle(x: number, y: number, dt: number): void {
    const nx = clamp(x, -PADDLE_X_RANGE, PADDLE_X_RANGE);
    const ny = clamp(y, PADDLE_Y_MIN, PADDLE_Y_MAX);
    if (dt > 0) {
      const a = Math.min(1, dt * 18);
      this.paddle.vx += ((nx - this.paddle.x) / dt - this.paddle.vx) * a;
      this.paddle.vy += ((ny - this.paddle.y) / dt - this.paddle.vy) * a;
    }
    this.paddle.x = nx;
    this.paddle.y = ny;
  }

  private startServe(): void {
    this.phase = "serve";
    this.quizAskedThisRally = false;
    this.rallyTime = 0;
    this.trail = [];
    this.timer = this.rally.server === "far" ? RIVAL_SERVE_DELAY : 0;
    this.holdBallForServe(0);
    this.cb.changed();
  }

  /** The ball waits above the server's paddle, bobbing as it's tossed. */
  private holdBallForServe(t: number): void {
    const bob = Math.abs(Math.sin(t * 2.4)) * 0.08;
    if (this.rally.server === "near") {
      this.ball = { x: this.paddle.x, y: Math.max(this.paddle.y, 0.95) + 0.14 + bob, z: PLAYER_PADDLE_Z - 0.06, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
    } else {
      this.ball = { x: this.brain.x, y: 1.06 + bob, z: RIVAL_PADDLE_Z + 0.08, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
    }
  }

  /**
   * The player serves (a click). Paddle position aims it: left/right picks the side,
   * high or low picks a long or short serve; moving the paddle up or down while serving
   * adds topspin or backspin.
   */
  playerServe(): boolean {
    if (this.phase !== "serve" || this.rally.server !== "near") return false;
    const from = { x: this.ball.x, y: Math.min(1.12, this.ball.y), z: this.ball.z };
    const depth = (this.paddle.y - PADDLE_Y_MIN) / (PADDLE_Y_MAX - PADDLE_Y_MIN);
    const target = { x: clamp(this.paddle.x * 0.65, -0.6, 0.6), z: -(0.55 + depth * 0.65) };
    const shot = planServe(from, target, clamp(this.paddle.vy / 3, -1, 1), clamp(-this.paddle.vx / 4, -0.6, 0.6));
    this.ball = { ...from, ...shot };
    onHit(this.rally, "near");
    this.swingAge = 0;
    this.phase = "rally";
    this.cb.sound("hit");
    this.cb.changed();
    return true;
  }

  /** Advances the match by `realDt` seconds of real time (`simDt` of game physics). */
  tick(realDt: number, simDt: number): void {
    this.swingAge += realDt;
    this.rivalSwingAge += realDt;
    switch (this.phase) {
      case "serve":
        this.timer -= realDt;
        this.holdBallForServe(performance.now() / 1000);
        aiThink(this.brain, this.ball, false, this.profile, simDt, this.rng);
        if (this.rally.server === "far" && this.timer <= 0) {
          const shot = aiServe(this.brain, this.profile, this.rng);
          this.ball = { x: this.brain.x, y: 1.0, z: RIVAL_PADDLE_Z + 0.1, ...shot };
          onHit(this.rally, "far");
          this.rivalSwingAge = 0;
          this.phase = "rally";
          this.cb.sound("hit");
          this.cb.changed();
        }
        return;
      case "rally":
        this.simulate(simDt);
        return;
      case "point": {
        this.timer -= realDt;
        // The dead ball keeps falling and bouncing; nothing it does counts now.
        for (let left = simDt; left > 1e-9; left -= STEP) stepBall(this.ball, Math.min(STEP, left));
        aiThink(this.brain, this.ball, false, this.profile, simDt, this.rng);
        if (this.timer <= 0) this.nextRally();
        return;
      }
      case "resume":
        this.timer -= realDt;
        if (this.timer <= 0) {
          this.phase = "rally";
          this.cb.changed();
        }
        return;
      default:
        return;
    }
  }

  private simulate(simDt: number): void {
    let left = simDt;
    while (left > 1e-9 && this.phase === "rally") {
      const dt = Math.min(STEP, left);
      left -= dt;
      this.rallyTime += dt;
      const pz = this.ball.z;
      const events = stepBall(this.ball, dt);
      for (const e of events) {
        let outcome: RallyOutcome = null;
        if (e.type === "table") {
          this.cb.sound("click");
          this.lastBounce = { x: e.x, z: e.z, at: performance.now() };
          outcome = onBounce(this.rally, e.side);
        } else if (e.type === "net") outcome = onNet(this.rally);
        else outcome = onFloor(this.rally);
        if (outcome) {
          this.resolve(outcome);
          return;
        }
      }
      // A ball that somehow never comes down (or rolls away) ends the rally as out.
      if (this.rallyTime > 10 || Math.abs(this.ball.z) > HALF_L + 5 || Math.abs(this.ball.x) > 5) {
        const outcome = onFloor(this.rally);
        if (outcome) {
          this.resolve(outcome);
          return;
        }
      }
      const incoming = this.rally.lastHitter === "near" && this.rally.hits > 0;
      aiThink(this.brain, this.ball, incoming, this.profile, dt, this.rng);

      // The player's paddle.
      if (pz < PLAYER_PADDLE_Z && this.ball.z >= PLAYER_PADDLE_Z && this.ball.vz > 0 && canHit(this.rally, "near")) {
        if (Math.hypot(this.ball.x - this.paddle.x, (this.ball.y - this.paddle.y) * 0.85) <= PADDLE_HIT_RADIUS) {
          const ret = playerReturn(this.ball, this.paddle);
          this.ball = { ...this.ball, z: PLAYER_PADDLE_Z - 0.001, ...ret.shot };
          onHit(this.rally, "near");
          this.swingAge = 0;
          this.cb.sound("hit");
          if (this.afterHit()) return;
        }
      }
      // The rival's paddle.
      if (pz > RIVAL_PADDLE_Z && this.ball.z <= RIVAL_PADDLE_Z && this.ball.vz < 0 && canHit(this.rally, "far")) {
        if (aiCanReach(this.brain, this.ball, this.profile)) {
          const { shot } = aiReturn(this.ball, this.profile, this.rng);
          this.ball = { ...this.ball, z: RIVAL_PADDLE_Z + 0.001, ...shot };
          onHit(this.rally, "far");
          this.rivalSwingAge = 0;
          this.cb.sound("hit");
          if (this.afterHit()) return;
        }
      }
    }
    this.trail.push({ x: this.ball.x, y: this.ball.y, z: this.ball.z });
    if (this.trail.length > 7) this.trail.shift();
  }

  /** After a good hit: maybe pause for the rally quiz. True when it paused. */
  private afterHit(): boolean {
    this.longestRally = Math.max(this.longestRally, this.rally.hits);
    this.cb.changed();
    if (this.quizEnabled && !this.quizAskedThisRally && this.rally.hits >= RALLY_QUIZ_HITS) {
      this.quizAskedThisRally = true;
      this.phase = "quiz";
      this.cb.quiz();
      this.cb.changed();
      return true;
    }
    return false;
  }

  /** The overlay answered (or skipped) the rally quiz. A right answer is a bonus point. */
  answerQuiz(right: boolean | null): void {
    if (this.phase !== "quiz") return;
    if (right !== null) this.quizAsked++;
    if (right) {
      this.quizRight++;
      this.match = awardBonus(this.match, "near");
      this.cb.sound("coin");
    } else if (right === false) this.cb.sound("miss");
    this.phase = "resume";
    this.timer = RESUME_DELAY;
    this.cb.changed();
  }

  private resolve(outcome: NonNullable<RallyOutcome>): void {
    this.phase = "point";
    this.timer = POINT_PAUSE;
    if (outcome.kind === "let") {
      this.lastLet = outcome.reason;
      this.lastPoint = null;
    } else {
      this.lastLet = "";
      this.lastPoint = { to: outcome.to, reason: outcome.reason };
      this.match = awardRally(this.match, outcome.to);
      this.cb.sound(outcome.to === "near" ? "coin" : "miss");
    }
    this.longestRally = Math.max(this.longestRally, this.rally.hits);
    this.cb.changed();
  }

  private nextRally(): void {
    const winner = winnerOf(this.match);
    if (winner) {
      this.phase = "over";
      this.cb.sound(winner === "near" ? "victory" : "defeat");
      this.cb.changed();
      return;
    }
    // A let replays with the same server; otherwise service follows the score.
    const server = this.lastLet ? this.rally.server : serverFor(this.match);
    this.rally = newRally(server);
    this.startServe();
  }

  /** Points scored by the player and the rival. */
  get score(): { you: number; rival: number } {
    return { you: this.match.score.near, rival: this.match.score.far };
  }
}
