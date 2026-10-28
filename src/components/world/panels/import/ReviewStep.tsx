/**
 * Step 4 — Review & confirmation (Phase 18A, Part 8). Mandatory: nothing
 * reaches the live save without passing through here. Shows summary
 * metrics, lets the user map each subject candidate to one of the 4
 * existing, art-bound subjects (or explicitly exclude it — see
 * docs/PHASE_18A_IMPORT_ARCHITECTURE.md §1/§9), include/exclude/edit every
 * module and assessment, resolve conflicts one at a time, and add one fact
 * manually. "Continue to Apply" is disabled while any conflict among
 * INCLUDED items is unresolved — there is no one-click "import everything".
 */

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, MapPin } from "lucide-react";
import type { AcademicImportPackage, ImportedAssessmentCandidate, ImportedModuleCandidate } from "../../../../import/types";
import type { ImportSelection } from "../../../../import/applyImport";
import { validateForApply } from "../../../../import/applyImport";
import { resolveConflict, unresolvedConflictCount } from "../../../../import/merge/mergeEngine";
import { createManualCompletionProvider } from "../../../../import/providers/manualProvider";
import type { SubjectRecord } from "../../../../types/domain";

type Filter = "all" | "attention" | "subjects" | "assessments" | "modules" | "calendar" | "excluded";

/** Plain function call so TS's aliased-condition narrowing never locks `filter`'s type down at a call site. */
function isOneOf(value: Filter, options: Filter[]): boolean {
  return (options as string[]).includes(value);
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "subjects", label: "Subjects" },
  { id: "assessments", label: "Assessments" },
  { id: "modules", label: "Modules" },
  { id: "calendar", label: "Calendar" },
  { id: "excluded", label: "Excluded" },
];

