/**
 * Step 2b — Extraction Report V2 (Phase 18B, Parts 5+6; upgraded Phase 18D,
 * Part 12). For every searched subject, shows the requested query, the
 * selected official result, any alternative candidates, exactly which
 * fields were discovered vs. missing, academic-year/teaching-period status,
 * the multi-dimensional quality report, warnings/conflicts, source pages
 * with retrieval dates, discovery method, and cache status — then offers
 * real next actions per subject, never describing a partial result as a
 * plain success.
 *
 * `queryResults` is populated only when the secure backend (Phase 18C/18D)
 * answered the request; the direct-browser fallback (Phase 18B) doesn't
 * produce this per-subject metadata, so this step degrades honestly to a
 * simpler per-subject summary in that case — never fabricating a quality
 * report it doesn't have.
 */

import { ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
import type { AcademicImportPackage, ImportedSubjectCandidate } from "../../../../import/types";
import type { CacheStatus, QueryResult, SubjectQuery } from "../../../../server/schema";
import type { DimensionLabel } from "../../../../server/qualityScore";
import { queryKey } from "./AmbiguityReviewStep";

function uniqueSources(subject: ImportedSubjectCandidate): string[] {
  const urls = new Set<string>();
  const add = (loc: string | null) => {
    if (loc) urls.add(loc);
  };
  for (const ref of subject.sourceReferences) add(ref.location);
  for (const module of subject.modules) for (const ref of module.sourceReferences) add(ref.location);
  for (const assessment of subject.assessments) for (const ref of assessment.sourceReferences) add(ref.location);
  return [...urls];
}

function missingList(subject: ImportedSubjectCandidate): string[] {
  const missing: string[] = [];
  if (!subject.code) missing.push("subject code");
  if (subject.modules.length === 0) missing.push("weekly modules");
  if (subject.assessments.length === 0) missing.push("assessments");
  if (subject.readings.length === 0) missing.push("readings");
  return missing;
}

function dimensionClass(label: DimensionLabel): string {
  switch (label) {
    case "High":
      return "is-high";
    case "Medium":
      return "is-medium";
    case "Partial":
      return "is-partial";
    case "Low":
      return "is-low";
    case "Missing":
      return "is-missing";
  }
}

function cacheStatusLabel(status: CacheStatus): string {
  switch (status) {
    case "hit":
      return "Served from cache";
    case "revalidated":
      return "Cache revalidated";
    case "live":
      return "Freshly retrieved";
    case "stale-fallback":
      return "Stale cached fallback (couldn't re-verify)";
  }
}

function matchingQueryResult(subject: ImportedSubjectCandidate, queryResults: QueryResult[]): QueryResult | null {
  return (
    queryResults.find(
      (q) =>
        (q.query.code && subject.code && q.query.code.toUpperCase() === subject.code.toUpperCase()) ||
        (q.query.name && subject.name && q.query.name.toLowerCase() === subject.name.toLowerCase())
    ) ?? null
  );
}

export function DiscoveryPreviewStep({
  pkg,
  queryResults,
  cacheStatus,
  retryingKey,
  onUploadMissing,
  onContinueToReview,
  onRetrySubject,
  onCancel,
}: {
  pkg: AcademicImportPackage;
  queryResults: QueryResult[];
  cacheStatus: CacheStatus | null;
  /** queryKey()-style label ("code|name") of a subject currently mid-refresh, or null. */
  retryingKey: string | null;
  onUploadMissing: () => void;
  onContinueToReview: () => void;
  onRetrySubject: (query: SubjectQuery) => void;
  onCancel: () => void;
}) {
  const found = pkg.subjects.filter((s) => s.confidence !== "missing").length;
  const total = pkg.subjects.length;
  const anyPartial = queryResults.some((q) => q.status === "partial") || pkg.subjects.some((s) => missingList(s).length > 0 && s.confidence !== "missing");

  return (
    <div className="setup-step" data-testid="discovery-preview-step">
      <p className="setup-lede">
        Found {found} of {total} subject{total === 1 ? "" : "s"}
        {anyPartial ? " — some results are partial and need a closer look" : ""}. Review what UniGame
        discovered below — nothing is added to your semester until you confirm it in Review.
      </p>

      {cacheStatus ? <p className="setup-hint">{cacheStatusLabel(cacheStatus)}</p> : null}

      {pkg.subjects.map((subject) => {
        const sources = uniqueSources(subject);
        const missing = missingList(subject);
        const isFound = subject.confidence !== "missing";
        const queryResult = matchingQueryResult(subject, queryResults);
        const quality = queryResult?.quality ?? null;
        const topSource = queryResult?.discoveredSources[0] ?? null;

        return (
          <section key={subject.temporaryId} className={`setup-subject-card${isFound ? "" : " is-excluded"}`} data-testid="discovery-subject-card">
            <header>
              <strong>{subject.name}</strong>
              {subject.code ? <span className="setup-subject-code">{subject.code}</span> : null}
            </header>

            {isFound ? (
              <p className="setup-item-meta">
                {subject.modules.length} modules · {subject.assessments.length} assessments · {subject.readings.length} readings
              </p>
            ) : (
              <p className="setup-hint">
                <AlertTriangle size={13} aria-hidden="true" /> Nothing found automatically for this subject — upload its subject
                guide instead.
              </p>
            )}

            {missing.length > 0 && isFound ? (
              <p className="setup-hint">
                <AlertTriangle size={13} aria-hidden="true" /> Missing (not a fabricated success): {missing.join(", ")}
              </p>
            ) : null}

            {topSource ? (
              <p className="setup-item-meta">
                Discovery method: {topSource.discoveryMethod} · Retrieved {new Date(topSource.fetchedAt).toLocaleString()}
              </p>
            ) : null}

            {quality ? (
              <div className="setup-quality-report" data-testid="quality-report">
                <p className="setup-quality-overall">
                  Overall: <strong>{quality.overall}</strong>
                </p>
                <ul className="setup-quality-dimensions">
                  <li className={dimensionClass(quality.dimensions.identity)}>Identity: {quality.dimensions.identity}</li>
                  <li className={dimensionClass(quality.dimensions.academicYear)}>Academic year: {quality.dimensions.academicYear}</li>
                  <li className={dimensionClass(quality.dimensions.teachingPeriod)}>Teaching period: {quality.dimensions.teachingPeriod}</li>
                  <li className={dimensionClass(quality.dimensions.assessments)}>Assessments: {quality.dimensions.assessments}</li>
                  <li className={dimensionClass(quality.dimensions.modules)}>Modules: {quality.dimensions.modules}</li>
                </ul>
                <p className="setup-item-meta">
                  {quality.dimensions.sourceAuthority} · {quality.dimensions.sourceFreshness}
                </p>
                <ul className="setup-warning-list">
                  {quality.explanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sources.length > 0 ? (
              <ul className="setup-source-links">
                {sources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} aria-hidden="true" /> {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {queryResult && (queryResult.status === "partial" || queryResult.status === "not-found" || queryResult.status === "error") ? (
              <div className="setup-actions">
                <button
                  type="button"
                  onClick={() => onRetrySubject(queryResult.query)}
                  disabled={retryingKey === queryKey(queryResult.query)}
                >
                  <RefreshCw size={13} aria-hidden="true" /> {retryingKey === queryKey(queryResult.query) ? "Searching again…" : "Refresh search"}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}

      {pkg.warnings.length > 0 ? (
        <section>
          <h3>Search notes</h3>
          <ul className="setup-warning-list">
            {pkg.warnings.map((w) => (
              <li key={w.id}>
                <AlertTriangle size={13} aria-hidden="true" /> {w.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={onContinueToReview}>
          Continue to Review
        </button>
        <button type="button" onClick={onUploadMissing}>
          Upload missing subject guides
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
