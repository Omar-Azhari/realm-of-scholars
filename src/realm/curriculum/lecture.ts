/**
 * Lectures for the lecture hall. A lecture is spoken segments (with slide
 * bullets and an example), check-in questions, takeaways and further reading.
 *
 *  - With AI on the server, a lecture is researched on the web (starting from
 *    the La Trobe Handbook for La Trobe subjects), follows your own uploaded
 *    slides when you give them, and is cached on this device per week.
 *  - Without AI, subjects with ready-made lectures (banks/lectures) get those;
 *    any other subject gets a shorter lecture built from what the game already
 *    knows about the week (handbook topics, summary, key terms, questions), and
 *    it says so.
 */

import type { RealmQuestion, RealmSubject } from "../types";
import { LECTURE_BANKS } from "./banks/lectures";
import type { LectureVideo, LectureVisual, Professor } from "./banks/lectures/types";
import { sanitizeVisual } from "../lecture/visuals";

export interface LectureSegment {
  heading: string;
  narration: string;
  points: string[];
  example: string;
  /** Animated diagram for the theatre screen. */
  visual?: LectureVisual;
}

export interface LectureCheck {
  afterSegment: number;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface Lecture {
  title: string;
  hook: string;
  objectives: string[];
  segments: LectureSegment[];
  checks: LectureCheck[];
  takeaways: string[];
  furtherReading: Array<{ title: string; url: string }>;
  sources: string[];
  /** A real explainer video to finish with. */
  video?: LectureVideo;
  /** Who teaches it (ready-made lectures). */
  professor?: Professor;
}

export interface StoredLecture {
  lecture: Lecture;
  /** "ai": researched lecture; "notes": ready-made lecture; "handbook": built from the game's own data. */
  source: "ai" | "notes" | "handbook";
  at: string;
  /** Whether the student's own slides were used. */
  withSlides: boolean;
}

const KEY = (subjectId: string, week: number) => `unigame.realm.lecture.${subjectId}.${week}`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const strs = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, n).map((x) => x.slice(0, max)) : []);

/** Accepts anything (a cache entry, a server reply); returns a valid lecture or null. */
export function sanitizeLecture(raw: unknown): Lecture | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const segments = (Array.isArray(r.segments) ? r.segments : [])
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({ heading: str(s.heading, 120), narration: str(s.narration, 2400), points: strs(s.points, 6, 200), example: str(s.example, 600), visual: sanitizeVisual(s.visual) }))
    .filter((s) => s.heading && s.narration)
    .slice(0, 12);
  if (segments.length === 0) return null;
  const checks = (Array.isArray(r.checks) ? r.checks : [])
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      afterSegment: typeof c.afterSegment === "number" ? Math.max(0, Math.min(segments.length - 1, Math.round(c.afterSegment))) : 0,
      prompt: str(c.prompt, 400),
      choices: strs(c.choices, 4, 200),
      answerIndex: typeof c.answerIndex === "number" ? Math.round(c.answerIndex) : -1,
      explanation: str(c.explanation, 500),
    }))
    .filter((c) => c.prompt && c.choices.length === 4 && c.answerIndex >= 0 && c.answerIndex < 4);
  return {
    title: str(r.title, 160) || segments[0].heading,
    hook: str(r.hook, 600),
    objectives: strs(r.objectives, 6, 200),
    segments,
    checks,
    takeaways: strs(r.takeaways, 8, 300),
    furtherReading: (Array.isArray(r.furtherReading) ? r.furtherReading : [])
      .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
      .map((f) => ({ title: str(f.title, 160), url: str(f.url, 500) }))
      .filter((f) => /^https:\/\//.test(f.url)),
    sources: strs(r.sources, 15, 500).filter((u) => /^https:\/\//.test(u)),
    video: sanitizeVideo(r.video),
    professor: sanitizeProfessor(r.professor),
  };
}

function sanitizeVideo(raw: unknown): LectureVideo | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const v = raw as Record<string, unknown>;
  const youtubeId = str(v.youtubeId, 11);
  if (!/^[\w-]{11}$/.test(youtubeId)) return undefined;
  const start = typeof v.start === "number" && Number.isFinite(v.start) ? Math.max(0, Math.round(v.start)) : undefined;
  return { youtubeId, title: str(v.title, 200), channel: str(v.channel, 100), intro: str(v.intro, 400), start };
}

function sanitizeProfessor(raw: unknown): Professor | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const p = raw as Record<string, unknown>;
  const name = str(p.name, 80);
  return name ? { name, title: str(p.title, 120), style: str(p.style, 300) } : undefined;
}

