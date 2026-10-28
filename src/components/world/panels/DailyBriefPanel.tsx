/**
 * Daily Brief panel (Phase 20D Part 4; expanded Phase 20E Part 4; made
 * adaptive Phase 22 Part 4). Reuses existing Academic Intelligence engines
 * throughout — no ranking/derivation logic is duplicated here, only
 * display: `getTodaysClasses`/`getDailyEncouragement` (`lib/todayEngine.ts`),
 * `getTopPriorityItems` (assessment-only, for Upcoming Deadlines),
 * `computeLevel`/`XP_PER_LEVEL` (xpRules.ts, unchanged), and
 * `getRoomUnlockProgress` (data/furnitureUnlocks.ts, Phase 20D/20E).
 *
 * Phase 22 Part 4 "Adaptive Daily Brief": the old "Suggested Study Block" +
 * "More Suggestions" sections (both sourced from the same single
 * `getTodayRecommendations` ranking) are replaced by ONE "Recommended For
 * You" section sourced from `RecommendationEngine.ts`'s
 * `generateRecommendations` — built from the Context Engine, so every card
 * carries a real "why" (`reason`) and a Part 8 "Why?" toggle revealing its
 * full evidence breakdown (no hidden scoring). Reuses `TasksPanel`'s exact
 * CSS classes rather than inventing a second visual language.
 */

import { useMemo, useState } from "react";
import { Crosshair, MapPin, HelpCircle } from "lucide-react";
import { useSaveData } from "../../../state/SaveDataContext";
import { useWorldUi } from "../../../world/WorldUiContext";
import { getDailyEncouragement, getTodaysClasses } from "../../../lib/todayEngine";
import { getTopPriorityItems, getPriorityItemId } from "../../../lib/priority";
import { getRoomUnlockProgress } from "../../../data/furnitureUnlocks";
import { computeLevel, XP_PER_LEVEL } from "../../../lib/xpRules";
import { getSubjectAccentVar } from "../../../lib/subjectTheme";
import { getTodaysCampusEvent } from "../../../game3d/campus/campusEvents";
import { getCampusAtmosphere } from "../../../game3d/campus/campusAtmosphere";
import { buildStudentContext } from "../../../ai/ContextEngine";
import { generateRecommendations, type RecommendationCategory } from "../../../ai/RecommendationEngine";

/** Recommendation categories with a clean existing in-world interactable to Track/Locate — the rest (take-a-break, organise-room, visit-library, subject-focus) don't map to one specific module/assessment, so they show as information only. */
const TRACKABLE_CATEGORIES: Partial<Record<RecommendationCategory, "modules" | "assessments">> = {
  overdue: "assessments",
  "assessment-prep": "assessments",
  "module-work": "modules",
  "lecture-review": "modules",
};

