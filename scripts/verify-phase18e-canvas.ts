/**
 * Phase 18E Canvas integration verification harness (Part 23). Drives the
 * REAL, unmodified src/server/lms/canvas/* and src/import/canvas* modules
 * against a local synthetic HTTP fixture server (no live Canvas dependency
 * — Part 23's own instruction: "the deterministic fixture suite must not
 * require a live Canvas institution"). Fixtures are minimal synthetic
 * objects defined inline (no real student data, no real tokens — Part 22).
 *
 * Run with (from the repo root, Node 20+):
 *   node scripts/build-verify-harness.mjs scripts/verify-phase18e-canvas.ts .tmp/verify-phase18e-canvas.cjs
 *   node .tmp/verify-phase18e-canvas.cjs
 */

process.env.CANVAS_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); // fixture-only key, never a real secret
process.env.CANVAS_OAUTH_STATE_SECRET = "fixture-only-state-secret-not-a-real-secret";

import * as http from "node:http";
import { encryptToken, decryptToken, isTokenEncryptionConfigured, constantTimeEqual, CURRENT_KEY_VERSION, TokenEncryptionError } from "../src/server/lms/canvas/canvasTokenCrypto";
import { generateState, signState, verifySignedState, generatePkceVerifier, derivePkceChallenge, isOAuthStateSigningConfigured } from "../src/server/lms/canvas/canvasOAuthState";
import { InMemoryCanvasConnectionStore, type CanvasConnectionRecord } from "../src/server/lms/canvas/canvasConnectionStore";
import { canvasGetList, canvasGetOne } from "../src/server/lms/canvas/canvasClient";
import { exchangeCodeForTokens, refreshAccessToken, revokeAccessToken, encryptTokenResponse, connectionNeedsRefresh } from "../src/server/lms/canvas/canvasTokenManager";
import { parseNextLink } from "../src/server/lms/canvas/canvasPagination";
import { parseRetryAfterMs, boundedBackoffMs } from "../src/server/lms/canvas/canvasRateLimit";
import { validateCourse, validateAssignment, validateModule, validateCalendarEvent, validateAnnouncement } from "../src/server/lms/canvas/canvasSchemas";
import { mapCourseToSubject, mapAssignmentToAssessment, mapModuleToCandidate, mapCalendarEventToCandidate, mapAnnouncementToCandidate, isAssignmentGeneratedEvent, parseCourseContextCode } from "../src/import/extraction/canvasMapping";
import { classifyCourse, discoverCourses, looksNonAcademic } from "../src/server/lms/canvas/canvasCourseDiscovery";
import { detectCanvasChanges, isCanvasOriginSourceFile, previewCanvasDataRemoval, removeCanvasImportedData } from "../src/import/canvasSync";
import { importCanvasCourses } from "../src/server/lms/canvas/canvasImportOrchestrator";
import { validateForApply, createEmptySelection } from "../src/import/applyImport";
import { mergeSourcePackages } from "../src/import/merge/mergeEngine";
import type { CanvasInstitutionDefinition } from "../src/import/canvasInstitutionRegistry";
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
// Local synthetic Canvas fixture server — no real Canvas dependency.
// ---------------------------------------------------------------------------

let tokenExchangeCount = 0;
let refreshTokenSeen: string | null = null;

