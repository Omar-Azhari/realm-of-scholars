/**
 * Turns untrusted curriculum JSON (from the AI research endpoint, an
 * uploaded document, or a hand-built entry) into a safe, complete
 * RealmSubject. Never throws — bad fields are dropped or defaulted.
 */

import type {
  CurriculumConfidence,
  RealmAssessment,
  RealmAssessmentKind,
  RealmKeyTerm,
  RealmQuestion,
  RealmSubject,
  RealmWeek,
  RegionTheme,
} from "../types";

const THEME_RULES: Array<{ theme: RegionTheme; pattern: RegExp }> = [
  { theme: "arcane", pattern: /comput|software|program|algorithm|data|cyber|network|web|cloud|ai\b|artificial|machine learning|information|digital|code/i },
  { theme: "foundry", pattern: /engineer|physics|mechanic|electr|math|calculus|statistic|algebra|robot|circuit|civil|structur/i },
  { theme: "alchemy", pattern: /chem|pharma|material|biochem|molecul/i },
  { theme: "grove", pattern: /bio|health|medic|nurs|anatom|physiol|ecolog|environment|agri|psycholog|sport|nutrition|vet/i },
  { theme: "guild", pattern: /business|manage|market|account|financ|econom|entrepreneur|commerce|project|supply|hr\b|human resource|professional/i },
  { theme: "forge", pattern: /design|art|media|architect|film|music|creative|interface|ux|ui\b|fashion|animation|game/i },
  { theme: "archive", pattern: /law|histor|philosoph|politic|literat|language|sociolog|educat|ethic|religio|anthropolog|journal|writing|english/i },
  { theme: "tide", pattern: /ocean|marine|geograph|earth|climate|geolog|astronom|space/i },
];

const THEME_ORDER: RegionTheme[] = ["arcane", "guild", "forge", "grove", "archive", "foundry", "tide", "alchemy"];

export function pickTheme(name: string, index: number, taken: Set<RegionTheme>): RegionTheme {
  for (const rule of THEME_RULES) {
    if (rule.pattern.test(name) && !taken.has(rule.theme)) return rule.theme;
  }
  const free = THEME_ORDER.find((theme) => !taken.has(theme));
  return free ?? THEME_ORDER[index % THEME_ORDER.length];
}

const KINDS: RealmAssessmentKind[] = ["exam", "quiz", "essay", "report", "project", "presentation", "lab", "participation", "other"];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function strList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v)).filter(Boolean).slice(0, max);
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "subject";
}

export function defaultQuestSteps(kind: RealmAssessmentKind, title: string): string[] {
  switch (kind) {
    case "exam":
      return ["Gather the exam scope and past papers", "Revise each week's key topics", "Complete a timed practice paper", "Sit the exam"];
    case "quiz":
      return ["Review the weeks the quiz covers", "Practise with the Duel Arena", "Complete the quiz"];
    case "presentation":
      return ["Read the brief and marking guide", "Research and outline your talk", "Build your slides", "Rehearse", "Present"];
    case "project":
      return ["Read the brief and marking guide", "Plan milestones", "Build the first draft", "Refine and test", "Submit"];
    case "lab":
      return ["Read the lab instructions", "Complete the lab work", "Write up results", "Submit"];
    case "participation":
      return ["Attend and engage each week", "Keep notes of your contributions", "Confirm participation is recorded"];
    default:
      return [`Read the brief for "${title}"`, "Research and gather sources", "Write the first draft", "Edit against the marking guide", "Submit"];
  }
}

function normalizeWeeks(raw: unknown): RealmWeek[] {
  if (!Array.isArray(raw)) return [];
  const weeks: RealmWeek[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const week = num(record.week);
    const title = str(record.title);
    if (week === null || week < 0 || week > 20 || !title) continue;
    if (weeks.some((w) => w.week === week)) continue;
    weeks.push({ week: Math.round(week), title, topics: strList(record.topics, 8), summary: str(record.summary) });
  }
  return weeks.sort((a, b) => a.week - b.week).slice(0, 16);
}