export function ReviewStep({
  pkg,
  onPkgChange,
  selection,
  onSelectionChange,
  liveSubjects,
  onAddMoreSources,
  onSaveDraft,
  onCancel,
  onProceedToApply,
}: {
  pkg: AcademicImportPackage;
  onPkgChange: (pkg: AcademicImportPackage) => void;
  selection: ImportSelection;
  onSelectionChange: (selection: ImportSelection) => void;
  liveSubjects: SubjectRecord[];
  onAddMoreSources: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  onProceedToApply: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("attention");
  const [manualOpen, setManualOpen] = useState(false);

  const summary = pkg.extractionSummary;
  const unresolved = unresolvedConflictCount(pkg);
  const validation = useMemo(() => validateForApply(pkg, selection, liveSubjects), [pkg, selection, liveSubjects]);

  const isExcluded = (id: string) => selection.excludedIds.has(id);
  const toggleExcluded = (id: string) => {
    const next = new Set(selection.excludedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange({ ...selection, excludedIds: next });
  };
  const setMapping = (subjectTempId: string, subjectId: string | null) => {
    onSelectionChange({ ...selection, subjectMapping: { ...selection.subjectMapping, [subjectTempId]: subjectId } });
  };

  const editAssessment = (subjectTempId: string, assessmentTempId: string, patch: Partial<ImportedAssessmentCandidate>) => {
    onPkgChange({
      ...pkg,
      subjects: pkg.subjects.map((s) =>
        s.temporaryId !== subjectTempId
          ? s
          : {
              ...s,
              assessments: s.assessments.map((a) => (a.temporaryId === assessmentTempId ? { ...a, ...patch } : a)),
            }
      ),
    });
  };

  const handleResolve = (conflictId: string, label: string) => {
    onPkgChange(resolveConflict(pkg, conflictId, label));
  };

  const showSubjects = isOneOf(filter, ["all", "attention", "subjects", "excluded"]);
  const showCalendar = isOneOf(filter, ["all", "attention", "calendar", "excluded"]);

  return (
    <div className="setup-step setup-review" data-testid="review-step">
      <div className="setup-metrics" data-testid="review-metrics">
        <Metric label="Subjects" value={summary.subjectsFound} />
        <Metric label="Modules" value={summary.modulesFound} />
        <Metric label="Assessments" value={summary.assessmentsFound} />
        <Metric label="Confirmed deadlines" value={summary.confirmedDeadlines} />
        <Metric label="Uncertain deadlines" value={summary.uncertainDeadlines} />
        <Metric label="Calendar events" value={summary.calendarEventsFound} />
        <Metric label="Conflicts" value={unresolved} warn={unresolved > 0} />
        <Metric label="Missing fields" value={summary.missingFieldsCount} />
      </div>

      <div className="setup-filter-row" role="tablist" aria-label="Review filters">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? "is-active" : ""} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {pkg.warnings.length > 0 && (filter === "all" || filter === "attention") ? (
        <ul className="setup-warning-list">
          {pkg.warnings.map((w) => (
            <li key={w.id}>
              <AlertTriangle size={13} aria-hidden="true" /> {w.message}
            </li>
          ))}
        </ul>
      ) : null}

      {(filter === "all" || filter === "attention") && pkg.conflicts.length > 0 ? (
        <section className="setup-conflicts">
          <h3>Conflicts</h3>
          {pkg.conflicts
            .filter((c) => filter !== "attention" || c.resolution === null)
            .map((conflict) => (
              <div key={conflict.id} className="setup-conflict-card" data-testid="conflict-card">
                <p>{conflict.summary}</p>
                {conflict.resolution ? (
                  <p className="setup-conflict-resolved">Resolved: {conflict.resolution}</p>
                ) : (
                  <div className="setup-conflict-options">
                    {conflict.options.map((opt) => (
                      <button key={opt.label} type="button" onClick={() => handleResolve(conflict.id, opt.label)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </section>
      ) : null}

      {showSubjects
        ? pkg.subjects
            .filter((s) => (filter === "excluded" ? isExcluded(s.temporaryId) : true))
            .map((subject) => {
              const mapping = selection.subjectMapping[subject.temporaryId];
              const excluded = isExcluded(subject.temporaryId);
              return (
                <section key={subject.temporaryId} className={`setup-subject-card${excluded ? " is-excluded" : ""}`} data-testid="subject-candidate">
                  <header>
                    <ConfidenceDot level={subject.confidence} />
                    <strong>{subject.name}</strong>
                    {subject.code ? <span className="setup-subject-code">{subject.code}</span> : null}
                  </header>

                  <label className="setup-mapping-row">
                    Match to
                    <select
                      value={mapping ?? ""}
                      onChange={(e) => setMapping(subject.temporaryId, e.target.value || null)}
                      disabled={excluded}
                    >
                      <option value="">Choose a subject…</option>
                      {liveSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => toggleExcluded(subject.temporaryId)}>
                      {excluded ? "Include" : "Exclude"}
                    </button>
                  </label>
                  {!mapping && !excluded ? (
                    <p className="setup-hint">
                      No room exists for a subject that isn't one of your four — match it above, or exclude it.
                    </p>
                  ) : null}

                  {!excluded && ((filter as Filter) === "all" || (filter as Filter) === "attention" || filter === "modules")
                    ? subject.modules.map((m) => (
                        <ModuleRow
                          key={m.temporaryId}
                          module={m}
                          excluded={isExcluded(m.temporaryId)}
                          onToggle={() => toggleExcluded(m.temporaryId)}
                          isItemExcluded={isExcluded}
                          onToggleItem={toggleExcluded}
                        />
                      ))
                    : null}

                  {!excluded && ((filter as Filter) === "all" || (filter as Filter) === "attention" || filter === "assessments")
                    ? subject.assessments.map((a) => (
                        <AssessmentRow
                          key={a.temporaryId}
                          assessment={a}
                          excluded={isExcluded(a.temporaryId)}
                          onToggle={() => toggleExcluded(a.temporaryId)}
                          onEdit={(patch) => editAssessment(subject.temporaryId, a.temporaryId, patch)}
                        />
                      ))
                    : null}
                </section>
              );
            })
        : null}

      {showCalendar && pkg.calendarEvents.length > 0 ? (
        <section className="setup-subject-card">
          <header>
            <strong>Calendar events</strong>
          </header>
          {pkg.calendarEvents
            .filter((e) => (filter === "excluded" ? isExcluded(e.temporaryId) : true))
            .map((event) => (
              <label key={event.temporaryId} className="setup-item-row">
                <input type="checkbox" checked={!isExcluded(event.temporaryId)} onChange={() => toggleExcluded(event.temporaryId)} />
                <span className="setup-item-title">{event.title}</span>
                <span className="setup-item-meta">{event.start.rawText}</span>
              </label>
            ))}
        </section>
      ) : null}

      <section className="setup-manual">
        <button type="button" className="setup-manual-toggle" onClick={() => setManualOpen((v) => !v)}>
          <ChevronDown size={14} aria-hidden="true" className={manualOpen ? "rot" : ""} /> Add one detail manually
        </button>
        {manualOpen ? <ManualEntryForm liveSubjects={liveSubjects} onAdd={(next) => onPkgChange(next)} pkg={pkg} /> : null}
      </section>

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={onProceedToApply} disabled={!validation.ok}>
          Continue to Apply
        </button>
        <button type="button" onClick={onAddMoreSources}>
          <MapPin size={14} aria-hidden="true" /> Upload another source
        </button>
        <button type="button" onClick={onSaveDraft}>
          Save draft
        </button>
        <button type="button" onClick={onCancel}>
          Cancel import
        </button>
      </div>
      {!validation.ok ? (
        <ul className="setup-validation-issues" data-testid="apply-issues">
          {validation.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`setup-metric${warn && value > 0 ? " is-warn" : ""}`}>
      <span className="setup-metric-value">{value}</span>
      <span className="setup-metric-label">{label}</span>
    </div>
  );
}

function ConfidenceDot({ level }: { level: string }) {
  const color =
    level === "confirmed" || level === "high"
      ? "#2ed17e"
      : level === "medium"
        ? "#ffb238"
        : level === "conflicting"
          ? "#ff6b6b"
          : "#6b7690";
  return <span className="setup-confidence-dot" style={{ background: color }} title={`Confidence: ${level}`} aria-hidden="true" />;
}

/**
 * Phase 19, Part 10: readings/schedule/outcomes are shown as an expandable,
 * per-item Accept/Reject list — reusing the exact same `excludedIds`
 * mechanism every other candidate type already uses (Part 9's "manual
 * override flag" applies once these reach the live save, not here; Review
 * itself only ever needs include/exclude per item, same as modules/
 * assessments/calendar events).
 */
function ModuleRow({
  module,
  excluded,
  onToggle,
  isItemExcluded,
  onToggleItem,
}: {
  module: ImportedModuleCandidate;
  excluded: boolean;
  onToggle: () => void;
  isItemExcluded: (id: string) => boolean;
  onToggleItem: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const readings = module.structuredReadings ?? [];
  const schedule = module.schedule ?? [];
  const outcomes = module.outcomes ?? [];
  const enrichmentCount = readings.length + schedule.length + outcomes.length;

  return (
    <div className="setup-item-row-group" data-testid="module-candidate">
      <label className="setup-item-row">
        <input type="checkbox" checked={!excluded} onChange={onToggle} />
        <ConfidenceDot level={module.confidence} />
        <span className="setup-item-title">
          {module.weekNumber ? `Week ${module.weekNumber}: ` : ""}
          {module.title}
        </span>
        {enrichmentCount > 0 ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} data-testid="module-enrichment-toggle">
            {readings.length > 0 ? `${readings.length} reading${readings.length === 1 ? "" : "s"}` : ""}
            {schedule.length > 0 ? ` · ${schedule.length} schedule` : ""}
            {outcomes.length > 0 ? ` · ${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"}` : ""}
            <ChevronDown size={12} aria-hidden="true" className={expanded ? "rot" : ""} />
          </button>
        ) : null}
      </label>
      {expanded ? (
        <div className="setup-module-enrichment" data-testid="module-enrichment-list">
          {readings.map((r) => (
            <label key={r.temporaryId} className="setup-item-row setup-item-row--nested">
              <input type="checkbox" checked={!isItemExcluded(r.temporaryId)} onChange={() => onToggleItem(r.temporaryId)} />
              <span className="setup-item-title">{r.kind === "required" ? "Required: " : "Recommended: "}{r.title}</span>
            </label>
          ))}
          {schedule.map((s) => (
            <label key={s.temporaryId} className="setup-item-row setup-item-row--nested">
              <input type="checkbox" checked={!isItemExcluded(s.temporaryId)} onChange={() => onToggleItem(s.temporaryId)} />
              <span className="setup-item-title">
                {s.kind}: {s.title}
                {s.dayOfWeek ? ` (${s.dayOfWeek}${s.startTime ? ` ${s.startTime}` : ""})` : ""}
              </span>
            </label>
          ))}
          {outcomes.map((o) => (
            <label key={o.temporaryId} className="setup-item-row setup-item-row--nested">
              <input type="checkbox" checked={!isItemExcluded(o.temporaryId)} onChange={() => onToggleItem(o.temporaryId)} />
              <span className="setup-item-title">{o.code ? `${o.code}: ` : ""}{o.text}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssessmentRow({
  assessment,
  excluded,
  onToggle,
  onEdit,
}: {
  assessment: ImportedAssessmentCandidate;
  excluded: boolean;
  onToggle: () => void;
  onEdit: (patch: Partial<ImportedAssessmentCandidate>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const conflicting = assessment.fieldConfidence.dueDate === "conflicting" || assessment.fieldConfidence.weighting === "conflicting";

  return (
    <div className={`setup-item-row setup-item-row--assessment${conflicting ? " is-conflicting" : ""}`} data-testid="assessment-candidate">
      <label>
        <input type="checkbox" checked={!excluded} onChange={onToggle} />
        <ConfidenceDot level={assessment.confidence} />
        <span className="setup-item-title">{assessment.title}</span>
      </label>
      <span className="setup-item-meta">
        {assessment.weighting !== null ? `${assessment.weighting}%` : "weight unknown"} ·{" "}
        {assessment.due?.rawText ?? "no date found"}
        {assessment.type === "exam" && assessment.examInfo ? ` · ${assessment.examInfo}` : ""}
      </span>
      <button type="button" onClick={() => setEditing((v) => !v)}>
        Edit
      </button>
      {editing ? (
        <div className="setup-edit-row">
          <label>
            Weighting %
            <input
              type="number"
              min={0}
              max={100}
              value={assessment.weighting ?? ""}
              onChange={(e) => onEdit({ weighting: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={assessment.due?.isoDate ?? ""}
              onChange={(e) =>
                onEdit({
                  due: {
                    rawText: e.target.value,
                    isoDate: e.target.value || null,
                    isoTime: assessment.due?.isoTime ?? null,
                    sourceTimezone: assessment.due?.sourceTimezone ?? null,
                    weekNumber: null,
                    dateKind: e.target.value ? "exact" : "missing",
                  },
                })
              }
            />
          </label>
          <label>
            Due time
            <input
              type="time"
              value={assessment.due?.isoTime ?? ""}
              onChange={(e) =>
                onEdit({
                  due: assessment.due
                    ? { ...assessment.due, isoTime: e.target.value || null }
                    : { rawText: "", isoDate: null, isoTime: e.target.value || null, sourceTimezone: null, weekNumber: null, dateKind: "missing" },
                })
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function ManualEntryForm({
  liveSubjects,
  pkg,
  onAdd,
}: {
  liveSubjects: SubjectRecord[];
  pkg: AcademicImportPackage;
  onAdd: (next: AcademicImportPackage) => void;
}) {
  const [subjectId, setSubjectId] = useState(liveSubjects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [weighting, setWeighting] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  async function submit() {
    if (!title.trim()) return;
    const subject = liveSubjects.find((s) => s.id === subjectId);
    const provider = createManualCompletionProvider();
    const payload = {
      subjectCode: subject?.code.value ?? null,
      subjectName: subject?.name ?? null,
      assessmentTitle: title.trim(),
      weighting: weighting ? Number(weighting) : null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      submissionMethod: null,
    };
    const result = await provider.extract(
      { sourceId: `manual-${Date.now()}`, filename: "Manual entry", kind: "json", bytes: null, text: JSON.stringify(payload) },
      { signal: new AbortController().signal, onProgress: () => {} }
    );
    const [manualSubject] = result.subjects;
    if (subject) {
      // Attach directly to the matched live subject's mapping by re-using its temporaryId if already present.
      const existing = pkg.subjects.find((s) => s.name === manualSubject.name);
      if (existing) {
        onAdd({
          ...pkg,
          subjects: pkg.subjects.map((s) => (s === existing ? { ...s, assessments: [...s.assessments, ...manualSubject.assessments] } : s)),
        });
      } else {
        onAdd({ ...pkg, subjects: [...pkg.subjects, manualSubject] });
      }
    } else {
      onAdd({ ...pkg, subjects: [...pkg.subjects, manualSubject] });
    }
    setTitle("");
    setWeighting("");
    setDueDate("");
    setDueTime("");
  }

  return (
    <div className="setup-manual-form">
      <label>
        Subject
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {liveSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Assessment title
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Weighting %
        <input type="number" min={0} max={100} value={weighting} onChange={(e) => setWeighting(e.target.value)} />
      </label>
      <label>
        Due date
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label>
        Due time
        <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
      </label>
      <button type="button" className="button--primary" onClick={() => void submit()} disabled={!title.trim()}>
        Add
      </button>
    </div>
  );
}
