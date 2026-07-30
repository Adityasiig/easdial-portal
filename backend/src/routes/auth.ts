import type { FastifyInstance } from 'fastify';
import { loginSchema } from '../schemas/auth.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

export async function authRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  // Sign in with real Peeredge carrier credentials.
  app.post('/auth/login', async (req) => {
    const { email, password } = loginSchema.parse(req.body);
    return authService.login(email, password);
  });

  // Current session identity.
  app.get('/auth/me', { preHandler: requireAuth(authService) }, async (req) => ({
    user: req.userSession!.identity,
  }));

  // End the session.
  app.post('/auth/logout', { preHandler: requireAuth(authService) }, async (req, reply) => {
    authService.logout(req.headers.authorization!.slice(7));
    reply.send({ ok: true });
  });
}
