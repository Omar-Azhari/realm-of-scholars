/**
 * AI study helpers for Realm of Scholars (server side only):
 *   - weekQuestions: turns one week's lecture slides into trial questions.
 *   - tutorReply: the subject tutor answers a question, grounded in the
 *     subject's curriculum. It explains and guides; it does not write the
 *     student's assessments for them.
 * Same model and safety settings as curriculumResearch.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CURRICULUM_MODEL, CurriculumError, isAiConfigured } from "./curriculumResearch";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_SLIDES_CHARS = 120_000;
const MAX_HISTORY = 12;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, maxItems).map((v) => v.trim().slice(0, maxLength)) : [];
}

// ---------------------------------------------------------------------------
// Week questions from lecture slides
// ---------------------------------------------------------------------------

export interface WeekQuestionsRequest {
  university: string;
  subjectCode: string;
  subjectName: string;
  week: number;
  weekTitle: string;
  slidesText: string;
}

export function validateWeekQuestionsRequest(body: Record<string, unknown>): WeekQuestionsRequest {
  const req: WeekQuestionsRequest = {
    university: text(body.university, 160),
    subjectCode: text(body.subjectCode, 30),
    subjectName: text(body.subjectName, 160),
    week: typeof body.week === "number" && body.week >= 1 && body.week <= 30 ? Math.round(body.week) : 0,
    weekTitle: text(body.weekTitle, 200),
    slidesText: typeof body.slidesText === "string" ? body.slidesText.slice(0, MAX_SLIDES_CHARS) : "",
  };
  if (!req.week) throw new CurriculumError("invalid-request", "A week number is required.");
  if (req.slidesText.trim().length < 200) throw new CurriculumError("invalid-request", "The slides had too little text to write questions from.");
  return req;
}

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "choices", "answerIndex", "explanation", "difficulty"],
        properties: {
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answerIndex: { type: "integer" },
          explanation: { type: "string" },
          difficulty: { type: "integer", enum: [1, 2, 3] },
        },
      },
    },
  },
} as const;

const WEEK_SYSTEM = `You write exam-standard multiple-choice questions for a study game from one week's lecture slides. Rules:
- Write 8-10 questions on the actual content of these slides only. Never ask about the slides themselves ("which slide…"), the lecturer, or admin notices.
- Most questions should be difficulty 2 (explain or distinguish concepts) or 3 (apply to a realistic scenario, calculate, debug, or choose between two closely related options). At most two may be difficulty 1 (recall).
- Exactly four distinct choices. Every wrong choice is a plausible misconception, similar in length and style to the correct one. Vary the position of the correct answer.
- "explanation": why the answer is right and why the most tempting wrong choice is wrong, in one or two sentences.
- Plain text, no markdown. Keep every string concise.`;

function client(): Anthropic {
  return new Anthropic();
}

function blocksText(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function mapError(error: unknown): never {
  if (error instanceof CurriculumError) throw error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    throw new CurriculumError("ai-unavailable", "The server's Anthropic credentials were rejected.");
  }
  if (error instanceof Anthropic.RateLimitError) throw new CurriculumError("rate-limited", "The archivists are busy. Wait a minute and try again.");
  if (error instanceof Anthropic.APIError) throw new CurriculumError("upstream", `AI service error (${error.status ?? "network"}).`);
  throw new CurriculumError("upstream", "The request failed unexpectedly.");
}

export async function weekQuestions(req: WeekQuestionsRequest): Promise<{ questions: unknown[] }> {
  if (!isAiConfigured()) throw new CurriculumError("ai-unavailable", "The server has no ANTHROPIC_API_KEY configured.");
  try {
    const stream = client().beta.messages.stream({
      model: CURRICULUM_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: QUESTIONS_SCHEMA as unknown as Record<string, unknown> } },
      system: WEEK_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Subject: ${[req.subjectCode, req.subjectName].filter(Boolean).join(" — ")}${req.university ? ` (${req.university})` : ""}\nWeek ${req.week}: ${req.weekTitle}\n\n<lecture_slides>\n${req.slidesText}\n</lecture_slides>\n\nWrite the questions.`,
        },
      ],
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new CurriculumError("refused", "The request was declined.");
    if (response.stop_reason === "max_tokens") throw new CurriculumError("upstream", "The questions were too long to finish. Try again.");
    const parsed = JSON.parse(blocksText(response.content)) as { questions?: unknown };
    return { questions: Array.isArray(parsed.questions) ? parsed.questions : [] };
  } catch (error) {
    if (error instanceof SyntaxError) throw new CurriculumError("upstream", "The questions came back malformed. Try again.");
    return mapError(error);
  }
}

// ---------------------------------------------------------------------------
// Explain it back
// ---------------------------------------------------------------------------

export interface ExplainRequest {
  subjectCode: string;
  subjectName: string;
  concept: string;
  /** What the course says about it (definition / week summary), to mark against. */
  reference: string;
  explanation: string;
}

