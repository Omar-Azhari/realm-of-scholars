/**
 * Privacy-conscious structured logging (Phase 18C, Part 11). Vercel
 * captures stdout/stderr as logs automatically — no logging SaaS
 * integration needed or added. Every log line is a flat JSON object with a
 * fixed field set; nothing here ever logs uploaded file content, full
 * extracted page text, an API key, cookies/auth headers, personal goals, or
 * any other unnecessary personally-identifying value — only counts,
 * durations, and category strings.
 */

import type { DiscoveryErrorCategory } from "./errors";
import type { CacheStatus } from "./schema";

export interface DiscoveryLogFields {
  requestId: string;
  institutionId: string;
  status: "ok" | "partial" | "error";
  sourceCount: number;
  fetchDurationMs: number;
  extractionDurationMs: number;
  cacheStatus: CacheStatus;
  errorCategory: DiscoveryErrorCategory | null;
}

export function logDiscoveryResult(fields: DiscoveryLogFields): void {
  console.log(JSON.stringify({ event: "academic-discovery", ...fields, loggedAt: new Date().toISOString() }));
}

export function logDiscoveryError(requestId: string, institutionId: string, category: DiscoveryErrorCategory, message: string): void {
  // `message` here is always one of the fixed, pre-written client-facing
  // strings from errors.ts (via toClientMessage) — never a raw exception's
  // .message/.stack, which could embed a URL, header value, or path.
  console.error(JSON.stringify({ event: "academic-discovery-error", requestId, institutionId, category, message, loggedAt: new Date().toISOString() }));
}
