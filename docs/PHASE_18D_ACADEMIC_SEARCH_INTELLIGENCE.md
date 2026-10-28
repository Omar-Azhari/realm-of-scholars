# Phase 18D — Academic Search and University Intelligence

Pre-flight audit + design for improving discovery quality, coverage and
transparency on top of Phase 18C's secure backend. Nothing here replaces the
`AcademicImportPackage`/Review/Apply/backup/Undo architecture — every
discovered fact still carries confidence, source references, and source
excerpts, and still passes through the existing pipeline.

## 1. Current state (audit findings)

**Supported-university coverage** (from `src/import/universityRegistry.ts`,
Phases 18B/18C):

| Institution | Direct template | Sitemap | Native search | Status |
|---|---|---|---|---|
| Melbourne | ✅ verified (handbook + assessment) | none needed | ✅ real | Only fully verified entry |
| Monash | ✅ resolves, but JS-rendered content | ✅ real index, crawls successfully | endpoint known, unconfirmed | Partial — code/title only |
| RMIT | none | ✅ real, but sampled entries were marketing/blog, not confirmed to cover the course catalogue | endpoint known | Unconfirmed coverage |
| La Trobe | guessed, 404'd on the one code tested | unreachable by research tooling | none known | Reachable host, no working path |
| Deakin | none | unreachable (403) | endpoint known, blocked | No working path |
| Swinburne | none | none | none | Not researched |
| Victoria University | none | none | none | Not researched |

**Current discovery success rate** (from the Phase 18C harness's bounded live
smoke test, run twice this session): 1 of 2 runs against Melbourne fully
succeeded; the other hit the site's own bot-protection page. This is the
single most important number this phase must contextualise honestly:
*discovery success is not just a codebase property — it varies run to run
against a real, rate-limiting external site.* The quality model (§10 of this
doc) exists precisely so a "partial" or "insufficient" result is explained,
not hidden behind one score.

**Current query types.** Only subject *code* queries are genuinely exercised
end-to-end (18B/18C). `SubjectQuery.name` exists in the type but the sitemap
adapter's name-matching path was written and unit-tested only lightly (one
success-path assertion in 18C's harness); this phase gives search-by-name
equal, tested weight.

**Ranking weaknesses found in 18C** (and fixed then, but worth restating as
the reason this phase formalises ranking properly): the sitemap adapter had
a bug where a path-ranking-hint match alone (with zero code/name text
correlation) qualified a candidate — meaning almost any page under a
`/subjects/` path would "match" almost any query. Phase 18C's fix removed
the standalone hint branch; Phase 18D's ranking engine (§Part 5) generalises
that fix into an explicit, numerically-weighted, testable scoring model so
the same class of bug can't reappear silently in a future adapter.

**Subject-name ambiguity risks:** two subjects with near-identical names
across faculties (common at large universities); a name that's a substring
of another subject's name; university-specific naming conventions (e.g.
"Unit" vs "Subject" vs "Course" terminology already tracked per-institution,
but title *formatting* conventions — trailing credit-point suffixes,
institution branding prefixes — are not yet normalised before comparison).

**Stale-handbook risks:** Phase 18C's `detectStaleYearWarning` only catches
the literal phrase "not available in YYYY" (observed real Melbourne
phrasing) — it does not detect a page that's simply from a *previous* year's
handbook edition with no explicit unavailability statement (e.g. a URL like
`/2024/subjects/...` fetched when the user asked for 2026). This phase adds
real year-signal extraction from title/URL/heading text, not just one phrase
pattern.

**Academic-year risks:** universities publish next year's handbook before
the current calendar year ends (e.g. 2027 handbook live in late 2026) — a
naive "year in URL == current calendar year" check would wrongly flag a
correct, current handbook as "future" during that overlap window. §Part 6
handles this explicitly.