export function validateExplainRequest(body: Record<string, unknown>): ExplainRequest {
  const req: ExplainRequest = {
    subjectCode: text(body.subjectCode, 30),
    subjectName: text(body.subjectName, 160),
    concept: text(body.concept, 160),
    reference: text(body.reference, 1500),
    explanation: text(body.explanation, 3000),
  };
  if (!req.concept) throw new CurriculumError("invalid-request", "Choose a concept to explain.");
  if (req.explanation.split(/\s+/).filter(Boolean).length < 8) throw new CurriculumError("invalid-request", "Write at least a sentence or two.");
  return req;
}

const EXPLAIN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "verdict", "got_right", "missing", "misconceptions", "tip"],
  properties: {
    score: { type: "integer" },
    verdict: { type: "string" },
    got_right: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" } },
    misconceptions: { type: "array", items: { type: "string" } },
    tip: { type: "string" },
  },
} as const;

const EXPLAIN_SYSTEM = `You mark a university student's own explanation of one concept (the Feynman technique). Judge understanding, not writing style or length.
- "score" 0-100: 90+ accurate, complete and in their own words with an example or consequence; 70-89 accurate with small gaps; 50-69 the core idea but important gaps; below 50 wrong or mostly missing.
- "got_right": up to 3 short points they explained correctly.
- "missing": up to 3 important points they left out.
- "misconceptions": anything they stated that is wrong (empty if none). Be specific.
- "verdict": one encouraging sentence. "tip": one concrete thing to revise or add.
Use the course reference when given; your own subject knowledge otherwise. Plain text, concise.`;

export interface ExplainResult {
  score: number;
  verdict: string;
  got_right: string[];
  missing: string[];
  misconceptions: string[];
  tip: string;
}

