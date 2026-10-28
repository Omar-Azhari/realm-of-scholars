/**
 * Phase 23 "Dashboard Connection" — a small, portable hook so any screen
 * (not just Game3D.tsx's in-world npc-chat handler) can open a real mentor
 * conversation. Wraps the exact same building blocks Game3D.tsx's npc-chat
 * case already uses — `ContextEngine.ts`, `MentorDialogueProvider.ts`,
 * `npcMemory.ts`'s recognition — so the CONVERSATION-GENERATION logic is
 * never duplicated; only the thin "open/close local state" glue exists in
 * two places (this hook, and Game3D.tsx's handler, which additionally
 * needs to drive the in-world `talking` pose override this hook has no
 * use for).
 */

import { useCallback, useState } from "react";
import { useSaveData } from "../state/SaveDataContext";
import { buildStudentContext } from "../ai/ContextEngine";
import { ruleBasedMentorDialogueProvider, type MentorConversation } from "../ai/MentorDialogueProvider";
import { withDailyCheckInFollowUp } from "../ai/CheckInFollowUp";
import { getNpcMemory, applyRecognition, hasGreetedToday } from "../lib/npcMemory";

export interface ActiveMentorConversation {
  npcLabel: string;
  conversation: MentorConversation;
}

export function useMentorConversation() {
  const { saveData, recordNpcInteraction, flagAssessmentStruggle } = useSaveData();
  const [active, setActive] = useState<ActiveMentorConversation | null>(null);

  const openConversation = useCallback(
    (npcKey: string, npcLabel: string) => {
      const now = new Date();
      const memory = getNpcMemory(saveData, npcKey);
      const context = buildStudentContext(saveData, now);
      const { conversation, memoryUpdate } = ruleBasedMentorDialogueProvider.buildConversation(saveData, context, npcKey, now);

      const finalConversation: MentorConversation = hasGreetedToday(memory, now)
        ? { npcKey, stages: [{ stage: "greeting", line: applyRecognition(memoryUpdate.summaryLine, memory, npcKey, now) }] }
        : withDailyCheckInFollowUp(conversation, saveData, npcKey, now);

      recordNpcInteraction(npcKey, memoryUpdate.summaryLine, memoryUpdate.topic ?? undefined);
      if (npcKey !== "guide" && memoryUpdate.flagAssessmentId !== undefined) flagAssessmentStruggle(npcKey, memoryUpdate.flagAssessmentId);

      setActive({ npcLabel, conversation: finalConversation });
    },
    [saveData, recordNpcInteraction, flagAssessmentStruggle]
  );

  const closeConversation = useCallback(() => setActive(null), []);

  return { active, openConversation, closeConversation };
}
