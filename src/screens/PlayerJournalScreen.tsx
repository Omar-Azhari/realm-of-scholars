/**
 * Player Journal (Phase 21 Part 8) — a private, read-only, auto-generated
 * record. Deliberately distinct from the existing, player-EDITED "Study
 * Journal" (`StudyJournalScreen.tsx`, its own Profile sub-tab): the brief
 * is explicit that THIS journal is "read-only. Auto-generated." — nothing
 * here has a create/edit/delete control, and every entry is composed from
 * data that already exists elsewhere in the save (milestones, mentor
 * relationships, building visits, assessment progress, NPC memory) rather
 * than invented or separately authored. No new derivation logic lives
 * here — only display and re-grouping of existing engines' output.
 */

import { useMemo } from "react";
import { Medal, Sparkles, ClipboardCheck, MapPin, MessageCircle, Flame, NotebookText } from "lucide-react";
import { useSaveData } from "../state/SaveDataContext";
import { getMelbourneDateTimeKey } from "../lib/selectors";
import { formatMelbourneKey } from "../lib/reminders";
import { getFavouriteBuildings } from "../game3d/campus/campusMap";
import { getSubjectAccentVar } from "../lib/subjectTheme";
import { getMentorRelationshipSummary } from "../ai/MentorRelationshipStats";

/** Milestone/NPC-memory timestamps are raw `toISOString()` UTC instants (unlike the Melbourne-local "key" strings `StudyJournalScreen`'s own entries store) — convert properly rather than assuming the format. */
function formatWhen(iso: string): string {
  return formatMelbourneKey(getMelbourneDateTimeKey(new Date(iso)));
}

