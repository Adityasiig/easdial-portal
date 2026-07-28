import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

/**
 * Handles authentication to the PeerEdge relationship API.
 *
 * The API uses a session COOKIE (no API key / bearer token — confirmed from the
 * captured traffic). Two env-driven modes:
 *
 *   PEEREDGE_AUTH_MODE=cookie  -> use PEEREDGE_SESSION_COOKIE verbatim as the
 *                                 Cookie header. Simplest; the cookie expires, so
 *                                 this suits testing or a short-lived refresh job.
 *
 *   PEEREDGE_AUTH_MODE=login   -> POST PEEREDGE_EMAIL/PEEREDGE_PASSWORD to
 *                                 PEEREDGE_LOGIN_URL, capture Set-Cookie, reuse it,
 *                                 and re-login automatically on a 401.
 *
 * Secrets come only from env — never hardcoded, never logged.
 */
export interface PeeredgeAuthConfig {
  mode: 'cookie' | 'login';
  baseUrl: string;
  origin: string;
  sessionCookie?: string;
  loginUrl?: string;
  email?: string;
  password?: string;
}

export class PeeredgeSession {
  private cookie: string | null = null;

  constructor(private readonly cfg: PeeredgeAuthConfig) {
    if (cfg.mode === 'cookie') this.cookie = cfg.sessionCookie ?? null;
  }

  /** Base headers every API call needs (Origin/Referer are validated server-side). */
  baseHeaders(): Record<string, string> {
    return {
      Accept: 'application/json, text/plain, */*',
      Origin: this.cfg.origin,
      Referer: `${this.cfg.origin}/`,
    };
  }

  /** Return the current Cookie header, logging in first if needed. */
  async cookieHeader(): Promise<string> {
    if (this.cookie) return this.cookie;
    if (this.cfg.mode === 'login') {
      await this.login();
      if (this.cookie) return this.cookie;
    }
    throw new AppError(
      500,
      'peeredge_no_session',
      'No PeerEdge session available (set PEEREDGE_SESSION_COOKIE or login creds)',
    );
  }

  /** Force a fresh login (used on 401). No-op in cookie mode. */
  async refresh(): Promise<void> {
    if (this.cfg.mode === 'login') {
      this.cookie = null;
      await this.login();
    }
  }

  private async login(): Promise<void> {
    const { loginUrl, email, password } = this.cfg;
    if (!loginUrl || !email || !password) {
      throw new AppError(500, 'peeredge_login_misconfig', 'Login mode missing URL/credentials');
    }
    // NOTE: exact payload field names must be confirmed by capturing the login
    // request (log out -> record -> log in). Adjust the body below to match.
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { ...this.baseHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new AppError(502, 'peeredge_login_failed', `PeerEdge login returned ${res.status}`);
    }
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new AppError(502, 'peeredge_login_no_cookie', 'PeerEdge login returned no Set-Cookie');
    }
    // Keep only the "name=value" pairs for the Cookie header.
    this.cookie = setCookie
      .split(/,(?=[^;]+?=)/)
      .map((c) => c.split(';')[0].trim())
      .join('; ');
    logger.info('PeerEdge session established via login');
  }
}
