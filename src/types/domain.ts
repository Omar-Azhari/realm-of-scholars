/**
 * UniGame complete data model.
 *
 * This is the single source of truth for entity shapes used by the seed data
 * (`src/data/*`) and, later, the app's local-storage save format and UI.
 * Nothing here is UI code — no React, no components. Phase 2+ code reads
 * these shapes; it does not redefine them.
 *
 * Reliability rule (see planning/DOCUMENT_AUDIT.md): any field not clearly
 * confirmed in /docs is represented as `null` + `status: "needs_confirmation"`
 * via `ConfirmableValue<T>`, never a guessed value.
 */

// ---------------------------------------------------------------------------
// Confirmation primitives
// ---------------------------------------------------------------------------

/** Per-field confirmation state. */
export type FieldConfirmationStatus = "confirmed" | "needs_confirmation";

/** Overall record confirmation state, derived from its constituent fields. */
export type ConfirmationStatus =
  | "confirmed"
  | "partially_confirmed"
  | "needs_confirmation";

export interface ConfirmableValue<T> {
  value: T | null;
  status: FieldConfirmationStatus;
}

export function confirmed<T>(value: T): ConfirmableValue<T> {
  return { value, status: "confirmed" };
}

export function unconfirmed<T>(): ConfirmableValue<T> {
  return { value: null, status: "needs_confirmation" };
}

/** Derives an overall status from the fields that matter for "is this record usable". */
export function deriveConfirmationStatus(
  ...fields: Array<ConfirmableValue<unknown>>
): ConfirmationStatus {
  const confirmedCount = fields.filter((f) => f.status === "confirmed").length;
  if (confirmedCount === fields.length) return "confirmed";
  if (confirmedCount === 0) return "needs_confirmation";
  return "partially_confirmed";
}

/** How a due-date/time window is expressed in the source material. */
export type DateKind =
  | "exact"
  | "week_only"
  | "placeholder_in_source"
  | "source_conflict"
  | "missing";

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface ReminderOffset {
  label: string;
  /** ISO 8601 duration, e.g. "P28D", "PT3H". */
  isoDuration: string;
}

/** The fixed offsets defined by every subject's "UniGame reminder rules" note. */
export const DEFAULT_REMINDER_OFFSETS: readonly ReminderOffset[] = [
  { label: "4 weeks before", isoDuration: "P28D" },
  { label: "2 weeks before", isoDuration: "P14D" },
  { label: "1 week before", isoDuration: "P7D" },
  { label: "3 days before", isoDuration: "P3D" },
  { label: "1 day before", isoDuration: "P1D" },
  { label: "3 hours before", isoDuration: "PT3H" },
];

export interface ReminderSchedule {
  offsets: readonly ReminderOffset[];
  /** True only when dueDate and dueTime are both confirmed. */
  active: boolean;
  /** Explains why reminders are inactive, when active is false. */
  reason: string | null;
}

/**
 * Builds a reminder schedule following the rule stated in every subject's
 * assessments file: reminders are only scheduled once due date AND due time
 * are confirmed; otherwise the schedule exists but stays inactive.
 */
