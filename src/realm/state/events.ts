/**
 * Transient game events (chat lines, XP drops, level-ups, quest
 * completions). Not persisted — they drive the HUD's feedback only.
 */

import type { ChatChannel } from "../types";

export type GameEvent =
  | { type: "chat"; channel: ChatChannel; text: string }
  | { type: "xp-drop"; subjectId: string; amount: number }
  | { type: "level-up"; subjectId: string; skillName: string; level: number }
  | { type: "quest-complete"; assessmentId: string; title: string; questPoints: number; xp: number; skillName: string }
  | { type: "graduated" }
  | { type: "sound"; name: SoundName }
  | { type: "focus"; amount: number; reason: string }
  | { type: "owl"; count: number };

export type SoundName = "level" | "quest" | "hit" | "miss" | "click" | "study" | "coin" | "victory" | "defeat" | "spell" | "thunder" | "owl" | "house";

type Listener = (event: GameEvent) => void;
const listeners = new Set<Listener>();

export function emit(event: GameEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function onGameEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function chat(text: string, channel: ChatChannel = "game"): void {
  emit({ type: "chat", channel, text });
}
