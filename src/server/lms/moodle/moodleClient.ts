/**
 * Server-only Moodle web-service client (Phase 18F, Part 6/7). Every call:
 * sends the institution-issued token as a POST BODY parameter (never a URL
 * query string — a deliberately stronger choice than Moodle's REST
 * protocol strictly requires, so the token structurally never appears
 * anywhere a URL might be logged; see the file-level redaction note below
 * for the one path — a thrown error's cause chain — where the raw request
 * could theoretically leak it, and how that's prevented), applies a
 * request timeout + response-size cap + content-type check identical in
 * spirit to `canvasClient.ts`, and — CRITICALLY, a genuine Moodle-specific
 * requirement Canvas never had — checks every response for Moodle's own
 * embedded-exception-envelope convention (`{exception, errorcode,
 * message}` returned with HTTP 200) BEFORE treating a 200 as success.
 *
 * `core_webservice_get_site_info` is always called first on any new
 * connection (Part 7) via `validateMoodleSiteAndUser`, using the raw token
 * directly (no stored connection record needs to exist yet) — every other
 * function goes through `moodleGetList`/`moodleGetOne`, which look up an
 * EXISTING connection's already-encrypted-then-decrypted token.
 */

import { moodleConnectionStore } from "./moodleConnectionStore";
import { decryptMoodleToken } from "./moodleTokenCrypto";
import { MoodleError, type MoodleErrorCategory } from "./moodleErrors";
import { isMoodleExceptionEnvelope, validateSiteInfo, type ValidatedSiteInfo } from "./moodleSchemas";
import type { MoodleInstitutionDefinition } from "../../../import/moodleInstitutionRegistry";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB — generous for a JSON list response, still bounded

async function readBoundedBody(res: Response): Promise<string> {
  const declaredLength = res.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new MoodleError("invalid-response", "Moodle response declared a size over the allowed limit.");
  }
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new MoodleError("invalid-response", "Moodle response exceeded the allowed size limit while streaming.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
}

