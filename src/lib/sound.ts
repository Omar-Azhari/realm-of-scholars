/**
 * Sound-event architecture — hooks only, no audio assets yet.
 *
 * Gameplay code emits semantic events via `emitSound`; whether anything is
 * heard depends on (a) the user's opt-in Settings toggle (off by default —
 * synced in from SaveDataContext) and (b) whether an audio file exists for
 * the event under public/assets/audio/<event>.mp3. Missing files fail
 * silently, so the event wiring ships now and final audio drops in later by
 * adding files — the same "engine renders whatever assets exist" contract
 * the artwork follows.
 */

import { assetUrl } from "../engine/manifestTypes";

export type SoundEvent =
  | "footsteps"
  | "hover"
  | "door-open"
  | "door-close"
  | "room-enter"
  | "module-complete"
  | "xp-gain"
  | "achievement-unlock"
  | "warning"
  | "celebration"
  /* Focus Sprint + living-semester events (Phase 7) */
  | "focus-start"
  | "focus-pause"
  | "focus-resume"
  | "focus-complete"
  | "focus-cancel"
  | "timer-warning"
  | "chair-move"
  | "monitor-on"
  | "room-upgrade"
  | "relationship-up"
  /* Phase 20C (Living World & Animation, Part 8) — ambience expansion. Reuses "footsteps"/"chair-move" above rather than duplicating them. */
  | "typing"
  | "paper-turn"
  | "coffee-place"
  | "room-ambience"
  | "birds-outside"
  | "hvac-hum"
  /* Phase 20E (Campus Expansion, Part 10) — campus-wide ambience. Reuses "door-open"/"typing"/"birds-outside" above rather than duplicating them. */
  | "distant-chatter"
  | "coffee-machine"
  | "projector-hum"
  | "library-ambience"
  | "wind-outside"
  /* Phase 21 Part 9 (Campus Atmosphere) — layered under a building's own ambience, never replacing it; same "missing file fails silently" contract as everything else above. */
  | "exam-week-hush"
  | "campus-quiet"
  /* V2 Phase 1 "Prestige Vertical Slice" (additive) — per-district ambience for the new prestige-v2 renderer only. Same missing-file-fails-silently contract; no mp3 assets exist for these in this environment yet (disclosed in docs/V2_PHASE1_VERTICAL_SLICE.md). */
  | "main-gate-wind"
  | "courtyard-fountain"
  | "great-hall-ambience"
  | "artisans-workshop-ambience"
  | "fireplace-crackle"
  | "bell-toll";

let soundEnabled = false;

/** Cache one Audio element per event; null marks a known-missing file. */
const audioCache = new Map<SoundEvent, HTMLAudioElement | null>();

/** Synced from settings by SaveDataContext — not read from storage here. */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

// ---------------------------------------------------------------------------
// Mixer architecture (Phase 20F Part 10) — categories, per-category volume,
// and the two real bugs the audit's Part 7/10 review surfaced: loop events
// stopping for EVERY source when only one of several concurrent sources
// (the player, or any of several NPCs sharing an activity) actually
// finished, and one-shot events able to retrigger arbitrarily fast when
// multiple sources hit the same event within a frame or two of each other.
// ---------------------------------------------------------------------------

/** The six categories Part 10 asks for. "music" has no events yet — reserved, not dead: the same "engine renders whatever assets exist" contract as everywhere else in the audio system, just with zero current members instead of zero current files. */
export type SoundCategory = "ambience" | "footsteps" | "interaction" | "ui" | "npc" | "music";

/** Every event's category — a lookup, not a judgement call made ad hoc at each call site. "npc" covers activity cues shared between the player and NPCs (typing/paper-turn/coffee-place/chair-move) rather than a literal player-vs-NPC distinction, since nothing at the emitSound call site currently tags who triggered it — see Part 10's completion notes in the audit doc. */
const SOUND_EVENT_CATEGORY: Record<SoundEvent, SoundCategory> = {
  footsteps: "footsteps",
  hover: "ui",
  "door-open": "interaction",
  "door-close": "interaction",
  "room-enter": "interaction",
  "module-complete": "ui",
  "xp-gain": "ui",
  "achievement-unlock": "ui",
  warning: "ui",
  celebration: "ui",
  "focus-start": "ui",
  "focus-pause": "ui",
  "focus-resume": "ui",
  "focus-complete": "ui",
  "focus-cancel": "ui",
  "timer-warning": "ui",
  "chair-move": "npc",
  "monitor-on": "interaction",
  "room-upgrade": "ui",
  "relationship-up": "ui",
  typing: "npc",
  "paper-turn": "npc",
  "coffee-place": "npc",
  "room-ambience": "ambience",
  "birds-outside": "ambience",
  "hvac-hum": "ambience",
  "distant-chatter": "ambience",
  "coffee-machine": "ambience",
  "projector-hum": "ambience",
  "library-ambience": "ambience",
  "wind-outside": "ambience",
  "exam-week-hush": "ambience",
  "campus-quiet": "ambience",
  "main-gate-wind": "ambience",
  "courtyard-fountain": "ambience",
  "great-hall-ambience": "ambience",
  "artisans-workshop-ambience": "ambience",
  "fireplace-crackle": "ambience",
  "bell-toll": "interaction",
};

