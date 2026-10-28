/**
 * Runtime validation of Moodle web-service responses (Phase 18F, Part 6/7).
 * Moodle is an external system this app doesn't control — its responses
 * are never trusted blindly. Same permissive-about-extra-fields discipline
 * as `canvasSchemas.ts`: every field this app actually reads must be the
 * right type or explicitly null/absent; unrecognised extra fields Moodle
 * sends are simply ignored, never treated as invalidating the whole
 * response.
 *
 * Epoch-seconds fields (Moodle's own convention, unlike Canvas's ISO
 * strings) are converted to ISO strings here so downstream mapping code
 * works with one date vocabulary — but a `0` or missing epoch value is
 * treated as ABSENT (`null`), never as the Unix epoch date (Part 10's
 * explicit instruction: "zero or missing timestamps must remain missing,
 * not become Unix epoch dates").
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Moodle epoch-seconds -> ISO string, treating 0/missing/negative as absent — never the Unix epoch date. */
function optionalEpochSecondsToIso(value: unknown): string | null {
  const n = optionalNumber(value);
  if (n === null || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Site info (Part 7) — validated first, on every connection, before any
// other function is trusted.
// ---------------------------------------------------------------------------

export interface ValidatedSiteInfo {
  siteName: string | null;
  siteUrl: string | null;
  version: string | null;
  userId: number | null;
  userDisplayName: string | null;
  lang: string | null;
  enabledFunctions: string[];
}

export function validateSiteInfo(raw: unknown): ValidatedSiteInfo | null {
  if (!isRecord(raw)) return null;
  const functionsRaw = Array.isArray(raw.functions) ? raw.functions : [];
  const enabledFunctions = functionsRaw
    .filter(isRecord)
    .map((f) => optionalString(f.name))
    .filter((n): n is string => n !== null);
  return {
    siteName: optionalString(raw.sitename),
    siteUrl: optionalString(raw.siteurl),
    version: optionalString(raw.version),
    userId: optionalNumber(raw.userid),
    userDisplayName: optionalString(raw.fullname),
    lang: optionalString(raw.lang),
    enabledFunctions,
  };
}

/**
 * Moodle's own documented failure convention: a failed web-service call
 * typically returns HTTP 200 with a JSON body containing `exception`/
 * `errorcode`/`message` — never a non-2xx HTTP status for this case. Every
 * response is checked against this shape BEFORE being treated as a
 * successful result (see moodleClient.ts) — a real, Moodle-specific
 * failure mode Canvas's client never had to handle.
 */
export function isMoodleExceptionEnvelope(raw: unknown): raw is { exception: unknown; errorcode: unknown; message: unknown } {
  return isRecord(raw) && typeof raw.exception === "string" && typeof raw.errorcode === "string";
}

// ---------------------------------------------------------------------------
// Courses (Part 8)
// ---------------------------------------------------------------------------

export interface ValidatedMoodleCourse {
  id: number;
  shortName: string | null;
  fullName: string | null;
  category: number | null;
  startDateIso: string | null;
  endDateIso: string | null;
  visible: boolean | null;
  progress: number | null;
  viewUrl: string | null;
  lastAccessIso: string | null;
}

export function validateMoodleCourse(raw: unknown): ValidatedMoodleCourse | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    shortName: optionalString(raw.shortname),
    fullName: optionalString(raw.fullname),
    category: optionalNumber(raw.category),
    startDateIso: optionalEpochSecondsToIso(raw.startdate),
    endDateIso: optionalEpochSecondsToIso(raw.enddate),
    visible: optionalBoolean(raw.visible),
    progress: optionalNumber(raw.progress),
    viewUrl: optionalString(raw.viewurl),
    lastAccessIso: optionalEpochSecondsToIso(raw.lastaccess),
  };
}

// ---------------------------------------------------------------------------
// Course content: sections + modules (Part 9/12)
// ---------------------------------------------------------------------------

export interface ValidatedModuleContent {
  type: string | null;
  filename: string | null;
  fileUrl: string | null;
}

function validateModuleContent(raw: unknown): ValidatedModuleContent | null {
  if (!isRecord(raw)) return null;
  return { type: optionalString(raw.type), filename: optionalString(raw.filename), fileUrl: optionalString(raw.fileurl) };
}

export interface ValidatedMoodleModule {
  id: number;
  url: string | null;
  name: string | null;
  instance: number | null;
  modName: string | null;
  visible: boolean | null;
  userVisible: boolean | null;
  contents: ValidatedModuleContent[];
}

