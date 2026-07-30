import type { FastifyInstance } from 'fastify';
import { createUserSchema, updateUserSchema } from '../schemas/auth.js';
import type { AuthService } from '../services/authService.js';
import type { AccountStore } from '../services/accountStore.js';
import { requireAdmin } from '../middleware/auth.js';
import { getSwitchClient } from '../adapters/peeredge/index.js';
import { BadRequest } from '../lib/errors.js';

export async function adminRoutes(
  app: FastifyInstance,
  authService: AuthService,
  accounts: AccountStore,
): Promise<void> {
  app.addHook('preHandler', requireAdmin(authService));

  // ED- relationships available to allocate.
  app.get('/admin/relationships', async () => getSwitchClient().listRelationships());

  // Users.
  app.get('/admin/users', async () => accounts.list());

  app.post('/admin/users', async (req, reply) => {
    const input = createUserSchema.parse(req.body);
    try {
      const user = await accounts.create({
        email: input.email,
        password: input.password,
        role: 'user',
        relationshipId: input.relationshipId,
        relationshipName: input.relationshipName,
      });
      reply.send({ user });
    } catch (err) {
      if (err instanceof Error && err.message === 'email_exists') {
        throw BadRequest('An account with that email already exists', 'email_exists');
      }
      throw err;
    }
  });

  app.patch('/admin/users/:id', async (req) => {
    const { id } = req.params as { id: string };
    const patch = updateUserSchema.parse(req.body);
    try {
      return { user: await accounts.update(id, patch) };
    } catch (err) {
      if (err instanceof Error && err.message === 'not_found') throw BadRequest('User not found');
      throw err;
    }
  });

  app.delete('/admin/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    accounts.delete(id);
    reply.send({ ok: true });
  });
}
