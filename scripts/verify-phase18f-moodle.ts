/**
 * Phase 18F Moodle integration verification harness (Part 23/24). Drives
 * the REAL, unmodified src/server/lms/moodle/* and src/import/moodle*
 * modules against a local synthetic HTTP fixture server — no live La Trobe
 * dependency (Part 23's own instruction), no real tokens or student data
 * (Part 22/23).
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18f-moodle.ts .tmp/verify-phase18f-moodle.cjs
 *   node .tmp/verify-phase18f-moodle.cjs
 */

process.env.MOODLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64"); // fixture-only key, never a real secret

import * as http from "node:http";
import { encryptMoodleToken, decryptMoodleToken, isMoodleTokenEncryptionConfigured } from "../src/server/lms/moodle/moodleTokenCrypto";
import { InMemoryMoodleConnectionStore, type MoodleConnectionRecord } from "../src/server/lms/moodle/moodleConnectionStore";
import { validateMoodleSiteAndUser, moodleGetList, moodleGetWrappedList } from "../src/server/lms/moodle/moodleClient";
import { MoodleError } from "../src/server/lms/moodle/moodleErrors";
import {
  validateSiteInfo,
  isMoodleExceptionEnvelope,
  validateMoodleCourse,
  validateMoodleSection,
  validateMoodleAssign,
  validateMoodleQuiz,
  validateMoodleCalendarEvent,
  validateMoodleForumPost,
} from "../src/server/lms/moodle/moodleSchemas";
import { classifyMoodleCourse, looksNonAcademic, discoverMoodleCourses } from "../src/server/lms/moodle/moodleCourseDiscovery";
import {
  mapMoodleCourseToSubject,
  mapMoodleAssignToAssessment,
  isMoodleQuizAssessable,
  mapMoodleQuizToAssessment,
  mapMoodleSectionToCandidate,
  isMoodleActivityGeneratedEvent,
  mapMoodleCalendarEventToCandidate,
  mapMoodleForumPostToAnnouncement,
} from "../src/import/extraction/moodleMapping";
import { importMoodleCourses } from "../src/server/lms/moodle/moodleImportOrchestrator";
import { detectMoodleChanges, isMoodleOriginSourceFile, previewMoodleDataRemoval, removeMoodleImportedData } from "../src/import/moodleSync";
import { validateForApply, createEmptySelection } from "../src/import/applyImport";
import { mergeSourcePackages } from "../src/import/merge/mergeEngine";
import type { MoodleInstitutionDefinition } from "../src/import/moodleInstitutionRegistry";
import type { SemesterRecord, SubjectRecord } from "../src/types/domain";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log(`  ok   - ${name}`);
  } else {
    failed++;
    failures.push(detail ? `${name} :: ${detail}` : name);
    console.log(`  FAIL - ${name}${detail ? " :: " + detail : ""}`);
  }
}

