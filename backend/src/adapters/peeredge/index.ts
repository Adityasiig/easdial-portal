import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import type { SwitchDataClient } from './SwitchDataClient.js';
import { MockSwitchClient } from './MockSwitchClient.js';
import { AdminRestClient } from './AdminRestClient.js';
import { PeeredgeSession } from './PeeredgeSession.js';

let instance: SwitchDataClient | null = null;

/** Singleton switch client — one admin service login serves the whole portal. */
export function getSwitchClient(): SwitchDataClient {
  if (instance) return instance;
  if (config.PEEREDGE_SOURCE === 'rest') {
    logger.info('Switch data source: REST (admin service login)');
    const session = new PeeredgeSession({
      baseUrl: config.PEEREDGE_BASE_URL as string,
      slug: config.PEEREDGE_SLUG,
      loginPath: config.PEEREDGE_ADMIN_LOGIN_PATH,
      email: config.PEEREDGE_ADMIN_EMAIL,
      password: config.PEEREDGE_ADMIN_PASSWORD,
    });
    instance = new AdminRestClient(config.PEEREDGE_BASE_URL as string, session, config.PEEREDGE_BRAND_PREFIX);
  } else {
    logger.info('Switch data source: MOCK');
    instance = new MockSwitchClient();
  }
  return instance;
}

export type { SwitchDataClient } from './SwitchDataClient.js';
export * from './types.js';
