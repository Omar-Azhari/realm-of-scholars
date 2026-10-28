/**
 * Realm of Scholars — the RuneScape-style game layer.
 *
 * Every subject the student enrols in becomes a SKILL (levels 1-99) and a
 * REGION of the world. Every assessment becomes a QUEST. Every teaching
 * week becomes a WAYSTONE the player can study at. Mini-games draw their
 * content from the subject's curriculum (key terms + practice questions).
 *
 * This file is data shapes only — no React, no rendering.
 */

/** How trustworthy a piece of curriculum data is, shown to the player so nothing invented is ever presented as official. */
export type CurriculumConfidence = "official" | "document" | "inferred" | "manual";

export interface RealmWeek {
  week: number;
  title: string;
  topics: string[];
  summary: string;
}

export type RealmAssessmentKind = "exam" | "quiz" | "essay" | "report" | "project" | "presentation" | "lab" | "participation" | "other";

export interface RealmAssessment {
  id: string;
  title: string;
  kind: RealmAssessmentKind;
  /** Percentage of the final grade, null when unknown. */
  weightPercent: number | null;
  /** Teaching week it is due in, null when unknown. */
  dueWeek: number | null;
  /** ISO date (YYYY-MM-DD) when known exactly. */
  dueDate: string | null;
  description: string;
  /** Quest steps — the player ticks these off as real progress. */
  steps: string[];
}

export interface RealmKeyTerm {
  term: string;
  definition: string;
  /** Teaching week the term belongs to (1-12). Missing when unknown. */
  week?: number;
}

export interface RealmQuestion {
  id: string;
  prompt: string;
  /** Exactly four options. */
  choices: string[];
  answerIndex: number;
  explanation: string;
  week: number | null;
  /** 1 = recall, 2 = understanding, 3 = application/analysis. Missing = 2. */
  difficulty?: 1 | 2 | 3;
  /**
   * How the question is answered. Missing = "choice" (pick one of four).
   * "term": type the term the prompt describes. "cloze": type the word or phrase for the blank (the prompt holds "____").
   * "numeric": type a number. Typed kinds still carry four `choices` (a fallback for older clients and for
   * multiple-choice modes); `choices[answerIndex]` is the canonical typed answer.
   */
  kind?: QuestionKind;
  /** Typed kinds: other accepted answers (matched case-insensitively, ignoring spaces and punctuation at the ends). */
  accept?: string[];
  /** Numeric kind: accepted absolute error (e.g. 0.01) and the unit shown after the box (e.g. "days", "$"). */
  tolerance?: number;
  unit?: string;
  /** Id of a worked example (RealmWorkedExample) that teaches this kind of problem. */
  workedExample?: string;
}

export type QuestionKind = "choice" | "term" | "cloze" | "numeric";

/** A worked example: a full solution, shown step by step, then a faded version where the student fills in steps. */
export interface RealmWorkedExample {
  id: string;
  /** Subject code prefix, e.g. "CSE2UI", "PM", "PPE", "CSE3CWA" (matched like the banks). */
  subject: string;
  week: number;
  title: string;
  /** The problem statement, short. */
  problem: string;
  /** Each step: what to do, the working shown, and the step's result. In the faded version the student types `result`. */
  steps: { action: string; working: string; result: string; tolerance?: number }[];
  /** One-line takeaway. */
  takeaway: string;
}

export type RegionTheme = "arcane" | "forge" | "grove" | "archive" | "guild" | "tide" | "foundry" | "alchemy";

export interface RealmSubject {
  id: string;
  code: string;
  name: string;
  summary: string;
  theme: RegionTheme;
  weeks: RealmWeek[];
  assessments: RealmAssessment[];
  keyTerms: RealmKeyTerm[];
  questions: RealmQuestion[];
  learningOutcomes: string[];
  sourceUrls: string[];
  confidence: CurriculumConfidence;
  /** Honest note from the research step — e.g. "Assessment weights not published for 2026; typical structure shown". */
  sourceNote: string;
  /** Credit points for the WAM. Missing = 15 (a standard La Trobe subject). */
  creditPoints?: number;
}

