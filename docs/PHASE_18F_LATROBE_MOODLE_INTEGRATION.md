# Phase 18F — La Trobe Moodle Integration

Pre-flight audit + design for a secure, read-only Moodle connection for La
Trobe University, built on top of Phases 18A–18E's existing academic-import
pipeline and Canvas integration. Nothing here replaces
`AcademicImportPackage`/Review/Apply/backup/Undo — Moodle data flows through
the exact same pipeline every other provider uses, including Canvas. Canvas
remains fully intact and regression-tested. No password collection, no
cookie/session scraping, no SSO/MFA bypass, no Moodle write operations, no
webhooks, no continuous polling, no AI extraction.

## 1. Current architecture (audit findings, extending Phase 18E's own §1)

Everything Phase 18E's audit (`docs/PHASE_18E_CANVAS_INTEGRATION.md` §1)
found about the provider contract, canonical model, merge/conflict engine,
Review/Apply/Undo, persistence conventions, Vercel Functions conventions,
security controls, environment-variable conventions, and the lack of a
durable database still holds unchanged — Phase 18F changes none of it.
Specific re-confirmations relevant to Moodle:

- **`AcademicProvider`/`ImportedSourcePackage`/`AcademicImportPackage`
  (`src/import/types.ts`) remain entirely provider-agnostic.** Nothing in
  the canonical model, `applyImport.ts`'s `validateForApply`/
  `buildApplyDiff`/`applySemesterImport`, or the merge/conflict engine
  references Canvas by name in a way that would need generalizing —
  `applyImport.ts` was read in full this phase and confirmed to operate
  purely on `AcademicImportPackage`/`ImportedSubjectCandidate` etc., with the
  one Canvas-specific concept (`isCanvasOriginSourceFile`'s `"Canvas — "`
  filename prefix) living entirely in `canvasSync.ts`, not in the shared
  Apply path. A `MoodleAcademicProvider` needs zero changes to any of these
  three files beyond the same additive pattern Canvas already used
  (`"Moodle — "` prefix, its own sync module).
- **`ConflictKind` already has one Canvas-specific member**
  (`canvas-remote-item-removed`) added additively in Phase 18E — the same
  additive-union-member pattern is used again for Moodle (§18).
- **`CanvasSyncState`/`CanvasCourseBinding`/`CanvasRemoteSnapshot`/
  `CanvasRemoteItemType`** (`src/types/domain.ts`) are Canvas-NAMED types,
  not a generic shared shape, stored as `UniGameSaveData.canvasSync:
  CanvasSyncState | null` — an additive field. **Deliberate decision for
  this phase (see §3 below): do NOT retroactively generify these into a
  shared `LmsSyncState`.** They already work, are fully tested, and
  touching them for a rename-only refactor would risk the one system this
  phase is explicitly told to preserve, for no functional gain. Moodle gets
  its own parallel, independently-named, additive field —
  `moodleSync: MoodleSyncState | null` — with its own
  `MoodleCourseBinding`/`MoodleRemoteSnapshot`/`MoodleRemoteItemType` types,
  mirroring Canvas's proven shape (including the exact same
  "present" → "missing-once" → "confirmed-deleted" two-consecutive-miss
  deletion state machine) field-for-field but as its own types. The
  provider-neutral abstraction Part 2 asks for lives at the RUNTIME/
  orchestration layer (`LmsProvider`, §2), not at the persisted-data-shape
  layer — this is the one place this phase's design deliberately does not
  force a shared generic type, per the brief's own "do not force Canvas and
  Moodle into an abstraction that hides important security or API
  differences."
- **The existing `ics-calendar` provider (`src/import/providers/icsProvider.ts`)
  is ALREADY a fully generic RFC 5545 subset parser with zero Canvas- or
  institution-specific code.** It requires no changes whatsoever to accept a
  calendar file exported from La Trobe's Moodle instance — Part 13's "path
  B" (Moodle ICS import fallback) is **already fully implemented today**;
  this phase's ICS-related work is limited to (a) UI wording that tells a La
  Trobe student specifically how to get their Moodle calendar's .ics file or
  webcal URL, and (b) the API-vs-ICS deduplication logic Part 13 describes
  — which, per §7 below, has no live API data to deduplicate against this
  phase, so it is designed but not exercised against a real Moodle API
  response.
- **`universityRegistry.ts` (Phase 18B/18D) already has a `latrobe` entry**
  (`src/import/universityRegistry.ts:251`), used for the "search La Trobe
  subject pages" fallback (Part 15). Its `supportStatus` is honestly
  `"unsupported"`/`"missing"` across every capability, with a documented
  note that `handbook.latrobe.edu.au` refused or blocked an automated fetch
  during Phase 18D's own research. This phase does not change that entry —
  it is a separate, already-honest fallback, unrelated to the Moodle LMS
  connection this phase adds. No live re-verification of that host was
  attempted this phase either (out of scope — Part 15 only requires this
  fallback to already exist and remain offered, which it does).
- **The Canvas API route pattern** (read in full this phase via
  `api/lms/canvas/disconnect.ts`): one file per route, `export const config
  = { runtime: "nodejs" }`, global + per-client rate limiting checked first,
  hand-rolled runtime body validation rejecting unknown fields and bounding
  string lengths, ownership verified via
  `getConnectionForOwnerAndInstitution(ownerId, institutionId)` plus an
  explicit `connection.ownerId !== ownerId` re-check, remote revocation
  attempted best-effort with local deletion happening unconditionally
  regardless of remote outcome, and a structured `{ category, message }`
  JSON error shape via `toClientMessage()`. Moodle's routes (§21) follow
  this exact pattern.

## 2. Provider-neutral `LmsProvider` contract

A new, thin interface — `src/import/lmsProvider.ts` — capturing what Canvas
and Moodle both need at the ORCHESTRATION layer (what Semester Setup's UI
and the sync-refresh flow call), without touching either provider's actual
transport/auth code:

