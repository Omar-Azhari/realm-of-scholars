/**
 * Token encryption at rest (Phase 18E, Part 4/20). A thin wrapper over the
 * generic, reusable AES-256-GCM core (`src/server/security/tokenCrypto.ts`,
 * extracted in Phase 18F so Moodle credentials can reuse the exact same
 * reviewed implementation instead of a duplicate one — see that file's
 * header). This file's public API (names, signatures, behaviour) is
 * UNCHANGED from before that extraction — no existing call site or test
 * needed to change.
 *
 * The encryption key is read from `process.env.CANVAS_TOKEN_ENCRYPTION_KEY`
 * fresh on every call — never cached at module load (the exact bug Phase
 * 18C found and fixed in `ssrfGuard.ts`'s localhost-allow flag). It is
 * expected to be a base64-encoded 32-byte (256-bit) key, generated once by
 * an administrator (see the deployment doc for the exact command) and
 * never committed to source control.
 */

import { createTokenCrypto, constantTimeEqual, CURRENT_KEY_VERSION, TokenEncryptionError, type EncryptedValue } from "../../security/tokenCrypto";

export { CURRENT_KEY_VERSION, TokenEncryptionError, constantTimeEqual, type EncryptedValue };

const canvasCrypto = createTokenCrypto("CANVAS_TOKEN_ENCRYPTION_KEY");

/** True only when a syntactically valid 32-byte key is configured — never assumed. */
export function isTokenEncryptionConfigured(): boolean {
  return canvasCrypto.isConfigured();
}

export function encryptToken(plaintext: string): EncryptedValue {
  return canvasCrypto.encrypt(plaintext);
}

/** Throws TokenEncryptionError on any tampering (auth-tag mismatch) or misconfiguration — never returns a partially-decrypted or guessed value. */
export function decryptToken(value: EncryptedValue): string {
  return canvasCrypto.decrypt(value);
}
