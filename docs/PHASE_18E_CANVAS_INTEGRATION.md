# Phase 18E — Canvas LMS Integration

Pre-flight audit + design for a secure, read-only Canvas connection, built on
top of Phases 18A–18D's existing academic-import pipeline. Nothing here
replaces `AcademicImportPackage`/Review/Apply/backup/Undo — Canvas data flows
through the exact same pipeline every other provider uses. No Moodle,
Blackboard, or Brightspace this phase; no write scopes; no AI extraction; no
webhooks; no continuous polling.

## 1. Current architecture (audit findings)

**Provider contract** (`src/import/types.ts`): `AcademicProvider` is
`{ id, displayName, capabilities, isAvailable(), validate(input), extract(input, ctx) }`.
`extract()` returns an `ImportedSourcePackage` (`{ providerId, subjects,
calendarEvents, warnings, conflicts? }`). Every existing provider (6 real, 5
placeholder) implements this identically; `officialUniversityProvider.ts`
(Phase 18B) is the closest existing precedent for a provider whose "file" is
actually a JSON-encoded request rather than a real uploaded document —
`ProviderInput.kind: "json"`, `text: JSON.stringify(payload)`. `CanvasAcademicProvider`
will follow this exact precedent: no new `SupportedFileKind` needed.

**Canonical model** (`src/import/types.ts`): `ImportedSubjectCandidate`,
`ImportedAssessmentCandidate`, `ImportedModuleCandidate`,
`ImportedCalendarCandidate` — every field-level fact carries
`ConfidenceLevel` (`confirmed/high/medium/low/missing/conflicting`) and
`SourceReference[]` (`sourceId, filename, location, excerpt, parser,
importedAt`). Canvas data maps into these exact shapes; no new candidate
types are introduced. `SourceReference.location` will hold the real Canvas
API/HTML URL (never a token-bearing URL — see §7).

**Merge/reconcile/conflict engine** (`src/import/merge/*`): `mergeSourcePackages`
matches subjects by code/name across providers and raises `ImportConflict`s
(`date-mismatch`, `weight-mismatch`, `subject-code-mismatch`,
`credit-points-mismatch`, `teaching-period-mismatch`,
`conflicting-handbook-versions`, `subject-mapping-ambiguous`,
`duplicate-assessment-name`, plus the reconcile-time live-semester
conflicts). `resolveConflict()` writes the chosen value back into the
candidate (the Phase 18A regression this project has a permanent test for —
see `scripts/verify-phase18d-conflicts.ts` §1). Phase 18E extends
`ConflictKind` with Canvas-specific kinds (§16 below) using the exact same
mechanics — no parallel conflict system.

**Review/Apply/backup/Undo** (`ReviewStep.tsx`, `applyImport.ts`,
`SaveDataContext.tsx`): Apply is `validateForApply → buildApplyDiff →
applySemesterImport`, called from `ApplyStep.tsx` after explicit user
confirmation. **Undo is a whole-`UniGameSaveData`-snapshot mechanism**, not a
field-level undo: `backupCurrentSave(saveData)` writes the entire current
save to `localStorage[IMPORT_BACKUP_KEY]` immediately before Apply commits;
`markImportBackupKind("semester-import")` tags it; Undo simply restores that
whole snapshot verbatim. This is the single most important finding for
Phase 18E's sync design (§10): **if Canvas sync metadata is stored as an
ADDITIVE field inside `UniGameSaveData` itself, the existing Undo mechanism
covers it automatically, with zero new Undo code** — Undo already restores
"everything in the save" to its pre-Apply state, which will include whatever
sync-metadata field this phase adds. OAuth tokens are never part of
`UniGameSaveData` (§4), so they are structurally outside anything Undo could
ever touch — satisfying "Undo must not restore revoked OAuth credentials"
by construction, not by a special case.

**Persistence** (`src/lib/persistence.ts`): `UniGameSaveData` is
`{ version: 2, semester, tasks, assessmentProgress, reminders, studyLog,
activeFocusSession, completedFocusSessions, mentorBonds, milestones,
completionCelebratedAt, userProgress, settings, personalGoals }`. Every
phase since v2 has added fields additively (no version bump, no migration
function beyond the original v1→v2 one) — Phase 18E follows this: one new
additive field, `canvasSync: CanvasSyncState | null`, defaulting to `null`
for every existing save. `exportSaveDataAsJson()`/`importSaveDataFromJson()`
serialize/parse exactly this object — anything not added to
`UniGameSaveData` (i.e., OAuth tokens, the installation identifier) can
never appear in a save export, by construction.

**No user-account system exists.** This is a critical finding, not an
assumption: `persistence.ts` has no concept of a logged-in user, session, or
server-side identity anywhere — UniGame is a single-device, localStorage-only
game with no backend accounts. Part 3's "associate the connection with an
authenticated UniGame user OR secure anonymous installation identifier,
according to the actual app architecture" therefore resolves to the second
option: a client-generated, non-secret, opaque installation identifier
(`crypto.randomUUID()`, stored under its OWN localStorage key — e.g.
`unigame:canvasInstallationId:v1` — deliberately OUTSIDE `STORAGE_KEY`'s save
object, so it is never included in a save export) is sent to the server as
`ownerId` when creating/using a Canvas connection. It is not a secret; it is
a correlation key, conceptually identical to an anonymous session id. Losing
it (cleared browser storage) means losing the Canvas connection binding —
documented as a known limitation (§13), not silently worked around.

