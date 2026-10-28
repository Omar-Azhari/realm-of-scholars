/**
 * GET /api/lms/canvas/callback (Phase 18E, Part 3/21). Canvas redirects the
 * user's browser here after they approve or deny access. Verifies state
 * (signature + one-time consumption + expiry), verifies the institution
 * still matches, exchanges the code server-side (client secret never
 * leaves the server), and redirects to the validated return path with a
 * non-sensitive status flag the frontend reads to resume Semester Setup.
 * Never exposes the access/refresh token to the browser at any point.
 */

import { randomUUID } from "node:crypto";
import { findCanvasInstitution } from "../../../src/import/canvasInstitutionRegistry";
import { canvasConnectionStore, type CanvasConnectionRecord } from "../../../src/server/lms/canvas/canvasConnectionStore";
import { verifySignedState } from "../../../src/server/lms/canvas/canvasOAuthState";
import { exchangeCodeForTokens, encryptTokenResponse } from "../../../src/server/lms/canvas/canvasTokenManager";
import { encryptToken } from "../../../src/server/lms/canvas/canvasTokenCrypto";
import { perClientRateLimiter, globalRateLimiter } from "../../../src/server/rateLimiter";

export const config = { runtime: "nodejs" };

function redirectWithStatus(returnPath: string, status: string, extra: Record<string, string> = {}): Response {
  const location = new URL(returnPath, "https://unigame.invalid"); // base is discarded — returnPath is always relative in this app
  location.searchParams.set("canvasStatus", status);
  for (const [key, value] of Object.entries(extra)) location.searchParams.set(key, value);
  // Rebuild as a relative URL (path + search) — never leak the placeholder base.
  const relative = `${location.pathname}${location.search}`;
  return new Response(null, { status: 302, headers: { location: relative } });
}

export async function GET(request: Request): Promise<Response> {
  if (!globalRateLimiter.tryConsume("global")) {
    return redirectWithStatus("/", "rate-limited");
  }
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown-client";
  if (!perClientRateLimiter.tryConsume(clientKey)) {
    return redirectWithStatus("/", "rate-limited");
  }

  const url = new URL(request.url);
  const signedState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const canvasError = url.searchParams.get("error");

  if (!signedState) return redirectWithStatus("/", "invalid-state");

  const rawState = verifySignedState(signedState);
  if (!rawState) return redirectWithStatus("/", "invalid-state");

  // Consuming is unconditional and happens exactly once, whether Canvas
  // approved or denied — a second callback with the same state (replay)
  // finds nothing and is rejected, whatever it claims.
  const pending = await canvasConnectionStore.consumePendingConnection(rawState);
  if (!pending) return redirectWithStatus("/", "state-expired");

  if (canvasError) {
    return redirectWithStatus(pending.returnPath, "denied");
  }
  if (!code) return redirectWithStatus(pending.returnPath, "error");

  const institution = findCanvasInstitution(pending.institutionId);
  if (!institution) return redirectWithStatus(pending.returnPath, "error");

  const clientId = process.env[institution.clientIdEnvVar];
  const clientSecret = process.env[institution.clientSecretEnvVar];
  const redirectUri = process.env[institution.redirectUriEnvVar];
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithStatus(pending.returnPath, "not-configured");
  }

  try {
    const tokens = await exchangeCodeForTokens(institution, {
      code,
      redirectUri,
      clientId,
      clientSecret,
      pkceVerifier: pending.pkceVerifier,
    });

    // No previous refresh token exists yet for a brand-new connection — an
    // empty placeholder is only ever used if Canvas somehow omitted
    // `refresh_token` on first authorization, which encryptTokenResponse
    // would then keep as-is; that would mean no refresh token is stored at
    // all, correctly reflected by an EMPTY encrypted value never
    // successfully decryptable — surfaced honestly if a refresh is later
    // attempted, never fabricated.
    const placeholderRefresh = encryptToken("");
    const encrypted = encryptTokenResponse(tokens, placeholderRefresh);

    const now = Date.now();
    const connection: CanvasConnectionRecord = {
      connectionId: randomUUID(),
      ownerId: pending.ownerId,
      institutionId: pending.institutionId,
      encryptedAccessToken: encrypted.accessToken,
      encryptedRefreshToken: encrypted.refreshToken,
      tokenExpiresAt: encrypted.tokenExpiresAt,
      scopes: encrypted.scopes,
      canvasUserId: tokens.user?.id !== undefined ? String(tokens.user.id) : null,
      canvasBaseUrl: institution.canvasBaseUrl,
      createdAt: now,
      updatedAt: now,
      lastSuccessfulSyncAt: null,
      reauthorisationRequiredAt: null,
      revokedAt: null,
    };
    await canvasConnectionStore.saveConnection(connection);

    return redirectWithStatus(pending.returnPath, "connected", { institutionId: pending.institutionId });
  } catch {
    // Deliberately no error detail forwarded — see canvasTokenManager.ts's
    // own discipline against logging/exposing token-exchange failure detail.
    return redirectWithStatus(pending.returnPath, "error");
  }
}
