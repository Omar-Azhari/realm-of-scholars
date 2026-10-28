/**
 * Enrolment: create your adventurer, tell the realm where and what you
 * study, then the archivists gather each subject's curriculum and forge
 * your world from it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CharacterCreator } from "../customise/CharacterCreator";
import { defaultAppearance } from "../customise/humans";
import { EnrolBackdrop } from "./EnrolBackdrop";
import { CreditsPanel, MenuFooter, MenuList, Wordmark } from "./MainMenu";
import { Icon } from "../hud/icons";
import type { AvatarId } from "../scene/models";
import { SubjectEditor } from "./SubjectEditor";
import { CoursePicker } from "./CoursePicker";
import { UNIVERSITY_DIRECTORY, citiesFor, teachingPeriodsFor, universitiesFor } from "../curriculum/universities";
import { checkResearchAvailable, CurriculumFetchError, extractDocumentText, fetchSubjectCurriculum } from "../curriculum/curriculumClient";
import { dedupeSubjectIds, normalizeSubject, pickTheme } from "../curriculum/normalize";
import { enrichWithBank } from "../curriculum/enrich";
import { laTrobeDatesFor, withLaTrobeDates } from "../curriculum/latrobeCalendar";
import { parseOutlineText } from "../curriculum/localOutlineParser";
import { LA_TROBE, defaultLaTrobePeriod, isLaTrobeName, laTrobeHandbookUrl, loadSavedLaTrobeSemester, type SavedLaTrobeSemester } from "../curriculum/latrobe";
import { setCurriculum, setPlayer } from "../state/actions";
import type { Appearance, CurriculumConfidence, Enrolment as EnrolmentData, PlayerLook, RealmPlayer, RealmSubject, RegionTheme } from "../types";

type Step = "title" | "character" | "where" | "course" | "subjects" | "summon" | "review";

const SKINS = ["#f6d5b8", "#eabf98", "#d8a47a", "#b98258", "#8d5a36", "#5e3a22"];
const HAIRS = ["#1d1410", "#4a2e1a", "#8a5a2a", "#c98a3a", "#e3c27a", "#a83a1f", "#d9d9d9", "#3a3a6a"];
const TUNICS = ["#7a1f2b", "#1f3f7a", "#2f6a2a", "#6a4a1a", "#4a2a6a", "#1f6a6a", "#8a6a1a", "#3a3a3a"];
const LEGS = ["#3a2a1c", "#2a2a2a", "#4a3a2a", "#2a3a5a", "#5a4a3a", "#3a4a2a"];
const CAPES = ["#8a1f2b", "#1f3f8a", "#2f7a2a", "#d4a52c", "#5a1f8a", "#1a1a1a", "#e8e2d4", "#c4501f"];

const YEAR_LEVELS = ["First year", "Second year", "Third year", "Fourth year", "Honours", "Masters", "PhD", "Other"];

interface SubjectDraft {
  key: number;
  code: string;
  name: string;
  file: File | null;
}

interface SummonState {
  status: "waiting" | "working" | "done" | "error";
  message: string;
  subject: RealmSubject | null;
  warnings: string[];
}

interface EnrolmentProps {
  existingPlayer: RealmPlayer | null;
}

export function Enrolment({ existingPlayer }: EnrolmentProps) {
  const [returning] = useState(existingPlayer !== null);
  const [step, setStep] = useState<Step>(existingPlayer ? "where" : "title");
  const [name, setName] = useState(existingPlayer?.name ?? "");
  const [look] = useState<PlayerLook>(existingPlayer?.look ?? { skin: SKINS[1], hair: HAIRS[1], tunic: TUNICS[1], legs: LEGS[0], cape: CAPES[0] });
  const [avatar] = useState<AvatarId>(existingPlayer?.avatar ?? "knight");
  const [appearance, setAppearance] = useState<Appearance>(existingPlayer?.appearance ?? defaultAppearance("female"));
  const [house, setHouse] = useState<string | null>(existingPlayer?.house ?? null);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState(YEAR_LEVELS[0]);
  const [teachingPeriod, setTeachingPeriod] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const laTrobeDates = laTrobeDatesFor({ university, teachingPeriod, year });
  const [campus, setCampus] = useState("");
  const [saved, setSaved] = useState<SavedLaTrobeSemester | null>(null);
  const [drafts, setDrafts] = useState<SubjectDraft[]>([{ key: 1, code: "", name: "", file: null }]);
  const [summon, setSummon] = useState<Record<number, SummonState>>({});
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [subjects, setSubjects] = useState<RealmSubject[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [credits, setCredits] = useState(false);

  const laTrobe = isLaTrobeName(university);
  const enrolment: EnrolmentData = useMemo(
    () => ({ country, city: laTrobe && campus ? campus : city, university, course, yearLevel, teachingPeriod, year, startDate: startDate || null }),
    [country, city, campus, laTrobe, university, course, yearLevel, teachingPeriod, year, startDate],
  );

  const cities = citiesFor(country);
  const universities = universitiesFor(country, city);
  const periods = laTrobe ? [...LA_TROBE.teachingPeriods] : teachingPeriodsFor(country);

  useEffect(() => {
    if (!laTrobe) return;
    let cancelled = false;
    void loadSavedLaTrobeSemester().then((result) => {
      if (!cancelled) setSaved(result);
    });
    return () => {
      cancelled = true;
    };
  }, [laTrobe]);

  const chooseLaTrobe = () => {
    setCountry(LA_TROBE.country);
    setCity("Melbourne");
    setUniversity(LA_TROBE.name);
    setCampus(LA_TROBE.campuses[0]);
    if (!teachingPeriod) setTeachingPeriod(defaultLaTrobePeriod());
    setStep("course");
  };

  const importSaved = () => {
    if (!saved) return;
    if (saved.year) setYear(saved.year);
    if (saved.teachingPeriod) setTeachingPeriod(saved.teachingPeriod);
    setSubjects(saved.subjects);
    setStep("review");
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const saveCharacter = () => {
    setPlayer({ name: name.trim() || "Adventurer", look, avatar, appearance, house: house ?? undefined });
    setStep("where");
  };

  const runSummon = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const valid = drafts.filter((d) => d.code.trim() || d.name.trim());
    setSummon(Object.fromEntries(valid.map((d) => [d.key, { status: "waiting", message: "Queued", subject: null, warnings: [] }])));
    const ai = await checkResearchAvailable();
    setAiAvailable(ai);

    const update = (key: number, patch: Partial<SummonState>) =>
      setSummon((s) => ({ ...s, [key]: { ...(s[key] ?? { status: "waiting", message: "", subject: null, warnings: [] }), ...patch } }));

    const work = async (draft: SubjectDraft) => {
      const fallback = { code: draft.code.trim(), name: draft.name.trim() };
      const warnings: string[] = [];
      let documentText: string | null = null;
      if (draft.file) {
        update(draft.key, { status: "working", message: `Reading ${draft.file.name}…` });
        try {
          documentText = await extractDocumentText(draft.file);
          if (documentText.trim().length < 80) {
            warnings.push(`${draft.file.name} had almost no readable text (it may be a scanned image).`);
            documentText = null;
          }
        } catch {
          warnings.push(`${draft.file.name} could not be read.`);
        }
      }
      const placeholder: RegionTheme = "arcane";
      const offline = (note: string): RealmSubject => {
        if (documentText) return normalizeSubject(parseOutlineText(documentText, fallback.code, fallback.name), fallback, "document", placeholder);
        const subject = normalizeSubject({ ...fallback }, fallback, "manual", placeholder);
        return { ...subject, sourceNote: note };
      };

      if (!ai) {
        const subject = offline("Curriculum research is unavailable, so add this subject's weekly topics and assessments below (copy them from your subject outline).");
        update(draft.key, {
          status: "done",
          message: documentText ? "Read from your outline." : "Ready for you to fill in.",
          subject,
          warnings,
        });
        return;
      }

      update(draft.key, { status: "working", message: documentText ? "Reading your outline…" : "Searching official subject pages…" });
      try {
        const response = await fetchSubjectCurriculum(enrolment, { ...fallback, documentText }, controller.signal);
        const rawConfidence = (response.subject as { confidence?: string } | null)?.confidence;
        const confidence: CurriculumConfidence = documentText ? "document" : rawConfidence === "official" ? "official" : "inferred";
        const subject = normalizeSubject(response.subject, fallback, confidence, placeholder);
        subject.sourceUrls = Array.from(new Set([...subject.sourceUrls, ...response.sources])).slice(0, 12);
        update(draft.key, {
          status: "done",
          message: `Found ${subject.weeks.length} weeks, ${subject.assessments.length} quests, ${subject.questions.length} practice questions.`,
          subject,
          warnings: [...warnings, ...response.warnings],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof CurriculumFetchError && error.failure.kind === "ai-unavailable") {
          setAiAvailable(false);
          const subject = offline("Research is unavailable right now. Fill in this subject's weeks and assessments below.");
          update(draft.key, { status: "done", message: "Research unavailable. Ready for you to fill in.", subject, warnings });
          return;
        }
        update(draft.key, { status: "error", message: error instanceof Error ? error.message : "Research failed.", warnings });
      }
    };

    // Two subjects at a time.
    const queue = [...valid];
    const runners = Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (queue.length && !controller.signal.aborted) {
        const next = queue.shift()!;
        await work(next);
      }
    });
    await Promise.all(runners);
  };

  const retryOne = async (draft: SubjectDraft) => {
    setSummon((s) => ({ ...s, [draft.key]: { status: "working", message: "Retrying…", subject: null, warnings: [] } }));
    try {
      const response = await fetchSubjectCurriculum(enrolment, { code: draft.code.trim(), name: draft.name.trim(), documentText: null });
      const rawConfidence = (response.subject as { confidence?: string } | null)?.confidence;
      const subject = normalizeSubject(response.subject, { code: draft.code.trim(), name: draft.name.trim() }, rawConfidence === "official" ? "official" : "inferred", "arcane");
      subject.sourceUrls = Array.from(new Set([...subject.sourceUrls, ...response.sources])).slice(0, 12);
      setSummon((s) => ({ ...s, [draft.key]: { status: "done", message: `Found ${subject.weeks.length} weeks, ${subject.assessments.length} quests.`, subject, warnings: response.warnings } }));
    } catch (error) {
      setSummon((s) => ({ ...s, [draft.key]: { status: "error", message: error instanceof Error ? error.message : "Research failed.", subject: null, warnings: [] } }));
    }
  };

  const skipToManual = (draft: SubjectDraft) => {
    const fallback = { code: draft.code.trim(), name: draft.name.trim() };
    const subject = { ...normalizeSubject({ ...fallback }, fallback, "manual", "arcane"), sourceNote: "Entered by you from your subject outline." };
    setSummon((s) => ({ ...s, [draft.key]: { status: "done", message: "Ready for you to fill in.", subject, warnings: [] } }));
  };

  const allSummoned = Object.values(summon).length > 0 && Object.values(summon).every((s) => s.status === "done");

  const toReview = () => {
    setSubjects(Object.values(summon).map((s) => s.subject).filter((s): s is RealmSubject => s !== null));
    setStep("review");
  };

  /** Region themes as the realm will have them, so the review already shows each subject's colours. */
  const reviewThemes = useMemo(() => {
    const taken = new Set<RegionTheme>();
    return subjects.map((subject, i) => {
      const theme = pickTheme(`${subject.name} ${subject.code}`, i, taken);
      taken.add(theme);
      return theme;
    });
  }, [subjects]);

  const forge = () => {
    const taken = new Set<RegionTheme>();
    const themed = dedupeSubjectIds(subjects.map(enrichWithBank)).map((subject, i) => {
      const theme = pickTheme(`${subject.name} ${subject.code}`, i, taken);
      taken.add(theme);
      return { ...subject, theme };
    });
    if (!returning) setPlayer({ name: name.trim() || "Adventurer", look, avatar, appearance, house: house ?? undefined });
    setCurriculum({ enrolment: withLaTrobeDates(enrolment), subjects: themed, createdAt: new Date().toISOString() });
  };

  return (
    <div className={`enrol enrol-${step}`}>
      <EnrolBackdrop close={step !== "title"} />

      {step === "title" ? (
        <>
          {credits ? (
            <CreditsPanel onClose={() => setCredits(false)} />
          ) : (
            <section className="rs-mainmenu">
              <Wordmark />
              <p className="rs-mainmenu-lede">Your real semester, played as an adventure. Subjects become skills, assessments become quests and every week of study is a waystone.</p>
              <MenuList
                label="Main menu"
                items={[
                  { label: "New game", hint: "Create your character", onSelect: () => setStep("character") },
                  { label: "Credits", onSelect: () => setCredits(true) },
                ]}
              />
            </section>
          )}
          <MenuFooter right="Made for La Trobe University students. Open to every university." />
        </>
      ) : (
        <section className="enrol-panel">
          <ol className="enrol-progress" aria-label="Enrolment steps">
            {STEPS.map((s, i) => {
              const at = STEPS.findIndex((x) => x.id === step);
              return (
                <li key={s.id} className={`${s.id === step ? "current" : ""} ${i < at ? "done" : ""}`} aria-current={s.id === step ? "step" : undefined}>
                  <span className="dot">{i < at ? <Icon name="check" /> : i + 1}</span>
                  <span className="label">{s.label}</span>
                </li>
              );
            })}
          </ol>

          {step === "character" ? (
            <div className="step">
              <h2>Create your character</h2>
              <label className="field">
                <span>Name</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
              </label>
              <CharacterCreator value={appearance} onChange={setAppearance} house={house} onHouse={setHouse} />
              <div className="actions">
                <button type="button" className="rs-button secondary" onClick={() => setStep("title")}>
                  Back
                </button>
                <button type="button" className="rs-button" disabled={!name.trim()} onClick={saveCharacter}>
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === "where" ? (
            <div className="step">
              <h2>{returning && existingPlayer ? `Welcome back, ${existingPlayer.name}. ` : ""}Where do you study?</h2>
              <button type="button" className="latrobe-card" onClick={chooseLaTrobe}>
                <span className="crest" aria-hidden="true">LTU</span>
                <span className="text">
                  <strong>I study at La Trobe University</strong>
                  <span>Melbourne, Bendigo, Albury-Wodonga, Mildura, Shepparton, Sydney or online. Built from the La Trobe Handbook and your Subject Learning Guides.</span>
                </span>
                <span className="go" aria-hidden="true">
                  <Icon name="chevronRight" />
                </span>
              </button>
              <p className="or-divider">
                <span>or choose another university</span>
              </p>
              <Picker
                label="Country"
                value={country}
                options={UNIVERSITY_DIRECTORY.map((c) => c.country)}
                onChange={(v) => {
                  setCountry(v);
                  setCity("");
                  setUniversity("");
                  setTeachingPeriod("");
                }}
                placeholder="Type or choose your country"
              />
              <Picker
                label="City"
                value={city}
                options={cities}
                onChange={(v) => {
                  setCity(v);
                  setUniversity("");
                }}
                placeholder="Type or choose your city"
              />
              <Picker label="University" value={university} options={universities} onChange={setUniversity} placeholder="Type or choose your university" />
              <div className="actions">
                {returning ? null : (
                  <button type="button" className="rs-button secondary" onClick={() => setStep("character")}>
                    Back
                  </button>
                )}
                <button type="button" className="rs-button" disabled={!country.trim() || !university.trim()} onClick={() => setStep("course")}>
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === "course" ? (
            <div className="step">
              <h2>What are you studying{laTrobe ? " at La Trobe" : ""}?</h2>
              {laTrobe ? (
                <div className="field">
                  <span>Campus</span>
                  <div className="chip-row" role="radiogroup" aria-label="Campus">
                    {LA_TROBE.campuses.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={campus === c} className={`chip ${campus === c ? "on" : ""}`} onClick={() => setCampus(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <CoursePicker laTrobe={laTrobe} campus={laTrobe ? campus : ""} value={course} onChange={setCourse} />
              <div className="field-row">
                <label className="field">
                  <span>Year level</span>
                  <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}>
                    {YEAR_LEVELS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Year</span>
                  <input type="number" value={year} min={2000} max={2100} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
                </label>
              </div>
              <Picker label="Semester / teaching period" value={teachingPeriod} options={periods} onChange={setTeachingPeriod} placeholder="e.g. Semester 2" />
              {laTrobeDates && !startDate ? (
                <p className="calendar-note">
                  <Icon name="calendar" /> La Trobe's official dates for {laTrobeDates.period} {laTrobeDates.year} will be used: teaching starts{" "}
                  {new Date(`${laTrobeDates.start}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, with the mid-semester
                  break and exam period ({new Date(`${laTrobeDates.examStart}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })} to{" "}
                  {new Date(`${laTrobeDates.examEnd}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}) built in.
                </p>
              ) : (
                <label className="field">
                  <span>First day of teaching (optional, so your tutors know which week it is)</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              )}
              <div className="actions">
                <button type="button" className="rs-button secondary" onClick={() => setStep("where")}>
                  Back
                </button>
                <button type="button" className="rs-button" disabled={!teachingPeriod.trim()} onClick={() => setStep("subjects")}>
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === "subjects" ? (
            <div className="step">
              <h2>Which subjects are you taking?</h2>
              {laTrobe && saved ? (
                <div className="saved-import">
                  <p>
                    <strong>Your saved La Trobe subjects:</strong> {saved.label} ({saved.source})
                  </p>
                  <ul>
                    {saved.subjects.map((s) => (
                      <li key={s.id}>
                        {s.code ? `${s.code}: ` : ""}
                        {s.name} · {s.weeks.length} weeks · {s.assessments.length} assessment{s.assessments.length === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="rs-button" onClick={importSaved}>
                    Use these subjects
                  </button>
                </div>
              ) : null}
              {laTrobe ? (
                <p className="muted">
                  Enter La Trobe subject codes (like CSE1OOF). Each subject is looked up in the La Trobe Handbook. For exact assessment dates
                  and weights, attach the <strong>Subject Learning Guide</strong> from LMS (Moodle).
                </p>
              ) : null}
              <p className="muted" hidden={laTrobe}>
                Add each subject's code and name. We search {university || "your university"}'s official pages for its weekly topics and
                assessments. For the most accurate realm, attach your subject outline (PDF, DOCX or TXT).
              </p>
              {drafts.map((draft, i) => (
                <div key={draft.key} className="subject-row">
                  <span className="num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <input
                    className="code"
                    value={draft.code}
                    placeholder="Code (e.g. CSE1OOF)"
                    onChange={(e) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
                    aria-label={`Subject ${i + 1} code`}
                  />
                  <input
                    className="name"
                    value={draft.name}
                    placeholder="Subject name"
                    onChange={(e) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    aria-label={`Subject ${i + 1} name`}
                  />
                  <span className="row-tools">
                  {laTrobe && laTrobeHandbookUrl(draft.code, year) ? (
                    <a className="handbook-link" href={laTrobeHandbookUrl(draft.code, year)!} target="_blank" rel="noreferrer noopener" title="Open in the La Trobe Handbook">
                      Handbook <Icon name="external" />
                    </a>
                  ) : null}
                  <label className="file-btn" title="Attach subject outline">
                    <Icon name="attach" /> {draft.file ? draft.file.name.slice(0, 14) : "Attach outline"}
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setDrafts((d) => d.map((x, j) => (j === i ? { ...x, file } : x)));
                      }}
                    />
                  </label>
                  <button type="button" className="icon-btn" disabled={drafts.length === 1} onClick={() => setDrafts((d) => d.filter((_, j) => j !== i))} aria-label="Remove subject">
                    <Icon name="close" />
                  </button>
                  </span>
                </div>
              ))}
              {drafts.length < 8 ? (
                <button type="button" className="link" onClick={() => setDrafts((d) => [...d, { key: Date.now(), code: "", name: "", file: null }])}>
                  <Icon name="plus" /> Add another subject
                </button>
              ) : null}
              <div className="actions">
                <button type="button" className="rs-button secondary" onClick={() => setStep("course")}>
                  Back
                </button>
                <button
                  type="button"
                  className="rs-button"
                  disabled={!drafts.some((d) => d.code.trim() || d.name.trim())}
                  onClick={() => {
                    setStep("summon");
                    void runSummon();
                  }}
                >
                  Research subjects
                </button>
              </div>
            </div>
          ) : null}

          {step === "summon" ? (
            <div className="step">
              <h2>Researching your subjects</h2>
              {aiAvailable === false ? (
                <p className="note">
                  Automatic curriculum research isn't available on this server (no Anthropic API key configured). Attached outlines are read directly; for
                  the rest you'll enter weeks and assessments yourself in the next step.
                </p>
              ) : (
                <p className="muted">Researching official subject pages can take a minute or two per subject.</p>
              )}
              <ul className="summon-list">
                {drafts
                  .filter((d) => d.code.trim() || d.name.trim())
                  .map((draft) => {
                    const s = summon[draft.key];
                    return (
                      <li key={draft.key} className={s?.status ?? "waiting"}>
                        <span className="spinner" aria-hidden="true">
                          {s?.status === "done" ? <Icon name="check" /> : s?.status === "error" ? <Icon name="close" /> : <span className="rs-spinner" />}
                        </span>
                        <span className="text">
                          <strong>{[draft.code, draft.name].filter(Boolean).join(": ")}</strong>
                          <span className="muted small">{s?.message ?? "Waiting…"}</span>
                          {s?.warnings.map((w) => (
                            <span key={w} className="warn small">
                              {w}
                            </span>
                          ))}
                        </span>
                        {s?.status === "error" ? (
                          <span className="row">
                            <button type="button" className="link" onClick={() => void retryOne(draft)}>
                              Retry
                            </button>
                            <button type="button" className="link" onClick={() => skipToManual(draft)}>
                              Enter manually
                            </button>
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
              <div className="actions">
                <button
                  type="button"
                  className="rs-button secondary"
                  onClick={() => {
                    abortRef.current?.abort();
                    setStep("subjects");
                  }}
                >
                  Back
                </button>
                <button type="button" className="rs-button" disabled={!allSummoned} onClick={toReview}>
                  Review
                </button>
              </div>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="step">
              <h2>Review your semester</h2>
              <p className="muted">
                Check what was found. Each subject becomes a region and a skill, each assessment a quest and each week a waystone.
              </p>
              <div className="review-list">
                {subjects.map((subject, i) => (
                  <SubjectEditor
                    key={`${subject.id}-${i}`}
                    subject={{ ...subject, theme: reviewThemes[i] ?? subject.theme }}
                    onChange={(next) => setSubjects((list) => list.map((s, j) => (j === i ? next : s)))}
                    onRemove={() => setSubjects((list) => list.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
              <div className="actions">
                <button type="button" className="rs-button secondary" onClick={() => setStep("subjects")}>
                  Back
                </button>
                <button type="button" className="rs-button big" disabled={subjects.length === 0} onClick={forge}>
                  Start the semester
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}


const STEPS: Array<{ id: Step; label: string }> = [
  { id: "character", label: "Character" },
  { id: "where", label: "University" },
  { id: "course", label: "Course" },
  { id: "subjects", label: "Subjects" },
  { id: "summon", label: "Research" },
  { id: "review", label: "Review" },
];

function Picker({ label, value, options, onChange, placeholder }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 40);
  return (
    <div className="field picker">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        aria-label={label}
        role="combobox"
        aria-expanded={open && filtered.length > 0}
      />
      {open && filtered.length > 0 ? (
        <ul className="picker-list" role="listbox">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
