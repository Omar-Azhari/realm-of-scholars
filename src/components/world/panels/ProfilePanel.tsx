/**
 * Profile view (Phase 15B) — lives inside the Menu panel. Folds the player's
 * identity, statistics, achievements, relationships, timeline and study
 * journal into one place via sub-tabs (progressive disclosure). Each sub-view
 * reuses an existing, self-contained (router-link-free) screen or component.
 */

import { useMemo, useState } from "react";
import { ProfileScreen } from "../../../screens/ProfileScreen";
import { TimelineScreen } from "../../../screens/TimelineScreen";
import { StudyJournalScreen } from "../../../screens/StudyJournalScreen";
import { PlayerJournalScreen } from "../../../screens/PlayerJournalScreen";
import { AchievementBadge } from "../../achievements/AchievementBadge";
import { useSaveData } from "../../../state/SaveDataContext";
import { getAchievementStatuses } from "../../../lib/achievements";
import { computeMentorRelationship, LEVEL_NAMES } from "../../../lib/mentorRelationship";
import { getSubjectAccentVar } from "../../../lib/subjectTheme";

export type ProfileSub = "overview" | "achievements" | "relationships" | "timeline" | "memories" | "journal";
const SUBS: { id: ProfileSub; label: string }[] = [
  { id: "overview", label: "Statistics" },
  { id: "achievements", label: "Achievements" },
  { id: "relationships", label: "Mentors" },
  { id: "timeline", label: "Timeline" },
  // Phase 21 Part 8 "Player Journal" — read-only, auto-generated highlights.
  // Deliberately a separate tab from "Journal" below, which is the
  // player's own manually-written study log (StudyJournalScreen,
  // pre-existing) — the brief's journal and that one serve different
  // purposes and neither should be folded into the other.
  { id: "memories", label: "Memories" },
  { id: "journal", label: "Journal" },
];

export function ProfilePanel({ initialSub = "overview" }: { initialSub?: ProfileSub }) {
  const { saveData } = useSaveData();
  const [sub, setSub] = useState<ProfileSub>(initialSub);
  const achievements = useMemo(() => getAchievementStatuses(saveData), [saveData]);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="profile-panel">
      <div className="profile-subtabs" role="tablist" aria-label="Profile sections">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={sub === s.id}
            className={sub === s.id ? "is-active" : ""}
            onClick={() => setSub(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="profile-subview">
        {sub === "overview" ? <ProfileScreen /> : null}
        {sub === "achievements" ? (
          <section className="screen">
            <h2 className="screen-title">
              Achievements — {unlocked}/{achievements.length}
            </h2>
            <div className="room-achievement-grid">
              {achievements.map((status) => (
                <AchievementBadge key={status.definition.id} status={status} />
              ))}
            </div>
          </section>
        ) : null}
        {sub === "relationships" ? <RelationshipsView /> : null}
        {sub === "timeline" ? <TimelineScreen /> : null}
        {sub === "memories" ? <PlayerJournalScreen /> : null}
        {sub === "journal" ? <StudyJournalScreen /> : null}
      </div>
    </div>
  );
}

function RelationshipsView() {
  const { saveData } = useSaveData();
  return (
    <section className="screen">
      <h2 className="screen-title">Mentor bonds</h2>
      <ul className="collections-list">
        {saveData.semester.subjects.map((subject) => {
          const rel = computeMentorRelationship(saveData, subject);
          return (
            <li key={subject.id}>
              <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(subject.id)})` }} />
              <strong>{subject.name}</strong> — level {rel.level}/{LEVEL_NAMES.length} ({rel.levelName})
              <span className="screen-lede">
                {rel.stats.sprints} sprints · {rel.stats.focusMinutes} min · {rel.stats.visitDays} visit
                day{rel.stats.visitDays === 1 ? "" : "s"}
                {rel.progress ? ` · ${rel.progress.current}/${rel.progress.needed} to next` : " · max"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