export interface Enrolment {
  country: string;
  city: string;
  university: string;
  course: string;
  yearLevel: string;
  teachingPeriod: string;
  year: number;
  /** ISO date of the first teaching day, used to work out the current week. Null = unknown. */
  startDate: string | null;
  /** Mondays (ISO) of non-teaching weeks, e.g. the mid-semester break. They don't count as teaching weeks. */
  breakWeeks?: string[];
  /** The official assessment (exam) period, when known. */
  examPeriod?: { start: string; end: string } | null;
}

export interface RealmCurriculum {
  enrolment: Enrolment;
  subjects: RealmSubject[];
  createdAt: string;
}

export interface PlayerLook {
  skin: string;
  hair: string;
  tunic: string;
  legs: string;
  cape: string;
}

export type AvatarId = "knight" | "mage" | "rogue" | "rogue_hooded" | "barbarian";

export type BodyType = "female" | "male";

/** The player's character: body type, mixed outfit parts, body sliders and colours (see customise/humans.ts). */
export interface Appearance {
  body: BodyType;
  parts: { head: string; body: string; legs: string; feet: string };
  /** -1 (short) … 1 (tall). */
  height: number;
  /** -1 (slim) … 1 (heavy). */
  build: number;
  /** 0 … 1. */
  muscle: number;
  skin: string;
  hair: string;
  /** Recolours the outfit's cloth (null = its own colours). */
  outfitColour: string | null;
}

export interface RealmPlayer {
  name: string;
  look: PlayerLook;
  /** Which adventurer model the player wore before characters had real bodies (older saves). */
  avatar?: AvatarId;
  /** The player's character. Missing in older saves: a default is made. */
  appearance?: Appearance;
  /** Academy house id (see customise/houses.ts). */
  house?: string;
}

export type QuestStatus = "not-started" | "in-progress" | "complete";

export interface QuestProgress {
  status: QuestStatus;
  stepsDone: boolean[];
  /** Steps that have already paid out XP — un-ticking and re-ticking a step never pays twice. */
  stepsRewarded: boolean[];
  completedAt: string | null;
}

export interface WeekProgress {
  studiedAt: string | null;
  minigamesWon: number;
}

export type ItemId =
  | "tome"
  | "xp-lamp"
  | "quest-scroll"
  | "focus-candle"
  | "graduation-cape"
  | "scholar-ring"
  | "rune-shard";

export interface InventoryItem {
  id: ItemId;
  /** Display name, e.g. "Tome of Week 3 (Data Structures)". */
  name: string;
  /** Subject the item is tied to (XP lamps rub into this skill). */
  subjectId: string | null;
  quantity: number;
}

export interface ActiveFocus {
  subjectId: string;
  startedAt: string;
  minutes: number;
  /** A booked library study room: classmates joining add XP. */
  room?: { name: string; members: string[] };
}

/** One weekly class from an imported timetable. */
export interface TimetableEntry {
  key: string;
  subjectId: string | null;
  title: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** "HH:MM", local time. */
  start: string;
  end: string;
  location: string;
}

export interface DailyCounter {
  date: string;
  /** subjectId -> mini-game wins today (drives diminishing XP so grinding never beats real study). */
  wins: Record<string, number>;
  /** Waystones studied today (daily challenge). */
  studied?: number;
  /** Quest steps completed today (daily challenge). */
  steps?: number;
  /** Today's daily-challenge reward has been claimed. */
  claimed?: boolean;
}

/** A question the player got wrong, waiting in the Grimoire of Mistakes for spaced review. */
export interface MistakeEntry {
  subjectId: string;
  /** Snapshot, so the review still works if the bank changes. */
  question: RealmQuestion;
  /** 0 = review tomorrow, 1 = in 3 days, 2 = in 7 days. Answering right at box 2 masters it. */
  box: number;
  /** Local date (YYYY-MM-DD) the card is next due. */
  dueOn: string;
  misses: number;
  addedAt: string;
}

export interface StudyStreak {
  current: number;
  best: number;
  /** Last local date with real study, null = never. */
  lastDay: string | null;
}

