/**
 * The lecture theatre's two screens:
 *
 *  - LectureSetup: pick a subject and week, optionally bring your own lecture
 *    slides, then start. A researched lecture (AI on the server: handbook +
 *    web + your slides) is saved on this device so it replays for free; with
 *    no AI, a shorter lecture is built from your handbook data.
 *  - LecturePlayer: a panel along the bottom of the screen (the theatre and
 *    its big screen stay visible). You sit on the front bench; the professor
 *    speaks each segment in the best voice the device has (lecture/speech.ts),
 *    the slide's animated diagram builds on the big screen as they talk
 *    (lecture/visuals.ts), and a check-in question or two follow the parts
 *    they test. It ends with takeaways and, when there is one, a real
 *    explainer video. Finishing pays out.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Window } from "./Window";
import "../../styles/lecture.css";
import { CurriculumFetchError, extractDocumentText, fetchLecture, type LectureInput } from "../curriculum/curriculumClient";
import { loadLecture, localLecture, sanitizeLecture, saveLecture, type Lecture, type LectureCheck, type StoredLecture } from "../curriculum/lecture";
import { setLiveSlide } from "../lecture/live";
import { englishVoices, isBasicVoice, onVoicesChanged, pickVoice, Speaker, speakingSeconds, speechAvailable, type VoiceGender } from "../lecture/speech";
import { attendLecture, lectureKey } from "../state/lectures";
import { currentTeachingWeek, weekKey } from "../state/actions";
import { recordAnswer } from "../state/stats";
import { recordMistake } from "../state/grimoire";
import { useRealm } from "../state/store";
import { chat, emit } from "../state/events";
import { runtime } from "../scene/runtime";
import type { RealmQuestion, RealmSubject } from "../types";
import { Icon } from "./icons";

const MAX_SLIDES = 80_000;
const VOICE_KEY = "unigame.realm.lectureVoice";
/** The chosen voice's name ("" = pick the best automatically). */
const VOICE_NAME_KEY = "unigame.realm.lectureVoiceName";
const AUTO_KEY = "unigame.realm.lectureAuto";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Per-device convenience only.
  }
}
function readText(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeText(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Per-device convenience only.
  }
}

/** The ready-made lectures' professors, so each gets a matching voice. */
const PROFESSOR_VOICES: Record<string, VoiceGender> = {
  "Professor Iris Thornquill": "female",
  "Professor Dex Calloway": "male",
  "Professor Maggie Ashby": "female",
  "Professor Kofi Mensah-Hart": "male",
};

/** English voices on this device, best first; updates when the browser finishes loading them. */
function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState(englishVoices);
  useEffect(() => onVoicesChanged(() => setVoices(englishVoices())), []);
  return voices;
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** A check-in question as a regular question, for the Grimoire and accuracy stats. */
function asQuestion(check: LectureCheck, week: number): RealmQuestion {
  return { id: `lecture-${week}-${hash(check.prompt)}`, prompt: check.prompt, choices: check.choices, answerIndex: check.answerIndex, explanation: check.explanation, week, difficulty: 2 };
}


// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

interface Playing {
  subject: RealmSubject;
  week: number;
  stored: StoredLecture;
}

type Seat = NonNullable<typeof runtime.seat>;

export function LectureWindow({ subjects, aiAvailable, lecternId, seat, onClose }: { subjects: RealmSubject[]; aiAvailable: boolean; lecternId: string; seat: Seat | null; onClose: () => void }) {
  const [playing, setPlaying] = useState<Playing | null>(null);
  if (playing) {
    return <LecturePlayer {...playing} lecternId={lecternId} seat={seat} onBack={() => setPlaying(null)} onClose={onClose} />;
  }
  return <LectureSetup subjects={subjects} aiAvailable={aiAvailable} onPlay={setPlaying} onClose={onClose} />;
}

