/** Review/edit one researched subject before the realm is forged. */

import { useState } from "react";
import { confidenceLabel } from "../hud/SidePanel";
import { defaultQuestSteps } from "../curriculum/normalize";
import { THEME_STYLES } from "../world/themes";
import type { RealmAssessment, RealmAssessmentKind, RealmSubject, RealmWeek } from "../types";
import { Icon, themeIcon } from "../hud/icons";

const KINDS: RealmAssessmentKind[] = ["exam", "quiz", "essay", "report", "project", "presentation", "lab", "participation", "other"];

function weeksToText(weeks: RealmWeek[]): string {
  return weeks.map((w) => `Week ${w.week}: ${w.title}`).join("\n");
}

function textToWeeks(text: string, previous: RealmWeek[]): RealmWeek[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const used = new Set<number>();
  return lines.slice(0, 16).map((line, i) => {
    const match = /^week\s*(\d{1,2})\s*[:.\-–—]?\s*(.*)$/i.exec(line);
    let week = match ? Number(match[1]) : i + 1;
    while (used.has(week)) week++;
    used.add(week);
    const title = (match ? match[2] : line).trim() || `Week ${week}`;
    const old = previous.find((w) => w.week === week && w.title === title);
    return old ?? { week, title, topics: [], summary: "" };
  });
}

export function SubjectEditor({ subject, onChange, onRemove }: { subject: RealmSubject; onChange: (s: RealmSubject) => void; onRemove: () => void }) {
  const [weeksText, setWeeksText] = useState(() => weeksToText(subject.weeks));
  const [open, setOpen] = useState(subject.weeks.length === 0 && subject.assessments.length === 0);

  const updateAssessment = (index: number, patch: Partial<RealmAssessment>) => {
    const assessments = subject.assessments.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onChange({ ...subject, assessments });
  };

  const addAssessment = () => {
    const kind: RealmAssessmentKind = "project";
    const title = `Assessment ${subject.assessments.length + 1}`;
    onChange({
      ...subject,
      assessments: [
        ...subject.assessments,
        { id: `${subject.id}-a${Date.now()}`, title, kind, weightPercent: null, dueWeek: null, dueDate: null, description: "", steps: defaultQuestSteps(kind, title) },
      ],
    });
  };

  const totalWeight = subject.assessments.reduce((sum, a) => sum + (a.weightPercent ?? 0), 0);

  return (
    <article className="subject-card" style={{ ["--accent" as string]: THEME_STYLES[subject.theme].accent }}>
      <header>
        <span className="subject-icon" aria-hidden="true">
          <Icon name={themeIcon(subject.theme)} />
        </span>
        <div className="subject-names">
          <input value={subject.code} onChange={(e) => onChange({ ...subject, code: e.target.value })} placeholder="Code" aria-label="Subject code" className="code" />
          <input value={subject.name} onChange={(e) => onChange({ ...subject, name: e.target.value })} placeholder="Subject name" aria-label="Subject name" />
        </div>
        <span className={`badge ${subject.confidence}`}>{confidenceLabel(subject.confidence)}</span>
      </header>
      <p className="subject-stats">
        {subject.weeks.length} weeks · {subject.assessments.length} quests{totalWeight ? ` (${totalWeight}% weighted)` : ""} · {subject.keyTerms.length} key terms · {subject.questions.length} practice questions
      </p>
      {totalWeight > 0 && totalWeight !== 100 ? (
        <p className="weight-warning">
          <Icon name="warning" /> The weightings add up to {totalWeight}%, not 100%.{" "}
          {totalWeight > 100
            ? "One may be listed twice (for example a project total alongside its parts). Check them against your Subject Learning Guide."
            : "Some are missing. Add them from your Subject Learning Guide, or later in the library's Grades window."}
        </p>
      ) : null}
      {subject.sourceNote ? <p className="note">{subject.sourceNote}</p> : null}
      {subject.sourceUrls.length ? (
        <details className="sources">
          <summary>{subject.sourceUrls.length} source{subject.sourceUrls.length === 1 ? "" : "s"}</summary>
          <ul>
            {subject.sourceUrls.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer noopener">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <button type="button" className="link" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide details" : "Edit weeks & quests"}
      </button>
      {open ? (
        <div className="subject-edit">
          <label className="field">
            <span>Weekly path, one week per line (e.g. “Week 3: Sorting algorithms”)</span>
            <textarea
              rows={8}
              value={weeksText}
              onChange={(e) => setWeeksText(e.target.value)}
              onBlur={() => onChange({ ...subject, weeks: textToWeeks(weeksText, subject.weeks) })}
            />
          </label>
          <div className="field">
            <span>Quests (assessments)</span>
            {subject.assessments.map((a, i) => (
              <div key={a.id} className="assessment-row">
                <input value={a.title} onChange={(e) => updateAssessment(i, { title: e.target.value })} aria-label="Assessment title" />
                <select value={a.kind} onChange={(e) => updateAssessment(i, { kind: e.target.value as RealmAssessmentKind })} aria-label="Type">
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={a.weightPercent ?? ""}
                  placeholder="%"
                  onChange={(e) => updateAssessment(i, { weightPercent: e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) })}
                  aria-label="Weight percent"
                  className="small"
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={a.dueWeek ?? ""}
                  placeholder="Wk"
                  onChange={(e) => updateAssessment(i, { dueWeek: e.target.value === "" ? null : Number(e.target.value) })}
                  aria-label="Due week"
                  className="small"
                />
                <button type="button" className="icon-btn" onClick={() => onChange({ ...subject, assessments: subject.assessments.filter((_, j) => j !== i) })} aria-label="Remove assessment">
                  <Icon name="close" />
                </button>
              </div>
            ))}
            <button type="button" className="link" onClick={addAssessment}>
              + Add assessment
            </button>
          </div>
          <button type="button" className="link danger" onClick={onRemove}>
            Remove this subject
          </button>
        </div>
      ) : null}
    </article>
  );
}
