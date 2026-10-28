/**
 * Tiny synthesised sound effects (Web Audio) — no audio files needed.
 * A short fanfare for level-ups, a chime for quests, thuds for combat,
 * footsteps, and a quiet, endlessly varying medieval background tune.
 */

import type { SoundName } from "./state/events";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(audio: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, gain: number): void {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + start);
  amp.gain.setValueAtTime(0.0001, audio.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(gain, audio.currentTime + start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.05);
}

const NOTE = (semitone: number) => 440 * Math.pow(2, (semitone - 9) / 12);

export function playSound(name: SoundName): void {
  const audio = context();
  if (!audio) return;
  switch (name) {
    case "level": {
      const seq = [0, 4, 7, 12, 7, 12, 16];
      seq.forEach((s, i) => tone(audio, NOTE(s + 12), i * 0.11, 0.22, "square", 0.05));
      tone(audio, NOTE(0), 0, 0.8, "triangle", 0.06);
      break;
    }
    case "quest": {
      [0, 4, 7, 11, 12].forEach((s, i) => tone(audio, NOTE(s + 12), i * 0.14, 0.4, "triangle", 0.07));
      break;
    }
    case "victory":
      [7, 12, 16, 19].forEach((s, i) => tone(audio, NOTE(s + 12), i * 0.09, 0.3, "square", 0.045));
      break;
    case "defeat":
      [7, 3, 0].forEach((s, i) => tone(audio, NOTE(s), i * 0.16, 0.35, "sawtooth", 0.04));
      break;
    case "hit":
      tone(audio, 140, 0, 0.12, "sawtooth", 0.08);
      tone(audio, 90, 0.03, 0.12, "square", 0.06);
      break;
    case "miss":
      tone(audio, 220, 0, 0.18, "triangle", 0.05);
      break;
    case "study":
      [0, 7, 12].forEach((s, i) => tone(audio, NOTE(s + 24), i * 0.07, 0.25, "sine", 0.05));
      break;
    case "coin":
      tone(audio, NOTE(28), 0, 0.08, "square", 0.04);
      tone(audio, NOTE(33), 0.07, 0.14, "square", 0.04);
      break;
    case "click":
      tone(audio, 660, 0, 0.04, "square", 0.02);
      break;
    case "spell": {
      // A rising shimmer.
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, audio.currentTime + 0.22);
      amp.gain.setValueAtTime(0.0001, audio.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.06, audio.currentTime + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.3);
      osc.connect(amp).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.32);
      tone(audio, NOTE(31), 0.08, 0.18, "triangle", 0.025);
      break;
    }
    case "thunder": {
      // A low, rolling rumble of filtered noise.
      const length = 2.4;
      const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * length), audio.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
        data[i] = last * 6;
      }
      const src = audio.createBufferSource();
      src.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 260;
      const amp = audio.createGain();
      amp.gain.setValueAtTime(0.0001, audio.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.5, audio.currentTime + 0.08);
      amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + length);
      src.connect(filter).connect(amp).connect(audio.destination);
      src.start();
      break;
    }
    case "owl":
      tone(audio, 392, 0, 0.32, "sine", 0.05);
      tone(audio, 330, 0.42, 0.5, "sine", 0.045);
      break;
    case "house":
      [0, 5, 9, 12, 9, 14].forEach((s, i) => tone(audio, NOTE(s + 12), i * 0.12, 0.3, "triangle", 0.05));
      break;
  }
}

/** Music level while a study window (duel, Grimoire, focus…) is open: quieter, so you can think. */
let duck = 1;
export function duckMusic(quiet: boolean): void {
  duck = quiet ? 0.35 : 1;
  if (music && ctx) music.master.gain.setTargetAtTime(0.55 * duck, ctx.currentTime, 0.6);
}

// ---------------------------------------------------------------------------
// Footsteps
// ---------------------------------------------------------------------------

let noiseBuffer: AudioBuffer | null = null;

function noise(audio: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== audio.sampleRate) {
    noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.2), audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export type StepSurface = "grass" | "stone" | "dirt" | "sand";

