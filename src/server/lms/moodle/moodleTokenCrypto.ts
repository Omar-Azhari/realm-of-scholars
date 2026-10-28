/**
 * Moodle token encryption at rest (Phase 18F, Part 5). A thin wrapper over
 * the same generic, reviewed AES-256-GCM core Canvas's
 * `canvasTokenCrypto.ts` uses (`src/server/security/tokenCrypto.ts`) — no
 * duplicated cryptography, per the brief's explicit instruction. Uses an
 * INDEPENDENT key from Canvas's (`MOODLE_TOKEN_ENCRYPTION_KEY`, not
 * `CANVAS_TOKEN_ENCRYPTION_KEY`), so rotating or compromising one never
 * affects the other. Read fresh from `process.env` on every call, never
 * cached at module load.
 */

import { createTokenCrypto, constantTimeEqual, CURRENT_KEY_VERSION, TokenEncryptionError, type EncryptedValue } from "../../security/tokenCrypto";

export { CURRENT_KEY_VERSION, TokenEncryptionError, constantTimeEqual, type EncryptedValue };

const moodleCrypto = createTokenCrypto("MOODLE_TOKEN_ENCRYPTION_KEY");

/** True only when a syntactically valid 32-byte key is configured — never assumed. */
export function isMoodleTokenEncryptionConfigured(): boolean {
  return moodleCrypto.isConfigured();
}

export function encryptMoodleToken(plaintext: string): EncryptedValue {
  return moodleCrypto.encrypt(plaintext);
}

/** Throws TokenEncryptionError on any tampering (auth-tag mismatch) or misconfiguration — never returns a partially-decrypted or guessed value. */
export function decryptMoodleToken(value: EncryptedValue): string {
  return moodleCrypto.decrypt(value);
}
