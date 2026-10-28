import { CircleUserRound, Flame, GraduationCap, Timer, Trophy } from "lucide-react";
import { useSaveData } from "../state/SaveDataContext";
import { Character } from "../components/character/Character";
import { getAchievementStatuses } from "../lib/achievements";
import { getCountedSessions, getSubjectFocusSeconds, getTotalFocusSeconds } from "../lib/focusSession";
import { computeMentorRelationship, formatMinutes } from "../lib/mentorRelationship";
import { getOverallModuleProgress, getSubjectCompletedModuleCount } from "../lib/selectors";
import { AiMentorDashboard } from "../components/dashboard/AiMentorDashboard";

/**
 * Player profile — every value on this screen is derived from saved data
 * (focus sessions, tasks, assessment progress, achievements, bonds). Nothing
 * is estimated or invented.
 */
export function ProfileScreen() {
  const { saveData } = useSaveData();
  const { userProgress, semester } = saveData;

  const overall = getOverallModuleProgress(saveData.tasks, semester.subjects);
  const achievements = getAchievementStatuses(saveData);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const sprints = getCountedSessions(saveData).length;
  const totalFocusMinutes = Math.floor(getTotalFocusSeconds(saveData) / 60);
  const assessmentsCompleted = saveData.assessmentProgress.filter(
    (p) => p.status === "submitted" || p.status === "graded"
  ).length;
  const totalAssessments = semester.subjects.reduce((sum, s) => sum + s.assessments.length, 0);

  return (
    <section className="screen">
      <h1 className="screen-title">
        <CircleUserRound size={26} aria-hidden="true" className="screen-title-icon" /> Player Profile
      </h1>
      <p className="screen-lede">Your semester, in real numbers — everything here comes from saved activity.</p>

      <div className="panel profile-header">
        <Character accentVar="--hq-accent" label="Your UniGame avatar" size="large" />
        <dl className="profile-stat-grid">
          <div>
            <dt>Level</dt>
            <dd>{userProgress.level}</dd>
          </div>
          <div>
            <dt>Total XP</dt>
            <dd>{userProgress.xp}</dd>
          </div>
          <div>
            <dt>
              <Flame size={13} aria-hidden="true" /> Current streak
            </dt>
            <dd>
              {userProgress.streakCount} day{userProgress.streakCount === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt>Longest streak</dt>
            <dd>
              {userProgress.longestStreak} day{userProgress.longestStreak === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt>
              <Timer size={13} aria-hidden="true" /> Focus time
            </dt>
            <dd>{formatMinutes(totalFocusMinutes)}</dd>
          </div>
          <div>
            <dt>Focus Sprints</dt>
            <dd>{sprints}</dd>
          </div>
          <div>
            <dt>
              <GraduationCap size={13} aria-hidden="true" /> Modules
            </dt>
            <dd>
              {overall.completed}/{overall.total}
            </dd>
          </div>
          <div>
            <dt>Assessments</dt>
            <dd>
              {assessmentsCompleted}/{totalAssessments}
            </dd>
          </div>
          <div>
            <dt>
              <Trophy size={13} aria-hidden="true" /> Achievements
            </dt>
            <dd>
              {unlocked}/{achievements.length}
            </dd>
          </div>
          <div>
            <dt>Semester completion</dt>
            <dd>{overall.percent}%</dd>
          </div>
        </dl>
      </div>

      {/* Phase 22 Part 9 "Dashboard Evolution" — Academic Health, Confidence
          Overview, Current Focus, Workload, Momentum, Weekly Reflection,
          Recommended Next Action, all derived from the AI Mentor's Context
          Engine. Kept as its own labelled section, not folded into the
          stat grid above, so the two "kinds" of information (raw counters
          vs. AI-derived guidance) stay visually distinct. */}
      <h2 className="screen-title" style={{ fontSize: "1.1rem", marginTop: "var(--space-5, 24px)" }}>
        Your AI Mentor
      </h2>
      <AiMentorDashboard />

      <div className="panel">
        <h2 className="dashboard-card-title">Subjects & mentors</h2>
        <ul className="profile-subject-list">
          {semester.subjects.map((subject) => {
            const relationship = computeMentorRelationship(saveData, subject);
            const focusMinutes = Math.floor(getSubjectFocusSeconds(saveData, subject.id) / 60);
            const modules = getSubjectCompletedModuleCount(saveData.tasks, subject);
            return (
              <li key={subject.id} className="profile-subject-row">
                <div className="profile-subject-main">
                  <strong>{subject.name}</strong>
                  <span>
                    {formatMinutes(focusMinutes)} focus · {relationship.stats.sprints} sprint
                    {relationship.stats.sprints === 1 ? "" : "s"} · {modules}/{subject.modules.length} modules
                  </span>
                </div>
                <div className="profile-subject-bond">
                  <span>
                    Mentor bond: Lv {relationship.level} · {relationship.levelName}
                  </span>
                  <div className="mentor-profile-bar" aria-hidden="true">
                    <div
                      style={{
                        width: relationship.progress
                          ? `${Math.min(100, (relationship.progress.current / relationship.progress.needed) * 100)}%`
                          : "100%",
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
