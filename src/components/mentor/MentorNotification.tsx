/**
 * Phase 24 "Non-Intrusive Notifications" — a small, dismissible,
 * NON-blocking chip surfacing a Proactive Mentor Engine event
 * (`ai/ProactiveMentorEngine.ts`). Deliberately NOT a modal and NOT the
 * conversation itself: the teaser line is a short, fixed string the engine
 * already chose; clicking "Talk" opens the real conversation the exact
 * same way every other mentor interaction does
 * (`MentorDialogueProvider.ts`'s `buildConversation`), so nothing here ever
 * generates or duplicates dialogue.
 */

interface MentorNotificationProps {
  npcLabel: string;
  line: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export function MentorNotification({ npcLabel, line, onOpen, onDismiss }: MentorNotificationProps) {
  return (
    <div className="mentor-notification" role="status" data-testid="mentor-notification">
      <span className="mentor-notification-name">{npcLabel}</span>
      <span className="mentor-notification-line">{line}</span>
      <button type="button" onClick={onOpen}>
        Talk
      </button>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