function categoryForStatus(status: number): MoodleErrorCategory {
  if (status === 401 || status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "moodle-unavailable";
  return "unknown";
}

/**
 * The one low-level entry point every other function in this module
 * delegates to. `token` is passed explicitly (never read from a connection
 * record here) so `validateMoodleSiteAndUser` can call it before any
 * connection record exists. The token is sent ONLY as a POST body
 * parameter — never appended to `url`, never logged, never included in any
 * thrown error's message (errors here report the MoodleErrorCategory and a
 * safe static message only, per moodleErrors.ts's own discipline — nothing
 * from the raw request or response body is ever echoed back).
 */
async function callMoodleFunction(
  institution: MoodleInstitutionDefinition,
  token: string,
  wsFunction: string,
  params: Record<string, string>,
  signal: AbortSignal | undefined
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  const body = new URLSearchParams({ wstoken: token, wsfunction: wsFunction, moodlewsrestformat: "json", ...params });

  try {
    let res: Response;
    try {
      res = await fetch(institution.webServiceEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: body.toString(),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (signal?.aborted) throw new MoodleError("invalid-request", "Cancelled.");
        throw new MoodleError("moodle-unavailable", "Moodle request timed out.");
      }
      throw new MoodleError("moodle-unavailable", "Moodle request failed (network error).");
    }

    if (res.status < 200 || res.status >= 300) {
      throw new MoodleError(categoryForStatus(res.status), `Moodle responded with HTTP ${res.status}.`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new MoodleError("invalid-response", `Moodle returned an unexpected content type: ${contentType || "(none)"}.`);
    }

    const bodyText = await readBoundedBody(res);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      throw new MoodleError("invalid-response", "Moodle returned a response that wasn't valid JSON.");
    }

    // Moodle's own documented failure convention: HTTP 200 with an embedded
    // exception envelope. Checked BEFORE this is ever treated as a
    // successful result — the raw exception/errorcode/message is
    // deliberately never included in the thrown error (it can contain
    // internal server detail); only a safe, categorized message is.
    if (isMoodleExceptionEnvelope(parsed)) {
      const errorcode = typeof parsed.errorcode === "string" ? parsed.errorcode : "";
      if (errorcode === "invalidtoken" || errorcode === "accessexception") {
        throw new MoodleError("invalid-token", "Moodle rejected the connection token.");
      }
      if (errorcode === "wsaccessuser" || errorcode === "missingrequiredcapability") {
        throw new MoodleError("insufficient-permission", "Moodle token lacks a required capability.");
      }
      throw new MoodleError("moodle-exception", "Moodle reported an exception handling this request.");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Part 7: validates the Moodle site AND the current user BEFORE anything
 * else is trusted. Rejects (throws) on: a response that doesn't parse as
 * site info, a site URL that doesn't match this institution's registered
 * `moodleBaseUrl` (never accepts whatever host happens to answer), or a
 * missing user id. Called with the RAW token directly — no stored
 * connection is required or assumed to exist yet.
 */
export async function validateMoodleSiteAndUser(
  institution: MoodleInstitutionDefinition,
  token: string,
  signal?: AbortSignal
): Promise<ValidatedSiteInfo> {
  const raw = await callMoodleFunction(institution, token, "core_webservice_get_site_info", {}, signal);
  const siteInfo = validateSiteInfo(raw);
  if (!siteInfo) throw new MoodleError("invalid-response", "Moodle's site-info response couldn't be understood.");
  if (siteInfo.userId === null) throw new MoodleError("invalid-response", "Moodle's site-info response didn't include a user id.");
  if (siteInfo.siteUrl && !siteInfo.siteUrl.startsWith(institution.moodleBaseUrl)) {
    throw new MoodleError("wrong-site", "This token belongs to a different Moodle site than the configured institution.");
  }
  return siteInfo;
}

interface UsableCredentialResult {
  ok: true;
  token: string;
}
interface UnusableCredentialResult {
  ok: false;
  reason: "not-configured" | "reauthorisation-required";
}

/**
 * Unlike Canvas's `ensureFreshAccessToken`, there is no refresh flow here —
 * an institution-issued Moodle token (Part 4/5) has no refresh-token
 * equivalent in the confirmed connection mode this phase supports (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §5/§17). An expired or
 * revoked credential is surfaced as `reauthorisation-required`, meaning
 * "an operator needs to configure a new token" — never silently retried,
 * never auto-refreshed.
 */
async function ensureUsableMoodleCredential(connectionId: string): Promise<UsableCredentialResult | UnusableCredentialResult> {
  const connection = await moodleConnectionStore.getConnection(connectionId);
  if (!connection || connection.revokedAt) return { ok: false, reason: "not-configured" };
  if (connection.reauthorisationRequiredAt) return { ok: false, reason: "reauthorisation-required" };
  if (connection.credentialExpiresAt !== null && connection.credentialExpiresAt < Date.now()) {
    await moodleConnectionStore.markReauthorisationRequired(connectionId);
    return { ok: false, reason: "reauthorisation-required" };
  }
  return { ok: true, token: decryptMoodleToken(connection.encryptedCredential) };
}

export interface MoodleFetchOutcome<T> {
  items: T[];
  skippedCount: number;
}

/** Fetches a Moodle list-shaped function result (a flat JSON array) — validated, bounded, never blindly trusted. */
export async function moodleGetList<TValidated>(
  institution: MoodleInstitutionDefinition,
  connectionId: string,
  wsFunction: string,
  params: Record<string, string>,
  validate: (raw: unknown) => TValidated | null,
  signal?: AbortSignal
): Promise<MoodleFetchOutcome<TValidated>> {
  const credential = await ensureUsableMoodleCredential(connectionId);
  if (!credential.ok) {
    throw new MoodleError(credential.reason === "not-configured" ? "not-configured" : "reauthorisation-required", "Moodle credential isn't available.");
  }
  const institutionForCall = institution;
  const raw = await callMoodleFunction(institutionForCall, credential.token, wsFunction, params, signal);
  if (!Array.isArray(raw)) {
    throw new MoodleError("invalid-response", "Moodle returned a response that wasn't a list where one was expected.");
  }
  let skippedCount = 0;
  const items: TValidated[] = [];
  for (const entry of raw) {
    const validated = validate(entry);
    if (validated === null) skippedCount += 1;
    else items.push(validated);
  }
  return { items, skippedCount };
}

/**
 * Fetches a Moodle function whose result is a WRAPPER OBJECT containing a
 * nested array (e.g. `mod_assign_get_assignments` returns
 * `{courses: [{id, assignments: [...]}], warnings: [...]}`;
 * `mod_quiz_get_quizzes_by_courses` returns `{quizzes: [...], warnings:
 * [...]}`; `core_calendar_get_calendar_events` returns `{events: [...],
 * warnings: [...]}`) — genuinely different from `core_course_get_contents`/
 * `core_enrol_get_users_courses`, which return a bare array directly. This
 * distinction is exactly why Moodle's client cannot assume one response
 * convention the way a single `canvasGetList` could for Canvas (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §2/§6) — getting it wrong
 * (treating a wrapper object as a bare array, or vice versa) throws
 * `invalid-response` immediately rather than silently reading `undefined`
 * fields, the same lesson this project's own Canvas orchestrator bug
 * (single-course-fetch through the list function) already taught.
 * `unwrap` extracts the nested array; a response that doesn't even have
 * that shape is rejected before any item is validated.
 */
export async function moodleGetWrappedList<TValidated>(
  institution: MoodleInstitutionDefinition,
  connectionId: string,
  wsFunction: string,
  params: Record<string, string>,
  unwrap: (raw: unknown) => unknown[] | null,
  validate: (raw: unknown) => TValidated | null,
  signal?: AbortSignal
): Promise<MoodleFetchOutcome<TValidated>> {
  const credential = await ensureUsableMoodleCredential(connectionId);
  if (!credential.ok) {
    throw new MoodleError(credential.reason === "not-configured" ? "not-configured" : "reauthorisation-required", "Moodle credential isn't available.");
  }
  const raw = await callMoodleFunction(institution, credential.token, wsFunction, params, signal);
  const unwrapped = unwrap(raw);
  if (unwrapped === null) {
    throw new MoodleError("invalid-response", "Moodle returned a response that didn't match the expected shape.");
  }
  let skippedCount = 0;
  const items: TValidated[] = [];
  for (const entry of unwrapped) {
    const validated = validate(entry);
    if (validated === null) skippedCount += 1;
    else items.push(validated);
  }
  return { items, skippedCount };
}

/** Fetches a Moodle single-object-shaped function result. */
export async function moodleGetOne<TValidated>(
  institution: MoodleInstitutionDefinition,
  connectionId: string,
  wsFunction: string,
  params: Record<string, string>,
  validate: (raw: unknown) => TValidated | null,
  signal?: AbortSignal
): Promise<TValidated | null> {
  const credential = await ensureUsableMoodleCredential(connectionId);
  if (!credential.ok) {
    throw new MoodleError(credential.reason === "not-configured" ? "not-configured" : "reauthorisation-required", "Moodle credential isn't available.");
  }
  const raw = await callMoodleFunction(institution, credential.token, wsFunction, params, signal);
  return validate(raw);
}

export { MoodleError };
