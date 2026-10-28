import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Coffee, Pause, Play, Square, Timer, X } from "lucide-react";
import { useSaveData } from "../../state/SaveDataContext";
import { FOCUS_PRESETS, getElapsedFocusMs, isFocusSessionPaused } from "../../lib/focusSession";
import { emitSound } from "../../lib/sound";
import { useMotionPreference } from "../../hooks/useMotionPreference";
import type { FocusCompletionOutcome } from "../../lib/focusSession";
import type { MoodRating, SubjectRecord } from "../../types/domain";

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const MOODS: Array<{ value: MoodRating; label: string }> = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

interface FocusPanelProps {
  subject: SubjectRecord;
  accent: string;
  /** Stand up / close Focus Mode (does not end a running session). */
  onClose: () => void;
}

type PanelView =
  | { kind: "setup" }
  | { kind: "running" }
  | { kind: "wrapup"; outcome: FocusCompletionOutcome; status: "completed" | "finished-early" }
  | { kind: "cancelled" };

/**
 * Focus Mode — lives inside the room next to the desk. Session state is in
 * the save (survives refresh); this panel only renders it and drives the
 * lifecycle mutations. The ticking interval repaints; elapsed time itself is
 * always derived from real timestamps.
 */
export function FocusPanel({ subject, accent, onClose }: FocusPanelProps) {
  const {
    saveData,
    startFocus,
    pauseFocus,
    resumeFocus,
    setFocusNotes,
    setFocusLinks,
    endFocus,
    updateStudyLog,
  } = useSaveData();
  const reduceMotion = useMotionPreference();
  const session = saveData.activeFocusSession;
  const sessionIsHere = session?.subjectId === subject.id;

  const [view, setView] = useState<PanelView>(() =>
    session && sessionIsHere ? { kind: "running" } : { kind: "setup" }
  );
  const [customFocus, setCustomFocus] = useState("25");
  const [customBreak, setCustomBreak] = useState("5");
  const [linkAssessment, setLinkAssessment] = useState("");
  const [linkModule, setLinkModule] = useState("");
  const [wrap, setWrap] = useState({ completed: "", difficulties: "", nextPlan: "", extraNotes: "" });
  const [moodBefore, setMoodBefore] = useState<MoodRating | null>(null);
  const [moodAfter, setMoodAfter] = useState<MoodRating | null>(null);
  const [breakLeft, setBreakLeft] = useState<number | null>(null);

  // Repaint tick — real elapsed time comes from timestamps, not this counter.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = session ? Math.floor(getElapsedFocusMs(session) / 1000) : 0;
  const plannedSeconds = session ? session.focusMinutes * 60 : 0;
  const remainingSeconds = plannedSeconds - elapsedSeconds;
  const paused = session ? isFocusSessionPaused(session) : false;

  // Timer warning at one minute left; auto-complete at zero (rising edges only).
  const warnedRef = useRef(false);
  const completingRef = useRef(false);
  useEffect(() => {
    if (!session || !sessionIsHere || view.kind !== "running") return;
    if (!warnedRef.current && remainingSeconds <= 60 && remainingSeconds > 0) {
      warnedRef.current = true;
      emitSound("timer-warning");
    }
    if (!completingRef.current && remainingSeconds <= 0) {
      completingRef.current = true;
      finish("completed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, session, sessionIsHere, view.kind]);

  // Break countdown (post-session, ephemeral by design — not persisted).
  useEffect(() => {
    if (breakLeft === null || breakLeft <= 0) return;
    const t = window.setTimeout(() => setBreakLeft((b) => (b === null ? null : b - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [breakLeft]);

  const start = (focusMinutes: number, breakMinutes: number) => {
    startFocus({
      subjectId: subject.id,
      assessmentId: linkAssessment || null,
      moduleId: linkModule || null,
      focusMinutes,
      breakMinutes,
    });
    emitSound("focus-start");
    warnedRef.current = false;
    completingRef.current = false;
    setView({ kind: "running" });
  };

  const finish = (status: "completed" | "finished-early") => {
    const outcome = endFocus(status);
    emitSound("focus-complete");
    if (outcome.xp?.counted) emitSound("xp-gain");
    setView({ kind: "wrapup", outcome, status });
  };

  const cancel = () => {
    endFocus("cancelled");
    emitSound("focus-cancel");
    setView({ kind: "cancelled" });
  };

  const saveWrapUp = (outcome: FocusCompletionOutcome) => {
    if (outcome.journalEntryId) {
      const existing = saveData.studyLog.find((entry) => entry.id === outcome.journalEntryId);
      updateStudyLog(outcome.journalEntryId, {
        completed: wrap.completed.trim(),
        difficulties: wrap.difficulties.trim(),
        nextPlan: wrap.nextPlan.trim(),
        moodBefore,
        moodAfter,
        notes: [existing?.notes, wrap.extraNotes.trim()].filter(Boolean).join("\n"),
      });
    }
    onClose();
  };

  const sessionElsewhere = session && !sessionIsHere;
  const otherSubjectName = sessionElsewhere
    ? (saveData.semester.subjects.find((s) => s.id === session.subjectId)?.name ?? session.subjectId)
    : null;

  return (
    <motion.div
      className="focus-panel"
      style={{ "--panel-accent": accent } as React.CSSProperties}
      role="dialog"
      aria-label={`Focus Mode — ${subject.name}`}
      initial={reduceMotion ? false : { opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <header className="focus-panel-header">
        <Timer size={16} aria-hidden="true" />
        <h2>Focus Mode · {subject.name}</h2>
        <button type="button" className="room-panel-close" onClick={onClose} aria-label="Stand up from the desk">
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      {sessionElsewhere ? (
        <div className="focus-panel-body">
          <p>
            A focus session is already running in <strong>{otherSubjectName}</strong>. Finish or
            cancel it there first — only one session can run at a time.
          </p>
        </div>
      ) : null}

      {!sessionElsewhere && view.kind === "setup" ? (
        <div className="focus-panel-body">
          <p className="room-panel-lede">Pick a preset or set your own focus/break lengths.</p>
          <div className="focus-preset-row">
            {FOCUS_PRESETS.map((preset) => (
              <button key={preset.label} type="button" onClick={() => start(preset.focusMinutes, preset.breakMinutes)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="focus-custom-row">
            <label>
              Focus (min)
              <input type="number" min="1" max="240" value={customFocus} onChange={(e) => setCustomFocus(e.target.value)} />
            </label>
            <label>
              Break (min)
              <input type="number" min="0" max="60" value={customBreak} onChange={(e) => setCustomBreak(e.target.value)} />
            </label>
            <button
              type="button"
              className="button--primary"
              disabled={!Number(customFocus)}
              onClick={() => start(Number(customFocus), Number(customBreak) || 0)}
            >
              Start custom
            </button>
          </div>
          <label className="focus-link-row">
            Link assessment (optional)
            <select value={linkAssessment} onChange={(e) => setLinkAssessment(e.target.value)}>
              <option value="">—</option>
              {subject.assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title}
                </option>
              ))}
            </select>
          </label>
          <label className="focus-link-row">
            Link module (optional)
            <select value={linkModule} onChange={(e) => setLinkModule(e.target.value)}>
              <option value="">—</option>
              {subject.modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.moduleNumber}. {module.title}
                </option>
              ))}
            </select>
          </label>
          <p className="focus-panel-hint">No XP for opening Focus Mode — only real focused minutes count.</p>
        </div>
      ) : null}

      {!sessionElsewhere && view.kind === "running" && session ? (
        <div className="focus-panel-body">
          <div className="focus-clock" aria-live="polite">
            <span className="focus-clock-remaining">{formatClock(remainingSeconds)}</span>
            <span className="focus-clock-sub">
              elapsed {formatClock(elapsedSeconds)} of {formatClock(plannedSeconds)}
              {paused ? " · paused" : ""}
            </span>
          </div>
          <div className="focus-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((elapsedSeconds / plannedSeconds) * 100))}>
            <div
              className="focus-progress-fill"
              style={{ width: `${Math.min(100, (elapsedSeconds / plannedSeconds) * 100)}%` }}
            />
          </div>

          <div className="focus-link-grid">
            <label>
              Assessment
              <select
                value={session.assessmentId ?? ""}
                onChange={(e) => setFocusLinks({ assessmentId: e.target.value || null, moduleId: session.moduleId })}
              >
                <option value="">—</option>
                {subject.assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Module
              <select
                value={session.moduleId ?? ""}
                onChange={(e) => setFocusLinks({ assessmentId: session.assessmentId, moduleId: e.target.value || null })}
              >
                <option value="">—</option>
                {subject.modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.moduleNumber}. {module.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="focus-notes">
            Session notes
            <textarea
              rows={3}
              value={session.notes}
              onChange={(e) => setFocusNotes(e.target.value)}
              placeholder="Scratchpad — saved into the journal entry when you finish."
            />
          </label>

          <div className="focus-actions">
            {paused ? (
              <button
                type="button"
                onClick={() => {
                  resumeFocus();
                  emitSound("focus-resume");
                }}
              >
                <Play size={14} aria-hidden="true" /> Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  pauseFocus();
                  emitSound("focus-pause");
                }}
              >
                <Pause size={14} aria-hidden="true" /> Pause
              </button>
            )}
            <button type="button" onClick={() => finish("finished-early")}>
              <Square size={14} aria-hidden="true" /> Finish early
            </button>
            <button type="button" onClick={cancel}>
              Cancel session
            </button>
          </div>
        </div>
      ) : null}

      {!sessionElsewhere && view.kind === "wrapup" ? (
        <div className="focus-panel-body">
          <h3 className="focus-wrapup-title">
            {view.status === "completed" ? "Session complete!" : "Session finished early"}
          </h3>
          {view.outcome.xp ? (
            <ul className="focus-xp-breakdown">
              {view.outcome.xp.lines.map((line) => (
                <li key={line.label}>
                  <span>{line.label}</span>
                  <strong>{line.xp > 0 ? `+${line.xp} XP` : "0 XP"}</strong>
                </li>
              ))}
              <li className="focus-xp-total">
                <span>Total</span>
                <strong>+{view.outcome.xp.totalXp} XP</strong>
              </li>
            </ul>
          ) : null}
          {breakLeft !== null && breakLeft > 0 ? (
            <p className="focus-break-timer">
              <Coffee size={14} aria-hidden="true" /> Break: {formatClock(breakLeft)} left
            </p>
          ) : view.outcome.record && view.outcome.record.breakMinutesPlanned > 0 && breakLeft === null ? (
            <button type="button" onClick={() => setBreakLeft(view.outcome.record!.breakMinutesPlanned * 60)}>
              <Coffee size={14} aria-hidden="true" /> Start {view.outcome.record.breakMinutesPlanned}-minute break
            </button>
          ) : null}

          <p className="room-panel-lede">Add details to the journal entry (optional):</p>
          <label className="focus-notes">
            What did you complete?
            <textarea rows={2} value={wrap.completed} onChange={(e) => setWrap({ ...wrap, completed: e.target.value })} />
          </label>
          <label className="focus-notes">
            What was difficult?
            <textarea rows={2} value={wrap.difficulties} onChange={(e) => setWrap({ ...wrap, difficulties: e.target.value })} />
          </label>
          <label className="focus-notes">
            What will you do next?
            <textarea rows={2} value={wrap.nextPlan} onChange={(e) => setWrap({ ...wrap, nextPlan: e.target.value })} />
          </label>
          <label className="focus-notes">
            Extra notes
            <textarea rows={2} value={wrap.extraNotes} onChange={(e) => setWrap({ ...wrap, extraNotes: e.target.value })} />
          </label>
          <div className="focus-mood-row">
            <span>Mood before</span>
            <div>
              {MOODS.map((mood) => (
                <button
                  key={mood.value}
                  type="button"
                  aria-pressed={moodBefore === mood.value}
                  className={moodBefore === mood.value ? "focus-mood--active" : ""}
                  onClick={() => setMoodBefore(mood.value)}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>
          <div className="focus-mood-row">
            <span>Mood after</span>
            <div>
              {MOODS.map((mood) => (
                <button
                  key={mood.value}
                  type="button"
                  aria-pressed={moodAfter === mood.value}
                  className={moodAfter === mood.value ? "focus-mood--active" : ""}
                  onClick={() => setMoodAfter(mood.value)}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>
          <div className="focus-actions">
            <button type="button" className="button--primary" onClick={() => saveWrapUp(view.outcome)}>
              Save to journal
            </button>
          </div>
        </div>
      ) : null}

      {!sessionElsewhere && view.kind === "cancelled" ? (
        <div className="focus-panel-body">
          <p>Session cancelled — no XP awarded, nothing recorded in the journal.</p>
          <div className="focus-actions">
            <button type="button" onClick={() => setView({ kind: "setup" })}>
              Start again
            </button>
            <button type="button" onClick={onClose}>
              Stand up
            </button>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
