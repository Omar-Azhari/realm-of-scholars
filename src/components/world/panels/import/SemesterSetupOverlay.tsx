/**
 * Semester Setup — the guided academic-import flow (Phase 18A, Part 7;
 * university discovery added Phase 18B, Part 5; Ambiguity Review + Extraction
 * Report V2 + retry-one-subject added Phase 18D, Parts 11/12/15). A full
 * overlay above the world and the panel system (like CompletionCelebration),
 * entered from Menu → "Semester Setup" or shown once on a genuinely empty
 * first launch.
 *
 * Steps: Study details → [Searching university → (Ambiguity review, only
 * when needed) → Import preview] (only when a university + subjects were
 * given) → Import sources → Processing → Review → Apply → Done. The
 * bracketed discovery steps are entirely optional and additive — leaving
 * university unset behaves exactly as Phase 18A did, straight from Study
 * details to Import sources.
 *
 * "Continue manually" and every provider surface stay honest about what's
 * actually available: Canvas/Moodle/Blackboard/Brightspace are visibly
 * labelled "coming later" (see providers/placeholders.ts) rather than
 * presented as equal options.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useSaveData } from "../../../../state/SaveDataContext";
import { useWorldUi } from "../../../../world/WorldUiContext";
import type { AcademicImportPackage, ImportedSourcePackage, ImportProgressEvent, ProviderInput } from "../../../../import/types";
import { computeExtractionSummary } from "../../../../import/types";
import type { ImportSelection } from "../../../../import/applyImport";
import { createEmptySelection } from "../../../../import/applyImport";
import { createProviderRegistry } from "../../../../import/providers/registry";
import { createOfficialUniversityProvider, type UniversityDiscoveryPayload } from "../../../../import/providers/officialUniversityProvider";
import { findUniversity, type UniversityDefinition } from "../../../../import/universityRegistry";
import { callDiscoveryBackend } from "../../../../import/backendDiscoveryClient";
import type { CacheStatus, DiscoverRequest, QueryResult, SubjectQuery } from "../../../../server/schema";
import { runImport } from "../../../../import/importManager";
import { mergeSourcePackages, type ImportPackageMeta } from "../../../../import/merge/mergeEngine";
import { reconcileWithLiveSemester } from "../../../../import/merge/reconcile";
import { suggestSubjectMapping } from "../../../../import/merge/subjectMapping";
import { saveImportDraft, clearImportDraft, loadImportDraft } from "../../../../import/draftStorage";
import { StudyDetailsStep, type StudyDetails } from "./StudyDetailsStep";
import { SourcesStep, type StagedFile } from "./SourcesStep";
import { ProcessingStep } from "./ProcessingStep";
import { DiscoveryStep, type DiscoveryPhase } from "./DiscoveryStep";
import { AmbiguityReviewStep, queryKey, type AmbiguityResolutionKind } from "./AmbiguityReviewStep";
import { DiscoveryPreviewStep } from "./DiscoveryPreviewStep";
import { CanvasConnectStep } from "./CanvasConnectStep";
import { CanvasCourseSelectStep } from "./CanvasCourseSelectStep";
import { CanvasImportingStep } from "./CanvasImportingStep";
import { CanvasExtractionReportStep } from "./CanvasExtractionReportStep";
import { MoodleConnectStep } from "./MoodleConnectStep";
import { MoodleExtractionReportStep } from "./MoodleExtractionReportStep";
import { ReviewStep } from "./ReviewStep";
import { ApplyStep } from "./ApplyStep";
import { DoneStep } from "./DoneStep";
import { beginCanvasConnect, callCanvasImportPreview } from "../../../../import/canvasBackendClient";
import type { CanvasCourseImportResult } from "../../../../server/lms/canvas/canvasImportOrchestrator";
import { callMoodleImportPreview } from "../../../../import/moodleBackendClient";
import type { MoodleCourseImportResult } from "../../../../server/lms/moodle/moodleImportOrchestrator";
import { MOODLE_INSTITUTION_PUBLIC_LIST } from "../../../../import/moodleInstitutionPublicList";

export type SetupStep =
  | "details"
  | "discovery"
  | "discovery-ambiguity"
  | "discovery-preview"
  | "sources"
  | "canvas-connect"
  | "canvas-select-courses"
  | "canvas-importing"
  | "canvas-report"
  | "moodle-connect"
  | "moodle-report"
  | "processing"
  | "review"
  | "apply"
  | "done";

const STEP_LABELS: Record<SetupStep, string> = {
  details: "Study details",
  discovery: "Searching university",
  "discovery-ambiguity": "Confirm results",
  "discovery-preview": "Import preview",
  sources: "Import sources",
  "canvas-connect": "Connect Canvas",
  "canvas-select-courses": "Select Canvas courses",
  "canvas-importing": "Retrieving Canvas data",
  "canvas-report": "Canvas extraction report",
  "moodle-connect": "Connect La Trobe LMS",
  "moodle-report": "Moodle extraction report",
  processing: "Processing",
  review: "Review",
  apply: "Apply",
  done: "Done",
};
const STEP_ORDER: SetupStep[] = [
  "details",
  "discovery",
  "discovery-ambiguity",
  "discovery-preview",
  "sources",
  "canvas-connect",
  "canvas-select-courses",
  "canvas-importing",
  "canvas-report",
  "moodle-connect",
  "moodle-report",
  "processing",
  "review",
  "apply",
  "done",
];

const UNIVERSITY_SOURCE_ID = "university-search";
/** sessionStorage only (never localStorage, never the save-data object) — a full page navigation to Canvas's OAuth screen and back would otherwise lose in-progress Study Details; cleared immediately after being read once on return. */
const CANVAS_RETURN_STATE_KEY = "unigame:canvasReturnState:v1";

