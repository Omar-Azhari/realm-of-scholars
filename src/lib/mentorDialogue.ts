/**
 * Living mentor dialogue — THE single place mentor speech is chosen.
 *
 * A priority ladder walks from urgent to ambient; the first applicable rung
 * wins. Every line either contains no factual claim (greetings, tone) or is
 * parameterised with REAL saved numbers (streaks, minutes, sprints, weeks).
 * Nothing ever claims work was done that wasn't.
 *
 * Variation is deterministic: pools are indexed by Melbourne day-of-year +
 * a subject hash, so lines change day to day and differ between mentors,
 * but never randomise within a session.
 */

import { getMelbourneDateTimeKey, getMelbourneDateIso, getSubjectCompletedModuleCount, isModuleCompleted, daysBetweenDateIso } from "./selectors";
import { getCountedSessions } from "./focusSession";
import { getRelationshipLine, type MentorRelationship } from "./mentorRelationship";
import type { SemesterCalendar } from "./semesterCalendar";
import type { SubjectSimState } from "./simulation";
import type { SubjectRecord, UniGameSaveData } from "../types/domain";

type Voice = {
  morning: string[];
  afternoon: string[];
  evening: string[];
  busy: string[];
  relaxed: string[];
  congrats: string[];
  concern: string[];
  revision: string[];
  ending: string[];
  complete: string[];
  /* Phase 17 additions — deeper personality. */
  humour: string[];
  burnout: string[];
  welcomeBack: string[];
  milestone: string[];
  /* Phase 23 additions — conversation bookends for MentorDialogueProvider.ts, same per-mentor voice, never a generic fallback phrase. */
  goodbye: string[];
};

/**
 * Per-mentor voice pools (personality angles from DESIGN_SYSTEM.md). Each
 * mentor is a distinct person:
 *  - UI Design "Iris": warm studio designer, talks in drafts and light.
 *  - Cloud "Cass": dry, precise engineer, talks in pipelines and uptime.
 *  - Project Management "Mara": steady coach, talks in schedules and paths.
 *  - Prof. Practices "Theo": high-energy founder, talks in traction and pitches.
 */
