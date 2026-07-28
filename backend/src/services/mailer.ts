import { logger } from '../lib/logger.js';
import { config } from '../config.js';

/**
 * Transactional email seam. Phase 1 logs the branded invite/reset link so the
 * flow is fully testable without an email provider. Swap `send` for SES /
 * Postmark / SendGrid in Phase 2 — callers don't change.
 */
export interface Mailer {
  sendPasswordSetup(to: string, rawToken: string, purpose: 'invite' | 'reset'): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async sendPasswordSetup(
    to: string,
    rawToken: string,
    purpose: 'invite' | 'reset',
  ): Promise<void> {
    const link = `${config.PORTAL_BASE_URL}/set-password?token=${rawToken}`;
    const verb = purpose === 'invite' ? 'Set up your EasDial portal password' : 'Reset your password';
    logger.info(
      { to, purpose },
      `[EasDial email] To: ${to} — ${verb}\n  ${link}\n  (Phase 1: link logged, not emailed.)`,
    );
  }
}

export const mailer: Mailer = new ConsoleMailer();