function LectureSetup({ subjects, aiAvailable, onPlay, onClose }: { subjects: RealmSubject[]; aiAvailable: boolean; onPlay: (p: Playing) => void; onClose: () => void }) {
  const curriculum = useRealm((s) => s.curriculum);
  const lectures = useRealm((s) => s.progress.lectures);
  const studied = useRealm((s) => s.progress.weeks);
  const teachingWeek = useMemo(() => currentTeachingWeek(curriculum), [curriculum]);
  const withWeeks = subjects.filter((s) => s.weeks.length > 0);
  const [subjectId, setSubjectId] = useState(withWeeks[0]?.id ?? "");
  const subject = withWeeks.find((s) => s.id === subjectId);
  const defaultWeek = (sub: RealmSubject | undefined) => {
    if (!sub) return 1;
    const now = teachingWeek !== null ? sub.weeks.filter((w) => w.week <= teachingWeek).at(-1) : undefined;
    return (now ?? sub.weeks[0]).week;
  };
  const [week, setWeek] = useState(() => defaultWeek(subject));
  const [slides, setSlides] = useState<{ name: string; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const info = subject?.weeks.find((w) => w.week === week);
  const cached = useMemo(() => (subject ? loadLecture(subject.id, week) : null), [subject, week]);

  if (!subject || !info) {
    return (
      <Window title="Lecture theatre" onClose={onClose}>
        <p>None of your subjects has a weekly schedule yet, so there's no lecture to give. Import your subject outlines (or re-enrol) to fill in the weeks.</p>
      </Window>
    );
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const text = (await extractDocumentText(file)).replace(/\s+\n/g, "\n").trim();
      if (text.length < 200) setError("Couldn't read much text from that file. Slides saved as images can't be read. Try exporting them as a PDF with text, or as .pptx.");
      else setSlides({ name: file.name, text: text.slice(0, MAX_SLIDES) });
    } catch {
      setError("Couldn't read that file. PDF, PowerPoint (.pptx), Word (.docx) and text files work.");
    } finally {
      setReading(false);
    }
  };

  const local = localLecture(subject, week);
  const professor = (cached?.source === "ai" ? null : local?.lecture.professor) ?? null;
  const playLocal = () => {
    if (!local) {
      setError("There's nothing recorded for that week yet.");
      return;
    }
    onPlay({ subject, week, stored: { lecture: local.lecture, source: local.source, at: new Date().toISOString(), withSlides: false } });
  };

  const research = async () => {
    const enrolment = curriculum?.enrolment;
    const input: LectureInput = {
      university: enrolment?.university ?? "",
      year: enrolment?.year ?? new Date().getFullYear(),
      subjectCode: subject.code,
      subjectName: subject.name,
      subjectSummary: subject.summary,
      learningOutcomes: subject.learningOutcomes.slice(0, 12),
      week,
      weekTitle: info.title,
      topics: info.topics.slice(0, 12),
      weekSummary: info.summary,
      keyTerms: subject.keyTerms.slice(0, 30).map((t) => ({ term: t.term, definition: t.definition })),
      slidesText: slides?.text ?? "",
    };
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError(null);
    try {
      const lecture = sanitizeLecture(await fetchLecture(input, controller.signal));
      if (!lecture) throw new CurriculumFetchError({ kind: "failed", message: "The lecture came back empty." });
      const stored: StoredLecture = { lecture, source: "ai", at: new Date().toISOString(), withSlides: Boolean(slides) };
      saveLecture(subject.id, week, stored);
      onPlay({ subject, week, stored });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof CurriculumFetchError ? e.message : "The professor couldn't prepare that lecture.");
    } finally {
      if (abort.current === controller) abort.current = null;
      setLoading(false);
    }
  };

  const start = () => {
    if (cached?.source === "ai" && !slides) onPlay({ subject, week, stored: cached });
    else if (aiAvailable) void research();
    else playLocal();
  };

  return (
    <Window title="Lecture theatre" onClose={onClose} width={640} className="rs-lecture-setup">
      {professor ? (
        <div className="rs-lecture-prof">
          <span className="rs-lecture-prof-icon" aria-hidden>
            <Icon name="cap" />
          </span>
          <div>
            <strong>{professor.name}</strong> <span className="muted small">· {professor.title}</span>
            <p className="small">{professor.style}</p>
          </div>
        </div>
      ) : null}
      <p>Pick a week and the professor teaches it: animated slides on the big screen, told out loud, with a check-in question or two along the way.</p>
      <div className="row">
        <label className="field inline">
          <span>Subject</span>
          <select
            value={subject.id}
            disabled={loading}
            onChange={(e) => {
              const next = withWeeks.find((s) => s.id === e.target.value);
              setSubjectId(e.target.value);
              setWeek(defaultWeek(next));
            }}
          >
            {withWeeks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code}: ` : ""}
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field inline">
          <span>Week</span>
          <select value={week} disabled={loading} onChange={(e) => setWeek(Number(e.target.value))}>
            {subject.weeks.map((w) => {
              const marks = [lectures[lectureKey(subject.id, w.week)] ? "attended" : "", studied[weekKey(subject.id, w.week)]?.studiedAt ? "" : "not studied", w.week === teachingWeek ? "this week" : ""].filter(Boolean);
              return (
                <option key={w.week} value={w.week}>
                  Week {w.week}: {w.title}
                  {marks.length ? ` (${marks.join(", ")})` : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      {info.topics.length ? <p className="muted small">This week: {info.topics.join(" · ")}</p> : null}

      <div className="rs-lecture-slides">
        <label className="rs-button secondary">
          {reading ? "Reading…" : slides ? "Change slides" : "Bring your lecture slides (optional)"}
          <input type="file" hidden accept=".pdf,.pptx,.docx,.txt,.md,application/pdf" disabled={loading || reading} onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {slides ? (
          <span className="small">
            <Icon name="attach" /> {slides.name} ({Math.round(slides.text.length / 1000)}k characters){" "}
            <button type="button" className="link" onClick={() => setSlides(null)}>
              remove
            </button>
          </span>
        ) : (
          <span className="muted small">The lecture follows your own slides when you add them.</span>
        )}
      </div>

      {cached ? (
        <p className="small">
          Saved lecture from {new Date(cached.at).toLocaleDateString()}
          {cached.withSlides ? ", built from your slides" : ""}. Replays are free.
        </p>
      ) : null}
      {aiAvailable ? (
        !cached || slides ? (
          <p className="muted small">The professor researches this week from {curriculum?.enrolment.university.includes("La Trobe") ? "the La Trobe Handbook" : "your subject's handbook data"} and the web{slides ? ", following your slides" : ""}. This takes a minute or two.</p>
        ) : null
      ) : (
        <p className="muted small">
          {local?.source === "notes"
            ? "A full lecture written for this week. (With an ANTHROPIC_API_KEY on the server, the professor can also research it fresh and follow your own slides.)"
            : "AI lectures are off (the server has no ANTHROPIC_API_KEY), so this lecture is built from your handbook data: the week's topics, key terms and questions."}
        </p>
      )}

      <VoicePicker gender={professor ? (PROFESSOR_VOICES[professor.name] ?? null) : null} />

      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <div className="rs-lecture-loading" role="status">
          <span className="rs-spinner" aria-hidden /> The professor is researching week {week}… (a minute or two)
          <button type="button" className="rs-button secondary" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="rs-button big" onClick={start} disabled={reading}>
            <Icon name="play" /> {cached?.source === "ai" && !slides ? "Replay lecture" : aiAvailable ? "Research and start" : "Start lecture"}
          </button>
          {aiAvailable && cached && !slides ? (
            <button type="button" className="rs-button secondary" onClick={() => void research()}>
              Research again
            </button>
          ) : null}
          {aiAvailable || error ? (
            <button type="button" className="rs-button secondary" onClick={playLocal}>
              {local?.source === "notes" ? "Ready-made lecture" : "Quick lecture from handbook"}
            </button>
          ) : null}
        </div>
      )}
    </Window>
  );
}

/** Chooses the professor's voice (per device) and warns when only robotic voices exist. */
function VoicePicker({ gender }: { gender: VoiceGender | null }) {
  const voices = useVoices();
  const [choice, setChoice] = useState(() => readText(VOICE_NAME_KEY));
  const speaker = useRef<Speaker | null>(null);
  useEffect(() => () => speaker.current?.cancel(), []);
  if (!speechAvailable()) return <p className="muted small">This browser can't speak, so you'll read along.</p>;
  const current = pickVoice(choice || null, gender);
  const test = () => {
    speaker.current ??= new Speaker();
    speaker.current.voice = current;
    speaker.current.say("Right, settle in everyone. Today's a good one, I promise. Any questions before we start?");
  };
  return (
    <div className="rs-lecture-voice">
      <label className="field inline">
        <span>Voice</span>
        <select
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            writeText(VOICE_NAME_KEY, e.target.value);
          }}
        >
          <option value="">Automatic (best on this device{current ? `: ${current.name.replace(/^Microsoft |^Google /, "").split(" - ")[0]}` : ""})</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="rs-button secondary" onClick={test}>
        <Icon name="volume" /> Test
      </button>
      {isBasicVoice(current) ? (
        <p className="muted small">This browser only has basic, robotic-sounding voices. For a natural human voice, open the game in Microsoft Edge (its free "Natural" voices), or install extra voices in your system's speech settings.</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function LecturePlayer({ subject, week, stored, lecternId, seat, onBack, onClose }: Playing & { lecternId: string; seat: Seat | null; onBack: () => void; onClose: () => void }) {
  const lecture: Lecture = stored.lecture;
  const total = lecture.segments.length;
  /** -1 = title card, 0..total-1 = segments, total = finished. */
  const [index, setIndex] = useState(-1);
  const [checkAt, setCheckAt] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean[]>(() => lecture.checks.map(() => false));
  const [right, setRight] = useState(0);
  const [voice, setVoice] = useState(() => speechAvailable() && readFlag(VOICE_KEY, true));
  const [auto, setAuto] = useState(() => readFlag(AUTO_KEY, true));
  const [paused, setPaused] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const speaker = useRef<Speaker>(new Speaker());
  const paid = useRef(false);
  const gender = lecture.professor ? (PROFESSOR_VOICES[lecture.professor.name] ?? null) : null;
  const voices = useVoices();
  useEffect(() => {
    speaker.current.voice = pickVoice(readText(VOICE_NAME_KEY) || null, gender);
  }, [voices, gender]);
  const tag = `${subject.code || subject.name} · Week ${week}`;

  // Sit down on the front bench and look at the stage (once, even when development mode runs effects twice).
  const seated = useRef(false);
  useEffect(() => {
    if (seated.current) return;
    seated.current = true;
    // Your camera stays as you set it; you just sit down.
    if (seat) runtime.seat = { ...seat };
    chat(`You take a seat on the front bench. ${lecture.professor ? `${lecture.professor.name} steps up to the lectern.` : ""} ${subject.name}, week ${week}: ${lecture.title}.`.replace(/\s+/g, " "));
    // Only when the lecture starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSpeech = useCallback(() => speaker.current.cancel(), []);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      stopSpeech();
      setPaused(false);
      if (!voice || !speechAvailable() || !text.trim()) return;
      speaker.current.say(text, onDone);
    },
    [voice, stopSpeech],
  );

  const finish = useCallback(() => {
    setIndex(total);
    if (paid.current) return;
    paid.current = true;
    const line = attendLecture(subject.id, week, right);
    setReward(line);
    emit({ type: "sound", name: "quest" });
    chat(`Lecture finished: ${lecture.title}. ${line}`, "quest");
  }, [total, subject.id, week, right, lecture.title]);

  const pendingCheck = useCallback((after: number) => lecture.checks.findIndex((c, i) => c.afterSegment === after && !answered[i]), [lecture.checks, answered]);

  const next = useCallback(() => {
    if (checkAt !== null) return;
    if (index >= 0 && index < total) {
      const c = pendingCheck(index);
      if (c >= 0) {
        setCheckAt(c);
        setChosen(null);
        return;
      }
    }
    if (index + 1 >= total) finish();
    else setIndex(index + 1);
  }, [checkAt, index, total, pendingCheck, finish]);
  const nextRef = useRef(next);
  nextRef.current = next;
  const autoRef = useRef(auto);
  autoRef.current = auto;

  // The screen, the professor and the voice follow the current slide.
  useEffect(() => {
    if (checkAt !== null) return;
    if (index < 0) {
      setLiveSlide({ subject: tag, title: lecture.title, heading: lecture.title, points: lecture.objectives.length ? lecture.objectives : [lecture.hook], index: 0, total });
      speak(lecture.hook || lecture.title);
    } else if (index < total) {
      const seg = lecture.segments[index];
      // The diagram builds over most of the time it takes to say the segment.
      const revealMs = speakingSeconds(seg.narration, voice) * 1000 * 0.8;
      setLiveSlide({ subject: tag, title: lecture.title, heading: seg.heading, points: seg.points, index: index + 1, total, visual: seg.visual, startedAt: performance.now(), revealMs });
      speak(seg.narration, () => {
        if (autoRef.current) nextRef.current();
      });
    } else {
      setLiveSlide({ subject: tag, title: lecture.title, heading: "Key takeaways", points: lecture.takeaways, index: 0, total });
      const wrap = lecture.takeaways.length ? `So, to sum up. ${lecture.takeaways.join(" ")}` : "And that's today's lecture.";
      speak(lecture.video ? `${wrap} ${lecture.video.intro}` : wrap);
    }
  }, [index, checkAt, lecture, tag, total, speak, voice]);

  useEffect(() => {
    runtime.talkingTo = index < total ? lecternId : null;
  }, [index, total, lecternId]);

  useEffect(
    () => () => {
      stopSpeech();
      setLiveSlide(null);
      runtime.talkingTo = null;
    },
    [stopSpeech],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const check = checkAt !== null ? lecture.checks[checkAt] : null;
  useEffect(() => {
    if (check) speak(check.prompt);
  }, [check, speak]);

  const answer = (i: number) => {
    if (!check || checkAt === null || chosen !== null) return;
    setChosen(i);
    const correct = i === check.answerIndex;
    const q = asQuestion(check, week);
    recordAnswer(subject.id, q, correct);
    if (correct) setRight((n) => n + 1);
    else recordMistake(subject.id, q);
    emit({ type: "sound", name: correct ? "coin" : "miss" });
    speak(`${correct ? "Correct." : `Not quite. The answer is ${check.choices[check.answerIndex]}.`} ${check.explanation}`);
  };

  const continueAfterCheck = () => {
    if (checkAt === null) return;
    const done = answered.map((a, i) => a || i === checkAt);
    setAnswered(done);
    setCheckAt(null);
    setChosen(null);
    const more = lecture.checks.findIndex((c, i) => c.afterSegment === index && !done[i]);
    if (more >= 0) setCheckAt(more);
    else if (index + 1 >= total) finish();
    else setIndex(index + 1);
  };

  const togglePause = () => {
    if (!speechAvailable()) return;
    if (paused) window.speechSynthesis.resume();
    else window.speechSynthesis.pause();
    setPaused(!paused);
  };

  const toggleVoice = () => {
    const on = !voice;
    setVoice(on);
    writeFlag(VOICE_KEY, on);
    if (!on) stopSpeech();
  };

  const watch = () => {
    if (!lecture.video) return;
    stopSpeech();
    setWatching(true);
    setLiveSlide({ subject: tag, title: lecture.title, heading: "Watch", points: [], index: 0, total, video: `${lecture.video.title} (${lecture.video.channel})` });
  };

  const replay = () => {
    stopSpeech();
    setWatching(false);
    paid.current = false;
    setAnswered(lecture.checks.map(() => false));
    setRight(0);
    setReward(null);
    setCheckAt(null);
    setIndex(-1);
  };

  const seg = index >= 0 && index < total ? lecture.segments[index] : null;
  const asked = answered.filter(Boolean).length;
  const progress = index < 0 ? 0 : Math.min(1, (index + (index >= total ? 0 : 1)) / total);
  const label = stored.source === "ai" ? (stored.withSlides ? "Researched + your slides" : "Researched") : stored.source === "notes" ? "Lecture notes" : "From your handbook data";

  return (
    <section className="rs-lecture" role="region" aria-label={`Lecture: ${lecture.title}`}>
      <header className="rs-lecture-head">
        <div>
          <strong>{lecture.title}</strong>
          <span className="muted small">
            {" "}
            · {lecture.professor ? `${lecture.professor.name} · ` : ""}
            {subject.code || subject.name} · Week {week}
          </span>
        </div>
        <span className={`rs-lecture-badge ${stored.source}`}>{label}</span>
        <button type="button" className="rs-close" onClick={onClose} aria-label="Leave the lecture">
          <Icon name="close" />
        </button>
      </header>
      <div className="rs-lecture-progress" aria-hidden>
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="rs-lecture-body" aria-live="polite">
        {check ? (
          <div className="rs-lecture-check">
            <p className="rs-lecture-kicker">Check-in question</p>
            <p className="rs-lecture-prompt">{check.prompt}</p>
            <div className="rs-lecture-choices">
              {check.choices.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rs-button secondary ${chosen !== null && i === check.answerIndex ? "right" : ""} ${chosen === i && i !== check.answerIndex ? "wrong" : ""}`}
                  disabled={chosen !== null}
                  onClick={() => answer(i)}
                >
                  {String.fromCharCode(65 + i)}. {c}
                </button>
              ))}
            </div>
            {chosen !== null ? (
              <>
                <p className="small">
                  {chosen === check.answerIndex ? "Correct. " : `The answer is ${String.fromCharCode(65 + check.answerIndex)}. `}
                  {check.explanation}
                  {chosen !== check.answerIndex ? " (Saved to your Grimoire for review.)" : ""}
                </p>
                <button type="button" className="rs-button" onClick={continueAfterCheck}>
                  Continue <Icon name="chevronRight" />
                </button>
              </>
            ) : null}
          </div>
        ) : index < 0 ? (
          <div>
            <p className="rs-lecture-kicker">Today's lecture</p>
            {lecture.hook ? <p className="rs-lecture-hook">{lecture.hook}</p> : null}
            {lecture.objectives.length ? (
              <>
                <p className="small">By the end you should be able to:</p>
                <ul className="small">
                  {lecture.objectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="muted small">
              {total} segment{total === 1 ? "" : "s"}, {lecture.checks.length} check-in question{lecture.checks.length === 1 ? "" : "s"}.
              {speechAvailable() ? "" : " (Your browser can't speak, so read along.)"}
            </p>
          </div>
        ) : seg ? (
          <div>
            <p className="rs-lecture-kicker">
              {index + 1} / {total} · {seg.heading}
            </p>
            <p className="rs-lecture-narration">{seg.narration}</p>
            {seg.example ? (
              <p className="rs-lecture-example">
                <strong>Example:</strong> {seg.example}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="rs-lecture-kicker">Lecture finished</p>
            {lecture.video ? (
              watching ? (
                <div className="rs-lecture-video">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${lecture.video.youtubeId}?rel=0&autoplay=1${lecture.video.start ? `&start=${lecture.video.start}` : ""}`}
                    title={lecture.video.title}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  <p className="muted small">
                    {lecture.video.title} · {lecture.video.channel} (YouTube)
                  </p>
                </div>
              ) : (
                <div className="rs-lecture-video-card">
                  <p className="small">{lecture.video.intro}</p>
                  <button type="button" className="rs-button" onClick={watch}>
                    <Icon name="play" /> Watch: {lecture.video.title}
                  </button>
                  <span className="muted small"> {lecture.video.channel} · plays from YouTube</span>
                </div>
              )
            ) : null}
            {lecture.checks.length ? (
              <p>
                Check-ins: {right} / {asked} right.
              </p>
            ) : null}
            {reward ? <p className="small">{reward}</p> : null}
            {lecture.takeaways.length ? (
              <>
                <p className="small">
                  <strong>Takeaways</strong>
                </p>
                <ul className="small">
                  {lecture.takeaways.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {lecture.furtherReading.length ? (
              <>
                <p className="small">
                  <strong>Further reading</strong>
                </p>
                <ul className="small">
                  {lecture.furtherReading.map((f) => (
                    <li key={f.url}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        {f.title || f.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {stored.source === "ai" && lecture.sources.length ? <p className="muted small">Researched from {lecture.sources.length} source{lecture.sources.length === 1 ? "" : "s"}. Check anything that matters against your official subject material.</p> : null}
          </div>
        )}
      </div>

      <footer className="rs-lecture-controls">
        {index >= total ? (
          <>
            <button type="button" className="rs-button" onClick={replay}>
              <Icon name="replay" /> Replay
            </button>
            <button type="button" className="rs-button secondary" onClick={onBack}>
              Another lecture
            </button>
            <button type="button" className="rs-button secondary" onClick={onClose}>
              Leave
            </button>
          </>
        ) : (
          <>
            <button type="button" className="rs-button secondary" disabled={index < 0 || check !== null} onClick={() => setIndex(index - 1)} aria-label="Previous slide">
              <Icon name="chevronLeft" />
            </button>
            {voice ? (
              <button type="button" className="rs-button secondary" onClick={togglePause} aria-label={paused ? "Resume speaking" : "Pause speaking"}>
                <Icon name={paused ? "play" : "pause"} /> {paused ? "Resume" : "Pause"}
              </button>
            ) : null}
            <button type="button" className="rs-button" disabled={check !== null} onClick={next}>
              {index < 0 ? "Begin" : index + 1 >= total && pendingCheck(index) < 0 ? "Finish" : "Next"} <Icon name="chevronRight" />
            </button>
            {speechAvailable() ? (
              <label className="rs-lecture-toggle">
                <input type="checkbox" checked={voice} onChange={toggleVoice} /> Voice
              </label>
            ) : null}
            {voice ? (
              <label className="rs-lecture-toggle">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={() => {
                    setAuto(!auto);
                    writeFlag(AUTO_KEY, !auto);
                  }}
                />{" "}
                Auto-advance
              </label>
            ) : null}
          </>
        )}
      </footer>
    </section>
  );
}