export function loadLecture(subjectId: string, week: number): StoredLecture | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(subjectId, week)) ?? "null") as Record<string, unknown> | null;
    const lecture = raw ? sanitizeLecture(raw.lecture) : null;
    if (!raw || !lecture) return null;
    return { lecture, source: raw.source === "ai" || raw.source === "notes" ? raw.source : "handbook", at: str(raw.at, 40), withSlides: raw.withSlides === true };
  } catch {
    return null;
  }
}

export function saveLecture(subjectId: string, week: number, stored: StoredLecture): void {
  try {
    localStorage.setItem(KEY(subjectId, week), JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the lecture still plays this time.
  }
}

/** Words worth matching on, lower-cased and roughly singular ("personas" -> "persona"). */
function stems(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.replace(/(ies|es|s)$/, ""));
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Lower-cases the first letter for use mid-sentence, unless the first word is an acronym ("ISO", "UX"). */
const midSentence = (s: string) => (/^[A-Z]{2,}\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** The week's topics, or (when the handbook only gave a summary) the phrases in its summary. */
function weekTopics(topics: string[], summary: string): string[] {
  if (topics.length) return topics.slice(0, 6);
  return summary
    .replace(/\.\s*$/, "")
    .split(/[,;]\s*/)
    .map((t) => t.replace(/^(and|or)\s+/i, "").trim())
    .filter((t) => (t.length >= 4 || /^[A-Z]{2,}$/.test(t)) && t.split(" ").length <= 8)
    .map(capitalise)
    .slice(0, 6);
}

/** A lecture from what the game already knows about the week — no AI needed. */
export function handbookLecture(subject: RealmSubject, week: number): Lecture | null {
  const w = subject.weeks.find((x) => x.week === week);
  if (!w) return null;
  const topics = weekTopics(w.topics, w.summary);
  const questions = subject.questions.filter((q) => q.week === week);
  const usedTerms = new Set<string>();
  // Each question is taught under the topic its wording matches most often. Words from the week's title
  // ("databases" in "Databases for web apps") are shared by every topic, so they don't count.
  const titleWords = new Set(stems(w.title));
  const topicWords = topics.map((t) => stems(t).filter((x) => x.length >= 5 && !titleWords.has(x)));
  const topicOf = new Map<string, number>();
  for (const q of questions) {
    if (!q.explanation) continue;
    const words = stems(`${q.prompt} ${q.explanation}`);
    let best = -1;
    let bestScore = 0;
    topicWords.forEach((tw, i) => {
      const score = words.filter((x) => tw.some((t) => x.startsWith(t) || t.startsWith(x))).length;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    if (best >= 0) topicOf.set(q.id, best);
  }
  const segments: LectureSegment[] = [];
  segments.push({
    heading: `Week ${week}: ${w.title}`,
    narration: `Welcome to week ${week} of ${subject.name}. This week is about ${w.title.toLowerCase()}. ${w.summary || ""} ${
      topics.length ? `We'll work through ${topics.length} ideas: ${topics.join(", ")}.` : ""
    } Listen for how each one connects back to what this subject is trying to teach you.`
      .replace(/\s+/g, " ")
      .trim(),
    points: topics.slice(0, 5),
    example: "",
  });
  topics.forEach((topic, topicIndex) => {
    const words = stems(topic);
    const related = subject.keyTerms.filter((t) => {
      const termWords = stems(t.term);
      return termWords.length > 0 && termWords.every((tw) => words.some((x) => x.startsWith(tw) || tw.startsWith(x)));
    });
    related.forEach((t) => usedTerms.add(t.term));
    const taught = questions.filter((q) => topicOf.get(q.id) === topicIndex);
    const lines = [
      ...related.map((t) => `${t.term} means ${midSentence(t.definition.replace(/\.$/, ""))}.`),
      ...taught.map((q, i) => `${["Here's the key idea:", "Remember:", "And note:"][i % 3]} ${q.explanation.replace(/\.$/, "")}.`),
    ];
    segments.push({
      heading: topic,
      narration: `${topic}. ${lines.length ? lines.join(" ") : `This is one of the core ideas of the week. Your lecture slides and readings go into the detail: note the definition, an example, and how it relates to ${w.title.toLowerCase()}.`}`,
      points: [...related.slice(0, 3).map((t) => `${t.term}: ${t.definition}`), ...taught.slice(0, 2).map((q) => q.explanation)].slice(0, 4).concat(lines.length ? [] : [topic]),
      example: "",
    });
  });
  const weekText = stems(`${w.title} ${w.summary} ${topics.join(" ")} ${questions.map((q) => `${q.prompt} ${q.explanation}`).join(" ")}`);
  const terms = subject.keyTerms.filter((t) => !usedTerms.has(t.term) && stems(t.term).length > 0 && stems(t.term).every((tw) => weekText.includes(tw)));
  if (terms.length) {
    segments.push({
      heading: "Key terms",
      narration: `Before we finish, the key terms for this week. ${terms
        .slice(0, 5)
        .map((t) => `${t.term}: ${t.definition.replace(/\.$/, "")}.`)
        .join(" ")}`,
      points: terms.slice(0, 5).map((t) => `${t.term}: ${t.definition}`),
      example: "",
    });
  }
  const checks = placeChecks(segments, questions);
  const urls = subject.sourceUrls.filter((u) => /^https:\/\//.test(u));
  return {
    title: `Week ${week}: ${w.title}`,
    hook: `Week ${week} of ${subject.name}: ${w.title}.${w.summary ? ` ${w.summary}` : ""}`,
    objectives: subject.learningOutcomes.length ? subject.learningOutcomes.slice(0, 3) : topics.slice(0, 3).map((t) => `Explain ${midSentence(t)}`),
    segments,
    checks,
    takeaways: segments.slice(1).map((s) => (s.points[0] && s.points[0] !== s.heading ? s.points[0] : s.heading)).slice(0, 6),
    furtherReading: urls.slice(0, 3).map((url) => ({ title: "Subject source", url })),
    sources: urls,
  };
}

/**
 * Picks at most `max` of the week's questions as check-ins, each placed after the
 * segment that teaches it best (never after the opening), so the lecture teaches
 * first and only checks lightly.
 */
export function placeChecks(segments: LectureSegment[], questions: RealmQuestion[], max = 2): LectureCheck[] {
  const scored = questions
    .map((q) => {
      const words = stems(`${q.prompt} ${q.choices[q.answerIndex] ?? ""} ${q.explanation}`).filter((x) => x.length >= 5);
      let best = -1;
      let bestScore = 0;
      segments.forEach((s, i) => {
        if (i === 0) return;
        const seen = new Set(stems(`${s.heading} ${s.narration} ${s.points.join(" ")}`));
        const score = words.filter((x) => seen.has(x)).length;
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      });
      return { q, best, bestScore };
    })
    .sort((a, b) => b.bestScore - a.bestScore);
  const used = new Set<number>();
  const out: LectureCheck[] = [];
  for (const { q, best } of scored) {
    if (out.length >= max || segments.length < 2) break;
    let at = best >= 1 && !used.has(best) ? best : -1;
    if (at < 0) at = [Math.floor(segments.length / 2), segments.length - 1].find((i) => i >= 1 && !used.has(i)) ?? -1;
    if (at < 0) continue;
    used.add(at);
    out.push({ afterSegment: at, prompt: q.prompt, choices: q.choices, answerIndex: q.answerIndex, explanation: q.explanation });
  }
  return out.sort((a, b) => a.afterSegment - b.afterSegment);
}

/** A ready-made lecture written for this week (banks/lectures), when the subject has one. */
export function notesLecture(subject: RealmSubject, week: number): Lecture | null {
  const w = subject.weeks.find((x) => x.week === week);
  const bank = LECTURE_BANKS.find((b) => b.match(subject.code, subject.name));
  const lec = bank?.weeks[week];
  if (!w || !lec) return null;
  // Same subject name at another university may teach different weeks: the topics must line up.
  const ours = new Set(stems(`${w.title} ${w.topics.join(" ")} ${w.summary}`));
  if (!stems(`${lec.title} ${lec.segments.map((s) => s.heading).join(" ")}`).some((x) => x.length >= 4 && ours.has(x))) return null;
  const segments = lec.segments.map((s) => ({ ...s, points: [...s.points], visual: sanitizeVisual(s.visual) }));
  const urls = subject.sourceUrls.filter((u) => /^https:\/\//.test(u));
  return {
    title: `Week ${week}: ${lec.title}`,
    hook: lec.hook,
    objectives: [...lec.objectives],
    segments,
    checks: placeChecks(segments, subject.questions.filter((q) => q.week === week)),
    takeaways: [...lec.takeaways],
    furtherReading: urls.slice(0, 3).map((url) => ({ title: "Subject handbook", url })),
    sources: urls,
    video: lec.video ? { ...lec.video } : undefined,
    professor: bank?.professor ? { ...bank.professor } : undefined,
  };
}

/** The best lecture available without AI: the ready-made one, else one built from the handbook data. */
export function localLecture(subject: RealmSubject, week: number): { lecture: Lecture; source: "notes" | "handbook" } | null {
  const notes = notesLecture(subject, week);
  if (notes) return { lecture: notes, source: "notes" };
  const hb = handbookLecture(subject, week);
  return hb ? { lecture: hb, source: "handbook" } : null;
}
