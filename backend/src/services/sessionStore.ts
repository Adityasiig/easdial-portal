import { randomBytes } from 'node:crypto';
import type { PeeredgeClient } from '../adapters/peeredge/index.js';

/** Who the authenticated user is, as reported by Peeredge (`/me`). */
export interface Identity {
  email: string;
  name: string;
  relationshipId: string;
}

/**
 * A live login. Holds the per-user Peeredge client (which carries that user's
 * bearer token + credentials for silent re-login). Server-side only — never
 * serialized to the browser.
 */
export interface Session {
  id: string;
  identity: Identity;
  client: PeeredgeClient;
  createdAt: number;
}

const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * In-memory session registry. The EasDial JWT only carries the session id; the
 * Peeredge token/credentials live here, in memory, and are dropped on logout,
 * expiry, or restart.
 */
export class SessionStore {
  private sessions = new Map<string, Session>();

  create(identity: Identity, client: PeeredgeClient): Session {
    const session: Session = {
      id: randomBytes(24).toString('hex'),
      identity,
      client,
      createdAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    this.sweep();
    return session;
  }

  get(id: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (Date.now() - session.createdAt > TTL_MS) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.createdAt > TTL_MS) this.sessions.delete(id);
    }
  }
}
