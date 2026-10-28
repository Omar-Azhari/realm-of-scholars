/**
 * Moodle connection storage (Phase 18F, Part 5). Modelled directly on
 * `canvasConnectionStore.ts`'s proven architecture — same in-memory-only,
 * per-process, non-production-durable honesty (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §17 and Phase 18E's own
 * §1/§13/§15 for the underlying reason: this codebase has no durable
 * database or key-value store today).
 *
 * Tokens are stored ONLY in their already-encrypted `EncryptedValue` form
 * (see moodleTokenCrypto.ts) — this module never sees, logs, or returns a
 * plaintext credential; encryption/decryption happens one layer above, in
 * moodleClient.ts/the connection-validation flow.
 *
 * `createPendingConnection`/`consumePendingConnection` exist for interface
 * parity with Canvas's store and forward-compatibility with a possible
 * future OAuth-capable Moodle deployment (Phase 18G, if an institution ever
 * installs a third-party OAuth-server plugin — see the architecture doc
 * §3/§17) — no current route calls them, since this phase's confirmed
 * connection mode (§5 of the architecture doc) is a directly-submitted,
 * institution-issued token with no redirect/callback dance to mediate.
 */

import type { EncryptedValue } from "./moodleTokenCrypto";

export type MoodleCredentialType = "institution-token";

export interface PendingMoodleConnection {
  state: string;
  institutionId: string;
  returnPath: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
}

export interface MoodleConnectionRecord {
  connectionId: string;
  ownerId: string;
  institutionId: string;
  moodleBaseUrl: string;
  encryptedCredential: EncryptedValue;
  credentialType: MoodleCredentialType;
  /** Epoch ms, or null when Moodle reports no expiry for this token. */
  credentialExpiresAt: number | null;
  /** Enabled web-service function names this token actually permits — read from core_webservice_get_site_info, never assumed. */
  enabledFunctions: string[];
  moodleUserId: string | null;
  moodleSiteName: string | null;
  createdAt: number;
  updatedAt: number;
  lastSuccessfulSyncAt: number | null;
  reauthorisationRequiredAt: number | null;
  revokedAt: number | null;
}

export interface MoodleConnectionStore {
  createPendingConnection(pending: PendingMoodleConnection): Promise<void>;
  /** One-time read: removes the pending connection so a replayed callback with the same state finds nothing. Returns null if the state is unknown OR already expired. */
  consumePendingConnection(state: string): Promise<PendingMoodleConnection | null>;
  saveConnection(record: MoodleConnectionRecord): Promise<void>;
  getConnection(connectionId: string): Promise<MoodleConnectionRecord | null>;
  getConnectionForOwnerAndInstitution(ownerId: string, institutionId: string): Promise<MoodleConnectionRecord | null>;
  /**
   * Applies `updater` to the current record and saves the result — the
   * ENTIRE updater call runs inside a per-connectionId lock, so two
   * concurrent credential-refresh attempts for the SAME connection can
   * never race (same discipline as Canvas's `updateTokensAtomically`).
   * Returns null if the connection doesn't exist.
   */
  updateCredentialAtomically(
    connectionId: string,
    updater: (current: MoodleConnectionRecord) => Promise<MoodleConnectionRecord>
  ): Promise<MoodleConnectionRecord | null>;
  markReauthorisationRequired(connectionId: string): Promise<void>;
  /** Soft-revoke: marks `revokedAt`, keeps the record, but it must never be usable for a live API call again. */
  revokeConnection(connectionId: string): Promise<void>;
  /** Hard-remove: the record no longer exists at all. */
  deleteConnection(connectionId: string): Promise<void>;
  listConnectionsForOwner(ownerId: string): Promise<MoodleConnectionRecord[]>;
}

/** Same 10-minute bound as Canvas's PENDING_CONNECTION_TTL_MS, for whichever future flow ever creates a pending Moodle connection (see file header). */
export const PENDING_MOODLE_CONNECTION_TTL_MS = 10 * 60_000;

export class InMemoryMoodleConnectionStore implements MoodleConnectionStore {
  private readonly pending = new Map<string, PendingMoodleConnection>();
  private readonly connections = new Map<string, MoodleConnectionRecord>();
  private readonly locks = new Map<string, Promise<void>>();

  async createPendingConnection(pending: PendingMoodleConnection): Promise<void> {
    this.pending.set(pending.state, pending);
  }

  async consumePendingConnection(state: string): Promise<PendingMoodleConnection | null> {
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  async saveConnection(record: MoodleConnectionRecord): Promise<void> {
    this.connections.set(record.connectionId, record);
  }

  async getConnection(connectionId: string): Promise<MoodleConnectionRecord | null> {
    return this.connections.get(connectionId) ?? null;
  }

  async getConnectionForOwnerAndInstitution(ownerId: string, institutionId: string): Promise<MoodleConnectionRecord | null> {
    for (const record of this.connections.values()) {
      if (record.ownerId === ownerId && record.institutionId === institutionId && !record.revokedAt) return record;
    }
    return null;
  }

  /** Same per-key promise-chain single-flight pattern as Canvas's store — fine for one in-memory instance; a real production adapter over a shared store would need a real lock (e.g. a conditional write). */
  private async withLock<T>(connectionId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(connectionId) ?? Promise.resolve();
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      connectionId,
      previous.then(() => next)
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async updateCredentialAtomically(
    connectionId: string,
    updater: (current: MoodleConnectionRecord) => Promise<MoodleConnectionRecord>
  ): Promise<MoodleConnectionRecord | null> {
    return this.withLock(connectionId, async () => {
      const current = this.connections.get(connectionId);
      if (!current) return null;
      const updated = await updater(current);
      this.connections.set(connectionId, updated);
      return updated;
    });
  }

  async markReauthorisationRequired(connectionId: string): Promise<void> {
    const current = this.connections.get(connectionId);
    if (!current) return;
    this.connections.set(connectionId, { ...current, reauthorisationRequiredAt: Date.now(), updatedAt: Date.now() });
  }

  async revokeConnection(connectionId: string): Promise<void> {
    const current = this.connections.get(connectionId);
    if (!current) return;
    this.connections.set(connectionId, { ...current, revokedAt: Date.now(), updatedAt: Date.now() });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async listConnectionsForOwner(ownerId: string): Promise<MoodleConnectionRecord[]> {
    return [...this.connections.values()].filter((r) => r.ownerId === ownerId);
  }

  /** Test/diagnostic only — not part of the interface. */
  get pendingCount(): number {
    return this.pending.size;
  }
}

// Module-level singleton — same per-instance scoping caveat as Canvas's
// canvasConnectionStore. Swap this for a real durable adapter (implementing
// the same MoodleConnectionStore interface) before relying on the Moodle
// token path in a real multi-instance production deployment.
export const moodleConnectionStore: MoodleConnectionStore = new InMemoryMoodleConnectionStore();
