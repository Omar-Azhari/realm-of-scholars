/**
 * Lecture hall (server side only): writes a full lecture for one teaching
 * week of a subject, in two steps —
 *   1. research: Claude searches the web (for La Trobe subjects, starting
 *      from the official Handbook page) and reads the student's own lecture
 *      slides when they upload them, then writes research notes;
 *   2. structure: the notes plus the week's handbook data become a lecture —
 *      spoken segments with slide bullets and examples, check-in questions,
 *      takeaways and further reading (only URLs that were actually found).
 * Same model, fallback and error handling as the rest of the realm's AI.
 */

import Anthropic from "@anthropic-ai/sdk";
import { collectUrls, CURRICULUM_MODEL, CurriculumError, isAiConfigured } from "./curriculumResearch";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_SLIDES_CHARS = 80_000;
const LA_TROBE_CODE = /^[A-Z]{3}[1-5][A-Z0-9]{2,4}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, maxItems).map((v) => v.trim().slice(0, maxLength)).filter(Boolean) : [];
}

export interface LectureRequest {
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
  /** The student's own slides for this week, when uploaded. */
  slidesText: string;
}

export function validateLectureRequest(body: Record<string, unknown>): LectureRequest {
  const terms = Array.isArray(body.keyTerms) ? body.keyTerms.slice(0, 30) : [];
  const req: LectureRequest = {
    university: text(body.university, 160),
    year: typeof body.year === "number" && body.year >= 2000 && body.year <= 2100 ? Math.round(body.year) : new Date().getFullYear(),
    subjectCode: text(body.subjectCode, 30),
    subjectName: text(body.subjectName, 160),
    subjectSummary: text(body.subjectSummary, 2000),
    learningOutcomes: list(body.learningOutcomes, 12, 300),
    week: typeof body.week === "number" && body.week >= 1 && body.week <= 30 ? Math.round(body.week) : 0,
    weekTitle: text(body.weekTitle, 200),
    topics: list(body.topics, 12, 160),
    weekSummary: text(body.weekSummary, 2000),
    keyTerms: terms
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({ term: text(t.term, 80), definition: text(t.definition, 300) }))
      .filter((t) => t.term),
    slidesText: typeof body.slidesText === "string" ? body.slidesText.slice(0, MAX_SLIDES_CHARS) : "",
  };
  if (!req.week) throw new CurriculumError("invalid-request", "A week number is required.");
  if (!req.subjectName && !req.subjectCode) throw new CurriculumError("invalid-request", "A subject is required.");
  if (!req.weekTitle && req.topics.length === 0 && req.slidesText.trim().length < 200) throw new CurriculumError("invalid-request", "There's nothing recorded for that week to teach from yet.");
  return req;
}

function describeWeek(req: LectureRequest): string {
  const lines = [
    `University: ${req.university || "not given"}`,
    `Subject: ${[req.subjectCode, req.subjectName].filter(Boolean).join(" — ")}`,
    req.subjectSummary ? `Subject overview (from the handbook): ${req.subjectSummary}` : "",
    req.learningOutcomes.length ? `Intended learning outcomes:\n- ${req.learningOutcomes.join("\n- ")}` : "",
    `Week ${req.week}: ${req.weekTitle || "(untitled)"}`,
    req.topics.length ? `Topics this week: ${req.topics.join("; ")}` : "",
    req.weekSummary ? `Week summary: ${req.weekSummary}` : "",
    req.keyTerms.length ? `Key terms the course uses:\n${req.keyTerms.map((t) => `- ${t.term}: ${t.definition}`).join("\n")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const RESEARCH_SYSTEM = `You are preparing to teach one week of a university subject. Research the week's topics so the lecture is accurate, current and well explained.
- Use web search and web fetch. Prefer authoritative sources: the university's own pages (handbook, library guides), standards bodies, official documentation, textbooks, and reputable university teaching material.
- When the student's own lecture slides are provided, they are the primary source: the lecture must follow them. Use the web to explain, correct and enrich, not to replace them.
- Write research notes, not the lecture: the key ideas in a sensible teaching order, precise definitions, one or two worked examples or real-world cases, common misconceptions, and how this week connects to the subject's learning outcomes.
- Note which source each important claim comes from. If something can't be verified, say so rather than guessing. Never invent university-specific facts (dates, weightings, lecturers).`;

const LECTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hook", "objectives", "segments", "checks", "takeaways", "further_reading"],
  properties: {
    title: { type: "string" },
    hook: { type: "string" },
    objectives: { type: "array", items: { type: "string" } },
    segments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "narration", "points", "example"],
        properties: {
          heading: { type: "string" },
          narration: { type: "string" },
          points: { type: "array", items: { type: "string" } },
          example: { type: "string" },
        },
      },
    },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["after_segment", "prompt", "choices", "answer_index", "explanation"],
        properties: {
          after_segment: { type: "integer" },
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          explanation: { type: "string" },
        },
      },
    },
    takeaways: { type: "array", items: { type: "string" } },
    further_reading: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: { title: { type: "string" }, url: { type: "string" } },
      },
    },
  },
} as const;

