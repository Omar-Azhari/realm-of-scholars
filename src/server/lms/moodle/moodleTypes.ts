/**
 * Raw Moodle web-service response shapes (Phase 18F, Part 6/8/9/10/11).
 * These describe what Moodle's documented functions return BEFORE runtime
 * validation (moodleSchemas.ts) — never trusted directly.
 */

export interface MoodleSiteInfoResponse {
  sitename?: unknown;
  siteurl?: unknown;
  version?: unknown;
  userid?: unknown;
  fullname?: unknown;
  lang?: unknown;
  functions?: unknown; // array of { name: string }
}

export interface MoodleExceptionEnvelope {
  exception?: unknown;
  errorcode?: unknown;
  message?: unknown;
}

export interface MoodleCourseResponse {
  id?: unknown;
  shortname?: unknown;
  fullname?: unknown;
  category?: unknown;
  startdate?: unknown; // epoch seconds
  enddate?: unknown; // epoch seconds
  visible?: unknown;
  progress?: unknown;
  viewurl?: unknown;
  lastaccess?: unknown;
}

export interface MoodleModuleContentResponse {
  type?: unknown;
  filename?: unknown;
  fileurl?: unknown;
}

export interface MoodleModuleResponse {
  id?: unknown;
  url?: unknown;
  name?: unknown;
  instance?: unknown;
  modname?: unknown; // "assign" | "quiz" | "page" | "resource" | "folder" | "url" | "forum" | "book" | "lesson" | "label" | "workshop" | "choice" | "glossary" | "database" | "lti" | ...
  visible?: unknown;
  uservisible?: unknown;
  contents?: unknown; // MoodleModuleContentResponse[]
}

export interface MoodleSectionResponse {
  id?: unknown;
  name?: unknown;
  section?: unknown; // section position/number
  visible?: unknown;
  summary?: unknown;
  modules?: unknown; // MoodleModuleResponse[]
}

export interface MoodleAssignResponse {
  id?: unknown;
  cmid?: unknown;
  course?: unknown;
  name?: unknown;
  intro?: unknown;
  duedate?: unknown; // epoch seconds, 0 = none
  allowsubmissionsfromdate?: unknown;
  cutoffdate?: unknown;
  grade?: unknown; // max grade, negative = scale
}

export interface MoodleQuizResponse {
  id?: unknown;
  course?: unknown;
  coursemodule?: unknown;
  name?: unknown;
  intro?: unknown;
  timeopen?: unknown;
  timeclose?: unknown;
  timelimit?: unknown;
  grade?: unknown;
  attempts?: unknown;
}

export interface MoodleCalendarEventResponse {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  timestart?: unknown; // epoch seconds
  timeduration?: unknown; // seconds
  eventtype?: unknown; // "due" | "close" | "course" | "site" | ...
  modulename?: unknown; // "assign" | "quiz" | null
  instance?: unknown; // linked assign/quiz instance id
  courseid?: unknown;
  uuid?: unknown; // ICS-equivalent stable id, when present
}

export interface MoodleForumPostResponse {
  id?: unknown;
  subject?: unknown;
  message?: unknown;
  created?: unknown; // epoch seconds
  userfullname?: unknown;
  courseid?: unknown;
  discussionid?: unknown;
}
