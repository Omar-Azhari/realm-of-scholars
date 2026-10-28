/**
 * Offline fallback for an uploaded subject outline when AI research isn't
 * available: pulls "Week N" schedule lines and percentage-weighted
 * assessment lines out of plain text. Deliberately conservative — it only
 * keeps what it can see, and the result is marked "document" confidence.
 */

import { defaultQuestSteps } from "./normalize";
import type { RealmAssessmentKind } from "../types";

const WEEK_LINE = /^\s*(?:week|wk|topic)\s*(\d{1,2})\s*[:.\-–—)]*\s*(.{3,140})$/i;
const WEIGHT = /(\d{1,3}(?:\.\d+)?)\s*%/;

function guessKind(title: string): RealmAssessmentKind {
  const t = title.toLowerCase();
  if (/exam|final test/.test(t)) return "exam";
  if (/quiz|test/.test(t)) return "quiz";
  if (/essay/.test(t)) return "essay";
  if (/report/.test(t)) return "report";
  if (/present|pitch|demo/.test(t)) return "presentation";
  if (/project|assignment|portfolio/.test(t)) return "project";
  if (/lab|practical/.test(t)) return "lab";
  if (/participation|attendance/.test(t)) return "participation";
  return "other";
}

export function parseOutlineText(text: string, code: string, name: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  const weeks = new Map<number, { week: number; title: string; topics: string[]; summary: string }>();
  for (const line of lines) {
    const match = WEEK_LINE.exec(line);
    if (!match) continue;
    const week = Number(match[1]);
    if (week < 1 || week > 16 || weeks.has(week)) continue;
    const title = match[2].replace(/\s{2,}/g, " ").trim();
    if (!/[a-z]/i.test(title)) continue;
    weeks.set(week, { week, title, topics: title.split(/[;,]/).map((s) => s.trim()).filter(Boolean).slice(0, 5), summary: "" });
  }

  const assessments: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    const weight = WEIGHT.exec(line);
    if (!weight || line.length > 160) continue;
    const pct = Number(weight[1]);
    if (pct <= 0 || pct > 100) continue;
    const title = line.replace(WEIGHT, "").replace(/[|:\-–—]+\s*$/, "").replace(/\s{2,}/g, " ").trim();
    if (title.length < 4 || assessments.some((a) => a.title === title)) continue;
    const kind = guessKind(title);
    const dueWeek = /week\s*(\d{1,2})/i.exec(line);
    assessments.push({
      title: title.slice(0, 100),
      kind,
      weightPercent: pct,
      dueWeek: dueWeek ? Number(dueWeek[1]) : null,
      dueDate: null,
      description: line,
      steps: defaultQuestSteps(kind, title),
    });
    if (assessments.length >= 8) break;
  }

  const total = assessments.reduce((sum, a) => sum + (a.weightPercent as number), 0);
  const trustedAssessments = total > 0 && total <= 110 ? assessments : assessments.map((a) => ({ ...a, weightPercent: null }));

  return {
    code,
    name,
    summary: "",
    weeks: [...weeks.values()].sort((a, b) => a.week - b.week),
    assessments: trustedAssessments,
    keyTerms: [],
    questions: [],
    learningOutcomes: [],
    sourceNote: `Read directly from your uploaded outline without AI: found ${weeks.size} weekly topics and ${assessments.length} weighted assessments. Check them in the review step.`,
  };
}
