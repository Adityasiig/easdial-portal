import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { metricsRoutes } from './routes/metrics.js';
import { AuthService } from './services/authService.js';
import { InMemoryUserStore, type UserStore } from './services/userStore.js';
import { mailer } from './services/mailer.js';

export interface BuiltServer {
  app: FastifyInstance;
  store: UserStore;
  authService: AuthService;
}

/** Compose the app. Store is injected so tests can swap it. */
export async function buildServer(store: UserStore = new InMemoryUserStore()): Promise<BuiltServer> {
  const app = Fastify({ logger: false });
  const authService = new AuthService(store, mailer);

  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });

  app.setErrorHandler(errorHandler);

  await app.register(async (a) => healthRoutes(a));
  await app.register(async (a) => authRoutes(a, authService));
  await app.register(async (a) => metricsRoutes(a, authService));

  return { app, store, authService };
}