const LECTURE_SYSTEM = `You are a university lecturer, delivering one week's lecture inside a study game where a professor speaks to the student in a lecture theatre. Turn the week information and research notes into the lecture. Your job is to TEACH: explain each idea from the ground up so a student who missed the class could understand it, then check understanding only lightly.
- "hook": one or two spoken sentences that open the lecture with why this matters.
- "objectives": 3-5 things the student will be able to do afterwards.
- "segments": 7-10 segments in teaching order: motivation, then each concept defined, explained (why and how it works), contrasted with common mistakes, and applied. Each has a short "heading" (the slide title), "narration" (what the professor says aloud, 130-190 words, clear and conversational, explaining rather than listing; read aloud by text-to-speech), "points" (3-5 short slide bullets), and "example" (a concrete worked example or real case in 1-3 sentences, or an empty string).
- "checks": 2-3 multiple-choice check-ins, each placed after the segment that taught it (never after the first segment) ("after_segment" is the 0-based segment index). Exactly four plausible choices, vary the correct position, and "explanation" says why the answer is right.
- "takeaways": 4-6 one-sentence summary points.
- "further_reading": 2-5 items, using ONLY URLs that appear in the research notes. Never invent a URL.
- Follow the student's own slides when they were provided. Be accurate; if the notes flagged something as unverified, leave it out. Plain text everywhere, no markdown. Never use em dashes; use commas, colons or full stops instead. Sound like a real person, not like AI writing (no "delve", "embark", "journey", "tapestry").`;

export interface Lecture {
  title: string;
  hook: string;
  objectives: string[];
  segments: Array<{ heading: string; narration: string; points: string[]; example: string }>;
  checks: Array<{ afterSegment: number; prompt: string; choices: string[]; answerIndex: number; explanation: string }>;
  takeaways: string[];
  furtherReading: Array<{ title: string; url: string }>;
  sources: string[];
}

function client(): Anthropic {
  return new Anthropic();
}

