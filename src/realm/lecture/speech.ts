/**
 * The professor's voice: the browser's own speech, made as human as it can be.
 *
 *  - Picks the best English voice on the device. The "Natural"/"Neural"
 *    online voices in Microsoft Edge (and Windows 11) sound close to a real
 *    person; Google and Apple "Enhanced"/"Premium" voices come next. Prefers
 *    Australian, then British, then American English, and the professor's
 *    gender when the voice name makes it clear.
 *  - Speaks sentence by sentence with short breaths between them, a little
 *    lift on questions, and a slightly slower pace for robotic voices.
 */

export type VoiceGender = "female" | "male";

const FEMALE = /natasha|aria|jenny|sonia|libby|michelle|ava|emma|samantha|karen|catherine|zira|hazel|susan|serena|moira|tessa|fiona|clara|jane|nancy|sara|elizabeth|annette|carly|freya|tina|joanne|neerja|leah|maisie|abbie|bella|hollie|olivia|female|woman/i;
const MALE = /william|guy|ryan|christopher|eric|brian|andrew|davis|tony|jason|roger|steffan|thomas|daniel|oliver|alfie|darren|duncan|ken\b|tim\b|neil|mark|david|george|james|rishi|prabhat|liam|elliot|ethan|noah|male\b|man\b/i;

export function voiceQuality(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (/natural/i.test(v.name)) score += 60;
  if (/neural/i.test(v.name)) score += 50;
  if (/premium|enhanced/i.test(v.name)) score += 40;
  if (/online/i.test(v.name)) score += 15;
  if (/google/i.test(v.name)) score += 18;
  if (/^en-AU/i.test(v.lang)) score += 12;
  else if (/^en-GB/i.test(v.lang)) score += 8;
  else if (/^en-(US|NZ|IE)/i.test(v.lang)) score += 5;
  return score;
}

export function genderOf(v: SpeechSynthesisVoice): VoiceGender | null {
  if (MALE.test(v.name) && !FEMALE.test(v.name)) return "male";
  if (FEMALE.test(v.name)) return "female";
  return null;
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** English voices, best first. Empty until the browser has loaded its voice list. */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => /^en(-|_|$)/i.test(v.lang))
    .sort((a, b) => voiceQuality(b) - voiceQuality(a));
}

/** Calls back when the browser's voice list (re)loads; returns an unsubscribe. */
export function onVoicesChanged(listener: () => void): () => void {
  if (!speechAvailable()) return () => undefined;
  window.speechSynthesis.addEventListener("voiceschanged", listener);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", listener);
}

/** The voice to use: the chosen one if it exists, else the best one, matching gender when possible. */
export function pickVoice(chosen: string | null, gender: VoiceGender | null): SpeechSynthesisVoice | null {
  const voices = englishVoices();
  if (chosen) {
    const exact = voices.find((v) => v.name === chosen);
    if (exact) return exact;
  }
  if (!voices.length) return null;
  const best = voiceQuality(voices[0]);
  // Prefer the professor's gender among voices nearly as good as the best.
  const matching = gender ? voices.find((v) => genderOf(v) === gender && voiceQuality(v) >= best - 20) : undefined;
  return matching ?? voices[0];
}

/** True for the robotic-sounding fallback voices (eSpeak-like, old SAPI). */
export function isBasicVoice(v: SpeechSynthesisVoice | null): boolean {
  return !v || voiceQuality(v) < 30;
}

/** Splits text into sentences, keeping short ones together; long sentences split at commas. */
export function sentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (const part of raw.map((s) => s.trim()).filter(Boolean)) {
    if (part.length <= 220) {
      out.push(part);
      continue;
    }
    let buf = "";
    for (const clause of part.split(/(?<=[,;:])\s+/)) {
      if ((buf + " " + clause).length > 200 && buf) {
        out.push(buf.trim());
        buf = "";
      }
      buf += ` ${clause}`;
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

/** Speaks text sentence by sentence with natural pauses. One instance per lecture. */
export class Speaker {
  private run = 0;
  private timer = 0;
  voice: SpeechSynthesisVoice | null = null;

  /** Stops anything being said (and any queued sentences). */
  cancel(): void {
    this.run++;
    window.clearTimeout(this.timer);
    if (speechAvailable()) window.speechSynthesis.cancel();
  }

  pause(): void {
    if (speechAvailable()) window.speechSynthesis.pause();
  }

  resume(): void {
    if (speechAvailable()) window.speechSynthesis.resume();
  }

  /** Says `text`; `onDone` runs once the last sentence finishes (not when cancelled). */
  say(text: string, onDone?: () => void): void {
    this.cancel();
    if (!speechAvailable() || !text.trim()) return;
    const run = this.run;
    const parts = sentences(text);
    const basic = isBasicVoice(this.voice);
    const next = (i: number) => {
      if (run !== this.run) return;
      if (i >= parts.length) {
        onDone?.();
        return;
      }
      const part = parts[i];
      const u = new SpeechSynthesisUtterance(part);
      if (this.voice) {
        u.voice = this.voice;
        u.lang = this.voice.lang;
      } else u.lang = "en-AU";
      const question = /\?["')\]]*$/.test(part);
      const excited = /!["')\]]*$/.test(part);
      // Natural voices already have good prosody; nudge only the basic ones much.
      u.rate = basic ? 0.92 : 1;
      u.pitch = question ? (basic ? 1.12 : 1.05) : excited ? 1.06 : 1;
      u.onend = () => {
        if (run !== this.run) return;
        // A breath between sentences; longer after questions, so they land.
        this.timer = window.setTimeout(() => next(i + 1), question ? 420 : /[:;]$/.test(part) ? 260 : 170);
      };
      u.onerror = () => {
        if (run === this.run) next(i + 1);
      };
      window.speechSynthesis.speak(u);
    };
    next(0);
  }
}

/** Seconds a passage takes to say (or read), for pacing the slide animations. */
export function speakingSeconds(text: string, spoken: boolean): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentencesCount = (text.match(/[.!?]/g) ?? []).length;
  return spoken ? words / 2.55 + sentencesCount * 0.2 : words / 3.6;
}