const VOICES: Record<string, Voice> = {
  "user-interface-design": {
    morning: [
      "Morning! Fresh canvas today.",
      "Early start — best light for sketching.",
      "Coffee, then wireframes. That's the order.",
      "The studio's quiet and bright. Perfect drafting hour.",
    ],
    afternoon: [
      "Afternoon — good time to iterate.",
      "Midday already? Let's refine something.",
      "Golden-hour's coming. Ship a draft before then?",
      "Afternoon slump? Low-stakes sketch fixes that.",
    ],
    evening: [
      "Evening sessions make thoughtful drafts.",
      "Late light in the studio — cosy, isn't it?",
      "Night owl mode. Some of my best layouts happen now.",
      "Dim the lamp, open one file. Small and calm.",
    ],
    busy: [
      "Big week on the board — one draft at a time.",
      "Lots pinned up right now. Pick one panel and start.",
      "The board's a collage this week. Deep breath, one artboard.",
      "Busy studio! Don't polish — rough it in first.",
    ],
    relaxed: [
      "Quiet week — nice time to explore ideas.",
      "Calm board today. Sketch something for fun?",
      "Slow week. Try a style you'd normally never touch.",
      "Nothing on fire — steal an hour to just play with type.",
    ],
    congrats: [
      "That iteration landed beautifully!",
      "Ship it! That one's portfolio-worthy.",
      "Oh, that's clean. Framed-on-the-wall clean.",
      "You made that look effortless. It wasn't. Well done.",
      "That composition just clicked. Genuinely lovely work.",
      "Pin that one up — it's the best thing on the board this week.",
    ],
    concern: [
      "The streak broke — happens to every designer. Start a small draft today?",
      "Been quiet lately. Even a rough sketch counts.",
      "No shame in a blank week. One line on the page beats none.",
      "The board misses you. Come pin up something tiny.",
      "This one's felt a little neglected — even five minutes of sketching helps.",
      "Nothing pinned up here in a while. No pressure, just an open invite back in.",
    ],
    revision: [
      "Revision time — walk your old drafts, you'll see how far you've come.",
      "Polish pass! Review beats redraw at this stage.",
      "Flip through the early sketches. The growth is the reward.",
      "Refine, don't restart. The bones are already good.",
    ],
    ending: [
      "Semester's wrapping up — finish the last panels strong.",
      "Final stretch. Tidy lines, tidy mind.",
      "Last few artboards. Make them the confident ones.",
      "Nearly hung the whole exhibition. Frame the last piece.",
    ],
    complete: [
      "The whole portfolio is done. I'm genuinely proud of this studio.",
      "Every draft became a deliverable. Take a bow.",
      "Full gallery, wall to wall. You built a body of work.",
      "From first blank canvas to this — what a collection.",
    ],
    humour: [
      "I aligned everything to an 8px grid last night. Slept like a baby.",
      "Rounded corners: still undefeated. Don't @ me.",
      "Someone used Comic Sans in a mockup once. We don't talk about it.",
      "Kerning is just personal space for letters, really.",
    ],
    burnout: [
      "You've been going hard. Even a designer needs to close the laptop.",
      "Great work doesn't need a martyr. Rest is part of the craft.",
      "Step back from the canvas — distance is how you spot the flaws anyway.",
      "Big output lately. Protect the eyes and the spark; take tonight off.",
    ],
    welcomeBack: [
      "There you are! The studio kept your seat warm.",
      "Welcome back — no lecture, just glad you're here.",
      "Back at the board! Let's ease in with something small.",
      "Missed your eye around here. Pick up wherever feels good.",
    ],
    milestone: [
      "We've done a lot of good work together — I trust your instincts now.",
      "You've become a real designer in this room. I mean that.",
      "I don't hand out this much faith often. You've earned the studio key.",
    ],
    goodbye: [
      "Go make something. I'll be here.",
      "Catch you at the next draft.",
      "The canvas'll wait for you.",
      "Off you go — good light out there.",
    ],
  },
  "cloud-based-web-application-development": {
    morning: [
      "Morning. Systems nominal — ready when you are.",
      "Early deploy window is open.",
      "Logs are quiet, coffee's hot. Good conditions.",
      "Fresh uptime clock. Let's not break it before noon.",
    ],
    afternoon: [
      "Afternoon checkpoint — pipeline's steady.",
      "Good time for a mid-day build.",
      "Traffic's flat. Perfect window to push something.",
      "Post-lunch deploy? Bold. I respect it.",
    ],
    evening: [
      "Evening shift — the lab hums nicely at night.",
      "Quiet racks tonight. Good focus conditions.",
      "Low latency, low light. Prime engineering hours.",
      "Night deploys, brave soul. I'll keep an eye on the dashboards.",
    ],
    busy: [
      "Heavy load this week. Ship one task at a time.",
      "Queue's deep — steady throughput beats bursts.",
      "Backpressure's high. Don't scale yourself past capacity.",
      "Lots in flight. Merge small, merge often.",
    ],
    relaxed: [
      "Light traffic this week. Good time to learn something.",
      "All green. Want to get ahead of the queue?",
      "Nothing paging. Refactor something you've been avoiding?",
      "Idle capacity is a gift. Spend it on the fundamentals.",
    ],
    congrats: [
      "Clean deploy! Zero rollbacks.",
      "That one shipped smoothly. Well engineered.",
      "Green across the board. Chef's kiss, or whatever engineers do.",
      "Merged, tested, live. Textbook.",
      "That build passed every check first try. Rare and excellent.",
      "Solid engineering there — no shortcuts, no regressions.",
    ],
    concern: [
      "The streak dropped. No alarms — just restart the pipeline today.",
      "A gap in the logs lately. One small session rebuilds momentum.",
      "Uptime dipped. It happens; bring it back with one commit.",
      "No incidents, just quiet. Kick off a small build to warm up.",
      "This subject's gone a bit stale in the logs. One small commit resets the clock.",
      "Quiet stretch here — no outage, just an open build queue whenever you're ready.",
    ],
    revision: [
      "Revision phase: re-run the fundamentals like regression tests.",
      "Audit season — verify what you know.",
      "Rollback-proof your knowledge: review the tricky modules twice.",
      "Treat exams like a load test. Rehearse under pressure.",
    ],
    ending: [
      "End of the release cycle — close out the last tickets.",
      "Final sprint of the semester. Steady hands.",
      "Freeze approaching. Land the last few changes carefully.",
      "One release left to cut. Ship it clean.",
    ],
    complete: [
      "Full pipeline green, every module deployed. Outstanding uptime.",
      "Semester shipped to production. Respect.",
      "100% coverage on the whole term. Genuinely impressive.",
      "Every service live, zero regressions. You ran this like a pro.",
    ],
    humour: [
      "It works on my machine. Fortunately, my machine is the cloud.",
      "There are two hard problems: caching, naming, and off-by-one errors.",
      "I named a server 'temporary' in 2019. It's load-bearing now.",
      "YAML indentation has caused me more grief than any exam.",
    ],
    burnout: [
      "You've been running hot. Even servers get scheduled downtime.",
      "Sustained load without cooling burns things out — you included. Rest.",
      "Push rate's unsustainable. Throttle yourself before something 500s.",
      "Great uptime, but take a maintenance window. Step away tonight.",
    ],
    welcomeBack: [
      "Connection re-established. Good to see you back online.",
      "Welcome back — no downtime penalties here. Let's warm the cache.",
      "The lab stayed running for you. Ease back in with a small build.",
      "You reappeared in the logs. Glad the gap's closed.",
    ],
    milestone: [
      "You've earned commit access to the important stuff. I trust your builds.",
      "We've shipped a lot together. You think like an engineer now.",
      "Not many get root in my lab. You did — the hard way, properly.",
    ],
    goodbye: [
      "Logging you off. Ping me when you're back.",
      "Connection closing gracefully. See you next session.",
      "I'll keep the lights on in the lab.",
      "Go build something. Status page's all green.",
    ],
  },
  "project-management": {
    morning: [
      "Morning stand-up: pick today's top item.",
      "Early start puts you ahead of the critical path.",
      "First thing: what's the one task that unblocks the rest?",
      "Good morning. Small win before lunch sets the tone.",
    ],
    afternoon: [
      "Midday check — are we on schedule?",
      "Afternoon's a good block for deep work.",
      "Half the day's baseline is set. How's the burndown?",
      "Post-lunch is underrated for focused, boring, important work.",
    ],
    evening: [
      "Evening review: close something small before you stop.",
      "Wrapping the day? Log what moved.",
      "End-of-day retro: one thing that went well, one to fix.",
      "Before you clock off — update the board so tomorrow's you says thanks.",
    ],
    busy: [
      "Milestones are stacked this week — sequence them, don't juggle.",
      "Critical path is tight. One deliverable at a time.",
      "Everything's due at once. That's a prioritisation problem, not a work problem.",
      "Deep backlog. Cut scope, protect the critical path.",
    ],
    relaxed: [
      "Slack in the schedule this week — bank some progress.",
      "Ahead of baseline. Nice position to be in.",
      "Quiet sprint. Pull one thing forward from next week.",
      "Buffer's healthy. Use it before it evaporates.",
    ],
    congrats: [
      "Milestone closed — the plan holds!",
      "Delivered on schedule. Textbook execution.",
      "Green milestone. That's what steady looks like.",
      "On time, in scope. The critical path bows to you.",
      "That's a clean delivery — no scope creep, no slippage.",
      "Well planned, well executed. That's the whole job, done right.",
    ],
    concern: [
      "The streak slipped. Re-baseline: one task today gets us moving.",
      "Progress stalled a little — small scope, quick win, today.",
      "Schedule drifted. No crisis; just re-plan and take one step.",
      "The board's gone quiet. Pull the smallest card and start.",
      "This one's fallen off the schedule a little. A single card gets it moving again.",
      "No updates here in a few days — nothing urgent, just an open slot on the board.",
    ],
    revision: [
      "Revision window: review deliverables against the brief.",
      "Time to audit the plan — check every milestone.",
      "Retro the whole term: what did each module actually teach?",
      "Consolidation phase. Re-read your own notes like a status report.",
    ],
    ending: [
      "Project close-out ahead — finish the punch list.",
      "Last reporting period of the semester. Bring it home.",
      "Final milestone in sight. Protect scope and land it.",
      "Close the last tickets. A clean finish is its own reward.",
    ],
    complete: [
      "Every milestone delivered. Project: closed, on time.",
      "Final report filed. This was a well-run semester.",
      "Full plan executed, nothing dropped. Genuinely well managed.",
      "Scope, schedule, delivery — all green. Textbook close-out.",
    ],
    humour: [
      "A meeting that could've been an email? In MY semester? Never.",
      "The plan survived contact with reality. Frame it. It's rare.",
      "I gave a task a buffer once. It expanded to fill the buffer. Parkinson was right.",
      "'Quick sync' is the most dangerous phrase in project management.",
    ],
    burnout: [
      "You've been sprinting for weeks. Even the best plan schedules rest.",
      "Velocity's high, but crunch isn't a strategy. Take a recovery day.",
      "Sustainable pace beats heroics. Log off and protect tomorrow's output.",
      "Great throughput — now bank some rest before it costs you.",
    ],
    welcomeBack: [
      "Good to see you back on the board. No blame, just re-plan.",
      "Welcome back — we'll re-baseline and start small.",
      "You're back in the stand-up. Let's pick one easy win today.",
      "Gap in the timeline's fine. Momentum starts with a single card.",
    ],
    milestone: [
      "You run this room like a lead now. I just hold the whiteboard.",
      "We've shipped every milestone together. That's a real partnership.",
      "I'd staff you on anything. You've proven the plan and the follow-through.",
    ],
    goodbye: [
      "Noted for the record. See you at the next stand-up.",
      "Board's updated. Go handle the rest of your day.",
      "That's logged. I'll see you at the next check-in.",
      "Off you go — the plan holds without you watching it every minute.",
    ],
  },
  "professional-practices-and-entrepreneurship-in-it": {
    morning: [
      "Morning, founder! Markets open.",
      "Early hustle — I love it.",
      "Rise and grind — or, you know, rise and think clearly first.",
      "New day, new pitch. What are we building?",
    ],
    afternoon: [
      "Afternoon check-in — traction looks interesting.",
      "Perfect time for a quick win to pitch later.",
      "Midday momentum. Turn one idea into one action.",
      "Investors love an afternoon update. Give yourself one.",
    ],
    evening: [
      "Evening grind — that's founder energy.",
      "Night shift at the incubator, classic startup.",
      "Best ideas hit at midnight. Second-best hit after sleep. Choose wisely.",
      "Late one? Ship a small thing, then actually rest.",
    ],
    busy: [
      "Demo-day energy this week — prioritise ruthlessly.",
      "Busy sprint! Ship the smallest lovable thing.",
      "Everyone wants everything. Say no to three things today.",
      "Runway's tight this week. Focus on the one metric that matters.",
    ],
    relaxed: [
      "Quiet market this week — great time to network or read.",
      "Low pressure today. Explore an idea?",
      "Calm week. Perfect for the boring stuff that compounds.",
      "No fires? Sharpen the pitch while it's quiet.",
    ],
    congrats: [
      "That's traction! Investors would love this.",
      "Huge win — put it on the pitch deck.",
      "Hockey-stick energy right there. Screenshot it.",
      "That's a slide in the Series A deck. Amazing.",
      "That's a legitimate growth story. Well pitched, well executed.",
      "Real traction, no smoke and mirrors. That's the good stuff.",
    ],
    concern: [
      "Momentum dipped — every startup has flat weeks. One small push today?",
      "The streak paused. Restart with something tiny and shippable.",
      "Even unicorns have quiet quarters. Ship one small thing to reset.",
      "Traction cooled off. That's a pivot moment, not a failure.",
      "This venture's gone quiet for a bit. One small pitch gets it moving again.",
      "No updates from this desk lately — no judgement, just an open door back in.",
    ],
    revision: [
      "Revision round: rehearse your pitch — er, your knowledge.",
      "Due-diligence time: verify everything you've built.",
      "Investors ask hard questions. Exams do too. Rehearse the answers.",
      "Consolidate the deck. Know your numbers cold.",
    ],
    ending: [
      "Demo day approaches — final polish!",
      "Last stretch before the showcase. Make it count.",
      "The pitch is nearly done. Land the closing slide.",
      "Final lap to launch. Ship the last feature and rehearse.",
    ],
    complete: [
      "Series A of semesters: everything delivered. Phenomenal run!",
      "You built the whole venture. Time to celebrate!",
      "Full launch, every milestone hit. That's founder-grade execution.",
      "From napkin sketch to shipped company. Take the win.",
    ],
    humour: [
      "We're not behind, we're pre-revenue. It's a mindset.",
      "I disrupted my sleep schedule. Very innovative. Do not recommend.",
      "Everything's an MVP if you're brave enough. Or reckless enough.",
      "Pitched a fridge to a penguin once. Learned a lot about product-market fit.",
    ],
    burnout: [
      "Hustle culture lied to you — rest is a growth strategy. Take the night.",
      "You can't pour from an empty runway. Refuel; the venture will keep.",
      "Founders who never stop, stop suddenly. Pace it. Log off tonight.",
      "Huge push lately. Protect the founder — that's the real asset.",
    ],
    welcomeBack: [
      "The prodigal founder returns! No pitch required, just glad you're back.",
      "Welcome back — every comeback story starts with showing up.",
      "Back in the incubator! Let's ship one small thing to warm up.",
      "You resurfaced! Quiet stretches happen. Let's rebuild momentum.",
    ],
    milestone: [
      "I'd invest in you. We've built real traction together in here.",
      "You've gone from student to founder in this room. Proud of that.",
      "Not many earn my full backing. You did — with receipts.",
    ],
    goodbye: [
      "Go close something. I'll be here for the next pitch.",
      "That's a wrap. See you at the next stand-up.",
      "Keep building. The incubator's always open.",
      "Off you go, founder. Make it count.",
    ],
  },
};

