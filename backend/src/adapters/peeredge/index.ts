import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import type { SwitchDataClient } from './SwitchDataClient.js';
import { MockSwitchClient } from './MockSwitchClient.js';
import { AdminRestClient } from './AdminRestClient.js';
import { PeeredgeSession } from './PeeredgeSession.js';
import { RelationshipRestClient } from './RelationshipRestClient.js';

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
  } else if (config.PEEREDGE_SOURCE === 'relationship') {
    logger.info('Switch data source: REST (single relationship login)');
    const relationshipBase = `${(config.PEEREDGE_BASE_URL as string).replace(/\/$/, '')}/api/v2/relationship`;
    const session = new PeeredgeSession({
      baseUrl: relationshipBase,
      slug: config.PEEREDGE_SLUG,
      loginPath: config.PEEREDGE_RELATIONSHIP_LOGIN_PATH,
      username: config.PEEREDGE_RELATIONSHIP_USERNAME,
      password: config.PEEREDGE_RELATIONSHIP_PASSWORD,
      loginShape: 'relationship',
    });
    instance = new RelationshipRestClient(relationshipBase, session, config.PEEREDGE_RELATIONSHIP_NAME);
  } else {
    logger.info('Switch data source: MOCK');
    instance = new MockSwitchClient();
  }
  return instance;
}

export type { SwitchDataClient } from './SwitchDataClient.js';
export * from './types.js';