function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      res.setHeader("content-type", "application/json");

      if (req.method === "POST" && url.pathname === "/login/oauth2/token") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const params = new URLSearchParams(body);
          tokenExchangeCount += 1;
          if (params.get("grant_type") === "refresh_token") {
            refreshTokenSeen = params.get("refresh_token");
            res.writeHead(200).end(JSON.stringify({ access_token: `fixture-access-${tokenExchangeCount}`, refresh_token: `fixture-refresh-rotated-${tokenExchangeCount}`, expires_in: 3600, scope: "url:GET|/api/v1/courses" }));
          } else {
            res.writeHead(200).end(JSON.stringify({ access_token: `fixture-access-${tokenExchangeCount}`, refresh_token: `fixture-refresh-${tokenExchangeCount}`, expires_in: 3600, scope: "url:GET|/api/v1/courses", user: { id: 999 } }));
          }
        });
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/login/oauth2/token") {
        const auth = req.headers.authorization;
        if (auth === "Bearer revoke-fail-token") {
          res.writeHead(500).end(JSON.stringify({ error: "revocation failed" }));
        } else {
          res.writeHead(200).end(JSON.stringify({}));
        }
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/courses") {
        const page = url.searchParams.get("page") ?? "1";
        if (page === "1") {
          res.setHeader("link", `<http://localhost:${port}/api/v1/courses?page=2>; rel="next"`);
          res.writeHead(200).end(JSON.stringify([
            { id: 101, name: "Introduction to Programming", course_code: "COS10009", workflow_state: "available", start_at: "2020-01-01T00:00:00Z", end_at: null, enrollments: [{ enrollment_state: "active" }] },
            { id: 102, name: "Student Orientation", course_code: null, workflow_state: "available", enrollments: [{ enrollment_state: "active" }] },
          ]));
        } else {
          res.writeHead(200).end(JSON.stringify([
            { id: 103, name: "Old Concluded Unit", course_code: "OLD1000", workflow_state: "completed", end_at: "2020-01-01T00:00:00Z", enrollments: [{ enrollment_state: "completed" }] },
            { id: "not-an-object" }, // malformed — must be skipped, not crash
          ]));
        }
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/courses/101") {
        res.writeHead(200).end(JSON.stringify({ id: 101, name: "Introduction to Programming", course_code: "COS10009", workflow_state: "available", apply_assignment_group_weights: true, syllabus_body: "<p>Welcome <script>alert(1)</script></p>" }));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/courses/101/assignments") {
        res.writeHead(200).end(JSON.stringify([
          { id: 201, name: "Assignment 1", description: "<b>Do the thing</b>", due_at: "2026-08-09T13:00:00Z", unlock_at: "2026-07-01T00:00:00Z", points_possible: 20, assignment_group_id: 301, submission_types: ["online_upload"], published: true, html_url: `http://localhost:${port}/courses/101/assignments/201` },
          { id: 202, name: "Assignment 2 (no due date)", points_possible: 10, assignment_group_id: 301, submission_types: [], published: true, html_url: `http://localhost:${port}/courses/101/assignments/202` },
        ]));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/courses/101/assignment_groups") {
        res.writeHead(200).end(JSON.stringify([{ id: 301, name: "Assignments", group_weight: 40 }]));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/courses/101/modules") {
        res.writeHead(200).end(JSON.stringify([
          { id: 401, name: "Week 1", position: 1, published: true, items: [{ id: 501, type: "Assignment", content_id: 201, title: "Assignment 1" }, { id: 502, type: "Page", title: "Lecture notes" }] },
        ]));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/calendar_events") {
        res.writeHead(200).end(JSON.stringify([
          { id: 601, title: "Assignment 1", start_at: "2026-08-09T13:00:00Z", type: "assignment", assignment: { id: 201 }, context_code: "course_101" },
          { id: 602, title: "Guest lecture", start_at: "2026-08-15T10:00:00Z", type: "event", context_code: "course_101" },
        ]));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/v1/announcements") {
        res.writeHead(200).end(JSON.stringify([{ id: 701, title: "Welcome", message: "<p>Hi <img onerror=alert(1) src=x></p>", posted_at: "2026-07-01T00:00:00Z", context_code: "course_101" }]));
        return;
      }
      res.writeHead(404).end(JSON.stringify({ error: "not found" }));
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, port });
    });
  });
}

function fixtureInstitution(port: number): CanvasInstitutionDefinition {
  const base = `http://localhost:${port}`;
  return {
    id: "fixture-institution",
    displayName: "Fixture Institution",
    canvasBaseUrl: base,
    authorizeEndpoint: `${base}/login/oauth2/auth`,
    tokenEndpoint: `${base}/login/oauth2/token`,
    revokeEndpoint: `${base}/login/oauth2/token`,
    apiBaseUrl: `${base}/api/v1`,
    clientIdEnvVar: "CANVAS_FIXTURE_CLIENT_ID",
    clientSecretEnvVar: "CANVAS_FIXTURE_CLIENT_SECRET",
    redirectUriEnvVar: "CANVAS_FIXTURE_REDIRECT_URI",
    supportNotes: "Synthetic fixture — not a real institution.",
    verificationNote: "Synthetic fixture for Phase 18E automated testing.",
    lastVerificationDate: "2026-07-23",
  };
}

