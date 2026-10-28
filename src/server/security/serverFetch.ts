/**
 * The single choke point for every network request the discovery backend
 * makes (Phase 18C, Part 3/6). Every page — a registry-templated handbook
 * URL, a sitemap URL, a redirect destination — goes through here.
 *
 * Guarantees, in order: SSRF guard (domain allowlist + IP/DNS checks) on
 * the URL itself, robots.txt respect, a single attempt with a bounded
 * timeout, MANUAL redirect following (each hop re-guarded — never trust
 * `fetch`'s automatic redirect handling for a server-side request), a
 * content-type allowlist, and a hard response-size cap enforced while
 * streaming (never trusts a Content-Length header alone).
 */

import { checkRobotsAllowed } from "../../import/discovery/safeFetch";
import { guardUrl, guardUrlStructure } from "./ssrfGuard";
import { DiscoveryError } from "../errors";

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DECOMPRESSED_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "application/xml", "text/xml", "text/plain"];

export interface ServerFetchResult {
  ok: boolean;
  status: number | null;
  text: string | null;
  finalUrl: string;
  contentType: string | null;
  error: string | null;
}

function contentTypeAllowed(header: string | null): boolean {
  if (!header) return false;
  const mime = header.split(";")[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.includes(mime);
}

async function readBounded(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new DiscoveryError("response-too-large", `response exceeded ${maxBytes} bytes`);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

/**
 * Fetches one URL with the full guard chain, following redirects manually
 * so every hop — not just the final destination — is re-validated.
 */
export async function serverFetchOfficialPage(
  initialUrl: string,
  officialDomains: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ServerFetchResult> {
  let current: URL;
  try {
    current = new URL(initialUrl);
  } catch {
    return { ok: false, status: null, text: null, finalUrl: initialUrl, contentType: null, error: "not a valid URL" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const guard = await guardUrl(current, officialDomains);
      if (!guard.allowed) {
        return { ok: false, status: null, text: null, finalUrl: current.toString(), contentType: null, error: guard.reason };
      }

      const robots = await checkRobotsAllowed(current, controller.signal);
      if (!robots.allowed) {
        return { ok: false, status: null, text: null, finalUrl: current.toString(), contentType: null, error: robots.reason };
      }

      const contentLengthGuard = (res: Response): string | null => {
        const len = Number(res.headers.get("content-length") ?? "0");
        return len > MAX_COMPRESSED_BYTES ? `response declared ${len} bytes, over the ${MAX_COMPRESSED_BYTES}-byte limit` : null;
      };

      const response = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "UniGame-AcademicDiscovery/1.0 (+student-owned semester import; server-side)" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, status: response.status, text: null, finalUrl: current.toString(), contentType: null, error: "redirect with no Location header" };
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, current);
        } catch {
          return { ok: false, status: response.status, text: null, finalUrl: current.toString(), contentType: null, error: "redirect Location header is not a valid URL" };
        }
        const nextGuard = guardUrlStructure(nextUrl, officialDomains);
        if (!nextGuard.allowed) {
          return { ok: false, status: response.status, text: null, finalUrl: nextUrl.toString(), contentType: null, error: `redirect rejected: ${nextGuard.reason}` };
        }
        current = nextUrl;
        continue;
      }

      if (!response.ok) {
        return { ok: false, status: response.status, text: null, finalUrl: response.url || current.toString(), contentType: null, error: `HTTP ${response.status}` };
      }

      const sizeError = contentLengthGuard(response);
      if (sizeError) {
        return { ok: false, status: response.status, text: null, finalUrl: current.toString(), contentType: null, error: sizeError };
      }

      const contentType = response.headers.get("content-type");
      if (!contentTypeAllowed(contentType)) {
        return { ok: false, status: response.status, text: null, finalUrl: current.toString(), contentType, error: `unsupported content type: ${contentType ?? "unknown"}` };
      }

      let text: string;
      try {
        text = await readBounded(response, MAX_DECOMPRESSED_BYTES);
      } catch (error) {
        if (error instanceof DiscoveryError) {
          return { ok: false, status: response.status, text: null, finalUrl: current.toString(), contentType, error: error.message };
        }
        throw error;
      }

      return { ok: true, status: response.status, text, finalUrl: current.toString(), contentType, error: null };
    }

    return { ok: false, status: null, text: null, finalUrl: current.toString(), contentType: null, error: "too many redirects" };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: null,
      text: null,
      finalUrl: current.toString(),
      contentType: null,
      error: aborted ? "timed out" : error instanceof Error ? error.message : "network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
