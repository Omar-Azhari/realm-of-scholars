/**
 * Phase 22 Part 9 "Dashboard Evolution" — seven small, minimal cards
 * (Academic Health, Confidence Overview, Current Focus, Workload,
 * Momentum, Weekly Reflection, Recommended Next Action), each reusing the
 * pre-existing `DashboardCardShell` chrome (Phase 5, previously unused —
 * no Dashboard screen had been wired up yet) rather than inventing a
 * second visual language. Every number traces to `ContextEngine.ts` or
 * one of the other Phase 22 AI modules — nothing here re-derives a value
 * a prior engine already computed. "Keep minimal": each card is a
 * headline value/label plus at most one supporting line, never a second
 * nested list of raw data.
 *
 * Phase 23 "Dashboard Connection" — every card now has a small "Talk"
 * affordance opening a real mentor conversation on the same topic
 * (`useMentorConversation.ts`, shared with Game3D.tsx's in-world
 * npc-chat), via the portable `MentorConversationPanel`.
 */

import { useMemo, useState } from "react";
import { HeartPulse, Gauge, Target, Scale, Zap, Sparkles, Compass, HelpCircle, MessageCircle } from "lucide-react";
import { DashboardCardShell } from "./DashboardCardShell";
import { useSaveData } from "../../state/SaveDataContext";
import { buildStudentContext } from "../../ai/ContextEngine";
import { generateRecommendations } from "../../ai/RecommendationEngine";
import { generateWeeklyReflection } from "../../ai/ReflectionEngine";
import { useMentorConversation } from "../../hooks/useMentorConversation";
import { MentorConversationPanel } from "../mentor/MentorConversationPanel";

const WORKLOAD_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", peak: "Peak" };

function TalkButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="daily-brief-why-toggle" onClick={onClick}>
      <MessageCircle size={14} aria-hidden="true" /> Talk to {label}
    </button>
  );
}