let port = 0;

async function main(): Promise<void> {
  const server0 = await startFixtureServer();
  port = server0.port;
  const institution = fixtureInstitution(port);

  // -------------------------------------------------------------------------
  await section("1. Token encryption (AES-256-GCM)", () => {
    check("encryption is configured with a valid fixture key", isTokenEncryptionConfigured());
    const encrypted = encryptToken("super-secret-access-token");
    check("ciphertext is not the plaintext", encrypted.ciphertext !== "super-secret-access-token");
    check("decrypts back to the exact plaintext", decryptToken(encrypted) === "super-secret-access-token");
    check("nonce is present and base64", typeof encrypted.nonce === "string" && encrypted.nonce.length > 0);
    check("key version recorded", encrypted.keyVersion === CURRENT_KEY_VERSION);

    const tampered = { ...encrypted, ciphertext: Buffer.from("tampered-ciphertext-bytes!!").toString("base64") };
    let threw = false;
    try {
      decryptToken(tampered);
    } catch (e) {
      threw = e instanceof TokenEncryptionError;
    }
    check("tampered ciphertext is rejected (auth tag mismatch), never silently decrypted wrong", threw);

    let wrongVersionThrew = false;
    try {
      decryptToken({ ...encrypted, keyVersion: 99 });
    } catch (e) {
      wrongVersionThrew = e instanceof TokenEncryptionError;
    }
    check("unsupported key version is rejected, not guessed at", wrongVersionThrew);

    const encryptedA = encryptToken("same-plaintext");
    const encryptedB = encryptToken("same-plaintext");
    check("same plaintext encrypted twice uses a different nonce each time (never reused)", encryptedA.nonce !== encryptedB.nonce);

    check("constant-time equal: identical strings", constantTimeEqual("abc123", "abc123"));
    check("constant-time equal: different strings", !constantTimeEqual("abc123", "abc124"));
    check("constant-time equal: different lengths (no throw)", !constantTimeEqual("abc", "abcd"));
  });

  // -------------------------------------------------------------------------
  await section("2. OAuth state signing + PKCE", () => {
    const state = generateState();
    check("state is non-empty and random-looking", state.length > 20);
    const signed = signState(state);
    check("signed state includes the original state", signed.startsWith(state));
    check("verifying a correctly-signed state returns the original", verifySignedState(signed) === state);
    check("tampered state is rejected", verifySignedState(`${state}x.forgedSignature`) === null);
    check("malformed (no dot) signed state is rejected, never throws", verifySignedState("not-a-signed-state") === null);
    check("state signing is configured", isOAuthStateSigningConfigured());

    const verifier = generatePkceVerifier();
    const challenge = derivePkceChallenge(verifier);
    check("PKCE verifier is non-trivial", verifier.length > 20);
    check("PKCE challenge is deterministic for the same verifier", derivePkceChallenge(verifier) === challenge);
    check("PKCE challenge differs from the verifier itself", challenge !== verifier);
  });

  // -------------------------------------------------------------------------
  await section("3. CanvasConnectionStore", async () => {
    const store = new InMemoryCanvasConnectionStore();
    const now = Date.now();
    await store.createPendingConnection({ state: "state-1", institutionId: "fixture-institution", returnPath: "/", pkceVerifier: "v1", ownerId: "owner-1", createdAt: now, expiresAt: now + 60_000 });

    const consumed = await store.consumePendingConnection("state-1");
    check("pending connection is retrievable once", consumed?.ownerId === "owner-1");
    const consumedAgain = await store.consumePendingConnection("state-1");
    check("replayed state is rejected on second consume attempt", consumedAgain === null);

    await store.createPendingConnection({ state: "state-expired", institutionId: "fixture-institution", returnPath: "/", pkceVerifier: "v2", ownerId: "owner-1", createdAt: now - 700_000, expiresAt: now - 600_000 });
    check("expired pending connection is rejected", (await store.consumePendingConnection("state-expired")) === null);

    const record: CanvasConnectionRecord = {
      connectionId: "conn-1",
      ownerId: "owner-1",
      institutionId: "fixture-institution",
      encryptedAccessToken: encryptToken("access-1"),
      encryptedRefreshToken: encryptToken("refresh-1"),
      tokenExpiresAt: now + 3600_000,
      scopes: ["url:GET|/api/v1/courses"],
      canvasUserId: "999",
      canvasBaseUrl: institution.canvasBaseUrl,
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    };
    await store.saveConnection(record);
    check("connection retrievable by id", (await store.getConnection("conn-1"))?.ownerId === "owner-1");
    check("connection retrievable by owner+institution", (await store.getConnectionForOwnerAndInstitution("owner-1", "fixture-institution"))?.connectionId === "conn-1");
    check("wrong owner finds nothing", (await store.getConnectionForOwnerAndInstitution("someone-else", "fixture-institution")) === null);

    // Concurrency: two overlapping updateTokensAtomically calls for the SAME
    // connection must never interleave — the second only starts once the
    // first has fully finished.
    const order: string[] = [];
    const call1 = store.updateTokensAtomically("conn-1", async (current) => {
      order.push("call1-start");
      await new Promise((r) => setTimeout(r, 30));
      order.push("call1-end");
      return { ...current, updatedAt: Date.now() };
    });
    const call2 = store.updateTokensAtomically("conn-1", async (current) => {
      order.push("call2-start");
      return { ...current, updatedAt: Date.now() };
    });
    await Promise.all([call1, call2]);
    check("concurrent updateTokensAtomically calls never interleave (call2 waits for call1 to finish)", order.indexOf("call1-end") < order.indexOf("call2-start"));

    await store.markReauthorisationRequired("conn-1");
    check("reauthorisation flag set", !!(await store.getConnection("conn-1"))?.reauthorisationRequiredAt);

    await store.revokeConnection("conn-1");
    check("revoked connection is excluded from getConnectionForOwnerAndInstitution", (await store.getConnectionForOwnerAndInstitution("owner-1", "fixture-institution")) === null);
    check("revoked connection record still exists (soft revoke, not deleted)", (await store.getConnection("conn-1")) !== null);

    await store.deleteConnection("conn-1");
    check("deleted connection is gone entirely", (await store.getConnection("conn-1")) === null);
  });

  // -------------------------------------------------------------------------
  await section("4. Token exchange, refresh, revocation", async () => {
    const tokens = await exchangeCodeForTokens(institution, { code: "fixture-code", redirectUri: "http://localhost/cb", clientId: "cid", clientSecret: "csecret", pkceVerifier: "verifier" });
    check("code exchange returns an access token", typeof tokens.access_token === "string" && tokens.access_token.length > 0);
    check("code exchange returns a refresh token on first authorization", typeof tokens.refresh_token === "string");
    check("code exchange returns the canvas user id", tokens.user?.id === 999);

    const encrypted = encryptTokenResponse(tokens, encryptToken("placeholder"));
    check("encryptTokenResponse stores a real expiry in the future", encrypted.tokenExpiresAt > Date.now());
    check("encryptTokenResponse parses the granted scope string", encrypted.scopes.includes("url:GET|/api/v1/courses"));

    const refreshed = await refreshAccessToken(institution, { refreshToken: "old-refresh-token", clientId: "cid", clientSecret: "csecret" });
    check("refresh returns a NEW access token", refreshed.access_token !== tokens.access_token);
    check("refresh-token rotation: server's new refresh token was received", typeof refreshed.refresh_token === "string" && refreshTokenSeen === "old-refresh-token");
    const rotatedEncrypted = encryptTokenResponse(refreshed, encrypted.refreshToken);
    check("rotation replaces the stored refresh token when a new one is returned", decryptToken(rotatedEncrypted.refreshToken) === refreshed.refresh_token);

    const revocation = await revokeAccessToken(institution, "some-access-token");
    check("revocation succeeds against the fixture server", revocation.ok);
    const failedRevocation = await revokeAccessToken(institution, "revoke-fail-token");
    check("revocation failure is reported, not thrown", !failedRevocation.ok && !!failedRevocation.error);

    check("connectionNeedsRefresh is true when already expired", connectionNeedsRefresh({ tokenExpiresAt: Date.now() - 1000 } as CanvasConnectionRecord));
    check("connectionNeedsRefresh is false when comfortably valid", !connectionNeedsRefresh({ tokenExpiresAt: Date.now() + 3600_000 } as CanvasConnectionRecord));
  });

  // -------------------------------------------------------------------------
  await section("5. Pagination + rate-limit helpers", () => {
    check("parses rel=next from a real Link header", parseNextLink('<http://x/a?page=2>; rel="next", <http://x/a?page=9>; rel="last"') === "http://x/a?page=2");
    check("returns null when there is no next link", parseNextLink('<http://x/a?page=9>; rel="last"') === null);
    check("returns null for a missing header", parseNextLink(null) === null);

    check("Retry-After parses delta-seconds", parseRetryAfterMs("2") === 2000);
    check("Retry-After is bounded to a sane maximum", (parseRetryAfterMs("999999") ?? 0) <= 5000);
    check("bounded backoff grows but stays bounded", boundedBackoffMs(1) < boundedBackoffMs(2) && boundedBackoffMs(10) <= 5000);
  });

  // -------------------------------------------------------------------------
  await section("6. Canvas response schema validation (never blindly trusted)", () => {
    check("valid course validates", validateCourse({ id: 1, name: "X", course_code: "X100" })?.id === 1);
    check("course missing id is rejected", validateCourse({ name: "no id" }) === null);
    check("non-object course is rejected", validateCourse("not an object") === null);
    check("null/omitted fields become null, not guessed", validateCourse({ id: 1 })?.name === null);

    check("valid assignment validates", validateAssignment({ id: 1, name: "A1", due_at: "2026-01-01T00:00:00Z" })?.due_at === "2026-01-01T00:00:00Z");
    check("assignment missing id is rejected", validateAssignment({ name: "no id" }) === null);

    check("valid module with items validates", validateModule({ id: 1, name: "M1", items: [{ id: 2, type: "Page" }] })?.items.length === 1);
    check("module item missing id is skipped, not crashed on", validateModule({ id: 1, items: [{ type: "Page" }, { id: 5, type: "Page" }] })?.items.length === 1);

    check("valid calendar event validates", validateCalendarEvent({ id: 1, title: "E1" })?.id === 1);
    check("valid announcement validates", validateAnnouncement({ id: 1, title: "A1" })?.id === 1);
  });

  // -------------------------------------------------------------------------
  await section("7. Canvas API client (pagination, auth, timeout discipline)", async () => {
    const store = new InMemoryCanvasConnectionStore();
    const now = Date.now();
    await store.saveConnection({
      connectionId: "conn-client-test",
      ownerId: "owner-1",
      institutionId: "does-not-matter-for-this-test",
      encryptedAccessToken: encryptToken("fixture-bearer-token"),
      encryptedRefreshToken: encryptToken(""),
      tokenExpiresAt: now + 3600_000, // far from expiry — ensureFreshAccessToken never needs a registry lookup
      scopes: [],
      canvasUserId: null,
      canvasBaseUrl: institution.canvasBaseUrl,
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    });
    // canvasClient.ts uses the MODULE-LEVEL canvasConnectionStore singleton
    // internally (via canvasTokenManager's ensureFreshAccessToken) — so this
    // test seeds THAT singleton directly rather than the local `store`
    // above (kept for the isolated store tests in section 3).
    const { canvasConnectionStore } = await import("../src/server/lms/canvas/canvasConnectionStore");
    await canvasConnectionStore.saveConnection({
      connectionId: "conn-client-test",
      ownerId: "owner-1",
      institutionId: "does-not-matter-for-this-test",
      encryptedAccessToken: encryptToken("fixture-bearer-token"),
      encryptedRefreshToken: encryptToken(""),
      tokenExpiresAt: now + 3600_000,
      scopes: [],
      canvasUserId: null,
      canvasBaseUrl: institution.canvasBaseUrl,
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    });

    const coursesResult = await canvasGetList(institution, "conn-client-test", "/courses", {}, validateCourse);
    check("Link-header pagination followed across pages", coursesResult.items.length === 3); // 2 valid on page 1 + 1 valid on page 2 (1 malformed skipped)
    check("malformed item skipped, counted, never crashes the whole request", coursesResult.skippedCount === 1);
    check("not truncated (both pages fully consumed within the bound)", !coursesResult.truncated);

    const oneCourse = await canvasGetOne(institution, "conn-client-test", "/courses/101", {}, validateCourse);
    check("single-resource GET works", oneCourse?.id === 101);
    const missingCourse = await canvasGetOne(institution, "conn-client-test", "/courses/999999", {}, validateCourse);
    check("404 on a single resource returns null, not a thrown error", missingCourse === null);
  });

  // -------------------------------------------------------------------------
  await section("8. Course discovery + classification (Part 7)", () => {
    const now = new Date("2026-07-23T00:00:00Z");
    const active = validateCourse({ id: 1, name: "Active Course", course_code: "ABC100", workflow_state: "available", enrollments: [{ enrollment_state: "active" }] })!;
    const concluded = validateCourse({ id: 2, name: "Concluded Course", workflow_state: "completed", enrollments: [{ enrollment_state: "completed" }] })!;
    const future = validateCourse({ id: 3, name: "Future Course", start_at: "2027-01-01T00:00:00Z", enrollments: [{ enrollment_state: "invited" }] })!;
    const orientation = validateCourse({ id: 4, name: "Student Orientation 2026", enrollments: [{ enrollment_state: "active" }] })!;

    check("active enrolment classified active", classifyCourse(active, now) === "active");
    check("concluded course classified completed", classifyCourse(concluded, now) === "completed");
    check("future course classified future", classifyCourse(future, now) === "future");
    check("orientation course is flagged non-academic", looksNonAcademic(orientation));

    const discovery = discoverCourses([active, concluded, future, orientation], now);
    check("active academic course is suggested selected", discovery.find((d) => d.course.id === 1)?.suggestedSelected === true);
    check("concluded course NOT suggested selected (never silently imported)", discovery.find((d) => d.course.id === 2)?.suggestedSelected === false);
    check("future course NOT suggested selected", discovery.find((d) => d.course.id === 3)?.suggestedSelected === false);
    check("orientation course NOT suggested selected even though active", discovery.find((d) => d.course.id === 4)?.suggestedSelected === false);
  });

  // -------------------------------------------------------------------------
  await section("9. Canvas mapping (never invents, never infers forbidden fields)", () => {
    const course = validateCourse({ id: 101, name: "Intro to Programming", course_code: "COS10009", apply_assignment_group_weights: true, syllabus_body: "<p>Hi <script>bad()</script></p>" })!;
    const subject = mapCourseToSubject(course, "src-1");
    check("course maps to a subject with a stable canvas-id temporaryId", subject.temporaryId === "canvas-subject-101");
    check("syllabus HTML is sanitised (no raw <script> survives)", !subject.description?.includes("<script>"));
    check("teachingPeriod is never inferred — stays null", subject.teachingPeriod === null);
    check("creditPoints is never invented — stays null", subject.creditPoints === null);

    const assignmentWithDue = validateAssignment({ id: 201, name: "A1", due_at: "2026-08-09T13:00:00Z", unlock_at: "2026-07-01T00:00:00Z", points_possible: 20, assignment_group_id: 301 })!;
    const group = { id: 301, name: "Assignments", group_weight: 40 };
    const assessment = mapAssignmentToAssessment(assignmentWithDue, group, true, "src-1");
    check("due_at becomes the deadline", assessment.due?.isoDate === "2026-08-09");
    check("unlock_at is NEVER used as a deadline", assessment.due?.isoDate !== "2026-07-01");
    check("weighting comes from the group ONLY when the course applies group weights", assessment.weighting === 40);
    check("points_possible is preserved but is NOT used as the weighting", assessment.weighting !== 20);

    const assessmentNoGroupWeight = mapAssignmentToAssessment(assignmentWithDue, group, false, "src-1");
    check("weighting stays null when the course does NOT apply group weights, even with a group present", assessmentNoGroupWeight.weighting === null);

    const noDueAssignment = validateAssignment({ id: 202, name: "A2" })!;
    const noDueAssessment = mapAssignmentToAssessment(noDueAssignment, null, true, "src-1");
    check("assignment with no due_at has no deadline (never guessed)", noDueAssessment.due === null);

    const module = validateModule({ id: 401, name: "Week 1", items: [{ id: 501, type: "Assignment", content_id: 201 }, { id: 502, type: "Page", title: "Notes" }] })!;
    const { module: moduleCandidate, linkedAssignmentCanvasIds } = mapModuleToCandidate(module, "src-1");
    check("module maps with a stable temporaryId", moduleCandidate.temporaryId === "canvas-module-401");
    check("assignment-type module item is NOT duplicated as a topic", !moduleCandidate.topics.some((t) => t.includes("Assignment")));
    check("assignment-type module item IS captured for linking", linkedAssignmentCanvasIds.includes(201));
    check("non-assignment module item becomes a topic", moduleCandidate.topics.some((t) => t.includes("Notes")));

    const assignmentEvent = validateCalendarEvent({ id: 601, title: "A1 due", type: "assignment", assignment: { id: 201 } })!;
    const ordinaryEvent = validateCalendarEvent({ id: 602, title: "Guest lecture", type: "event" })!;
    check("assignment-generated calendar event is detected for dedup", isAssignmentGeneratedEvent(assignmentEvent));
    check("ordinary calendar event is not flagged for dedup", !isAssignmentGeneratedEvent(ordinaryEvent));
    const calendarCandidate = mapCalendarEventToCandidate(ordinaryEvent, "src-1");
    check("calendar event maps with a stable temporaryId", calendarCandidate.temporaryId === "canvas-calendar-602");

    const announcement = validateAnnouncement({ id: 701, title: "Welcome", message: "<p>Hi <img onerror=alert(1) src=x></p>" })!;
    const announcementCandidate = mapAnnouncementToCandidate(announcement, "src-1");
    check("announcement HTML is sanitised (no onerror survives)", !announcementCandidate.body.includes("onerror"));
    check("announcement maps with a stable temporaryId", announcementCandidate.temporaryId === "canvas-announcement-701");

    check("context_code parses course id", parseCourseContextCode("course_101") === 101);
    check("malformed context_code returns null, never guessed", parseCourseContextCode("not-a-context-code") === null);
  });

  // -------------------------------------------------------------------------
  await section("10. Sync change detection (Part 16 — never one-miss deletion)", async () => {
    const course = validateCourse({ id: 101, name: "Intro to Programming", course_code: "COS10009" })!;
    const subjectV1 = mapCourseToSubject(course, "src-1");
    const assignment = validateAssignment({ id: 201, name: "A1", due_at: "2026-08-09T13:00:00Z" })!;
    subjectV1.assessments = [mapAssignmentToAssessment(assignment, null, false, "src-1")];

    const first = await detectCanvasChanges(101, subjectV1, [], [], []);
    check("first sync reports the course + assignment as new items", first.report.newItemsCount === 2);
    check("no changes reported as 'changed' on first sync", first.report.changedItemsCount === 0);

    // Second sync: identical content — nothing changed.
    const second = await detectCanvasChanges(101, subjectV1, [], [], first.nextSnapshots);
    check("re-syncing identical content reports zero new/changed items", second.report.newItemsCount === 0 && second.report.changedItemsCount === 0);
    check("unchanged items are counted", second.report.unchangedCount === 2);

    // Third sync: the assignment's due date changed.
    const changedAssignment = validateAssignment({ id: 201, name: "A1", due_at: "2026-08-16T13:00:00Z" })!;
    const subjectV2 = mapCourseToSubject(course, "src-1");
    subjectV2.assessments = [mapAssignmentToAssessment(changedAssignment, null, false, "src-1")];
    const third = await detectCanvasChanges(101, subjectV2, [], [], second.nextSnapshots);
    check("a genuinely changed due date is reported as changed", third.report.changedItemsCount >= 1);

    // Fourth sync: the assignment is now ABSENT (Canvas omitted it) — must
    // NOT be proposed as a deletion after just one omission.
    const subjectV3 = mapCourseToSubject(course, "src-1");
    subjectV3.assessments = [];
    const fourth = await detectCanvasChanges(101, subjectV3, [], [], third.nextSnapshots);
    check("one omission is NOT treated as a deletion", fourth.report.proposedDeletionsCount === 0);

    // Fifth sync: STILL absent — now it's safe to propose as a deletion.
    const fifth = await detectCanvasChanges(101, subjectV3, [], [], fourth.nextSnapshots);
    check("two consecutive omissions ARE proposed as a deletion", fifth.report.proposedDeletionsCount === 1);
  });

  // -------------------------------------------------------------------------
  await section("11. Remove-imported-Canvas-data (Part 19)", () => {
    check("Canvas-origin sourceFile is recognised", isCanvasOriginSourceFile("Canvas — Assignment 1"));
    check("non-Canvas sourceFile is not misidentified", !isCanvasOriginSourceFile("clean-syllabus.pdf"));

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
          modules: [{ id: "m1", subjectId: "subj-1", moduleNumber: 1, title: "Canvas Module", overview: "", suggestedTasks: [], miniGameIdeas: [], sourceNote: "Canvas — Week 1" }],
          assessments: [
            {
              id: "a1",
              subjectId: "subj-1",
              assessmentNumber: 1,
              part: null,
              title: "Canvas Assignment",
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
              sourceFile: "Canvas — Assignment 1",
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

    const preview = previewCanvasDataRemoval(semester);
    check("preview identifies exactly the Canvas-origin items", preview[0]?.assessmentTitles.includes("Canvas Assignment") && preview[0]?.moduleTitles.includes("Canvas Module"));
    check("preview does NOT include the manually-entered assessment", !preview[0]?.assessmentTitles.includes("Manually Entered Assessment"));

    const cleaned = removeCanvasImportedData(semester);
    check("removal keeps the subject room itself (never deletes a room)", cleaned.subjects.length === 1);
    check("removal strips only the Canvas-origin assessment", cleaned.subjects[0].assessments.length === 1 && cleaned.subjects[0].assessments[0].title === "Manually Entered Assessment");
    check("removal strips the Canvas-origin module", cleaned.subjects[0].modules.length === 0);
  });

  // -------------------------------------------------------------------------
  await section("12. Duplicate-room-mapping validation (Part 13, benefits every provider)", () => {
    const liveSubjects: SubjectRecord[] = [
      { id: "room-1", name: "Room One", code: { value: null, status: "needs_confirmation" }, colourTheme: "", characterConcept: "", modules: [], assessments: [] },
    ];
    const pkg = mergeSourcePackages(
      [
        { providerId: "canvas-lms", subjects: [mapCourseToSubject(validateCourse({ id: 1, name: "Introduction to Programming", course_code: "COS10009" })!, "s1")], calendarEvents: [], warnings: [] },
        { providerId: "canvas-lms", subjects: [mapCourseToSubject(validateCourse({ id: 2, name: "Database Systems", course_code: "COS20015" })!, "s2")], calendarEvents: [], warnings: [] },
      ],
      [],
      { institution: null, degree: null, major: null, academicYear: null, semesterName: null, campus: null },
      new Date().toISOString()
    );
    const selection = createEmptySelection();
    selection.subjectMapping[pkg.subjects[0].temporaryId] = "room-1";
    selection.subjectMapping[pkg.subjects[1].temporaryId] = "room-1"; // same room, deliberately

    const validation = validateForApply(pkg, selection, liveSubjects);
    check("two Canvas courses mapped to the SAME room is caught, not silently allowed", !validation.ok);
    check("the issue names the live room", validation.issues.some((i) => i.includes("Room One")));
  });

  // -------------------------------------------------------------------------
  await section("13. End-to-end Canvas import orchestration (one course, real fixture server)", async () => {
    const { canvasConnectionStore } = await import("../src/server/lms/canvas/canvasConnectionStore");
    const outcome = await importCanvasCourses(institution, "conn-client-test", [101], { includeAnnouncements: true }, "e2e-src");
    check("one course produced one subject", outcome.sourcePackage.subjects.length === 1);
    check("assignments mapped (Assignment 1 has a due date, Assignment 2 doesn't)", outcome.sourcePackage.subjects[0].assessments.length === 2);
    check("module mapped, assignment-type item linked (not duplicated as a topic)", outcome.sourcePackage.subjects[0].modules.length === 1);
    check("assignment-generated calendar event deduplicated (only the ordinary event remains)", outcome.sourcePackage.calendarEvents.length === 1 && outcome.sourcePackage.calendarEvents[0].title === "Guest lecture");
    check("announcement included when opted in", (outcome.sourcePackage.announcements?.length ?? 0) === 1);
    check("course result reports found status with real counts", outcome.courseResults[0]?.status === "found" && outcome.courseResults[0]?.assignmentsFound === 2);
    void canvasConnectionStore; // referenced above only to keep the seeded singleton import visible in this section too
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
