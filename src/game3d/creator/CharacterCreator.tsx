/**
 * Character Creator (Phase 20B, Part 3). Category tabs + swatch grids on
 * one side, the live 3D preview (`CharacterCreatorPreview.tsx`) on the
 * other. Every edit pushes a new entry onto a local undo/redo history
 * (historyStack.ts) — nothing writes to the real save until "Done" is
 * pressed, so Cancel always discards cleanly.
 *
 * Deliberately NOT included here (see docs/PHASE_20_3D_WORLD_CUSTOMISATION.md
 * and the Phase 20B completion report for the full reasoning): the
 * "who are you" identity fields (name/university/degree/year) — those
 * belong to the onboarding flow's own step, not this component, since
 * re-editing them from the in-world Wardrobe doesn't match the real-world
 * metaphor ("changing what you look like" vs "changing your enrolment
 * details"). This component only ever edits appearance + personality.
 */

import { useMemo, useRef, useState } from "react";
import { Shuffle, Undo2, Redo2, RotateCcw, Check, X } from "lucide-react";
import { CharacterCreatorPreview, type CharacterCreatorPreviewHandle } from "./CharacterCreatorPreview";
import {
  createHistoryStack,
  pushHistory,
  undoHistory,
  redoHistory,
  currentHistoryValue,
  canUndoHistory,
  canRedoHistory,
  type HistoryStack,
} from "./historyStack";
import { randomiseAppearance, randomisePersonality } from "./randomise";
import {
  BODY_PRESETS,
  SKIN_TONES,
  HAIR_OPTIONS,
  HAIR_COLORS,
  EYE_OPTIONS,
  EYEBROW_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  TOP_OPTIONS,
  JACKET_OPTIONS,
  BOTTOM_OPTIONS,
  SHOES_OPTIONS,
  ACCESSORY_OPTIONS,
  type AppearanceOption,
} from "../../data/appearanceCatalogue";
import { PERSONALITY_TRAITS, buildPersonalityPreview } from "../../data/personalityTraits";
import { useMotionPreference } from "../../hooks/useMotionPreference";
import type { CharacterAppearance, PlayerPersonality } from "../../types/domain";

interface Draft {
  appearance: CharacterAppearance;
  personality: PlayerPersonality;
}

export type TabId = "body" | "hair" | "face" | "top" | "jacket" | "bottom" | "shoes" | "accessories" | "personality";

