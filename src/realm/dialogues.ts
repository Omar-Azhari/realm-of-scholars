/** NPC dialogue scripts, built from the player's real curriculum and progress. */

import type { Dialogue, DialogueOption } from "./hud/ChatBox";
import { currentTeachingWeek, questProgress, resolvedDueDate, weekKey } from "./state/actions";
import { levelForXp } from "./xp";
import { weakWeeks } from "./state/stats";
import { THEME_STYLES } from "./world/themes";
import type { RealmAssessment, RealmState, RealmSubject } from "./types";

export function soonestQuest(state: RealmState, subjects: RealmSubject[]): { subject: RealmSubject; assessment: RealmAssessment } | null {
  return upcomingQuests(state, subjects)[0] ?? null;
}

/** Every unfinished quest, soonest deadline first. */
export function upcomingQuests(state: RealmState, subjects: RealmSubject[]): Array<{ subject: RealmSubject; assessment: RealmAssessment }> {
  const open: Array<{ subject: RealmSubject; assessment: RealmAssessment; order: number }> = [];
  for (const subject of subjects) {
    for (const assessment of subject.assessments) {
      if (questProgress(state, assessment).status === "complete") continue;
      // Real dates first (exact, or worked out from the semester start); week-only quests after, in week order.
      // Deadlines more than a week gone (probably done, just not ticked off) go last.
      const date = resolvedDueDate(assessment, state.curriculum);
      const time = date ? new Date(`${date}T12:00:00`).getTime() : 0;
      const longPast = date !== null && time < Date.now() - 7 * 86_400_000;
      const order = date && !longPast ? time : assessment.dueWeek !== null && !date ? 8e15 + assessment.dueWeek : longPast ? 9e15 + time / 1e6 : 9.9e15;
      open.push({ subject, assessment, order });
    }
  }
  open.sort((a, b) => a.order - b.order);
  return open.map(({ subject, assessment }) => ({ subject, assessment }));
}

export function dueLabel(a: RealmAssessment, curriculum: RealmState["curriculum"] = null): string {
  const date = resolvedDueDate(a, curriculum);
  const day = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : null;
  if (a.dueDate && day) return `due ${day}`;
  if (a.dueWeek !== null) return day ? `due in Week ${a.dueWeek} (around ${day})` : `due in Week ${a.dueWeek}`;
  return "with no due date recorded";
}

export function nextStudyAdvice(state: RealmState, subject: RealmSubject): string {
  const current = currentTeachingWeek(state.curriculum);
  const unstudied = subject.weeks.filter((w) => !state.progress.weeks[weekKey(subject.id, w.week)]?.studiedAt);
  if (subject.weeks.length === 0) return "I have no weekly path recorded for this subject. Read your subject outline and add the weeks when you re-enrol.";
  const weak = weakWeeks(state, subject)[0];
  if (weak) {
    return `Your answers on Week ${weak.week} ("${weak.title}") are only ${Math.round(weak.rate * 100)}% right across ${weak.answered} questions. Its waystone glows red. Revisit that week, then try its trial again.`;
  }
  if (unstudied.length === 0) return "You have studied every waystone. Now win their trials and finish your quests. Mastery is near.";
  const thisWeek = current !== null ? unstudied.find((w) => w.week === current) : undefined;
  const behind = current !== null ? unstudied.filter((w) => w.week < current) : [];
  if (behind.length > 0) {
    return `You have fallen behind on Week ${behind[0].week}: ${behind[0].title}. Catch up at its waystone before the path grows longer.`;
  }
  const target = thisWeek ?? unstudied[0];
  return `Seek the Waystone of Week ${target.week}: "${target.title}". Study it, then face its trial.`;
}

export function tutorDialogue(
  state: RealmState,
  subject: RealmSubject,
  tutor: string,
  open: { board: () => void; codex: () => void; ask: () => void; explain: () => void; close: () => void; show: (d: Dialogue) => void },
): Dialogue {
  const studied = subject.weeks.filter((w) => state.progress.weeks[weekKey(subject.id, w.week)]?.studiedAt).length;
  const done = subject.assessments.filter((a) => questProgress(state, a).status === "complete").length;
  const level = levelForXp(state.progress.skillXp[subject.id] ?? 0);
  const name = state.player?.name ?? "traveller";
  const pages = [
    `Welcome, ${name}. I am ${tutor}, keeper of ${subject.name} here at the ${THEME_STYLES[subject.theme].landmarkName}.`,
    `You stand at level ${level}. You have studied ${studied} of ${subject.weeks.length} waystones and completed ${done} of ${subject.assessments.length} quests.`,
  ];
  if (subject.confidence === "inferred") {
    pages.push(`A word of caution: parts of this path were inferred rather than read from official pages. ${subject.sourceNote || "Check them against your subject outline."}`);
  }
  pages.push("How may I help you?");

  const back = () => open.show(tutorDialogue(state, subject, tutor, open));
  const say = (lines: string[]): void =>
    open.show({ speaker: tutor, side: "npc", pages: lines, options: [{ label: "I have another question.", run: back }, { label: "Farewell.", run: open.close }] });

  const soonest = soonestQuest(state, [subject]);
  const options: DialogueOption[] = [
    { label: "I have a question about the subject.", run: () => { open.close(); open.ask(); } },
    { label: "Let me explain a concept to you.", run: () => { open.close(); open.explain(); } },
    { label: "What should I study next?", run: () => say([nextStudyAdvice(state, subject), soonest ? `Your most pressing quest is "${soonest.assessment.title}", ${dueLabel(soonest.assessment, state.curriculum)}.` : "Every quest of this subject is complete. Well done."]) },
    {
      label: "Tell me about this subject.",
      run: () =>
        say([
          subject.summary || `Your codex holds what is known of ${subject.name}.`,
          subject.learningOutcomes.length ? `By the end you should be able to: ${subject.learningOutcomes.slice(0, 3).join("; ")}.` : "Open your Codex to read the weekly path and key terms.",
        ]),
    },
    {
      label: "How do I train here?",
      run: () =>
        say([
          "Study each week at its waystone, then win its trial. The Exam Arena tests you on the whole subject with harder questions; the Scroll table pairs terms with meanings; the Rune altar spells out key words; the Meditation shrine rewards real, timed focus. Enter my building to read the subject's codex.",
          "But the greatest experience comes from quests: your real assessments. Tick their steps on the quest board as you truly complete them.",
          "When a deadline draws near, its boss rises in the lair nearby. And every question you miss waits in your Grimoire of Mistakes until you've truly learned it.",
        ]),
    },
    { label: "Show me the quest board.", run: () => { open.close(); open.board(); } },
    { label: "Open my codex for this subject.", run: () => { open.close(); open.codex(); } },
    { label: "Farewell.", run: open.close },
  ];
  return { speaker: tutor, side: "npc", pages, options };
}

