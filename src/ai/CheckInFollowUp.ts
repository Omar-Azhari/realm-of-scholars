/**
 * Phase 24 "Daily Check-In" follow-up — a small, CONSUMING-side helper, not
 * an edit to `MentorDialogueProvider.ts` itself (Rule #4: that file "remains
 * the dialogue interface"). This prepends one honest, descriptive line to
 * an already-built `MentorConversation` when today's Daily Check-In pick
 * named THIS exact subject mentor — "Earlier you said you'd focus on this
 * today," never a claim that the player typed or said anything (there is no
 * free-text input anywhere in this game; the check-in is a real,
 * multiple-choice save fact, see `types/domain.ts`'s `DailyCheckIn`).
 *
 * Shared by both call sites that build a real conversation
 * (`Game3D.tsx`'s `openMentorConversation`, `useMentorConversation.ts`) so
 * the follow-up line is never duplicated or drifted between them.
 */

import { getMelbourneDateIso } from "../lib/selectors";
import type { MentorConversation } from "./MentorDialogueProvider";
import type { UniGameSaveData } from "../types/domain";

const FOLLOW_UP_LINE = "Earlier you said you'd focus on this today — how's it going?";

export function withDailyCheckInFollowUp(conversation: MentorConversation, save: UniGameSaveData, npcKey: string, now: Date = new Date()): MentorConversation {
  const checkIn = save.dailyCheckIn;
  if (!checkIn || checkIn.subjectId !== npcKey || checkIn.dateIso !== getMelbourneDateIso(now)) return conversation;
  return { ...conversation, stages: [{ stage: "greeting", line: FOLLOW_UP_LINE }, ...conversation.stages] };
}
