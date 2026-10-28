/** Interface windows opened from the world or the side panel. */

import { useRef, useState } from "react";
import { Window } from "./Window";
import { realmStore, useRealm } from "../state/store";
import { chat } from "../state/events";
import { CurriculumFetchError, extractDocumentText, fetchWeekQuestions } from "../curriculum/curriculumClient";
import { normalizeQuestions } from "../curriculum/normalize";
import { isWeakWeek, weekAccuracy } from "../state/stats";
import { claimDaily, dailyChallenges, DAILY_REWARD_COINS, questProgress, rubLamp, setQuestStep, setSlideQuestions, weekKey, currentTeachingWeek, resolvedDueDate } from "../state/actions";
import { levelForXp, levelProgress, questCompletionXp, questPointsFor, xpForLevel, xpToNextLevel, MAX_LEVEL } from "../xp";
import { confidenceLabel } from "./SidePanel";
import type { RealmAssessment, RealmSubject } from "../types";
import { Icon, themeIcon } from "./icons";
import { WeekCheck } from "./WeekCheck";
import { hasStudyCheck, STUDY_CHECK } from "../state/studyCheck";

function dueText(assessment: RealmAssessment): string {
  const curriculum = realmStore.get().curriculum;
  const date = resolvedDueDate(assessment, curriculum);
  const day = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : null;
  if (assessment.dueDate && day) return day;
  // A week-only due date: show the week, and the Friday of that week when the semester dates are known.
  if (assessment.dueWeek !== null) return day ? `Week ${assessment.dueWeek} (~${day})` : `Week ${assessment.dueWeek}`;
  return "Due date unknown. Check your subject outline.";
}

export function QuestJournal({ assessmentId, onClose }: { assessmentId: string; onClose: () => void }) {
  const state = useRealm((s) => s);
  let found: { subject: RealmSubject; assessment: RealmAssessment } | null = null;
  for (const subject of state.curriculum?.subjects ?? []) {
    const assessment = subject.assessments.find((a) => a.id === assessmentId);
    if (assessment) found = { subject, assessment };
  }
  if (!found) return null;
  const { subject, assessment } = found;
  const progress = questProgress(state, assessment);
  return (
    <Window title={assessment.title} onClose={onClose} className="quest-journal" width={560}>
      <div className="parchment">
        <p className="quest-meta">
          <span>{subject.name}</span>
          <span>{assessment.kind}</span>
          <span>{assessment.weightPercent !== null ? `${assessment.weightPercent}% of grade` : "Weight unknown"}</span>
          <span>{dueText(assessment)}</span>
        </p>
        {assessment.description ? <p>{assessment.description}</p> : null}
        <p className="quest-reward">
          Rewards: {questPointsFor(assessment.weightPercent)} Quest Points · {questCompletionXp(assessment.weightPercent).toLocaleString()} {subject.name} XP · Lamp of
          Insight
        </p>
        <h3>Quest steps</h3>
        <ol className="quest-steps">
          {assessment.steps.map((step, i) => {
            const done = progress.stepsDone[i] ?? false;
            return (
              <li key={i} className={done ? "done" : ""}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={step}
                    checked={done}
                    disabled={progress.status === "complete"}
                    onChange={(e) => setQuestStep(assessment.id, i, e.target.checked)}
                  />
                  <span>{step}</span>
                </label>
              </li>
            );
          })}
        </ol>
        {progress.status === "complete" ? (
          <p className="quest-complete-note">Quest complete{progress.completedAt ? ` · ${new Date(progress.completedAt).toLocaleDateString()}` : ""}</p>
        ) : (
          <p className="muted small">Tick each step as you really do it. Finishing every step completes the quest.</p>
        )}
      </div>
    </Window>
  );
}

