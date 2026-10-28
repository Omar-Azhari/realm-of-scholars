# Phase 18B — Official University Discovery

Extends Phase 18A's import foundation with automatic discovery of publicly
available academic information from official university websites, feeding
into the same `AcademicImportPackage` and Review/Apply workflow — no new
storage, no new merge engine, no duplicated provider logic.

## 1. Research: what's actually reachable

Before writing the registry, five universities' public handbook systems were
inspected directly (via live fetches, not guesswork) to ground every URL
pattern in reality rather than invention:

| University | Finding |
|---|---|
| **University of Melbourne** | `https://handbook.unimelb.edu.au/subjects/{code}` and `.../assessment` are real, static-HTML, unauthenticated pages. The assessment page lists tasks as prose ("Essay worth 50% ... Due Week 10"), not "Assessment N:" headings. |
| **Monash University** | `https://handbook.monash.edu/current/units/{code}` is a real, resolving URL — but the page is client-rendered; a plain HTTP fetch only ever sees the app shell (title/code visible, description/assessment content is not). |
| **RMIT University** | No simple code-in-path URL exists. Current course guides sit behind a search/curriculum-catalogue interface. A guessed `/course/{code}` path returned HTTP 404. |
| **La Trobe University** | `handbook.latrobe.edu.au` is reachable via plain fetch (confirmed during harness verification), but a guessed `/subjects/{code}` path returned HTTP 404 for the tested code — the real path scheme is not yet known. |
| **Deakin University** | The unit-search endpoint returned HTTP 403 Forbidden to an automated fetch. No working direct URL pattern is known. |

Swinburne and Victoria University were not researched this phase — they're
listed in the registry (so Study Details can record the institution) with no
URL templates attempted.

This spread — one fully working source, one partially working, three with no
verified direct link — is exactly what Part 8 of the brief asks to be
demonstrated, and it reflects the real state of these websites rather than a
simulation.

## 2. Architecture

```
StudyDetailsStep (university + subject codes, optional)
        │
        ▼
officialUniversityProvider.ts  ──uses──▶ universityRegistry.ts (pure data)
        │                                        │
        │ (per subject: handbook → subject       │ officialDomains, URL
        │  guide → timetable → assessment →      │ templates, code format,
        │  calendar, each via safeFetch.ts)       │ terminology — no logic
        ▼
   htmlToPlainText()  ──▶  parseSyllabusText()  (the EXACT Phase 18A engine)
        │
        ▼
ImportedSourcePackage  ──▶  mergeSourcePackages()  (the EXACT Phase 18A engine)
        │
        ▼
AcademicImportPackage  ──▶  DiscoveryPreviewStep (Found N / extraction report)
        │
        ├── "Upload missing subject guides" ──▶ SourcesStep (existing, unchanged)
        │
        ▼
finalizeAndGoToReview()  ──▶  reconcileWithLiveSemester()  (existing, unmodified)
        │
        ▼
ReviewStep → ApplyStep → DoneStep   (existing, 100% unmodified)
```

Nothing downstream of "produce an `AcademicImportPackage`" changed. The new
code is entirely upstream: one new provider, one new registry, one new HTML
text-stripper, one new fetch-safety module, and three new UI steps (subject
entry folded into Study Details, a searching-progress step, and a
found/preview step) that all funnel into the same `pkg`/`selection` state the
existing Review/Apply/Done steps already consume.

## 3. Provider contract (Part 1)

`officialUniversityProvider.ts` implements the standard `AcademicProvider`
interface (`requiresNoFile: true`, matching `ManualCompletionProvider`'s
precedent). It contains **zero** per-university branching — every fact it
needs (which domains it may fetch from, which URL to build, what a valid
subject code looks like) comes from `universityRegistry.ts`. Its only
"scraping logic" is the generic HTML→text conversion and a call into the
already-existing `parseSyllabusText()` — the identical function PDF/DOCX/
text providers use.

Rejected sources, structurally: the provider can only ever construct a URL
from a registry template and can only ever fetch a hostname listed in that
university's `officialDomains` (checked both before the request and again
after following any redirect). There is no code path that accepts or fetches
a URL derived from page content, so mirrors, forums, cached copies, and wiki
pages are excluded by construction, not by a denylist that could go stale.
AI-generated pages are excluded the same way — nothing in the registry
points at one.

## 4. University Registry (Part 2)

`src/import/universityRegistry.ts` — 7 entries (La Trobe, Monash, Melbourne,
RMIT, Deakin, Swinburne, Victoria University), each with: `officialDomains`,
`handbookUrlTemplate` / `subjectGuideUrlTemplate` / `timetableUrlTemplate` /
`assessmentUrlTemplate` / `calendarUrlTemplate` (all `{code}`-templated
strings, `null` where unverified), `unitTerm` (local terminology), `subjectCodePattern`
(a regex, used only to sanity-check an entered code — never to invent one),
`teachingPeriodNames`, and an honest `verified` + `verificationNote` pair
documenting exactly what was checked and when.

## 5. Discovery pipeline (Part 3)

