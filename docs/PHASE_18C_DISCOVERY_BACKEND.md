# Phase 18C — Secure Academic Discovery Backend

## 1. Pre-flight audit findings

**Does a backend already exist?** No. Through Phases 1–18B this project has
been a 100% client-side Vite + React SPA — `localStorage` persistence, zero
API routes, zero server code, zero environment-variable convention beyond
Vite's own `import.meta.env.BASE_URL` (one call site, `src/engine/manifestTypes.ts`).

**Is a hosting target already declared?** Yes — `vercel.json` exists at the
repo root (SPA rewrites + static asset cache headers). No `/api` directory
exists yet. This settles the runtime choice without needing to ask: **Vercel
Functions**, the platform this project is already configured for, add zero
new hosting relationships, zero new accounts, and deploy automatically
alongside the existing static build the moment files exist under `/api`.

**Function signature.** Verified directly against Vercel's current Functions
docs (fetched during this phase, not assumed): a file under `/api` exports a
named HTTP-method handler using the **standard Web `Request`/`Response`
API** — `export async function POST(request: Request): Promise<Response>` —
no `@vercel/node` dependency required. Runtime defaults to `nodejs` unless a
file opts into `config.runtime = "edge"`. This phase deliberately never sets
edge: the SSRF-protection requirement ("resolve DNS... reject private-address
resolution") needs `node:dns`, which only the Node.js runtime provides.

**`AcademicProvider` / `AcademicExtractionService` / `OfficialUniversityProvider` / registry / safeFetch** —
all inspected (all authored in Phases 18A/18B of this same session).
`AcademicExtractionService` (Part 11 of 18A) is a *different* concept — an
optional future AI-extraction adapter — and stays untouched and unwired this
phase too; this phase's backend does deterministic retrieval + the existing
rules-based extraction, never an AI call. `OfficialUniversityProvider`'s
direct-from-browser fetch (Phase 18B) is **kept** as the graceful fallback
when the backend is unavailable — not replaced, not deleted.

**Vercel CLI / `@vercel/node`** — neither is installed in this environment,
and neither gets installed by this phase (no `vercel login`/project-link
action was taken). See §11 for what this means for local development.

## 2. Current browser-only limitations (recap, Phase 18B findings)

| Limitation | Why a backend fixes it |
|---|---|
| CORS | A server has no CORS restriction fetching another server. |
| JS-rendered handbook pages (Monash confirmed) | Out of scope for *this* phase (no headless browser — see §6); the backend still can't render JS, but it can at least tell the difference between "blocked" and "rendered client-side" and say so honestly. |
| Search-driven sites (RMIT, Deakin, Swinburne, VU) | A server-side sitemap-based search adapter can find pages a hardcoded URL template can't. |
| Unstable/guessed URL templates (La Trobe 404'd in 18B) | Same fix — search adapter as a second attempt after the direct template. |
| robots.txt / redirect validation | Already existed in `safeFetch.ts`; the backend adds *manual, per-hop* redirect validation, which matters more in a server context (see §5). |

## 3. Trust boundary

```
Browser (untrusted input)                    Vercel Function (trusted, isolated)
──────────────────────────                   ────────────────────────────────────
institutionId (registry key)     ──POST──▶   1. validate request (reject unknown
subjectQueries[] (code/name          )                  fields, wrong types, oversized)
academicYear, teachingPeriod,                2. look up institution in SERVER-SIDE
degree, major, campus, locale                   registry (browser never sends a URL)
                                              3. build candidate URLs from registry
                                                 templates / sitemap / search adapter
                                              4. SSRF-guarded fetch of ONLY those URLs
                                              5. extract via existing deterministic
                                                 engine, merge, build quality report
                              ◀──JSON──────  6. return AcademicImportPackage-shaped
                                                 response + warnings + timing
```

The browser **never** sends a URL. It sends an institution id (a registry
key) and search terms (subject code/name strings). Every URL the function
ever fetches is either a registry template with `{code}` substituted, or a
link discovered on a sitemap page that was itself fetched from an official
domain and filtered to that same domain before being considered a candidate.
There is no code path — none — that accepts or forwards an arbitrary
browser-supplied URL. This is what keeps the endpoint from being a generic
proxy: it is a *fixed-menu* fetcher (registry-and-sitemap-derived URLs only),
never an *à la carte* one (fetch-whatever-URL-you-send-me).

## 4. Request/response schema (Part 2)

See `src/server/schema.ts` for the authoritative shape and the hand-written
runtime validator (`validateDiscoverRequest`). No new dependency (e.g. zod)
was added for this — the validated surface is one endpoint with a small,
flat-ish shape, and a hand-written allow-list validator keeps the dependency
footprint at zero while still rejecting unknown fields, wrong types, empty
arrays, and oversized strings. TypeScript types alone are erased at runtime
and are never trusted for anything the browser sends.

Request: `institutionId`, `subjectQueries[]` (`{ code?, name? }`, at least one
of the two, max 10 queries per request), `degree?`, `major?`, `academicYear`
(4-digit string), `teachingPeriod?`, `campus?`, `locale?`. Every optional
string field is length-capped and stripped of control characters before use.

Response: `requestId`, `institution`, `queryResults[]` (per-subject: status,
discoveredSources, warnings), `package` (an `AcademicImportPackage`, so the
frontend and Review step need no new shape), `warnings[]`, `errors[]`,
`timing` (`{ totalMs, perSubjectMs }`), `cacheStatus` (`"hit" | "revalidated" | "live" | "stale-fallback"`).

Discovered source: `finalUrl`, `pageTitle`, `sourceType` (`"handbook" | "subject-guide" | "timetable" | "assessment" | "calendar" | "search-result"`),
`officialDomain`, `fetchedAt`, `contentHash`, `confidence`, `discoveryMethod`
(`"direct-template" | "sitemap" | "search-adapter"`), `warnings[]`.

## 5. Security boundary (Part 3) — `src/server/security/`

- **HTTPS only**, except `http://localhost`/`127.0.0.1` in local dev (and
  even then, only ever reachable if a developer explicitly points a registry
  entry at it — never reachable from a deployed instance, since Vercel
  production requests never resolve to loopback addresses in the first
  place).
- **Domain allowlist**: every candidate URL's hostname must be in that
  institution's registry `officialDomains` *before* the first request is
  made.
- **IP-literal / localhost / private-network rejection**: a hostname that is
  itself an IPv4/IPv6 literal is rejected outright — official pages are
  always named hosts. `localhost`, `127.0.0.0/8`, `::1`, link-local
  (`169.254.0.0/16`, `fe80::/10`), private ranges (`10.0.0.0/8`,
  `172.16.0.0/12`, `192.168.0.0/16`), multicast, and other reserved ranges
  are all rejected.
- **DNS resolution check**: before fetching, the hostname is resolved via
  `node:dns/promises` and *every* returned address is checked against the
  same private/reserved ranges above — this is what stops a malicious or
  compromised DNS record from pointing an allowlisted *hostname* at an
  internal IP (allowlisting the name alone isn't enough).
- **Manual, per-hop redirect validation**: the fetcher uses `redirect: "manual"`
  and follows redirects itself (bounded to 3 hops), re-running the entire
  domain-allowlist + IP/DNS check on *every* hop's destination — not just the
  final URL. This is stricter than Phase 18B's browser-side `safeFetch.ts`,
  which only re-checks the final URL after letting the browser's own fetch
  follow redirects automatically. That's a deliberate, threat-model-specific
  difference (documented, not a retrofit of a "bug"): a browser fetch runs on
  the user's own machine and cannot reach a cloud provider's internal
  network; a server-side fetch runs inside that cloud network and
  *can* — so every hop needs the check there, not just the destination.
- **Reject embedded credentials** in a URL (`user:pass@host`).
- **Limits**: 3 redirects max, 8-second total timeout per fetch, 2 MB
  compressed / 6 MB decompressed response size cap (aborts mid-stream once
  exceeded), content-type allowlist (`text/html`, `application/xhtml+xml`,
  `application/xml`, `text/xml`, `text/plain`).
- **Never** executes remote JavaScript, never renders in a browser (headless
  or otherwise — see §6's explicit decision not to add one this phase),
  never forwards the browser's cookies/auth headers (the function only ever
  sends its own descriptive `User-Agent`), never touches an LMS or any
  authenticated page (registry domains are exclusively public handbook
  hosts).
- **Tracking-parameter stripping**: common tracking params (`utm_*`, `gclid`,
  `fbclid`, session-id-shaped query params) are stripped from any URL before
  it's logged or stored as a `SourceReference`.
- **Log sanitisation**: logged URLs never include query strings beyond the
  stripped set above; error messages are categorised (§10) rather than
  including raw exception text that might embed a full URL or header value.
- **Rate limits**: per-client (IP-keyed) and global bounded in-memory
  counters (documented per-instance limitation, §9) reject with a clear
  "rate limited" error category rather than queuing or retrying.
- **Cancellation**: the handler honours `request.signal` (a real Vercel
  Functions feature per §1) and passes it through to every downstream fetch.

None of these are weakened for any specific university, including the ones
that don't work well (Monash/RMIT/La Trobe/Deakin) — a difficult site fails
gracefully with an honest warning, per Part 6, rather than loosening a
control to "make it work".

## 6. Headless browser — explicitly not used

The audit considered and rejected adding a headless browser (Playwright/
Puppeteer) to render JS-only pages like Monash's. Reasons:
- It would need its own sandboxed process/container, a materially larger
  attack surface (a real browser engine fetching and *executing* arbitrary
  remote script, which directly contradicts "never execute remote
  JavaScript"), and meaningfully higher cold-start/latency/cost on a
  serverless platform.
- Nothing about Monash's specific failure mode requires it to be "safe" —
  the honest, correct response is exactly what Part 6 asks for: report that
  the page needs client-side rendering and point the user at upload/manual
  completion instead.
A headless browser is deferred to Phase 18D+ only if a future audit
establishes a strictly sandboxed, specifically necessary use case.

## 7. Search-provider design (Part 4)

`src/server/search/` defines a `SearchAdapter` interface with two
implementations:
- **`SitemapSearchAdapter`** (real, wired, no credentials needed): fetches
  an institution's registered sitemap location(s) (XML sitemap or an HTML
  sitemap/index page), filters entries to the institution's own domains,
  and ranks candidates by: exact subject-code substring match in the URL
  path > handbook/subject-guide path-terminology match (registry-defined
  `pathRankingHints`) > exact subject-name match in the linked page's title
  > partial name match. Returns no result rather than a low-confidence guess
  when nothing clears a minimum ranking bar.
- **`ExternalSearchApiAdapter`** (interface only, **not wired up** this
  phase — exactly the Phase 18A AI-adapter precedent): documents the shape a
  real approved search API (e.g. a paid web-search API) would need to
  implement, gated behind an env var that, if unset, means this adapter is
  simply never selected. No key of any kind exists in this repository or in
  browser code.

Every result the adapter returns keeps its discovery evidence (the sitemap
page it came from, the matched ranking signal) as part of the
`DiscoveredSource`'s `discoveryMethod`/`confidence`, so a search-found page is
never presented with unearned confidence relative to a verified direct
template.

## 8. University Registry V2 (Part 5)

`src/import/universityRegistry.ts` is **extended**, not replaced (same file,
same 7 institutions, same `verified`/`verificationNote` precedent from Phase
18B). New optional fields added this phase: `preferredDomains`,
`excludedSubdomains`, `subjectGuideTerm`/`teachingPeriodTerm` (separate from
the existing `unitTerm`), `searchQueryTemplate`, `nativeSearchEndpoint`,
`sitemapLocations`, `preferredSourceTypes`, `pathRankingHints`,
`yearUrlConvention`, `knownJsRenderedSections`, `availabilityNotes`,
`researchDate`. Every field defaults to `null`/`[]` for the 6 institutions
not re-researched this phase — nothing is guessed to fill a gap.

Re-verification this phase (via real fetches — see §13): Melbourne remains
the only `verified: true` entry; Monash's confirmed-partial status is
unchanged; RMIT/La Trobe/Deakin gained a documented sitemap-adapter attempt
(see completion report for what was actually found) rather than a second
guessed URL template.

## 9. Cache & rate limits (Part 10) — a real, honestly-scoped limitation

Vercel Functions on the Hobby/default tier are stateless between cold starts
and **do not share memory across concurrent instances**. This phase
implements a real, bounded, in-memory LRU-style cache and rate limiter
(`src/server/cache.ts`, `src/server/rateLimiter.ts`) that work correctly
*within* a single warm instance — genuinely reduces repeat load on university
servers and genuinely rate-limits a burst from one warm instance — but is
**not** a cross-instance/durable store. The cache/rate-limiter modules are
written behind a small interface so a real distributed store (Vercel KV /
Upstash Redis) can be swapped in later without touching calling code; that
swap is **not** performed this phase (it needs a real provisioned store this
environment has no credentials for) and is called out explicitly in Phase
18D scope. Cache keys: `institutionId + normalizedSubjectQuery + academicYear + teachingPeriod`,
with content-hash-based revalidation for stable handbook pages (long TTL) and
a short TTL for failures (so a transiently-down site is retried soon, not
cached as permanently broken). Every response reports which of
hit/revalidated/live/stale-fallback happened.

## 10. Observability (Part 11)

Structured `console.log`/`console.error` JSON lines (Vercel captures stdout
as logs automatically — no logging SaaS integration needed or added).
Logged: `requestId`, `institutionId`, per-subject result status, source
count, fetch/extraction duration, cache status, and one of the fixed error
categories in `src/server/errors.ts` (`invalid-request`,
`unsupported-institution`, `no-official-result`, `robots-disallowed`,
`timeout`, `domain-rejected`, `redirect-rejected`, `response-too-large`,
`unsupported-content-type`, `parse-failure`, `stale-academic-year`,
`ambiguous-results`, `service-misconfigured`). Never logged: uploaded file
content, full extracted page text, any API key, cookies/auth headers,
personal goals, or any other unnecessary PII — the request body's
`subjectQueries` are logged as counts, not raw content, beyond the
institution id.

## 11. Local development strategy

The Vercel CLI is **not installed** in this environment (verified: `npx vercel --version` requires a fresh download this session did not perform, to avoid an uninvited account/login action). Two consequences, both handled:
1. **The core logic is 100% testable without the CLI.** Every module under
   `src/server/` is plain, platform-agnostic TypeScript (no Vercel-specific
   import anywhere except the one-line handler in `api/academic/discover.ts`
   itself). The verification harness (§13, extending the Phase 18A/18B
   pattern) calls these functions directly in Node — genuine execution of
   the real shipped code, not a mock.
2. **Running the actual HTTP endpoint locally** is documented (§ deployment)
   as `npx vercel dev`, the standard command for this setup — not run in
   this session, since installing/authenticating the CLI is an account-level
   action outside this phase's scope to take unprompted.

## 12. Privacy implications

No new PII collection: `subjectQueries`/`degree`/`major`/`academicYear`/
`teachingPeriod`/`campus` are the same fields Phase 18A's Study Details
already collects client-side; this phase just also sends them to the
function that needs them to build a search query, and the function does not
persist them past the request (the cache key is a hash of the query terms,
not the terms verbatim, and the cache stores only the resulting page
data/extraction — never the user's personal goals, institution enrolment
identity, or any account-identifying value, none of which this endpoint ever
receives in the first place).

## 14. Deployment (Part 14)

**Hosting.** Already configured — `vercel.json` at the repo root. No change
was needed to that file; `POST /api/academic/discover` deploys automatically
because Vercel treats any file under `/api` as a function. The static SPA
build (`vite build` → `dist/`) and the API function are deployed together
from one `vercel` project; no separate service or account.

**Environment variables** (all optional — every feature this phase adds
degrades gracefully to "not configured" rather than failing):
| Variable | Purpose | Required? |
|---|---|---|
| `UNIGAME_SEARCH_API_KEY` | Enables `ExternalSearchApiAdapter` (§7) — unset means that adapter is simply never selected. | No |
| `UNIGAME_ALLOW_LOCALHOST_FETCH` | Set to `"true"` only for local testing against a synthetic fixture server (see the Phase 18C verification harness) — never set in production. | No (dev/test only) |

No other secret exists. **No secret appears in the browser bundle**: every
`src/server/*` module and `api/academic/discover.ts` are outside Vite's
build graph (Vite only bundles what `index.html`'s script tags reach), and
`vite build`'s output was inspected this phase to confirm `dist/` contains
no reference to either variable name.

**Local development commands:**
```
npm run dev              # existing Vite dev server — the SPA only; /api/* 404s here (confirmed this phase — see completion report), which is the correct, honest trigger for the frontend's fallback path
npx vercel dev            # the real way to run BOTH the SPA and /api/* locally — NOT run this phase (see §11); requires `vercel login` first
npm run build             # existing production build — unaffected by /api (verified: dist/ output is identical in shape to before this phase)
npm run typecheck         # now also covers api/ (tsconfig.app.json's include was extended to ["src", "api"])
npm run lint              # unchanged — covers src/ only, consistent with scripts/ also being unlinted; api/ and src/server/ (the latter IS under src/, so IS linted) both pass with 0 warnings
```

**Health check.** `GET /api/academic/discover` returns `{ "status": "ok", "service": "academic-discovery" }` — usable directly as a Vercel/uptime-monitor health check target.

**Rate-limit and cache storage.** In-memory, per-instance (§9) — no external store to provision this phase. A future distributed rollout would provision Vercel KV or Upstash Redis and swap the implementations behind `BoundedCache`/`RateLimiter`'s existing interfaces.

**Timeout settings.** Per-fetch timeout is 8 seconds (`serverFetch.ts`), well under Vercel's default function timeout; no `vercel.json` `maxDuration` override was needed or added.

**Log access.** Standard `vercel logs` / the Vercel dashboard's Functions tab — no separate logging integration was added (§10).

**Secret rotation.** Since the only real secret slot (`UNIGAME_SEARCH_API_KEY`) is unused this phase, there is nothing to rotate yet; when a real search API is wired up (Phase 18D+), rotation is standard Vercel environment-variable update + redeploy, no code change required (the adapter already reads it fresh from `process.env` at call time, not cached at module load — the same lesson applied to `ssrfGuard.ts`'s localhost flag after it was found caching at load time during this phase's own testing).

**Fallback mode when the backend is unavailable.** Already the frontend's default behaviour (§13/Part 9): a non-2xx or network-level failure calling `/api/academic/discover` is treated identically to "not configured" — the UI falls back to Phase 18B's direct-browser provider, with an honest on-screen indicator of which mode is active (`DiscoveryStep.tsx`'s `mode` prop). This was verified directly this phase: with no Vercel function deployed (this dev environment has none), the real fetch call 404s, is caught, and the flow proceeds via direct-browser discovery without any error surfaced to the user beyond the honest "using your browser directly" note.

## 13. Rollback / fallback behaviour

If the backend is unreachable, misconfigured, or returns a 5xx: the frontend
falls back to the **existing, unmodified** Phase 18B
`OfficialUniversityProvider` (direct-from-browser fetch) for any institution
where that has a chance of working (Melbourne, confirmed), and otherwise
surfaces "Automatic search isn't available right now" and routes the user to
upload/calendar-import/manual-completion — never a fake progress bar, never
a silently-empty result presented as "nothing found" when the real cause was
"couldn't reach the search service". This mirrors the Undo/backup precedent
from Phase 18A: a failure path that degrades to the next-most-manual option
rather than blocking the user.
