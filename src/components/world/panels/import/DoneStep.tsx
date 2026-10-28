/**
 * Step 6 — Done (Phase 18A, Part 10). Grounded, factual suggestions derived
 * straight from the save (never invented from the syllabus), plus a
 * genuinely optional personal-goals form kept distinct from anything the
 * import extracted — these are things only the user can decide.
 */

import { useState } from "react";
import { useSaveData } from "../../../../state/SaveDataContext";
import { getAcademicSuggestions } from "../../../../lib/academicSuggestions";

const STUDY_DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

export function DoneStep({ onClose }: { onClose: () => void }) {
  const { saveData, updatePersonalGoals } = useSaveData();
  const suggestions = getAcademicSuggestions(saveData);

  const [targetGrade, setTargetGrade] = useState(String(saveData.personalGoals.targetGrade ?? ""));
  const [weeklyHours, setWeeklyHours] = useState(String(saveData.personalGoals.weeklyStudyHours ?? ""));
  const [days, setDays] = useState<string[]>(saveData.personalGoals.preferredStudyDays);
  const [sprintCount, setSprintCount] = useState(String(saveData.personalGoals.desiredFocusSprintsPerWeek ?? ""));
  const [saved, setSaved] = useState(false);

  function toggleDay(day: string) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleSaveGoals() {
    updatePersonalGoals({
      targetGrade: targetGrade.trim() ? Number(targetGrade) : null,
      weeklyStudyHours: weeklyHours.trim() ? Number(weeklyHours) : null,
      preferredStudyDays: days,
      desiredFocusSprintsPerWeek: sprintCount.trim() ? Number(sprintCount) : null,
    });
    setSaved(true);
  }

  return (
    <div className="setup-step" data-testid="done-step">
      <p className="setup-lede">Your semester is set up. Here's what's next.</p>

      {suggestions.length > 0 ? (
        <ul className="setup-suggestion-list" data-testid="academic-suggestions">
          {suggestions.map((s) => (
            <li key={s.id}>{s.text}</li>
          ))}
        </ul>
      ) : null}

      <section className="setup-goals-form">
        <h3>Your own goals <span className="setup-optional">(optional — entirely up to you)</span></h3>
        <label>
          Target grade <span className="setup-optional">(%)</span>
          <input type="number" min={0} max={100} value={targetGrade} onChange={(e) => setTargetGrade(e.target.value)} placeholder="e.g. 80" />
        </label>
        <label>
          Weekly study hours
          <input type="number" min={0} value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} />
        </label>
        <label>
          Desired Focus Sprints per week
          <input type="number" min={0} value={sprintCount} onChange={(e) => setSprintCount(e.target.value)} />
        </label>
        <div className="setup-day-picker" role="group" aria-label="Preferred study days">
          {STUDY_DAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              className={days.includes(day.value) ? "is-active" : ""}
              onClick={() => toggleDay(day.value)}
              aria-pressed={days.includes(day.value)}
            >
              {day.label}
            </button>
          ))}
        </div>
        <button type="button" className="button--primary" onClick={handleSaveGoals}>
          {saved ? "Saved" : "Save my goals"}
        </button>
      </section>

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={onClose} data-testid="setup-finish">
          Done
        </button>
      </div>
    </div>
  );
}