export function DailyBriefPanel() {
  const { saveData } = useSaveData();
  const { locateInWorld, trackObjective } = useWorldUi();
  const now = useMemo(() => new Date(), []);
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);

  const context = useMemo(() => buildStudentContext(saveData, now), [saveData, now]);
  const recommendations = useMemo(() => generateRecommendations(saveData, context, now, 5), [saveData, context, now]);
  const todaysClasses = useMemo(() => getTodaysClasses(saveData, now), [saveData, now]);
  const encouragement = useMemo(() => getDailyEncouragement(now), [now]);
  const campusEvent = useMemo(() => getTodaysCampusEvent(now), [now]);
  const campusAtmosphere = useMemo(() => getCampusAtmosphere(saveData, now), [saveData, now]);
  const unlockProgress = useMemo(() => getRoomUnlockProgress(saveData), [saveData]);
  const deadlines = useMemo(
    () => getTopPriorityItems(saveData.semester.subjects, saveData.tasks, now, 20, saveData.settings.pinnedPriorityIds).filter((item) => item.type === "assessment"),
    [saveData, now]
  );

  const { xp, streakCount, longestStreak } = saveData.userProgress;
  const level = computeLevel(xp);
  const xpIntoLevel = xp - (level - 1) * XP_PER_LEVEL;
  // Phase 20F Part 9 — distinguishes "you haven't imported a semester yet"
  // (guide them toward Import) from "you have, and nothing's urgent right
  // now" (reassure them) — the brief's own two distinct example fallback
  // lines for Upcoming Deadlines only make sense as two different cases.
  const hasSubjects = saveData.semester.subjects.length > 0;

  return (
    <div className="tasks-panel daily-brief-panel">
      <p className="daily-brief-intro">{encouragement}</p>
      {/* Phase 21 Part 5 "Campus Events" — ambience only, no button, no
          tracking: just what's happening on campus today. */}
      <p className="daily-brief-event">{campusEvent.line}</p>
      {/* Phase 21 Part 9 "Campus Atmosphere" — null on an ordinary teaching
          day (deliberately quiet most of the time, per the brief's own
          "keep subtle"), so this rarely stacks with the line above. */}
      {campusAtmosphere.note ? <p className="daily-brief-event">{campusAtmosphere.note}</p> : null}

      {/* Phase 20F Part 9 hierarchy: greeting, most urgent deadline, today's
          classes, recommended next action, streak/XP/unlocks — deadlines
          now lead (previously Today's Classes came first). */}
      <section className="tasks-section">
        <h3 className="tasks-section-title">
          Upcoming Deadlines <span className="tasks-section-count">{deadlines.length}</span>
        </h3>
        {deadlines.length > 0 ? (
          <ul className="tasks-list">
            {deadlines.slice(0, 4).map((item) => (
              <li key={getPriorityItemId(item)} className="task-card">
                <span className="task-card-main task-card-main--static">
                  <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(item.subject.id)})` }} />
                  <span className="task-card-text">
                    <span className="task-card-title">{item.type === "assessment" ? item.assessment.title : ""}</span>
                    <span className="task-card-sub">
                      {item.subject.name}
                      {item.type === "assessment" ? ` · due ${item.assessment.dueWindowRaw}` : ""}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tasks-empty">{hasSubjects ? "No urgent deadlines." : "Your next imported assessment will appear here."}</p>
        )}
      </section>

      <section className="tasks-section">
        <h3 className="tasks-section-title">Today's Classes</h3>
        {todaysClasses.length > 0 ? (
          <ul className="tasks-list">
            {todaysClasses.map((cls) => (
              <li key={cls.entry.id} className="task-card">
                <span className="task-card-main task-card-main--static">
                  <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(cls.subjectId)})` }} />
                  <span className="task-card-text">
                    <span className="task-card-title">{cls.entry.title}</span>
                    <span className="task-card-sub">
                      {cls.subjectName}
                      {cls.entry.startTime ? ` · ${cls.entry.startTime}` : ""}
                      {cls.entry.location ? ` · ${cls.entry.location}` : ""}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tasks-empty">No classes scheduled today.</p>
        )}
      </section>

      {/* Phase 22 Part 4/8 — every card states WHY it's here (`rec.reason`)
          and carries a "Why?" toggle revealing the full evidence breakdown
          behind it (`rec.evidence`, the same `PriorityReason[]` shape
          `priority.ts` already defines for exactly this purpose) — no
          hidden scoring. */}
      <section className="tasks-section">
        <h3 className="tasks-section-title">Recommended For You</h3>
        {recommendations.length > 0 ? (
          <ul className="tasks-list">
            {recommendations.map((rec, index) => {
              const kind = TRACKABLE_CATEGORIES[rec.category];
              const subject = rec.subjectId ? saveData.semester.subjects.find((s) => s.id === rec.subjectId) : undefined;
              const isExpanded = expandedRecommendationId === rec.id;
              return (
                <li key={rec.id} className={index === 0 ? "task-card task-card--next" : "task-card"}>
                  <span className="task-card-main task-card-main--static">
                    {subject ? <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(subject.id)})` }} /> : null}
                    <span className="task-card-text">
                      <span className="task-card-title">{rec.action}</span>
                      <span className="task-card-sub">
                        {rec.reason} · ~{rec.estimatedDurationMinutes} min · {rec.confidenceLabel} confidence
                      </span>
                    </span>
                  </span>
                  <div className="task-card-actions">
                    {kind && subject ? (
                      <>
                        <button type="button" onClick={() => trackObjective({ title: rec.action, subjectId: subject.id, sceneId: `room-${subject.id}`, interactableId: kind })}>
                          <Crosshair size={14} aria-hidden="true" /> Track
                        </button>
                        <button type="button" onClick={() => locateInWorld({ title: rec.action, subjectId: subject.id, sceneId: `room-${subject.id}`, interactableId: kind })}>
                          <MapPin size={14} aria-hidden="true" /> Locate
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="daily-brief-why-toggle"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedRecommendationId(isExpanded ? null : rec.id)}
                    >
                      <HelpCircle size={14} aria-hidden="true" /> Why?
                    </button>
                  </div>
                  {isExpanded ? (
                    <ul className="daily-brief-evidence-list">
                      {rec.evidence.map((reason, reasonIndex) => (
                        <li key={reasonIndex}>
                          {reason.label} <span className="daily-brief-evidence-score">({reason.contribution}/{reason.max})</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="tasks-empty">Continue your current study plan.</p>
        )}
      </section>

      <section className="tasks-section daily-brief-stats">
        <div className="daily-brief-stat">
          <span className="daily-brief-stat-label">Study Streak</span>
          <span className="daily-brief-stat-value">
            {streakCount} day{streakCount === 1 ? "" : "s"}
            {longestStreak > streakCount ? ` (best ${longestStreak})` : ""}
          </span>
        </div>
        <div className="daily-brief-stat">
          <span className="daily-brief-stat-label">XP Progress</span>
          <span className="daily-brief-stat-value">
            Level {level} — {xpIntoLevel}/{XP_PER_LEVEL} XP
          </span>
        </div>
        <div className="daily-brief-stat">
          <span className="daily-brief-stat-label">Room Unlocks</span>
          <span className="daily-brief-stat-value">
            {unlockProgress.unlockedCount}/{unlockProgress.totalCount} items
            {unlockProgress.nextItem ? ` — next: ${unlockProgress.nextItem.displayName}` : ""}
          </span>
        </div>
      </section>

    </div>
  );
}
