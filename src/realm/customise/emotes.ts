/** Emotes: animations the character can play on demand (the G key opens the wheel). */

export interface Emote {
  id: string;
  label: string;
  icon: string;
  /** Animation clip (see CLIP_ALIAS in customise/humans.ts). */
  clip: string;
}

export const EMOTES: Emote[] = [
  { id: "wave", label: "Wave", icon: "👋", clip: "Wave" },
  { id: "cast", label: "Cast", icon: "✨", clip: "Cast" },
  { id: "point", label: "Point", icon: "👉", clip: "Point" },
  { id: "roll", label: "Roll", icon: "🤸", clip: "Roll" },
  { id: "bow", label: "Bow", icon: "🙇", clip: "Interact" },
  { id: "kick", label: "Kick", icon: "🦵", clip: "Kick" },
];