```ts
interface LmsConnectionStatus {
  connected: boolean;
  institutionConfigured: boolean;
  reauthorisationRequired: boolean;
  lastSuccessfulSyncAt: string | null;
}

interface LmsCourseSummary {
  remoteId: string; // stringified — Canvas uses numeric ids, Moodle also numeric, kept as string so the interface never assumes a type
  name: string;
  code: string | null;
  classification: "active" | "future" | "completed" | "hidden" | "unavailable" | "non-academic" | "unknown";
  suggestedSelected: boolean;
}

interface LmsProvider {
  readonly providerId: string; // "canvas-lms" | "moodle-lms"
  readonly institutionId: string;
  isConfigured(): boolean;
  getConnectionStatus(ownerId: string): Promise<LmsConnectionStatus>;
  listCourses(ownerId: string): Promise<LmsCourseSummary[]>;
  previewImport(ownerId: string, courseIds: string[], options: Record<string, boolean>): Promise<ImportedSourcePackage>;
  // previewSync / disconnect are intentionally NOT forced into one shape —
  // see below.
}
```

**What is deliberately shared:** connection status shape, course-summary
shape (enough for a room-mapping list), and the return type of a preview
(`ImportedSourcePackage` — already provider-neutral). This is enough for
Semester Setup's UI to render "Connect / Status / Course list / Preview" for
EITHER provider through one code path once an institution's LMS kind is
known, which is the actual UI-facing win Part 2 asks for.

**What is deliberately NOT shared, and why:**
- **Authentication.** Canvas's `connect`/`callback` OAuth redirect dance and
  Moodle's token-based (or, per §4/§17, currently unconfigured) connection
  are structurally different flows with different security properties —
  forcing one `connect()` method would either lose Canvas's PKCE/state
  machinery in the abstraction or require Moodle to fake an OAuth redirect
  it doesn't have. Each provider keeps its own `connect`/`disconnect`
  route set (§21); the frontend calls the right one once it knows the
  institution's LMS kind (`canvasLms` vs `moodleLms`), exactly as today's
  Canvas-only frontend already special-cases Canvas.
- **Pagination, rate-limit handling, response schemas.** Canvas's
  Link-header pagination and Moodle's flat-array/plugin-warning response
  shape (§6) are different enough that a shared "fetch a page" abstraction
  would hide real behavioural differences (e.g. Moodle web-service calls
  return HTTP 200 with an embedded `exception`/`errorcode` field on
  failure, unlike Canvas's HTTP status codes — §6/§22) — each client stays
  independent.
- **Sync metadata storage** — per §1, `canvasSync`/`moodleSync` remain
  separate additive save-data fields, not a shared type.

`CanvasAcademicProvider`-equivalent and the new `MoodleAcademicProvider`
each implement `LmsProvider` as a thin facade over their existing/new
provider-specific modules — this is an additive wrapper, not a rewrite of
either provider's internals. Canvas's existing routes/client/store are
unchanged; the facade only adapts already-existing functions to the shared
shape for the UI's benefit.

## 3. La Trobe Moodle research findings (Part 1's required research)

Research was limited to official sources: La Trobe's own current-student
support site (`latrobe-current.custhelp.com`), Moodle's own developer/user
documentation (`docs.moodle.org`, `moodledev.io`), and Moodle's own community
forum posts confirming documented product behaviour (`moodle.org/mod/forum`).
No unofficial "how to log in" aggregator site's claims were relied upon for
any security-relevant fact — only for the one plausible, unverified hostname
noted below, exactly as Phase 18B/18E marked similarly-sourced values
`verified: false`.

**Confirmed: La Trobe's LMS is Moodle.** La Trobe's own current-student FAQ
describes "the LMS" as "Moodle (Modular Object-Oriented Dynamic Learning
Environment)" directly, and separate FAQ articles exist for "LMS Calendar",
"LMS Calendar Import", "LMS User Preferences", "Accessing lecture notes",
and general LMS access — all consistent with a standard Moodle deployment.
Login is via a La Trobe username in the form `StudentID@students.ltu.edu.au`
plus password, through La Trobe's StudentOnLine portal or the LMS login page
directly — confirming this is a normal institutional Moodle instance with
standard username/password (SSO-fronted) authentication, not a special
third-party-app-friendly deployment.

