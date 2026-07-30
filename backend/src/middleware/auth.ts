import type { FastifyReply, FastifyRequest } from 'fastify';
import { Forbidden, Unauthorized } from '../lib/errors.js';
import type { AuthService } from '../services/authService.js';
import type { Account } from '../services/accountStore.js';

declare module 'fastify' {
  interface FastifyRequest {
    account?: Account;
  }
}

function resolve(authService: AuthService, req: FastifyRequest): Account {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');
  return authService.verify(header.slice(7));
}

/** Require a valid session (any role). */
export function requireAuth(authService: AuthService) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    req.account = resolve(authService, req);
  };
}

/** Require an admin session. */
export function requireAdmin(authService: AuthService) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const account = resolve(authService, req);
    if (account.role !== 'admin') throw Forbidden('Admin only');
    req.account = account;
  };
}