/** One footstep: a short filtered noise burst, brighter on stone than on grass. */
export function playFootstep(surface: StepSurface): void {
  const audio = context();
  if (!audio || audio.state !== "running") return;
  const source = audio.createBufferSource();
  source.buffer = noise(audio);
  source.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = audio.createBiquadFilter();
  filter.type = surface === "stone" ? "bandpass" : "lowpass";
  filter.frequency.value = surface === "stone" ? 1900 : surface === "sand" ? 1200 : surface === "dirt" ? 700 : 520;
  filter.Q.value = surface === "stone" ? 1.4 : 0.7;
  const amp = audio.createGain();
  const t = audio.currentTime;
  const peak = surface === "stone" ? 0.07 : 0.09;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + (surface === "stone" ? 0.07 : 0.12));
  source.connect(filter).connect(amp).connect(audio.destination);
  source.start(t);
  source.stop(t + 0.15);
}

// ---------------------------------------------------------------------------
// Background music: D dorian, a slow lute arpeggio over soft pads with an
// occasional recorder phrase. Generated live, so it never loops exactly.
// ---------------------------------------------------------------------------

const BEAT = 0.42;
/** Chord roots (semitones from D) and their dorian triads. */
const PROGRESSIONS = [
  [
    [0, 3, 7],
    [-2, 2, 5],
    [-4, 0, 3],
    [-2, 2, 5],
  ],
  [
    [0, 3, 7],
    [5, 9, 12],
    [-2, 2, 5],
    [0, 3, 7],
  ],
];
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15];
const D3 = 146.83;
const hz = (semitone: number) => D3 * Math.pow(2, semitone / 12);

let music: { timer: number; master: GainNode; next: number; bar: number; prog: number } | null = null;

function pluck(audio: AudioContext, out: AudioNode, freq: number, at: number, gain: number): void {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, at);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freq * 6, at);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, at + 0.6);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  osc.connect(filter).connect(amp).connect(out);
  osc.start(at);
  osc.stop(at + 1.5);
}