**Unverified: exact LMS hostname.** Multiple non-official, aggregator-style
sites (login directory pages, not La Trobe's own domain) cite
`https://lms.latrobe.edu.au` as the LMS root. This was NOT independently
confirmed against an official La Trobe technical document during this
research pass (unlike, e.g., `handbook.latrobe.edu.au`, which Phase 18D
already uses and which La Trobe's own handbook links confirm). It is
recorded in the registry (§4) as a plausible, unverified default —
`verificationNote`-flagged exactly like Phase 18E's Canvas
`canvasBaseUrl` guesses — never treated as confirmed-working, never used to
mark the institution "configured."

**Confirmed: Moodle web-service token issuance is admin-gated, not
student-self-service, on a standard Moodle install.** Per Moodle's own
developer documentation (`docs.moodle.org/502/en/Using_web_services`,
`docs.moodle.org/dev/External_services_security`) and multiple Moodle
community-forum threads confirming the same product behaviour: creating a
web-service token normally requires the `moodle/webservice:createtoken`
capability, which is not granted to the standard "Student" role by default
on a stock Moodle install; the reliable path institutions actually use is a
site administrator manually creating a token for a specific user against a
specific external service via Site Administration → Plugins → Web services
→ Manage tokens — an approval action only La Trobe's own Moodle
administrators can perform, exactly parallel to Canvas's Developer Key
requiring an institution admin (Phase 18E §3). No evidence was found that
La Trobe grants students this capability or operates a self-service token
portal.

**Confirmed: the one student-self-service Moodle token path
(the mobile-app login endpoint) requires the student's password, which
this app must never collect.** Moodle's built-in "Mobile web services"
(enabled by default whenever a site runs over HTTPS) power the official
Moodle Mobile app via `POST /login/token.php`, which exchanges a username +
**password** directly for a token. Even where this endpoint is reachable,
using it would require UniGame's server to receive and forward the
student's actual La Trobe password — explicitly forbidden by this phase's
brief ("Never request the user's La Trobe username or password inside
UniGame," "Never submit credentials to the Moodle login form"). This path is
therefore never implemented, regardless of whether La Trobe has mobile web
services enabled (not independently confirmed either way).

**Confirmed: Moodle's core OAuth 2 subsystem is the wrong direction for
this use case.** Moodle core's own OAuth 2 documentation
(`docs.moodle.org/502/en/OAuth_2_authentication`, `.../OAuth_2_services`)
describes Moodle acting as an OAuth2 **client**, authenticating users
against external identity providers (Google, Microsoft, generic OAuth2) for
**logging into Moodle** — the opposite of what this phase needs (a
third-party app obtaining delegated, scoped, read-only access to a
student's OWN Moodle data). Unlike Canvas, where every Canvas instance ships
a standard "Developer Key" self-service-registrable OAuth **provider** role
core to the platform, Moodle core does not ship an equivalent third-party
OAuth-provider role. Community plugins exist that add one (`local_oauth`,
`local_oauth2` on moodle.org's plugin directory) — but these are optional,
separately-installed add-ons, not a Moodle-core capability, and no evidence
was found that La Trobe has installed either. This is a genuine, material
platform difference from Canvas worth naming explicitly: **Canvas has a
mature, standardized third-party-app registration story; a stock Moodle
install does not**, which is why this phase's honest conclusion (§17) is
more conservative than Phase 18E's for Canvas.

**Confirmed: La Trobe's Moodle calendar supports the standard Moodle-core
calendar export feature (webcal URL subscription or downloadable .ics
file), reachable by any authenticated student in their own browser, with no
admin approval needed** — La Trobe's own "LMS Calendar" FAQ describes
scrolling to "Import or export calendars" on the LMS calendar page,
recommends the URL/webcal method "because the calendar will update when the
LMS calendar is updated," and separately allows a plain .ics file download;
it explicitly supports adding the exported calendar to iCal and Google
Calendar. **Important honesty note, carried into the UI (§15/§26):** La
Trobe's own FAQ includes the disclaimer "Student IT does not support the
usability of this — use this at your discretion." This is a standard core
Moodle feature (`docs.moodle.org`'s own "Calendar export" page documents the
same mechanism generically), reachable by the student themselves with no
credential collection by UniGame at any point — this app never touches the
student's Moodle session; the student exports/copies the URL or file
themselves and hands it to UniGame's existing, unmodified ICS importer.

**Confirmed: no La Trobe developer portal, public API program, or
third-party integration documentation was found.** Web search for a La
Trobe-specific developer/API portal returned no results beyond general
university-IT pages at OTHER institutions (Stanford, UCLA, Michigan) — no
evidence La Trobe publishes anything analogous to a Canvas-style Developer
Key self-service flow or an OAuth app-registration process for third-party
student tools.

**Conclusion (mirrors and sharpens Phase 18E §3's honest posture):** no
approved, student-usable, password-free live Moodle API or OAuth connection
path can be confirmed as available today. This phase therefore ships the
full provider-neutral architecture, `MoodleAcademicProvider`, connection
store, client, mapping, and sync engine — all real and fixture-tested — with
the live connection honestly left unconfigured (§17), and makes the ALREADY
FULLY WORKING ICS calendar path (§1) the practical, promoted-with-equal-
weight channel for La Trobe students today, exactly as Part 15 requires.

## 4. La Trobe Moodle institution registry

`src/import/moodleInstitutionRegistry.ts` — parallel to, but separate from,
`canvasInstitutionRegistry.ts` (different OAuth/token shape entirely) and
`universityRegistry.ts` (public discovery, unrelated to LMS credentials):

| Field | Value |
|---|---|
| `institutionId` | `"latrobe"` |
| `displayName` | `"La Trobe University"` |
| `lmsKind` | `"moodle"` |
| `moodleBaseUrl` | `"https://lms.latrobe.edu.au"` — **unverified**, see §3 |
| `loginUrl` | `"https://lms.latrobe.edu.au/login/index.php"` — derived, same unverified basis |
| `webServiceEndpoint` | `` `${moodleBaseUrl}/webservice/rest/server.php` `` — Moodle's standard, fixed path (not La Trobe-specific; confirmed only in the sense that this is Moodle's own documented, invariant REST endpoint path — not confirmed reachable/enabled for La Trobe specifically) |
| `siteInfoFunction` | `"core_webservice_get_site_info"` — Moodle's own standard function name |
| `authenticationMode` | `"unconfigured"` (§17 — no approved token/OAuth path confirmed) |
| `administratorApprovalRequired` | `true` |
| `tokenEnvVar` | `"MOODLE_LATROBE_SERVICE_TOKEN"` — name only, never a value; unset |
| `supportedCapabilities` | `["calendar-ics-fallback", "official-subject-discovery-fallback"]` |
| `unsupportedCapabilities` | `["oauth-connect", "web-service-token-self-service", "live-course-api"]` |
| `calendarExportSupport` | `"student-self-service-ics-or-webcal"` — confirmed (§3), with La Trobe's own "not officially supported for usability" disclaimer preserved verbatim |
| `lastVerificationDate` | `"2026-07-23"` |
| `verificationEvidence` | citations to La Trobe's own current-student FAQ pages (LMS, LMS Calendar, moodle search results) plus Moodle's own developer docs, as enumerated in §3 |
| `knownLimitations` | the full §3 conclusion, condensed |

No secret of any kind is stored in this file — only a token env-var NAME,
matching the Canvas registry's own discipline. `moodleBaseUrl` is never
treated as confirmed-working; nothing in this codebase marks La Trobe
"configured" based on the login page being reachable (an explicit brief
instruction) — `isMoodleInstitutionConfigured()` (mirroring
`isCanvasInstitutionConfigured()`) returns `true` only when
`MOODLE_LATROBE_SERVICE_TOKEN` is actually set in the environment, which it
is not in this repository.

## 5. Authentication and connection modes

Per §3's findings, only two of the brief's five listed modes are actually
implementable honestly today:

1. **Institution-issued Moodle web-service token (mode 2)** — fully
   implemented in code (§6/§21: validate against `core_webservice_get_site_info`,
   encrypt immediately, never return to the browser, show exactly which
   functions the token permits), but requires `MOODLE_LATROBE_SERVICE_TOKEN`
   to be set by whoever operates this deployment after obtaining a real
   token from La Trobe's Moodle administrators (§26 onboarding checklist) —
   unconfigured today, exactly like every Canvas institution.
2. **Unconfigured mode (mode 4)** — the default, first-class state. The
   connect screen shows exactly the sentence the brief specifies: "La Trobe
   Moodle automatic connection is not currently configured. You can still
   import your Moodle calendar or upload your subject documents."
3. **ICS-only fallback mode (mode 5)** — already fully working (§1/§3),
   promoted with equal visual weight alongside upload/search/manual entry,
   never presented as a lesser option.

**Not implemented, with reasoning:** mode 1 (institution-approved
OAuth/delegated authorisation) has no confirmed availability for a stock
Moodle install (§3) — the code path is deliberately NOT stubbed out as if it
existed, since that would risk implying a connection option that cannot
actually work; if a future institution's Moodle instance is confirmed to run
a real OAuth-provider plugin, that would be new, separately-scoped work
(§26/Phase 18G), not a currently-dead code path. Mode 3 (Moodle mobile-
service token) is the same mechanism as mode 1's password-collection problem
(§3) and is never implemented for the same reason.

Every rule from the brief is honoured by construction: no username/password
field exists anywhere in this app's Moodle UI; no request is ever made to
Moodle's own login form; no browser cookie is ever read, stored, or
forwarded; no token is ever requested from or returned to browser
JavaScript; a user-supplied token (when the operator configures one) is sent
directly server-to-server over HTTPS, validated against
`core_webservice_get_site_info` before being trusted, encrypted immediately
via the same `canvasTokenCrypto.ts` primitives Phase 18E already built
(§6/no new cryptography), and never written to `localStorage`, save
exports, or logs.

## 6. Moodle server client (`src/server/lms/moodle/`)

Files, mirroring Canvas's proven module boundaries exactly:

- `moodleTypes.ts` — raw Moodle response shapes (site info, course, course
  content/section/module, assignment, quiz, calendar event, forum
  discussion).
- `moodleSchemas.ts` — `validateSiteInfo`/`validateCourse`/
  `validateCourseContent`/`validateAssignment`/`validateQuiz`/
  `validateCalendarEvent`/`validateForumPost`, each tolerant of
  nullable/omitted/version-dependent fields, returning `null` (never a
  guess) on anything structurally wrong.
- `moodleErrors.ts` — `MoodleErrorCategory`, `MoodleError`, `toClientMessage()`
  — same shape as `canvasErrors.ts`. Critically, Moodle's own error
  convention differs from Canvas's and must be handled explicitly: **a
  failed Moodle web-service call typically returns HTTP 200 with a JSON
  body containing `exception`/`errorcode`/`message` fields, not a non-2xx
  HTTP status.** The client checks for this envelope on every response
  BEFORE treating a 200 as success — a real, Moodle-specific failure mode
  Canvas's client never had to handle, and exactly the kind of
  provider-specific difference §2 explains why a single shared client was
  not attempted.
- `moodlePagination.ts` — Moodle web-service list functions generally
  return a flat array (no Link-header pagination); pagination, where a
  function supports it, is via explicit `options[limitfrom]`/
  `options[limitnum]` parameters. Bounded to the same conservative page
  count/size discipline as Canvas's client (`MAX_PAGES_PER_REQUEST`-
  equivalent), even though the common case is a single response.
- `moodleSanitizer.ts` — reuses the same `htmlToPlainText`-based discipline
  Phase 18E already established (`extraction/htmlSanitize.ts`) rather than
  a new bespoke sanitizer; Moodle's rich-text fields (`summary`, `intro`,
  assignment descriptions, forum posts) are flattened to safe plain text
  before ever reaching a candidate.
- `moodleClient.ts` — server-only, sends the encrypted-then-decrypted
  token as `wstoken` (a required Moodle REST parameter) and
  `moodlewsrestformat=json`; enforces HTTPS-only, request timeout,
  cancellation via `AbortSignal`, a bounded response-size cap, and a
  content-type check identical in spirit to `canvasClient.ts`. **Because
  Moodle's REST convention embeds the token as a query/POST parameter
  rather than an Authorization header (Moodle's own documented
  convention — there is no alternative header-based auth for the standard
  REST protocol), the client strips `wstoken` from every log line, thrown
  error message, and any URL that might ever be surfaced to the user or a
  structured log** (the brief's explicit Part 6 instruction) — this is a
  genuine, Moodle-specific redaction requirement Canvas's Bearer-header
  design never needed.
- `moodleImportOrchestrator.ts` — one file per selected course: fetch
  course content, assignments, quizzes, calendar events, (opt-in) forum
  posts; map through `moodleMapping.ts`; assemble one `ImportedSourcePackage`
  — same one-course-failure-never-destroys-another discipline as
  `canvasImportOrchestrator.ts` (and the same lesson from this session's own
  Canvas bug fix: single-resource fetches use the client's single-item
  function, never the list function, checked explicitly in review before
  this phase's own harness is trusted).

Site/user validation (Part 7) happens first, always: `moodleClient.ts`
calls `core_webservice_get_site_info` before any other function, and
rejects (never silently proceeds) on: unexpected hostname (compared against
the registry's `moodleBaseUrl`, never a value taken from the request),
wrong/unknown site, a token whose enabled functions don't cover what this
app needs, or a malformed response. Only `siteName`, `siteUrl`, `version`,
`userId`, `userDisplayName`, `functions` (the enabled-function list), and a
connection timestamp are retained — no other profile field is ever
requested or stored.

## 7. Course discovery, content, and mapping (Parts 8–14)

Mirrors Canvas's proven design (`canvasCourseDiscovery.ts`,
`canvasMapping.ts`) with Moodle's own function names and field semantics:

| Moodle function/field | Maps to | Never-infer rule enforced |
|---|---|---|
| `core_enrol_get_users_courses` | course list | classification (active/future/completed/hidden/unavailable/non-academic/unknown) uses `startdate`/`enddate`/`visible`, never today's date alone as a teaching-period signal |
| `course.shortname`/`fullname` | `ImportedSubjectCandidate.code`/`.name` | subject code only trusted when it matches a recognisable La Trobe-style pattern (reusing `universityRegistry.ts`'s existing `subjectCodePattern` for `latrobe`, `/^[A-Z]{3}\d[A-Z]{2}$/`) — otherwise left null, never guessed |
| `core_course_get_contents` (sections + modules) | `ImportedModuleCandidate` per section | section ordering preserved; unsupported activity types become plain linked resources, never assessments |
| `mod_assign` instance (`duedate`, `allowsubmissionsfromdate`, `cutoffdate`, `grade`) | `ImportedAssessmentCandidate` | `duedate` is the ONLY field that becomes the deadline; `allowsubmissionsfromdate` and `cutoffdate` are availability/closure metadata only, never substituted for `duedate`; a `0` or missing timestamp is treated as absent, never as the Unix epoch date; `grade` (maximum) is never treated as weighting |
| `mod_quiz` instance (`timeopen`, `timeclose`, `timelimit`, `grade`) | assessment candidate ONLY when the course structure/activity type clearly marks it assessable | `timeclose` becomes the deadline only for an actual assessable quiz; `timeopen` stays availability metadata; question content/answers are never fetched |
| calendar events (`core_calendar_get_calendar_events`, when/if ever reachable) | `ImportedCalendarCandidate` | deduplicated against assignment/quiz due dates by remote instance id, never fuzzy title matching — same discipline as Canvas's `isAssignmentGeneratedEvent` |
| forum posts (`mod_forum`), opt-in only | `ImportedAnnouncementCandidate` | bounded recent date range, sanitised, never treated as a deadline |

Every mapped candidate carries the Moodle instance id (course id, module
id, or instance id as appropriate), source URL, fetched timestamp, Moodle's
own `timemodified` where available (informational only, never authoritative
alone — same discipline as Canvas's `remoteUpdatedAt`), and a content
fingerprint (reusing `sha256Hex`, identical to Canvas's approach).
`temporaryId`s are stable and Moodle-id-derived (`moodle-<kind>-<id>`,
parallel to Canvas's `canvas-<kind>-<id>` convention), enabling the same
simple-lookup change detection Canvas's sync engine already proved.

This entire mapping layer is **designed and fixture-tested (§23/§24) against
synthetic Moodle responses shaped exactly like the documented Moodle web-
service JSON schemas** — it cannot be exercised against a live La Trobe
Moodle response this phase, since no approved connection exists (§3/§17).
This mirrors Phase 18E's own honest posture for institutions with no
Developer Key configured.

## 8. Sections, activities, resources (Part 12)

Supported Moodle module types map as the brief specifies: `assign`/`quiz`
reference their assessment candidate rather than duplicating it (same
link-don't-duplicate pattern as Canvas's module→assignment linking);
`page`/`resource`/`folder`/`url`/`book`/`label` become module resource
text/links; `forum` stays a resource unless explicitly identified as an
announcements forum (opt-in, §9); unsupported/unknown module types (`lesson`,
`workshop`, `choice`, `glossary`, `database`, `external tool` and anything
else Moodle reports) become safe linked resources rather than being
dropped silently or crashing the mapper. Hidden activities
(`visible: false`) are labelled as hidden, never silently excluded from the
extraction report (though excluded from default suggested-selected state).
No file content is downloaded by default — only metadata and the resource's
own Moodle URL.

## 9. Calendar and announcements (Parts 13–14)

**Path A (Moodle API calendar)** is designed in `moodleMapping.ts` against
Moodle's documented `core_calendar_get_calendar_events` shape, but is
**never exercised live this phase** — no approved connection exists to call
it against La Trobe's real data (§3/§17). It is fixture-tested only.

**Path B (ICS fallback)** is the ALREADY-WORKING existing `ics-calendar`
provider (§1) — no code change. UI copy (§15) explains specifically how to
get the export: "Open your LMS calendar → scroll to 'Import or export
calendars' → choose the URL or .ics file option," matching La Trobe's own
FAQ wording, including the honest note that La Trobe's own Student IT
doesn't officially support the feature's usability, without implying
UniGame itself has any problem with it.

**Deduplication (assignment/quiz due date vs calendar event, API vs ICS)**
is designed the same way Canvas's `isAssignmentGeneratedEvent` works —
matched by the calendar event's own linked module/instance id, never fuzzy
title matching — but since Path A never runs live this phase, the "API
event vs ICS event" case has no live data to exercise; it is covered only
by fixtures (§23) simulating both paths simultaneously.

**Announcements** (Moodle's "Announcements" forum, `mod_forum` with
`type: "news"`) are opt-in via the same settings-screen pattern as Canvas's
grades opt-in — a single setting: "Show recent La Trobe LMS announcements in
UniGame." Bounded to a recent date range, sanitised, never a game
notification, never fetched by default.

## 10. La Trobe-first Semester Setup UX (Part 15)

Institution selection already routes to an LMS-kind lookup (extending the
existing university-selection step with a `moodleInstitutionRegistry`
check, parallel to the existing Canvas institution check) — selecting "La
Trobe University" surfaces "LMS detected: Moodle" as an informational chip,
never suggesting Canvas (the brief's explicit instruction; Canvas remains
offered only for institutions actually configured for it). Given §3/§17's
honest unconfigured state, the Sources step for La Trobe shows the exact
sentence the brief specifies, followed by — with EQUAL visual weight, never
demoted —: Import Moodle calendar (routes straight to the existing ICS
importer with La Trobe-specific instructional copy), Upload subject guide,
Upload assessment information, Search La Trobe subject pages (the existing
Phase 18D fallback), Enter subjects manually. If a future deployment DOES
configure `MOODLE_LATROBE_SERVICE_TOKEN` (§17), the full Connect → status →
select subjects → retrieve → extraction report → room mapping flow the
brief describes activates automatically (the UI branches on
`isMoodleInstitutionConfigured()`, exactly as Canvas's UI already branches
on `isCanvasInstitutionConfigured()`) — this phase builds and fixture-tests
that full flow even though it cannot be exercised live yet.

## 11. Course-to-room mapping (Part 16)

Reuses the existing room-mapping UI pattern and `validateForApply`'s
duplicate-room-mapping check (already provider-neutral — fixed generically
in Phase 18E, §84–97's own completion report) unchanged. No new rooms, no
world-architecture changes. A warning is shown when more than four academic
courses are selected, matching the brief's instruction.

## 12. Synchronisation and conflicts (Parts 17–18)

`moodleSync.ts` mirrors `canvasSync.ts` field-for-field (§1): its own
`isMoodleOriginSourceFile("Moodle — ")`-prefixed detection,
`previewMoodleDataRemoval`/`removeMoodleImportedData`, a `MoodleChangeKind`
union, and `detectMoodleChanges` using the identical two-consecutive-miss
deletion state machine already proven correct by Canvas's own regression
suite. `ConflictKind` gains one new additive member,
`moodle-remote-item-removed`, parallel to Canvas's own. Due-date/weighting
conflicts against an already-confirmed live value are raised for free by the
existing, unmodified `reconcileWithLiveSemester` once Moodle data flows
through it — no separate Moodle-specific conflict-detection code needed,
exactly as Canvas already proved. Manual sync only; no polling.

## 13. Review, Apply, Undo, disconnect (Parts 19–20)

No changes to `applyImport.ts`, `ReviewStep.tsx`'s core mechanics, or the
Undo/backup mechanism (§1) — Moodle packages flow through unmodified.
Review gains the same filter set Canvas already has, generalized to show
"New/Changed/Removed from [provider]" regardless of which LMS produced the
change. Undo restores `moodleSync` for free (an additive `UniGameSaveData`
field, §1) and never restores revoked/deleted Moodle credentials (which live
entirely server-side, same structural guarantee as Canvas). Disconnect/
Reauthorise/Refresh/Stop-syncing-one-course/Remove-connection-data/
Remove-imported-data controls mirror `CanvasSettingsSection.tsx` exactly,
added as a parallel `MoodleSettingsSection.tsx` (or, if net simpler once
built, a shared component parameterised by provider — a UI-layer decision
deferred to implementation, not a data-model one).

## 14. API routes (Part 21)

Following `api/lms/canvas/disconnect.ts`'s exact pattern (§1): rate limiting
first, hand-rolled body validation rejecting unknown fields, ownership
verified against the connection store, structured redacted errors. Given
§3/§17's findings, only routes the confirmed (if-ever-configured) token
model actually supports are created:

```
GET  /api/lms/moodle/status
POST /api/lms/moodle/token        (submit an operator-configured token — see §5; there is no OAuth callback to build, since no OAuth path is confirmed available — Part 21's own instruction: "Do not create fake callback routes where no OAuth flow exists")
POST /api/lms/moodle/disconnect
GET  /api/lms/moodle/courses
POST /api/lms/moodle/import-preview
POST /api/lms/moodle/sync-preview
```

No `/connect` or `/callback` route is created — there is no OAuth
authorization-redirect flow to mediate (§3/§5). `/token` exists only to let
an operator-configured deployment validate a token was entered correctly by
whichever internal process configures it — it is NOT a student-facing
"paste your Moodle token here" UI field, since a stock Moodle install
doesn't hand ordinary students one to paste (§3).

## 15. Security and privacy (Part 22)

Every requirement from Phase 18E's own security posture applies unchanged,
plus Moodle-specific additions found this phase: token-in-query-parameter
redaction (§6, a genuine Moodle-specific need Canvas didn't have),
HTTP-200-with-embedded-error-envelope detection (§6, so a Moodle "failure"
is never misread as a successful empty response), and the same
host-allowlist/encrypted-credential/ownership-check/no-secrets-in-bundle
discipline Canvas already established, reusing (never duplicating) its
crypto primitives.

## 16. Fixtures and automated verification (Parts 23–24)

`scripts/verify-phase18f-moodle.ts` (built the same way as
`scripts/verify-phase18e-canvas.ts` — a local synthetic HTTP fixture server,
zero live dependency) will cover: site-info validation (valid/wrong-host/
insufficient-functions/malformed), the HTTP-200-embedded-error-envelope
case specifically, token redaction from logs/errors, course
discovery/classification, the full never-infer mapping rule set (due vs
cut-off vs allow-from, max grade vs weighting, quiz assessment-status
gating), section/activity mapping including unsupported-type fallback,
calendar dedup logic (exercised via fixtures even though Path A never runs
live), the two-consecutive-miss sync deletion rule, data-removal preview/
execution, and one end-to-end course import against the fixture server —
the same shape of coverage Canvas's 115-check harness achieved. All four
Canvas-era harnesses plus this new one must stay green; typecheck/lint/
build/secret-leak scan repeated exactly as Phase 18E's own sweep.

## 17. Deployment requirements (Part 26 detail deferred to the completion
report at the end of this phase)

**The headline finding, sharper than Phase 18E's Canvas equivalent:** this
phase can ship a fully real, fixture-tested Moodle architecture and a
fully working ICS/upload/search/manual fallback experience for La Trobe
students TODAY, with zero further configuration. Turning on the live
Moodle API/token path additionally requires La Trobe's own Moodle
administrators to manually issue a web-service token scoped to an
appropriate external service for a specific account (there is no
self-service or OAuth alternative on a stock Moodle install, per §3) — an
external prerequisite this codebase cannot self-provision, and one with a
real, honestly-documented ceiling: even once configured, the token is
issued to a single La Trobe account, not a per-student delegated-consent
flow the way Canvas's OAuth is — meaning a real multi-student production
deployment of the live Moodle path would need La Trobe to either grant
`moodle/webservice:createtoken` broadly (uncommon, a security-relaxation
decision only La Trobe can make) or run one of the optional third-party
OAuth-server plugins (§3) — both are Phase 18G-or-later, La-Trobe-side
decisions, not something this codebase's next iteration can resolve alone.

## 18. Features deliberately excluded this phase

- Any LMS other than Moodle for La Trobe, and no change to Canvas's
  existing institution set.
- Moodle OAuth/mobile-token authentication (no confirmed, password-free,
  student-self-service path exists on a stock Moodle install — §3).
- Any Moodle write operation, webhooks, continuous polling, AI extraction,
  new game mechanics — same exclusions as Phase 18E, extended to Moodle.
- A shared, generic `LmsSyncState` replacing `CanvasSyncState` — a
  deliberate non-refactor (§1) to avoid risking Canvas's working, tested
  system for no functional benefit.
- Live verification against a real La Trobe Moodle account (§3/§17's
  finding: no such account is available, and this app must never ask a
  user for one).

## 19. Deployment (Part 26)

**Hosting.** No change to `vercel.json` — folder-based routing means
`api/lms/moodle/status.ts` → `GET /api/lms/moodle/status`, etc., deploying
automatically alongside every existing Canvas and discovery function. Every
handler sets `export const config = { runtime: "nodejs" }` (never Edge —
token encryption needs `node:crypto`).

**Routes actually created** — deliberately fewer than the brief's suggested
list, each with a specific reason (§5/§14): `status`, `token`, `disconnect`,
`courses`, `import-preview`, `refresh`. No `connect`/`callback` (no OAuth
redirect flow exists to mediate — creating one would be the fake callback
route Part 21 explicitly forbids) and no separate `sync-preview` (Canvas's
own implementation proved this unnecessary: `import-preview` already serves
both the first import and a later resync identically, with change detection
happening entirely client-side via `moodleSync.ts`'s `detectMoodleChanges`
comparing a fresh fetch against the locally-stored `moodleSync` snapshot).

**Required environment variables — none are set in this repository:**

| Variable | Purpose | Required for |
|---|---|---|
| `MOODLE_TOKEN_ENCRYPTION_KEY` | 32-byte AES-256-GCM key, base64-encoded, encrypting every stored Moodle credential — independent from Canvas's own key | Any Moodle connection to work at all |
| `MOODLE_LATROBE_SERVICE_TOKEN` | The institution-issued Moodle web-service token itself | La Trobe's Connect entry to be offered as configured |

Generating `MOODLE_TOKEN_ENCRYPTION_KEY` uses the identical command as
Canvas's own key (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
— a SEPARATE key from Canvas's, so rotating or compromising one never
affects the other, even though both reuse the same underlying
`src/server/security/tokenCrypto.ts` implementation (§1's deliberate
extraction — see that file's header). `MOODLE_LATROBE_SERVICE_TOKEN` is
never generated by this app; it is provided by whoever obtains it from La
Trobe's own Moodle administrators (§20's onboarding checklist).

**The durable-store blocker (identical shape to Canvas's, §17 of Phase
18E's own doc).** `MoodleConnectionStore` is a real, fully-tested interface
with one adapter today (`InMemoryMoodleConnectionStore`) — not
production-durable for the same reason Canvas's isn't: this deployment has
no database or key-value store anywhere. Turning on the Moodle token path
in a real multi-instance production deployment needs exactly one new
adapter implementing `MoodleConnectionStore` against a real durable store —
no interface change, no call-site change anywhere else, the same
deliberately-isolated swap Canvas's own doc already established.

**La Trobe institution onboarding checklist** (what obtaining and
configuring a real token actually requires — none of this can be automated
by this app, and per §3, there is no self-service alternative on a stock
Moodle install):
1. Someone with a legitimate need contacts La Trobe's IT/Moodle
   administration team and requests a **web-service token** scoped to an
   **external service** exposing only the read-only functions this app
   needs (§7 of the original brief's function list: `core_webservice_get_site_info`,
   `core_enrol_get_users_courses`, `core_course_get_contents`,
   `mod_assign_get_assignments`, `mod_quiz_get_quizzes_by_courses`,
   `core_calendar_get_calendar_events`, and, only if announcements are
   wanted, `mod_forum_get_forums_by_courses` + `mod_forum_get_forum_discussions`)
   — never a broader or administrative service.
2. La Trobe's admin creates the token via Site Administration → Plugins →
   Web services → Manage tokens, for the SPECIFIC account whose enrolled
   courses this deployment is meant to surface (a token is tied to one
   Moodle user, not a delegated-consent-per-student model — see §17's own
   limitation).
3. The token is provided through a secure, out-of-band channel — never
   pasted into this app's UI, chat, or committed to source.
4. Set `MOODLE_LATROBE_SERVICE_TOKEN` as a Vercel environment variable.
5. Correct `moodleBaseUrl` in `moodleInstitutionRegistry.ts` if La Trobe's
   actual LMS hostname differs from the unverified `lms.latrobe.edu.au`
   default already listed (§4's `knownLimitations` flags this explicitly).
6. Redeploy. `isMoodleInstitutionConfigured("latrobe")` will now return
   `true`.
7. Verify: call `GET /api/lms/moodle/status` for the configured owner,
   confirm `connected: true`, run one course import preview.

**Health/observability.** No dedicated health-check endpoint — `GET
/api/lms/moodle/status` serves this purpose per-installation;
`isMoodleInstitutionConfigured()` is a pure function of an environment
variable, checkable without a network call. Structured logging follows the
same counts/categories/durations-only discipline as Canvas — raw Moodle
`errorcode`/`debuginfo`/`exception` strings are never logged or surfaced to
the client (§6/§22), only the categorized `MoodleErrorCategory`.

**Secret rotation and incident response.** If `MOODLE_LATROBE_SERVICE_TOKEN`
is suspected compromised: ask La Trobe's Moodle admin to delete/reissue the
token via Manage Tokens (there is no remote-revocation API call this app
can make — §20/`disconnect.ts`'s own honest limitation), then update the
env var and redeploy. If `MOODLE_TOKEN_ENCRYPTION_KEY` is suspected
compromised: rotate it and force every existing connection into
`reauthorisationRequiredAt` (or clear the connection store once a durable
adapter exists), same as Canvas's own incident-response shape.

**User-facing privacy explanation** (shown/implied by the UI copy already
built, §10): UniGame never sees or stores a La Trobe password; a Moodle
connection (when ever configured) uses a single institution-issued token
that only permits reading the connected account's own enrolled-course data;
disconnecting removes the locally stored encrypted credential; removing
imported data is a separate, previewed, explicitly-confirmed action.

# Completion Report

## 20. What was actually built, per part

Parts 1–18 above ARE the completion record for Parts 1–20 of the original
brief — audit (§1/§3), provider-neutral `LmsProvider` contract (§2, with a
correction made mid-implementation: dropped a synchronous `isConfigured()`
method that would have required importing the server-only institution
registry into client code — the exact shape that caused Canvas's own
bundle leak earlier this project; `getConnectionStatus`'s async
`institutionConfigured` field already covers this honestly), the La Trobe
Moodle registry (§4), connection modes + `MoodleConnectionStore` (§5),
Moodle server client with genuine Moodle-specific handling (§6 — the
HTTP-200-embedded-exception-envelope convention, and the flat-array-vs-
wrapper-object response-shape distinction, a real design difference from
Canvas's client caught by writing `moodleGetWrappedList` as a DISTINCT
function rather than assuming one shape), site/user validation (§7),
course discovery/classification (§8), the full mapping layer (§9 sections/
assignments/quizzes with every never-infer rule literally encoded), sync
engine with the identical two-consecutive-miss deletion rule Canvas already
proved (§12), Review/Apply/Undo integration requiring zero changes to
either (§13, confirmed by direct inspection during the audit), API routes
(§14 — 6 built, 2 deliberately not: no fake OAuth callback, no separate
sync-preview), and the full La Trobe-first Semester Setup UI + Settings
controls (§10, verified live in-browser against the real dev server with
zero console errors, correctly showing the honest "couldn't reach the
Moodle connection service" fallback in local dev — the same documented
Vite-dev-server limitation Canvas already has).

Two design corrections were made during implementation, not designed away
in advance:
- The `LmsProvider.isConfigured()` bundle-leak risk described above (§2),
  caught before it ever shipped by re-checking the real Canvas UI pattern
  (`CanvasConnectStep.tsx` never imports the registry directly either).
- `moodleImportOrchestrator.ts`'s course fetch was initially drafted as a
  single-course re-fetch via a Moodle function, then deliberately redesigned
  to take the already-discovered course record directly, once research
  confirmed no reliable single-course Moodle function exists across
  versions — a direct application of the lesson from this project's own
  Phase 18E Canvas bug (single-resource fetch mistakenly routed through a
  list-fetch function), applied here BEFORE it could become a live bug
  rather than after.

## 21. Automated test totals

| Harness | Checks | Result |
|---|---|---|
| `scripts/verify-phase18f-moodle.ts` (this phase, new) | 80 | 80/80 passing |
| `scripts/verify-phase18a-import.ts` (regression) | 118 | 118/118 passing |
| `scripts/verify-phase18c-backend.ts` (regression) | 68 | 68/68 passing |
| `scripts/verify-phase18d-conflicts.ts` (regression) | 29 | 29/29 passing |
| `scripts/verify-phase18d-extractors.ts` (regression) | 29 | 29/29 passing |
| `scripts/verify-phase18e-canvas.ts` (regression) | 115 | 115/115 passing |

Total: 439 automated checks across 6 harnesses, all green. The new harness
runs entirely against a local synthetic Moodle fixture server (a single
REST endpoint dispatching on `wsfunction`, exactly like a real Moodle site
— no live La Trobe dependency, no real tokens or student data) and covers:
token encryption reuse, `MoodleConnectionStore` CRUD + one-time pending-
connection consumption + `updateCredentialAtomically` concurrency, site/
user validation (valid/invalid-token/wrong-site/insufficient-function
cases), the Moodle-specific exception-envelope detection, flat-array vs
wrapper-object response unwrapping, expired-credential rejection, course
classification (active/completed/future/hidden/non-academic), the full
never-infer mapping rule set (duedate vs allowsubmissionsfromdate vs
cutoffdate, grade maximum vs weighting, quiz assessable-gating by grade,
zero-timestamp-as-missing), section/module mapping with assign/quiz linking
and hidden-item labelling, calendar event dedup, HTML sanitisation, the
two-consecutive-miss sync deletion rule, data-removal preview/execution,
the duplicate-room-mapping check (confirmed provider-neutral, benefiting
Moodle for free), and one full end-to-end course import against the
fixture server. `npm run typecheck`, `npm run lint`, and `npm run build`
all complete cleanly; a post-build `grep` of `dist/assets/*.js` for both
Canvas's and Moodle's env-var names, endpoints, and base URLs confirms zero
matches for either provider.

Per Part 25, no live Moodle test was attempted — no legitimate La Trobe
Moodle account or token was available in this environment, and per §3's
research findings, no confirmed self-service path exists for this app to
obtain one even if attempted. The honest unconfigured state and the ICS/
upload/search/manual fallback experience were verified directly in the
browser against the real dev server instead (§10/§20).

## 22. Known limitations and Phase 18G scope

- **No La Trobe Moodle token is configured in this repository.** The
  "Connect La Trobe LMS" entry point is real, tested code that currently
  reports "not currently configured" — see §20's onboarding checklist for
  what turning it on actually requires, and note the ceiling even once
  configured: a single institution-issued token maps to one Moodle account,
  not a per-student delegated-consent flow the way Canvas's OAuth is.
- **No production-durable `MoodleConnectionStore` adapter exists** — same
  shape and same fix as Canvas's own equivalent limitation (§19).
- **`moodleBaseUrl` is an unverified default** (`lms.latrobe.edu.au`,
  sourced from third-party citations, not an official La Trobe technical
  document) — must be corrected during real onboarding if wrong.
- **The Moodle API calendar path (Part 13 path A) has never run against
  live data** — it's fixture-tested only; the ICS path (path B) is the
  proven, working channel for La Trobe students today.
- Announcements remain a separate, off-by-default opt-in, exercised only
  against fixtures.
- No site-wide CSP, no Moodle webhooks, no write operations, no continuous
  polling — all deliberately out of scope (§18), unchanged from Phase 18E's
  own equivalent exclusions.
- Phase 18G's natural scope, in priority order: (1) a production-durable
  connection-store adapter shared in spirit with Canvas's own equivalent
  need; (2) actually obtaining a real La Trobe Moodle token through
  official channels and completing the onboarding checklist (§20); (3) if
  La Trobe (or another target institution) is ever confirmed to run a
  genuine third-party OAuth-server Moodle plugin, revisit whether a
  delegated per-student consent flow becomes possible — not assumed
  available before then; (4) the same site-wide CSP audit Phase 18E's own
  doc already recommended, still outstanding; (5) evaluate whether the
  provider-neutral `LmsProvider` contract (§2) needs a third implementation
  once a second real LMS connection (Canvas or Moodle) is actually live in
  production, to confirm the abstraction holds under real usage rather than
  only fixture-tested design.