const TABS: { id: TabId; label: string }[] = [
  { id: "body", label: "Body" },
  { id: "hair", label: "Hair" },
  { id: "face", label: "Face" },
  { id: "top", label: "Top" },
  { id: "jacket", label: "Jacket" },
  { id: "bottom", label: "Bottom" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
  { id: "personality", label: "Personality" },
];

const MAX_ACCESSORIES = 4;
const MAX_SECONDARY_TRAITS = 2;

export interface CharacterCreatorProps {
  initialAppearance: CharacterAppearance;
  initialPersonality: PlayerPersonality;
  onDone: (appearance: CharacterAppearance, personality: PlayerPersonality) => void;
  onCancel?: () => void;
  doneLabel?: string;
  /** Restricts which category tabs are shown — used by the onboarding flow to split "Appearance" and "Personality" into separate wizard steps over this one component, without duplicating the UI. Defaults to every tab (the in-world Wardrobe/Menu entry point). */
  visibleTabs?: TabId[];
}

function SwatchButton({
  selected,
  label,
  onSelect,
  colorHex,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  colorHex?: string;
}) {
  return (
    <button
      type="button"
      className={`creator-swatch${selected ? " creator-swatch--selected" : ""}`}
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
    >
      <span className="creator-swatch-chip" style={colorHex ? { background: colorHex } : undefined} aria-hidden="true" />
      <span className="creator-swatch-label">{label}</span>
    </button>
  );
}

export function CharacterCreator({
  initialAppearance,
  initialPersonality,
  onDone,
  onCancel,
  doneLabel = "Done",
  visibleTabs,
}: CharacterCreatorProps) {
  const reduceMotion = useMotionPreference();
  const previewRef = useRef<CharacterCreatorPreviewHandle>(null);
  const availableTabs = visibleTabs ? TABS.filter((t) => visibleTabs.includes(t.id)) : TABS;
  const [tab, setTab] = useState<TabId>(availableTabs[0]?.id ?? "body");
  const [history, setHistory] = useState<HistoryStack<Draft>>(
    createHistoryStack({ appearance: initialAppearance, personality: initialPersonality })
  );

  const draft = currentHistoryValue(history);

  const commit = (next: Draft) => setHistory((h) => pushHistory(h, next));
  const setAppearance = (patch: Partial<CharacterAppearance>) => commit({ ...draft, appearance: { ...draft.appearance, ...patch } });
  const setPersonality = (patch: Partial<PlayerPersonality>) => commit({ ...draft, personality: { ...draft.personality, ...patch } });

  const undo = () => setHistory(undoHistory);
  const redo = () => setHistory(redoHistory);
  const randomise = () => commit({ appearance: randomiseAppearance(), personality: randomisePersonality() });

  const toggleAccessory = (id: string) => {
    const has = draft.appearance.accessoryIds.includes(id);
    if (has) {
      setAppearance({ accessoryIds: draft.appearance.accessoryIds.filter((a) => a !== id) });
    } else if (draft.appearance.accessoryIds.length < MAX_ACCESSORIES) {
      setAppearance({ accessoryIds: [...draft.appearance.accessoryIds, id] });
    }
  };

  const toggleSecondaryTrait = (id: string) => {
    if (id === draft.personality.primaryTraitId) return;
    const has = draft.personality.secondaryTraitIds.includes(id);
    if (has) {
      setPersonality({ secondaryTraitIds: draft.personality.secondaryTraitIds.filter((t) => t !== id) });
    } else if (draft.personality.secondaryTraitIds.length < MAX_SECONDARY_TRAITS) {
      setPersonality({ secondaryTraitIds: [...draft.personality.secondaryTraitIds, id] });
    }
  };

  const personalityPreview = useMemo(
    () => buildPersonalityPreview(draft.personality.primaryTraitId, draft.personality.secondaryTraitIds),
    [draft.personality]
  );

  return (
    <div className="character-creator">
      <div className="creator-preview-pane">
        <CharacterCreatorPreview ref={previewRef} appearance={draft.appearance} reduceMotion={reduceMotion} />
        <div className="creator-preview-controls">
          <button type="button" onClick={() => previewRef.current?.resetCamera()} aria-label="Reset camera view">
            <RotateCcw size={15} aria-hidden="true" /> Reset view
          </button>
        </div>
      </div>

      <div className="creator-controls-pane">
        <div className="creator-toolbar">
          <button type="button" onClick={undo} disabled={!canUndoHistory(history)} aria-label="Undo last change">
            <Undo2 size={16} aria-hidden="true" /> Undo
          </button>
          <button type="button" onClick={redo} disabled={!canRedoHistory(history)} aria-label="Redo last undone change">
            <Redo2 size={16} aria-hidden="true" /> Redo
          </button>
          <button type="button" onClick={randomise} aria-label="Randomise appearance and personality">
            <Shuffle size={16} aria-hidden="true" /> Randomise
          </button>
        </div>

        <div className="creator-tabs" role="tablist" aria-label="Appearance categories">
          {availableTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`creator-tab${tab === t.id ? " creator-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="creator-tab-panel" role="tabpanel">
          {tab === "body" ? (
            <>
              <h3 className="creator-section-title">Build</h3>
              <div className="creator-swatch-grid">
                {BODY_PRESETS.map((b) => (
                  <SwatchButton key={b.id} selected={draft.appearance.bodyId === b.id} label={b.label} onSelect={() => setAppearance({ bodyId: b.id })} />
                ))}
              </div>
              <h3 className="creator-section-title">Skin tone</h3>
              <div className="creator-swatch-grid">
                {SKIN_TONES.map((s) => (
                  <SwatchButton
                    key={s.id}
                    selected={draft.appearance.skinToneId === s.id}
                    label={s.label}
                    colorHex={s.hex}
                    onSelect={() => setAppearance({ skinToneId: s.id })}
                  />
                ))}
              </div>
            </>
          ) : null}

          {tab === "hair" ? (
            <>
              <h3 className="creator-section-title">Hairstyle</h3>
              <div className="creator-swatch-grid">
                {HAIR_OPTIONS.map((h) => (
                  <SwatchButton
                    key={h.id}
                    selected={draft.appearance.hairId === h.id}
                    label={h.label}
                    colorHex={h.colors.primary}
                    onSelect={() => setAppearance({ hairId: h.id })}
                  />
                ))}
              </div>
              <h3 className="creator-section-title">Hair colour</h3>
              <div className="creator-swatch-grid">
                {HAIR_COLORS.map((c) => (
                  <SwatchButton
                    key={c.id}
                    selected={draft.appearance.hairColorId === c.id}
                    label={c.label}
                    colorHex={c.hex}
                    onSelect={() => setAppearance({ hairColorId: c.id })}
                  />
                ))}
              </div>
            </>
          ) : null}

          {tab === "face" ? (
            <>
              <h3 className="creator-section-title">Eyes</h3>
              <div className="creator-swatch-grid">
                {EYE_OPTIONS.map((e) => (
                  <SwatchButton key={e.id} selected={draft.appearance.eyesId === e.id} label={e.label} colorHex={e.hex} onSelect={() => setAppearance({ eyesId: e.id })} />
                ))}
              </div>
              <h3 className="creator-section-title">Eyebrows</h3>
              <div className="creator-swatch-grid">
                {EYEBROW_OPTIONS.map((e) => (
                  <SwatchButton key={e.id} selected={draft.appearance.eyebrowsId === e.id} label={e.label} onSelect={() => setAppearance({ eyebrowsId: e.id })} />
                ))}
              </div>
              <h3 className="creator-section-title">Facial hair</h3>
              <div className="creator-swatch-grid">
                <SwatchButton selected={draft.appearance.facialHairId === null} label="None" onSelect={() => setAppearance({ facialHairId: null })} />
                {FACIAL_HAIR_OPTIONS.map((f) => (
                  <SwatchButton key={f.id} selected={draft.appearance.facialHairId === f.id} label={f.label} onSelect={() => setAppearance({ facialHairId: f.id })} />
                ))}
              </div>
            </>
          ) : null}

          {tab === "top" ? (
            <div className="creator-swatch-grid">
              {TOP_OPTIONS.map((o: AppearanceOption) => (
                <SwatchButton key={o.id} selected={draft.appearance.topId === o.id} label={o.label} colorHex={o.colors.primary} onSelect={() => setAppearance({ topId: o.id })} />
              ))}
            </div>
          ) : null}

          {tab === "jacket" ? (
            <div className="creator-swatch-grid">
              <SwatchButton selected={draft.appearance.jacketId === null} label="None" onSelect={() => setAppearance({ jacketId: null })} />
              {JACKET_OPTIONS.map((o) => (
                <SwatchButton key={o.id} selected={draft.appearance.jacketId === o.id} label={o.label} colorHex={o.colors.primary} onSelect={() => setAppearance({ jacketId: o.id })} />
              ))}
            </div>
          ) : null}

          {tab === "bottom" ? (
            <div className="creator-swatch-grid">
              {BOTTOM_OPTIONS.map((o) => (
                <SwatchButton key={o.id} selected={draft.appearance.bottomId === o.id} label={o.label} colorHex={o.colors.primary} onSelect={() => setAppearance({ bottomId: o.id })} />
              ))}
            </div>
          ) : null}

          {tab === "shoes" ? (
            <div className="creator-swatch-grid">
              {SHOES_OPTIONS.map((o) => (
                <SwatchButton key={o.id} selected={draft.appearance.shoesId === o.id} label={o.label} colorHex={o.colors.primary} onSelect={() => setAppearance({ shoesId: o.id })} />
              ))}
            </div>
          ) : null}

          {tab === "accessories" ? (
            <>
              <p className="creator-hint">Choose up to {MAX_ACCESSORIES}.</p>
              <div className="creator-swatch-grid">
                {ACCESSORY_OPTIONS.map((o) => (
                  <SwatchButton
                    key={o.id}
                    selected={draft.appearance.accessoryIds.includes(o.id)}
                    label={o.label}
                    colorHex={o.colors.primary}
                    onSelect={() => toggleAccessory(o.id)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {tab === "personality" ? (
            <>
              <h3 className="creator-section-title">Primary trait</h3>
              <div className="creator-swatch-grid">
                {PERSONALITY_TRAITS.map((t) => (
                  <SwatchButton
                    key={t.id}
                    selected={draft.personality.primaryTraitId === t.id}
                    label={t.label}
                    onSelect={() => setPersonality({ primaryTraitId: t.id, secondaryTraitIds: draft.personality.secondaryTraitIds.filter((id) => id !== t.id) })}
                  />
                ))}
              </div>
              <h3 className="creator-section-title">Secondary traits (up to {MAX_SECONDARY_TRAITS})</h3>
              <div className="creator-swatch-grid">
                {PERSONALITY_TRAITS.filter((t) => t.id !== draft.personality.primaryTraitId).map((t) => (
                  <SwatchButton key={t.id} selected={draft.personality.secondaryTraitIds.includes(t.id)} label={t.label} onSelect={() => toggleSecondaryTrait(t.id)} />
                ))}
              </div>
              {personalityPreview ? (
                <div className="creator-personality-preview" aria-live="polite">
                  <p>
                    <strong>Posture:</strong> {personalityPreview.postureLabel}
                  </p>
                  <p>
                    <strong>Dialogue tone:</strong> {personalityPreview.dialogueToneSample}
                  </p>
                  <p className="creator-hint">This never affects grades or academic outcomes — it's purely cosmetic.</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="creator-actions">
          {onCancel ? (
            <button type="button" className="creator-action-secondary" onClick={onCancel}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          ) : null}
          <button type="button" className="creator-action-primary" onClick={() => onDone(draft.appearance, draft.personality)}>
            <Check size={16} aria-hidden="true" /> {doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
