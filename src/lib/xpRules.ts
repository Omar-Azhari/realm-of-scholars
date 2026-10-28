/**
 * Focus Sprint XP rules — THE single place session XP is computed.
 *
 * Rules (plain language, mirrored in the post-session breakdown UI):
 * - Base:    1 XP per 5 full minutes of REAL focused time (capped at 120
 *            minutes per session, i.e. max 24 base XP).
 * - Long-session bonus: +5 XP when a session reaches 45 focused minutes.
 * - First session of the day: +5 XP for the first counted session on a
 *   Melbourne calendar day.
 * - Weekly consistency: +10 XP when this session makes it 4 or more distinct
 *   study days within the trailing 7 days (counting today).
 *
 * Guarantees:
 * - No XP for opening Focus Mode, pausing, or cancelling — XP exists only in
 *   the completion mutation, computed from real elapsed time.
 * - A session shorter than MIN_COUNTED_MINUTES counts for nothing (0 XP,
 *   excluded from sprint counts/achievements/relationships) — finishing
 *   early records only what actually happened.
 * - Sessions are keyed by id; the completion mutation is idempotent, so the
 *   same session can never be paid twice.
 * - Module/assessment/streak XP (saveDataMutations.ts) is untouched.
 */

import { getMelbourneDateIso, daysBetweenDateIso } from "./selectors";
import type { FocusSessionRecord } from "../types/domain";

/** Below this many real focused minutes a session does not count as a sprint. */
export const MIN_COUNTED_MINUTES = 5;
/** Focused minutes that earn base XP are capped here per session. */
export const MAX_BASE_MINUTES = 120;
export const XP_PER_FIVE_MINUTES = 1;
export const LONG_SESSION_MINUTES = 45;
export const LONG_SESSION_BONUS = 5;
export const FIRST_OF_DAY_BONUS = 5;
export const WEEKLY_CONSISTENCY_DAYS = 4;
export const WEEKLY_CONSISTENCY_BONUS = 10;

/** THE level curve — every level-from-XP computation goes through here (RC1 audit D1). */
export const XP_PER_LEVEL = 100;

export function computeLevel(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
}

export interface XpBreakdownLine {
  label: string;
  xp: number;
}

export interface FocusXpResult {
  totalXp: number;
  lines: XpBreakdownLine[];
  /** False when the session was too short to count as a sprint at all. */
  counted: boolean;
}

/** A session that counts toward sprints/achievements/relationships. */
export function isCountedSession(record: Pick<FocusSessionRecord, "status" | "elapsedFocusSeconds">): boolean {
  return (
    (record.status === "completed" || record.status === "finished-early") &&
    record.elapsedFocusSeconds >= MIN_COUNTED_MINUTES * 60
  );
}

/**
 * Computes XP for a session that is about to be recorded. `priorSessions`
 * must NOT include the session being completed.
 */
export function computeFocusXp(
  elapsedFocusSeconds: number,
  priorSessions: FocusSessionRecord[],
  now: Date = new Date()
): FocusXpResult {
  const minutes = Math.floor(elapsedFocusSeconds / 60);
  if (minutes < MIN_COUNTED_MINUTES) {
    return {
      totalXp: 0,
      lines: [
        {
          label: `Under ${MIN_COUNTED_MINUTES} focused minutes — too short to count as a sprint`,
          xp: 0,
        },
      ],
      counted: false,
    };
  }

  const lines: XpBreakdownLine[] = [];
  const baseMinutes = Math.min(minutes, MAX_BASE_MINUTES);
  const baseXp = Math.floor(baseMinutes / 5) * XP_PER_FIVE_MINUTES;
  lines.push({ label: `${minutes} focused minutes (1 XP per 5 min${minutes > MAX_BASE_MINUTES ? ", capped at 120" : ""})`, xp: baseXp });

  if (minutes >= LONG_SESSION_MINUTES) {
    lines.push({ label: `Long session (${LONG_SESSION_MINUTES}+ minutes)`, xp: LONG_SESSION_BONUS });
  }

  const today = getMelbourneDateIso(now);
  const countedPrior = priorSessions.filter(isCountedSession);
  const firstToday = !countedPrior.some((session) => getMelbourneDateIso(new Date(session.startedAt)) === today);
  if (firstToday) {
    lines.push({ label: "First focus session today", xp: FIRST_OF_DAY_BONUS });
  }

  const recentDays = new Set<string>(
    countedPrior
      .map((session) => getMelbourneDateIso(new Date(session.startedAt)))
      .filter((dateIso) => {
        const age = daysBetweenDateIso(dateIso, today);
        return age >= 0 && age < 7;
      })
  );
  recentDays.add(today);
  if (recentDays.size >= WEEKLY_CONSISTENCY_DAYS) {
    lines.push({
      label: `Weekly consistency (${recentDays.size} study days in the last 7)`,
      xp: WEEKLY_CONSISTENCY_BONUS,
    });
  }

  return {
    totalXp: lines.reduce((sum, line) => sum + line.xp, 0),
    lines,
    counted: true,
  };
}