async function section(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (error) {
    failed++;
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    failures.push(`${name} threw :: ${detail}`);
    console.log(`  FAIL - section threw: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Local synthetic Moodle fixture server — single REST endpoint, dispatches
// on the `wsfunction` POST-body parameter, exactly like a real Moodle site.
// ---------------------------------------------------------------------------

const VALID_TOKEN = "fixture-valid-token";
const INSUFFICIENT_TOKEN = "fixture-insufficient-token";
let port = 0;

function jsonResponse(res: http.ServerResponse, body: unknown): void {
  res.setHeader("content-type", "application/json");
  res.writeHead(200).end(JSON.stringify(body));
}

function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "POST") {
        res.writeHead(404).end();
        return;
      }
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const wsfunction = params.get("wsfunction");
        const wstoken = params.get("wstoken");

        if (wstoken === "fixture-invalid-token") {
          jsonResponse(res, { exception: "moodle_exception", errorcode: "invalidtoken", message: "Invalid token" });
          return;
        }

        if (wsfunction === "core_webservice_get_site_info") {
          if (wstoken === INSUFFICIENT_TOKEN) {
            jsonResponse(res, { sitename: "Fixture LMS", siteurl: `http://localhost:${port}`, version: "2024100700", userid: 42, fullname: "Fixture Student", lang: "en", functions: [{ name: "core_webservice_get_site_info" }] });
            return;
          }
          jsonResponse(res, {
            sitename: "Fixture LMS",
            siteurl: `http://localhost:${port}`,
            version: "2024100700",
            userid: 42,
            fullname: "Fixture Student",
            lang: "en",
            functions: [
              { name: "core_webservice_get_site_info" },
              { name: "core_enrol_get_users_courses" },
              { name: "core_course_get_contents" },
              { name: "mod_assign_get_assignments" },
              { name: "mod_quiz_get_quizzes_by_courses" },
              { name: "core_calendar_get_calendar_events" },
              { name: "mod_forum_get_forums_by_courses" },
              { name: "mod_forum_get_forum_discussions" },
            ],
          });
          return;
        }

        if (wsfunction === "core_enrol_get_users_courses") {
          jsonResponse(res, [
            { id: 101, shortname: "COS10009", fullname: "Introduction to Programming", category: 1, startdate: 1704067200, enddate: 0, visible: true },
            { id: 102, shortname: "ORIENT100", fullname: "Student Orientation", category: 2, startdate: 0, enddate: 0, visible: true },
            { id: 103, shortname: "OLD1000", fullname: "Old Concluded Subject", category: 1, startdate: 1577836800, enddate: 1609459200, visible: true },
            { id: "not-an-object" },
          ]);
          return;
        }

        if (wsfunction === "core_course_get_contents") {
          jsonResponse(res, [
            {
              id: 201,
              name: "Week 1",
              section: 1,
              visible: true,
              summary: "<p>Welcome <script>alert(1)</script></p>",
              modules: [
                { id: 301, url: `http://localhost:${port}/mod/assign/view.php?id=301`, name: "Assignment 1", instance: 401, modname: "assign", visible: true, uservisible: true, contents: [] },
                { id: 302, url: null, name: "Lecture notes", instance: null, modname: "resource", visible: true, uservisible: true, contents: [{ type: "file", filename: "notes.pdf", fileurl: null }] },
                { id: 303, url: null, name: "Hidden reading", instance: null, modname: "page", visible: false, uservisible: false, contents: [] },
              ],
            },
          ]);
          return;
        }

        if (wsfunction === "mod_assign_get_assignments") {
          jsonResponse(res, {
            courses: [
              {
                id: 101,
                assignments: [
                  { id: 401, cmid: 301, course: 101, name: "Assignment 1", intro: "<b>Do the thing</b>", duedate: 1754744400, allowsubmissionsfromdate: 1751932800, cutoffdate: 1755001200, grade: 20 },
                  { id: 402, cmid: 305, course: 101, name: "Assignment 2 (no due date)", intro: "", duedate: 0, allowsubmissionsfromdate: 0, cutoffdate: 0, grade: 10 },
                ],
              },
            ],
            warnings: [],
          });
          return;
        }

        if (wsfunction === "mod_quiz_get_quizzes_by_courses") {
          jsonResponse(res, {
            quizzes: [
              { id: 501, course: 101, coursemodule: 306, name: "Assessed Quiz", intro: "", timeopen: 1751932800, timeclose: 1754744400, timelimit: 3600, grade: 20, attempts: 1 },
              { id: 502, course: 101, coursemodule: 307, name: "Practice Quiz", intro: "", timeopen: 0, timeclose: 0, timelimit: 0, grade: 0, attempts: 0 },
            ],
            warnings: [],
          });
          return;
        }

        if (wsfunction === "core_calendar_get_calendar_events") {
          jsonResponse(res, {
            events: [
              { id: 601, name: "Assignment 1", timestart: 1754744400, timeduration: 0, eventtype: "due", modulename: "assign", instance: 401, courseid: 101 },
              { id: 602, name: "Guest lecture", timestart: 1755100800, timeduration: 3600, eventtype: "course", modulename: null, instance: null, courseid: 101 },
            ],
            warnings: [],
          });
          return;
        }

        if (wsfunction === "mod_forum_get_forums_by_courses") {
          jsonResponse(res, [{ id: 701, type: "news", course: 101 }]);
          return;
        }

        if (wsfunction === "mod_forum_get_forum_discussions") {
          jsonResponse(res, { discussions: [{ id: 801, subject: "Welcome", message: "<p>Hi <img onerror=alert(1) src=x></p>", created: 1751500000, userfullname: "Coordinator", courseid: 101 }], warnings: [] });
          return;
        }

        jsonResponse(res, { exception: "moodle_exception", errorcode: "invalidfunction", message: "Unknown function" });
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const p = (server.address() as { port: number }).port;
      resolve({ server, port: p });
    });
  });
}

