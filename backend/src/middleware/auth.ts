import type { FastifyReply, FastifyRequest } from 'fastify';
import { Unauthorized } from '../lib/errors.js';
import type { AuthService } from '../services/authService.js';
import type { Session } from '../services/sessionStore.js';

declare module 'fastify' {
  interface FastifyRequest {
    userSession?: Session;
  }
}

/** Factory producing a preHandler that requires a valid EasDial bearer token. */
export function requireAuth(authService: AuthService) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');
    req.userSession = authService.verify(header.slice(7));
  };
}