function canvasStatusMessage(status: string): string | null {
  switch (status) {
    case "denied":
      return "Canvas authorization was denied.";
    case "state-expired":
      return "That Canvas connection attempt expired — please try again.";
    case "rate-limited":
      return "Canvas is temporarily rate-limiting requests — try again shortly.";
    case "not-configured":
      return "Canvas integration for this institution hasn't been set up yet.";
    case "error":
      return "Couldn't complete the Canvas connection right now.";
    default:
      return null;
  }
}

/** Classifies each line as a subject code (matches the university's own code pattern) or a subject name — mixed code/name queries (Phase 18D, Part 15). */
function parseSubjectQueries(raw: string, university: UniversityDefinition | null): SubjectQuery[] {
  return raw
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const looksLikeCode = university ? university.subjectCodePattern.test(line.toUpperCase()) : /^[A-Z]{2,6}\d{3,5}[A-Z]{0,2}$/i.test(line);
      return looksLikeCode ? { code: line.toUpperCase(), name: null, preferredUrl: null } : { code: null, name: line, preferredUrl: null };
    });
}

function packageAsSourcePackage(pkg: AcademicImportPackage): ImportedSourcePackage {
  return {
    providerId: pkg.provider.join("+") || "combined",
    subjects: pkg.subjects,
    calendarEvents: pkg.calendarEvents,
    warnings: pkg.warnings,
    conflicts: pkg.conflicts,
    announcements: pkg.announcements,
  };
}

function findSubjectForQuery(pkg: AcademicImportPackage, query: SubjectQuery) {
  return (
    pkg.subjects.find(
      (s) =>
        (query.code && s.code && s.code.toUpperCase() === query.code.toUpperCase()) ||
        (query.name && s.name.toLowerCase() === query.name.toLowerCase())
    ) ?? null
  );
}