function blocksText(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function research(req: LectureRequest): Promise<{ notes: string; sources: string[] }> {
  const code = req.subjectCode.toUpperCase();
  const laTrobe = /la\s*trobe/i.test(req.university) && LA_TROBE_CODE.test(code);
  const start = laTrobe ? `\n\nStart by fetching the official handbook page: https://handbook.latrobe.edu.au/subjects/${req.year}/${code.toLowerCase()}` : "";
  const slides = req.slidesText.trim().length >= 200 ? `\n\n<student_lecture_slides>\n${req.slidesText}\n</student_lecture_slides>` : "";
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `Research this week so it can be taught well.\n\n${describeWeek(req)}${start}${slides}` }];
  const sources = new Set<string>();
  let notes = "";
  for (let turn = 0; turn < 5; turn++) {
    const stream = client().beta.messages.stream({
      model: CURRICULUM_MODEL,
      max_tokens: 24000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: RESEARCH_SYSTEM,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 6 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
      ],
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new CurriculumError("refused", "The research request was declined.");
    collectUrls(response.content, sources);
    notes += blocksText(response.content);
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  for (const match of notes.matchAll(/https?:\/\/[^\s)\]>"']+/g)) sources.add(match[0].replace(/[.,;]+$/, ""));
  return { notes: notes.trim(), sources: [...sources].slice(0, 15) };
}

/** Keeps only well-formed parts of the model's lecture, and only URLs research actually found. */
export function cleanLecture(raw: unknown, sources: string[]): Lecture {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const segments = (Array.isArray(r.segments) ? r.segments : [])
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({ heading: text(s.heading, 120), narration: text(s.narration, 1600), points: list(s.points, 6, 200), example: text(s.example, 600) }))
    .filter((s) => s.heading && s.narration)
    .slice(0, 12);
  const checks = (Array.isArray(r.checks) ? r.checks : [])
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      afterSegment: typeof c.after_segment === "number" ? Math.max(0, Math.min(segments.length - 1, Math.round(c.after_segment))) : 0,
      prompt: text(c.prompt, 400),
      choices: list(c.choices, 4, 200),
      answerIndex: typeof c.answer_index === "number" ? Math.round(c.answer_index) : -1,
      explanation: text(c.explanation, 500),
    }))
    .filter((c) => c.prompt && c.choices.length === 4 && c.answerIndex >= 0 && c.answerIndex < 4)
    .slice(0, 6);
  const known = new Set(sources);
  const furtherReading = (Array.isArray(r.further_reading) ? r.further_reading : [])
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({ title: text(f.title, 160), url: text(f.url, 500) }))
    .filter((f) => /^https:\/\//.test(f.url) && known.has(f.url))
    .slice(0, 6);
  return {
    title: text(r.title, 160),
    hook: text(r.hook, 600),
    objectives: list(r.objectives, 6, 200),
    segments,
    checks,
    takeaways: list(r.takeaways, 8, 300),
    furtherReading,
    sources: sources.filter((u) => /^https:\/\//.test(u)),
  };
}

export async function writeLecture(req: LectureRequest): Promise<Lecture> {
  if (!isAiConfigured()) throw new CurriculumError("ai-unavailable", "The server has no ANTHROPIC_API_KEY configured.");
  try {
    const { notes, sources } = await research(req);
    const slides = req.slidesText.trim().length >= 200 ? `\n\n<student_lecture_slides>\n${req.slidesText}\n</student_lecture_slides>` : "";
    const stream = client().beta.messages.stream({
      model: CURRICULUM_MODEL,
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: LECTURE_SCHEMA as unknown as Record<string, unknown> } },
      system: LECTURE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${describeWeek(req)}${slides}\n\n<research_notes>\n${notes || "(no research notes: teach from the week information above)"}\n</research_notes>\n\n<found_urls>\n${sources.join("\n")}\n</found_urls>\n\nWrite the lecture.`,
        },
      ],
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new CurriculumError("refused", "The lecture request was declined.");
    if (response.stop_reason === "max_tokens") throw new CurriculumError("upstream", "The lecture was too long to finish. Try again.");
    const lecture = cleanLecture(JSON.parse(blocksText(response.content)), sources);
    if (lecture.segments.length < 3) throw new CurriculumError("upstream", "The lecture came back too short. Try again.");
    return lecture;
  } catch (error) {
    if (error instanceof CurriculumError) throw error;
    if (error instanceof SyntaxError) throw new CurriculumError("upstream", "The lecture came back malformed. Try again.");
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new CurriculumError("ai-unavailable", "The server's Anthropic credentials were rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) throw new CurriculumError("rate-limited", "The lecturers are busy. Wait a minute and try again.");
    if (error instanceof Anthropic.APIError) throw new CurriculumError("upstream", `AI service error (${error.status ?? "network"}).`);
    throw new CurriculumError("upstream", "The lecture failed unexpectedly.");
  }
}