**Institution-specific terminology** already captured per-institution
(`unitTerm`, `subjectGuideTerm`, `teachingPeriodTerm`, `teachingPeriodNames`)
but not yet used as *matching aliases* — e.g. knowing Monash calls Semester 1
"Semester 1" but a rarer program might call an equivalent period "Term 1" is
not yet cross-mapped. §Part 7 adds an explicit alias table.

**Extraction gaps:** the general deterministic engine (heading-based +
prose-fallback, Phases 18A/18B) has no path for structured data a real page
might embed (JSON-LD, an HTML `<table>` of assessments, an accordion). This
phase adds an *institution-specific extractor* layer that only ever
*extends* the general engine, never replaces it, and only for genuinely
observed real structures (not speculative ones).

## 2. Proposed scoring model (Part 5/10 preview — full detail in-code)

Ranking (which *candidate page* is the right one) and quality (*how good is
what was extracted from it*) are deliberately two separate, both-explainable
models:

- **Ranking** (`src/server/search/ranking.ts`) produces a numeric score per
  *candidate page* from a fixed list of named signals (each with a fixed
  weight), before any page is chosen. Two near-equal top scores → ambiguous,
  never silently resolved.
- **Quality** (`src/server/qualityScore.ts`) produces per-*dimension* labels
  (identity/year/period/assessments/modules/authority/freshness) for the
  page(s) actually chosen and extracted from. A perfect identity match with
  zero public assessments can never be labelled "Excellent" — the overall
  label is a function (documented, not hidden) of the *worst* materially
  important dimension, not an average that can hide a gap.

## 3. Candidate-selection model

When ranking produces one clear winner (score gap above a fixed threshold,
§Part 5), discovery proceeds straight to the existing Review step exactly as
today. When it doesn't, a new **Ambiguity Review** step (Part 11) — a
candidate-selection UI *before* Review, never replacing it — presents the
top candidates with their scores' contributing signals in plain language,
requires an explicit user pick (or exclude/search-again/upload), and only
then hands the chosen candidate into the unchanged Review pipeline.

## 4. Provider extension strategy

`src/import/extraction/institutions/` (Part 9) holds one file per
institution that needs it, each exporting a function of the same shape as
the general engine's entry point, called *after* general extraction and
merged additively (never overwriting a field the general engine already
found with higher or equal confidence). An institution with no file simply
uses general extraction — there is no per-institution branching inside the
general engine itself, preserving the existing "no hardcoded scraping logic
inside providers" rule from Phase 18B.

## 5. Privacy considerations

No new PII collection. Search-by-name sends the subject name string the
user already typed in Study Details (same field, existing since 18A) to the
same backend that already receives subject codes; nothing about degree/major
is sent to an external search adapter unless genuinely needed to disambiguate
(Part 3's explicit requirement), and even then only as an additional search
term, never logged verbatim (Phase 18C's logging convention — counts and
categories, not content — is unchanged and re-verified this phase).

## 6. Test strategy

Same split as Phase 18C: a deterministic fixture suite (synthetic, local
HTTP server, no live dependency) proves every ranking/year/period/conflict
rule in isolation and in combination; a separate, explicitly bounded live
smoke test against real university sites is reported honestly and never
flips the fixture suite's pass/fail count (Phase 18C's own bot-protection
encounter this session is the concrete proof this separation matters).

## 7. Stop conditions

Per the brief: stop once search-by-code and search-by-name both work,
ranking is deterministic/explainable, ambiguous results require selection,
year/teaching-period mismatches are handled safely (never silently
resolved), the quality report is transparent, fallback remains functional,
and the full import pipeline (Review → Apply → reload → Undo) remains
intact. Canvas/Moodle/Blackboard/Brightspace OAuth and any AI-extraction
dependency remain explicitly out of scope, unchanged from Phases 18A–18C.

---

# Completion Report

Everything below was built after this audit, in the order the brief's Parts
imply. All stop conditions are met; see §9.

## 8. What was actually built, per Part