**Vercel Functions / server module conventions** (`api/academic/discover.ts`,
`src/server/*`, Phases 18C/18D): one file per route under `api/`, Web-standard
`Request`/`Response` handlers, `export const config = { runtime: "nodejs" }`
(never Edge — SSRF/crypto both need Node APIs), all real logic in
framework-agnostic `src/server/*` modules imported by a thin `api/*` handler.
Runtime request validation is hand-written (no schema library), rejects
unknown fields, bounds every string/array. `tsconfig.app.json`'s `include`
already covers `["src", "api"]`. This phase adds `api/lms/canvas/*.ts`
following the identical pattern — folder-based routing means
`api/lms/canvas/connect.ts` → `GET /api/lms/canvas/connect`, etc. (confirmed
against the existing single `api/academic/discover.ts` precedent; Vercel
resolves function routes before `vercel.json`'s SPA catch-all rewrite, so no
change to `vercel.json` is needed for these new routes to work once
deployed).

**Security controls already in place** (`src/server/security/*`,
`src/server/pageCache.ts`, `cache.ts`, `rateLimiter.ts`): domain allowlisting,
literal-IP/private-range/localhost rejection (IPv4+IPv6), real DNS
resolution + private-address rejection, manual per-hop redirect validation,
size/timeout/content-type limits, bounded in-memory caches, fixed-window
rate limiting (`perClientRateLimiter`/`globalRateLimiter`, 5/min/IP and
60/min/instance). All of this is REUSABLE for Canvas: the Canvas API client
(§6/Part 6) needs its own base-URL allowlist (Canvas institution domains, not
`officialDomains` — a separate registry, §Part 2) but the same
timeout/size/content-type/redirect discipline applies unchanged.

**Environment-variable convention**: `UNIGAME_` prefix for this project's
own server-only config (`UNIGAME_SEARCH_API_KEY`,
`UNIGAME_ALLOW_LOCALHOST_FETCH`), read fresh from `process.env` at call time
(never cached at module load — a real bug this project already hit and fixed
in `ssrfGuard.ts` during Phase 18C). Phase 18E uses `CANVAS_` prefixed names
per the brief's own explicit suggestion (`CANVAS_TOKEN_ENCRYPTION_KEY`,
`CANVAS_OAUTH_STATE_SECRET`, `CANVAS_<INSTITUTION>_CLIENT_ID/SECRET/REDIRECT_URI`)
— a deliberate departure from the `UNIGAME_` convention because these name a
THIRD PARTY's credentials, not this app's own config, and per-institution
naming needs the institution id in the variable name itself. No
Vite-prefixed (`VITE_`) name is ever used for anything server-only — Vite
inlines `VITE_*` variables into the browser bundle at build time, so a
`VITE_CANVAS_CLIENT_SECRET` would be a literal secret leak; this is checked
explicitly in the verification harness (§15/Part 23).

**No CSP exists today.** Grepped the whole repo (excluding `node_modules`) —
no `Content-Security-Policy` header or meta tag anywhere. This is a
pre-existing, site-wide gap, not something Canvas introduces. Recommended
(§Part 20) as a `vercel.json` header addition; NOT implemented this phase,
since a correct CSP needs auditing every asset/font/script source this whole
app already loads (fonts, sprites, audio) and doing that hastily risks
breaking unrelated functionality — explicitly named as a Phase 18F
candidate rather than rushed in under Canvas's own scope.

**No durable database or key-value store exists anywhere in this
project.** This is the second critical finding: Vercel Functions here run
with zero external storage — `BoundedCache`, `RateLimiter`, and every other
piece of "server state" from Phases 18C/18D is explicitly documented as
in-memory and per-instance (not shared across cold starts or concurrent
instances). This directly triggers Part 4's own contingency: **the
production durable `CanvasConnectionStore` adapter is honestly left
unconfigured this phase.** An in-memory adapter is implemented and fully
tested (proves the interface and every OAuth code path deterministically),
but it cannot durably persist a Canvas connection across a real multi-instance
Vercel deployment — documented prominently, never glossed over (§13, §Part 4).

## 2. Canvas OAuth requirements

Canvas implements a standard **OAuth 2.0 authorization-code grant**
(`/login/oauth2/auth` → `/login/oauth2/token`), documented at Canvas's own
"OAuth2" and "API Change Log" pages. Key facts that shape this design
(verified against Canvas's own developer documentation conventions, since no
live Canvas sandbox is available this phase — see §Part 24/Sandbox below):

- Every Canvas **institution runs its own instance** at its own hostname
  (e.g. `canvas.instructure.com`, `<institution>.instructure.com`, or a fully
  custom domain) — there is no single global Canvas API host.
