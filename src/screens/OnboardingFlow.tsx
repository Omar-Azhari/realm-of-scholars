/**
 * First-time onboarding (Phase 20B, Part 1). Shown exactly once — see
 * `App.tsx`'s gate on `saveData.playerIdentity === null` and
 * `sanitizeSaveData`'s migration handling in persistence.ts for exactly
 * how a save that predates this phase never sees it ("returning users
 * skip directly to Campus").
 *
 * Welcome -> Who are you? -> Appearance -> Personality -> Preview -> Enter
 * Campus. Every step's input accumulates in local component state only —
 * nothing is written to the real save until "Enter Campus" is pressed,
 * which commits the whole `PlayerIdentity` in one `updatePlayerIdentity`
 * call. A refresh mid-onboarding restarts the flow rather than leaving a
 * half-written identity behind (no partial-completion edge case, matching
 * Part 10's "no save corruption").
 *
 * The Appearance and Personality steps both reuse the exact same
 * `CharacterCreator` used by the in-world Wardrobe — restricted to
 * different tabs via `visibleTabs` — rather than duplicating that UI.
 */

import { Suspense, useState } from "react";
import { GraduationCap, Sparkles, User, Wand2 } from "lucide-react";
import { CharacterCreatorLazy } from "../world/CharacterCreatorLazy";
import { createDefaultAppearance, createDefaultPersonality } from "../data/playerIdentityDefaults";
import { buildPersonalityPreview, findPersonalityTrait } from "../data/personalityTraits";
import { useSaveData } from "../state/SaveDataContext";
import type { CharacterAppearance, PlayerPersonality, YearLevel } from "../types/domain";

type Step = "welcome" | "who-are-you" | "appearance" | "personality" | "preview";

const STEP_ORDER: Step[] = ["welcome", "who-are-you", "appearance", "personality", "preview"];

const YEAR_LEVEL_OPTIONS: { value: YearLevel; label: string }[] = [
  { value: "first-year", label: "First year" },
  { value: "second-year", label: "Second year" },
  { value: "third-year", label: "Third year" },
  { value: "fourth-year", label: "Fourth year" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "other", label: "Other" },
];

interface Draft {
  preferredName: string;
  displayName: string;
  university: string;
  degree: string;
  yearLevel: YearLevel | null;
  appearance: CharacterAppearance;
  personality: PlayerPersonality;
}

function CreatorLoading() {
  return (
    <div className="onboarding-creator-loading" role="status">
      Loading character creator…
    </div>
  );
}