/** Body parts that can be swapped between adventurer classes (they share one rig). */
export type OutfitSlot = "head" | "torso" | "arms" | "legs" | "cape" | "headgear";
/** Parts that can be dyed. */
export type DyeSlot = "torso" | "arms" | "legs" | "headgear";

export interface Wardrobe {
  owned: string[];
  cape: string | null;
  hat: string | null;
  pet: string | null;
  /** Per-slot class to borrow the part from ("none" hides it). Missing = the avatar's own part. */
  outfit: Partial<Record<OutfitSlot, AvatarId | "none">>;
  /** Per-slot dye id (see customise/outfit.ts). */
  dyes: Partial<Record<DyeSlot, string>>;
}

/** A piece of furniture placed in the dorm room. */
export interface PlacedFurniture {
  uid: string;
  id: string;
  /** Grid cell of the footprint's min corner (floor items) or wall column (wall items). */
  c: number;
  r: number;
  /** Quarter turns. */
  rot: 0 | 1 | 2 | 3;
}

export interface Dorm {
  /** Furniture id -> how many the player owns. */
  owned: Record<string, number>;
  placed: PlacedFurniture[];
}

/** A classmate's progress, pasted in as a share code. */
export interface GroupMember {
  name: string;
  university: string;
  period: string;
  /** Subject code -> level. */
  levels: Record<string, number>;
  totalLevel: number;
  questPoints: number;
  streak: number;
  /** When the code was made (ISO). */
  sharedAt: string;
  /** Academy house and that classmate's own house points (newer codes only). */
  house?: string;
  housePoints?: number;
  /** Arena ratings and personal bests per game, and the season they were shared in (newer codes only). */
  arena?: Partial<Record<ArenaGameId, { rating: number; best: number }>>;
  arenaSeason?: string;
}

/** The Arena's competitive study games (see src/realm/arena/). */
export type ArenaGameId = "buzzer" | "blitz" | "lexicon" | "connections" | "sequence";

/** One game's ranked record. */
export interface ArenaRecord {
  /** Elo-style rating (starts at 1000). */
  rating: number;
  /** Highest rating ever reached. */
  peak: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Current win streak and the best one. */
  streak: number;
  bestStreak: number;
  /** Personal best score in this game's points. */
  best: number;
  /** This season's highest rating and wins. */
  seasonPeak: number;
  seasonWins: number;
}

export interface ArenaProgress {
  /** Weekly season id (ISO week, e.g. "2026-W43"). */
  season: string;
  games: Partial<Record<ArenaGameId, ArenaRecord>>;
  /** Today's capped arena rewards, and ranked daily puzzles already played ("game|subjectId"). */
  daily: { date: string; xp: number; coins: number; focus: number; played: string[] };
}

export interface AnswerTally {
  right: number;
  wrong: number;
}

export interface AssessmentMark {
  score: number;
  outOf: number;
}

export interface MockExamResult {
  subjectId: string;
  at: string;
  right: number;
  total: number;
  minutes: number;
}

/** A letter in the owl-post mailbox. */
export interface Letter {
  /** Stable id: the same news never arrives twice. */
  key: string;
  at: string;
  from: string;
  subject: string;
  body: string;
  read: boolean;
}