export function AiMentorDashboard() {
  const { saveData } = useSaveData();
  const now = useMemo(() => new Date(), []);
  const [showWhy, setShowWhy] = useState(false);
  const { active, openConversation, closeConversation } = useMentorConversation();

  const context = useMemo(() => buildStudentContext(saveData, now), [saveData, now]);
  const recommendations = useMemo(() => generateRecommendations(saveData, context, now, 1), [saveData, context, now]);
  const reflection = useMemo(() => generateWeeklyReflection(saveData, context, now), [saveData, context, now]);

  const topRecommendation = recommendations[0] ?? null;

  // Academic Health — the one honestly-derivable status without a
  // fabricated "should be X% done by now" curve: overdue work always
  // means "needs attention"; otherwise it's steady.
  const needsAttention = context.overdueAssessments.length > 0;
  const healthLabel = needsAttention ? "Needs Attention" : "On Track";
  const healthDetail = needsAttention
    ? `${context.overdueAssessments.length} overdue assessment${context.overdueAssessments.length === 1 ? "" : "s"}.`
    : `${context.semester.overallProgress.percent}% of modules complete, nothing overdue.`;

  // Current Focus — descriptive (what you've actually been doing), not
  // prescriptive — the subject with the most Focus Sprint time this week.
  const mostFocused = [...context.subjects].sort((a, b) => b.focusMinutesLast7Days - a.focusMinutesLast7Days)[0];
  const currentFocusLabel = mostFocused && mostFocused.focusMinutesLast7Days > 0 ? mostFocused.subjectName : "No sessions yet this week";
  const currentFocusDetail = mostFocused && mostFocused.focusMinutesLast7Days > 0 ? `${mostFocused.focusMinutesLast7Days} min this week.` : "Start a Focus Sprint to see it here.";
  const currentFocusSubjectId = mostFocused && mostFocused.focusMinutesLast7Days > 0 ? mostFocused.subjectId : null;

  const totalFocusMinutesThisWeek = context.subjects.reduce((sum, s) => sum + s.focusMinutesLast7Days, 0);

  return (
    <div className="dashboard-grid">
      <DashboardCardShell title="Academic Health" icon={HeartPulse}>
        <strong className="dashboard-stat-value">{healthLabel}</strong>
        <p className="screen-lede">{healthDetail}</p>
        <TalkButton label="the guide" onClick={() => openConversation("guide", "Campus Guide")} />
      </DashboardCardShell>

      <DashboardCardShell title="Confidence Overview" icon={Gauge}>
        {context.subjects.length > 0 ? (
          <ul className="dashboard-list">
            {context.subjects.map((s) => (
              <li key={s.subjectId}>
                <button type="button" className="dashboard-list-link" onClick={() => openConversation(s.subjectId, `${s.subjectName} Mentor`)}>
                  {s.subjectName}
                </button>
                <span>{s.confidence.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="screen-lede">No subjects imported yet.</p>
        )}
      </DashboardCardShell>

      <DashboardCardShell title="Current Focus" icon={Target}>
        <strong className="dashboard-stat-value">{currentFocusLabel}</strong>
        <p className="screen-lede">{currentFocusDetail}</p>
        {currentFocusSubjectId ? (
          <TalkButton label={`${currentFocusLabel} Mentor`} onClick={() => openConversation(currentFocusSubjectId, `${currentFocusLabel} Mentor`)} />
        ) : null}
      </DashboardCardShell>

      <DashboardCardShell title="Workload" icon={Scale}>
        <strong className="dashboard-stat-value">{context.workloadLevel ? WORKLOAD_LABELS[context.workloadLevel] : "Not available"}</strong>
        <p className="screen-lede">{context.workloadLevel ? "This teaching week, relative to your own semester." : "Confirm your semester start date to see this."}</p>
        <TalkButton label="the guide" onClick={() => openConversation("guide", "Campus Guide")} />
      </DashboardCardShell>

      <DashboardCardShell title="Momentum" icon={Zap}>
        <strong className="dashboard-stat-value">
          {context.streak.current} day{context.streak.current === 1 ? "" : "s"}
        </strong>
        <p className="screen-lede">
          Current streak · {totalFocusMinutesThisWeek} min focused this week.
        </p>
        <TalkButton label="the guide" onClick={() => openConversation("guide", "Campus Guide")} />
      </DashboardCardShell>

      <DashboardCardShell title="Weekly Reflection" icon={Sparkles}>
        {reflection.statements.length > 0 ? (
          <ul className="dashboard-list">
            {reflection.statements.slice(0, 3).map((s) => (
              <li key={s.id}>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="screen-lede">Nothing to reflect on yet this week — get started, and it'll show up here.</p>
        )}
        <TalkButton label="the guide" onClick={() => openConversation("guide", "Campus Guide")} />
      </DashboardCardShell>

      <DashboardCardShell title="Recommended Next Action" icon={Compass}>
        {topRecommendation ? (
          <>
            <strong className="dashboard-stat-value" style={{ fontSize: "1rem" }}>
              {topRecommendation.action}
            </strong>
            <p className="screen-lede">{topRecommendation.reason}</p>
            <button type="button" className="daily-brief-why-toggle" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
              <HelpCircle size={14} aria-hidden="true" /> Why?
            </button>
            {showWhy ? (
              <ul className="daily-brief-evidence-list">
                {topRecommendation.evidence.map((reason, i) => (
                  <li key={i}>
                    {reason.label} <span className="daily-brief-evidence-score">({reason.contribution}/{reason.max})</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {topRecommendation.subjectId ? (
              (() => {
                const subject = context.subjects.find((s) => s.subjectId === topRecommendation.subjectId);
                return subject ? <TalkButton label={`${subject.subjectName} Mentor`} onClick={() => openConversation(subject.subjectId, `${subject.subjectName} Mentor`)} /> : null;
              })()
            ) : (
              <TalkButton label="the guide" onClick={() => openConversation("guide", "Campus Guide")} />
            )}
          </>
        ) : (
          <p className="screen-lede">Continue your current study plan.</p>
        )}
      </DashboardCardShell>

      {active ? <MentorConversationPanel npcLabel={active.npcLabel} conversation={active.conversation} onClose={closeConversation} /> : null}
    </div>
  );
}
