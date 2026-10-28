/**
 * Generic authenticated-encryption-at-rest core (extracted in Phase 18F from
 * Phase 18E's `canvasTokenCrypto.ts`, so Moodle credentials reuse the exact
 * same, already-reviewed AES-256-GCM logic instead of a duplicated
 * implementation — "do not duplicate cryptography" applies as much to this
 * project's own code as to a home-grown cipher). Uses `node:crypto`'s
 * built-in AES-256-GCM directly — a trusted runtime primitive. Authenticated
 * encryption (GCM's auth tag detects any tampering with the ciphertext), a
 * unique random nonce per encrypted value (never reused), and explicit
 * key-version metadata so a future re-key doesn't silently break existing
 * encrypted values.
 *
 * Each caller supplies its OWN environment-variable name via
 * `createTokenCrypto(envVarName)` — Canvas and Moodle credentials are
 * encrypted under independent keys (`CANVAS_TOKEN_ENCRYPTION_KEY` vs
 * `MOODLE_TOKEN_ENCRYPTION_KEY`), so rotating or compromising one never
 * affects the other, while both share this one reviewed implementation.
 * `canvasTokenCrypto.ts` wraps this factory with its exact original public
 * API (unchanged names/signatures/behaviour) so no existing Canvas call
 * site or test needed to change.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const NONCE_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
export const CURRENT_KEY_VERSION = 1;

export interface EncryptedValue {
  ciphertext: string; // base64
  nonce: string; // base64
  authTag: string; // base64
  keyVersion: number;
}

export class TokenEncryptionError extends Error {}

export interface TokenCrypto {
  isConfigured(): boolean;
  encrypt(plaintext: string): EncryptedValue;
  decrypt(value: EncryptedValue): string;
}

export function createTokenCrypto(envVarName: string): TokenCrypto {
  function getKey(): Buffer {
    const raw = process.env[envVarName];
    if (!raw) {
      throw new TokenEncryptionError(`${envVarName} is not configured — token storage is unavailable.`);
    }
    let key: Buffer;
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new TokenEncryptionError(`${envVarName} is not valid base64.`);
    }
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new TokenEncryptionError(`${envVarName} must decode to exactly ${KEY_LENGTH_BYTES} bytes, got ${key.length}.`);
    }
    return key;
  }

  return {
    isConfigured(): boolean {
      try {
        getKey();
        return true;
      } catch {
        return false;
      }
    },
    encrypt(plaintext: string): EncryptedValue {
      const key = getKey();
      const nonce = randomBytes(NONCE_LENGTH_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, nonce);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return {
        ciphertext: ciphertext.toString("base64"),
        nonce: nonce.toString("base64"),
        authTag: authTag.toString("base64"),
        keyVersion: CURRENT_KEY_VERSION,
      };
    },
    decrypt(value: EncryptedValue): string {
      if (value.keyVersion !== CURRENT_KEY_VERSION) {
        throw new TokenEncryptionError(`Unsupported key version ${value.keyVersion} (current is ${CURRENT_KEY_VERSION}) — this value needs re-encryption under a version-aware decrypt path before it can be read.`);
      }
      const key = getKey();
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(value.nonce, "base64"));
      decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
      try {
        const plaintext = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]);
        return plaintext.toString("utf8");
      } catch {
        throw new TokenEncryptionError("Decryption failed — the encrypted value may have been tampered with or the key is wrong.");
      }
    },
  };
}

/** Constant-time string comparison — for state/signature/token checks where a timing side-channel could leak information one byte at a time. Returns false (never throws) on any length mismatch. Provider-neutral: takes no env var, so both Canvas and Moodle code use this one directly. */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