export function OnboardingFlow() {
  const { updatePlayerIdentity } = useSaveData();
  const [step, setStep] = useState<Step>("welcome");
  const [draft, setDraft] = useState<Draft>({
    preferredName: "",
    displayName: "",
    university: "",
    degree: "",
    yearLevel: null,
    appearance: createDefaultAppearance(),
    personality: createDefaultPersonality(),
  });

  const stepIndex = STEP_ORDER.indexOf(step);
  const goBack = () => setStep(STEP_ORDER[Math.max(0, stepIndex - 1)]);

  const enterCampus = () => {
    updatePlayerIdentity({
      preferredName: draft.preferredName.trim() || "Student",
      displayName: draft.displayName.trim() || null,
      university: draft.university.trim() || null,
      degree: draft.degree.trim() || null,
      yearLevel: draft.yearLevel,
      appearance: draft.appearance,
      personality: draft.personality,
    });
  };

  const preview = buildPersonalityPreview(draft.personality.primaryTraitId, draft.personality.secondaryTraitIds);
  const primaryTraitLabel = findPersonalityTrait(draft.personality.primaryTraitId)?.label ?? "—";

  return (
    <div className="onboarding-flow">
      <div className="onboarding-card">
        <ol className="onboarding-progress" aria-label="Onboarding progress">
          {STEP_ORDER.map((s, i) => (
            <li key={s} className={i === stepIndex ? "onboarding-progress-dot onboarding-progress-dot--active" : i < stepIndex ? "onboarding-progress-dot onboarding-progress-dot--done" : "onboarding-progress-dot"} aria-current={i === stepIndex ? "step" : undefined} />
          ))}
        </ol>

        {step === "welcome" ? (
          <section className="onboarding-step" aria-labelledby="onboarding-welcome-title">
            <Sparkles size={28} aria-hidden="true" className="onboarding-step-icon" />
            <h1 id="onboarding-welcome-title">Welcome to UniGame</h1>
            <p className="onboarding-lede">
              You're about to begin your university journey. Let's set up who you are and what your character looks
              like — it only takes a minute, and you can change any of it later.
            </p>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-primary" onClick={() => setStep("who-are-you")}>
                Begin
              </button>
            </div>
          </section>
        ) : null}

        {step === "who-are-you" ? (
          <section className="onboarding-step" aria-labelledby="onboarding-who-title">
            <User size={26} aria-hidden="true" className="onboarding-step-icon" />
            <h1 id="onboarding-who-title">Who are you?</h1>
            <p className="onboarding-lede">Everything here is optional except your name, and can be changed later from Menu.</p>
            <div className="onboarding-form">
              <label className="onboarding-field">
                <span>Preferred name</span>
                <input
                  type="text"
                  value={draft.preferredName}
                  onChange={(e) => setDraft((d) => ({ ...d, preferredName: e.target.value }))}
                  maxLength={40}
                  autoFocus
                />
              </label>
              <label className="onboarding-field">
                <span>Display name (optional)</span>
                <input type="text" value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} maxLength={40} />
              </label>
              <label className="onboarding-field">
                <span>University (optional)</span>
                <input type="text" value={draft.university} onChange={(e) => setDraft((d) => ({ ...d, university: e.target.value }))} maxLength={80} />
              </label>
              <label className="onboarding-field">
                <span>Degree (optional)</span>
                <input type="text" value={draft.degree} onChange={(e) => setDraft((d) => ({ ...d, degree: e.target.value }))} maxLength={80} />
              </label>
              <label className="onboarding-field">
                <span>Year level (optional)</span>
                <select value={draft.yearLevel ?? ""} onChange={(e) => setDraft((d) => ({ ...d, yearLevel: (e.target.value || null) as YearLevel | null }))}>
                  <option value="">Not specified</option>
                  {YEAR_LEVEL_OPTIONS.map((y) => (
                    <option key={y.value} value={y.value}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-secondary" onClick={goBack}>
                Back
              </button>
              <button type="button" className="onboarding-primary" onClick={() => setStep("appearance")} disabled={!draft.preferredName.trim()}>
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {step === "appearance" ? (
          <section className="onboarding-step onboarding-step--creator" aria-labelledby="onboarding-appearance-title">
            <h1 id="onboarding-appearance-title" className="onboarding-step-title-inline">
              <Wand2 size={22} aria-hidden="true" /> Appearance
            </h1>
            <Suspense fallback={<CreatorLoading />}>
              <CharacterCreatorLazy
                initialAppearance={draft.appearance}
                initialPersonality={draft.personality}
                visibleTabs={["body", "hair", "face", "top", "jacket", "bottom", "shoes", "accessories"]}
                doneLabel="Continue"
                onDone={(appearance) => {
                  setDraft((d) => ({ ...d, appearance }));
                  setStep("personality");
                }}
              />
            </Suspense>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-secondary" onClick={goBack}>
                Back
              </button>
            </div>
          </section>
        ) : null}

        {step === "personality" ? (
          <section className="onboarding-step onboarding-step--creator" aria-labelledby="onboarding-personality-title">
            <h1 id="onboarding-personality-title" className="onboarding-step-title-inline">
              <Sparkles size={22} aria-hidden="true" /> Personality
            </h1>
            <Suspense fallback={<CreatorLoading />}>
              <CharacterCreatorLazy
                initialAppearance={draft.appearance}
                initialPersonality={draft.personality}
                visibleTabs={["personality"]}
                doneLabel="Continue"
                onDone={(_appearance, personality) => {
                  setDraft((d) => ({ ...d, personality }));
                  setStep("preview");
                }}
              />
            </Suspense>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-secondary" onClick={goBack}>
                Back
              </button>
            </div>
          </section>
        ) : null}

        {step === "preview" ? (
          <section className="onboarding-step" aria-labelledby="onboarding-preview-title">
            <GraduationCap size={28} aria-hidden="true" className="onboarding-step-icon" />
            <h1 id="onboarding-preview-title">Ready to begin</h1>
            <div className="onboarding-summary">
              <p>
                <strong>{draft.displayName.trim() || draft.preferredName.trim() || "Student"}</strong>
              </p>
              {draft.university.trim() ? <p>{draft.university.trim()}</p> : null}
              {draft.degree.trim() ? <p>{draft.degree.trim()}</p> : null}
              <p className="onboarding-summary-personality">
                {primaryTraitLabel}
                {preview ? ` — ${preview.postureLabel.toLowerCase()}` : ""}
              </p>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-secondary" onClick={goBack}>
                Back
              </button>
              <button type="button" className="onboarding-primary" onClick={enterCampus} data-testid="onboarding-enter-campus">
                Enter Campus
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
