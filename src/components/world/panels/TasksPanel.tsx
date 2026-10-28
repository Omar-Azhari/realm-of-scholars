/**
 * Tasks panel (Phase 15B) — the main place to decide what to do next.
 * Three sections only: Next (the single top recommendation, highlighted) ·
 * Upcoming · Completed, with a compact subject filter. A card shows just
 * title / subject / due / state; selecting it reveals details and the four
 * actions Track · Locate · Start · Complete. All data derives from existing
 * selectors.
 */

import { useMemo, useState } from "react";
import { MapPin, Timer, Crosshair, Check } from "lucide-react";
import { useSaveData } from "../../../state/SaveDataContext";
import { useWorldUi } from "../../../world/WorldUiContext";
import { getTopPriorityItems, getPriorityItemId, type PriorityItem } from "../../../lib/priority";
import { isModuleCompleted } from "../../../lib/selectors";
import { getSubjectAccentVar } from "../../../lib/subjectTheme";

export function TasksPanel() {
  const { saveData, toggleModuleCompletion, setAssessmentProgressStatus } = useSaveData();
  const { locateInWorld, trackObjective, requestFocus, objective } = useWorldUi();
  const subjects = saveData.semester.subjects;
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const shown = (subjectId: string) => filter === null || filter === subjectId;

  const ranked = useMemo(
    () => getTopPriorityItems(subjects, saveData.tasks, new Date(), 40, saveData.settings.pinnedPriorityIds),
    [subjects, saveData.tasks, saveData.settings.pinnedPriorityIds]
  );
  const visible = ranked.filter((i) => shown(i.subject.id));
  const next = visible[0] ?? null;
  const upcoming = visible.slice(1);
  const completed = subjects
    .filter((s) => shown(s.id))
    .flatMap((s) => s.modules.filter((m) => isModuleCompleted(saveData.tasks, m.id)).map((m) => ({ subject: s, module: m })));

  const dueLabel = (item: PriorityItem) =>
    item.type === "assessment" ? item.assessment.dueWindowRaw : "Module";

  const complete = (item: PriorityItem) => {
    if (item.type === "module") toggleModuleCompletion(item.module.id);
    else setAssessmentProgressStatus(item.assessment.id, "submitted");
  };

  const card = (item: PriorityItem, highlight = false) => {
    const id = getPriorityItemId(item);
    const title = item.type === "module" ? item.module.title : item.assessment.title;
    const isSel = selected === id;
    const tracked = objective?.subjectId === item.subject.id && objective?.title === title;
    return (
      <li key={id} className={`task-card${highlight ? " task-card--next" : ""}`} data-selected={isSel || undefined}>
        <button type="button" className="task-card-main" onClick={() => setSelected(isSel ? null : id)} aria-expanded={isSel}>
          <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(item.subject.id)})` }} />
          <span className="task-card-text">
            <span className="task-card-title">{title}</span>
            <span className="task-card-sub">
              {item.subject.code.value ?? item.subject.name} · {dueLabel(item)}
            </span>
          </span>
          {tracked ? <Crosshair size={14} aria-hidden="true" className="task-card-tracked" /> : null}
        </button>
        {isSel ? (
          <div className="task-card-detail">
            <p className="task-card-detailmeta">
              {item.subject.name}
              {item.type === "assessment" ? ` · due ${item.assessment.dueWindowRaw}` : " · module"}
            </p>
            <div className="task-card-actions">
              <button type="button" onClick={() => trackObjective({ title, subjectId: item.subject.id, sceneId: `room-${item.subject.id}`, interactableId: item.type === "assessment" ? "assessments" : "modules" })}>
                <Crosshair size={14} aria-hidden="true" /> Track
              </button>
              <button type="button" onClick={() => locateInWorld({ title, subjectId: item.subject.id, sceneId: `room-${item.subject.id}`, interactableId: item.type === "assessment" ? "assessments" : "modules" })}>
                <MapPin size={14} aria-hidden="true" /> Locate
              </button>
              <button type="button" onClick={() => requestFocus(item.subject.id)}>
                <Timer size={14} aria-hidden="true" /> Start
              </button>
              <button type="button" onClick={() => complete(item)}>
                <Check size={14} aria-hidden="true" /> Complete
              </button>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="tasks-panel">
      <div className="tasks-filter" role="group" aria-label="Filter by subject">
        <button type="button" aria-pressed={filter === null} className={filter === null ? "is-active" : ""} onClick={() => setFilter(null)}>
          All
        </button>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={filter === s.id}
            className={filter === s.id ? "is-active" : ""}
            onClick={() => setFilter(filter === s.id ? null : s.id)}
            title={s.name}
          >
            <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(s.id)})` }} />
            {s.code.value ?? s.name}
          </button>
        ))}
      </div>

      <section className="tasks-section">
        <h3 className="tasks-section-title">Next</h3>
        {next ? <ul className="tasks-list">{card(next, true)}</ul> : <p className="tasks-empty">Nothing outstanding — you're all caught up.</p>}
      </section>

      <section className="tasks-section">
        <h3 className="tasks-section-title">
          Upcoming <span className="tasks-section-count">{upcoming.length}</span>
        </h3>
        {upcoming.length > 0 ? <ul className="tasks-list">{upcoming.map((i) => card(i))}</ul> : <p className="tasks-empty">Nothing else queued.</p>}
      </section>

      <section className="tasks-section">
        <h3 className="tasks-section-title">
          Completed <span className="tasks-section-count">{completed.length}</span>
        </h3>
        {completed.length > 0 ? (
          <ul className="tasks-list">
            {completed.slice(0, 30).map(({ subject, module }) => (
              <li key={module.id} className="task-card task-card--done">
                <span className="task-card-main task-card-main--static">
                  <span className="tasks-dot" style={{ background: `var(${getSubjectAccentVar(subject.id)})` }} />
                  <span className="task-card-text">
                    <span className="task-card-title">{module.title}</span>
                  </span>
                  <Check size={14} aria-hidden="true" />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tasks-empty">Nothing completed yet.</p>
        )}
      </section>
    </div>
  );
}
