/**
 * AI curriculum research for Realm of Scholars.
 *
 * Two calls per subject:
 *   1. RESEARCH — Claude searches the web (official handbook / unit outline
 *      pages for the student's university, course and teaching period) and
 *      writes a plain-text brief, citing what it found.
 *      Skipped when the student uploaded their own subject outline: the
 *      document text is the source instead.
 *   2. STRUCTURE — Claude turns the brief (or document) into strict JSON
 *      matching the game's curriculum schema, including practice questions
 *      and key terms for the mini-games.
 *
 * Honesty rule carried into the prompts: anything not found in an
 * official source is marked "inferred" and explained in `sourceNote`, so
 * the game can tell the player to verify it — weights and due dates are
 * never invented.
 */

import Anthropic from "@anthropic-ai/sdk";

export const CURRICULUM_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_DOCUMENT_CHARS = 300_000;

export interface CurriculumRequest {
  country: string;
  city: string;
  university: string;
  course: string;
  yearLevel: string;
  teachingPeriod: string;
  year: number;
  subjectCode: string;
  subjectName: string;
  /** Text extracted from a subject outline the student uploaded. When present, no web research happens. */
  documentText: string | null;
}

export interface CurriculumResult {
  subject: unknown;
  sources: string[];
  warnings: string[];
}

export class CurriculumError extends Error {
  constructor(
    public readonly category: "ai-unavailable" | "invalid-request" | "rate-limited" | "refused" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validateCurriculumRequest(body: unknown): CurriculumRequest {
  if (!body || typeof body !== "object") throw new CurriculumError("invalid-request", "Body must be a JSON object.");
  const record = body as Record<string, unknown>;
  const request: CurriculumRequest = {
    country: text(record.country, 80),
    city: text(record.city, 80),
    university: text(record.university, 160),
    course: text(record.course, 160),
    yearLevel: text(record.yearLevel, 40),
    teachingPeriod: text(record.teachingPeriod, 60),
    year: typeof record.year === "number" && record.year >= 2000 && record.year <= 2100 ? Math.round(record.year) : new Date().getFullYear(),
    subjectCode: text(record.subjectCode, 30),
    subjectName: text(record.subjectName, 160),
    documentText: typeof record.documentText === "string" && record.documentText.trim() ? record.documentText : null,
  };
  if (!request.university) throw new CurriculumError("invalid-request", "University is required.");
  if (!request.subjectCode && !request.subjectName) throw new CurriculumError("invalid-request", "A subject code or name is required.");
  return request;
}

const nullable = (type: "string" | "integer" | "number") => ({ anyOf: [{ type }, { type: "null" }] });

const CURRICULUM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "code", "summary", "confidence", "sourceNote", "learningOutcomes", "weeks", "assessments", "keyTerms", "questions"],
  properties: {
    name: { type: "string" },
    code: { type: "string" },
    summary: { type: "string" },
    confidence: { type: "string", enum: ["official", "document", "inferred"] },
    sourceNote: { type: "string" },
    learningOutcomes: { type: "array", items: { type: "string" } },
    weeks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["week", "title", "topics", "summary"],
        properties: {
          week: { type: "integer" },
          title: { type: "string" },
          topics: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
      },
    },
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "weightPercent", "dueWeek", "dueDate", "description", "steps"],
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["exam", "quiz", "essay", "report", "project", "presentation", "lab", "participation", "other"] },
          weightPercent: nullable("number"),
          dueWeek: nullable("integer"),
          dueDate: nullable("string"),
          description: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
    keyTerms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "definition"],
        properties: { term: { type: "string" }, definition: { type: "string" } },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "choices", "answerIndex", "explanation", "week", "difficulty"],
        properties: {
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answerIndex: { type: "integer" },
          explanation: { type: "string" },
          week: nullable("integer"),
          difficulty: { type: "integer", enum: [1, 2, 3] },
        },
      },
    },
  },
} as const;

