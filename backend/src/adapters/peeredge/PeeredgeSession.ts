import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

/**
 * Authenticates to a PeerEdge tenant using the login → Bearer-token flow
 * documented in the 46 Labs integration reference:
 *
 *   POST https://api-<slug>.peeredge.com<loginPath>
 *   headers: Content-Type: application/json, User-Agent: <browser>, Referer: https://<slug>.peeredge.com/
 *   body:    { "user": { "email": "...", "password": "..." } }
 *   -> token is returned in the `Authorization` RESPONSE header ("Bearer <token>"),
 *      NOT the JSON body. We strip "Bearer " and cache it (~10 min TTL).
 *
 * A legacy `sessionCookie` mode is kept as a fallback for manual testing.
 */
export interface PeeredgeAuthConfig {
  baseUrl: string; // https://api-<slug>.peeredge.com
  slug: string; // <slug> (used for Referer)
  loginPath: string; // /api/v2/login (admin) or /api/v2/relationship/auth/login (carrier)
  email?: string;
  username?: string;
  password?: string;
  loginShape?: 'admin' | 'relationship';
  sessionCookie?: string; // fallback: use a raw Cookie header instead of login
}

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes, per the reference doc
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export class PeeredgeSession {
  private token: string | null = null;
  private tokenAt = 0;

  constructor(private readonly cfg: PeeredgeAuthConfig) {}

  /** Browser-like headers the PeerEdge edge requires (UA + Referer). */
  private baseHeaders(): Record<string, string> {
    return {
      'User-Agent': BROWSER_UA,
      Referer: `https://${this.cfg.slug}.peeredge.com/`,
      Accept: 'application/json, text/plain, */*',
    };
  }

  /** Full header set for an authenticated request (Bearer token or fallback cookie). */
  async requestHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers = { ...this.baseHeaders(), ...extra };
    if (this.cfg.sessionCookie) {
      headers.Cookie = this.cfg.sessionCookie;
      return headers;
    }
    headers.Authorization = `Bearer ${await this.getToken()}`;
    return headers;
  }

  /** Force a fresh login (used on 401/403). No-op in cookie mode. */
  async refresh(): Promise<void> {
    if (this.cfg.sessionCookie) return;
    this.token = null;
    await this.login();
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() - this.tokenAt < TOKEN_TTL_MS) return this.token;
    await this.login();
    return this.token as string;
  }

  private async login(): Promise<void> {
    const { baseUrl, loginPath, email, username, password } = this.cfg;
    const identity = this.cfg.loginShape === 'relationship' ? username : email;
    if (!identity || !password) {
      throw new AppError(500, 'peeredge_login_misconfig', 'Peeredge identity or password is not configured');
    }
    const url = `${baseUrl.replace(/\/$/, '')}${loginPath}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { ...this.baseHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(
          this.cfg.loginShape === 'relationship'
            ? { user_name: identity, password }
            : { user: { email: identity, password } },
        ),
      });
    } catch (err) {
      logger.error({ err }, 'PeerEdge login request failed');
      throw new AppError(502, 'peeredge_unreachable', 'PeerEdge login unreachable');
    }
    if (!res.ok) {
      // Distinguish "wrong credentials" (client sees 401) from an upstream fault (502).
      if ([400, 401, 403, 422].includes(res.status)) {
        throw new AppError(401, 'peeredge_bad_credentials', 'Invalid email or password');
      }
      throw new AppError(502, 'peeredge_login_failed', `PeerEdge login returned ${res.status}`);
    }
    // Token comes back in the Authorization RESPONSE header, not the body.
    const auth = res.headers.get('authorization');
    if (!auth) {
      throw new AppError(502, 'peeredge_login_no_token', 'PeerEdge login returned no Authorization header');
    }
    this.token = auth.replace(/^Bearer\s+/i, '').trim();
    this.tokenAt = Date.now();
    logger.info('PeerEdge session established (bearer token)');
  }
}