function fixtureInstitution(fixturePort: number): MoodleInstitutionDefinition {
  const base = `http://localhost:${fixturePort}`;
  return {
    institutionId: "fixture-latrobe",
    displayName: "Fixture La Trobe",
    lmsKind: "moodle",
    moodleBaseUrl: base,
    loginUrl: `${base}/login/index.php`,
    webServiceEndpoint: `${base}/webservice/rest/server.php`,
    siteInfoFunction: "core_webservice_get_site_info",
    authenticationMode: "institution-token",
    administratorApprovalRequired: true,
    tokenEnvVar: "MOODLE_FIXTURE_LATROBE_SERVICE_TOKEN",
    supportedCapabilities: [],
    unsupportedCapabilities: [],
    calendarExportSupport: "student-self-service-ics-or-webcal",
    lastVerificationDate: "2026-07-23",
    verificationEvidence: [],
    knownLimitations: [],
  };
}

async function main(): Promise<void> {
  const server0 = await startFixtureServer();
  port = server0.port;
  const institution = fixtureInstitution(port);

  // -------------------------------------------------------------------------
  await section("1. Moodle token encryption (reused AES-256-GCM core)", () => {
    check("encryption is configured with a valid fixture key", isMoodleTokenEncryptionConfigured());
    const encrypted = encryptMoodleToken("super-secret-moodle-token");
    check("ciphertext is not the plaintext", encrypted.ciphertext !== "super-secret-moodle-token");
    check("decrypts back to the exact plaintext", decryptMoodleToken(encrypted) === "super-secret-moodle-token");
    const encryptedA = encryptMoodleToken("same-plaintext");
    const encryptedB = encryptMoodleToken("same-plaintext");
    check("same plaintext encrypted twice uses a different nonce each time", encryptedA.nonce !== encryptedB.nonce);
  });

  // -------------------------------------------------------------------------
  await section("2. MoodleConnectionStore", async () => {
    const store = new InMemoryMoodleConnectionStore();
    const now = Date.now();
    await store.createPendingConnection({ state: "state-1", institutionId: "fixture-latrobe", returnPath: "/", ownerId: "owner-1", createdAt: now, expiresAt: now + 60_000 });
    check("pending connection is retrievable once", (await store.consumePendingConnection("state-1"))?.ownerId === "owner-1");
    check("replayed state is rejected on second consume attempt", (await store.consumePendingConnection("state-1")) === null);

    const record: MoodleConnectionRecord = {
      connectionId: "conn-1",
      ownerId: "owner-1",
      institutionId: "fixture-latrobe",
      moodleBaseUrl: institution.moodleBaseUrl,
      encryptedCredential: encryptMoodleToken(VALID_TOKEN),
      credentialType: "institution-token",
      credentialExpiresAt: null,
      enabledFunctions: ["core_enrol_get_users_courses", "core_course_get_contents"],
      moodleUserId: "42",
      moodleSiteName: "Fixture LMS",
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    };
    await store.saveConnection(record);
    check("connection retrievable by id", (await store.getConnection("conn-1"))?.ownerId === "owner-1");
    check("connection retrievable by owner+institution", (await store.getConnectionForOwnerAndInstitution("owner-1", "fixture-latrobe"))?.connectionId === "conn-1");
    check("wrong owner finds nothing", (await store.getConnectionForOwnerAndInstitution("someone-else", "fixture-latrobe")) === null);

    const order: string[] = [];
    const call1 = store.updateCredentialAtomically("conn-1", async (current) => {
      order.push("call1-start");
      await new Promise((r) => setTimeout(r, 30));
      order.push("call1-end");
      return { ...current, updatedAt: Date.now() };
    });
    const call2 = store.updateCredentialAtomically("conn-1", async (current) => {
      order.push("call2-start");
      return { ...current, updatedAt: Date.now() };
    });
    await Promise.all([call1, call2]);
    check("concurrent updateCredentialAtomically calls never interleave", order.indexOf("call1-end") < order.indexOf("call2-start"));

    await store.markReauthorisationRequired("conn-1");
    check("reauthorisation flag set", !!(await store.getConnection("conn-1"))?.reauthorisationRequiredAt);
    await store.revokeConnection("conn-1");
    check("revoked connection excluded from owner+institution lookup", (await store.getConnectionForOwnerAndInstitution("owner-1", "fixture-latrobe")) === null);
    check("revoked connection record still exists", (await store.getConnection("conn-1")) !== null);
    await store.deleteConnection("conn-1");
    check("deleted connection is gone entirely", (await store.getConnection("conn-1")) === null);
  });

  // -------------------------------------------------------------------------
  await section("3. Site/user validation (Part 7) + exception-envelope handling", async () => {
    const siteInfo = await validateMoodleSiteAndUser(institution, VALID_TOKEN);
    check("site info validates with a real user id", siteInfo.userId === 42);
    check("all expected functions are reported enabled", siteInfo.enabledFunctions.includes("mod_assign_get_assignments"));

    let invalidTokenThrew: MoodleError | null = null;
    try {
      await validateMoodleSiteAndUser(institution, "fixture-invalid-token");
    } catch (e) {
      invalidTokenThrew = e instanceof MoodleError ? e : null;
    }
    check("invalid token is rejected via the exception envelope, never silently accepted", invalidTokenThrew?.category === "invalid-token");

    const wrongSiteInstitution: MoodleInstitutionDefinition = { ...institution, moodleBaseUrl: "http://localhost:9" };
    let wrongSiteThrew: MoodleError | null = null;
    try {
      await validateMoodleSiteAndUser(wrongSiteInstitution, VALID_TOKEN);
    } catch (e) {
      wrongSiteThrew = e instanceof MoodleError ? e : null;
    }
    check("a token whose reported site URL doesn't match the configured institution is rejected", wrongSiteThrew?.category === "wrong-site");

    check("isMoodleExceptionEnvelope recognises a real exception body", isMoodleExceptionEnvelope({ exception: "x", errorcode: "invalidtoken", message: "m" }));
    check("isMoodleExceptionEnvelope does not misidentify an ordinary object", !isMoodleExceptionEnvelope({ id: 1, name: "ok" }));

    const insufficientSiteInfo = await validateMoodleSiteAndUser(institution, INSUFFICIENT_TOKEN);
    check("a token with fewer enabled functions is still validated (permission gating happens at the connect layer, not here)", !insufficientSiteInfo.enabledFunctions.includes("mod_assign_get_assignments"));
  });

  // -------------------------------------------------------------------------
  await section("4. Moodle client: flat-array vs wrapper-object response shapes", async () => {
    const store = (await import("../src/server/lms/moodle/moodleConnectionStore")).moodleConnectionStore;
    const now = Date.now();
    await store.saveConnection({
      connectionId: "conn-client-test",
      ownerId: "owner-1",
      institutionId: "fixture-latrobe",
      moodleBaseUrl: institution.moodleBaseUrl,
      encryptedCredential: encryptMoodleToken(VALID_TOKEN),
      credentialType: "institution-token",
      credentialExpiresAt: null,
      enabledFunctions: [],
      moodleUserId: "42",
      moodleSiteName: "Fixture LMS",
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    });

    const courseResult = await moodleGetList(institution, "conn-client-test", "core_enrol_get_users_courses", {}, validateMoodleCourse);
    check("flat-array function (core_enrol_get_users_courses) parses directly", courseResult.items.length === 3);
    check("malformed item skipped, never crashes the whole request", courseResult.skippedCount === 1);

    const assignResult = await moodleGetWrappedList(institution, "conn-client-test", "mod_assign_get_assignments", { "courseids[0]": "101" }, (raw) => {
      const courses = (raw as { courses?: unknown }).courses;
      if (!Array.isArray(courses)) return null;
      const match = courses.find((c) => (c as { id?: unknown }).id === 101);
      return match ? ((match as { assignments?: unknown }).assignments as unknown[]) : [];
    }, validateMoodleAssign);
    check("wrapper-object function (mod_assign_get_assignments) is correctly unwrapped", assignResult.items.length === 2);

    let expiredThrew: MoodleError | null = null;
    await store.saveConnection({
      connectionId: "conn-expired",
      ownerId: "owner-1",
      institutionId: "fixture-latrobe",
      moodleBaseUrl: institution.moodleBaseUrl,
      encryptedCredential: encryptMoodleToken(VALID_TOKEN),
      credentialType: "institution-token",
      credentialExpiresAt: Date.now() - 1000,
      enabledFunctions: [],
      moodleUserId: "42",
      moodleSiteName: "Fixture LMS",
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    });
    try {
      await moodleGetList(institution, "conn-expired", "core_enrol_get_users_courses", {}, validateMoodleCourse);
    } catch (e) {
      expiredThrew = e instanceof MoodleError ? e : null;
    }
    check("an expired credential is rejected as reauthorisation-required, never silently used", expiredThrew?.category === "reauthorisation-required");
  });

  // -------------------------------------------------------------------------
  await section("5. Course discovery + classification (Part 8)", () => {
    const now = new Date("2026-07-23T00:00:00Z");
    const active = validateMoodleCourse({ id: 1, shortname: "COS10009", fullname: "Active Course", startdate: 1704067200, enddate: 0, visible: true })!;
    const concluded = validateMoodleCourse({ id: 2, shortname: "OLD1000", fullname: "Concluded Course", startdate: 1577836800, enddate: 1609459200, visible: true })!;
    const future = validateMoodleCourse({ id: 3, shortname: "FUT2000", fullname: "Future Course", startdate: 1893456000, enddate: 0, visible: true })!;
    const hidden = validateMoodleCourse({ id: 4, shortname: "HID1000", fullname: "Hidden Course", startdate: 0, enddate: 0, visible: false })!;
    const orientation = validateMoodleCourse({ id: 5, shortname: "ORI100", fullname: "Student Orientation 2026", startdate: 0, enddate: 0, visible: true })!;

    check("active course classified active", classifyMoodleCourse(active, now) === "active");
    check("concluded course classified completed", classifyMoodleCourse(concluded, now) === "completed");
    check("future course classified future", classifyMoodleCourse(future, now) === "future");
    check("hidden course classified hidden", classifyMoodleCourse(hidden, now) === "hidden");
    check("orientation course is flagged non-academic", looksNonAcademic(orientation));

    const discovery = discoverMoodleCourses([active, concluded, future, hidden, orientation], now);
    check("active academic course is suggested selected", discovery.find((d) => d.course.id === 1)?.suggestedSelected === true);
    check("concluded course NOT suggested selected", discovery.find((d) => d.course.id === 2)?.suggestedSelected === false);
    check("future course NOT suggested selected", discovery.find((d) => d.course.id === 3)?.suggestedSelected === false);
    check("hidden course NOT suggested selected", discovery.find((d) => d.course.id === 4)?.suggestedSelected === false);
    check("orientation course NOT suggested selected even though visible", discovery.find((d) => d.course.id === 5)?.suggestedSelected === false);
  });

  // -------------------------------------------------------------------------
  await section("6. Course/assignment/quiz/section mapping (never invents forbidden fields)", () => {
    const course = validateMoodleCourse({ id: 101, shortname: "CSE2UI", fullname: "Intro to Programming" })!;
    const subject = mapMoodleCourseToSubject(course, "src-1");
    check("reliable La Trobe-style code (3 letters + 1 digit + 2 letters) recognised", subject.code === "CSE2UI");
    check("teachingPeriod is never inferred — stays null", subject.teachingPeriod === null);
    check("creditPoints is never invented — stays null", subject.creditPoints === null);

    const unreliableCourse = validateMoodleCourse({ id: 102, shortname: "random-name-2026", fullname: "Something" })!;
    const unreliableSubject = mapMoodleCourseToSubject(unreliableCourse, "src-1");
    check("a shortname that doesn't match the reliable subject-code pattern is left null, never guessed", unreliableSubject.code === null);

    const assignWithDue = validateMoodleAssign({ id: 401, name: "Assignment 1", duedate: 1754744400, allowsubmissionsfromdate: 1751932800, cutoffdate: 1755001200, grade: 20 })!;
    const assessment = mapMoodleAssignToAssessment(assignWithDue, "src-1");
    check("duedate becomes the deadline", assessment.due?.isoDate === "2025-08-09");
    check("allowsubmissionsfromdate is NEVER used as the deadline", assessment.due?.isoDate !== "2025-07-08");
    check("cutoffdate is NEVER used as the deadline", assessment.due?.isoDate !== "2025-08-12");
    check("weighting is never derived from grade maximum alone", assessment.weighting === null);

    const noDueAssign = validateMoodleAssign({ id: 402, name: "No due date", duedate: 0 })!;
    const noDueAssessment = mapMoodleAssignToAssessment(noDueAssign, "src-1");
    check("a zero duedate is treated as missing, never the Unix epoch date", noDueAssessment.due === null);

    const assessedQuiz = validateMoodleQuiz({ id: 501, name: "Assessed Quiz", timeopen: 1751932800, timeclose: 1754744400, grade: 20 })!;
    const practiceQuiz = validateMoodleQuiz({ id: 502, name: "Practice Quiz", timeopen: 0, timeclose: 0, grade: 0 })!;
    check("a quiz with a positive grade is treated as assessable", isMoodleQuizAssessable(assessedQuiz));
    check("a quiz with grade 0 is NOT treated as assessable (practice quiz)", !isMoodleQuizAssessable(practiceQuiz));
    const quizAssessment = mapMoodleQuizToAssessment(assessedQuiz, "src-1");
    check("assessable quiz's closeDate becomes the deadline", quizAssessment.due?.isoDate === "2025-08-09");
    check("quiz weighting is never derived from grade maximum", quizAssessment.weighting === null);

    const section = validateMoodleSection({
      id: 201,
      name: "Week 1",
      section: 1,
      summary: "<p>Hi <script>bad()</script></p>",
      modules: [
        { id: 301, name: "Assignment 1", instance: 401, modname: "assign", visible: true },
        { id: 302, name: "Lecture notes", instance: null, modname: "resource", visible: true },
        { id: 303, name: "Hidden reading", instance: null, modname: "page", visible: false },
      ],
    })!;
    const { module, linkedAssignInstanceIds } = mapMoodleSectionToCandidate(section, "src-1");
    check("section maps with a stable temporaryId", module.temporaryId === "moodle-module-201");
    check("section summary HTML is sanitised", !module.description.includes("<script>"));
    check("assign-type module item is NOT duplicated as a topic", !module.topics.some((t) => t.includes("Assignment 1")));
    check("assign-type module item IS captured for linking", linkedAssignInstanceIds.includes(401));
    check("non-assessment module item becomes a topic", module.topics.some((t) => t.includes("Lecture notes")));
    check("hidden module item is labelled, not silently excluded", module.topics.some((t) => t.includes("Hidden reading") && t.includes("(hidden)")));

    const assignEvent = validateMoodleCalendarEvent({ id: 601, name: "A1 due", eventtype: "due", modulename: "assign", instance: 401 })!;
    const ordinaryEvent = validateMoodleCalendarEvent({ id: 602, name: "Guest lecture", eventtype: "course" })!;
    check("assignment-generated calendar event is detected for dedup", isMoodleActivityGeneratedEvent(assignEvent));
    check("ordinary calendar event is not flagged for dedup", !isMoodleActivityGeneratedEvent(ordinaryEvent));
    const calendarCandidate = mapMoodleCalendarEventToCandidate(ordinaryEvent, "src-1");
    check("calendar event maps with a stable temporaryId", calendarCandidate.temporaryId === "moodle-calendar-602");

    const post = validateMoodleForumPost({ id: 801, subject: "Welcome", message: "<p>Hi <img onerror=alert(1) src=x></p>" })!;
    const announcement = mapMoodleForumPostToAnnouncement(post, "src-1");
    check("announcement HTML is sanitised", !announcement.body.includes("onerror"));
    check("announcement maps with a stable temporaryId", announcement.temporaryId === "moodle-announcement-801");
  });

  // -------------------------------------------------------------------------
  await section("7. Sync change detection (never one-miss deletion)", async () => {
    const course = validateMoodleCourse({ id: 101, shortname: "COS10009", fullname: "Intro to Programming" })!;
    const subjectV1 = mapMoodleCourseToSubject(course, "src-1");
    const assign = validateMoodleAssign({ id: 401, name: "Assignment 1", duedate: 1754744400 })!;
    subjectV1.assessments = [mapMoodleAssignToAssessment(assign, "src-1")];

    const first = await detectMoodleChanges(101, subjectV1, [], [], []);
    check("first sync reports the course + assignment as new items", first.report.newItemsCount === 2);

    const second = await detectMoodleChanges(101, subjectV1, [], [], first.nextSnapshots);
    check("re-syncing identical content reports zero new/changed items", second.report.newItemsCount === 0 && second.report.changedItemsCount === 0);
    check("unchanged items are counted", second.report.unchangedCount === 2);

    const changedAssign = validateMoodleAssign({ id: 401, name: "Assignment 1", duedate: 1755000000 })!;
    const subjectV2 = mapMoodleCourseToSubject(course, "src-1");
    subjectV2.assessments = [mapMoodleAssignToAssessment(changedAssign, "src-1")];
    const third = await detectMoodleChanges(101, subjectV2, [], [], second.nextSnapshots);
    check("a genuinely changed due date is reported as changed", third.report.changedItemsCount >= 1);

    const subjectV3 = mapMoodleCourseToSubject(course, "src-1");
    subjectV3.assessments = [];
    const fourth = await detectMoodleChanges(101, subjectV3, [], [], third.nextSnapshots);
    check("one omission is NOT treated as a deletion", fourth.report.proposedDeletionsCount === 0);

    const fifth = await detectMoodleChanges(101, subjectV3, [], [], fourth.nextSnapshots);
    check("two consecutive omissions ARE proposed as a deletion", fifth.report.proposedDeletionsCount === 1);
  });

  // -------------------------------------------------------------------------
  await section("8. Remove-imported-Moodle-data (Part 20)", () => {
    check("Moodle-origin sourceFile is recognised", isMoodleOriginSourceFile("Moodle — Assignment 1"));
    check("non-Moodle sourceFile is not misidentified", !isMoodleOriginSourceFile("clean-syllabus.pdf"));

    const semester: SemesterRecord = {
      label: "Semester 2 2026",
      timezone: "Australia/Melbourne",
      startDate: { value: null, status: "needs_confirmation" },
      endDate: { value: null, status: "needs_confirmation" },
      breaks: [],
      examPeriod: { value: null, status: "needs_confirmation" },
      weekNumberingNote: "",
      subjects: [
        {
          id: "subj-1",
          name: "Test Subject",
          code: { value: "COS10009", status: "confirmed" },
          colourTheme: "#000",
          characterConcept: "",
          modules: [{ id: "m1", subjectId: "subj-1", moduleNumber: 1, title: "Moodle Section", overview: "", suggestedTasks: [], miniGameIdeas: [], sourceNote: "Moodle — Week 1" }],
          assessments: [
            {
              id: "a1",
              subjectId: "subj-1",
              assessmentNumber: 1,
              part: null,
              title: "Moodle Assignment",
              kind: "other",
              weight: { value: null, status: "needs_confirmation" },
              weightRaw: "",
              dueDate: { value: null, status: "needs_confirmation" },
              dueTime: { value: null, status: "needs_confirmation" },
              dueWindowRaw: "",
              dateKind: "missing",
              confirmationStatus: "needs_confirmation",
              aiPolicy: { value: null, status: "needs_confirmation" },
              extensionEligibility: { value: null, status: "needs_confirmation" },
              reminderSchedule: { offsets: [], active: false, reason: null },
              description: "",
              notes: "",
              sourceFile: "Moodle — Assignment 1",
            },
            {
              id: "a2",
              subjectId: "subj-1",
              assessmentNumber: 2,
              part: null,
              title: "Manually Entered Assessment",
              kind: "other",
              weight: { value: null, status: "needs_confirmation" },
              weightRaw: "",
              dueDate: { value: null, status: "needs_confirmation" },
              dueTime: { value: null, status: "needs_confirmation" },
              dueWindowRaw: "",
              dateKind: "missing",
              confirmationStatus: "needs_confirmation",
              aiPolicy: { value: null, status: "needs_confirmation" },
              extensionEligibility: { value: null, status: "needs_confirmation" },
              reminderSchedule: { offsets: [], active: false, reason: null },
              description: "",
              notes: "",
              sourceFile: "Manual entry",
            },
          ],
        },
      ],
    };

    const preview = previewMoodleDataRemoval(semester);
    check("preview identifies exactly the Moodle-origin items", preview[0]?.assessmentTitles.includes("Moodle Assignment") && preview[0]?.moduleTitles.includes("Moodle Section"));
    check("preview does NOT include the manually-entered assessment", !preview[0]?.assessmentTitles.includes("Manually Entered Assessment"));

    const cleaned = removeMoodleImportedData(semester);
    check("removal keeps the subject room itself", cleaned.subjects.length === 1);
    check("removal strips only the Moodle-origin assessment", cleaned.subjects[0].assessments.length === 1 && cleaned.subjects[0].assessments[0].title === "Manually Entered Assessment");
    check("removal strips the Moodle-origin module", cleaned.subjects[0].modules.length === 0);
  });

  // -------------------------------------------------------------------------
  await section("9. Duplicate-room-mapping validation (provider-neutral, benefits Moodle too)", () => {
    const liveSubjects: SubjectRecord[] = [{ id: "room-1", name: "Room One", code: { value: null, status: "needs_confirmation" }, colourTheme: "", characterConcept: "", modules: [], assessments: [] }];
    const pkg = mergeSourcePackages(
      [
        { providerId: "moodle-lms", subjects: [mapMoodleCourseToSubject(validateMoodleCourse({ id: 1, shortname: "COS10009", fullname: "Introduction to Programming" })!, "s1")], calendarEvents: [], warnings: [] },
        { providerId: "moodle-lms", subjects: [mapMoodleCourseToSubject(validateMoodleCourse({ id: 2, shortname: "COS20015", fullname: "Database Systems" })!, "s2")], calendarEvents: [], warnings: [] },
      ],
      [],
      { institution: null, degree: null, major: null, academicYear: null, semesterName: null, campus: null },
      new Date().toISOString()
    );
    const selection = createEmptySelection();
    selection.subjectMapping[pkg.subjects[0].temporaryId] = "room-1";
    selection.subjectMapping[pkg.subjects[1].temporaryId] = "room-1";
    const validation = validateForApply(pkg, selection, liveSubjects);
    check("two Moodle courses mapped to the SAME room is caught", !validation.ok);
    check("the issue names the live room", validation.issues.some((i) => i.includes("Room One")));
  });

  // -------------------------------------------------------------------------
  await section("10. End-to-end Moodle import orchestration (fixture server)", async () => {
    const outcome = await importMoodleCourses(institution, "conn-client-test", [{ id: 101, shortName: "COS10009", fullName: "Introduction to Programming", viewUrl: null }], { includeAnnouncements: true }, "e2e-src");
    check("one course produced one subject", outcome.sourcePackage.subjects.length === 1);
    check("assignments + assessable quiz mapped (practice quiz excluded)", outcome.sourcePackage.subjects[0].assessments.length === 3);
    check("section mapped, assign-type item linked (not duplicated as a topic)", outcome.sourcePackage.subjects[0].modules.length === 1);
    check("assignment-generated calendar event deduplicated (only the ordinary event remains)", outcome.sourcePackage.calendarEvents.length === 1 && outcome.sourcePackage.calendarEvents[0].title === "Guest lecture");
    check("announcement included when opted in", (outcome.sourcePackage.announcements?.length ?? 0) === 1);
    check("course result reports found status with real counts", outcome.courseResults[0]?.status === "found" && outcome.courseResults[0]?.assignmentsFound === 2);
  });

  // ---------------------------------------------------------------------
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed (${passed + failed} checks total)`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
  server0.server.close();
}

void main();