export function validateMoodleModule(raw: unknown): ValidatedMoodleModule | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  const contentsRaw = Array.isArray(raw.contents) ? raw.contents : [];
  return {
    id,
    url: optionalString(raw.url),
    name: optionalString(raw.name),
    instance: optionalNumber(raw.instance),
    modName: optionalString(raw.modname),
    visible: optionalBoolean(raw.visible),
    userVisible: optionalBoolean(raw.uservisible),
    contents: contentsRaw.map(validateModuleContent).filter((c): c is ValidatedModuleContent => c !== null),
  };
}

export interface ValidatedMoodleSection {
  id: number;
  name: string | null;
  section: number | null;
  visible: boolean | null;
  summary: string | null;
  modules: ValidatedMoodleModule[];
}

export function validateMoodleSection(raw: unknown): ValidatedMoodleSection | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  const modulesRaw = Array.isArray(raw.modules) ? raw.modules : [];
  return {
    id,
    name: optionalString(raw.name),
    section: optionalNumber(raw.section),
    visible: optionalBoolean(raw.visible),
    summary: optionalString(raw.summary),
    modules: modulesRaw.map(validateMoodleModule).filter((m): m is ValidatedMoodleModule => m !== null),
  };
}

// ---------------------------------------------------------------------------
// Assignments (Part 10)
// ---------------------------------------------------------------------------

export interface ValidatedMoodleAssign {
  id: number;
  cmid: number | null;
  course: number | null;
  name: string | null;
  intro: string | null;
  dueDateIso: string | null;
  allowSubmissionsFromDateIso: string | null;
  cutOffDateIso: string | null;
  grade: number | null;
}

export function validateMoodleAssign(raw: unknown): ValidatedMoodleAssign | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    cmid: optionalNumber(raw.cmid),
    course: optionalNumber(raw.course),
    name: optionalString(raw.name),
    intro: optionalString(raw.intro),
    dueDateIso: optionalEpochSecondsToIso(raw.duedate),
    allowSubmissionsFromDateIso: optionalEpochSecondsToIso(raw.allowsubmissionsfromdate),
    cutOffDateIso: optionalEpochSecondsToIso(raw.cutoffdate),
    grade: optionalNumber(raw.grade),
  };
}

// ---------------------------------------------------------------------------
// Quizzes (Part 11)
// ---------------------------------------------------------------------------

export interface ValidatedMoodleQuiz {
  id: number;
  course: number | null;
  courseModule: number | null;
  name: string | null;
  intro: string | null;
  openDateIso: string | null;
  closeDateIso: string | null;
  timeLimitSeconds: number | null;
  grade: number | null;
  attemptsAllowed: number | null;
}

export function validateMoodleQuiz(raw: unknown): ValidatedMoodleQuiz | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    course: optionalNumber(raw.course),
    courseModule: optionalNumber(raw.coursemodule),
    name: optionalString(raw.name),
    intro: optionalString(raw.intro),
    openDateIso: optionalEpochSecondsToIso(raw.timeopen),
    closeDateIso: optionalEpochSecondsToIso(raw.timeclose),
    timeLimitSeconds: optionalNumber(raw.timelimit),
    grade: optionalNumber(raw.grade),
    attemptsAllowed: optionalNumber(raw.attempts),
  };
}

// ---------------------------------------------------------------------------
// Calendar events (Part 13)
// ---------------------------------------------------------------------------

export interface ValidatedMoodleCalendarEvent {
  id: number;
  name: string | null;
  description: string | null;
  startIso: string | null;
  durationSeconds: number | null;
  eventType: string | null;
  moduleName: string | null;
  instance: number | null;
  courseId: number | null;
  uuid: string | null;
}

export function validateMoodleCalendarEvent(raw: unknown): ValidatedMoodleCalendarEvent | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    name: optionalString(raw.name),
    description: optionalString(raw.description),
    startIso: optionalEpochSecondsToIso(raw.timestart),
    durationSeconds: optionalNumber(raw.timeduration),
    eventType: optionalString(raw.eventtype),
    moduleName: optionalString(raw.modulename),
    instance: optionalNumber(raw.instance),
    courseId: optionalNumber(raw.courseid),
    uuid: optionalString(raw.uuid),
  };
}

// ---------------------------------------------------------------------------
// Forum posts / announcements (Part 14, opt-in)
// ---------------------------------------------------------------------------

export interface ValidatedMoodleForumPost {
  id: number;
  subject: string | null;
  message: string | null;
  createdIso: string | null;
  authorDisplayName: string | null;
  courseId: number | null;
}

export function validateMoodleForumPost(raw: unknown): ValidatedMoodleForumPost | null {
  if (!isRecord(raw)) return null;
  const id = optionalNumber(raw.id);
  if (id === null) return null;
  return {
    id,
    subject: optionalString(raw.subject),
    message: optionalString(raw.message),
    createdIso: optionalEpochSecondsToIso(raw.created),
    authorDisplayName: optionalString(raw.userfullname),
    courseId: optionalNumber(raw.courseid),
  };
}
