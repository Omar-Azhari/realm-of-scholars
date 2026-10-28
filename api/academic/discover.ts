/**
 * POST /api/academic/discover (Phase 18C, Part 2/8). The one HTTP entry
 * point this phase adds. Deliberately thin: validate → rate-limit → cache
 * lookup → orchestrate (src/server/discoveryOrchestrator.ts) → merge
 * through the EXISTING, unmodified merge engine → respond. All real logic
 * lives in framework-agnostic src/server/* modules so it's testable without
 * a Vercel-specific test harness (see the verification scripts).
 *
 * Runtime is deliberately Node.js, not Edge (the default — this file never
 * sets `config.runtime = "edge"`), because SSRF protection needs
 * `node:dns`, which Edge doesn't provide.
 */

import { validateDiscoverRequest } from "../../src/server/schema";
import type { DiscoverResponse, CacheStatus } from "../../src/server/schema";
import { discoverSubjects, type OrchestratorOutcome } from "../../src/server/discoveryOrchestrator";
import { DiscoveryError, toClientMessage, type DiscoveryErrorCategory } from "../../src/server/errors";
import { BoundedCache, buildCacheKey, FAILURE_TTL_MS, SUCCESS_TTL_MS } from "../../src/server/cache";
import { perClientRateLimiter, globalRateLimiter } from "../../src/server/rateLimiter";
import { logDiscoveryError, logDiscoveryResult } from "../../src/server/logging";
import { mergeSourcePackages } from "../../src/import/merge/mergeEngine";

export const config = { runtime: "nodejs" };

const discoveryCache = new BoundedCache<OrchestratorOutcome>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function errorResponse(status: number, category: DiscoveryErrorCategory, requestId: string, detail?: string): Response {
  return jsonResponse(status, { requestId, errors: [{ category, message: toClientMessage(category, detail) }] });
}

export async function GET(): Promise<Response> {
  return jsonResponse(200, { status: "ok", service: "academic-discovery" });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  if (!globalRateLimiter.tryConsume("global")) {
    return errorResponse(429, "rate-limited", requestId);
  }
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown-client";
  if (!perClientRateLimiter.tryConsume(clientKey)) {
    return errorResponse(429, "rate-limited", requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-request", requestId, "body was not valid JSON");
  }

  const validation = validateDiscoverRequest(body);
  if (!validation.ok || !validation.value) {
    return errorResponse(400, "invalid-request", requestId, validation.error ?? undefined);
  }
  const discoverRequest = validation.value;

  const cacheKey = discoverRequest.subjectQueries
    .map((q) => buildCacheKey(discoverRequest.institutionId, q.code, q.name, discoverRequest.academicYear, discoverRequest.teachingPeriod))
    .sort()
    .join("|");

  let outcome: OrchestratorOutcome;
  let cacheStatus: CacheStatus;
  const cached = discoveryCache.get(cacheKey);
  if (cached) {
    outcome = cached.value;
    cacheStatus = "hit";
  } else {
    try {
      outcome = await discoverSubjects(discoverRequest, requestId);
      const anyFound = outcome.queryResults.some((q) => q.status === "found" || q.status === "partial");
      discoveryCache.set(cacheKey, outcome, anyFound ? SUCCESS_TTL_MS : FAILURE_TTL_MS);
      cacheStatus = "live";
    } catch (error) {
      const category = error instanceof DiscoveryError ? error.category : "service-misconfigured";
      const message = error instanceof DiscoveryError ? error.message : "unexpected error";
      logDiscoveryError(requestId, discoverRequest.institutionId, category, toClientMessage(category));
      void message;
      return errorResponse(400, category, requestId);
    }
  }

  const merged = mergeSourcePackages(
    outcome.sourcePackages,
    [],
    {
      institution: outcome.institution,
      degree: discoverRequest.degree,
      major: discoverRequest.major,
      academicYear: discoverRequest.academicYear,
      semesterName: discoverRequest.teachingPeriod,
      campus: discoverRequest.campus,
    },
    new Date().toISOString()
  );

  const response: DiscoverResponse = {
    requestId,
    institution: outcome.institution,
    queryResults: outcome.queryResults,
    discoveredSources: outcome.discoveredSources,
    package: merged,
    warnings: merged.warnings,
    errors: [],
    timing: { totalMs: Date.now() - start, perSubjectMs: outcome.perSubjectMs },
    cacheStatus,
  };

  logDiscoveryResult({
    requestId,
    institutionId: discoverRequest.institutionId,
    status: outcome.queryResults.every((q) => q.status === "found") ? "ok" : outcome.queryResults.some((q) => q.status === "found" || q.status === "partial") ? "partial" : "error",
    sourceCount: outcome.discoveredSources.length,
    fetchDurationMs: Date.now() - start,
    extractionDurationMs: 0,
    cacheStatus,
    errorCategory: null,
  });

  return jsonResponse(200, response);
}
