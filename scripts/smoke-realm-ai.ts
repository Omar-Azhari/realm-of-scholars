/**
 * Live smoke test for Realm of Scholars' AI features. Makes REAL Claude
 * API calls (costs a little money), so it only runs when you ask:
 *
 *   1. Put ANTHROPIC_API_KEY=... in .env.local (never commit it).
 *   2. npx tsx --env-file=.env.local scripts/smoke-realm-ai.ts
 *
 * Checks, in order: the tutor answers a question, slides become trial
 * questions, and curriculum research for one La Trobe subject returns a
 * usable curriculum. Each step prints what came back.
 */

import { isAiConfigured, researchCurriculum } from "../src/server/realm/curriculumResearch";
import { tutorReply, weekQuestions } from "../src/server/realm/studyAi";
import { normalizeQuestions, normalizeSubject } from "../src/realm/curriculum/normalize";

async function step(name: string, run: () => Promise<string>): Promise<boolean> {
  const started = Date.now();
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const summary = await run();
    console.log(`  ok (${((Date.now() - started) / 1000).toFixed(1)} s) — ${summary}`);
    return true;
  } catch (error) {
    console.log(`  FAIL — ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main(): Promise<void> {
  if (!isAiConfigured()) {
    console.log("No ANTHROPIC_API_KEY found. Add it to .env.local and run:\n  npx tsx --env-file=.env.local scripts/smoke-realm-ai.ts");
    process.exitCode = 1;
    return;
  }
  const results: boolean[] = [];

  results.push(
    await step("Tutor chat", async () => {
      const { reply } = await tutorReply({
        university: "La Trobe University",
        tutorName: "Master Artisan Hilde",
        subject: {
          code: "CSE2UI",
          name: "User Interface Design",
          summary: "Human-centred design of user interfaces.",
          learningOutcomes: [],
          weeks: [{ week: 7, title: "Evaluation and User Testing", topics: ["heuristic evaluation", "usability testing"] }],
          keyTerms: [{ term: "Heuristic evaluation", definition: "Experts inspect an interface against usability principles." }],
          assessments: ["Assessment 1"],
        },
        currentWeek: 7,
        history: [],
        question: "What's the difference between a heuristic evaluation and a usability test?",
      });
      if (reply.length < 80) throw new Error(`Reply too short: ${reply}`);
      console.log(`  reply: ${reply.slice(0, 300)}${reply.length > 300 ? "…" : ""}`);
      return `${reply.length} characters`;
    }),
  );

  results.push(
    await step("Questions from lecture slides", async () => {
      const slidesText = [
        "Week 3: Personas and scenarios",
        "A persona is a fictional, research-based archetype of a target user. It has goals, frustrations and context, drawn from interviews.",
        "Personas are not demographics: they focus on behaviours and goals.",
        "Scenarios are short stories describing how a persona uses the product to achieve a goal in a specific context.",
        "Empathy maps capture what users say, think, do and feel.",
        "Pitfalls: personas built on assumptions instead of research; too many personas; designing for 'everyone'.",
      ].join("\n");
      const { questions } = await weekQuestions({ university: "La Trobe University", subjectCode: "CSE2UI", subjectName: "User Interface Design", week: 3, weekTitle: "Personas and scenarios", slidesText });
      const valid = normalizeQuestions(questions, "cse2ui", "s3-");
      if (valid.length < 6) throw new Error(`Only ${valid.length} valid questions`);
      console.log(`  e.g. ${valid[0].prompt}`);
      return `${valid.length} valid questions`;
    }),
  );

  results.push(
    await step("Curriculum research (La Trobe handbook)", async () => {
      const result = await researchCurriculum({
        country: "Australia",
        city: "Melbourne",
        university: "La Trobe University",
        course: "Bachelor of Computer Science",
        yearLevel: "2",
        teachingPeriod: "Semester 2",
        year: 2026,
        subjectCode: "CSE2UI",
        subjectName: "User Interface Design",
        documentText: null,
      });
      const subject = normalizeSubject(result.subject, { code: "CSE2UI", name: "User Interface Design" }, "inferred", "arcane");
      if (subject.weeks.length < 6 || subject.questions.length < 20) throw new Error(`Thin result: ${subject.weeks.length} weeks, ${subject.questions.length} questions`);
      console.log(`  sources: ${result.sources.slice(0, 3).join(", ") || "none"}`);
      return `${subject.weeks.length} weeks, ${subject.assessments.length} assessments, ${subject.questions.length} questions, confidence ${subject.confidence}`;
    }),
  );

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} AI checks passed`);
  if (passed < results.length) process.exitCode = 1;
}

void main();
