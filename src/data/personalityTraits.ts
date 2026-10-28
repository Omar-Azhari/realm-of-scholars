/**
 * Personality trait catalogue (Phase 20B, Part 7). A single deterministic,
 * rules-based model — no LLM, matching this project's established pattern
 * for every other "personality"-flavoured system (e.g. the per-mentor
 * voice pools in src/lib/mentorDialogue.ts). No pre-existing PLAYER
 * personality model was found in the codebase when this was built (the
 * mentorDialogue.ts one is NPC-voice-only); this catalogue is new, built
 * to the same deterministic-function precedent rather than assumed to
 * already exist.
 *
 * One primary trait, up to two secondary traits, all drawn from the same
 * pool (`PERSONALITY_TRAITS`) — a secondary trait is just a second (or
 * third) pick from the identical list, not a separate catalogue. Every
 * trait carries purely cosmetic preview data (idle-animation speed,
 * posture, a sample dialogue-tone line) — per the brief, personality
 * "does not affect grades or academic outcomes." Nothing here reads or
 * writes academic state.
 */

export interface PersonalityTrait {
  id: string;
  label: string;
  description: string;
  /** Multiplies the shared idle animation's timing (see characterRig.ts) — >1 = more restless/energetic idle, <1 = calmer/stiller. */
  idleSpeedMultiplier: number;
  /** Degrees of forward/back lean applied to the torso pivot as a static posture cue. */
  postureLeanDeg: number;
  postureLabel: string;
  /** A single illustrative line — preview only, never generated or shown as real mentor/NPC dialogue. */
  dialogueToneSample: string;
}

export const PERSONALITY_TRAITS: PersonalityTrait[] = [
  {
    id: "trait-diligent",
    label: "Diligent",
    description: "Steady, methodical, rarely misses a deadline.",
    idleSpeedMultiplier: 0.85,
    postureLeanDeg: 2,
    postureLabel: "Upright, attentive",
    dialogueToneSample: "“I've already read ahead for next week — want to go over it together?”",
  },
  {
    id: "trait-curious",
    label: "Curious",
    description: "Asks questions, chases tangents, loves a rabbit hole.",
    idleSpeedMultiplier: 1.15,
    postureLeanDeg: -3,
    postureLabel: "Head tilted, looking around",
    dialogueToneSample: "“Wait — why does it work that way? Let's find out.”",
  },
  {
    id: "trait-sociable",
    label: "Sociable",
    description: "Warm, talkative, energised by other people.",
    idleSpeedMultiplier: 1.25,
    postureLeanDeg: -1,
    postureLabel: "Open, facing outward",
    dialogueToneSample: "“Oh good, you're here — tell me how your week's been!”",
  },
  {
    id: "trait-creative",
    label: "Creative",
    description: "Sees a different angle on everything, a little unconventional.",
    idleSpeedMultiplier: 1.1,
    postureLeanDeg: 4,
    postureLabel: "Loose, expressive",
    dialogueToneSample: "“What if we tried it completely backwards?”",
  },
  {
    id: "trait-calm",
    label: "Calm",
    description: "Unhurried, grounding to be around, rarely rattled.",
    idleSpeedMultiplier: 0.7,
    postureLeanDeg: 0,
    postureLabel: "Relaxed, still",
    dialogueToneSample: "“No rush. We'll get through it one step at a time.”",
  },
  {
    id: "trait-ambitious",
    label: "Ambitious",
    description: "Sets a high bar, always looking at the next goal.",
    idleSpeedMultiplier: 1.05,
    postureLeanDeg: 3,
    postureLabel: "Forward-leaning, focused",
    dialogueToneSample: "“Good — now, what's the next thing we're aiming for?”",
  },
  {
    id: "trait-adventurous",
    label: "Adventurous",
    description: "Says yes first, figures out the details later.",
    idleSpeedMultiplier: 1.3,
    postureLeanDeg: -2,
    postureLabel: "Bouncy, restless",
    dialogueToneSample: "“Let's just try it and see what happens.”",
  },
  {
    id: "trait-thoughtful",
    label: "Thoughtful",
    description: "Considers every angle before speaking.",
    idleSpeedMultiplier: 0.75,
    postureLeanDeg: 1,
    postureLabel: "Quiet, composed",
    dialogueToneSample: "“Give me a moment — I want to think this through properly.”",
  },
  {
    id: "trait-humorous",
    label: "Humorous",
    description: "Finds the light side of things, easy to laugh with.",
    idleSpeedMultiplier: 1.2,
    postureLeanDeg: -1,
    postureLabel: "Playful, animated",
    dialogueToneSample: "“Okay but hear me out — what if the assignment fights back?”",
  },
  {
    id: "trait-disciplined",
    label: "Disciplined",
    description: "Sticks to the plan, values routine and consistency.",
    idleSpeedMultiplier: 0.8,
    postureLeanDeg: 2,
    postureLabel: "Squared, steady",
    dialogueToneSample: "“Same time as always — let's keep the streak going.”",
  },
];

export function findPersonalityTrait(id: string): PersonalityTrait | undefined {
  return PERSONALITY_TRAITS.find((t) => t.id === id);
}

/** Every trait id in a `PlayerPersonality` is valid, primary is never repeated among secondaries, and there are never more than 2 secondaries — used by migration/defaults and the deterministic test harness. */
export function isValidPersonality(personality: { primaryTraitId: string; secondaryTraitIds: string[] }): boolean {
  if (!findPersonalityTrait(personality.primaryTraitId)) return false;
  if (personality.secondaryTraitIds.length > 2) return false;
  if (personality.secondaryTraitIds.includes(personality.primaryTraitId)) return false;
  if (new Set(personality.secondaryTraitIds).size !== personality.secondaryTraitIds.length) return false;
  return personality.secondaryTraitIds.every((id) => findPersonalityTrait(id));
}

export interface PersonalityPreview {
  idleSpeedMultiplier: number;
  postureLeanDeg: number;
  postureLabel: string;
  dialogueToneSample: string;
  traitLabels: string[];
}

/**
 * Deterministic blend of a primary trait + up to 2 secondaries into one
 * preview: the primary is weighted 2x a secondary for the two numeric
 * values (so it always dominates the feel), while the posture label and
 * dialogue sample are always the PRIMARY trait's own (blending two
 * descriptive strings reads as nonsense; the numbers blend, the words
 * don't). Pure function — no randomness, same inputs always produce the
 * same preview, which is exactly what Part 13's "personality save/load"
 * and "randomise" tests rely on.
 */
export function buildPersonalityPreview(primaryTraitId: string, secondaryTraitIds: string[]): PersonalityPreview | null {
  const primary = findPersonalityTrait(primaryTraitId);
  if (!primary) return null;
  const secondaries = secondaryTraitIds.map(findPersonalityTrait).filter((t): t is PersonalityTrait => Boolean(t));

  const weights = [2, ...secondaries.map(() => 1)];
  const values = [primary, ...secondaries];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const idleSpeedMultiplier = values.reduce((sum, t, i) => sum + t.idleSpeedMultiplier * weights[i], 0) / totalWeight;
  const postureLeanDeg = values.reduce((sum, t, i) => sum + t.postureLeanDeg * weights[i], 0) / totalWeight;

  return {
    idleSpeedMultiplier,
    postureLeanDeg,
    postureLabel: primary.postureLabel,
    dialogueToneSample: primary.dialogueToneSample,
    traitLabels: values.map((t) => t.label),
  };
}
