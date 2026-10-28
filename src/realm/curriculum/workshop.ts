/**
 * Subject workshops: a hands-on game that fits the subject, chosen from the
 * subject's name and code. Subjects that match none keep the shared games.
 * The critical-path puzzles are generated (and checked) here; the other
 * games use the hand-written banks in banks/workshopBanks.ts.
 */

import type { RealmSubject } from "../types";

export type WorkshopKind = "bug-hunt" | "usability" | "critical-path" | "ethics";

export const WORKSHOP_INFO: Record<WorkshopKind, { name: string; station: string; blurb: string }> = {
  "bug-hunt": { name: "Bug Hunt", station: "Debugging forge", blurb: "Find the one broken line in real web code." },
  usability: { name: "Spot the Flaw", station: "Design critique table", blurb: "Find the part of a screen that breaks a usability heuristic." },
  "critical-path": { name: "Critical Path", station: "Planning table", blurb: "Work out durations, critical tasks and float in project networks." },
  ethics: { name: "Ethics Tribunal", station: "Tribunal bench", blurb: "Judge which ACS professional value is most at stake." },
};

/** The owner's four La Trobe IT subjects, by Handbook code. */
const BY_CODE: Array<[RegExp, WorkshopKind]> = [
  [/^CSE2UI(?![A-Z0-9])/, "usability"],
  [/^CSE3CWA(?![A-Z0-9])/, "bug-hunt"],
  [/^CSE3PM(?![A-Z0-9])/, "critical-path"],
  [/^CSE3PPE(?![A-Z0-9])/, "ethics"],
];

/** Words that place a subject in computing, so IT-only games (ACS ethics, web code) don't reach nursing or law. */
const IT_CONTEXT = /\b(it|ict|information technology|information systems|computing|computer|computer science|software|cyber ?security|web)\b/;

export function workshopFor(subject: Pick<RealmSubject, "name" | "code">): WorkshopKind | null {
  const code = subject.code.trim().toUpperCase().replace(/\s+/g, "");
  for (const [pattern, kind] of BY_CODE) if (pattern.test(code)) return kind;
  const name = subject.name.toLowerCase();
  const it = /^CSE/.test(code) || IT_CONTEXT.test(name);
  if (/user interface|user experience|\bux\b|usability|interaction design|human.computer|\bhci\b/.test(name)) return "usability";
  // Critical path puzzles are plain project networks, so they suit project management in any discipline.
  if (/project manag/.test(name)) return "critical-path";
  // The Ethics Tribunal judges ACS (Australian Computer Society) values: computing subjects only.
  if (it && /professional|ethic/.test(name)) return "ethics";
  if (/\bweb\b|\bprogramming\b|\bsoftware\b|\bcoding\b|javascript|python|\bjava\b|full.?stack/.test(name)) return "bug-hunt";
  return null;
}

// ---------------------------------------------------------------------------
// Critical path puzzles
// ---------------------------------------------------------------------------

export interface PathTask {
  id: string;
  duration: number;
  after: string[];
}

export interface PathAnalysis {
  duration: number;
  critical: string[];
  float: Record<string, number>;
}

