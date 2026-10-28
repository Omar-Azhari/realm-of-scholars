/**
 * Canvas token exchange, refresh, and revocation (Phase 18E, Part 3/6).
 * The only module that ever talks to Canvas's OAuth token endpoint. Never
 * logs a token value or a raw Canvas error body — only status codes and
 * high-level categories (Part 20's "no plaintext token logging" /
 * "no token values in errors").
 */

import { encryptToken, decryptToken, type EncryptedValue } from "./canvasTokenCrypto";
import { canvasConnectionStore, type CanvasConnectionRecord } from "./canvasConnectionStore";
import { findCanvasInstitution, type CanvasInstitutionDefinition } from "../../../import/canvasInstitutionRegistry";

const TOKEN_REQUEST_TIMEOUT_MS = 8000;
/** Refresh proactively once within this margin of expiry, rather than waiting for a live 401 mid-sync. */
const REFRESH_SAFETY_MARGIN_MS = 2 * 60_000;

export class CanvasTokenError extends Error {}

export interface CanvasTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  user?: { id: number | string };
}

function isCanvasTokenResponse(value: unknown): value is CanvasTokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.access_token === "string";
}

async function postToTokenEndpoint(tokenEndpoint: string, body: URLSearchParams): Promise<CanvasTokenResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new CanvasTokenError("Canvas token request timed out.");
      throw new CanvasTokenError("Canvas token request failed (network error).");
    }
    if (!res.ok) {
      // Deliberately never includes the response body — Canvas error
      // payloads can echo back request parameters, which must never reach
      // a log or an error surfaced to the browser.
      throw new CanvasTokenError(`Canvas token endpoint responded with HTTP ${res.status}.`);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new CanvasTokenError("Canvas token endpoint returned a response that wasn't valid JSON.");
    }
    if (!isCanvasTokenResponse(data)) {
      throw new CanvasTokenError("Canvas token endpoint response did not include an access_token.");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeCodeForTokens(
  institution: CanvasInstitutionDefinition,
  params: { code: string; redirectUri: string; clientId: string; clientSecret: string; pkceVerifier: string }
): Promise<CanvasTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.pkceVerifier,
  });
  return postToTokenEndpoint(institution.tokenEndpoint, body);
}

export async function refreshAccessToken(
  institution: CanvasInstitutionDefinition,
  params: { refreshToken: string; clientId: string; clientSecret: string }
): Promise<CanvasTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });
  return postToTokenEndpoint(institution.tokenEndpoint, body);
}

/** Canvas's revoke endpoint is a DELETE against the same token-endpoint path, bearer-authenticated with the token being revoked. Best-effort: failure here must never block local credential deletion (see Part 19 — "if revocation fails, still delete local credentials"). */
export async function revokeAccessToken(institution: CanvasInstitutionDefinition, accessToken: string): Promise<{ ok: boolean; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(institution.revokeEndpoint, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    return { ok: res.ok, error: res.ok ? null : `Canvas revocation responded with HTTP ${res.status}` };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Canvas revocation request timed out" : "Canvas revocation request failed (network error)";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export interface EncryptedTokenUpdate {
  accessToken: EncryptedValue;
  refreshToken: EncryptedValue;
  tokenExpiresAt: number;
  scopes: string[];
}

/** Encrypts a fresh token response for storage. Refresh-token ROTATION: only replaces the stored refresh token when Canvas actually returned a new one — otherwise the previous (still valid) encrypted refresh token is kept as-is, never re-encrypted from a decrypted round-trip (which would need the plaintext unnecessarily). */
export function encryptTokenResponse(tokens: CanvasTokenResponse, previousEncryptedRefreshToken: EncryptedValue): EncryptedTokenUpdate {
  return {
    accessToken: encryptToken(tokens.access_token),
    refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : previousEncryptedRefreshToken,
    tokenExpiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    scopes: tokens.scope ? tokens.scope.split(" ").filter((s) => s.length > 0) : [],
  };
}

export function connectionNeedsRefresh(connection: CanvasConnectionRecord): boolean {
  return Date.now() > connection.tokenExpiresAt - REFRESH_SAFETY_MARGIN_MS;
}

export function decryptAccessToken(connection: CanvasConnectionRecord): string {
  return decryptToken(connection.encryptedAccessToken);
}

export function decryptRefreshToken(connection: CanvasConnectionRecord): string {
  return decryptToken(connection.encryptedRefreshToken);
}

export type EnsureFreshTokenResult =
  | { ok: true; accessToken: string; connection: CanvasConnectionRecord }
  | { ok: false; reason: "reauthorisation-required" | "not-configured" | "connection-not-found" };

/**
 * The single place both the manual `/api/lms/canvas/refresh` endpoint and
 * the Canvas API client's internal calls go through — refreshes only when
 * actually needed. The entire check-then-refresh sequence (including the
 * network call to Canvas) runs INSIDE one `updateTokensAtomically` call, so
 * it is genuinely serialized per connectionId (Part 3: "do not refresh
 * multiple times concurrently for the same connection") — a second
 * concurrent caller's updater only starts once the first has fully
 * finished and saved, so it will see the ALREADY-refreshed record and
 * correctly decide no further refresh is needed, rather than racing a
 * second network call. On failure, marks the connection as requiring
 * reauthorisation and returns that as data — never throws, never silently
 * fabricates a successful refresh.
 */
export async function ensureFreshAccessToken(connectionId: string): Promise<EnsureFreshTokenResult> {
  let outcome: EnsureFreshTokenResult = { ok: false, reason: "connection-not-found" };

  const result = await canvasConnectionStore.updateTokensAtomically(connectionId, async (current) => {
    if (current.revokedAt) {
      outcome = { ok: false, reason: "connection-not-found" };
      return current;
    }
    if (!connectionNeedsRefresh(current)) {
      outcome = { ok: true, accessToken: decryptAccessToken(current), connection: current };
      return current;
    }

    const institution = findCanvasInstitution(current.institutionId);
    const clientId = institution ? process.env[institution.clientIdEnvVar] : undefined;
    const clientSecret = institution ? process.env[institution.clientSecretEnvVar] : undefined;
    if (!institution || !clientId || !clientSecret) {
      outcome = { ok: false, reason: "not-configured" };
      return current;
    }

    try {
      const tokens = await refreshAccessToken(institution, { refreshToken: decryptRefreshToken(current), clientId, clientSecret });
      const encrypted = encryptTokenResponse(tokens, current.encryptedRefreshToken);
      const updated: CanvasConnectionRecord = {
        ...current,
        encryptedAccessToken: encrypted.accessToken,
        encryptedRefreshToken: encrypted.refreshToken,
        tokenExpiresAt: encrypted.tokenExpiresAt,
        scopes: encrypted.scopes.length > 0 ? encrypted.scopes : current.scopes,
        reauthorisationRequiredAt: null,
        updatedAt: Date.now(),
      };
      outcome = { ok: true, accessToken: decryptAccessToken(updated), connection: updated };
      return updated;
    } catch {
      outcome = { ok: false, reason: "reauthorisation-required" };
      return { ...current, reauthorisationRequiredAt: Date.now(), updatedAt: Date.now() };
    }
  });

  if (!result) return { ok: false, reason: "connection-not-found" };
  return outcome;
}
