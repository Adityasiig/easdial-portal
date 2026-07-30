import type { FastifyInstance } from 'fastify';
import { loginSchema } from '../schemas/auth.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { toPublic } from '../services/accountStore.js';

export async function authRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.post('/auth/login', async (req) => {
    const { email, password } = loginSchema.parse(req.body);
    return authService.login(email, password);
  });

  app.get('/auth/me', { preHandler: requireAuth(authService) }, async (req) => ({
    user: toPublic(req.account!),
  }));

  // Stateless JWT — logout is handled client-side by dropping the token.
  app.post('/auth/logout', async (_req, reply) => reply.send({ ok: true }));
}