function describeStudent(req: CurriculumRequest): string {
  const subject = [req.subjectCode, req.subjectName].filter(Boolean).join(" — ");
  return [
    `Subject: ${subject}`,
    `University: ${req.university}${req.city ? ` (${req.city}${req.country ? `, ${req.country}` : ""})` : req.country ? ` (${req.country})` : ""}`,
    req.course ? `Course / degree: ${req.course}` : null,
    req.yearLevel ? `Year level: ${req.yearLevel}` : null,
    `Teaching period: ${req.teachingPeriod || "not specified"} ${req.year}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const RESEARCH_SYSTEM = `You research university subject curricula for a study game. Find the OFFICIAL information for one subject: the university's own handbook, course catalogue, unit/subject outline or learning-management pages. Prefer the edition for the stated teaching period and year; say so if you can only find another year.

Gather, where published:
- the subject's official name and code, and a short description
- learning outcomes
- the week-by-week topic schedule
- every assessment task: name, type, weighting (%), due week or date, and what it requires
- the core concepts and terminology a student must master

Write a plain-text research brief with these sections: OVERVIEW, LEARNING OUTCOMES, WEEKLY SCHEDULE, ASSESSMENTS, KEY CONCEPTS, GAPS. In GAPS, state plainly what you could not find in an official source. Never present a guess as official. End with a SOURCES section listing every URL you relied on.`;

const STRUCTURE_SYSTEM = `You convert subject research into the JSON curriculum used by a fantasy study game. Rules:
- "confidence": "official" when the weekly schedule and assessments came from the university's own pages; "document" when they came from the student's uploaded outline; "inferred" when you had to fill gaps.
- If no official weekly schedule exists, build a sensible 12-week plan from the subject description and learning outcomes, and say so in "sourceNote".
- Never invent assessment weights or due dates. Use null when unknown. If the real assessments are unknown, list the typical tasks for this kind of subject with null weights, and say so in "sourceNote".
- "sourceNote": one or two honest sentences telling the student what is official and what they should verify.
- "steps": 3-6 concrete, practical actions a student takes to complete that assessment.
- "keyTerms": 15-25 core concepts with one-sentence definitions in plain language.
- "questions": 40-48 demanding multiple-choice questions on the subject's actual content, about three per teaching week (set "week"). Never ask about the syllabus itself (no "which week covers X", no assessment trivia). Aim for university exam standard: most should be "difficulty" 2 (explain or distinguish concepts) or 3 (apply to a realistic scenario, calculate, debug, or choose between two closely related options); at most a quarter may be 1 (recall). Exactly four distinct choices; every wrong choice must be a plausible misconception, similar in length and style to the correct one. "answerIndex" is the 0-based index of the correct choice; vary its position. "explanation" says why the answer is right and why the most tempting wrong choice is wrong, in one or two sentences.
- Keep every string concise. Use plain text, no markdown.`;

const LA_TROBE_CODE = /^[A-Z]{3}[1-5][A-Z0-9]{2,4}$/;

export function isLaTrobeRequest(req: CurriculumRequest): boolean {
  return /la\s*trobe/i.test(req.university);
}

/** Official La Trobe pages to start from — web fetch can only open URLs that appear in the conversation. */
export function laTrobeStartingUrls(req: CurriculumRequest): string[] {
  const code = req.subjectCode.trim().toUpperCase();
  if (!LA_TROBE_CODE.test(code)) return [];
  const lower = code.toLowerCase();
  return [`https://handbook.latrobe.edu.au/subjects/${req.year}/${lower}`, `https://handbook.latrobe.edu.au/subjects/${req.year - 1}/${lower}`];
}

const LA_TROBE_GUIDANCE = `This student is at La Trobe University (Australia). Use only official La Trobe sources:
- The La Trobe Handbook: https://handbook.latrobe.edu.au/subjects/{year}/{code in lowercase} — overview, intended learning outcomes, learning activities, and per-instance assessments (each teaching period and campus is a separate "subject instance").
- Other latrobe.edu.au pages (study, library reading lists).
Prefer the instance matching the student's teaching period and campus. La Trobe's detailed weekly schedule and exact due dates are usually in the Subject Learning Guide on LMS (Moodle), which you cannot access — say so in GAPS rather than guessing.`;

function client(): Anthropic {
  return new Anthropic();
}

export function collectUrls(content: Anthropic.Beta.BetaContentBlock[], into: Set<string>): void {
  for (const block of content) {
    if (block.type === "text" && block.citations) {
      for (const citation of block.citations) {
        if ("url" in citation && typeof citation.url === "string") into.add(citation.url);
      }
    }
    if (block.type === "web_fetch_tool_result") {
      const result = block.content as unknown as { type?: string; url?: string };
      if (result && result.type === "web_fetch_result" && typeof result.url === "string") into.add(result.url);
    }
  }
}

function blocksText(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function research(req: CurriculumRequest): Promise<{ brief: string; sources: string[] }> {
  const anthropic = client();
  const laTrobe = isLaTrobeRequest(req);
  const starting = laTrobe ? laTrobeStartingUrls(req) : [];
  const intro = laTrobe
    ? `Research this subject's official curriculum.\n\n${describeStudent(req)}\n\n${LA_TROBE_GUIDANCE}${starting.length ? `\n\nStart by fetching:\n${starting.join("\n")}` : ""}`
    : `Research this subject's official curriculum.\n\n${describeStudent(req)}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: intro }];
  const officialOnly = laTrobe ? { allowed_domains: ["latrobe.edu.au"] } : {};
  const sources = new Set<string>();
  let brief = "";

  for (let turn = 0; turn < 5; turn++) {
    const stream = anthropic.beta.messages.stream({
      model: CURRICULUM_MODEL,
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: RESEARCH_SYSTEM,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 8, ...officialOnly },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6, ...officialOnly },
      ],
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") {
      throw new CurriculumError("refused", "The research request was declined.");
    }
    collectUrls(response.content, sources);
    brief += blocksText(response.content);
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  for (const match of brief.matchAll(/https?:\/\/[^\s)\]>"']+/g)) sources.add(match[0].replace(/[.,;]+$/, ""));
  return { brief: brief.trim(), sources: [...sources].slice(0, 12) };
}

async function structure(req: CurriculumRequest, sourceLabel: string, sourceText: string): Promise<unknown> {
  const anthropic = client();
  const stream = anthropic.beta.messages.stream({
    model: CURRICULUM_MODEL,
    max_tokens: 32000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: CURRICULUM_SCHEMA as unknown as Record<string, unknown> },
    },
    system: STRUCTURE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${describeStudent(req)}\n\n<${sourceLabel}>\n${sourceText}\n</${sourceLabel}>\n\nProduce the curriculum JSON for this subject.`,
      },
    ],
  });
  const response = await stream.finalMessage();
  if (response.stop_reason === "refusal") throw new CurriculumError("refused", "The structuring request was declined.");
  if (response.stop_reason === "max_tokens") throw new CurriculumError("upstream", "The curriculum was too long to finish. Try again.");
  const raw = blocksText(response.content);
  try {
    return JSON.parse(raw);
  } catch {
    throw new CurriculumError("upstream", "The curriculum came back malformed. Try again.");
  }
}

