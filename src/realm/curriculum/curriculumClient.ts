/**
 * Browser side of curriculum gathering. Calls /api/realm/curriculum (AI
 * research or uploaded-outline structuring) and extracts text from an
 * uploaded PDF/DOCX/TXT using the project's existing extractors.
 */

import type { Enrolment } from "../types";

export interface SubjectRequest {
  code: string;
  name: string;
  documentText: string | null;
}

export interface CurriculumResponse {
  subject: unknown;
  sources: string[];
  warnings: string[];
}

export type CurriculumFailure =
  | { kind: "ai-unavailable"; message: string }
  | { kind: "rate-limited"; message: string }
  | { kind: "failed"; message: string };

export class CurriculumFetchError extends Error {
  constructor(public readonly failure: CurriculumFailure) {
    super(failure.message);
  }
}

const ENDPOINT = "/api/realm/curriculum";

/** True when the server can do AI research. False when it has no key, or when no server is reachable (static hosting). */
export async function checkResearchAvailable(): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT, { method: "GET" });
    if (!response.ok) return false;
    const body = (await response.json()) as { aiConfigured?: boolean };
    return body.aiConfigured === true;
  } catch {
    return false;
  }
}

export async function fetchSubjectCurriculum(enrolment: Enrolment, subject: SubjectRequest, signal?: AbortSignal): Promise<CurriculumResponse> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        country: enrolment.country,
        city: enrolment.city,
        university: enrolment.university,
        course: enrolment.course,
        yearLevel: enrolment.yearLevel,
        teachingPeriod: enrolment.teachingPeriod,
        year: enrolment.year,
        subjectCode: subject.code,
        subjectName: subject.name,
        documentText: subject.documentText,
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new CurriculumFetchError({ kind: "ai-unavailable", message: "Could not reach the research server." });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // fall through to status handling
  }
  const message = typeof body.message === "string" ? body.message : `Request failed (${response.status}).`;
  if (response.status === 503 || response.status === 404) throw new CurriculumFetchError({ kind: "ai-unavailable", message });
  if (response.status === 429) throw new CurriculumFetchError({ kind: "rate-limited", message });
  if (!response.ok) throw new CurriculumFetchError({ kind: "failed", message });
  return {
    subject: body.subject,
    sources: Array.isArray(body.sources) ? (body.sources as unknown[]).filter((s): s is string => typeof s === "string") : [],
    warnings: Array.isArray(body.warnings) ? (body.warnings as unknown[]).filter((s): s is string => typeof s === "string") : [],
  };
}

/** Reads text out of an uploaded subject outline. Supports PDF, DOCX, TXT/MD. */
export async function extractDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const bytes = await file.arrayBuffer();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractPdfPages } = await import("../../import/providers/pdfExtract");
    const pages = await extractPdfPages(bytes, new AbortController().signal);
    return pages.map((p) => p.text).join("\n\n");
  }
  if (name.endsWith(".docx")) {
    const { extractDocxText } = await import("../../import/providers/docxExtract");
    return extractDocxText(bytes);
  }
  if (name.endsWith(".pptx")) {
    const { extractPptxText } = await import("./pptxExtract");
    return extractPptxText(bytes);
  }
  return new TextDecoder().decode(bytes);
}

async function postJson(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new CurriculumFetchError({ kind: "ai-unavailable", message: "Could not reach the server." });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // fall through to status handling
  }
  const message = typeof body.message === "string" ? body.message : `Request failed (${response.status}).`;
  if (response.status === 503 || response.status === 404) throw new CurriculumFetchError({ kind: "ai-unavailable", message });
  if (response.status === 429) throw new CurriculumFetchError({ kind: "rate-limited", message });
  if (!response.ok) throw new CurriculumFetchError({ kind: "failed", message });
  return body;
}

export interface WeekQuestionsInput {
  university: string;
  subjectCode: string;
  subjectName: string;
  week: number;
  weekTitle: string;
  slidesText: string;
}

/** Raw (unvalidated) questions written from lecture slides — run them through normalizeQuestions. */
export async function fetchWeekQuestions(input: WeekQuestionsInput, signal?: AbortSignal): Promise<unknown[]> {
  const body = await postJson("/api/realm/study", { mode: "week-questions", ...input }, signal);
  return Array.isArray(body.questions) ? body.questions : [];
}

export interface TutorInput {
  university: string;
  tutorName: string;
  subject: {
    code: string;
    name: string;
    summary: string;
    learningOutcomes: string[];
    weeks: Array<{ week: number; title: string; topics: string[] }>;
    keyTerms: Array<{ term: string; definition: string }>;
    assessments: string[];
  };
  currentWeek: number | null;
  history: Array<{ role: "student" | "tutor"; text: string }>;
  question: string;
}

export async function askTutor(input: TutorInput, signal?: AbortSignal): Promise<string> {
  const body = await postJson("/api/realm/study", { mode: "tutor", ...input }, signal);
  if (typeof body.reply !== "string") throw new CurriculumFetchError({ kind: "failed", message: "The tutor didn't answer." });
  return body.reply;
}

export interface ExplainInput {
  subjectCode: string;
  subjectName: string;
  concept: string;
  reference: string;
  explanation: string;
}

export interface ExplainFeedback {
  score: number;
  verdict: string;
  got_right: string[];
  missing: string[];
  misconceptions: string[];
  tip: string;
}

export async function gradeExplanation(input: ExplainInput, signal?: AbortSignal): Promise<ExplainFeedback> {
  const body = await postJson("/api/realm/study", { mode: "explain", ...input }, signal);
  if (typeof body.score !== "number") throw new CurriculumFetchError({ kind: "failed", message: "The tutor couldn't mark that." });
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    score: body.score,
    verdict: typeof body.verdict === "string" ? body.verdict : "",
    got_right: list(body.got_right),
    missing: list(body.missing),
    misconceptions: list(body.misconceptions),
    tip: typeof body.tip === "string" ? body.tip : "",
  };
}

/** Fetches a La Trobe Moodle calendar export through the server (browsers can't read it directly). */
export async function fetchMoodleCalendar(url: string, signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/realm/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal });
  } catch {
    throw new Error("Could not reach the server. Download the .ics file from Moodle and upload it instead.");
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // handled below
  }
  if (!response.ok || typeof body.text !== "string") {
    throw new Error(typeof body.message === "string" ? body.message : "The calendar link didn't work. Download the .ics file from Moodle and upload it instead.");
  }
  return body.text;
}

export interface LectureInput {
  university: string;
  year: number;
  subjectCode: string;
  subjectName: string;
  subjectSummary: string;
  learningOutcomes: string[];
  week: number;
  weekTitle: string;
  topics: string[];
  weekSummary: string;
  keyTerms: Array<{ term: string; definition: string }>;
  slidesText: string;
}

/** Asks the server to research and write a lecture (a minute or two). Returns the raw lecture to sanitise. */
export async function fetchLecture(input: LectureInput, signal?: AbortSignal): Promise<unknown> {
  const body = await postJson("/api/realm/lecture", input, signal);
  return body.lecture;
}
