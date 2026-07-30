import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { metricsRoutes } from './routes/metrics.js';
import { AuthService } from './services/authService.js';
import { AccountStore } from './services/accountStore.js';

export interface BuiltServer {
  app: FastifyInstance;
  accounts: AccountStore;
  authService: AuthService;
}

export async function buildServer(): Promise<BuiltServer> {
  const app = Fastify({ logger: false });
  const accounts = new AccountStore();
  await accounts.init();
  const authService = new AuthService(accounts);

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
  app.setErrorHandler(errorHandler);

  await app.register(async (a) => healthRoutes(a));
  await app.register(async (a) => authRoutes(a, authService));
  await app.register(async (a) => adminRoutes(a, authService, accounts));
  await app.register(async (a) => metricsRoutes(a, authService));

  return { app, accounts, authService };
}