export function deriveReminderSchedule(
  dueDate: ConfirmableValue<unknown>,
  dueTime: ConfirmableValue<unknown>
): ReminderSchedule {
  const active = dueDate.status === "confirmed" && dueTime.status === "confirmed";
  return {
    offsets: DEFAULT_REMINDER_OFFSETS,
    active,
    reason: active
      ? null
      : "Due date and/or time is not yet confirmed. Per the UniGame reminder rules stated in this subject's assessments file, deadline reminders are not scheduled until both are confirmed.",
  };
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

/** Academic Intelligence (Phase 19, Part 1/2/8). */
export interface ModuleReading {
  id: string;
  title: string;
  kind: "required" | "recommended";
  author: string | null;
  url: string | null;
  sourceFile: string;
}

export interface ModuleScheduleEntry {
  id: string;
  kind: "lecture" | "tutorial" | "lab";
  title: string;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  sourceFile: string;
}

export interface ModuleRecord {
  id: string;
  subjectId: string;
  /** 1-12. */
  moduleNumber: number;
  title: string;
  overview: string;
  suggestedTasks: string[];
  miniGameIdeas: string[];
  sourceNote: string;
  /** Phase 19 (additive) — defaults to [] for every save that predates this field. */
  readings: ModuleReading[];
  /** Phase 19 (additive) — defaults to [] for every save that predates this field. */
  schedule: ModuleScheduleEntry[];
  /** Phase 19 (additive) — learning outcomes, verbatim source text. Defaults to [] for every save that predates this field. */
  outcomes: string[];
  /** Phase 19 (additive) — ids of OTHER modules (same subject) this one depends on. Defaults to [] for every save that predates this field. */
  prerequisiteModuleIds: string[];
  /** Phase 19 (additive, Part 9) — field names a user has directly edited since import, so a future re-import/sync never silently overwrites them (same pattern as CanvasRemoteSnapshot.userOverriddenFields). Defaults to [] for every save that predates this field. */
  manualOverrides: string[];
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export type AssessmentKind =
  | "essay"
  | "report"
  | "exam"
  | "project"
  | "presentation"
  | "quiz"
  | "other";

export interface AssessmentRecord {
  id: string;
  subjectId: string;
  /** The subject's assessment sequence number (1-4), matching the source's own numbering. */
  assessmentNumber: number;
  /** e.g. "Part 1: Group Project Management Plan"; null for assessments with no parts. */
  part: string | null;
  title: string;
  kind: AssessmentKind;
  weight: ConfirmableValue<number>;
  /** Literal weight text as shown in source (preserves qualifiers like "(recorded)"). */
  weightRaw: string;
  /** ISO date (YYYY-MM-DD), Australia/Melbourne local calendar date. */
  dueDate: ConfirmableValue<string>;
  /** 24-hour local time "HH:mm", Australia/Melbourne. */
  dueTime: ConfirmableValue<string>;
  /** Raw due-date text from source when an exact date isn't available (e.g. "Week 4, 3-9 August 2026"). */
  dueWindowRaw: string;
  dateKind: DateKind;
  /** Derived from weight/dueDate/dueTime — see deriveConfirmationStatus. */
  confirmationStatus: ConfirmationStatus;
  aiPolicy: ConfirmableValue<string>;
  extensionEligibility: ConfirmableValue<string>;
  reminderSchedule: ReminderSchedule;
  /** What the assessment requires (task content), as described in source. */
  description: string;
  /** Freeform commentary: conflicts, caveats, what remains to be confirmed. */
  notes: string;
  /** Path (or screenshot label) identifying the source evidence for this record. */
  sourceFile: string;
  /** Phase 19 (additive) — exam format/duration/materials, only meaningful when kind === "exam". Defaults to unconfirmed() for every save that predates this field. */
  examInfo: ConfirmableValue<string>;
}

// ---------------------------------------------------------------------------
// Subjects & semester
// ---------------------------------------------------------------------------

export interface SubjectRecord {
  id: string;
  name: string;
  code: ConfirmableValue<string>;
  colourTheme: string;
  characterConcept: string;
  modules: ModuleRecord[];
  assessments: AssessmentRecord[];
}

export interface SemesterRecord {
  label: string;
  timezone: string;
  startDate: ConfirmableValue<string>;
  endDate: ConfirmableValue<string>;
  breaks: Array<{ label: string; range: ConfirmableValue<string> }>;
  examPeriod: ConfirmableValue<string>;
  weekNumberingNote: string;
  subjects: SubjectRecord[];
}

// ---------------------------------------------------------------------------
// Forward-looking entities (from planning/FEATURE_PLAN.md section 1).
// Not seeded with data yet — no such data exists in /docs — but part of the
// complete model so Phase 2+ code has a stable shape to build against instead
// of inventing one ad hoc when reminders/tasks/progress are implemented.
// ---------------------------------------------------------------------------

export type TaskType = "study" | "milestone" | "reminder" | "custom";

export interface TaskRecord {
  id: string;
  linkedAssessmentId: string | null;
  linkedModuleId: string | null;
  title: string;
  type: TaskType;
  dueDate: string | null;
  estimatedMinutes: number | null;
  completed: boolean;
  /** ISO timestamp of when `completed` last became true; null while incomplete. */
  completedAt: string | null;
  /** ISO timestamp of the first time this task's detail was opened/reviewed; null until then. */
  reviewedAt: string | null;
  xpReward: number;
  weekNumber: number | null;
}

export type AssessmentProgressStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded";

export interface UserAssessmentProgress {
  assessmentId: string;
  progressPercent: number;
  status: AssessmentProgressStatus;
  /** ISO timestamp of the last status change (Phase 11, additive) — lets the timeline date submissions. */
  statusChangedAt: string | null;
  estimatedHours: number | null;
  hoursCompleted: number;
  checklist: Array<{ id: string; label: string; done: boolean }>;
  grade: number | null;
  /** User's own reference links for this assessment (LMS page, shared doc, etc.) — not seed data. */
  links: Array<{ id: string; label: string; url: string }>;
}

// ---------------------------------------------------------------------------
// Reminders (save v2)
// ---------------------------------------------------------------------------

export type ReminderKind =
  | "assessment-deadline"
  | "assessment-start"
  | "milestone"
  | "weekly-planning"
  | "study-session"
  | "overdue-task"
  | "needs-confirmation";

export type ReminderStatus = "pending" | "dismissed" | "completed";

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  title: string;
  subjectId: string | null;
  assessmentId: string | null;
  /** For auto deadline reminders: the ISO offset this instance represents (e.g. "P7D"); null for custom. */
  offsetIso: string | null;
  /** When the reminder fires — Australia/Melbourne wall clock, "YYYY-MM-DDTHH:mm". */
  fireAt: string;
  /** Original source wording (e.g. "11:59 pm AEST, Sunday 9 August 2026") kept for traceability. */
  sourceWindow: string | null;
  status: ReminderStatus;
  /** Melbourne wall-clock key until which this reminder is snoozed; null = not snoozed. */
  snoozedUntil: string | null;
  /** Set when the app has surfaced this firing (sound/browser notification) — prevents repeats. */
  notifiedAt: string | null;
  /** "auto" reminders are generated/synced from assessment data; "user" ones are hand-created. */
  origin: "auto" | "user";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Study logs (save v2)
// ---------------------------------------------------------------------------

/** 1 (rough) … 5 (great). */
export type MoodRating = 1 | 2 | 3 | 4 | 5;

export interface StudyLogEntry {
  id: string;
  subjectId: string;
  assessmentId: string | null;
  moduleId: string | null;
  /** Australia/Melbourne wall clock, "YYYY-MM-DDTHH:mm". */
  dateTime: string;
  durationMinutes: number | null;
  completed: string;
  difficulties: string;
  nextPlan: string;
  moodBefore: MoodRating | null;
  moodAfter: MoodRating | null;
  notes: string;
  /** Reserved: links this log to a Focus Sprint session in a later phase. */
  focusSessionId: string | null;
}

export interface UserProgress {
  xp: number;
  level: number;
  streakCount: number;
  /** Highest streak ever reached (Phase 7, additive — defaults to streakCount on old saves). */
  longestStreak: number;
  lastActiveDate: string | null;
  perSubjectCompletionPercent: Record<string, number>;
  overallCompletionPercent: number;
}

// ---------------------------------------------------------------------------
// Focus Sprint (Phase 7 — additive save-v2 fields)
// ---------------------------------------------------------------------------

export type FocusSessionStatus = "completed" | "finished-early" | "cancelled";

/**
 * The single in-flight Focus Sprint. Timer state is reconstructed from real
 * clock time: elapsed = accumulatedMs + (now - segmentStartedAt when
 * running), so a page refresh (or laptop sleep) never loses time.
 */
export interface ActiveFocusSession {
  id: string;
  subjectId: string;
  assessmentId: string | null;
  moduleId: string | null;
  /** ISO timestamp when the session was started. */
  startedAt: string;
  focusMinutes: number;
  breakMinutes: number;
  /** Focused milliseconds banked from finished run segments (pauses close a segment). */
  accumulatedMs: number;
  /** ISO timestamp when the current running segment began; null while paused. */
  segmentStartedAt: string | null;
  /** Notes typed during the session — copied into the journal entry on completion. */
  notes: string;
}

export interface FocusSessionRecord {
  id: string;
  subjectId: string;
  assessmentId: string | null;
  moduleId: string | null;
  startedAt: string;
  endedAt: string;
  focusMinutesPlanned: number;
  breakMinutesPlanned: number;
  /** Real focused time — the only basis for XP and study-time totals. */
  elapsedFocusSeconds: number;
  status: FocusSessionStatus;
  xpAwarded: number;
  /** The auto-created Study Journal entry (null for cancelled sessions). */
  journalEntryId: string | null;
}

/**
 * Per-mentor stored bond state. Only the once-per-day visit counter is
 * stored — everything else about a relationship is derived from real saved
 * activity (see src/lib/mentorRelationship.ts), so it can never drift.
 */
export interface MentorBond {
  /** Distinct Melbourne days the player entered this subject's room. */
  visitDays: number;
  lastVisitDate: string | null;
}

/**
 * Phase 21 Part 3 "Campus Memory" — the ONE piece of NPC state that's
 * genuinely stored rather than derived (everything else about a
 * relationship — Level, Trust, Familiarity, Mood — is a pure function of
 * real save data, see `src/lib/mentorRelationship.ts`/`npcRelationship.ts`).
 * A greeting/advice LINE can't be re-derived after the fact (the priority
 * ladder that chose it depends on the moment it ran), so remembering what
 * was actually said — and recognising "we already spoke today" — needs a
 * real memory. Keyed by a stable NPC key: a subject id for subject
 * mentors, `"guide"` for the Campus HQ mentor. Population NPCs
 * (librarian, lab technician, etc.) are deliberately NOT tracked here —
 * "important NPC" per the brief, not every background character.
 */
export interface NpcMemoryEntry {
  /** The last line this NPC said to the player, for recognition/journal display. */
  lastLine: string | null;
  /** Melbourne calendar day (YYYY-MM-DD) the last line was said — drives "already greeted today" recognition. */
  lastLineDate: string | null;
  /** Full ISO timestamp of the last interaction, for the Journal's "recent memories" ordering. */
  lastInteractionAt: string | null;
  /**
   * Phase 23 (additive) — the last few conversation topics shown (a small,
   * capped, most-recent-last list), so a later visit can avoid picking the
   * identical topic again ("never repeat identical conversations"). Never
   * grows unbounded — capped in `npcMemory.ts`.
   */
  recentTopics: string[];
  /**
   * Phase 23 (additive) — an assessment flagged as under real pressure
   * during a past conversation (low progress + a close confirmed
   * deadline), so a later visit can honestly follow up once its status
   * changes ("How did that go?") without ever claiming the player "told"
   * the mentor anything — there is no free-text input anywhere in this
   * game. Cleared once followed up.
   */
  flaggedAssessmentId: string | null;
  flaggedAssessmentAt: string | null;
  /** Phase 24 "Mentor Relationships" (additive) — total real conversations opened with this NPC (recognition-collapsed repeats count too — they're still a real interaction). Never reset. */
  conversationCount: number;
  /**
   * Phase 24 (additive) — a small, capped log of advice actually given
   * (the `RecommendationEngine.ts` category + subject it concerned, and
   * when). Used only for the honest, disclosed "advice followed" heuristic
   * in `ai/MentorRelationshipStats.ts` — real subsequent activity within a
   * time window, never a certain read of causality or intent.
   */
  adviceLog: Array<{ category: string; subjectId: string | null; at: string }>;
}

/**
 * Phase 21 Part 2/3/8 — visit tracking for the 6 real campus LOCATIONS
 * (as opposed to `mentorBonds`, which tracks visits to a SUBJECT's own
 * room/building). Same shape and same once-per-Melbourne-day increment
 * rule as `MentorBond`, deliberately — "You've been visiting the library
 * a lot" and the Journal's "favourite building" both need real, per-
 * building visit frequency, which nothing before this phase tracked
 * (buildings were pure travel destinations with no memory of their own).
 */
export interface BuildingVisitRecord {
  visitDays: number;
  lastVisitDate: string | null;
}

/**
 * Phase 22 Part 5 (additive): one real, distinct-day building visit — the
 * minimum needed to honestly answer "how many times did you visit the
 * Library THIS WEEK" (`BuildingVisitRecord` above only ever stores a
 * lifetime total + the single most recent date, which can't answer a
 * rolling-window question). Appended to by the same `recordBuildingVisit`
 * mutation, on the same "new day" gate, so it always has exactly one entry
 * per building per distinct visit day — never a fabricated one. Capped to
 * the most recent ~90 entries (SaveDataContext) so a long-lived save's
 * history doesn't grow unbounded.
 */
export interface BuildingVisitLogEntry {
  sceneId: string;
  dateIso: string;
}

/**
 * A first-seen timestamp for a derived milestone (Phase 11, additive).
 * Locked/unlocked state is ALWAYS re-derived from the save — this log only
 * remembers *when* a derived state was first observed, so the Semester
 * Timeline can order events chronologically.
 */
export interface MilestoneEntry {
  /** Stable id, e.g. "achievement:first-sprint", "bond:user-interface-design:2", "stage:project-management:1". */
  id: string;
  /** Phase 22 Part 6 (additive): "goal-complete" — a daily AI Mentor goal (`GoalSystem.ts`) completed, one per goal per day (the id is date-suffixed, so completing the same goal template again tomorrow logs a fresh entry). */
  kind: "achievement" | "bond-level" | "room-stage" | "semester-complete" | "goal-complete";
  label: string;
  /** ISO timestamp of first observation. */
  at: string;
}

/**
 * Phase 24 (additive) — one fired Proactive Mentor Engine event, kept only
 * so the SAME condition doesn't get re-surfaced (cooldown for continuous
 * conditions like "heavy workload," permanent once-ever for a specific
 * real event like a milestone). See `ai/ProactiveMentorEngine.ts` for how
 * `triggerId` is built (it doubles as the dedupe key — e.g.
 * "confidence-low:user-interface-design", "milestone:goal:study-45:2026-08-12").
 */
export interface ProactiveLogEntry {
  triggerId: string;
  firedAt: string;
}

/** Phase 24 (additive) — the once-per-day "what are you focusing on today?" multiple-choice pick. `subjectId: null` means "not sure yet," a real, honest answer, not a missing one. */
export interface DailyCheckIn {
  dateIso: string;
  subjectId: string | null;
}

/** Phase 24 (additive) — the once-per-day "how did today feel?" multiple-choice pick, asked when the player is leaving for the day. */
export interface EveningCheckIn {
  dateIso: string;
  feltManageable: boolean;
}

/** One default assessment-reminder offset with its user toggle. */
export interface ReminderOffsetSetting {
  /** ISO 8601 duration, e.g. "P28D", "PT3H" — matches DEFAULT_REMINDER_OFFSETS. */
  isoDuration: string;
  enabled: boolean;
}

export interface QuietHoursSetting {
  enabled: boolean;
  /** Australia/Melbourne local hours, 0-23. A window may wrap midnight (e.g. 22 → 7). */
  startHour: number;
  endHour: number;
}

/**
 * Phase 20F Part 10 mixer volumes, 0–1 per category. Deliberately a plain,
 * import-free shape (this file stays dependency-free) rather than reusing
 * `SoundCategory` from `lib/sound.ts` — the key set must match that type's
 * literal union exactly; `lib/sound.ts` is the source of truth for what the
 * categories mean, this is only the save-data shape for them.
 */
export interface SoundMixerSettings {
  ambience: number;
  footsteps: number;
  interaction: number;
  ui: number;
  npc: number;
  music: number;
}

export interface AppSettings {
  reducedMotion: boolean;
  /** Sound effects are opt-in — off until the user enables them in Settings. */
  soundEnabled: boolean;
  /** Phase 20F Part 10 — per-category mix levels, applied only once `soundEnabled` is true. Additive; a save from before this phase gets all-1.0 defaults via migration. */
  soundVolumes: SoundMixerSettings;
  /** App-level opt-in for browser notifications (separate from the browser's own permission). */
  browserNotificationsEnabled: boolean;
  notificationPermission: "default" | "granted" | "denied";
  /** Per-offset enable/disable for auto assessment-deadline reminders. */
  reminderOffsets: ReminderOffsetSetting[];
  /** Generate a Monday-morning weekly planning reminder. */
  weeklyPlanningReminder: boolean;
  /** Suppress browser notifications during these Melbourne-local hours. */
  quietHours: QuietHoursSetting;
  dataVersion: number;
  theme: "system" | "light" | "dark";
  /** Manual Priority Centre override — assessment/module ids pinned to the top of Recommended regardless of score. */
  pinnedPriorityIds: string[];
  /** First-run coach mark in the HQ hall — dismissed by the X or by entering any room. */
  onboardingHintDismissed: boolean;
  /** Semester Setup was auto-offered once on a genuinely empty first launch — never re-shown automatically after this. */
  semesterSetupOffered: boolean;
  /** Phase 20 (additive) — which world renderer displays the game world; the renderer only ever DISPLAYS academic state, it never owns it. Defaults to "legacy-2d" for every save that predates this field. */
  worldRenderer: WorldRenderer;
  /** Phase 20F Part 15 — only ever affects the 3D Campus renderer (dpr cap, shadow map size/on-off); the legacy 2D renderer has no concept of graphics quality and is untouched either way. "auto" (default) picks a tier from `navigator.hardwareConcurrency`/`deviceMemory` at runtime, never stored as a resolved value — a save with "auto" re-evaluates on every device it's opened on. */
  graphicsQuality: GraphicsQuality;
  /** Phase 20F Part 13 — the 3D Campus's own first-session guidance coach mark (separate from `onboardingHintDismissed` above, which is the legacy 2D world's equivalent — the two renderers' first-run guidance are independent, dismissing one never silently dismisses the other). Resettable from Settings. */
  campus3DGuidanceDismissed: boolean;
}

/** Phase 20 — the 3D renderer is opt-in and experimental; switching back to "legacy-2d" at any time fully restores the existing world with zero data loss, since both renderers read the same save. "prestige-v2" (V2 Phase 1, additive) is a THIRD, independent renderer — the Prestige Vertical Slice (docs/UNIGAME_V2_MASTER_DESIGN.md) — coexisting with, never replacing, "experimental-3d"; switching between any of the three is always non-destructive since all three read the same save. */
export type WorldRenderer = "legacy-2d" | "experimental-3d" | "prestige-v2";

/** Phase 20F Part 15 — 3D Campus rendering quality. "auto" resolves to one of the other three at runtime (see `src/game3d/quality.ts`), never stored resolved. */
export type GraphicsQuality = "auto" | "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// Player identity (Phase 20B, additive) — who the player is and how their
// character looks, distinct from PersonalGoals (study planning targets)
// below and from AppSettings (app preferences). Every id field here is a
// CATALOGUE id (src/data/appearanceCatalogue.ts,
// src/data/personalityTraits.ts) — never a mesh path or asset URL, so a
// save file never depends on a specific 3D asset existing.
//
// `playerIdentity` on `UniGameSaveData` is `null` only for a save that has
// never been through the onboarding flow or migration — see
// `sanitizeSaveData`'s handling in persistence.ts. Once non-null (whether
// user-authored via onboarding, or backfilled with defaults for a save that
// predates this phase), onboarding never shows again — "returning users
// skip directly to Campus" (Phase 20B brief, Part 1).
// ---------------------------------------------------------------------------

/** A small, genuinely-fixed set — unlike the extensible appearance/personality catalogues below, this doesn't grow over time, so a closed union is appropriate here. */
export type YearLevel = "first-year" | "second-year" | "third-year" | "fourth-year" | "postgraduate" | "other";

/**
 * Every field is a catalogue id (validated against
 * `src/data/appearanceCatalogue.ts` at the point of use, the same way
 * imported subject/module ids are validated against their own data rather
 * than baked into the type system) — never a mesh path, per the brief's
 * explicit "no mesh paths inside save files."
 */
export interface CharacterAppearance {
  bodyId: string;
  skinToneId: string;
  hairId: string;
  hairColorId: string;
  eyesId: string;
  eyebrowsId: string;
  /** `null` = clean-shaven / no facial hair option selected. */
  facialHairId: string | null;
  topId: string;
  /** `null` = no jacket layer. */
  jacketId: string | null;
  bottomId: string;
  shoesId: string;
  /** 0 or more accessory catalogue ids — order is display/layering order. */
  accessoryIds: string[];
}

/** One primary trait, up to two secondary traits — Phase 20B Part 7. Trait ids are validated against `src/data/personalityTraits.ts`, not a closed union, so the trait list can grow without a type change (same extensibility precedent as the appearance catalogue). */
export interface PlayerPersonality {
  primaryTraitId: string;
  /** At most 2 — enforced where this is edited (the Character Creator), not by the type itself. */
  secondaryTraitIds: string[];
}

/** The six Art Bible room themes (docs/UNIGAME_ART_BIBLE.md Part 9). Stored as a player preference now, ahead of Milestone 20D's room customisation actually consuming it — the same "store the field before every consumer of it exists" precedent as `PersonalGoals`. */
export type RoomThemeId = "modern-campus" | "cozy-library" | "minimal-study" | "creative-studio" | "digital-lab" | "classic-academy";

/**
 * Phase 20D (additive) — which furniture the player has permanently
 * unlocked (checked once against real progress signals — XP, level,
 * streaks, achievements — and then kept forever, even if the underlying
 * signal later changes, e.g. a streak resets) and what's actually placed
 * in each room slot right now. `currentThemeId` is deliberately NOT a
 * field here — it already exists as `PlayerIdentity.preferredRoomTheme`
 * (Phase 20B), and Part 2's "do not duplicate information already stored
 * elsewhere" applies just as much to this phase's own new field as it did
 * to the last one.
 */
export interface RoomCustomisation {
  /** Furniture catalogue ids (src/data/furnitureCatalogue.ts) the player has ever unlocked — permanent once granted. */
  unlockedFurnitureIds: string[];
  /** Room slot id -> the furniture catalogue id currently placed there, or `null` for an empty slot (src/game3d/rooms/roomSlots.ts). */
  placedFurniture: Record<string, string | null>;
  /** Room slot id -> rotation in degrees (0/90/180/270), Room Edit Mode's "Rotate" action (Part 5) — only meaningful for slots with `rotatable: true`; absent/unused entries default to 0. */
  rotations: Record<string, number>;
}

export interface PlayerIdentity {
  preferredName: string;
  /** Optional — shown instead of `preferredName` where a "handle" reads better; falls back to `preferredName` when null. */
  displayName: string | null;
  university: string | null;
  degree: string | null;
  yearLevel: YearLevel | null;
  appearance: CharacterAppearance;
  personality: PlayerPersonality;
  preferredRoomTheme: RoomThemeId;
  /** Hex string, e.g. "#ff8a4c". */
  favouriteColour: string;
  createdAt: string;
  lastModifiedAt: string;
  schemaVersion: number;
  /** Phase 20D (additive) — see `RoomCustomisation` above. */
  roomCustomisation: RoomCustomisation;
}

// ---------------------------------------------------------------------------
// Personal goals (Phase 18A, additive) — distinct from official academic
// requirements (subjects/modules/assessments). Never inferred from an
// imported syllabus; only ever set by the user themselves, e.g. from the
// Semester Setup flow or Menu → Settings.
// ---------------------------------------------------------------------------

export interface PersonalGoals {
  targetGrade: number | null;
  weeklyStudyHours: number | null;
  /** Lowercase day names, e.g. ["monday", "wednesday"]. */
  preferredStudyDays: string[];
  desiredFocusSprintsPerWeek: number | null;
}

// ---------------------------------------------------------------------------
// Canvas sync (Phase 18E, additive) — non-secret bookkeeping only. The
// encrypted OAuth connection itself lives entirely server-side, keyed by a
// separate, non-secret installation id (see
// docs/PHASE_18E_CANVAS_INTEGRATION.md §1/§4/§10); this is only ever course
// bindings and remote-item fingerprints for change detection, so it's safe
// to round-trip through save export/import and the existing whole-save
// backup/Undo mechanism like every other field here.
// ---------------------------------------------------------------------------

export type CanvasRemoteItemType = "course" | "assignment" | "module" | "calendar-event" | "announcement";

export interface CanvasCourseBinding {
  connectionId: string;
  institutionId: string;
  canvasCourseId: number;
  /** The live SubjectRecord id this course is bound to, once mapped in Review/Apply. */
  localSubjectId: string;
  boundAt: string;
}

export interface CanvasRemoteSnapshot {
  institutionId: string;
  remoteCourseId: number;
  remoteItemId: number;
  remoteItemType: CanvasRemoteItemType;
  /** Canvas's own `updated_at`, when the resource provides one — informational, never authoritative on its own (Part 16: "use fingerprints only as supporting evidence"). */
  remoteUpdatedAt: string | null;
  contentFingerprint: string;
  lastImportedAt: string;
  lastSeenAt: string;
  localTargetId: string | null;
  /** Field names the user explicitly edited locally in Review — a later sync must never silently overwrite these (Part 17). */
  userOverriddenFields: string[];
  /** "present": seen in the most recent successful sync. "missing-once": absent from exactly one successful sync (not yet proposed as a deletion — Part 16's "never interpret one omission as deletion"). "confirmed-deleted": absent across two consecutive successful syncs — safe to propose as a deletion change. */
  remoteDeletionState: "present" | "missing-once" | "confirmed-deleted";
}

export interface CanvasSyncState {
  courseBindings: CanvasCourseBinding[];
  remoteSnapshots: CanvasRemoteSnapshot[];
}

export function createEmptyCanvasSyncState(): CanvasSyncState {
  return { courseBindings: [], remoteSnapshots: [] };
}

// ---------------------------------------------------------------------------
// Moodle sync metadata (Phase 18F). Deliberately its OWN, independently-
// named additive field/types — NOT a shared generic type with Canvas's
// above, even though the shape mirrors it field-for-field (including the
// same two-consecutive-miss deletion state machine) — see
// docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §1 for why: this already-
// working, already-tested Canvas system is never touched for a rename-only
// refactor with no functional benefit. Stored the same way, for the same
// reason: an additive `moodleSync` field gets full Undo/backup coverage
// for free from the existing whole-save-snapshot mechanism.
// ---------------------------------------------------------------------------

export type MoodleRemoteItemType = "course" | "assignment" | "quiz" | "section" | "calendar-event" | "announcement";

export interface MoodleCourseBinding {
  connectionId: string;
  institutionId: string;
  moodleCourseId: number;
  /** The live SubjectRecord id this course is bound to, once mapped in Review/Apply. */
  localSubjectId: string;
  boundAt: string;
}

export interface MoodleRemoteSnapshot {
  institutionId: string;
  remoteCourseId: number;
  remoteItemId: number;
  remoteItemType: MoodleRemoteItemType;
  /** Moodle's own `timemodified`, when the resource provides one — informational, never authoritative on its own (same discipline as Canvas's remoteUpdatedAt). */
  remoteUpdatedAt: string | null;
  contentFingerprint: string;
  lastImportedAt: string;
  lastSeenAt: string;
  localTargetId: string | null;
  /** Field names the user explicitly edited locally in Review — a later sync must never silently overwrite these. */
  userOverriddenFields: string[];
  /** "present": seen in the most recent successful sync. "missing-once": absent from exactly one successful sync (not yet proposed as a deletion). "confirmed-deleted": absent across two consecutive successful syncs — safe to propose as a deletion change. */
  remoteDeletionState: "present" | "missing-once" | "confirmed-deleted";
}

export interface MoodleSyncState {
  courseBindings: MoodleCourseBinding[];
  remoteSnapshots: MoodleRemoteSnapshot[];
}

export function createEmptyMoodleSyncState(): MoodleSyncState {
  return { courseBindings: [], remoteSnapshots: [] };
}

/**
 * Versioned local-storage root object (see planning/FEATURE_PLAN.md section
 * 7). Version 2 added `reminders`, the richer StudyLogEntry shape, and the
 * notification/reminder settings; version-1 saves are migrated on load with
 * an automatic backup (see src/lib/persistence.ts).
 */
export interface UniGameSaveData {
  version: 2;
  semester: SemesterRecord;
  tasks: TaskRecord[];
  assessmentProgress: UserAssessmentProgress[];
  reminders: ReminderRecord[];
  studyLog: StudyLogEntry[];
  /** Phase 7 (additive): the single in-flight Focus Sprint, if any. */
  activeFocusSession: ActiveFocusSession | null;
  /** Phase 7 (additive): every finished/cancelled Focus Sprint. */
  completedFocusSessions: FocusSessionRecord[];
  /** Phase 7 (additive): per-subject stored bond state (visit days only). */
  mentorBonds: Record<string, MentorBond>;
  /** Phase 21 Part 3 (additive): campus memory for important NPCs, keyed by a stable NPC key (subject id, or "guide"). */
  npcMemory: Record<string, NpcMemoryEntry>;
  /** Phase 21 Part 2/8 (additive): visit tracking for the 6 real campus locations, keyed by CampusSceneId string. */
  buildingVisits: Record<string, BuildingVisitRecord>;
  /** Phase 22 Part 5 (additive): a capped, distinct-day visit log — see `BuildingVisitLogEntry`. */
  buildingVisitLog: BuildingVisitLogEntry[];
  /** Phase 11 (additive): first-seen timestamps for derived milestones. */
  milestones: MilestoneEntry[];
  /** Phase 11 (additive): when the semester-completion ceremony was shown; null = not yet. */
  completionCelebratedAt: string | null;
  userProgress: UserProgress;
  settings: AppSettings;
  /** Phase 18A (additive): user-chosen personal study goals — never inferred from an import. */
  personalGoals: PersonalGoals;
  /**
   * Phase 18E (additive): Canvas sync metadata (course bindings + remote-
   * item snapshots for change detection) — null until a Canvas course is
   * ever bound. Deliberately NOT the encrypted OAuth connection itself
   * (that lives entirely server-side, keyed by a separate, non-secret
   * installation id — see docs/PHASE_18E_CANVAS_INTEGRATION.md §1/§10) —
   * this field only ever holds non-secret bookkeeping, so it's safe to
   * round-trip through save export/import and the existing whole-save
   * backup/Undo mechanism exactly like every other save field.
   */
  canvasSync: CanvasSyncState | null;
  /** Same additive, non-secret bookkeeping pattern as canvasSync above, for Moodle (Phase 18F). Credentials never live here — see moodleConnectionStore.ts, entirely server-side. */
  moodleSync: MoodleSyncState | null;
  /** Phase 20B (additive): `null` only for a save that has never been through onboarding or migration — see the PlayerIdentity section above and `sanitizeSaveData` in persistence.ts for exactly how this stays non-null for every returning user. */
  playerIdentity: PlayerIdentity | null;
  /** Phase 24 (additive): cooldown/persistence log for the Proactive Mentor Engine — see `ai/ProactiveMentorEngine.ts`. Capped; never fabricated. */
  proactiveMentorLog: ProactiveLogEntry[];
  /** Phase 24 (additive): today's "what are you focusing on" pick, if the player has answered the once-per-day check-in. Never free text — a real subjectId (or null for "not sure yet"), referenced descriptively by later mentor dialogue. Reset implicitly by date — a new day's check-in simply overwrites this. */
  dailyCheckIn: DailyCheckIn | null;
  /** Phase 24 (additive): today's evening "how did it feel" pick, if the player has answered it. Same real-fact, no-free-text discipline as dailyCheckIn. */
  eveningCheckIn: EveningCheckIn | null;
}

/** @deprecated Legacy alias — new code should use UniGameSaveData. */
export type UniGameSaveDataV1 = UniGameSaveData;
