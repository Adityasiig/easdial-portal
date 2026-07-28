import type { FastifyReply, FastifyRequest } from 'fastify';
import { Unauthorized } from '../lib/errors.js';
import type { AuthService, AuthTokenPayload } from '../services/authService.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthTokenPayload;
  }
}

/** Factory producing a preHandler that requires a valid Bearer token. */
export function requireAuth(authService: AuthService) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');
    req.auth = authService.verify(header.slice(7));
  };
}