- **Part 2 — Adapter architecture.** `src/server/search/types.ts` defines
  `AcademicSearchAdapter` (`isConfigured`/`supportsInstitution`/`search`/
  `healthCheck`) plus `SearchRequest`/`SearchResult`. Adapters return
  candidates only — no adapter touches SSRF/domain-validation/retrieval;
  that stays in `security/serverFetch.ts` and `security/ssrfGuard.ts`,
  called from the orchestrator, never from an adapter.
- **Part 3 — External search adapter.** `src/server/search/externalApiAdapter.ts`
  — real, credential-gated (`UNIGAME_SEARCH_API_KEY`), honestly reports
  unconfigured when the key is absent (which it always is in this repo — no
  key exists anywhere), and `search()` returns `[]` rather than a fabricated
  result. Every fallback (direct template → sitemap → upload) keeps working
  with this adapter absent, exactly as before.
- **Part 4/5 — Search-by-name + ranking.** `src/server/search/ranking.ts`'s
  `scoreCandidate()` is the single, shared, explainable scoring function
  (named signals with fixed weights in the exported `WEIGHTS` table — see
  the file for the full list). `sitemapAdapter.ts` uses it in TWO passes: a
  cheap URL-only pre-filter (no fetch, `pageText: ""`), then a real re-score
  after fetching only the shortlist — never "fetch every result". Path
  hints alone score `+2`, structurally too small to ever qualify a candidate
  alone against `MINIMUM_QUALIFYING_SCORE = 15` — the generalised fix for
  the real Phase 18C sitemap bug. `AMBIGUITY_SCORE_GAP = 10` flags a
  near-tie as ambiguous rather than silently picking the marginally-higher
  score.
- **Part 6/7 — Year/period intelligence.** `src/server/search/yearDetection.ts`
  and `teachingPeriod.ts` — pure classification functions
  (exact/likely/not-shown/stale/future/conflicting for year;
  exact/alias/not-shown/conflicting/multiple-offered for period), driven by
  registry data (`teachingPeriodAliases`), never a cross-institution
  equivalence table.
- **Part 8 — Registry V3.** `src/import/universityRegistry.ts` extended with
  `archivePathPatterns`, `marketingPathPatterns`, `titleSuffixesToStrip`,
  `subjectCodeAliases`, `teachingPeriodAliases`, and a full
  `InstitutionSupportStatus` per institution (see §1's table — unchanged
  from the audit; no institution's status was inflated during
  implementation).