/** Splices a single re-discovered subject back into an already-merged package — used by retry-one-subject and the Ambiguity Review "select"/"search again" actions, so the OTHER subjects are never re-run or lost. */
function replaceSubjectInPackage(pkg: AcademicImportPackage, oldTemporaryId: string | null, replacement: AcademicImportPackage): AcademicImportPackage {
  const newSubject = replacement.subjects[0] ?? null;
  const subjects = oldTemporaryId
    ? pkg.subjects.filter((s) => s.temporaryId !== oldTemporaryId)
    : pkg.subjects;
  if (newSubject) subjects.push(newSubject);
  // Any conflict that named the replaced candidate no longer applies to a
  // subject that no longer exists in this exact form — dropped rather than
  // left dangling on a stale temporaryId. Conflicts untouched by the
  // replacement (a different subject entirely) are kept as-is.
  const conflicts = oldTemporaryId ? pkg.conflicts.filter((c) => !c.candidateIds.includes(oldTemporaryId)) : pkg.conflicts;
  const warnings = oldTemporaryId ? pkg.warnings.filter((w) => w.sourceId !== oldTemporaryId) : pkg.warnings;
  return {
    ...pkg,
    subjects,
    conflicts,
    warnings: [...warnings, ...replacement.warnings],
    extractionSummary: computeExtractionSummary({ subjects, calendarEvents: pkg.calendarEvents, conflicts }),
  };
}

