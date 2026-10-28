/**
 * The archery round runner: aim, draw, breath, arrows in flight, scoring, ends and the
 * quiz range, stepped together. No React or three.js: the scene reads its fields each
 * frame and the overlay listens to its callbacks.
 */

import {
  BOSS_SCALE,
  crossTarget,
  DRAW_TIME,
  EYE_HEIGHT,
  launchArrow,
  MAX_FLIGHT_SECONDS,
  ringScore,
  stepArrow,
  swayAt,
  updateBreath,
  type ArrowState,
  type Breath,
  type Vec3,
  type Wind,
} from "./physics";
import {
  isCorrectTarget,
  PRACTICE_ROUNDS,
  practiceTarget,
  QUIZ_ARROWS_PER_QUESTION,
  QUIZ_WIND_MAX,
  quizHitPoints,
  quizTargets,
  rollWind,
  streakMultiplier,
  targetPosition,
  type ArcheryMode,
  type TargetSpec,
} from "./rules";
import type { QuizItem } from "./quiz";

export type ArcheryPhase = "intro" | "aim" | "flight" | "result" | "done";
export type ArcherySound = "click" | "hit" | "miss" | "level" | "coin" | "victory" | "defeat";

export interface Popup {
  id: number;
  kind: "ring" | "bull" | "miss" | "right" | "wrong" | "bale";
  big: string;
  small: string;
}

export interface StuckArrow {
  /** The target it's in (it moves with it), or null for the ground. */
  targetId: string | null;
  /** Tip position: offset from the target centre, or the world position in the ground. */
  at: Vec3;
  dir: Vec3;
}

export interface Feedback {
  /** Index of the target hit (quiz), or null. */
  hit: number | null;
  correct: boolean | null;
}

export interface ArcheryCallbacks {
  sound(name: ArcherySound): void;
  changed(): void;
  popup(p: Omit<Popup, "id">): void;
  /** A quiz-range answer (a hit on a lettered target). */
  answer(item: QuizItem, correct: boolean): void;
}

