/**
 * Reports whether answer length gives the right choice away in the built-in quiz banks.
 * Run: npx tsx scripts/check-answer-lengths.ts
 *
 * For each bank it prints:
 *   - longest: % of questions where the correct choice is the longest (ties included)
 *   - uniquely longest: % where it is strictly longer than every distractor
 *   - shortest: % where the correct choice is the shortest (ties included)
 *   - uniquely shortest: % where it is strictly shorter than every distractor
 *   - pick-longest wins: how often "always pick the longest choice" is right (ties split evenly)
 *   - pick-shortest wins: the same for "always pick the shortest choice" (chance is 25%)
 *   - ratio: average of (correct length / mean distractor length)
 *   - spread: % of questions where every choice is within 25% of the longest one
 * The Spot the Flaw workshop is checked the same way, using each element's detail text.
 * Exits with code 1 if any bank's "longest" or "uniquely shortest" share is above 35%.
 * --list prints the questions where the correct choice is the longest; --list-short the uniquely shortest ones.
 */

import { builtInBank } from "../src/realm/curriculum/banks/latrobeBanks";
import { USABILITY } from "../src/realm/curriculum/banks/workshopBanks";

interface Item {
  id: string;
  choices: string[];
  answer: number;
}

const SUBJECTS = [
  { id: "cse2ui", code: "CSE2UI", name: "User Interface Design" },
  { id: "cse3cwa", code: "CSE3CWA", name: "Cloud-Based Web Application Development" },
  { id: "pm", code: "", name: "Project Management" },
  { id: "ppe", code: "", name: "Professional Practices and Entrepreneurship in Information Technology" },
];

const LIMIT = 0.35;

function pct(n: number, total: number): string {
  return `${((100 * n) / Math.max(1, total)).toFixed(1)}%`.padStart(6);
}

function stats(label: string, items: Item[]): { longest: number; uniqueShort: number; total: number } {
  let longest = 0;
  let uniqueShort = 0;
  let unique = 0;
  let shortest = 0;
  let spread = 0;
  let ratioSum = 0;
  let guess = 0;
  let guessShort = 0;
  for (const item of items) {
    const lens = item.choices.map((c) => c.length);
    const mine = lens[item.answer];
    const others = lens.filter((_, i) => i !== item.answer);
    const max = Math.max(...lens);
    if (mine >= Math.max(...others)) longest++;
    // A student who always picks the longest choice (at random among ties) is right this often.
    if (mine === max) guess += 1 / lens.filter((l) => l === max).length;
    const min = Math.min(...lens);
    if (mine === min) guessShort += 1 / lens.filter((l) => l === min).length;
    if (mine > Math.max(...others)) unique++;
    if (mine <= Math.min(...others)) shortest++;
    if (mine < Math.min(...others)) uniqueShort++;
    if (Math.min(...lens) >= 0.75 * max) spread++;
    ratioSum += mine / (others.reduce((a, b) => a + b, 0) / others.length);
  }
  const n = items.length;
  console.log(
    `${label.padEnd(16)} n=${String(n).padStart(3)}  longest ${pct(longest, n)}  uniquely longest ${pct(unique, n)}  shortest ${pct(shortest, n)}  uniquely shortest ${pct(uniqueShort, n)}  pick-longest wins ${pct(guess, n)}  pick-shortest wins ${pct(guessShort, n)}  ratio ${(ratioSum / Math.max(1, n)).toFixed(2)}  within 25% ${pct(spread, n)}`,
  );
  return { longest, uniqueShort, total: n };
}

const all: Item[] = [];
let failed = false;
console.log("Quiz banks (src/realm/curriculum/banks/latrobeBanks.ts)");
for (const s of SUBJECTS) {
  const bank = builtInBank(s.code, s.name, s.id);
  if (!bank) continue;
  const items = bank.questions.map((q) => ({ id: q.id, choices: q.choices, answer: q.answerIndex }));
  all.push(...items);
  const r = stats(s.id, items);
  if (r.longest / r.total > LIMIT || r.uniqueShort / r.total > LIMIT) failed = true;
}
const overall = stats("ALL QUESTIONS", all);
if (overall.longest / overall.total > LIMIT || overall.uniqueShort / overall.total > LIMIT) failed = true;

console.log("\nWorkshop: Spot the Flaw (element details, src/realm/curriculum/banks/workshopBanks.ts)");
const flaws = stats(
  "usability",
  USABILITY.map((u, i) => ({ id: `usability-${i}`, choices: u.elements.map((e) => e.detail), answer: u.flaw })),
);
if (flaws.longest / flaws.total > LIMIT || flaws.uniqueShort / flaws.total > LIMIT) failed = true;

if (process.argv.includes("--list")) {
  console.log("\nQuestions where the correct choice is the longest:");
  for (const item of all) {
    const lens = item.choices.map((c) => c.length);
    const mine = lens[item.answer];
    if (lens.every((l, i) => i === item.answer || l <= mine)) console.log(`  ${item.id}: ${item.choices[item.answer]}`);
  }
}

if (process.argv.includes("--list-short")) {
  console.log("\nQuestions where the correct choice is the unique shortest:");
  for (const item of all) {
    const lens = item.choices.map((c) => c.length);
    const mine = lens[item.answer];
    if (lens.every((l, i) => i === item.answer || l > mine)) console.log(`  ${item.id}: ${item.choices[item.answer]}  |  ${item.choices.filter((_, i) => i !== item.answer).join("  /  ")}`);
  }
}

console.log(failed ? `\nFAIL: a bank gives the answer away by length (longest or shortest) more than ${LIMIT * 100}% of the time.` : "\nOK: no bank above the limit.");
process.exit(failed ? 1 : 0);