- Each institution's Canvas admin must register a **Developer Key**
  (Canvas's term for an OAuth client registration) scoped to that
  institution's own instance, producing a client id + client secret + one or
  more allowed redirect URIs — configured entirely on Canvas's side, nothing
  this app can provision itself.
- Canvas supports the standard `response_type=code` authorization flow with
  `state` (CSRF protection) and, per Canvas's documented support, **PKCE**
  (`code_challenge`/`code_challenge_method=S256`) as an additional layer for
  public/native clients — used here as defense-in-depth even though this is
  a confidential server-side client (the server holds the client secret),
  since PKCE costs nothing extra and further binds the authorization code to
  this specific request.
- Access tokens are **short-lived** (Canvas's own docs describe access
  tokens as expiring, with refresh tokens used to obtain new ones) — refresh
  must be implemented, not optional.
- Canvas returns `refresh_token` only on the FIRST authorization for a given
  client/user pair by default (unless `replace_tokens` behavior applies) —
  the stored refresh token must be treated as long-lived and precious; a
  refresh response that includes a NEW refresh token must have it replace
  the old one (rotation), never appended alongside it.

## 3. Developer-key requirement

**This app cannot obtain a Developer Key on any institution's behalf** — it
is an administrative action only an institution's own Canvas admin can
perform, in their own Canvas admin console, under their own institution's
service agreement. This phase therefore:

- Ships a **Canvas institution registry** (`src/import/canvasInstitutionRegistry.ts`,
  §Part 2) with **zero institutions marked `configured: true`** in this
  repository — because no real Developer Key exists for any institution.
  Every entry describes WHERE a real Developer Key would need to be
  registered (Canvas base URL, OAuth endpoints, the env-var NAMES a
  real deployment would set) without ever containing a secret value.
- Documents the exact administrator checklist (§Part 25/deployment doc) an
  institution would follow to provision one.
- Treats "unconfigured" as the default, fully-supported, first-class state —
  not an error page. When no institution is configured, Study Details still
  shows "Connect Canvas" as an option, but selecting it explains honestly
  that no institution has been set up yet and offers every existing
  fallback (web discovery, document upload, ICS/JSON import, manual entry)
  with equal visual weight — never a dead end.

## 4. Supported OAuth flow

Authorization-code + PKCE, server-mediated throughout:

1. Browser calls `GET /api/lms/canvas/connect?institutionId=...&returnPath=...`.
2. Server validates `institutionId` against the registry and rejects if
   unconfigured (§3) or `returnPath` isn't an allowlisted in-app path (open-
   redirect protection). Server generates a cryptographically random `state`
   value, a PKCE verifier + its S256 challenge, signs a short-lived
   "pending connection" record (state, institutionId, returnPath, PKCE
   verifier, expiry) — see §Part 4 — and redirects the browser to Canvas's
   real `authorizeEndpoint` with `client_id`, `redirect_uri`, `response_type=code`,
   `state`, `code_challenge`, `code_challenge_method=S256`, and the exact
   scope list (§6).
3. User authenticates with Canvas directly (this app never sees Canvas
   credentials) and approves or denies.
4. Canvas redirects to `GET /api/lms/canvas/callback?code=...&state=...`
   (or `?error=access_denied&state=...` on denial).
5. Server: looks up the pending connection by `state` (consuming it — a
   `state` can be used exactly once; a second attempt is a replay and is
   rejected), verifies it hasn't expired, verifies the institution still
   matches, then exchanges `code` + PKCE verifier for tokens server-side
   against Canvas's `tokenEndpoint` (client secret sent server-to-server
   only, never to the browser). On success: encrypts the tokens (§Part 4/§7),
   saves the connection keyed by the installation id, redirects the browser
   to the validated `returnPath`. On denial/failure: redirects to the
   `returnPath` with a query flag the frontend reads to show an honest
   "authorization was denied"/"couldn't connect" state — never a silent
   no-op.
6. `POST /api/lms/canvas/refresh` — exchanges a stored refresh token for a
   new access token when the current one is expired or about to expire;
   single-flight per connection (a mutex keyed by connectionId prevents two
   concurrent refreshes racing and one clobbering the other's rotated
   refresh token — §Part 4/§17).
7. `POST /api/lms/canvas/disconnect` — revokes the token via Canvas's
   `DELETE /login/oauth2/token` where reachable, deletes the encrypted
   connection record regardless of whether remote revocation succeeded,
   reports which one happened.
8. `GET /api/lms/canvas/status` — returns the connection's non-secret state
   (connected/reauth-required/not-connected, institution, last sync time) —
   never the tokens themselves.

## 5. Institution-specific Canvas domains

Never assumed to be one global hostname. The Canvas institution registry
(§Part 2) is the single source of truth for which hostnames this app will
ever send a token-bearing request to or redirect a user's browser toward —
exactly parallel to `universityRegistry.ts`'s `officialDomains` allowlist
(Phase 18B), but a SEPARATE registry, because Canvas OAuth fields (client
id/secret env-var names, redirect URIs, token/authorize endpoints) have
nothing to do with public-discovery fields (handbook URL templates, sitemap
locations). The browser is never allowed to submit an arbitrary Canvas base
URL directly into server fetch logic — a custom-domain entry (if ever added
by an admin) must be validated (well-formed HTTPS host, not an IP literal,
not a private/localhost address — reusing `src/server/security/ipRanges.ts`'s
existing checks) BEFORE it is stored in the registry or used in any request,
never accepted ad hoc from a single request.

## 6. Token lifecycle