export async function gradeExplanation(req: ExplainRequest): Promise<ExplainResult> {
  if (!isAiConfigured()) throw new CurriculumError("ai-unavailable", "The server has no ANTHROPIC_API_KEY configured.");
  try {
    const stream = client().beta.messages.stream({
      model: CURRICULUM_MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: EXPLAIN_SCHEMA as unknown as Record<string, unknown> } },
      system: EXPLAIN_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Subject: ${[req.subjectCode, req.subjectName].filter(Boolean).join(" — ")}\nConcept: ${req.concept}\n${req.reference ? `Course reference: ${req.reference}\n` : ""}\n<student_explanation>\n${req.explanation}\n</student_explanation>`,
        },
      ],
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new CurriculumError("refused", "The request was declined.");
    const parsed = JSON.parse(blocksText(response.content)) as ExplainResult;
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      verdict: String(parsed.verdict ?? "").slice(0, 400),
      got_right: stringList(parsed.got_right, 3, 300),
      missing: stringList(parsed.missing, 3, 300),
      misconceptions: stringList(parsed.misconceptions, 3, 300),
      tip: String(parsed.tip ?? "").slice(0, 400),
    };
  } catch (error) {
    if (error instanceof SyntaxError) throw new CurriculumError("upstream", "The marking came back malformed. Try again.");
    return mapError(error);
  }
}

// ---------------------------------------------------------------------------
// Tutor chat
// ---------------------------------------------------------------------------

export interface TutorTurn {
  role: "student" | "tutor";
  text: string;
}

export interface TutorRequest {
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
  history: TutorTurn[];
  question: string;
}

export function validateTutorRequest(body: Record<string, unknown>): TutorRequest {
  const subject = (typeof body.subject === "object" && body.subject !== null ? body.subject : {}) as Record<string, unknown>;
  const weeks = Array.isArray(subject.weeks) ? subject.weeks.slice(0, 20) : [];
  const terms = Array.isArray(subject.keyTerms) ? subject.keyTerms.slice(0, 40) : [];
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  const req: TutorRequest = {
    university: text(body.university, 160),
    tutorName: text(body.tutorName, 80) || "the tutor",
    subject: {
      code: text(subject.code, 30),
      name: text(subject.name, 160),
      summary: text(subject.summary, 1500),
      learningOutcomes: stringList(subject.learningOutcomes, 12, 300),
      weeks: weeks
        .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
        .map((w) => ({ week: typeof w.week === "number" ? Math.round(w.week) : 0, title: text(w.title, 200), topics: stringList(w.topics, 10, 120) })),
      keyTerms: terms
        .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
        .map((t) => ({ term: text(t.term, 80), definition: text(t.definition, 300) })),
      assessments: stringList(subject.assessments, 12, 200),
    },
    currentWeek: typeof body.currentWeek === "number" ? Math.round(body.currentWeek) : null,
    history: history
      .filter((h): h is Record<string, unknown> => typeof h === "object" && h !== null)
      .map((h) => ({ role: h.role === "tutor" ? ("tutor" as const) : ("student" as const), text: text(h.text, 2000) }))
      .filter((h) => h.text),
    question: text(body.question, 2000),
  };
  if (!req.subject.name && !req.subject.code) throw new CurriculumError("invalid-request", "A subject is required.");
  if (!req.question) throw new CurriculumError("invalid-request", "Ask a question first.");
  return req;
}

function tutorSystem(req: TutorRequest): string {
  const s = req.subject;
  const weeks = s.weeks.map((w) => `Week ${w.week}: ${w.title}${w.topics.length ? ` (${w.topics.join(", ")})` : ""}`).join("\n");
  const terms = s.keyTerms.map((t) => `${t.term}: ${t.definition}`).join("\n");
  return `You are ${req.tutorName}, the tutor for ${[s.code, s.name].filter(Boolean).join(" ")}${req.university ? ` at ${req.university}` : ""}, inside a fantasy-themed study game. A university student is asking you about the subject.

How to answer:
- Teach the concept clearly and accurately, at university level, with a short concrete example where it helps. Plain text, no markdown headings; at most about 180 words unless the student asks for more.
- Ground your answer in this subject's curriculum below. Say which week covers it when that helps the student revise. If the question is outside this subject, answer briefly and say so.
- Academic integrity: never write, rewrite or complete the student's assessment for them, and never give answers to graded questions. Explain the ideas, point to what to revise, and ask a guiding question instead.
- If you are unsure about a detail specific to this university (dates, weightings, marking), say so and tell the student to check the subject guide on Moodle.
- Stay warm and lightly in character as a scholar of the realm, but put the teaching first.
- Write like a real person: never use em dashes (use commas, colons or full stops), and avoid AI-sounding words like "delve", "embark" or "journey".

Subject overview: ${s.summary || "not recorded"}
${s.learningOutcomes.length ? `Learning outcomes:\n${s.learningOutcomes.join("\n")}\n` : ""}${weeks ? `Weekly topics:\n${weeks}\n` : ""}${terms ? `Key terms:\n${terms}\n` : ""}${s.assessments.length ? `Assessments: ${s.assessments.join("; ")}\n` : ""}${req.currentWeek ? `The student is currently in Week ${req.currentWeek}.` : ""}`;
}

export async function tutorReply(req: TutorRequest): Promise<{ reply: string }> {
  if (!isAiConfigured()) throw new CurriculumError("ai-unavailable", "The server has no ANTHROPIC_API_KEY configured.");
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of req.history) {
    const role = turn.role === "tutor" ? "assistant" : "user";
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n\n${turn.text}`;
    else messages.push({ role, content: turn.text });
  }
  if (messages[0]?.role === "assistant") messages.shift();
  const last = messages[messages.length - 1];
  if (last?.role === "user") last.content = `${last.content as string}\n\n${req.question}`;
  else messages.push({ role: "user", content: req.question });

  try {
    const stream = client().beta.messages.stream({
      model: CURRICULUM_MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: tutorSystem(req),
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new CurriculumError("refused", "The tutor declined to answer that.");
    const reply = blocksText(response.content).trim();
    if (!reply) throw new CurriculumError("upstream", "The tutor had nothing to say. Try asking another way.");
    return { reply };
  } catch (error) {
    return mapError(error);
  }
}
