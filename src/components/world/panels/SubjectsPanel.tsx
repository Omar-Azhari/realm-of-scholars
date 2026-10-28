/**
 * Subjects panel (Phase 15B) — four clear entries (name, colour, progress,
 * next deadline, Enter/Locate). Opening a subject reveals three sections:
 * Overview · Modules · Resources. Assessments link back to Tasks rather than
 * re-listing every task here (no duplicated task management). A schematic
 * campus map (also the minimap's target) sits at the top of the list.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, MapPin, ArrowLeft, BookOpen, ListChecks, Gamepad2, Link2, ClipboardList, Search, CalendarDays, GraduationCap } from "lucide-react";
import { useSaveData } from "../../../state/SaveDataContext";
import { useWorldUi } from "../../../world/WorldUiContext";
import {
  getSubjectProgressPercent,
  getSubjectCompletedModuleCount,
  getUpcomingDeadlines,
  isModuleCompleted,
} from "../../../lib/selectors";
import { getSubjectAccentVar } from "../../../lib/subjectTheme";
import { searchAcademicContent } from "../../../lib/academicSearch";
import { CampusMap } from "../CampusMap";
import type { SubjectRecord } from "../../../types/domain";

type Section = "overview" | "modules" | "resources";

export function SubjectsPanel() {
  const { saveData } = useSaveData();
  const { closePanel, locateInWorld, panelSubjectId, panelSection, openPanelFor } = useWorldUi();
  const navigate = useNavigate();
  const subjects = saveData.semester.subjects;

  const [openId, setOpenId] = useState<string | null>(panelSubjectId ?? null);
  const [section, setSection] = useState<Section>((panelSection as Section) || "overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Re-sync when a room object deep-opens this panel at a subject/section.
  useEffect(() => {
    if (panelSubjectId) setOpenId(panelSubjectId);
    if (panelSection === "resources" || panelSection === "overview") setSection(panelSection);
  }, [panelSubjectId, panelSection]);

  const openSubject = openId ? subjects.find((s) => s.id === openId) : null;

  if (openSubject) {
    return (
      <SubjectDetail
        subject={openSubject}
        section={section}
        setSection={setSection}
        onBack={() => setOpenId(null)}
        onEnter={() => {
          closePanel();
          navigate(`/subjects/${openSubject.id}`, { state: { via: "door" } });
        }}
        onViewTasks={() => openPanelFor("tasks", openSubject.id)}
      />
    );
  }

  const searchResults = searchAcademicContent(saveData.semester, searchQuery);

  return (
    <div className="subjects-panel">
      <label className="subjects-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search modules, assessments, readings, lectures…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search academic content"
        />
      </label>
      {searchQuery.trim() ? (
        <ul className="subjects-search-results" data-testid="academic-search-results">
          {searchResults.length === 0 ? <li className="subjects-search-empty">No matches.</li> : null}
          {searchResults.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <span className="subjects-search-kind">{r.kind}</span>
              <span className="setup-item-title">{r.title}</span>
              <span className="setup-item-meta">
                {r.subjectName} · {r.detail}
              </span>
              <button type="button" onClick={() => locateInWorld(r.locate)}>
                <MapPin size={13} aria-hidden="true" /> Locate
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <CampusMap
            onSelect={(subjectId) => {
              closePanel();
              navigate(`/subjects/${subjectId}`, { state: { via: "door" } });
            }}
          />
          <div className="subjects-grid">
        {subjects.map((subject) => {
          const percent = getSubjectProgressPercent(saveData.tasks, subject);
          const next = getUpcomingDeadlines([subject])[0];
          const accent = `var(${getSubjectAccentVar(subject.id)})`;
          return (
            <article key={subject.id} className="subject-card" style={{ ["--card-accent" as string]: accent }}>
              <button
                type="button"
                className="subject-card-open"
                onClick={() => {
                  setSection("overview");
                  setOpenId(subject.id);
                }}
              >
                <span className="subject-card-dot" style={{ background: accent }} />
                <span className="subject-card-headtext">
                  <span className="subject-card-name">{subject.name}</span>
                  <span className="subject-card-mentor">{subject.characterConcept}</span>
                </span>
              </button>
              <div className="subject-card-bar" aria-hidden="true">
                <span style={{ width: `${percent}%`, background: accent }} />
              </div>
              <p className="subject-card-meta">
                {percent}% · Next: {next ? next.assessment.title : "nothing scheduled"}
              </p>
              <div className="subject-card-actions">
                <button
                  type="button"
                  className="button--primary"
                  onClick={() => {
                    closePanel();
                    navigate(`/subjects/${subject.id}`, { state: { via: "door" } });
                  }}
                >
                  <DoorOpen size={14} aria-hidden="true" /> Enter
                </button>
                <button
                  type="button"
                  onClick={() =>
                    locateInWorld({
                      title: `${subject.name} room`,
                      subjectId: subject.id,
                      sceneId: `room-${subject.id}`,
                      interactableId: next ? "assessments" : "modules",
                    })
                  }
                >
                  <MapPin size={14} aria-hidden="true" /> Locate
                </button>
              </div>
            </article>
          );
        })}
          </div>
        </>
      )}
    </div>
  );
}

function SubjectDetail({
  subject,
  section,
  setSection,
  onBack,
  onEnter,
  onViewTasks,
}: {
  subject: SubjectRecord;
  section: Section;
  setSection: (s: Section) => void;
  onBack: () => void;
  onEnter: () => void;
  onViewTasks: () => void;
}) {
  const { saveData } = useSaveData();
  const percent = getSubjectProgressPercent(saveData.tasks, subject);
  const done = getSubjectCompletedModuleCount(saveData.tasks, subject);
  const next = getUpcomingDeadlines([subject])[0];
  const currentModule = subject.modules.find((m) => !isModuleCompleted(saveData.tasks, m.id));
  const accent = `var(${getSubjectAccentVar(subject.id)})`;
  const links = saveData.assessmentProgress
    .filter((p) => subject.assessments.some((a) => a.id === p.assessmentId))
    .flatMap((p) => p.links);

  return (
    <div className="subject-detail" style={{ ["--card-accent" as string]: accent }}>
      <button type="button" className="menu-back" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true" /> Subjects
      </button>
      <header className="subject-detail-head">
        <span className="subject-card-dot" style={{ background: accent }} />
        <h3>{subject.name}</h3>
      </header>

      <div className="subject-sections" role="tablist" aria-label="Subject sections">
        {(["overview", "modules", "resources"] as Section[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} className={section === s ? "is-active" : ""} onClick={() => setSection(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {section === "overview" ? (
        <div className="subject-overview">
          <div className="subject-card-bar" aria-hidden="true">
            <span style={{ width: `${percent}%`, background: accent }} />
          </div>
          <p className="subject-card-meta">
            {done}/{subject.modules.length} modules · {percent}%
          </p>
          <p className="subject-card-meta">Mentor: {subject.characterConcept}</p>
          <p className="subject-card-meta">Current: {currentModule ? currentModule.title : "All modules complete 🎓"}</p>
          <p className="subject-card-meta">Next due: {next ? `${next.assessment.title} — ${next.assessment.dueWindowRaw}` : "nothing scheduled"}</p>
          <div className="subject-card-actions">
            <button type="button" className="button--primary" onClick={onEnter}>
              <DoorOpen size={14} aria-hidden="true" /> Enter Room
            </button>
            <button type="button" onClick={onViewTasks}>
              <ClipboardList size={14} aria-hidden="true" /> Assessments in Tasks
            </button>
          </div>
        </div>
      ) : null}

      {section === "modules" ? (
        <ul className="subject-modules">
          {subject.modules.map((m) => {
            const complete = isModuleCompleted(saveData.tasks, m.id);
            return (
              <li key={m.id} data-done={complete || undefined}>
                <span className="subject-module-num">{m.moduleNumber}</span>
                <span className="subject-module-title">{m.title}</span>
                <span className="subject-module-state">{complete ? "Done" : ""}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {section === "resources" ? (
        <div className="subject-resources">
          {subject.modules.map((m) => (
            <details key={m.id} className="resources-module">
              <summary>
                <BookOpen size={14} aria-hidden="true" /> {m.moduleNumber}. {m.title}
              </summary>
              <div className="resources-module-body">
                <p className="resources-overview">{m.overview}</p>
                {m.suggestedTasks.length > 0 ? (
                  <div className="resources-group">
                    <h5>
                      <ListChecks size={13} aria-hidden="true" /> Activities
                    </h5>
                    <ul>
                      {m.suggestedTasks.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.miniGameIdeas.length > 0 ? (
                  <div className="resources-group">
                    <h5>
                      <Gamepad2 size={13} aria-hidden="true" /> Practice ideas
                    </h5>
                    <ul>
                      {m.miniGameIdeas.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.readings.length > 0 ? (
                  <div className="resources-group">
                    <h5>
                      <BookOpen size={13} aria-hidden="true" /> Readings
                    </h5>
                    <ul>
                      {m.readings.map((r) => (
                        <li key={r.id}>
                          {r.kind === "required" ? "Required: " : "Recommended: "}
                          {r.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.schedule.length > 0 ? (
                  <div className="resources-group">
                    <h5>
                      <CalendarDays size={13} aria-hidden="true" /> Schedule
                    </h5>
                    <ul>
                      {m.schedule.map((s) => (
                        <li key={s.id}>
                          {s.kind[0].toUpperCase() + s.kind.slice(1)}: {s.title}
                          {s.dayOfWeek ? ` (${s.dayOfWeek}${s.startTime ? ` ${s.startTime}` : ""})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.outcomes.length > 0 ? (
                  <div className="resources-group">
                    <h5>
                      <GraduationCap size={13} aria-hidden="true" /> Learning outcomes
                    </h5>
                    <ul>
                      {m.outcomes.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
          {links.length > 0 ? (
            <div className="resources-links">
              <h5>
                <Link2 size={13} aria-hidden="true" /> Saved links
              </h5>
              <ul>
                {links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener">
                      {l.label || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