export async function researchCurriculum(req: CurriculumRequest): Promise<CurriculumResult> {
  if (!isAiConfigured()) {
    throw new CurriculumError("ai-unavailable", "The server has no ANTHROPIC_API_KEY configured.");
  }
  const warnings: string[] = [];
  try {
    if (req.documentText) {
      let documentText = req.documentText;
      if (documentText.length > MAX_DOCUMENT_CHARS) {
        documentText = documentText.slice(0, MAX_DOCUMENT_CHARS);
        warnings.push(`Your document was very long; only the first ${MAX_DOCUMENT_CHARS.toLocaleString()} characters were read.`);
      }
      const subject = await structure(req, "uploaded_subject_outline", documentText);
      return { subject, sources: [], warnings };
    }
    const { brief, sources } = await research(req);
    if (!brief) throw new CurriculumError("upstream", "Research returned nothing. Try again or upload your subject outline.");
    const subject = await structure(req, "research_brief", brief);
    return { subject, sources, warnings };
  } catch (error) {
    if (error instanceof CurriculumError) throw error;
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new CurriculumError("ai-unavailable", "The server's Anthropic credentials were rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new CurriculumError("rate-limited", "The archivists are busy. Wait a minute and try again.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new CurriculumError("upstream", `Research service error (${error.status ?? "network"}).`);
    }
    throw new CurriculumError("upstream", "Research failed unexpectedly.");
  }
}
