/**
 * Discovery quality score (Phase 18D, Part 10). Never a single unexplained
 * percentage — separate, labelled dimensions plus an overall label that is
 * a function of the WORST materially important dimension, not an average
 * that could hide a real gap. A subject with confirmed identity but zero
 * public assessments can never be labelled "Excellent".
 */

import type { ImportedSubjectCandidate } from "../import/types";
import type { YearDetectionResult } from "./search/yearDetection";
import type { TeachingPeriodResult } from "./search/teachingPeriod";
import type { DiscoveryMethod } from "./schema";

export type DimensionLabel = "High" | "Medium" | "Partial" | "Low" | "Missing";
export type OverallLabel = "Excellent" | "Good" | "Partial" | "Needs review" | "Insufficient";

export interface QualityDimensions {
  identity: DimensionLabel;
  academicYear: DimensionLabel;
  teachingPeriod: DimensionLabel;
  contentCompleteness: DimensionLabel;
  assessments: DimensionLabel;
  modules: DimensionLabel;
  sourceAuthority: string;
  sourceFreshness: string;
}

export interface QualityResult {
  dimensions: QualityDimensions;
  overall: OverallLabel;
  /** Plain-language reasons for the overall label — always shown alongside it, never a bare label with no explanation. */
  explanation: string[];
}

function identityLabel(subject: ImportedSubjectCandidate): DimensionLabel {
  if (subject.confidence === "missing") return "Missing";
  if (subject.confidence === "confirmed" || subject.confidence === "high") return "High";
  if (subject.confidence === "medium") return "Medium";
  return "Low";
}

function yearLabel(yearResult: YearDetectionResult | null): DimensionLabel {
  if (!yearResult) return "Missing";
  switch (yearResult.classification) {
    case "exact":
      return "High";
    case "likely":
    case "future":
      return "Medium";
    case "not-shown":
      return "Missing";
    case "stale":
    case "conflicting":
      return "Low";
  }
}

function periodLabel(periodResult: TeachingPeriodResult | null): DimensionLabel {
  if (!periodResult) return "Missing";
  switch (periodResult.classification) {
    case "exact":
      return "High";
    case "alias":
      return "Medium";
    case "not-shown":
      return "Missing";
    case "conflicting":
    case "multiple-offered":
      return "Low";
  }
}

function assessmentsLabel(subject: ImportedSubjectCandidate): DimensionLabel {
  if (subject.assessments.length === 0) return "Missing";
  const complete = subject.assessments.filter((a) => a.weighting !== null && a.due?.isoDate);
  if (complete.length === subject.assessments.length) return "High";
  if (complete.length > 0) return "Partial";
  return "Low";
}

function modulesLabel(subject: ImportedSubjectCandidate): DimensionLabel {
  if (subject.modules.length === 0) return "Missing";
  return subject.modules.length >= 6 ? "High" : "Partial";
}

function sourceAuthorityText(discoveryMethod: DiscoveryMethod | null): string {
  switch (discoveryMethod) {
    case "direct-template":
      return "Official handbook (direct verified link)";
    case "sitemap":
    case "search-adapter":
    case "native-search":
      return "Official handbook (found via search)";
    case "registry-known-page":
      return "Official registry-known page";
    case "user-selected":
      return "Official page you selected from the alternatives list";
    default:
      return "Unknown";
  }
}

function sourceFreshnessText(yearResult: YearDetectionResult | null, requestedYear: string): string {
  if (!yearResult || yearResult.classification === "not-shown") return "Not stated on the page";
  if (yearResult.classification === "exact") return `Verified for ${requestedYear}`;
  if (yearResult.classification === "stale") return `Stale — appears to be for ${yearResult.detectedYears.join(", ")}`;
  if (yearResult.classification === "future") return `Next-year edition (${yearResult.detectedYears.join(", ")}) — published early`;
  if (yearResult.classification === "conflicting") return `Conflicting years shown: ${yearResult.detectedYears.join(", ")}`;
  return "Uncertain";
}

export function computeQualityScore(
  subject: ImportedSubjectCandidate,
  yearResult: YearDetectionResult | null,
  periodResult: TeachingPeriodResult | null,
  discoveryMethod: DiscoveryMethod | null,
  requestedYear: string
): QualityResult {
  const identity = identityLabel(subject);
  const academicYear = yearLabel(yearResult);
  const teachingPeriod = periodLabel(periodResult);
  const assessments = assessmentsLabel(subject);
  const modules = modulesLabel(subject);

  const missingCoreCount = [identity, assessments, modules].filter((d) => d === "Missing").length;
  const contentCompleteness: DimensionLabel = missingCoreCount >= 2 ? "Low" : assessments === "Missing" || modules === "Missing" ? "Partial" : "High";

  const explanation: string[] = [];
  let overall: OverallLabel;

  if (identity === "Missing") {
    overall = "Insufficient";
    explanation.push("Subject identity could not be confirmed from any source.");
  } else if (academicYear === "Low") {
    overall = "Needs review";
    explanation.push("The page appears to be for a different or conflicting academic year — confirm before relying on it.");
  } else if (assessments === "Missing") {
    overall = "Needs review";
    explanation.push("No public assessment information was found — this cannot be labelled Excellent even though the subject identity is confirmed.");
  } else if (assessments === "Partial" || assessments === "Low" || modules === "Missing" || modules === "Partial" || teachingPeriod === "Missing") {
    overall = "Partial";
    explanation.push("Some information (modules, assessments, or teaching period) is incomplete or was not found.");
  } else if (identity === "High" && assessments === "High" && academicYear === "High") {
    overall = "Excellent";
    explanation.push("Subject identity, academic year, and assessments are all confirmed from an official source.");
  } else {
    overall = "Good";
    explanation.push("Core information was found and is reasonably confident, though not every dimension is fully confirmed.");
  }

  return {
    dimensions: {
      identity,
      academicYear,
      teachingPeriod,
      contentCompleteness,
      assessments,
      modules,
      sourceAuthority: sourceAuthorityText(discoveryMethod),
      sourceFreshness: sourceFreshnessText(yearResult, requestedYear),
    },
    overall,
    explanation,
  };
}
