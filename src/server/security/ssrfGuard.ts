/**
 * SSRF guard (Phase 18C, Part 3). Every URL the backend is about to fetch —
 * a registry-templated URL, a sitemap-discovered link, or a redirect
 * destination — passes through here first. This is deliberately stricter
 * than Phase 18B's browser-side `safeFetch.ts`: a server-side fetch runs
 * inside cloud infrastructure and can reach internal network ranges a
 * browser never could, so every hop gets the full check here, not just the
 * final destination.
 */

import { resolve4, resolve6 } from "node:dns/promises";
import { isLiteralIpAddress, isLocalhostName, isPrivateOrReservedAddress } from "./ipRanges";

export interface GuardResult {
  allowed: boolean;
  reason: string | null;
}

// Read fresh on every call, not cached at module load: a long-lived warm
// serverless instance should see an env-var change on its next invocation,
// and a test harness that sets this after the module has already loaded
// must not be stuck with a stale `false`.
function allowLocalhostFetch(): boolean {
  return process.env.UNIGAME_ALLOW_LOCALHOST_FETCH === "true";
}

/** Structural checks only — no network call. Used for a fast first pass before the DNS check. */
export function guardUrlStructure(url: URL, officialDomains: string[]): GuardResult {
  const allowLocalhost = allowLocalhostFetch();
  if (url.protocol !== "https:" && !(allowLocalhost && url.protocol === "http:")) {
    return { allowed: false, reason: "only HTTPS is permitted" };
  }
  if (url.username || url.password) {
    return { allowed: false, reason: "URLs with embedded credentials are rejected" };
  }
  if (!officialDomains.includes(url.hostname)) {
    return { allowed: false, reason: "hostname is not one of this institution's official domains" };
  }
  if (isLiteralIpAddress(url.hostname)) {
    return { allowed: false, reason: "IP-address hostnames are rejected — official pages are always named hosts" };
  }
  if (isLocalhostName(url.hostname) && !allowLocalhost) {
    return { allowed: false, reason: "localhost is rejected" };
  }
  return { allowed: true, reason: null };
}

/** Resolves the hostname and rejects if ANY returned address is private/loopback/link-local/multicast/reserved. */
export async function guardDnsResolution(hostname: string): Promise<GuardResult> {
  if (allowLocalhostFetch() && isLocalhostName(hostname)) {
    return { allowed: true, reason: null };
  }
  const addresses: string[] = [];
  let resolvedAny = false;
  try {
    addresses.push(...(await resolve4(hostname)));
    resolvedAny = true;
  } catch {
    // No A record — fine, may be AAAA-only.
  }
  try {
    addresses.push(...(await resolve6(hostname)));
    resolvedAny = true;
  } catch {
    // No AAAA record — fine, may be A-only.
  }
  if (!resolvedAny) {
    return { allowed: false, reason: "hostname could not be resolved" };
  }
  const privateHit = addresses.find((addr) => isPrivateOrReservedAddress(addr));
  if (privateHit) {
    return { allowed: false, reason: "hostname resolves to a private/reserved address" };
  }
  return { allowed: true, reason: null };
}

/** The full check for one URL: structure first (cheap), then DNS resolution (a real network call). */
export async function guardUrl(url: URL, officialDomains: string[]): Promise<GuardResult> {
  const structural = guardUrlStructure(url, officialDomains);
  if (!structural.allowed) return structural;
  return guardDnsResolution(url.hostname);
}
