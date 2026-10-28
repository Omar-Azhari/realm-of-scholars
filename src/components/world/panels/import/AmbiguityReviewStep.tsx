/**
 * Ambiguity Review (Phase 18D, Part 11) — shown before the existing Review
 * screen whenever the backend couldn't confidently pick one official page
 * for a subject (`QueryResult.status === "ambiguous"`, i.e. the top two
 * ranked candidates scored within the ranking engine's own ambiguity gap —
 * see `src/server/search/ranking.ts`'s `AMBIGUITY_SCORE_GAP`). Never auto-
 * applies a choice: every ambiguous subject needs an explicit action here
 * before "Continue to Review" is enabled, and whichever candidate ends up
 * selected still flows through the unmodified Review/Apply/Undo pipeline
 * exactly like every other subject.
 */

import { useState } from "react";
import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp, CircleHelp } from "lucide-react";
import type { DiscoveredSource, QueryResult, SubjectQuery } from "../../../../server/schema";

export type AmbiguityResolutionKind = "keep" | "select" | "exclude";

function queryLabel(query: SubjectQuery): string {
  return query.code ?? query.name ?? "this subject";
}

function queryKey(query: SubjectQuery): string {
  return `${query.code ?? ""}|${query.name ?? ""}`;
}

function candidateWhyMatched(source: DiscoveredSource): string {
  const parts: string[] = [];
  if (source.discoveryMethod === "direct-template") parts.push("a verified direct handbook URL");
  else if (source.discoveryMethod === "sitemap") parts.push("found via the university's sitemap");
  else if (source.discoveryMethod === "native-search") parts.push("found via the university's own search");
  else if (source.discoveryMethod === "user-selected") parts.push("the page you selected");
  else parts.push("found via official-domain search");
  parts.push(`${source.confidence} confidence`);
  return parts.join(" — ");
}

function QualityPreview({ quality }: { quality: QueryResult["quality"] }) {
  if (!quality) return null;
  return (
    <p className="setup-hint">
      <CircleHelp size={13} aria-hidden="true" /> Quality preview: <strong>{quality.overall}</strong> — {quality.explanation[0]}
    </p>
  );
}

function CandidateCard({
  source,
  isSelected,
  disabled,
  onSelect,
}: {
  source: DiscoveredSource;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <li className={`setup-candidate-card${isSelected ? " is-selected" : ""}`}>
      <div className="setup-candidate-head">
        <strong>{source.pageTitle ?? "Untitled page"}</strong>
        {isSelected ? <span className="setup-candidate-current-badge">Currently selected</span> : null}
      </div>
      <p className="setup-item-meta">
        {source.sourceType} · {source.officialDomain} · {candidateWhyMatched(source)}
      </p>
      {source.warnings.length > 0 ? (
        <p className="setup-hint">
          <AlertTriangle size={13} aria-hidden="true" /> {source.warnings.join(" ")}
        </p>
      ) : null}
      <a href={source.finalUrl} target="_blank" rel="noreferrer" className="setup-candidate-link">
        <ExternalLink size={12} aria-hidden="true" /> {source.finalUrl}
      </a>
      {!isSelected ? (
        <div className="setup-actions">
          <button type="button" onClick={onSelect} disabled={disabled}>
            Select this result
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function AmbiguityReviewStep({
  queryResults,
  resolutions,
  retryingKey,
  onKeep,
  onSelect,
  onExclude,
  onRetry,
  onUploadInstead,
  onEnterManually,
  onContinue,
  onCancel,
}: {
  queryResults: QueryResult[];
  /** Which ambiguous subjects have already had an explicit action taken this session — keyed by queryKey(). Continuing is only enabled once every ambiguous subject has one. */
  resolutions: Record<string, AmbiguityResolutionKind>;
  /** queryKey() of a subject currently mid re-fetch (select/search-again), or null — disables that one subject's actions without freezing the rest. */
  retryingKey: string | null;
  onKeep: (query: SubjectQuery) => void;
  onSelect: (query: SubjectQuery, url: string) => void;
  onExclude: (query: SubjectQuery) => void;
  onRetry: (query: SubjectQuery) => void;
  onUploadInstead: () => void;
  onEnterManually: () => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ambiguous = queryResults.filter((q) => q.status === "ambiguous");
  const allResolved = ambiguous.every((q) => resolutions[queryKey(q.query)] !== undefined);

  return (
    <div className="setup-step" data-testid="ambiguity-review-step">
      <p className="setup-lede">
        UniGame found more than one similarly-ranked official page for {ambiguous.length} subject
        {ambiguous.length === 1 ? "" : "s"}. Pick which page is right before continuing — nothing is
        applied automatically.
      </p>

      {ambiguous.map((result) => {
        const key = queryKey(result.query);
        const top = result.discoveredSources[0] ?? null;
        const isOpen = expanded[key] ?? false;
        const resolution = resolutions[key];
        const isBusy = retryingKey === key;

        return (
          <section key={key} className="setup-subject-card" data-testid="ambiguity-subject-card">
            <header>
              <strong>{queryLabel(result.query)}</strong>
              {result.query.code ? <span className="setup-subject-code">{result.query.code}</span> : null}
              {resolution ? <span className="setup-conflict-resolved">Resolved</span> : null}
              {isBusy ? <span className="setup-hint">Searching again…</span> : null}
            </header>

            {top ? (
              <>
                <p className="setup-item-meta">
                  {top.pageTitle ?? "Untitled page"} · {top.sourceType} · {top.officialDomain}
                </p>
                <QualityPreview quality={result.quality} />
              </>
            ) : null}

            <button
              type="button"
              className="setup-manual-toggle"
              onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}{" "}
              Compare {result.discoveredSources.length + result.alternativeCandidates.length} candidates
            </button>

            {isOpen ? (
              <ul className="setup-candidate-list">
                {result.discoveredSources.map((source) => (
                  <CandidateCard
                    key={source.finalUrl}
                    source={source}
                    isSelected
                    disabled={isBusy}
                    onSelect={() => onSelect(result.query, source.finalUrl)}
                  />
                ))}
                {result.alternativeCandidates.map((source) => (
                  <CandidateCard
                    key={source.finalUrl}
                    source={source}
                    isSelected={false}
                    disabled={isBusy}
                    onSelect={() => onSelect(result.query, source.finalUrl)}
                  />
                ))}
              </ul>
            ) : null}

            <div className="setup-actions">
              <button type="button" className="button--primary" onClick={() => onKeep(result.query)} disabled={isBusy}>
                Keep this result
              </button>
              <button type="button" onClick={() => onRetry(result.query)} disabled={isBusy}>
                Search again
              </button>
              <button type="button" onClick={() => onExclude(result.query)} disabled={isBusy}>
                Exclude subject
              </button>
            </div>
          </section>
        );
      })}

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={onContinue} disabled={!allResolved}>
          Continue to Review
        </button>
        <button type="button" onClick={onUploadInstead}>
          Upload subject guide instead
        </button>
        <button type="button" onClick={onEnterManually}>
          Enter code manually
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {!allResolved ? <p className="setup-hint">Resolve every ambiguous subject above before continuing.</p> : null}
    </div>
  );
}

export { queryKey };
