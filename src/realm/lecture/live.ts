/**
 * What the lecture theatre's big screen shows right now. The lecture player
 * writes it; the 3D screen redraws when it changes.
 */

import type { LectureVisual } from "../curriculum/banks/lectures/types";

export interface LiveSlide {
  subject: string;
  title: string;
  heading: string;
  points: string[];
  /** 1-based slide number; 0 = title card. */
  index: number;
  total: number;
  /** An animated diagram drawn instead of the bullet points. */
  visual?: LectureVisual;
  /** performance.now() when this slide started, and how long its diagram takes to build. */
  startedAt?: number;
  revealMs?: number;
  /** A video is playing in the lecture panel: the screen says so. */
  video?: string;
}

let current: LiveSlide | null = null;
const listeners = new Set<() => void>();

export function setLiveSlide(slide: LiveSlide | null): void {
  current = slide;
  for (const listener of listeners) listener();
}

export function liveSlide(): LiveSlide | null {
  return current;
}

export function onLiveSlide(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