export interface RealmProgress {
  skillXp: Record<string, number>;
  /** Energy earned by studying and spent on playing (gathering, dungeons, arcade). */
  focus: number;
  /** Life-skill XP (fishing, mining, woodcutting, cooking, crafting, combat). */
  lifeXp: Record<string, number>;
  /** Gathered and cooked materials: id -> count. */
  materials: Record<string, number>;
  /** Weapons the player has crafted, and the one they carry. */
  weapons: string[];
  weapon: string | null;
  /** key: `${subjectId}:${week}` (or `${subjectId}:all` for whole-subject questions) — drives the weak-spot map. */
  accuracy: Record<string, AnswerTally>;
  /** assessmentId -> the mark the student actually received. */
  marks: Record<string, AssessmentMark>;
  /** achievementId -> ISO time unlocked. */
  achievements: Record<string, string>;
  /** Achievement title shown above the player, or null. */
  title: string | null;
  mockExams: MockExamResult[];
  /** concept key -> best "explain it back" score (0-100). */
  explained: Record<string, number>;
  /** Simple lifetime counters: mastered (Grimoire), workshopWins. */
  counters: Record<string, number>;
  /** The exam-week siege bonus was claimed for this semester. */
  siegeClaimed: boolean;
  /** key: question key (see mistakeKey) */
  mistakes: Record<string, MistakeEntry>;
  streak: StudyStreak;
  wardrobe: Wardrobe;
  /** The player's decoratable dorm room. */
  dorm: Dorm;
  /** Islands visited (passport stamps) and rivals beaten: island id -> ISO time. */
  voyages: { stamps: Record<string, string>; rivals: Record<string, string> };
  /** Weekly classes from an imported timetable. */
  timetable: TimetableEntry[];
  /** Class follow-up bonuses already paid ("date|class key"), most recent last. */
  classClaims: string[];
  /** Lectures attended in the lecture theatre: "subjectId:week" -> local date (YYYY-MM-DD) last attended. */
  lectures: Record<string, string>;
  /** Secret doors opened: door id -> ISO time. */
  secrets: Record<string, string>;
  /** Duelling club: this season (YYYY-MM), your rank (1 = top) and best rank. */
  ladder: { season: string; rank: number; best: number };
  /** Potion boosts: buff id -> ISO time it wears off. */
  buffs: Record<string, string>;
  /** Spell ids on the four-slot spell bar (see life/spells.ts); "" = empty. */
  spellbar: string[];
  /** Owl post, newest first. */
  mail: Letter[];
  /** Last night slept in the dorm bed (local date) and when the "well rested" XP bonus ends (ISO). */
  rest: { lastDay: string | null; until: string | null };
  /** assessmentId -> ISO time the deadline boss was beaten. */
  bosses: Record<string, string>;
  /** Classmates added by share code, keyed by name|university. */
  group: Record<string, GroupMember>;
  quests: Record<string, QuestProgress>;
  /** key: `${subjectId}:${week}` */
  weeks: Record<string, WeekProgress>;
  questPoints: number;
  coins: number;
  inventory: InventoryItem[];
  activeFocus: ActiveFocus | null;
  daily: DailyCounter;
  graduatedAt: string | null;
  /** Total real focus minutes completed. */
  focusMinutes: number;
  /** Arena ratings, records and today's capped rewards. */
  arena: ArenaProgress;
  /** Play-world games (parkour, archery, ping pong…): game id -> record (state/playGames.ts). */
  games: Record<string, PlayRecord>;
}

export interface PlayRecord {
  /** Best score (or best time, for games where lower is better); null before the first finish. */
  best: number | null;
  plays: number;
  medal: "bronze" | "silver" | "gold" | null;
  /** Coins paid today (local date), for the daily cap. */
  coinsDay: string;
  coinsToday: number;
}

export interface RealmSettings {
  sound: boolean;
  /** Background music (synthesised, no files). */
  music: boolean;
  /** Browser notifications for deadlines, reviews and streaks. */
  reminders: boolean;
  /** Sky follows the real clock (night after dark). */
  realTimeSky: boolean;
  /** Interface text size multiplier. */
  textScale: 1 | 1.15 | 1.3;
  /** Blue/orange instead of green/red, plus ✓/✗ marks. */
  colorblind: boolean;
  /** Turns off interface animations. */
  reduceMotion: boolean;
  /** Persisted camera zoom, 0-1. */
  zoom: number;
  /** "ultra" adds ambient occlusion (strong GPUs); "high" has bloom, tone mapping and anti-aliasing; "low" is for older laptops. */
  graphics: "ultra" | "high" | "low";
}

export interface RealmState {
  version: 1;
  player: RealmPlayer | null;
  curriculum: RealmCurriculum | null;
  progress: RealmProgress;
  settings: RealmSettings;
}

export type ChatChannel = "game" | "quest" | "level" | "npc";

export interface ChatMessage {
  id: number;
  channel: ChatChannel;
  text: string;
}
