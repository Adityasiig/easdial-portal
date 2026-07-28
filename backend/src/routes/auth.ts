import type { FastifyInstance } from 'fastify';
import {
  inviteSchema,
  loginSchema,
  requestResetSchema,
  setPasswordSchema,
} from '../schemas/auth.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { Forbidden } from '../lib/errors.js';

export async function authRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.post('/auth/login', async (req) => {
    const { email, password } = loginSchema.parse(req.body);
    return authService.login(email, password);
  });

  app.post('/auth/set-password', async (req, reply) => {
    const { token, password } = setPasswordSchema.parse(req.body);
    await authService.setPassword(token, password);
    reply.send({ ok: true });
  });

  app.post('/auth/request-reset', async (req, reply) => {
    const { email } = requestResetSchema.parse(req.body);
    await authService.requestReset(email);
    // Always 200 — never reveal whether the email exists.
    reply.send({ ok: true });
  });

  // Admin-only: invite/create a carrier user.
  app.post('/auth/invite', { preHandler: requireAuth(authService) }, async (req, reply) => {
    if (req.auth?.role !== 'admin') throw Forbidden('Admin role required');
    const { email, relationshipId, brand } = inviteSchema.parse(req.body);
    await authService.invite(email, relationshipId, brand);
    reply.send({ ok: true });
  });

  // Current session info.
  app.get('/auth/me', { preHandler: requireAuth(authService) }, async (req) => ({
    user: req.auth,
  }));
}