`access_token` (short-lived, per Canvas's own token-expiry behavior) +
`refresh_token` (long-lived, rotated on some refresh responses) +
`expires_at` (computed server-side from the token response's `expires_in`)
+ `scopes` (the exact scope string Canvas granted, which may differ from
what was requested if an admin restricted it) are the only Canvas-issued
values stored, always encrypted (§Part 4). Lifecycle:

- **Issued** at callback-time (§4 step 5).
- **Used** for every Canvas API call via `canvasTokenManager.ts`, which
  checks `expires_at` before each call and refreshes proactively if within
  a safety margin of expiring, rather than waiting for a live 401.
- **Refreshed** — see §4 step 6; on failure the connection is marked
  `reauthorisationRequiredAt` (a timestamp, not a deletion) — imported
  academic data is completely unaffected, and the next Canvas action
  offers "Reauthorise" prominently rather than silently failing.
- **Revoked** at explicit user Disconnect (§4 step 7) or, if Canvas itself
  revokes it out-of-band (an admin revokes the Developer Key, the user
  changes their Canvas password in a way that invalidates tokens, etc.), the
  next API call's 401 is treated as "reauthorisation required", not a crash.
- **Never** written to `UniGameSaveData`, browser localStorage, save
  exports, error messages, or structured logs (verified explicitly, §Part 23).

## 7. Server trust boundary

Identical philosophy to Phase 18C's SSRF boundary, extended to Canvas:

- The browser may only ever send: an `institutionId` (validated against the
  registry), a `returnPath` (validated against an allowlist of in-app
  routes), the state/PKCE values the server itself issued and the browser
  is merely round-tripping through the Canvas redirect, and — for read
  operations — course/assignment/module ids that the SAME connection has
  already legitimately seen (never an arbitrary remote id fished from
  outside this app; every id used in a later request is checked against
  IDs this app itself returned earlier for that connection, closing the
  "arbitrary remote id" gap Part 21 calls out).
- The server is the only thing that ever holds a client secret or a Canvas
  access/refresh token. Every Canvas API call is server → Canvas, never
  browser → Canvas (except the OAuth authorize redirect itself, which
  carries no secret, only the public client id and PKCE challenge).
- Every connection-mutating operation (refresh, disconnect, sync) checks
  that the calling installation id actually OWNS the connection being
  acted on — no operation accepts a bare `connectionId` without also
  confirming the request's installation id matches the connection's
  `ownerId` (Part 21's "require authenticated connection ownership").
- File/attachment links from Canvas are surfaced as plain external URLs the
  user opens themselves (their own Canvas session in their own browser
  handles auth for that click) — this app's server never proxies a
  Canvas-hosted file through a token-bearing request path, so no token can
  ever leak through a URL parameter or a proxied download.

## 8. Requested API scopes

Least privilege — every scope maps to one concrete, already-scoped-in
feature; nothing speculative. Canvas expresses OAuth scopes as
`url:METHOD|/api/v1/path` strings; the exact list is finalized in
`canvasInstitutionRegistry.ts`'s `DEFAULT_READONLY_SCOPES` and documented
here per-feature:

| Scope (Canvas API path) | Feature that needs it |
|---|---|
| `url:GET\|/api/v1/users/self` | Current user identity (confirm who authorized, for `canvasUserId`) |
| `url:GET\|/api/v1/courses` | Course listing (Part 7) |
| `url:GET\|/api/v1/courses/:id` (enrollments included) | Enrolment state to classify active/completed/future (Part 7) |
| `url:GET\|/api/v1/courses/:id/assignments` | Assignment import (Part 9) |
| `url:GET\|/api/v1/courses/:id/assignment_groups` | Assignment-group weighting (Part 9) |
| `url:GET\|/api/v1/courses/:id/modules` | Module import (Part 10) |
| `url:GET\|/api/v1/courses/:id/modules/:id/items` | Module items (Part 10) |
| `url:GET\|/api/v1/courses/:id/pages/:url` | Page body, ONLY when a module item selected by the user needs it (Part 10) |
| `url:GET\|/api/v1/calendar_events` | Calendar import (Part 11) |
| `url:GET\|/api/v1/announcements` | Announcements, opt-in only (Part 11) |
| `url:GET\|/api/v1/courses/:id` (syllabus_body include) | Syllabus body where accessible (as additional subject description text, never a required field) |

**Deferred, separate, explicit opt-in only** (Part 12 — not requested at
initial connect time; a second, distinct authorization/consent step would be
needed before these are ever requested):
`url:GET|/api/v1/courses/:id/students/submissions` (submissions),
grade-bearing fields on assignments/submissions.

**Never requested**: any `POST`/`PUT`/`DELETE` scope, any admin scope, any
scope touching other students' data, any scope beyond what the table above
lists.

## 9. Data mapping

| Canvas entity | UniGame candidate | Notes |
|---|---|---|
| Course | `ImportedSubjectCandidate` | `course_code` → `code`, `name` → `name`; `enrollment_term_id`/dates → informs `teachingPeriod` only when a term name is resolvable, never guessed |
| Assignment | `ImportedAssessmentCandidate` | `due_at` → the ONLY field that becomes a deadline; `points_possible` stored separately from `weighting` (never conflated — Part 9); `unlock_at`/`lock_at` become availability metadata, never a deadline |
| Assignment group (weighted) | contributes `weighting` only when `course.apply_assignment_group_weights === true` | never assumed otherwise |
| Module | `ImportedModuleCandidate` | items become module description/topics or, when an item is an Assignment, a LINK to the already-created assessment candidate (never a duplicate) |
| Module item (Page/File/Discussion/ExternalUrl) | module resource text/links | never promoted to a standalone assessment |
| Calendar event | `ImportedCalendarCandidate` | assignment-generated events are deduplicated against the assessment they came from (matched by Canvas's own `assignment_id` on the event, not fuzzy title matching) |
| Announcement | a NEW, separate, non-assessment informational candidate type (§Part 11) — opt-in, never a deadline | |

Every mapped candidate carries: Canvas's own numeric id (as `location` or a
dedicated `remoteId`-style field in `SourceReference`), the exact API/HTML
URL fetched, `fetchedAt`, `sourceType`, a `ConfidenceLevel` (Canvas
structured-JSON fields get `"high"` when present and non-null, `"missing"`
when null/absent — never inferred), and a content fingerprint (SHA-256 of
the normalized JSON fields that matter for change detection, reusing
`src/server/contentHash.ts`'s existing `sha256Hex`, the same helper Phase
18C/18D's page cache already uses) plus Canvas's own `updated_at` where the
resource provides one.

## 10. Sync ownership

**Sync metadata lives inside `UniGameSaveData`** (a new additive
`canvasSync: CanvasSyncState | null` field — §1's key finding), NOT in a
separate store, and NOT alongside encrypted credentials. This gives sync
metadata the exact same guarantees the rest of the save already has for
free: it round-trips through save export/import, and — critically — it is
automatically restored by the EXISTING whole-snapshot Undo mechanism after a
Canvas Apply, with no new Undo code. Credentials remain entirely
server-side (`CanvasConnectionStore`, §Part 4), keyed by the client-side
installation id — never merged into save data, never exported.

`CanvasSyncState` holds, per bound course: `CanvasCourseBinding` (which
Canvas course maps to which local subject room + when), and per remote item,
a `CanvasRemoteSnapshot` (remote id, remote type, content fingerprint, last
imported-at, last seen-at, local target id, deletion state) — exactly the
fields Part 15 specifies. A sync run never mutates the live save directly;
it produces a `CanvasSyncReport` (a list of `CanvasSyncChange`s) that flows
through the SAME Review screen as any other import, gated by the same
Apply transaction.

## 11. Privacy model

- No new PII beyond what the user already explicitly authorizes Canvas to
  share via the OAuth consent screen (their own name/id as visible to
  Canvas, their own course/assignment data).
- Grades/submissions are a categorically separate, off-by-default data
  class (§Part 12) — never fetched as a side effect of ordinary course
  import, never required for any other feature.
- Structured logs never include token values, raw Canvas response bodies,
  or free-text content (assignment descriptions, announcement bodies) — only
  counts/categories/durations, the same discipline Phase 18C's
  `logging.ts` already established for discovery logs.
- Canvas-provided rich text (assignment descriptions, announcement bodies,
  syllabus body) is sanitized before ever being rendered — no script
  execution, no inline event handlers — using the SAME `htmlToPlainText`-
  adjacent sanitization discipline already in this codebase (Phase 18A's
  `extraction/htmlText.ts`), extended with an explicit allowlist-based HTML
  sanitizer for the cases where limited rich formatting (bold/lists/links)
  is actually shown rather than flattened to plain text.

## 12. Deletion and disconnection behaviour

Five distinct, separately-triggered actions (Part 19) — never conflated:

1. **Disconnect Canvas** — revoke token at Canvas (best-effort, result
   reported honestly either way), delete the encrypted connection record,
   stop future sync. Imported academic data (subjects/assessments/modules/
   calendar events already applied to the live save) is untouched.
2. **Reauthorise Canvas** — re-runs the OAuth flow for an existing,
   `reauthorisationRequiredAt`-marked connection; on success, clears that
   flag and updates tokens; the OLD connection record is updated in place
   (same `connectionId`), not replaced — sync history/bindings are
   preserved.
3. **Refresh Canvas** — a manual, user-triggered sync run (§Part 15) using
   the existing connection; not a token refresh (that's automatic and
   internal — see §6) though it may trigger one if the access token has
   expired.
4. **Stop syncing one course** — removes just that course's
   `CanvasCourseBinding`; already-imported data for that course is
   untouched; future syncs simply won't touch it either.
5. **Remove imported Canvas academic data** — a SEPARATE, explicitly
   destructive action with its own preview (which subjects/assessments/
   modules/events came from Canvas and would be removed), gated by
   confirmation, entirely independent of Disconnect — a user can disconnect
   and keep their data, or keep the connection and remove the data, or
   both, or neither.

## 13. Failure states

Every failure is a distinct, honestly-labelled state, never a silent
fallback to "nothing happened" and never a crash:

| Failure | Handling |
|---|---|
| Institution not configured (no real Developer Key) | "Canvas integration for this institution hasn't been set up yet" + every existing fallback shown |
| User denies Canvas authorization | "Authorization was denied" — returns to Sources step, connection never created |
| State expired/invalid/replayed | Rejected before any token exchange; user sent back to retry the connect step cleanly |
| Code exchange fails (Canvas error response) | Structured error surfaced without exposing raw Canvas error internals; connection never partially created |
| Access token expired mid-sync | Transparent refresh attempt first; only surfaced to the user if refresh also fails |
| Refresh fails | `reauthorisationRequiredAt` set; academic data untouched; "Reauthorise" offered |
| Canvas rate-limits (429) | Retry-After honored once with bounded backoff, then reported as "Canvas is temporarily rate-limiting requests — try again shortly" rather than retried aggressively |
| Canvas 5xx / unreachable | Bounded retry (idempotent GETs only), then "Canvas is temporarily unavailable" |
| Partial success across endpoints (courses ok, assignments fail for one course) | That course's report is marked partial; other courses' results are untouched — same "one failure never destroys another's result" discipline as Phase 18C's `discoverSubjects` |
| **No durable connection store in production** | Documented explicitly as a deployment blocker, not silently degraded — see §1 |

## 14. Testing strategy

Same split established across every prior phase: a deterministic fixture
suite (synthetic Canvas responses via a local HTTP fixture server or direct
function calls — never a live Canvas dependency) proves every OAuth/token/
mapping/sync rule in isolation; the brief's Part 24 "optional sandbox test"
is explicitly skipped this phase (no legitimate Canvas developer sandbox
credentials are available in this environment, and this app must never ask
the user to paste a client secret into chat, place one in source, or attempt
to obtain institutional credentials) — the OAuth redirect URL construction
is instead verified WITHOUT ever sending it (constructing the exact
authorize-URL string and asserting its shape/parameters), which proves the
flow is wired correctly without requiring a live Canvas response.

## 15. Deployment requirements

Summarized here; full detail in the deployment doc section written at the
end of this phase (Part 25). The headline finding: **this phase can ship a
fully real, fixture-tested OAuth/import/sync architecture, but Canvas OAuth
cannot be turned on in production without (a) at least one institution
provisioning a real Developer Key, and (b) a durable key-value store or
database replacing the in-memory `CanvasConnectionStore` adapter** — both
external prerequisites this codebase cannot self-provision. Every piece of
code is written and tested against that honest reality, not against a
pretended-complete deployment.

## 16. Features deliberately excluded this phase

- Moodle, Blackboard, Brightspace (any LMS other than Canvas).
- Any Canvas write operation (grade posting, assignment creation, etc.).
- Continuous/background polling of any kind.
- Webhooks (Canvas supports them, but a legitimate signed-verification
  pipeline needs a durable backend this project doesn't have yet — Part 20's
  own instruction).
- Grades/submissions by default (separate opt-in, §Part 12; the opt-in UI
  itself is built this phase, but requesting the scope requires the
  explicit consent step to actually be triggered by a real user action).
- A production-durable token store (§1/§13 — the interface and an
  in-memory test adapter are built; the production adapter is honestly left
  unconfigured).
- A site-wide Content Security Policy (pre-existing gap, out of Canvas's
  own scope — recommended as a Phase 18F item).
- AI-based extraction of any kind, and any new game mechanic.

## 17. Deployment (Part 25)

**Hosting.** No change to `vercel.json` — folder-based routing means
`api/lms/canvas/connect.ts` → `GET /api/lms/canvas/connect`, etc., deploying
automatically alongside the existing `api/academic/discover.ts` function and
the static SPA build, exactly as documented for Phase 18C (§14 of that
phase's own doc). Every handler sets `export const config = { runtime:
"nodejs" }` (never Edge — token encryption needs `node:crypto`).

**Required environment variables — none are set in this repository; every
one is a real deployment prerequisite, not a formality:**

| Variable | Purpose | Required for |
|---|---|---|
| `CANVAS_TOKEN_ENCRYPTION_KEY` | 32-byte AES-256-GCM key, base64-encoded, encrypting every stored access/refresh token | Any Canvas OAuth to work at all |
| `CANVAS_OAUTH_STATE_SECRET` | HMAC-SHA256 secret signing the OAuth `state` parameter | Any Canvas OAuth to work at all |
| `CANVAS_<INSTITUTION>_CLIENT_ID` | Developer Key client id for that institution (e.g. `CANVAS_UNIMELB_CLIENT_ID`) | That institution's Connect Canvas to be offered as configured |
| `CANVAS_<INSTITUTION>_CLIENT_SECRET` | Developer Key client secret — server-only, never sent to the browser | Same as above |
| `CANVAS_<INSTITUTION>_REDIRECT_URI` | The exact redirect URI registered on that institution's Developer Key (must match Canvas's own record exactly) | Same as above |

`<INSTITUTION>` is the registry id upper-cased with non-alphanumerics
replaced by `_` (e.g. `unimelb` → `UNIMELB`) — see `envVarNames()` in
`canvasInstitutionRegistry.ts`. `isCanvasInstitutionConfigured(id)` reads
`process.env` fresh on every call (never cached at module load); with no
institution's client id/secret pair set, every "Connect Canvas" entry point
still renders — it explains honestly that the institution isn't set up yet
and shows every other import method with equal weight, never a dead end.

**Generating `CANVAS_TOKEN_ENCRYPTION_KEY`:**
```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Store the output as the Vercel environment variable value directly. Losing
this key makes every previously-encrypted token permanently undecryptable
(by design — there is no recovery path other than every user reconnecting
Canvas). Rotating it requires either (a) a maintenance window where all
existing connections are force-disconnected and users reconnect, or (b) a
future dual-key decrypt path keyed by the already-present `keyVersion` field
on every encrypted value — not built this phase, since no rotation has ever
been needed yet, but the `keyVersion` field exists specifically so that
migration is possible without a schema change later.

**Generating `CANVAS_OAUTH_STATE_SECRET`:** any high-entropy random string
(e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
Rotating it invalidates only in-flight (unconsumed) OAuth attempts — since
pending connections expire after `PENDING_CONNECTION_TTL_MS` (10 minutes)
regardless, rotating this secret is low-risk and needs no user-facing
migration.

**Institution onboarding checklist** (what a real deployment operator does
to turn on one institution — none of this can be automated by this app):
1. The institution's own Canvas admin registers a Developer Key in their
   Canvas admin console, providing: a redirect URI of
   `https://<this-app's-domain>/api/lms/canvas/callback`, and requesting the
   scope list in §8 (read-only, no admin, no grades by default).
2. The admin (or whoever holds the Developer Key) provides the resulting
   client id + client secret through a secure, out-of-band channel — never
   pasted into this app's UI, chat, or committed to source.
3. Set `CANVAS_<ID>_CLIENT_ID`, `CANVAS_<ID>_CLIENT_SECRET`,
   `CANVAS_<ID>_REDIRECT_URI` as Vercel environment variables for the
   production (and, separately, preview/staging if used) environment.
4. Correct that institution's `canvasBaseUrl` in
   `canvasInstitutionRegistry.ts` if it differs from the unverified
   `<id>.instructure.com`/custom-domain default already listed (§3's
   `verificationNote` flags every entry as needing this confirmation).
5. Redeploy. `isCanvasInstitutionConfigured(id)` will now return `true`, and
   "Connect Canvas" for that institution becomes a real, working OAuth flow.
6. Verify with a real test account: connect, confirm `GET
   /api/lms/canvas/status` reports `connected: true`, run one course import
   preview, confirm Disconnect revokes cleanly (Canvas's own "Authorized
   Apps" settings page for that test user should no longer list this app
   after Disconnect).

**The durable-store blocker (repeated deliberately, not a duplicate
oversight).** `CanvasConnectionStore` is a real, fully-tested interface
(`src/server/lms/canvas/canvasConnectionStore.ts`) with one adapter today:
`InMemoryCanvasConnectionStore`, backing the module-level `canvasConnectionStore`
singleton every route currently uses. This is **not production-durable**: a
Vercel Function's in-memory state is not guaranteed to survive a cold start
or to be shared across concurrent instances, so a real multi-instance
production deployment would see connections randomly "disappear" (falsely
reporting `not connected`) whenever a request lands on an instance that
didn't handle that connection's original OAuth callback. **Turning this on
in production requires writing one more adapter** implementing the exact
same `CanvasConnectionStore` interface against a real durable store (Vercel
KV / Upstash Redis / a hosted Postgres table, etc.) — encrypting is already
handled upstream by `canvasTokenCrypto.ts`, so the new adapter only needs to
persist already-encrypted blobs keyed by `connectionId` and by
`(ownerId, institutionId)`, plus the same one-time pending-connection
consumption semantics verified in §3 of the automated harness. No interface
change, no call-site change anywhere else in the codebase — this is
deliberately the ONE swap needed to move from fixture-tested to
production-durable.

**Local development.** `npm run dev` serves the SPA only; `/api/lms/canvas/*`
routes are not reachable that way (same limitation already documented for
`/api/academic/discover` in Phase 18C §14) — the frontend's "couldn't reach
the Canvas connection service" honest-fallback message (added this phase,
see the `CanvasConnectStep.tsx` fix below) is what a developer will actually
see locally, which is correct, not a bug. `npx vercel dev` is the real way to
exercise the API routes locally, and needs the environment variables above
set in a local `.env` (via `vercel env pull` from a real project, or a
throwaway sandbox Developer Key) — never a fixture/test value pasted into a
committed file.

**Health/observability.** No dedicated Canvas health-check endpoint was
added this phase (unlike `/api/academic/discover`'s `GET` health response) —
`GET /api/lms/canvas/status?institutionId=...` already serves this purpose
per-installation, and per-institution "configured" state is a pure function
of environment variables, checkable via `isCanvasInstitutionConfigured()`
without a network call. Structured logging follows Phase 18C's existing
`logging.ts` discipline (counts/categories/durations only — §11).

**Secret rotation and incident response.** If a client secret is suspected
compromised: rotate it in that institution's Canvas Developer Key console
first (this immediately invalidates the old secret Canvas-side), then update
the corresponding `CANVAS_<ID>_CLIENT_SECRET` env var and redeploy — already-
issued access/refresh tokens for existing connections remain valid until
Canvas separately revokes them (a Canvas-side action, not something this app
triggers). If `CANVAS_TOKEN_ENCRYPTION_KEY` is suspected compromised: every
stored token must be treated as compromised — rotate the key, and force
every existing connection into `reauthorisationRequiredAt` (or simply clear
the connection store, once a durable adapter exists) so every user
reconnects under the new key. If a user reports unexpected Canvas activity
under their account: disconnecting from UniGame's Settings screen revokes
this app's specific token at Canvas (§12) — it does not affect any other
application the user may have separately authorized.

# Completion Report

## 18. What was actually built, per part

Parts 1–3 (audit, institution registry, OAuth requirement) are §1–§3 above.
Parts 4–21 (OAuth flow, token storage, Canvas API client, course discovery,
mapping, announcements/grades opt-in, room-mapping UI, Semester Setup
integration, sync/change-detection, Review/Apply/disconnect/data-removal
integration) were built exactly as designed in §4–§13, with two real defects
found and fixed during implementation and verification (not designed away in
advance):

- **`updateTokensAtomically`'s original signature was synchronous**, which
  meant the network refresh call happened OUTSIDE the held lock and did not
  actually prevent two concurrent refreshes from racing. Fixed by changing
  the store interface to take an async updater
  (`(current) => Promise<CanvasConnectionRecord>`) so the entire
  check-then-refresh-then-save sequence runs inside one held per-connection
  lock — verified directly in the harness (§19, check 
  "concurrent updateTokensAtomically calls never interleave").
- **`canvasImportOrchestrator.ts` fetched a single course via
  `canvasGetList` instead of `canvasGetOne`** — found by this phase's own
  verification harness (§19), not by manual review. Canvas's real
  `GET /courses/:id` returns one JSON object, not an array, so
  `canvasGetList`'s `Array.isArray` check would have thrown
  `invalid-response` on every real course import, unconditionally. Fixed to
  call `canvasGetOne`, re-verified end-to-end against the local fixture
  server.

Two pre-existing, provider-agnostic gaps (not Canvas-specific, but exposed
by Canvas's many-courses-per-import shape) were also found and fixed:
`validateForApply()` had no duplicate-room-mapping check (two subject
candidates could silently both be mapped to the same live room); and
`applyImport.ts`'s module-creation path hardcoded
`sourceNote: "Added via Semester Setup import."` regardless of provider,
unlike assessments, which meant Canvas-origin modules could never be
reliably identified for the "Remove imported Canvas data" feature. Both are
fixed and covered by regression checks in the existing Phase 18A/18D
harnesses and this phase's own harness respectively.

## 19. Automated test totals

| Harness | Checks | Result |
|---|---|---|
| `scripts/verify-phase18e-canvas.ts` (this phase, new) | 115 | 115/115 passing |
| `scripts/verify-phase18a-import.ts` (regression) | 118 | 118/118 passing |
| `scripts/verify-phase18c-backend.ts` (regression) | 68 | 68/68 passing |
| `scripts/verify-phase18d-conflicts.ts` (regression) | 29 | 29/29 passing |
| `scripts/verify-phase18d-extractors.ts` (regression) | 29 | 29/29 passing |

The new harness runs entirely against a local synthetic HTTP fixture server
(no real Canvas dependency, no real tokens or student data — Part 22/23) and
covers: token encryption round-trip/tamper/key-version rejection, constant-
time comparison, OAuth state signing/verification, PKCE derivation,
`CanvasConnectionStore` CRUD + one-time pending-connection consumption +
`updateTokensAtomically` concurrency, Canvas client pagination/retry-after/
schema-validation/size-limit behavior, course classification (active/
completed/future/non-academic), Canvas mapping correctness (`due_at`-only
deadlines, weighting only when group-weighted, module/assignment dedup,
calendar assignment-event dedup, stable temporary ids, HTML sanitization),
sync change detection (new/changed/unchanged counts and specifically the
two-consecutive-miss deletion rule — never a one-miss deletion), Canvas
data-removal preview/execution, the duplicate-room-mapping validation fix,
and one full end-to-end course import against the fixture server. `npm run
typecheck`, `npm run lint`, and `npm run build` all complete cleanly; a
post-build `grep` of `dist/assets/*.js` for Canvas env-var names, client
secrets, and `canvasBaseUrl` confirms zero matches — the institution
registry's public-facing data (`canvasInstitutionPublicList.ts`) is the only
Canvas-institution data reachable from client code.

Per Part 24, no live Canvas OAuth test was attempted — no legitimate sandbox
or developer credentials were available in this environment, and this app
must never ask a user to share a client secret in chat or place one in
source. The OAuth authorize-URL construction is instead verified by
asserting its exact shape/parameters without ever sending it, which proves
the flow is wired correctly without a live Canvas response.

## 20. Known limitations and Phase 18F scope

Carried over from §13/§16/§17 above, restated together as the honest state
of this feature at the end of Phase 18E:

- **No institution has a real Developer Key configured in this
  repository.** Every "Connect Canvas" entry point is real, tested code that
  currently reports "not configured" for all seven registry entries — see
  §17's onboarding checklist for what turning one on actually requires.
- **No production-durable `CanvasConnectionStore` adapter exists.** The
  interface and an in-memory adapter are fully built and tested; a real
  deployment needs exactly one new adapter (§17) before OAuth connections
  will survive across Vercel instances/cold starts.
- **Canvas hostnames in the registry are unverified defaults**, not
  confirmed-working URLs — each carries an explicit `verificationNote` and
  must be corrected during real onboarding if wrong.
- Grades/submissions remain a separate, off-by-default opt-in (by design,
  not a gap) — the opt-in UI exists, but no institution has ever actually
  exercised the additional consent step live.
- No site-wide CSP, no Canvas webhooks, no Moodle/Blackboard/Brightspace —
  all deliberately out of scope this phase (§16), recommended as Phase 18F
  candidates where a durable backend and/or broader LMS support becomes a
  real, separately-scoped priority.
- Phase 18F's natural scope, in priority order: (1) a production-durable
  `CanvasConnectionStore` adapter, since nothing else Canvas-related can go
  live in production without it; (2) real institution onboarding once at
  least one Developer Key exists; (3) a site-wide CSP audit; (4) evaluation
  of a second LMS (Moodle is the next most-requested in similar contexts)
  only after Canvas has real production usage to learn from.
