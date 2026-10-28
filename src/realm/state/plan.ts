/**
 * Study plan: suggested dates for each quest step, worked back from the
 * due date, and an .ics export so the plan can go into any calendar app.
 *
 * A quest's work is spread over the two weeks before it is due (or from
 * today, if that's later); the last step lands on the due date.
 */

import { addDays, todayIso } from "./store";
import { questProgress, resolvedDueDate } from "./actions";
import type { RealmAssessment, RealmState, RealmSubject } from "../types";

export const PLAN_WINDOW_DAYS = 14;

export interface PlannedStep {
  index: number;
  text: string;
  date: string;
  done: boolean;
}

export interface QuestPlan {
  subject: RealmSubject;
  assessment: RealmAssessment;
  due: string;
  steps: PlannedStep[];
}

/** Null when the quest is complete, has no known due date, or its deadline has passed. */
export function planFor(state: RealmState, subject: RealmSubject, assessment: RealmAssessment, today = todayIso()): QuestPlan | null {
  const progress = questProgress(state, assessment);
  if (progress.status === "complete") return null;
  const due = resolvedDueDate(assessment, state.curriculum);
  if (!due || due < today) return null;
  const windowStart = addDays(due, -PLAN_WINDOW_DAYS);
  const start = windowStart > today ? windowStart : today;
  const span = Math.round((new Date(`${due}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000);
  const open = assessment.steps.map((text, index) => ({ text, index, done: progress.stepsDone[index] ?? false })).filter((s) => !s.done);
  const steps: PlannedStep[] = assessment.steps.map((text, index) => {
    const done = progress.stepsDone[index] ?? false;
    if (done) return { index, text, date: today, done };
    const position = open.findIndex((s) => s.index === index);
    const date = addDays(start, Math.round(((position + 1) / open.length) * span));
    return { index, text, date, done };
  });
  return { subject, assessment, due, steps };
}

export function allPlans(state: RealmState, today = todayIso()): QuestPlan[] {
  const plans: QuestPlan[] = [];
  for (const subject of state.curriculum?.subjects ?? []) {
    for (const assessment of subject.assessments) {
      const plan = planFor(state, subject, assessment, today);
      if (plan) plans.push(plan);
    }
  }
  return plans.sort((a, b) => a.due.localeCompare(b.due));
}

function icsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines at 75 octets as RFC 5545 asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

const compact = (iso: string) => iso.replace(/-/g, "");

/** An .ics calendar with an all-day event per open step plus each deadline. */
export function plansToIcs(plans: QuestPlan[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UniGame//Realm of Scholars study plan//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Study plan (Realm of Scholars)"];
  const event = (uid: string, date: string, summary: string, description: string) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@realm-of-scholars`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
      fold(`SUMMARY:${icsText(summary)}`),
      fold(`DESCRIPTION:${icsText(description)}`),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  };
  for (const plan of plans) {
    const code = plan.subject.code || plan.subject.name;
    for (const step of plan.steps.filter((s) => !s.done)) {
      event(`${plan.assessment.id}-step${step.index}`, step.date, `${code}: ${step.text}`, `Step ${step.index + 1} of "${plan.assessment.title}", due ${plan.due}.`);
    }
    event(`${plan.assessment.id}-due`, plan.due, `DUE ${code}: ${plan.assessment.title}`, `${plan.assessment.weightPercent !== null ? `${plan.assessment.weightPercent}% of the grade. ` : ""}Check the subject guide for the exact time.`);
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