function pad(audio: AudioContext, out: AudioNode, freqs: number[], at: number, length: number): void {
  for (const freq of freqs) {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, at);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.linearRampToValueAtTime(0.05, at + length * 0.3);
    amp.gain.linearRampToValueAtTime(0.0001, at + length);
    osc.connect(amp).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

function recorder(audio: AudioContext, out: AudioNode, freq: number, at: number, length: number): void {
  const osc = audio.createOscillator();
  const vibrato = audio.createOscillator();
  const depth = audio.createGain();
  const amp = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  vibrato.frequency.value = 5;
  depth.gain.value = freq * 0.006;
  vibrato.connect(depth).connect(osc.frequency);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.linearRampToValueAtTime(0.045, at + 0.08);
  amp.gain.setValueAtTime(0.045, at + length - 0.1);
  amp.gain.linearRampToValueAtTime(0.0001, at + length);
  osc.connect(amp).connect(out);
  osc.start(at);
  vibrato.start(at);
  osc.stop(at + length + 0.05);
  vibrato.stop(at + length + 0.05);
}

/** Schedules one bar (8 beats) of music starting at `at`. */
function scheduleBar(audio: AudioContext, out: AudioNode, at: number, bar: number, prog: number): void {
  const chord = PROGRESSIONS[prog][bar % 4];
  pad(audio, out, chord.map((s) => hz(s)), at, BEAT * 8);
  const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
  pattern.forEach((n, i) => pluck(audio, out, hz(chord[n] + 12), at + i * BEAT, i === 0 ? 0.07 : 0.045));
  // A recorder phrase every other bar, notes drawn from the scale near the chord.
  if (bar % 2 === 1 && Math.random() < 0.8) {
    let degree = DORIAN.indexOf(chord[0] < 0 ? chord[1] : chord[0]);
    if (degree < 0) degree = 2;
    let t = at;
    const lengths = Math.random() < 0.5 ? [2, 1, 1, 2, 2] : [1, 1, 2, 4];
    for (const beats of lengths) {
      degree = Math.max(0, Math.min(DORIAN.length - 1, degree + (Math.floor(Math.random() * 5) - 2)));
      recorder(audio, out, hz(DORIAN[degree] + 24), t, beats * BEAT * 0.95);
      t += beats * BEAT;
    }
  }
}

export function startMusic(): void {
  const audio = context();
  if (!audio || music) return;
  const master = audio.createGain();
  master.gain.value = 0.0001;
  master.connect(audio.destination);
  master.gain.setTargetAtTime(0.55 * duck, audio.currentTime + 0.1, 1.5);
  const state = { timer: 0, master, next: audio.currentTime + 0.3, bar: 0, prog: 0 };
  const tick = () => {
    if (audio.state !== "running") return;
    // After a pause (tab hidden, audio suspended) restart from now instead of replaying missed bars.
    if (state.next < audio.currentTime) state.next = audio.currentTime + 0.1;
    while (state.next < audio.currentTime + 1.2) {
      scheduleBar(audio, master, state.next, state.bar, state.prog);
      state.next += BEAT * 8;
      state.bar += 1;
      if (state.bar % 8 === 0) state.prog = Math.floor(Math.random() * PROGRESSIONS.length);
    }
  };
  state.timer = window.setInterval(tick, 250);
  tick();
  music = state;
}

export function stopMusic(): void {
  if (!music || !ctx) return;
  const current = music;
  music = null;
  window.clearInterval(current.timer);
  current.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  window.setTimeout(() => current.master.disconnect(), 2000);
}

/** Browsers start audio suspended until the player clicks or presses a key. */
export function resumeAudioOnGesture(): () => void {
  const resume = () => {
    const audio = context();
    if (audio && audio.state === "running") cleanup();
  };
  const cleanup = () => {
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume);
  window.addEventListener("keydown", resume);
  return cleanup;
}

// ---------------------------------------------------------------------------
// Ambience: birdsong by day, crickets at night, waves near the shore
// ---------------------------------------------------------------------------

export interface AmbienceMood {
  night: boolean;
  /** 0 inland – 1 right on the shore. */
  water: number;
}

let ambience: { timer: number; master: GainNode; surf: GainNode; noise: AudioBufferSourceNode } | null = null;

function surfBuffer(audio: AudioContext): AudioBuffer {
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  // Brown-ish noise: softer than white, like distant surf.
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function chirp(audio: AudioContext, out: AudioNode, at: number): void {
  const notes = 2 + Math.floor(Math.random() * 3);
  const base = 2400 + Math.random() * 1600;
  for (let n = 0; n < notes; n++) {
    const t = at + n * (0.09 + Math.random() * 0.05);
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * (1 + Math.random() * 0.25), t);
    osc.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), t + 0.07);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.018, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(amp).connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

function cricket(audio: AudioContext, out: AudioNode, at: number): void {
  const freq = 4200 + Math.random() * 600;
  for (let p = 0; p < 3; p++) {
    const t = at + p * 0.05;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.008, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    osc.connect(amp).connect(out);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

/** Starts the ambient soundscape. `mood` is read every half second. */
export function startAmbience(mood: () => AmbienceMood): void {
  const audio = context();
  if (!audio || ambience) return;
  const master = audio.createGain();
  master.gain.value = 0.0001;
  master.connect(audio.destination);
  master.gain.setTargetAtTime(0.9, audio.currentTime + 0.1, 2);
  // Surf: looping noise through a low-pass filter whose volume swells like waves.
  const noise = audio.createBufferSource();
  noise.buffer = surfBuffer(audio);
  noise.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  const surf = audio.createGain();
  surf.gain.value = 0;
  noise.connect(filter).connect(surf).connect(master);
  noise.start();
  let nextCall = audio.currentTime + 1;
  const tick = () => {
    if (audio.state !== "running") return;
    const m = mood();
    const now = audio.currentTime;
    const swell = 0.5 + 0.5 * Math.sin(now * 0.7) * Math.sin(now * 0.23 + 1);
    surf.gain.setTargetAtTime(m.water * (0.05 + swell * 0.07), now, 0.4);
    if (now >= nextCall) {
      if (m.night) {
        cricket(audio, master, now + 0.05);
        nextCall = now + 0.6 + Math.random() * 1.2;
      } else {
        chirp(audio, master, now + 0.05);
        nextCall = now + 2 + Math.random() * 5;
      }
    }
  };
  const timer = window.setInterval(tick, 500);
  ambience = { timer, master, surf, noise };
}

export function stopAmbience(): void {
  if (!ambience || !ctx) return;
  const current = ambience;
  ambience = null;
  window.clearInterval(current.timer);
  current.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  window.setTimeout(() => {
    current.noise.stop();
    current.master.disconnect();
  }, 2000);
}
