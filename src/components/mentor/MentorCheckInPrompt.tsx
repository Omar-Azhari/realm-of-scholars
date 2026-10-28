/**
 * Phase 24 "Daily Check-In" / "Evening Reflection" — a small, non-blocking,
 * MULTIPLE-CHOICE mini-interaction. Deliberately its own simple prompt
 * rather than a `MentorConversationPanel` stage: this game has no free-text
 * input anywhere, and `MentorDialogueProvider.ts`/the Conversation UI are
 * both explicitly protected ("remains the dialogue interface" — Rule #4).
 * A picked option becomes a small, honest save fact
 * (`UniGameSaveData.dailyCheckIn` / `eveningCheckIn`) that later dialogue
 * can reference descriptively (`ai/CheckInFollowUp.ts`) — never fed into
 * `RecommendationEngine.ts`/`ReflectionEngine.ts`/`GoalSystem.ts` internals.
 */

interface CheckInOption {
  id: string;
  label: string;
}

interface MentorCheckInPromptProps {
  npcLabel: string;
  question: string;
  options: CheckInOption[];
  onSelect: (id: string) => void;
  onDismiss: () => void;
}

export function MentorCheckInPrompt({ npcLabel, question, options, onSelect, onDismiss }: MentorCheckInPromptProps) {
  return (
    <div className="mentor-checkin-prompt" role="dialog" aria-label={question} data-testid="mentor-checkin-prompt">
      <header className="mentor-checkin-header">
        <strong>{npcLabel}</strong>
        <button type="button" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </header>
      <p className="mentor-checkin-question">{question}</p>
      <div className="mentor-checkin-options">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onSelect(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