const FALLBACK_VOICE = VOICES["user-interface-design"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973;
  return hash;
}

function pick(pool: string[], subjectId: string, now: Date): string {
  const dayOfYear = Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / (24 * 3600 * 1000)
  );
  return pool[(dayOfYear + hashString(subjectId)) % pool.length];
}

export interface MentorLineInput {
  save: UniGameSaveData;
  subject: SubjectRecord;
  sim: SubjectSimState;
  relationship: MentorRelationship;
  calendar: SemesterCalendar;
  /** Optional real next-priority item title (module/assessment). */
  nextItemTitle?: string | null;
  /** True when the next priority item is an assessment (points to the board). */
  nextIsAssessment?: boolean;
  now?: Date;
}

export function getMentorLine({
  save,
  subject,
  sim,
  relationship,
  calendar,
  nextItemTitle = null,
  nextIsAssessment = false,
  now = new Date(),
}: MentorLineInput): string {
  const voice = VOICES[subject.id] ?? FALLBACK_VOICE;
  const say = (pool: string[]) => pick(pool, subject.id, now);

  // 1. Real deadline pressure always wins (overdue / days-left / unconfirmed).
  if (sim.pressingConcern) return sim.pressingConcern;

  // 2. A completion just landed.
  if (sim.justCelebrated) return say(voice.congrats);

  // 3. Semester genuinely complete.
  if (calendar.era === "complete") return say(voice.complete);

  // 3b. Returning after real inactivity — warm welcome, never a scold. Based
  // on the gap since the last active Melbourne day.
  const todayForGap = getMelbourneDateIso(now);
  if (
    save.userProgress.lastActiveDate &&
    save.userProgress.lastActiveDate !== todayForGap &&
    daysBetweenDateIso(save.userProgress.lastActiveDate, todayForGap) >= 4
  ) {
    return say(voice.welcomeBack);
  }

  // 4. Broken streak (real: a previously-built streak is now zero).
  if (save.userProgress.streakCount === 0 && save.userProgress.longestStreak >= 3) {
    return say(voice.concern);
  }

  // 4b. Burnout care — sustained heavy load or a very long streak under load.
  if (sim.workload >= 85 || (save.userProgress.streakCount >= 14 && sim.workload >= 60)) {
    return say(voice.burnout);
  }

  // 5. Long streak praise — real number quoted.
  if (save.userProgress.streakCount >= 7) {
    return `${save.userProgress.streakCount} days straight — ${
      say(voice.congrats).charAt(0).toLowerCase() + say(voice.congrats).slice(1)
    }`;
  }

  // 6. A counted Focus Sprint in THIS subject today — real minutes quoted.
  const todayIso = getMelbourneDateIso(now);
  const sprintToday = getCountedSessions(save).find(
    (session) =>
      session.subjectId === subject.id &&
      getMelbourneDateTimeKey(new Date(session.startedAt)).slice(0, 10) === todayIso
  );
  if (sprintToday) {
    return `${Math.floor(sprintToday.elapsedFocusSeconds / 60)} focused minutes in here today — good work.`;
  }

  // 7. Revision / semester-ending windows (only when derivable).
  if (calendar.period === "revision" || calendar.period === "exams") return say(voice.revision);
  if (calendar.currentWeek !== null && calendar.currentWeek >= calendar.totalTeachingWeeks - 1) {
    return say(voice.ending);
  }

  // 8-9. Busy / relaxed weeks from the real workload signal.
  if (sim.workload >= 70) return say(voice.busy);
  if (sim.workload <= 30 && relationship.level >= 2) return say(voice.relaxed);

  // 10. Deep-bond milestone lines at high relationship levels (real stats).
  if (relationship.level >= 4) return say(voice.milestone);
  const relationshipLine = getRelationshipLine(relationship);
  if (relationshipLine) return relationshipLine;

  // 11. Navigational nudges — point at the room's own objects instead of a
  // menu, using real progress. Deterministic pick keeps it stable per day.
  const completedModules = getSubjectCompletedModuleCount(save.tasks, subject);
  const totalModules = subject.modules.length;
  const remaining = totalModules - completedModules;
  const currentModule = subject.modules.find((m) => !isModuleCompleted(save.tasks, m.id));
  const navHints: string[] = [];
  if (nextItemTitle && nextIsAssessment) {
    navHints.push(`Have you checked the assessment board? "${nextItemTitle}" is coming up.`);
  }
  if (currentModule && remaining > 0) {
    navHints.push(
      remaining <= 2
        ? `You're almost through the modules here — ${remaining} left. The bookshelf has the reading.`
        : `The bookshelf has today's reading: "${currentModule.title}".`
    );
    navHints.push(
      `${completedModules} of ${totalModules} modules done — the study desk's free whenever you want a focus session.`
    );
    // Phase 19, Part 12: reference a real required reading on the current
    // module, when one was actually extracted — never invented, and only
    // ever the module's own data, never a different module's.
    const requiredReading = currentModule.readings.find((r) => r.kind === "required");
    if (requiredReading) {
      navHints.push(`Before you move on — the required reading here is "${requiredReading.title}".`);
    }
  }
  // Phase 19, Part 12: name the real current teaching week, only when the
  // semester start date is confirmed (never a guessed week number).
  if (calendar.currentWeek !== null) {
    navHints.push(`We're in Week ${calendar.currentWeek} of the semester.`);
  }
  if (navHints.length > 0) return pick(navHints, subject.id, now);

  // 12. Time-of-day greeting, with an occasional light aside for personality.
  const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
  const dayOfYear = Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / (24 * 3600 * 1000));
  if ((dayOfYear + hashString(subject.id)) % 4 === 0) return say(voice.humour);
  if (hour < 12) return say(voice.morning);
  if (hour < 17) return say(voice.afternoon);
  return say(voice.evening);
}

/** A mentor's semester-complete line (used by the HQ completion sequence). */
export function getCompletionLine(subjectId: string, variant: number): string {
  const voice = VOICES[subjectId] ?? FALLBACK_VOICE;
  return voice.complete[variant % voice.complete.length];
}

/** Phase 23 — a personality-flavoured sign-off, same deterministic day+subject pick as every other voice pool here (never generic, never randomised within a session). */
export function getMentorGoodbye(subjectId: string, now: Date = new Date()): string {
  const voice = VOICES[subjectId] ?? FALLBACK_VOICE;
  return pick(voice.goodbye, subjectId, now);
}

/** Rough line count for reporting/tests. */
export function dialogueLineCount(): number {
  return Object.values(VOICES).reduce(
    (sum, voice) => sum + Object.values(voice).reduce((s, pool) => s + pool.length, 0),
    0
  );
}