const YAW_LIMIT = 0.62;
const PITCH_MIN = -0.25;
const PITCH_MAX = 0.5;
const STEP = 1 / 240;
/** Real seconds the end banner, a shot's result and a quiz answer stay up. */
const INTRO_SECONDS = 1.8;
const RESULT_SECONDS = 0.9;
const QUIZ_RESULT_SECONDS = 2.4;
/** Seconds at full draw before the arms start to tire. */
const HOLD_COMFORT = 2.6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class ArcheryEngine {
  readonly mode: ArcheryMode;
  phase: ArcheryPhase = "intro";
  timer = INTRO_SECONDS;
  /** Seconds since the round started (drives sway and moving targets). */
  t = 0;
  yaw = 0;
  pitch = 0.01;
  drawing = false;
  power = 0;
  holdTime = 0;
  breath: Breath = { air: 1, steady: 0, strain: 0 };
  holdingBreath = false;
  wind: Wind = { x: 0, z: 0 };
  arrow: ArrowState | null = null;
  /** The last arrow's flight ended here (for the arrow camera's pause). */
  landedAt: Vec3 | null = null;
  stuck: StuckArrow[] = [];
  targets: TargetSpec[] = [];
  arrowCam = false;
  /** Bumped on bullseyes, so the scene can play a burst there. */
  burst: { at: Vec3; id: number } | null = null;

  // Target practice
  round = 0;
  /** Ring scores per end. */
  ends: number[][] = PRACTICE_ROUNDS.map(() => []);
  xs = 0;

  // Quiz range
  questions: QuizItem[];
  qIndex = 0;
  arrowsLeft = QUIZ_ARROWS_PER_QUESTION;
  streak = 0;
  bestStreak = 0;
  right = 0;
  wrong = 0;
  skipped = 0;
  quizScore = 0;
  feedback: Feedback | null = null;

  private readonly cb: ArcheryCallbacks;
  private readonly rng: () => number;
  private burstId = 0;

  constructor(mode: ArcheryMode, questions: QuizItem[], cb: ArcheryCallbacks, rng: () => number = Math.random) {
    this.mode = mode;
    this.questions = questions;
    this.cb = cb;
    this.rng = rng;
    this.setupRound();
  }

  get total(): number {
    return this.mode === "practice" ? this.ends.reduce((s, e) => s + e.reduce((a, b) => a + b, 0), 0) : this.quizScore;
  }

  get question(): QuizItem | null {
    return this.mode === "quiz" ? (this.questions[this.qIndex] ?? null) : null;
  }

  get arrowsInEnd(): number {
    return PRACTICE_ROUNDS[this.round]?.arrows ?? 0;
  }

  get multiplier(): number {
    return streakMultiplier(this.streak);
  }

  /** Arms tire after holding full draw; running out of breath shakes too. */
  get fatigue(): number {
    return clamp((this.holdTime - HOLD_COMFORT) / 3, 0, 1) * 0.8 + this.breath.strain * 0.6;
  }

  /** The aim right now, sway included. */
  get aim(): { yaw: number; pitch: number } {
    const s = swayAt(this.t, this.breath.steady, this.fatigue);
    const k = 0.35 + 0.65 * this.power;
    return { yaw: this.yaw + s.yaw * k, pitch: this.pitch + s.pitch * k };
  }

  private setupRound(): void {
    this.stuck = [];
    this.arrow = null;
    this.landedAt = null;
    this.feedback = null;
    this.t = 0;
    if (this.mode === "practice") {
      this.targets = [practiceTarget(this.round)];
      this.wind = rollWind(PRACTICE_ROUNDS[this.round].windMax, this.rng);
    } else {
      this.targets = quizTargets();
      this.wind = rollWind(QUIZ_WIND_MAX, this.rng);
      this.arrowsLeft = QUIZ_ARROWS_PER_QUESTION;
    }
    this.phase = "intro";
    this.timer = this.mode === "practice" ? INTRO_SECONDS : 1.1;
    this.cb.changed();
  }

  /** Mouse look (radians). Aiming is finer while the bow is drawn. */
  look(dYaw: number, dPitch: number): void {
    if (this.phase === "done") return;
    const fine = 1 - 0.55 * this.power;
    this.yaw = clamp(this.yaw + dYaw * fine, -YAW_LIMIT, YAW_LIMIT);
    this.pitch = clamp(this.pitch + dPitch * fine, PITCH_MIN, PITCH_MAX);
  }

  startDraw(): void {
    if (this.phase !== "aim" || this.drawing) return;
    this.drawing = true;
    this.power = 0;
    this.holdTime = 0;
  }

  /** Lets the string down without shooting. */
  cancelDraw(): void {
    this.drawing = false;
    this.power = 0;
    this.holdTime = 0;
  }

  /** Looses the arrow. A barely drawn bow just lets down. */
  release(): void {
    if (!this.drawing) return;
    const power = this.power;
    this.drawing = false;
    this.power = 0;
    this.holdTime = 0;
    if (this.phase !== "aim" || power < 0.12) return;
    const a = this.aim;
    this.arrow = launchArrow({ x: 0, y: EYE_HEIGHT, z: 0 }, a.yaw, a.pitch, power);
    this.landedAt = null;
    this.phase = "flight";
    this.cb.sound("click");
    this.cb.changed();
  }

  tick(dt: number): void {
    this.t += dt;
    this.breath = updateBreath(this.breath, this.holdingBreath && (this.phase === "aim" || this.phase === "flight"), dt);
    if (this.drawing) {
      this.power = Math.min(1, this.power + dt / DRAW_TIME);
      if (this.power >= 1) this.holdTime += dt;
    }
    switch (this.phase) {
      case "intro":
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = "aim";
          this.cb.changed();
        }
        return;
      case "flight":
        this.fly(dt);
        return;
      case "result":
        this.timer -= dt;
        if (this.timer <= 0) this.next();
        return;
      default:
        return;
    }
  }

  targetPos(spec: TargetSpec): Vec3 {
    return targetPosition(spec, this.t);
  }

  private fly(dt: number): void {
    const a = this.arrow;
    if (!a) return;
    for (let left = dt; left > 1e-9; left -= STEP) {
      const prev = { ...a.p };
      stepArrow(a, this.wind, Math.min(STEP, left));
      for (let i = 0; i < this.targets.length; i++) {
        const spec = this.targets[i];
        const pos = this.targetPos(spec);
        const hit = crossTarget(prev, a.p, { ...pos, radius: spec.radius });
        if (hit) {
          this.onTargetHit(i, hit.dx, hit.dy, a);
          return;
        }
      }
      if (a.p.y <= 0.02) {
        a.p.y = 0.02;
        this.onMiss(a, true);
        return;
      }
      if (a.t > MAX_FLIGHT_SECONDS || a.p.z < -120) {
        this.onMiss(a, false);
        return;
      }
    }
  }

  private dirOf(a: ArrowState): Vec3 {
    const s = Math.hypot(a.v.x, a.v.y, a.v.z) || 1;
    return { x: a.v.x / s, y: a.v.y / s, z: a.v.z / s };
  }

  private onTargetHit(index: number, dx: number, dy: number, a: ArrowState): void {
    const spec = this.targets[index];
    const pos = this.targetPos(spec);
    const dir = this.dirOf(a);
    this.stuck.push({ targetId: spec.id, at: { x: dx, y: dy, z: 0 }, dir });
    this.landedAt = { x: pos.x + dx, y: pos.y + dy, z: pos.z };
    this.arrow = null;
    const { ring, x } = ringScore(dx, dy, spec.radius);
    if (this.mode === "practice") {
      this.ends[this.round].push(ring);
      if (x) this.xs++;
      if (ring >= 10) {
        this.burst = { at: this.landedAt, id: ++this.burstId };
        this.cb.sound("level");
        this.cb.popup({ kind: "bull", big: x ? "X" : "10", small: x ? "Dead centre!" : "Bullseye!" });
      } else if (ring > 0) {
        this.cb.sound("hit");
        this.cb.popup({ kind: "ring", big: String(ring), small: ring >= 8 ? "Great shot" : ring >= 5 ? "Good" : "On the board" });
      } else {
        this.cb.sound("miss");
        this.cb.popup({ kind: "bale", big: "0", small: "In the straw" });
      }
      this.toResult(RESULT_SECONDS);
      return;
    }
    // Quiz range: the letter you hit is your answer.
    const item = this.question;
    if (!item) return;
    const correct = isCorrectTarget(index, item.question);
    this.feedback = { hit: index, correct };
    this.cb.answer(item, correct);
    if (correct) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.right++;
      const pts = quizHitPoints(ring, this.streak);
      this.quizScore += pts;
      if (ring >= 10) this.burst = { at: this.landedAt, id: ++this.burstId };
      this.cb.sound(ring >= 10 ? "level" : "coin");
      this.cb.popup({ kind: "right", big: `+${pts}`, small: this.streak >= 2 ? `Right! Streak x${streakMultiplier(this.streak)}` : "Right!" });
    } else {
      this.streak = 0;
      this.wrong++;
      this.cb.sound("miss");
      this.cb.popup({ kind: "wrong", big: "Wrong", small: `It was ${"ABCD"[item.question.answerIndex]}` });
    }
    this.toResult(QUIZ_RESULT_SECONDS);
  }

  private onMiss(a: ArrowState, inGround: boolean): void {
    const dir = this.dirOf(a);
    if (inGround) this.stuck.push({ targetId: null, at: { ...a.p }, dir });
    this.landedAt = { ...a.p };
    this.arrow = null;
    this.cb.sound("miss");
    if (this.mode === "practice") {
      this.ends[this.round].push(0);
      this.cb.popup({ kind: "miss", big: "Miss", small: "Watch the wind and the drop" });
      this.toResult(RESULT_SECONDS);
      return;
    }
    this.arrowsLeft--;
    if (this.arrowsLeft > 0) {
      this.cb.popup({ kind: "miss", big: "Miss", small: "One more arrow" });
      this.toResult(RESULT_SECONDS);
      return;
    }
    const item = this.question;
    this.skipped++;
    this.streak = 0;
    this.feedback = { hit: null, correct: null };
    this.cb.popup({ kind: "miss", big: "Out of arrows", small: item ? `It was ${"ABCD"[item.question.answerIndex]}` : "" });
    this.toResult(QUIZ_RESULT_SECONDS);
  }

  private toResult(seconds: number): void {
    this.phase = "result";
    this.timer = this.arrowCam ? seconds + 0.5 : seconds;
    this.cb.changed();
  }

  private next(): void {
    if (this.mode === "practice") {
      if (this.ends[this.round].length < this.arrowsInEnd) {
        this.phase = "aim";
        this.cb.changed();
        return;
      }
      this.round++;
      if (this.round >= PRACTICE_ROUNDS.length) return this.finish();
      this.setupRound();
      return;
    }
    // Quiz: another arrow at the same question, or the next question.
    if (!this.feedback && this.arrowsLeft > 0) {
      this.phase = "aim";
      this.cb.changed();
      return;
    }
    this.qIndex++;
    if (this.qIndex >= this.questions.length) return this.finish();
    this.setupRound();
  }

  private finish(): void {
    this.phase = "done";
    this.cb.changed();
  }

  /** The boss half-size for a target (for drawing). */
  static bossHalf(spec: TargetSpec): number {
    return spec.radius * BOSS_SCALE;
  }
}
