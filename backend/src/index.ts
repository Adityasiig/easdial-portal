import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import type { PeeredgeClient } from './PeeredgeClient.js';
import { MockPeeredgeClient } from './MockPeeredgeClient.js';
import { RestPeeredgeClient } from './RestPeeredgeClient.js';
import { PeeredgeSession } from './PeeredgeSession.js';

let instance: PeeredgeClient | null = null;

/** Factory — selects the data source from config. Singleton per process. */
export function getPeeredgeClient(): PeeredgeClient {
  if (instance) return instance;

  if (config.PEEREDGE_SOURCE === 'rest') {
    logger.info(`Peeredge data source: REST (live, auth=${config.PEEREDGE_AUTH_MODE})`);
    const session = new PeeredgeSession({
      mode: config.PEEREDGE_AUTH_MODE,
      baseUrl: config.PEEREDGE_BASE_URL as string,
      origin: config.PEEREDGE_ORIGIN,
      sessionCookie: config.PEEREDGE_SESSION_COOKIE,
      loginUrl: config.PEEREDGE_LOGIN_URL || undefined,
      email: config.PEEREDGE_EMAIL,
      password: config.PEEREDGE_PASSWORD,
    });
    instance = new RestPeeredgeClient(config.PEEREDGE_BASE_URL as string, session);
  } else {
    logger.info('Peeredge data source: MOCK (synthetic data)');
    instance = new MockPeeredgeClient();
  }
  return instance;
}

export type { PeeredgeClient } from './PeeredgeClient.js';
export * from './types.js';