Per subject code, in the specified order — handbook, subject guide,
timetable, assessment, calendar — `discoverOneSubject()` skips any `null`
template (never guesses one) and, for every real template, calls
`safeFetchOfficialPage()` once. Every page that succeeds gets joined into one
text blob (the same "join pages, track boundaries via `locate()`" pattern
`pdfProvider.ts` already uses for page numbers, just with real URLs standing
in for page numbers) and parsed once through `parseSyllabusText()`.

Combining a discovery run with an existing package (e.g. the user then
uploads a missing subject's guide) reuses `mergeSourcePackages()` directly —
the existing package's subjects/calendar events/warnings are passed back
through the same merge function as one more "source", so cross-source
conflict detection (a discovered date disagreeing with an uploaded one)
works for free, and reconciliation against the live semester happens exactly
once, at a single funnel point (`finalizeAndGoToReview`) regardless of which
combination of discovery and uploads the user actually used.

## 6. Extraction (Part 4)

All Phase 18A rules apply unchanged (never infer a year/time, never resolve
"Week N" to a date, never invent a reading). One new, small, shared rule was
added — `proseAssessmentRules.ts` — because the one real, verified handbook
source (Melbourne) describes assessments as plain sentences ("Essay worth
50% ... Due Week 10") rather than under an "Assessment N:" heading. It's a
second *finder*, not a second extraction pipeline: it returns the exact same
`AssessmentMention` shape `assessmentRules.ts` does, reuses the same
`findWeighting`/`extractDateMentions`/`findSubmissionMethod` helpers, and
only ever runs when the heading-based pass finds nothing — an uploaded
syllabus with real "Assessment N:" headings is unaffected.

Every discovered field carries a `SourceReference` whose `location` is the
real page URL that produced it (shown as a clickable link in the Discovery
preview and, later, in Review).

## 7. Safety (Part 7)

`src/import/discovery/safeFetch.ts` is the single choke point for every
network call this feature makes:
1. **Domain allowlist** — the target hostname must be in the university's
   `officialDomains`, checked again after any redirect.
2. **robots.txt** — fetched once per origin (cached per run), parsed for a
   `UniGame-Import`-specific or wildcard `Disallow` group; a disallowed path
   is refused. A missing/unreadable robots.txt is treated as "nothing
   disallowed" (standard crawler convention), never as "block everything".
3. **Single attempt, bounded time** — one `fetch()` per page with an
   `AbortSignal` timeout (default 8s); there is no retry loop anywhere in
   this feature.
4. **Graceful failure** — every failure mode (CORS block in-browser, network
   error, timeout, HTTP error, robots disallow, redirect off-domain) produces
   an honest `ImportWarning` and an empty/partial subject candidate, never a
   thrown, uncaught error and never fabricated content.

No authenticated LMS page is ever addressed — every registry domain is a
university's own public handbook host, and the provider never accepts
credentials or session state of any kind.

## 8. Known limitations

- **Browser CORS.** These fetches happen from the user's own browser at
  runtime. Universities that don't send permissive CORS headers for
  arbitrary origins will fail there even though the exact same request
  succeeds from this project's Node-based verification harness (Node has no
  CORS enforcement). This was tested directly: the harness's live fetch to
  Melbourne succeeded, and the SAME code path was then re-verified inside
  the actual running browser app and also succeeded — Melbourne's handbook
  host happens to allow it. RMIT/La Trobe/Deakin/Monash were not confirmed to
  allow cross-origin browser fetches at all; for those, "Upload missing
  subject guides" is the realistic primary path today, which is exactly why
  Part 5's flow includes it as a first-class step rather than an
  afterthought.
- **JS-rendered handbook sites** (Monash confirmed; RMIT/Deakin/La Trobe
  unconfirmed either way) will typically yield only a subject's code/title
  from a plain-HTML fetch, not its description or assessments.
- **Guessed, unverified URL templates** (Monash's is real-but-partial;
  La Trobe's guessed template 404'd for the one code tested; RMIT and Deakin
  have no template at all) may need correction once a real, reachable
  pattern is found — the registry's `verified`/`verificationNote` fields
  exist specifically to make this state visible rather than silently wrong.
- **No live search.** A subject is only ever discoverable if the user
  already knows and enters its code — there's no "search by subject name"
  fallback yet (a natural Phase 18C candidate once a real search API or
  university-specific search endpoint is wired up, with its own API-key/
  backend considerations).
- `ConflictKind`'s `"semester-date-mismatch"`/`"subject-mapping-ambiguous"`
  remain unimplemented, unchanged from Phase 18A's noted limitation.

## 9. Proposed Phase 18C scope

- Real search-by-name fallback for universities without a predictable
  code→URL pattern (RMIT, Deakin, Swinburne, VU), and correcting/re-verifying
  the La Trobe and Monash templates.
- Canvas/Moodle/Blackboard/Brightspace (this phase's explicit stop
  condition).
- The Phase 18A AI-extraction adapter, wired up behind a real backend, for
  handbook pages that are JS-rendered and yield nothing from a plain fetch.