function normalizeAssessments(raw: unknown, subjectId: string): RealmAssessment[] {
  if (!Array.isArray(raw)) return [];
  const result: RealmAssessment[] = [];
  raw.slice(0, 10).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const title = str(record.title);
    if (!title) return;
    const kindRaw = str(record.kind).toLowerCase();
    const kind = (KINDS as string[]).includes(kindRaw) ? (kindRaw as RealmAssessmentKind) : "other";
    const weight = num(record.weightPercent);
    const dueWeek = num(record.dueWeek);
    const dueDateRaw = str(record.dueDate);
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : null;
    const steps = strList(record.steps, 8);
    result.push({
      id: `${subjectId}-a${index + 1}`,
      title,
      kind,
      weightPercent: weight !== null && weight > 0 && weight <= 100 ? Math.round(weight) : null,
      dueWeek: dueWeek !== null && dueWeek >= 0 && dueWeek <= 20 ? Math.round(dueWeek) : null,
      dueDate,
      description: str(record.description),
      steps: steps.length >= 2 ? steps : defaultQuestSteps(kind, title),
    });
  });
  return result;
}

function normalizeTerms(raw: unknown): RealmKeyTerm[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const terms: RealmKeyTerm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const term = str(record.term);
    const definition = str(record.definition);
    if (!term || !definition || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    const week = typeof record.week === "number" && Number.isInteger(record.week) && record.week >= 1 && record.week <= 52 ? record.week : undefined;
    terms.push(week === undefined ? { term, definition } : { term, definition, week });
  }
  return terms.slice(0, 40);
}

/** Validates untrusted questions. `idPrefix` keeps ids unique when adding to an existing bank (e.g. from slides). */
export function normalizeQuestions(raw: unknown, subjectId: string, idPrefix = "q"): RealmQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: RealmQuestion[] = [];
  raw.slice(0, 60).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const prompt = str(record.prompt);
    const choices = strList(record.choices, 4);
    const answerIndex = num(record.answerIndex);
    if (!prompt || choices.length !== 4 || answerIndex === null || answerIndex < 0 || answerIndex > 3) return;
    if (new Set(choices.map((c) => c.toLowerCase())).size !== 4) return;
    const week = num(record.week);
    const difficultyRaw = num(record.difficulty);
    const difficulty = difficultyRaw === 1 || difficultyRaw === 2 || difficultyRaw === 3 ? difficultyRaw : 2;
    questions.push({
      id: `${subjectId}-${idPrefix}${index + 1}`,
      prompt,
      choices,
      answerIndex: Math.round(answerIndex),
      explanation: str(record.explanation),
      week: week !== null ? Math.round(week) : null,
      difficulty,
    });
  });
  return questions;
}

export function normalizeSubject(
  raw: unknown,
  fallback: { code: string; name: string },
  confidence: CurriculumConfidence,
  theme: RegionTheme,
): RealmSubject {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const name = str(record.name) || fallback.name || fallback.code || "Unnamed subject";
  const code = str(record.code) || fallback.code;
  const id = slug(code || name);
  const subject: RealmSubject = {
    id,
    code,
    name,
    summary: str(record.summary),
    theme,
    weeks: normalizeWeeks(record.weeks),
    assessments: normalizeAssessments(record.assessments, id),
    keyTerms: normalizeTerms(record.keyTerms),
    questions: normalizeQuestions(record.questions, id),
    learningOutcomes: strList(record.learningOutcomes, 12),
    sourceUrls: strList(record.sourceUrls, 10).filter((u) => /^https?:\/\//i.test(u)),
    confidence,
    sourceNote: str(record.sourceNote),
  };
  return subject;
}

/** Ensures every subject id is unique within a curriculum (two subjects with the same code/name would otherwise collide). */
export function dedupeSubjectIds(subjects: RealmSubject[]): RealmSubject[] {
  const seen = new Map<string, number>();
  return subjects.map((subject) => {
    const count = seen.get(subject.id) ?? 0;
    seen.set(subject.id, count + 1);
    if (count === 0) return subject;
    const id = `${subject.id}-${count + 1}`;
    return {
      ...subject,
      id,
      assessments: subject.assessments.map((a, i) => ({ ...a, id: `${id}-a${i + 1}` })),
      questions: subject.questions.map((q, i) => ({ ...q, id: `${id}-q${i + 1}` })),
    };
  });
}