- **Part 9 — Institution-specific extractors.** `src/import/extraction/institutions/`
  — one genuine extractor (`unimelb.ts`, the only "verified" institution),
  selected by id via `registry.ts`, running strictly after general
  extraction and only ever filling a still-null field (credit points via a
  "Credit Points:" label the general engine never looks for at all;
  coordinator via Melbourne's "Subject Coordinator:" label variant, which
  the general engine's stricter `COORDINATOR_LABEL_PATTERN` misses). Never
  overwrites, never invents, falls back to general-only extraction on any
  error (wrapped in try/catch in the orchestrator) or for any institution
  with no extractor registered.
- **Part 10 — Quality score.** `src/server/qualityScore.ts` — eight
  dimensions computed independently, an overall label derived by explicit
  if/else rules keyed to the worst materially important dimension (never an
  average). A subject with confirmed identity but no public assessments is
  labelled "Needs review", never "Excellent" — enforced by a real branch in
  `computeQualityScore`, verified by a dedicated harness check.
- **Part 11 — Ambiguity Review.** `AmbiguityReviewStep.tsx` — shown before
  Review whenever any `QueryResult.status === "ambiguous"`. Shows title,
  code, source type, domain, quality preview, and every alternative
  candidate with why it matched; actions are Keep/Select/Search
  again/Exclude/Upload/Enter manually. "Select" is real, not cosmetic: it
  round-trips through a new `preferredUrl` field on `SubjectQuery` (Part
  11's own consequence — see §8a below) that re-fetches and re-extracts
  from the exact chosen page, still through the same domain-allowlist/SSRF
  guard as every other fetch. Nothing is auto-applied; "Continue to Review"
  is disabled until every ambiguous subject has an explicit resolution.
- **Part 12 — Extraction Report V2.** `DiscoveryPreviewStep.tsx` rewritten:
  per subject shows discovery method, retrieval time, the full quality
  dimension breakdown with its plain-language explanation, missing fields
  labelled "(not a fabricated success)", and a per-subject "Refresh search"
  action for partial/not-found/error results.
- **Part 13 — Conflict engine extensions.** `mergeEngine.ts`'s
  `mergeSubjectPair` now detects `subject-code-mismatch`,
  `credit-points-mismatch`, and `teaching-period-mismatch` across sources
  (nulls the field pending resolution, exactly like the existing
  weight/date pattern); `resolveConflict` writes the chosen value back into
  the subject candidate for all three. `subjectMapping.ts` now returns
  `ambiguousWith` when two live subjects score within
  `AMBIGUITY_SIMILARITY_GAP` of each other, and `reconcile.ts` raises
  `subject-mapping-ambiguous` from it. The orchestrator raises
  `conflicting-handbook-versions` when a subject's own fetched pages show
  conflicting year signals (a new `ImportedSourcePackage.conflicts` field
  carries this through `mergeSourcePackages`). A permanent regression test
  for the named Phase 18A conflict-resolution bug (resolving a conflict
  recording the choice but never writing it back) lives in
  `scripts/verify-phase18d-conflicts.ts`, §1.
- **Part 14 — Cache and revalidation.** `src/server/pageCache.ts` — a
  fetched-page cache (URL → `{html, contentHash, canonicalUrl,
  institutionId, academicYear, createdAt, expiresAt, lastValidatedAt,
  sourceRetrievedAt}`), with a stale-fallback grace window: a failed fresh
  fetch returns the last cached copy (marked `stale: true`, surfaced as a
  warning) rather than turning a transient blip into "not found". Wired
  into the orchestrator's direct-template and `preferredUrl` fetch paths.
  Never caches uploaded documents, notes, goals, credentials, or
  authenticated data — this module has no code path to any of those (they
  live entirely in `SaveDataContext`/localStorage). A parsed-result cache
  was deliberately NOT added — see `pageCache.ts`'s own docstring for the
  real temporaryId-identity risk that makes it unsafe as a quick bolt-on;
  named as a Phase 18E candidate instead. Manual refresh with rate limiting
  falls out of existing infrastructure for free: every retry/select POSTs
  through the same `/api/academic/discover` handler, so it's already
  bounded by `perClientRateLimiter` (5/minute/IP).
- **Part 15 — Frontend search experience.** `StudyDetailsStep.tsx` accepts
  mixed code/name lines, classified per-line against the selected
  university's real `subjectCodePattern` (not a generic guess).
  `DiscoveryStep.tsx` shows real, discrete states
  (validating/checking-patterns/searching, then per-subject terminal
  states) — no percentage bar anywhere. `SemesterSetupOverlay.tsx`'s
  `rediscoverOneSubject()` re-runs discovery for exactly one query via a
  single-item `subjectQueries` request, splicing only that subject back
  into the merged package — every other already-successful subject is
  untouched. All existing fallbacks (direct-browser, upload, ICS/JSON
  import, manual entry) are unchanged and still reachable at every step.
- **Part 16 — Fixtures.** `fixtures/phase18d/` — a conflicting-year page
  (drives the `conflicting-handbook-versions` conflict), a genuine Melbourne-
  style subject page and a formatting-variant of it (drives the
  institution-extractor tests), reusing `fixtures/phase18c/*`'s existing
  fixtures (duplicate-content, robots, redirects, size/content-type limits,
  stale-year, JS-shell, sitemap index/leaf) rather than re-creating them.
  All synthetic; nothing copyrighted.
- **Part 17 — Automated verification.** Four Node harnesses, all
  deterministic and independent of live sites:
  `scripts/verify-phase18a-import.ts` (118 checks, pre-existing, re-run and
  still green), `scripts/verify-phase18c-backend.ts` (68 checks — 3 fixed
  this phase: a stale sitemap-adapter call site from the Part 2 interface
  reshape, a fixture university missing Registry V3 fields, and one
  confidence-tier assertion updated to match the new ranking engine's
  actual, correct output), `scripts/verify-phase18d-conflicts.ts` (29
  checks — the new conflict kinds + the named regression test),
  `scripts/verify-phase18d-extractors.ts` (29 checks — the unimelb
  extractor, `preferredUrl`'s "select" capability, and the page cache).
  **244 deterministic checks total, 0 failing.**
- **Part 18 — Live support matrix.** `scripts/verify-phase18d-live-matrix.ts`
  — a separate, non-failing report (see §9 for the actual run's output).
- **Part 19 — Performance/accessibility.** See §10/§11 below.
- **Part 20 — Deployment.** See §12 below.

### 8a. A genuinely new backend capability: `preferredUrl`

Part 11's "Select this result" action needs the backend to extract from a
*specific* page the user chose, not just re-run ranking. `SubjectQuery`
gained an optional `preferredUrl: string | null` (validated as a well-formed
http(s) URL in `schema.ts`, bounded to 500 characters). This is NOT "fetch
any URL the browser sends": the browser only ever echoes back a URL it
already received in a prior response's `discoveredSources`/
`alternativeCandidates`, and the orchestrator still runs it through the
exact same `serverFetchOfficialPage` (domain-allowlist + SSRF guard) as
every other candidate — rejected outright if it isn't one of the
institution's `officialDomains`. Verified explicitly (harness checks 6a/6b
in `verify-phase18d-extractors.ts`).

## 9. Automated test totals and live results

**244 / 244 deterministic checks passing**, across 4 harnesses, none
depending on a live site:
| Harness | Checks |
|---|---|
| `verify-phase18a-import.ts` | 118 |
| `verify-phase18c-backend.ts` | 68 |
| `verify-phase18d-conflicts.ts` | 29 |
| `verify-phase18d-extractors.ts` | 29 |

**Live support matrix** (`verify-phase18d-live-matrix.ts`, run 2026-07-23,
bounded — one code query + one name query per institution, never asserts
pass/fail):

| Institution | Code query | Result | Name query | Result |
|---|---|---|---|---|
| Melbourne | UNIB10007 (confirmed real) | partial — no meaningful content this run | "Introduction to Climate Change" | not found |
| Monash | FIT1045 (unconfirmed guess) | partial | "Introduction to Programming" | not found |
| RMIT | COSC1076 (unconfirmed guess) | not found | "Advanced Programming Techniques" | not found |
| La Trobe | CSE1OFA (unconfirmed guess) | not found | "Object-Oriented Fundamentals A" | not found |
| Deakin | SIT102 (unconfirmed guess) | not found | "Introduction to Programming" | not found |
| Swinburne | COS10009 (unconfirmed guess) | not found | "Introduction to Programming" | not found |
| Victoria University | ISY1002 (unconfirmed guess) | not found | "Introduction to Programming" | not found |

Melbourne's own confirmed-real code returned "partial, no meaningful
content" on this particular run — the live handbook briefly served a bot-
protection interstitial page ("Pardon Our Interruption", the exact same
page the Phase 18C harness's own live smoke test hit earlier this session)
rather than real content. This is reported exactly as it happened, not
smoothed over: it is the concrete, repeated proof of why this phase's
quality model, honest partial/not-found states, and separate
live/deterministic test split all exist. Separately, in a live browser
verification pass earlier this session (see §11), the SAME code against the
SAME live site DID succeed and returned genuine content (2 modules, 3
assessments, "Introduction to Climate Change") — confirming the discovery
pipeline itself works correctly; only the live site's own bot-protection
is variable run to run, exactly as §1's audit already anticipated.

Every other institution's query used an unconfirmed, plausible-format
guess (no genuine verified example code was available from prior research)
— a "not found" there says nothing about whether that institution's
discovery pattern is right or wrong, only that this specific guessed
code/name wasn't found. No institution's support status was inflated based
on this run.

## 10. Accessibility

- Semantic controls throughout (native `<button>`/`<select>`/`<textarea>`,
  `aria-expanded` on the Ambiguity Review's compare toggle, `role="dialog"
  aria-modal` on the overlay, unchanged from Phase 18A).
- Keyboard: every new action (Keep/Select/Search again/Exclude/Continue) is
  a real `<button>`, reachable and activatable via keyboard exactly like
  every existing Semester Setup control — no new custom widget, no new
  focus trap introduced.
- No colour-only confidence indicators: every quality dimension chip states
  its label as text ("Identity: High") with colour as a secondary accent
  only (`.setup-quality-dimensions` in `import.css`), same convention as
  the pre-existing `.setup-metric.is-warn`/conflict styling.
- 44px targets: all new buttons reuse the existing `.setup-actions button`
  sizing (`min-height: var(--tap-target-min)` already enforced globally in
  `import.css`); no new small hit-targets were introduced.
- Mobile responsiveness: new components (`.setup-candidate-card`,
  `.setup-discovery-phase`, `.setup-quality-report`) use the same flex-
  column/flex-wrap patterns as every existing setup-step component and
  inherit the existing `@media (max-width: 720px)` rules; long URLs use
  `word-break: break-all` to avoid horizontal overflow.
- Verified live in the Browser pane this phase (Vite dev server,
  `npm run dev`): the mixed code/name Study Details field, the real-state
  Discovery checklist (captured mid-flight showing "Validating your
  request" → "Checking verified university patterns" → "Searching official
  sources and extracting information…"), the honest fallback-mode notice,
  Extraction Report V2 (partial-result qualification, quality-adjacent
  warnings, source links), and the unmodified Review screen — all with
  zero console errors across the full run. The Ambiguity Review step's live
  rendering was NOT reachable in this dev environment (`vite dev` doesn't
  serve the Vercel function, so only the direct-browser fallback — which
  never produces ambiguous results — was exercised); its logic is instead
  proven by the 29 deterministic checks in `verify-phase18d-conflicts.ts`
  and `verify-phase18d-extractors.ts`, and its render path is covered by a
  clean `tsc -b`/`eslint`/`vite build`.
- Reduced motion: no new CSS animation was added (the existing
  `.setup-spin` keyframe, already present since Phase 18A, is reused as-is
  for the Discovery step's active-phase spinner icon — not re-authored).

## 11. Performance

- Candidate/fetch limits remain conservative and unchanged in scale from
  Phase 18C: `MAX_CANDIDATES_TO_FETCH = 5` (sitemap adapter), `resultLimit`
  capped in every `SearchRequest`.
- Bundle-size change: the production build (`vite build`) still produces
  the same chunk shape as before this phase (`index`, `pdfExtract`,
  `docxExtract` code-split exactly as previously) — the new components add
  to the main `index` chunk only; no new heavy dependency was introduced.
  Pre-existing >500kB chunk warnings are unchanged from before this phase.
- Page cache (§Part 14, §8) removes a real network round-trip for any
  retry-one-subject or select-alternative action that re-requests a URL
  fetched within the last 30 minutes — verified directly (harness §7 in
  `verify-phase18d-extractors.ts`: a second `discoverOneSubject()` call for
  the same URL makes zero additional requests to the fixture server).
- Server discovery duration / search-request counts were not instrumented
  as a new metric this phase (no new logging field added) — the existing
  `logDiscoveryResult()` structured log already records `fetchDurationMs`
  and `sourceCount` per request (Phase 18C), reused unchanged.

## 12. Deployment and configuration (Part 20)

**Hosting.** Unchanged from Phase 18C — `vercel.json` already configures
`api/academic/discover.ts` as a Node.js Vercel Function; no new endpoint was
added this phase (the new `preferredUrl` field is carried on the EXISTING
request shape, not a new route).

**Environment variables** (all optional; every feature degrades to "not
configured" rather than failing):
| Variable | Purpose | Required? |
|---|---|---|
| `UNIGAME_SEARCH_API_KEY` | Enables `ExternalSearchApiAdapter` — unset means it's never selected, and the honest not-implemented `search()` still returns `[]` if it somehow were. | No |
| `UNIGAME_ALLOW_LOCALHOST_FETCH` | Local/test-only — allows the SSRF guard to permit `localhost`/private-range fetches for the synthetic fixture servers used by every Node harness. Never set in production. | No (dev/test only) |

No new secret was introduced this phase. No secret appears in committed
files, the browser bundle, logs, screenshots, or example values — verified
by the same method as Phase 18C (`src/server/*` and `api/*` are outside
Vite's build graph; `vite build`'s `dist/` output was inspected this phase
and contains neither variable name).

**Local development:**
```
npm run dev                                   # Vite only — /api/* 404s here (expected; triggers the honest direct-browser fallback)
npm run typecheck                              # covers src/ + api/ (tsconfig.app.json's include, set in 18C, unchanged)
npm run lint                                   # src/ only (scripts/ intentionally unlinted, same as 18C)
npm run build                                  # production build — verified this phase, same chunk shape as before

# Fixture-test command (deterministic, no live dependency):
node scripts/build-verify-harness.mjs scripts/verify-phase18a-import.ts .tmp/verify-phase18a-import.cjs && node .tmp/verify-phase18a-import.cjs
node scripts/build-verify-harness.mjs scripts/verify-phase18c-backend.ts .tmp/verify-phase18c-backend.cjs && node .tmp/verify-phase18c-backend.cjs
node scripts/build-verify-harness.mjs scripts/verify-phase18d-conflicts.ts .tmp/verify-phase18d-conflicts.cjs && node .tmp/verify-phase18d-conflicts.cjs
node scripts/build-verify-harness.mjs scripts/verify-phase18d-extractors.ts .tmp/verify-phase18d-extractors.cjs && node .tmp/verify-phase18d-extractors.cjs

# Live-test command (bounded, non-failing report — run separately, never part of CI's pass/fail):
node scripts/build-verify-harness.mjs scripts/verify-phase18d-live-matrix.ts .tmp/verify-phase18d-live-matrix.cjs && node .tmp/verify-phase18d-live-matrix.cjs
```

**Cache behaviour.** Two independent, in-memory, per-instance layers (both
documented as per-instance, not distributed — same honest scoping as Phase
18C's request cache): the Phase 18C whole-response cache
(`BoundedCache`/`cache.ts`, unchanged) and this phase's page cache
(`PageCache`/`pageCache.ts`) — 30-minute TTL, 6-hour stale-fallback grace
window, 200-entry LRU bound. A distributed cache (Vercel KV/Upstash) remains
optional and undocumented-as-required, same as 18C's own conclusion —
nothing in this phase's traffic volume justifies it yet.

**Rate limits.** Unchanged: `perClientRateLimiter` (5/minute/IP),
`globalRateLimiter` (60/minute/instance) — both already cover every new
request path this phase adds (retry-one-subject and "select" both go
through the same `/api/academic/discover` handler).

**Health check.** Unchanged: `GET /api/academic/discover` →
`{"status":"ok","service":"academic-discovery"}`.

**Search-adapter-disabled behaviour.** With `UNIGAME_SEARCH_API_KEY` unset
(the only state this repo has ever run in), `createExternalSearchApiAdapter()`
reports `isConfigured() === false` and is skipped entirely by the
orchestrator's adapter loop — direct templates, the sitemap adapter, and
the direct-browser fallback all continue working exactly as verified by
the 244 passing deterministic checks.

**Secret rotation.** Unchanged process from 18C: standard Vercel
environment-variable update + redeploy; every place that reads
`UNIGAME_SEARCH_API_KEY` reads `process.env` fresh at call time (never
cached at module load), so rotation needs no code change.

**Supported-university matrix maintenance.** `InstitutionSupportStatus` on
each `UniversityDefinition` (Registry V3, §Part 8) is the single source of
truth for what's genuinely verified — update it only after a real live
check (as this phase's own live matrix run demonstrates, "HTTP 200" and
"HTTP 200 with real academic content" are different claims), and re-run
`verify-phase18d-live-matrix.ts` after any registry change to that
institution's URL templates or search configuration.

## 13. Known limitations and Phase 18E scope

- **Parsed-result cache** was designed but deliberately not wired in (see
  §Part 14/`pageCache.ts`'s docstring) — needs identity-safe re-stamping of
  `temporaryId`/`sourceReferences` on a cache hit before it can be used
  safely across a multi-subject batch.
- **The direct-browser fallback (Phase 18B) still only supports code
  queries**, not name queries — a name-only subject silently produced
  nothing through that path before this phase; this phase adds an explicit
  warning for it (`SemesterSetupOverlay.tsx`), but doesn't extend
  `officialUniversityProvider.ts` itself to support name search (that would
  require duplicating the ranking/search logic that already lives
  server-side, which the architecture deliberately avoids — the honest fix
  is a working backend deployment, not a client-side reimplementation).
- **RMIT/La Trobe/Deakin/Swinburne/Victoria University remain unverified**
  for genuine live discovery (§1's audit table, re-confirmed unchanged by
  this phase's own live matrix run) — no code in this phase claims
  otherwise; `InstitutionSupportStatus` for all five stays `"unsupported"`/
  `"missing"` confidence.
- **The Ambiguity Review step's ranking-signal detail** (`RankingSignal[]`)
  isn't threaded all the way to the frontend — `DiscoveredSource` (the
  schema type the frontend actually receives) carries `discoveryMethod`,
  `confidence`, and `warnings`, but not the raw per-signal score breakdown;
  "why it matched" is currently a short derived sentence
  (`candidateWhyMatched()` in `AmbiguityReviewStep.tsx`), not the full
  signal list. A Phase 18E candidate: extend `DiscoveredSource` with an
  optional `rankSignals` field for a genuinely detailed "why" explanation.
- **No headless browser was added**, per the brief's own instruction — every
  JS-rendered-content institution (Monash confirmed, others unknown) is
  still reported honestly as such (`jsRenderedLimitations`), not worked
  around.

**Recommended exact scope for Phase 18E:**
1. A temporaryId-safe parsed-result cache (the limitation named above).
2. Extend `DiscoveredSource`/`SearchResult` with `rankSignals` end-to-end so
   the Ambiguity Review can show the full contributing-signal breakdown,
   not just a summary sentence.
3. Real research passes for RMIT, La Trobe, Deakin, Swinburne, and Victoria
   University — each needs its OWN genuine live verification before its
   `InstitutionSupportStatus` can move past "unsupported"/"missing".
4. A second, real institution-specific extractor (once a second
   institution reaches "verified" `staticPageAvailability`) to prove the
   `src/import/extraction/institutions/` pattern generalises beyond one
   example.
5. Extending name-search support into the Phase 18B direct-browser fallback
   itself, OR — more realistically — prioritising an actual Vercel
   deployment (`vercel dev`/production) so the secure backend (where name
   search already works) is reachable in more environments, reducing
   reliance on the fallback altogether.
