import { config } from '../../config.js';
import type { PeeredgeClient } from './PeeredgeClient.js';
import { MockPeeredgeClient } from './MockPeeredgeClient.js';
import { RestPeeredgeClient } from './RestPeeredgeClient.js';
import { PeeredgeSession } from './PeeredgeSession.js';

export interface PeeredgeCredentials {
  email: string;
  password: string;
}

/**
 * Build a Peeredge client for one user's credentials.
 * - rest mode: authenticates as that user (login → bearer token, per the 46 Labs reference).
 * - mock mode: returns synthetic data for local UI development (credentials ignored).
 */
export function createPeeredgeClient(creds: PeeredgeCredentials): PeeredgeClient {
  if (config.PEEREDGE_SOURCE === 'rest') {
    const session = new PeeredgeSession({
      baseUrl: config.PEEREDGE_BASE_URL as string,
      slug: config.PEEREDGE_SLUG,
      loginPath: config.PEEREDGE_LOGIN_PATH,
      email: creds.email,
      password: creds.password,
    });
    return new RestPeeredgeClient(config.PEEREDGE_BASE_URL as string, session);
  }
  return new MockPeeredgeClient(creds.email);
}

export type { PeeredgeClient } from './PeeredgeClient.js';
export * from './types.js';