/** Forward and backward pass (activity-on-node). */
export function analyseNetwork(tasks: PathTask[]): PathAnalysis {
  const es: Record<string, number> = {};
  const ef: Record<string, number> = {};
  for (const t of tasks) {
    es[t.id] = Math.max(0, ...t.after.map((p) => ef[p]));
    ef[t.id] = es[t.id] + t.duration;
  }
  const duration = Math.max(...tasks.map((t) => ef[t.id]));
  const lf: Record<string, number> = {};
  const ls: Record<string, number> = {};
  for (const t of [...tasks].reverse()) {
    const successors = tasks.filter((s) => s.after.includes(t.id));
    lf[t.id] = successors.length ? Math.min(...successors.map((s) => ls[s.id])) : duration;
    ls[t.id] = lf[t.id] - t.duration;
  }
  const float: Record<string, number> = {};
  for (const t of tasks) float[t.id] = ls[t.id] - es[t.id];
  return { duration, critical: tasks.filter((t) => float[t.id] === 0).map((t) => t.id), float };
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PathPuzzle {
  tasks: PathTask[];
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

/** A small project network (tasks listed in dependency order) and one question about it. */
export function makePathPuzzle(seed: number): PathPuzzle {
  const random = rng(seed);
  const count = 6 + Math.floor(random() * 2);
  const tasks: PathTask[] = [];
  for (let i = 0; i < count; i++) {
    const id = String.fromCharCode(65 + i);
    const earlier = tasks.map((t) => t.id);
    const after: string[] = [];
    if (i > 0) {
      const n = i < 2 ? 1 : random() < 0.4 ? 2 : 1;
      while (after.length < Math.min(n, earlier.length)) {
        const pick = earlier[Math.floor(random() * earlier.length)];
        if (!after.includes(pick)) after.push(pick);
      }
      // Starting tasks: let the second task also start at day 0 sometimes.
      if (i === 1 && random() < 0.5) after.length = 0;
    }
    tasks.push({ id, duration: 1 + Math.floor(random() * 8), after: after.sort() });
  }
  const analysis = analyseNetwork(tasks);
  const kind = Math.floor(random() * 3);
  const shuffle = <T,>(items: T[]) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const path = analysis.critical.join(" → ");
  if (kind === 0) {
    const right = analysis.duration;
    const sum = tasks.reduce((n, t) => n + t.duration, 0);
    const longestSingle = Math.max(...tasks.map((t) => t.duration));
    const wrong = [...new Set([sum, right - 2, right + 3, longestSingle * 2, right - 1, right + 1, right + 4, right + 5].filter((v) => v > 0 && v !== right))].slice(0, 3);
    const choices = shuffle([right, ...wrong]).map((v) => `${v} days`);
    return { tasks, prompt: "What is the shortest possible duration of this project?", choices, answerIndex: choices.indexOf(`${right} days`), explanation: `The longest chain of dependent tasks sets the duration: ${path} = ${right} days.` };
  }
  if (kind === 1) {
    const slack = tasks.filter((t) => analysis.float[t.id] > 0);
    if (slack.length >= 1) {
      const t = slack[Math.floor(random() * slack.length)];
      const right = analysis.float[t.id];
      const wrong = [...new Set([0, right + 1, right + 2, Math.max(1, right - 1), right + 3].filter((v) => v !== right && v >= 0))].slice(0, 3);
      const choices = shuffle([right, ...wrong]).map((v) => `${v} day${v === 1 ? "" : "s"}`);
      return {
        tasks,
        prompt: `How much float (slack) does task ${t.id} have?`,
        choices,
        answerIndex: choices.indexOf(`${right} day${right === 1 ? "" : "s"}`),
        explanation: `Float = latest start − earliest start. Task ${t.id} can slip ${right} day${right === 1 ? "" : "s"} without delaying the ${analysis.duration}-day project. Critical path: ${path}.`,
      };
    }
  }
  const criticalTask = analysis.critical[Math.floor(random() * analysis.critical.length)];
  const nonCritical = tasks.filter((t) => !analysis.critical.includes(t.id)).map((t) => t.id);
  if (nonCritical.length >= 3) {
    const choices = shuffle([criticalTask, ...shuffle(nonCritical).slice(0, 3)]).map((id) => `Task ${id}`);
    return {
      tasks,
      prompt: "Which task is on the critical path (delaying it delays the whole project)?",
      choices,
      answerIndex: choices.indexOf(`Task ${criticalTask}`),
      explanation: `Critical tasks have zero float. The critical path is ${path} (${analysis.duration} days).`,
    };
  }
  // Too few non-critical tasks for that question: fall back to duration.
  return makePathPuzzle(seed + 7919);
}
