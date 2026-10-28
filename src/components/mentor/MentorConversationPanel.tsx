/**
 * Phase 23 "Conversation Flow" + "Visual Improvements" — a portable,
 * renderer-independent panel that plays back a `MentorConversation`
 * (`src/ai/MentorDialogueProvider.ts`) one stage at a time, each with a
 * typing-effect reveal, reading top-to-bottom like a real short exchange
 * rather than one flat toast line. Used from BOTH `Game3D.tsx`'s npc-chat
 * handler and the Dashboard's "click an insight, start a conversation"
 * entry points (Part "Dashboard Connection") — neither owns this
 * component, both just pass it a conversation and an onClose.
 *
 * "No flashy effects. Professional. Warm." — a plain typewriter reveal and
 * a stage fade-in, nothing more; fully skipped under reduced motion (every
 * line appears immediately, matching this codebase's existing
 * reduced-motion contract elsewhere).
 */

import { useEffect, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useMotionPreference } from "../../hooks/useMotionPreference";
import type { MentorConversation } from "../../ai/MentorDialogueProvider";

const TYPE_SPEED_MS = 16;
const STAGE_PAUSE_MS = 550;

export function MentorConversationPanel({
  npcLabel,
  conversation,
  onClose,
}: {
  npcLabel: string;
  conversation: MentorConversation;
  onClose: () => void;
}) {
  const reduceMotion = useMotionPreference();
  const stages = conversation.stages;
  const [visibleCount, setVisibleCount] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [showEvidence, setShowEvidence] = useState(false);
  const advanceTimerRef = useRef<number | null>(null);

  const currentIndex = Math.min(visibleCount, stages.length - 1);
  const currentStage = stages[currentIndex];
  const currentComplete = reduceMotion || typedLength >= (currentStage?.line.length ?? 0);

  // Reset and (re)start playback whenever the conversation itself changes —
  // never mid-way through a DIFFERENT conversation's typing.
  useEffect(() => {
    setVisibleCount(0);
    setTypedLength(0);
    setShowEvidence(false);
  }, [conversation]);

  useEffect(() => {
    if (reduceMotion || !currentStage) return;
    setTypedLength(0);
    const id = window.setInterval(() => {
      setTypedLength((prev) => {
        const next = prev + 1;
        if (next >= currentStage.line.length) window.clearInterval(id);
        return next;
      });
    }, TYPE_SPEED_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, reduceMotion]);

  useEffect(() => {
    if (!currentComplete || visibleCount >= stages.length - 1) return;
    advanceTimerRef.current = window.setTimeout(() => setVisibleCount((v) => v + 1), reduceMotion ? 0 : STAGE_PAUSE_MS);
    return () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComplete, visibleCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!currentStage) return null;
  const line = currentComplete ? currentStage.line : currentStage.line.slice(0, typedLength);
  const hasEvidence = currentComplete && currentStage.evidence && currentStage.evidence.length > 0;

  return (
    <div className="mentor-conversation-panel" role="dialog" aria-label={`Conversation with ${npcLabel}`}>
      <header className="mentor-conversation-header">
        <strong>{npcLabel}</strong>
        <button type="button" onClick={onClose} aria-label="Close conversation">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="mentor-conversation-transcript">
        {stages.slice(0, currentIndex).map((stage, i) => (
          <p key={i} className="mentor-conversation-line mentor-conversation-line--done">
            {stage.line}
          </p>
        ))}
        <p className="mentor-conversation-line mentor-conversation-line--active">{line}</p>
        {hasEvidence ? (
          <button type="button" className="mentor-conversation-why" aria-expanded={showEvidence} onClick={() => setShowEvidence((v) => !v)}>
            <HelpCircle size={13} aria-hidden="true" /> Why?
          </button>
        ) : null}
        {showEvidence && currentStage.evidence ? (
          <ul className="daily-brief-evidence-list">
            {currentStage.evidence.map((reason, i) => (
              <li key={i}>
                {reason.label} <span className="daily-brief-evidence-score">({reason.contribution}/{reason.max})</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
