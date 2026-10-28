/**
 * Canvas connection storage (Phase 18E, Part 4). Defines the durable
 * interface every real deployment needs, plus an in-memory adapter that
 * proves the interface and every OAuth code path deterministically but is
 * NOT production-durable — it is per-process memory, lost on every cold
 * start/restart, and never shared across concurrent Vercel Function
 * instances, exactly like `cache.ts`/`rateLimiter.ts`'s existing honest
 * caveat. See docs/PHASE_18E_CANVAS_INTEGRATION.md §1/§13/§15: this
 * codebase has no durable database or key-value store today, so a real
 * production adapter (Vercel KV, Upstash Redis, Postgres, etc.) is
 * deliberately left unimplemented and documented rather than faked.
 *
 * Tokens are stored ONLY in their already-encrypted `EncryptedValue` form
 * (see canvasTokenCrypto.ts) — this module never sees, logs, or returns a
 * plaintext token; encryption/decryption happens in canvasTokenManager.ts,
 * one layer above.
 */

import type { EncryptedValue } from "./canvasTokenCrypto";

export interface PendingCanvasConnection {
  /** The unsigned, random half of the state value — see canvasOAuthState.ts. */
  state: string;
  institutionId: string;
  /** Validated against an in-app path allowlist before this record is created — never stored unchecked. */
  returnPath: string;
  pkceVerifier: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
}

export interface CanvasConnectionRecord {
  connectionId: string;
  ownerId: string;
  institutionId: string;
  encryptedAccessToken: EncryptedValue;
  encryptedRefreshToken: EncryptedValue;
  /** Epoch ms. */
  tokenExpiresAt: number;
  scopes: string[];
  canvasUserId: string | null;
  canvasBaseUrl: string;
  createdAt: number;
  updatedAt: number;
  lastSuccessfulSyncAt: number | null;
  reauthorisationRequiredAt: number | null;
  revokedAt: number | null;
}

export interface CanvasConnectionStore {
  createPendingConnection(pending: PendingCanvasConnection): Promise<void>;
  /** One-time read: removes the pending connection so a replayed callback with the same state finds nothing. Returns null if the state is unknown OR already expired (expired entries are treated as absent, then evicted). */
  consumePendingConnection(state: string): Promise<PendingCanvasConnection | null>;
  saveConnection(record: CanvasConnectionRecord): Promise<void>;
  getConnection(connectionId: string): Promise<CanvasConnectionRecord | null>;
  getConnectionForOwnerAndInstitution(ownerId: string, institutionId: string): Promise<CanvasConnectionRecord | null>;
  /**
   * Applies `updater` to the current record and saves the result — the
   * ENTIRE updater call (which may itself await a network refresh call)
   * runs inside a per-connectionId lock, so two concurrent refresh attempts
   * for the SAME connection can never race (Part 3: "do not refresh
   * multiple times concurrently for the same connection") — the second
   * caller's updater only starts once the first's has fully finished and
   * saved. Returns null if the connection doesn't exist.
   */
  updateTokensAtomically(
    connectionId: string,
    updater: (current: CanvasConnectionRecord) => Promise<CanvasConnectionRecord>
  ): Promise<CanvasConnectionRecord | null>;
  markReauthorisationRequired(connectionId: string): Promise<void>;
  /** Soft-revoke: marks `revokedAt`, keeps the record (e.g. for audit / "when was this disconnected" reporting) but the connection must never be usable for a live API call again. */
  revokeConnection(connectionId: string): Promise<void>;
  /** Hard-remove: the record no longer exists at all. */
  deleteConnection(connectionId: string): Promise<void>;
  listConnectionsForUser(ownerId: string): Promise<CanvasConnectionRecord[]>;
}

/** How long a pending connection (state issued, callback not yet received) stays valid — used by the /connect handler when constructing a PendingCanvasConnection's expiresAt. 10 minutes: long enough for a real user to complete Canvas's login/consent screen, short enough to bound replay risk. */
export const PENDING_CONNECTION_TTL_MS = 10 * 60_000;

export class InMemoryCanvasConnectionStore implements CanvasConnectionStore {
  private readonly pending = new Map<string, PendingCanvasConnection>();
  private readonly connections = new Map<string, CanvasConnectionRecord>();
  private readonly locks = new Map<string, Promise<void>>();

  async createPendingConnection(pending: PendingCanvasConnection): Promise<void> {
    this.pending.set(pending.state, pending);
  }

  async consumePendingConnection(state: string): Promise<PendingCanvasConnection | null> {
    const entry = this.pending.get(state);
    // Always delete on read attempt — a replayed callback (valid state used
    // twice) must find nothing the second time, whether or not the first
    // read succeeded.
    this.pending.delete(state);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  async saveConnection(record: CanvasConnectionRecord): Promise<void> {
    this.connections.set(record.connectionId, record);
  }

  async getConnection(connectionId: string): Promise<CanvasConnectionRecord | null> {
    return this.connections.get(connectionId) ?? null;
  }

  async getConnectionForOwnerAndInstitution(ownerId: string, institutionId: string): Promise<CanvasConnectionRecord | null> {
    for (const record of this.connections.values()) {
      if (record.ownerId === ownerId && record.institutionId === institutionId && !record.revokedAt) return record;
    }
    return null;
  }

  /** A simple per-key promise chain — the next caller's work only starts after the previous caller's finished, giving single-flight semantics without a real distributed lock (fine for one in-memory instance; a real production adapter over a shared store would need a real lock, e.g. a conditional-write). */
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

  async updateTokensAtomically(
    connectionId: string,
    updater: (current: CanvasConnectionRecord) => Promise<CanvasConnectionRecord>
  ): Promise<CanvasConnectionRecord | null> {
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

  async listConnectionsForUser(ownerId: string): Promise<CanvasConnectionRecord[]> {
    return [...this.connections.values()].filter((r) => r.ownerId === ownerId);
  }

  /** Test/diagnostic only — not part of the interface. */
  get pendingCount(): number {
    return this.pending.size;
  }
}

// Module-level singleton — same per-instance scoping caveat as
// src/server/cache.ts's BoundedCache and rateLimiter.ts's RateLimiter.
// Swap this for a real durable adapter (implementing the same
// CanvasConnectionStore interface) before relying on Canvas OAuth in a
// real multi-instance production deployment — see PENDING_CONNECTION_TTL_MS
// comment and the deployment doc for what that requires.
export const canvasConnectionStore: CanvasConnectionStore = new InMemoryCanvasConnectionStore();
