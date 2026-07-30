import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError, Unauthorized } from '../lib/errors.js';
import { createPeeredgeClient } from '../adapters/peeredge/index.js';
import type { Session, SessionStore } from './sessionStore.js';

/**
 * Authentication by pass-through to Peeredge: the user signs in with their real
 * Peeredge carrier credentials, we verify them against Peeredge, and hold their
 * session server-side. The browser only ever receives an opaque EasDial JWT that
 * references the server-side session — never the Peeredge token or password.
 */
export class AuthService {
  constructor(private readonly sessions: SessionStore) {}

  /** Verify credentials against Peeredge and open a session. */
  async login(email: string, password: string): Promise<{ token: string; user: Session['identity'] }> {
    const client = createPeeredgeClient({ email: email.trim(), password });

    let identity: Session['identity'];
    try {
      identity = await client.whoami(); // performs the Peeredge login
    } catch (err) {
      // Wrong credentials → 401 for the user; genuine upstream faults surface as-is.
      if (err instanceof AppError && err.statusCode === 401) {
        throw Unauthorized('Invalid email or password');
      }
      throw err;
    }

    const session = this.sessions.create(identity, client);
    const signOptions = { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions;
    const token = jwt.sign({ sub: session.id }, config.JWT_SECRET, signOptions);
    return { token, user: identity };
  }

  /** Resolve a bearer token to its live session, or throw 401. */
  verify(token: string): Session {
    let sessionId: string;
    try {
      sessionId = (jwt.verify(token, config.JWT_SECRET) as { sub: string }).sub;
    } catch {
      throw Unauthorized('Invalid or expired session');
    }
    const session = this.sessions.get(sessionId);
    if (!session) throw Unauthorized('Session expired — please sign in again');
    return session;
  }

  /** End a session (best-effort — an invalid token is a no-op). */
  logout(token: string): void {
    try {
      const sessionId = (jwt.verify(token, config.JWT_SECRET) as { sub: string }).sub;
      this.sessions.delete(sessionId);
    } catch {
      /* already invalid */
    }
  }
}