export function QuestBoardWindow({ subjectId, onClose, onOpenQuest }: { subjectId: string; onClose: () => void; onOpenQuest: (id: string) => void }) {
  const state = useRealm((s) => s);
  const subject = state.curriculum?.subjects.find((s) => s.id === subjectId);
  if (!subject) return null;
  return (
    <Window title={`Quest board · ${subject.name}`} onClose={onClose} width={560}>
      {subject.assessments.length === 0 ? (
        <p>No assessments were found for this subject. Study every waystone to complete it, or add assessments by re-enrolling.</p>
      ) : (
        <ul className="board-list">
          {subject.assessments.map((a) => {
            const p = questProgress(state, a);
            return (
              <li key={a.id}>
                <button type="button" className={`board-notice ${p.status}`} onClick={() => onOpenQuest(a.id)}>
                  <strong>{a.title}</strong>
                  <span>
                    {a.weightPercent !== null ? `${a.weightPercent}%` : "?%"} · {dueText(a)} · {p.status === "complete" ? "Complete" : p.status === "in-progress" ? `${p.stepsDone.filter(Boolean).length}/${a.steps.length} steps` : "Not started"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Window>
  );
}

/** Upload a week's lecture slides; the AI writes trial questions from them. */
function SlidesUpload({ subject, week, weekTitle }: { subject: RealmSubject; week: number; weekTitle: string }) {
  const university = useRealm((s) => s.curriculum?.enrolment.university ?? "");
  const count = subject.questions.filter((q) => q.id.startsWith(`${subject.id}-s${week}-`)).length;
  const [status, setStatus] = useState<{ busy: boolean; text: string; error: boolean }>({ busy: false, text: "", error: false });
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setStatus({ busy: true, text: "Reading your slides…", error: false });
    try {
      const slidesText = await extractDocumentText(file);
      if (slidesText.trim().length < 200) throw new Error("Those slides have almost no text to read (image-only slides can't be read).");
      setStatus({ busy: true, text: "The archivists are writing questions from your slides…", error: false });
      const raw = await fetchWeekQuestions({ university, subjectCode: subject.code, subjectName: subject.name, week, weekTitle, slidesText });
      const questions = normalizeQuestions(raw, subject.id, `s${week}-`).map((q) => ({ ...q, week }));
      if (questions.length === 0) throw new Error("No usable questions came back. Try again.");
      setSlideQuestions(subject.id, week, questions);
      setStatus({ busy: false, text: `${questions.length} new questions from ${file.name} now guard this waystone's trial.`, error: false });
      chat(`The waystone of Week ${week} absorbs your lecture slides: ${questions.length} new trial questions.`);
    } catch (error) {
      const message =
        error instanceof CurriculumFetchError && error.failure.kind === "ai-unavailable"
          ? "Writing questions from slides needs the realm's AI server (an ANTHROPIC_API_KEY on the server). It isn't set up yet."
          : error instanceof Error
            ? error.message
            : "That didn't work.";
      setStatus({ busy: false, text: message, error: true });
    }
  };

  return (
    <div className="slides-upload">
      <p className="muted small">
        <strong>Lecture slides:</strong> upload this week's slides (PDF, PowerPoint or Word) and the trial will ask about what your lecturer actually taught.
        {count > 0 ? ` ${count} questions from your slides are already here; uploading again replaces them.` : ""}
      </p>
      <button type="button" className="rs-button secondary" disabled={status.busy} onClick={() => input.current?.click()}>
        {status.busy ? "Working…" : "Upload slides"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.pptx,.docx,.txt,.md,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {status.text ? <p className={status.error ? "error small" : "muted small"}>{status.text}</p> : null}
    </div>
  );
}

export function StudyWindow({ subjectId, week, onClose, onTrial, onExplain }: { subjectId: string; week: number; onClose: () => void; onTrial: () => void; onExplain?: () => void }) {
  const subject = useRealm((s) => s.curriculum?.subjects.find((x) => x.id === subjectId));
  const progress = useRealm((s) => s.progress.weeks[weekKey(subjectId, week)]);
  const [checking, setChecking] = useState(false);
  const info = subject?.weeks.find((w) => w.week === week);
  if (!subject || !info) return null;
  const studied = Boolean(progress?.studiedAt);
  const canCheck = !studied && hasStudyCheck(subject, week);
  if (checking) {
    return (
      <Window title={`Waystone of Week ${week}`} onClose={onClose} width={560}>
        <WeekCheck subject={subject} week={week} onDone={() => setChecking(false)} />
      </Window>
    );
  }
  return (
    <Window title={`Waystone of Week ${week}`} onClose={onClose} width={560}>
      <div className="parchment">
        <h3>{info.title}</h3>
        {info.summary ? <p>{info.summary}</p> : null}
        {info.topics.length ? (
          <ul className="topics">
            {info.topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
        <p className="muted small">
          {studied
            ? `Studied ${new Date(progress!.studiedAt!).toLocaleDateString()}.`
            : canCheck
              ? `Study it: attend this week's lecture in the Lecture Theatre, or pass a ${STUDY_CHECK.questions}-question check here. Either pays the full study reward.`
              : "Study it: take a seat for this week's lecture in the Lecture Theatre. Finishing it pays the full study reward."}{" "}
          Trials won here: {progress?.minigamesWon ?? 0}
        </p>
      </div>
      <div className="row">
        {studied ? (
          <button type="button" className="rs-button" disabled>
            Studied
          </button>
        ) : canCheck ? (
          <button type="button" className="rs-button" onClick={() => setChecking(true)}>
            Take the study check
          </button>
        ) : null}
        <button type="button" className="rs-button secondary" onClick={onTrial}>
          Begin trial
        </button>
      </div>
      <SlidesUpload subject={subject} week={week} weekTitle={info.title} />
      {onExplain ? (
        <p className="muted small">
          Think you've got it?{" "}
          <button type="button" className="link" onClick={onExplain}>
            Explain this week back to your tutor
          </button>
        </p>
      ) : null}
    </Window>
  );
}

export function CodexWindow({ subjectId, onClose, onAddQuestions, onExplain }: { subjectId: string; onClose: () => void; onAddQuestions?: () => void; onExplain?: () => void }) {
  const subject = useRealm((s) => s.curriculum?.subjects.find((x) => x.id === subjectId));
  const weeks = useRealm((s) => s.progress.weeks);
  const xp = useRealm((s) => s.progress.skillXp[subjectId] ?? 0);
  const curriculum = useRealm((s) => s.curriculum);
  const [tab, setTab] = useState<"weeks" | "terms" | "about">("weeks");
  if (!subject) return null;
  const level = levelForXp(xp);
  const current = currentTeachingWeek(curriculum);
  return (
    <Window title={subject.name} onClose={onClose} width={640}>
      <div className="codex-head">
        <div>
          <p className="big">Level {level}</p>
          <p className="muted small">
            {xp.toLocaleString()} XP{level < MAX_LEVEL ? ` · ${xpToNextLevel(xp).toLocaleString()} to level ${level + 1}` : " · Mastered"}
          </p>
          <div className="xpbar">
            <span style={{ width: `${Math.round(levelProgress(xp) * 100)}%` }} />
          </div>
        </div>
        <p className={`badge ${subject.confidence}`}>{confidenceLabel(subject.confidence)}</p>
      </div>
      {onAddQuestions || onExplain ? (
        <div className="row codex-tools">
          {onExplain ? (
            <button type="button" className="rs-button secondary" onClick={onExplain}>
              Explain it back
            </button>
          ) : null}
          {onAddQuestions ? (
            <button type="button" className="rs-button secondary" onClick={onAddQuestions}>
              Add your own questions
            </button>
          ) : null}
        </div>
      ) : null}
      <nav className="codex-tabs">
        {(["weeks", "terms", "about"] as const).map((t) => (
          <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "weeks" ? "Weekly path" : t === "terms" ? "Key terms" : "About"}
          </button>
        ))}
      </nav>
      <div className="codex-body">
        {tab === "weeks" ? (
          <ol className="codex-weeks">
            {subject.weeks.map((w) => (
              <li key={w.week} className={`${weeks[weekKey(subject.id, w.week)]?.studiedAt ? "done" : ""} ${current === w.week ? "current" : ""}`}>
                <strong>Week {w.week}:</strong> {w.title}
                <WeekAccuracy subjectId={subject.id} week={w.week} />
                {current === w.week ? <span className="now">This week</span> : null}
                {w.topics.length ? <span className="muted small"> · {w.topics.join(", ")}</span> : null}
              </li>
            ))}
            {subject.weeks.length === 0 ? <li className="muted">No weekly schedule found.</li> : null}
          </ol>
        ) : null}
        {tab === "terms" ? (
          <dl className="codex-terms">
            {subject.keyTerms.map((t) => (
              <div key={t.term}>
                <dt>{t.term}</dt>
                <dd>{t.definition}</dd>
              </div>
            ))}
            {subject.keyTerms.length === 0 ? <p className="muted">No key terms recorded.</p> : null}
          </dl>
        ) : null}
        {tab === "about" ? (
          <div>
            {subject.summary ? <p>{subject.summary}</p> : null}
            {subject.learningOutcomes.length ? (
              <>
                <h4>Learning outcomes</h4>
                <ul>
                  {subject.learningOutcomes.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {subject.sourceNote ? <p className="note">{subject.sourceNote}</p> : null}
            {subject.sourceUrls.length ? (
              <>
                <h4>Sources</h4>
                <ul className="sources">
                  {subject.sourceUrls.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer noopener">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </Window>
  );
}

/** "70% of 12" next to a week in the Codex: the weak-spot map in words. */
function WeekAccuracy({ subjectId, week }: { subjectId: string; week: number }) {
  const rate = useRealm((s) => weekAccuracy(s, subjectId, week)?.rate ?? -1);
  const answered = useRealm((s) => weekAccuracy(s, subjectId, week)?.answered ?? 0);
  const weak = useRealm((s) => isWeakWeek(s, subjectId, week));
  if (rate < 0) return null;
  return (
    <span className={`week-acc ${weak ? "weak" : ""}`} title={`${Math.round(rate * 100)}% of ${answered} answers right`}>
      {" "}
      {weak ? <Icon name="warning" /> : null}{weak ? " " : ""}
      {Math.round(rate * 100)}% of {answered}
    </span>
  );
}

export function LampWindow({ itemIndex, onClose }: { itemIndex: number; onClose: () => void }) {
  const subjects = useRealm((s) => s.curriculum?.subjects) ?? [];
  const skillXp = useRealm((s) => s.progress.skillXp);
  return (
    <Window title="Lamp of Insight" onClose={onClose}>
      <p>Choose the skill to gain experience in:</p>
      <div className="lamp-grid">
        {subjects.map((s) => {
          const level = levelForXp(skillXp[s.id] ?? 0);
          return (
            <button
              key={s.id}
              type="button"
              className="rs-button"
              onClick={() => {
                rubLamp(itemIndex, s.id);
                onClose();
              }}
            >
              <Icon name={themeIcon(s.theme)} /> {s.name} (level {level})
            </button>
          );
        })}
      </div>
    </Window>
  );
}

export function GraduationWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const subjects = state.curriculum?.subjects ?? [];
  const total = subjects.reduce((sum, s) => sum + levelForXp(state.progress.skillXp[s.id] ?? 0), 0);
  return (
    <Window title="The Great Hall" onClose={onClose} className="graduation" width={600}>
      <div className="parchment grad-scroll">
        <p className="grad-crest">
          <Icon name="cap" />
        </p>
        <h3>Be it known throughout the realm</h3>
        <p>
          that <strong>{state.player?.name}</strong> has completed every quest of {state.curriculum?.enrolment.teachingPeriod} {state.curriculum?.enrolment.year}
          {state.curriculum?.enrolment.course ? ` in ${state.curriculum.enrolment.course}` : ""} at {state.curriculum?.enrolment.university}.
        </p>
        <ul className="grad-skills">
          {subjects.map((s) => (
            <li key={s.id}>
              {s.name}: level {levelForXp(state.progress.skillXp[s.id] ?? 0)}
            </li>
          ))}
        </ul>
        <p>
          Total level {total} · {state.progress.questPoints} Quest Points · {state.progress.focusMinutes} minutes of focused study
        </p>
        <p className="muted small">Your Graduation Cape is in your inventory. Keep training: level {MAX_LEVEL} is the mark of a true master ({xpForLevel(MAX_LEVEL).toLocaleString()} XP).</p>
      </div>
    </Window>
  );
}

export function ControlsWindow({ onClose }: { onClose: () => void }) {
  return (
    <Window title="How to play" onClose={onClose} width={560}>
      <ul className="controls">
        <li>
          <strong>WASD</strong> or the <strong>arrow keys</strong> walk. <strong>E</strong> uses whatever is in front of you. <strong>Space</strong> jumps. Hold <strong>Shift</strong> to sprint (watch the stamina bar).
        </li>
        <li>
          Or <strong>left-click</strong> the ground to walk there, and click a person or place to use it.
        </li>
        <li>
          <strong>Right-click</strong> anything for all its options (Talk-to, Study, Trial, Travel, Examine…).
        </li>
        <li>
          <strong>Drag</strong> turns the camera; <strong>R / T</strong> tilts it; <strong>scroll</strong> zooms. The <strong>view button</strong> (the eye, bottom right, beside Menu) switches between third
          and first person; in first person, drag to look around. Click the compass to face north.
        </li>
        <li>
          <strong>M</strong> (or the Menu button, bottom right) opens your skills, quests, Grimoire, achievements, bag, codex and options. <strong>L</strong> opens
          the message log.
        </li>
        <li>Click the minimap to travel (the minus button folds it away). Signposts at the Agora fast-travel to each subject. The home button teleports you back.</li>
        <li>
          <strong>F</strong> attacks the nearest monster (or click it); <strong>1–4</strong> cast the spells on your spell bar; <strong>H</strong> eats your best food.
        </li>
        <li>
          <strong>G</strong> opens emotes. <strong>B</strong> takes off or lands on your broom (earned by studying every week of a subject).
        </li>
        <li>Owl post (Menu, then Owl post): deadline reminders, reviews, classes and news arrive as letters.</li>
      </ul>
      <h3>Study powers play</h3>
      <ul className="controls">
        <li>
          <strong>Focus</strong> (the bolt in the top bar) is earned only by studying: waystones, quest steps, Grimoire reviews, trial and boss wins, meditation, explaining
          a concept and the daily fountain. Up to 100.
        </li>
        <li>
          Focus is spent on play: fishing, mining and woodcutting (1 each), starting a fight (1), the crypt (15), the Siege of Procrastination (5) and the Island Race (3).
        </li>
        <li>Cook fish at the campfire for food, and forge weapons at the anvil from ore and logs. Life skills and gear carry over to next semester.</li>
        <li>The striped games hall in the Agora has the arcade games. Study breaks inside the Siege pay gold for right answers.</li>
        <li>
          Your dorm on the Agora is yours to furnish with coins. A comfier room adds Focus to the daily challenge reward. The wardrobe inside mixes parts from every
          class and dyes them; press <strong>G</strong> anywhere for emotes.
        </li>
      </ul>
      <h3>Your semester, as a realm</h3>
      <ul className="controls">
        <li>Each subject is a <strong>skill</strong> (level 1–99) and a region of the island.</li>
        <li>
          Each assessment is a <strong>quest</strong> on that region's quest board. Tick off steps as you really do them.
        </li>
        <li>
          Each teaching week is a <strong>waystone</strong>. Study it, then win its trial.
        </li>
        <li>The Exam Arena asks ten hard questions from the whole subject; waystone trials focus on one week. Coins buy hints.</li>
        <li>The Scroll table, Rune altar and Meditation shrine turn revision and real focus time into experience.</li>
        <li>Each subject's building is its library: enter to read the weekly path and key terms.</li>
        <li>The Fountain of Resolve sets three daily challenges for coins and a Lamp of Insight.</li>
        <li>
          Every question you miss goes into the <strong>Grimoire of Mistakes</strong> (Grimoire tab) and comes back 1, 3 and 7 days later until you've mastered it.
        </li>
        <li>
          A <strong>deadline boss</strong> rises in each subject's lair one week before an assessment is due. Beat it to prove you've revised what it covers.
        </li>
        <li>Ask a tutor a question about the subject, and upload a week's lecture slides at its waystone to get trial questions from them.</li>
        <li>Import your real due dates from Moodle in the Quests tab. Your study streak pays a bonus every 7 days in a row.</li>
        <li>Spend coins at the Agora bazaar on capes, hats and pets; swap codes with classmates at the study-group board.</li>
        <li>Complete every quest to graduate in the Great Hall.</li>
      </ul>
      <p className="muted small">On a phone or tablet, use the on-screen joystick and the Use button.</p>
      <p className="muted small">Characters: Quaternius Ultimate Modular Men &amp; Women (quaternius.com). Skeletons, buildings, furniture, trees and props: KayKit by Kay Lousberg (www.kaylousberg.com), CC0. Music and sounds are generated in your browser.</p>
    </Window>
  );
}

export function DailyWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const status = dailyChallenges(state);
  return (
    <Window title="Fountain of Resolve" onClose={onClose} width={520}>
      <p>The water shows today's challenges. They reset at midnight.</p>
      <ul className="daily-list">
        {status.items.map((item) => (
          <li key={item.label} className={item.done ? "done" : ""}>
            <span className="check" aria-hidden="true">
              <Icon name={item.done ? "check" : "minus"} />
            </span>
            <span className="label">{item.label}</span>
            <span className="progress">{item.progress}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Reward: {DAILY_REWARD_COINS} coins and a Lamp of Insight. Spend coins on hints in duels and trials.
      </p>
      <div className="row">
        <button type="button" className="rs-button" disabled={!status.complete || status.claimed} onClick={() => claimDaily()}>
          {status.claimed ? "Claimed today" : status.complete ? "Claim reward" : "Not complete yet"}
        </button>
      </div>
    </Window>
  );
}
