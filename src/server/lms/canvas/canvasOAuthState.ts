/**
 * OAuth state signing + PKCE (Phase 18E, Part 3/20). Two independent layers
 * of CSRF/replay protection, both required, neither substituting for the
 * other:
 *
 *  - The `state` value is cryptographically random (unguessable) AND
 *    HMAC-signed with a server-only secret (tamper-evident) — even if an
 *    attacker could somehow enumerate pending-connection keys in the
 *    connection store, they could not forge a signature without the secret.
 *  - The connection store's `createPendingConnection`/`consumePendingConnection`
 *    (see canvasConnectionStore.ts) adds the THIRD layer: one-time
 *    consumption + a short expiry, so even a validly-signed state can't be
 *    replayed twice or used after it goes stale.
 *
 * PKCE (`code_verifier`/`code_challenge`) is generated per Canvas's
 * documented S256 support — used here as defense-in-depth even though this
 * is a confidential (server-side) OAuth client, since it costs nothing and
 * further binds the authorization code to this exact request.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_ENTROPY_BYTES = 32;
const PKCE_VERIFIER_BYTES = 32;

export function generateState(): string {
  return randomBytes(STATE_ENTROPY_BYTES).toString("base64url");
}

function getStateSecret(): Buffer {
  const raw = process.env.CANVAS_OAUTH_STATE_SECRET;
  if (!raw) throw new Error("CANVAS_OAUTH_STATE_SECRET is not configured — Canvas OAuth is unavailable.");
  return Buffer.from(raw, "utf8");
}

export function isOAuthStateSigningConfigured(): boolean {
  return Boolean(process.env.CANVAS_OAUTH_STATE_SECRET);
}

/** Appends an HMAC-SHA256 signature to a random state value — this is the value actually sent to Canvas as `state`. */
export function signState(state: string): string {
  const signature = createHmac("sha256", getStateSecret()).update(state).digest("base64url");
  return `${state}.${signature}`;
}

/** Verifies the signature (constant-time) and returns the original random state, or null if the signature is missing/malformed/wrong — never throws on bad input, so a malicious callback query param can't crash the handler. */
export function verifySignedState(signedState: string): string | null {
  const dotIndex = signedState.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === signedState.length - 1) return null;
  const state = signedState.slice(0, dotIndex);
  const signature = signedState.slice(dotIndex + 1);

  let expected: string;
  try {
    expected = createHmac("sha256", getStateSecret()).update(state).digest("base64url");
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  return state;
}

export function generatePkceVerifier(): string {
  return randomBytes(PKCE_VERIFIER_BYTES).toString("base64url");
}

export function derivePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export { timingSafeEqual };