export function SemesterSetupOverlay() {
  const { closeSemesterSetup } = useWorldUi();
  const { saveData } = useSaveData();

  const [step, setStep] = useState<SetupStep>(() => (loadImportDraft() ? "review" : "details"));
  const [details, setDetails] = useState<StudyDetails>({
    institution: "",
    degree: "",
    major: "",
    academicYear: "",
    semesterName: "",
    campus: "",
    universityId: "",
    subjectCodes: "",
  });
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [pkg, setPkg] = useState<AcademicImportPackage | null>(() => loadImportDraft());
  const [selection, setSelection] = useState<ImportSelection>(() => createEmptySelection());
  const [progress, setProgress] = useState<Record<string, ImportProgressEvent>>({});
  const [discoveryMode, setDiscoveryMode] = useState<"backend" | "direct" | null>(null);
  const [discoveryPhase, setDiscoveryPhase] = useState<DiscoveryPhase>("validating");
  const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [ambiguityResolutions, setAmbiguityResolutions] = useState<Record<string, AmbiguityResolutionKind>>({});
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [canvasInstitutionId, setCanvasInstitutionId] = useState("");
  const [canvasConnectMessage, setCanvasConnectMessage] = useState<string | null>(null);
  const [canvasCourseCount, setCanvasCourseCount] = useState(0);
  const [canvasCourseResults, setCanvasCourseResults] = useState<CanvasCourseImportResult[]>([]);
  const [moodleCourseResults, setMoodleCourseResults] = useState<MoodleCourseImportResult[]>([]);
  // Derived, never separately tracked state (Study Details already knows the
  // university; this just looks up whether ITS LMS is Moodle) — avoids a
  // second source of truth that could desync from `details.universityId`.
  const moodleInstitution = MOODLE_INSTITUTION_PUBLIC_LIST.find((i) => i.institutionId === details.universityId) ?? null;

  const abortRef = useRef<AbortController | null>(null);
  const providersRef = useRef(createProviderRegistry(() => (details.academicYear ? Number(details.academicYear) : null)));

  // Resuming from a Canvas OAuth redirect (Phase 18E, Part 3/14): the whole
  // app reloaded at "/" with a `canvasStatus` query param — restore
  // whatever Study Details state survives that (sessionStorage, never the
  // save-data object) and land on the right Canvas step, once, on mount.
  const canvasResumeRef = useRef(false);
  useEffect(() => {
    if (canvasResumeRef.current || typeof window === "undefined") return;
    canvasResumeRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const canvasStatus = params.get("canvasStatus");
    if (!canvasStatus) return;

    const savedRaw = window.sessionStorage.getItem(CANVAS_RETURN_STATE_KEY);
    window.sessionStorage.removeItem(CANVAS_RETURN_STATE_KEY);
    if (savedRaw) {
      try {
        const saved = JSON.parse(savedRaw) as { details: StudyDetails };
        setDetails(saved.details);
      } catch {
        // Malformed/stale sessionStorage entry — ignored, never crashes the resume.
      }
    }

    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState(null, "", url.toString());

    if (canvasStatus === "connected") {
      const institutionId = params.get("institutionId") ?? "";
      setCanvasInstitutionId(institutionId);
      setStep(institutionId ? "canvas-select-courses" : "canvas-connect");
    } else {
      setCanvasConnectMessage(canvasStatusMessage(canvasStatus));
      setStep("canvas-connect");
    }
  }, []);

  // Resuming a saved draft: compute subject-mapping suggestions without
  // re-running reconciliation (that would duplicate the conflicts already
  // baked into the saved draft — see reconcileWithLiveSemester's docstring).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !pkg || step !== "review") return;
    resumedRef.current = true;
    setSelection((prev) => {
      const nextMapping = { ...prev.subjectMapping };
      for (const subject of pkg.subjects) {
        if (nextMapping[subject.temporaryId] === undefined) {
          const suggestion = suggestSubjectMapping(subject, saveData.semester.subjects);
          nextMapping[subject.temporaryId] =
            suggestion.confidence === "exact-code" || suggestion.confidence === "strong-name" ? suggestion.subjectId : null;
        }
      }
      return { ...prev, subjectMapping: nextMapping };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goto = useCallback((next: SetupStep) => setStep(next), []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    clearImportDraft();
    closeSemesterSetup();
  }, [closeSemesterSetup]);

  const handleSaveDraft = useCallback(() => {
    if (pkg) saveImportDraft(pkg);
    closeSemesterSetup();
  }, [pkg, closeSemesterSetup]);

  const currentMeta = useCallback(
    (): ImportPackageMeta => ({
      institution: details.institution || null,
      degree: details.degree || null,
      major: details.major || null,
      academicYear: details.academicYear || null,
      semesterName: details.semesterName || null,
      campus: details.campus || null,
    }),
    [details]
  );

  // The single funnel every path (discovery-only, upload-only, or both)
  // passes through exactly once before Review — reconciling more than once
  // on the same package would duplicate live-conflicts (see
  // reconcileWithLiveSemester's docstring).
  const finalizeAndGoToReview = useCallback(
    (pkgToFinalize: AcademicImportPackage) => {
      const { pkg: reconciled, subjectMappings } = reconcileWithLiveSemester(pkgToFinalize, saveData.semester);
      setPkg(reconciled);
      saveImportDraft(reconciled);
      setSelection((prev) => {
        const nextMapping = { ...prev.subjectMapping };
        for (const { temporaryId, mapping } of subjectMappings) {
          if (nextMapping[temporaryId] === undefined) {
            nextMapping[temporaryId] =
              mapping.confidence === "exact-code" || mapping.confidence === "strong-name" ? mapping.subjectId : null;
          }
        }
        return { ...prev, subjectMapping: nextMapping };
      });
      setStep("review");
    },
    [saveData.semester]
  );

  const runDiscovery = useCallback(async () => {
    const university = findUniversity(details.universityId);
    setDiscoveryPhase("validating");
    const queries = parseSubjectQueries(details.subjectCodes, university);
    if (!university || queries.length === 0) {
      goto("sources");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({});
    setQueryResults([]);
    setCacheStatus(null);
    setAmbiguityResolutions({});
    setStep("discovery");
    setDiscoveryPhase("checking-patterns");

    let sourcePackage: ImportedSourcePackage | null = null;

    // Try the secure backend first (Phase 18C) — it solves CORS/JS-rendering
    // for real in production. A 4-digit year is required by its schema; if
    // the user hasn't given one, there's nothing valid to send it, so this
    // step is skipped (never sent as a guess) and the direct fallback runs.
    if (/^\d{4}$/.test(details.academicYear)) {
      setDiscoveryMode("backend");
      setDiscoveryPhase("searching");
      const backendRequest: DiscoverRequest = {
        institutionId: university.id,
        subjectQueries: queries,
        degree: details.degree || null,
        major: details.major || null,
        academicYear: details.academicYear,
        teachingPeriod: details.semesterName || null,
        campus: details.campus || null,
        locale: null,
      };
      try {
        const backendResult = await callDiscoveryBackend(backendRequest, controller.signal);
        if (backendResult.available && backendResult.response) {
          sourcePackage = packageAsSourcePackage(backendResult.response.package);
          setQueryResults(backendResult.response.queryResults);
          setCacheStatus(backendResult.response.cacheStatus);
        }
      } catch {
        if (controller.signal.aborted) {
          setStep("details");
          return;
        }
        // Any other error here means "not available" — fall through to direct.
      }
    }

    // Fallback: Phase 18B's direct-browser provider (still works for
    // universities whose server happens to allow cross-origin requests,
    // e.g. Melbourne — confirmed in Phase 18B testing). This path doesn't
    // produce per-subject QueryResult metadata (quality/ambiguity/cache),
    // so queryResults honestly stays empty and the Extraction Report/
    // Ambiguity Review degrade to their package-only view.
    if (!sourcePackage) {
      setDiscoveryMode("direct");
      const codes = queries.map((q) => q.code).filter((c): c is string => !!c);
      const payload: UniversityDiscoveryPayload = {
        universityId: university.id,
        academicYear: details.academicYear || null,
        teachingPeriod: details.semesterName || null,
        subjectCodes: codes,
      };
      const input: ProviderInput = {
        sourceId: UNIVERSITY_SOURCE_ID,
        filename: `${university.name} search`,
        kind: "json",
        bytes: null,
        text: JSON.stringify(payload),
      };
      try {
        sourcePackage = await createOfficialUniversityProvider().extract(input, {
          signal: controller.signal,
          onProgress: (event) => setProgress((prev) => ({ ...prev, [UNIVERSITY_SOURCE_ID]: event })),
        });
      } catch {
        // Cancelled or a genuine provider error either way returns the user to
        // a step they can act from, rather than losing their study details.
        setStep(controller.signal.aborted ? "details" : "sources");
        return;
      }

      // The Phase 18B direct-browser provider only ever searched by code —
      // a name-only query silently produces nothing through this fallback
      // path. Rather than let those subjects vanish from the report with no
      // explanation, add an explicit warning for each one.
      const nameOnlyQueries = queries.filter((q) => !q.code && q.name);
      if (nameOnlyQueries.length > 0) {
        sourcePackage = {
          ...sourcePackage,
          warnings: [
            ...sourcePackage.warnings,
            ...nameOnlyQueries.map((q, i) => ({
              id: `direct-fallback-name-unsupported-${i}`,
              kind: "unmatched-subject" as const,
              message: `"${q.name}" couldn't be searched by name through the direct-browser fallback (only the secure search service supports name search, and it wasn't reachable) — try its subject code, or upload its guide instead.`,
              sourceId: UNIVERSITY_SOURCE_ID,
            })),
          ],
        };
      }
    }

    if (controller.signal.aborted) {
      setStep("details");
      return;
    }

    setDiscoveryPhase("done");
    const merged = mergeSourcePackages(
      pkg ? [packageAsSourcePackage(pkg), sourcePackage] : [sourcePackage],
      pkg?.sourceFiles ?? [],
      currentMeta(),
      new Date().toISOString()
    );
    setPkg(merged);

    setQueryResults((current) => {
      const anyAmbiguous = current.some((q) => q.status === "ambiguous");
      setStep(anyAmbiguous ? "discovery-ambiguity" : "discovery-preview");
      return current;
    });
  }, [details, pkg, currentMeta, goto]);

  /** Re-runs discovery for exactly ONE subject query (retry-one-subject, Part 15; "Search again" on the Ambiguity Review, Part 11) — every other already-successful subject is left completely untouched. `preferredUrl` implements the "Select this result" action: the browser only ever echoes back a URL it already received from a prior response. */
  const rediscoverOneSubject = useCallback(
    async (query: SubjectQuery, preferredUrl: string | null) => {
      const university = findUniversity(details.universityId);
      if (!university || !pkg) return;
      if (!/^\d{4}$/.test(details.academicYear)) return; // same schema requirement as the initial discovery

      const key = queryKey(query);
      setRetryingKey(key);
      const controller = new AbortController();
      abortRef.current = controller;

      const oldSubject = findSubjectForQuery(pkg, query);
      const request: DiscoverRequest = {
        institutionId: university.id,
        subjectQueries: [{ ...query, preferredUrl }],
        degree: details.degree || null,
        major: details.major || null,
        academicYear: details.academicYear,
        teachingPeriod: details.semesterName || null,
        campus: details.campus || null,
        locale: null,
      };
      try {
        const result = await callDiscoveryBackend(request, controller.signal);
        if (result.available && result.response) {
          const nextPkg = replaceSubjectInPackage(pkg, oldSubject?.temporaryId ?? null, result.response.package);
          setPkg(nextPkg);
          setQueryResults((prev) => {
            const next = prev.filter((q) => queryKey(q.query) !== key);
            next.push(...result.response!.queryResults);
            return next;
          });
          setAmbiguityResolutions((prev) => ({ ...prev, [key]: "select" }));
        }
      } catch {
        // Cancelled or unreachable — the subject simply keeps its previous
        // result; nothing is silently cleared.
      } finally {
        setRetryingKey(null);
      }
    },
    [details, pkg]
  );

  const handleKeepAmbiguous = useCallback((query: SubjectQuery) => {
    setAmbiguityResolutions((prev) => ({ ...prev, [queryKey(query)]: "keep" }));
  }, []);

  const handleExcludeAmbiguous = useCallback(
    (query: SubjectQuery) => {
      const key = queryKey(query);
      setAmbiguityResolutions((prev) => ({ ...prev, [key]: "exclude" }));
      setPkg((prev) => {
        if (!prev) return prev;
        const subject = findSubjectForQuery(prev, query);
        if (!subject) return prev;
        const subjects = prev.subjects.filter((s) => s.temporaryId !== subject.temporaryId);
        const conflicts = prev.conflicts.filter((c) => !c.candidateIds.includes(subject.temporaryId));
        return { ...prev, subjects, conflicts, extractionSummary: computeExtractionSummary({ subjects, calendarEvents: prev.calendarEvents, conflicts }) };
      });
    },
    []
  );

  const runProcessing = useCallback(
    async (inputs: ProviderInput[], sourceFiles: AcademicImportPackage["sourceFiles"]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({});
      setStep("processing");

      const { pkg: rawPkg } = await runImport({
        providers: providersRef.current,
        inputs,
        sourceFiles,
        meta: currentMeta(),
        signal: controller.signal,
        onProgress: (event) => {
          if (event.sourceId) setProgress((prev) => ({ ...prev, [event.sourceId as string]: event }));
        },
      });

      if (controller.signal.aborted) {
        setStep("sources");
        return;
      }

      const combined = pkg
        ? mergeSourcePackages(
            [packageAsSourcePackage(pkg), packageAsSourcePackage(rawPkg)],
            [...pkg.sourceFiles, ...sourceFiles],
            currentMeta(),
            new Date().toISOString()
          )
        : rawPkg;

      finalizeAndGoToReview(combined);
    },
    [pkg, currentMeta, finalizeAndGoToReview]
  );

  /** Persists the in-progress Study Details to sessionStorage (never the save-data object, never localStorage) before a REAL page navigation to Canvas's OAuth screen — restored, once, on return (see the mount effect above). */
  const handleBeginCanvasConnect = useCallback(
    (institutionId: string) => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(CANVAS_RETURN_STATE_KEY, JSON.stringify({ details }));
      }
      beginCanvasConnect(institutionId);
    },
    [details]
  );

  const handleCanvasConnected = useCallback((institutionId: string) => {
    setCanvasInstitutionId(institutionId);
    setStep("canvas-select-courses");
  }, []);

  const handleCanvasImport = useCallback(
    async (courseIds: number[], includeAnnouncements: boolean) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setCanvasCourseCount(courseIds.length);
      setStep("canvas-importing");

      const result = await callCanvasImportPreview(canvasInstitutionId, courseIds, includeAnnouncements, controller.signal).catch(() => null);
      if (controller.signal.aborted) {
        setStep("canvas-select-courses");
        return;
      }
      if (!result || !result.available || !result.outcome) {
        setCanvasConnectMessage(result?.error ?? "Canvas is temporarily unavailable.");
        setStep("canvas-select-courses");
        return;
      }

      setCanvasCourseResults(result.outcome.courseResults);
      const merged = mergeSourcePackages(
        pkg ? [packageAsSourcePackage(pkg), result.outcome.sourcePackage] : [result.outcome.sourcePackage],
        pkg?.sourceFiles ?? [],
        currentMeta(),
        new Date().toISOString()
      );
      setPkg(merged);
      setStep("canvas-report");
    },
    [canvasInstitutionId, pkg, currentMeta]
  );

  const handleMoodleImport = useCallback(
    async (courses: Array<{ courseId: number; shortName: string | null; fullName: string | null; viewUrl: string | null }>, includeAnnouncements: boolean) => {
      if (!moodleInstitution) return;
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await callMoodleImportPreview(moodleInstitution.institutionId, courses, includeAnnouncements, controller.signal).catch(() => null);
      if (controller.signal.aborted) {
        setStep("moodle-connect");
        return;
      }
      if (!result || !result.available || !result.outcome) {
        setStep("moodle-connect");
        return;
      }

      setMoodleCourseResults(result.outcome.courseResults);
      const merged = mergeSourcePackages(
        pkg ? [packageAsSourcePackage(pkg), result.outcome.sourcePackage] : [result.outcome.sourcePackage],
        pkg?.sourceFiles ?? [],
        currentMeta(),
        new Date().toISOString()
      );
      setPkg(merged);
      setStep("moodle-report");
    },
    [moodleInstitution, pkg, currentMeta]
  );

  return (
    <div className="setup-overlay" role="dialog" aria-modal="true" aria-label="Semester Setup" data-testid="semester-setup">
      <header className="setup-overlay-head">
        <div className="setup-steps" aria-label="Setup progress">
          {STEP_ORDER.map((s) => (
            <span key={s} className={`setup-step-chip${s === step ? " is-active" : ""}`} data-testid={`setup-step-${s}`}>
              {STEP_LABELS[s]}
            </span>
          ))}
        </div>
        <button type="button" className="setup-overlay-close" onClick={handleCancel} aria-label="Cancel semester setup">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="setup-overlay-body">
        {step === "details" ? (
          <StudyDetailsStep
            details={details}
            onChange={setDetails}
            onContinue={() => void runDiscovery()}
            onSkip={handleCancel}
          />
        ) : null}

        {step === "discovery" ? (
          <DiscoveryStep
            universityName={findUniversity(details.universityId)?.name ?? "your university"}
            phase={discoveryPhase}
            mode={discoveryMode}
            subjectStates={queryResults.map((q) => ({ label: q.query.code ?? q.query.name ?? "subject", status: q.status }))}
            onCancel={() => abortRef.current?.abort()}
          />
        ) : null}

        {step === "discovery-ambiguity" ? (
          <AmbiguityReviewStep
            queryResults={queryResults}
            resolutions={ambiguityResolutions}
            retryingKey={retryingKey}
            onKeep={handleKeepAmbiguous}
            onSelect={(query, url) => void rediscoverOneSubject(query, url)}
            onExclude={handleExcludeAmbiguous}
            onRetry={(query) => void rediscoverOneSubject(query, null)}
            onUploadInstead={() => goto("sources")}
            onEnterManually={() => goto("details")}
            onContinue={() => goto("discovery-preview")}
            onCancel={handleCancel}
          />
        ) : null}

        {step === "discovery-preview" && pkg ? (
          <DiscoveryPreviewStep
            pkg={pkg}
            queryResults={queryResults}
            cacheStatus={cacheStatus}
            retryingKey={retryingKey}
            onUploadMissing={() => goto("sources")}
            onContinueToReview={() => finalizeAndGoToReview(pkg)}
            onRetrySubject={(query) => void rediscoverOneSubject(query, null)}
            onCancel={handleCancel}
          />
        ) : null}

        {step === "sources" ? (
          <SourcesStep
            stagedFiles={stagedFiles}
            onStagedFilesChange={setStagedFiles}
            onProcess={(inputs, sourceFiles) => void runProcessing(inputs, sourceFiles)}
            onContinueManually={() => {
              setPkg((prev) => prev ?? emptyPackage());
              setStep("review");
            }}
            onConnectCanvas={() => {
              setCanvasConnectMessage(null);
              goto("canvas-connect");
            }}
            onConnectMoodle={moodleInstitution ? () => goto("moodle-connect") : undefined}
            onBack={() => goto("details")}
          />
        ) : null}

        {step === "canvas-connect" ? (
          <CanvasConnectStep
            connectMessage={canvasConnectMessage}
            onConnected={handleCanvasConnected}
            onBeginConnect={handleBeginCanvasConnect}
            onSkip={() => goto("sources")}
            onBack={() => goto("sources")}
          />
        ) : null}

        {step === "canvas-select-courses" ? (
          <CanvasCourseSelectStep
            institutionId={canvasInstitutionId}
            onImport={(courseIds, includeAnnouncements) => void handleCanvasImport(courseIds, includeAnnouncements)}
            onCancel={handleCancel}
            onBack={() => goto("canvas-connect")}
          />
        ) : null}

        {step === "canvas-importing" ? <CanvasImportingStep courseCount={canvasCourseCount} onCancel={() => abortRef.current?.abort()} /> : null}

        {step === "canvas-report" ? (
          <CanvasExtractionReportStep
            courseResults={canvasCourseResults}
            onContinueToReview={() => pkg && finalizeAndGoToReview(pkg)}
            onCancel={handleCancel}
          />
        ) : null}

        {step === "moodle-connect" && moodleInstitution ? (
          <MoodleConnectStep
            institutionId={moodleInstitution.institutionId}
            onImport={(courses, includeAnnouncements) => void handleMoodleImport(courses, includeAnnouncements)}
            onUseFallback={() => goto("sources")}
            onBack={() => goto("sources")}
          />
        ) : null}

        {step === "moodle-report" ? (
          <MoodleExtractionReportStep
            courseResults={moodleCourseResults}
            onContinueToReview={() => pkg && finalizeAndGoToReview(pkg)}
            onCancel={handleCancel}
          />
        ) : null}

        {step === "processing" ? (
          <ProcessingStep
            files={stagedFiles.filter((f) => f.status === "ready")}
            progress={progress}
            onCancel={() => abortRef.current?.abort()}
          />
        ) : null}

        {step === "review" && pkg ? (
          <ReviewStep
            pkg={pkg}
            onPkgChange={(next) => {
              setPkg(next);
              saveImportDraft(next);
            }}
            selection={selection}
            onSelectionChange={setSelection}
            liveSubjects={saveData.semester.subjects}
            onAddMoreSources={() => goto("sources")}
            onSaveDraft={handleSaveDraft}
            onCancel={handleCancel}
            onProceedToApply={() => goto("apply")}
          />
        ) : null}

        {step === "apply" && pkg ? (
          <ApplyStep
            pkg={pkg}
            selection={selection}
            onBack={() => goto("review")}
            onApplied={() => {
              clearImportDraft();
              setStep("done");
            }}
          />
        ) : null}

        {step === "done" ? <DoneStep onClose={closeSemesterSetup} /> : null}
      </div>
    </div>
  );
}

function emptyPackage(): AcademicImportPackage {
  return {
    importId: `manual-${Date.now()}`,
    createdAt: new Date().toISOString(),
    provider: [],
    sourceFiles: [],
    institution: null,
    degree: null,
    major: null,
    academicYear: null,
    semesterName: null,
    campus: null,
    subjects: [],
    calendarEvents: [],
    warnings: [],
    conflicts: [],
    extractionSummary: {
      subjectsFound: 0,
      modulesFound: 0,
      assessmentsFound: 0,
      calendarEventsFound: 0,
      confirmedDeadlines: 0,
      uncertainDeadlines: 0,
      conflictsFound: 0,
      missingFieldsCount: 0,
    },
  };
}