export function PlayerJournalScreen() {
  const { saveData } = useSaveData();
  const subjects = saveData.semester.subjects;
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const achievements = useMemo(
    () => saveData.milestones.filter((m) => m.kind === "achievement").sort((a, b) => (a.at < b.at ? 1 : -1)),
    [saveData.milestones]
  );
  const otherMilestones = useMemo(
    () => saveData.milestones.filter((m) => m.kind !== "achievement").sort((a, b) => (a.at < b.at ? 1 : -1)),
    [saveData.milestones]
  );

  const favouriteBuildings = useMemo(() => getFavouriteBuildings(saveData, 3), [saveData]);

  const completedAssessments = useMemo(() => {
    const list: Array<{ id: string; title: string; subjectName: string; subjectId: string; when: string | null; graded: boolean }> = [];
    for (const subject of subjects) {
      for (const assessment of subject.assessments) {
        const progress = saveData.assessmentProgress.find((p) => p.assessmentId === assessment.id);
        if (progress && (progress.status === "submitted" || progress.status === "graded")) {
          list.push({
            id: assessment.id,
            title: assessment.title,
            subjectName: subject.name,
            subjectId: subject.id,
            when: progress.statusChangedAt,
            graded: progress.status === "graded",
          });
        }
      }
    }
    return list.sort((a, b) => ((b.when ?? "") < (a.when ?? "") ? -1 : 1));
  }, [subjects, saveData.assessmentProgress]);

  const mentorComments = useMemo(() => {
    const list: Array<{ key: string; label: string; line: string; when: string | null; subjectId: string | null; stage: string; conversationCount: number }> = [];
    for (const [key, memory] of Object.entries(saveData.npcMemory)) {
      if (!memory.lastLine) continue;
      const subject = subjectById.get(key);
      // Phase 24 "Mentor Relationships" — stage + conversation count reuse
      // the SAME real, already-derived relationship data every other
      // engine reads (mentorRelationship.ts's points/level, or the guide's
      // conversation-count staircase); nothing here is a second system.
      const summary = getMentorRelationshipSummary(saveData, key);
      list.push({
        key,
        label: subject ? `${subject.name} Mentor` : key === "guide" ? "Campus Guide" : key,
        line: memory.lastLine,
        when: memory.lastInteractionAt,
        subjectId: subject?.id ?? null,
        stage: summary.stage,
        conversationCount: summary.conversationCount,
      });
    }
    return list.sort((a, b) => ((b.when ?? "") < (a.when ?? "") ? -1 : 1));
  }, [saveData, subjectById]);

  const { streakCount, longestStreak } = saveData.userProgress;

  const hasAnything =
    achievements.length > 0 ||
    otherMilestones.length > 0 ||
    favouriteBuildings.length > 0 ||
    completedAssessments.length > 0 ||
    mentorComments.length > 0 ||
    streakCount > 0 ||
    longestStreak > 0;

  return (
    <section className="screen">
      <h1 className="screen-title">
        <NotebookText size={26} aria-hidden="true" className="screen-title-icon" /> Memories
      </h1>
      <p className="screen-lede">
        A private, auto-generated record of your semester — everything below reflects things
        you've actually done. Read-only; there's nothing here to edit.
      </p>

      {!hasAnything ? (
        <div className="panel">
          <p className="screen-lede">Nothing recorded yet — get studying, and this page will fill itself in.</p>
        </div>
      ) : (
        <>
          <div className="panel">
            <h2 className="dashboard-card-title">
              <Flame size={16} aria-hidden="true" /> Study Streak
            </h2>
            <p className="screen-lede">
              {streakCount} day{streakCount === 1 ? "" : "s"} current
              {longestStreak > 0 ? ` · best ${longestStreak} day${longestStreak === 1 ? "" : "s"}` : ""}
            </p>
          </div>

          {favouriteBuildings.length > 0 ? (
            <div className="panel">
              <h2 className="dashboard-card-title">
                <MapPin size={16} aria-hidden="true" /> Favourite Places
              </h2>
              <ul className="collections-list">
                {favouriteBuildings.map(({ location, visitDays }) => (
                  <li key={location.id}>
                    <strong>{location.label}</strong>
                    <span className="screen-lede"> — visited {visitDays} day{visitDays === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {achievements.length > 0 ? (
            <div className="panel">
              <h2 className="dashboard-card-title">
                <Medal size={16} aria-hidden="true" /> Achievements
              </h2>
              <ul className="collections-list">
                {achievements.map((m) => (
                  <li key={m.id}>
                    <strong>{m.label}</strong>
                    <span className="screen-lede"> — {formatWhen(m.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {completedAssessments.length > 0 ? (
            <div className="panel">
              <h2 className="dashboard-card-title">
                <ClipboardCheck size={16} aria-hidden="true" /> Completed Assessments
              </h2>
              <ul className="collections-list">
                {completedAssessments.map((a) => (
                  <li key={a.id}>
                    <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(a.subjectId)})` }} />
                    <strong>{a.title}</strong>
                    <span className="screen-lede">
                      {" "}
                      — {a.subjectName} · {a.graded ? "graded" : "submitted"}
                      {a.when ? ` · ${formatWhen(a.when)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mentorComments.length > 0 ? (
            <div className="panel">
              <h2 className="dashboard-card-title">
                <MessageCircle size={16} aria-hidden="true" /> Mentor Comments
              </h2>
              <ul className="collections-list">
                {mentorComments.map((c) => (
                  <li key={c.key}>
                    {c.subjectId ? <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(c.subjectId)})` }} /> : null}
                    <strong>{c.label}</strong>
                    <span className="screen-lede">
                      {" "}
                      — "{c.line}"{c.when ? ` · ${formatWhen(c.when)}` : ""} · {c.stage} · {c.conversationCount} conversation{c.conversationCount === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {otherMilestones.length > 0 ? (
            <div className="panel">
              <h2 className="dashboard-card-title">
                <Sparkles size={16} aria-hidden="true" /> Milestones
              </h2>
              <ul className="collections-list">
                {otherMilestones.map((m) => (
                  <li key={m.id}>
                    <strong>{m.label}</strong>
                    <span className="screen-lede"> — {formatWhen(m.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