/** 0–1 per category; all default to 1 (full volume) — the master `soundEnabled` toggle above is the actual on/off switch, these are relative mix levels once sound is on. */
const categoryVolumes: Record<SoundCategory, number> = {
  ambience: 1,
  footsteps: 1,
  interaction: 1,
  ui: 1,
  npc: 1,
  music: 1,
};

/** Applies instantly to any already-playing sound in that category (a currently-looping ambience track gets audibly quieter/louder the moment the slider moves), not just future emits. */
export function setCategoryVolume(category: SoundCategory, volume: number): void {
  const clamped = Math.min(1, Math.max(0, volume));
  categoryVolumes[category] = clamped;
  for (const [event, audio] of audioCache) {
    if (audio && SOUND_EVENT_CATEGORY[event] === category) audio.volume = clamped;
  }
}

export function getCategoryVolume(category: SoundCategory): number {
  return categoryVolumes[category];
}

export function getSoundEventCategory(event: SoundEvent): SoundCategory {
  return SOUND_EVENT_CATEGORY[event];
}

/** How many concurrent "sources" (NPCs, or the player) currently want a given loop event playing. The single shared `Audio` element only actually stops once this reaches 0 — the fix for one NPC finishing an activity silencing another's identical, still-ongoing one. */
const loopRefCounts = new Map<SoundEvent, number>();

/** One-shot cooldown, ms — a second emit of the SAME one-shot event within this window is dropped rather than restarting the clip, so near-simultaneous triggers (two NPCs both starting "coffee-place" a couple of frames apart) read as one cue, not a stutter. Events the audit specifically flagged ("overlapping coffee sounds", "repeated door sounds") get a slightly longer window; everything else gets a small default guard against accidental machine-gun retriggers. */
const DEFAULT_ONE_SHOT_COOLDOWN_MS = 120;
const SOUND_EVENT_COOLDOWN_MS: Partial<Record<SoundEvent, number>> = {
  "coffee-place": 400,
  "door-open": 350,
  "chair-move": 300,
  "paper-turn": 250,
};
const lastPlayedAt = new Map<SoundEvent, number>();

/** Optional test/diagnostic tap — receives every emit regardless of the enabled flag. */
type SoundListener = (event: SoundEvent) => void;
const listeners = new Set<SoundListener>();

export function onSoundEvent(listener: SoundListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fire a sound event. Safe to call from anywhere, any number of times —
 * with sound disabled (the default) or no audio file present, it's a no-op
 * beyond notifying diagnostic listeners.
 *
 * `options.loop` (Phase 20C, Part 8) — for continuous ambience (room tone,
 * birds, HVAC hum) rather than a one-shot effect. Calling an already-
 * playing loop again doesn't restart it from the beginning; it instead
 * increments a reference count (Phase 20F Part 10) so that several
 * concurrent sources sharing the same loop (the player and an NPC both
 * "typing", say) each get their own `stopSound` accounted for — the loop
 * only actually pauses once every source has stopped it, fixing a real bug
 * where any ONE source finishing silenced everyone else's identical,
 * still-ongoing sound.
 *
 * One-shot events are additionally guarded by a small per-event cooldown
 * (Phase 20F Part 10) — a second emit of the same one-shot within the
 * cooldown window is dropped rather than restarting the clip, so two
 * sources triggering the same cue a couple of frames apart read as one cue.
 */
export function emitSound(event: SoundEvent, options?: { loop?: boolean }): void {
  for (const listener of listeners) listener(event);
  if (!soundEnabled) return;

  let audio = audioCache.get(event);
  if (audio === null) return; // previously failed to load — don't retry every emit

  if (!audio) {
    audio = new Audio(assetUrl(`audio/${event}.mp3`));
    audio.preload = "auto";
    audio.addEventListener("error", () => audioCache.set(event, null), { once: true });
    audioCache.set(event, audio);
  }

  audio.volume = getCategoryVolume(SOUND_EVENT_CATEGORY[event]);
  audio.loop = options?.loop ?? false;

  if (options?.loop) {
    loopRefCounts.set(event, (loopRefCounts.get(event) ?? 0) + 1);
    if (!audio.paused) return; // another source already has this loop running
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay restrictions or missing file — stay silent.
    });
    return;
  }

  const now = performance.now();
  const cooldown = SOUND_EVENT_COOLDOWN_MS[event] ?? DEFAULT_ONE_SHOT_COOLDOWN_MS;
  if (now - (lastPlayedAt.get(event) ?? -Infinity) < cooldown) return;
  lastPlayedAt.set(event, now);

  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Autoplay restrictions or missing file — stay silent.
  });
}

/**
 * Stops (and rewinds) a currently-playing loop — mainly for ending a
 * `{loop: true}` ambience/activity sound. A no-op if that event was never
 * started or has no file. Phase 20F Part 10 — decrements the same
 * reference count `emitSound` increments; the underlying `Audio` element
 * only actually pauses once every source that started this loop has also
 * stopped it, so one NPC finishing an activity doesn't cut off another's
 * identical, still-ongoing one.
 */
export function stopSound(event: SoundEvent): void {
  const audio = audioCache.get(event);
  if (!audio) return;

  const count = loopRefCounts.get(event) ?? 0;
  if (count > 1) {
    loopRefCounts.set(event, count - 1);
    return; // at least one other source still wants this loop playing
  }
  loopRefCounts.delete(event);

  audio.pause();
  audio.currentTime = 0;
}
